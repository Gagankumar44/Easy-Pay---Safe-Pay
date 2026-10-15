"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { elderCopy } from "@/lib/elder-copy";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { Icon } from "@/components/icons";
type Contact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
};
export default function Contacts() {
  const { prefs, t } = useApp();
  const c = elderCopy(prefs.language);
  const [items, setItems] = useState<Contact[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", relationship: "" });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState<Contact | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void api<Contact[]>("/api/help-contacts")
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);
  async function save(value = form, undo = false) {
    setBusy(true);
    setError("");
    try {
      const result = await api<Contact>("/api/help-contacts", {
        name: value.name,
        phone: value.phone,
        relationship: value.relationship,
      });
      setItems((previous) => [result, ...previous]);
      if (undo) setRemoved(null);
      else setForm({ name: "", phone: "", relationship: "" });
      setNotice(c.contactAdded);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: Contact) {
    setBusy(true);
    setError("");
    try {
      await api("/api/help-contacts/" + item.id, undefined, "DELETE");
      setItems((previous) => previous.filter((value) => value.id !== item.id));
      setRemoved(item);
      setNotice(c.contactRemoved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <PageHeading title={c.contacts} description={c.contactsIntro} />
      <ErrorNotice error={error} />
      {notice && (
        <div className="notice" role="status">
          {notice}
          {removed && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void save(removed, true)}
            >
              {prefs.language === "kn-IN"
                ? "ಮರಳಿ ಉಳಿಸಿ"
                : prefs.language === "hi-IN"
                  ? "वापस सहेजें"
                  : "Undo remove"}
            </button>
          )}
        </div>
      )}
      <div className="stack">
        {items.map((item) => (
          <section className="panel stack-sm" key={item.id}>
            <h2>{item.name}</h2>
            <p>
              {item.relationship && item.relationship + " · "}
              {item.phone}
            </p>
            <div className="actions">
              <a className="btn primary" href={"tel:" + item.phone}>
                <Icon name="phone" size={20} />
                {c.callContact}
              </a>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void remove(item)}
              >
                {c.remove}
              </button>
            </div>
          </section>
        ))}
      </div>
      {!items.length && (
        <p role="status">{busy ? t("wait") : c.emptyContacts}</p>
      )}
      <details className="panel section-space" open={!items.length}>
        <summary className="text-button">{c.saveContact}</summary>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="field">
            <label htmlFor="contact-name">{c.contactName}</label>
            <input
              id="contact-name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="off"
              value={form.name}
              onChange={(event) =>
                setForm((p) => ({ ...p, name: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="contact-phone">{c.contactNumber}</label>
            <input
              id="contact-phone"
              type="tel"
              required
              minLength={10}
              maxLength={30}
              inputMode="tel"
              value={form.phone}
              onChange={(event) =>
                setForm((p) => ({ ...p, phone: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="contact-relation">{c.relation}</label>
            <input
              id="contact-relation"
              maxLength={60}
              value={form.relationship}
              onChange={(event) =>
                setForm((p) => ({ ...p, relationship: event.target.value }))
              }
            />
          </div>
          <button className="btn primary" disabled={busy}>
            {busy ? t("wait") : c.saveContact}
          </button>
        </form>
      </details>
      <p className="hint section-space">{c.contactNote}</p>
    </main>
  );
}
