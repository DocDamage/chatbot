# REA reverse engineering

The chatbot integrates [REA](https://github.com/DocDamage/rea) through local stdio MCP. The optional runtime is pinned to published `rea-agents@6.8.0` in `services/rea/package-lock.json`. The linked fork was reviewed at `d48e472fa6a664cacbb400560e673533005795ce`; that snapshot can contain changes beyond the published package. REA is MIT licensed; its full notice is retained in `services/rea/LICENSE.rea`.

## Setup and use

Run `npm run setup:rea`, then restart the chatbot. Setup installs the isolated locked package, records a compatible existing Node executable in ignored `services/rea/runtime.json`, and sets `REA_ENABLED=true` in your local `.env`. It does not upgrade Node or install native engines. REA requires Node `^22.23.4`, `^24.22.1`, or `>=26.12.1`; set `REA_NODE_PATH` if discovery does not find yours.

Open **REA · Reverse engineering** below the chat history controls. Select a local file/directory or upload an artifact, choose an analysis type, and start it. Results include evidence IDs, limitations, and a download of the complete evidence bundle. Recent analyses survive restarts. Cancel work or delete saved analyses from the panel.

Chat commands work with Ollama without requiring model tool calling:

```text
/rea status
/rea analyze "G:\artifacts\resources\app.asar"
/rea result <analysis-id>
/rea cancel <analysis-id>
```

Commands queue analysis and report its actual status. Use the panel for explicit operations and optional native function names or provider-returned addresses.

With the local app running, `npm run verify:rea` performs live JavaScript, archive, model, Windows PE and .NET checks where applicable. Add `-- --native` to verify a native catalog and decompile a provider-returned internal function. Results are written to ignored `temp/rea-live-verification.json`.

## Workflows

| Selection | REA operations | Requirements |
| --- | --- | --- |
| JavaScript / Electron | `analyze_javascript_application`, summary first | ASAR, extracted directory, or isolated source file |
| Archive / package | `open_binary`, `inspect_artifact` | Supported ZIP/application package |
| Windows PE | `inspect_pe_imports`, `inspect_pe_resources` | EXE/DLL/SYS; no native decompiler required |
| .NET | `inspect_managed_artifact`, summary first | Supported managed assembly |
| Native | `open_binary`, `binary_overview`, `list_procedures`; optional `analyze_function` | Compatible installed provider such as Ghidra |
| Model | `inspect_model_artifact`, summary first | Supported model artifact, such as GGUF or safetensors |

Successful workflows export complete evidence before closing their session. If a later operation fails, already-observed evidence is exported when possible; the job remains failed. A missing provider or missing export never produces a successful job. Summary records can refer to a `parent_evidence_id`; the downloaded bundle retains the complete parent record.

Native function names can be stripped. Start with native overview, inspect the retained procedure catalog, then request a specific known name/address. These observations describe static structure. Runtime behavior, exploitability and behavioral equivalence require additional evidence.

## Local access and budgets

Developer/admin sessions are required. The REA route is excluded from hosted deployments, and every chat API, including streaming, enforces the same local access boundary. Saved results, downloads and deletion are scoped to their authenticated owner.

Local paths default to the chatbot workspace. To approve other locations, configure absolute directories:

```dotenv
REA_ALLOWED_ROOTS=["G:/dev/Chatbot","G:/artifacts"]
REA_TIMEOUT_MS=300000
REA_MAX_INPUT_BYTES=134217728
```

Uploads enter private snapshots; staging files are removed after admission. Credential paths, symbolic links/junctions and network paths are rejected. Directory snapshots filter credentials, dependencies, caches and unsupported file types, with a visible limitation. Defaults: 128 MB, 3,000 files, one active job and four waiting jobs. Restarts mark unfinished work interrupted for deliberate retry.

Inputs, reports and evidence persist under ignored `data/rea/jobs` until you delete the analysis. The adapter starts REA and static providers. It does not expose arbitrary REA commands, target execution, process attachment, browser interaction or device tools. Providers retain their own filesystem/process/network authority and configuration. Untrusted parsers are not a security sandbox.

The optional package and transitive dependencies have a separate lockfile and licenses; they are outside the base application SBOM. The base app builds without installing REA.
