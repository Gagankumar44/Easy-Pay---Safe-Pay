"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, dateTime, money, Payment } from "@/lib/api";
import {
  ErrorNotice,
  PageHeading,
  StatusBadge,
  useApp,
} from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { followupCopy } from "@/lib/followup-copy";
import { uiCopy } from "@/lib/ui-copy";
export default function Activity() {
  const { t, prefs } = useApp();
  const c = uiCopy(prefs.language);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPayments(await api<Payment[]>("/api/demo-payments/history"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);
  const visible = payments.filter(
    (p) =>
      (status === "all" ||
        (status === "unresolved" &&
          ["pending", "unknown"].includes(p.status)) ||
        p.status === status) &&
      [
        p.recipient,
        p.purpose,
        p.transaction_id,
        p.amount,
        dateTime(p.created_at, prefs.language),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const unresolved = payments.filter(
    (p) => p.status === "pending" || p.status === "unknown",
  );
  return (
    <main>
      <PageHeading title={t("historyTitle")} description={t("historyText")} />
      <ErrorNotice error={error} />
      <div className="actions">
        <Link className="text-button" href="/reminders">
          {followupCopy(prefs.language).reminders}
        </Link>
        <Link className="text-button" href="/familiar-tasks">
          {followupCopy(prefs.language).familiar}
        </Link>
      </div>
      {unresolved.length > 0 && (
        <div className="notice warning">
          {c.awaiting}: {unresolved.length}{" "}
          <button
            className="text-button"
            onClick={() => {
              setStatus("unresolved");
              setQuery("");
            }}
          >
            {t("checkStatus")}
          </button>
        </div>
      )}
      <div className="field" style={{ marginBottom: 20 }}>
        <label htmlFor="history-search">{t("search")}</label>
        <input
          id="history-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
        />
      </div>
      <div className="filters">
        {[
          "all",
          "success",
          "pending",
          "unknown",
          "failed",
          ...(unresolved.length ? ["unresolved"] : []),
        ].map((value) => (
          <button
            key={value}
            className={"filter " + (status === value ? "active" : "")}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {value === "unresolved"
              ? c.awaiting
              : value === "all"
                ? t("all")
                : t(value as "success" | "failed" | "pending" | "unknown")}
          </button>
        ))}
      </div>
      <section className="panel">
        {loading ? (
          <p role="status">{t("wait")}</p>
        ) : error ? (
          <button className="btn" onClick={() => void load()}>
            {t("retry")}
          </button>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <h2>{payments.length ? t("search") : t("empty")}</h2>
            <p>{payments.length ? c.emptySearch : t("emptyText")}</p>
            <Link className="btn primary" href="/send-money">
              {t("send")}
            </Link>
          </div>
        ) : (
          visible.map((payment) => (
            <Link
              className="payment-row"
              key={payment.transaction_id}
              href={"/payment-result/" + payment.transaction_id}
            >
              <span className="row-icon">
                <Icon name="send" size={21} />
              </span>
              <div className="row-details">
                <h2>{payment.recipient}</h2>
                <p>
                  {payment.purpose} ·{" "}
                  {dateTime(payment.created_at, prefs.language)}
                </p>
              </div>
              <div className="row-end">
                <strong>{money(payment.amount)}</strong>
                <StatusBadge status={payment.status} />
              </div>
              <Icon name="arrow" size={19} />
            </Link>
          ))
        )}
      </section>
      <button
        className="text-button"
        disabled={loading}
        onClick={() => void load()}
      >
        {t("checkStatus")}
      </button>
    </main>
  );
}
