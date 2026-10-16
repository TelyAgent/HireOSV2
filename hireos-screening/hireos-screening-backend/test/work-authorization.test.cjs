// #157 -- work authorization is not missing information, and it is not a matching or scoring factor: the same
// candidate gets the same match and score whether or not the profile states it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ScreeningService, scoredHardRequirements, withoutWorkAuthorization } = require('../dist/screening/screening.service');
const { profileCorpus } = require('../dist/discovery/discovery.service');
const { ProfileParserService } = require('../dist/profiles/profile-parser.service');

const base = {
  version: 1,
  location: { value: 'Hanoi, Vietnam', status: 'known' },
  skills: [{ name: 'SQL' }, { name: 'Python' }],
  employmentHistory: [{ company: 'Example Co', title: 'Data analyst', achievements: ['Built weekly dashboards'] }],
};
const stated = { ...base, workAuthorization: { value: 'Authorized to work in Vietnam; no sponsorship needed', status: 'known' } };
const notStated = { ...base, workAuthorization: { value: '', status: 'unknown' } };
const resume = 'Mai Tran\nData analyst at Example Co. SQL, Python, dashboards for regional sales teams.';

test('#157 AC-1: a résumé that says nothing about work authorization does not list it as missing', () => {
  const parsed = new ProfileParserService().parse('m-1', [{ id: 's1', text: `${resume}\nWork authorization: Not stated` }], 'Mai Tran');
  assert.ok(!parsed.missingFields.includes('work_authorization'));
  const withoutLine = new ProfileParserService().parse('m-1', [{ id: 's1', text: resume }], 'Mai Tran');
  assert.ok(!withoutLine.missingFields.includes('work_authorization'));
  assert.ok(withoutLine.missingFields.includes('education'), 'genuinely missing fields are still listed');
});

test('#157 AC-3: scoring gives the same result whether or not work authorization is stated', () => {
  const dimensions = [
    { id: 'd1', name: 'Location and compensation fit', weight: 0.4 },
    { id: 'd2', name: 'Technical skills', weight: 0.6 },
  ];
  const requirements = [
    { id: 'r1', label: 'Authorized to work in Vietnam', kind: 'authorization', hard: true },
    { id: 'r2', label: '2+ years of analysis', kind: 'experience', hard: true },
  ];
  const hard = scoredHardRequirements(requirements);
  assert.deepEqual(hard.map((r) => r.id), ['r2'], 'an authorization requirement is not evaluated');
  const service = new ScreeningService({}, {}, {}, {}, { isConfigured: () => false });
  const run = (profile) => {
    const p = withoutWorkAuthorization(profile);
    return service['evaluateLocally'](dimensions, hard, p, `${resume} ${JSON.stringify(p)}`.toLowerCase());
  };
  assert.deepEqual(run(stated), run(notStated));
});

test('#157 AC-3: matching reads the same profile text whether or not work authorization is stated', () => {
  assert.equal(profileCorpus(stated), profileCorpus(notStated));
  assert.doesNotMatch(profileCorpus(stated), /authorized|sponsorship/);
});
