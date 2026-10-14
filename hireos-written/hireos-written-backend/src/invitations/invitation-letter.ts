/**
 * The covering letter a candidate gets with a written-test invitation: a greeting, a short
 * introduction and an HR sign-off, so it reads like a note from the hiring team rather than a
 * system notification. The email and the candidate page (/apply/:token) both use it.
 */
export interface InvitationLetterInput {
  candidateName: string;
  jobTitle: string;
  /** Display name of the mailbox the invitation is sent from, e.g. "招聘专员"; null when none is set up. */
  senderName: string | null;
  mode: string;
  durationMin: number | null;
  deadline: Date | null;
}

export interface InvitationLetter {
  /** e.g. "2026-10-15 23:42（北京时间）" -- shown prominently, not only inside a paragraph. */
  deadlineText: string | null;
  /** e.g. "限时 90 分钟，打开题目后开始计时" or "不限作答时长". */
  timingText: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
  signature: string[];
}

/** "YYYY-MM-DD HH:mm" in Beijing time (UTC+8, no DST) -- the letter states the time zone explicitly. */
export function formatDeadline(deadline: Date): string {
  const d = new Date(deadline.getTime() + 8 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function invitationLetter(input: InvitationLetterInput): InvitationLetter {
  const timingText = input.mode === 'timed' && input.durationMin ? `限时 ${input.durationMin} 分钟，打开题目后开始计时` : '不限作答时长';
  const deadlineText = input.deadline ? `${formatDeadline(input.deadline)}（北京时间）` : null;
  const timing = `本次笔试${timingText}`;
  const deadline = deadlineText ? `，请在 ${deadlineText}前提交` : '';
  return {
    deadlineText,
    timingText,
    greeting: `${input.candidateName}，您好：`,
    paragraphs: [
      `感谢您对「${input.jobTitle}」岗位的关注。我们认真阅读了您的简历，诚挚邀请您参加该岗位的笔试，以便更全面地了解您的专业能力。`,
      `${timing}${deadline}。建议您预留一段不受打扰的时间，准备好后再开始作答。`,
      '如有任何疑问，欢迎直接回复邀请邮件与我们联系。期待您的作答！',
    ],
    closing: '祝好！',
    signature: [input.senderName?.trim(), `「${input.jobTitle}」招聘团队`].filter((line): line is string => !!line),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function invitationEmail(input: InvitationLetterInput, link: string): { subject: string; text: string; html: string } {
  const letter = invitationLetter(input);
  const linkLine = '请点击以下链接查看题目并提交作答：';
  const deadlineLine = letter.deadlineText ? `截止时间：${letter.deadlineText}（${letter.timingText}），请务必在截止前提交。` : null;
  const text = [
    letter.greeting,
    '',
    letter.paragraphs[0],
    '',
    ...(deadlineLine ? [deadlineLine, ''] : []),
    letter.paragraphs[1],
    '',
    linkLine,
    link,
    '',
    letter.paragraphs[2],
    '',
    letter.closing,
    ...letter.signature,
  ].join('\n');
  const p = (s: string) => `<p>${escapeHtml(s)}</p>`;
  const deadlineBox = letter.deadlineText
    ? `<div style="margin:16px 0;padding:12px 16px;border-left:4px solid #d97706;background:#fff7ed;border-radius:4px">`
      + `<div style="font-size:13px;color:#92400e">截止时间</div>`
      + `<div style="font-size:18px;font-weight:bold;color:#b45309;margin:2px 0">${escapeHtml(letter.deadlineText)}</div>`
      + `<div style="font-size:13px;color:#92400e">${escapeHtml(letter.timingText)}，请务必在截止前提交。</div></div>`
    : '';
  const html = [
    p(letter.greeting),
    p(letter.paragraphs[0]),
    deadlineBox,
    p(letter.paragraphs[1]),
    `<p>${escapeHtml(linkLine)}<br/><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
    p(letter.paragraphs[2]),
    `<p>${escapeHtml(letter.closing)}<br/>${letter.signature.map(escapeHtml).join('<br/>')}</p>`,
  ].join('');
  const subjectDeadline = input.deadline ? `（请于 ${formatDeadline(input.deadline).slice(5)} 前提交）` : '';
  return { subject: `「${input.jobTitle}」笔试邀请 · ${input.candidateName}${subjectDeadline}`, text, html };
}
