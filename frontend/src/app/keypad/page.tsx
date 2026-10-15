"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, Language } from "@/lib/api";
import { useVoice } from "@/lib/voice";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { AssistantVoice } from "@/components/assistant-voice";
import { Icon } from "@/components/icons";
type Connection = {
  id: string;
  phone: string;
  language: Language;
  payment_limit: number;
  gateway_configured: boolean;
  phone_verified: false;
  live_payments: false;
};
type Call = {
  session_id: string;
  step: string;
  reply: string;
  details: Record<string, string>;
  entered_digits: number;
  language: Language;
  receipt_id: string | null;
  next_action: string | null;
  end_call: boolean;
};
type Key = { session_id: string; event_id: string; key: string };
const copy = {
  "en-IN": {
    title: "Phone assistant",
    intro: "Link once. Practise payments using familiar phone keys.",
    setup: "Link your phone",
    phone: "Phone number",
    agree: "Link this number to my demo profile",
    link: "Link phone",
    code: "Your Easy Pay call code",
    codeNote:
      "Keep this code private. It is shown only now. It is not a bank PIN.",
    linked: "Phone linked for the demo",
    start: "Start demo call",
    end: "End call",
    disconnect: "Disconnect phone",
    confirmDisconnect: "Disconnect this phone and end its active calls?",
    digit: "Digits entered",
    live: "Live calls and bank payments are not connected.",
    details: "How real calls connect",
    explain:
      "A telephony provider can connect through the signed gateway. A bank or UPI 123PAY partner is required for real payments. No UPI PIN or OTP is collected here. Phone ownership still needs provider verification.",
    recipients: "Saved recipients",
    limit: "Up to ₹10,000 per demo phone payment",
    useCode: "Enter my code for this demo",
    receipt: "Open receipt",
    help: "Scam reporting assistant",
    status: "Activity",
    key: "Press",
    review: "Payment details",
    again: "Start another call",
    language: "Call language",
  },
  "hi-IN": {
    title: "फोन सहायक",
    intro: "एक बार जोड़ें। फोन बटन से भुगतान का अभ्यास करें।",
    setup: "फोन जोड़ें",
    phone: "फोन नंबर",
    agree: "यह नंबर मेरी डेमो प्रोफ़ाइल से जोड़ें",
    link: "फोन जोड़ें",
    code: "आपका Easy Pay कॉल कोड",
    codeNote: "कोड निजी रखें। केवल अभी दिखेगा। यह बैंक पिन नहीं है।",
    linked: "फोन डेमो से जुड़ा है",
    start: "डेमो कॉल शुरू करें",
    end: "कॉल समाप्त करें",
    disconnect: "फोन हटाएं",
    confirmDisconnect: "यह फोन हटाएं और चालू कॉल समाप्त करें?",
    digit: "डाले गए अंक",
    live: "असली कॉल और बैंक भुगतान जुड़े नहीं हैं।",
    details: "असली कॉल कैसे जुड़ती है",
    explain:
      "टेलीफोन प्रदाता सुरक्षित गेटवे से जुड़ सकता है। असली भुगतान के लिए बैंक या UPI 123PAY भागीदार चाहिए। यहाँ UPI पिन या ओटीपी नहीं लिया जाता। फोन मालिक की पुष्टि प्रदाता को करनी होगी।",
    recipients: "सहेजे प्राप्तकर्ता",
    limit: "हर डेमो फोन भुगतान में अधिकतम ₹10,000",
    useCode: "इस डेमो में मेरा कोड डालें",
    receipt: "रसीद खोलें",
    help: "धोखाधड़ी रिपोर्ट सहायक",
    status: "गतिविधि",
    key: "दबाएं",
    review: "भुगतान विवरण",
    again: "दूसरी कॉल शुरू करें",
    language: "कॉल भाषा",
  },
  "kn-IN": {
    title: "ಫೋನ್ ಸಹಾಯಕ",
    intro: "ಒಮ್ಮೆ ಸಂಪರ್ಕಿಸಿ. ಫೋನ್ ಕೀಗಳಿಂದ ಪಾವತಿ ಅಭ್ಯಾಸ ಮಾಡಿ.",
    setup: "ನಿಮ್ಮ ಫೋನ್ ಸಂಪರ್ಕಿಸಿ",
    phone: "ಫೋನ್ ಸಂಖ್ಯೆ",
    agree: "ಈ ಸಂಖ್ಯೆಯನ್ನು ನನ್ನ ಡೆಮೋ ಪ್ರೊಫೈಲ್‌ಗೆ ಸಂಪರ್ಕಿಸಿ",
    link: "ಫೋನ್ ಸಂಪರ್ಕಿಸಿ",
    code: "ನಿಮ್ಮ Easy Pay ಕರೆ ಕೋಡ್",
    codeNote:
      "ಈ ಕೋಡ್ ಖಾಸಗಿಯಾಗಿರಲಿ. ಈಗ ಮಾತ್ರ ತೋರಿಸಲಾಗುತ್ತದೆ. ಇದು ಬ್ಯಾಂಕ್ ಪಿನ್ ಅಲ್ಲ.",
    linked: "ಫೋನ್ ಡೆಮೋಗೆ ಸಂಪರ್ಕಿಸಲಾಗಿದೆ",
    start: "ಡೆಮೋ ಕರೆ ಪ್ರಾರಂಭಿಸಿ",
    end: "ಕರೆ ಮುಗಿಸಿ",
    disconnect: "ಫೋನ್ ಸಂಪರ್ಕ ತೆಗೆದುಹಾಕಿ",
    confirmDisconnect:
      "ಈ ಫೋನ್ ಸಂಪರ್ಕ ತೆಗೆದುಹಾಕಿ ಮತ್ತು ಸಕ್ರಿಯ ಕರೆಗಳನ್ನು ಮುಗಿಸಬೇಕೇ?",
    digit: "ನಮೂದಿಸಿದ ಅಂಕಿಗಳು",
    live: "ನಿಜವಾದ ಕರೆ ಮತ್ತು ಬ್ಯಾಂಕ್ ಪಾವತಿಗಳು ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ.",
    details: "ನಿಜವಾದ ಕರೆ ಹೇಗೆ ಸಂಪರ್ಕವಾಗುತ್ತದೆ",
    explain:
      "ದೂರವಾಣಿ ಸಂಸ್ಥೆ ಸಹಿ ಮಾಡಿದ ಗೇಟ್‌ವೇ ಮೂಲಕ ಸಂಪರ್ಕಿಸಬಹುದು. ನಿಜವಾದ ಪಾವತಿಗೆ ಬ್ಯಾಂಕ್ ಅಥವಾ UPI 123PAY ಪಾಲುದಾರ ಬೇಕು. ಇಲ್ಲಿ UPI ಪಿನ್ ಅಥವಾ ಒಟಿಪಿ ಪಡೆಯುವುದಿಲ್ಲ. ಫೋನ್ ಮಾಲೀಕತ್ವವನ್ನು ಸಂಸ್ಥೆ ದೃಢೀಕರಿಸಬೇಕು.",
    recipients: "ಉಳಿಸಿದ ಸ್ವೀಕರಿಸುವವರು",
    limit: "ಪ್ರತಿ ಡೆಮೋ ಫೋನ್ ಪಾವತಿಗೆ ₹10,000ವರೆಗೆ",
    useCode: "ಈ ಡೆಮೋಗೆ ನನ್ನ ಕೋಡ್ ನಮೂದಿಸಿ",
    receipt: "ರಸೀದಿ ತೆರೆಯಿರಿ",
    help: "ವಂಚನೆ ವರದಿ ಸಹಾಯಕ",
    status: "ಚಟುವಟಿಕೆ",
    key: "ಒತ್ತಿ",
    review: "ಪಾವತಿ ವಿವರಗಳು",
    again: "ಮತ್ತೊಂದು ಕರೆ ಪ್ರಾರಂಭಿಸಿ",
    language: "ಕರೆ ಭಾಷೆ",
  },
};
export default function Keypad() {
  const { prefs, t } = useApp();
  const d = copy[prefs.language];
  const [connection, setConnection] = useState<Connection | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Key | null>(null);
  const [remove, setRemove] = useState(false);
  const sending = useRef(false);
  const voice = useVoice(
    call?.language ?? prefs.language,
    prefs.speech_rate,
    undefined,
    prefs.cloud_voice,
  );
  const load = useCallback(
    () =>
      api<Connection | null>("/api/phone/connection")
        .then(setConnection)
        .catch((e) => setError(e.message))
        .finally(() => setLoaded(true)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function pair() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await api<Connection & { call_code: string }>(
        "/api/phone/connection",
        { phone, language: prefs.language, consent },
      );
      setConnection(value);
      setCode(value.call_code);
      setCall(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function start() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    voice.stop();
    try {
      const value = await api<Call>("/api/phone/calls", {});
      setCall(value);
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function key(value: string, existing?: Key) {
    if (!call || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    voice.stop();
    const body = existing ?? {
      session_id: call.session_id,
      event_id: crypto.randomUUID(),
      key: value,
    };
    try {
      const next = await api<Call>("/api/phone/calls/key", body);
      setCall(next);
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
      setPending(body);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function enterCode() {
    if (!call || sending.current || !code) return;
    sending.current = true;
    setBusy(true);
    setError("");
    voice.stop();
    try {
      let next = call;
      for (const digit of code + "#") {
        const body = {
          session_id: call.session_id,
          event_id: crypto.randomUUID(),
          key: digit,
        };
        setPending(body);
        next = await api<Call>("/api/phone/calls/key", body);
      }
      setCall(next);
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    setError("");
    voice.stop();
    try {
      await api("/api/phone/connection", undefined, "DELETE");
      setConnection(null);
      setCall(null);
      setCode("");
      setConsent(false);
      setPending(null);
      setRemove(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="assistant-page">
      <PageHeading title={d.title} description={d.intro} />
      <ErrorNotice error={error || voice.error} />
      {!loaded ? (
        <p role="status">{t("wait")}</p>
      ) : !connection ? (
        <form
          className="panel stack"
          onSubmit={(e) => {
            e.preventDefault();
            void pair();
          }}
        >
          <h2>{d.setup}</h2>
          <div className="field">
            <label htmlFor="linked-phone">{d.phone}</label>
            <input
              id="linked-phone"
              type="tel"
              inputMode="tel"
              placeholder="+91"
              maxLength={30}
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <p>
            {d.language}:{" "}
            {prefs.language === "kn-IN"
              ? "ಕನ್ನಡ"
              : prefs.language === "hi-IN"
                ? "हिन्दी"
                : "English"}
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {d.agree}
          </label>
          <button className="btn primary" disabled={busy || !consent}>
            {d.link}
          </button>
        </form>
      ) : (
        <section className="panel stack-sm">
          <h2>{d.linked}</h2>
          <p>
            {connection.phone} ·{" "}
            {connection.language === "kn-IN"
              ? "ಕನ್ನಡ"
              : connection.language === "hi-IN"
                ? "हिन्दी"
                : "English"}
          </p>
          <p>{d.limit}</p>
          {code && (
            <div className="call-code">
              <h3>{d.code}</h3>
              <p className="code-number">{code}</p>
              <small>{d.codeNote}</small>
            </div>
          )}
          {!call && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void start()}
            >
              <Icon name="phone" size={20} />
              {d.start}
            </button>
          )}
          <div className="actions">
            <Link className="text-button" href="/recipients">
              {d.recipients}
            </Link>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setRemove(true)}
            >
              {d.disconnect}
            </button>
          </div>
          {remove && (
            <div className="warning stack-sm">
              <p>{d.confirmDisconnect}</p>
              <div className="actions">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => void disconnect()}
                >
                  {d.disconnect}
                </button>
                <button className="btn" onClick={() => setRemove(false)}>
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      {call && (
        <section className="panel stack">
          <div
            className={
              "call-screen " + (call.step === "warning" ? "danger-panel" : "")
            }
            aria-live="polite"
            aria-atomic="true"
          >
            <h2>{busy ? t("wait") : call.reply}</h2>
          </div>
          {["auth", "amount"].includes(call.step) && (
            <p role="status">
              {d.digit}: {"•".repeat(call.entered_digits)}
            </p>
          )}
          <AssistantVoice
            voice={voice}
            text={call.reply}
            language={call.language}
            ready={loaded}
            busy={busy}
          />
          {pending && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => void key(pending.key, pending)}
            >
              {t("retry")}
            </button>
          )}
          {!call.end_call && (
            <>
              <div className="dialpad">
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                  "*",
                  "0",
                  "#",
                ].map((value) => (
                  <button
                    key={value}
                    disabled={busy || !!pending}
                    onClick={() => void key(value)}
                    aria-label={d.key + " " + value}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="actions">
                {call.step === "auth" && code && (
                  <button
                    className="btn"
                    disabled={busy || !!pending || call.entered_digits > 0}
                    onClick={() => void enterCode()}
                  >
                    {d.useCode}
                  </button>
                )}
                <button
                  className="text-button"
                  disabled={busy || !!pending}
                  onClick={() => void key("*")}
                >
                  {d.end}
                </button>
              </div>
            </>
          )}
          {call.receipt_id && (
            <Link
              className="btn primary"
              href={"/payment-result/" + call.receipt_id}
            >
              {d.receipt}
            </Link>
          )}
          {call.next_action && (
            <Link
              className={
                "btn " + (call.step === "warning" ? "danger-solid" : "")
              }
              href={call.next_action}
            >
              {call.next_action === "/help/fraud" ? d.help : d.status}
            </Link>
          )}
          {call.end_call && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => void start()}
            >
              {d.again}
            </button>
          )}
          {call.step === "review" && (
            <dl className="details">
              {Object.entries(call.details).map(([field, value]) => (
                <div key={field}>
                  <dt>
                    {field === "purpose"
                      ? t("reason")
                      : field === "recipient"
                        ? t("recipient")
                        : field === "amount"
                          ? t("amount")
                          : t("upi")}
                  </dt>
                  <dd>
                    {field === "amount" ? "₹" : ""}
                    {value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
      <div className="panel stack-sm">
        <p className="hint">{d.live}</p>
        <details>
          <summary className="text-button">{d.details}</summary>
          <p>{d.explain}</p>
        </details>
      </div>
    </main>
  );
}
