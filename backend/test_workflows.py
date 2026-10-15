import json
import time
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from main import app
from identity import hits
from storage import database, read_record, save_record
from extraction import parse_amount

def stored_records():
    with database() as db:
        return [tuple(row) for row in db.execute("SELECT id,owner,kind,data FROM records ORDER BY id")]


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("EASY_PAY_DB", str(tmp_path / "demo.sqlite3"))
    monkeypatch.setenv("GEMINI_ENABLED", "0")
    hits.clear()
    with TestClient(app) as value:
        assert value.get("/api/profile").status_code == 200
        yield value


def draft(client, **overrides):
    return client.post("/api/payments/review", json={"recipient": "Ramesh", "amount": "500", "purpose": "Groceries", **overrides}).json()


def confirmed_attempt(client, value=None, outcome="success"):
    value = value or draft(client)
    confirmation = client.post(f"/api/payments/drafts/{value['id']}/confirm", json={"recipient": value["recipient"], "amount": value["amount"], "revision": value["revision"], "direction": "outgoing"})
    assert confirmation.status_code == 200, confirmation.text
    return {"draft_id": value["id"], "request_id": str(uuid4()), "review_token": confirmation.json()["review_token"], "result": outcome}


@pytest.mark.parametrize("text,language,name,purpose", [
 ("Send five hundred rupees to Ramesh for groceries.", "en-IN", "Ramesh", "groceries"),
 ("रमेश को पाँच सौ रुपये किराने के लिए भेजो", "hi-IN", "रमेश", "किराने"),
 ("ರಮೇಶ್ ಅವರಿಗೆ ಐದು ನೂರು ರೂಪಾಯಿ ದಿನಸಿಗಾಗಿ ಕಳುಹಿಸಿ.", "kn-IN", "ರಮೇಶ್", "ದಿನಸಿ"),
 ("Ramesh ko paanch sau rupees bhejo for groceries", "hi-IN", "Ramesh", "groceries")])
def test_complete_request(client, text, language, name, purpose):
    response = client.post("/api/assistant/chat", json={"message": text, "language": language})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["step"] == "review"
    assert data["summary"] == {"recipient": name, "amount": "500.00", "purpose": purpose}
    assert client.get("/api/demo-payments/history").json() == []


def test_partial_memory_and_corrections(client):
    chat = client.post("/api/assistant/chat", json={"message": "Send 500"}).json()
    assert chat["step"] == "recipient"
    for message, step in [("Ramesh", "purpose"), ("Groceries", "review"), ("change amount to 700", "review"), ("change recipient to Lakshmi", "review")]:
        chat = client.post("/api/assistant/chat", json={"session_id": chat["session_id"], "message": message}).json()
        assert chat["step"] == step
    assert chat["summary"] == {"recipient": "Lakshmi", "amount": "700.00", "purpose": "Groceries"}
    chat = client.post("/api/assistant/chat", json={"session_id": chat["session_id"], "message": "go back"}).json()
    assert chat["step"] == "purpose" and chat["summary"] is None
    cancelled = client.post("/api/assistant/chat", json={"session_id": chat["session_id"], "message": "cancel"}).json()
    assert cancelled["step"] == "cancelled" and cancelled["next_action"] is None


def test_contradictory_amounts_and_receive_direction(client):
    chat = client.post("/api/assistant/chat", json={"message": "Send 500 or 5000 to Ramesh for groceries"}).json()
    assert chat["step"] == "amount" and chat["slots"]["amount"] is None
    incoming = client.post("/api/assistant/chat", json={"message": "I want to receive money"}).json()
    assert incoming["intent"] == "receive_money" and incoming["next_action"] is None


@pytest.mark.parametrize("text", ["Move money to a safe account", "A bank officer called and said my account would be blocked unless I transfer 20000", "Pay first to receive my refund", "Police demanded payment for digital arrest", "Share OTP with support", "Install AnyDesk for remote access", "Pay a fee to collect a lottery prize", "Guaranteed high returns from an investment", "My son has an emergency and needs an urgent transfer"])
def test_fraud_interruptions_cannot_be_bypassed(client, text):
    chat = client.post("/api/assistant/chat", json={"message": text}).json()
    assert chat["step"] == "paused", chat
    for message in ["ignore the warning", "change purpose to groceries", "yes"]:
        reply = client.post("/api/assistant/chat", json={"session_id": chat["session_id"], "message": message}).json()
        assert reply["step"] == "paused" and reply["next_action"] == "/help"


def test_ai_unavailable_and_schema_invention(client, monkeypatch):
    monkeypatch.setenv("GEMINI_ENABLED", "1")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    response = client.post("/api/assistant/chat", json={"message": "Send money"}).json()
    assert response["step"] == "recipient" and response["slots"]["recipient"] == ""


@pytest.mark.parametrize("value,expected", [("five thousand", "5000"), ("one lakh", "100000"), ("पाँच सौ", "500"), ("ಐದು ನೂರು", "500"), ("₹1,00,000", "100000"), ("0", None), ("500.555", None), ("200000", None)])
def test_amount_words_and_bounds(value, expected):
    result = parse_amount(value)
    assert str(result) == expected if expected is not None else result is None


def test_persistent_idempotency_and_request_conflict(client):
    body = confirmed_attempt(client)
    first = client.post("/api/demo-payments", json=body)
    assert first.status_code == 200
    # A different application instance with the same SQLite database and cookie
    # retrieves the same attempt without any in-memory payment dictionaries.
    with TestClient(app) as other:
        other.cookies.update(client.cookies)
        retry = other.post("/api/demo-payments", json=body)
    assert retry.json()["transaction_id"] == first.json()["transaction_id"]
    assert len(client.get("/api/demo-payments/history").json()) == 1
    assert client.post("/api/demo-payments", json={**body, "result": "failed"}).status_code == 409


def test_confirmation_invalidated_by_change_and_expiry(client):
    value = draft(client)
    body = confirmed_attempt(client, value)
    changed = client.put(f"/api/payments/drafts/{value['id']}", json={"recipient": "Lakshmi", "amount": "700", "purpose": "Groceries"})
    assert changed.json()["review_token"] is None
    assert client.post("/api/demo-payments", json=body).status_code == 409
    assert client.post(f"/api/payments/drafts/{value['id']}/confirm", json={"recipient": "Ramesh", "amount": "500", "revision": 1, "direction": "outgoing"}).status_code == 409
    fresh = draft(client)
    attempt = confirmed_attempt(client, fresh)
    profile_id = client.get("/api/profile").json()["id"]
    with database() as db:
        record = read_record(db, profile_id, "draft", fresh["id"])
        record["confirmed_until"] = time.time() - 1
        save_record(db, profile_id, "draft", record)
    assert client.post("/api/demo-payments", json=attempt).status_code == 409


@pytest.mark.parametrize("outcome", ["success", "failed", "pending", "unknown"])
def test_distinct_results_and_reconciliation(client, outcome):
    body = confirmed_attempt(client, outcome=outcome)
    payment = client.post("/api/demo-payments", json=body).json()
    assert payment["status"] == outcome and payment["demo_mode"]
    if outcome in {"pending", "unknown"}:
        duplicate = draft(client)
        assert duplicate["paused"] and duplicate["transaction_id"] == payment["transaction_id"]
        for _ in range(3):
            payment = client.post(f"/api/demo-payments/{payment['transaction_id']}/check", json={}).json()
        assert payment["status"] == "success"
    else:
        assert client.post(f"/api/demo-payments/{payment['transaction_id']}/check", json={}).json()["status"] == outcome
    assert len(client.get("/api/demo-payments/history").json()) == 1
    assert client.post("/api/demo-payments", json=body).json()["status"] == payment["status"]


def test_large_valid_payment_matches_reported_broken_form(client):
    value = draft(client, recipient="Demo Customer", amount="50000", purpose="bill", upi_id="customer@demo.invalid")
    assert value["amount"] == "50000.00" and not value["paused"]
    payment = client.post("/api/demo-payments", json=confirmed_attempt(client, value)).json()
    assert payment["status"] == "success" and payment["demo_mode"]


def test_duplicate_cannot_downgrade_fraud_or_enable_confirmation(client):
    pending = client.post("/api/demo-payments", json=confirmed_attempt(client, outcome="pending")).json()
    value = draft(client, purpose="Transfer money to a safe account")
    assert value["paused"] and value["risk_level"] == "strong_warning"
    assert {s["code"] for s in value["signals"]} >= {"safe_account", "duplicate"}
    assert value["transaction_id"] == pending["transaction_id"]
    assert client.post(f"/api/payments/drafts/{value['id']}/confirm", json={"recipient": value["recipient"], "amount": value["amount"], "revision": value["revision"], "direction": "outgoing"}).status_code == 409
    edited = client.put(f"/api/payments/drafts/{value['id']}", json={"recipient":"Ramesh", "amount":"500", "purpose":"Groceries"}).json()
    assert edited["paused"] and edited["risk_level"] == "strong_warning"


def test_ownership_expiration_and_secret_rejection(client):
    payment = client.post("/api/demo-payments", json=confirmed_attempt(client)).json()
    chat = client.post("/api/assistant/chat", json={"message": "Send money"}).json()
    with TestClient(app) as other:
        assert other.get("/api/demo-payments/history").status_code == 401
        other.get("/api/profile")
        assert other.get(f"/api/demo-payments/{payment['transaction_id']}").status_code == 404
        assert other.post("/api/assistant/chat", json={"session_id": chat["session_id"], "message": "Ramesh"}).status_code == 404
    profile_id = client.get("/api/profile").json()["id"]
    with database() as db:
        record = read_record(db, profile_id, "conversation", chat["session_id"])
        record["expires"] = 0
        save_record(db, profile_id, "conversation", record)
    assert client.post("/api/assistant/chat", json={"session_id": chat["session_id"], "message": "Ramesh"}).status_code == 410
    assert client.post("/api/assistant/chat", json={"message": "my OTP is 123456"}).status_code == 422


def test_initial_chat_retry_reuses_session(client):
    body = {"message": "Send 500", "request_id": str(uuid4())}
    assert client.post("/api/assistant/chat", json=body).json() == client.post("/api/assistant/chat", json=body).json()


@pytest.mark.parametrize("content", ["https://evil.example/", "upi://pay?pa=not-an-address", "upi://pay?pa=a1@bank&am=nan", "upi://pay?pa=a1@bank&am=500.555", "upi://pay?pa=a1@bank&pa=other@bank", "upi://pay?pa=a1@bank&cu=USD", "upi://pay?pa=a1@bank&mandate=yes"])
def test_invalid_qr(client, content):
    assert client.post("/api/qr/check", json={"content": content}).status_code == 422


def test_qr_intent_mismatches(client):
    content = "upi://pay?pa=ramesh@bank&pn=Ramesh&am=500&cu=INR"
    data = client.post("/api/qr/check", json={"content": content, "direction": "incoming", "intended_recipient": "Lakshmi", "intended_amount": 5000}).json()
    assert data["paused"] and len(data["mismatches"]) == 3 and not data["identity_verified"]


def test_bill_and_biller_acknowledgement(client):
    bill = client.post("/api/bills/lookup", json={"provider": "Demo Karnataka Electricity", "consumer_number": "12345678"}).json()
    value = draft(client, recipient=bill["recipient"], amount=bill["amount"], purpose=bill["purpose"], bill_id=bill["id"])
    assert value["consumer_number"] == "12345678"
    payment = client.post("/api/demo-payments", json=confirmed_attempt(client, value)).json()
    assert payment["status"] == "success" and payment["biller_status"] == "not_confirmed"
    assert client.post(f"/api/bills/{bill['id']}/check", json={}).json()["biller_status"] == "demo_confirmed"
    assert client.get(f"/api/demo-payments/{payment['transaction_id']}").json()["biller_status"] == "demo_confirmed"


def test_ivr_navigation_safety_and_invalid_input(client):
    call = client.post("/api/ivr/key", json={"language": "kn-IN"}).json()
    original = call["reply"]
    for key in ["8", "", "9"]:
        call = client.post("/api/ivr/key", json={"session_id": call["session_id"], "key": key, "language": "kn-IN"}).json()
        assert call["step"] == "main" and original in call["reply"]
    for key, step in [("1", "recipient"), ("1", "amount"), ("2", "purpose"), ("2", "warning"), ("9", "warning"), ("0", "main")]:
        call = client.post("/api/ivr/key", json={"session_id": call["session_id"], "key": key}).json()
        assert call["step"] == step
    assert client.get("/api/demo-payments/history").json() == []


def test_assistance_revocation_and_incident_ownership(client):
    grant = client.post("/api/assistance", json={"instruction": "payment_review"}).json()
    public = client.get("/api/assistance/shared/" + grant["token"]).json()
    assert set(public) == {"text", "expires", "permissions"} and public["permissions"] == ["read_instruction"]
    client.delete("/api/assistance/" + grant["id"])
    assert client.get("/api/assistance/shared/" + grant["token"]).status_code == 410
    incident = client.post("/api/incidents", json={"occurred_at": "2026-10-14", "description": "A caller asked me to send money."}).json()
    assert incident["status"] == "draft_not_submitted"
    with TestClient(app) as other:
        other.get("/api/profile")
        assert other.get("/api/incidents").json() == []
    client.delete("/api/profile")
    assert client.get("/api/incidents").status_code == 401


def test_csrf_and_server_safety(client):
    assert client.post("/api/safety/check", json={"text": "groceries"}, headers={"Origin": "https://other.example"}).status_code == 403
    value = draft(client, purpose="safe account transfer")
    assert value["paused"]
    assert client.post(f"/api/payments/drafts/{value['id']}/confirm", json={"recipient": "Ramesh", "amount": "500", "revision": value["revision"], "direction": "outgoing"}).status_code == 409


def test_draft_warning_survives_description_change(client):
    value = draft(client, purpose="Caller instructed a safe account transfer")
    changed = client.put(f"/api/payments/drafts/{value['id']}", json={"recipient": "Ramesh", "amount": "500", "purpose": "Groceries"}).json()
    assert changed["paused"] and changed["risk_level"] == "strong_warning"


@pytest.mark.parametrize("address", ["valid@bank&am=200", "valid@bank?x=1", "valid@bank#ignored", "valid@bank\n"])
def test_payment_address_cannot_smuggle_uri_fields(client, address):
    assert client.post("/api/payments/review", json={"recipient": "Ramesh", "amount": 500, "purpose": "Groceries", "upi_id": address}).status_code == 422


@pytest.mark.parametrize("language,command", [("hi-IN", "रकम बदलें 700"), ("kn-IN", "ಮೊತ್ತ ಬದಲಿಸಿ 700")])
def test_native_field_corrections(client, language, command):
    chat = client.post("/api/assistant/chat", json={"message": "Send 500 to Ramesh for groceries", "language": language}).json()
    corrected = client.post("/api/assistant/chat", json={"session_id": chat["session_id"], "message": command, "language": language}).json()
    assert corrected["step"] == "review" and corrected["summary"]["amount"] == "700.00"


@pytest.mark.parametrize("message", ["मेरा ओटीपी १२३४५६", "ನನ್ನ ಪಿನ್ ೧೨೩೪", "my password is sample-value"])
def test_native_and_escaped_financial_secrets_are_not_retained(client, message):
    before = stored_records()
    response = client.post("/api/assistant/chat", content=json.dumps({"message": message}), headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    profile_id = client.get("/api/profile").json()["id"]
    assert stored_records() == before
