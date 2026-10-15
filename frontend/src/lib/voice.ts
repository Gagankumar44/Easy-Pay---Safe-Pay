"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, Language, speechAudio, speechTranscript } from "./api";
import { elderCopy } from "./elder-copy";
import { recordedVoice, hasRecordedKannada } from "./recorded-voice";
import {
  startRecognition,
  type NativeCapture,
  type Recognition,
} from "./recognition";
import { microphoneCopy, microphoneError } from "./microphone-copy";
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useVoice(
  language: Language,
  rate: number,
  onTranscript?: (text: string) => void,
  allowCloud = false,
) {
  const [supported, setSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [inputNeedsOnline, setInputNeedsOnline] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [inputError, setInputError] = useState("");
  const [voiceMissing, setVoiceMissing] = useState(false);
  const recognition = useRef<NativeCapture | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recordTimer = useRef<number | null>(null);
  const playback = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<{
    text: string;
    language: Language;
    blob: Blob;
  } | null>(null);
  const audioUrl = useRef<string | null>(null);
  const audioAbort = useRef<AbortController | null>(null);
  const transcriptAbort = useRef<AbortController | null>(null);
  const playVersion = useRef(0);
  const listenVersion = useRef(0);
  const microphonePending = useRef(false);
  const callback = useRef(onTranscript);
  useEffect(() => {
    callback.current = onTranscript;
  }, [onTranscript]);
  const stop = useCallback(() => {
    playVersion.current++;
    audioAbort.current?.abort();
    playback.current?.pause();
    playback.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setPreparing(false);
  }, []);
  const cancelListening = useCallback(() => {
    listenVersion.current++;
    microphonePending.current = false;
    transcriptAbort.current?.abort();
    recognition.current?.cancel();
    recognition.current = null;
    if (recorder.current && recorder.current.state !== "inactive")
      recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (recordTimer.current) window.clearTimeout(recordTimer.current);
    setListening(false);
    setStarting(false);
    setTranscribing(false);
  }, []);
  useEffect(() => {
    const refresh = () => {
      const w = window as SpeechWindow;
      setSupported(
        Boolean(
          w.SpeechRecognition ||
          w.webkitSpeechRecognition ||
          (allowCloud &&
            window.MediaRecorder &&
            navigator.mediaDevices?.getUserMedia),
        ),
      );
      setSpeechSupported(
        "speechSynthesis" in window ||
          allowCloud ||
          (language === "kn-IN" && hasRecordedKannada),
      );
      const voices =
        "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];
      setVoiceMissing(
        language !== "en-IN" &&
          !voices.some((v) =>
            v.lang.toLowerCase().startsWith(language.slice(0, 2)),
          ),
      );
    };
    void Promise.resolve().then(refresh);
    const timer = window.setTimeout(refresh, 800);
    if ("speechSynthesis" in window)
      window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      audioCache.current = null;
      window.clearTimeout(timer);
      if ("speechSynthesis" in window)
        window.speechSynthesis.removeEventListener("voiceschanged", refresh);
      stop();
      cancelListening();
    };
  }, [language, allowCloud, stop, cancelListening]);
  const speak = useCallback(
    (text: string, customRate = rate) => {
      stop();
      setSpeechError("");
      setPlaybackBlocked(false);
      const c = elderCopy(language);
      const version = playVersion.current;
      const voices =
        "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];
      const native =
        voices.find((v) => v.lang.toLowerCase() === language.toLowerCase()) ||
        voices.find((v) =>
          v.lang.toLowerCase().startsWith(language.slice(0, 2)),
        );
      const recorded = recordedVoice(language, text);
      if (
        native ||
        (language === "en-IN" && "speechSynthesis" in window && !allowCloud)
      ) {
        const output = new SpeechSynthesisUtterance(text);
        output.lang = language;
        output.rate = customRate;
        if (native) output.voice = native;
        output.onstart = () => {
          if (version === playVersion.current) setSpeaking(true);
        };
        output.onend = () => {
          if (version === playVersion.current) setSpeaking(false);
        };
        output.onerror = (event) => {
          if (version === playVersion.current) {
            setSpeaking(false);
            if (event.error === "not-allowed") setPlaybackBlocked(true);
            else if (!["canceled", "interrupted"].includes(event.error))
              setSpeechError(c.voiceUnavailable);
          }
        };
        window.speechSynthesis.speak(output);
        return;
      }
      if (!allowCloud && !recorded) {
        setSpeechError(c.voiceUnavailable);
        setVoiceMissing(language !== "en-IN");
        return;
      }
      const controller = new AbortController();
      audioAbort.current = controller;
      const timer = window.setTimeout(() => controller.abort(), 50000);
      setPreparing(true);
      const cached = audioCache.current;
      const source =
        cached?.text === text && cached.language === language
          ? Promise.resolve(cached.blob)
          : recorded
            ? fetch(recorded, { signal: controller.signal }).then(
                (response) => {
                  if (!response.ok) throw new Error();
                  return response.blob();
                },
              )
            : speechAudio(text, language, controller.signal);
      void source
        .then(async (blob) => {
          if (version !== playVersion.current) return;
          audioCache.current = { text, language, blob };
          const url = URL.createObjectURL(blob);
          audioUrl.current = url;
          const audio = new Audio(url);
          playback.current = audio;
          audio.playbackRate = Math.max(0.5, Math.min(1.2, customRate));
          audio.onended = () => {
            if (version === playVersion.current) stop();
          };
          audio.onerror = () => {
            if (version === playVersion.current) {
              stop();
              setSpeechError(c.voiceUnavailable);
            }
          };
          await audio.play();
          if (version === playVersion.current) setSpeaking(true);
        })
        .catch((e) => {
          if (version === playVersion.current) {
            stop();
            if (e instanceof Error && e.name === "NotAllowedError")
              setPlaybackBlocked(true);
            else
              setSpeechError(
                e instanceof ApiError && e.status === 429
                  ? c.voiceBusy
                  : c.voiceUnavailable,
              );
          }
        })
        .finally(() => {
          window.clearTimeout(timer);
          if (version === playVersion.current) setPreparing(false);
        });
    },
    [language, rate, allowCloud, stop],
  );
  const start = useCallback(() => {
    stop();
    cancelListening();
    setInputError("");
    const version = listenVersion.current;
    const c = elderCopy(language);
    setInputNeedsOnline(false);
    if (
      allowCloud &&
      window.MediaRecorder &&
      navigator.mediaDevices?.getUserMedia
    ) {
      setStarting(true);
      microphonePending.current = true;
      recordTimer.current = window.setTimeout(() => {
        if (microphonePending.current && version === listenVersion.current) {
          cancelListening();
          setInputError(microphoneError("permission-timeout", language));
        }
      }, 20000);
      void navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((capture) => {
          if (version !== listenVersion.current) {
            capture.getTracks().forEach((track) => track.stop());
            return;
          }
          stream.current = capture;
          microphonePending.current = false;
          if (recordTimer.current) window.clearTimeout(recordTimer.current);
          setStarting(false);
          const mime = [
            "audio/webm;codecs=opus",
            "audio/ogg;codecs=opus",
            "audio/mp4",
          ].find((value) => MediaRecorder.isTypeSupported(value));
          if (!mime) {
            capture.getTracks().forEach((track) => track.stop());
            setListening(false);
            setInputError(c.inputUnavailable);
            return;
          }
          const input = new MediaRecorder(capture, { mimeType: mime });
          recorder.current = input;
          const chunks: Blob[] = [];
          let size = 0;
          input.ondataavailable = (event) => {
            size += event.data.size;
            if (size > 3 * 1024 * 1024) {
              cancelListening();
              setInputError(c.noSpeech);
              return;
            }
            chunks.push(event.data);
          };
          input.onerror = () => {
            cancelListening();
            setInputError(c.noSpeech);
          };
          input.onstop = () => {
            capture.getTracks().forEach((track) => track.stop());
            if (recordTimer.current) window.clearTimeout(recordTimer.current);
            if (version !== listenVersion.current) return;
            setListening(false);
            if (!size) {
              setInputError(c.noSpeech);
              return;
            }
            const controller = new AbortController();
            transcriptAbort.current = controller;
            const timer = window.setTimeout(() => controller.abort(), 35000);
            setTranscribing(true);
            void speechTranscript(
              new Blob(chunks, { type: mime }),
              language,
              controller.signal,
            )
              .then((result) => {
                if (version === listenVersion.current)
                  callback.current?.(result.text);
              })
              .catch((e) => {
                if (version === listenVersion.current)
                  setInputError(
                    e instanceof ApiError &&
                      /OTP|PIN|password|credentials/i.test(e.message)
                      ? c.secretAudio
                      : e instanceof ApiError && e.status >= 500
                        ? microphoneCopy(language).network
                        : c.noSpeech,
                  );
              })
              .finally(() => {
                window.clearTimeout(timer);
                if (version === listenVersion.current) setTranscribing(false);
              });
          };
          input.start(1000);
          setListening(true);
          recordTimer.current = window.setTimeout(() => {
            if (input.state === "recording") input.stop();
          }, 45000);
        })
        .catch((error) => {
          if (version === listenVersion.current) {
            cancelListening();
            setInputError(
              microphoneError(
                error instanceof Error ? error.name : "audio-capture",
                language,
              ),
            );
          }
        });
      return;
    }
    const Constructor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) {
      setInputError(c.inputUnavailable);
      setInputNeedsOnline(true);
      return;
    }
    try {
      recognition.current = startRecognition(Constructor, language, {
        status: (status) => {
          if (version === listenVersion.current) {
            setStarting(status === "starting");
            setListening(status === "listening");
          }
        },
        text: (text) => {
          if (version === listenVersion.current) callback.current?.(text);
        },
        error: (code) => {
          if (version !== listenVersion.current) return;
          setInputError(microphoneError(code, language));
          setInputNeedsOnline(!["not-allowed", "audio-capture"].includes(code));
        },
      });
    } catch {
      setStarting(false);
      setInputError(microphoneError("service-not-allowed", language));
      setInputNeedsOnline(true);
    }
  }, [language, allowCloud, stop, cancelListening]);
  const stopListening = useCallback(() => {
    if (microphonePending.current) {
      cancelListening();
      return;
    }
    if (recorder.current?.state === "recording") recorder.current.stop();
    else recognition.current?.stop();
  }, [cancelListening]);
  return {
    supported,
    speechSupported,
    listening,
    starting,
    inputNeedsOnline,
    speaking,
    preparing,
    playbackBlocked,
    transcribing,
    error: inputError || speechError,
    inputError,
    speechError,
    voiceMissing,
    start,
    stopListening,
    cancelListening,
    speak,
    stop,
  };
}
