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
  assert.match(email.html, /截止时间<\/div>.*2026-10-15 11:31（北京时间）/);
  assert.match(email.subject, /请于 10-15 11:31 前提交/);
  assert.match(email.html, /&lt;b&gt;x&lt;\/b&gt;，您好/);
});
