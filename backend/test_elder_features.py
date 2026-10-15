import io
import wave

import pytest
from fastapi.testclient import TestClient
from main import app
from extraction import extract_local, parse_amount
from speech import speech_hits, Transcript
from speech import speech_text
from storage import database, read_record
from test_workflows import client, stored_records


@pytest.fixture(autouse=True)
def clean_speech():
    speech_hits.clear()


def wav_bytes(seconds=.1):
    result = io.BytesIO()
    with wave.open(result, "wb") as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(16000)
        wav.writeframes(b"\0\0" * int(seconds * 16000))
    return result.getvalue()

@pytest.mark.parametrize("language,value,expected",[("kn-IN","₹500.00","500 ರೂಪಾಯಿ"),("hi-IN","₹1,000.25","1000 रुपये 25 पैसे"),("en-IN","₹0.05","0 rupees 5 paise")])
def test_currency_spoken_without_changing_value(language,value,expected):
    assert speech_text(value,language)==expected

def test_transcription_rejects_wrong_script_without_creating_payment(client,monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY","mock-key")
    monkeypatch.setenv("GEMINI_ENABLED","1")
    monkeypatch.setattr("speech.transcribe_audio",lambda *args:Transcript(text="తెలుగు",unclear=False,contains_private_credentials=False))
    result=client.post("/api/speech/transcribe?language=kn-IN&consent=true",content=wav_bytes(),headers={"content-type":"audio/wav"})
    assert result.status_code==422
    assert client.get("/api/demo-payments/history").json()==[]


@pytest.mark.parametrize("value,expected", [("ಐನೂರು", "500"), ("ಐದುನೂರು", "500"), ("ಐದುಸಾವಿರ", "5000"), ("ಐವತ್ತೈದು", "55"), ("ಇಪ್ಪತ್ತೆರಡು", "22"), ("ನೂರ ಐವತ್ತು", "150"), ("ಐದು ನೂರು ರೂಪಾಯಿಗಳನ್ನು", "500"), ("aidu nooru rupayi", "500")])
def test_kannada_number_forms(value, expected):
    assert str(parse_amount(value)) == expected


@pytest.mark.parametrize("text,recipient,amount,purpose", [
    ("ರಮೇಶ್ ಗೆ ಐನೂರು ರೂಪಾಯಿ ದಿನಸಿಗೆ ಕಳಿಸು", "ರಮೇಶ್", "500.00", "ದಿನಸಿ"),
    ("ಐದುನೂರು ರೂಪಾಯಿಗಳನ್ನು ರಮೇಶ್ ಅವರಿಗೆ ಕಳುಹಿಸಿ", "ರಮೇಶ್", "500.00", ""),
    ("ರಮೇಶನಿಗೆ 500 ರೂಪಾಯಿ ಕಳುಹಿಸು", "ರಮೇಶ", "500.00", ""),
    ("Ramesh ge aidu nooru rupayi dinasige kalisi", "Ramesh", "500.00", "dinasige"),
])
def test_natural_kannada_requests(client, text, recipient, amount, purpose):
    local = extract_local(text)
    assert (local["intent"], local["recipient"], local["amount"], local["purpose"]) == ("send_money", recipient, amount, purpose)
    result = client.post("/api/assistant/chat", json={"message": text, "language": "kn-IN"}).json()
    assert result["slots"]["amount"] == "500.00" and result["language"] == "kn-IN"
    assert result["step"] == ("review" if purpose else "purpose")
    assert client.get("/api/demo-payments/history").json() == []


def test_unicode_marks_cannot_turn_unknown_word_into_partial_amount(client):
    value = extract_local("ರಮೇಶ್ ಗೆ ಐದುನೂರುಅಲ್ಲ ರೂಪಾಯಿ ಕಳುಹಿಸಿ")
    assert value["amount"] is None
    assert extract_local("ರಮೇಶ್ ಗೆ ಐದುನೂರು ಅಥವಾ ಐದುಸಾವಿರ ಕಳಿಸಿ")["conflicting_amounts"]
    result = client.post("/api/assistant/chat", json={"message":"ಹಣ ಕಳಿಸಬೇಕು", "language":"kn-IN"}).json()
    assert result["step"] == "recipient"
    cancelled = client.post("/api/assistant/chat", json={"session_id":result["session_id"], "message":"ರದ್ದು ಮಾಡಿ", "language":"kn-IN"}).json()
    assert cancelled["step"] == "cancelled"


def test_switch_language_translates_current_question_without_changing_fields(client):
    first = client.post("/api/assistant/chat", json={"message":"Send 500 to Ramesh", "language":"en-IN"}).json()
    profile_id = client.get("/api/profile").json()["id"]
    with database() as db:
        old = read_record(db, profile_id, "conversation", first["session_id"])
    result = client.get("/api/assistant/sessions/" + first["session_id"] + "?language=kn-IN").json()
    assert result["language"] == "kn-IN" and result["slots"] == first["slots"]
    assert result["reply"] == "ಈ ಪಾವತಿ ಯಾವುದಕ್ಕಾಗಿ?"
    with database() as db:
        assert read_record(db, profile_id, "conversation", first["session_id"]) == old
    with TestClient(app) as other:
        other.get("/api/profile")
        assert other.get("/api/assistant/sessions/" + first["session_id"]).status_code == 404


def test_trusted_contact_validation_isolation_export_and_undo(client):
    body = {"name":"Demo family", "phone":"+91 (00000) 00000", "relationship":"Family"}
    saved = client.post("/api/help-contacts", json=body).json()
    assert saved["phone"] == "+910000000000"
    assert client.post("/api/help-contacts", json=body).status_code == 409
    with TestClient(app) as other:
        other.get("/api/profile")
        assert other.get("/api/help-contacts").json() == []
        assert other.delete("/api/help-contacts/" + saved["id"]).status_code == 404
    exported = client.get("/api/profile/export").json()
    assert exported["help_contact"][0]["name"] == body["name"]
    assert client.delete("/api/help-contacts/" + saved["id"], headers={"Content-Type":"application/json"}).status_code == 200
    restored = client.post("/api/help-contacts", json=body).json()
    assert restored["id"] != saved["id"] and len(client.get("/api/help-contacts").json()) == 1
    client.delete("/api/profile")
    with database() as db:
        assert db.execute("SELECT count(*) FROM records WHERE kind='help_contact'").fetchone()[0] == 0


@pytest.mark.parametrize("phone", ["1930", "0000000000", "+91javascript:alert(1)", "+1;call99999", "1"*16])
def test_invalid_help_contact_numbers(client, phone):
    assert client.post("/api/help-contacts", json={"name":"Sample", "phone":phone}).status_code == 422


def test_controls_progress_stays_separate_from_payments(client):
    assert client.put("/api/progress/controls", json={"completed_steps":[0,1,2,3]}).status_code == 200
    assert client.put("/api/progress/controls", json={"completed_steps":[4]}).status_code == 422
    assert client.get("/api/demo-payments/history").json() == []


def enable_speech(monkeypatch):
    monkeypatch.setenv("GEMINI_ENABLED", "1"); monkeypatch.setenv("GEMINI_API_KEY", "test-only"); monkeypatch.setenv("SPEECH_ENABLED", "1")


def test_speech_consent_offline_and_cache_policy(client, monkeypatch):
    before = stored_records()
    import speech
    body = {"text":"ಹಣವನ್ನು ಯಾರಿಗೆ ಕಳುಹಿಸಬೇಕು?", "language":"kn-IN", "consent":True}
    assert client.post("/api/speech/speak", json={**body,"consent":False}).status_code == 409
    assert client.post("/api/speech/speak", json=body).status_code == 503
    enable_speech(monkeypatch)
    data = wav_bytes()
    monkeypatch.setattr(speech, "generate_audio", lambda *_: data)
    response = client.post("/api/speech/speak", json=body)
    assert response.status_code == 200 and response.content == data
    assert response.headers["content-type"] == "audio/wav" and response.headers["cache-control"] == "no-store"
    assert client.post("/api/speech/speak", json={**body,"text":"OTP is 123456"}).status_code == 422
    assert stored_records() == before


def test_speech_provider_failure_and_output_validation(client, monkeypatch):
    import speech
    enable_speech(monkeypatch)
    def broken(*_): raise TimeoutError()
    monkeypatch.setattr(speech, "generate_audio", broken)
    assert client.post("/api/speech/speak", json={"text":"ನಮಸ್ಕಾರ", "consent":True}).status_code == 503


def test_speech_transcript_is_reviewed_not_executed(client, monkeypatch):
    before = stored_records()
    import speech
    enable_speech(monkeypatch)
    monkeypatch.setattr(speech, "transcribe_audio", lambda *_: Transcript(text="ರಮೇಶ್ ಗೆ ಐನೂರು ರೂಪಾಯಿ ದಿನಸಿಗೆ ಕಳಿಸು", unclear=False, contains_private_credentials=False))
    data = wav_bytes()
    url = "/api/speech/transcribe?consent=true&language=kn-IN"
    assert client.post("/api/speech/transcribe", content=data, headers={"Content-Type":"audio/wav"}).status_code == 409
    response = client.post(url, content=data, headers={"Content-Type":"audio/wav"})
    assert response.status_code == 200 and response.json()["needs_review"]
    assert response.json()["text"].startswith("ರಮೇಶ್")
    assert client.get("/api/demo-payments/history").json() == []
    assert stored_records() == before


@pytest.mark.parametrize("text,unclear,secret", [("",True,False), ("OTP is 123456",False,False), ("",False,True)])
def test_unclear_or_private_speech_is_rejected(client, monkeypatch, text, unclear, secret):
    import speech
    enable_speech(monkeypatch)
    monkeypatch.setattr(speech, "transcribe_audio", lambda *_: Transcript(text=text, unclear=unclear, contains_private_credentials=secret))
    assert client.post("/api/speech/transcribe?consent=true", content=wav_bytes(), headers={"Content-Type":"audio/wav"}).status_code == 422


def test_audio_size_format_duration_and_rate_limits(client, monkeypatch):
    import speech
    enable_speech(monkeypatch)
    url = "/api/speech/transcribe?consent=true"
    assert client.post(url, content=b"not-audio", headers={"Content-Type":"audio/wav"}).status_code == 422
    assert client.post(url, content=b"data", headers={"Content-Type":"application/pdf"}).status_code == 415
    assert client.post(url, content=wav_bytes(51), headers={"Content-Type":"audio/wav"}).status_code == 422
    chunks = (b"x"*1024*1024 for _ in range(4))
    assert client.post(url, content=chunks, headers={"Content-Type":"audio/webm"}).status_code == 413
    speech_hits.clear()
    monkeypatch.setattr(speech, "generate_audio", lambda *_: wav_bytes())
    for _ in range(12):
        assert client.post("/api/speech/speak", json={"text":"ನಮಸ್ಕಾರ","consent":True}).status_code == 200
    assert client.post("/api/speech/speak", json={"text":"ನಮಸ್ಕಾರ","consent":True}).status_code == 429
