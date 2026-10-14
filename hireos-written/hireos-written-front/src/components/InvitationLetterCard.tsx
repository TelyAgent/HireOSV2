import type { InvitationLetter } from "../data/writtenApi";

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
 * Preview-only copy of hireos-written-backend's invitationLetter() (src/invitations/invitation-letter.ts),
 * so HR sees the letter before sending. The candidate page always renders the backend's version.
 */
export function previewInvitationLetter(input: {
  candidateName: string; jobTitle: string; senderName: string | null; mode: string; durationMin: number | null; deadline: string;
}): InvitationLetter {
  const timing = input.mode === "timed" && input.durationMin
    ? `本次笔试限时 ${input.durationMin} 分钟，打开题目后开始计时`
    : "本次笔试不限作答时长";
  const deadline = input.deadline ? `，请在 ${input.deadline.replace("T", " ")} 前提交` : "";
  return {
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
