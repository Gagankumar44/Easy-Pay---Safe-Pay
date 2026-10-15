"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, downloadText } from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { uiCopy } from "@/lib/ui-copy";
type Incident = {
  id: string;
  summary: string;
  occurred_at: string;
  description?: string;
  gathering_details?: boolean;
};
export default function Complaint() {
  const { t, prefs } = useApp();
  const c = uiCopy(prefs.language);
  const [form, setForm] = useState({
    occurred_at: "",
    amount: "",
    reference: "",
    contact_method: "Call",
    description: "",
    evidence_notes: "",
  });
  const [draft, setDraft] = useState<Incident | null>(null);
  const [saved, setSaved] = useState<Incident[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Incident[]>("/api/incidents")
      .then(setSaved)
      .catch((e) => setError(e.message));
  }, []);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const value = await api<Incident>("/api/incidents", form);
      setDraft(value);
      setSaved((p) => [value, ...p]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await api("/api/incidents/" + id, undefined, "DELETE");
      setSaved((p) => p.filter((i) => i.id !== id));
      if (draft?.id === id) setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="narrow">
      <PageHeading
        title={t("complaint")}
        description="Gather the details you know. This draft is saved for you and is not submitted to any authority."
      />
      <ErrorNotice error={error} />
      {!draft ? (
        <form
          className="panel stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {[
            {
              key: "occurred_at",
              label: "When did it happen?",
              type: "datetime-local",
            },
            {
              key: "amount",
              label: "Amount involved (optional)",
              type: "text",
            },
            {
              key: "reference",
              label: "Transaction reference (optional)",
              type: "text",
            },
          ].map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                type={f.type}
                required={f.key === "occurred_at"}
                maxLength={
                  f.key === "reference" ? 100 : f.key === "amount" ? 30 : 80
                }
                value={form[f.key as keyof typeof form]}
                onChange={(e) =>
                  setForm((p) => ({ ...p, [f.key]: e.target.value }))
                }
              />
            </div>
          ))}
          <div className="field">
            <label htmlFor="contact_method">How were you contacted?</label>
            <select
              id="contact_method"
              value={form.contact_method}
              onChange={(e) =>
                setForm((p) => ({ ...p, contact_method: e.target.value }))
              }
            >
              {["Call", "Message", "Website", "Other"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="description">What were you told?</label>
            <textarea
              id="description"
              required
              minLength={3}
              maxLength={2000}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
            <small>{t("secret")}</small>
          </div>
          <div className="field">
            <label htmlFor="evidence">
              What evidence do you have? (optional)
            </label>
            <textarea
              id="evidence"
              maxLength={1000}
              value={form.evidence_notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, evidence_notes: e.target.value }))
              }
            />
            <small>
              Keep original evidence on your device. This form stores notes, not
              files.
            </small>
          </div>
          <button className="btn primary" disabled={busy}>
            {busy ? t("wait") : "Prepare my summary"}
          </button>
        </form>
      ) : (
        <section className="panel stack">
          <h2>Review your incident summary</h2>
          <pre className="preformatted">{draft.summary}</pre>
          <div className="actions">
            <button
              className="btn"
              onClick={() => downloadText("incident-draft.txt", draft.summary)}
            >
              Download draft
            </button>
            <a
              className="btn primary"
              href="https://cybercrime.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("portal")}
            </a>
            <button className="text-button" onClick={() => setDraft(null)}>
              Prepare another draft
            </button>
          </div>
        </section>
      )}
      {saved.length > 0 && (
        <section className="panel stack" style={{ marginTop: 24 }}>
          <h2>{c.savedDrafts}</h2>
          {saved.map((i) => (
            <div className="actions" key={i.id}>
              <button className="text-button" onClick={() => setDraft(i)}>
                {i.occurred_at || i.description?.slice(0, 60) || c.draftTitle} ·{" "}
                {i.gathering_details ? c.draftStarted : c.draftReady}
              </button>
              <button className="text-button" onClick={() => void remove(i.id)}>
                Delete draft
              </button>
            </div>
          ))}
        </section>
      )}
      <Link className="text-button" href="/help">
        {t("getHelp")}
      </Link>
    </main>
  );
}
