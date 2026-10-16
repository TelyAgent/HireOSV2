// #230 -- a round's interview language (not anyone's interface language) decides what its live transcript is
// requested in; an unsupported value is refused before any transcript connection.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transcriptParamsFor, INTERVIEW_LANGUAGES } = require('../dist/meetings/transcript-language');
const { scheduleRoundSchema } = require('../dist/intake/contracts');

test('#230 AC-1: Chinese, English and mixed map to the RTMS transcript settings; the default stays Chinese', () => {
  assert.deepEqual(transcriptParamsFor('zh'), { srcLanguage: 4, enableLid: false }); // TranscriptLanguage.CHINESE_SIMPLIFIED
  assert.deepEqual(transcriptParamsFor('en'), { srcLanguage: 9, enableLid: false }); // TranscriptLanguage.ENGLISH
  assert.deepEqual(transcriptParamsFor('auto'), { srcLanguage: -1, enableLid: true }); // language identification
  assert.deepEqual(transcriptParamsFor(null), transcriptParamsFor('zh'), 'rounds from before the setting keep Chinese');
  assert.deepEqual([...INTERVIEW_LANGUAGES], ['zh', 'en', 'auto']);
});

test('#230 AC-1/AC-3: an unsupported language gives no transcript settings, so no stream is opened; scheduling refuses it', () => {
  assert.equal(transcriptParamsFor('fr'), null);
  const base = { version: 1, scheduledAt: '2026-10-20T02:00:00.000Z', timezone: 'Asia/Shanghai', meetingLink: '' };
  assert.equal(scheduleRoundSchema.safeParse({ ...base, interviewLanguage: 'en' }).success, true);
  assert.equal(scheduleRoundSchema.safeParse(base).success, true, 'left out: the round keeps its language');
  assert.equal(scheduleRoundSchema.safeParse({ ...base, interviewLanguage: 'fr' }).success, false);
});

test('#230 AC-1: the constants match the installed @zoom/rtms', () => {
  let rtms;
  try { rtms = require('@zoom/rtms'); } catch { return; } // native addon unavailable on this platform
  const L = (rtms.default || rtms).TranscriptLanguage;
  assert.equal(transcriptParamsFor('zh').srcLanguage, L.CHINESE_SIMPLIFIED);
  assert.equal(transcriptParamsFor('en').srcLanguage, L.ENGLISH);
  assert.equal(transcriptParamsFor('auto').srcLanguage, L.NONE);
});
