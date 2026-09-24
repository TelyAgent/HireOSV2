import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MainInner, AppearancePanel, AppearancePreview } from "../components/AppShell";
import { Icon } from "../components/ui/Icons";
import { Button, EmptyState, PersonChip, StatusBadge } from "../components/ui/Primitives";
import { useStore } from "../store/StoreContext";
import { PEOPLE, getPerson } from "../data/fixtures/people";
import { SAVED_VIEWS } from "../data/fixtures/tasks";
import { MODELS, MODEL_ACTIVITY, MODEL_EVALS, TASK_POLICIES, USAGE_ROWS } from "../data/fixtures/aiModels";
import { daysAgo, fmtDateTime, fmtRelative, hoursAgo } from "../lib/format";

const SETTINGS_NAV = [
  {
    group: "Personal",
    items: [
      { key: "overview", label: "Settings overview" },
      { key: "profile", label: "My Profile & Preferences" },
      { key: "appearance", label: "Appearance" },
      { key: "homepage", label: "Homepage & Views" },
      { key: "notifications", label: "Notifications" },
    ],
  },
  {
    group: "Workspace",
    items: [
      { key: "organization", label: "Organization & Workspace" },
      { key: "members", label: "Members & Permissions" },
      { key: "workflow", label: "Workflow & Approvals" },
      { key: "email", label: "Email & Publication" },
      { key: "files", label: "Files & Integrations" },
      { key: "ai-models", label: "AI Models" },
      { key: "data-policy", label: "Data Policy & Audit" },
    ],
  },
];

export function SettingsPage() {
  const { section = "overview" } = useParams();
  const { t } = useStore();
  const navigate = useNavigate();

  // Files & Integrations is a shared capability with its own top-level page.
  if (section === "files") return <Navigate to="/files" replace />;

  return (
    <MainInner variant="flush">
      <div className="settings-shell">
        <div className="settings-nav">
          {SETTINGS_NAV.map((g) => (
            <div key={g.group} className="settings-nav-group">
              <div className="snlabel">{t(g.group)}</div>
              {g.items.map((it) => (
                <div
                  key={it.key}
                  className={`settings-nav-item${section === it.key ? " active" : ""}`}
                  onClick={() => navigate(`/settings/${it.key}`)}
                >
                  {t(it.label)}
                </div>
              ))}
            </div>
          ))}
        </div>
        {section === "ai-models" ? (
          <AiModelsSection />
        ) : (
          <div className="settings-content">
            <SettingsSection section={section} />
          </div>
        )}
      </div>
    </MainInner>
  );
}

function SettingsHead({ title, scope }: { title: string; scope: string }) {
  return (
    <h2 className="section-title">
      {title}
      <span className="scope-tag">{scope}</span>
    </h2>
  );
}

function SettingsSection({ section }: { section: string }) {
  const { state, t, say, resetAppearance, set, person } = useStore();
  const navigate = useNavigate();

  switch (section) {
    case "overview":
      return (
        <>
          <SettingsHead title={t("Settings overview")} scope={`${t("You")} • Sending Labs`} />
          <div className="field">
            <input type="text" placeholder={t("Search settings…")} />
          </div>
          <div className="job-card-grid">
            {SETTINGS_NAV.flatMap((g) => g.items)
              .filter((i) => i.key !== "overview")
              .map((i) => (
                <div key={i.key} className="job-card" onClick={() => navigate(`/settings/${i.key}`)}>
                  <div className="jc-title">{t(i.label)}</div>
                </div>
              ))}
          </div>
        </>
      );

    case "profile":
      return (
        <>
          <SettingsHead title={t("My Profile & Preferences")} scope={t("Current user")} />
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="flex items-center gap-12">
              <span className="avatar-md" style={{ background: person?.color }}>
                {person?.initials}
              </span>
              <div>
                <div style={{ fontWeight: 500 }}>{person?.name}</div>
                <div className="tiny">
                  {person?.title} • {person?.email}
                </div>
              </div>
            </div>
          </div>
          <div className="field">
            <label>{t("Display name")}</label>
            <input type="text" defaultValue={person?.name} />
          </div>
          <div className="field">
            <label>{t("Language")}</label>
            <select value={state.lang} onChange={(e) => set({ lang: e.target.value as "en" | "zh" })}>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>
          <div className="field">
            <label>{t("Time zone")}</label>
            <select defaultValue="hcm">
              <option value="hcm">Asia/Ho_Chi_Minh (UTC+7)</option>
              <option value="sg">Asia/Singapore (UTC+8)</option>
            </select>
          </div>
          <div className="field">
            <label>{t("Memberships")}</label>
            <div className="tiny">Sending Labs — {person?.role}</div>
          </div>
          <Button variant="primary" onClick={() => say(t("Saved"), { type: "success" })}>
            {t("Save")}
          </Button>
        </>
      );

    case "appearance":
      return (
        <>
          <SettingsHead title={t("Appearance")} scope={t("Account — personal")} />
          <p className="tiny" style={{ marginBottom: 16 }}>
            {t("This panel and the header Appearance button control the same preference — changes apply instantly everywhere.")}
          </p>
          <AppearancePanel />
          <div style={{ marginBottom: 16 }}>
            <AppearancePreview />
          </div>
          <Button variant="text" onClick={resetAppearance}>
            {t("Reset to defaults")}
          </Button>
        </>
      );

    case "homepage":
      return (
        <>
          <SettingsHead title={t("Homepage & Views")} scope={`${t("You")} • Sending Labs • ${t("JD Management")}`} />
          <div className="field">
            <label>{t("T1 — My work")}</label>
            <div className="checkbox-row">
              <input type="checkbox" defaultChecked id="t1-expanded" />
              <label htmlFor="t1-expanded" style={{ margin: 0, textTransform: "none" }}>
                {t("Always expanded (cannot be fully hidden)")}
              </label>
            </div>
          </div>
          <div className="field">
            <label>{t("T2/T3 default state")}</label>
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="trends-default"
                checked={state.homeTrendsOpen}
                onChange={(e) => set({ homeTrendsOpen: e.target.checked })}
              />
              <label htmlFor="trends-default" style={{ margin: 0, textTransform: "none" }}>
                {t("Show T2/T3 statistics expanded by default")}
              </label>
            </div>
          </div>
          <div className="field">
            <label>{t("Saved views")}</label>
            {SAVED_VIEWS.map((v) => (
              <span key={v} className="tag" style={{ margin: 2 }}>
                {t(v, `savedView.${v}`)}
              </span>
            ))}
          </div>
          <Button variant="primary" onClick={() => say(t("Saved"), { type: "success" })}>
            {t("Save")}
          </Button>{" "}
          <Button variant="text" onClick={() => say(t("Reset — saved views were not deleted"))}>
            {t("Reset to defaults")}
          </Button>
        </>
      );

    case "notifications":
      return (
        <>
          <SettingsHead title={t("Notifications")} scope={`${t("You")} • ${t("Personal")}`} />
          <div className="field">
            <label>{t("Channels")}</label>
            <div className="checkbox-row">
              <input type="checkbox" defaultChecked id="ch-inapp" />
              <label htmlFor="ch-inapp" style={{ margin: 0, textTransform: "none" }}>
                {t("In-app")}
              </label>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" defaultChecked id="ch-email" />
              <label htmlFor="ch-email" style={{ margin: 0, textTransform: "none" }}>
                {t("Email")}
              </label>
            </div>
          </div>
          <div className="field">
            <label>{t("Working hours")}</label>
            <div className="flex gap-8">
              <input type="text" defaultValue="09:00" style={{ width: 90 }} />
              <span style={{ alignSelf: "center" }}>{t("to")}</span>
              <input type="text" defaultValue="18:00" style={{ width: 90 }} />
            </div>
          </div>
          <div className="field">
            <label>{t("Digest frequency")}</label>
            <select defaultValue="daily">
              <option value="realtime">{t("Real-time")}</option>
              <option value="daily">{t("Daily digest")}</option>
              <option value="weekly">{t("Weekly digest")}</option>
            </select>
          </div>
          <div className="warning-inline" style={{ marginBottom: 16 }}>
            <Icon name="campaign" />
            {t("Approval-step notifications are mandated by workflow policy and cannot be fully disabled.")}
          </div>
          <div className="field">
            <label>{t("Recent sends")}</label>
            <div className="tiny">
              {t("Approval reminder to Alex Park — delivered")} • {fmtRelative(hoursAgo(3))}
            </div>
            <div className="tiny">
              {t("Task reminder to Linh Tran — failed (bounced)")} • {fmtRelative(daysAgo(1))}
            </div>
          </div>
          <Button variant="primary" onClick={() => say(t("Saved"), { type: "success" })}>
            {t("Save")}
          </Button>
        </>
      );

    case "organization":
      return (
        <>
          <SettingsHead title={t("Organization & Workspace")} scope={t("Workspace admin")} />
          <div className="field">
            <label>{t("Company")}</label>
            <input type="text" defaultValue="Sending Labs" />
          </div>
          <div className="field">
            <label>{t("Default language / time zone")}</label>
            <div className="tiny">English • Asia/Ho_Chi_Minh</div>
          </div>
          <div className="field">
            <label>{t("Departments")}</label>
            {["Engineering", "People", "Finance", "Product", "Customer Success"].map((d) => (
              <span key={d} className="tag" style={{ margin: 2 }}>
                {d}
              </span>
            ))}
          </div>
          <div className="field">
            <label>{t("Locations")}</label>
            {["Hanoi, VN", "Ho Chi Minh City, VN", "Singapore", "Remote"].map((d) => (
              <span key={d} className="tag" style={{ margin: 2 }}>
                {d}
              </span>
            ))}
          </div>
          <Button variant="primary" onClick={() => say(t("Saved"), { type: "success" })}>
            {t("Save")}
          </Button>
        </>
      );

    case "members":
      return (
        <>
          <SettingsHead title={t("Members & Permissions")} scope={t("Permission admin")} />
          <div className="field">
            <input type="text" placeholder={t("Search members…")} />
          </div>
          <div className="card">
            {Object.values(PEOPLE).map((p) => (
              <div key={p.id} className="list-row">
                <span className="avatar-sm" style={{ background: p.color }}>
                  {p.initials}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  <div className="tiny">{p.email}</div>
                </div>
                <span className="badge badge-neutral">{p.role}</span>
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => say(t("Job scope and restricted-field entitlements are configured per member (demo)"))}
                >
                  {t("Manage scope")}
                </Button>
              </div>
            ))}
          </div>
        </>
      );

    case "workflow":
      return (
        <>
          <SettingsHead title={t("Workflow & Approvals")} scope={`${t("Workspace")} • ${t("JD module")}`} />
          <div className="field">
            <label>{t("Default policy")}</label>
            <div className="tiny">{t("Hiring Manager → HR (two distinct people)")}</div>
          </div>
          <div className="field">
            <label>{t("Conditional steps")}</label>
            <div className="tiny">
              {t("Finance step added automatically when department = Finance, or when budget policy requires review.")}
            </div>
          </div>
          <div className="field">
            <label>{t("Submission threshold")}</label>
            <div className="tiny">
              {t(
                "Title, valid owner, HC, location/workplace type, ≥1 responsibility, explicit must-have/preferred, internal/external visibility, valid approval policy, 0 unresolved blockers.",
              )}
            </div>
          </div>
          <div className="field">
            <label>{t("Material change fields")}</label>
            {[
              "Salary",
              "Headcount",
              "Location",
              "Level",
              "Employment type",
              "Must-have requirements",
              "Key responsibilities",
              "Rubric/weights",
            ].map((d) => (
              <span key={d} className="tag" style={{ margin: 2 }}>
                {t(d)}
              </span>
            ))}
          </div>
          <Button variant="primary" onClick={() => say(t("Published new policy version"), { type: "success" })}>
            {t("Publish policy")}
          </Button>
        </>
      );

    case "email":
      return (
        <>
          <SettingsHead title={t("Email & Publication")} scope={`${t("Workspace")} • ${t("send/publish permissions")}`} />
          <div className="field">
            <label>{t("Send identity")}</label>
            <div className="tiny">HR@sendinglabs.com ({t("shared, authorized")})</div>
          </div>
          <div className="field">
            <label>{t("Default audience")}</label>
            <select defaultValue="public">
              <option value="internal">{t("Internal only")}</option>
              <option value="public">{t("Public (approved External JD only)")}</option>
            </select>
          </div>
          <div className="field">
            <label>{t("Channels")}</label>
            {[
              { name: "Careers site", icon: "language" },
              { name: "LinkedIn Jobs", icon: "business_center" },
            ].map((ch) => (
              <div key={ch.name} className="conn-card">
                <div className="cc-top">
                  <div className="cc-icon">
                    <Icon name={ch.icon} />
                  </div>
                  <div style={{ flex: 1, fontWeight: 500 }}>{ch.name}</div>
                  <StatusBadge kind="connection_status" value="connected" />
                </div>
                <Button variant="text" size="sm" onClick={() => say(t("Test connection succeeded"), { type: "success" })}>
                  {t("Test connection")}
                </Button>
              </div>
            ))}
          </div>
        </>
      );

    case "data-policy":
      return (
        <>
          <SettingsHead title={t("Data Policy & Audit")} scope={t("Policy/audit admin")} />
          <div className="field">
            <label>{t("Restricted field classes")}</label>
            {["age_preference", "national_origin_proxy", "gender_proxy"].map((d) => (
              <span key={d} className="tag mono" style={{ margin: 2 }}>
                {d}
              </span>
            ))}
          </div>
          <div className="field">
            <label>{t("Retention")}</label>
            <div className="tiny">{t("Closed jobs: retained 24 months. Archived: retained per legal hold policy.")}</div>
          </div>
          <div className="field">
            <label>{t("Audit log")}</label>
            <div className="card">
              {(state.activity["job-demo-102"] ?? []).slice(0, 6).map((a, i) => (
                <div key={i} className="timeline-item" style={{ padding: "10px 14px" }}>
                  <div className="ti-icon">
                    <Icon name="history" />
                  </div>
                  <div className="ti-body">
                    <div className="ti-title">
                      {a.actor === "system" ? t("System") : (getPerson(a.actor)?.name ?? a.actor)} — {a.text}
                    </div>
                    <div className="ti-meta">{fmtDateTime(a.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      );

    default:
      return <EmptyState icon="settings" title={t("Not found")} />;
  }
}

/* ---------------------------------------------------------------
   AI Models
   --------------------------------------------------------------- */
type ModelTab = "catalog" | "policies" | "compare" | "usage" | "activity";

function AiModelsSection() {
  const { t } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as ModelTab) || "catalog";
  const tabs: { key: ModelTab; label: string }[] = [
    { key: "catalog", label: "Model catalog" },
    { key: "policies", label: "Task policies" },
    { key: "compare", label: "Compare & evaluate" },
    { key: "usage", label: "Usage & cost" },
    { key: "activity", label: "Activity & versions" },
  ];
  return (
    <div className="settings-content" style={{ maxWidth: 1040 }}>
      <h2 className="section-title">
        {t("AI Models")}
        <span className="scope-tag">{t("Model admin • quality lead")}</span>
      </h2>
      <div className="underline-tabs">
        {tabs.map((x) => (
          <div key={x.key} className={`u-tab${tab === x.key ? " active" : ""}`} onClick={() => setParams({ tab: x.key })}>
            {t(x.label)}
          </div>
        ))}
      </div>
      {tab === "catalog" ? (
        <ModelCatalog />
      ) : tab === "policies" ? (
        <TaskPolicies />
      ) : tab === "compare" ? (
        <CompareEvaluate />
      ) : tab === "usage" ? (
        <UsageCost />
      ) : (
        <ModelActivity />
      )}
    </div>
  );
}

function ModelCatalog() {
  const { t, say } = useStore();
  return (
    <>
      <Button size="sm" style={{ marginBottom: 14 }} onClick={() => say(t("Model connection reference added (demo)"), { type: "success" })}>
        <Icon name="add" />
        {t("Add model connection")}
      </Button>
      {MODELS.map((m) => (
        <div key={m.id} className="model-card">
          <div className="mc-top">
            <div>
              <div style={{ fontWeight: 600 }}>{m.name}</div>
              <div className="tiny">
                {m.provider} • {t("region")}: {m.region}
              </div>
            </div>
            <span className={`badge ${m.status === "enabled" ? "badge-success" : "badge-neutral"}`}>
              {m.status === "enabled" ? t("Enabled") : t("Disabled")}
            </span>
          </div>
          <div className="flex gap-6 flex-wrap" style={{ marginBottom: 6 }}>
            {m.capabilities.map((c) => (
              <span key={c} className="tag mono">
                {c}
              </span>
            ))}
          </div>
          {m.disabledReason && (
            <div className="warning-inline" style={{ marginBottom: 8 }}>
              <Icon name="block" />
              {t(m.disabledReason)}
            </div>
          )}
          <div className="model-metric-grid">
            {[
              { val: m.priceKnown ? m.priceIn : t("Unknown"), lbl: t("Price in") },
              { val: m.priceKnown ? m.priceOut : t("Unknown"), lbl: t("Price out") },
              { val: m.p50, lbl: t("P50 latency") },
              { val: m.p95, lbl: t("P95 latency") },
              { val: m.accuracy === "Not evaluated" ? t("Not evaluated") : m.accuracy, lbl: t("Accuracy (sample)") },
            ].map((metric) => (
              <div key={metric.lbl} className="model-metric">
                <div className="mm-val">{metric.val}</div>
                <div className="mm-lbl">{metric.lbl}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-8" style={{ marginTop: 10 }}>
            <Button variant="text" size="sm" onClick={() => say(t("Test call succeeded (demo)"), { type: "success" })}>
              {t("Test")}
            </Button>
            {m.priceKnown ? (
              <Button
                variant="text"
                size="sm"
                onClick={() => say(t("Price sync scheduled nightly — last run succeeded"), { type: "success" })}
              >
                {t("Price sync: Scheduled")}
              </Button>
            ) : (
              <Button
                variant="text"
                size="sm"
                onClick={() => say(t("This provider does not support automatic price sync — use manual update."))}
              >
                {t("Price sync: Unsupported")}
              </Button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function TaskPolicies() {
  const { t, say } = useStore();
  const modelName = (id: string | null) => (id ? (MODELS.find((m) => m.id === id)?.name ?? "—") : "—");
  return (
    <>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Task type")}</th>
              <th>{t("Primary model")}</th>
              <th>{t("Fallback")}</th>
              <th>{t("Preference")}</th>
              <th>{t("Notes")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {Object.entries(TASK_POLICIES).map(([k, p]) => (
              <tr key={k}>
                <td className="mono">{k}</td>
                <td>{modelName(p.primary)}</td>
                <td>{modelName(p.fallback)}</td>
                <td>{t(p.preference)}</td>
                <td className="tiny">{t(p.notes)}</td>
                <td className="text-right">
                  <Button variant="text" size="sm" onClick={() => say(t("Policy edit flow not built in this prototype"))}>
                    {t("Edit")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="info-inline" style={{ marginTop: 12 }}>
        <Icon name="info" />
        {t("Policies inherit Platform → Workspace → JD → Task hard limits; a lower level may only tighten, never relax them.")}
      </div>
    </>
  );
}

function CompareEvaluate() {
  const { t, say } = useStore();
  return (
    <>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Task type")}</th>
              <th>{t("Model")}</th>
              <th>{t("Sample")}</th>
              <th>{t("Accuracy")}</th>
              <th>{t("Cost/doc")}</th>
              <th>P50</th>
              <th>P95</th>
              <th>{t("Failure rate")}</th>
              <th>{t("Reviewer")}</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_EVALS.map((e) => (
              <tr key={e.id}>
                <td className="mono">{e.taskType}</td>
                <td>{MODELS.find((m) => m.id === e.model)?.name}</td>
                <td>{e.sampleSize}</td>
                <td>{e.accuracy}</td>
                <td>{e.cost}</td>
                <td>{e.p50}</td>
                <td>{e.p95}</td>
                <td>{e.failureRate}</td>
                <td>
                  <PersonChip id={e.reviewer} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section-block" style={{ marginTop: 18 }}>
        <div className="section-title" style={{ fontSize: "var(--fs-sm)" }}>
          {t("Controlled rollout")}
        </div>
        <div className="card card-pad">
          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontWeight: 500 }}>Claude — Balanced v2 {t("candidate")}</div>
              <div className="tiny">{t("Sample 15% • Budget cap $50 • Stop threshold: accuracy drop >3pts")}</div>
            </div>
            <Button size="sm" onClick={() => say(t("Rollout completed at 100% — no regression detected"), { type: "success" })}>
              {t("View status")}
            </Button>
          </div>
        </div>
      </div>
      <div className="section-block">
        <div className="section-title" style={{ fontSize: "var(--fs-sm)" }}>
          {t("Quality regression")}
        </div>
        <div className="card card-pad">
          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontWeight: 500 }}>
                <span className="mono">jd_generate</span> {t("weekly regression")}
              </div>
              <div className="tiny">{t("Dataset v3 • Threshold: accuracy ≥ 90% • On failure: alert + block auto-publish")}</div>
            </div>
            <Button variant="text" size="sm" onClick={() => say(t("Last run passed — 94% accuracy"), { type: "success" })}>
              {t("View last run")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function UsageCost() {
  const { t } = useStore();
  return (
    <>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Task type")}</th>
              <th>{t("Estimated")}</th>
              <th>{t("Reserved")}</th>
              <th>{t("Actual")}</th>
              <th>{t("Pending reconciliation")}</th>
              <th>{t("Period")}</th>
            </tr>
          </thead>
          <tbody>
            {USAGE_ROWS.map((r) => (
              <tr key={r.taskType}>
                <td className="mono">{r.taskType}</td>
                <td>{r.estimated}</td>
                <td>{r.reserved}</td>
                <td>{r.actual}</td>
                <td>{r.pending}</td>
                <td className="tiny">{t(r.period)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tiny" style={{ marginTop: 10 }}>
        {t("AI cost budget is tracked separately from hiring headcount budget.")}
      </div>
    </>
  );
}

function ModelActivity() {
  const { t, say } = useStore();
  return (
    <>
      <div className="card card-pad">
        {MODEL_ACTIVITY.map((a, i) => (
          <div key={i} className="timeline-item">
            <div className="ti-icon">
              <Icon name="history" />
            </div>
            <div className="ti-body">
              <div className="ti-title">{t(a.text)}</div>
              <div className="ti-meta">{fmtDateTime(a.at)}</div>
            </div>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        style={{ marginTop: 12 }}
        onClick={() => say(t("Rolled back to previous approved policy version"), { type: "success" })}
      >
        {t("Rollback to previous version")}
      </Button>
    </>
  );
}
