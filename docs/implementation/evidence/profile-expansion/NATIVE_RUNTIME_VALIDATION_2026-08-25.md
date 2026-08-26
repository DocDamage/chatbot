# Native Runtime Validation — 2026-08-25

**Status:** `IMPLEMENTED_NOT_VERIFIED`
**Environment:** Windows local-trusted development host
**Git state:** uncommitted worktree based on `55dbcd0a2af1bd4c26f1f28aae7b3e3d6823f7f2`
**Purpose:** record executed local runtime evidence without promoting any capability to production-supported status.

## Discovered runtimes

| Runtime | Selected path or endpoint | Observation |
|---|---|---|
| Python / Faster Whisper | `I:\Coding Projects\ChatBot\data\native-runtime\python\Scripts\python.exe` | Local environment created and Faster Whisper installed. |
| FFmpeg / FFprobe | `C:\ProgramData\chocolatey\bin\ffmpeg.exe`, `ffprobe.exe` | Discovered and used for media/audio operations. |
| Demucs | `C:\Users\dferr\.local\bin\demucs.exe` | Discovered and used for an actual separation run. |
| Godot | `C:\Users\dferr\bin\godot-v4.7.1\Godot_v4.7.1-stable_win64_console.exe` | Discovered and used for CLI validation/profile probes. |
| Unity | `C:\Program Files\Unity\Hub\Editor\6000.4.5f1\Editor\Unity.exe` | Installed, but editor execution is blocked by the absence of a valid Unity Editor license. |
| Unreal | `D:\Unreal\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe` | Complete installation selected; headless commandlet validation passed. |
| PowerShell / Windows SAPI | `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` | Discovered and used for TTS and screen capture. |
| Ollama | `http://127.0.0.1:11434` | Healthy local endpoint with an installed Qwen 3 model. |

Unreal discovery also found a complete `D:\Unreal\UE_5.5` installation. The candidate at `C:\Program Files\Epic Games\UE_5.7` is intentionally rejected because `Engine\Shaders` is missing. Discovery chooses the newest complete editor, currently Unreal 5.8 on `D:`.

## Executed local smoke evidence

| Capability | Executed outcome |
|---|---|
| Speech synthesis | Windows SAPI produced a valid 117,086-byte PCM WAV artifact. |
| Speech recognition | Faster Whisper transcribed a SAPI round trip exactly as `The speech recognition route is working correctly.` with approximately 0.984 confidence. |
| Screen capture | Windows capture returned real dimensions and pixels; the HTTP route withheld raw pixels by default when only text-redaction protection was requested. |
| OCR | FFmpeg frame extraction and Tesseract recognition completed against a generated media fixture. |
| Translation and writing transforms | Ollama completed local translation, clipboard transformation, dictation transformation, and writing-proposal operations. Route-level French and Spanish translation smokes passed. |
| Dubbing and narration | Timing-fit dubbing and chaptered narration emitted real audio/package artifacts. |
| Stem separation | Demucs emitted four real WAV stems; complement/mix behavior is covered by backend tests. |
| Godot | CLI runtime scenario and profiler probe passed against a clean fixture project. |
| Unreal | `UnrealEditor-Cmd.exe` 5.8 completed a terminating headless `ResavePackages` project-validation commandlet with exit code 0 in approximately 6.3 seconds. |
| Asset cooking | The project-owned local AssetCooker executor produced actual copied/manifested artifacts rather than simulated success. |

## Deliberate limitations and blockers

- Unity is installed but is not operational on this host until a legitimate Unity Editor license is activated. The observed editor result was exit code 198 with `No valid Unity Editor license found`. The implementation does not bypass licensing.
- Unity and Unreal gameplay assertions require a reviewed project-side instrumentation bridge. Without one, assertions report `*_ASSERTION_BRIDGE_UNAVAILABLE` rather than fabricated success.
- Unity and Unreal profiling requires trusted editor/project instrumentation. The adapters report `*_PROFILER_INSTRUMENTATION_UNAVAILABLE` rather than returning synthetic zero metrics.
- This is local worktree evidence, not clean-machine, exact-commit CI, legal, load/soak, manual accessibility, rollout, or post-deploy certification.

## Automated verification after runtime integration

- Server: 222 active suites passed; 1,173 tests passed and 2 were intentionally skipped.
- Server Stage 2 coverage passed: 23,085/37,301 lines and 10,197/20,403 branches.
- Client: 36 test files and 115 tests passed.
- Client Stage 2 coverage passed: 1,568/2,320 lines and 1,233/2,047 branches.
- Accessibility: 16 focused unit checks and 6 Chromium/Axe workflows passed.
- Production build and packaging smoke passed.
- Phase 2 source-integrity, inventory, reachability, file-size, environment-contract, and documentation gates passed.

These results support local experimental use only. They do not change any `PX` task from `IMPLEMENTED_NOT_VERIFIED`.
