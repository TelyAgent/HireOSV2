HireOS Command - Interview module prototype (v19)

Open index.html in any modern browser (Chrome / Edge / Safari). Single self-contained file, no server or install needed.
Fonts load from Google Fonts when online; the page falls back to system fonts offline.

Tips
- Top-right avatar menu: switch persona (John Falis = HR, Shuo Shan = Hiring Manager, Jay Horse / Mason Yang = Interviewers, Oliver Tan = Admin, Si Xia = HR).
- Gear icon: theme (light / dark / system), accent colour, text size.
- Settings -> People & roles: toggle HR / Hiring Manager / Admin.
- Demo clock is fixed at Tue 8 Sep 2026, 09:00 (UTC+8). All data, calendars, emails and booking links are simulated.

New in v11
- Interviewer is the base role for everyone (HR/HM/Admin also interview). Interviewer "My tasks": invites awaiting my acceptance, accepted-but-no-time-yet (arrange a time), candidate-sent times to pick from, confirmed upcoming interviews, feedback.
- Interviewer-led scheduling: after accepting, the interviewer either (1) shares all their free times (auto-sent to the candidate, who picks one) or (2) asks the candidate for times and picks one. HR can hand a round over, or approve an interviewer's request to arrange it themselves.
- Every task has a deadline (21 task types). Settings -> Task deadlines lists and edits the default hours. Overdue = red, due within 24h = amber; lists sort by deadline.

New in v12
- Guided demo (left rail video icon, Home -> "Guided demo", or Create page -> "Watch the demo"): a replayable walkthrough that drives the real prototype with a cursor, spotlight and captions. Pause / previous / next / chapter jump / speed / restart. Runs on a copy of the data; Exit restores everything.
- Pick any combination: 5 ways the job comes in (From HireOS, Upload, Folder, Email, Describe it by voice/text) x 4 ways to agree a time (candidate books, HR coordinates, interviewer shares free times, interviewer asks the candidate). Phone-call-only (blue-collar) scenario needs no JD and no resume.
- Create page now has two new tabs: "From HireOS" and "Describe it (voice or text)"; creating a project now really creates one that flows through rubric -> plan -> schedule -> feedback -> decision -> package.

New in v13
- Panel rounds: a round can have a second interviewer (rare). Lead interviewer stays the owner and submits the scorecard; the second person is a Co-interviewer (can add notes beside the scorecard) or an Observer / shadow (sits in, no scorecard).
- Where: Set up interviews wizard -> small "+ Add a second interviewer" link under each round; round drawer -> small "+ Add a second interviewer" link under the interviewer row (coordinators only).
- Booking times and conflict checks use both calendars. The candidate's booking page shows both people. Sample data: Jay Horse + Mason Yang (co-interviewer, SRE project round 3) and Jay Horse + Jules Moreau (observer, iOS project round 1).

New in v14/v15
- Guided demo -> "Candidate's view": a replayable animation of what the candidate sees when the interviewer shares 2-3 times. The email / SMS holds only a link (messages cannot carry interactive controls). The link opens the HireOS Interview candidate page in the browser: choose a time, fill a short details form, confirm, then simply close the page. Ends with the interviewer's side.

New in v16
- Left rail "Interviews" (list icon) and Home -> "All interviews" tab: one list of every interview arrangement (candidate + JD). Columns: Candidate & role | Stage & status (7-step mini bar, status pill, "who we are waiting on") | Next interview | Hiring Manager / decision | Scheduler | Rounds. Filters + search. Click a row to open it.
- Candidate names are links everywhere an interview exists (task rows, Next up card, round drawer, My interviews). Click -> that interview's detail page.
- Detail page redesigned: candidate name is the title with a status pill; a 7-stage tracker (Rubric, Plan, Schedule, Interviews, Debrief, Decision, Package) with "Stage n of 7" and one line on what happens next; stages are clickable and show a lock when not yet available.
- Tabs reduced from 10 to 4: Overview / Interviews / Evaluation / Decision, with small sub-pills inside (Interviews: Schedule, Plan & questions, Brief, Live room; Evaluation: Rubric, Scorecards, Debrief; Decision: Decision, Package). Interviewer-only users do not see the tracker.

New in v17
- Interview feedback is now flexible. One tap on the verdict (Strong hire / Hire / Unsure / No hire / Too early to tell) is enough to submit.
- Optional comment: type it, or tap "Dictate your feedback" and just talk (simulated transcription; no need to follow the rubric).
- Scoring by competency is tucked into an optional, collapsed section. Anything not scored stays Unknown, never zero, and never blocks the debrief or decision.
- Review page shows the verdict, comment and how it was given (verdict only / verdict + comment / verdict + voice note / scored). The decision summary says so when no competency scores exist.
- Guided demo feedback chapter now shows verdict -> voice note -> "detailed scores stay optional".

New in v18
- Live dictation: "Dictate your feedback" uses the browser's speech recognition when it is available and the mic is allowed (Chrome/Edge/Safari). If not, it inserts a sample so the flow can still be shown.
- HireOS reads the comment (typed or spoken; English and some Chinese keywords) and matches it to the rubric competencies with a Positive / Concern / Mixed / Mentioned tag, shown live under the comment box. It matches words only, never invents a score. Not mentioned = Unknown.
- Review page shows the matched sentences per competency; the decision draft says how many competencies the comments touched.
- Decision page: a gentle heads-up when a must-have competency has neither a score nor a comment, with "Ask <interviewer> for a quick line". Confirming is never blocked.
(Matching is keyword-based in this prototype; a real product would use an AI model.)

New in v19
- Rubric library (left rail, note icon). Two tabs: "Role templates" (15 starter templates; filter by role type, company stage/size, company type; preview, "Use for this project", copy to company templates) and "Company standard" (Sending Labs Core Interview Rubric SL-HR-001 v1.1, shown in full).
- Project Rubric tab now offers four ways to start: pick from the library, generate with AI, paste or upload your own (.md/.txt/.csv; tables, bullets or one-per-line), or write manually. "Edit draft" works: rename, must-have/standard, required level, weight, definition, add/remove. Editing a confirmed rubric creates a new version (locked once scores exist). "Save to library" turns a project rubric into a company template.
- Company standard on every role: rounds now have a type. HR round = full SL-C01-C08 scoring (1-5, 100-point total, Not assessed never zero, total marked Incomplete if any item is missing, bands 85/75/65), SL-C09 AI mindset scored separately, critical red-flag checkbox. Business round = role skills plus a three-item culture review (Strong / Meets / Concern / Not observed, default Not observed; a Concern needs a reason in the shared comment). Wizard: "Round type" selector and "Add HR culture round".
- Review and Decision pages show the layers side by side (A HR culture, B AI mindset, C role skills, D business-round review) with a risk-review banner for concerns, red flags and HR/business disagreement. Nothing is averaged or blocks the decision.
(Prototype limits: the company standard itself is read-only here; template content is starter material to be replaced with your own.)
