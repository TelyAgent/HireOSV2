import { useEffect, useState } from "react";
import type { InvitationLetter } from "../data/writtenApi";
import { invitationLetter, type CandidateLocale } from "../utils/invitationLetter";

function remainingText(deadline: Date, now: number, locale: CandidateLocale): string {
  const ms = deadline.getTime() - now;
  const en = locale === "en";
  if (ms <= 0) return en ? "The deadline has passed" : "已超过截止时间";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return en ? `${days} d ${hours} h left` : `距截止还有 ${days} 天 ${hours} 小时`;
  if (hours > 0) return en ? `${hours} h ${mins} min left` : `距截止还有 ${hours} 小时 ${mins} 分钟`;
  return en ? `${mins} min left` : `距截止还有 ${mins} 分钟`;
}

/**
 * The submission deadline, shown above everything else on the candidate page so it can't be
 * missed: the date (Beijing time, as in the email), the time allowed, and a live countdown.
 */
export function DeadlineBanner({ letter, deadline, locale = "zh" }: { letter: InvitationLetter; deadline: string | null; /** The candidate's language (#229). */ locale?: CandidateLocale }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!letter.deadlineText || !deadline) return null;
  const due = new Date(deadline);
  const left = due.getTime() - now;
  const tone = left < 24 * 3600_000 ? "danger" : "warning";
  return (
    <div className={`banner ${tone}`} style={{ marginBottom: 16, display: "block", padding: "14px 18px" }}>
      <div style={{ fontSize: 13 }}>{locale === "en" ? "Submission deadline" : "提交截止时间"}</div>
      <div style={{ fontSize: 20, fontWeight: 700, margin: "2px 0 4px" }}>{letter.deadlineText}</div>
      <div style={{ fontSize: 13 }}>
        {remainingText(due, now, locale)} · {letter.timingText}
      </div>
    </div>
  );
}

/** The HR covering letter at the top of the candidate page (and its preview in the send drawer). */
export function InvitationLetterCard({ letter }: { letter: InvitationLetter }) {
  return (
    <div className="card card-pad" style={{ marginBottom: 16, lineHeight: 1.7 }}>
      <p style={{ margin: "0 0 8px" }}>{letter.greeting}</p>
      {letter.paragraphs.map((p) => (
        <p key={p} style={{ margin: "0 0 8px", textIndent: "2em" }}>{p}</p>
      ))}
      <p style={{ margin: "12px 0 0" }}>{letter.closing}</p>
      {letter.signature.map((line) => (
        <div key={line} style={{ color: "var(--text-secondary)" }}>{line}</div>
      ))}
    </div>
  );
}

/**
 * The letter for the send drawer's preview, from the same rules the backend writes the email and the candidate
 * page with (utils/invitationLetter, checked against the backend by its test) — in the candidate's language (#229).
 */
export function previewInvitationLetter(input: {
  locale?: CandidateLocale; candidateName: string; jobTitle: string; senderName: string | null; mode: string; durationMin: number | null; /** ISO instant, or "" when not set yet. */
  deadline: string;
}): InvitationLetter {
  return invitationLetter({ ...input, deadline: input.deadline ? new Date(input.deadline) : null });
}
