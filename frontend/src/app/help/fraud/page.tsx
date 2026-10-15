"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  api,
  ApiError,
  downloadText,
  Language,
  Payment,
  session,
} from "@/lib/api";
import { useVoice } from "@/lib/voice";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { AssistantVoice } from "@/components/assistant-voice";
import { elderCopy } from "@/lib/elder-copy";
import { Icon } from "@/components/icons";
import { uiCopy } from "@/lib/ui-copy";
import { OnlineVoice } from "@/components/online-voice";
type Incident = {
  id: string;
  summary: string;
  gathering_details: boolean;
  source_payment_id: string | null;
  evidence: Payment | null;
  amount: string;
  reference: string;
  recipient: string;
  description: string;
  conversation_context: string;
  occurred_at: string;
  contact_method: string;
  bank?: string;
  upi_id?: string;
  acknowledgement?: { reference: string; verified: false } | null;
};
type Report = {
  session_id: string;
  step: string;
  reply: string;
  language: Language;
  incident: Incident;
  choices: string[];
};
const copy = {
  "en-IN": {
    title: "Scam reporting assistant",
    urgent: "Lost money? Call 1930 now.",
    call: "Call 1930 · toll-free",
    note: "Do not wait to finish this chat. Contact your bank through a known number.",
    receipt: "Use a payment receipt",
    none: "No receipt / payment outside this app",
    prefilled: "Receipt details added automatically",
    answer: "Your answer",
    saved: "Saved report draft",
    status: "This app has not submitted your complaint.",
    open: "Open official cybercrime portal",
    download: "Download report",
    copy: "Copy report",
    copied: "Report copied",
    manual: "Saved drafts / manual report",
    again: "Start another report",
    source: "This receipt is simulated. It does not prove a real loss.",
    ack: "Already reported? Record your acknowledgement",
    ackLabel: "Official acknowledgement number",
    save: "Save acknowledgement",
    ackSaved: "Acknowledgement recorded by you; not verified",
    methods: ["Call", "Message", "Website", "Other"],
    choose: "Choose a payment",
  },
  "hi-IN": {
    title: "धोखाधड़ी रिपोर्ट सहायक",
    urgent: "पैसे खोए? अभी 1930 पर कॉल करें।",
    call: "1930 पर कॉल · टोल-फ्री",
    note: "यह बातचीत पूरी होने का इंतजार न करें। बैंक के परिचित नंबर पर संपर्क करें।",
    receipt: "भुगतान रसीद इस्तेमाल करें",
    none: "रसीद नहीं / इस ऐप के बाहर भुगतान",
    prefilled: "रसीद विवरण अपने आप जोड़े गए",
    answer: "आपका जवाब",
    saved: "सहेजा रिपोर्ट मसौदा",
    status: "इस ऐप ने शिकायत जमा नहीं की है।",
    open: "आधिकारिक साइबर पोर्टल खोलें",
    download: "रिपोर्ट डाउनलोड करें",
    copy: "रिपोर्ट कॉपी करें",
    copied: "रिपोर्ट कॉपी हुई",
    manual: "सहेजे मसौदे / खुद रिपोर्ट लिखें",
    again: "दूसरी रिपोर्ट शुरू करें",
    source: "यह डेमो रसीद है। यह असली नुकसान का प्रमाण नहीं है।",
    ack: "रिपोर्ट कर दी? पावती नंबर सहेजें",
    ackLabel: "आधिकारिक पावती नंबर",
    save: "पावती सहेजें",
    ackSaved: "आपने पावती दर्ज की; सत्यापित नहीं",
    methods: ["कॉल", "संदेश", "वेबसाइट", "अन्य"],
    choose: "भुगतान चुनें",
  },
  "kn-IN": {
    title: "ವಂಚನೆ ವರದಿ ಸಹಾಯಕ",
    urgent: "ಹಣ ಕಳೆದುಕೊಂಡಿರಾ? ಈಗಲೇ 1930ಕ್ಕೆ ಕರೆ ಮಾಡಿ.",
    call: "1930ಕ್ಕೆ ಕರೆ · ಟೋಲ್-ಫ್ರೀ",
    note: "ಈ ಚಾಟ್ ಮುಗಿಯುವವರೆಗೆ ಕಾಯಬೇಡಿ. ಬ್ಯಾಂಕ್‌ನ ಪರಿಚಿತ ಸಂಖ್ಯೆಗೆ ಸಂಪರ್ಕಿಸಿ.",
    receipt: "ಪಾವತಿ ರಸೀದಿ ಬಳಸಿ",
    none: "ರಸೀದಿ ಇಲ್ಲ / ಈ ಆಪ್ ಹೊರಗೆ ಪಾವತಿ",
    prefilled: "ರಸೀದಿ ವಿವರಗಳು ಸ್ವಯಂ ಸೇರಿಸಲಾಗಿದೆ",
    answer: "ನಿಮ್ಮ ಉತ್ತರ",
    saved: "ಉಳಿಸಿದ ವರದಿ ಕರಡು",
    status: "ಈ ಆ್ಯಪ್ ದೂರು ಸಲ್ಲಿಸಿಲ್ಲ.",
    open: "ಅಧಿಕೃತ ಸೈಬರ್ ಪೋರ್ಟಲ್ ತೆರೆಯಿರಿ",
    download: "ವರದಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
    copy: "ವರದಿ ನಕಲಿಸಿ",
    copied: "ವರದಿ ನಕಲಿಸಲಾಗಿದೆ",
    manual: "ಉಳಿಸಿದ ಕರಡು / ಸ್ವತಃ ವರದಿ ಬರೆಯಿರಿ",
    again: "ಮತ್ತೊಂದು ವರದಿ ಪ್ರಾರಂಭಿಸಿ",
    source: "ಇದು ಡೆಮೋ ರಸೀದಿ. ನಿಜವಾದ ನಷ್ಟದ ಸಾಕ್ಷಿಯಲ್ಲ.",
    ack: "ವರದಿ ಮಾಡಿದ್ದೀರಾ? ಸ್ವೀಕೃತಿ ಸಂಖ್ಯೆ ಉಳಿಸಿ",
    ackLabel: "ಅಧಿಕೃತ ಸ್ವೀಕೃತಿ ಸಂಖ್ಯೆ",
    save: "ಸ್ವೀಕೃತಿ ಉಳಿಸಿ",
    ackSaved: "ನೀವು ಸ್ವೀಕೃತಿ ದಾಖಲಿಸಿದ್ದೀರಿ; ಪರಿಶೀಲಿಸಿಲ್ಲ",
    methods: ["ಕರೆ", "ಸಂದೇಶ", "ವೆಬ್‌ಸೈಟ್", "ಬೇರೆ"],
    choose: "ಪಾವತಿ ಆರಿಸಿ",
  },
};
export default function FraudAssistant() {
  const { prefs, t } = useApp();
  const c = elderCopy(prefs.language);
  const u = uiCopy(prefs.language);
  const d = copy[prefs.language];
  const labels = {
    "en-IN": {
      amount: "Amount",
      recipient: "Recipient",
      upi_id: "Payment address",
      reference: "Payment reference",
      bank: "Bank / payment app",
      occurred_at: "When",
      contact_method: "Contact method",
      description: "What happened",
    },
    "hi-IN": {
      amount: "रकम",
      recipient: "प्राप्तकर्ता",
      upi_id: "भुगतान पता",
      reference: "भुगतान संदर्भ",
      bank: "बैंक / भुगतान ऐप",
      occurred_at: "कब",
      contact_method: "संपर्क तरीका",
      description: "क्या हुआ",
    },
    "kn-IN": {
      amount: "ಮೊತ್ತ",
      recipient: "ಸ್ವೀಕರಿಸುವವರು",
      upi_id: "ಪಾವತಿ ವಿಳಾಸ",
      reference: "ಪಾವತಿ ಉಲ್ಲೇಖ",
      bank: "ಬ್ಯಾಂಕ್ / ಪಾವತಿ ಆಪ್",
      occurred_at: "ಯಾವಾಗ",
      contact_method: "ಸಂಪರ್ಕ ವಿಧಾನ",
      description: "ಏನಾಯಿತು",
    },
  }[prefs.language];
  const [report, setReport] = useState<Report | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selected, setSelected] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ack, setAck] = useState("");
  const [retry, setRetry] = useState<{
    session_id: string;
    request_id: string;
    message: string;
    language: Language;
  } | null>(null);
  const sending = useRef(false);
  const textbox = useRef<HTMLTextAreaElement>(null);
  const transcript = useCallback((text: string) => {
    setInput(text);
    textbox.current?.focus();
  }, []);
  const voice = useVoice(
    prefs.language,
    prefs.speech_rate,
    transcript,
    prefs.cloud_voice,
  );
  const language = useRef(prefs.language);
  const conversationSource = useRef<string | null>(null);
  const { stop, cancelListening } = voice;
  useEffect(() => {
    language.current = prefs.language;
  }, [prefs.language]);
  const begin = useCallback(
    async (payment_id: string | null) => {
      if (sending.current) return;
      sending.current = true;
      setBusy(true);
      setError("");
      stop();
      cancelListening();
      try {
        const value = await api<Report>("/api/fraud/sessions", {
          payment_id,
          conversation_id: conversationSource.current,
          language: language.current,
        });
        setReport(value);
        setInput(
          value.step === "description"
            ? value.incident.conversation_context.slice(0, 500).trim()
            : "",
        );
        setRetry(null);
        session.setItem("easy-pay-fraud-chat", value.session_id);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        sending.current = false;
        setBusy(false);
      }
    },
    [stop, cancelListening],
  );
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      void api<Payment[]>("/api/demo-payments/history")
        .then((values) => {
          if (active) setPayments(values);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
      const payment = new URLSearchParams(window.location.search).get(
        "payment",
      );
      conversationSource.current = new URLSearchParams(
        window.location.search,
      ).get("conversation");
      if (payment || conversationSource.current) {
        setSelected(payment ?? "");
        void begin(payment);
      } else {
        const saved = session.getItem("easy-pay-fraud-chat");
        if (saved) {
          void api<Report>(
            "/api/fraud/sessions/" + saved + "?language=" + language.current,
          )
            .then((value) => {
              if (active) setReport(value);
            })
            .catch(() => {
              session.removeItem("easy-pay-fraud-chat");
              if (active) void begin(null);
            });
        } else void begin(null);
      }
    });
    return () => {
      active = false;
    };
  }, [begin]);
  useEffect(() => {
    if (!report || busy || report.language === prefs.language) return;
    let active = true;
    void api<Report>(
      "/api/fraud/sessions/" +
        report.session_id +
        "?language=" +
        prefs.language,
    )
      .then((v) => {
        if (active) setReport(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [report, busy, prefs.language]);
  async function send(text: string, existing = retry) {
    if (!report || sending.current || !text.trim()) return;
    sending.current = true;
    setBusy(true);
    setError("");
    voice.stop();
    voice.cancelListening();
    const body = existing ?? {
      session_id: report.session_id,
      request_id: crypto.randomUUID(),
      message: text,
      language: prefs.language,
    };
    try {
      const value = await api<Report>("/api/fraud/chat", body);
      setReport(value);
      setInput("");
      setRetry(null);
    } catch (e) {
      setError((e as Error).message);
      setRetry(
        e instanceof ApiError && [401, 410, 422].includes(e.status)
          ? null
          : body,
      );
      setInput(text);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function copyReport() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.incident.summary);
      setNotice(d.copied);
    } catch {
      downloadText("cyber-report-draft.txt", report.incident.summary);
    }
  }
  async function saveAck() {
    if (!report) return;
    setBusy(true);
    setError("");
    try {
      const incident = await api<Incident>(
        "/api/fraud/incidents/" + report.incident.id + "/acknowledgement",
        { reference: ack },
      );
      setReport({ ...report, incident });
      setNotice(d.ackSaved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="assistant-page">
      <PageHeading title={d.title} />
      <section className="danger-panel stack-sm" role="note">
        <h2>{d.urgent}</h2>
        <p>{d.note}</p>
        <a className="btn danger-solid" href="tel:1930">
          <Icon name="phone" size={20} />
          {d.call}
        </a>
      </section>
      <ErrorNotice error={error || voice.inputError} />
      {notice && <p role="status">{notice}</p>}
      <section className="panel assistant-focus stack">
        <details>
          <summary className="text-button">{d.receipt}</summary>
          <div className="field">
            <label htmlFor="report-payment">{d.choose}</label>
            <select
              id="report-payment"
              value={selected}
              disabled={busy}
              onChange={(e) => {
                setSelected(e.target.value);
                void begin(e.target.value || null);
              }}
            >
              <option value="">{d.none}</option>
              {payments.map((p) => (
                <option key={p.transaction_id} value={p.transaction_id}>
                  {p.recipient} · ₹{p.amount} ·{" "}
                  {new Date(p.created_at).toLocaleDateString(prefs.language)}
                </option>
              ))}
            </select>
          </div>
        </details>
        {report?.incident.evidence && (
          <div className="prefill-note">
            <p>{d.prefilled}</p>
            <p>
              <strong>
                {report.incident.recipient} · ₹{report.incident.amount}
              </strong>
            </p>
            <small>{d.source}</small>
          </div>
        )}
        {report?.step === "description" &&
          report.incident.conversation_context && (
            <p className="hint">
              {prefs.language === "kn-IN"
                ? "ನಿಮ್ಮ ಹಿಂದಿನ ಮಾತು ಸೇರಿಸಲಾಗಿದೆ. ವಿವರ ನೋಡಿ ಕಳುಹಿಸಿ."
                : prefs.language === "hi-IN"
                  ? "आपकी पिछली बात जोड़ी है। विवरण जाँचकर भेजें।"
                  : "Your earlier words are filled in. Check them, then send."}
            </p>
          )}
        <div
          className="assistant-question"
          aria-live="polite"
          aria-atomic="true"
        >
          <h2>{busy ? t("wait") : (report?.reply ?? t("wait"))}</h2>
        </div>
        <AssistantVoice
          voice={voice}
          text={report?.reply ?? ""}
          ready={!!report && report.language === prefs.language}
          busy={busy}
        />
        {!!report?.choices.length && (
          <div className="quick-tasks">
            {report.choices.map((choice, i) => (
              <button
                className="btn"
                key={choice}
                disabled={busy || !!retry}
                onClick={() => void send(choice, null)}
              >
                {d.methods[i]}
              </button>
            ))}
          </div>
        )}
        {retry && (
          <button
            className="btn"
            disabled={busy}
            onClick={() => void send(retry.message, retry)}
          >
            {t("retry")}
          </button>
        )}
        <details open={report?.step !== "ready"}>
          <summary
            className="text-button"
            style={report?.step === "ready" ? undefined : { display: "none" }}
          >
            {prefs.language === "kn-IN"
              ? "ಇನ್ನಷ್ಟು ವಿವರ ಅಥವಾ ತಿದ್ದುಪಡಿ ಸೇರಿಸಿ"
              : prefs.language === "hi-IN"
                ? "और विवरण या सुधार जोड़ें"
                : "Add details or corrections"}
          </summary>
          <form
            className="stack-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input, null);
            }}
          >
            <div className="field">
              <label htmlFor="fraud-answer">{d.answer}</label>
              <textarea
                id="fraud-answer"
                ref={textbox}
                rows={2}
                maxLength={500}
                value={input}
                disabled={busy || !!retry || voice.transcribing}
                onFocus={voice.stop}
                onChange={(e) => {
                  voice.stop();
                  setInput(e.target.value);
                }}
              />
              <small>{c.reviewTranscript}</small>
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn"
                disabled={busy || !!retry || voice.transcribing}
                onClick={
                  voice.starting
                    ? voice.cancelListening
                    : voice.listening
                      ? voice.stopListening
                      : voice.start
                }
              >
                <Icon name="mic" size={20} />
                {voice.listening || voice.starting ? t("stop") : t("mic")}
              </button>
              <button
                className="btn primary"
                disabled={
                  busy ||
                  !!retry ||
                  !input.trim() ||
                  voice.listening ||
                  voice.starting ||
                  voice.transcribing
                }
              >
                {t("submit")}
              </button>
            </div>
            {voice.listening && <p role="status">{c.recording}</p>}
            {voice.transcribing && <p role="status">{c.transcribing}</p>}
            <OnlineVoice
              needed={voice.inputNeedsOnline || !voice.supported}
              forMicrophone
            />
          </form>
        </details>
      </section>
      {report && (
        <section className="panel stack">
          <h2>{report.step === "ready" ? u.draftReady : u.draftStarted}</h2>
          <p className="report-status">{d.status}</p>
          {report.step !== "ready" && <p className="hint">{u.detailsNeeded}</p>}
          <details open={report.step === "ready"}>
            <summary className="text-button">{u.reportReview}</summary>
            <dl className="details">
              {Object.entries(labels).map(([field, label]) => {
                const original = report.incident[field as keyof typeof labels];
                const value =
                  field === "occurred_at" &&
                  original &&
                  /^\d{4}-\d{2}-\d{2}T/.test(original) &&
                  Number.isFinite(Date.parse(original))
                    ? new Intl.DateTimeFormat(prefs.language, {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kolkata",
                      }).format(new Date(original))
                    : original;
                return value ? (
                  <div key={field}>
                    <dt>{label}</dt>
                    <dd>
                      {field === "amount" && value !== "Unknown" ? "₹" : ""}
                      {field === "contact_method"
                        ? (d.methods[
                            ["Call", "Message", "Website", "Other"].indexOf(
                              value,
                            )
                          ] ?? value)
                        : value === "Unknown"
                          ? prefs.language === "kn-IN"
                            ? "ಗೊತ್ತಿಲ್ಲ"
                            : prefs.language === "hi-IN"
                              ? "पता नहीं"
                              : "Unknown"
                          : value}
                    </dd>
                  </div>
                ) : null;
              })}
            </dl>
          </details>
          <details>
            <summary className="text-button">{c.more}</summary>
            <pre className="report-preview">{report.incident.summary}</pre>
          </details>
          <div className="actions">
            <button
              className="btn"
              disabled={report.step !== "ready"}
              onClick={() => void copyReport()}
            >
              {d.copy}
            </button>
            <button
              className="btn"
              disabled={report.step !== "ready"}
              onClick={() =>
                downloadText("cyber-report-draft.txt", report.incident.summary)
              }
            >
              {d.download}
            </button>
            <a
              className="btn primary"
              href="https://cybercrime.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {d.open}
              <Icon name="arrow" size={18} />
            </a>
          </div>
          <details>
            <summary className="text-button">{d.ack}</summary>
            <form
              className="stack-sm"
              onSubmit={(e) => {
                e.preventDefault();
                void saveAck();
              }}
            >
              <div className="field">
                <label htmlFor="cyber-ack">{d.ackLabel}</label>
                <input
                  id="cyber-ack"
                  minLength={5}
                  maxLength={80}
                  pattern="[A-Za-z0-9 /\\-]+"
                  required
                  value={ack}
                  onChange={(e) => setAck(e.target.value)}
                />
              </div>
              <button className="btn" disabled={busy}>
                {d.save}
              </button>
            </form>
            {report.incident.acknowledgement && (
              <p>
                {d.ackSaved}: {report.incident.acknowledgement.reference}
              </p>
            )}
          </details>
          <div className="actions">
            <Link className="text-button" href="/help/complaint">
              {d.manual}
            </Link>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setSelected("");
                conversationSource.current = null;
                window.history.replaceState(null, "", "/help/fraud");
                void begin(null);
              }}
            >
              {d.again}
            </button>
            <Link href="/contacts" className="text-button">
              {c.contacts}
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
