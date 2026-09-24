# HireOS Command — JD Management (frontend)

React port of `../docs/HireOS_Command_JD_Management_Prototype.html`, built on the
same stack as the other HireOS subsystems (`hireos-screening-front`,
`job-Interview-front`): **Vite + React 19 + TypeScript + react-router**, with the
prototype's own design-token CSS rather than a component library.

The port adds a **language switch (English / 中文)**, which the source prototype
did not have.

## Running

```bash
npm install
npm run dev        # http://localhost:5175
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on port 5175, proxying `/api` → `http://127.0.0.1:3005` (the JD backend) |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

`VITE_API_PROXY_TARGET` overrides the backend the dev server proxies to (see
`.env.example`). All data is currently served from in-memory fixtures, so no
backend is required to run the UI.

## Layout

```
src/
  index.css              Design system + module CSS, extracted from the prototype
  main.tsx / App.tsx     Root, router, error boundary
  components/
    AppShell.tsx         Topbar, sidenav, appearance/role/demo modals
    ui/                  Icon, Button, badges, page fragments, overlay host
  store/
    types.ts             App state shape
    initialState.ts      Deep-cloned fixtures + persisted preference keys
    StoreContext.tsx     Reducer, toasts, overlay stack, appearance, i18n hook
  data/
    types.ts             Domain types (Job, RoleVersion, Requirement, …)
    i18n.ts              English → Chinese table + `translate()`
    fixtures/            Demo data, ported verbatim from the prototype
  lib/format.ts          uid / date / relative-time / money helpers
  pages/                 Home, My Tasks, Job Library, New Job, Job Workspace,
                         Templates, Files & Integrations, Settings, 404
  features/
    copilot/             "Ask Copilot" voice/chat drawer + simulated generation
    workspace/           Document editor, side panel, approval, publication,
                         attachments, activity, versions, blueprint drawer
    tasks/               Task-count hook
```

### Routes

`/home` · `/tasks` · `/jobs` · `/jobs/new` · `/jobs/:id/:tab` · `/templates` ·
`/files` · `/settings/:section`

The workspace tabs are `document`, `approval`, `publication`, `attachments`,
`activity`, `versions`. The prototype's `requirements`, `internal-jd` and
`external-jd` routes are kept as aliases of the Document tab (the first opens
the Requirements Blueprint drawer on arrival; the latter two preselect an
audience).

## State model

The prototype mutated a single global `state` object and re-rendered by hand.
That model is kept — `useReducer` with a `MUTATE` action that applies a mutator
to nested fixture data and returns a fresh top-level object — because the demo
data is per-session and never shared. Only UI preferences (`lang`, `theme`,
`accent`, `textSize`, `sidenavCollapsed`) are persisted, in `localStorage` under
`hireos-jd-prefs`.

Modals and drawers are pushed onto an overlay stack as React elements; each one
reads the store itself, so overlays stay live while underlying data changes.

## Language switch

`t('English source')` looks up `src/data/i18n.ts` and returns the source string
unchanged when the language is `en`, or no translation exists.

Scope matches the sibling Resume Screening port: **product chrome is
translated** (labels, buttons, statuses, headings, toasts, empty states) while
**fixture content stays in its source language** (job titles, requirement
statements, JD body text, activity sentences, people names) — that content
represents the customer's own data, not the product UI.

Where the same English word means different things in different places, the
translation key is namespaced by context, e.g. `hiring_status.Open` ("招聘中")
vs `task_status.Open` ("待处理"). Pass the namespace as `t(source, key)`.

Dates, relative times and salary ranges follow the active language via
`setFormatLang`, which the store calls on every language change.

## Simulated behaviour

As in the prototype, there are no real model calls, emails, uploads or channel
integrations. Copilot suggestions come from a small keyword knowledge base
(`features/copilot/geminiLogic.ts`) plus canonical rewrites
(`features/workspace/docHelpers.ts`), voice input replays a sample transcript,
and publication/activation/withdrawal transitions resolve on timers.
