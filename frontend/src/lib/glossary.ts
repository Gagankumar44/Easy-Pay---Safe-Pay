import { Language } from "./api";
export const glossary = [
  {
    term: ["UPI", "UPI", "UPI"],
    meaning: [
      "A system for moving money between participating bank accounts. Review who receives money and how much before approving.",
      "बैंक खातों के बीच पैसे भेजने की प्रणाली। मंज़ूरी से पहले प्राप्तकर्ता और राशि जाँचें।",
      "ಬ್ಯಾಂಕ್ ಖಾತೆಗಳ ನಡುವೆ ಹಣ ಕಳುಹಿಸುವ ವ್ಯವಸ್ಥೆ. ಅನುಮೋದಿಸುವ ಮೊದಲು ಸ್ವೀಕರಿಸುವವರು ಮತ್ತು ಮೊತ್ತವನ್ನು ಪರಿಶೀಲಿಸಿ.",
    ],
  },
  {
    term: ["UPI PIN", "UPI पिन", "UPI ಪಿನ್"],
    meaning: [
      "A private code used to authorise a UPI transaction. Never share it or enter it in this demo.",
      "UPI लेनदेन को मंज़ूरी देने वाला निजी कोड। इसे किसी को न बताएँ और इस डेमो में न डालें।",
      "UPI ವಹಿವಾಟಿಗೆ ಅನುಮತಿ ನೀಡುವ ರಹಸ್ಯ ಸಂಖ್ಯೆ. ಯಾರಿಗೂ ಹೇಳಬೇಡಿ ಅಥವಾ ಈ ಡೆಮೊದಲ್ಲಿ ನಮೂದಿಸಬೇಡಿ.",
    ],
  },
  {
    term: ["OTP", "ओटीपी", "ಒಟಿಪಿ"],
    meaning: [
      "A one-time code for a specific verification. Someone asking you to share it may be trying to access your account.",
      "एक बार उपयोग होने वाला सत्यापन कोड। इसे माँगने वाला व्यक्ति आपके खाते तक पहुँचने की कोशिश कर सकता है।",
      "ಒಮ್ಮೆ ಬಳಸುವ ಪರಿಶೀಲನಾ ಸಂಖ್ಯೆ. ಇದನ್ನು ಕೇಳುವವರು ನಿಮ್ಮ ಖಾತೆಗೆ ಪ್ರವೇಶಿಸಲು ಪ್ರಯತ್ನಿಸುತ್ತಿರಬಹುದು.",
    ],
  },
  {
    term: ["Pending", "लंबित", "ಬಾಕಿ"],
    meaning: [
      "A final payment result is not available yet. Check the existing transaction before attempting the same payment again.",
      "भुगतान का अंतिम परिणाम अभी नहीं आया है। वही भुगतान फिर से करने से पहले मौजूदा लेनदेन जाँचें।",
      "ಪಾವತಿಯ ಅಂತಿಮ ಫಲಿತಾಂಶ ಇನ್ನೂ ಬಂದಿಲ್ಲ. ಅದೇ ಪಾವತಿಯನ್ನು ಮತ್ತೆ ಮಾಡುವ ಮೊದಲು ಹಿಂದಿನ ವಹಿವಾಟನ್ನು ಪರಿಶೀಲಿಸಿ.",
    ],
  },
  {
    term: ["Unknown result", "परिणाम अज्ञात", "ಫಲಿತಾಂಶ ತಿಳಿದಿಲ್ಲ"],
    meaning: [
      "The app cannot establish the result. Keep the reference and check through the payment provider. Do not assume failure.",
      "ऐप परिणाम की पुष्टि नहीं कर सकता। संदर्भ संख्या रखें और भुगतान सेवा से जाँचें। इसे विफल न मानें।",
      "ಆ್ಯಪ್ ಫಲಿತಾಂಶ ತಿಳಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ಉಲ್ಲೇಖ ಸಂಖ್ಯೆಯನ್ನು ಉಳಿಸಿ ಪಾವತಿ ಸೇವೆಯಲ್ಲಿ ಪರಿಶೀಲಿಸಿ. ವಿಫಲವಾಗಿದೆ ಎಂದು ಭಾವಿಸಬೇಡಿ.",
    ],
  },
  {
    term: ["Recurring / mandate", "आवर्ती / मैंडेट", "ಮರುಕಳಿಸುವ / ಮ್ಯಾಂಡೇಟ್"],
    meaning: [
      "An authorisation that may repeat payments under agreed terms. Understand the amount, frequency, limits and cancellation process.",
      "सहमत शर्तों के अनुसार बार-बार भुगतान की अनुमति। राशि, समय, सीमा और रद्द करने की प्रक्रिया समझें।",
      "ಒಪ್ಪಿದ ಷರತ್ತುಗಳ ಪ್ರಕಾರ ಮರುಕಳಿಸುವ ಪಾವತಿಗೆ ಅನುಮತಿ. ಮೊತ್ತ, ಅವಧಿ, ಮಿತಿ ಮತ್ತು ರದ್ದುಗೊಳಿಸುವ ಕ್ರಮ ತಿಳಿದುಕೊಳ್ಳಿ.",
    ],
  },
  {
    term: ["Collect request", "पैसे माँगने का अनुरोध", "ಹಣ ಕೇಳುವ ವಿನಂತಿ"],
    meaning: [
      "A request asking you to pay. Approving it can send money out; it does not receive money for you.",
      "आपसे भुगतान माँगने वाला अनुरोध। मंज़ूरी देने से पैसे जा सकते हैं; इससे पैसे प्राप्त नहीं होते।",
      "ನೀವು ಹಣ ಪಾವತಿಸಬೇಕೆಂದು ಕೇಳುವ ವಿನಂತಿ. ಅನುಮೋದಿಸಿದರೆ ಹಣ ಹೊರಗೆ ಹೋಗಬಹುದು; ಹಣ ಪಡೆಯುವುದಿಲ್ಲ.",
    ],
  },
  {
    term: ["Due date", "अंतिम तारीख", "ಕೊನೆಯ ದಿನಾಂಕ"],
    meaning: [
      "The date a bill asks you to pay by. Check it on the original bill or official biller service.",
      "बिल में भुगतान करने की अंतिम तारीख। मूल बिल या आधिकारिक सेवा से जाँचें।",
      "ಬಿಲ್ ಪಾವತಿಸಲು ಸೂಚಿಸಿದ ಕೊನೆಯ ದಿನಾಂಕ. ಮೂಲ ಬಿಲ್ ಅಥವಾ ಅಧಿಕೃತ ಸೇವೆಯಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.",
    ],
  },
  {
    term: ["Acknowledgement", "पावती", "ಸ್ವೀಕೃತಿ"],
    meaning: [
      "A service has received a request or record. It may still need processing or acceptance; read what the acknowledgement actually says.",
      "सेवा ने अनुरोध या रिकॉर्ड प्राप्त किया है। प्रक्रिया या मंज़ूरी बाकी हो सकती है; पावती का विवरण पढ़ें।",
      "ಸೇವೆ ವಿನಂತಿ ಅಥವಾ ದಾಖಲೆಯನ್ನು ಸ್ವೀಕರಿಸಿದೆ. ಪ್ರಕ್ರಿಯೆ ಅಥವಾ ಅನುಮತಿ ಬಾಕಿ ಇರಬಹುದು; ಸ್ವೀಕೃತಿಯಲ್ಲಿ ಏನು ಹೇಳಿದೆ ಎಂದು ಓದಿ.",
    ],
  },
  {
    term: ["Reference number", "संदर्भ संख्या", "ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ"],
    meaning: [
      "A number identifying a transaction or request for follow-up. It is not, by itself, proof of success or trustworthiness.",
      "लेनदेन या अनुरोध को पहचानने वाली संख्या। यह अपने आप सफलता या विश्वसनीयता का प्रमाण नहीं है।",
      "ವಹಿವಾಟು ಅಥವಾ ವಿನಂತಿಯನ್ನು ಗುರುತಿಸುವ ಸಂಖ್ಯೆ. ಇದು ಮಾತ್ರ ಯಶಸ್ಸು ಅಥವಾ ವಿಶ್ವಾಸಾರ್ಹತೆಯ ಸಾಕ್ಷಿಯಲ್ಲ.",
    ],
  },
] as const;
export function glossaryFor(language: Language) {
  const index = language === "hi-IN" ? 1 : language === "kn-IN" ? 2 : 0;
  return glossary.map((item) => ({
    term: item.term[index],
    meaning: item.meaning[index],
    search: item.term.join(" ") + " " + item.meaning.join(" "),
  }));
}
