"""Paired IVR workflow and signed gateway interface; transfers are mock-only."""
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from decimal import Decimal
from threading import RLock
from typing import Literal
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from identity import owner
from storage import database, list_records, read_record, save_record, timestamp
from payments import PaymentRequest, Confirmation, DemoPaymentInput, prepare_draft, confirm_for_owner, simulate_for_owner

router = APIRouter(prefix="/api/phone", tags=["Paired telephone assistant"])
call_lock = RLock()  # Local demo. A production gateway must serialize each call.
auth_buffers = {}
LANG = Literal["en-IN", "hi-IN", "kn-IN"]
TEXT = {
 "en-IN": {"auth":"Enter your six-digit Easy Pay call code, then #. This is not your bank PIN.", "main":"Press 1 to send money, 2 for payment status, 3 for scam help. Press 9 to repeat. * ends the call.", "recipient":"Choose a saved recipient: {names}. 0 returns to the menu.", "empty":"Save a recipient on the website before making a phone payment. Press 0 for the menu.", "amount":"Enter the amount in whole rupees, then #. Maximum 10,000 rupees. * ends the call.", "purpose":"Press 1 for groceries, 2 for medicine, 3 for family expenses, 4 if a caller asked you to move money to a safe account.", "review":"You want to send {amount} rupees to {recipient} for {purpose}. Money would leave your account. This is a demo. Press 1 to confirm a simulated payment, 2 to change the amount, or * to cancel.", "warning":"Danger. Do not send money. A safe-account request is a scam warning. Contact your bank independently. Press 3 for scam help or * to end.", "status":"Latest demo payment: {recipient}, {amount} rupees, {status}. Check a pending result before paying again. 0 returns to the menu.", "no_status":"There are no payments in this profile. Press 0 for the menu.", "fraud":"For financial cyber fraud in India, call 1930. Your reporting assistant is available on the website. Press * to end.", "done":"The simulated payment is complete. No real money moved. Your receipt is saved in website Activity. Press * to end.", "end":"Call ended. No new payment was made.", "invalid":"That input is not valid. ", "limit":"Use a whole-rupee amount from 1 to 10,000. ", "bad_code":"Call code not accepted. ", "locked":"Too many unsuccessful codes. End this call and try later.", "paused":"An earlier payment is unresolved. Check its receipt in Activity before another payment. Press 0 for the menu."},
 "hi-IN": {"auth":"Easy Pay का छह अंकों वाला कॉल कोड डालें, फिर # दबाएं। यह बैंक पिन नहीं है।", "main":"पैसे भेजने के लिए 1, भुगतान स्थिति के लिए 2, धोखाधड़ी मदद के लिए 3। दोहराने के लिए 9, कॉल समाप्त करने के लिए *।", "recipient":"सहेजा नाम चुनें: {names}। मेनू के लिए 0।", "empty":"फोन भुगतान से पहले वेबसाइट पर प्राप्तकर्ता सहेजें। मेनू के लिए 0।", "amount":"पूरे रुपये में रकम डालें, फिर #। अधिकतम 10,000 रुपये। कॉल समाप्त करने के लिए *।", "purpose":"किराने के लिए 1, दवा के लिए 2, परिवार खर्च के लिए 3, कॉल करने वाले ने सुरक्षित खाते में पैसे भेजने को कहा तो 4।", "review":"आप {purpose} के लिए {recipient} को {amount} रुपये भेजना चाहते हैं। पैसे खाते से जाएंगे। यह डेमो है। नकली भुगतान की पुष्टि के लिए 1, रकम बदलने के लिए 2, रद्द करने के लिए *।", "warning":"खतरा। पैसे न भेजें। सुरक्षित खाते में पैसे भेजने की मांग धोखाधड़ी का संकेत है। अपने बैंक से संपर्क करें। धोखाधड़ी मदद के लिए 3 या समाप्त करने के लिए *।", "status":"आखिरी डेमो भुगतान: {recipient}, {amount} रुपये, {status}। लंबित भुगतान दोबारा न करें। मेनू के लिए 0।", "no_status":"कोई भुगतान नहीं है। मेनू के लिए 0।", "fraud":"आर्थिक साइबर धोखाधड़ी के लिए 1930 पर कॉल करें। रिपोर्ट सहायक वेबसाइट पर है। समाप्त करने के लिए *।", "done":"नकली भुगतान पूरा हुआ। असली पैसे नहीं गए। रसीद वेबसाइट की गतिविधि में है। समाप्त करने के लिए *।", "end":"कॉल समाप्त हुई। कोई नया भुगतान नहीं हुआ।", "invalid":"यह विकल्प सही नहीं है। ", "limit":"1 से 10,000 तक पूरे रुपये डालें। ", "bad_code":"कॉल कोड सही नहीं है। ", "locked":"कई गलत कोड आए। कॉल समाप्त करके बाद में कोशिश करें।", "paused":"पहला भुगतान लंबित है। गतिविधि में रसीद जाँचें। मेनू के लिए 0।"},
 "kn-IN": {"auth":"Easy Pay ಆರು ಅಂಕಿಯ ಕರೆ ಕೋಡ್ ನಮೂದಿಸಿ, ನಂತರ # ಒತ್ತಿ. ಇದು ಬ್ಯಾಂಕ್ ಪಿನ್ ಅಲ್ಲ.", "main":"ಹಣ ಕಳುಹಿಸಲು 1, ಪಾವತಿ ಸ್ಥಿತಿಗೆ 2, ವಂಚನೆ ಸಹಾಯಕ್ಕೆ 3. ಮತ್ತೆ ಕೇಳಲು 9. ಕರೆ ಮುಗಿಸಲು *.", "recipient":"ಉಳಿಸಿದ ಹೆಸರು ಆರಿಸಿ: {names}. ಮೆನುಗೆ 0.", "empty":"ಫೋನ್ ಪಾವತಿಗೆ ಮೊದಲು ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಸ್ವೀಕರಿಸುವವರನ್ನು ಉಳಿಸಿ. ಮೆನುಗೆ 0.", "amount":"ಪೂರ್ಣ ರೂಪಾಯಿಗಳಲ್ಲಿ ಮೊತ್ತ ನಮೂದಿಸಿ, ನಂತರ #. ಗರಿಷ್ಠ 10,000 ರೂಪಾಯಿ. ಕರೆ ಮುಗಿಸಲು *.", "purpose":"ದಿನಸಿಗೆ 1, ಔಷಧಿಗೆ 2, ಕುಟುಂಬ ಖರ್ಚಿಗೆ 3, ಕರೆ ಮಾಡಿದವರು ಸುರಕ್ಷಿತ ಖಾತೆಗೆ ಹಣ ಕಳುಹಿಸಲು ಹೇಳಿದ್ದರೆ 4.", "review":"ನೀವು {purpose}ಗಾಗಿ {recipient} ಅವರಿಗೆ {amount} ರೂಪಾಯಿ ಕಳುಹಿಸಲು ಬಯಸುತ್ತೀರಿ. ಹಣ ಖಾತೆಯಿಂದ ಹೊರಹೋಗುತ್ತದೆ. ಇದು ಡೆಮೋ. ಕಾಲ್ಪನಿಕ ಪಾವತಿ ಒಪ್ಪಲು 1, ಮೊತ್ತ ಬದಲಿಸಲು 2, ರದ್ದು ಮಾಡಲು *.", "warning":"ಅಪಾಯ. ಹಣ ಕಳುಹಿಸಬೇಡಿ. ಸುರಕ್ಷಿತ ಖಾತೆಗೆ ಹಣ ಕಳುಹಿಸುವ ಬೇಡಿಕೆ ವಂಚನೆಯ ಸೂಚನೆ. ಬ್ಯಾಂಕ್‌ಗೆ ಸ್ವತಂತ್ರವಾಗಿ ಸಂಪರ್ಕಿಸಿ. ವಂಚನೆ ಸಹಾಯಕ್ಕೆ 3 ಅಥವಾ ಮುಗಿಸಲು *.", "status":"ಕೊನೆಯ ಡೆಮೋ ಪಾವತಿ: {recipient}, {amount} ರೂಪಾಯಿ, {status}. ಬಾಕಿ ಪಾವತಿಯನ್ನು ಮತ್ತೆ ಮಾಡಬೇಡಿ. ಮೆನುಗೆ 0.", "no_status":"ಇನ್ನೂ ಪಾವತಿಗಳಿಲ್ಲ. ಮೆನುಗೆ 0.", "fraud":"ಆರ್ಥಿಕ ಸೈಬರ್ ವಂಚನೆಗೆ 1930ಕ್ಕೆ ಕರೆ ಮಾಡಿ. ವರದಿ ಸಹಾಯಕ ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಇದೆ. ಮುಗಿಸಲು *.", "done":"ಕಾಲ್ಪನಿಕ ಪಾವತಿ ಪೂರ್ಣವಾಗಿದೆ. ನಿಜವಾದ ಹಣ ಹೋಗಿಲ್ಲ. ರಸೀದಿ ವೆಬ್‌ಸೈಟ್ ಚಟುವಟಿಕೆಯಲ್ಲಿ ಉಳಿದಿದೆ. ಮುಗಿಸಲು *.", "end":"ಕರೆ ಮುಗಿದಿದೆ. ಹೊಸ ಪಾವತಿ ಆಗಿಲ್ಲ.", "invalid":"ಈ ಆಯ್ಕೆ ಸರಿಯಿಲ್ಲ. ", "limit":"1 ರಿಂದ 10,000ವರೆಗಿನ ಪೂರ್ಣ ರೂಪಾಯಿ ನಮೂದಿಸಿ. ", "bad_code":"ಕರೆ ಕೋಡ್ ಸರಿಯಿಲ್ಲ. ", "locked":"ಹಲವು ತಪ್ಪು ಕೋಡ್‌ಗಳು ಬಂದಿವೆ. ಕರೆ ಮುಗಿಸಿ ನಂತರ ಪ್ರಯತ್ನಿಸಿ.", "paused":"ಹಿಂದಿನ ಪಾವತಿ ಬಾಕಿ ಇದೆ. ಚಟುವಟಿಕೆಯಲ್ಲಿ ರಸೀದಿ ನೋಡಿ. ಮೆನುಗೆ 0."}
}

def normalize_phone(value):
    value = re.sub(r"[\s()-]", "", value)
    if re.fullmatch(r"[6-9]\d{9}", value):
        value = "+91" + value
    if not re.fullmatch(r"\+[1-9]\d{9,14}", value):
        raise ValueError("Use a phone number with country code, for example +91 followed by 10 digits.")
    return value

class Pair(BaseModel):
    phone: str = Field(max_length=30)
    language: LANG = "en-IN"
    consent: Literal[True]
    @field_validator("phone")
    @classmethod
    def valid_phone(cls,value):
        return normalize_phone(value)

def digest_code(code, salt):
    return hashlib.scrypt(code.encode(),salt=bytes.fromhex(salt),n=2**14,r=8,p=1).hex()

def public_pair(pair):
    return {"id":pair["id"], "phone":pair["phone"], "language":pair["language"], "phone_verified":False, "payment_limit":10000, "mode":"demo", "gateway_configured":len(os.getenv("TELEPHONY_WEBHOOK_SECRET",""))>=32, "live_payments":False}

@router.get("/connection")
def connection(request:Request):
    profile_id = owner(request)
    with database() as db:
        pairs = list_records(db,profile_id,"phone_connection")
    return public_pair(pairs[0]) if pairs else None

@router.post("/connection")
def pair_phone(body:Pair, request:Request):
    profile_id = owner(request)
    code = str(secrets.randbelow(900000)+100000)
    salt = secrets.token_hex(16)
    with database() as db:
        for row in db.execute("SELECT owner,data FROM records WHERE kind='phone_connection'"):
            if json.loads(row["data"])["phone"] == body.phone and row["owner"] != profile_id:
                raise HTTPException(409,"This phone is already linked. Disconnect it from the other profile first.")
        db.execute("DELETE FROM records WHERE owner=? AND kind IN ('phone_connection','phone_call')",(profile_id,))
        pair = {"id":str(uuid4()), "phone":body.phone, "language":body.language, "code_hash":digest_code(code,salt), "salt":salt, "failures":0, "locked_until":0, "created_at":timestamp()}
        save_record(db,profile_id,"phone_connection",pair)
    return {**public_pair(pair), "call_code":code}

@router.delete("/connection")
def disconnect(request:Request):
    profile_id = owner(request)
    with database() as db:
        db.execute("DELETE FROM records WHERE owner=? AND kind IN ('phone_connection','phone_call')",(profile_id,))
    return {"disconnected":True}

def new_call(profile_id, pair, call_id=None):
    state = {"id":str(uuid4()), "connection_id":pair["id"], "external_call_id":call_id, "language":pair["language"], "step":"auth", "buffer":"", "details":{}, "expires":time.time()+600, "events":{}, "payment_request_id":str(uuid4()), "authenticated":False}
    with database() as db:
        active = list_records(db,profile_id,"phone_call")
        if call_id:
            existing = next((c for c in active if c.get("external_call_id")==call_id),None)
            if existing:
                return existing
        if len([c for c in active if c["expires"] > time.time() and c["step"] != "end"]) >= 3:
            raise HTTPException(429,"End the existing calls before starting another.")
        save_record(db,profile_id,"phone_call",state)
    return state

def view(state):
    p = TEXT[state["language"]]
    step = state["step"]
    fields = {**state["details"], "names":", ".join(f"{i+1} {r['name']}" for i,r in enumerate(state.get("recipients",[])))}
    if state["language"] != "en-IN":
        native = {"hi-IN":{"Groceries":"किराना","Medicine":"दवा","Family expenses":"परिवार खर्च","success":"सफल","pending":"लंबित","failed":"विफल","unknown":"अज्ञात"},"kn-IN":{"Groceries":"ದಿನಸಿ","Medicine":"ಔಷಧಿ","Family expenses":"ಕುಟುಂಬ ಖರ್ಚು","success":"ಯಶಸ್ವಿ","pending":"ಬಾಕಿ","failed":"ವಿಫಲ","unknown":"ಅಜ್ಞಾತ"}}[state["language"]]
        fields = {k:native.get(v,v) for k,v in fields.items()}
    reply = state.get("prefix","") + p[step].format(**fields)
    if step == "auth":
        state = {**state, "buffer":auth_buffers.get(state["id"],("",0))[0]}
    return {"session_id":state["id"], "step":step, "reply":reply, "details":state["details"], "entered_digits":len(state["buffer"]), "language":state["language"], "demo_mode":True, "payment_limit":10000, "receipt_id":state.get("receipt_id"), "next_action":"/help/fraud" if step in {"warning","fraud"} else "/activity" if step in {"paused","status","done"} else None, "end_call":step in {"end","locked"}}

class Key(BaseModel):
    session_id: UUID
    event_id: UUID = Field(default_factory=uuid4)
    key: str = Field(pattern=r"^[0-9*#]?$", default="")

def advance(profile_id,state,key,event_id):
    with call_lock:
        with database() as db:
            state = read_record(db,profile_id,"phone_call",state["id"])
            pair = read_record(db,profile_id,"phone_connection",state["connection_id"]) if state else None
        if not state or not pair or state["expires"] < time.time():
            raise HTTPException(410,"This call expired or was disconnected. Start again.")
        fingerprint = hashlib.sha256(key.encode()).hexdigest()
        prior = state["events"].get(event_id)
        if prior:
            if prior["fingerprint"] is not None and prior["fingerprint"] != fingerprint:
                raise HTTPException(409,"This event already carried a different key.")
            return prior["response"]
        p = TEXT[state["language"]]
        state["prefix"] = ""
        step = state["step"]
        if step in {"end","locked"}:
            pass
        elif key == "*":
            auth_buffers.pop(state["id"],None)
            state.update(step="end", buffer="")
        elif step == "auth":
            if pair["locked_until"] > time.time():
                state["step"] = "locked"
            elif key == "#":
                code = auth_buffers.pop(state["id"],("",0))[0]
                accepted = len(code) == 6 and secrets.compare_digest(digest_code(code,pair["salt"]),pair["code_hash"])
                if accepted:
                    state.update(step="main",authenticated=True)
                    pair.update(failures=0, locked_until=0)
                else:
                    pair["failures"] += 1
                    state["prefix"] = p["bad_code"]
                    if pair["failures"] >= 5:
                        pair["locked_until"] = time.time()+300
                        state["step"] = "locked"
                with database() as db:
                    save_record(db,profile_id,"phone_connection",pair)
            elif key.isdigit():
                for call_id,(_,expires) in list(auth_buffers.items()):
                    if expires < time.time():
                        auth_buffers.pop(call_id,None)
                code = auth_buffers.get(state["id"],("",0))[0]
                if len(code) < 6:
                    auth_buffers[state["id"]] = (code+key,state["expires"])
        elif step == "amount":
            if key == "#":
                amount = int(state["buffer"] or "0")
                state["buffer"] = ""
                if 1 <= amount <= 10000:
                    state["details"]["amount"] = f"{amount:.2f}"
                    state["step"] = "purpose"
                else:
                    state["prefix"] = p["limit"]
            elif key.isdigit() and len(state["buffer"]) < 6:
                state["buffer"] += key
        elif key == "0":
            state.update(step="main",details={},buffer="",receipt_id=None)
        elif key == "9" or key == "":
            pass
        elif step == "main" and key == "1":
            state.update(payment_request_id=str(uuid4()), details={},receipt_id=None)
            with database() as db:
                state["recipients"] = list_records(db,profile_id,"recipient")[:8]
            state["step"] = "recipient" if state["recipients"] else "empty"
        elif step == "main" and key == "2":
            with database() as db:
                payments = list_records(db,profile_id,"payment")
            state["step"] = "status" if payments else "no_status"
            if payments:
                state["details"] = {k:payments[0][k] for k in ("recipient","amount","status")}
                state["receipt_id"] = payments[0]["id"]
        elif key == "3" and step in {"main","warning"}:
            state["step"] = "fraud"
        elif step == "recipient" and key.isdigit() and 1 <= int(key) <= len(state["recipients"]):
            r = state["recipients"][int(key)-1]
            state["details"] = {"recipient":r["name"], "upi_id":r["upi_id"], "phone":r.get("phone", ""), "recipient_id":r["id"]}
            state["step"] = "amount"
        elif step == "purpose" and key in "1234":
            state["details"]["purpose"] = {"1":"Groceries","2":"Medicine","3":"Family expenses","4":"Caller requested a safe account transfer"}[key]
            state["step"] = "warning" if key == "4" else "review"
        elif step == "review" and key == "2":
            state["step"] = "amount"
        elif step == "review" and key == "1":
            # A stable attempt ID survives gateway retries, including a dropped response.
            with database() as db:
                previous = db.execute("SELECT transaction_id FROM attempts WHERE owner=? AND request_id=?",(profile_id,state["payment_request_id"])).fetchone()
            if previous:
                state.update(step="done",receipt_id=previous["transaction_id"])
            else:
                draft = prepare_draft(profile_id,PaymentRequest(**state["details"]))
                if draft["paused"]:
                    state.update(step="paused",receipt_id=draft.get("transaction_id"))
                else:
                    confirmed = confirm_for_owner(profile_id,draft["id"],Confirmation(revision=draft["revision"],recipient=draft["recipient"],amount=Decimal(draft["amount"]),direction="outgoing"))
                    receipt = simulate_for_owner(profile_id,DemoPaymentInput(draft_id=draft["id"],review_token=confirmed["review_token"],request_id=state["payment_request_id"]))
                    state.update(step="done",receipt_id=receipt["id"])
        else:
            state["prefix"] = p["invalid"]
        response = view(state)
        # Do not retain DTMF digits: they can contain the private app call code.
        state["events"][event_id] = {"fingerprint":None if step=="auth" else fingerprint, "response":response}
        state["events"] = dict(list(state["events"].items())[-120:])
        with database() as db:
            if not read_record(db,profile_id,"phone_connection",pair["id"]):
                raise HTTPException(410,"This phone connection was removed.")
            save_record(db,profile_id,"phone_call",state)
        return response

@router.post("/calls")
def start_demo(request:Request):
    profile_id = owner(request)
    with database() as db:
        pairs = list_records(db,profile_id,"phone_connection")
    if not pairs:
        raise HTTPException(409,"Link a phone first.")
    return view(new_call(profile_id,pairs[0]))

@router.post("/calls/key")
def demo_key(body:Key, request:Request):
    profile_id = owner(request)
    with database() as db:
        state = read_record(db,profile_id,"phone_call",str(body.session_id))
    if not state:
        raise HTTPException(404,"Call not found.")
    return advance(profile_id,state,body.key,str(body.event_id))

class GatewayEvent(BaseModel):
    call_id: str = Field(min_length=8,max_length=100,pattern=r"^[A-Za-z0-9_-]+$")
    event_id: UUID
    caller: str = Field(max_length=30)
    event: Literal["start","key","end"]
    key: str = Field(default="",pattern=r"^[0-9*#]?$" )
    @field_validator("caller")
    @classmethod
    def valid_phone(cls,value):
        return normalize_phone(value)

@router.post("/gateway")
async def gateway(request:Request):
    """HMAC-SHA256(timestamp + '.' + exact JSON bytes); gateway renders prompts."""
    secret = os.getenv("TELEPHONY_WEBHOOK_SECRET","")
    if len(secret) < 32:
        raise HTTPException(503,"A telephone gateway is not configured.")
    stamp = request.headers.get("x-call-timestamp","")
    signature = request.headers.get("x-call-signature","")
    raw = await request.body()
    if not re.fullmatch(r"[0-9]{10,11}",stamp) or abs(time.time()-int(stamp)) > 300:
        raise HTTPException(401,"Invalid gateway timestamp.")
    expected = hmac.new(secret.encode(),stamp.encode()+b"."+raw,hashlib.sha256).hexdigest()
    if not secrets.compare_digest(expected,signature):
        raise HTTPException(401,"Invalid gateway signature.")
    try:
        body = GatewayEvent.model_validate_json(raw)
    except ValueError:
        raise HTTPException(422,"Use a valid call event.")
    with database() as db:
        candidates = [(row["owner"],json.loads(row["data"])) for row in db.execute("SELECT records.owner,records.data FROM records JOIN profiles ON profiles.id=records.owner WHERE records.kind='phone_connection' AND profiles.expires>?",(time.time(),))]
        match = next(((o,p) for o,p in candidates if p["phone"]==body.caller),None)
        if not match:
            raise HTTPException(404,"Caller is not linked.")
        profile_id,pair = match
        state = next((c for c in list_records(db,profile_id,"phone_call") if c.get("external_call_id")==body.call_id),None)
    if body.event == "start":
        with call_lock:
            state = new_call(profile_id,pair,body.call_id)
        if state["expires"] < time.time():
            raise HTTPException(410,"Call expired.")
        return view(state)
    if not state:
        raise HTTPException(404,"Call is not active.")
    return advance(profile_id,state,"*" if body.event=="end" else body.key,str(body.event_id))

