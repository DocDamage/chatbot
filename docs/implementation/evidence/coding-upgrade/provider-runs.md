# Live provider runs

Both runs used implementation SHA `d5ec6086d61e90c3586af382b1587f7ec7cae7db`, the fixed 27-case upgraded manifest, and the explicit-live-model network policy.

| Provider | Model | Result |
|---|---|---|
| Gemini | `gemini-3.6-flash` | 13 ready, 14 unsupported; 11 model-adapter cases recorded in `upgraded/report.json`. |
| DeepSeek | `deepseek-chat` | 13 ready, 14 unsupported; 12 model-adapter cases, three applied patches, and honest failed/unsupported checks recorded during the separate live run. |

The initial Gemini attempt with `gemini-2.0-flash` was not counted: the provider returned HTTP 404 because that model had been retired. Google’s current model documentation identifies `gemini-3.6-flash` as the stable model code.
