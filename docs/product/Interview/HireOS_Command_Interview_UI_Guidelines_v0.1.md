# HireOS Command Interview — UI Guidelines

Doc ID: CMD-INT-UI-001  
Version: v0.1  
Date: 2026-09-11  
Product: HireOS Command Interview  
Platform: Desktop Web, laptop-first  
Primary viewport: 1440 × 900  
Minimum validated viewport: 1366 × 768  

---

## 1. Design Positioning

HireOS Command Interview uses a productivity-software visual language inspired by Google Workspace: clean surfaces, compact density, clear hierarchy, and operational clarity. The product is built for HR partners, hiring managers, and interviewers who need to prepare, conduct, review, and finalize interviews with traceable evidence.

The UI should feel:

- Professional, calm, and task-oriented.
- Lightweight rather than enterprise-heavy.
- Evidence-driven rather than dashboard-heavy.
- Suitable for long desktop working sessions.
- Friendly enough for HR users, but structured enough for technical interview review.

The interface must not look like a full email system, offer approval system, or end-to-end ATS. Integrations may be shown as simulated connection points only.

---

## 2. Global Information Architecture

### 2.1 Application Chrome

The global shell contains three persistent layers:

1. Workspace banner
   - Height: 34px.
   - Dark background.
   - Used for prototype/demo context such as workspace title and unverified/simulated environment notices.
   - Hidden on the Live Interview page to preserve interview focus.

2. Top bar
   - Height: 56px.
   - Contains logo, product name, current module, global search, language switch, appearance settings, and user role switcher.
   - The top bar should not duplicate primary workflow creation actions when the same action already appears in the main page.

3. Left side navigation
   - Supports Home, Create, Files, and Settings/demo placeholder.
   - Active state uses brand color and soft brand background.
   - Supports two display states: Collapsed and Expanded (see 2.1.1).

#### 2.1.1 Side Navigation States

The left side navigation supports two states. The user can switch between them with a toggle control; the choice should persist across sessions (e.g. stored locally per user).

Collapsed (default):

- Width: 52px.
- Icon-only.
- Item label is available as a tooltip on hover/focus, not rendered inline.
- Toggle control icon points "outward" (expand) to indicate the action it performs.

Expanded:

- Width: 220px.
- Icon + text label shown side by side for every item.
- Toggle control icon points "inward" (collapse) to indicate the action it performs.
- Long labels truncate with ellipsis rather than wrapping or forcing extra width.

Rules:

- The toggle control sits at the bottom of the side navigation, below Settings, and is always visible in both states.
- Width changes animate over ~160–200ms ease, matching other panel transitions; icons and labels should not reflow or flash during the transition.
- Active-state styling (brand color + soft brand background) and hover/focus treatment apply identically in both states.
- The toggle button must expose `aria-expanded` and an `aria-label` that reflects the resulting action ("Expand navigation" / "Collapse navigation"), localized per 10. Localization.
- Below 1100px viewport width, the side navigation should default to Collapsed to preserve room for primary content; the user may still expand it manually.
- Collapsing/expanding must not shift the workspace banner or top bar height, and must not reflow the workflow tab bar's active underline position mid-animation.

#### 2.1.2 Selected / Active Item Style

The active item in the side navigation (and any equivalent vertical nav list, such as a Settings sidebar) uses a two-part token pairing:

- Background: soft brand tint (`--brand-soft`).
- Text: the brand color as adjusted for the current theme — the same value used for active tab underlines and active icons — at font-weight 600. Never a fixed, light-theme-only dark shade of the brand color.
- If the item carries a count/badge, its background switches to the strong brand fill with `--brand-ink` text when the item is active.

Rules:

- Verify text-on-soft-background legibility in Light, Dark, and Deep themes independently — do not assume a value tuned for Light will still read on a soft/translucent brand background over a dark surface. A brand "text" shade that is dark and muted in Light mode must become a light, saturated tint in Dark/Deep mode, or the label becomes unreadable against the dark surface.
- This pairing applies to every "soft background + colored text" selected/active pattern in the product, not only the primary side navigation — e.g. a secondary in-page navigation list (Settings sidebar), selected filter chips, and active segmented-tab labels must all follow the same rule.

### 2.2 Main Navigation Model

The interview project flow is organized as a horizontal workflow navigation:

1. Overview
2. Requirements & Rubric
3. Plan
4. Schedule
5. Brief
6. Live
7. Review
8. Debrief
9. Decision
10. Package

Rules:

- Workflow tabs are horizontally scrollable when space is limited.
- Active tab uses a 2px brand underline.
- Disabled or blocked workflow steps should not be visually hidden; clicking should show a localized toast explaining the prerequisite.
- Candidate-facing and internal pages must remain clearly separated.

---

## 3. Layout System

### 3.1 Canvas and Page Width

The product should use full available browser width. Do not apply a fixed max-width to primary pages.

Page padding:

- Standard pages: 32px left/right, 22–28px top, 60px bottom.
- Live Interview page: 22px left/right, 8px top, 16px bottom.
- Cards and sections should expand responsively with `auto-fit` or `minmax()` grids.

### 3.2 Grid Patterns

Common grids:

- Dashboard cards: `repeat(auto-fill, minmax(200px, 240px))`, left-aligned.
- Overview content: `repeat(auto-fit, minmax(280px, 1fr))`.
- Two-column work areas: flexible main column + secondary panel.
- Live Interview: main video/interview column + right side panel.

Live Interview layout:

- Desktop: `minmax(0, 1fr) minmax(320px, 360px)`.
- Gap: 16px.
- Below 1100px: collapse into one column.
- Below 720px: video tiles stack vertically.

### 3.3 Spacing Scale

Use a compact 4px-based spacing rhythm:

| Token | Value | Usage |
| --- | ---: | --- |
| xs | 4px | Label-to-text spacing, tight icon gaps |
| sm | 6–8px | Button icon gap, chip groups |
| md | 10–12px | Form rows, tab gaps, card internals |
| lg | 14–16px | Card padding, panel spacing |
| xl | 20–24px | Section spacing, page header gaps |
| page | 28–32px | Page horizontal/top padding |

---

## 4. Visual Tokens

The current implementation uses CSS variables on the root and mirrors them to `<html>` so portal components such as modals and drawers inherit the same theme.

### 4.1 Core Tokens

| Token | Purpose |
| --- | --- |
| `--bg` | Main page background |
| `--surface` | Primary card, top bar, modal, drawer background |
| `--surface-2` | Subtle nested panels and input-like surfaces |
| `--surface-3` | Active navigation backgrounds, unknown/default chips |
| `--ink` | Primary text |
| `--ink-2` | Secondary text |
| `--ink-3` | Muted text, captions, metadata |
| `--line` | Default border |
| `--line-strong` | Stronger border, form controls, important containers |
| `--brand` | Primary accent |
| `--brand-ink` | Text/icon color on brand background |
| `--brand-soft` | Active or selected soft background |
| `--brand-strong` | Hover/strong brand state |
| `--ok` / `--ok-soft` | Positive state |
| `--warn` / `--warn-soft` | Warning / needs attention |
| `--bad` / `--bad-soft` / `--bad-ink` | Error / destructive state |
| `--ai` / `--ai-soft` | AI suggestion or AI-generated content |
| `--scroll-thumb` | Scrollbar thumb |

### 4.2 Light Theme

Default light values:

| Token | Value |
| --- | --- |
| `--bg` | `#eef2f6` |
| `--surface` | `#ffffff` |
| `--surface-2` | `#f8fafc` |
| `--surface-3` | `#f1f5f9` |
| `--ink` | `#111827` |
| `--ink-2` | `#4b5563` |
| `--ink-3` | `#9ca3af` |
| `--line` | `#e5e7eb` |
| `--line-strong` | `#d1d5db` |
| `--ok` | `#059669` |
| `--ok-soft` | `#d1fae5` |
| `--warn` | `#b45309` |
| `--warn-soft` | `#fef3c7` |
| `--bad` | `#dc2626` |
| `--bad-soft` | `#fee2e2` |
| `--bad-ink` | `#ffffff` |

### 4.3 Dark Theme

Default dark values:

| Token | Value |
| --- | --- |
| `--bg` | `#0f172a` |
| `--surface` | `#1e293b` |
| `--surface-2` | `#0f172a` |
| `--surface-3` | `#334155` |
| `--ink` | `#f8fafc` |
| `--ink-2` | `#d6deea` |
| `--ink-3` | `#aab8ca` |
| `--line` | `#334155` |
| `--line-strong` | `#475569` |
| `--ok` | `#6ee7b7` |
| `--ok-soft` | `rgba(16,185,129,.18)` |
| `--warn` | `#fcd34d` |
| `--warn-soft` | `rgba(245,158,11,.18)` |
| `--bad` | `#fda4af` |
| `--bad-soft` | `rgba(244,63,94,.18)` |
| `--bad-ink` | `#4c0519` |

### 4.4 Deep Theme

Deep mode is a darker blue-tinted variant:

| Token | Value |
| --- | --- |
| `--bg` | `#0a0f1f` |
| `--surface` | `#16213a` |
| `--surface-2` | `#0b1526` |
| `--surface-3` | `#1f2d4d` |

Other dark-mode semantic tokens are shared with Dark Theme.

### 4.5 Accent Colors

The product supports three accent themes. Teal is the default and should remain the primary brand direction unless a brand decision changes.

| Accent | Light brand | Dark brand | Strong | AI paired color |
| --- | --- | --- | --- | --- |
| Teal | `#0d9488` | `#5eead4` | `#0f766e` | Violet |
| Blue | `#2563eb` | `#93c5fd` | `#1d4ed8` | Violet |
| Violet | `#7c3aed` | `#c4b5fd` | `#6d28d9` | Teal |

Brand usage:

- Primary action buttons.
- Active navigation.
- Selected tabs/options.
- Focus outlines.
- Important links.
- Logo/avatar accents.

AI color usage:

- AI suggestions.
- Simulated AI analysis.
- AI-generated draft content.
- AI should not share the same styling as human scores or final decisions.

---

## 5. Typography

### 5.1 Font Families

Primary UI font:

- `Inter`
- Fallback: `system-ui`, `-apple-system`, `sans-serif`

Monospace/caption font:

- `IBM Plex Mono`
- Used for section labels, trace step numbers, technical metadata, timestamps, and uppercase micro-labels.

Icon font:

- `Material Symbols Rounded`
- Default size: 18px.

### 5.2 Type Scale

| Role | Size | Weight | Usage |
| --- | ---: | ---: | --- |
| Page title | 22–24px | 700 | Home title, project title |
| Modal title | 22px | 700 | Create project modal |
| Section/card title | 15–16px | 700 | Drawer title, card title |
| Body | 12.5–13.5px | 400–500 | Main readable text |
| Button text | 12–13.5px | 600–700 | Actions |
| Metadata | 11–12px | 400–600 | Secondary details |
| Mono label | 10–10.5px | 500–700 | Uppercase section label |

### 5.3 Text Size Preference

The app supports Small, Medium, and Large text size.

- Medium base: 13px.
- Small base: 12px.
- Large base: 15px.
- Elements with `data-base` can scale upward in Large mode.

Design implication: layouts must tolerate larger text without clipped buttons, cramped tags, or fixed-width labels.

---

## 6. Components

### 6.1 Surface Card

Default card:

- Background: `--surface`.
- Border: `1px solid --line`.
- Radius: 14px.
- Padding: 16px 18px.
- Used for dashboard cards, rubric cards, source-material panels, scorecards, and review sections.

Nested card:

- Background: `--surface-2`.
- Border: `1px solid --line`.
- Radius: 11–12px.

### 6.2 Buttons

Primary button:

- Height: 34px default; 40px large; 30px small.
- Background: `--brand`.
- Border: `1px solid --brand`.
- Text: `--brand-ink`.
- Radius: 10–11px.
- Font weight: 700.
- Used for main forward actions.

Secondary button:

- Height: 32px default; 26px small.
- Background: `--surface`.
- Border: `1px solid --line`.
- Text: `--ink-2`.
- Radius: 9px.
- Font weight: 500.

Ghost button:

- Transparent background and border.
- Text: `--ink-2`.
- Used for low-emphasis actions such as Skip, Back, Add follow-up.

Danger/destructive action:

- Background: `--bad`.
- Text: `--bad-ink`.
- Used sparingly, for end call, destructive remove, or error recovery.

### 6.3 Chips and Status Pills

Chip:

- Height: 26px small or 30px medium.
- Radius: 9px.
- Padding: 10–12px horizontal.
- Active chips use `--brand-soft` + `--brand`.
- Warning chips use `--warn-soft` + `--warn`.

Pill:

- Height: 22px.
- Radius: 6px.
- Padding: 8px horizontal.
- Font size: 11px.
- Font weight: 600.
- Must size to content; avoid forcing long labels into fixed-width containers.

Status tones:

| Tone | Background | Text | Usage |
| --- | --- | --- | --- |
| ok | `--ok-soft` | `--ok` | Completed, provided, passed |
| warn | `--warn-soft` | `--warn` | Needs attention, pending, exception |
| bad | `--bad-soft` | `--bad` | Error, blocked, failed |
| unknown | `--surface-3` | `--ink-2` | Unknown, not provided, no score |

Important rule: Unknown must never be rendered as 0, failing, or visually equivalent to bad.

### 6.4 Banners

Banner radius: 12px.  
Padding: 11px 14px.  
Border: semantic tone color.  
Background: semantic soft color.  
Font size: 12.5px.  
Line height: 1.45.

Use banners for:

- Setup prerequisites.
- Simulated integration notices.
- Evidence gaps.
- Pending confirmations.
- Important state transitions.

### 6.5 Tabs

Project workflow tabs:

- Height: 38px.
- Active underline: 2px solid `--brand`.
- Active text: `--brand`.
- Inactive text: `--ink-2`.
- Horizontal overflow allowed.

Panel tabs, such as Live Interview side panel:

- Active text: `--brand`.
- Underline: 2px.
- Side panels should keep content scrollable independently.

### 6.6 Modals

Create Project modal:

- Width: 640px.
- Radius: 18px.
- Padding: 26px 28px 22px.
- Centered.
- Uses tabs/cards for creation method: manual upload, folder import, email import.

Rules:

- JD is required.
- Resume, screening, and assessment are optional.
- File upload controls must support remove/retry states.
- Uploaded JD content should populate the JD textarea after extraction.
- Simulated folder/email integrations must be clearly labeled as not connected or simulated.

### 6.7 Drawers

Right-side drawers:

- Width: 520px.
- Max responsive width: `min(520px, 96vw)`.
- Sticky header.
- Header padding: 17px 20px 15px.
- Body padding: 16px 20px 24px.
- Close button: 32px square, 8px radius.

Use drawers for:

- Score trace.
- Evidence/source answer.
- Behavioral anchors.
- File preview.
- Resume preview.

Resume interaction rule:

- “View résumé” should open a side drawer from the screen edge and show complete resume content, not a small inline preview.

### 6.8 Toasts

Toast:

- Position: bottom center.
- Bottom offset: 24px.
- Max width: 520px.
- Padding: 12px 16px.
- Radius: 12px.
- Background: `--ink`.
- Text: `--surface`.
- Font size: 12.5px.
- Duration: about 4.2s.

Localization rule:

- Toast messages must switch with current language.
- Any action feedback must exist in both English and Chinese.

---

## 7. Product-Specific UI Patterns

### 7.1 JD-Centered Home List

The Home page should use JD as the top-level organizing object.

Rules:

- Each JD row is expandable.
- Candidate interview status belongs to candidate rows, not the JD row.
- Clicking a JD row should expand/collapse only.
- Clicking a candidate row enters that candidate’s interview flow.
- Each JD row should include an “Associate candidate” action.
- Associating a candidate requires selecting/creating a candidate and uploading the candidate resume at the same time.

Candidate rows should show:

- Candidate name.
- Current interview status.
- Resume availability / view action.
- Next step or owner.
- Last updated time where useful.

### 7.2 Requirements & Rubric

This page converts JD and optional candidate materials into structured requirements.

Rules:

- Requirements must be traceable to the JD.
- Human scoring and AI suggestions must be visually separated.
- Rubric confirmation is a prerequisite before interview planning.
- Missing evidence should be shown as Unknown, not as low ability.
- Capability cards may use Card-P0/Card-P1/Card-P2 to avoid confusion with product development P0/P1/P2.

### 7.3 Interview Plan and Brief

Plan page:

- Shows interview rounds, owners, scope, and planned evidence coverage.
- Must distinguish “plan all rounds” and “plan one round now.”

Brief page:

- Internal-only.
- Should not be visible to candidate.
- Should show interviewer-specific responsibilities and evidence targets.

### 7.4 Live Interview

Live Interview should visually match a Google Meet-like simulated session while staying inside HireOS.

Structure:

- Top compact session header.
- Large two-person video area.
- Right side panel with Notes, Transcript, and AI Suggestions tabs.
- Current question card below video stage.
- Bottom/right completion action.

Video stage:

- Background: dark video container.
- Two equal tiles on desktop.
- Candidate/interviewer initials centered.
- Name labels fixed at bottom-left of each tile.
- Controls centered near bottom: microphone, camera, participants, end call.

Side panel:

- Width target: 320–360px.
- Content scrolls independently.
- Notes: textarea-like freeform note area.
- Transcript: time-stamped turns with speaker names.
- AI Suggestions: suggested follow-up questions and evidence gap warnings.

Important rules:

- AI suggestions must be assistive, not final scoring.
- Recording/transcript simulated state must be labeled.
- “Complete session & go to Review” is different from “Continue to next round” and “Recommend for offer.”

### 7.5 Review and Score Trace

Review page must make scoring traceable.

Each score should trace to:

1. Rubric competency.
2. Behavioral anchor.
3. Human score.
4. AI draft/suggestion, if any.
5. Reason.
6. Evidence item.
7. Original answer or resume/source text.

Rules:

- Human score is authoritative.
- AI recommendation is advisory.
- Counter-evidence should remain visible.
- Unknown remains Unknown.
- Score trace should open in a drawer, not overload the main table.

### 7.6 Debrief and Decision

Debrief:

- Summarizes cross-round evidence.
- Highlights evidence gaps and bottom-line exceptions.
- Separates AI summary from human conclusion.

Decision:

- HR and Hiring Manager must confirm separately.
- Bottom-line exceptions require explicit acknowledgment.
- “Continue to next round” and “Recommend for offer” must be separate actions.
- Published package should only be available after required confirmations.

### 7.7 Files

Files page supports source material management.

Rules:

- Show file read status, business matching status, source, and updated time.
- Source material should be previewed or inspected in a drawer.
- Unmatched files must require explicit triage.
- Candidate must not be able to access internal evidence files, scorecards, debriefs, or reports.

---

## 8. Interaction States

### 8.1 Focus

Keyboard focus:

- Outline: 2px solid `--brand`.
- Offset: 2px.
- Applies to buttons, inputs, and textareas.

### 8.2 Hover

Hover should be subtle:

- Cards: border may shift toward `--brand` only when clickable.
- Icon buttons: background moves from transparent to `--surface-3`.
- Live controls: increase white overlay opacity.

### 8.3 Disabled

Disabled primary action:

- Background: `--surface-3`.
- Text: `--ink-3`.
- Cursor: not allowed.

Blocked workflow states should generally remain clickable but explain the prerequisite via localized toast.

### 8.4 Loading and Error

File upload:

- Show uploading state on the file row.
- On failure, show localized error text and a retry action.
- Removal action should remain available when safe.

Project creation:

- Show JD extraction or upload state clearly.
- The Create action should be disabled while submitting.

---

## 9. Accessibility and Readability

Minimum expectations:

- Every icon-only button needs an `aria-label`.
- Toast should use `role="status"` and `aria-live="polite"`.
- Primary navigation should use `role="navigation"` and meaningful labels.
- Do not rely on color alone for critical state; pair color with labels.
- Maintain readable contrast in Light, Dark, and Deep themes.
- Avoid fixed-width labels that clip in Chinese or Large Text mode.
- Scrollable areas must remain reachable on 1366 × 768.

---

## 10. Localization

The product supports English and Chinese.

Rules:

- All visible text must use the localization map or a language-aware helper.
- Toasts, errors, empty states, labels, buttons, and simulated integration notices must all be localized.
- Mixed-language fallback such as “(英)” should be treated as temporary only.
- Status labels must have equivalent English and Chinese forms.
- Text containers should adapt to longer Chinese or English strings without clipping.

---

## 11. Responsive Behavior

Primary design remains desktop/laptop-first.

Required behavior:

- 1440 × 900 is the main design target.
- 1366 × 768 must be manually checked.
- Main pages must use full width.
- Side navigation defaults to Collapsed (52px) below 1100px and may be Expanded (220px) manually at any width; see 2.1.1.
- Tables/lists should scroll horizontally only when necessary.
- Workflow tabs may horizontally scroll.
- Live Interview collapses from two-column to one-column below 1100px.
- Video tiles stack below 720px.
- Drawers cap at 96vw.

---

## 12. Implementation Guidance

Recommended next step is to formalize the current inline styles into reusable components and tokens.

Priority components to standardize:

1. App shell / top bar / side nav.
2. Button variants.
3. Surface card and nested card.
4. Status pill and chip.
5. Banner.
6. Workflow tab navigation.
7. Modal layout.
8. Drawer layout.
9. JD expandable list and candidate row.
10. Live Interview panel.
11. Score trace drawer.

Recommended token cleanup:

- Move design tokens into a central theme file.
- Avoid hard-coded colors except true video-call backgrounds and workspace demo banner.
- Add semantic sizing tokens for radius, spacing, and elevation.
- Add a localization lint/check for hard-coded UI strings.

---

## 13. Current Known UI Risks

These are areas to keep checking as the prototype evolves:

- Top-bar and Home-page duplicate creation entry.
- Status pills with long text may feel crowded if fixed widths are introduced.
- Expanded JD arrows must not shrink in dense rows.
- Candidate status should remain on candidate rows, not JD rows.
- Resume preview must use a side drawer with full content.
- Toast localization can regress when new actions are added.
- Dark mode can regress when new hard-coded colors are introduced.
- A brand color tuned for "text on soft background" in Light mode can become unreadable in Dark/Deep mode if it isn't given its own light-mode/dark-mode values (see 2.1.2) — check active/selected states in all three themes whenever a new accent or selected-state pattern is added.
- AI and human evaluation styling must remain distinct.
- Unknown evidence must never look like failure.
- Side navigation is currently implemented as icon-only/fixed-width; expand/collapse (2.1.1) is not yet built and needs implementation plus persistence of the chosen state.

