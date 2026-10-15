"""Owned reminders, familiar tasks and progress; none of these execute payments."""
import json
from datetime import datetime, timezone, timedelta
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, StrictInt
from identity import owner, DEFAULTS
from storage import database, list_records, read_record, save_record, timestamp

router = APIRouter(prefix="/api", tags=["Reminders and progress"])


class ReminderInput(BaseModel):
    transaction_id: str = Field(min_length=1, max_length=80)
    minutes: Literal[1, 15, 60, 1440] = 15
    consent: bool


class ReminderUpdate(BaseModel):
    action: Literal["dismiss", "snooze"]
    minutes: Literal[1, 15, 60, 1440] = 15


def reminders_enabled(db, profile_id):
    row = db.execute("SELECT preferences FROM profiles WHERE id=?", (profile_id,)).fetchone()
    return bool(({**DEFAULTS, **json.loads(row["preferences"])}).get("reminders"))


def reminder_rows(db, profile_id):
    rows = list_records(db, profile_id, "reminder")
    for item in rows:
        payment = read_record(db, profile_id, "payment", item["transaction_id"])
        if item["state"] == "scheduled" and (not payment or payment["status"] not in ("pending", "unknown")):
            item.update(state="resolved", updated_at=timestamp())
            save_record(db, profile_id, "reminder", item)
        item["due"] = item["state"] == "scheduled" and reminders_enabled(db, profile_id) and datetime.fromisoformat(item["due_at"]) <= datetime.now(timezone.utc)
    return sorted(rows, key=lambda x: x["due_at"])


@router.get("/reminders")
def get_reminders(request: Request):
    profile_id = owner(request)
    with database() as db:
        return {"enabled": reminders_enabled(db, profile_id), "items": reminder_rows(db, profile_id)}


@router.post("/reminders")
def create_reminder(body: ReminderInput, request: Request):
    profile_id = owner(request)
    with database() as db:
        if not body.consent or not reminders_enabled(db, profile_id):
            raise HTTPException(409, "Enable in-app reminders and agree before saving a reminder.")
        payment = read_record(db, profile_id, "payment", body.transaction_id)
        if not payment:
            raise HTTPException(404, "Payment not found.")
        if payment["status"] not in ("pending", "unknown"):
            raise HTTPException(409, "This payment already has a final result.")
        active = next((r for r in reminder_rows(db, profile_id) if r["transaction_id"] == body.transaction_id and r["state"] == "scheduled"), None)
        item = active or {"id": str(uuid4()), "transaction_id": body.transaction_id, "recipient": payment["recipient"], "created_at": timestamp()}
        item.update(state="scheduled", due_at=(datetime.now(timezone.utc) + timedelta(minutes=body.minutes)).isoformat(), updated_at=timestamp())
        item.pop("due", None)
        save_record(db, profile_id, "reminder", item)
        return item


@router.put("/reminders/{reminder_id}")
def update_reminder(reminder_id: str, body: ReminderUpdate, request: Request):
    profile_id = owner(request)
    with database() as db:
        item = next((r for r in reminder_rows(db, profile_id) if r["id"] == reminder_id), None)
        if not item:
            raise HTTPException(404, "Reminder not found.")
        if body.action == "dismiss":
            item["state"] = "dismissed"
        else:
            if item["state"] != "scheduled" or not reminders_enabled(db, profile_id):
                raise HTTPException(409, "Only enabled, unresolved reminders can be snoozed.")
            item["due_at"] = (datetime.now(timezone.utc) + timedelta(minutes=body.minutes)).isoformat()
        item.update(updated_at=timestamp())
        item.pop("due", None)
        save_record(db, profile_id, "reminder", item)
        return item


PROGRESS_LIMITS = {"lesson-" + str(i): 1 for i in range(7)}
PROGRESS_LIMITS.update({"pension": 4, "documents": 4, "health": 4})
PROGRESS_LIMITS["controls"] = 4


class ProgressInput(BaseModel):
    completed_steps: list[StrictInt] = Field(max_length=10)


@router.get("/progress")
def get_progress(request: Request):
    profile_id = owner(request)
    with database() as db:
        return list_records(db, profile_id, "progress")


@router.put("/progress/{task}")
def put_progress(task: str, body: ProgressInput, request: Request):
    profile_id = owner(request)
    if task not in PROGRESS_LIMITS or any(type(i) is not int or i < 0 or i >= PROGRESS_LIMITS[task] for i in body.completed_steps):
        raise HTTPException(422, "Choose a known task and valid step.")
    with database() as db:
        old = next((r for r in list_records(db, profile_id, "progress") if r["task"] == task), None)
        item = {"id": old["id"] if old else str(uuid4()), "task": task, "completed_steps": sorted(set(body.completed_steps)), "updated_at": timestamp()}
        save_record(db, profile_id, "progress", item)
        return item


@router.get("/familiar-tasks")
def familiar_tasks(request: Request):
    profile_id = owner(request)
    with database() as db:
        rows = list_records(db, profile_id, "payment")
    tasks, seen = [], set()
    for p in rows:
        key = (p["recipient"].casefold(), p.get("upi_id", ""), p.get("phone", ""), p["purpose"].casefold())
        # Bills must be fetched again; never reuse a stale bill account/amount.
        if p["status"] != "success" or p.get("bill_id") or p.get("frequency", "one_time") != "one_time" or key in seen:
            continue
        seen.add(key)
        tasks.append({field: p.get(field, "") for field in ("recipient", "amount", "purpose", "upi_id", "phone")} | {"recipient_id":p.get("recipient_id"), "source_id": p["transaction_id"], "identity_verified": False})
        if len(tasks) == 5:
            break
    return tasks
