# Live provider runs

The checked-in Gemini run used implementation SHA `54623a7e5e616324bf1311f789960cb8e03d723e`, the fixed 27-case upgraded manifest, and the explicit-live-model network policy.

| Provider | Model | Result |
|---|---|---|
| Gemini | `gemini-3.6-flash` | 13 ready, 14 unsupported; five model-adapter cases, with later ready cases honestly recording free-tier quota failures in `upgraded/report.json`. |
| DeepSeek | `deepseek-chat` | Separate preceding run: 13 ready, 14 unsupported; 12 model-adapter cases, three applied patches, and honest failed/unsupported checks. |

The initial Gemini attempt with `gemini-2.0-flash` was not counted: the provider returned HTTP 404 because that model had been retired. Google’s current model documentation identifies `gemini-3.6-flash` as the stable model code.
