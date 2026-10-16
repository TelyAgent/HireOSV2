// Invitation letter: the email and the candidate page greet the candidate and close with an HR sign-off.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { invitationLetter, invitationEmail } = require('../dist/invitations/invitation-letter');

const base = { candidateName: '陈昊天', jobTitle: '全栈工程师', senderName: '招聘专员', mode: 'timed', durationMin: 90, deadline: new Date('2026-10-15T03:31:00Z') };

test('greets the candidate by name and signs off as the sending HR mailbox', () => {
  const letter = invitationLetter(base);
  assert.equal(letter.greeting, '陈昊天，您好：');
  assert.match(letter.paragraphs[0], /全栈工程师/);
  assert.match(letter.paragraphs[1], /限时 90 分钟/);
  assert.match(letter.paragraphs[1], /2026-10-15 11:31（北京时间）前提交/);
  assert.deepEqual(letter.signature, ['招聘专员', '「全栈工程师」招聘团队']);
});

test('falls back to the hiring team when no mailbox is configured', () => {
  const letter = invitationLetter({ ...base, senderName: null, mode: 'deadline_only', durationMin: null });
  assert.deepEqual(letter.signature, ['「全栈工程师」招聘团队']);
  assert.equal(letter.deadlineText, '2026-10-15 11:31（北京时间）');
  assert.equal(letter.timingText, '不限作答时长');
  assert.match(letter.paragraphs[1], /不限作答时长/);
});

test('email carries the letter and the link, without the "system generated" footer', () => {
  const email = invitationEmail({ ...base, candidateName: '<b>x</b>' }, 'https://example.com/apply/t');
  assert.match(email.text, /您好：/);
  assert.match(email.text, /https:\/\/example.com\/apply\/t/);
  assert.match(email.text, /招聘专员\n「全栈工程师」招聘团队$/);
  assert.doesNotMatch(email.text, /系统自动发送/);
  assert.match(email.text, /截止时间：2026-10-15 11:31（北京时间）/);
  assert.match(email.text, /逾期将无法提交/);
  assert.match(email.html, /截止时间<\/div>.*2026-10-15 11:31（北京时间）/);
  assert.match(email.subject, /请于 10-15 11:31 前提交/);
  assert.match(email.html, /&lt;b&gt;x&lt;\/b&gt;，您好/);
});

// #229 -- the candidate's language: English invitations are English throughout, Chinese ones stay as they were,
// and the send drawer's preview is the same letter the backend writes.
const front = require('../../hireos-written-front/src/utils/invitationLetter.ts');
const base229 = { candidateName: 'Alex Kim', jobTitle: 'Data Engineer', senderName: 'Recruiting', mode: 'timed', durationMin: 90, deadline: new Date('2026-10-20T10:00:00Z') };

test('#229 AC-1: an English invitation — subject, letter, deadline and timing all in English, the zone named', () => {
  const letter = invitationLetter({ ...base229, locale: 'en' });
  assert.equal(letter.greeting, 'Dear Alex Kim,');
  assert.equal(letter.deadlineText, '2026-10-20 18:00 (Beijing time, UTC+8)');
  assert.equal(letter.timingText, '90-minute time limit, starting when you open the questions');
  assert.match(letter.paragraphs[1], /^This test has a 90-minute time limit, which starts when you open the questions; please submit by 2026-10-20 18:00 \(Beijing time, UTC\+8\)\./);
  assert.equal(letter.closing, 'Best regards,');
  assert.deepEqual(letter.signature, ['Recruiting', 'Data Engineer hiring team']);
  const mail = invitationEmail({ ...base229, locale: 'en' }, 'https://example.test/apply/t');
  assert.equal(mail.subject, 'Written test invitation: Data Engineer · Alex Kim (please submit by 10-20 18:00, Beijing time)');
  assert.match(mail.text, /Open the link below to see the questions and submit your answers:\nhttps:\/\/example\.test\/apply\/t/);
  assert.match(mail.text, /Deadline: 2026-10-20 18:00 \(Beijing time, UTC\+8\) \(90-minute time limit/);
  assert.match(mail.html, />Deadline</);
  for (const part of [mail.subject, mail.text, mail.html, ...Object.values(letter).flat()]) assert.doesNotMatch(String(part), /[一-鿿]/, String(part).slice(0, 60));
  // Untimed.
  assert.equal(invitationLetter({ ...base229, locale: 'en', mode: 'deadline_only', durationMin: null }).timingText, 'No time limit for answering');
});

test('#229 AC-1/AC-2: the Chinese branch is unchanged, and an invitation without a language is Chinese', () => {
  const zh = invitationLetter({ ...base229, locale: 'zh' });
  assert.deepEqual(invitationLetter(base229), zh);
  assert.equal(zh.greeting, 'Alex Kim，您好：');
  assert.equal(invitationEmail(base229, 'https://example.test/apply/t').subject, '「Data Engineer」笔试邀请 · Alex Kim（请于 10-20 18:00 前提交）');
});

test('#229 AC-1/AC-3: the send drawer previews exactly the letter the backend writes, in both languages', () => {
  for (const locale of ['zh', 'en']) {
    for (const input of [base229, { ...base229, mode: 'deadline_only', durationMin: null }, { ...base229, senderName: null, deadline: null }]) {
      assert.deepEqual(front.invitationLetter({ ...input, locale }), invitationLetter({ ...input, locale }), `${locale} ${input.mode}`);
    }
  }
});

test('#229 AC-2: the language is stored with the invitation when it is sent; left out, it is Chinese', async () => {
  const { InvitationsService } = require('../dist/invitations/invitations.service');
  const created = [];
  const sent = [];
  const tx = {
    $queryRaw: async () => [{ status: 'linked' }],
    invitation: { findMany: async () => [], create: async ({ data }) => { created.push(data); return { id: 'i-1', round: 1, token: 't', ...data }; } },
    planItem: { findMany: async () => [{ id: 'p-1' }], updateMany: async () => ({}) },
    case: { update: async () => ({}), updateMany: async () => ({ count: 1 }) },
  };
  const db = { case: { findFirst: async () => ({ id: 'c-1', status: 'linked', draftRoundOpen: false, candidate: { name: 'Alex Kim' }, job: { title: 'Data Engineer' } }) }, $transaction: async (fn) => fn(tx) };
  const mail = { senderAccount: async () => null, sendFromWorkspaceAccount: async (_i, m) => { sent.push(m); return { sent: true }; } };
  const lifecycle = { lockCase: async () => ({ status: 'linked' }), advance: async () => true };
  const svc = new InvitationsService(db, mail, { get: (_k, d) => d }, {}, lifecycle);
  const dto = { questions: [{ questionId: 'q1', code: 'Q', title: 'T', prompt: 'P' }], mode: 'deadline_only', deadline: '2026-10-20T10:00:00Z', disclosurePolicy: 'summary_only', recipientEmail: 'a@b.c' };
  await svc.create({ workspaceId: 'ws', actorId: 'hr', roles: [] }, 'c-1', { ...dto, locale: 'en' });
  await svc.create({ workspaceId: 'ws', actorId: 'hr', roles: [] }, 'c-1', dto);
  assert.deepEqual(created.map((c) => c.locale), ['en', 'zh']);
  assert.match(sent[0].subject, /^Written test invitation/);
  assert.match(sent[1].subject, /笔试邀请/);
});
