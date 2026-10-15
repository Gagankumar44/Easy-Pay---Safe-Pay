"use client";
import Link from "next/link";
import { useState } from "react";
import { api, Safety } from "@/lib/api";
import { useVoice } from "@/lib/voice";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { elderCopy } from "@/lib/elder-copy";
import { SafetyNotice } from "@/components/safety-notice";
import { OnlineVoice } from "@/components/online-voice";
export default function Help() {
  const { t, prefs } = useApp();
  const [text, setText] = useState("");
  const [safety, setSafety] = useState<Safety | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const voice = useVoice(
    prefs.language,
    prefs.speech_rate,
    undefined,
    prefs.cloud_voice,
  );
  const c = elderCopy(prefs.language);
  async function check() {
    setBusy(true);
    setError("");
    try {
      setSafety(await api<Safety>("/api/safety/check", { text }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <PageHeading title={t("helpTitle")} description={t("helpIntro")} />
      <div className="columns">
        <div className="stack">
          <section className="panel stack">
            <Icon name="phone" size={27} />
            <p className="muted">{t("callText")}</p>
            <a className="btn primary" href="tel:1930">
              {t("call")}
              <Icon name="arrow" size={18} />
            </a>
            <a
              className="text-button"
              href="https://cybercrime.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("portal")}
            </a>
          </section>
          <section className="panel stack-sm">
            <Link className="btn" href="/contacts">
              <Icon name="users" size={21} />
              {c.contacts}
            </Link>
            <h2>{t("bank")}</h2>
            <p className="muted">{t("bankText")}</p>
            <OnlineVoice needed={voice.voiceMissing} />
            <button
              className="text-button"
              onClick={() => voice.speak(t("helpIntro") + " " + t("bankText"))}
            >
              <Icon name="volume" size={17} />
              {t("replay")}
            </button>
            <ErrorNotice error={voice.error} />
          </section>
        </div>
        <div className="stack">
          <Link href="/help/fraud" className="task-card">
            <span className="task-icon">
              <Icon name="bill" />
            </span>
            <div>
              <h2>{prefs.language === "kn-IN" ? "ವಂಚನೆ ವರದಿ ಸಹಾಯಕ" : prefs.language === "hi-IN" ? "धोखाधड़ी रिपोर्ट सहायक" : "Scam reporting assistant"}</h2>
              <p>{prefs.language === "kn-IN" ? "ವಿವರ ಸೇರಿಸಿ, ವರದಿ ಕರಡು ಸಿದ್ಧಪಡಿಸಿ." : prefs.language === "hi-IN" ? "विवरण जोड़कर रिपोर्ट मसौदा तैयार करें।" : "Gather details and prepare your report."}</p>
            </div>
            <Icon name="arrow" size={19} />
          </Link>
          <section className="panel stack">
            <h2>{c.checkMessage}</h2>
            <form
              className="stack-sm"
              onSubmit={(e) => {
                e.preventDefault();
                void check();
              }}
            >
              <label htmlFor="scam-message" className="small">
                {c.asked}
              </label>
              <textarea
                id="scam-message"
                required
                minLength={3}
                maxLength={2000}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setSafety(null);
                }}
              />
              <button className="btn" disabled={busy}>
                {busy ? t("wait") : c.checkSigns}
              </button>
            </form>
            <ErrorNotice error={error} />
            {safety && <SafetyNotice safety={safety} actions={false} />}
          </section>
          <p className="hint">{t("secret")}</p>
        </div>
      </div>
    </main>
  );
}
