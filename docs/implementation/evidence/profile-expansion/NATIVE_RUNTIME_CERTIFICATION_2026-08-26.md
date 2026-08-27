# Native Runtime Certification — 2026-08-26

**Status:** `IMPLEMENTED_NOT_VERIFIED`  
**Environment:** Windows local-trusted development host  
**Branch:** `codex/cf04-cf10-integration`  
**Starting commit:** `f78a5a53e680d00bb81514371cd23c8794563118`  
**Purpose:** certify the native runtime matrix that can be executed on this host while preserving the independent legal, manual-accessibility, clean-machine, production-like, release-artifact, and post-deploy gates.

## Outcome

The installed native stack is operational for local experimental use. Unity's former license blocker is resolved. Real artifact- or process-level checks passed for Unity, Unreal, Godot, Windows SAPI, Faster Whisper, screen capture, Tesseract OCR, FFmpeg/FFprobe, Demucs, Ollama, browser E2E, and host telemetry.

This evidence does **not** promote the branch or any PX capability to `VERIFIED`. Unity and Unreal gameplay assertions and profiler measurements still need reviewed project-side instrumentation. Manual assistive-technology testing, clean-machine/device coverage, production-like load and recovery, legal review, signed artifacts, rollout, and post-deploy evidence also remain open.

## Runtime inventory

| Runtime | Selected installation | Result |
|---|---|---|
| Python / Faster Whisper | `data/native-runtime/python/Scripts/python.exe` | Found; real local transcription passed. |
| FFmpeg / FFprobe | Chocolatey installation | Found; real media extraction, conversion, and probing passed. |
| Demucs | User-local pipx installation | Found; real four-stem CPU separation passed. |
| Godot | `Godot_v4.7.1-stable_win64_console.exe` | Found; scene assertions and profile probe passed. |
| Unity | Unity Hub Editor `6000.4.5f1` | Found; Personal license observed and project validation exited 0. |
| Unreal | `D:\Unreal\UE_5.8` | Found as the newest complete installation; commandlet validation exited 0. |
| PowerShell / Windows SAPI | Windows PowerShell 5.1 | Found; TTS and screen-capture operations passed. |
| Ollama | `http://127.0.0.1:11434` | Service started locally; discovery and real `qwen3:8b` inference passed. |
| Browser | Playwright Chromium `1.62.0` | Production build and all seven browser workflows passed. |

## Executed evidence

### Adapter contracts

The focused native suite passed 6/6 suites and 44/44 tests:

- runtime discovery and complete Unreal-install selection;
- command isolation, output capture, timeout, and bounded-log behavior;
- voice, screen, OCR, local-AI, audio, and media backend contracts;
- Godot runtime/profile behavior;
- Unity and Unreal installed-editor behavior, fail-closed assertion handling, profiling limitations, and export contracts;
- multi-engine project isolation and license gating.

The local-model regression suite passed 1/1 suite and 6/6 tests after the hardware-canary repair described below.

### Unity licensing and editor

- Unity Hub `3.21.0` displayed `Personal` under **Settings → Licenses**, with activation date `Fri, Jul 1, 2016`.
- A direct headless editor launch exited with code 0.
- `InstalledGameEditorBackend.runScenario('unity', ...)` opened the persisted smoke project, completed compilation/validation, reported `passed: true`, and exited with code 0 in approximately 4.1 seconds.
- The prior exit-198 `No valid Unity Editor license found` blocker is resolved on this host.

Unity and Unreal still deliberately return `*_ASSERTION_BRIDGE_UNAVAILABLE` and `*_PROFILER_INSTRUMENTATION_UNAVAILABLE` where a trusted project-side bridge is absent. Editor startup success is not represented as gameplay or profiler evidence.

### Godot and Unreal

- Godot loaded `res://main.tscn`; `node_exists` and `screen_text` assertions both passed for the `Status` label.
- Godot emitted an actual profile payload, including three nodes, approximately 24.6 MB static memory, and a 60 Hz physics tick rate. Headless rendering legitimately reported zero draw calls/VRAM.
- Unreal `5.8` ran the terminating `ResavePackages` project commandlet against `data/native-runtime/smoke/unreal/Smoke.uproject`, reported `passed: true`, and exited normally in approximately 37.3 seconds.

### Voice, screen, OCR, and audio

- Windows SAPI produced a 109,376-byte, 22,050 Hz WAV with approximately 2.48 seconds of audio.
- Faster Whisper `tiny.en` transcribed that WAV exactly as `Native certification check.` with approximately 0.765 confidence and `isLocalOnly: true`.
- Windows screen capture returned a 37,688-byte PNG at the requested 640×360 bounds. Local OCR executed with ten detected snippets; snippet content was not retained in this evidence.
- FFmpeg sampled two frames from the 640×360 subtitle fixture. Tesseract recognized `ACCESSIBILITY WORKS` in both frames at 0.96 confidence.
- Demucs `htdemucs` on CPU produced and verified four 44.1 kHz stereo WAV stems (`bass`, `drums`, `other`, and `vocals`), each 359,502 bytes with distinct SHA-256 digests.

### Local model and hardware

- Ollama discovery reported `nomic-embed-text:v1.5`, `qwen3-vl:8b-instruct`, and `qwen3:8b`.
- A real `qwen3:8b` transformation returned `LOCAL_OK`.
- The CF-04 hardware canary passed against the loopback OpenAI-compatible endpoint: endpoint healthy, three models discovered, one 2,048 MB resource lease allocated/released, and visible inference response `OK`.
- Physical host inventory observed an Intel Core i5-14600K (14 cores/20 logical processors), approximately 48 GB visible RAM, and an NVIDIA GeForce RTX 3060 with 12,288 MiB VRAM.
- Desktop telemetry reported healthy RAM, CPU, and disk state during the run.
- The installed Demucs virtual environment uses `torch 2.11.0+cpu`; CUDA Demucs acceleration is therefore **not configured or certified**, despite the physical NVIDIA GPU being present.

### Browser

`npm run test:browser` completed successfully after building server and client production bundles. Playwright ran seven Chromium workflows on desktop and mobile viewports; all seven passed in approximately 22.6 seconds. The scenarios covered authentication boundaries, settings and persisted chat, accessibility, real workspace text/audio fixtures, approval-gated knowledge ingestion, local-tool/Sprite Lab workflow, and mobile chat.

## Defect found and repaired during certification

The first real CF-04 hardware canary reached Ollama and completed generation, but failed because its ten-token completion cap was consumed by a reasoning model before visible content was emitted. `LocalHardwareCanary` now uses a bounded 512-token health-check budget, deterministic temperature, and an explicit short-response system prompt. A regression assertion verifies the request budget and temperature. The repaired real canary returned visible `OK` and passed.

## User-supplied license and credential materials

Two files were inspected offline outside the repository. No credential values were printed, extracted into the worktree, or committed.

| Material | SHA-256 | Handling and conclusion |
|---|---|---|
| User license text (1,410 bytes) | `0DDFFEED82B78EF002F1E0AE95E966EEEDE43E60D9782B383E64C4F33BAA643D` | Contains a CC0-style grant plus a fallback royalty-free license. It can document rights for material actually owned by its issuer, but it does not identify the creator, covered assets, upstream revisions, trademarks, patents, privacy/publicity rights, or third-party dependencies. It is not sufficient by itself to close the repository-wide legal gate. |
| API-key archive (2,419 bytes) | `C44903172EFD50F17A4DE4BDEDB7849F38DA8B2C3E68985BF2FDA7FB8D695EE4` | Contains one environment file and seven provider/key text files. Presence was inventoried without exposing values. These credentials were not needed for the local native canaries and were not transmitted to providers. |

Provider credentials alone do not define or authorize a production-like deployment target, load test, backup/restore drill, or post-deploy check. Those gates remain open until a target environment and its data stores are explicitly in scope.

## Remaining gates

- Immutable upstream revisions and dependency/asset-specific legal review with accountable sign-off.
- Reviewed Unity and Unreal project-side gameplay assertion and profiler bridges, followed by real measurements.
- CUDA-capable Demucs installation and GPU-specific certification if GPU stem separation is a release requirement.
- Clean-machine and representative-device certification.
- Signed manual WCAG, keyboard-only, screen-reader, and other assistive-technology testing; the user has deferred this step.
- Production-like load/soak, backup/restore, quarterly drill, signed release-artifact, rollout, and post-deploy evidence.

## Promotion decision

Keep `IMPLEMENTED_NOT_VERIFIED`. The native-host execution gate is substantially closed, including the Unity license issue, but the independent gates above prevent honest release promotion.
