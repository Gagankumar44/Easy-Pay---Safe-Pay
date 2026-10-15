"use client";
import { useCallback, useEffect, useState } from "react";
import { api, Reminder, Reminders } from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { ReminderRow } from "@/components/reminders";
import { followupCopy } from "@/lib/followup-copy";
export default function RemindersPage() {
  const { prefs, update, t } = useApp();
  const c = followupCopy(prefs.language);
  const [items, setItems] = useState<Reminder[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setItems((await api<Reminders>("/api/reminders")).items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function act(id: string, action: "dismiss" | "snooze") {
    setBusy(true);
    setError("");
    try {
      await api("/api/reminders/" + id, { action, minutes: 15 }, "PUT");
      await load();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <PageHeading title={c.reminders} description={c.intro} />
      <ErrorNotice error={error} />
      <div className="panel stack-sm">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={prefs.reminders}
            onChange={(event) =>
              void update({ reminders: event.target.checked })
                .then(load)
                .catch((e) => setError(e.message))
            }
          />
          {c.enabled}
        </label>
        <p className="hint">{c.privacy}</p>
        {!prefs.reminders && <p>{c.pause}</p>}
      </div>
      <div className="stack section-space">
        {items.length ? (
          items.map((item) => (
            <ReminderRow
              item={item}
              key={item.id}
              busy={busy}
              act={(id, action) => void act(id, action)}
            />
          ))
        ) : (
          <p role="status">{busy ? t("wait") : c.empty}</p>
        )}
      </div>
    </main>
  );
}
