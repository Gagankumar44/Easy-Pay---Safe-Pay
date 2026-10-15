"use client";
import { Draft, money } from "@/lib/api";
import { elderCopy } from "@/lib/elder-copy";
import { useVoice } from "@/lib/voice";
import { useApp } from "./app-shell";
import { Icon } from "./icons";
import { SafetyNotice } from "./safety-notice";
import { AssistantVoice } from "./assistant-voice";
import { PaymentStatus, paymentCopy } from "./payment-status";
import { safetyCopy } from "@/lib/safety-copy";
export function PaymentReview({
  draft,
  busy = false,
}: {
  draft: Draft;
  busy?: boolean;
}) {
  const { t, prefs } = useApp();
  const c = elderCopy(prefs.language);
  const voice = useVoice(
    prefs.language,
    prefs.speech_rate,
    undefined,
    prefs.cloud_voice,
  );
  const first = draft.signals[0]
    ? safetyCopy(prefs.language, draft.signals[0])
    : null;
  const pausedSpeech =
    draft.risk_level === "strong_warning"
      ? prefs.language === "kn-IN"
        ? "ವಂಚನೆಯ ಅನುಮಾನ. ಹಣ ಕಳುಹಿಸಬೇಡಿ. ಪರಿಚಿತ ಸಂಖ್ಯೆಗೆ ಕರೆ ಮಾಡಿ ಪರಿಶೀಲಿಸಿ."
        : c.danger + " " + c.dangerAction
      : [paymentCopy[prefs.language].paused, first?.noticed, first?.action]
          .filter(Boolean)
          .join(". ");
  const spoken = draft.paused
    ? pausedSpeech
    : [
        t("recipient") + ": " + draft.recipient,
        t("amount") + ": " + draft.amount,
        t("reason") + ": " + draft.purpose,
        ...(draft.phone
          ? [
              (prefs.language === "kn-IN"
                ? "ಮೊಬೈಲ್ ಕೊನೆಯ ಅಂಕಿಗಳು "
                : prefs.language === "hi-IN"
                  ? "मोबाइल के आखिरी अंक "
                  : "Mobile ending ") + draft.phone.slice(-4),
            ]
          : []),
        t("direction"),
      ].join(". ");
  return (
    <>
      {draft.paused ? (
        <SafetyNotice safety={draft} />
      ) : (
        !busy && <PaymentStatus state="ready" />
      )}
      <div>
        <p className="review-direction">
          <Icon name="send" size={17} />
          {t("direction")}
        </p>
        <p className="review-amount">{money(draft.amount)}</p>
        <p className="lead" style={{ marginTop: 4 }}>
          {draft.recipient}
        </p>
      </div>
      <dl className="details">
        {draft.phone && (
          <div>
            <dt>
              {prefs.language === "kn-IN"
                ? "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ"
                : prefs.language === "hi-IN"
                  ? "मोबाइल नंबर"
                  : "Mobile number"}
            </dt>
            <dd>{draft.phone}</dd>
          </div>
        )}
        {draft.consumer_number && (
          <div>
            <dt>
              {prefs.language === "kn-IN"
                ? "ಬಿಲ್ ಖಾತೆ"
                : prefs.language === "hi-IN"
                  ? "बिल खाता"
                  : "Bill account"}
            </dt>
            <dd>{draft.consumer_number}</dd>
          </div>
        )}
        {draft.upi_id && (
          <div>
            <dt>{t("upi")}</dt>
            <dd>{draft.upi_id}</dd>
          </div>
        )}
        <div>
          <dt>{t("reason")}</dt>
          <dd>{draft.purpose}</dd>
        </div>
        {draft.frequency === "recurring" && (
          <div>
            <dt>{t("frequency")}</dt>
            <dd>{t("recurring")}</dd>
          </div>
        )}
      </dl>
      <p className="hint">{t("unverified")}</p>
      <AssistantVoice
        voice={voice}
        text={
          (draft.paused ? "" : paymentCopy[prefs.language].ready + ". ") +
          spoken
        }
        ready
        busy={busy}
        replyKey={draft.id + ":" + draft.revision}
      />
    </>
  );
}
