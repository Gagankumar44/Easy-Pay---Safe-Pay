"""SQLite persistence for fictional demo profiles and their owned records."""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


def timestamp():
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def database():
    path = Path(os.getenv("EASY_PAY_DB", str(Path(__file__).parent / "data" / "demo.sqlite3")))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.executescript("""
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL,
        expires REAL NOT NULL, preferences TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS records_owner_kind ON records(owner, kind);
      CREATE TABLE IF NOT EXISTS attempts (
        owner TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, transaction_id TEXT NOT NULL,
        PRIMARY KEY(owner, request_id)
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, profile_id TEXT UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        credential_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        expires REAL NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS recovery_codes (
        digest TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        used_at TEXT
      );
      CREATE TABLE IF NOT EXISTS auth_failures (
        key TEXT NOT NULL, at REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_failures_key_at ON auth_failures(key, at);
    """)
    try:
        connection.execute("BEGIN IMMEDIATE")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def read_record(db, owner, kind, record_id):
    row = db.execute("SELECT data FROM records WHERE id=? AND owner=? AND kind=?",
                     (record_id, owner, kind)).fetchone()
    return json.loads(row["data"]) if row else None


def save_record(db, owner, kind, record):
    db.execute("""INSERT INTO records VALUES(?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at
      WHERE records.owner=excluded.owner AND records.kind=excluded.kind""",
      (record["id"], owner, kind, json.dumps(record, ensure_ascii=False), timestamp()))


def list_records(db, owner, kind):
    return [json.loads(row["data"]) for row in db.execute(
        "SELECT data FROM records WHERE owner=? AND kind=? ORDER BY updated_at DESC", (owner, kind))]
