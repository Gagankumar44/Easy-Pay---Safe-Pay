"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, dateTime, downloadText, money, Payment } from "@/lib/api";
import {
  ErrorNotice,
  PageHeading,
  StatusBadge,
  useApp,
} from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { ReminderForm } from "@/components/reminders";
import { uiCopy } from "@/lib/ui-copy";
import { paymentCopy } from "@/components/payment-status";
export default function PaymentResult() {
  const { id } = useParams<{ id: string }>();
  const { t, prefs } = useApp();
  const c = uiCopy(prefs.language);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(
    async (check = false) => {
      setBusy(true);
      setError("");
      try {
        setPayment(
          await api<Payment>(
            "/api/demo-payments/" +
              encodeURIComponent(id) +
              (check ? "/check" : ""),
            check ? {} : undefined,
          ),
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [id],
  );
  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);
  const pending =
    payment?.status === "pending" || payment?.status === "unknown";
  const receipt = () => {
    if (payment)
      downloadText(
        "easy-pay-demo-receipt.txt",
        [
          "Easy Pay — Safe Pay / SIMULATED RECEIPT / NO REAL MONEY",
          t("amount") + ": " + money(payment.amount),
          t("recipient") + ": " + payment.recipient,
          t("upi") + ": " + (payment.upi_id || payment.phone || "—"),
          t("reason") + ": " + payment.purpose,
          t("check") + ": " + t(payment.status),
          t("timestamp") + ": " + dateTime(payment.created_at, prefs.language),
          t("reference") + ": " + payment.transaction_id,
          payment.bill_id
            ? "Biller acknowledgement: " + payment.biller_status
            : "",
        ].join("\n"),
      );
  };
  async function checkBill() {
    if (!payment?.bill_id) return;
    setBusy(true);
    try {
      await api("/api/bills/" + payment.bill_id + "/check", {});
      await load();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const eventLabel = (status: string) =>
    ({
      ready_for_handoff: t("review"),
      handoff_issued: c.mockStarted,
      biller_demo_confirmed: c.billConfirmed,
    })[status] ??
    (["success", "pending", "unknown", "failed"].includes(status)
      ? t(status as "success" | "failed" | "pending" | "unknown")
      : status);
  return (
    <main className="narrow">
      <PageHeading title={t("receipt")} />
      <ErrorNotice error={error} />
      {!payment ? (
        busy ? (
          <p role="status">{t("wait")}</p>
        ) : (
          <button className="btn" onClick={() => void load()}>
            {t("retry")}
          </button>
        )
      ) : (
        <div className="panel stack">
          <section
            className={`payment-status ${payment.status === "success" ? "ready" : pending ? "waiting" : "blocked"}`}
            role="status"
          >
            <span className="payment-status-icon">
              <Icon
                name={
                  payment.status === "success"
                    ? "check"
                    : payment.status === "failed"
                      ? "close"
                      : "clock"
                }
                size={25}
              />
            </span>
            <div>
              <h2>{t(payment.status)}</h2>
              {pending && <p>{c.duplicate}</p>}
            </div>
          </section>
          <div>
            <p className="review-direction">{t("direction")}</p>
            <p className="review-amount">{money(payment.amount)}</p>
            <p className="lead" style={{ marginTop: 3 }}>
              {payment.recipient}
            </p>
          </div>
          <div className="actions">
            {pending && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void load(true)}
              >
                {busy ? t("wait") : t("checkStatus")}
              </button>
            )}
            <button className="btn" onClick={receipt}>
              {t("download")}
            </button>
          </div>
          <dl className="details">
            {payment.upi_id && (
              <div>
                <dt>{t("upi")}</dt>
                <dd>{payment.upi_id}</dd>
              </div>
            )}
            {payment.phone && (
              <div>
                <dt>
                  {prefs.language === "kn-IN"
                    ? "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ"
                    : prefs.language === "hi-IN"
                      ? "मोबाइल नंबर"
                      : "Mobile number"}
                </dt>
                <dd>{payment.phone}</dd>
              </div>
            )}
            {payment.consumer_number && (
              <div>
                <dt>{paymentCopy[prefs.language].billAccount}</dt>
                <dd>{payment.consumer_number}</dd>
              </div>
            )}
            <div>
              <dt>{t("reason")}</dt>
              <dd>{payment.purpose}</dd>
            </div>
            <div>
              <dt>{t("timestamp")}</dt>
              <dd>{dateTime(payment.created_at, prefs.language)}</dd>
            </div>
            <div>
              <dt>{t("reference")}</dt>
              <dd>{payment.transaction_id}</dd>
            </div>
            <div>
              <dt>{t("check")}</dt>
              <dd>
                <StatusBadge status={payment.status} />
              </dd>
            </div>
          </dl>
          {payment.bill_id && (
            <div className="notice">
              <h3>{c.billAck}</h3>
              <p>
                {payment.biller_status === "demo_confirmed"
                  ? c.billConfirmed
                  : c.billWaiting}
              </p>
              {payment.status === "success" &&
                payment.biller_status !== "demo_confirmed" && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void checkBill()}
                  >
                    {c.checkBill}
                  </button>
                )}
            </div>
          )}
          {pending && (
            <details>
              <summary className="text-button">
                {prefs.language === "kn-IN"
                  ? "ನೆನಪಿಸುವಿಕೆ"
                  : prefs.language === "hi-IN"
                    ? "याद दिलाएँ"
                    : "Remind me later"}
              </summary>
              <ReminderForm
                key={payment.transaction_id}
                transactionId={payment.transaction_id}
              />
            </details>
          )}
          <details>
            <summary className="text-button">{c.updates}</summary>
            <ol className="timeline">
              {payment.events.map((event, i) => (
                <li key={i}>
                  {eventLabel(event.status)}
                  <small>{dateTime(event.at, prefs.language)}</small>
                </li>
              ))}
            </ol>
          </details>
          <div className="actions">
            <Link className="text-button" href="/activity">
              {t("activity")}
            </Link>
            <Link
              className="text-button"
              href={"/help/fraud?payment=" + payment.transaction_id}
            >
              {t("getHelp")}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
