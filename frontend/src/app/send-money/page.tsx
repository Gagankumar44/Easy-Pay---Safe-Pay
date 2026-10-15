"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  Draft,
  Payment,
  PaymentFields,
  PaymentContact,
  session,
  ApiError,
} from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { PaymentReview } from "@/components/payment-review";
import { Icon } from "@/components/icons";
import { elderCopy } from "@/lib/elder-copy";
import { uiCopy } from "@/lib/ui-copy";
import { PaymentStatus, paymentCopy } from "@/components/payment-status";
type Attempt = {
  draft_id: string;
  review_token: string;
  request_id: string;
  result: Payment["status"];
};
const blank: PaymentFields = {
  recipient: "",
  amount: "",
  purpose: "",
  upi_id: "",
  frequency: "one_time",
  direction: "outgoing",
};
export default function SendMoney() {
  const { t, prefs } = useApp();
  const c = uiCopy(prefs.language);
  const p = paymentCopy[prefs.language];
  const router = useRouter();
  const [fields, setFields] = useState<PaymentFields>(blank);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<Payment["status"]>("success");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [attemptSaved, setAttemptSaved] = useState(false);
  const [recovery, setRecovery] = useState<Attempt | null>(null);
  const [recipients, setRecipients] = useState<PaymentContact[]>([]);
  const [reload, setReload] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const draftId = useRef<string | null>(null);
  const attempt = useRef<Attempt | null>(null);
  const leaving = useRef(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!draft) return;
    reviewRef.current?.focus({ preventScroll: true });
    reviewRef.current?.scrollIntoView({ block: "start" });
  }, [draft]);
  useEffect(() => {
    void Promise.resolve().then(async () => {
      setLoadFailed(false);
      try {
        const saved = session.getItem("easy-pay-prefill");
        const resume = JSON.parse(
          session.getItem("easy-pay-send-form") ?? "null",
        ) as {
          fields: PaymentFields;
          draft_id?: string;
          editing?: boolean;
        } | null;
        if (saved) setFields({ ...blank, ...JSON.parse(saved) });
        else if (resume?.fields) setFields({ ...blank, ...resume.fields });
        const id =
          new URLSearchParams(window.location.search).get("draft") ||
          (!saved ? resume?.draft_id : null);
        if (id) {
          const value = await api<Draft>(
            "/api/payments/drafts/" + encodeURIComponent(id),
          );
          if (value.state === "handoff_issued" && value.transaction_id) {
            leaving.current = true;
            session.removeItem("easy-pay-send-form");
            router.replace("/payment-result/" + value.transaction_id);
            return;
          }
          draftId.current = value.id;
          const details: PaymentFields = {
            recipient: value.recipient,
            amount: value.amount,
            purpose: value.purpose,
            upi_id: value.upi_id,
            phone: value.phone,
            recipient_id: value.recipient_id,
            bill_id: value.bill_id,
            frequency: value.frequency,
            direction: value.direction,
          };
          setFields(
            resume?.editing &&
              !new URLSearchParams(window.location.search).has("draft")
              ? resume.fields
              : details,
          );
          if (
            !resume?.editing ||
            new URLSearchParams(window.location.search).has("draft")
          )
            setDraft(value.state === "cancelled" ? null : value);
        } else if (saved) {
          setFields({ ...blank, ...JSON.parse(saved) });
          session.removeItem("easy-pay-prefill");
        } else if (resume?.fields) {
          setFields({ ...blank, ...resume.fields });
        }
        const last = session.getItem("easy-pay-attempt");
        if (last) setRecovery(JSON.parse(last));
      } catch (e) {
        setError((e as Error).message);
        setLoadFailed(true);
      } finally {
        setInitialized(true);
      }
    });
    api<PaymentContact[]>("/api/recipients")
      .then(setRecipients)
      .catch(() => {});
  }, [router, reload]);
  useEffect(() => {
    if (
      !initialized ||
      leaving.current ||
      ![
        fields.recipient,
        fields.amount,
        fields.purpose,
        fields.upi_id,
        fields.phone,
      ].some(Boolean)
    )
      return;
    const timer = window.setTimeout(() => {
      if (!leaving.current)
        session.setItem(
          "easy-pay-send-form",
          JSON.stringify({
            fields,
            draft_id: draftId.current,
            editing: !draft,
          }),
        );
    }, 150);
    return () => window.clearTimeout(timer);
  }, [initialized, fields, draft]);
  const change = (key: keyof PaymentFields, value: string) => {
    setFields((previous) => ({
      ...previous,
      [key]: value,
      ...(["recipient", "upi_id", "phone"].includes(key)
        ? {
            recipient_id: null,
            ...(key === "recipient"
              ? { upi_id: "", phone: "" }
              : previous.recipient_id
                ? { [key === "upi_id" ? "phone" : "upi_id"]: "" }
                : {}),
          }
        : {}),
    }));
    setConfirmed(false);
    setError("");
  };
  async function review(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<Draft>(
        draftId.current
          ? "/api/payments/drafts/" + draftId.current
          : "/api/payments/review",
        fields,
        draftId.current ? "PUT" : "POST",
      );
      draftId.current = data.id;
      setDraft(data);
      setConfirmed(false);
      attempt.current = null;
      setAttemptSaved(false);
      setTimeout(() => reviewRef.current?.focus(), 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function execute(existing?: Attempt) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let body = existing ?? attempt.current;
      if (!body) {
        if (!draft || !confirmed) return;
        const confirmation = await api<{ review_token: string }>(
          "/api/payments/drafts/" + draft.id + "/confirm",
          {
            revision: draft.revision,
            recipient: draft.recipient,
            amount: draft.amount,
            direction: "outgoing",
          },
        );
        body = {
          draft_id: draft.id,
          review_token: confirmation.review_token,
          request_id: crypto.randomUUID(),
          result,
        };
        attempt.current = body;
        setAttemptSaved(true);
        session.setItem("easy-pay-attempt", JSON.stringify(body));
      }
      const payment = await api<Payment>("/api/demo-payments", body);
      leaving.current = true;
      session.removeItem("easy-pay-send-form");
      session.removeItem("easy-pay-attempt");
      router.push("/payment-result/" + payment.transaction_id);
    } catch (e) {
      setError((e as Error).message);
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        /confirmation expired|details changed|saved contact/i.test(e.message)
      ) {
        attempt.current = null;
        setAttemptSaved(false);
        setRecovery(null);
        setConfirmed(false);
        session.removeItem("easy-pay-attempt");
      }
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      const cancelling = draft?.id ?? draftId.current;
      if (cancelling)
        await api("/api/payments/drafts/" + cancelling + "/cancel", {});
      leaving.current = true;
      session.removeItem("easy-pay-send-form");
      session.removeItem("easy-pay-attempt");
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="narrow payment-page">
      <PageHeading
        title={
          draft?.paused
            ? draft.risk_level === "strong_warning"
              ? p.blocked
              : p.paused
            : draft
              ? t("reviewTitle")
              : t("send")
        }
      />
      <ol
        className="workflow-progress"
        aria-label={[c.enter, c.review, c.result].join(" → ")}
      >
        {[c.enter, c.review, c.result].map((label, index) => (
          <li
            key={label}
            className={index === (draft ? 1 : 0) ? "current" : ""}
            aria-current={index === (draft ? 1 : 0) ? "step" : undefined}
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <ErrorNotice error={error} />
      {busy && (
        <PaymentStatus state={draft || recovery ? "processing" : "checking"} />
      )}
      {loadFailed && (
        <button
          className="btn"
          onClick={() => {
            setError("");
            setInitialized(false);
            setReload((value) => value + 1);
          }}
        >
          {t("retry")}
        </button>
      )}
      {recovery && !draft && (
        <div className="notice warning stack-sm">
          <h2>{p.recover}</h2>
          <p>{p.recoverText}</p>
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => void execute(recovery)}
            >
              {p.recoverButton}
            </button>
            <Link className="text-button" href="/activity">
              {t("activity")}
            </Link>
          </div>
        </div>
      )}
      {!initialized ? (
        <p role="status">{t("wait")}</p>
      ) : loadFailed ? null : !draft ? (
        <form
          className="panel stack payment-form"
          onSubmit={review}
          aria-busy={busy}
        >
          <fieldset
            disabled={busy || !!recovery}
            className="payment-fields stack"
          >
            <div className="actions">
              <Link className="text-button" href="/qr">
                <Icon name="qr" size={18} />
                {t("scan")}
              </Link>
            </div>
            {recipients.length > 0 && (
              <div className="field">
                <label htmlFor="saved-recipient">{t("saved")}</label>
                <select
                  id="saved-recipient"
                  value={fields.recipient_id ?? ""}
                  onChange={(e) => {
                    const saved = recipients.find(
                      (r) => r.id === e.target.value,
                    );
                    if (saved) {
                      setFields((p) => ({
                        ...p,
                        recipient: saved.name,
                        upi_id: saved.upi_id,
                        phone: saved.phone ?? "",
                        recipient_id: saved.id,
                      }));
                      setError("");
                    }
                  }}
                >
                  <option value="">{c.chooseRecipient}</option>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="recipient">{t("recipient")}</label>
              <input
                id="recipient"
                autoComplete="off"
                required
                minLength={2}
                maxLength={80}
                value={fields.recipient}
                onChange={(e) => change("recipient", e.target.value)}
                placeholder="Ramesh Kumar"
              />
            </div>
            <div className="field">
              <label htmlFor="amount">{t("amount")}</label>
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                required
                min=".01"
                max="100000"
                step=".01"
                value={fields.amount}
                onChange={(e) => change("amount", e.target.value)}
                placeholder="500"
              />
            </div>
            <div className="field">
              <label htmlFor="purpose">{t("purpose")}</label>
              <input
                id="purpose"
                required
                minLength={3}
                maxLength={250}
                value={fields.purpose}
                onChange={(e) => change("purpose", e.target.value)}
                placeholder={p.purposeHint}
              />
            </div>
            <div className="field">
              <label htmlFor="upi">{t("upi")}</label>
              <input
                id="upi"
                autoComplete="off"
                maxLength={194}
                value={fields.upi_id ?? ""}
                onChange={(e) => change("upi_id", e.target.value)}
                placeholder="name@bank"
              />
              <small>{t("unverified")}</small>
            </div>
            {fields.phone && (
              <p className="prefill-note">
                {prefs.language === "kn-IN"
                  ? "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ"
                  : prefs.language === "hi-IN"
                    ? "मोबाइल नंबर"
                    : "Mobile number"}
                : {fields.phone}
              </p>
            )}
            <details>
              <summary className="text-button">
                {elderCopy(prefs.language).more}
              </summary>
              <div className="field">
                <label htmlFor="frequency">{t("frequency")}</label>
                <select
                  id="frequency"
                  value={fields.frequency ?? "one_time"}
                  onChange={(e) => change("frequency", e.target.value)}
                >
                  <option value="one_time">{t("once")}</option>
                  <option value="recurring">{t("recurring")}</option>
                </select>
              </div>
            </details>
            <button className="btn primary full" disabled={busy}>
              {busy ? t("wait") : t("review")}
              <Icon name="arrow" size={19} />
            </button>
          </fieldset>
        </form>
      ) : (
        <div
          className="panel stack"
          tabIndex={-1}
          ref={reviewRef}
          aria-busy={busy}
        >
          <PaymentReview draft={draft} busy={busy} />
          {!draft.paused && (
            <>
              <details>
                <summary>
                  {prefs.language === "kn-IN"
                    ? "ಡೆಮೋ ಆಯ್ಕೆಗಳು"
                    : prefs.language === "hi-IN"
                      ? "डेमो विकल्प"
                      : "Demo options"}
                </summary>
                <div className="field">
                  <label htmlFor="demo-result">{t("simulation")}</label>
                  <select
                    id="demo-result"
                    disabled={busy || attemptSaved}
                    value={result}
                    onChange={(e) =>
                      setResult(e.target.value as Payment["status"])
                    }
                  >
                    <option value="success">{t("success")}</option>
                    <option value="failed">{t("failed")}</option>
                    <option value="pending">{t("pending")}</option>
                    <option value="unknown">{t("unknown")}</option>
                  </select>
                </div>
              </details>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy || attemptSaved}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>{t("confirm")}</span>
              </label>
              <button
                className="btn primary full"
                disabled={busy || !confirmed}
                onClick={() => void execute()}
              >
                {busy ? t("wait") : attemptSaved ? t("retry") : t("continue")}
                <Icon name="arrow" size={19} />
              </button>
            </>
          )}
          <div className="actions">
            <button
              className="btn"
              disabled={busy || attemptSaved}
              onClick={() => {
                setDraft(null);
                setConfirmed(false);
              }}
            >
              {t("change")}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void cancel()}
            >
              {t("cancel")}
            </button>
            {attemptSaved && (
              <Link className="text-button" href="/activity">
                {t("activity")}
              </Link>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
