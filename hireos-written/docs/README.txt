HireOS Written Test Prototype

Open hireos-assessment-prototype.html directly in a modern browser (double-click, or drag into a browser tab). No build step, no server required. It defaults to the "My Tasks" list (#/tasks).

Included flow updates:
- Written Test candidate task list, grouped by candidate, with status filters (completed / pending test / pending submission / pending result review)
- Job and candidate grouping ("Cluster by JD" view), with a "Compare candidates" action restricted to candidates that already have a score
- Candidate plan detail page reached from the task list, with four tabs:
  - Assessment plan (question list, add question via Question Bank or AI generation)
  - Submission (deliverable files list with received date, preview/download actions)
  - Comprehensive evaluation (AI + human scoring, override, accept-all, re-run AI)
  - Evaluation result (final release preview once the evaluation is finalized)
- Drawer-based "add assessment question" flow (Question Bank selection or AI-generated brief + rubric) and "send to candidate" flow (timed/deadline mode, disclosure settings)
- Resume preview and assessment result preview drawers
- English / Chinese language toggle (top bar)

This is a self-contained, static HTML demo. All demo data lives in the page's JS and is persisted only to the browser's local storage (per-origin) — nothing is sent to a server. Clearing site data / local storage resets the demo to its seeded state.
