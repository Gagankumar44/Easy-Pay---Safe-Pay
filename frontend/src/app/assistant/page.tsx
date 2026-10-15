"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  Draft,
  Language,
  PaymentFields,
  PaymentContact,
  Safety,
  session,
} from "@/lib/api";
import { useVoice } from "@/lib/voice";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { SafetyNotice } from "@/components/safety-notice";
import { AssistantVoice } from "@/components/assistant-voice";
import { elderCopy } from "@/lib/elder-copy";
import { assistantInputCopy } from "@/lib/assistant-input-copy";
import { OnlineVoice } from "@/components/online-voice";
import { uiCopy } from "@/lib/ui-copy";
import { microphoneCopy } from "@/lib/microphone-copy";
type Chat = {
  session_id: string;
  intent: string;
  step: string;
  reply: string;
  slots: { recipient: string; amount: string | null; purpose: string };
  summary: PaymentFields | null;
  next_action: string | null;
  safety: Safety | null;
  language: Language;
  intent_confirmed: boolean;
  choices: {
    label: string;
    value?: string;
    href?: string;
    recipient_id?: string;
  }[];
  contact?: PaymentContact | null;
  bill: { consumer_number: string } | null;
};
type Message = { role: "user" | "assistant"; text: string };
type RequestBody = {
  session_id: string | null;
  request_id: string;
  message: string;
  language: Language;
  recipient_id?: string | null;
};
const copy = {
  "en-IN": {
    greeting: "What would you like help with?",
    yes: "Yes, review payment",
    history: "Conversation",
    answer: "Your answer",
    correct: "Change details",
    details: "Details so far",
    fraud: "Reporting assistant",
    switch: "Language",
    cancel: "Cancel task",
  },
  "hi-IN": {
    greeting: "आपको क्या मदद चाहिए?",
    yes: "हाँ, भुगतान की जाँच करें",
    history: "बातचीत",
    answer: "आपका जवाब",
    correct: "विवरण बदलें",
    details: "अब तक के विवरण",
    fraud: "रिपोर्ट सहायक",
    switch: "भाषा",
    cancel: "काम रद्द करें",
  },
  "kn-IN": {
    greeting: "ನಿಮಗೆ ಯಾವ ಸಹಾಯ ಬೇಕು?",
    yes: "ಹೌದು, ಪಾವತಿ ಪರಿಶೀಲಿಸಿ",
    history: "ಸಂಭಾಷಣೆ",
    answer: "ನಿಮ್ಮ ಉತ್ತರ",
    correct: "ವಿವರ ಬದಲಿಸಿ",
    details: "ಇದುವರೆಗಿನ ವಿವರಗಳು",
    fraud: "ವರದಿ ಸಹಾಯಕ",
    switch: "ಭಾಷೆ",
    cancel: "ಕೆಲಸ ರದ್ದು ಮಾಡಿ",
  },
};
export default function AssistantPage() {
  const { prefs, t, update, ready } = useApp();
  const c = elderCopy(prefs.language);
  const d = copy[prefs.language];
  const a = assistantInputCopy(prefs.language);
  const mic = microphoneCopy(prefs.language);
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [contacts, setContacts] = useState<PaymentContact[]>([]);
  const modeChosen = useRef(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [restored, setRestored] = useState(false);
  const [retryBody, setRetryBody] = useState<RequestBody | null>(null);
  const sending = useRef(false);
  const question = useRef<HTMLDivElement>(null);
  const dangerRegion = useRef<HTMLDivElement>(null);
  const textbox = useRef<HTMLTextAreaElement>(null);
  const transcript = useCallback((text: string) => {
    setInput(text);
    requestAnimationFrame(() => textbox.current?.focus());
  }, []);
  const voice = useVoice(
    prefs.language,
    prefs.speech_rate,
    transcript,
    prefs.cloud_voice,
  );
  useEffect(() => {
    if (chat?.step === "paused") dangerRegion.current?.focus();
  }, [chat?.step]);
  useEffect(() => {
    void Promise.resolve().then(() => {
      const mode = new URLSearchParams(window.location.search).get("mode");
      if (mode === "voice" || mode === "text") {
        modeChosen.current = true;
        setInputMode(mode);
      }
      try {
        const saved = JSON.parse(session.getItem("easy-pay-chat") ?? "null");
        if (saved) {
          setChat(saved.chat);
          setMessages(saved.messages);
        }
      } catch {
        session.removeItem("easy-pay-chat");
      }
      setRestored(true);
    });
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (!modeChosen.current)
      void Promise.resolve().then(() =>
        setInputMode(prefs.interaction === "touch" ? "text" : "voice"),
      );
    let active = true;
    void api<PaymentContact[]>("/api/recipients")
      .then((value) => {
        if (active) setContacts(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ready, prefs.interaction]);
  useEffect(() => {
    if (!chat || busy || chat.language === prefs.language) return;
    let active = true;
    void api<Chat>(
      "/api/assistant/sessions/" +
        chat.session_id +
        "?language=" +
        prefs.language,
    )
      .then((value) => {
        if (active) setChat(value);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          if (e instanceof ApiError && [404, 410].includes(e.status))
            setExpired(true);
        }
      });
    return () => {
      active = false;
    };
  }, [chat, busy, prefs.language]);
  useEffect(() => {
    if (chat)
      session.setItem("easy-pay-chat", JSON.stringify({ chat, messages }));
  }, [chat, messages]);
  async function send(
    text: string,
    existing?: RequestBody,
    advance = false,
    recipientId?: string,
  ) {
    if (sending.current || !text.trim()) return;
    sending.current = true;
    setBusy(true);
    setError("");
    voice.stop();
    voice.cancelListening();
    const body = existing ?? {
      session_id: chat?.session_id ?? null,
      request_id: crypto.randomUUID(),
      message: text,
      language: prefs.language,
      recipient_id: recipientId ?? null,
    };
    const next = [...messages, { role: "user" as const, text }];
    if (!existing) {
      setInput("");
    }
    try {
      const data = await api<Chat>("/api/assistant/chat", body);
      setChat(data);
      setMessages([...next, { role: "assistant", text: data.reply }]);
      setRetryBody(null);
      question.current?.focus();
      if (
        (advance || data.intent_confirmed) &&
        data.intent_confirmed &&
        data.summary &&
        data.next_action
      ) {
        await enterReview(data);
      }
    } catch (e) {
      setError((e as Error).message);
      const ended = e instanceof ApiError && [401, 404, 410].includes(e.status);
      const invalid = e instanceof ApiError && e.status === 422;
      setExpired(ended);
      const retryable =
        !(e instanceof ApiError) ||
        e.status === 0 ||
        e.status === 408 ||
        e.status === 429 ||
        e.status >= 500 ||
        (e.status === 409 && /processing|message updated/i.test(e.message));
      setRetryBody(ended || invalid || !retryable ? null : body);
      if (!ended) setInput(text);
    } finally {
      setBusy(false);
      sending.current = false;
    }
  }
  function restart() {
    voice.stop();
    voice.cancelListening();
    setChat(null);
    setMessages([]);
    setInput("");
    setError("");
    setExpired(false);
    setRetryBody(null);
    session.removeItem("easy-pay-chat");
  }
  async function enterReview(value: Chat) {
    if (value.next_action === "/send-money") {
      const draft = await api<Draft>(
        "/api/assistant/sessions/" + value.session_id + "/review",
        {},
      );
      router.push("/send-money?draft=" + draft.id);
    } else if (value.next_action) {
      router.push(value.next_action);
    }
  }
  async function open() {
    if (!chat || sending.current) return;
    sending.current = true;
    setBusy(true);
    voice.stop();
    try {
      await enterReview(chat);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  function chooseInput(mode: "voice" | "text", focusAnswer = true) {
    modeChosen.current = true;
    voice.stop();
    voice.cancelListening();
    setInputMode(mode);
    if (mode === "text" && focusAnswer)
      requestAnimationFrame(() => textbox.current?.focus());
  }
  const latest = chat?.reply ?? d.greeting;
  const hasDetails = !!chat?.slots && Object.values(chat.slots).some(Boolean);
  return (
    <main className="assistant-page">
      <PageHeading title={t("assistantTitle")} />
      <div className="language-choices" role="group" aria-label={d.switch}>
        {(
          [
            ["en-IN", "English"],
            ["hi-IN", "हिन्दी"],
            ["kn-IN", "ಕನ್ನಡ"],
          ] as const
        ).map(([language, label]) => (
          <button
            key={language}
            className={"btn " + (prefs.language === language ? "selected" : "")}
            aria-pressed={prefs.language === language}
            disabled={!ready || busy || voice.listening || voice.transcribing}
            onClick={() =>
              void update({ language }).catch((e) => setError(e.message))
            }
          >
            {label}
          </button>
        ))}
      </div>
      {chat?.step === "paused" && chat.safety && (
        <div ref={dangerRegion} tabIndex={-1} style={{ marginBottom: 20 }}>
          <SafetyNotice safety={chat.safety} />
        </div>
      )}
      <section className="panel assistant-focus stack">
        <p className="assistant-speaker">
          <Icon name="volume" size={20} />
          {a.assistant}
        </p>
        <div
          ref={question}
          tabIndex={-1}
          className="assistant-question"
          aria-live="polite"
          aria-atomic="true"
        >
          {chat?.step !== "paused" && <h2>{busy ? t("wait") : latest}</h2>}
        </div>
        <AssistantVoice
          voice={voice}
          text={latest}
          ready={
            ready && restored && (!chat || chat.language === prefs.language)
          }
          busy={busy || expired}
          replyKey={String(messages.length)}
        />
        <ErrorNotice error={error} />
        {(!chat || ["start", "cancelled"].includes(chat.step)) && (
          <details className="assistant-other-tasks">
            <summary>{uiCopy(prefs.language).moreTasks}</summary>
            <div className="quick-tasks">
              <button
                className="btn"
                disabled={busy}
                onClick={() => void send(c.sendPrompt)}
              >
                {t("send")}
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void send(c.billPrompt)}
              >
                {t("bills")}
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void send(c.statusPrompt)}
              >
                {t("check")}
              </button>
              <Link className="btn" href="/help/fraud">
                {t("getHelp")}
              </Link>
            </div>
          </details>
        )}
        {!!chat?.choices?.length && (
          <div className="quick-tasks">
            {chat.choices.map((choice, i) =>
              choice.href ? (
                <Link key={i} href={choice.href} className="btn">
                  {choice.label}
                </Link>
              ) : (
                <button
                  key={i}
                  disabled={busy}
                  className="btn"
                  onClick={() =>
                    void send(
                      choice.value ?? choice.label,
                      undefined,
                      false,
                      choice.recipient_id,
                    )
                  }
                >
                  {choice.label}
                </button>
              ),
            )}
          </div>
        )}
        {chat?.contact && (
          <div className="matched-contact" role="status">
            <span className="contact-avatar" aria-hidden="true">
              {chat.contact.name.slice(0, 1)}
            </span>
            <div>
              <small>
                {a.matched}
                {chat.contact.demo ? " · " + a.demo : ""}
              </small>
              <strong>{chat.contact.name}</strong>
              <span>
                {chat.contact.upi_id}
                {chat.contact.upi_id && chat.contact.phone ? " · " : ""}
                {chat.contact.phone}
              </span>
            </div>
          </div>
        )}
        {hasDetails && chat && (
          <details open={["review", "bill_review"].includes(chat.step)}>
            <summary className="text-button">{d.details}</summary>
            <dl className="details">
              {(["recipient", "amount", "purpose"] as const)
                .filter((k) => !!chat.slots[k])
                .map((k) => (
                  <div key={k}>
                    <dt>{t(k === "purpose" ? "reason" : k)}</dt>
                    <dd>
                      {k === "amount" ? "₹" : ""}
                      {chat.slots[k]}
                    </dd>
                  </div>
                ))}
              {chat.bill && (
                <div>
                  <dt>
                    {prefs.language === "kn-IN"
                      ? "ಗ್ರಾಹಕ ಸಂಖ್ಯೆ"
                      : prefs.language === "hi-IN"
                        ? "उपभोक्ता नंबर"
                        : "Consumer number"}
                  </dt>
                  <dd>{chat.bill.consumer_number}</dd>
                </div>
              )}
            </dl>
          </details>
        )}
        {chat?.step === "review" && !chat.intent_confirmed && (
          <button
            className="btn primary"
            disabled={busy || !!retryBody}
            onClick={() => void send("yes", undefined, true)}
          >
            {d.yes}
            <Icon name="arrow" size={18} />
          </button>
        )}
        {chat?.next_action && chat.step !== "paused" && (
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => void open()}
          >
            {chat.next_action === "/send-money"
              ? t("openReview")
              : chat.next_action === "/activity"
                ? t("activity")
                : t("getHelp")}
            <Icon name="arrow" size={18} />
          </button>
        )}
        {chat?.step === "paused" && (
          <Link
            className="btn danger-solid"
            href={"/help/fraud?conversation=" + chat.session_id}
          >
            {d.fraud}
            <Icon name="arrow" size={18} />
          </Link>
        )}
        {retryBody && (
          <button
            className="btn"
            disabled={busy}
            onClick={() => void send(retryBody.message, retryBody)}
          >
            {t("retry")}
          </button>
        )}
        <form
          className={"assistant-composer input-" + inputMode}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <div className="input-mode-tabs" role="tablist" aria-label={a.choice}>
            {(["voice", "text"] as const).map((mode) => (
              <button
                type="button"
                role="tab"
                key={mode}
                id={"input-tab-" + mode}
                aria-selected={inputMode === mode}
                tabIndex={inputMode === mode ? 0 : -1}
                aria-controls="answer-panel"
                className={"input-mode-tab mode-" + mode}
                onClick={() => chooseInput(mode)}
                onKeyDown={(event) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? "voice"
                        : event.key === "End"
                          ? "text"
                          : mode === "voice"
                            ? "text"
                            : "voice";
                    chooseInput(next, false);
                    document.getElementById("input-tab-" + next)?.focus();
                  }
                }}
              >
                <Icon name={mode === "voice" ? "mic" : "keyboard"} size={23} />
                {mode === "voice" ? a.speak : a.type}
              </button>
            ))}
          </div>
          <div
            id="answer-panel"
            role="tabpanel"
            aria-labelledby={"input-tab-" + inputMode}
            className="input-mode-panel stack"
          >
            {inputMode === "voice" && (
              <div className="voice-answer-area">
                <button
                  type="button"
                  className={
                    "voice-capture-button" +
                    (voice.listening ? " is-listening" : "")
                  }
                  disabled={
                    busy || expired || !!retryBody || voice.transcribing
                  }
                  aria-pressed={voice.listening || voice.starting}
                  onClick={
                    voice.starting
                      ? voice.cancelListening
                      : voice.listening
                        ? voice.stopListening
                        : voice.start
                  }
                >
                  <span className="voice-capture-icon">
                    <Icon name={voice.listening ? "check" : "mic"} size={30} />
                  </span>
                  <span>
                    {voice.starting
                      ? mic.cancel
                      : voice.listening
                        ? a.stop
                        : !voice.supported
                          ? mic.setup
                          : a.tap}
                  </span>
                </button>
                <p className="hint">
                  {prefs.cloud_voice ? mic.finishHint : a.microphone}
                </p>
                {voice.starting && (
                  <p className="mic-starting" role="status">
                    {mic.starting}
                  </p>
                )}
                <ErrorNotice error={voice.inputError} />
                <OnlineVoice
                  needed={!voice.supported || voice.inputNeedsOnline}
                  forMicrophone
                />
              </div>
            )}
            {(inputMode === "text" || !!input || voice.transcribing) && (
              <div className="field">
                <label htmlFor="message">
                  <Icon
                    name={inputMode === "text" ? "keyboard" : "mic"}
                    size={19}
                  />
                  {inputMode === "text" ? a.typed : a.transcript}
                </label>
                <textarea
                  id="message"
                  ref={textbox}
                  rows={2}
                  maxLength={500}
                  value={input}
                  disabled={
                    busy ||
                    expired ||
                    !!retryBody ||
                    voice.transcribing ||
                    voice.listening ||
                    voice.starting
                  }
                  onFocus={voice.stop}
                  onChange={(e) => {
                    voice.stop();
                    setInput(e.target.value);
                  }}
                  placeholder={a.placeholder}
                />
              </div>
            )}
            <div className="actions">
              {(inputMode === "text" || !!input) && (
                <button
                  className="btn primary"
                  disabled={
                    busy ||
                    expired ||
                    !!retryBody ||
                    voice.listening ||
                    voice.starting ||
                    voice.transcribing ||
                    !input.trim()
                  }
                >
                  {a.send}
                  <Icon name="arrow" size={18} />
                </button>
              )}
            </div>
            {voice.listening && <p role="status">{c.recording}</p>}
            {voice.transcribing && <p role="status">{c.transcribing}</p>}
          </div>
        </form>
        {chat && (
          <div className="chat-tools">
            {chat.step === "review" && (
              <>
                <button
                  disabled={busy}
                  className="text-button"
                  onClick={() => void send(c.editAmount)}
                >
                  {c.editAmount}
                </button>
                <button
                  disabled={busy}
                  className="text-button"
                  onClick={() => void send(c.editName)}
                >
                  {c.editName}
                </button>
              </>
            )}
            {chat.step !== "cancelled" && (
              <button
                disabled={busy}
                className="text-button"
                onClick={() => void send("cancel")}
              >
                {d.cancel}
              </button>
            )}
            <button disabled={busy} className="text-button" onClick={restart}>
              {t("restart")}
            </button>
          </div>
        )}
      </section>
      {contacts.length > 0 &&
        (!chat || ["start", "cancelled", "recipient"].includes(chat.step)) && (
          <section className="assistant-contacts">
            <div className="section-label">
              <h2>{a.saved}</h2>
              <Link href="/recipients" className="text-button">
                {a.edit}
              </Link>
            </div>
            <div className="contact-shortcuts">
              {contacts.slice(0, 6).map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className="contact-shortcut"
                  disabled={busy}
                  onClick={() =>
                    chat?.step === "recipient"
                      ? void send(contact.name, undefined, false, contact.id)
                      : void send(
                          c.sendPrompt +
                            " " +
                            (prefs.language === "en-IN" ? "to " : "") +
                            contact.name,
                        )
                  }
                >
                  <span className="contact-avatar" aria-hidden="true">
                    {contact.name.slice(0, 1)}
                  </span>
                  <strong>{contact.name}</strong>
                  <small>
                    {contact.demo ? a.demo + " · " : ""}
                    {contact.phone?.slice(-4) || contact.upi_id}
                  </small>
                </button>
              ))}
            </div>
          </section>
        )}
      {!!messages.length && (
        <details className="panel conversation-history">
          <summary className="text-button">
            {d.history} · {messages.filter((m) => m.role === "user").length}
          </summary>
          <div className="chat-log">
            {messages.map((m, i) => (
              <p key={i} className={"bubble " + m.role}>
                <small>
                  {m.role === "user" ? t("message") : t("assistant")}
                </small>
                {m.text}
              </p>
            ))}
          </div>
        </details>
      )}
      <p className="hint">{t("secret")}</p>
    </main>
  );
}
