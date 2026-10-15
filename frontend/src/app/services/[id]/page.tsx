"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ErrorNotice, PageHeading, useApp } from "@/components/app-shell";
import { useVoice } from "@/lib/voice";
import { guidesFor } from "@/lib/guides";
import { Icon } from "@/components/icons";
import { useProgress } from "@/lib/progress";
import { uiCopy } from "@/lib/ui-copy";
import { OnlineVoice } from "@/components/online-voice";
export default function Guide() {
  const { id } = useParams<{ id: string }>();
  const { prefs, t } = useApp();
  const guide = guidesFor(prefs.language).find((g) => g.id === id);
  const c = uiCopy(prefs.language);
  const voice = useVoice(
    prefs.language,
    prefs.speech_rate,
    undefined,
    prefs.cloud_voice,
  );
  const progress = useProgress();
  const checked =
    progress.items.find((item) => item.task === id)?.completed_steps ?? [];
  if (!guide)
    return (
      <main>
        <PageHeading title={c.notFound} />
        <Link className="btn" href="/services">
          {t("services")}
        </Link>
      </main>
    );
  return (
    <main className="narrow">
      <PageHeading title={guide.title} description={guide.description} />
      <section className="panel stack">
        <ErrorNotice error={progress.error} />
        {progress.loading && <p role="status">{t("wait")}</p>}
        <p className="hint">{guide.source}</p>
        <ol className="numbered">
          {guide.steps.map((step, index) => (
            <li key={step}>
              <div>
                <p>{step}</p>
                <label className="checkbox small" style={{ marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={checked.includes(index)}
                    disabled={progress.loading || progress.saving}
                    onChange={(e) =>
                      void progress.save(
                        id,
                        e.target.checked
                          ? [...checked, index]
                          : checked.filter((i) => i !== index),
                      )
                    }
                  />
                  {c.stepRead}
                </label>
              </div>
            </li>
          ))}
        </ol>
        <p className="notice">{guide.note}</p>
        <div className="actions">
          <a
            className="btn primary"
            href={guide.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.openOfficial}
            <Icon name="arrow" size={18} />
          </a>
          <button
            className="text-button"
            onClick={() => voice.speak(guide.steps.join(" "))}
          >
            <Icon name="volume" size={18} />
            {t("replay")}
          </button>
          {(voice.speaking || voice.preparing) && (
            <button className="text-button" onClick={voice.stop}>
              {t("stop")}
            </button>
          )}
        </div>
        <OnlineVoice needed={voice.voiceMissing} />
        <ErrorNotice error={voice.error} />
        <a
          href={guide.reference}
          className="text-button"
          target="_blank"
          rel="noopener noreferrer"
        >
          {c.source}
        </a>
      </section>
      <Link href="/services" className="text-button">
        {t("back")} · {t("services")}
      </Link>
    </main>
  );
}
