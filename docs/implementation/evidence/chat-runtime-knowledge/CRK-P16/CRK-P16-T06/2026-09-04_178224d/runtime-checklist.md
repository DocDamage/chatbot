# Runtime Checklist — CRK-P16-T06: Feedback Consolidation Exit Gate

- [x] One canonical feedback service exists (`CanonicalFeedbackService.ts`).
- [x] Old collectors are adapted/deprecated/removed (`FeedbackCollectorAdapter.ts`, deprecation annotations on `src/core/rl/` and `src/core/learning/`).
- [x] Feedback is tied to trace versions without private prompt text (`FeedbackTraceBinding.ts`, §2845).
- [x] Feedback cannot directly self-train production behavior (`FeedbackTriageService.ts`, §2872-2892).
- [x] Client feedback bar component renders thumbs up/down and optional category follow-up (`ResponseFeedbackBar.tsx`, §2870).
- [x] Privacy deletion purges feedback by session and user upon request (`CanonicalFeedbackService.ts`, §2894).
- [x] All production source files strictly under 300 lines.
- [x] Full type-check passing across server, tests, and client.
- [x] Server and client linters passing with zero warnings or errors.
