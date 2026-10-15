import pytest
from fastapi.testclient import TestClient
from main import app
from test_workflows import client, confirmed_attempt
from test_connected_assistants import turn


def contact(client, name="Akash"):
    return next(r for r in client.get("/api/recipients").json() if r["name"] == name)


def test_starter_contacts_owned_seeded_once_and_removable(client):
    rows = client.get("/api/recipients").json()
    assert {r["name"] for r in rows} == {"Akash", "Suraj", "Gowtham"}
    assert all(r["demo"] and not r["identity_verified"] and r["phone"].startswith("000") for r in rows)
    client.get("/api/profile")
    assert len(client.get("/api/recipients").json()) == 3
    client.delete("/api/recipients/" + rows[0]["id"])
    client.get("/api/profile")
    assert len(client.get("/api/recipients").json()) == 2
    with TestClient(app) as other:
        other.get("/api/profile")
        assert not {r["id"] for r in other.get("/api/recipients").json()} & {r["id"] for r in rows}


@pytest.mark.parametrize("language,text,name", [
    ("en-IN", "Pay Akash 500 for groceries", "Akash"),
    ("hi-IN", "आकाश को पाँच सौ रुपये किराने के लिए भेजो", "Akash"),
    ("kn-IN", "ಆಕಾಶ್ ಗೆ ಐನೂರು ರೂಪಾಯಿ ದಿನಸಿಗಾಗಿ ಕಳುಹಿಸು", "Akash"),
    ("en-IN", "Send 500 to Suraj for groceries", "Suraj"),
    ("en-IN", "Pay Gowtham 500 for groceries", "Gowtham"),
    ("kn-IN", "ಸೂರಜ್ ಗೆ ಐನೂರು ರೂಪಾಯಿ ದಿನಸಿಗಾಗಿ ಕಳುಹಿಸು", "Suraj"),
    ("hi-IN", "गौतम को पाँच सौ रुपये किराने के लिए भेजो", "Gowtham"),
])
def test_named_payment_binds_saved_destination(client, language, text, name):
    state = turn(client, {}, text, language)
    saved = contact(client, name)
    assert state["step"] == "review", state
    assert state["summary"]["recipient_id"] == saved["id"]
    assert state["summary"]["upi_id"] == saved["upi_id"]
    assert state["summary"]["phone"] == saved["phone"]
    assert saved["phone"][-4:] in state["reply"]
    assert state["next_action"] is None


def test_short_request_collects_details_and_correction_changes_destination(client):
    state = turn(client, {}, "Pay Akash")
    assert state["step"] == "amount" and state["contact"]["name"] == "Akash"
    state = turn(client, state, "500")
    state = turn(client, state, "groceries")
    state = turn(client, state, "change name to Suraj")
    assert state["summary"]["upi_id"] == "suraj@demo.invalid"
    state = turn(client, state, "change name to Akshay")
    assert state["contact"] is None and "upi_id" not in state["summary"]


def test_duplicate_names_require_explicit_selection(client):
    second = client.post("/api/recipients", json={"name":"Akash", "upi_id":"akash.other@demo.invalid", "phone":"0000000201"}).json()
    state = turn(client, {}, "Pay Akash 500 for groceries")
    assert state["step"] == "choose_contact" and state["summary"] is None
    assert len(state["choices"]) == 2
    state = client.post("/api/assistant/chat", json={"session_id":state["session_id"], "message":"Akash", "recipient_id":second["id"]}).json()
    assert state["summary"]["upi_id"] == second["upi_id"] and state["summary"]["amount"] == "500.00"


def test_phone_only_contact_and_missing_destination(client):
    client.post("/api/recipients", json={"name":"Demo Aunt", "phone":"0000000104"})
    state = turn(client, {}, "Send 200 to Demo Aunt for groceries")
    assert state["summary"]["phone"] == "0000000104" and state["summary"]["upi_id"] == ""
    client.post("/api/recipients", json={"name":"No Address"})
    state = turn(client, {}, "Send 200 to No Address for groceries")
    assert state["step"] == "contact_details" and state["summary"] is None


def test_changed_contact_invalidates_readback_and_payment_confirmation(client):
    state = turn(client, {}, "Pay Akash 500 for groceries")
    saved = contact(client)
    draft = client.post("/api/payments/review", json=state["summary"]).json()
    client.put("/api/recipients/" + saved["id"], json={"name":"Akash", "upi_id":"akash.new@demo.invalid", "phone":saved["phone"]})
    assert client.post("/api/payments/review", json=state["summary"]).status_code == 409
    response = client.post("/api/payments/drafts/" + draft["id"] + "/confirm", json={"recipient":draft["recipient"], "amount":draft["amount"], "revision":draft["revision"], "direction":"outgoing"})
    assert response.status_code == 409
    state = turn(client, state, "yes")
    assert state["step"] == "recipient" and not state["intent_confirmed"] and state["summary"] is None


def test_contact_change_after_confirmation_cannot_execute(client):
    state = turn(client, {}, "Pay Akash 500 for groceries")
    draft = client.post("/api/payments/review", json=state["summary"]).json()
    attempt = confirmed_attempt(client, draft)
    client.delete("/api/recipients/" + state["contact"]["id"])
    assert client.post("/api/demo-payments", json=attempt).status_code == 409
    assert client.get("/api/demo-payments/history").json() == []


def test_existing_receipt_replays_after_contact_removed(client):
    state = turn(client, {}, "Pay Akash 500 for groceries")
    draft = client.post("/api/payments/review", json=state["summary"]).json()
    attempt = confirmed_attempt(client, draft)
    payment = client.post("/api/demo-payments", json=attempt).json()
    client.delete("/api/recipients/" + state["contact"]["id"])
    assert client.post("/api/demo-payments", json=attempt).json() == payment
    assert len(client.get("/api/demo-payments/history").json()) == 1


def test_assistant_review_handoff_is_owned_idempotent_and_not_a_payment(client):
    state = turn(client, {}, "Pay Gowtham 500 for groceries")
    path = "/api/assistant/sessions/" + state["session_id"] + "/review"
    assert client.post(path, json={}).status_code == 409
    state = turn(client, state, "yes")
    draft = client.post(path, json={}).json()
    assert draft["upi_id"] == "gowtham@demo.invalid" and "review_token" not in draft
    assert client.post(path, json={}).json()["id"] == draft["id"]
    assert client.get("/api/payments/drafts/" + draft["id"]).status_code == 200
    with TestClient(app) as other:
        other.get("/api/profile")
        assert other.get("/api/payments/drafts/" + draft["id"]).status_code == 404
        assert other.post(path, json={}).status_code == 410
        assert other.post("/api/payments/review", json=state["summary"]).status_code == 409
    assert client.get("/api/demo-payments/history").json() == []


def test_scam_request_never_uses_contact_to_bypass_warning(client):
    state = turn(client, {}, "A bank caller says pay Akash 500 to move money to a safe account")
    assert state["step"] == "paused" and state["safety"]["paused"]
    saved = contact(client)
    state = client.post("/api/assistant/chat", json={"session_id":state["session_id"], "message":"Akash", "recipient_id":saved["id"]}).json()
    assert state["step"] == "paused"
    assert client.post("/api/assistant/sessions/" + state["session_id"] + "/review", json={}).status_code == 409
