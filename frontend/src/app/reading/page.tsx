"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { api, Reading, readImage } from "@/lib/api";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { followupCopy } from "@/lib/followup-copy";
import { useVoice } from "@/lib/voice";
import { Icon } from "@/components/icons";
import { SafetyNotice } from "@/components/safety-notice";
import { OnlineVoice } from "@/components/online-voice";
import { elderCopy } from "@/lib/elder-copy";
const copy = {
  "en-IN": {
    textMode: "Text",
    photoMode: "Photo",
    intro: "Understand visible words, then check the original.",
    text: "Type or paste the visible text",
    image: "Choose a redacted screenshot or photo",
    consent: "I removed private details and allow Google to read this content.",
    privacy:
      "Use fictional or redacted content. Remove OTPs, passwords, recovery codes, full account and identity numbers. PNG, JPEG or WebP, up to 5 MB. No payment is prepared from an image.",
    explain: "Explain this",
    clear: "Clear content",
    unclear: "Some content is unclear. Check the original.",
    warning: "Pause and verify this request independently.",
    original: "Text that was read",
    sample: "Use sample text",
  },
  "hi-IN": {
    textMode: "पाठ",
    photoMode: "फोटो",
    intro: "दिखाई देने वाले शब्द समझें, फिर मूल जानकारी जाँचें।",
    text: "दिखाई देने वाला पाठ लिखें या पेस्ट करें",
    image: "निजी जानकारी हटाकर स्क्रीनशॉट या फोटो चुनें",
    consent:
      "मैंने निजी जानकारी हटाई है और Google को यह पढ़ने की अनुमति देता/देती हूँ।",
    privacy:
      "काल्पनिक या निजी जानकारी हटाया हुआ पाठ उपयोग करें। ओटीपी, पासवर्ड, रिकवरी कोड, पूरे खाता और पहचान नंबर हटाएँ। PNG, JPEG या WebP, अधिकतम 5 MB। फोटो से भुगतान तैयार नहीं होता।",
    explain: "समझाएँ",
    clear: "पाठ साफ करें",
    unclear: "कुछ जानकारी स्पष्ट नहीं है। मूल जानकारी जाँचें।",
    warning: "रुकें और इस अनुरोध की स्वतंत्र जाँच करें।",
    original: "पढ़ा गया पाठ",
    sample: "नमूना पाठ उपयोग करें",
  },
  "kn-IN": {
    textMode: "ಪಠ್ಯ",
    photoMode: "ಚಿತ್ರ",
    intro: "ಕಾಣುವ ಪದಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಂಡು ಮೂಲ ಮಾಹಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ.",
    text: "ಕಾಣುವ ಪಠ್ಯವನ್ನು ಬರೆಯಿರಿ ಅಥವಾ ಅಂಟಿಸಿ",
    image: "ಖಾಸಗಿ ವಿವರಗಳನ್ನು ತೆಗೆದ ಚಿತ್ರ ಆಯ್ಕೆಮಾಡಿ",
    consent: "ಖಾಸಗಿ ವಿವರ ತೆಗೆದಿದ್ದೇನೆ. ಈ ಮಾಹಿತಿಯನ್ನು Google ಓದಲು ಒಪ್ಪುತ್ತೇನೆ.",
    privacy:
      "ಕಾಲ್ಪನಿಕ ಅಥವಾ ಖಾಸಗಿ ವಿವರಗಳನ್ನು ತೆಗೆದ ಮಾಹಿತಿಯನ್ನು ಬಳಸಿ. ಒಟಿಪಿ, ಪಾಸ್‌ವರ್ಡ್, ಚೇತರಿಕೆ ಕೋಡ್, ಪೂರ್ಣ ಖಾತೆ ಮತ್ತು ಗುರುತಿನ ಸಂಖ್ಯೆಗಳನ್ನು ತೆಗೆದುಹಾಕಿ. PNG, JPEG ಅಥವಾ WebP, ಗರಿಷ್ಠ 5 MB. ಚಿತ್ರದಿಂದ ಪಾವತಿ ಸಿದ್ಧವಾಗುವುದಿಲ್ಲ.",
    explain: "ವಿವರಿಸಿ",
    clear: "ಮಾಹಿತಿ ತೆರವುಗೊಳಿಸಿ",
    unclear: "ಕೆಲವು ಮಾಹಿತಿ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ.",
    warning: "ನಿಲ್ಲಿಸಿ ಈ ವಿನಂತಿಯನ್ನು ಸ್ವತಂತ್ರವಾಗಿ ಪರಿಶೀಲಿಸಿ.",
    original: "ಓದಿದ ಪಠ್ಯ",
    sample: "ಮಾದರಿ ಪಠ್ಯ ಬಳಸಿ",
  },
};
export default function ReadingPage() {
  const { prefs, t } = useApp();
  const c = copy[prefs.language];
  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Reading | null>(null);
  const voice = useVoice(
    result?.language ?? prefs.language,
    prefs.speech_rate,
    undefined,
    prefs.cloud_voice,
  );
  const clearResult = () => {
    voice.stop();
    setResult(null);
    setError("");
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    clearResult();
    setBusy(true);
    try {
      setResult(
        mode === "text"
          ? await api<Reading>("/api/reading/text", {
              text,
              consent,
              language: prefs.language,
            })
          : await readImage(file!, prefs.language),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function clear() {
    clearResult();
    setText("");
    setFile(null);
    setFileKey((key) => key + 1);
    setConsent(false);
  }
  return (
    <main className="narrow">
      <PageHeading
        title={followupCopy(prefs.language).reading}
        description={c.intro}
      />
      <ErrorNotice error={error || voice.error} />
      <form className="panel stack" onSubmit={(event) => void submit(event)}>
        <div className="filters">
          <button
            type="button"
            className={"filter " + (mode === "text" ? "active" : "")}
            aria-pressed={mode === "text"}
            disabled={busy}
            onClick={() => {
              clearResult();
              setMode("text");
            }}
          >
            {c.textMode}
          </button>
          <button
            type="button"
            className={"filter " + (mode === "image" ? "active" : "")}
            aria-pressed={mode === "image"}
            disabled={busy}
            onClick={() => {
              clearResult();
              setMode("image");
            }}
          >
            {c.photoMode}
          </button>
        </div>
        {mode === "text" ? (
          <div className="field">
            <label htmlFor="reading-text">{c.text}</label>
            <textarea
              id="reading-text"
              required
              minLength={3}
              maxLength={5000}
              rows={6}
              disabled={busy}
              value={text}
              onChange={(event) => {
                clearResult();
                setText(event.target.value);
              }}
            />
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                clearResult();
                setText(
                  prefs.language === "hi-IN"
                    ? "नमूना बिजली बिल: कुल राशि ₹850। अंतिम तारीख 21 अक्टूबर। भुगतान के बाद पावती रखें।"
                    : prefs.language === "kn-IN"
                      ? "ಮಾದರಿ ವಿದ್ಯುತ್ ಬಿಲ್: ಒಟ್ಟು ₹850. ಕೊನೆಯ ದಿನಾಂಕ ಅಕ್ಟೋಬರ್ 21. ಪಾವತಿಯ ನಂತರ ಸ್ವೀಕೃತಿ ಉಳಿಸಿ."
                      : "Sample electricity bill: Total ₹850. Due date 21 October. Keep the acknowledgement after payment.",
                );
              }}
            >
              {c.sample}
            </button>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="reading-file">{c.image}</label>
            <input
              id="reading-file"
              key={fileKey}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
              disabled={busy}
              onChange={(event) => {
                clearResult();
                const next = event.target.files?.[0] ?? null;
                if (
                  next &&
                  (next.size > 5 * 1024 * 1024 ||
                    !["image/png", "image/jpeg", "image/webp"].includes(
                      next.type,
                    ))
                ) {
                  setFile(null);
                  setError("Choose a PNG, JPEG or WebP smaller than 5 MB.");
                } else setFile(next);
              }}
            />
          </div>
        )}
        <details>
          <summary className="text-button">
            {elderCopy(prefs.language).more}
          </summary>
          <p className="hint">
            {c.privacy}{" "}
            {prefs.language === "kn-IN"
              ? "ಈ ಆ್ಯಪ್ ಇದನ್ನು ಉಳಿಸುವುದಿಲ್ಲ."
              : prefs.language === "hi-IN"
                ? "यह ऐप इसे सहेजता नहीं है।"
                : "This app does not save the content."}
          </p>
        </details>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={consent}
            disabled={busy}
            onChange={(event) => setConsent(event.target.checked)}
          />
          {c.consent}
        </label>
        <div className="actions">
          <button
            className="btn primary"
            disabled={busy || !consent || (mode === "image" && !file)}
          >
            {busy ? t("wait") : c.explain}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={clear}
          >
            {c.clear}
          </button>
        </div>
      </form>
      {result && (
        <section className="panel stack section-space" aria-live="polite">
          <h2>{result.title}</h2>
          <p className="reading-copy">{result.summary}</p>
          {result.unclear && <p className="notice">{c.unclear}</p>}
          {result.safety.paused && <SafetyNotice safety={result.safety} />}
          {result.visible_text && (
            <details>
              <summary className="text-button">{c.original}</summary>
              <p className="reading-copy">{result.visible_text}</p>
            </details>
          )}
          <p className="hint">{result.notice}</p>
          <OnlineVoice needed={voice.voiceMissing} />
          <button
            className="text-button"
            onClick={() => voice.speak(result.summary + " " + result.notice)}
          >
            <Icon name="volume" size={18} />
            {t("replay")}
          </button>
          {(voice.preparing || voice.speaking) && (
            <button className="text-button" onClick={voice.stop}>
              {t("stop")}
            </button>
          )}
        </section>
      )}
      <Link href="/glossary" className="text-button">
        {followupCopy(prefs.language).glossary}
        <Icon name="arrow" size={18} />
      </Link>
    </main>
  );
}
