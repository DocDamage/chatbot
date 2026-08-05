# Clipboard Behavior Matrix

| Case | Native API | Fallback | Expected result | Coverage |
|---|---|---|---|---|
| Secure supported context | resolves | not called | success, accessible status | utility + both component suites |
| API unavailable | absent | succeeds | fallback success, accessible status | utility + Sprite Lab integration |
| Permission/API rejection | rejects | succeeds | fallback success | utility |
| Permission/API rejection | rejects | fails | non-fatal error | utility + Local Run integration |
| No API and no fallback | absent | unavailable | non-fatal unavailable result | utility |
