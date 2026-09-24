import { useStore } from '../../store/StoreContext';

export function LiveQuestionPanel() {
  const { state, t, say } = useStore();
  const isR1 = state.roundView === 'r1';
  return <fieldset disabled style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{state.lang === 'zh' ? '示例问题，尚未绑定真实项目；问题操作未接入' : 'Sample question; no real project linked. Question actions are not connected.'}</div>
          <div
            style={{
              marginTop: 12,
              padding: "14px 16px",
              border: "1px solid var(--line)",
              borderRadius: 14,
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  flex: 1,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10.5,
                  letterSpacing: ".05em",
                  color: "var(--ink-3)",
                }}
              >
                {t.currentQuestion}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                {t.targetsLabel}
                {isR1
                  ? "Distributed Systems Design, Backend Engineering Depth (Go / Java), Technical Communication"
                  : "Production Ownership & Incident Response, Security & Compliance Awareness, Collaboration & Mentorship"}
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 14.5, fontWeight: 600 }}>
              {isR1
                ? "Walk me through a distributed system you designed end-to-end — what were the hardest trade-offs?"
                : "Tell me about an incident you owned end-to-end. What did you ship, and what changed afterward?"}
            </div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: "var(--ink-2)" }}>
              Assess depth of real design ownership vs. surface familiarity.
            </div>
            <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 9 }}>
              <button
                onClick={() => say("Advanced to the next question in this round’s plan.")}
                style={{
                  height: 30,
                  padding: "0 12px",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 9,
                  background: "var(--surface)",
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {t.nextQuestionBtn}
              </button>
              <button
                onClick={() => say("Question skipped; it stays visible as not asked.")}
                style={{
                  height: 30,
                  padding: "0 12px",
                  border: "1px solid var(--line)",
                  borderRadius: 9,
                  background: "transparent",
                  color: "var(--ink-2)",
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {t.skipBtn}
              </button>
              <button
                onClick={() =>
                  say("Add follow-up is not part of this demo flow.")
                }
                style={{
                  height: 30,
                  padding: "0 12px",
                  border: "1px solid var(--line)",
                  borderRadius: 9,
                  background: "transparent",
                  color: "var(--ink-2)",
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {t.addFollowUp}
              </button>
            </div>
          </div>
  </fieldset>;
}
