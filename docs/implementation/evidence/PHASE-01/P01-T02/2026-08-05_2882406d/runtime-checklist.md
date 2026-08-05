# P01-T02 Runtime Checklist

- [x] Clipboard API success calls `writeText` with the exact command.
- [x] Successful copy announces an accessible `role="status"` message.
- [x] Missing Clipboard API uses the browser fallback when available.
- [x] Clipboard permission rejection uses the browser fallback when available.
- [x] Failed Clipboard API plus failed fallback shows a non-fatal `role="alert"` message.
- [x] Missing Clipboard API plus missing fallback shows a non-fatal error result.
- [x] Local Run Approval remains interactive after clipboard failure.
- [x] Sprite Lab exposes fallback-copy success to the user.
- [x] Temporary fallback textarea is removed after use.
- [x] Prior selection and focused element are restored by the fallback where available.

Runtime layer: Vitest 4.1.7 with jsdom 29.1.1, exercised through both utility tests and rendered component integration tests. A manual real-browser session was not required by this task's acceptance criteria.
