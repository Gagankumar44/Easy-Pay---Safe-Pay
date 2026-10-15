"""Local app credentials. These accounts do not verify a person or a bank account."""
import hashlib
import hmac
import re
import secrets
import time
from threading import BoundedSemaphore
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from identity import COOKIE, digest, owner, profile_data, set_session_cookie
from storage import database, timestamp

router = APIRouter(prefix="/api/auth", tags=["Local demo accounts"])
hash_slots = BoundedSemaphore(4)
RETENTION = 86400 * 90


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=15, max_length=128)

    @field_validator("username")
    @classmethod
    def clean_username(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{2,31}", value):
            raise ValueError("Use 3–32 letters, numbers, dots, dashes or underscores.")
        return value


class Recovery(Credentials):
    code: str = Field(min_length=10, max_length=80)


def password_hash(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    # Bounded memory/work factor; no plaintext passwords or fast password hashes.
    with hash_slots:
        result = hashlib.scrypt(password.encode(), salt=salt, n=32768, r=8, p=3,
                                maxmem=64 * 1024 * 1024, dklen=32)
    return "scrypt:" + salt.hex() + ":" + result.hex()


def password_matches(password, encoded):
    _, salt, _ = encoded.split(":")
    return hmac.compare_digest(password_hash(password, bytes.fromhex(salt)), encoded)


def keys_for(request, username):
    ip = request.client.host if request.client else "unknown"
    return [(digest("account:" + ip + ":" + username), 5), (digest("auth-ip:" + ip), 20)]


def check_attempts(request, username):
    now = time.time()
    with database() as db:
        db.execute("DELETE FROM auth_failures WHERE at<?", (now - 900,))
        for key, limit in keys_for(request, username):
            count = db.execute("SELECT count(*) FROM auth_failures WHERE key=? AND at>?", (key, now - 900)).fetchone()[0]
            if count >= limit:
                raise HTTPException(429, "Too many unsuccessful attempts. Try again in 15 minutes.")


def failed_attempt(request, username):
    # Commit the throttle before raising an HTTP error.
    with database() as db:
        for key, _ in keys_for(request, username):
            db.execute("INSERT INTO auth_failures VALUES(?,?)", (key, time.time()))
    raise HTTPException(401, "The account details could not be verified.")


def new_session(db, response, profile_id):
    token = secrets.token_urlsafe(32)
    db.execute("INSERT INTO auth_sessions VALUES(?,?,?,?)", (digest(token), profile_id, time.time() + 86400 * 7, timestamp()))
    db.execute("UPDATE profiles SET expires=? WHERE id=?", (time.time() + RETENTION, profile_id))
    set_session_cookie(response, token)
    row = db.execute("SELECT * FROM profiles WHERE id=?", (profile_id,)).fetchone()
    return profile_data(db, row)


def recovery_digest(account_id, code):
    normal = re.sub(r"[\s-]", "", code).upper()
    return digest(account_id + ":" + normal)


@router.post("/register")
def register(body: Credentials, request: Request, response: Response):
    profile_id = owner(request)
    check_attempts(request, body.username)
    with database() as db:
        if db.execute("SELECT id FROM accounts WHERE profile_id=?", (profile_id,)).fetchone():
            raise HTTPException(409, "Sign out before creating another account.")
        if db.execute("SELECT id FROM accounts WHERE username=?", (body.username,)).fetchone():
            raise HTTPException(409, "Choose another username.")
    encoded = password_hash(body.password)
    codes = ["EP-" + "-".join(re.findall(".{4}", secrets.token_hex(12).upper())) for _ in range(4)]
    account_id = str(uuid4())
    with database() as db:
        # Recheck uniqueness after hashing outside the write transaction.
        if db.execute("SELECT id FROM accounts WHERE username=? OR profile_id=?", (body.username, profile_id)).fetchone():
            raise HTTPException(409, "This account was already created or the username is unavailable.")
        db.execute("INSERT INTO accounts VALUES(?,?,?,?,?,?)", (account_id, profile_id, body.username, encoded, 1, timestamp()))
        for code in codes:
            db.execute("INSERT INTO recovery_codes VALUES(?,?,NULL)", (recovery_digest(account_id, code), account_id))
        # Invalidate the old guest cookie while preserving this profile's owned data.
        db.execute("UPDATE profiles SET token_hash=? WHERE id=?", (digest(secrets.token_urlsafe(32)), profile_id))
        return {"profile": new_session(db, response, profile_id), "recovery_codes": codes}


@router.post("/sign-in")
def sign_in(body: Credentials, request: Request, response: Response):
    check_attempts(request, body.username)
    with database() as db:
        account = db.execute("""SELECT a.* FROM accounts a JOIN profiles p ON p.id=a.profile_id
            WHERE username=? AND p.expires>?""", (body.username, time.time())).fetchone()
    # Equal cost for nonexistent users; never disclose which credential failed.
    encoded = account["password_hash"] if account else "scrypt:" + "00" * 16 + ":" + "00" * 32
    valid = password_matches(body.password, encoded)
    if not account or not valid:
        failed_attempt(request, body.username)
    with database() as db:
        current = db.execute("SELECT credential_version FROM accounts WHERE id=?", (account["id"],)).fetchone()
        if not current or current["credential_version"] != account["credential_version"]:
            raise HTTPException(409, "Account access changed. Try signing in again.")
        db.execute("DELETE FROM auth_failures WHERE key=?", (keys_for(request, body.username)[0][0],))
        return new_session(db, response, account["profile_id"])


@router.post("/recover")
def recover(body: Recovery, request: Request, response: Response):
    check_attempts(request, body.username)
    with database() as db:
        account = db.execute("""SELECT a.* FROM accounts a JOIN profiles p ON p.id=a.profile_id
            WHERE username=? AND p.expires>?""", (body.username, time.time())).fetchone()
        code = db.execute("SELECT * FROM recovery_codes WHERE digest=? AND used_at IS NULL",
                          (recovery_digest(account["id"], body.code),)).fetchone() if account else None
    if not account or not code:
        failed_attempt(request, body.username)
    encoded = password_hash(body.password)
    with database() as db:
        changed = db.execute("UPDATE recovery_codes SET used_at=? WHERE digest=? AND used_at IS NULL", (timestamp(), code["digest"])).rowcount
        current = db.execute("SELECT credential_version FROM accounts WHERE id=?", (account["id"],)).fetchone()
        if not changed or not current or current["credential_version"] != account["credential_version"]:
            raise HTTPException(409, "Recovery details changed. Try again with an unused code.")
        db.execute("UPDATE accounts SET password_hash=?, credential_version=credential_version+1 WHERE id=?", (encoded, account["id"]))
        db.execute("DELETE FROM auth_sessions WHERE profile_id=?", (account["profile_id"],))
        db.execute("DELETE FROM auth_failures WHERE key=?", (keys_for(request, body.username)[0][0],))
        return new_session(db, response, account["profile_id"])


@router.post("/sign-out")
def sign_out(request: Request, response: Response):
    profile_id = owner(request)
    with database() as db:
        db.execute("DELETE FROM auth_sessions WHERE token_hash=?", (digest(request.cookies.get(COOKIE, "")),))
        db.execute("UPDATE profiles SET token_hash=? WHERE id=? AND token_hash=?",
                   (digest(secrets.token_urlsafe(32)), profile_id, digest(request.cookies.get(COOKIE, ""))))
    response.delete_cookie(COOKIE, path="/")
    return {"signed_out": True}
