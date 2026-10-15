"use client";
import { useState } from "react";
import { elderCopy } from "@/lib/elder-copy";
import { ErrorNotice, useApp } from "./app-shell";
import { assistantInputCopy } from "@/lib/assistant-input-copy";
export function OnlineVoice({
  needed,
  forMicrophone = false,
}: {
  needed: boolean;
  forMicrophone?: boolean;
}) {
  const { prefs, update, t } = useApp();
  const c = elderCopy(prefs.language);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!needed || prefs.cloud_voice) return null;
  return (
    <div className="voice-option stack-sm">
      <p>
        {forMicrophone
          ? assistantInputCopy(prefs.language).onlineInput
          : c.voiceMissing}
      </p>
      <p className="hint">{c.onlineNote}</p>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void update({ cloud_voice: true })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? t("wait") : c.onlineVoice}
      </button>
      <ErrorNotice error={error} />
    </div>
  );
}
