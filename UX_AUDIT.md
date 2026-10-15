# Easy Pay — Safe Pay: UI/UX review

Updated 15 October 2026 after source review and browser checks. This is a heuristic review, not an accessibility certification or an older-adult usability study. See [WORKFLOW_MAP.md](WORKFLOW_MAP.md) for routes, responsibilities and recovery paths.

## Problems resolved in this refinement

| Problem | Change and practical effect |
| --- | --- |
| Valid payment form showed a generic input error when the API was down | Restored the API, separated service failures from validation, retained the form and verified retry. Added a launcher that checks both services. |
| Safety states were difficult to distinguish | Red stop panel for strong warnings, amber for checks/holds/unresolved outcomes, green for ready-to-confirm/success. Each state includes an icon, text and the next action. |
| Duplicate detection could replace a stronger fraud warning | Kept the strong warning and added the duplicate signal and receipt link. Server confirmation remains blocked. |
| Assistant collected details and then sent the user through entry again | An owned server endpoint opens the complete draft directly in shared review. Bills use the same direct handoff. Explicit final payment confirmation remains. |
| Named payments could lose the destination | Akash, Suraj and Gowtham are saved fictional payment contacts with language aliases, phone and UPI details. Exact matching only; ambiguity asks for a choice. Contact snapshots are rechecked before confirmation/execution. |
| Speak and Type looked too similar | Separate labeled tabs, microphone/keyboard icons and restrained green/blue panels. Home exposes each mode directly. |
| Tap to speak displayed Listening without actual recognition startup | Distinct starting/listening states, cancellation and a startup deadline. Live native word previews, silence recovery, late-final-word handling and a consented online alternative. Errors appear beside the microphone. |
| Browser recognition failures had no useful recovery | Distinct permission/device/service messages and online voice setup. Online recording explains Finish speaking → check words → Send. Enabling online voice cannot accidentally submit the enclosing form. |
| Review warning could remain above the visible viewport | Focus and scroll the newly rendered review into view. The red warning appears first and no confirmation control is rendered for a paused draft. |
| Waiting receipts made checking status secondary to reminders | Put the existing receipt's Check status first; move optional reminders into a disclosure. A status check never sends another payment. |
| Navigation and back links lost context | Nested payment, Activity, Help and Services pages retain their section and relevant parent. |
| Preference writes could race and roll back newer settings | Queue writes and roll back to the last successfully saved preferences. Recover service availability on retry/focus. |
| Kannada headings overflowed at narrow/large-text sizes | Allow long native words to wrap, retain 18px mobile base text and enlarge bottom navigation labels. Native and large-text reflow still needs physical-device validation. |
| Services presented too many competing choices | Lead with official-service guides and group optional tools/people assistance. Translate the three service guides and their controls into Hindi/Kannada. |
| Report draft looked complete from its first question; some saved entries looked blank | Distinguish Draft started/Ready to review, use a report-specific review label, defer completed exports until ready, and give incomplete saved drafts a visible name. Source-aware reuse prevents silently omitting a newly supplied conversation. |
| A recent payment could lose phone/contact binding when repeated | Retain the destination metadata and require fresh shared review/confirmation. |

## Remaining issues

| Priority | Issue | Next concrete work |
| --- | --- | --- |
| P1 before an elder-facing pilot | Some account, learning and manual-report prose still uses English | Translate and validate those complete journeys with native speakers, including errors and exports. |
| P1 before an elder-facing pilot | Manual incident drafts still have a limited edit/resume workflow | Add an owned update path, clear resume action and consistent undo, retaining original receipt evidence. |
| P1 before an elder-facing pilot | Physical microphone capture, pronunciation and comprehension have not been tested with older people | Test real English/Hindi/Kannada speakers on common phones, with slow speech, pauses, background noise and browser permission recovery. |
| P2 | Supporting pages still use different manual playback controls | Reuse appropriate repeat/stop/autoplay recovery while avoiding unsolicited reading of entire pages. |
| P2 | Saved preferences can briefly hydrate after default page text | Carry initial settings into rendering and test slow/offline loads without mismatched interactive initialization. |
| P2 | Some QR and account screens still expose technical detail early | Test whether progressive disclosure improves task completion without hiding necessary destination/recovery information. |

Browser speech recognition varies by browser and can expose an API while its service is unavailable. The implementation distinguishes startup, network, permission and language failures; see [MDN's recognition error documentation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error). Online voice remains an explicit choice because Google processes the words or recording. The app does not retain microphone audio.

Bank identity verification, real transfers, carrier calling and official complaint submission remain external integrations. The local demo cannot claim to detect every fraudulent request, verify a recipient, or automatically file a government complaint.

## Verification scope

This refinement exercised the reported payment example, scam blocking and relabel resistance, service failure/recovery, saved destinations, explicit confirmation, pending receipt checks and microphone startup/recovery in the local browser. Unit/API coverage is documented in [QA.md](QA.md). The earlier website-wide pass covered all routes listed in the workflow map. Remaining priorities need user research and device testing rather than additional speculative interface changes.
