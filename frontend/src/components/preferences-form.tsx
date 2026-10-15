"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  defaults,
  downloadText,
  Preferences,
  switchProfile,
} from "@/lib/api";
import { useVoice } from "@/lib/voice";
import { ErrorNotice, PageHeading, useApp } from "./app-shell";
import { Icon } from "./icons";
import Link from "next/link";
import { followupCopy } from "@/lib/followup-copy";
import { elderCopy } from "@/lib/elder-copy";
import { assistantVoiceCopy } from "./assistant-voice";
export function PreferencesForm({
  onboarding = false,
}: {
  onboarding?: boolean;
}) {
  const { prefs, t, update, account } = useApp();
  const [form, setForm] = useState<Preferences>(defaults);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const voice = useVoice(
    form.language,
    form.speech_rate,
    undefined,
    form.cloud_voice,
  );
  useEffect(() => {
    Promise.resolve().then(() => setForm(prefs));
  }, [prefs]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await update({ ...form, onboarded: true });
      setNotice(t("savedNotice"));
      if (onboarding) router.push("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api("/api/profile", undefined, "DELETE");
      switchProfile();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function exportData() {
    try {
      downloadText(
        "easy-pay-demo-data.json",
        JSON.stringify(await api("/api/profile/export"), null, 2),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    setNotice("");
  };
  return (
    <main className="narrow">
      <PageHeading
        title={onboarding ? "Welcome to Easy Pay." : t("settingsTitle")}
        description={
          onboarding
            ? "Choose what feels comfortable. No bank account or microphone access is needed to explore."
            : t("settingsText")
        }
      />
      <ErrorNotice error={error} />
      {!onboarding && (
        <div className="panel stack-sm" style={{ marginBottom: 22 }}>
          <h2>
            {account
              ? "Your app account · " + account.username
              : "Guest demo session"}
          </h2>
          <div className="actions">
            <Link className="text-button" href="/account">
              {account ? "Manage account" : "Sign in or create an account"}
            </Link>
            <Link className="text-button" href="/reminders">
              {followupCopy(prefs.language).reminders}
            </Link>
            <Link className="text-button" href="/controls">
              {elderCopy(prefs.language).tutorial}
            </Link>
          </div>
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {onboarding && (
        <div className="progress-steps">
          {["Welcome", t("language"), t("interaction"), t("size")].map(
            (label, i) => (
              <span className={step === i ? "current" : ""} key={i}>
                {i + 1}. {label}
              </span>
            ),
          )}
        </div>
      )}
      <div className="panel stack">
        {onboarding && step === 0 && (
          <div className="stack">
            <Icon name="shield" size={35} />
            <h2>A guide for your everyday decisions.</h2>
            <p className="muted">
              Practise a payment, check a suspicious request, or find an
              official service. You stay in control of each step.
            </p>
            <p className="hint">
              This hackathon demo uses fictional profiles and simulated
              payments.
            </p>
          </div>
        )}
        {(!onboarding || step === 1) && (
          <div className="field">
            <label htmlFor="preference-language">{t("language")}</label>
            <select
              id="preference-language"
              value={form.language}
              onChange={(e) =>
                set("language", e.target.value as Preferences["language"])
              }
            >
              <option value="en-IN">English</option>
              <option value="hi-IN">हिन्दी</option>
              <option value="kn-IN">ಕನ್ನಡ</option>
            </select>
          </div>
        )}
        {(!onboarding || step === 2) && (
          <div className="field">
            <label htmlFor="interaction">{t("interaction")}</label>
            <select
              id="interaction"
              value={form.interaction}
              onChange={(e) =>
                set("interaction", e.target.value as Preferences["interaction"])
              }
            >
              <option value="both">{t("both")}</option>
              <option value="voice">{t("voice")}</option>
              <option value="touch">{t("touch")}</option>
            </select>
            <small>
              Every task also has a text and touch option. Voice availability
              depends on your device.
            </small>
          </div>
        )}
        {(!onboarding || step === 3) && (
          <>
            <div className="field">
              <label htmlFor="text-size">{t("size")}</label>
              <select
                id="text-size"
                value={form.text_size}
                onChange={(e) =>
                  set("text_size", e.target.value as Preferences["text_size"])
                }
              >
                <option value="normal">{t("normal")}</option>
                <option value="large">{t("large")}</option>
                <option value="extra-large">{t("extra")}</option>
              </select>
              <p
                style={{
                  fontSize:
                    form.text_size === "extra-large"
                      ? 26
                      : form.text_size === "large"
                        ? 23
                        : 19,
                  padding: 18,
                  background: "var(--bg)",
                  borderRadius: 10,
                }}
              >
                Review the recipient, amount and reason.
              </p>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.contrast}
                onChange={(e) => set("contrast", e.target.checked)}
              />
              {t("contrast")}
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.audio}
                onChange={(e) => set("audio", e.target.checked)}
              />
              {assistantVoiceCopy(form.language).otherPages}
            </label>
            <p className="hint">
              {assistantVoiceCopy(form.language).automatic}
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.cloud_voice}
                onChange={(event) => set("cloud_voice", event.target.checked)}
              />
              {elderCopy(form.language).onlineVoice}
            </label>
            {form.cloud_voice && (
              <p className="hint">{elderCopy(form.language).onlineNote}</p>
            )}
            {!onboarding && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.reminders}
                  onChange={(e) => set("reminders", e.target.checked)}
                />
                {followupCopy(form.language).enabled}
              </label>
            )}
            <div className="field">
              <label htmlFor="speech-rate">
                {t("speed")} · {form.speech_rate.toFixed(2)}×
              </label>
              <input
                id="speech-rate"
                type="range"
                min=".5"
                max="1.2"
                step=".05"
                value={form.speech_rate}
                onChange={(e) => set("speech_rate", Number(e.target.value))}
              />
              <button
                className="text-button"
                onClick={() => voice.speak(t("confirm"))}
              >
                <Icon name="volume" size={18} />
                {t("replay")}
              </button>
              <ErrorNotice error={voice.error} />
            </div>
          </>
        )}
        <div className="actions">
          {onboarding && step > 0 && (
            <button className="btn" onClick={() => setStep(step - 1)}>
              {t("back")}
            </button>
          )}
          {onboarding && step < 3 ? (
            <button className="btn primary" onClick={() => setStep(step + 1)}>
              Continue
              <Icon name="arrow" size={18} />
            </button>
          ) : (
            <button
              className="btn primary full"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? t("wait") : t("save")}
            </button>
          )}
        </div>
      </div>
      {!onboarding && (
        <section className="panel stack" style={{ marginTop: 22 }}>
          <h2>Your demo data</h2>
          <details>
            <summary className="text-button">
              {elderCopy(prefs.language).more}
            </summary>
            <p className="hint">
              A private device session keeps your demo activity separate.
              Preferences, payment records and complaint drafts stay on this
              demo server. Guest profiles and sign-in sessions expire after 7
              days. Accounts expire after 90 days without a sign-in; expired
              data is removed when a demo profile is opened. Voice recognition
              may use your browser’s speech service. No audio recordings are
              stored by this app.
            </p>
          </details>
          <div className="actions">
            <button className="btn" onClick={() => void exportData()}>
              Download my demo data
            </button>
            <button className="text-button" onClick={() => setDeleting(true)}>
              Delete this demo profile
            </button>
          </div>
          {deleting && (
            <div className="danger-panel stack-sm">
              <p>
                Delete all payments, preferences, recipients and complaint
                drafts from this profile? This cannot be undone.
              </p>
              <div className="actions">
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  Delete all demo data
                </button>
                <button className="btn" onClick={() => setDeleting(false)}>
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
