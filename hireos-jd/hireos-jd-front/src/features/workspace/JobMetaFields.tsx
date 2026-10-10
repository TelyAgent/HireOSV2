/**
 * Job fields shown under the document title (completeness standard group A). Location, Headcount and
 * Level are required and always visible — flagged when empty. The optional ones are added on demand
 * through "Add field" and can be removed from the view again.
 *
 * Fields Core Record holds (location, headcount, level, team, employment type) are saved to the job
 * right away; the rest live in the document's `meta` and are saved with the document.
 */
import { useEffect, useState } from "react";
import { Dropdown, Input, Select } from "antd";
import { Icon } from "../../components/ui/Icons";
import { useStore } from "../../store/StoreContext";
import { PEOPLE } from "../../data/fixtures/people";
import { updateJobFields, type JobFieldsPatch } from "../jobs/jobsApi";
import { coreJobToLocalJob } from "../jobs/jobsMapping";
import { editDocCopy, selectDraft } from "./docHelpers";
import type { Job } from "../../data/types";
import type { Evaluation } from "./completeness";

type FieldType = "text" | "number" | "select" | "person" | "date";
interface FieldDef {
  key: string;
  label: string;
  icon: string;
  type: FieldType;
  options?: string[];
  /** Core Record field this maps to; absent = stored in the document meta. */
  core?: keyof JobFieldsPatch;
}

const REQUIRED_FIELDS: FieldDef[] = [
  { key: "location", label: "Location", icon: "location_on", type: "text", core: "location" },
  { key: "headcount", label: "Headcount", icon: "group", type: "number", core: "openings" },
  { key: "level", label: "Level", icon: "military_tech", type: "text", core: "seniority" },
];

const OPTIONAL_FIELDS: FieldDef[] = [
  { key: "department", label: "Department", icon: "apartment", type: "text" },
  { key: "team", label: "Team", icon: "groups", type: "text", core: "team" },
  { key: "employmentType", label: "Employment type", icon: "badge", type: "select", options: ["Full-time", "Part-time", "Contract", "Intern"], core: "employmentType" },
  { key: "workplaceType", label: "Workplace type", icon: "home_work", type: "select", options: ["On-site", "Hybrid", "Remote"] },
  { key: "hiringManager", label: "Hiring manager", icon: "person", type: "person" },
  { key: "recruiter", label: "Recruiter", icon: "person_search", type: "person" },
  { key: "reportsTo", label: "Reports to", icon: "account_tree", type: "text" },
  { key: "hiringReason", label: "Hiring reason", icon: "help", type: "select", options: ["New headcount", "Business expansion", "Replacement"] },
  { key: "priority", label: "Priority", icon: "flag", type: "select", options: ["low", "normal", "high", "urgent"] },
  { key: "targetStart", label: "Target start date", icon: "event", type: "date" },
  { key: "deadline", label: "Application deadline", icon: "event_busy", type: "date" },
];

/** "—" is the placeholder the job mapping uses for fields Core Record didn't return. */
export function isBlankValue(v: unknown) {
  return v == null || String(v).trim() === "" || String(v).trim() === "—";
}

export function JobMetaFields({ jobId, ev }: { jobId: string; ev: Evaluation | null }) {
  const { state, t, mutate, say } = useStore();
  const job = state.jobs[jobId];
  const meta = selectDraft(state, jobId).meta;
  const shown = meta?.shown ?? [];

  const valueOf = (f: FieldDef): string => {
    if (!f.core && meta?.values[f.key] != null) return meta.values[f.key];
    const v = job[f.key as keyof Job];
    return isBlankValue(v) ? "" : String(v);
  };

  const saveMeta = (fn: (m: { values: Record<string, string>; shown: string[] }) => void) =>
    mutate((d) => {
      editDocCopy(d, jobId, (doc) => {
        const m = { values: { ...(doc.meta?.values ?? {}) }, shown: [...(doc.meta?.shown ?? [])] };
        fn(m);
        doc.meta = m;
        doc.revision++;
        if (doc.saveState !== "saving") doc.saveState = "dirty";
      });
    });

  /** Returns false (and keeps the old value) when the input is rejected or the save fails. */
  const save = async (f: FieldDef, raw: string): Promise<boolean> => {
    const value = raw.trim();
    if (value === valueOf(f)) return true;
    if (!f.core) {
      saveMeta((m) => {
        m.values[f.key] = value;
      });
      return true;
    }
    let patch: JobFieldsPatch;
    if (f.key === "headcount") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) {
        say(t("Headcount must be a whole number of 1 or more."), { type: "error" });
        return false;
      }
      patch = { openings: n };
    } else {
      if (!value && REQUIRED_FIELDS.includes(f)) {
        say(`${t(f.label)} ${t("is required — it can’t be empty.")}`, { type: "error" });
        return false;
      }
      patch = { [f.core]: value };
    }
    try {
      const updated = await updateJobFields(jobId, patch);
      mutate((d) => {
        const j = d.jobs[jobId];
        if (!j) return;
        d.jobs[jobId] = { ...coreJobToLocalJob(updated, j), [f.key]: f.key === "headcount" ? Number(value) : value };
      });
      say(t("Saved"), { type: "success" });
      return true;
    } catch (error) {
      say(error instanceof Error ? error.message : t("Couldn't save this field. Please try again."), { type: "error" });
      return false;
    }
  };

  const optional = shown.map((k) => OPTIONAL_FIELDS.find((f) => f.key === k)).filter((f): f is FieldDef => !!f);
  const addable = OPTIONAL_FIELDS.filter((f) => !shown.includes(f.key));

  return (
    <div className="jw-meta">
      {REQUIRED_FIELDS.map((f) => {
        const row = ev?.rows.find((r) => r.item.field === f.key);
        return (
          <MetaField
            key={f.key}
            def={f}
            value={valueOf(f)}
            missing={row ? !row.ok : !valueOf(f)}
            weak={row?.ok ? row.weak : ""}
            onSave={(v) => save(f, v)}
          />
        );
      })}
      {optional.map((f) => (
        <MetaField
          key={f.key}
          def={f}
          value={valueOf(f)}
          onSave={(v) => save(f, v)}
          onRemove={() =>
            saveMeta((m) => {
              m.shown = m.shown.filter((k) => k !== f.key);
            })
          }
        />
      ))}
      <span className="meta-break" />
      {addable.length > 0 && (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: addable.map((f) => ({ key: f.key, label: t(f.label), icon: <Icon name={f.icon} size={16} /> })),
            onClick: ({ key }) =>
              saveMeta((m) => {
                if (!m.shown.includes(key)) m.shown.push(key);
              }),
          }}
        >
          <button type="button" className="meta-add">
            <Icon name="add" />
            {t("Add field")}
          </button>
        </Dropdown>
      )}
    </div>
  );
}

function MetaField({
  def,
  value,
  missing,
  weak,
  onSave,
  onRemove,
}: {
  def: FieldDef;
  value: string;
  missing?: boolean;
  /** "Needs revision" message from the completeness check. */
  weak?: string;
  onSave: (value: string) => Promise<boolean>;
  onRemove?: () => void;
}) {
  const { t } = useStore();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = async (next: string) => {
    if (!(await onSave(next))) setDraft(value);
  };

  const placeholder = missing ? t("Required") : t("Not set");
  let control;
  if (def.type === "select" || def.type === "person") {
    const options =
      def.type === "person"
        ? Object.values(PEOPLE).map((p) => ({ value: p.id, label: p.name }))
        : (def.options ?? []).map((o) => ({ value: o, label: t(o.charAt(0).toUpperCase() + o.slice(1)) }));
    control = (
      <Select
        size="small"
        variant="borderless"
        className="jw-field-select"
        popupMatchSelectWidth={false}
        placeholder={placeholder}
        allowClear
        value={value || undefined}
        options={options}
        onChange={(v) => void commit((v as string | undefined) ?? "")}
      />
    );
  } else {
    control = (
      <Input
        size="small"
        variant="borderless"
        className={`jw-field-input${missing ? " is-missing" : ""}`}
        type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
        min={def.type === "number" ? 1 : undefined}
        placeholder={placeholder}
        value={draft}
        style={def.type === "date" ? undefined : { width: `${Math.max(def.type === "number" ? 5 : 10, draft.length + 2)}ch` }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    );
  }

  return (
    <label
      className={`jw-field${missing ? " is-missing" : ""}${weak ? " is-weak" : ""}${onRemove ? " jw-field-opt" : ""}`}
      data-field={def.key}
      title={weak ? t(weak) : undefined}
    >
      <span className="jw-field-label">
        <Icon name={def.icon} />
        {t(def.label)}
      </span>
      {control}
      {onRemove && (
        <button
          type="button"
          className="meta-x"
          title={t("Remove from this view")}
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
        >
          <Icon name="close" />
        </button>
      )}
    </label>
  );
}
