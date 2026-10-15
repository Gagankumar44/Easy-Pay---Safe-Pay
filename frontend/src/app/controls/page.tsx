"use client";
import { useState } from "react";
import Link from "next/link";
import { api, Preferences } from "@/lib/api";
import { elderCopy } from "@/lib/elder-copy";
import { useVoice } from "@/lib/voice";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { OnlineVoice } from "@/components/online-voice";
import { Icon } from "@/components/icons";
const lessons = {
  "en-IN": [
    [
      "Choose your language",
      "Use the language menu at the top. You can change it at any time.",
    ],
    ["Make reading comfortable", "Try larger letters or high contrast."],
    [
      "Recognise a warning",
      "Red means stop for a serious concern. Amber means pause and check. Each warning explains what to do.",
    ],
    [
      "Review before deciding",
      "Check who receives money and how much. You can change or cancel before confirming.",
    ],
  ],
  "hi-IN": [
    ["अपनी भाषा चुनें", "ऊपर भाषा के मेनू से चुनें। इसे कभी भी बदल सकते हैं।"],
    ["पढ़ना आसान करें", "बड़े अक्षर या अधिक कंट्रास्ट आज़माएँ।"],
    [
      "चेतावनी पहचानें",
      "लाल रंग गंभीर खतरे पर रुकने के लिए है। पीला रंग रुककर जाँचने के लिए है। साथ में करने वाला काम बताया जाता है।",
    ],
    [
      "फैसले से पहले जाँचें",
      "पैसे किसे और कितने जाने हैं, जाँचें। पुष्टि से पहले बदल या रद्द कर सकते हैं।",
    ],
  ],
  "kn-IN": [
    [
      "ನಿಮ್ಮ ಭಾಷೆ ಆರಿಸಿ",
      "ಮೇಲಿನ ಭಾಷೆ ಮೆನುವನ್ನು ಬಳಸಿ. ಯಾವಾಗ ಬೇಕಾದರೂ ಬದಲಿಸಬಹುದು.",
    ],
    [
      "ಓದುವುದನ್ನು ಸುಲಭ ಮಾಡಿ",
      "ದೊಡ್ಡ ಅಕ್ಷರ ಅಥವಾ ಹೆಚ್ಚಿನ ಕಾಂಟ್ರಾಸ್ಟ್ ಪ್ರಯತ್ನಿಸಿ.",
    ],
    [
      "ಎಚ್ಚರಿಕೆ ಗುರುತಿಸಿ",
      "ಗಂಭೀರ ಅಪಾಯಕ್ಕೆ ಕೆಂಪು ಬಣ್ಣ ನಿಲ್ಲಿಸಲು ಹೇಳುತ್ತದೆ. ಹಳದಿ ಬಣ್ಣ ಪರಿಶೀಲಿಸಲು ಹೇಳುತ್ತದೆ. ಏನು ಮಾಡಬೇಕು ಎಂದು ಬರಹವೂ ತಿಳಿಸುತ್ತದೆ.",
    ],
    [
      "ನಿರ್ಧಾರದ ಮೊದಲು ಪರಿಶೀಲಿಸಿ",
      "ಹಣ ಯಾರಿಗೆ ಮತ್ತು ಎಷ್ಟು ಹೋಗುತ್ತದೆ ಎಂದು ನೋಡಿ. ದೃಢೀಕರಿಸುವ ಮೊದಲು ಬದಲಿಸಬಹುದು ಅಥವಾ ರದ್ದು ಮಾಡಬಹುದು.",
    ],
  ],
};
export default function Controls() {
  const { prefs, t, update, ready } = useApp();
  const c = elderCopy(prefs.language);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previous, setPrevious] = useState<Pick<
    Preferences,
    "text_size" | "contrast"
  > | null>(null);
  const voice = useVoice(
    prefs.language,
    prefs.speech_rate,
    undefined,
    prefs.cloud_voice,
  );
  const lesson = lessons[prefs.language][step];
  async function trial(patch: Partial<Preferences>) {
    setPrevious(
      (value) =>
        value ?? { text_size: prefs.text_size, contrast: prefs.contrast },
    );
    try {
      await update(patch);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function finish() {
    setBusy(true);
    try {
      await api(
        "/api/progress/controls",
        { completed_steps: [0, 1, 2, 3] },
        "PUT",
      );
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="narrow">
      <PageHeading title={c.tutorial} description={c.tutorialIntro} />
      <ErrorNotice error={error || voice.error} />
      {done ? (
        <section className="panel stack">
          <h2>{c.controlsDone}</h2>
          <Link className="btn primary" href="/">
            {t("home")}
          </Link>
        </section>
      ) : (
        <section className="panel stack">
          <p className="tour-count">{step + 1} / 4</p>
          <h2>{lesson[0]}</h2>
          <p>{lesson[1]}</p>
          {step === 1 && (
            <div className="actions">
              <button
                className="btn"
                disabled={!ready}
                onClick={() => void trial({ text_size: "large" })}
              >
                {c.tryLarger}
              </button>
              <button
                className="btn"
                disabled={!ready}
                onClick={() => void trial({ contrast: !prefs.contrast })}
              >
                {c.tryContrast}
              </button>
            </div>
          )}
          {step === 2 && (
            <div className="danger-panel stack-sm">
              <div className="alert-heading">
                <Icon name="warning" />
                <strong>{c.danger}</strong>
              </div>
              <p>{c.dangerAction}</p>
              <small>{c.practice}</small>
            </div>
          )}
          {step === 3 && (
            <div className="notice stack-sm">
              <strong>Demo Shop · ₹100</strong>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setChecked(event.target.checked)}
                />
                {t("confirm")}
              </label>
            </div>
          )}
          <OnlineVoice needed={voice.voiceMissing} />
          <div className="actions">
            <button
              className="text-button"
              onClick={() => voice.speak(lesson.join(". "))}
            >
              <Icon name="volume" size={18} />
              {voice.preparing ? c.preparing : t("replay")}
            </button>
            {(voice.speaking || voice.preparing) && (
              <button className="text-button" onClick={voice.stop}>
                {t("stop")}
              </button>
            )}
          </div>
          <div className="actions">
            {step > 0 && (
              <button
                className="btn"
                onClick={() => {
                  voice.stop();
                  setStep(step - 1);
                }}
              >
                {c.previous}
              </button>
            )}
            {step < 3 ? (
              <button
                className="btn primary"
                onClick={() => {
                  voice.stop();
                  setStep(step + 1);
                }}
              >
                {c.next}
              </button>
            ) : (
              <button
                className="btn primary"
                disabled={!checked || busy}
                onClick={() => void finish()}
              >
                {busy ? t("wait") : c.finish}
              </button>
            )}
          </div>
        </section>
      )}
      {previous && (
        <button
          className="text-button"
          onClick={() =>
            void update(previous).catch((e) => setError(e.message))
          }
        >
          {c.restore}
        </button>
      )}
    </main>
  );
}
