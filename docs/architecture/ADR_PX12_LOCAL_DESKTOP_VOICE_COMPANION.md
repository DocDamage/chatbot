# Architecture Decision Record: Phase PX-12 — Local Desktop Voice Companion

## Status
Accepted (`LOCAL_ONLY_EXPERIMENTAL`)

## Context
The ChatBot Hub ecosystem requires a desktop companion for dictation, voice chat, local transcription/TTS, screen context capture, clipboard transformations, and briefings without violating the local-only security and privacy boundary.

## Decisions
1. **Desktop Boundary & Loopback Auth:** Desktop companion runs as a separate native application communicating with the chatbot server via loopback authentication (`127.0.0.1`).
2. **Local-First STT & TTS:** Default transcription uses local Whisper (`whisper.cpp` compatible models) with checksum validation and Voice Activity Detection (VAD). Default TTS uses local Kokoro/OS native speech. Remote cloud TTS requires explicit data-egress approval.
3. **Explicit User Trigger for Screen Capture:** Continuous background screen capture is strictly rejected. Capture is on-demand, cropped to bounding boxes, downscaled, redacted for credentials, and ephemeral.
4. **Clipboard Security Gate:** Clipboard transformations (translate, summarize, explain, rewrite, code fix) scan for sensitive credentials and warn before writing to the system clipboard.
5. **OS Sandbox Policy:** Broad arbitrary OS control (command execution, powershell, file deletion, power actions) is blocked. Only a narrow allowlist (open chatbot, paste approved text, show notification, open approved URL) is permitted.
6. **Privacy & Retention:** Default-off retention for audio recordings and screen thumbnails. Support bundles are scrubbed of raw media.

## Consequences
- Clean separation between server core and desktop companion.
- Complete privacy protection for voice recordings and screen captures.
- Full verification through `VoiceCompanion.eval.test.ts`.
