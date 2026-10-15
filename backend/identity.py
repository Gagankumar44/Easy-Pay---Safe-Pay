import hashlib
import json
import os
import secrets
import time
from collections import defaultdict, deque
from threading import Lock
from uuid import uuid4

from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel
from typing import Literal
from storage import database, list_records, timestamp
from payment_contacts import ensure_demo_contacts

router = APIRouter(prefix="/api/profile", tags=["Demo profiles"])
COOKIE = "easy_pay_session"
DEFAULTS = {"language": "en-IN", "text_size": "normal", "contrast": False,
            "speech_rate": 0.85, "audio": False, "interaction": "both", "onboarded": False, "reminders": False, "cloud_voice": False}


class Preferences(BaseModel):
    language: Literal["en-IN", "hi-IN", "kn-IN"] = "en-IN"
    text_size: Literal["normal", "large", "extra-large"] = "normal"
    contrast: bool = False
    speech_rate: float = 0.85
    audio: bool = False
    interaction: Literal["voice", "touch", "both"] = "both"
    onboarded: bool = False
    reminders: bool = False
    cloud_voice: bool = False


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def find_profile(db, token):
    if not token:
        return None
    row = db.execute("""SELECT p.* FROM profiles p JOIN auth_sessions s ON s.profile_id=p.id
        WHERE s.token_hash=? AND s.expires>? AND p.expires>?""", (digest(token), time.time(), time.time())).fetchone()
    return row or db.execute("SELECT * FROM profiles WHERE token_hash=? AND expires>?", (digest(token), time.time())).fetchone()


def set_session_cookie(response, token):
    response.set_cookie(COOKIE, token, httponly=True, samesite="lax", secure=os.getenv("COOKIE_SECURE") == "1", max_age=86400 * 7, path="/")


def profile_data(db, row):
    ensure_demo_contacts(db, row["id"])
    account = db.execute("SELECT username FROM accounts WHERE profile_id=?", (row["id"],)).fetchone()
    return {"id": row["id"], "demo_mode": True, "preferences": {**DEFAULTS, **json.loads(row["preferences"])},
            "account": {"username": account["username"]} if account else None}


def owner(request: Request):
    token = request.cookies.get(COOKIE, "")
    with database() as db:
        row = find_profile(db, token)
    if not row:
        raise HTTPException(401, "Your demo session expired. Reload the page to start a new session.")
    return row["id"]


@router.get("")
def get_profile(request: Request, response: Response):
    token = request.cookies.get(COOKIE, "")
    with database() as db:
        # Remove expired profiles and their records rather than retaining abandoned data.
        db.execute("DELETE FROM profiles WHERE expires<?", (time.time(),))
        db.execute("DELETE FROM auth_sessions WHERE expires<?", (time.time(),))
        row = find_profile(db, token)
        if not row:
            token = secrets.token_urlsafe(32)
            profile_id = str(uuid4())
            db.execute("INSERT INTO profiles VALUES(?,?,?,?,?)", (profile_id, hashlib.sha256(token.encode()).hexdigest(), time.time() + 86400 * 7, json.dumps(DEFAULTS), timestamp()))
            set_session_cookie(response, token)
            ensure_demo_contacts(db, profile_id)
            return {"id": profile_id, "demo_mode": True, "preferences": DEFAULTS, "account": None}
        return profile_data(db, row)


@router.put("/preferences")
def update_preferences(prefs: Preferences, request: Request):
    profile_id = owner(request)
    if not 0.5 <= prefs.speech_rate <= 1.2:
        raise HTTPException(422, "Speech speed must be between 0.5 and 1.2.")
    with database() as db:
        db.execute("UPDATE profiles SET preferences=? WHERE id=?", (prefs.model_dump_json(), profile_id))
    return prefs


@router.delete("")
def delete_profile(request: Request, response: Response):
    profile_id = owner(request)
    with database() as db:
        db.execute("DELETE FROM profiles WHERE id=?", (profile_id,))
    response.delete_cookie(COOKIE, path="/")
    return {"deleted": True}


@router.get("/export")
def export_profile(request: Request):
    profile_id = owner(request)
    with database() as db:
        row = db.execute("SELECT preferences FROM profiles WHERE id=?", (profile_id,)).fetchone()
        return {"demo_mode": True, "preferences": json.loads(row["preferences"]),
                "phone_connection": [{k: record[k] for k in ("id", "phone", "language", "created_at")} for record in list_records(db, profile_id, "phone_connection")],
                **{kind: list_records(db, profile_id, kind) for kind in ("payment", "recipient", "incident", "bill", "reminder", "progress", "help_contact")}}


# A bounded process-local limiter protects the local demo. Distributed deployment
# requires a shared gateway limiter; this is not bank authentication.
hits = defaultdict(deque)
hit_lock = Lock()


def rate_limit(request: Request):
    keys = [("ip:" + (request.client.host if request.client else "unknown"), 180)]
    token = request.cookies.get(COOKIE)
    if token:
        keys.append(("session:" + hashlib.sha256(token.encode()).hexdigest(), 60))
    now = time.monotonic()
    with hit_lock:
        for old_key in list(hits):
            if not hits[old_key] or now - hits[old_key][-1] > 60:
                del hits[old_key]
        for key, limit in keys:
            queue = hits[key]
            while queue and now - queue[0] > 60:
                queue.popleft()
            if len(queue) >= limit:
                raise HTTPException(429, "Please wait a minute before trying again.")
        for key, _ in keys:
            hits[key].append(now)
