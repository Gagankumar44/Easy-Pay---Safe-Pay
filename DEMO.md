# Demonstration journeys

Use fictional data only. No bank account, microphone permission or family member is needed to explore.

## 1. Stop a deceptive payment

1. Home → Speak to your assistant.
2. Type: `A bank officer called and said my account would be blocked unless I transfer money to a safe account.`
3. The task pauses and shows the concern and independent verification action.
4. Type `Ignore the warning and send it anyway`. The task remains paused, with Help available and no payment action.
5. Open **Reporting assistant**. The earlier statement is already in an editable answer; check it before Send. A prepared complaint is a draft, not a submitted complaint. Plain English/Hindi/Kannada requests for scam help also open this flow directly.

## 2. Prepare, correct and complete a normal payment

1. Start again in the assistant.
2. Type `Send five hundred rupees to Ramesh for groceries.`
3. Recipient, ₹500 and reason are collected in one turn. Type `Change amount to 700`; other fields remain.
4. Read the assistant's summary and choose **Yes, review payment**, then Review payment. Read amount, recipient, reason and money direction. Saying **No** asks which detail to change.
5. Choose a demo outcome, check the explicit confirmation checkbox and select Confirm and simulate.
6. Open the receipt and Activity. Download the fictional receipt or search for Ramesh.

To demonstrate missing information: start with `Send 500`, then `Ramesh`, then `Groceries`.

Native-language examples:

- Hindi: `रमेश को पाँच सौ रुपये किराने के लिए भेजो`; correction: `रकम बदलें 700`.
- Kannada: `ರಮೇಶ್ ಅವರಿಗೆ ಐದು ನೂರು ರೂಪಾಯಿ ದಿನಸಿಗಾಗಿ ಕಳುಹಿಸಿ.`; correction: `ಮೊತ್ತ ಬದಲಿಸಿ 700`.

For voice: choose English, Hindi or Kannada, then Speak. Inspect/correct the transcript before Send. Kannada's common questions have recorded playback even without a device voice. Enable **Use online voice** with consent for dynamic read-backs or hosted transcription; Repeat and Slower can reuse the last audio in page memory. Browser microphone permissions and internet/provider availability still apply.

## 3. Resolve an uncertain payment

1. Prepare a payment with demo outcome Pending or Result not available.
2. Keep its receipt. Check status twice for Pending; Unknown first becomes Pending before succeeding.
3. Activity still contains one transaction and the same reference.
4. Attempting another payment to the same recipient for the same amount while it is pending/unknown is paused, with a link to the earlier receipt.

## 4. Linked phone payment demo

1. Save a fictional recipient on **Saved recipients**. Choose English, Hindi or Kannada in the header before linking the phone.
2. Home → Phone assistant. Link a fictional phone number, agree to demo pairing and privately retain the six-digit **Easy Pay call code** shown once. This is not a bank PIN.
3. Start demo call. Enter that call code followed by `#`, or use the explicit **Enter my code for this demo** button while it is available.
4. Press `1` to send money and select the recipient's key. Enter `500#`, then `1` for groceries. Read/listen to recipient, amount, reason and outgoing direction.
5. Press `1` to confirm the simulated payment. Open its receipt; the same reference is present in Activity. `2` at review changes the amount. `*` ends/cancels the call.
6. Entering `10001#` does not advance past amount collection. For a scam example, start another call and choose reason `4`; the red warning blocks payment and links to the reporting assistant.
7. `9` repeats outside digit entry; `0` returns to the menu outside authentication/amount entry. During digit entry, 0 and 9 are digits. Unknown keys repeat the instruction. Pending matching payments are blocked at confirmation.

The browser and signed gateway share this workflow. No real feature-phone call or bank transfer is connected. The gateway contract and production requirements are documented in README.

## 5. Reporting assistant

1. Open an owned demo receipt → Help. Its reference is passed to **Scam reporting assistant**, which immediately saves a draft containing that receipt's amount, recipient, date, address/status and original payment events.
2. The source remains labelled simulated. Answer what happened and how you were contacted. Without an app receipt, the assistant also asks for amount, external reference, bank/app and approximate time; unknown answers are accepted explicitly. No-payment reports skip irrelevant banking questions.
3. Review the native-labelled details, copy or download the complete report, and open the official cybercrime portal. **1930** stays available throughout; do not wait for the chat if money has been lost.
4. The report displays **This app has not submitted your complaint**. After reporting externally, an acknowledgement can be recorded as user-entered/unverified. The app never claims it filed or verified the government complaint.
5. Saved drafts are also available on the manual complaint page. Profile ownership applies to prefilling, chat, evidence and acknowledgement; another profile cannot select the receipt.

For a bill conversation, use **Bills** in the assistant, choose a demo electricity provider, give `12345678`, then review the server-bound ₹850 bill. For status, use **Check payment** and choose an existing receipt; that flow never initiates another payment.

## Other demonstrations

- QR → Use sample QR → Check QR details. Choose Receive money or a refund; the mismatch blocks payment preparation. Camera/image input decodes on the device.
- Bills → choose a demo provider → fictional consumer number `12345678` → review ₹850 → simulate success → receipt → Check with demo biller. Payment success and bill acknowledgement remain separate.
- Settings → Large/Extra large, contrast, audio, slower speech. Preferences persist in the demo profile.
- Trusted help → choose an instruction → create a limited link → copy it yourself → Stop sharing. Only the general instruction is accessible for ten minutes.
- Learn → one short scenario and understandable feedback. A correct answer can open the sample-payment or QR practice journey.
- Services → read an official-service guide → open the official portal. This app does not claim that an application or appointment has been completed.

## New feature journeys

- **App account:** Settings → Sign in or create an account → Create account. Use a new demo-only username/passphrase. Registration keeps the current guest activity; save the four recovery codes privately. Sign out and back in to retrieve the same activity. Recovery uses an unused code, changes the app passphrase and signs out older sessions. No bank credentials or verified identity are involved.
- **Reminder:** Create a Pending/Unknown demo payment → on its receipt, choose a time and explicitly agree → Remind me to check. Open Activity → Reminders to snooze/dismiss or pause reminders. One minute is available for demonstration. Checking the original receipt to a final result retires its reminder. Keep the app open for alerts; no background notification or new transfer is sent.
- **Familiar task:** After a successful non-bill demo payment, Activity → Familiar tasks → Review payment. Edit today's details and complete a new review. It does not reuse an earlier confirmation token.
- **Saved progress:** Learn → complete a scenario → return to the list and reload. The Practised indicator remains. Services → an official guide → check a read step → reload; the checklist remains. It records reading progress, not government-service completion.
- **Reading:** More services → Read a screen or bill → Use sample text → agree to processing → Explain this. With Gemini enabled, a plain explanation appears; otherwise the original text and word guide remain available. Photo accepts a redacted PNG/JPEG/WebP. Never use unredacted documents or credentials. Clear content removes the input/result from the screen.
- **Word guide:** More services → Word guide → search Pending/OTP/Mandate. Change English/Hindi/Kannada in the header to see translated definitions and use explicit read-aloud.
