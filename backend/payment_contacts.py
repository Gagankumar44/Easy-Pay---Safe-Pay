"""Owned payment contacts and deliberately fictional starter destinations."""
import re
import unicodedata
from uuid import NAMESPACE_URL, uuid5
from fastapi import HTTPException
from storage import database, list_records, read_record, save_record

DEMOS = (
    ("Akash", "0000000101", "akash@demo.invalid", ["आकाश", "ಆಕಾಶ್", "ಆಕಾಶ"]),
    ("Suraj", "0000000102", "suraj@demo.invalid", ["सूरज", "ಸೂರಜ್", "ಸೂರಜ"]),
    ("Gowtham", "0000000103", "gowtham@demo.invalid", ["Gautham", "Gautam", "गौतम", "ಗೌತಮ್", "ಗೌತಮ", "ಗೌತಮ್"]),
)
COPY = {
    "en-IN": {"choose":"More than one saved contact matches. Choose the right person below.", "missing":"This contact has no payment address or mobile number. Add their details in Saved contacts.", "changed":"This saved contact changed or was removed. Choose the recipient again.", "edit":"Open saved contacts", "linked":"Saved contact", "ending":"Mobile ending {digits}."},
    "hi-IN": {"choose":"एक से अधिक सहेजे संपर्क मिले। नीचे सही व्यक्ति चुनें।", "missing":"इस संपर्क का भुगतान पता या मोबाइल नंबर नहीं है। सहेजे संपर्क में विवरण जोड़ें।", "changed":"सहेजा संपर्क बदल गया या हटा दिया गया। व्यक्ति फिर चुनें।", "edit":"सहेजे संपर्क खोलें", "linked":"सहेजा संपर्क", "ending":"मोबाइल के आखिरी अंक {digits}।"},
    "kn-IN": {"choose":"ಒಂದಕ್ಕಿಂತ ಹೆಚ್ಚು ಉಳಿಸಿದ ಹೆಸರುಗಳು ಸಿಕ್ಕಿವೆ. ಕೆಳಗೆ ಸರಿಯಾದ ವ್ಯಕ್ತಿಯನ್ನು ಆರಿಸಿ.", "missing":"ಈ ಸಂಪರ್ಕಕ್ಕೆ ಪಾವತಿ ವಿಳಾಸ ಅಥವಾ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಇಲ್ಲ. ಉಳಿಸಿದ ಸಂಪರ್ಕಗಳಲ್ಲಿ ವಿವರ ಸೇರಿಸಿ.", "changed":"ಉಳಿಸಿದ ಸಂಪರ್ಕ ಬದಲಾಗಿದೆ ಅಥವಾ ತೆಗೆದುಹಾಕಲಾಗಿದೆ. ಸ್ವೀಕರಿಸುವವರನ್ನು ಮತ್ತೆ ಆರಿಸಿ.", "edit":"ಉಳಿಸಿದ ಸಂಪರ್ಕ ತೆರೆಯಿರಿ", "linked":"ಉಳಿಸಿದ ಸಂಪರ್ಕ", "ending":"ಮೊಬೈಲ್ ಕೊನೆಯ ಅಂಕಿಗಳು {digits}."},
}

def name_key(value):
    value = unicodedata.normalize("NFKC", value).casefold().strip(" .,!?:;।")
    value = re.sub(r"\s+(?:ಅವರಿಗೆ|ಗೆ|को)$", "", value)
    return re.sub(r"\s+", " ", value)

def names(record):
    return {name_key(n) for n in [record["name"], *record.get("aliases", [])]}

def ensure_demo_contacts(db, profile_id):
    marker = str(uuid5(NAMESPACE_URL, "easy-pay/demo-contacts/" + profile_id))
    if read_record(db, profile_id, "demo_contacts_seed", marker):
        return
    existing = list_records(db, profile_id, "recipient")
    for name, phone, upi, aliases in DEMOS:
        if any(name_key(name) in names(r) for r in existing):
            continue
        record = {"id":str(uuid5(NAMESPACE_URL, "easy-pay/contact/" + profile_id + "/" + name)),
                  "name":name, "phone":phone, "upi_id":upi, "aliases":aliases,
                  "demo":True, "identity_verified":False}
        save_record(db, profile_id, "recipient", record)
    # Seed once: removing a demo contact must not make it reappear on reload.
    save_record(db, profile_id, "demo_contacts_seed", {"id":marker, "version":1})

def public_contact(record):
    return {k:record.get(k, False if k == "demo" else "") for k in ("id", "name", "upi_id", "phone", "demo")}

def demo_metadata(record):
    for name, phone, upi, aliases in DEMOS:
        if record["name"] == name and record.get("phone") == phone and record.get("upi_id") == upi:
            return {"demo":True, "aliases":aliases}
    return {"demo":False}

def owned_contact(profile_id, contact_id):
    with database() as db:
        record = read_record(db, profile_id, "recipient", str(contact_id))
    if not record:
        raise HTTPException(409, "This saved contact is no longer available. Choose a saved recipient again.")
    return record

def contact_is_current(profile_id, snapshot):
    try:
        current = public_contact(owned_contact(profile_id, snapshot["id"]))
    except HTTPException:
        return False
    return all(current[k] == snapshot.get(k, "") for k in ("name", "upi_id", "phone"))

def mentions(text, record):
    text = unicodedata.normalize("NFKC", text).casefold()
    def letter(char):
        return bool(char) and unicodedata.category(char)[0] in {"L", "M", "N"}
    for alias in names(record):
        for match in re.finditer(re.escape(alias), text):
            before, after = text[:match.start()], text[match.end():]
            # Spoken Kannada often attaches the recipient's case ending.
            after = re.sub(r"^(?:ಅವರಿಗೆ|ವರಿಗೆ|ಗೆ)", "", after)
            if not letter(before[-1:]) and not letter(after[:1]):
                return True
    return False

def resolve_contact(state, profile_id, text="", selected_id=None, allow_mentions=False):
    with database() as db:
        records = list_records(db, profile_id, "recipient")
    if selected_id:
        chosen = next((r for r in records if r["id"] == str(selected_id)), None)
        if not chosen:
            raise HTTPException(409, "This saved contact is no longer available. Choose again.")
        matches = [chosen]
    else:
        key = name_key(state.get("recipient", ""))
        matches = [r for r in records if key in names(r)] if key else []
        if allow_mentions and not matches:
            matches = [r for r in records if mentions(text, r)]
    state.pop("contact_candidates", None)
    state["contact"] = None
    if len(matches) > 1:
        state.update(step="choose_contact", contact_candidates=[r["id"] for r in matches], intent_confirmed=False)
        return "choose"
    if matches:
        record = matches[0]
        state.update(recipient=record["name"], contact=public_contact(record))
        if not record.get("upi_id") and not record.get("phone"):
            state.update(step="contact_details", intent_confirmed=False)
            return "missing"
    return None

def contact_choices(state, profile_id):
    with database() as db:
        rows = list_records(db, profile_id, "recipient")
    if state["step"] == "choose_contact":
        rows = [r for r in rows if r["id"] in state.get("contact_candidates", [])]
    return [{"label":r["name"] + (" · " + r["phone"][-4:] if r.get("phone") else "") +
             (" · " + r["upi_id"] if r.get("upi_id") else ""), "value":r["name"], "recipient_id":r["id"]} for r in rows[:8]]
