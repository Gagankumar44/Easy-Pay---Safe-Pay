export const guides = [
  {
    id: "pension",
    title: "Pension & life certificate",
    description: "Find Jeevan Pramaan and understand the next steps.",
    icon: "bill",
    url: "https://jeevanpramaan.gov.in/",
    source: "Jeevan Pramaan · Government of India",
    steps: [
      "Check with your pension authority that Jeevan Pramaan is supported for your pension.",
      "Use the official portal to find an authorised centre or the current supported method. Follow its instructions for the information and identity checks it requires.",
      "After generating a certificate, keep the Pramaan ID and acknowledgement.",
      "Check acceptance with your pension disbursing authority. A generated certificate is subject to their approval.",
    ],
    note: "This guide does not collect identity numbers or generate a certificate.",
    reference: "https://jeevanpramaan.gov.in/v2.0/misc/faq",
  },
  {
    id: "documents",
    title: "Your digital documents",
    description: "Access and share documents through DigiLocker.",
    icon: "book",
    url: "https://www.digilocker.gov.in/",
    source: "DigiLocker · Government of India",
    steps: [
      "Open the official DigiLocker portal and follow its registration or sign-in steps.",
      "Find the issuing organisation and fetch the document you need.",
      "Check the document details before sharing it.",
      "Use DigiLocker’s own sharing controls for a specific purpose and recipient.",
    ],
    note: "Sign-in and document sharing happen only on the official service.",
    reference: "https://www.digilocker.gov.in/",
  },
  {
    id: "health",
    title: "Hospital appointments",
    description: "Find a participating hospital through the official portal.",
    icon: "users",
    url: "https://ors.gov.in/",
    source: "Online Registration System · Government of India",
    steps: [
      "Open the official Online Registration System and choose Book Appointment.",
      "Choose an available hospital, department and date. Availability depends on the hospital.",
      "Follow the official portal’s identity and booking steps.",
      "Keep the booking acknowledgement and check the hospital’s instructions before visiting.",
    ],
    note: "This app provides navigation, not medical advice or a confirmed appointment.",
    reference: "https://ors.nic.in/faq.html",
  },
] as const;

const hindi = [
  {
    title: "पेंशन और जीवन प्रमाण",
    description: "जीवन प्रमाण के अगले कदम समझें।",
    steps: [
      "अपने पेंशन कार्यालय से जाँचें कि आपकी पेंशन के लिए जीवन प्रमाण मान्य है।",
      "आधिकारिक पोर्टल पर अधिकृत केंद्र या समर्थित तरीका खोजें। पहचान और जानकारी की प्रक्रिया वहीं पूरी करें।",
      "प्रमाणपत्र बनने पर प्रमाण आईडी और स्वीकृति संभालकर रखें।",
      "पेंशन देने वाली संस्था से स्वीकृति जाँचें। प्रमाणपत्र बनना और उसका स्वीकार होना अलग हैं।",
    ],
    note: "यह मार्गदर्शिका पहचान नंबर नहीं लेती और प्रमाणपत्र नहीं बनाती।",
  },
  {
    title: "आपके डिजिटल दस्तावेज़",
    description: "DigiLocker पर दस्तावेज़ ढूँढें और साझा करें।",
    steps: [
      "आधिकारिक DigiLocker पोर्टल खोलें और पंजीकरण या साइन इन करें।",
      "दस्तावेज़ जारी करने वाली संस्था चुनें और ज़रूरी दस्तावेज़ प्राप्त करें।",
      "साझा करने से पहले दस्तावेज़ के विवरण जाँचें।",
      "खास काम और व्यक्ति के लिए DigiLocker के अपने साझाकरण विकल्प इस्तेमाल करें।",
    ],
    note: "साइन इन और दस्तावेज़ साझा करना आधिकारिक सेवा पर होता है।",
  },
  {
    title: "अस्पताल की अपॉइंटमेंट",
    description: "आधिकारिक पोर्टल पर उपलब्ध अस्पताल खोजें।",
    steps: [
      "आधिकारिक Online Registration System खोलें और अपॉइंटमेंट बुक करने का विकल्प चुनें।",
      "उपलब्ध अस्पताल, विभाग और तारीख चुनें। उपलब्धता अस्पताल पर निर्भर है।",
      "आधिकारिक पोर्टल की पहचान और बुकिंग प्रक्रिया पूरी करें।",
      "बुकिंग की स्वीकृति रखें और जाने से पहले अस्पताल के निर्देश जाँचें।",
    ],
    note: "यह ऐप रास्ता दिखाती है। यह चिकित्सकीय सलाह या पक्की अपॉइंटमेंट नहीं है।",
  },
];
const kannada = [
  {
    title: "ಪಿಂಚಣಿ ಮತ್ತು ಜೀವಿತ ಪ್ರಮಾಣ",
    description: "ಜೀವನ್ ಪ್ರಮಾಣ್‌ನ ಮುಂದಿನ ಹಂತ ತಿಳಿಯಿರಿ.",
    steps: [
      "ನಿಮ್ಮ ಪಿಂಚಣಿಗೆ ಜೀವನ್ ಪ್ರಮಾಣ್ ಮಾನ್ಯವೇ ಎಂದು ಪಿಂಚಣಿ ಕಚೇರಿಯಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.",
      "ಅಧಿಕೃತ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಮಾನ್ಯ ಕೇಂದ್ರ ಅಥವಾ ಬೆಂಬಲಿತ ವಿಧಾನ ಹುಡುಕಿ. ಗುರುತು ಮತ್ತು ಮಾಹಿತಿಯ ಪ್ರಕ್ರಿಯೆಯನ್ನು ಅಲ್ಲಿಯೇ ಪೂರ್ಣಗೊಳಿಸಿ.",
      "ಪ್ರಮಾಣಪತ್ರ ಸಿದ್ಧವಾದ ಮೇಲೆ ಪ್ರಮಾಣ್ ಐಡಿ ಮತ್ತು ಸ್ವೀಕೃತಿ ಉಳಿಸಿ.",
      "ಪಿಂಚಣಿ ನೀಡುವ ಸಂಸ್ಥೆಯೊಂದಿಗೆ ಸ್ವೀಕೃತಿ ಪರಿಶೀಲಿಸಿ. ಪ್ರಮಾಣಪತ್ರ ಸಿದ್ಧವಾಗುವುದು ಮತ್ತು ಅಂಗೀಕಾರ ಬೇರೆ ಹಂತಗಳು.",
    ],
    note: "ಈ ಮಾರ್ಗದರ್ಶಿ ಗುರುತು ಸಂಖ್ಯೆ ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ ಅಥವಾ ಪ್ರಮಾಣಪತ್ರ ನೀಡುವುದಿಲ್ಲ.",
  },
  {
    title: "ನಿಮ್ಮ ಡಿಜಿಟಲ್ ದಾಖಲೆಗಳು",
    description: "DigiLocker ನಲ್ಲಿ ದಾಖಲೆ ಹುಡುಕಿ ಮತ್ತು ಹಂಚಿ.",
    steps: [
      "ಅಧಿಕೃತ DigiLocker ತೆರೆಯಿರಿ. ನೋಂದಣಿ ಅಥವಾ ಪ್ರವೇಶದ ಹಂತ ಅನುಸರಿಸಿ.",
      "ದಾಖಲೆ ನೀಡಿದ ಸಂಸ್ಥೆ ಆರಿಸಿ ಬೇಕಾದ ದಾಖಲೆ ಪಡೆಯಿರಿ.",
      "ಹಂಚುವ ಮೊದಲು ದಾಖಲೆಯ ವಿವರ ಪರಿಶೀಲಿಸಿ.",
      "ನಿರ್ದಿಷ್ಟ ಉದ್ದೇಶ ಮತ್ತು ವ್ಯಕ್ತಿಗಾಗಿ DigiLocker ನ ಹಂಚಿಕೆ ಆಯ್ಕೆಗಳನ್ನು ಬಳಸಿ.",
    ],
    note: "ಪ್ರವೇಶ ಮತ್ತು ದಾಖಲೆ ಹಂಚಿಕೆ ಅಧಿಕೃತ ಸೇವೆಯಲ್ಲಿ ಮಾತ್ರ ನಡೆಯುತ್ತದೆ.",
  },
  {
    title: "ಆಸ್ಪತ್ರೆ ಭೇಟಿಯ ಸಮಯ",
    description: "ಅಧಿಕೃತ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಲಭ್ಯ ಆಸ್ಪತ್ರೆ ಹುಡುಕಿ.",
    steps: [
      "ಅಧಿಕೃತ Online Registration System ತೆರೆದು ಭೇಟಿ ಕಾಯ್ದಿರಿಸುವ ಆಯ್ಕೆ ಆರಿಸಿ.",
      "ಲಭ್ಯ ಆಸ್ಪತ್ರೆ, ವಿಭಾಗ ಮತ್ತು ದಿನಾಂಕ ಆರಿಸಿ. ಲಭ್ಯತೆ ಆಸ್ಪತ್ರೆಯನ್ನು ಅವಲಂಬಿಸಿದೆ.",
      "ಅಧಿಕೃತ ಪೋರ್ಟಲ್‌ನ ಗುರುತು ಮತ್ತು ಕಾಯ್ದಿರಿಸುವ ಹಂತ ಪೂರ್ಣಗೊಳಿಸಿ.",
      "ಕಾಯ್ದಿರಿಸಿದ ಸ್ವೀಕೃತಿ ಉಳಿಸಿ. ಹೋಗುವ ಮೊದಲು ಆಸ್ಪತ್ರೆಯ ಸೂಚನೆ ಪರಿಶೀಲಿಸಿ.",
    ],
    note: "ಈ ಆ್ಯಪ್ ದಾರಿ ತೋರಿಸುತ್ತದೆ. ಇದು ವೈದ್ಯಕೀಯ ಸಲಹೆ ಅಥವಾ ಖಚಿತ ಭೇಟಿಯ ಸಮಯವಲ್ಲ.",
  },
];
export function guidesFor(language: import("./api").Language) {
  return guides.map((guide, index) => ({
    ...guide,
    ...(language === "hi-IN"
      ? hindi[index]
      : language === "kn-IN"
        ? kannada[index]
        : {}),
    source: guide.source.replace(
      "Government of India",
      language === "hi-IN"
        ? "भारत सरकार"
        : language === "kn-IN"
          ? "ಭಾರತ ಸರ್ಕಾರ"
          : "Government of India",
    ),
  }));
}
