/**
 * The covering letter a candidate gets with a written-test invitation: a greeting, a short
 * introduction and an HR sign-off, so it reads like a note from the hiring team rather than a
 * system notification. The email and the candidate page (/apply/:token) both use it.
 */
/** The language the candidate is written to (#229) — chosen when sending, separate from the questions' language. */
export type CandidateLocale = 'zh' | 'en';

export interface InvitationLetterInput {
  /** Defaults to Chinese: invitations sent before the choice existed were all written in Chinese. */
  locale?: CandidateLocale;
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
  if (input.locale === 'en') return englishLetter(input);
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

/** The same letter in English (#229). The deadline still names its zone: Beijing time, UTC+8. */
function englishLetter(input: InvitationLetterInput): InvitationLetter {
  const timed = input.mode === 'timed' && input.durationMin;
  const timingText = timed ? `${input.durationMin}-minute time limit, starting when you open the questions` : 'No time limit for answering';
  const deadlineText = input.deadline ? `${formatDeadline(input.deadline)} (Beijing time, UTC+8)` : null;
  const timing = timed ? `This test has a ${input.durationMin}-minute time limit, which starts when you open the questions` : 'This test has no time limit for answering';
  const deadline = deadlineText ? `; please submit by ${deadlineText}` : '';
  return {
    deadlineText,
    timingText,
    greeting: `Dear ${input.candidateName},`,
    paragraphs: [
      `Thank you for your interest in the ${input.jobTitle} role. We have read your résumé carefully and would like to invite you to a written test for this role, so we can get to know your skills better.`,
      `${timing}${deadline}. We suggest setting aside some uninterrupted time and starting when you are ready.`,
      'If you have any questions, just reply to the invitation email. We look forward to your answers!',
    ],
    closing: 'Best regards,',
    signature: [input.senderName?.trim(), `${input.jobTitle} hiring team`].filter((line): line is string => !!line),
  };
}

/** The email's own wording around the letter, per language. */
const EMAIL_COPY = {
  zh: {
    link: '请点击以下链接查看题目并提交作答：',
    deadlineLine: (deadline: string, timing: string) => `截止时间：${deadline}（${timing}），逾期将无法提交。`,
    deadlineLabel: '截止时间',
    deadlineNote: (timing: string) => `${timing}，逾期将无法提交。`,
    subject: (job: string, name: string, due: string | null) => `「${job}」笔试邀请 · ${name}${due ? `（请于 ${due} 前提交）` : ''}`,
  },
  en: {
    link: 'Open the link below to see the questions and submit your answers:',
    deadlineLine: (deadline: string, timing: string) => `Deadline: ${deadline} (${timing}). Answers can't be submitted after it.`,
    deadlineLabel: 'Deadline',
    deadlineNote: (timing: string) => `${timing}. Answers can't be submitted after the deadline.`,
    subject: (job: string, name: string, due: string | null) => `Written test invitation: ${job} · ${name}${due ? ` (please submit by ${due}, Beijing time)` : ''}`,
  },
} as const;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function invitationEmail(input: InvitationLetterInput, link: string): { subject: string; text: string; html: string } {
  const letter = invitationLetter(input);
  const copy = EMAIL_COPY[input.locale === 'en' ? 'en' : 'zh'];
  const linkLine = copy.link;
  const deadlineLine = letter.deadlineText ? copy.deadlineLine(letter.deadlineText, letter.timingText) : null;
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
      + `<div style="font-size:13px;color:#92400e">${escapeHtml(copy.deadlineLabel)}</div>`
      + `<div style="font-size:18px;font-weight:bold;color:#b45309;margin:2px 0">${escapeHtml(letter.deadlineText)}</div>`
      + `<div style="font-size:13px;color:#92400e">${escapeHtml(copy.deadlineNote(letter.timingText))}</div></div>`
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
  return { subject: copy.subject(input.jobTitle, input.candidateName, input.deadline ? formatDeadline(input.deadline).slice(5) : null), text, html };
}
