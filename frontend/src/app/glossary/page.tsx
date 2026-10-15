"use client";
import { useState } from "react";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { glossaryFor } from "@/lib/glossary";
import { followupCopy } from "@/lib/followup-copy";
import { useVoice } from "@/lib/voice";
import { Icon } from "@/components/icons";
import { OnlineVoice } from "@/components/online-voice";
export default function Glossary() {
  const { prefs, t } = useApp();
  const [query, setQuery] = useState("");
  const voice = useVoice(
    prefs.language,
    prefs.speech_rate,
    undefined,
    prefs.cloud_voice,
  );
  const c = followupCopy(prefs.language);
  const items = glossaryFor(prefs.language).filter((item) =>
    item.search.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <main className="narrow">
      <PageHeading title={c.glossary} />
      <div className="field">
        <label htmlFor="word-search">
          {prefs.language === "hi-IN"
            ? "शब्द खोजें"
            : prefs.language === "kn-IN"
              ? "ಪದ ಹುಡುಕಿ"
              : "Find a word"}
        </label>
        <input
          id="word-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <ErrorNotice error={voice.error} />
      <OnlineVoice needed={voice.voiceMissing} />
      <div className="stack section-space">
        {items.map((item) => (
          <section className="panel stack-sm" key={item.term}>
            <h2>{item.term}</h2>
            <p>{item.meaning}</p>
            <button
              className="text-button"
              onClick={() => voice.speak(item.term + ". " + item.meaning)}
            >
              <Icon name="volume" size={18} />
              {t("replay")}
            </button>
          </section>
        ))}
        {!items.length && (
          <p role="status">
            {prefs.language === "hi-IN"
              ? "यह शब्द नहीं मिला।"
              : prefs.language === "kn-IN"
                ? "ಈ ಪದ ಕಂಡುಬಂದಿಲ್ಲ."
                : "No matching word. Try another term."}
          </p>
        )}
      </div>
    </main>
  );
}
