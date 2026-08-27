# Production-Like, Game Editor, and CUDA Certification — 2026-08-27

## Scope and result

This record closes the three machine-executable gates requested on 2026-08-27:

1. an isolated production-like deployment target with load, persistence, backup/restore, hardening, and rollback checks;
2. reviewed project-side Unity and Unreal gameplay/profiler instrumentation executed in the installed editors; and
3. optional CUDA-enabled Demucs execution on the installed NVIDIA GeForce RTX 3060.

All three targets passed on this workstation. This is strong local production-like and host-native evidence; it is not evidence of deployment into a named cloud/staging account, managed-service recovery, public TLS termination, a long soak, signed artifacts, or post-deployment observation.

Implementation commit: `509f9ffcb93095ca368425eeb2e2c0823aacd12f` on `codex/cf04-cf10-integration`.

## Implementation delivered

- `deploy/certification/docker-compose.production-like.yml` defines an isolated Linux OCI target with the production application image, PostgreSQL 16 + pgvector, Redis 7 AOF persistence, private data-service networking, loopback-only application publishing, health checks, generated throwaway secrets, read-only application root filesystem, non-root execution, all capabilities dropped, and `no-new-privileges`.
- `scripts/certification/production-like.mjs` creates a timestamped Compose project, builds and starts it, checks readiness and access boundaries, proves restart persistence, performs PostgreSQL and Redis backup/restore, applies a bounded HTTP load test, inspects container hardening and port exposure, rehearses image rollback, writes JSON evidence, and removes only its timestamped containers/networks/volumes.
- `scripts/certification/http-load.mjs` is a dependency-free concurrent HTTP load driver with failure and p95 SLO enforcement.
- The Dockerfile now separates cached development and production dependency stages. This removes the former source-change-triggered `npm prune --omit=dev`; native production dependencies are compiled once and copied into the minimal runtime stage.
- Hosted URL validation now accepts single-label private service-discovery hosts such as `redis`, while insecure public HTTP endpoints remain rejected.
- RAG authentication middleware is scoped to `/api/rag`; it no longer intercepts the built client entry point.
- The invalid pgvector IVFFlat migration was removed. The schema deliberately permits mixed embedding dimensions in an unbounded `vector` column, for which pgvector cannot create that index. Vector retrieval remains correct via exact scan; a future dimension-specific index strategy is a performance enhancement rather than a silently failed migration.
- `GameEditorInstrumentationSources.ts` supplies reviewed bridges generated into isolated certification projects. Unity enters Play Mode and samples real runtime assertions and profiler counters. Unreal uses the project Python API for world/actor assertions and the native CSV profiler for flushed game-frame metrics.
- `NativeGameEditorBackends.ts` now consumes bridge results, fails closed when instrumentation evidence is missing, and parses Unreal CSV captures rather than manufacturing profiler values.
- `NativeAudioBackends.ts` passes the configured shared-FFmpeg directory into Demucs so TorchCodec can encode output on Windows.

## Production-like certification

- Command: `npm run certify:production-like`
- Result: PASS
- Raw local evidence: `data/certification/20260827071303/production-like-certification.json`
- Elapsed wall time: 6 minutes 42 seconds, dominated by Docker Desktop export of the native production dependency layer.
- HTTP checks: liveness 200, readiness 200, built client 200, missing authentication 401, insufficient role 403, hosted local-only game-studio route 404.
- Browser headers: Content Security Policy present, `X-Frame-Options: SAMEORIGIN`, and `X-Content-Type-Options: nosniff`.
- Restart persistence: PostgreSQL PASS, Redis PASS, application readiness after restart PASS.
- Recovery: PostgreSQL custom-format dump restored and exact marker verified; Redis AOF/RDB archive restored into a replacement data state and exact marker verified.
- Load: 135,141 successful requests in 15.056 seconds at concurrency 20; 8,975.90 requests/second; zero failures; p50 1.70 ms, p95 4.80 ms, p99 10.78 ms, maximum 36.94 ms. The enforced p95 limit was 500 ms.
- Hardening: runtime user `node`; read-only root filesystem; all Linux capabilities dropped; `no-new-privileges`; application published only on `127.0.0.1:4301`; PostgreSQL and Redis had no published host ports.
- Rollback: the certified image was retagged as the rollback candidate, the application container was force-recreated without a build, and readiness returned 200.
- Cleanup: the timestamped Compose project's containers, networks, and volumes were deleted after evidence collection. Backup artifacts remain under ignored local `data/certification` storage.

The load result measures a local loopback readiness endpoint and therefore establishes runtime/process/network headroom, not representative end-user chat latency or external-provider capacity. A named environment should reuse the same assertions with realistic traffic and a materially longer soak.

## Unity and Unreal certification

- Command: `npm run certify:game-editors`
- Result: PASS
- Raw local evidence: `data/native-runtime/certification/20260827072145/game-editor-certification.json`
- Unity executable: Unity 6000.4.5f1.
- Unity license: active Personal entitlement accepted by the installed editor; real batch Play Mode runs exited successfully.
- Unity assertions: `ChatBotSmokeProbe` existed, reflected property `Smoke.status` equaled `Ready`, and sampled runtime FPS exceeded the threshold.
- Unity profile: 28,180.97 FPS, 0.0355 ms/frame, one runtime object, 91.84 MB allocated memory, 50.00 Hz physics. The intentionally empty headless scene reported zero draw calls and zero graphics memory.
- Unreal executable: Unreal Engine 5.8.
- Unreal assertions: project-side Python instrumentation inspected the active level and confirmed real world actors existed.
- Unreal profile: 120 flushed native CSV gameplay frames; 2,312.52 FPS, 0.4324 ms/frame, 116 actors, and 1,597.40 MB physical memory. `-nullrhi` intentionally reported zero draw calls.

The extreme FPS values are expected for minimal unthrottled headless fixtures. Their purpose is to prove the instrumentation path and real engine-frame sampling. Performance acceptance for an actual game must use that game's scenes, rendering backend, content, target device, and thresholds.

## CUDA Demucs certification

- Physical GPU: NVIDIA GeForce RTX 3060, 12 GB.
- Runtime: `torch 2.11.0+cu130`, `torchaudio 2.11.0+cu130`, `torchcodec 0.16.0+cu130`.
- CUDA check: `torch.cuda.is_available()` returned true; CUDA runtime 13.0; a real 4096 x 4096 CUDA matrix operation completed.
- Demucs check: a real two-stem CUDA separation completed in 3.79 seconds and produced `vocals.mp3` and `no_vocals.mp3`, each 81,502 bytes, under ignored local evidence directory `data/native-runtime/certification/cuda-20260827020804`.
- Windows encoding dependency: `FFMPEG_SHARED_DLL_DIR` is persisted for the existing shared FFmpeg installation, and `GPU_AVAILABLE=true` is persisted at user scope. The application prepends that validated directory only for the Demucs child process.
- Package source: official PyTorch CUDA 13.0 wheels were used. References: <https://pytorch.org/get-started/previous-versions/> and <https://download.pytorch.org/whl/cu130>.
- TorchCodec's Windows shared-FFmpeg requirement is documented upstream: <https://github.com/meta-pytorch/torchcodec>.

## Remaining external gates

- Legal/license promotion still needs immutable upstream revisions and an authorized review of the actual redistributed assets and dependencies. The Unity activation proves editor entitlement, not repository-wide redistribution rights.
- Clean-machine/device certification and signed manual WCAG/screen-reader testing remain open.
- A named staging/production environment still needs real TLS termination, managed-service backup/restore, representative application traffic and soak duration, signed release artifacts, and post-deploy monitoring evidence.
- Dimension-specific pgvector indexes should be designed when production embedding-provider/dimension policy is fixed; the current mixed-dimension store uses correct exact vector scans.
