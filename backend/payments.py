import hashlib
import json
import secrets
import time
import re
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, ValidationInfo
from identity import owner
from safety import assess, parse_upi
from storage import database, list_records, read_record, save_record, timestamp

router = APIRouter(prefix="/api", tags=["Mock payments"])


class PaymentRequest(BaseModel):
    recipient: str = Field(min_length=2, max_length=80)
    amount: Decimal = Field(gt=0, le=100000, decimal_places=2, allow_inf_nan=False)
    purpose: str = Field(min_length=3, max_length=250)
    upi_id: str = Field(default="", max_length=194)
    phone: str = Field(default="", max_length=30)
    recipient_id: UUID | None = None
    frequency: Literal["one_time", "recurring"] = "one_time"
    direction: Literal["outgoing", "incoming"] = "outgoing"
    bill_id: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        value = re.sub(r"[\s()-]", "", value)
        if value and (not re.fullmatch(r"\+?[0-9]{10,15}", value) or set(value.replace("+", "")) == {"0"}):
            raise ValueError("Use a mobile number with 10–15 digits.")
        return value

    @field_validator("upi_id")
    @classmethod
    def validate_address(cls, value):
        if value and not re.fullmatch(r"[a-zA-Z0-9._-]{2,128}@[a-zA-Z0-9.-]{2,64}", value):
            raise ValueError("Please provide a valid UPI address without extra instructions.")
        return value

    @field_validator("recipient", "purpose")
    @classmethod
    def strip_fields(cls, value, info: ValidationInfo):
        value = value.strip()
        if len(value) < (2 if info.field_name == "recipient" else 3):
            raise ValueError("Please provide enough information for this field.")
        return value


def validate_saved_destination(db, profile_id, fields):
    if not fields.get("recipient_id"):
        return None
    contact = read_record(db, profile_id, "recipient", str(fields["recipient_id"]))
    if not contact or any(contact.get(k, "") != fields.get(k, "") for k in ("upi_id", "phone")) or contact["name"] != fields["recipient"]:
        raise HTTPException(409, "Saved contact details changed. Choose the contact again before payment review.")
    if not fields.get("upi_id") and not fields.get("phone"):
        raise HTTPException(422, "Add a payment address or mobile number to this contact first.")
    return contact


def public_draft(draft):
    return {k:v for k,v in draft.items() if k not in {"review_token", "confirmed_until", "context", "source_signature"}}


def prepare_draft(profile_id, payment, draft_id=None, conversation_context=""):
    fields = payment.model_dump(mode="json")
    fields["amount"] = f"{payment.amount:.2f}"
    if payment.upi_id:
        try:
            parse_upi("upi://pay?" + urlencode({"pa": payment.upi_id}))
        except ValueError as exc:
            raise HTTPException(422, str(exc))
    with database() as db:
        contact = validate_saved_destination(db, profile_id, fields)
        if contact:
            fields["contact_demo"] = contact.get("demo", False)
        old = read_record(db, profile_id, "draft", draft_id) if draft_id else None
        if draft_id and not old:
            raise HTTPException(404, "Payment draft not found.")
        if old and old["state"] == "handoff_issued":
            raise HTTPException(409, "This draft already has a payment attempt. Check its receipt.")
        if payment.bill_id:
            bill = read_record(db, profile_id, "bill", payment.bill_id)
            if not bill or bill["recipient"] != payment.recipient or bill["amount"] != fields["amount"] or payment.purpose != "Electricity bill" or payment.upi_id or payment.phone or payment.recipient_id:
                raise HTTPException(409, "Bill details changed. Retrieve the bill again.")
            fields["consumer_number"] = bill["consumer_number"]
        context = ((old.get("context", old["purpose"])[:3000] + " ") if old else conversation_context[-4000:] + " ") + payment.purpose
        safety = assess(context, payment.frequency, payment.direction)
        if old and old["risk_level"] == "strong_warning":
            for signal in old["signals"]:
                if signal["code"] not in {s["code"] for s in safety["signals"]}:
                    safety["signals"].append(signal)
            safety.update(risk_level="strong_warning", paused=True, message="This task remains paused. Start a different task only after independently verifying the request.", reasons=[s["noticed"] for s in safety["signals"]])
        # Unresolved attempts for the same recipient and amount block new attempts.
        duplicate = next((p for p in list_records(db, profile_id, "payment") if p["recipient"].casefold() == payment.recipient.casefold() and p["amount"] == fields["amount"] and p["status"] in {"pending", "unknown"}), None)
        if duplicate:
            # An unresolved receipt must never downgrade a strong fraud warning.
            safety["signals"].append({"code": "duplicate", "level": "needs_clarification", "noticed": "An earlier payment to this recipient is unresolved.", "action": "Check the existing receipt before trying again."})
            safety.update(paused=True, transaction_id=duplicate["transaction_id"],
                          risk_level="strong_warning" if safety["risk_level"] == "strong_warning" else "needs_clarification",
                          reasons=[s["noticed"] for s in safety["signals"]])
            if safety["risk_level"] != "strong_warning":
                safety["message"] = "An earlier payment has no final result. Check its status before paying again."
        draft = {"id": draft_id or str(uuid4()), **fields, **safety, "context": context, "revision": old["revision"] + 1 if old else 1,
                 "state": "safety_paused" if safety["paused"] else "needs_review", "review_token": None,
                 "confirmed_until": 0, "created_at": old["created_at"] if old else timestamp(), "identity_verified": False}
        save_record(db, profile_id, "draft", draft)
    return draft


@router.get("/payments/drafts/{draft_id}")
def get_draft(draft_id: UUID, request: Request):
    profile_id = owner(request)
    with database() as db:
        draft = read_record(db, profile_id, "draft", str(draft_id))
    if not draft:
        raise HTTPException(404, "Payment draft not found.")
    return public_draft(draft)


@router.post("/payments/review")
def review_payment(payment: PaymentRequest, request: Request):
    return prepare_draft(owner(request), payment)


@router.put("/payments/drafts/{draft_id}")
def change_draft(draft_id: UUID, payment: PaymentRequest, request: Request):
    return prepare_draft(owner(request), payment, str(draft_id))


class Confirmation(BaseModel):
    revision: int
    recipient: str
    amount: Decimal
    direction: Literal["outgoing"]


@router.post("/payments/drafts/{draft_id}/confirm")
def confirm_draft(draft_id: UUID, confirmation: Confirmation, request: Request):
    return confirm_for_owner(owner(request), str(draft_id), confirmation)


def confirm_for_owner(profile_id, draft_id, confirmation):
    with database() as db:
        draft = read_record(db, profile_id, "draft", str(draft_id))
        if not draft:
            raise HTTPException(404, "Payment draft not found.")
        if draft["state"] not in {"needs_review", "ready_for_handoff"} or draft["paused"]:
            raise HTTPException(409, "This payment cannot advance. Change or cancel it.")
        validate_saved_destination(db, profile_id, draft)
        if confirmation.revision != draft["revision"] or confirmation.recipient != draft["recipient"] or f"{confirmation.amount:.2f}" != draft["amount"]:
            raise HTTPException(409, "Details changed. Review and confirm them again.")
        if draft["state"] != "ready_for_handoff" or draft["confirmed_until"] < time.time():
            draft.update(state="ready_for_handoff", review_token=secrets.token_urlsafe(32), confirmed_until=time.time() + 300)
        save_record(db, profile_id, "draft", draft)
    return {"review_token": draft["review_token"], "expires_in": 300}


@router.post("/payments/drafts/{draft_id}/cancel")
def cancel_draft(draft_id: UUID, request: Request):
    profile_id = owner(request)
    with database() as db:
        draft = read_record(db, profile_id, "draft", str(draft_id))
        if not draft:
            raise HTTPException(404, "Draft not found.")
        if draft["state"] == "handoff_issued":
            raise HTTPException(409, "A payment attempt already exists. Check its status.")
        draft.update(state="cancelled", review_token=None, confirmed_until=0)
        save_record(db, profile_id, "draft", draft)
    return {"cancelled": True}


class DemoPaymentInput(BaseModel):
    draft_id: UUID
    review_token: str = Field(min_length=20, max_length=100)
    request_id: UUID
    result: Literal["success", "failed", "pending", "unknown"] = "success"


MESSAGES = {"success": "The mock provider reports success. No real money was transferred.",
            "failed": "The mock provider reports failure. No real money was transferred.",
            "pending": "The mock provider is still processing. Check this receipt instead of sending again.",
            "unknown": "No result is available yet. Check this receipt before trying another payment."}


@router.post("/demo-payments")
def simulate_payment(payment: DemoPaymentInput, request: Request):
    return simulate_for_owner(owner(request), payment)


def simulate_for_owner(profile_id, payment):
    fingerprint = hashlib.sha256(json.dumps(payment.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()
    with database() as db:
        old = db.execute("SELECT * FROM attempts WHERE owner=? AND request_id=?", (profile_id, str(payment.request_id))).fetchone()
        if old:
            if old["fingerprint"] != fingerprint:
                raise HTTPException(409, "This request ID was already used for different details.")
            return read_record(db, profile_id, "payment", old["transaction_id"])
        draft = read_record(db, profile_id, "draft", str(payment.draft_id))
        if not draft:
            raise HTTPException(404, "Draft not found.")
        if draft["state"] != "ready_for_handoff" or not secrets.compare_digest(draft["review_token"] or "", payment.review_token) or draft["confirmed_until"] < time.time():
            raise HTTPException(409, "Confirmation expired or details changed. Review the payment again.")
        validate_saved_destination(db, profile_id, draft)
        if assess(draft.get("context", draft["purpose"]), draft["frequency"], draft["direction"])["paused"]:
            raise HTTPException(409, "Payment safety review requires clarification.")
        if any(p["recipient"].casefold() == draft["recipient"].casefold() and p["amount"] == draft["amount"] and p["status"] in {"pending", "unknown"} for p in list_records(db, profile_id, "payment")):
            raise HTTPException(409, "A matching payment is still unresolved. Check its receipt.")
        transaction_id = str(uuid4())
        now = timestamp()
        record = {"id": transaction_id, "transaction_id": transaction_id,
                  **{k: draft[k] for k in ("recipient", "amount", "purpose", "upi_id", "frequency", "bill_id")},
                  "status": payment.result, "message": MESSAGES[payment.result], "demo_mode": True,
                  "consumer_number": draft.get("consumer_number"),
                  "phone":draft.get("phone", ""), "recipient_id":draft.get("recipient_id"), "contact_demo":draft.get("contact_demo", False),
                  "provider": "mock", "created_at": now, "updated_at": now, "checks": 0,
                  "biller_status": "not_confirmed" if draft["bill_id"] else None,
                  "events": [{"status": "ready_for_handoff", "at": now}, {"status": "handoff_issued", "at": now}, {"status": payment.result, "at": now}]}
        db.execute("INSERT INTO attempts VALUES(?,?,?,?)", (profile_id, str(payment.request_id), fingerprint, transaction_id))
        save_record(db, profile_id, "payment", record)
        draft.update(state="handoff_issued", transaction_id=transaction_id)
        save_record(db, profile_id, "draft", draft)
    return record


@router.get("/demo-payments/history")
def history(request: Request):
    profile_id = owner(request)
    with database() as db:
        return list_records(db, profile_id, "payment")


@router.get("/demo-payments/{transaction_id}")
def get_payment(transaction_id: UUID, request: Request):
    profile_id = owner(request)
    with database() as db:
        record = read_record(db, profile_id, "payment", str(transaction_id))
    if not record:
        raise HTTPException(404, "Transaction not found in this demo profile.")
    return record


@router.post("/demo-payments/{transaction_id}/check")
def reconcile_payment(transaction_id: UUID, request: Request):
    profile_id = owner(request)
    with database() as db:
        record = read_record(db, profile_id, "payment", str(transaction_id))
        if not record:
            raise HTTPException(404, "Transaction not found.")
        if record["status"] in {"pending", "unknown"}:
            record["checks"] += 1
            # Deterministic mock progression: unknown -> pending -> success.
            record["status"] = "pending" if record["status"] == "unknown" or record["checks"] == 1 else "success"
            record["message"] = MESSAGES[record["status"]]
            record["updated_at"] = timestamp()
            record["events"].append({"status": record["status"], "at": record["updated_at"]})
            save_record(db, profile_id, "payment", record)
    return record


class QRRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2048)
    intended_recipient: str = ""
    intended_amount: Decimal | None = None
    direction: Literal["outgoing", "incoming"] = "outgoing"


@router.post("/qr/check")
def check_qr(qr: QRRequest):
    try:
        result = parse_upi(qr.content)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    mismatch = []
    if qr.direction == "incoming":
        mismatch.append("You want to receive money, but this QR sends money out.")
    if qr.intended_recipient and qr.intended_recipient.casefold() not in {result["recipient"].casefold(), result["upi_id"].casefold()}:
        mismatch.append("The QR recipient differs from the recipient you expected.")
    if qr.intended_amount is not None and result["amount"] and qr.intended_amount != Decimal(result["amount"]):
        mismatch.append("The QR amount differs from the amount you expected.")
    return {**result, "mismatches": mismatch, "paused": bool(mismatch)}


class SafetyRequest(BaseModel):
    text: str = Field(min_length=3, max_length=2000)


@router.post("/safety/check")
def check_message(value: SafetyRequest):
    return assess(value.text)
