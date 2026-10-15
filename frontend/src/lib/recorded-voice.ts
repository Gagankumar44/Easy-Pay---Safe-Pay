import recordingData from "./recorded-voices.json";
import { Language } from "./api";
const recordings = recordingData as Record<string, string>;
export const voiceKey = (text: string) => text.trim().replace(/[.?!।]+$/, "");
export function recordedVoice(language: Language, text: string) {
  return language === "kn-IN" ? recordings[voiceKey(text)] : undefined;
}
export const hasRecordedKannada = Object.keys(recordings).length > 0;
