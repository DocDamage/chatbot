# Local Tool + SEC Database Expansion Plan

Status: Planned
Owner: DocDamage/chatbot
Scope: Full-scale required expansion
Created: 2026-05-21

This file is intentionally separate from `docs/RELEASE_COMPLETION_AUDIT.md`. It is a feature expansion plan, not a release audit.

## Locked decisions

The following decisions are locked based on the requested direction:

1. The chatbot must include SEC database work.
2. The SEC module must target full SEC filing intelligence, not only 10-Ks.
3. SEC ingestion must be full scale.
4. SEC history depth must be all available history where technically accessible.
5. The open-source / free-tool knowledge database must be included.
6. Tool records must be editable from the UI.
7. The chatbot must support local executable tools.
8. The chatbot must support any local tool the user explicitly approves, not only a fixed list.
9. The local tool system must prioritize the easiest path for the user.
10. Aseprite must be embedded as a first-class sprite workflow integration.
11. The Aseprite integration is for private local use.
12. Aseprite fallback behavior must support Aseprite, LibreSprite, Pixelorama, and internal image tooling.
13. Audio/beatmaking must be full local assistant depth, not advisor-only.
14. Game development support must cover all target engines: Keter/MonoGame, Godot, RPG Maker MZ/MV, Unity, Unreal, and generic engine workflows.
15. Education support must include general learning, coding bootcamp replacement, test prep, DDS/certification prep, and study-path generation.

## Existing repo baseline

The repo already provides a strong base for this expansion:

- Node + TypeScript backend.
- Express API server.
- React + Vite client.
- Static GitHub Pages client build support.
- Local backend mode for full tool execution.
- RAG service.
- Document manager.
- SQLite local fallback.
- PostgreSQL support.
- pgvector migration support for PostgreSQL.
- Tool registry.
- Function caller.
- Code executor.
- Command runner.
- File explorer API.
- Audio preview/analyze API.
- Knowledge OS routes.
- Specialist modes for market, business, engineering, game dev, gaming, music, security, science, history, story, and more.

The expansion must build on these systems instead of replacing them.

## Non-negotiable architecture split

### GitHub Pages mode

GitHub Pages must remain static and safe:

- Static UI/demo.
- Public docs.
- No local file access.
- No private database access.
- No local executable access.
- No SEC ingestion jobs.
- No Aseprite/Blender/Godot/FreeCAD/KiCad execution.

### Local mode

The local app is the full system:

- Local database.
- RAG indexing.
- SEC ingestion.
- Tool execution.
- File browser.
- Audio browser.
- Sprite Lab.
- 3D Asset Lab.
- Engineering Lab.
- Local installers/build helpers.
- Private Aseprite bundle/import support.

## Database strategy

### Required database tiers

1. SQLite remains the zero-config local fallback.
2. PostgreSQL + pgvector becomes the required full-scale mode.
3. Docker Compose must provide an easy local PostgreSQL + pgvector setup.
4. Redis remains useful for cache/queue coordination where enabled.
5. Large raw filing/document storage must live outside Git under ignored folders.

### Required data roots

```text
/data/chatbot.db
/data/sec/
/data/sec/raw/
/data/sec/html/
/data/sec/xbrl/
/data/sec/bulk/
/data/sec/normalized/
/data/tools/
/data/tools/private-bundles/
/data/tools/executables/
/data/sprite-lab/
/data/audio-lab/
```

These folders must be ignored by Git unless they contain tiny sample fixtures.

## SEC full filing intelligence module

### Required end state

The SEC module must become a full filings intelligence module, not a small 10-K helper.

Required forms:

- 10-K and variants.
- 10-Q and variants.
- 8-K.
- 20-F.
- 40-F.
- 6-K.
- S-1 and major registration statements.
- DEF 14A proxy statements.
- Forms 3, 4, 5 ownership filings.
- 13F.
- SC 13D / SC 13G.
- Other forms supported by EDGAR metadata once the ingestion framework is stable.

### Required SEC capabilities

- Company lookup by ticker, name, CIK, exchange, and aliases.
- Filing metadata ingestion.
- Filing document download.
- Bulk archive ingestion.
- Incremental daily refresh.
- Full available history ingestion.
- XBRL company facts ingestion.
- XBRL company concept lookup.
- XBRL frames support.
- HTML filing section extraction.
- Inline XBRL extraction.
- Risk factor extraction.
- MD&A extraction.
- Business section extraction.
- Legal proceedings extraction.
- Controls/procedures extraction.
- Financial statements extraction.
- Filing comparison across years.
- Company-to-company comparison.
- Watchlists.
- Full-text search.
- Vector search.
- Hybrid search.
- Exact source citations.
- Saved report generation.
- Scheduled refresh jobs.
- Rate limiting.
- SEC-compliant User-Agent configuration.
- Error/retry/audit logs.

### SEC ingestion scale model

The module must support four scale tiers:

1. Manual ticker/company ingestion.
2. Watchlist ingestion.
3. Index ingestion, such as S&P 500 / Russell 3000 if source list is available.
4. Full SEC bulk ingestion.

The final goal is tier 4. The implementation can stage the build by tier, but the target is not optional.

### Required SEC tables

```text
sec_companies
- id
- cik
- cik_padded
- ticker
- name
- legal_name
- former_names_json
- sic
- sic_description
- exchange
- fiscal_year_end
- entity_type
- metadata_json
- created_at
- updated_at

sec_filings
- id
- company_id
- cik
- accession_number
- form_type
- filing_date
- report_date
- acceptance_datetime
- act
- file_number
- film_number
- primary_document
- primary_document_url
- filing_detail_url
- local_raw_path
- local_html_path
- local_text_path
- local_xbrl_path
- content_hash
- ingest_status
- metadata_json
- created_at
- updated_at

sec_filing_documents
- id
- filing_id
- sequence
- filename
- description
- document_type
- url
- local_path
- content_type
- content_hash
- size_bytes
- created_at

sec_filing_sections
- id
- filing_id
- item_code
- item_title
- section_order
- section_text
- start_offset
- end_offset
- confidence
- parser_version
- created_at

sec_filing_chunks
- id
- filing_id
- section_id
- chunk_index
- content
- token_count
- metadata_json
- created_at

sec_xbrl_facts
- id
- company_id
- filing_id
- accession_number
- taxonomy
- concept
- label
- description
- unit
- value_numeric
- value_text
- period_start
- period_end
- fiscal_year
- fiscal_period
- form_type
- frame
- filed_date
- metadata_json
- created_at

sec_watchlists
- id
- name
- description
- created_at
- updated_at

sec_watchlist_companies
- watchlist_id
- company_id
- created_at

sec_ingestion_runs
- id
- run_type
- scope
- status
- started_at
- completed_at
- files_seen
- files_downloaded
- filings_parsed
- chunks_created
- facts_created
- error_count
- errors_json
- metadata_json

sec_source_citations
- id
- filing_id
- chunk_id
- company_id
- citation_label
- source_url
- local_path
- quoted_text
- metadata_json
- created_at
```

### SEC UI panels

Required UI:

- SEC Research panel.
- Company lookup box.
- Filing browser.
- Form filters.
- Year range filters.
- Section selector.
- XBRL facts viewer.
- Company comparison view.
- Watchlist manager.
- Ingestion job monitor.
- Citation inspector.
- Export report button.

## Open-source / free-tool database

### Required purpose

The chatbot must know expensive tools, free/open-source alternatives, source-available alternatives, licensing caveats, install methods, supported platforms, and actual tool integrations.

### Required records

Initial records must include at least:

Data/science/engineering:

- Python.
- NumPy.
- SciPy.
- Jupyter.
- GNU Octave.
- R.
- Jamovi.
- JASP.
- FreeCAD.
- KiCad.
- OpenModelica.
- Scilab.

Creative/game/audio:

- Blender.
- Godot.
- MonoGame.
- RPG Maker MZ/MV tooling.
- Unity.
- Unreal.
- Ardour.
- LMMS.
- Audacity.
- Reaper as cheap/non-open-source but useful.
- Aseprite.
- LibreSprite.
- Pixelorama.
- Piskel.
- Krita.
- GIMP.
- Inkscape.
- FFmpeg.
- ImageMagick.

Education:

- Khan Academy.
- MIT OpenCourseWare.
- freeCodeCamp.
- The Odin Project.
- CS50.
- OpenStax.
- Kaggle Learn.
- DDS/certification prep records where user provides/approves sources.

Software/devops/business/security:

- Git.
- GitHub.
- GitLab CE.
- Docker.
- PostgreSQL.
- MySQL Community.
- MongoDB Community.
- Redis.
- SQLite.
- Bitwarden.
- Odoo Community.
- Magento Open Source.
- RHEL alternatives such as Fedora/CentOS Stream/Rocky/Alma context.

### Required tables

```text
tool_catalog
- id
- name
- slug
- category
- subcategory
- description
- replaces_paid_tools_json
- comparable_tools_json
- open_source_status
- license
- license_url
- cost_model
- platforms_json
- official_url
- source_url
- install_methods_json
- executable_names_json
- cli_support
- api_support
- best_for_json
- not_good_for_json
- difficulty_level
- integration_status
- integration_module
- trust_level
- last_verified_at
- metadata_json
- created_at
- updated_at

tool_capabilities
- id
- tool_id
- capability_key
- capability_name
- description
- input_types_json
- output_types_json
- requires_executable
- requires_network
- risk_level
- created_at

tool_replacement_maps
- id
- paid_tool_name
- paid_tool_category
- free_tool_id
- fit_score
- replacement_type
- tradeoffs_json
- notes
- created_at

tool_install_profiles
- id
- tool_id
- os
- package_manager
- install_command
- detection_paths_json
- env_vars_json
- verification_command
- created_at

tool_user_overrides
- id
- user_id
- tool_id
- executable_path
- enabled
- trust_level
- approval_policy
- notes
- created_at
- updated_at
```

## Local executable system

### Required local tool bridge

Add a new local tool bridge with these responsibilities:

- Detect installed executables.
- Store approved executable paths.
- Support user-specified tools.
- Support private local bundles.
- Run commands with typed templates.
- Capture stdout/stderr/files.
- Enforce timeouts.
- Enforce workspace sandboxing.
- Require approval based on risk.
- Produce dry-run previews.
- Store audit logs.
- Expose status in UI.

### Required executable registry tables

```text
local_executables
- id
- tool_id
- name
- executable_path
- executable_version
- os
- detected
- detection_method
- enabled
- trust_level
- approval_policy
- last_checked_at
- metadata_json
- created_at
- updated_at

local_tool_runs
- id
- tool_id
- executable_id
- user_id
- command_template
- resolved_command_json
- cwd
- status
- exit_code
- stdout_path
- stderr_path
- output_files_json
- started_at
- completed_at
- duration_ms
- risk_level
- approved_by_user
- metadata_json
```

### Required approval policy

Approval policy must support:

- Always ask.
- Ask once per session.
- Remember safe tools.
- Always ask for destructive or expensive operations.
- Always ask before installers modify the system.
- Always audit external executable runs.

## Aseprite embedded sprite workflow

### Required behavior

Aseprite must be treated as the primary sprite workflow tool.

Required support:

- Detect installed Aseprite.
- Detect Steam Aseprite path.
- Detect portable Aseprite path.
- Let user manually set Aseprite path.
- Support private local bundle/import folder.
- Support local build-from-source helper.
- Run Aseprite CLI commands.
- Inspect `.ase` and `.aseprite` files where possible.
- Export spritesheets.
- Export frame sequences.
- Export JSON animation data.
- Export tags.
- Export layers.
- Extract palettes.
- Enforce palettes.
- Generate animation manifests.
- Batch resize/regrid sprites.
- Slice sprite sheets.
- Validate frame alignment.
- Validate animation coverage.
- Integrate with APES-style sprite workflows.

### Private bundle model

The repo must not commit compiled third-party binaries.

For private use, the local app may support:

```text
/data/tools/private-bundles/aseprite/
/local-tools/aseprite/        # gitignored
```

The setup wizard should provide the easiest path:

1. Detect an existing Aseprite installation.
2. Let the user point to `aseprite.exe` or equivalent.
3. Let the user import a private portable folder.
4. Let the user run a build-from-source helper locally.
5. Store the executable path in local database user settings.
6. Never commit the binary to GitHub.

### Aseprite fallback chain

Required fallback order:

1. Aseprite.
2. LibreSprite.
3. Pixelorama.
4. Internal Sharp/PNG tooling.
5. Internal Python image tooling where needed.

If one fails, the next available fallback must pick up the operation when technically possible.

### Sprite Lab UI

Required UI:

- Sprite Lab panel.
- Tool status: Aseprite / LibreSprite / Pixelorama / internal.
- File picker integration.
- Sprite preview.
- Grid overlay.
- Frame slicer.
- Animation tag viewer.
- Palette viewer.
- Export settings.
- Batch operation queue.
- Manifest output viewer.
- Error/fallback report.

## Blender bridge

Required support:

- Detect Blender.
- Run Blender headless scripts.
- Convert GLB/GLTF/FBX/OBJ where supported.
- Generate thumbnails/renders.
- Validate meshes.
- Inspect materials/textures.
- Batch optimize assets.
- Export game-ready versions.
- Generate import reports.
- Integrate with Game Dev and 3D Asset Lab panels.

## Godot bridge

Required support:

- Detect Godot.
- Create project templates.
- Create scenes.
- Generate scripts.
- Validate project structure.
- Run import checks.
- Run headless tests where possible.
- Generate plugins/tools.
- Support 2D RPG, 3D prototype, visual-novel, and asset-preview templates.

## MonoGame / Keter bridge

Required support:

- Detect dotnet.
- Detect MonoGame project files.
- Run build/test commands.
- Validate Content folder.
- Validate MGCB content references.
- Generate scene templates.
- Generate shader/content pipeline helper scripts.
- Support KeterEngine-specific workflows.

## RPG Maker MZ/MV bridge

Required support:

- Inspect project structure.
- Inspect plugin list.
- Generate plugin skeletons.
- Validate plugin headers.
- Validate event data JSON.
- Generate event design docs.
- Support Smart Event Director, 4th-wall effects, and Revengence/Nemesis-like plugin planning.

## Unity bridge

Required support:

- Detect Unity project.
- Inspect Assets/Packages/ProjectSettings.
- Generate C# scripts.
- Generate editor tooling skeletons.
- Validate common project structure.
- Avoid requiring Unity Hub automation at first unless user approves.

## Unreal bridge

Required support:

- Detect Unreal project.
- Inspect `.uproject`.
- Generate C++/Blueprint planning docs.
- Generate import pipeline docs.
- Generate automation scripts where safe.
- Support UE5 character/asset workflow planning.

## FreeCAD bridge

Required support:

- Detect FreeCAD.
- Generate FreeCAD Python macros.
- Create parametric primitive designs.
- Export STEP/STL/OBJ where supported.
- Generate measurement reports.
- Support engineering prototype workflows.

## KiCad bridge

Required support:

- Detect KiCad and `kicad-cli`.
- Inspect projects.
- Generate BOMs.
- Generate netlist/report helpers.
- Validate schematic/PCB paths.
- Export fabrication-style reports where supported.

## Python/R/Octave runners

### Python runner

Required support:

- Controlled scripts.
- Data analysis.
- SEC analysis.
- CSV/JSON transforms.
- Charts.
- Audio metadata helpers.
- Image processing helpers.
- Notebook-style future workflow.

### R runner

Required support:

- Rscript execution.
- Statistical summaries.
- Regression/anova support.
- CSV analysis.
- Report output.

### Octave runner

Required support:

- MATLAB-like numerical scripts.
- Matrix calculations.
- Engineering calculations.
- Plot/data export where possible.

## Audio / beatmaking module

Required end state: full local beatmaking assistant.

Required support:

- Audio file browser.
- Preview playback.
- Waveform view.
- BPM detection.
- Key detection where possible.
- Sample tagging.
- Sample-pack folder organization.
- Drum pattern generation.
- MIDI generation.
- Chord progression generation.
- Bassline/808 pattern generation.
- Arrangement maps.
- Exportable MIDI files.
- Exportable JSON arrangement files.
- FL Studio workflow guidance.
- Pro Tools workflow guidance.
- Logic workflow guidance.
- Ardour/LMMS/Audacity knowledge records.
- Plugin database records.

## Education module

Required scope:

- General learning.
- Coding bootcamp replacement.
- Test prep.
- DDS/certification prep.
- University-course alternatives.
- Study plans.
- Flashcards.
- Quizzes.
- Progress tracking.
- Source-backed curriculum records.

Required records:

- Khan Academy.
- MIT OpenCourseWare.
- freeCodeCamp.
- The Odin Project.
- CS50.
- OpenStax.
- Kaggle Learn.
- User-provided DDS/certification documents.

## UI expansion

Avoid adding too many new chat modes. The mode selector is already large.

Required panels instead:

- Local Tools panel.
- SEC Research panel.
- Tool Advisor panel.
- Sprite Lab panel.
- 3D Asset Lab panel.
- Engineering Lab panel.
- Education Builder panel.
- Ingestion Jobs panel.
- Executable Settings panel.

Modes can remain mostly existing:

- Market handles SEC financial questions.
- Business handles business/tool recommendations.
- Engineering handles CAD/KiCad/FreeCAD/Python/R/Octave.
- Game Dev handles engines.
- Music handles audio/beatmaking.
- Knowledge OS handles database/source governance.

## API route expansion

Required new route groups:

```text
/api/local-tools
/api/local-tools/detect
/api/local-tools/executables
/api/local-tools/run
/api/local-tools/runs
/api/sec
/api/sec/companies
/api/sec/filings
/api/sec/ingest
/api/sec/watchlists
/api/sec/search
/api/sec/compare
/api/sec/facts
/api/tools/catalog
/api/tools/replacements
/api/tools/install-profiles
/api/sprite-lab
/api/sprite-lab/export
/api/sprite-lab/slice
/api/sprite-lab/palette
/api/asset-lab/blender
/api/asset-lab/godot
/api/asset-lab/freecad
/api/asset-lab/kicad
/api/education
/api/education/plans
/api/education/quizzes
/api/education/flashcards
```

## Required implementation phases

Even though the target is full scale, the implementation must be staged so it can be verified.

### Phase 1 — foundation

- Add local tool database tables.
- Add tool catalog tables.
- Add SEC database tables.
- Add ignored local data folders.
- Add Docker Compose for PostgreSQL + pgvector + Redis.
- Add environment docs.
- Add migration tests.

### Phase 2 — local executable bridge

- Add `LocalToolRegistry`.
- Add `ExecutableDetector`.
- Add `LocalToolRunner`.
- Add run audit logging.
- Add approval policy.
- Add detection endpoints.
- Add executable settings UI.

### Phase 3 — SEC full-scale skeleton

- Add SEC service layer.
- Add SEC API client with User-Agent and rate limiter.
- Add company lookup.
- Add submissions ingestion.
- Add companyfacts ingestion.
- Add filing metadata storage.
- Add ingestion runs.
- Add SEC Research UI.

### Phase 4 — SEC document parsing

- Add filing document downloader.
- Add HTML/text extractor.
- Add item section extractor.
- Add chunking and embeddings.
- Add citations.
- Add exact filing search.
- Add vector/hybrid search.

### Phase 5 — SEC full-scale ingestion

- Add bulk ZIP ingestion.
- Add resumable jobs.
- Add daily refresh.
- Add all available history mode.
- Add watchdog/retry queue.
- Add job monitor UI.

### Phase 6 — Aseprite/Sprite Lab

- Add Aseprite detector.
- Add private bundle importer.
- Add Aseprite CLI wrapper.
- Add LibreSprite fallback.
- Add Pixelorama fallback.
- Add internal PNG fallback.
- Add sprite sheet export.
- Add frame slicing.
- Add palette extraction.
- Add animation manifest generation.
- Add Sprite Lab UI.

### Phase 7 — creative/game/engineering bridges

- Add Blender bridge.
- Add Godot bridge.
- Add MonoGame/Keter bridge.
- Add RPG Maker bridge.
- Add Unity bridge.
- Add Unreal bridge.
- Add FreeCAD bridge.
- Add KiCad bridge.
- Add 3D Asset Lab and Engineering Lab UI.

### Phase 8 — audio full assistant

- Add BPM/key detection helpers.
- Add MIDI generation.
- Add drum pattern generator.
- Add chord/bassline generator.
- Add arrangement exporter.
- Expand AudioPreviewBrowser into Audio Lab.

### Phase 9 — education builder

- Add education source records.
- Add learning path generator.
- Add quiz generator.
- Add flashcard generator.
- Add progress records.
- Add Education Builder UI.

### Phase 10 — tests/evals/docs

- Add unit tests.
- Add route tests.
- Add DB migration tests.
- Add local tool detection tests.
- Add SEC parser fixtures.
- Add Sprite Lab fixture tests.
- Add docs.
- Add release verification commands.

## Security and safety requirements

Local tool execution is powerful and must not become random shell access.

Required guardrails:

- No unrestricted shell by default.
- Commands must use typed templates.
- User-approved custom tools allowed, but stored with risk labels.
- Dangerous operations require confirmation.
- Installer/update operations require confirmation.
- Write operations must be workspace-bound unless user explicitly approves broader paths.
- Output paths must be logged.
- All executable runs must be auditable.
- Static GitHub Pages mode must never expose executable actions.

## Verification requirements

Do not mark any module complete without verification.

Required checks:

- `npm run type-check`
- `npm run lint`
- `npm test`
- route tests for new APIs
- database migration tests
- SEC parser fixture tests
- local tool detection tests with mocked paths
- Aseprite fallback-chain tests with mocked executables
- UI build test
- GitHub Pages static build test
- manual local smoke test

## Acceptance criteria

The expansion is complete only when:

1. The local app can detect, configure, approve, and run local tools.
2. Tool records are editable in the database/UI.
3. The SEC module can ingest and search companies, filings, facts, sections, chunks, and citations.
4. The SEC module supports full-scale ingestion through resumable jobs.
5. Aseprite is a first-class tool bridge.
6. Aseprite fallback chain works.
7. Sprite Lab can export, slice, inspect, and manifest sprite assets.
8. Blender/Godot/FreeCAD/KiCad and game-engine bridges are registered.
9. The audio module can generate usable beatmaking artifacts.
10. The education module can generate study paths, quizzes, flashcards, and progress data.
11. GitHub Pages still builds as a static safe UI.
12. Local-only features stay hidden/disabled in GitHub Pages mode.
13. Tests and docs exist for all major systems.

## Immediate next step

Implement Phase 1 first:

- database migrations,
- Docker Compose,
- local data folders,
- catalog seed records,
- SEC schema,
- local executable schema,
- first route stubs,
- tests.

Then move to Phase 2 local tool bridge before attempting full SEC ingestion or Aseprite automation.
