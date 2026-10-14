import { useEffect, useState } from "react";
import type { InvitationLetter } from "../data/writtenApi";

function remainingText(deadline: Date, now: number): string {
  const ms = deadline.getTime() - now;
  if (ms <= 0) return "已超过截止时间";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `距截止还有 ${days} 天 ${hours} 小时`;
  if (hours > 0) return `距截止还有 ${hours} 小时 ${mins} 分钟`;
  return `距截止还有 ${mins} 分钟`;
}

/**
 * The submission deadline, shown above everything else on the candidate page so it can't be
 * missed: the date (Beijing time, as in the email), the time allowed, and a live countdown.
 */
export function DeadlineBanner({ letter, deadline }: { letter: InvitationLetter; deadline: string | null }) {
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
      <div style={{ fontSize: 13 }}>提交截止时间</div>
      <div style={{ fontSize: 20, fontWeight: 700, margin: "2px 0 4px" }}>{letter.deadlineText}</div>
      <div style={{ fontSize: 13 }}>
        {remainingText(due, now)} · {letter.timingText}
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

/** Same as the backend's formatDeadline(): "YYYY-MM-DD HH:mm" in Beijing time (UTC+8, no DST). */
function formatBeijingTime(date: Date): string {
  const d = new Date(date.getTime() + 8 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/**
 * Preview-only copy of hireos-written-backend's invitationLetter() (src/invitations/invitation-letter.ts),
 * so HR sees the letter before sending. The candidate page always renders the backend's version.
 */
export function previewInvitationLetter(input: {
  candidateName: string; jobTitle: string; senderName: string | null; mode: string; durationMin: number | null; /** ISO instant, or "" when not set yet. */
  deadline: string;
}): InvitationLetter {
  const timingText = input.mode === "timed" && input.durationMin ? `限时 ${input.durationMin} 分钟，打开题目后开始计时` : "不限作答时长";
  const deadlineText = input.deadline ? `${formatBeijingTime(new Date(input.deadline))}（北京时间）` : null;
  const timing = `本次笔试${timingText}`;
  const deadline = deadlineText ? `，请在 ${deadlineText}前提交` : "";
  return {
    deadlineText,
    timingText,
    greeting: `${input.candidateName}，您好：`,
    paragraphs: [
      `感谢您对「${input.jobTitle}」岗位的关注。我们认真阅读了您的简历，诚挚邀请您参加该岗位的笔试，以便更全面地了解您的专业能力。`,
      `${timing}${deadline}。建议您预留一段不受打扰的时间，准备好后再开始作答。`,
      "如有任何疑问，欢迎直接回复邀请邮件与我们联系。期待您的作答！",
    ],
    closing: "祝好！",
    signature: [input.senderName?.trim(), `「${input.jobTitle}」招聘团队`].filter((line): line is string => !!line),
  };
}
