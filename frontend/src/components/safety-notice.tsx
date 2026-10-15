"use client";
import Link from "next/link";
import { Safety } from "@/lib/api";
import { elderCopy } from "@/lib/elder-copy";
import { safetyCopy } from "@/lib/safety-copy";
import { useApp } from "./app-shell";
import { Icon } from "./icons";
import { paymentCopy } from "./payment-status";
export function SafetyNotice({
  safety,
  actions = true,
}: {
  safety: Safety;
  actions?: boolean;
}) {
  const { prefs, t } = useApp();
  const c = elderCopy(prefs.language);
  if (!safety.paused) return <p className="notice neutral">{c.noSigns}</p>;
  const danger = safety.risk_level === "strong_warning";
  const first = safety.signals[0];
  const detail = first ? safetyCopy(prefs.language, first) : null;
  return (
    <section
      className={(danger ? "danger-panel" : "warning-panel") + " stack-sm"}
      role="alert"
    >
      <div className="alert-heading">
        <Icon name="warning" size={27} />
        <h2>
          {danger
            ? paymentCopy[prefs.language].blocked
            : paymentCopy[prefs.language].paused}
        </h2>
      </div>
      {detail && <p>{detail.noticed}</p>}
      <p className="alert-action">{detail?.action ?? c.dangerAction}</p>
      {safety.signals.length > 1 && (
        <details>
          <summary className="text-button">{c.more}</summary>
          <div className="stack-sm">
            {safety.signals.slice(1).map((signal) => {
              const text = safetyCopy(prefs.language, signal);
              return (
                <div key={signal.code}>
                  <p>{text.noticed}</p>
                  <p>{text.action}</p>
                </div>
              );
            })}
          </div>
        </details>
      )}
      {actions && (
        <div className="actions">
          {safety.transaction_id ? (
            <Link
              className="btn"
              href={"/payment-result/" + safety.transaction_id}
            >
              {t("checkStatus")}
            </Link>
          ) : (
            <Link className={danger ? "btn danger-solid" : "btn"} href="/help">
              {t("getHelp")}
            </Link>
          )}
          <Link className="text-button" href="/contacts">
            {c.contacts}
          </Link>
        </div>
      )}
    </section>
  );
}
