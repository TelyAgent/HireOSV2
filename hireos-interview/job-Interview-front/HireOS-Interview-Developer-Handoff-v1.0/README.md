# HireOS Command Interview — Developer Handoff

## Package contents

- `prototype/index.html` — current interactive prototype.
- `prototype/support.js` — runtime required by the prototype.
- `docs/HireOS_Command_Interview_PRD_v1.5.md` — latest product requirements.
- `docs/HireOS_Command_Interview_Prototype_Design_Brief_v1.0.md` — primary design reference.
- `docs/HiOS_Command_Company_Email_and_Interview_Flow_v1.0.md` — supplementary import, notification, deep-link, permission, and exception flows.
- `docs/HireOS_Command_Interview_Interface_Spec_v1.0.md` — field, state, and exception reference.
- `docs/design-qa.md` — latest visual and interaction verification report.

## Run locally

From the package root, start a static web server:

```bash
python3 -m http.server 4175
```

Then open:

```text
http://127.0.0.1:4175/prototype/
```

Do not open `index.html` directly with a `file://` URL. The prototype expects to run through HTTP.

## Implementation notes

- This is a high-fidelity clickable prototype, not production application code.
- The interface is responsive and does not use page-level maximum-width containers.
- The live interview view uses a two-column desktop layout and stacks the side panel below 1100 px.
- English and Chinese, light and dark themes, role switching, and the primary JD-to-evaluation flow are simulated in the browser.
- Google Meet, email, folder, calendar, recording, transcript, and Offer integrations are simulated and must be replaced by product services.
- The UI loads Inter, IBM Plex Mono, and Material Symbols Rounded from Google Fonts. Production should use the organization’s approved asset-loading policy.
- Browser state is stored locally for prototype preferences only.

## Score trace contract

Keep these concepts separate in the production data model and UI:

1. Confirmed requirement and rubric version.
2. AI draft score and model/run metadata.
3. Human score and evaluator.
4. Human rationale.
5. Evidence reference, source type, round, timestamp, summary, and original response.

`Unknown` represents insufficient evidence. It must not be converted to zero or interpreted as low ability.

## Required product boundaries

- A JD alone is enough to create an Interview Project.
- Résumé, screening, and assessment inputs remain optional.
- AI suggestions never overwrite human scores.
- HR and Hiring Manager confirmations are independent.
- Continue to next round and Recommend for offer are separate actions.
- Candidate-facing access must exclude internal Brief, Scorecard, Debrief, and evaluation reports.
- Do not expand this module into a full email backend, Offer approval system, or end-to-end ATS.

## Suggested engineering split

- App shell, responsive layout, design tokens, and localization.
- Interview project and rubric domain models.
- Live interview session, notes, transcript, and AI suggestion states.
- Review and score-trace evidence graph.
- Debrief, dual confirmation, and evaluation package.
- Integration adapters and permission boundaries.

