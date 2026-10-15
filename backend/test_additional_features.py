import io
import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from PIL import Image, PngImagePlugin

from main import app
from storage import database, read_record, save_record
from identity import COOKIE, hits, digest
from reading import reading_hits, Explanation, sanitize_image
from test_workflows import client, draft, confirmed_attempt, stored_records

ACCOUNT = {"username": "sample_user", "password": "A demo phrase of several words"}


@pytest.fixture(autouse=True)
def clear_reading_hits():
    reading_hits.clear()


def register(client):
    response = client.post("/api/auth/register", json=ACCOUNT)
    assert response.status_code == 200, response.text
    return response.json()


def payment(client, outcome="pending", **fields):
    return client.post("/api/demo-payments", json=confirmed_attempt(client, draft(client, **fields), outcome)).json()


def enable_reminders(client):
    prefs = client.get("/api/profile").json()["preferences"]
    assert not prefs["reminders"]
    assert client.put("/api/profile/preferences", json={**prefs, "reminders": True}).status_code == 200


def test_account_adopts_guest_activity_and_rotates_cookie(client):
    old = client.cookies.get(COOKIE)
    guest = client.get("/api/profile").json()["id"]
    transaction = payment(client, "success")
    account = register(client)
    assert account["profile"]["id"] == guest
    assert account["profile"]["account"] == {"username": ACCOUNT["username"]}
    assert client.cookies.get(COOKIE) != old
    assert len(account["recovery_codes"]) == len(set(account["recovery_codes"])) == 4
    assert client.get("/api/demo-payments/history").json()[0]["transaction_id"] == transaction["transaction_id"]
    with TestClient(app) as other:
        other.cookies.set(COOKIE, old)
        assert other.get("/api/demo-payments/history").status_code == 401
    with database() as db:
        data = db.execute("SELECT password_hash FROM accounts").fetchone()[0]
        assert data.startswith("scrypt:") and ACCOUNT["password"] not in data
        assert db.execute("SELECT count(*) FROM recovery_codes").fetchone()[0] == 4
        assert account["recovery_codes"][0] not in db.execute("SELECT digest FROM recovery_codes").fetchone()[0]


def test_sign_in_recovers_owned_data_without_merging_guest(client):
    original = register(client)["profile"]["id"]
    transaction = payment(client, "success")
    cookie = client.cookies.get(COOKIE)
    assert client.post("/api/auth/sign-out").status_code == 200
    assert client.get("/api/demo-payments/history").status_code == 401
    guest = client.get("/api/profile").json()["id"]
    assert guest != original
    payment(client, "failed", recipient="Other person")
    assert client.post("/api/auth/sign-in", json=ACCOUNT).status_code == 200
    assert client.get("/api/profile").json()["id"] == original
    assert [p["transaction_id"] for p in client.get("/api/demo-payments/history").json()] == [transaction["transaction_id"]]
    with TestClient(app) as other:
        other.cookies.set(COOKIE, cookie)
        assert other.get("/api/demo-payments/history").status_code == 401


def test_recovery_is_one_use_and_revokes_other_sessions(client):
    codes = register(client)["recovery_codes"]
    with TestClient(app) as other:
        assert other.post("/api/auth/sign-in", json=ACCOUNT).status_code == 200
        new_password = "A different demo passphrase"
        result = client.post("/api/auth/recover", json={**ACCOUNT, "password": new_password, "code": codes[0].lower().replace("-", " ")})
        assert result.status_code == 200, result.text
        assert other.get("/api/demo-payments/history").status_code == 401
        assert other.post("/api/auth/sign-in", json=ACCOUNT).status_code == 401
        assert other.post("/api/auth/sign-in", json={**ACCOUNT, "password": new_password}).status_code == 200
    assert client.post("/api/auth/recover", json={**ACCOUNT, "code": codes[0]}).status_code == 401
    assert client.post("/api/auth/recover", json={**ACCOUNT, "code": codes[1]}).status_code == 200


def test_auth_failure_limit_survives_new_client(client):
    register(client)
    for _ in range(5):
        assert client.post("/api/auth/sign-in", json={**ACCOUNT, "password": "Incorrect password phrase"}).status_code == 401
    with TestClient(app) as other:
        assert other.post("/api/auth/sign-in", json=ACCOUNT).status_code == 429


@pytest.mark.parametrize("override", [{"username": "!"}, {"password": "short-secret"}, {"password": "x" * 129}])
def test_credentials_not_echoed_on_validation_error(client, override):
    body = {**ACCOUNT, **override}
    response = client.post("/api/auth/register", json=body)
    assert response.status_code == 422
    assert body["password"] not in response.text


def test_auth_routes_do_not_disable_financial_secret_guard(client):
    assert client.post("/api/auth/register", json={**ACCOUNT, "password": "password is 123456 a long phrase"}).status_code == 200
    assert client.post("/api/assistant/chat", json={"message": "password is 123456 a long phrase"}).status_code == 422


def test_account_export_and_delete_omit_credentials_and_cascade(client):
    register(client)
    data = client.get("/api/profile/export").json()
    assert not any(name in data for name in ("accounts", "password_hash", "auth_sessions", "recovery_codes"))
    assert client.delete("/api/profile").status_code == 200
    with database() as db:
        for table in ("accounts", "auth_sessions", "recovery_codes"):
            assert db.execute("SELECT count(*) FROM " + table).fetchone()[0] == 0
    assert client.post("/api/auth/sign-in", json=ACCOUNT).status_code == 401


def test_expired_account_is_cleaned_up(client):
    profile_id = register(client)["profile"]["id"]
    with database() as db:
        db.execute("UPDATE profiles SET expires=0 WHERE id=?", (profile_id,))
    assert client.get("/api/demo-payments/history").status_code == 401
    assert client.get("/api/profile").json()["account"] is None
    with database() as db:
        assert db.execute("SELECT count(*) FROM accounts").fetchone()[0] == 0


def test_sign_out_revokes_only_current_account_session(client):
    register(client)
    with TestClient(app) as other:
        other.post("/api/auth/sign-in", json=ACCOUNT)
        client.post("/api/auth/sign-out")
        assert other.get("/api/demo-payments/history").status_code == 200
        with database() as db:
            db.execute("UPDATE auth_sessions SET expires=0")
        assert other.get("/api/demo-payments/history").status_code == 401


def test_reminder_consent_dedup_snooze_dismiss_and_resolution(client):
    p = payment(client)
    body = {"transaction_id": p["transaction_id"], "minutes": 1, "consent": True}
    assert client.post("/api/reminders", json=body).status_code == 409
    enable_reminders(client)
    assert client.post("/api/reminders", json={**body, "consent": False}).status_code == 409
    item = client.post("/api/reminders", json=body).json()
    assert client.post("/api/reminders", json=body).json()["id"] == item["id"]
    assert len(client.get("/api/reminders").json()["items"]) == 1
    profile_id = client.get("/api/profile").json()["id"]
    with database() as db:
        saved = read_record(db, profile_id, "reminder", item["id"])
        saved["due_at"] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        save_record(db, profile_id, "reminder", saved)
    assert client.get("/api/reminders").json()["items"][0]["due"]
    assert client.put("/api/reminders/" + item["id"], json={"action": "snooze"}).status_code == 200
    assert not client.get("/api/reminders").json()["items"][0]["due"]
    client.post("/api/demo-payments/" + p["transaction_id"] + "/check")
    client.post("/api/demo-payments/" + p["transaction_id"] + "/check")
    resolved = client.get("/api/reminders").json()["items"][0]
    assert resolved["state"] == "resolved" and not resolved["due"]
    assert len(client.get("/api/demo-payments/history").json()) == 1
    assert client.put("/api/reminders/" + item["id"], json={"action": "snooze"}).status_code == 409
    assert client.put("/api/reminders/" + item["id"], json={"action": "dismiss"}).json()["state"] == "dismissed"
    assert client.post("/api/reminders", json=body).status_code == 409


def test_disabled_reminder_has_no_due_alert(client):
    p = payment(client)
    enable_reminders(client)
    item = client.post("/api/reminders", json={"transaction_id": p["transaction_id"], "minutes": 1, "consent": True}).json()
    profile = client.get("/api/profile").json()
    with database() as db:
        item["due_at"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        save_record(db, profile["id"], "reminder", item)
    client.put("/api/profile/preferences", json={**profile["preferences"], "reminders": False})
    assert not client.get("/api/reminders").json()["items"][0]["due"]
    assert client.put("/api/reminders/" + item["id"], json={"action": "snooze"}).status_code == 409


def test_progress_and_reminders_are_owned(client):
    client.put("/api/progress/pension", json={"completed_steps": [2, 0, 2]})
    enable_reminders(client)
    p = payment(client)
    item = client.post("/api/reminders", json={"transaction_id": p["transaction_id"], "consent": True}).json()
    with TestClient(app) as other:
        other.get("/api/profile")
        assert other.get("/api/progress").json() == []
        assert other.get("/api/reminders").json()["items"] == []
        assert other.put("/api/reminders/" + item["id"], json={"action": "dismiss"}).status_code == 404
        prefs = other.get("/api/profile").json()["preferences"]
        other.put("/api/profile/preferences", json={**prefs, "reminders": True})
        assert other.post("/api/reminders", json={"transaction_id": p["transaction_id"], "consent": True}).status_code == 404
    assert client.get("/api/progress").json()[0]["completed_steps"] == [0, 2]
    with TestClient(app) as restarted:
        restarted.cookies.update(client.cookies)
        assert restarted.get("/api/progress").json()[0]["completed_steps"] == [0, 2]
    assert client.put("/api/progress/pension", json={"completed_steps": []}).json()["completed_steps"] == []


@pytest.mark.parametrize("task,steps", [("unknown", [0]), ("pension", [4]), ("lesson-7", [0]), ("lesson-1", [-1]), ("lesson-1", [True]), ("health", ["1"])])
def test_invalid_progress(client, task, steps):
    assert client.put("/api/progress/" + task, json={"completed_steps": steps}).status_code == 422


def test_familiar_tasks_are_owned_no_bills_or_failed_payments(client):
    payment(client, "failed")
    payment(client, "success", recipient="Lakshmi")
    payment(client, "success", recipient="Lakshmi")
    bill = client.post("/api/bills/lookup", json={"provider": "Demo City Electricity", "consumer_number": "12345678"}).json()
    payment(client, "success", recipient=bill["recipient"], amount=bill["amount"], purpose=bill["purpose"], bill_id=bill["id"])
    tasks = client.get("/api/familiar-tasks").json()
    assert len(tasks) == 1 and tasks[0]["recipient"] == "Lakshmi" and not tasks[0]["identity_verified"]
    assert not any(k in tasks[0] for k in ("review_token", "draft_id", "bill_id"))
    with TestClient(app) as other:
        other.get("/api/profile")
        assert other.get("/api/familiar-tasks").json() == []


def image_bytes():
    image = Image.new("RGB", (100, 100), "white")
    meta = PngImagePlugin.PngInfo()
    meta.add_text("private", "remove this metadata")
    result = io.BytesIO()
    image.save(result, "PNG", pnginfo=meta)
    return result.getvalue()


def test_image_sanitization_strips_metadata_and_rejects_invalid_files():
    clean = sanitize_image(image_bytes())
    with Image.open(io.BytesIO(clean)) as image:
        assert not image.info and image.size == (100, 100)
    with pytest.raises(Exception) as caught:
        sanitize_image(b"not an image")
    assert caught.value.status_code == 422


@pytest.mark.parametrize("language", ["en-IN", "hi-IN", "kn-IN"])
def test_reading_requires_consent_and_has_honest_text_fallback(client, language):
    before = stored_records()
    body = {"text": "Sample bill: total 850, due next week", "language": language, "consent": True}
    assert client.post("/api/reading/text", json={**body, "consent": False}).status_code == 409
    result = client.post("/api/reading/text", json=body).json()
    assert result["engine"] == "text_fallback" and result["visible_text"] == body["text"]
    assert not result["safety"]["paused"]
    assert stored_records() == before


def test_reading_safety_cannot_initiate_payment(client):
    result = client.post("/api/reading/text", json={"text": "Pay first to receive a refund", "consent": True}).json()
    assert result["safety"]["paused"]
    assert client.get("/api/demo-payments/history").json() == []
    assert client.post("/api/reading/text", json={"text": "OTP is 123456", "consent": True}).status_code == 422


def test_image_endpoint_limits_and_missing_ai(client):
    uri = "/api/reading/image?consent=true"
    assert client.post("/api/reading/image", content=image_bytes(), headers={"Content-Type": "image/png"}).status_code == 409
    assert client.post(uri, content=b"x", headers={"Content-Type": "application/pdf"}).status_code == 415
    assert client.post(uri, content=b"x", headers={"Content-Type": "image/png"}).status_code == 422
    assert client.post(uri, content=image_bytes(), headers={"Content-Type": "image/png"}).status_code == 503
    assert client.post(uri, content=b"x" * (5 * 1024 * 1024 + 1), headers={"Content-Type": "image/png"}).status_code == 413
    assert client.post("/api/reading/text", json={"text": "x" * 17000, "consent": True}).status_code == 413


def test_chunked_image_upload_cannot_bypass_size_limit(client):
    chunks = (b"x" * (1024 * 1024) for _ in range(6))
    assert client.post("/api/reading/image?consent=true", content=chunks, headers={"Content-Type": "image/png"}).status_code == 413


def test_chunked_json_is_bounded_and_empty_json_delete_works(client):
    chunks = (b"x" * 10000 for _ in range(3))
    assert client.post("/api/assistant/chat", content=chunks, headers={"Content-Type": "application/json"}).status_code == 413
    register(client)
    assert client.delete("/api/profile", headers={"Content-Type": "application/json"}).status_code == 200
    assert client.get("/api/demo-payments/history").status_code == 401


@pytest.mark.parametrize("size,animated", [((10, 10), False), ((3500, 3500), False), ((100, 100), True)])
def test_image_dimensions_and_animation_are_rejected(size, animated):
    image = Image.new("RGB", size, "white")
    data = io.BytesIO()
    image.save(data, "PNG", save_all=animated, append_images=[Image.new("RGB", size, "black")] if animated else [])
    with pytest.raises(Exception) as caught:
        sanitize_image(data.getvalue())
    assert caught.value.status_code == 422


def test_reading_schema_response_flags_and_failure(client, monkeypatch):
    import reading
    monkeypatch.setenv("GEMINI_ENABLED", "1")
    monkeypatch.setenv("GEMINI_API_KEY", "test-only")
    parsed = Explanation(title="Sample", summary="Visible words", visible_text="Sample bill", unclear=True, possible_deception=True, contains_private_credentials=False)
    monkeypatch.setattr(reading, "explain_ai", lambda content, language: parsed)
    result = client.post("/api/reading/image?consent=true", content=image_bytes(), headers={"Content-Type": "image/png"}).json()
    assert result["engine"] == "gemini" and result["unclear"] and result["safety"]["paused"]
    parsed.contains_private_credentials = True
    assert client.post("/api/reading/text", json={"text": "Sample words", "consent": True}).status_code == 422
    def unavailable(*_):
        raise TimeoutError
    monkeypatch.setattr(reading, "explain_ai", unavailable)
    assert client.post("/api/reading/text", json={"text": "Sample words", "consent": True}).json()["engine"] == "text_fallback"
    assert client.post("/api/reading/image?consent=true", content=image_bytes(), headers={"Content-Type": "image/png"}).status_code == 503


def test_reading_limit(client):
    for _ in range(6):
        assert client.post("/api/reading/text", json={"text": "Sample bill words", "consent": True}).status_code == 200
    assert client.post("/api/reading/text", json={"text": "Sample bill words", "consent": True}).status_code == 429
