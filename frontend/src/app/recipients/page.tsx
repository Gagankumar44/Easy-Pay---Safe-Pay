"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, prefill, PaymentContact } from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { assistantInputCopy } from "@/lib/assistant-input-copy";
import { Icon } from "@/components/icons";
type Recipient = PaymentContact;
export default function Recipients() {
  const { t, prefs } = useApp();
  const a = assistantInputCopy(prefs.language);
  const router = useRouter();
  const [name, setName] = useState("");
  const [upi, setUpi] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [removed, setRemoved] = useState<Recipient | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Recipient[]>("/api/recipients")
      .then(setRecipients)
      .catch((e) => setError(e.message));
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const data = await api<Recipient>(
        editing ? "/api/recipients/" + editing : "/api/recipients",
        {
          name,
          upi_id: upi,
          phone,
        },
        editing ? "PUT" : "POST",
      );
      setRecipients((p) =>
        editing ? p.map((r) => (r.id === editing ? data : r)) : [data, ...p],
      );
      setName("");
      setUpi("");
      setPhone("");
      setEditing(null);
      setShowForm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await api("/api/recipients/" + id, undefined, "DELETE");
      setRemoved(recipients.find((r) => r.id === id) ?? null);
      setRecipients((p) => p.filter((r) => r.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function undo() {
    if (!removed || busy) return;
    setBusy(true);
    try {
      const record = await api<Recipient>("/api/recipients", {
        name: removed.name,
        phone: removed.phone ?? "",
        upi_id: removed.upi_id,
      });
      setRecipients((p) => [record, ...p]);
      setRemoved(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <PageHeading title={a.saved} />
      <ErrorNotice error={error} />
      {recipients.some((r) => r.demo) && <p className="notice">{a.demoNote}</p>}
      {removed && (
        <div className="notice actions" role="status">
          <span>
            {removed.name} · {a.remove}
          </span>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => void undo()}
          >
            {prefs.language === "kn-IN"
              ? "ಹಿಂದಿರುಗಿಸಿ"
              : prefs.language === "hi-IN"
                ? "वापस लाएँ"
                : "Undo"}
          </button>
        </div>
      )}
      {!showForm && (
        <button
          className="btn"
          onClick={() => {
            setEditing(null);
            setName("");
            setUpi("");
            setPhone("");
            setShowForm(true);
          }}
        >
          <Icon name="users" size={20} />
          {a.add}
        </button>
      )}
      {showForm && (
        <form
          className="panel stack"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="field">
            <label htmlFor="saved-name">{a.name}</label>
            <input
              id="saved-name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="saved-upi">{a.upi}</label>
            <input
              id="saved-upi"
              maxLength={194}
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="saved-phone">{a.phone}</label>
            <input
              id="saved-phone"
              type="tel"
              inputMode="tel"
              maxLength={30}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <p className="hint">{a.empty}</p>
          <button className="btn primary" disabled={busy}>
            {busy ? t("wait") : a.save}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => setShowForm(false)}
          >
            {a.cancel}
          </button>
        </form>
      )}
      <section className="panel stack" style={{ marginTop: 22 }}>
        {recipients.length ? (
          recipients.map((r) => (
            <div key={r.id} className="saved-contact-row">
              <div className="contact-title">
                <span className="contact-avatar" aria-hidden="true">
                  {r.name.slice(0, 1)}
                </span>
                <h2>{r.name}</h2>
                {r.demo && <span className="demo-chip">{a.demo}</span>}
              </div>
              <p className="hint">
                {r.phone}
                {r.phone && r.upi_id ? " · " : ""}
                {r.upi_id}
                {!r.phone && !r.upi_id ? a.empty : ""}
              </p>
              <div className="actions">
                <button
                  className="text-button"
                  onClick={() => {
                    prefill({
                      recipient: r.name,
                      upi_id: r.upi_id,
                      phone: r.phone ?? "",
                      recipient_id: r.id,
                      amount: "",
                      purpose: "",
                    });
                    router.push("/send-money");
                  }}
                >
                  {t("send")}
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditing(r.id);
                    setName(r.name);
                    setUpi(r.upi_id);
                    setPhone(r.phone ?? "");
                    setShowForm(true);
                    requestAnimationFrame(() =>
                      document.getElementById("saved-name")?.focus(),
                    );
                  }}
                >
                  {a.edit}
                </button>
                <button
                  className="text-button"
                  onClick={() => void remove(r.id)}
                >
                  {a.remove}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No saved recipients yet.</p>
        )}
      </section>
    </main>
  );
}
