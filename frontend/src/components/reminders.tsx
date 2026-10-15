"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api, dateTime, Reminder, Reminders } from "@/lib/api";
import { followupCopy } from "@/lib/followup-copy";
import { ErrorNotice, useApp } from "./app-shell";

export function ReminderForm({ transactionId }: { transactionId: string }) {
  const { prefs, t, update } = useApp();
  const copy = followupCopy(prefs.language);
  const [minutes, setMinutes] = useState(15);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let mounted = true;
    void api<Reminders>("/api/reminders")
      .then((value) => {
        if (
          mounted &&
          value.items.some(
            (item) =>
              item.transaction_id === transactionId &&
              item.state === "scheduled",
          )
        )
          setSaved(true);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [transactionId]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (!prefs.reminders) await update({ reminders: true });
      await api("/api/reminders", {
        transaction_id: transactionId,
        minutes,
        consent,
      });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack-sm">
      <h3>{copy.reminders}</h3>
      <p className="hint">{copy.privacy}</p>
      <ErrorNotice error={error} />
      {saved ? (
        <p role="status">
          {copy.saved}{" "}
          <Link className="text-button" href="/reminders">
            {copy.reminders}
          </Link>
        </p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="reminder-time">{copy.later}</label>
            <select
              id="reminder-time"
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            >
              {[
                [1, copy.one],
                [15, copy.fifteen],
                [60, copy.hour],
                [1440, copy.day],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            {copy.consent}
          </label>
          <button
            className="btn"
            disabled={busy || !consent}
            onClick={() => void save()}
          >
            {busy ? t("wait") : copy.save}
          </button>
        </>
      )}
    </div>
  );
}

export function DueReminders() {
  const { prefs } = useApp();
  const path = usePathname();
  const [due, setDue] = useState<Reminder[]>([]);
  const copy = followupCopy(prefs.language);
  useEffect(() => {
    if (!prefs.reminders) return;
    let active = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      void api<Reminders>("/api/reminders")
        .then((result) => {
          if (active) setDue(result.items.filter((item) => item.due));
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 60000);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [prefs.reminders, path]);
  if (!prefs.reminders || !due.length || path === "/reminders") return null;
  return (
    <div className="notice" role="status">
      {copy.due} · {due.length}
      <br />
      <Link className="text-button" href="/reminders">
        {copy.reminders}
      </Link>
    </div>
  );
}

export function ReminderRow({
  item,
  busy,
  act,
}: {
  item: Reminder;
  busy: boolean;
  act: (id: string, action: "dismiss" | "snooze") => void;
}) {
  const { prefs } = useApp();
  const c = followupCopy(prefs.language);
  return (
    <section className="panel stack-sm">
      <h2>{item.recipient}</h2>
      <p>
        {item.due
          ? c.due
          : item.state === "resolved"
            ? c.resolved
            : item.state === "dismissed"
              ? c.dismissed
              : c.scheduled}{" "}
        · {dateTime(item.due_at)}
      </p>
      <Link className="btn" href={"/payment-result/" + item.transaction_id}>
        {c.open}
      </Link>
      {item.state === "scheduled" && (
        <div className="actions">
          <button
            className="text-button"
            disabled={busy || !prefs.reminders}
            onClick={() => act(item.id, "snooze")}
          >
            {c.snooze}
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => act(item.id, "dismiss")}
          >
            {c.dismiss}
          </button>
        </div>
      )}
    </section>
  );
}
