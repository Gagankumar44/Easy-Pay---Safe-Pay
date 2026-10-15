"use client";
import { useApp } from "./app-shell";
import { Icon } from "./icons";

export const paymentCopy = {
  "en-IN": {
    checking: "Checking payment",
    checkingText: "Please wait while we check the details and warning signs.",
    processing: "Waiting for the result",
    processingText: "Keep this page open. Do not send another payment.",
    ready: "Ready to confirm",
    readyText:
      "No listed warning signs found. Check the recipient and amount below.",
    blocked: "Payment stopped",
    paused: "Payment on hold",
    changed: "Choose the saved contact again before continuing.",
    recover: "Check your last attempt",
    recoverText: "Retrieve its receipt before starting another payment.",
    recoverButton: "Recover receipt",
    connection: "Service unavailable",
    connectionText:
      "Your details are kept here. Try again when the service returns.",
    retryReview: "Review again",
    billAccount: "Bill account",
    purposeHint: "For example, groceries or an electricity bill",
  },
  "hi-IN": {
    checking: "भुगतान की जाँच हो रही है",
    checkingText: "विवरण और चेतावनी संकेतों की जाँच होने तक रुकें।",
    processing: "परिणाम का इंतज़ार है",
    processingText: "यह पृष्ठ खुला रखें। दूसरा भुगतान न करें।",
    ready: "पुष्टि के लिए तैयार",
    readyText: "सूचीबद्ध चेतावनी संकेत नहीं मिले। नीचे नाम और रकम जाँचें।",
    blocked: "भुगतान रोक दिया गया",
    paused: "भुगतान रुका हुआ है",
    changed: "आगे बढ़ने से पहले सहेजा संपर्क दोबारा चुनें।",
    recover: "पिछला प्रयास जाँचें",
    recoverText: "दूसरा भुगतान शुरू करने से पहले उसकी रसीद लें।",
    recoverButton: "रसीद वापस पाएँ",
    connection: "सेवा उपलब्ध नहीं है",
    connectionText: "विवरण यहीं सुरक्षित हैं। सेवा लौटने पर फिर कोशिश करें।",
    retryReview: "फिर से जाँचें",
    billAccount: "बिल खाता",
    purposeHint: "जैसे, किराने का सामान या बिजली का बिल",
  },
  "kn-IN": {
    checking: "ಪಾವತಿ ಪರಿಶೀಲಿಸುತ್ತಿದೆ",
    checkingText: "ವಿವರ ಮತ್ತು ಎಚ್ಚರಿಕೆ ಸಂಕೇತಗಳನ್ನು ಪರಿಶೀಲಿಸುವವರೆಗೆ ಕಾಯಿರಿ.",
    processing: "ಫಲಿತಾಂಶಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದೆ",
    processingText: "ಈ ಪುಟ ತೆರೆದಿಡಿ. ಮತ್ತೊಂದು ಪಾವತಿ ಮಾಡಬೇಡಿ.",
    ready: "ದೃಢೀಕರಿಸಲು ಸಿದ್ಧವಾಗಿದೆ",
    readyText:
      "ಪಟ್ಟಿಯ ಎಚ್ಚರಿಕೆ ಸಂಕೇತಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ಕೆಳಗಿನ ಹೆಸರು ಮತ್ತು ಮೊತ್ತ ಪರಿಶೀಲಿಸಿ.",
    blocked: "ಪಾವತಿ ನಿಲ್ಲಿಸಲಾಗಿದೆ",
    paused: "ಪಾವತಿ ತಡೆಹಿಡಿಯಲಾಗಿದೆ",
    changed: "ಮುಂದುವರಿಯುವ ಮೊದಲು ಉಳಿಸಿದ ಸಂಪರ್ಕವನ್ನು ಮತ್ತೆ ಆರಿಸಿ.",
    recover: "ಹಿಂದಿನ ಪ್ರಯತ್ನ ಪರಿಶೀಲಿಸಿ",
    recoverText: "ಮತ್ತೊಂದು ಪಾವತಿ ಮಾಡುವ ಮೊದಲು ಅದರ ರಸೀದಿ ಪಡೆಯಿರಿ.",
    recoverButton: "ರಸೀದಿ ಮರಳಿ ಪಡೆಯಿರಿ",
    connection: "ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ",
    connectionText: "ವಿವರಗಳು ಇಲ್ಲಿಯೇ ಇವೆ. ಸೇವೆ ಬಂದಾಗ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    retryReview: "ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ",
    billAccount: "ಬಿಲ್ ಖಾತೆ",
    purposeHint: "ಉದಾಹರಣೆಗೆ, ದಿನಸಿ ಅಥವಾ ವಿದ್ಯುತ್ ಬಿಲ್",
  },
};

export function PaymentStatus({
  state,
}: {
  state: "checking" | "processing" | "ready" | "connection";
}) {
  const { prefs } = useApp();
  const c = paymentCopy[prefs.language];
  return (
    <section
      className={`payment-status ${state === "ready" ? "ready" : "waiting"}`}
      role="status"
      aria-live="polite"
    >
      <span className="payment-status-icon">
        <Icon name={state === "ready" ? "check" : "clock"} size={24} />
      </span>
      <div>
        <h2>{c[state]}</h2>
        <p>{c[`${state}Text`]}</p>
      </div>
    </section>
  );
}
