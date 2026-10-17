# Signal States

| State | Presentation |
| --- | --- |
| Current AI recommendation | Existing textual level; explain evidence strength |
| Insufficient evidence | No definite level; explain unknowns require review |
| Manually added | No AI level; explain this role was proposed by a person |
| Not eligible | Eligibility badge, no confidence level; explain conflicting role evidence |
| Replaced recommendation | Existing expired label and stale reason; no current signal disclosure |
| Loading | Existing page skeleton; no premature level |
| Error | Existing candidate lookup error; no fabricated signal |

The disclosure uses native `details` / `summary`, works with Enter and Space, and does not rely on color. No access-control behavior changes.
