import re
import hashlib
import json
import time
from typing import Literal
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field
from extraction import extract, parse_amount
from identity import owner
from safety import assess
from storage import database, list_records, read_record, save_record
from assistant_tasks import COPY, YES, CORRECTION, summary_reply, task_view, bill_turn
from payment_contacts import COPY as CONTACT_COPY, resolve_contact, contact_is_current, owned_contact

router = APIRouter(prefix="/api/assistant", tags=["Conversation"])
PROMPTS = {
 "en-IN": {"welcome": "Tell me what you need. For example: send five hundred rupees to Ramesh for groceries.", "recipient": "Who should receive the money?", "amount": "How many rupees would you like to send?", "purpose": "What is this payment for?", "invalid": "Please give one amount from ₹0.01 to ₹1,00,000, with at most two decimal places.", "conflict": "I heard more than one amount. Please tell me just the amount you want to send.", "paused": "This task is paused because of a possible scam. Stop and verify through a known contact. Changing the description will not clear this warning. Start again for a different task.", "cancel": "This task is cancelled. No payment was made.", "review": "Check the recipient, amount and reason below. Money would leave your account. Open payment review when you are ready; no payment has been made.", "receive": "To receive money, share your payment address with a known sender. Do not approve an outgoing payment or share a PIN to receive a refund.", "bill": "Open Bills to look up a fictional electricity bill and review it.", "history": "Open Activity to check an existing demo payment. Checking status does not create another payment.", "repeat": "Tell me what you need help with."},
 "hi-IN": {"welcome": "बताइए आपको क्या मदद चाहिए। जैसे: रमेश को पाँच सौ रुपये किराने के लिए भेजो।", "recipient": "पैसे किसे भेजने हैं?", "amount": "आप कितने रुपये भेजना चाहते हैं?", "purpose": "यह भुगतान किस लिए है?", "invalid": "कृपया ₹0.01 से ₹1,00,000 के बीच एक सही रकम बताएं।", "conflict": "एक से अधिक रकम मिली। कृपया केवल सही रकम बताएं।", "paused": "धोखाधड़ी की आशंका के कारण काम रोका गया है। अपने परिचित नंबर से जाँच करें। विवरण बदलने से चेतावनी नहीं हटेगी। अलग काम के लिए फिर से शुरू करें।", "cancel": "काम रद्द किया गया। कोई भुगतान नहीं हुआ।", "review": "नीचे नाम, रकम और कारण जाँचें। पैसे आपके खाते से जाएंगे। तैयार होने पर भुगतान की जाँच खोलें। अभी कोई भुगतान नहीं हुआ।", "receive": "पैसे प्राप्त करने के लिए किसी को पिन न बताएं और पैसे भेजने की मंजूरी न दें। परिचित भेजने वाले को अपना भुगतान पता दें।", "bill": "बिल पेज पर एक काल्पनिक बिजली बिल देखें।", "history": "पुराने डेमो भुगतान की स्थिति के लिए गतिविधि खोलें। इससे नया भुगतान नहीं होगा।", "repeat": "बताइए आपको क्या मदद चाहिए।"},
 "kn-IN": {"welcome": "ನಿಮಗೆ ಯಾವ ಸಹಾಯ ಬೇಕು? ಉದಾಹರಣೆ: ರಮೇಶ್ ಅವರಿಗೆ ಐದು ನೂರು ರೂಪಾಯಿ ದಿನಸಿಗಾಗಿ ಕಳುಹಿಸಿ.", "recipient": "ಹಣವನ್ನು ಯಾರಿಗೆ ಕಳುಹಿಸಬೇಕು?", "amount": "ಎಷ್ಟು ರೂಪಾಯಿ ಕಳುಹಿಸಲು ಬಯಸುತ್ತೀರಿ?", "purpose": "ಈ ಪಾವತಿ ಯಾವುದಕ್ಕಾಗಿ?", "invalid": "₹0.01 ರಿಂದ ₹1,00,000 ನಡುವಿನ ಒಂದು ಸರಿಯಾದ ಮೊತ್ತ ತಿಳಿಸಿ.", "conflict": "ಒಂದಕ್ಕಿಂತ ಹೆಚ್ಚು ಮೊತ್ತ ಸಿಕ್ಕಿದೆ. ಸರಿಯಾದ ಒಂದು ಮೊತ್ತ ತಿಳಿಸಿ.", "paused": "ವಂಚನೆಯ ಅನುಮಾನದ ಕಾರಣ ಈ ಕೆಲಸ ನಿಲ್ಲಿಸಲಾಗಿದೆ. ಪರಿಚಿತ ಸಂಖ್ಯೆಗೆ ಕರೆ ಮಾಡಿ ಪರಿಶೀಲಿಸಿ. ವಿವರ ಬದಲಿಸಿದರೂ ಎಚ್ಚರಿಕೆ ಉಳಿಯುತ್ತದೆ. ಬೇರೆ ಕೆಲಸಕ್ಕೆ ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ.", "cancel": "ಕೆಲಸ ರದ್ದಾಗಿದೆ. ಯಾವುದೇ ಪಾವತಿ ಆಗಿಲ್ಲ.", "review": "ಹೆಸರು, ಮೊತ್ತ ಮತ್ತು ಕಾರಣ ಪರಿಶೀಲಿಸಿ. ಹಣ ನಿಮ್ಮ ಖಾತೆಯಿಂದ ಹೊರಹೋಗುತ್ತದೆ. ಸಿದ್ಧವಾದಾಗ ಪಾವತಿ ಪರಿಶೀಲನೆ ತೆರೆಯಿರಿ. ಇನ್ನೂ ಪಾವತಿ ಆಗಿಲ್ಲ.", "receive": "ಹಣ ಪಡೆಯಲು ಪಿನ್ ಹಂಚಬೇಡಿ ಅಥವಾ ಹೊರಹೋಗುವ ಪಾವತಿ ಒಪ್ಪಬೇಡಿ. ಪರಿಚಿತ ಕಳುಹಿಸುವವರಿಗೆ ನಿಮ್ಮ ಪಾವತಿ ವಿಳಾಸ ನೀಡಿ.", "bill": "ಬಿಲ್ ಪುಟದಲ್ಲಿ ಕಾಲ್ಪನಿಕ ವಿದ್ಯುತ್ ಬಿಲ್ ನೋಡಿ.", "history": "ಹಳೆಯ ಡೆಮೋ ಪಾವತಿ ಸ್ಥಿತಿಗಾಗಿ ಚಟುವಟಿಕೆ ತೆರೆಯಿರಿ. ಇದು ಹೊಸ ಪಾವತಿ ಮಾಡುವುದಿಲ್ಲ.", "repeat": "ನಿಮಗೆ ಯಾವ ಸಹಾಯ ಬೇಕು?"}
}
PROMPTS["en-IN"].update(welcome="What would you like help with?", paused="Possible scam. Do not send money. Verify through a number you already know.", review="Check the recipient, amount and reason. Money would leave your account.", bill="Open Bills to check an electricity bill.", history="Open Activity to check your existing payment.")
PROMPTS["hi-IN"].update(welcome="आपको क्या मदद चाहिए?", paused="धोखाधड़ी का शक है। पैसे न भेजें। पहले से परिचित नंबर पर जाँच करें।", review="नाम, रकम और कारण जाँचें। पैसे आपके खाते से जाएंगे।", bill="बिजली बिल देखने के लिए बिल खोलें।", history="मौजूदा भुगतान के लिए गतिविधि खोलें।")
PROMPTS["kn-IN"].update(welcome="ನಿಮಗೆ ಯಾವ ಸಹಾಯ ಬೇಕು?", paused="ವಂಚನೆಯ ಅನುಮಾನ. ಹಣ ಕಳುಹಿಸಬೇಡಿ. ಪರಿಚಿತ ಸಂಖ್ಯೆಗೆ ಕರೆ ಮಾಡಿ ಪರಿಶೀಲಿಸಿ.", review="ಹೆಸರು, ಮೊತ್ತ ಮತ್ತು ಕಾರಣ ಪರಿಶೀಲಿಸಿ. ಹಣ ನಿಮ್ಮ ಖಾತೆಯಿಂದ ಹೊರಹೋಗುತ್ತದೆ.", bill="ವಿದ್ಯುತ್ ಬಿಲ್ ಪರಿಶೀಲಿಸಲು ಬಿಲ್ ಪುಟ ತೆರೆಯಿರಿ.", history="ಹಿಂದಿನ ಪಾವತಿ ಸ್ಥಿತಿ ಪರಿಶೀಲಿಸಿ.")


class ChatRequest(BaseModel):
    session_id: UUID | None = None
    request_id: UUID = Field(default_factory=uuid4)
    message: str = Field(min_length=1, max_length=500)
    language: Literal["en-IN", "hi-IN", "kn-IN"] = "en-IN"
    recipient_id: UUID | None = None


def chat_response(state, reply, action=None):
    summary = {k: state[k] for k in ("recipient", "amount", "purpose")} if all(state.get(k) for k in ("recipient", "amount", "purpose")) else None
    if summary and state.get("bill"):
        summary["bill_id"] = state["bill"]["id"]
    if state["step"] in {"choose_contact", "contact_details"}:
        summary = None
    if summary and state.get("contact"):
        summary.update(upi_id=state["contact"]["upi_id"], phone=state["contact"]["phone"], recipient_id=state["contact"]["id"])
    return {"session_id": state["id"], "intent": state["intent"], "step": state["step"], "reply": reply,
            "slots": {k: state.get(k) for k in ("recipient", "amount", "purpose")}, "summary": summary,
            "next_action": action, "engine": state.get("engine", "workflow"), "safety": state.get("safety"), "language": state.get("language", "en-IN"), "contact":state.get("contact")}


@router.get("/sessions/{session_id}")
def current_task(session_id: UUID, http_request: Request, language: Literal["en-IN", "hi-IN", "kn-IN"] = Query("en-IN")):
    profile_id = owner(http_request)
    with database() as db:
        state = read_record(db, profile_id, "conversation", str(session_id))
    if not state:
        raise HTTPException(404, "This conversation is not available.")
    if state["expires"] < time.time():
        raise HTTPException(410, "This conversation expired. Start again.")
    prompts = PROMPTS[language]
    state["language"] = language
    step = state["step"]
    key = step if step in {"recipient", "amount", "purpose", "review", "paused"} else "cancel" if step == "cancelled" else {"pay_bill": "bill", "check_payment": "history", "receive_money": "receive"}.get(state["intent"], "welcome")
    action = "/help" if step == "paused" or state["intent"] == "scam_help" else "/send-money" if step == "review" else {"pay_bill": "/bills", "check_payment": "/activity"}.get(state["intent"])
    if step == "review":
        reply = summary_reply(state)
        action = "/send-money" if state.get("intent_confirmed") else None
    elif state["intent"] == "pay_bill" and step in {"provider","consumer","bill_review"}:
        reply = COPY[language][{"provider":"provider","consumer":"consumer","bill_review":"bill"}[step]]
        action = "/send-money" if step == "bill_review" else None
    elif step in {"choose_contact", "contact_details"}:
        reply = CONTACT_COPY[language]["choose" if step == "choose_contact" else "missing"]
        action = None
    elif step == "correction":
        reply = CORRECTION[language]
    elif state["intent"] == "scam_help" and step != "paused":
        reply = COPY[language]["fraud"]
        action = "/help/fraud?conversation="+state["id"]
    elif state["intent"] == "check_payment":
        reply = COPY[language]["status"]
    else:
        reply = prompts[key]
    return {**chat_response(state, reply, action), **task_view(state,profile_id)}


@router.post("/chat")
def chat(request: ChatRequest, http_request: Request):
    profile_id = owner(http_request)
    text = request.message.strip()
    if not text:
        raise HTTPException(422, "Please type or speak a message.")
    with database() as db:
        if request.session_id:
            state = read_record(db, profile_id, "conversation", str(request.session_id))
            if not state:
                raise HTTPException(404, "This conversation is not available in your profile.")
            expired = state["expires"] < time.time()
            if expired:
                db.execute("DELETE FROM records WHERE id=? AND owner=?", (state["id"], profile_id))
            elif str(request.request_id) in state.get("responses", {}):
                return state["responses"][str(request.request_id)]
        else:
            for previous in list_records(db, profile_id, "conversation"):
                if previous["expires"] > time.time() and str(request.request_id) in previous.get("responses", {}):
                    return previous["responses"][str(request.request_id)]
                if previous["expires"] > time.time() and previous.get("initial_request_id") == str(request.request_id):
                    raise HTTPException(409, "This message is still processing. Retry the same message in a moment.")
            expired = False
            state = {"id": str(uuid4()), "intent": "other", "step": "start", "recipient": "", "amount": None,
                     "purpose": "", "context": "", "safety": None, "version": 0, "initial_request_id": str(request.request_id), "responses": {}, "expires": time.time() + 1800}
            save_record(db, profile_id, "conversation", state)
    if expired:
        raise HTTPException(410, "This conversation expired after 30 minutes. Start again; no payment was made.")
    version = state["version"]
    prompts = PROMPTS[request.language]
    state["language"] = request.language
    value = text.casefold()
    action = None
    if value in {"cancel", "stop", "रद्द", "बंद", "ರದ್ದು", "ರದ್ದು ಮಾಡಿ", "ರದ್ದುಮಾಡಿ", "ನಿಲ್ಲಿಸು", "ನಿಲ್ಲಿಸಿ", "ನಿಲ್ಲಿಸಬೇಕು"}:
        state["step"] = "cancelled"
        reply = prompts["cancel"]
    elif value in {"start again", "restart", "new task", "फिर से शुरू", "ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ"}:
        state.update(intent="other", step="start", recipient="", amount=None, purpose="", context="", safety=None, intent_confirmed=False, bill=None, provider=None, consumer_number=None, contact=None, contact_candidates=[])
        reply = COPY[request.language]["choose"]
    elif value in {"repeat", "repeat that", "speak slower", "i didn't understand", "दोहराएं", "ಮತ್ತೆ ಹೇಳಿ", "ಅರ್ಥವಾಗಲಿಲ್ಲ", "ನಿಧಾನವಾಗಿ ಹೇಳಿ"}:
        if state["step"] == "review":
            reply = summary_reply(state)
            action = "/send-money" if state.get("intent_confirmed") else None
        elif state["step"] == "correction":
            reply = CORRECTION[request.language]
        elif state["step"] in {"provider","consumer","bill_review"}:
            reply = COPY[request.language][{"provider":"provider","consumer":"consumer","bill_review":"bill"}[state["step"]]]
            action = "/send-money" if state["step"] == "bill_review" else None
        else:
            reply = prompts.get(state["step"], prompts["repeat"])
    elif state["step"] == "paused":
        state["context"] = (state["context"] + " " + text)[-4000:]
        latest = assess(state["context"])
        known = {signal["code"] for signal in state["safety"]["signals"]}
        state["safety"]["signals"].extend(signal for signal in latest["signals"] if signal["code"] not in known)
        if latest["risk_level"] == "strong_warning":
            state["safety"]["risk_level"] = "strong_warning"
        state["safety"]["reasons"] = [signal["noticed"] for signal in state["safety"]["signals"]]
        reply, action = prompts["paused"], "/help"
    elif state["step"] == "review" and value in YES:
        if state.get("contact") and not contact_is_current(profile_id, state["contact"]):
            state.update(recipient="", contact=None, step="recipient", intent_confirmed=False)
            reply = CONTACT_COPY[request.language]["changed"]
        else:
            state["intent_confirmed"] = True
            reply, action = summary_reply(state), "/send-money"
    elif state["step"] == "review" and value in {"no","not right","नहीं","गलत","ಇಲ್ಲ","ತಪ್ಪು"}:
        state.update(step="correction",intent_confirmed=False)
        reply = CORRECTION[request.language]
    elif state["step"] in {"recipient","amount","purpose","provider","consumer"} and ("?" in text or value in {"i don't know","not sure","पता नहीं","ಗೊತ್ತಿಲ್ಲ"}):
        reply = prompts.get(state["step"], COPY[request.language].get(state["step"],COPY[request.language]["choose"]))
    else:
        if request.recipient_id:
            if state["intent"] != "send_money":
                raise HTTPException(422, "Choose a payment task before selecting a contact.")
            selected = owned_contact(profile_id, request.recipient_id)
            extracted = extract(selected["name"], use_ai=False)
            extracted.update(intent="other", recipient=selected["name"], amount=None, purpose="", invalid_amount=False, conflicting_amounts=False)
        else:
            extracted = extract(text, use_ai=state["step"] in {"start", "cancelled", "completed"})
        state["engine"] = extracted["engine"]
        state["context"] = (state["context"] + " " + text)[-4000:]
        safety = assess(state["context"])
        if extracted["ai_concern"] and not safety["paused"]:
            safety = {"risk_level": "needs_clarification", "paused": True, "message": "The description may involve pressure or deception. Verify independently.", "signals": [{"code": "unverified_request", "level": "needs_clarification", "noticed": "The request may involve pressure or an unverified claim.", "action": "Verify the recipient and payment reason through a known contact before continuing."}], "reasons": ["The request needs independent verification."]}
        if safety["paused"]:
            state.update(step="paused", intent="scam_help", safety=safety)
            reply, action = prompts["paused"], "/help"
        else:
            if extracted["intent"] not in {"other",state["intent"]}:
                state.update(intent=extracted["intent"], step="start", recipient="", amount=None, purpose="", intent_confirmed=False, bill=None, provider=None, consumer_number=None, contact=None)
            if state["step"] in {"start", "cancelled", "completed"}:
                state.update(intent=extracted["intent"], recipient="", amount=None, purpose="", intent_confirmed=False, bill=None, provider=None, consumer_number=None, contact=None)
            if state["intent"] != "send_money":
                if state["intent"] == "pay_bill":
                    reply, action = bill_turn(state,text,profile_id)
                elif state["intent"] == "scam_help":
                    reply, action = COPY[request.language]["fraud"], "/help/fraud?conversation="+state["id"]
                    state["step"] = "completed"
                elif state["intent"] == "check_payment":
                    with database() as db:
                        has_payments = bool(list_records(db,profile_id,"payment"))
                    reply, action = COPY[request.language]["status" if has_payments else "empty"], "/activity" if has_payments else None
                    state["step"] = "completed"
                else:
                    key = "receive" if state["intent"] == "receive_money" else "welcome"
                    reply = prompts[key] if key == "receive" else COPY[request.language]["choose"]
                    state["step"] = "completed" if key == "receive" else "start"
            else:
                correction = re.search(r"(?:change|correct)\s+(amount|recipient|name|reason|purpose)(?:\s+(?:to|is))?\s*(.*)", text, re.I)
                native_correction = re.search(r"(रकम|राशि|नाम|प्राप्तकर्ता|कारण|ಮೊತ್ತ|ಹೆಸರು|ಕಾರಣ)\s*(?:बदलें|बदलो|बदलकर|बदलिए|ಬದಲಿಸಿ|ಬದಲಾಯಿಸಿ)\s*(.*)", text)
                if value in {"go back", "back", "no", "नहीं", "ಇಲ್ಲ", "ಹಿಂದೆ", "ಹಿಂದೆ ಹೋಗಿ"}:
                    state["step"] = "purpose" if state.get("purpose") else "amount" if state.get("amount") else "recipient"
                    state[state["step"]] = None if state["step"] == "amount" else ""
                    if state["step"] == "recipient":
                        state["contact"] = None
                    reply = prompts[state["step"]]
                else:
                    state["intent_confirmed"] = False
                    if correction or native_correction:
                        match = correction or native_correction
                        field = {"name": "recipient", "reason": "purpose", "रकम": "amount", "राशि": "amount", "नाम": "recipient", "प्राप्तकर्ता": "recipient", "कारण": "purpose", "ಮೊತ್ತ": "amount", "ಹೆಸರು": "recipient", "ಕಾರಣ": "purpose"}.get(match.group(1).lower(), match.group(1).lower())
                        new_value = match.group(2).strip()
                        state[field] = f"{parse_amount(new_value):.2f}" if field == "amount" and parse_amount(new_value) is not None else None if field == "amount" else new_value
                        state["step"] = field
                    else:
                        for field in ("recipient", "amount", "purpose"):
                            if extracted.get(field):
                                state[field] = extracted[field]
                        if state["step"] == "recipient" and not extracted["recipient"] and extracted["intent"] == "other" and not extracted["amount"]:
                            state["recipient"] = text[:80]
                        elif state["step"] == "amount" and not extracted["amount"]:
                            parsed = parse_amount(text)
                            state["amount"] = f"{parsed:.2f}" if parsed is not None else None
                        elif state["step"] == "purpose" and not extracted["purpose"]:
                            state["purpose"] = text[:250]
                    contact_issue = resolve_contact(state, profile_id, text, request.recipient_id,
                        allow_mentions=not extracted.get("recipient") and not (correction or native_correction))
                    if extracted["conflicting_amounts"] or extracted["invalid_amount"]:
                        state.update(amount=None, step="amount")
                        reply = prompts["conflict"] if extracted["conflicting_amounts"] else prompts["invalid"]
                    elif contact_issue:
                        reply = CONTACT_COPY[request.language][contact_issue]
                    else:
                        missing = next((k for k in ("recipient", "amount", "purpose") if not state.get(k)), None)
                        state["step"] = missing or "review"
                        reply = prompts[missing] if missing else summary_reply(state)
                        action = None
    response = {**chat_response(state, reply, action), **task_view(state,profile_id)}
    state.update(last_reply=reply, version=version + 1, expires=time.time() + 1800)
    state["responses"][str(request.request_id)] = response
    state["responses"] = dict(list(state["responses"].items())[-20:])
    with database() as db:
        current = read_record(db, profile_id, "conversation", state["id"])
        if not current or current["version"] != version:
            raise HTTPException(409, "Another message updated this task. Please send your message again.")
        save_record(db, profile_id, "conversation", state)
    return response


@router.post("/sessions/{session_id}/review")
def open_review(session_id: UUID, request: Request):
    """One owned handoff into the shared review; this never confirms a payment."""
    from payments import PaymentRequest, prepare_draft, public_draft
    profile_id = owner(request)
    with database() as db:
        state = read_record(db, profile_id, "conversation", str(session_id))
    if not state or state["expires"] < time.time():
        raise HTTPException(410, "This conversation expired. Start again.")
    if state.get("safety") and state["safety"].get("paused"):
        raise HTTPException(409, "This task is paused. Verify the request independently.")
    if not ((state["intent"] == "send_money" and state["step"] == "review" and state.get("intent_confirmed")) or (state["intent"] == "pay_bill" and state["step"] == "bill_review")):
        raise HTTPException(409, "Complete and check the assistant's details first.")
    fields = chat_response(state, "")["summary"]
    if not fields:
        raise HTTPException(409, "Complete the payment details first.")
    if state.get("contact") and not contact_is_current(profile_id, state["contact"]):
        raise HTTPException(409, "Saved contact details changed. Choose the contact again before payment review.")
    signature = hashlib.sha256(json.dumps([fields,state["context"]],sort_keys=True).encode()).hexdigest()
    with database() as db:
        existing = read_record(db,profile_id,"draft",state.get("review_draft_id", ""))
    if existing and existing.get("source_signature") == signature and existing["state"] != "cancelled":
        return public_draft(existing)
    draft = prepare_draft(profile_id, PaymentRequest(**fields), conversation_context=state["context"])
    draft["source_signature"] = signature
    with database() as db:
        current = read_record(db,profile_id,"conversation",state["id"])
        if not current or current["version"] != state["version"]:
            raise HTTPException(409, "This task changed. Check the latest details.")
        current["review_draft_id"] = draft["id"]
        save_record(db,profile_id,"draft",draft)
        save_record(db,profile_id,"conversation",current)
    return public_draft(draft)
