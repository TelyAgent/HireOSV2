import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Drawer } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Breadcrumbs, Button, Chip, EmptyState } from "../components/ui/Primitives";
import { currentRoundId } from "../utils/cases";
import {
  ATTEMPTS, CASES, CORE_CANDIDATES, INVITATIONS, PLANS, QUESTIONS, fmtDateShort, nowISO,
  type PlanItem, type Round,
} from "../data/fixtures";
import { getUser } from "../data/users";
import type { UserId } from "../store/types";

type OwnershipKey = "hrOwner" | "hiringManager" | "reviewAssignee";

function roundReleaseReady(rounds: Round[], roundId: string): { ready: boolean; reason?: string } {
  const round = rounds.find((r) => r.id === roundId);
  if (!round) return { ready: false, reason: "Round not found." };
  if (round.releaseCondition === "manual" || round.position === 1) return { ready: true };
  const prevIds = round.dependsOnRoundIds?.length ? round.dependsOnRoundIds : [rounds[round.position - 2]?.id].filter(Boolean) as string[];
  const prevRounds = prevIds.map((id) => rounds.find((r) => r.id === id)).filter(Boolean) as Round[];
  if (prevRounds.length === 0) return { ready: true };
  if (round.releaseCondition === "after_previous_submission") {
    const ok = prevRounds.every((r) => ["submitted", "review_pending", "completed"].includes(r.status));
    return { ready: ok, reason: ok ? undefined : "Previous round hasn't been submitted yet." };
  }
  if (round.releaseCondition === "after_previous_review") {
    const ok = prevRounds.every((r) => r.status === "completed");
    return { ready: ok, reason: ok ? undefined : "Previous round hasn't finished human review yet." };
  }
  return { ready: true };
}

export function PlanPage() {
  const { id: caseId = "" } = useParams();
  const { t, say } = useStore();
  const navigate = useNavigate();
  const c = CASES[caseId];

  const [ownership, setOwnership] = useState(c?.ownership ?? { hrOwner: null, hiringManager: null, reviewAssignee: null });
  const [roundMode, setRoundMode] = useState<"single" | "multiple">(c?.roundMode ?? "single");
  const [rounds, setRounds] = useState<Round[]>(() => c ? c.rounds.map((r) => ({ ...r })) : []);
  const [selectedRoundId, setSelectedRoundId] = useState<string | undefined>(() => (c ? currentRoundId(caseId) : undefined));
  const [plans, setPlans] = useState<Record<string, PlanItem>>(PLANS);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!c) return;
    setOwnership(c.ownership);
    setRoundMode(c.roundMode);
    setRounds(c.rounds.map((r) => ({ ...r })));
    setSelectedRoundId(currentRoundId(caseId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);
  const availableQuestions = useMemo(() => Object.values(QUESTIONS).filter((q) => ["published", "draft_review"].includes(q.status)), []);

  if (!c) return <div className="banner danger">{t("Case not found.")}</div>;

  const cand = CORE_CANDIDATES[c.candidateId];
  const round = rounds.find((r) => r.id === selectedRoundId) ?? rounds[0];
  const items = round.planItemIds.map((id) => plans[id]).filter(Boolean);
  const readiness = roundReleaseReady(rounds, round.id);
  const invs = Object.values(INVITATIONS).filter((i) => i.caseId === caseId);
  const canInvite = !!c.applicationId && items.length > 0 && readiness.ready;

  function updateOwnership(key: OwnershipKey, value: string) {
    setOwnership((prev) => ({ ...prev, [key]: value || null }));
    say("Ownership updated.", { type: "success" });
  }
  function updateRound(patch: Partial<Round>) {
    setRounds((prev) => prev.map((r) => (r.id === round.id ? { ...r, ...patch } : r)));
  }
  function addRound() {
    const pos = rounds.length + 1;
    const title = `Round ${pos}`;
    const nr: Round = { id: `round_${caseId}_${pos}`, position: pos, title, planItemIds: [], releaseCondition: "after_previous_review", dependsOnRoundIds: [rounds[rounds.length - 1].id], deadlineAt: null, status: "planned" };
    setRounds((prev) => [...prev, nr]);
    setSelectedRoundId(nr.id);
    setRoundMode("multiple");
    say(`${title} added — set its release condition and add a test.`, { type: "success" });
  }
  function addTest(questionId: string) {
    // PlanItem.kind is "required" | "optional" — the prototype's own runtime data used a
    // third "supplemental" value for a round's non-first item, which doesn't fit that union;
    // "optional" is the closest fit (a plan item added on top of the round's first, required one).
    const kind: PlanItem["kind"] = items.length === 0 ? "required" : "optional";
    const piId = `pi_${caseId}_${round.id.replace(`round_${caseId}_`, "")}_${questionId}`;
    setPlans((prev) => ({ ...prev, [piId]: { id: piId, caseId, questionId, kind, status: "awaiting_submission" } }));
    updateRound({ planItemIds: [...round.planItemIds, piId] });
    setPickerOpen(false);
    say(`${QUESTIONS[questionId].code} added to ${round.title} as a new plan item.`, { type: "success" });
  }
  function openSubmission(inv: (typeof invs)[number]) {
    const att = Object.values(ATTEMPTS).find((a) => a.caseId === caseId && (inv.questionIds.length === 0 || inv.questionIds.includes(a.questionId)));
    if (att) navigate(`/attempts/${att.id}/submission`);
    else say("No submission received yet.");
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Assessments", href: "/assessments" }, { label: "Finance Operations Hiring", href: "/assessments/prj_fin" }, { label: cand.name }]} />
      <h1 style={{ marginBottom: 4 }}>{cand.name}{t("'s plan")}</h1>
      <div className="muted" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        {cand.email} · <StatusBadge status={c.status} />
      </div>

      {!c.applicationId && (
        <div className="banner warning" style={{ marginBottom: 16 }}>{t("Confirm the candidate's role link first — invitations for a formal role assessment require a confirmed Application.")}</div>
      )}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <b>{t("Ownership")}</b>
          <span className="tiny">{t("Routes notifications only — not required to act (Startup Team Access)")}</span>
        </div>
        <div className="grid-3" style={{ gap: 10 }}>
          {([["hrOwner", "HR owner"], ["hiringManager", "Hiring manager"], ["reviewAssignee", "Review assignee"]] as const).map(([key, label]) => (
            <div key={key} className="field">
              <label>{t(label)}</label>
              <select className="input" value={ownership[key] ?? ""} onChange={(e) => updateOwnership(key, e.target.value)}>
                <option value="">{t("— Not set (defaults to initiator) —")}</option>
                {(["user_john", "user_daniel", "user_morgan", "user_sam"] as UserId[]).map((uid) => {
                  const u = getUser(uid);
                  return <option key={uid} value={uid}>{u.name} — {u.role}</option>;
                })}
              </select>
            </div>
          ))}
        </div>
        {!ownership.hrOwner && !ownership.hiringManager && (
          <div className="tiny" style={{ marginTop: 8, color: "var(--warning)" }}>{t("No HR owner or Hiring manager set — this doesn't block sending; the initiator is the default contact.")}</div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <b style={{ marginRight: 2 }}>{t("Plan structure")}</b>
        <Button size="sm" variant={roundMode !== "multiple" ? "primary" : "ghost"} onClick={() => setRoundMode("single")}>{t("Single round")}</Button>
        <Button size="sm" variant={roundMode === "multiple" ? "primary" : "ghost"} onClick={() => setRoundMode("multiple")}>{t("Multiple rounds")}</Button>
      </div>

      {roundMode === "multiple" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {rounds.map((r) => {
            const active = round.id === r.id;
            return (
              <div
                key={r.id}
                className="chip"
                style={{ cursor: "pointer", display: "flex", gap: 6, alignItems: "center", ...(active ? { background: "var(--selected-surface)", color: "var(--accent)", borderColor: "transparent" } : {}) }}
                onClick={() => setSelectedRoundId(r.id)}
              >
                {r.title} <StatusBadge status={r.status} />
              </div>
            );
          })}
          <Button size="sm" variant="ghost" onClick={addRound}>{t("+ Add round")}</Button>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <b>{round.title}</b>
          <StatusBadge status={round.status} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="field" style={{ minWidth: 220 }}>
            <label>{t("Release condition")}</label>
            <select
              className="input"
              value={round.releaseCondition}
              disabled={round.position === 1}
              title={round.position === 1 ? t("Round 1 has no previous round to depend on.") : undefined}
              onChange={(e) => { updateRound({ releaseCondition: e.target.value }); say("Release condition updated.", { type: "success" }); }}
            >
              <option value="manual">{t("Manual release")}</option>
              <option value="after_previous_submission">{t("After previous round is submitted")}</option>
              <option value="after_previous_review">{t("After previous round is reviewed")}</option>
            </select>
          </div>
          <div className="field">
            <label>{t("Deadline")}</label>
            <input
              className="input"
              type="date"
              value={round.deadlineAt ? round.deadlineAt.slice(0, 10) : ""}
              onChange={(e) => { updateRound({ deadlineAt: e.target.value ? new Date(e.target.value + "T23:59:00Z").toISOString() : null }); say("Deadline updated.", { type: "success" }); }}
            />
          </div>
        </div>
        {!readiness.ready && (
          <div className="banner warning" style={{ marginTop: 10 }}>{t("Not ready to release yet —")} {readiness.reason} {t("You can still plan and add tests; sending is blocked until the condition is met.")}</div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {items.length === 0 ? (
          <EmptyState icon="assignment" title="No plan items in this round yet. Add a test to get started." />
        ) : (
          items.map((pi) => {
            const q = QUESTIONS[pi.questionId];
            return (
              <div key={pi.id} className="task-row">
                <div className="task-main">
                  <div className="task-title">{q.code} — {q.title} <Chip>{pi.kind}</Chip></div>
                  <div className="task-sub">v{q.version} · {q.competencies.map((cc) => `${cc.name} ${Math.round(cc.fraction * 100)}%`).join(", ")}</div>
                </div>
                <StatusBadge status={pi.status} />
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Button onClick={() => setPickerOpen(true)}>{t("Add test")}</Button>
        <Button onClick={() => say("Plan approved — this is the acting employee's own confirmation, no second approver required (Startup Team Access).", { type: "success" })}>{t("Approve plan")}</Button>
        <Button
          variant="primary"
          disabled={!canInvite}
          title={!c.applicationId ? t("Confirm the candidate's role link first") : items.length === 0 ? t("Add at least one test first") : readiness.reason}
          onClick={() => navigate(`/invitations/new?cases=${caseId}${roundMode === "multiple" ? `&round=${round.id}` : ""}`)}
        >
          {t("Invite candidate")}{roundMode === "multiple" ? ` — ${round.title}` : ""}
        </Button>
        <Button variant="ghost" onClick={() => say(`Plan version history (demo): v1 created ${fmtDateShort(nowISO(0))}`)}>{t("History")}</Button>
      </div>

      {invs.length > 0 && (
        <>
          <h3 style={{ marginBottom: 8 }}>{invs.length > 1 ? t("Invitations") : t("Invitation")}</h3>
          {invs.map((inv) => (
            <div key={inv.id} className="card card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <b>{inv.mode === "timed" ? `${inv.durationMin} ${t("min timed")}` : t("Deadline only")}</b> · {t("deadline")} {fmtDateShort(inv.deadline)}
                <div className="tiny"><StatusBadge status={inv.status} /></div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => openSubmission(inv)}>{t("View submission →")}</Button>
            </div>
          ))}
        </>
      )}

      <Drawer open={pickerOpen} onClose={() => setPickerOpen(false)} title={t("Add from Question Bank")} width={460}>
        {availableQuestions.map((q) => (
          <div key={q.id} className="card card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 8 }} onClick={() => addTest(q.id)}>
            <div>
              <b>{q.code}</b> — {q.title}
              <div className="tiny">{q.roles.join(", ")}</div>
            </div>
            <StatusBadge status={q.status} />
          </div>
        ))}
      </Drawer>
    </div>
  );
}
