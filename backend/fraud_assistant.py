"""Owned evidence prefilling and reporting guidance. No government submission."""
import time
from typing import Literal
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from identity import owner
from storage import database, list_records, read_record, save_record, timestamp

router = APIRouter(prefix="/api/fraud", tags=["Reporting assistant"])
TEXT = {
 "en-IN":{"description":"What happened? Tell me what the caller or message asked you to do. Do not include a PIN, OTP or password.", "method":"How did they contact you: call, message, website or something else?", "amount":"How much money was lost? Say 'unknown' or 'no payment' if needed.", "when":"When did this happen? An approximate date and time is enough.", "ready":"Your report draft is saved. Review the details, call 1930 and complete the official report. This website has not submitted a government complaint.", "invalid_amount":"Give one amount in rupees, or say 'unknown' or 'no payment'.", "choose":"Please choose call, message, website or other."},
 "hi-IN":{"description":"क्या हुआ? कॉल या संदेश ने क्या करने को कहा? पिन, ओटीपी या पासवर्ड न लिखें।", "method":"संपर्क कैसे किया: कॉल, संदेश, वेबसाइट या कोई और तरीका?", "amount":"कितने रुपये खोए? रकम न पता हो तो 'पता नहीं', भुगतान न हुआ हो तो 'भुगतान नहीं' बताएं।", "when":"यह कब हुआ? अनुमानित तारीख और समय बताएं।", "ready":"रिपोर्ट का मसौदा सहेजा है। विवरण जाँचें, 1930 पर कॉल करें और आधिकारिक रिपोर्ट पूरी करें। इस वेबसाइट ने सरकारी शिकायत जमा नहीं की है।", "invalid_amount":"एक रकम बताएं, या 'पता नहीं' या 'भुगतान नहीं' कहें।", "choose":"कॉल, संदेश, वेबसाइट या अन्य चुनें।"},
 "kn-IN":{"description":"ಏನಾಯಿತು? ಕರೆ ಅಥವಾ ಸಂದೇಶದಲ್ಲಿ ಏನು ಮಾಡಲು ಹೇಳಿದರು? ಪಿನ್, ಒಟಿಪಿ ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಬರೆಯಬೇಡಿ.", "method":"ಅವರು ಹೇಗೆ ಸಂಪರ್ಕಿಸಿದರು: ಕರೆ, ಸಂದೇಶ, ವೆಬ್‌ಸೈಟ್ ಅಥವಾ ಬೇರೆ ವಿಧಾನ?", "amount":"ಎಷ್ಟು ಹಣ ಕಳೆದುಕೊಂಡಿರಿ? ತಿಳಿಯದಿದ್ದರೆ 'ಗೊತ್ತಿಲ್ಲ', ಪಾವತಿ ಆಗಿಲ್ಲದಿದ್ದರೆ 'ಪಾವತಿ ಇಲ್ಲ' ಹೇಳಿ.", "when":"ಇದು ಯಾವಾಗ ಆಯಿತು? ಅಂದಾಜು ದಿನಾಂಕ ಮತ್ತು ಸಮಯ ಸಾಕು.", "ready":"ವರದಿ ಕರಡು ಉಳಿಸಲಾಗಿದೆ. ವಿವರ ಪರಿಶೀಲಿಸಿ, 1930ಕ್ಕೆ ಕರೆ ಮಾಡಿ ಅಧಿಕೃತ ವರದಿ ಪೂರ್ಣಗೊಳಿಸಿ. ಈ ವೆಬ್‌ಸೈಟ್ ಸರ್ಕಾರಿ ದೂರು ಸಲ್ಲಿಸಿಲ್ಲ.", "invalid_amount":"ಒಂದು ಮೊತ್ತ ತಿಳಿಸಿ, ಅಥವಾ 'ಗೊತ್ತಿಲ್ಲ' ಅಥವಾ 'ಪಾವತಿ ಇಲ್ಲ' ಹೇಳಿ.", "choose":"ಕರೆ, ಸಂದೇಶ, ವೆಬ್‌ಸೈಟ್ ಅಥವಾ ಬೇರೆ ವಿಧಾನ ಆರಿಸಿ."}
}
METHODS = {"Call":{"call","phone","कॉल","ಕರೆ"}, "Message":{"message","sms","whatsapp","संदेश","ಸಂದೇಶ"}, "Website":{"website","वेबसाइट","ವೆಬ್‌ಸೈಟ್"}, "Other":{"other","अन्य","ಬೇರೆ"}}
TEXT["en-IN"].update(reference="What is the payment reference or UTR on your bank receipt? Say 'unknown' if you cannot find it.",bank="Which bank or payment app did you use? Do not give an account number.")
TEXT["hi-IN"].update(reference="बैंक रसीद का भुगतान संदर्भ या UTR क्या है? न मिले तो 'पता नहीं' बताएं।",bank="कौन सा बैंक या भुगतान ऐप इस्तेमाल किया? खाता नंबर न बताएं।")
TEXT["kn-IN"].update(reference="ಬ್ಯಾಂಕ್ ರಸೀದಿಯ ಪಾವತಿ ಉಲ್ಲೇಖ ಅಥವಾ UTR ಯಾವುದು? ಸಿಗದಿದ್ದರೆ 'ಗೊತ್ತಿಲ್ಲ' ಹೇಳಿ.",bank="ಯಾವ ಬ್ಯಾಂಕ್ ಅಥವಾ ಪಾವತಿ ಆಪ್ ಬಳಸಿದಿರಿ? ಖಾತೆ ಸಂಖ್ಯೆ ಹೇಳಬೇಡಿ.")
UNKNOWN = {"unknown","don't know","no payment","not paid","पता नहीं","भुगतान नहीं","ಗೊತ್ತಿಲ್ಲ","ಪಾವತಿ ಇಲ್ಲ"}

def pack(state):
    details = state["details"]
    lines = ["REPORT DRAFT — NOT SUBMITTED", "This is an allegation supplied by the user; identity and loss have not been verified."]
    if state.get("payment"):
        lines.append("Source: simulated Easy Pay payment. No real money was transferred.")
    labels = {"occurred_at":"When","amount":"Amount (INR)","reference":"Payment reference","bank":"Bank / payment app","recipient":"Recipient","upi_id":"Payment address","payment_status":"Payment status","contact_method":"Contact method","description":"What happened"}
    lines += [f"{label}: {details.get(k) or 'Not yet supplied'}" for k,label in labels.items()]
    lines += ["Contact your bank through a number you already know.", "Evidence: preserve original messages, call details, payment receipts and bank records.", "Official handoff: call 1930; complete your complaint at https://cybercrime.gov.in/ .", "Government submission status: NOT SUBMITTED by this app."]
    if state.get("acknowledgement"):
        lines.append("User-entered acknowledgement (unverified): "+state["acknowledgement"]["reference"])
    incident = {"id":state["incident_id"], **details, "summary":"\n".join(lines), "status":"draft_not_submitted", "created_at":state["created_at"], "source_payment_id":state.get("payment_id"), "source_conversation_id":state.get("conversation_id"), "conversation_context":state.get("conversation_context",""), "evidence":state.get("payment"), "gathering_details":state["step"] != "ready", "acknowledgement":state.get("acknowledgement")}
    return incident

def view(state):
    return {"session_id":state["id"],"step":state["step"], "reply":TEXT[state["language"]][state["step"]], "language":state["language"], "incident":pack(state), "official_submission":"not_submitted", "official_url":"https://cybercrime.gov.in/", "helpline":"1930", "choices":list(METHODS) if state["step"]=="method" else []}

class Start(BaseModel):
    payment_id: UUID | None = None
    conversation_id: UUID | None = None
    language: Literal["en-IN","hi-IN","kn-IN"] = "en-IN"

@router.post("/sessions")
def start(body:Start, request:Request):
    profile_id = owner(request)
    with database() as db:
        conversation = read_record(db,profile_id,"conversation",str(body.conversation_id)) if body.conversation_id else None
        if body.conversation_id and not conversation:
            raise HTTPException(404,"Conversation not found in this profile.")
        payment = read_record(db,profile_id,"payment",str(body.payment_id)) if body.payment_id else None
        if body.payment_id and not payment:
            raise HTTPException(404,"Payment not found in this profile.")
        if body.payment_id or body.conversation_id:
            previous = next((s for s in list_records(db,profile_id,"fraud_chat") if s.get("payment_id") == (str(body.payment_id) if body.payment_id else None) and s.get("conversation_id") == (str(body.conversation_id) if body.conversation_id else None) and s["expires"] > time.time() and read_record(db,profile_id,"incident",s["incident_id"])),None)
            if previous:
                if previous.get("conversation_context", "") == (conversation.get("context", "") if conversation else ""):
                    previous["language"] = body.language
                    return view(previous)
        details = {"occurred_at":payment["created_at"] if payment else "", "amount":payment["amount"] if payment else "", "reference":payment["id"] if payment else "", "recipient":payment["recipient"] if payment else "", "upi_id":payment["upi_id"] if payment else "", "payment_status":payment["status"] if payment else "", "contact_method":"", "description":""}
        state = {"id":str(uuid4()),"incident_id":str(uuid4()), "payment_id":str(body.payment_id) if payment else None, "payment":payment, "conversation_id":str(body.conversation_id) if conversation else None,"conversation_context":conversation.get("context","") if conversation else "", "step":"description", "details":details,"language":body.language,"created_at":timestamp(),"expires":time.time()+1800,"responses":{},"version":0}
        save_record(db,profile_id,"fraud_chat",state)
        save_record(db,profile_id,"incident",pack(state))
    return view(state)

@router.get("/sessions/{session_id}")
def current(session_id:UUID,request:Request,language:Literal["en-IN","hi-IN","kn-IN"]="en-IN"):
    profile_id = owner(request)
    with database() as db:
        state = read_record(db,profile_id,"fraud_chat",str(session_id))
    if not state or state["expires"] < time.time():
        raise HTTPException(410,"Report chat expired. Your saved draft remains in complaint drafts.")
    state["language"] = language
    return view(state)

class Message(BaseModel):
    session_id: UUID
    request_id: UUID = Field(default_factory=uuid4)
    message: str = Field(min_length=1,max_length=500)
    language: Literal["en-IN","hi-IN","kn-IN"] = "en-IN"

@router.post("/chat")
def chat(body:Message,request:Request):
    profile_id = owner(request)
    with database() as db:
        state = read_record(db,profile_id,"fraud_chat",str(body.session_id))
        if not state or state["expires"] < time.time():
            raise HTTPException(410,"This reporting chat expired. The draft is still saved.")
        if str(body.request_id) in state["responses"]:
            return state["responses"][str(body.request_id)]
        state["language"] = body.language
        copy = TEXT[body.language]
        text = body.message.strip()
        if not text:
            raise HTTPException(422,"Please give an answer.")
        value = text.casefold()
        if value not in {"repeat","ಮತ್ತೆ ಹೇಳಿ","दोहराएं"}:
            step = state["step"]
            if step == "description":
                if len(text) < 3:
                    raise HTTPException(422,"Please describe what happened.")
                state["details"]["description"] = text
                state["step"] = "method"
            elif step == "method":
                method = next((k for k,v in METHODS.items() if value in v),None)
                if not method:
                    result = view(state)
                    result["reply"] = copy["choose"]
                    return result
                state["details"]["contact_method"] = method
                state["step"] = "ready" if state.get("payment") else "amount"
            elif step == "amount":
                if value in UNKNOWN:
                    state["details"]["amount"] = "0.00" if value in {"no payment","not paid","भुगतान नहीं","ಪಾವತಿ ಇಲ್ಲ"} else "Unknown"
                else:
                    from extraction import parse_amount
                    amount = parse_amount(text)
                    if amount is None:
                        result = view(state)
                        result["reply"] = copy["invalid_amount"]
                        return result
                    state["details"]["amount"] = f"{amount:.2f}"
                state["step"] = "when" if state["details"]["amount"]=="0.00" else "reference"
            elif step == "reference":
                state["details"]["reference"] = "Unknown" if value in UNKNOWN else text[:100]
                state["step"] = "bank"
            elif step == "bank":
                state["details"]["bank"] = "Unknown" if value in UNKNOWN else text[:80]
                state["step"] = "when"
            elif step == "when":
                state["details"]["occurred_at"] = text[:80]
                state["step"] = "ready"
            elif step == "ready":
                # Add corrections as explicit user notes; never replace source evidence.
                description = state["details"]["description"]+"\nAdditional user note: "+text
                if len(description) > 2000:
                    raise HTTPException(409,"This draft is full. Download it and start another report for additional notes.")
                state["details"]["description"] = description
        state["expires"] = time.time()+1800
        response = view(state)
        state["responses"][str(body.request_id)] = response
        state["responses"] = dict(list(state["responses"].items())[-20:])
        save_record(db,profile_id,"fraud_chat",state)
        save_record(db,profile_id,"incident",pack(state))
        return response

class Acknowledgement(BaseModel):
    reference: str = Field(min_length=5,max_length=80,pattern=r"^[A-Za-z0-9 /-]+$")

@router.post("/incidents/{incident_id}/acknowledgement")
def acknowledge(incident_id:UUID,body:Acknowledgement,request:Request):
    profile_id = owner(request)
    with database() as db:
        incident = read_record(db,profile_id,"incident",str(incident_id))
        if not incident:
            raise HTTPException(404,"Report draft not found.")
        incident["acknowledgement"] = {"reference":body.reference,"source":"user_entered","verified":False,"recorded_at":timestamp()}
        incident["summary"] = incident["summary"].split("\nUser-entered acknowledgement (unverified):")[0]+"\nUser-entered acknowledgement (unverified): "+body.reference
        save_record(db,profile_id,"incident",incident)
        for state in list_records(db,profile_id,"fraud_chat"):
            if state["incident_id"] == str(incident_id):
                state["acknowledgement"] = incident["acknowledgement"]
                save_record(db,profile_id,"fraud_chat",state)
    return incident
