import { Drawer } from "antd";
import { useStore, zhText } from "../store/StoreContext";
import { CloseSvg, OpenSvg, QuoteSvg } from "./ui/Icons";
import { COMPS } from "../data/comps";
import { compName } from "../utils/status";

export function ScoreTraceDrawer() {
  const { state, set, t, evidence } = useStore();
  const drawer = state.drawer;
  const open = !!drawer;

  if (!drawer) return null;

  // Three kinds of drawers:
  // "file:FILENAME" -> file details
  // "compId:anchors" -> behavioral anchors
  // "compId:score" or "compId:evidence" -> score trace

  if (drawer.startsWith("file:")) {
    const fname = drawer.slice(5);
    return (
      <FileDrawer fname={fname} open={open} onClose={() => set({ drawer: null, sourceAnswer: null })} />
    );
  }

  const [compId, mode] = drawer.split(":");
  const comp = COMPS.find((c) => c.id === compId);
  if (!comp) return null;

  if (mode === "anchors") {
    return (
      <AnchorsDrawer
        compId={compId}
        open={open}
        onClose={() => set({ drawer: null })}
      />
    );
  }

  // Score trace / evidence
  return (
    <ScoreTrace
      compId={compId}
      open={open}
      onClose={() => set({ drawer: null, sourceAnswer: null })}
    />
  );
}

function FileDrawer({ fname, open, onClose }: { fname: string; open: boolean; onClose: () => void }) {
  const { t, state } = useStore();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={520}
      closable={false}
      styles={{
        body: { padding: 0 },
        wrapper: { width: "min(520px, 96vw)" },
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          padding: "17px 20px 15px",
          borderBottom: "1px solid var(--line)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10.5,
              letterSpacing: ".05em",
              color: "var(--ink-3)",
            }}
          >
            {t.evidenceTraceHeader}
          </div>
          <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>
            {t.evidenceManifestHeader}
          </div>
        </div>
        <button
          aria-label={t.close}
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "var(--surface)",
            color: "var(--ink-2)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CloseSvg />
        </button>
      </div>
      <div style={{ padding: "16px 20px 24px" }}>
        <Steps
          items={[
            { step: "1", ref: "READ STATUS", text: "Available · virus scan passed · text extraction completed where supported." },
            {
              step: "2",
              ref: "BUSINESS STATUS",
              text: fname.includes("Assessment_Result")
                ? "No assessment linked to the active project."
                : "Source is retained; project matching never happens silently.",
            },
            { step: "3", ref: "AVAILABLE ACTIONS", text: "Preview, download, view activity and resolve matching are simulated from this detail panel." },
            { step: "4", ref: "ACCESS", text: "Internal recruiting team only. Candidates cannot access this file from the interview workspace." },
          ]}
        />
      </div>
    </Drawer>
  );
}

function AnchorsDrawer({ compId, open, onClose }: { compId: string; open: boolean; onClose: () => void }) {
  const { t, state } = useStore();
  const comp = COMPS.find((c) => c.id === compId);
  if (!comp) return null;
  const title = `${compName(comp, state.lang)} — BEHAVIORAL ANCHORS`;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={520}
      closable={false}
      styles={{ body: { padding: 0 }, wrapper: { width: "min(520px, 96vw)" } }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          padding: "17px 20px 15px",
          borderBottom: "1px solid var(--line)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10.5,
              letterSpacing: ".05em",
              color: "var(--ink-3)",
            }}
          >
            BEHAVIORAL ANCHORS
          </div>
          <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>
            {title}
          </div>
        </div>
        <button
          aria-label={t.close}
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "var(--surface)",
            color: "var(--ink-2)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CloseSvg />
        </button>
      </div>
      <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {comp.anchors.map((a, i) => (
          <div className="trace-step" key={i}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div className="trace-step-number">{i + 1}</div>
              <div
                style={{
                  flex: 1,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: "var(--ink-3)",
                }}
              >
                Level {i + 1}
              </div>
            </div>
            <div style={{ marginTop: 7, fontSize: 12.5, lineHeight: 1.55 }}>
              {zhText(a, state.lang)}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

function ScoreTrace({
  compId,
  open,
  onClose,
}: {
  compId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { state, set, t, evidence, r1Scores, role, say } = useStore();
  const comp = COMPS.find((c) => c.id === compId);
  if (!comp) return null;
  const human = comp.round === "r1" ? r1Scores[compId] ?? null : state.r2Scores[compId] ?? null;
  const ev = evidence[compId] || [];
  const drawerReason =
    comp.id === "bed"
      ? state.lang === "zh"
        ? "人工评审将评分上调，因为 goroutine 泄漏排查案例体现了直接的生产工程深度；较弱的连接池容量回答仍作为反向证据保留。"
        : "The human reviewer raised the score because the goroutine-leak debugging example showed direct production depth; the weaker connection-pool sizing answer remains visible as counter-evidence."
      : comp.id === "sca"
        ? state.lang === "zh"
          ? "未记录评分，因为该回答无法关联到候选人亲自做出的具体决策。缺失证据继续显示为「未知」，不会被换算成低分。"
          : "No score was recorded because the answer could not be tied to a specific decision made by the candidate. Unknown is preserved instead of converting missing evidence to a low score."
        : comp.id === "cm"
          ? state.lang === "zh"
            ? "人工评审保留了低于 AI 草稿的评分，因为尚无证据表明候选人在同事持续受阻时会调整辅导方式。"
            : "The human reviewer kept the score below the AI draft because there was no evidence of adapting the mentoring approach when the teammate remained blocked."
          : state.lang === "zh"
            ? "人工评审确认引用的证据达到了当前记录等级对应的行为锚点。"
            : "The human reviewer confirmed that the cited evidence meets the behavioral anchor for the recorded level.";

  const title = `${compName(comp, state.lang)} — ${t.evidenceTraceHeader.toLowerCase()}`;

  const sourceAnswer = state.sourceAnswer;
  const originalIsManual = sourceAnswer?.source === "manual";
  const originalIsResume = sourceAnswer?.source === "resume";
  const originalTime = sourceAnswer?.timecode ?? "00:07:02";
  const originalRef = sourceAnswer?.ref ?? "";
  const originalMeta = !sourceAnswer
    ? ""
    : originalIsResume
      ? state.lang === "zh"
        ? "来源：候选人简历 · 原始文件"
        : "Source: candidate résumé · original file"
      : originalIsManual
        ? state.lang === "zh"
          ? "来源：面试官人工笔记 · 第 2 轮"
          : "Source: interviewer manual notes · Round 2"
        : state.lang === "zh"
          ? `来源：实时转写 · 第 1 轮 · ${originalTime} · Elena Torres`
          : `Source: live transcript · Round 1 · ${originalTime} · Elena Torres`;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={520}
      closable={false}
      styles={{ body: { padding: 0 }, wrapper: { width: "min(520px, 96vw)" } }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          padding: "17px 20px 15px",
          borderBottom: "1px solid var(--line)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10.5,
                letterSpacing: ".05em",
                color: "var(--ink-3)",
              }}
            >
              {t.evidenceTraceHeader}
            </div>
            <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>
              {title}
            </div>
          </div>
          <button
            aria-label={t.close}
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "var(--surface)",
              color: "var(--ink-2)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseSvg />
          </button>
        </div>
        <div
          style={{
            marginTop: 13,
            display: "grid",
            gridTemplateColumns: "repeat(5,1fr)",
            gap: 5,
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                height: 5,
                borderRadius: 3,
                background: "var(--brand)",
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}>
          {t.traceChainLabel}
        </div>
      </div>

      <div style={{ padding: "16px 20px 24px" }}>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 11,
            background: "var(--brand-soft)",
            color: "var(--ink)",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          {state.lang === "zh"
            ? "每个最终评分都沿同一条链路保存：岗位要求与评分标准 → AI 草稿 → 人工评分 → 人工理由 → 原始证据。点击证据可查看原始回答及上下文。"
            : "Every final score keeps one auditable chain: requirement and rubric → AI draft → human score → human rationale → original evidence. Open any evidence item to inspect the source response and context."}
        </div>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <Steps
            items={[
              {
                step: "1",
                ref: state.lang === "zh" ? "岗位要求 + 评分标准" : "REQUIREMENT + RUBRIC",
                text: `${compName(comp, state.lang)} · Required L${comp.req} · Weight ${comp.w}% · rubric v${state.rubricVersion}`,
              },
              {
                step: "2",
                ref: state.lang === "zh" ? "AI 草稿（仅供参考）" : "AI DRAFT · SUGGESTION ONLY",
                text:
                  comp.ai == null
                    ? state.lang === "zh"
                      ? "未知"
                      : "Unknown"
                    : (state.lang === "zh" ? "等级 " : "Level ") + comp.ai +
                      (state.lang === "zh"
                        ? " · AI 建议与人工评分分开保存，绝不会覆盖人工结果。"
                        : " · Kept separate from the human score and never overwrites it."),
              },
              {
                step: "3",
                ref: state.lang === "zh" ? "人工评分" : "HUMAN SCORE",
                text:
                  human == null
                    ? state.lang === "zh"
                      ? "未知 · 证据不足；不会换算为 0 分或能力不足。"
                      : "Unknown · insufficient evidence; never converted to zero or a low-ability signal."
                    : (state.lang === "zh"
                        ? "等级 " + human + " · 由 "
                        : "Level " + human + " · recorded by ") +
                      (comp.round === "r1" ? "David Kim" : "Priya Nair"),
              },
              { step: "4", ref: state.lang === "zh" ? "人工理由" : "HUMAN RATIONALE", text: drawerReason },
            ]}
          />
          {ev.length ? (
            ev.map((e, i) => (
              <div key={i} className="trace-step">
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div className="trace-step-number">5</div>
                  <div
                    style={{
                      flex: 1,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 10,
                      color: "var(--ink-3)",
                    }}
                  >
                    {state.lang === "zh" ? "证据 " : "EVIDENCE "} {i + 1} ·{" "}
                    {zhText(e.ref, state.lang)}
                  </div>
                </div>
                <div style={{ marginTop: 7, fontSize: 12.5, lineHeight: 1.55 }}>
                  {zhText(e.text, state.lang)}
                </div>
                <button
                  onClick={() => set({ sourceAnswer: e })}
                  style={{
                    marginTop: 10,
                    height: 30,
                    padding: "0 11px",
                    border: "1px solid var(--brand)",
                    borderRadius: 8,
                    background: "var(--surface)",
                    color: "var(--brand)",
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <OpenSvg />
                  {state.lang === "zh" ? "查看原始回答" : "Open original response"}
                </button>
              </div>
            ))
          ) : (
            <div className="trace-step">
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div className="trace-step-number">5</div>
                <div
                  style={{
                    flex: 1,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                    color: "var(--ink-3)",
                  }}
                >
                  {state.lang === "zh" ? "证据" : "EVIDENCE"}
                </div>
              </div>
              <div style={{ marginTop: 7, fontSize: 12.5, lineHeight: 1.55 }}>
                {state.lang === "zh"
                  ? "当前没有足够的可核实证据，状态保持为未知。"
                  : "No sufficient, verifiable evidence is currently available; the result remains Unknown."}
              </div>
            </div>
          )}
        </div>

        {sourceAnswer && (
          <div
            style={{
              marginTop: 16,
              padding: "15px 16px",
              border: "1px solid var(--brand)",
              borderRadius: 12,
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className="material-symbols-rounded" style={{ color: "var(--brand)" }}>
                format_quote
              </span>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
                {t.originalResponse}
              </div>
              <button
                onClick={() => set({ sourceAnswer: null })}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "var(--ink-3)",
                  cursor: "pointer",
                  fontSize: 11.5,
                }}
              >
                {t.collapse}
              </button>
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10.5,
                color: "var(--ink-3)",
              }}
            >
              {originalMeta}
            </div>
            <div
              style={{
                marginTop: 10,
                padding: "12px 13px",
                borderLeft: "3px solid var(--brand)",
                background: "var(--surface-2)",
                fontSize: 12.5,
                lineHeight: 1.6,
              }}
            >
              {sourceAnswer.sourceText || sourceAnswer.text}
            </div>
            <div style={{ marginTop: 11, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  if (originalIsResume) set({ screen: "files" });
                  else
                    set({
                      screen: "live",
                      roundView: originalIsManual ? "r2" : "r1",
                      liveTab: originalIsManual ? "notes" : "transcript",
                    });
                  set({ drawer: null, sourceAnswer: null });
                }}
                style={{
                  height: 30,
                  padding: "0 11px",
                  border: "1px solid var(--brand)",
                  borderRadius: 8,
                  background: "var(--brand)",
                  color: "var(--brand-ink)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t.openTranscriptContext}
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(originalRef);
                    say(state.lang === "zh" ? "证据引用已复制。" : "Evidence reference copied.");
                  } catch {
                    say(
                      state.lang === "zh"
                        ? "浏览器未允许复制，请手动记录证据引用。"
                        : "Copy was not permitted by the browser; note the evidence reference manually.",
                    );
                  }
                }}
                style={{
                  height: 30,
                  padding: "0 11px",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  background: "var(--surface)",
                  fontSize: 11.5,
                  cursor: "pointer",
                }}
              >
                {t.copyEvidenceReference}
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function Steps({ items }: { items: { step: string; ref: string; text: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} className="trace-step">
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div className="trace-step-number">{it.step}</div>
            <div
              style={{
                flex: 1,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                color: "var(--ink-3)",
              }}
            >
              {it.ref}
            </div>
          </div>
          <div style={{ marginTop: 7, fontSize: 12.5, lineHeight: 1.55 }}>
            {it.text}
          </div>
        </div>
      ))}
    </div>
  );
}