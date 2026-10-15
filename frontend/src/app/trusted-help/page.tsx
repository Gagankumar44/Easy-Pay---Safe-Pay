"use client";
import { useEffect, useState } from "react";
import { api, dateTime } from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { Icon } from "@/components/icons";
type Grant = { id: string; token: string; text: string; expires: number };
export default function TrustedHelp() {
  const { t } = useApp();
  const [instruction, setInstruction] = useState("payment_review");
  const [grant, setGrant] = useState<Grant | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!grant) return;
    const tick = () => setExpired(Date.now() / 1000 > grant.expires);
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [grant]);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const data = await api<Grant>("/api/assistance", { instruction });
      setGrant(data);
      setLink(window.location.origin + "/trusted-help/shared/" + data.token);
      setExpired(false);
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!grant) return;
    setBusy(true);
    try {
      await api("/api/assistance/" + grant.id, undefined, "DELETE");
      setGrant(null);
      setLink("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError(
        "Select the link below and copy it using your device’s copy command.",
      );
    }
  }
  return (
    <main className="narrow">
      <PageHeading
        title={t("trusted")}
        description="Share one non-sensitive instruction with a person you choose. You stay in control."
      />
      <ErrorNotice error={error} />
      <section className="panel stack">
        <Icon name="users" size={28} />
        <h2>A little help, with clear limits.</h2>
        <p className="muted">
          The link shares only the instruction shown here. It gives no access to
          balances, payment details, history, documents, or account controls.
        </p>
        {!grant ? (
          <>
            <div className="field">
              <label htmlFor="help-instruction">
                What would you like help understanding?
              </label>
              <select
                id="help-instruction"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              >
                <option value="payment_review">Reading a payment review</option>
                <option value="pending_payment">
                  What to do with a pending payment
                </option>
                <option value="report_fraud">
                  Finding official fraud support
                </option>
              </select>
            </div>
            <p className="hint">
              Anyone with the link can read this instruction for 10 minutes.
              Choose who you share it with.
            </p>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void create()}
            >
              {busy ? t("wait") : "Create limited help link"}
              <Icon name="arrow" size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="notice">
              <p>{grant.text}</p>
            </div>
            <p className="hint">
              {expired
                ? "This link has expired."
                : "Expires " +
                  dateTime(new Date(grant.expires * 1000).toISOString())}
            </p>
            <div className="field">
              <label htmlFor="share-link">Help link</label>
              <input
                id="share-link"
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="actions">
              <button
                className="btn"
                disabled={expired}
                onClick={() => void copy()}
              >
                {copied ? "Link copied" : "Copy link"}
              </button>
              <button
                className="btn danger"
                disabled={busy}
                onClick={() => void revoke()}
              >
                Stop sharing
              </button>
            </div>
            <p className="hint" role="status">
              Share it through your preferred messaging app. This app does not
              send it to anyone.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
