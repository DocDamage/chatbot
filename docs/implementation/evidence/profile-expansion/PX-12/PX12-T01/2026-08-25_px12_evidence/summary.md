# PX-12 Tasks Evidence Index

- **Phase:** `PX-12 (Local Desktop Voice Companion)`
- **Status:** `IMPLEMENTED_NOT_VERIFIED`
- **Branch:** `codex/cf04-cf10-integration`
- **Date:** `2026-08-25`

## Tasks Verified:
- **PX12-T01:** Desktop companion architecture & loopback session (`ADR_PX12_LOCAL_DESKTOP_VOICE_COMPANION.md`, `FloatingAssistantService.ts`)
- **PX12-T02:** Local STT provider abstraction, model checksums & VAD (`LocalSTTProvider.ts`)
- **PX12-T03:** Local TTS provider, Kokoro/OS voice engine & synthetic disclosure (`LocalTTSProvider.ts`)
- **PX12-T04:** Recording state machine, push-to-talk, hotkeys & audio device selection (`VoiceRecordingService.ts`)
- **PX12-T05:** Dictation modes (raw, cleanup, translate, instruction draft, paste safeguards) (`VoiceDictationEngine.ts`)
- **PX12-T06:** Floating assistant panel session, dialog turns & speech interruption (`FloatingAssistantService.ts`)
- **PX12-T07:** On-demand screen context capture, region crop & credential redaction (`ScreenContextCaptureService.ts`)
- **PX12-T08:** Clipboard transformations, secret detection & safe write gating (`ClipboardActionService.ts`)
- **PX12-T09:** Daily briefings, memory recap, reminders & hardware telemetry (`DesktopCompanionBriefingService.ts`)
- **PX12-T10:** Strict OS action policy sandbox (allowlist vs arbitrary commands) (`DesktopOSActionPolicy.ts`)
- **PX12-T11:** Privacy manager, temporary artifact purge & support bundle sanitizer (`DesktopPrivacyManager.ts`)
- **PX12-T12:** Windows companion packaging & installer manifest (`DesktopPackagingManifest.ts`)
- **PX12-T13:** Voice companion evaluation test suite (`VoiceCompanion.eval.test.ts`)
