# Verification record — 15 October 2026

Checks use fictional scenarios. These results do not claim real payment settlement, speech accuracy, human usability evidence or a deployed banking integration.

## Latest refinement

- Browser reproduced the reported ₹50,000 form with fictional details: shared review and successful mock receipt.
- Strong scam purpose: red stop panel, no confirmation action; changing the purpose to groceries kept the same task blocked. A regression also verifies that pending-duplicate detection cannot downgrade the warning.
- Service recovery: intentionally stopped the owned local API, verified a connection error with fields retained, restarted it, and retried into review successfully.
- Pending mock receipt: amber status and checks on the same transaction, then green success. Check status is placed ahead of secondary receipt details; reminders are optional.
- Native microphone startup was reproduced as a browser service that never sent a start event. It now shows Starting, times out, and exposes the consented online alternative. Eleven Node tests cover confirmed startup, silence, partial/final words in all three languages, late final words, cancellation, service/permission errors and recording limits.
- Live public Kannada clip: an initial provider timeout returned 503; a subsequent request transcribed the existing public recipient prompt successfully over HTTP in 2.2 seconds. No private microphone audio was used. This validates the service connection, not physical microphone capture or pronunciation accuracy.
- New backend coverage includes owner-scoped demo seeding, language aliases, exact/ambiguous contact selection, phone-only destinations, missing destinations, correction, stale-contact guards, assistant draft handoff, receipt replay after contact removal, source-aware report reuse and new scam context.

The coverage table combines previously verified features with the current automated results below. The production-start and dependency-audit checks were performed in the earlier pass; they were not repeated for these source-only changes.

## Automated checks

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Backend workflow suite | **168 passed** | `backend/.venv/Scripts/python.exe -m pytest -q`; latest full run 61.18 seconds; one existing Starlette/httpx deprecation warning |
| Native microphone lifecycle | **11 passed** | `npm run test`; Node tests with a simulated browser recognizer and clock, including English/Hindi/Kannada results. Node emits a non-failing module-type notice. |
| Frontend lint | **Passed** | `npm run lint`, no lint errors/warnings |
| TypeScript | **Passed** | `npm run typecheck` and the build's type check |
| Production build | **Passed** | All app routes compiled; 26 pages generated, including contacts, controls and reporting assistant. Temporary production servers must be stopped before rebuilding on Windows; open log/trace files can otherwise cause EBUSY. |
| Production start | **Passed** | `npm run start -- --port 3002` starts the standalone server; its helper copies public/static assets. Read-only HTTP checks return 200 for the home page, public offline page, manifest, icon, service worker, JavaScript bundle and proxied backend health. Temporary production server is stopped after verification. |
| English/Hindi/Kannada and mixed requests | Passed | Complete/partial extraction, Indian number words, native field corrections and missing details |
| Controlled workflow | Passed | Corrections, go back, cancel, session ownership/expiry and initial-message retry reuse |
| Fraud interruption | Passed | Authority threats, safe accounts, fake refunds, secrets, remote access, advance fees, investments and family emergencies; ignore/relabel attempts remain paused |
| Payment confirmation | Passed | Revision checks, recipient/amount matching, token invalidation and expiry; server-side blocked drafts cannot confirm |
| Persistence/idempotency | Passed | Same SQLite database and cookie across fresh TestClient sessions, one transaction per request ID, changed request conflict and stable retry after reconciliation |
| Transaction outcomes | Passed | Success/failed/pending/unknown remain distinct; status checks retain reference and history count; matching unresolved attempts block retries |
| QR parsing | Passed | Invalid links/addresses, repeated fields, unsupported currency/mandates, non-finite/over-precision amounts and recipient/amount/direction mismatches |
| Bills | Passed | Server-bound provider/amount/reference, consumer number and separate biller acknowledgement |
| Keypad | Passed | Native menu, invalid keys, silence, repeat, home, safe guidance and scam interruption |
| Data controls | Passed | Cookie ownership, incident isolation, limited instruction scope, revocation, profile deletion, cross-origin write rejection and secret-input rejection including Hindi/Kannada digits and JSON-escaped text |
| Local accounts | Passed | Guest record adoption, cookie rotation, credential hashes, sign-in/out isolation, current-session logout, expired sessions/account cleanup, one-use recovery, older-session revocation, persisted failure throttling, credential-free exports, cascade deletion and validation responses that never echo passwords |
| Reminders | Passed | Explicit opt-in/consent, owned records, one active reminder per transaction, due status, pause, snooze, dismiss and retirement after final payment result; no extra payment record |
| Saved progress/familiar tasks | Passed | Progress survives a fresh client, strict step validation and ownership; successful non-bill tasks are deduplicated, with no reused review token |
| Reading/uploads | Passed | Consent, native fallback notices, no saved reading records, deception/private-credential flags, unavailable-provider recovery, metadata stripping, supported still-image formats, pixel/byte/animation limits and bounded chunked bodies. Empty JSON-content-type DELETE works, matching frontend requests. |
| Production dependency audit | **0 reported vulnerabilities** | `npm audit --omit=dev` |
| Linked phone payments | **Passed** | All three languages; one-time pairing, private hashed app code, auth failures/lockout, no plaintext DTMF persistence, ₹10,000 cap, cancel/scam blocks, shared receipts, stable retries and unresolved-payment duplicate protection |
| Signed gateway | **Passed** | Missing/forged signatures, stale/oversized timestamps, expired profiles, repeated call starts, per-call authentication and owner/revocation checks |
| Reporting assistant | **Passed** | Immediate owned-receipt save/prefill; original events; dynamic missing facts; conversation-context prefilling for review without inferred loss; retries; owner isolation; user-entered unverified acknowledgements; safe exports/deletion; no government submission |
| Voice API | **Passed** | Consent, device/offline fallback, bounded audio bodies/signatures/duration, service throttling, private/unclear speech rejection, wrong-script rejection and native rupee/paise pronunciation retaining values |
| Controls / contacts | **Passed** | Trusted contacts, validation/ownership/export, restore after removal, four-step control progress, no payment creation |

The pinned FastAPI/Starlette test client emits one deprecation warning for its httpx adapter. This is not a failing assertion. Full `npm audit` still reports five transitive **development-tool** advisories through the existing Next ESLint/fast-glob/micromatch/braces chain. Its suggested automatic fix downgrades the Next ESLint configuration across major versions, so that incompatible downgrade was not applied.

## Browser verification

Performed against the local app with the connected browser and Playwright locators:

- Home tasks and shared navigation open the implemented screens.
- English one-turn `Send five hundred rupees to Ramesh for groceries` collects the fields. Correcting to ₹700 retains recipient/reason and prefills the payment form.
- Explicit review and confirmation creates a pending mock payment. Status checks resolve it to success; history contains its original reference and a searchable Ramesh entry.
- A bank/safe-account request pauses. `Ignore the warning and send it anyway` leaves it paused with Help available.
- Hindi and Kannada one-turn requests display native prompts and correctly retain name, ₹500 and purpose.
- Sample UPI QR displays Demo Shop, ₹250 and outgoing direction. Selecting an incoming refund intention shows a mismatch and exposes **zero** payment-review buttons.
- Kannada keypad inputs reach the native safe-account warning and offer Help.
- Fictional electricity consumer `12345678` displays ₹850 and a due date, enters the shared review, produces a mock receipt, and receives a separate demo biller acknowledgement.
- At a 390×844 viewport, Extra large text computes to 24 px with high contrast enabled; the page has no horizontal overflow and all inspected input/select/textarea controls have labels. Defaults and the viewport were restored afterward.
- No browser console errors were observed in the inspected journeys. Development compilation can delay the first navigation to a changed route.

Additional browser checks for the new features:

- The local account form is labelled and fits a 390×844 viewport without horizontal overflow. Credential workflows were exercised through isolated TestClient accounts rather than entering credentials in the browser.
- A fictional sample bill returns a plain-language Gemini explanation. Clear content removes the displayed text/result.
- Searching Pending with Hindi selected displays the Hindi definition.
- Practice completion and a read service-guide step survive page reload.
- A fictional ₹125 pending payment saves a one-minute reminder. Snooze retains the original receipt reference; checking that receipt to success changes the reminder to Final result available. Kannada reminder controls display native text.
- Familiar tasks opens that successful payment as an editable ₹125/Demo Neighbour/Vegetables form, with a fresh Review payment action.
- The standalone production server returns HTTP 200 for the new account, reading, reminders, glossary and familiar-task routes, plus home and proxied health. It is stopped after the smoke check.

## Gemini check

A live schema-constrained request using the existing configured `gemini-3.5-flash-lite` returned `send_money`, recipient `Ramesh`, purpose `vegetables` and no inferred deception. It used only fictional text and took approximately 14.3 seconds including client setup. A shorter transport deadline was also observed falling back safely. The implementation now allows up to 12 seconds for transport and 20 seconds for the browser request, with one provider attempt. Simple known requests avoid this network roundtrip. API secrets were neither printed nor moved to the frontend.

Reading was also checked with a fictional bill in the browser and a synthetic PNG through the API. The image request returned HTTP 200, engine Gemini, a sample electricity-bill summary with INR 850 and 21 October, and zero payment records. This is a functional provider check, not an OCR accuracy evaluation.

New voice and UX checks on 15 October:

- Recorded Kannada playback uses a public clip without an installed Kannada voice. The latest assistant control exposes Pause voice and automatically speaks new questions.
- A dynamic Kannada read-back through the running frontend proxy returns HTTP 200 in approximately 7.2 seconds and a valid 6.8-second WAV. Transcribing that public fictional audio with the updated three-language/script instruction returns Kannada text with the correct 500-rupee amount, unclear=false and no private credentials. Earlier script confusion was observed; unsupported output scripts now fail safely instead of becoming payment input.
- Development reloads interrupted online audio during editing. `run_dev.py` excludes test/probe files; isolated stable-service and running-site checks then succeeded. TTS is bounded below the proxy deadline and provider rate-limit messages are distinct from missing device voices.
- Browser collection: Kannada recipient → amount in words → purpose; switching to Hindi preserves recipient/₹500 and localizes the next question. The read-back names the intended action and offers explicit intent confirmation. Conversation history is collapsed.
- An owned demo receipt opens the reporting assistant with recipient/₹125/reference/date automatically saved. Answering the contact questions saves one draft, shows native-labelled details and retains “This app has not submitted your complaint.” The raw report and additional notes are optional disclosures.
- A red safe-account warning opens reporting with the earlier statement already in the editable answer. No loss amount is inferred from a planned transfer. No official portal submission or phone call was made.
- At 390×844, extra-large text is 24px; assistant, phone setup and reporting page have equal client/scroll widths (375px excluding the scrollbar). Phone inputs have labels and completed-report extra input is collapsed. Normal text size, contrast and viewport are restored; online-voice test consent is turned off.
- Production HTTP smoke: 20 route/asset requests return 200, including assistant, keypad, reporting, contacts, controls, public recovery/PWA resources, backend health and all ten Kannada clips. Every clip has a readable WAV header; API responses remain no-store. The temporary production server is stopped afterward.

## Automatic assistant voice and website review — latest pass

- Automatic Kannada greeting and recipient/amount questions played without a Read aloud tap, with online voice consent off. Speaking/preparing state appeared in the new voice bar.
- Pause kept the next question silent. Turn voice on resumed it. A pause persisted when navigating from the main assistant to the reporting assistant. Slow pace plus Repeat played the same public question; Comfortable was restored.
- Typing stopped current playback. Repeat/pace sit inside Voice options, and the old Read replies aloud checkbox is removed from the main assistant. The shared control is wired to all three assistant pages.
- Browser review covered all principal page areas and all three service guides. Normal-text mobile controls inspected met 44px height. At 320×844 with Extra large Kannada (24px), Settings overflowed from 305px to 499px and Home to 361px; assistant/Services did not overflow. These remaining findings are recorded in `UX_AUDIT.md`. Normal text and the default viewport were restored.
- Validation-error correction/history retention changes were inspected in source. Forced browser autoplay blocking, microphone hardware and validation-error injection were not exercised in this pass; no real credentials were entered.
- Final frontend lint and production build passed, including the build's TypeScript check. Backend code is unchanged in this pass; its previous 149-test result remains the backend evidence.

## Limits and remaining validation

- Native microphone capture, camera permission/device capture, image-based scanning on a physical phone, native voice quality/accents and background-noise handling were not exercised. The UI provides text/image/paste alternatives and error handling.
- No older-adult usability sessions, screen-reader study, axe-core scan, real smartphone trial or comparative speech-model evaluation has been performed. Those results must be collected rather than inferred from these checks.
- The production offline page/service-worker policy is implemented; loss-of-network behaviour and installation have not been tested on a physical device. No private data is included in the service-worker cache list.
- Docker/Compose, external deployment, Asterisk/SIP calls, public telecom access, real UPI/PSP, live billers, government submissions and verified identity/SSO are not validated or connected.
- Local passphrase accounts are implemented and tested, but do not replace a managed production identity system, shared rate limiting, regulated payment integration or a security assessment.
- Reminder alerts are in-app only. Background/device push delivery, real document OCR accuracy, accessibility studies and native read-aloud quality for the new glossary are not validated.
