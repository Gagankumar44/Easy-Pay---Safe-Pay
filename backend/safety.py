"""Explainable rules control advancement; AI cannot override them."""
import re
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse, parse_qs

RULES = [
    ("safe_account", "strong_warning", r"safe account|protect.*(?:transfer|money)|सुरक्षित खात|ಸುರಕ್ಷಿತ ಖಾತ",
     "You were asked to move money to protect it.", "Stop and contact your bank using its official app or a number you already know."),
    ("authority", "strong_warning", r"digital arrest|डिजिटल अरेस्ट|ಡಿಜಿಟಲ್ ಅರೆಸ್ಟ್|(?:bank|police|officer|cbi|बैंक|पुलिस|ಬ್ಯಾಂಕ್|ಪೊಲೀಸ್).*(?:block|arrest|transfer|send|भेज|ಹಣ|कॉल)|(?:arrest|account blocked).*(?:pay|money)",
     "An authority claim or threat is linked to a payment.", "Pause. Independently contact the organisation through its official channel."),
    ("receive_payment", "strong_warning", r"(?:pay|send|transfer|scan|pin|पिन|भेज|ಪಿನ್|ಕಳುಹಿ).*(?:receive|refund|cashback|रिफंड|वापस|ಪಡೆಯ|ಮರುಪಾವತಿ)|(?:refund|receive|रिफंड|ಮರುಪಾವತಿ).*(?:pin|pay first|scan|ಪಿನ್)",
     "An outgoing payment or PIN request is being described as receiving money.", "Do not approve an outgoing payment to receive a refund. Verify with the sender independently."),
    ("secrets", "strong_warning", r"(?:share|tell|give|send|बताओ|साझा|ಹೇಳಿ|ಹಂಚಿ).*(?:otp|pin|password|ओटीपी|ಪಿನ್|ಒಟಿಪಿ)|(?:otp|pin|password).*(?:share|tell|asked|request)",
     "Someone is requesting a financial secret.", "Never share an OTP, password or UPI PIN. Contact official support."),
    ("remote_access", "strong_warning", r"remote access|screen.?shar|anydesk|teamviewer|स्क्रीन शेयर|ಪರದೆ ಹಂಚ",
     "Someone is requesting access to your screen or device.", "Stop the session and contact your bank independently before making a payment."),
    ("advance_fee", "strong_warning", r"(?:prize|lottery|reward|इनाम|ಲಾಟರಿ).*(?:pay|fee|deposit|भेज)|(?:pay|fee).*(?:prize|lottery)|guaranteed.*(?:return|profit)|double your money",
     "A reward or guaranteed return requires money first.", "Do not send an advance fee. Check the organisation independently."),
    ("family_emergency", "needs_clarification", r"(?:son|daughter|family|grandson|बेट|ಮಗ).*(?:urgent|emergency|new number|hospital)|(?:urgent|emergency).*(?:family|son|daughter)",
     "An urgent family request needs an identity check.", "Call your family member on a previously saved number before continuing."),
    ("urgency", "needs_clarification", r"unknown caller|urgent|immediately|right now|lottery|prize|तुरंत|ಅವಸರ",
     "The request contains pressure or an unfamiliar caller.", "Take time to verify the recipient and reason through a known contact."),
]


def assess(text, frequency="one_time", direction="outgoing"):
    signals = []
    for code, level, pattern, noticed, action in RULES:
        if re.search(pattern, text.casefold()):
            signals.append({"code": code, "level": level, "noticed": noticed, "action": action})
    if direction != "outgoing":
        signals.append({"code": "direction", "level": "strong_warning", "noticed": "This flow sends money, but your intention is to receive it.", "action": "Cancel this payment and confirm the direction."})
    if frequency == "recurring":
        signals.append({"code": "recurring", "level": "needs_clarification", "noticed": "This authorisation repeats over time.", "action": "Use a supported mandate service and review frequency and cancellation terms."})
    if text.strip().casefold() in {"", "unknown", "don't know", "not sure", "पता नहीं", "ಗೊತ್ತಿಲ್ಲ"}:
        signals.append({"code": "purpose", "level": "needs_clarification", "noticed": "The payment reason is unclear.", "action": "Explain what this payment is for before continuing."})
    level = "strong_warning" if any(s["level"] == "strong_warning" for s in signals) else "needs_clarification" if signals else "no_signals"
    return {"risk_level": level, "signals": signals, "reasons": [s["noticed"] for s in signals],
            "message": "Payment paused. Verify the request independently." if signals else "No listed warning signs found. This does not verify the recipient or guarantee safety.",
            "paused": bool(signals)}


def parse_upi(raw):
    if len(raw) > 2048:
        raise ValueError("QR contents are too long.")
    uri = urlparse(raw.strip())
    if uri.scheme.casefold() != "upi" or uri.netloc.casefold() != "pay" or uri.path not in {"", "/"}:
        raise ValueError("Use a UPI payment QR. External links are not opened.")
    values = parse_qs(uri.query, keep_blank_values=True)
    if any(len(v) != 1 for v in values.values()):
        raise ValueError("QR has conflicting or repeated fields.")
    get = lambda key: values.get(key, [""])[0].strip()
    address = get("pa")
    if not re.fullmatch(r"[a-zA-Z0-9._-]{2,128}@[a-zA-Z0-9.-]{2,64}", address):
        raise ValueError("QR contains an invalid UPI address.")
    if get("cu") and get("cu").upper() != "INR":
        raise ValueError("Only rupee payments are supported.")
    if any(key in values for key in ("mode", "recur", "mandate", "validitystart", "validityend")):
        raise ValueError("Recurring or special payment instructions need a supported provider.")
    amount = None
    if get("am"):
        try:
            value = Decimal(get("am"))
            if not value.is_finite() or not 0 < value <= 100000 or value.as_tuple().exponent < -2:
                raise ValueError()
            amount = f"{value:.2f}"
        except (InvalidOperation, ValueError):
            raise ValueError("QR amount must be between ₹0.01 and ₹1,00,000 with at most two decimal places.")
    return {"recipient": (get("pn") or address)[:80], "upi_id": address, "amount": amount,
            "purpose": get("tn")[:250], "direction": "outgoing", "identity_verified": False,
            "message": "This QR prepares an outgoing payment. A valid format does not prove the recipient is trustworthy."}
