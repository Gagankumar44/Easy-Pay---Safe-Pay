"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, money, Draft } from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { uiCopy } from "@/lib/ui-copy";
type Bill = {
  id: string;
  recipient: string;
  amount: string;
  purpose: string;
  consumer_number: string;
  due_date: string;
};
export default function Bills() {
  const { t, prefs } = useApp();
  const c = uiCopy(prefs.language);
  const router = useRouter();
  const [provider, setProvider] = useState("Demo Karnataka Electricity");
  const [number, setNumber] = useState("");
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function lookup() {
    setBusy(true);
    setError("");
    try {
      setBill(
        await api<Bill>("/api/bills/lookup", {
          provider,
          consumer_number: number,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reviewBill() {
    if (!bill || busy) return;
    setBusy(true);
    setError("");
    try {
      const draft = await api<Draft>("/api/payments/review", {
        recipient: bill.recipient,
        amount: bill.amount,
        purpose: bill.purpose,
        bill_id: bill.id,
      });
      router.push("/send-money?draft=" + draft.id);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <PageHeading title={t("bills")} />
      <ErrorNotice error={error} />
      {!bill ? (
        <form
          className="panel stack"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
        >
          <Icon name="bill" size={28} />
          <h2>{c.electricity}</h2>
          <div className="field">
            <label htmlFor="biller">{c.provider}</label>
            <select
              id="biller"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option>Demo Karnataka Electricity</option>
              <option>Demo City Electricity</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="consumer-number">{c.consumer}</label>
            <input
              id="consumer-number"
              inputMode="numeric"
              required
              pattern="[0-9]{6,12}"
              minLength={6}
              maxLength={12}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="12345678"
            />
            <small>{c.billHint}</small>
          </div>
          <button className="btn primary" disabled={busy}>
            {busy ? t("wait") : c.findBill}
            <Icon name="arrow" size={18} />
          </button>
        </form>
      ) : (
        <section className="panel stack">
          <h2>{bill.recipient}</h2>
          <p className="review-amount">{money(bill.amount)}</p>
          <dl className="details">
            <div>
              <dt>{c.consumer}</dt>
              <dd>{bill.consumer_number}</dd>
            </div>
            <div>
              <dt>{c.due}</dt>
              <dd>{bill.due_date}</dd>
            </div>
            <div>
              <dt>{c.provider}</dt>
              <dd>{c.electricity}</dd>
            </div>
          </dl>
          <p className="hint">{c.billNote}</p>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => void reviewBill()}
          >
            {t("review")}
            <Icon name="arrow" size={18} />
          </button>
          <button className="text-button" onClick={() => setBill(null)}>
            {t("change")}
          </button>
        </section>
      )}
    </main>
  );
}
