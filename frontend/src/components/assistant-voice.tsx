"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Language, session } from "@/lib/api";
import { useVoice } from "@/lib/voice";
import { recordedVoice } from "@/lib/recorded-voice";
import { elderCopy } from "@/lib/elder-copy";
import { ErrorNotice, useApp } from "./app-shell";
import { Icon } from "./icons";
import { OnlineVoice } from "./online-voice";
import { microphoneCopy } from "@/lib/microphone-copy";

const copy = {
  "en-IN": {
    on: "Voice on",
    paused: "Voice paused",
    pause: "Pause voice",
    resume: "Turn voice on",
    speaking: "Speaking",
    answering: "Listening to your answer",
    setup: "Voice needs setup",
    start: "Start voice",
    blocked: "Tap once to let your browser play the voice.",
    options: "Voice options",
    repeat: "Repeat question",
    pace: "Speaking pace",
    slow: "Slow",
    comfortable: "Comfortable",
    normal: "Normal",
    otherPages: "Read other pages aloud",
    automatic:
      "Assistant questions are spoken automatically. You can pause voice in the assistant.",
  },
  "hi-IN": {
    on: "आवाज़ चालू",
    paused: "आवाज़ बंद",
    pause: "आवाज़ रोकें",
    resume: "आवाज़ चालू करें",
    speaking: "सहायक बोल रहा है",
    answering: "आपका जवाब सुन रहे हैं",
    setup: "आवाज़ सेट करें",
    start: "आवाज़ शुरू करें",
    blocked: "ब्राउज़र में आवाज़ सुनने के लिए एक बार दबाएँ।",
    options: "आवाज़ के विकल्प",
    repeat: "सवाल दोबारा सुनें",
    pace: "बोलने की गति",
    slow: "धीमी",
    comfortable: "आरामदायक",
    normal: "सामान्य",
    otherPages: "दूसरे पृष्ठों का पाठ सुनें",
    automatic: "सहायक सवाल अपने आप बोलता है। सहायक में आवाज़ रोक सकते हैं।",
  },
  "kn-IN": {
    on: "ಧ್ವನಿ ಚಾಲನೆಯಲ್ಲಿದೆ",
    paused: "ಧ್ವನಿ ನಿಲ್ಲಿಸಲಾಗಿದೆ",
    pause: "ಧ್ವನಿ ನಿಲ್ಲಿಸಿ",
    resume: "ಧ್ವನಿ ಚಾಲನೆ ಮಾಡಿ",
    speaking: "ಸಹಾಯಕ ಮಾತನಾಡುತ್ತಿದೆ",
    answering: "ನಿಮ್ಮ ಉತ್ತರ ಕೇಳುತ್ತಿದೆ",
    setup: "ಧ್ವನಿ ಹೊಂದಿಸಿ",
    start: "ಧ್ವನಿ ಪ್ರಾರಂಭಿಸಿ",
    blocked: "ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಕೇಳಲು ಒಮ್ಮೆ ಒತ್ತಿರಿ.",
    options: "ಧ್ವನಿ ಆಯ್ಕೆಗಳು",
    repeat: "ಪ್ರಶ್ನೆ ಮತ್ತೆ ಕೇಳಿ",
    pace: "ಮಾತಿನ ವೇಗ",
    slow: "ನಿಧಾನ",
    comfortable: "ಆರಾಮವಾಗಿ",
    normal: "ಸಾಮಾನ್ಯ",
    otherPages: "ಇತರ ಪುಟಗಳ ಪಠ್ಯ ಓದಿ ಹೇಳಿ",
    automatic:
      "ಸಹಾಯಕ ಪ್ರಶ್ನೆಗಳನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಹೇಳುತ್ತದೆ. ಸಹಾಯಕದಲ್ಲಿ ಧ್ವನಿ ನಿಲ್ಲಿಸಬಹುದು.",
  },
};
export const assistantVoiceCopy = (language: Language) => copy[language];

export function AssistantVoice({
  voice,
  text,
  ready,
  busy = false,
  language,
  replyKey = "",
}: {
  voice: ReturnType<typeof useVoice>;
  text: string;
  ready: boolean;
  busy?: boolean;
  language?: Language;
  replyKey?: string;
}) {
  const { prefs, update, ready: profileReady } = useApp();
  const selectedLanguage = language ?? prefs.language;
  const d = copy[selectedLanguage];
  const c = elderCopy(selectedLanguage);
  const [paused, setPaused] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");
  const lastQuestion = useRef("");
  const paceId = useId();
  const { speak, stop, cancelListening } = voice;
  const needsOnline =
    voice.voiceMissing && !recordedVoice(selectedLanguage, text);
  const key = JSON.stringify([
    selectedLanguage,
    text,
    replyKey,
    prefs.cloud_voice,
  ]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setPaused(session.getItem("easy-pay-voice-paused") === "true");
      setInitialized(true);
    });
  }, []);

  useEffect(() => {
    if (voice.listening || voice.starting || voice.transcribing) {
      lastQuestion.current = key;
      return;
    }
    if (
      !ready ||
      !profileReady ||
      !initialized ||
      busy ||
      !text ||
      paused ||
      needsOnline ||
      !voice.speechSupported ||
      voice.playbackBlocked ||
      lastQuestion.current === key
    )
      return;
    // Give restored conversations and device voices time to settle. One reply is
    // spoken once; microphone completion never restarts the previous question.
    const timer = window.setTimeout(() => {
      if (document.hidden) return;
      lastQuestion.current = key;
      speak(text);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    ready,
    profileReady,
    initialized,
    busy,
    text,
    paused,
    needsOnline,
    key,
    voice.speechSupported,
    voice.playbackBlocked,
    voice.listening,
    voice.starting,
    voice.transcribing,
    speak,
  ]);

  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        stop();
        cancelListening();
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [stop, cancelListening]);

  function play() {
    lastQuestion.current = key;
    cancelListening();
    speak(text);
  }
  const status = voice.starting
    ? microphoneCopy(selectedLanguage).starting
    : voice.listening
      ? d.answering
      : voice.transcribing
        ? c.transcribing
        : paused
          ? d.paused
          : needsOnline
            ? d.setup
            : voice.preparing
              ? c.preparing
              : voice.speaking
                ? d.speaking
                : d.on;
  return (
    <div className="assistant-voice stack-sm">
      <div className="voice-bar">
        <span className="voice-state" role="status">
          <Icon name="volume" size={21} />
          {status}
        </span>
        {voice.playbackBlocked &&
        !paused &&
        !voice.listening &&
        !voice.starting ? (
          <button
            type="button"
            className="btn"
            disabled={busy || !ready || !profileReady}
            onClick={play}
          >
            {d.start}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (paused) {
                session.removeItem("easy-pay-voice-paused");
                setPaused(false);
                if (ready && profileReady && !busy && !needsOnline) play();
              } else {
                stop();
                cancelListening();
                session.setItem("easy-pay-voice-paused", "true");
                setPaused(true);
              }
            }}
          >
            {paused ? d.resume : d.pause}
          </button>
        )}
      </div>
      {voice.playbackBlocked && !paused && <p className="hint">{d.blocked}</p>}
      {!paused && <OnlineVoice needed={needsOnline} />}
      <details className="voice-options">
        <summary>{d.options}</summary>
        <div className="voice-options-body">
          <div className="field">
            <label htmlFor={paceId}>{d.pace}</label>
            <select
              id={paceId}
              value={prefs.speech_rate}
              onChange={(event) => {
                void update({ speech_rate: Number(event.target.value) }).catch(
                  (e) => setError(e.message),
                );
              }}
            >
              <option value={0.65}>{d.slow}</option>
              <option value={0.85}>{d.comfortable}</option>
              <option value={1}>{d.normal}</option>
              {![0.65, 0.85, 1].includes(prefs.speech_rate) && (
                <option value={prefs.speech_rate}>
                  {prefs.speech_rate.toFixed(2)}×
                </option>
              )}
            </select>
          </div>
          <button
            type="button"
            className="btn"
            disabled={
              busy ||
              !ready ||
              !profileReady ||
              !text ||
              !voice.speechSupported ||
              needsOnline ||
              voice.transcribing ||
              voice.listening ||
              voice.starting
            }
            onClick={play}
          >
            <Icon name="volume" size={20} />
            {d.repeat}
          </button>
        </div>
      </details>
      <ErrorNotice error={error || voice.speechError} />
    </div>
  );
}
