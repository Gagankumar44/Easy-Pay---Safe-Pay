"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, money, PaymentFields, prefill } from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { followupCopy } from "@/lib/followup-copy";
export default function FamiliarTasks() {
  const { prefs, t } = useApp();
  const [tasks, setTasks] = useState<(PaymentFields & { source_id: string })[]>(
    [],
  );
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    void api<typeof tasks>("/api/familiar-tasks")
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);
  return (
    <main className="narrow">
      <PageHeading
        title={followupCopy(prefs.language).familiar}
        description="Start from a previous successful demo payment. Check the details again for today."
      />
      <ErrorNotice error={error} />
      <p className="notice">
        Recipient identity remains unverified. Every new payment needs a new
        safety check and confirmation. Bills must be fetched again.
      </p>
      <div className="stack section-space">
        {tasks.map((task) => (
          <section className="panel stack-sm" key={task.source_id}>
            <h2>{task.recipient}</h2>
            <p>
              {task.purpose} · {money(task.amount)}
            </p>
            <div className="actions">
              <button
                className="btn primary"
                onClick={() => {
                  prefill({
                    recipient: task.recipient,
                    amount: task.amount,
                    purpose: task.purpose,
                    upi_id: task.upi_id,
                    phone: task.phone,
                    recipient_id: task.recipient_id,
                    frequency: "one_time",
                    direction: "outgoing",
                  });
                  router.push("/send-money");
                }}
              >
                {t("review")}
              </button>
              <Link
                className="text-button"
                href={"/payment-result/" + task.source_id}
              >
                {t("receipt")}
              </Link>
            </div>
          </section>
        ))}
        {!tasks.length && (
          <p role="status">
            {busy
              ? t("wait")
              : "Successful one-time demo payments will appear here."}
          </p>
        )}
      </div>
    </main>
  );
}
