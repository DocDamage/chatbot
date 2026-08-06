# Repository Inventory

Generated deterministically by `scripts/release/generate-repository-inventory.mjs`. Do not edit generated tables by hand.

## Summary

| Category | Count |
|---|---|
| Source files | 921 |
| Production source files | 722 |
| Reachable production files | 551 |
| Unreachable production files | 171 |
| Discovered route calls | 325 |
| Environment variables | 153 |
| Feature flags | 17 |
| Files above 300 lines | 63 |

## Server route calls

| Method | Path | Source |
|---|---|---|
| GET | `/health` | `src/server/healthRoutes.ts:13` |
| GET | `/health/ready` | `src/server/healthRoutes.ts:74` |
| GET | `/health/live` | `src/server/healthRoutes.ts:96` |
| GET | `/api/metrics` | `src/server/healthRoutes.ts:100` |
| GET | `/metrics` | `src/server/healthRoutes.ts:121` |
| USE | `/api/v1` | `src/server/index.ts:184` |
| USE | `/api/v2` | `src/server/index.ts:190` |
| POST | `/api/chat` | `src/server/index.ts:197` |
| POST | `/api/knowledge-base/add` | `src/server/index.ts:205` |
| POST | `/api/knowledge-base/file` | `src/server/index.ts:215` |
| USE | `/api/knowledge-os` | `src/server/index.ts:226` |
| GET | `/api/tools` | `src/server/index.ts:230` |
| GET | `/api/models/free` | `src/server/index.ts:247` |
| GET | `/api-docs` | `src/server/index.ts:263` |
| POST | `/api/upload` | `src/server/index.ts:289` |
| POST | `/api/feedback` | `src/server/index.ts:316` |
| GET | `/api/feedback/:messageId` | `src/server/index.ts:333` |
| GET | `/api/user/instructions` | `src/server/index.ts:344` |
| PUT | `/api/user/instructions` | `src/server/index.ts:352` |
| GET | `/api/chat/quick-replies` | `src/server/index.ts:364` |
| POST | `/api/conversations/:sessionId/share` | `src/server/index.ts:386` |
| GET | `/api/share/:shareId` | `src/server/index.ts:403` |
| GET | `/api/documents/search` | `src/server/index.ts:419` |
| USE | `/api/knowledge` | `src/server/index.ts:435` |
| POST | `/api/knowledge/reddit` | `src/server/index.ts:437` |
| POST | `/api/knowledge/youtube` | `src/server/index.ts:447` |
| POST | `/api/knowledge/university` | `src/server/index.ts:457` |
| POST | `/api/knowledge/papers` | `src/server/index.ts:467` |
| POST | `/api/knowledge/github` | `src/server/index.ts:477` |
| POST | `/api/knowledge/stackoverflow` | `src/server/index.ts:487` |
| POST | `/api/knowledge/news` | `src/server/index.ts:497` |
| POST | `/api/knowledge/medium` | `src/server/index.ts:512` |
| POST | `/api/knowledge/quora` | `src/server/index.ts:522` |
| POST | `/api/knowledge/gutenberg` | `src/server/index.ts:532` |
| POST | `/api/knowledge/docs` | `src/server/index.ts:542` |
| POST | `/api/knowledge/library-of-congress` | `src/server/index.ts:552` |
| POST | `/api/knowledge/entertainment` | `src/server/index.ts:562` |
| POST | `/api/knowledge/books` | `src/server/index.ts:576` |
| POST | `/api/knowledge/specialized-topics` | `src/server/index.ts:589` |
| POST | `/api/knowledge/financial-advice` | `src/server/index.ts:602` |
| POST | `/api/knowledge/religion` | `src/server/index.ts:610` |
| POST | `/api/knowledge/mental-health` | `src/server/index.ts:618` |
| POST | `/api/knowledge/web-design` | `src/server/index.ts:626` |
| POST | `/api/knowledge/ui-design` | `src/server/index.ts:634` |
| POST | `/api/knowledge/backend-design` | `src/server/index.ts:642` |
| POST | `/api/knowledge/music-theory` | `src/server/index.ts:650` |
| POST | `/api/knowledge/llm-programming` | `src/server/index.ts:658` |
| POST | `/api/knowledge/anatomy` | `src/server/index.ts:666` |
| POST | `/api/knowledge/pottery` | `src/server/index.ts:674` |
| POST | `/api/knowledge/gardening` | `src/server/index.ts:682` |
| POST | `/api/knowledge/cna` | `src/server/index.ts:690` |
| POST | `/api/knowledge/dsp` | `src/server/index.ts:698` |
| POST | `/api/knowledge/rn` | `src/server/index.ts:706` |
| POST | `/api/knowledge/astronomy` | `src/server/index.ts:714` |
| POST | `/api/knowledge/astrology` | `src/server/index.ts:722` |
| POST | `/api/knowledge/botany` | `src/server/index.ts:730` |
| POST | `/api/knowledge/marijuana-growing` | `src/server/index.ts:738` |
| POST | `/api/knowledge/load-telegram` | `src/server/index.ts:746` |
| POST | `/api/knowledge/wikipedia` | `src/server/index.ts:767` |
| POST | `/api/knowledge/scrape` | `src/server/index.ts:777` |
| POST | `/api/knowledge/load-csv` | `src/server/index.ts:788` |
| POST | `/api/knowledge/load-json` | `src/server/index.ts:812` |
| POST | `/api/knowledge/graph/entity` | `src/server/index.ts:834` |
| GET | `/api/knowledge/graph/query` | `src/server/index.ts:844` |
| POST | `/api/knowledge/fuse` | `src/server/index.ts:856` |
| POST | `/api/reasoning/chain-of-thought` | `src/server/index.ts:1014` |
| GET | `/api/debug/:requestId` | `src/server/index.ts:1030` |
| GET | `/api/conversations` | `src/server/index.ts:1043` |
| GET | `/api/conversations/:sessionId` | `src/server/index.ts:1053` |
| DELETE | `/api/conversations/:sessionId` | `src/server/index.ts:1064` |
| POST | `/api/webhooks` | `src/server/index.ts:1072` |
| GET | `/api/webhooks` | `src/server/index.ts:1088` |
| DELETE | `/api/webhooks/:id` | `src/server/index.ts:1094` |
| GET | `*` | `src/server/index.ts:1103` |
| GET | `/stats` | `src/server/routes/admin.ts:127` |
| POST | `/cache/clear` | `src/server/routes/admin.ts:176` |
| GET | `/users` | `src/server/routes/admin.ts:222` |
| GET | `/analytics` | `src/server/routes/admin.ts:247` |
| GET | `/logs` | `src/server/routes/admin.ts:267` |
| GET | `/api/audio/files` | `src/server/routes/audio.ts:9` |
| GET | `/api/audio/metadata` | `src/server/routes/audio.ts:17` |
| GET | `/api/audio/preview` | `src/server/routes/audio.ts:23` |
| GET | `/api/audio/waveform` | `src/server/routes/audio.ts:29` |
| POST | `/api/audio/load-into-chat` | `src/server/routes/audio.ts:35` |
| POST | `/api/audio/analyze` | `src/server/routes/audio.ts:40` |
| POST | `/api/business/ask` | `src/server/routes/business.ts:7` |
| POST | `/api/business/plan` | `src/server/routes/business.ts:11` |
| POST | `/api/business/pricing` | `src/server/routes/business.ts:15` |
| POST | `/api/business/market` | `src/server/routes/business.ts:19` |
| POST | `/api/business/unit-economics` | `src/server/routes/business.ts:23` |
| POST | `/api/chrono/ask` | `src/server/routes/chrono.ts:6` |
| POST | `/api/code/ask` | `src/server/routes/code.ts:22` |
| POST | `/api/code/plan` | `src/server/routes/code.ts:30` |
| POST | `/api/code/patch` | `src/server/routes/code.ts:45` |
| POST | `/api/code/review` | `src/server/routes/code.ts:61` |
| POST | `/api/code/verify` | `src/server/routes/code.ts:69` |
| GET | `/api/code/files/search` | `src/server/routes/code.ts:82` |
| GET | `/api/code/symbols` | `src/server/routes/code.ts:90` |
| POST | `/api/creative/draft-scene` | `src/server/routes/creative.ts:28` |
| POST | `/api/creative/continue-scene` | `src/server/routes/creative.ts:33` |
| POST | `/api/creative/revise` | `src/server/routes/creative.ts:38` |
| POST | `/api/creative/outline` | `src/server/routes/creative.ts:43` |
| POST | `/api/creative/character` | `src/server/routes/creative.ts:48` |
| POST | `/api/creative/world` | `src/server/routes/creative.ts:53` |
| POST | `/api/creative/roleplay-turn` | `src/server/routes/creative.ts:58` |
| POST | `/api/creative/continuity-summary` | `src/server/routes/creative.ts:63` |
| POST | `/api/creative/export` | `src/server/routes/creative.ts:68` |
| GET | `/api/education/sources` | `src/server/routes/education.ts:11` |
| GET | `/api/education/stats` | `src/server/routes/education.ts:15` |
| POST | `/api/education/plans` | `src/server/routes/education.ts:19` |
| POST | `/api/engineering/ask` | `src/server/routes/engineering.ts:7` |
| POST | `/api/engineering/electronics` | `src/server/routes/engineering.ts:11` |
| POST | `/api/engineering/robotics` | `src/server/routes/engineering.ts:15` |
| POST | `/api/engineering/mechanical` | `src/server/routes/engineering.ts:19` |
| POST | `/api/engineering/bom` | `src/server/routes/engineering.ts:23` |
| GET | `/knowledge-base` | `src/server/routes/export.ts:20` |
| GET | `/conversations` | `src/server/routes/export.ts:48` |
| POST | `/import/knowledge-base` | `src/server/routes/export.ts:75` |
| POST | `/import/conversations` | `src/server/routes/export.ts:114` |
| GET | `/api/files/tree` | `src/server/routes/files.ts:27` |
| GET | `/api/files/search` | `src/server/routes/files.ts:31` |
| GET | `/api/files/read` | `src/server/routes/files.ts:42` |
| GET | `/api/files/preview/audio` | `src/server/routes/files.ts:52` |
| GET | `/api/files/preview/image` | `src/server/routes/files.ts:65` |
| GET | `/api/files/metadata` | `src/server/routes/files.ts:77` |
| POST | `/api/files/load-into-chat` | `src/server/routes/files.ts:83` |
| POST | `/api/flstudio/connect` | `src/server/routes/flstudio.ts:9` |
| GET | `/api/flstudio/status` | `src/server/routes/flstudio.ts:13` |
| GET | `/api/flstudio/tools` | `src/server/routes/flstudio.ts:17` |
| GET | `/api/flstudio/state` | `src/server/routes/flstudio.ts:21` |
| POST | `/api/flstudio/disconnect` | `src/server/routes/flstudio.ts:25` |
| POST | `/api/flstudio/command` | `src/server/routes/flstudio.ts:29` |
| POST | `/api/flstudio/tool-call` | `src/server/routes/flstudio.ts:37` |
| POST | `/api/flstudio/piano-roll/notes` | `src/server/routes/flstudio.ts:49` |
| POST | `/api/flstudio/piano-roll/chord` | `src/server/routes/flstudio.ts:59` |
| POST | `/api/flstudio/channel/step-sequence` | `src/server/routes/flstudio.ts:74` |
| POST | `/api/flstudio/mixer/set` | `src/server/routes/flstudio.ts:88` |
| POST | `/api/flstudio/transport` | `src/server/routes/flstudio.ts:122` |
| POST | `/api/gamedev/design` | `src/server/routes/gamedev.ts:7` |
| POST | `/api/gamedev/prototype` | `src/server/routes/gamedev.ts:11` |
| POST | `/api/gamedev/balance` | `src/server/routes/gamedev.ts:15` |
| POST | `/api/gamedev/review` | `src/server/routes/gamedev.ts:19` |
| POST | `/api/gaming/ask` | `src/server/routes/gaming.ts:17` |
| GET | `/api/gaming/playbooks` | `src/server/routes/gaming.ts:24` |
| POST | `/api/gaming/playbook` | `src/server/routes/gaming.ts:30` |
| POST | `/api/gaming/engine` | `src/server/routes/gaming.ts:46` |
| POST | `/api/gaming/assets` | `src/server/routes/gaming.ts:59` |
| POST | `/api/gaming/prompts` | `src/server/routes/gaming.ts:73` |
| POST | `/api/geography/ask` | `src/server/routes/geography.ts:7` |
| POST | `/api/geography/country` | `src/server/routes/geography.ts:11` |
| POST | `/api/geography/culture` | `src/server/routes/geography.ts:15` |
| POST | `/api/geography/map-context` | `src/server/routes/geography.ts:19` |
| POST | `/api/gis/ask` | `src/server/routes/gis.ts:42` |
| POST | `/api/gis/geocode` | `src/server/routes/gis.ts:47` |
| POST | `/api/gis/reverse-geocode` | `src/server/routes/gis.ts:58` |
| POST | `/api/gis/route` | `src/server/routes/gis.ts:66` |
| POST | `/api/gis/places/search` | `src/server/routes/gis.ts:76` |
| POST | `/api/gis/parcels/search` | `src/server/routes/gis.ts:88` |
| POST | `/api/gis/layers/import` | `src/server/routes/gis.ts:99` |
| GET | `/api/gis/layers` | `src/server/routes/gis.ts:112` |
| POST | `/api/gis/layers/query` | `src/server/routes/gis.ts:116` |
| POST | `/api/gis/analysis/distance` | `src/server/routes/gis.ts:126` |
| POST | `/api/gis/analysis/buffer` | `src/server/routes/gis.ts:133` |
| POST | `/api/gis/analysis/nearest` | `src/server/routes/gis.ts:142` |
| POST | `/api/gis/sessions` | `src/server/routes/gis.ts:151` |
| GET | `/api/gis/sessions` | `src/server/routes/gis.ts:164` |
| GET | `/api/gis/sessions/:id` | `src/server/routes/gis.ts:168` |
| POST | `/api/health/ask` | `src/server/routes/health.ts:7` |
| POST | `/api/health/anatomy` | `src/server/routes/health.ts:11` |
| POST | `/api/health/fitness` | `src/server/routes/health.ts:15` |
| POST | `/api/health/nutrition` | `src/server/routes/health.ts:19` |
| POST | `/api/health/red-flags` | `src/server/routes/health.ts:23` |
| POST | `/api/health/medication` | `src/server/routes/health.ts:27` |
| POST | `/api/history/ask` | `src/server/routes/history.ts:6` |
| POST | `/api/history/timeline` | `src/server/routes/history.ts:7` |
| POST | `/api/history/compare` | `src/server/routes/history.ts:8` |
| POST | `/api/history/primary-sources` | `src/server/routes/history.ts:9` |
| GET | `/api/knowledge-base/stats` | `src/server/routes/knowledge-base.ts:7` |
| POST | `/api/knowledge-online/miss` | `src/server/routes/knowledge-online.ts:14` |
| POST | `/api/knowledge-online/check` | `src/server/routes/knowledge-online.ts:18` |
| POST | `/api/knowledge-online/search` | `src/server/routes/knowledge-online.ts:34` |
| POST | `/api/knowledge-online/search-and-ingest` | `src/server/routes/knowledge-online.ts:40` |
| POST | `/api/knowledge-online/ingest` | `src/server/routes/knowledge-online.ts:60` |
| DELETE | `/api/knowledge-online/ingest/:ingestionId` | `src/server/routes/knowledge-online.ts:70` |
| GET | `/api/knowledge-os/summary` | `src/server/routes/knowledge-os.ts:15` |
| POST | `/api/knowledge-os/entities/link` | `src/server/routes/knowledge-os.ts:37` |
| GET | `/api/knowledge-os/entities/search` | `src/server/routes/knowledge-os.ts:49` |
| GET | `/api/knowledge-os/entities/stats` | `src/server/routes/knowledge-os.ts:58` |
| POST | `/api/knowledge-os/graph/build` | `src/server/routes/knowledge-os.ts:62` |
| POST | `/api/knowledge-os/import/repositories` | `src/server/routes/knowledge-os.ts:80` |
| GET | `/api/knowledge-os/graph/stats` | `src/server/routes/knowledge-os.ts:111` |
| GET | `/api/knowledge-os/graph/export` | `src/server/routes/knowledge-os.ts:118` |
| GET | `/api/knowledge-os/wiki/pages` | `src/server/routes/knowledge-os.ts:136` |
| GET | `/api/knowledge-os/wiki/search` | `src/server/routes/knowledge-os.ts:140` |
| GET | `/api/knowledge-os/wiki/pages/:slug(*)` | `src/server/routes/knowledge-os.ts:148` |
| POST | `/api/knowledge-os/wiki/pages` | `src/server/routes/knowledge-os.ts:152` |
| POST | `/api/knowledge-os/wiki/ingest` | `src/server/routes/knowledge-os.ts:168` |
| POST | `/api/knowledge-os/memory/remember` | `src/server/routes/knowledge-os.ts:196` |
| GET | `/api/knowledge-os/memory/recall` | `src/server/routes/knowledge-os.ts:214` |
| POST | `/api/knowledge-os/memory/:id/approval` | `src/server/routes/knowledge-os.ts:224` |
| GET | `/api/knowledge-os/memory/stats` | `src/server/routes/knowledge-os.ts:231` |
| POST | `/api/knowledge-os/db/ask` | `src/server/routes/knowledge-os.ts:235` |
| POST | `/api/knowledge-os/db/query` | `src/server/routes/knowledge-os.ts:243` |
| GET | `/api/knowledge-os/db/schema` | `src/server/routes/knowledge-os.ts:251` |
| POST | `/api/knowledge-os/governance/evidence` | `src/server/routes/knowledge-os.ts:255` |
| GET | `/api/knowledge-os/governance/evidence` | `src/server/routes/knowledge-os.ts:269` |
| POST | `/api/knowledge-os/governance/golden-tasks` | `src/server/routes/knowledge-os.ts:273` |
| POST | `/api/language/ask` | `src/server/routes/language.ts:7` |
| POST | `/api/language/translate` | `src/server/routes/language.ts:11` |
| POST | `/api/language/rewrite` | `src/server/routes/language.ts:15` |
| POST | `/api/language/rhetoric` | `src/server/routes/language.ts:19` |
| POST | `/api/language/speech` | `src/server/routes/language.ts:23` |
| POST | `/api/legal/ask` | `src/server/routes/legal.ts:7` |
| POST | `/api/legal/contract` | `src/server/routes/legal.ts:11` |
| POST | `/api/legal/risk` | `src/server/routes/legal.ts:15` |
| POST | `/api/legal/civic` | `src/server/routes/legal.ts:19` |
| GET | `/api/local-tools/detect` | `src/server/routes/local-tools.ts:18` |
| GET | `/api/local-tools/executables` | `src/server/routes/local-tools.ts:22` |
| POST | `/api/local-tools/executables` | `src/server/routes/local-tools.ts:26` |
| POST | `/api/local-tools/run/plan` | `src/server/routes/local-tools.ts:45` |
| POST | `/api/local-tools/run/start-approved` | `src/server/routes/local-tools.ts:64` |
| GET | `/api/local-tools/runs` | `src/server/routes/local-tools.ts:73` |
| POST | `/api/local-tools/runs/:runId/approve` | `src/server/routes/local-tools.ts:77` |
| POST | `/api/local-tools/runs/:runId/start` | `src/server/routes/local-tools.ts:83` |
| POST | `/api/local-tools/runs/:runId/cancel` | `src/server/routes/local-tools.ts:92` |
| GET | `/api/local-tools/runs/:runId/files` | `src/server/routes/local-tools.ts:113` |
| GET | `/api/local-tools/runs/:runId/files/:fileName` | `src/server/routes/local-tools.ts:137` |
| POST | `/api/market/analyze` | `src/server/routes/market.ts:7` |
| POST | `/api/market/backtest` | `src/server/routes/market.ts:11` |
| POST | `/api/market/filing` | `src/server/routes/market.ts:15` |
| POST | `/api/market/macro` | `src/server/routes/market.ts:19` |
| POST | `/api/math/ask` | `src/server/routes/math.ts:7` |
| POST | `/api/math/solve` | `src/server/routes/math.ts:11` |
| POST | `/api/math/verify` | `src/server/routes/math.ts:15` |
| POST | `/api/music/mix/analyze` | `src/server/routes/music.ts:17` |
| POST | `/api/music/mix/plan` | `src/server/routes/music.ts:21` |
| POST | `/api/music/mix/apply` | `src/server/routes/music.ts:25` |
| POST | `/api/music/mix/revise` | `src/server/routes/music.ts:29` |
| POST | `/api/music/mix/master` | `src/server/routes/music.ts:33` |
| POST | `/api/music/ask` | `src/server/routes/music.ts:37` |
| POST | `/api/music/suno` | `src/server/routes/music.ts:40` |
| POST | `/api/music/fl-studio` | `src/server/routes/music.ts:43` |
| POST | `/api/music/pro-tools` | `src/server/routes/music.ts:46` |
| POST | `/api/music/logic` | `src/server/routes/music.ts:49` |
| POST | `/api/music/beat` | `src/server/routes/music.ts:52` |
| POST | `/api/music/mix` | `src/server/routes/music.ts:55` |
| POST | `/api/music/master` | `src/server/routes/music.ts:58` |
| POST | `/api/music/arrangement` | `src/server/routes/music.ts:61` |
| POST | `/api/music/daw-translate` | `src/server/routes/music.ts:64` |
| POST | `/api/music/theory` | `src/server/routes/music.ts:67` |
| POST | `/api/music/genre-timeline` | `src/server/routes/music.ts:70` |
| POST | `/api/music/arrangement-review` | `src/server/routes/music.ts:73` |
| POST | `/api/philosophy/ask` | `src/server/routes/philosophy.ts:7` |
| POST | `/api/philosophy/argument` | `src/server/routes/philosophy.ts:11` |
| POST | `/api/philosophy/debate` | `src/server/routes/philosophy.ts:15` |
| POST | `/api/philosophy/ethics` | `src/server/routes/philosophy.ts:19` |
| POST | `/api/plans` | `src/server/routes/plans.ts:10` |
| GET | `/api/plans` | `src/server/routes/plans.ts:24` |
| GET | `/api/plans/:planId` | `src/server/routes/plans.ts:28` |
| POST | `/api/plans/:planId/load` | `src/server/routes/plans.ts:34` |
| POST | `/api/pop-culture/ask` | `src/server/routes/pop-culture.ts:6` |
| POST | `/api/pop-culture/timeline` | `src/server/routes/pop-culture.ts:7` |
| POST | `/api/pop-culture/franchise` | `src/server/routes/pop-culture.ts:8` |
| POST | `/api/pop-culture/compare` | `src/server/routes/pop-culture.ts:9` |
| POST | `/api/rag/query` | `src/server/routes/rag-query.ts:8` |
| POST | `/api/science/ask` | `src/server/routes/science.ts:6` |
| POST | `/api/science/invention` | `src/server/routes/science.ts:7` |
| POST | `/api/science/timeline` | `src/server/routes/science.ts:8` |
| POST | `/api/science/papers` | `src/server/routes/science.ts:9` |
| POST | `/api/science/patents` | `src/server/routes/science.ts:10` |
| GET | `/api/sec/status` | `src/server/routes/sec.ts:11` |
| GET | `/api/sec/companies/search` | `src/server/routes/sec.ts:15` |
| GET | `/api/sec/live/tickers` | `src/server/routes/sec.ts:21` |
| GET | `/api/sec/live/submissions/:cik` | `src/server/routes/sec.ts:25` |
| GET | `/api/sec/live/facts/:cik` | `src/server/routes/sec.ts:31` |
| POST | `/api/sec/ingest/plan` | `src/server/routes/sec.ts:37` |
| POST | `/api/sec/ingest/company/cik/:cik` | `src/server/routes/sec.ts:45` |
| POST | `/api/sec/ingest/company/ticker/:ticker` | `src/server/routes/sec.ts:57` |
| POST | `/api/sec/ingest/queue` | `src/server/routes/sec.ts:69` |
| GET | `/api/sec/ingest/queue` | `src/server/routes/sec.ts:80` |
| POST | `/api/sec/ingest/recover-stale` | `src/server/routes/sec.ts:86` |
| POST | `/api/sec/ingest/process` | `src/server/routes/sec.ts:90` |
| POST | `/api/sec/filings/parse` | `src/server/routes/sec.ts:97` |
| POST | `/api/security/ask` | `src/server/routes/security.ts:7` |
| POST | `/api/security/review-code` | `src/server/routes/security.ts:11` |
| POST | `/api/security/threat-model` | `src/server/routes/security.ts:15` |
| POST | `/api/security/privacy` | `src/server/routes/security.ts:19` |
| POST | `/api/security/dependencies` | `src/server/routes/security.ts:23` |
| GET | `/api/settings` | `src/server/routes/settings.ts:43` |
| PUT | `/api/settings` | `src/server/routes/settings.ts:64` |
| GET | `/providers` | `src/server/routes/setup.ts:19` |
| GET | `/providers/free` | `src/server/routes/setup.ts:40` |
| GET | `/provider/:id` | `src/server/routes/setup.ts:59` |
| POST | `/key/:provider` | `src/server/routes/setup.ts:171` |
| DELETE | `/key/:provider` | `src/server/routes/setup.ts:212` |
| GET | `/status` | `src/server/routes/setup.ts:233` |
| GET | `/guide` | `src/server/routes/setup.ts:266` |
| POST | `/import` | `src/server/routes/setup.ts:278` |
| GET | `/export` | `src/server/routes/setup.ts:306` |
| GET | `/embed/:provider` | `src/server/routes/setup.ts:317` |
| POST | `/api/sixsigma/ask` | `src/server/routes/sixsigma.ts:7` |
| POST | `/api/sixsigma/calculate` | `src/server/routes/sixsigma.ts:11` |
| POST | `/api/sixsigma/project` | `src/server/routes/sixsigma.ts:15` |
| POST | `/api/sixsigma/certification` | `src/server/routes/sixsigma.ts:19` |
| POST | `/api/sixsigma/simulate` | `src/server/routes/sixsigma.ts:23` |
| POST | `/api/sixsigma/export` | `src/server/routes/sixsigma.ts:27` |
| POST | `/api/sixsigma/study-plan` | `src/server/routes/sixsigma.ts:31` |
| GET | `/api/sprite-lab/status` | `src/server/routes/sprite-lab.ts:15` |
| POST | `/api/sprite-lab/plan` | `src/server/routes/sprite-lab.ts:19` |
| POST | `/api/sprite-lab/external/plan` | `src/server/routes/sprite-lab.ts:31` |
| POST | `/api/sprite-lab/external/run` | `src/server/routes/sprite-lab.ts:52` |
| POST | `/api/sprite-lab/internal/slice-grid` | `src/server/routes/sprite-lab.ts:76` |
| POST | `/api/sprite-lab/internal/palette` | `src/server/routes/sprite-lab.ts:87` |
| POST | `/api/sprite-lab/internal/manifest` | `src/server/routes/sprite-lab.ts:100` |
| POST | `/api/story/ask` | `src/server/routes/story.ts:7` |
| POST | `/api/story/plot` | `src/server/routes/story.ts:11` |
| POST | `/api/story/character` | `src/server/routes/story.ts:15` |
| POST | `/api/story/worldbuild` | `src/server/routes/story.ts:19` |
| POST | `/api/story/dialogue` | `src/server/routes/story.ts:23` |
| POST | `/api/story/continuity` | `src/server/routes/story.ts:27` |
| GET | `/api/tool-catalog` | `src/server/routes/toolCatalog.ts:11` |
| GET | `/api/tool-catalog/stats` | `src/server/routes/toolCatalog.ts:19` |
| POST | `/chat` | `src/server/routes/v1/chat.ts:14` |
| POST | `/chat` | `src/server/routes/v2/chat.ts:16` |
| POST | `/chat/stream` | `src/server/routes/v2/chat.ts:36` |

## Client panels and workspaces

- `client/src/components/AudioPreviewBrowser.tsx`
- `client/src/components/CodeWorkflowPanel.tsx`
- `client/src/components/ConversationToolsPanel.tsx`
- `client/src/components/CreativeComposerPanel.tsx`
- `client/src/components/FLStudioControlPanel.tsx`
- `client/src/components/FileExplorerPanel.tsx`
- `client/src/components/GamingPlaybookPanel.tsx`
- `client/src/components/KnowledgeOSPanel.tsx`
- `client/src/components/KnowledgeOnlinePanel.tsx`
- `client/src/components/LocalRunApprovalPanel.tsx`
- `client/src/components/LocalToolsWorkspace.tsx`
- `client/src/components/SettingsMenu.tsx`
- `client/src/components/SpriteLabPanel.tsx`
- `client/src/features/gis/GISMapPanel.tsx`

## Environment variables

- `ALLOW_PRIVATE_WEBHOOK_URLS`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `API_KEY_ENCRYPTION_SECRET`
- `ASSEMBLYAI_API_KEY`
- `BASE_URL`
- `BING_API_KEY`
- `BLACKBELT_SOURCE_DIR`
- `BRANCH_PROTECTION_TOKEN`
- `CARTESIA_API_KEY`
- `CEREBRAS_API_KEY`
- `CEREBRAS_MODEL`
- `CLAUDE_MODEL`
- `CODE_EXECUTOR_TIMEOUT`
- `COHERE_API_KEY`
- `COHERE_MODEL`
- `COMICVINE_API_KEY`
- `CORS_ORIGIN`
- `CSRF_TOKEN`
- `CUDA_VISIBLE_DEVICES`
- `DATABASE_URL`
- `DEBUG_MODE`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `DISK_CACHE_DIR`
- `EAGER_CODING_KNOWLEDGE_LOAD`
- `EAGER_KNOWLEDGE_LOAD`
- `ELEVENLABS_API_KEY`
- `EMBEDDING_MODEL`
- `EMBEDDING_PROVIDER`
- `EMBEDDING_USE_TRANSFORMERS`
- `ENABLE_AGENT_PATCH_APPLY`
- `ENABLE_BASH_EXECUTOR`
- `ENABLE_DISK_CACHE`
- `ENABLE_ENSEMBLE`
- `ENABLE_FILE_LOGGING`
- `ENABLE_MODEL_ROUTING`
- `ENABLE_RAG`
- `ENABLE_REDIS_CACHE`
- `ENABLE_SAFETY_PIPELINE`
- `ENABLE_SEMANTIC_CACHE`
- `ENABLE_TOOL_CALLING`
- `ENABLE_WEBSOCKET`
- `EUROPEANA_API_KEY`
- `EVAL_TARGET_URL`
- `FILE_SEARCH_MAX_CONTENT_BYTES`
- `FILE_SEARCH_MAX_FILES`
- `FL_STUDIO_MCP_ARGS`
- `FL_STUDIO_MCP_COMMAND`
- `FL_STUDIO_MCP_CWD`
- `FRED_API_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GENERAL_CORPUS_DELAY_MS`
- `GENERAL_CORPUS_LIMIT`
- `GENERAL_CORPUS_RETRIES`
- `GENERAL_CORPUS_RETRY_DELAY_MS`
- `GENERAL_CORPUS_TOPICS`
- `GENERAL_CORPUS_YEAR_EVENTS`
- `GIS_ARCGIS_PARCEL_LAYER_URL`
- `GIS_DEFAULT_CENTER_LAT`
- `GIS_DEFAULT_CENTER_LNG`
- `GIS_GEOCODER_PROVIDER`
- `GIS_PARCEL_PROVIDER`
- `GIS_PROVIDER_CACHE_TTL_SECONDS`
- `GIS_REDACT_EXACT_ADDRESSES`
- `GIS_ROUTING_PROVIDER`
- `GITHUB_BRANCH`
- `GITHUB_PAGES`
- `GITHUB_REPOSITORY`
- `GITHUB_TOKEN`
- `GOOGLE_API_KEY`
- `GOOGLE_BOOKS_API_KEY`
- `GOOGLE_CSE_ID`
- `GPT4V_MODEL`
- `GPU_AVAILABLE`
- `GPU_MEMORY_MB`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GROUNDING_MODE`
- `GROUNDING_REQUIRED_COVERAGE`
- `GUARDIAN_API_KEY`
- `HUGGINGFACE_API_KEY`
- `HUGGINGFACE_MODEL`
- `JWT_SECRET`
- `KNOWLEDGE_BASE_DIR`
- `KNOWLEDGE_GRAPH_MAX_FILES`
- `LLAVA_MODEL`
- `LLM_PROVIDER`
- `LOCAL_KNOWLEDGE_WIKI_DIR`
- `LOGS_DIR`
- `LOG_LEVEL`
- `NEWS_API_KEY`
- `NODE_ENV`
- `NODE_OPTIONS`
- `NVIDIA_VISIBLE_DEVICES`
- `NYTIMES_API_KEY`
- `OLLAMA_MODEL`
- `OLLAMA_URL`
- `OMDB_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_COMPATIBLE_API_KEY`
- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_MODEL`
- `OPENAI_COMPATIBLE_PROVIDER_NAME`
- `OPENAI_MODEL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OSRM_BASE_URL`
- `PATH`
- `PIXELORAMA_CLI_ARGS_JSON`
- `POLYGON_API_KEY`
- `PORT`
- `PUBLIC_KNOWLEDGE_BASE_DIR`
- `RAG_CHUNK_SIZE`
- `RAG_DATABASE_URL`
- `RAG_GENERATE_EMBEDDINGS`
- `RAG_PERSISTENCE`
- `RAG_RETRIEVAL_MODE`
- `RAG_SQLITE_PATH`
- `RATE_LIMIT_FAIL_OPEN`
- `RATE_LIMIT_MAX_REQUESTS`
- `RATE_LIMIT_WINDOW_MS`
- `REDIS_URL`
- `REQUEST_READY_TIMEOUT_MS`
- `RERANKER_MODE`
- `SEARCH_API_KEY`
- `SEARCH_ENGINE`
- `SEC_MAX_REQUESTS_PER_SECOND`
- `SEC_QUEUE_MAX_ITEMS`
- `SEC_USER_AGENT`
- `SEMANTIC_CACHE_SIMILARITY_THRESHOLD`
- `SEMANTIC_CACHE_TTL`
- `SIXSIGMA_ANALYSIS_API_KEY`
- `SIXSIGMA_ANALYSIS_API_URL`
- `SMITHSONIAN_API_KEY`
- `STACKOVERFLOW_API_KEY`
- `STARTUP_TIMEOUT_MS`
- `TEMP`
- `TMDB_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `USERPROFILE`
- `USE_GEMINI_VISION`
- `USE_GPT4V`
- `USE_HUGGINGFACE`
- `USE_LLAVA`
- `USE_OLLAMA`
- `VITE_PUBLIC_API_BASE_URL`
- `VITE_RUNTIME_MODE`
- `WIKIPEDIA_API_BASE`
- `YOUTUBE_API_KEY`

## External binaries

- `git` — `src/core/tools/RepoTools.ts`

## Files above 300 lines

| File | Lines |
|---|---|
| `client/src/components/AssistantChat.tsx` | 649 |
| `client/src/components/CreativeComposerPanel.tsx` | 456 |
| `client/src/components/FLStudioControlPanel.tsx` | 622 |
| `client/src/components/KnowledgeOSPanel.tsx` | 313 |
| `client/src/components/ModeSelector.tsx` | 393 |
| `client/src/components/SettingsMenu.tsx` | 495 |
| `client/src/components/SpriteLabPanel.tsx` | 378 |
| `docs/extract_all_snippets.js` | 364 |
| `scripts/import-wikipedia-general-corpus.ts` | 337 |
| `src/core/agents/AgentTeam.ts` | 547 |
| `src/core/agents/MultiAgentOrchestrator.ts` | 1269 |
| `src/core/agents/ReasoningController.ts` | 368 |
| `src/core/analytics/AnalyticsService.ts` | 448 |
| `src/core/audio/AudioLibraryService.ts` | 458 |
| `src/core/automation/AutoDrive.ts` | 497 |
| `src/core/browser/BrowserAgent.ts` | 388 |
| `src/core/config/APIKeyManager.ts` | 644 |
| `src/core/config/ProfileManager.ts` | 434 |
| `src/core/contracts/UniversalContract.ts` | 321 |
| `src/core/creative/CreativeWritingAgent.ts` | 345 |
| `src/core/database/Database.ts` | 519 |
| `src/core/database/ExpansionMigrations.ts` | 383 |
| `src/core/gis/GISService.ts` | 581 |
| `src/core/graph/KnowledgeGraphIndexer.ts` | 319 |
| `src/core/initialization/ServiceInitializer.ts` | 822 |
| `src/core/knowledge/GitHubSource.ts` | 323 |
| `src/core/knowledge/LocalKnowledgeAnswerer.ts` | 384 |
| `src/core/knowledge/QueryEnhancer.ts` | 440 |
| `src/core/knowledge/ScientificPapersSource.ts` | 325 |
| `src/core/learning/ModelUpdater.ts` | 339 |
| `src/core/memory/GraphMemory.ts` | 580 |
| `src/core/memory/ProjectContext.ts` | 536 |
| `src/core/multimodal/ImageProcessor.ts` | 607 |
| `src/core/multimodal/VideoProcessor.ts` | 591 |
| `src/core/notifications/TwilioAdapter.ts` | 360 |
| `src/core/orchestrator/EnhancedOrchestrator.ts` | 564 |
| `src/core/orchestrator/Orchestrator.ts` | 375 |
| `src/core/personalization/UserProfiler.ts` | 493 |
| `src/core/providers/DeviceAdapter.ts` | 353 |
| `src/core/providers/LLMAdapter.ts` | 316 |
| `src/core/providers/ModelRouter.ts` | 358 |
| `src/core/providers/VisionAdapter.ts` | 375 |
| `src/core/quality/AutoReview.ts` | 398 |
| `src/core/rag/AudioRAG.ts` | 422 |
| `src/core/rag/CorrectiveRetriever.ts` | 460 |
| `src/core/rag/HybridRetriever.ts` | 392 |
| `src/core/rag/RAGDocumentStore.ts` | 403 |
| `src/core/rag/RAGRouter.ts` | 368 |
| `src/core/rag/TrustRAG.ts` | 368 |
| `src/core/rag/VideoRAG.ts` | 443 |
| `src/core/safety/ApprovalPolicy.ts` | 338 |
| `src/core/safety/SandboxController.ts` | 438 |
| `src/core/scheduler/TaskScheduler.ts` | 447 |
| `src/core/sec/SECService.ts` | 406 |
| `src/core/sprite-lab/SpriteExternalToolAdapter.ts` | 348 |
| `src/core/tools/WebSearcher.ts` | 452 |
| `src/core/tools/catalog/ToolCatalogService.ts` | 419 |
| `src/core/ui/ThinkingUI.ts` | 394 |
| `src/core/voice/VoiceAgent.ts` | 437 |
| `src/server/index.ts` | 1145 |
| `src/server/routes/admin.ts` | 317 |
| `src/server/routes/legacy-chat.ts` | 316 |
| `src/server/routes/setup.ts` | 437 |
