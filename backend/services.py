import re
import secrets
import time
from datetime import datetime, timezone, timedelta
from typing import Literal
from uuid import UUID, uuid4
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from identity import owner
from safety import assess
from storage import database, list_records, read_record, save_record, timestamp

router = APIRouter(prefix="/api", tags=["Demo services"])


class HelpContact(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=10, max_length=30)
    relationship: str = Field(default="", max_length=60)

    @field_validator("phone")
    @classmethod
    def phone_number(cls, value):
        value = re.sub(r"[\s()-]", "", value)
        if not re.fullmatch(r"\+?[0-9]{10,15}", value) or set(value.replace("+", "")) == {"0"}:
            raise ValueError("Use a phone number with 10–15 digits and optional country code.")
        return value


@router.get("/help-contacts")
def help_contacts(request: Request):
    profile_id = owner(request)
    with database() as db:
        return list_records(db, profile_id, "help_contact")


@router.post("/help-contacts")
def save_help_contact(body: HelpContact, request: Request):
    profile_id = owner(request)
    with database() as db:
        rows = list_records(db, profile_id, "help_contact")
        if any(row["phone"] == body.phone for row in rows):
            raise HTTPException(409, "This number is already saved.")
        if len(rows) >= 8:
            raise HTTPException(409, "You can save up to eight trusted contacts.")
        record = {"id": str(uuid4()), **body.model_dump(), "created_at": timestamp()}
        save_record(db, profile_id, "help_contact", record)
        return record


@router.delete("/help-contacts/{contact_id}")
def remove_help_contact(contact_id: UUID, request: Request):
    profile_id = owner(request)
    with database() as db:
        if not read_record(db, profile_id, "help_contact", str(contact_id)):
            raise HTTPException(404, "Contact not found.")
        db.execute("DELETE FROM records WHERE id=? AND owner=? AND kind='help_contact'", (str(contact_id), profile_id))
    return {"deleted": True}


class BillRequest(BaseModel):
    provider: Literal["Demo Karnataka Electricity", "Demo City Electricity"]
    consumer_number: str = Field(pattern=r"^[0-9]{6,12}$")


@router.post("/bills/lookup")
def lookup_bill(value: BillRequest, request: Request):
    profile_id = owner(request)
    bill = {"id": str(uuid4()), "recipient": value.provider, "consumer_number": value.consumer_number,
            "amount": "850.00", "purpose": "Electricity bill", "due_date": (datetime.now(timezone(timedelta(hours=5, minutes=30))).date() + timedelta(days=7)).isoformat(),
            "demo_mode": True, "biller_status": "not_confirmed"}
    with database() as db:
        save_record(db, profile_id, "bill", bill)
    return bill


@router.post("/bills/{bill_id}/check")
def check_bill(bill_id: UUID, request: Request):
    profile_id = owner(request)
    with database() as db:
        bill = read_record(db, profile_id, "bill", str(bill_id))
        if not bill:
            raise HTTPException(404, "Bill not found.")
        payments = [p for p in list_records(db, profile_id, "payment") if p["bill_id"] == str(bill_id)]
        succeeded = next((p for p in payments if p["status"] == "success"), None)
        if succeeded and bill["biller_status"] != "demo_confirmed":
            bill["biller_status"] = "demo_confirmed"
            succeeded["biller_status"] = "demo_confirmed"
            succeeded["events"].append({"status": "biller_demo_confirmed", "at": timestamp()})
            save_record(db, profile_id, "payment", succeeded)
            save_record(db, profile_id, "bill", bill)
    return bill


class Incident(BaseModel):
    occurred_at: str = Field(min_length=1, max_length=80)
    amount: str = Field(default="", max_length=30)
    reference: str = Field(default="", max_length=100)
    contact_method: Literal["Call", "Message", "Website", "Other"] = "Call"
    description: str = Field(min_length=3, max_length=2000)
    evidence_notes: str = Field(default="", max_length=1000)


@router.get("/incidents")
def incidents(request: Request):
    profile_id = owner(request)
    with database() as db:
        return list_records(db, profile_id, "incident")


@router.post("/incidents")
def prepare_incident(value: Incident, request: Request):
    profile_id = owner(request)
    if re.search(r"(?:otp|pin|password|ओटीपी|ಪಿನ್)\s*(?:is|:|=)?\s*\d{4,}", value.description, re.I):
        raise HTTPException(422, "Remove financial secrets from your description before saving.")
    summary = (f"Incident preparation — not submitted\nWhen: {value.occurred_at}\nAmount: {value.amount or 'Not supplied'}\n"
               f"Payment reference: {value.reference or 'Not supplied'}\nContact: {value.contact_method}\n"
               f"What happened: {value.description}\nEvidence notes: {value.evidence_notes or 'Not supplied'}\n"
               "Review these details and report through your bank, 1930 or cybercrime.gov.in. This draft is not an official complaint or a recovery guarantee.")
    record = {"id": str(uuid4()), **value.model_dump(), "summary": summary, "status": "draft_not_submitted", "created_at": timestamp()}
    with database() as db:
        save_record(db, profile_id, "incident", record)
    return record


@router.delete("/incidents/{incident_id}")
def delete_incident(incident_id: UUID, request: Request):
    profile_id = owner(request)
    with database() as db:
        db.execute("DELETE FROM records WHERE id=? AND owner=? AND kind='incident'", (str(incident_id), profile_id))
        for state in list_records(db,profile_id,"fraud_chat"):
            if state["incident_id"] == str(incident_id):
                db.execute("DELETE FROM records WHERE id=? AND owner=? AND kind='fraud_chat'",(state["id"],profile_id))
    return {"deleted": True}


INSTRUCTIONS = {
 "payment_review": "Help me read the payment review: recipient, amount, reason and money leaving my account. I will make the final decision myself. No payment details are shared here.",
 "pending_payment": "Help me understand a pending payment. Check the existing receipt through Activity before making another attempt.",
 "report_fraud": "Help me find official reporting assistance. In India, financial cyber fraud can be reported through 1930 and cybercrime.gov.in. Contact the bank independently."
}


class Assistance(BaseModel):
    instruction: Literal["payment_review", "pending_payment", "report_fraud"]


@router.post("/assistance")
def grant_assistance(value: Assistance, request: Request):
    profile_id = owner(request)
    record = {"id": str(uuid4()), "token": secrets.token_urlsafe(32), "instruction": value.instruction,
              "text": INSTRUCTIONS[value.instruction], "expires": time.time() + 600, "revoked": False}
    with database() as db:
        save_record(db, profile_id, "assistance", record)
    return record


@router.get("/assistance/shared/{token}")
def shared_instruction(token: str):
    if len(token) > 100:
        raise HTTPException(404, "Help link unavailable.")
    with database() as db:
        rows = db.execute("SELECT data FROM records WHERE kind='assistance'").fetchall()
    import json
    for row in rows:
        record = json.loads(row["data"])
        if secrets.compare_digest(record["token"], token):
            if record["revoked"] or record["expires"] < time.time():
                raise HTTPException(410, "This help link expired or was stopped by its owner.")
            return {"text": record["text"], "expires": record["expires"], "permissions": ["read_instruction"]}
    raise HTTPException(404, "Help link unavailable.")


@router.delete("/assistance/{grant_id}")
def revoke_assistance(grant_id: UUID, request: Request):
    profile_id = owner(request)
    with database() as db:
        record = read_record(db, profile_id, "assistance", str(grant_id))
        if not record:
            raise HTTPException(404, "Help link not found.")
        record["revoked"] = True
        save_record(db, profile_id, "assistance", record)
    return {"revoked": True}


class Recipient(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    upi_id: str = Field(default="", max_length=194)
    phone: str = Field(default="", max_length=30)

    @field_validator("phone")
    @classmethod
    def phone_number(cls, value):
        return HelpContact.phone_number(value) if value else ""

    @field_validator("name")
    @classmethod
    def contact_name(cls, value):
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter a contact name.")
        return value


@router.get("/recipients")
def recipients(request: Request):
    profile_id = owner(request)
    with database() as db:
        return list_records(db, profile_id, "recipient")


@router.post("/recipients")
def save_recipient(value: Recipient, request: Request):
    profile_id = owner(request)
    from safety import parse_upi
    if value.upi_id:
        try:
            parse_upi("upi://pay?" + urlencode({"pa": value.upi_id}))
        except ValueError as exc:
            raise HTTPException(422, str(exc))
    record = {"id": str(uuid4()), **value.model_dump(), "identity_verified": False}
    from payment_contacts import demo_metadata
    record.update(demo_metadata(record))
    with database() as db:
        save_record(db, profile_id, "recipient", record)
    return record


@router.put("/recipients/{recipient_id}")
def edit_recipient(recipient_id: UUID, value: Recipient, request: Request):
    profile_id = owner(request)
    from payment_contacts import owned_contact
    previous = owned_contact(profile_id, recipient_id)
    if value.upi_id:
        from safety import parse_upi
        try:
            parse_upi("upi://pay?" + urlencode({"pa": value.upi_id}))
        except ValueError as exc:
            raise HTTPException(422, str(exc))
    record = {**previous, **value.model_dump(), "identity_verified":False}
    if previous["name"] != value.name:
        record.pop("aliases", None)
    # An edited address is user supplied, even when its name started as a demo.
    if any(previous.get(k, "") != record[k] for k in ("name", "phone", "upi_id")):
        record["demo"] = False
    with database() as db:
        save_record(db, profile_id, "recipient", record)
    return record


@router.delete("/recipients/{recipient_id}")
def delete_recipient(recipient_id: UUID, request: Request):
    profile_id = owner(request)
    with database() as db:
        db.execute("DELETE FROM records WHERE id=? AND owner=? AND kind='recipient'", (str(recipient_id), profile_id))
    return {"deleted": True}


IVR_MENUS = {
 "en-IN": "Choose 1 payment guidance, 2 bill help, 3 payment status, 4 scam help, 5 government services. Press 9 to repeat or 0 for the main menu.",
 "hi-IN": "भुगतान मदद के लिए 1, बिल के लिए 2, भुगतान स्थिति के लिए 3, धोखाधड़ी मदद के लिए 4, सरकारी सेवाओं के लिए 5 दबाएं। दोहराने के लिए 9, मुख्य मेनू के लिए 0।",
 "kn-IN": "ಪಾವತಿ ಸಹಾಯಕ್ಕೆ 1, ಬಿಲ್ ಸಹಾಯಕ್ಕೆ 2, ಪಾವತಿ ಸ್ಥಿತಿಗೆ 3, ವಂಚನೆ ಸಹಾಯಕ್ಕೆ 4, ಸರ್ಕಾರಿ ಸೇವೆಗಳಿಗೆ 5 ಒತ್ತಿ. ಮತ್ತೆ ಕೇಳಲು 9, ಮುಖ್ಯ ಮೆನುಗೆ 0."
}
IVR_TEXT = {
 "en-IN": {"recipient": "Choose a fictional recipient: 1 Ramesh, 2 Lakshmi.", "amount": "Choose an amount: 1 for 100 rupees, 2 for 500 rupees.", "purpose": "Choose a reason: 1 groceries, 2 a caller asked you to move money to a safe account.", "review": "Review these details in the app before any simulated payment. This telephone assistant cannot authorise a transfer.", "bill": "Use the Bills page to review a fictional electricity bill. Confirm the provider and amount.", "status": "Check your existing payment through Activity. A pending result is not a reason to pay again.", "fraud": "Stop the payment. Contact your bank independently. For financial cyber fraud in India, call 1930 or visit cybercrime.gov.in.", "services": "Find official pension and document services on the Services page. An application and approval are separate steps.", "invalid": "That key is not available. Try again. ", "silence": "No key was received. ", "warning": "Payment paused: a safe-account request is a scam warning. Contact your bank independently."},
 "hi-IN": {"recipient": "काल्पनिक नाम चुनें: रमेश के लिए 1, लक्ष्मी के लिए 2।", "amount": "100 रुपये के लिए 1, 500 रुपये के लिए 2।", "purpose": "किराने के लिए 1, कॉल करने वाले ने सुरक्षित खाते में पैसे भेजने को कहा तो 2।", "review": "ऐप में नाम, रकम और कारण जाँचें। फोन सहायक भुगतान की मंजूरी नहीं देता।", "bill": "बिल पेज पर काल्पनिक बिजली बिल, प्रदाता और रकम जाँचें।", "status": "गतिविधि में पुराने भुगतान की स्थिति देखें। लंबित भुगतान दोबारा न करें।", "fraud": "भुगतान रोकें। बैंक से स्वतंत्र रूप से संपर्क करें। आर्थिक साइबर धोखाधड़ी के लिए भारत में 1930 या cybercrime.gov.in पर रिपोर्ट करें।", "services": "सेवा पेज पर आधिकारिक पेंशन और दस्तावेज सेवाएं देखें। आवेदन और मंजूरी अलग हैं।", "invalid": "यह बटन उपलब्ध नहीं है। फिर कोशिश करें। ", "silence": "कोई बटन नहीं दबाया गया। ", "warning": "भुगतान रोका गया। सुरक्षित खाते में पैसे भेजने की मांग संदिग्ध है। अपने बैंक से संपर्क करें।"},
 "kn-IN": {"recipient": "ಕಾಲ್ಪನಿಕ ಹೆಸರು ಆರಿಸಿ: ರಮೇಶ್‌ಗೆ 1, ಲಕ್ಷ್ಮಿಗೆ 2.", "amount": "100 ರೂಪಾಯಿಗೆ 1, 500 ರೂಪಾಯಿಗೆ 2.", "purpose": "ದಿನಸಿಗೆ 1, ಕರೆ ಮಾಡಿದವರು ಸುರಕ್ಷಿತ ಖಾತೆಗೆ ಹಣ ಕಳುಹಿಸಲು ಹೇಳಿದ್ದರೆ 2.", "review": "ಆಪ್‌ನಲ್ಲಿ ಹೆಸರು, ಮೊತ್ತ ಮತ್ತು ಕಾರಣ ಪರಿಶೀಲಿಸಿ. ಫೋನ್ ಸಹಾಯಕ ಪಾವತಿಗೆ ಅನುಮತಿ ನೀಡುವುದಿಲ್ಲ.", "bill": "ಬಿಲ್ ಪುಟದಲ್ಲಿ ಕಾಲ್ಪನಿಕ ವಿದ್ಯುತ್ ಬಿಲ್, ಸಂಸ್ಥೆ ಮತ್ತು ಮೊತ್ತ ಪರಿಶೀಲಿಸಿ.", "status": "ಚಟುವಟಿಕೆಯಲ್ಲಿ ಹಳೆಯ ಪಾವತಿ ಸ್ಥಿತಿ ನೋಡಿ. ಬಾಕಿ ಪಾವತಿ ಮತ್ತೆ ಮಾಡಬೇಡಿ.", "fraud": "ಪಾವತಿ ನಿಲ್ಲಿಸಿ. ಬ್ಯಾಂಕ್‌ಗೆ ಸ್ವತಂತ್ರವಾಗಿ ಸಂಪರ್ಕಿಸಿ. ಭಾರತದಲ್ಲಿ ಆರ್ಥಿಕ ಸೈಬರ್ ವಂಚನೆಯನ್ನು 1930 ಅಥವಾ cybercrime.gov.in ಮೂಲಕ ವರದಿ ಮಾಡಿ.", "services": "ಸೇವೆ ಪುಟದಲ್ಲಿ ಅಧಿಕೃತ ಪಿಂಚಣಿ ಮತ್ತು ದಾಖಲೆ ಸೇವೆಗಳನ್ನು ನೋಡಿ. ಅರ್ಜಿ ಮತ್ತು ಅನುಮೋದನೆ ಬೇರೆ ಹಂತಗಳು.", "invalid": "ಈ ಕೀ ಲಭ್ಯವಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ. ", "silence": "ಯಾವುದೇ ಕೀ ಬಂದಿಲ್ಲ. ", "warning": "ಪಾವತಿ ನಿಲ್ಲಿಸಲಾಗಿದೆ. ಸುರಕ್ಷಿತ ಖಾತೆಗೆ ಹಣ ಕಳುಹಿಸುವ ಬೇಡಿಕೆ ಅನುಮಾನಾಸ್ಪದ. ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ ಸಂಪರ್ಕಿಸಿ."}
}


class KeypadInput(BaseModel):
    session_id: UUID | None = None
    key: str = Field(default="", max_length=1)
    language: Literal["en-IN", "hi-IN", "kn-IN"] = "en-IN"


@router.post("/ivr/key")
def keypad(value: KeypadInput, request: Request):
    profile_id = owner(request)
    with database() as db:
        state = read_record(db, profile_id, "ivr", str(value.session_id)) if value.session_id else None
        if value.session_id and (not state or state["expires"] < time.time()):
            raise HTTPException(410, "Your demo call expired. Start a new call.")
        state = state or {"id": str(uuid4()), "step": "main", "details": {}, "expires": time.time() + 600}
        prompts = IVR_TEXT[value.language]
        key = value.key
        prefix = ""
        if key == "0":
            state.update(step="main", details={})
        elif key == "9" or not value.session_id:
            pass
        elif key == "":
            prefix = prompts["silence"]
        elif state["step"] == "main" and key in "12345":
            state["step"] = {"1": "recipient", "2": "bill", "3": "status", "4": "fraud", "5": "services"}[key]
        elif state["step"] == "recipient" and key in "12":
            state["details"]["recipient"] = "Ramesh" if key == "1" else "Lakshmi"
            state["step"] = "amount"
        elif state["step"] == "amount" and key in "12":
            state["details"]["amount"] = "100.00" if key == "1" else "500.00"
            state["step"] = "purpose"
        elif state["step"] == "purpose" and key in "12":
            state["details"]["purpose"] = "Groceries" if key == "1" else "Caller asked for a safe account transfer"
            state["safety"] = assess(state["details"]["purpose"])
            state["step"] = "warning" if state["safety"]["paused"] else "review"
        else:
            prefix = prompts["invalid"]
        state["expires"] = time.time() + 600
        state["reply"] = prefix + (IVR_MENUS[value.language] if state["step"] == "main" else prompts[state["step"]])
        state["next_action"] = {"bill": "/bills", "status": "/activity", "fraud": "/help", "warning": "/help", "services": "/services", "review": "/send-money"}.get(state["step"])
        save_record(db, profile_id, "ivr", state)
    return {"session_id": state["id"], "step": state["step"], "reply": state["reply"], "details": state["details"], "next_action": state["next_action"], "demo_mode": True}
