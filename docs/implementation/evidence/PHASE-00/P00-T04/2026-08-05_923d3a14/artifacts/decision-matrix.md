# P00-T04 Decision Matrix

| ADR | Area | Accepted boundary | Current implementation certified? | Primary follow-on tasks |
|---|---|---|---|---|
| ADR-0001 | Database | PostgreSQL hosted; SQLite trusted-local | No | P02-T06, P03-T07, P05 |
| ADR-0002 | Product profiles | `HOSTED` and `LOCAL_TRUSTED`; local integrations excluded from hosted registration | No | P02, P04-T03/T05/T06, P07 |
| ADR-0003 | GitHub Pages | Optional static demo only; repair or remove | No | P01-T05, P08, P12 |
| ADR-0004 | LLM providers | OpenAI hosted target; Ollama local target; others preview/experimental | No | P06, P07-T01/T02 |
| ADR-0005 | File formats | Narrow initial target; Office/GIF/BMP preview; unknown fallback unsupported | No | P04-T04/T07, P07-T08, P09-T04 |
| ADR-0006 | Operating systems | Windows 11 x64 local; Linux x86_64 hosted | No | P04, P07, P11, P12 |
| ADR-0007 | Redis | Private authenticated hosted Redis; optional loopback local Redis; not system of record | No | P04-T08, P09-T05, P11-T03 |
| ADR-0008 | Hosting | Managed single-region Linux OCI platform with managed data services | No | P03-T08, P10, P11, P12 |
| ADR-0009 | Experimental modules | Four manifest categories control route/UI/background registration and promotion | No | P02, P03-T01, P04-T03, P07, P12 |
| ADR-0010 | Telemetry/privacy | Data-minimized operational telemetry; no content analytics by default | No | P04-T10/T11, P05-T08, P10, P12 |
