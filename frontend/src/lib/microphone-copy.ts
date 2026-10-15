import type { Language } from "./api";
const copy = {
  "en-IN": {
    starting: "Starting microphone…",
    cancel: "Cancel microphone request",
    permission:
      "Allow microphone access in your browser's site settings, then tap Speak again.",
    service:
      "The browser's speech service did not respond. Enable online voice below, or type your answer.",
    silence:
      "No words were received. Try again near the microphone, enable online voice, or type.",
    device: "No working microphone was found. Connect one or type your answer.",
    busy: "The microphone is busy. Close another recording app, then try again.",
    network:
      "Online transcription is unavailable. Your typed answer still works. Try voice again shortly.",
    setup: "Set up microphone",
    finishHint:
      "Tap Finish speaking to turn your recording into text. Check the words, then send.",
  },
  "hi-IN": {
    starting: "माइक्रोफोन शुरू हो रहा है…",
    cancel: "माइक्रोफोन अनुरोध रद्द करें",
    permission:
      "ब्राउज़र की साइट सेटिंग में माइक्रोफोन की अनुमति दें, फिर बोलें दबाएँ।",
    service:
      "ब्राउज़र की आवाज़ सेवा ने जवाब नहीं दिया। नीचे ऑनलाइन आवाज़ चालू करें या उत्तर लिखें।",
    silence:
      "कोई शब्द नहीं मिले। माइक्रोफोन के पास फिर बोलें, ऑनलाइन आवाज़ चालू करें या लिखें।",
    device:
      "काम करने वाला माइक्रोफोन नहीं मिला। माइक्रोफोन जोड़ें या उत्तर लिखें।",
    busy: "माइक्रोफोन व्यस्त है। दूसरा रिकॉर्डिंग ऐप बंद करके फिर कोशिश करें।",
    network:
      "ऑनलाइन आवाज़ को लिखने की सेवा उपलब्ध नहीं है। उत्तर लिख सकते हैं या थोड़ी देर बाद फिर बोलें।",
    setup: "माइक्रोफोन सेट करें",
    finishHint:
      "रिकॉर्डिंग को लिखने के लिए बात पूरी करें दबाएँ। शब्द जाँचें, फिर भेजें।",
  },
  "kn-IN": {
    starting: "ಮೈಕ್ರೋಫೋನ್ ಪ್ರಾರಂಭಿಸುತ್ತಿದೆ…",
    cancel: "ಮೈಕ್ರೋಫೋನ್ ವಿನಂತಿ ರದ್ದು ಮಾಡಿ",
    permission:
      "ಬ್ರೌಸರ್‌ನ ಸೈಟ್ ಸೆಟ್ಟಿಂಗ್‌ನಲ್ಲಿ ಮೈಕ್ರೋಫೋನ್ ಅನುಮತಿ ನೀಡಿ, ನಂತರ ಮಾತನಾಡಿ ಒತ್ತಿರಿ.",
    service:
      "ಬ್ರೌಸರ್‌ನ ಮಾತಿನ ಸೇವೆ ಪ್ರತಿಕ್ರಿಯಿಸಲಿಲ್ಲ. ಕೆಳಗೆ ಆನ್‌ಲೈನ್ ಧ್ವನಿ ಚಾಲನೆ ಮಾಡಿ ಅಥವಾ ಉತ್ತರ ಬರೆಯಿರಿ.",
    silence:
      "ಮಾತಿನ ಬರಹ ಸಿಗಲಿಲ್ಲ. ಮೈಕ್ರೋಫೋನ್ ಹತ್ತಿರ ಮತ್ತೆ ಹೇಳಿ, ಆನ್‌ಲೈನ್ ಧ್ವನಿ ಬಳಸಿ ಅಥವಾ ಬರೆಯಿರಿ.",
    device:
      "ಕಾರ್ಯನಿರ್ವಹಿಸುವ ಮೈಕ್ರೋಫೋನ್ ಸಿಗಲಿಲ್ಲ. ಮೈಕ್ರೋಫೋನ್ ಸಂಪರ್ಕಿಸಿ ಅಥವಾ ಉತ್ತರ ಬರೆಯಿರಿ.",
    busy: "ಮೈಕ್ರೋಫೋನ್ ಬಳಕೆಯಲ್ಲಿದೆ. ಬೇರೆ ರೆಕಾರ್ಡಿಂಗ್ ಆಪ್ ಮುಚ್ಚಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    network:
      "ಆನ್‌ಲೈನ್ ಮಾತು ಬರಹ ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ಉತ್ತರ ಬರೆಯಬಹುದು ಅಥವಾ ಸ್ವಲ್ಪ ಸಮಯದ ಬಳಿಕ ಮತ್ತೆ ಮಾತನಾಡಿ.",
    setup: "ಮೈಕ್ರೋಫೋನ್ ಹೊಂದಿಸಿ",
    finishHint:
      "ರೆಕಾರ್ಡಿಂಗ್ ಬರಹವಾಗಲು ಮಾತು ಮುಗಿಸಿ ಒತ್ತಿರಿ. ಬರಹ ಪರಿಶೀಲಿಸಿ ನಂತರ ಕಳುಹಿಸಿ.",
  },
};
export const microphoneCopy = (language: Language) => copy[language];
export function microphoneError(code: string, language: Language) {
  const c = copy[language];
  if (
    [
      "not-allowed",
      "NotAllowedError",
      "SecurityError",
      "permission-timeout",
    ].includes(code)
  )
    return c.permission;
  if (["audio-capture", "NotFoundError"].includes(code)) return c.device;
  if (code === "NotReadableError") return c.busy;
  if (code === "no-speech") return c.silence;
  return c.service;
}
