# Afkary 0.4.2 — Field-resilient Arabic dictation

## Evidence
- Edge desktop: recognition works but stops and sometimes misrecognizes words.
- Chrome Android: repeated words and rapid session termination in 0.4.1.
- Brave Android: partial improvements, remaining repeated words and short sessions.
- Firefox, Chromium, Opera, desktop Brave: provider/recognition support differs.

## Source precedent
Adapted from scientifica007/Official_report_template_03, app.js UX-04.1, and tests/report-voice-dictation.test.mjs. It uses an editable in-tab transcript, final-only speech events, deduplication of cumulative result indices, bounded restarts, and explicit copy/insert/discard.

## Operational workflow
1. Open the independent speech panel through the dictation button.
2. Review the privacy notice, choose ar-DZ, ar-SA, or ar, and explicitly start listening.
3. Only final recognition results appear in the reviewable transcript.
4. On normal onend, restart after a short delay. Stop after six silent endings or three rapid empty endings; fatal permission/service errors never loop.
5. Review/edit/copy, then explicitly insert into the idea editor; saving the idea remains a separate user action.
6. Nonempty uninserted transcription triggers a browser unload warning where supported.

## Limitations
Two-or-more adjacent words replayed across recognition sessions are removed, so intentional two-word repetition near a session boundary may be suppressed. Single-word repetition is preserved. The browser may send audio to an external recognition provider. Afkary itself does not record or upload audio. Browser simulation and unit tests do not establish real-microphone success; field testing remains necessary.
