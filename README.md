# Easy Pay — Safe Pay

**[▶ Watch the demo video](https://drive.google.com/file/d/1_WbXcZiroIDpUTdkGXjmSojt1IstFrZn/view?usp=sharing)**

A local hackathon prototype for understandable payments and fraud support. Bills and payments are fictional; app accounts provide local access to practice activity. This version extends the original Next.js + FastAPI project with a neutral interface, one green action colour and warning colours only for meaningful states.

## Run locally

After installing the dependencies below, start and check both services together from the project directory:

```powershell
.\Start-EasyPay.ps1
```

This keeps the API on 8001 and the website on 3000 running in the background, with logs in `backend/data`. It checks the API through the website proxy before reporting readiness. Existing services are reused. The two-terminal development option remains available below.

Keep these two terminals running from the project directory:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run_dev.py
```

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:3000**. Easy Pay uses **8001**; the unrelated API on 8000 is not used. The frontend proxies `/backend/*` to FastAPI, so the browser does not need a hardcoded backend IP. Set `API_BASE_URL` in `frontend/.env.local` before starting/building when the backend is elsewhere.

The development launcher excludes test and local probe files from reload watching so they do not interrupt voice playback. For a stable API without reload, run `python -m uvicorn main:app --host 127.0.0.1 --port 8001` in the backend environment.

For a fresh checkout, first create the backend virtual environment with `python -m venv .venv` in `backend`. For a local production preview, use `npm run build` then `npm run start` in `frontend`; `npm run start -- --port 3002` uses another port. Add `http://localhost:3002` to the backend's `FRONTEND_ORIGINS` and restart it to use forms on that alternate port. The start helper prepares the standalone server's public/static assets. Docker copies those assets at image-build time.

Existing `backend/.env` credentials are preserved. A backend-only `GEMINI_API_KEY` enables optional structured interpretation; the existing `GEMINI_MODEL` is respected. Set `GEMINI_ENABLED=0` for the deterministic offline-AI demo. Gemini has a configurable transport timeout up to twelve seconds (`GEMINI_TIMEOUT_MS`) and one attempt, within the frontend's twenty-second request deadline; failures fall back to the controlled local workflow. Simple known requests use the fast deterministic path. No AI output can authorise a payment or declare settlement.

## Implemented

- A focused conversation UI with persisted 30-minute tasks, one current question, English/Hindi/Kannada and mixed-language extraction, amounts in words, corrections and cancellation. The assistant reads back the recipient, amount and reason and asks whether it understood correctly before payment review. Speech transcripts require explicit Send.
- Task-specific bill-provider/consumer collection, server-bound bill review, saved-recipient choices and owned receipt selection for payment-status requests. Unknown requests offer specific tasks; saying the read-back is wrong asks which detail needs changing.
- Automatic spoken questions across the main, reporting and browser phone assistants. A compact voice bar offers Pause/Turn voice on; Voice options contains Repeat and Slow/Comfortable/Normal pace. Pause persists across assistants in the current tab. Typing or microphone input stops playback; hidden pages stop speech/capture. Browser autoplay blocks expose Start voice. Push-to-talk and editable transcripts still require explicit Send. Ten public Kannada question clips work without an installed Kannada voice. Consented online voice supports dynamic replies and transcription through the existing Gemini provider, with bounded requests and no saved private audio. Native voices match the selected language.
- Explainable contextual fraud rules, payment-direction checks, recurring-payment interruption and warnings that cannot be cleared by relabelling the same task.
- Shared payment review with explicit amount/recipient/direction confirmation, draft revisions, five-minute confirmation expiry and cancellation.
- SQLite persistence, opaque HttpOnly device sessions, record ownership, durable request idempotency, unresolved-payment duplicate protection and an event timeline.
- Distinct simulated success, failure, pending and unknown results. Status checks update the original record. In the deterministic mock, pending resolves on the second check; unknown first becomes pending.
- Searchable/filterable activity, receipt details and downloadable text receipts.
- On-device QR image/camera decoding, pasted UPI URI checks, malformed/unsupported data rejection, recipient/amount/direction comparisons and a learning mode. A QR never verifies identity or starts a transfer.
- A fictional electricity bill lookup and shared review, with a separate demo biller acknowledgement after mock-provider success.
- A separate reporting assistant with immediate 1930/official-portal links. Selecting a receipt automatically pre-fills and saves owned transaction details and the event timeline. A scam conversation carries earlier words into an editable answer, without treating a planned amount as a loss. The assistant asks for missing facts, bank/app and external reference; reports can be copied/downloaded. User-entered official acknowledgement numbers remain explicitly unverified. All reports remain drafts unless completed on the official portal.
- A linked English/Hindi/Kannada phone assistant: one-time demo pairing, a hashed app-only call code, saved recipients, digit entry, a ₹10,000 limit, read-back, cancellation, scam interruption, shared payment receipts and duplicate protection. The signed IVR gateway accepts provider call events; the browser uses the same workflow. Calls and payments are simulated.
- Trusted calling contacts with undo after removal, a four-step control practice, shorter task screens and red danger panels with explicit actions. Amber panels distinguish checks requiring clarification.
- Limited ten-minute help links containing a fixed general instruction, expiry and owner revocation. Helpers cannot see payment details or control the app.
- Saved unverified recipients; seven short practice lessons; official pension, DigiLocker and appointment navigation guides.
- Onboarding and stored text-size, contrast, language, interaction and audio preferences; keyboard focus styles, labels, large controls and reduced-motion handling.
- Profile data export/deletion, explicit demo boundaries and a production service worker caching public recovery guidance, icons and the ten public Kannada clips. API responses, receipts and private pages are never cached.
- Local username/passphrase accounts, guest activity adoption at registration, sign-in/out and four one-use recovery codes. Scrypt password hashes, rotated HttpOnly sessions, persisted failed-attempt limits and recovery that revokes older sessions. These accounts do not verify a person or bank account.
- Opt-in reminders for existing pending/unknown payments, with scheduling, snooze, dismiss, pause and retirement when a final result is recorded. Alerts appear while the app is open; no push, email, SMS or automatic payment.
- Familiar tasks from recent successful demo payments. Selecting one fills a new editable form and requires fresh review/confirmation; bills must be fetched again.
- Owned, persistent service checklist and practice completion, with no quiz scores.
- Consent-based text and screenshot/photo reading. PNG/JPEG/WebP inputs are bounded to 5 MB/12 megapixels, validated, stripped of metadata and handled in memory. Optional Gemini explanations are schema constrained; text has an original-text fallback when AI fails. Images never create a payment draft.
- An English/Hindi/Kannada word guide with search and read-aloud. Reminder and reading controls support all three languages.

Core conversations, review labels, keypad prompts and public-service guides support the three languages. Practice lesson prose and some supporting account/manual-report screens still use English.

The latest refinement adds owned fictional Akash, Suraj and Gowtham payment contacts with Hindi/Kannada aliases, editable mobile/UPI destinations, direct assistant/bill handoff into shared review, restored payment forms, distinct microphone/typing panels and red/amber/green payment states. See [WORKFLOW_MAP.md](WORKFLOW_MAP.md) for the route and logic map, and [UX_AUDIT.md](UX_AUDIT.md) for resolved and remaining usability problems.

## Storage and privacy

The default database is `backend/data/demo.sqlite3`, ignored along with `.env` and the virtual environment. Override its location with `EASY_PAY_DB`. Guest profiles and sign-in sessions expire after seven days. Account profiles expire 90 days after the last successful registration/sign-in/recovery; cleanup runs when a profile is opened. Conversation sessions expire after 30 minutes. New tables are created without deleting existing records. The database can survive a backend restart. Use SQLite's backup API for a consistent backup of a running database; copying only the main file while WAL writes are active is insufficient.

The demo does not store microphone recordings, QR images or reading uploads/outputs. The browser's speech-recognition service may process microphone audio. Typed conversation context and incident notes are stored for the fictional demo workflow. Reading sends consented content to the backend and, when enabled, Gemini; Google processes the request under the configured API terms. Use fictional or redacted inputs, without credentials, identity documents or full account numbers. Reading inputs are never appended to conversation history.

Local accounts require an app-only passphrase of 15–128 characters. They use salted scrypt (N=32768, r=8, p=3); passwords and recovery codes are not stored in plaintext or echoed in validation errors. Five failed attempts per IP/username or twenty per IP trigger a rolling 15-minute limit. Recovery codes reset the app password once and invalidate all older sessions. Keep them privately: there is no email/SMS recovery or identity verification. Sign-in opens the account's records without merging another guest's records. Session tokens stay in HttpOnly cookies, never browser storage.

Use Settings to export your demo records or delete the profile. In a shared environment, each browser session gets separate owned records. Do not enter actual personal or financial information.

## Verification

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

```powershell
cd frontend
npm.cmd run lint
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

See [QA.md](QA.md) for executed checks and their limits, and [DEMO.md](DEMO.md) for demonstration journeys. `gemini_test.py` and `ai_intent.py` are retained as legacy development files; they are not mounted in the new API. Pytest discovers only `test_*.py`, avoiding unintended live Gemini calls.

## Telephone integration interface

Pair a fictional number on `/keypad` and save a recipient on `/recipients`. Pairing shows a six-digit **Easy Pay call code once**; it is separate from a bank PIN. Phone ownership is explicitly unverified in the demo. The code is hashed with salted scrypt, protected by five failed attempts and a five-minute lock. Incomplete authentication digits stay only in process memory. Disconnecting the phone invalidates active calls; profile deletion removes the pairing.

To connect an approved telephony adapter, configure `TELEPHONY_WEBHOOK_SECRET` with at least 32 random characters and send `POST /api/phone/gateway`. Sign the exact JSON bytes with HMAC-SHA256 over `timestamp + '.' + body`, using `X-Call-Timestamp` (Unix seconds) and `X-Call-Signature` (hex). Timestamps must be within five minutes. Payload: `call_id`, UUID `event_id`, `caller` (E.164), `event` (`start`, `key`, `end`), and `key` (one DTMF character). The adapter renders returned `reply` in returned `language` and honours `end_call`. Authentication is required each call; caller ID alone cannot authorise a demo payment. Retries reuse event IDs; payment attempts additionally have durable idempotency.

Use a single API worker for this local SQLite demo. Call serialization and partial DTMF authentication are process-local; deployment needs shared call state, durable event storage and a gateway limiter. A live service also needs verified phone ownership, an actual phone number/carrier, provider speech and a bank/UPI 123PAY partner. The gateway never receives a UPI PIN or bank OTP and always produces mock payments. Setting the signing secret does not connect a telephone network or enable live money movement.

For online speech, set `SPEECH_ENABLED=1` and optionally `GEMINI_TTS_MODEL` (default `gemini-3.8-flash-tts`). The UI asks for online voice consent. Currency amounts are spoken with native rupee/paise units. The most recent playback is reused in page memory for Repeat at the selected pace; it is cleared on unmount or voice-language/consent changes. Public prompt assets can be regenerated with `python generate_prompt_audio.py`; that script sends only public UI words. See [Google's speech documentation](https://ai.google.dev/gemini-api/docs/speech-generation).

See [UX_AUDIT.md](UX_AUDIT.md) for website-wide findings, including localization, narrow-screen large-text reflow and payment/reporting handoffs.

## Remaining external work

This is a functional local prototype, not a completed banking product. Real UPI authorisation/status/callbacks, bank/PSP approval, live billers, Asterisk/SIP/carrier connectivity and verified identity require external integration. Native/online speech paths are implemented, but physical-device and older-adult pronunciation/usability testing and full translation of supporting prose remain. No live transfer, telephone call, bill settlement or government application is implemented. Cyber complaints are prepared and handed off to the official portal; government identity/login steps and authorised submission integration are not connected. The app never marks an automatic government complaint as filed.

Before real-user deployment: integrate verified identity/SSO and managed recovery, PostgreSQL/row-level access if shared, shared rate limiting, HTTPS with `COOKIE_SECURE=1`, exact `FRONTEND_ORIGINS`, monitoring with secret-safe logs, database migration/backup procedures, privacy/retention review, provider callback verification, and usability evaluation. Local credential accounts are implemented, but are not a production identity system. The included Docker configuration is a staging starting point and has not been deployed or container-tested on this Windows machine.

## Guidance sources

- [NPCI UPI FAQ](https://www.npci.org.in/what-we-do/upi/faqs)
- [Ministry of Home Affairs reporting information](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2223095&lang=1&reg=3)
- [National Cybercrime Reporting Portal](https://cybercrime.gov.in/)
- [Jeevan Pramaan FAQ](https://jeevanpramaan.gov.in/v2.0/misc/faq)
- [DigiLocker](https://www.digilocker.gov.in/)
- [ORS appointment FAQ](https://ors.nic.in/faq.html)
- [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Google Gen AI Python SDK](https://googleapis.github.io/python-genai/)
