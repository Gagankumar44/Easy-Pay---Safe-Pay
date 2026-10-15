"""Small, owned task handlers. Conversation never executes a payment."""
import re
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from storage import database, list_records, save_record
from payment_contacts import contact_choices, COPY as CONTACT_COPY

COPY = {
 "en-IN": {"choose":"Would you like to send money, pay an electricity bill, check a payment, or get scam help?", "provider":"Which electricity provider? Choose Karnataka or City (demo).", "consumer":"What is the 6–12 digit consumer number on your bill?", "bad_consumer":"Please give only the 6–12 digit consumer number from your bill.", "bill":"Your demo electricity bill is ₹850. Check the provider and consumer number below before payment review.", "empty":"There are no payments in this profile yet. Would you like to send money or check a different task?", "status":"Choose the payment you want to check. Pending or unknown payments should be checked before paying again.", "confirmed":"You want to send ₹{amount} to {recipient} for {purpose}. Open payment review to check the payment address.", "summary":"You want to send ₹{amount} to {recipient} for {purpose}. Is that right?", "fraud":"Let’s prepare the details for scam help. If money has been lost, call 1930 now."},
 "hi-IN": {"choose":"पैसे भेजना, बिजली बिल, भुगतान स्थिति या धोखाधड़ी मदद — आपको क्या करना है?", "provider":"बिजली प्रदाता चुनें: कर्नाटक या सिटी (डेमो)।", "consumer":"बिल पर दिया 6–12 अंकों का उपभोक्ता नंबर क्या है?", "bad_consumer":"बिल का केवल 6–12 अंकों वाला उपभोक्ता नंबर बताएं।", "bill":"आपका डेमो बिजली बिल ₹850 है। भुगतान की जाँच से पहले प्रदाता और उपभोक्ता नंबर देखें।", "empty":"इस प्रोफ़ाइल में कोई भुगतान नहीं है। पैसे भेजना है या कोई और मदद चाहिए?", "status":"किस भुगतान की स्थिति देखनी है? लंबित या अज्ञात भुगतान दोबारा न करें।", "confirmed":"आप {purpose} के लिए {recipient} को ₹{amount} भेजना चाहते हैं। भुगतान पता जाँचने के लिए भुगतान की जाँच खोलें।", "summary":"आप {purpose} के लिए {recipient} को ₹{amount} भेजना चाहते हैं। क्या यह सही है?", "fraud":"धोखाधड़ी सहायता के लिए विवरण तैयार करें। पैसे खोए हैं तो अभी 1930 पर कॉल करें।"},
 "kn-IN": {"choose":"ಹಣ ಕಳುಹಿಸುವುದು, ವಿದ್ಯುತ್ ಬಿಲ್, ಪಾವತಿ ಸ್ಥಿತಿ ಅಥವಾ ವಂಚನೆ ಸಹಾಯ — ನಿಮಗೆ ಏನು ಬೇಕು?", "provider":"ವಿದ್ಯುತ್ ಸಂಸ್ಥೆ ಆರಿಸಿ: ಕರ್ನಾಟಕ ಅಥವಾ ಸಿಟಿ (ಡೆಮೋ).", "consumer":"ಬಿಲ್‌ನಲ್ಲಿರುವ 6–12 ಅಂಕಿಯ ಗ್ರಾಹಕ ಸಂಖ್ಯೆ ಯಾವುದು?", "bad_consumer":"ಬಿಲ್‌ನ 6–12 ಅಂಕಿಯ ಗ್ರಾಹಕ ಸಂಖ್ಯೆಯನ್ನು ಮಾತ್ರ ತಿಳಿಸಿ.", "bill":"ನಿಮ್ಮ ಡೆಮೋ ವಿದ್ಯುತ್ ಬಿಲ್ ₹850. ಪಾವತಿ ಪರಿಶೀಲನೆಗೆ ಮೊದಲು ಸಂಸ್ಥೆ ಮತ್ತು ಗ್ರಾಹಕ ಸಂಖ್ಯೆ ನೋಡಿ.", "empty":"ಈ ಪ್ರೊಫೈಲ್‌ನಲ್ಲಿ ಪಾವತಿಗಳಿಲ್ಲ. ಹಣ ಕಳುಹಿಸಲು ಅಥವಾ ಬೇರೆ ಸಹಾಯ ಬೇಕೇ?", "status":"ಯಾವ ಪಾವತಿಯ ಸ್ಥಿತಿ ನೋಡಬೇಕು? ಬಾಕಿ ಅಥವಾ ಅಜ್ಞಾತ ಪಾವತಿಯನ್ನು ಮತ್ತೆ ಮಾಡಬೇಡಿ.", "confirmed":"ನೀವು {purpose}ಗಾಗಿ {recipient} ಅವರಿಗೆ ₹{amount} ಕಳುಹಿಸಲು ಬಯಸುತ್ತೀರಿ. ಪಾವತಿ ವಿಳಾಸ ಪರಿಶೀಲಿಸಲು ಪಾವತಿ ಪರಿಶೀಲನೆ ತೆರೆಯಿರಿ.", "summary":"ನೀವು {purpose}ಗಾಗಿ {recipient} ಅವರಿಗೆ ₹{amount} ಕಳುಹಿಸಲು ಬಯಸುತ್ತೀರಿ. ಇದು ಸರಿಯೇ?", "fraud":"ವಂಚನೆ ಸಹಾಯಕ್ಕಾಗಿ ವಿವರಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಿ. ಹಣ ಕಳೆದುಕೊಂಡಿದ್ದರೆ ಈಗಲೇ 1930ಕ್ಕೆ ಕರೆ ಮಾಡಿ."}
}

YES = {"yes", "yes please", "correct", "that's right", "confirm", "हाँ", "हां", "सही", "सही है", "ಹೌದು", "ಸರಿ", "ಹೌದು ಸರಿ"}
YES.update({"yes that's right","yes correct","yes do that","okay","ok","हाँ सही है","जी हाँ","ಹೌದು ಇದು ಸರಿ","ಇದು ಸರಿ"})
CORRECTION = {"en-IN":"What should I change: recipient, amount or reason?", "hi-IN":"क्या बदलना है: नाम, रकम या कारण?", "kn-IN":"ಏನು ಬದಲಿಸಬೇಕು: ಹೆಸರು, ಮೊತ್ತ ಅಥವಾ ಕಾರಣ?"}

def summary_reply(state):
    key = "confirmed" if state.get("intent_confirmed") else "summary"
    fields = {k:state[k] for k in ("recipient","amount","purpose")}
    # Translate only established short reasons; retain original evidence in slots.
    reasons = {"groceries":{"groceries","किराने","किराना","ದಿನಸಿ"},"medicine":{"medicine","दवा","ಔಷಧಿ"},"rent":{"rent","किराया","ಬಾಡಿಗೆ"}}
    reason = next((k for k,words in reasons.items() if fields["purpose"].casefold() in words),None)
    if reason:
        fields["purpose"] = {"en-IN":{"groceries":"groceries","medicine":"medicine","rent":"rent"},"hi-IN":{"groceries":"किराने","medicine":"दवा","rent":"किराया"},"kn-IN":{"groceries":"ದಿನಸಿ","medicine":"ಔಷಧಿ","rent":"ಬಾಡಿಗೆ"}}[state["language"]][reason]
    reply = COPY[state["language"]][key].format(**fields)
    if state.get("contact") and state["contact"].get("phone"):
        reply += " " + CONTACT_COPY[state["language"]]["ending"].format(digits=state["contact"]["phone"][-4:])
    return reply

def task_view(state, profile_id):
    """Localized choices carry explicit values; never synthetic user answers."""
    copy = COPY[state["language"]]
    choices = []
    if state["step"] == "correction":
        labels = {"en-IN":["Recipient","Amount","Reason"], "hi-IN":["नाम","रकम","कारण"], "kn-IN":["ಹೆಸರು","ಮೊತ್ತ","ಕಾರಣ"]}[state["language"]]
        choices = [{"label":label,"value":"change "+field} for label,field in zip(labels,("recipient","amount","purpose"))]
    elif state["step"] == "provider":
        choices = [{"label":name, "value":name} for name in ("Demo Karnataka Electricity", "Demo City Electricity")]
    elif state["step"] in {"recipient", "choose_contact"}:
        choices = contact_choices(state, profile_id)
    elif state["step"] == "contact_details":
        choices = [{"label":CONTACT_COPY[state["language"]]["edit"], "href":"/recipients"}]
    elif state["intent"] == "check_payment":
        with database() as db:
            choices = [{"label":f"{p['recipient']} · ₹{p['amount']} · {p['status']}", "href":"/payment-result/"+p["id"]} for p in list_records(db,profile_id,"payment")[:6]]
    return {"choices":choices, "intent_confirmed":state.get("intent_confirmed",False), "bill":state.get("bill")}

def bill_turn(state, text, profile_id):
    copy = COPY[state["language"]]
    if re.search(r"karnataka|ಕರ್ನಾಟಕ|कर्नाटक", text, re.I):
        state["provider"] = "Demo Karnataka Electricity"
    elif re.search(r"\bcity\b|ಸಿಟಿ|सिटी", text, re.I):
        state["provider"] = "Demo City Electricity"
    digits = re.search(r"(?<!\d)(\d{6,12})(?!\d)", text)
    if digits:
        state["consumer_number"] = digits.group(1)
    if not state.get("provider"):
        state["step"] = "provider"
        return copy["provider"], None
    if not state.get("consumer_number"):
        bad = state["step"] == "consumer"
        state["step"] = "consumer"
        return copy["bad_consumer" if bad else "consumer"], None
    if not state.get("bill"):
        bill = {"id":str(uuid4()), "recipient":state["provider"], "consumer_number":state["consumer_number"], "amount":"850.00", "purpose":"Electricity bill", "due_date":(datetime.now(timezone(timedelta(hours=5,minutes=30))).date()+timedelta(days=7)).isoformat(), "demo_mode":True,"biller_status":"not_confirmed"}
        with database() as db:
            save_record(db,profile_id,"bill",bill)
        state["bill"] = bill
        state.update(recipient=bill["recipient"], amount=bill["amount"], purpose=bill["purpose"])
    state["step"] = "bill_review"
    return copy["bill"], "/send-money"
