// #155 -- every F02 field comes back with its value, a known / missing / partial status and where it sits in the
// résumé (version, page, paragraph). A field the résumé doesn't give is "missing", never filled in; without
// readable source text the location is reported unavailable rather than linked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { profileFields, PROFILE_FIELDS } = require('../dist/profiles/profile-fields');
const { ProfileParserService } = require('../dist/profiles/profile-parser.service');
const { ProfilesService } = require('../dist/profiles/profiles.service');
const { CandidatesService } = require('../dist/library/candidates.service');
const { splitText } = require('../dist/intake/materials.service');

const read = (name) => fs.readFileSync(path.join(__dirname, 'fixtures/f02', name), 'utf8');
const segmentsOf = (text, page) => splitText(text, page).map((s, i) => ({ ...s, id: `s${i + 1}` }));
const source = (segments, readable = true) => ({ resumeVersionId: 'rv-2', resumeVersion: 2, materialId: 'm-1', readable, segments });
const byField = (fields) => Object.fromEntries(fields.map((f) => [f.field, f]));

// What the AI parser stores for the complete résumé (the model call itself is replaced).
const aiAnswer = {
  displayName: 'Linh Pham', email: 'Linh.Pham@Example.test', phone: '+84 90 123 4567',
  location: { value: 'Ho Chi Minh City, Vietnam', status: 'known', country: 'Vietnam', city: 'Ho Chi Minh City' }, workAuthorization: { value: '', status: 'unknown' },
  availability: { value: '1 month', status: 'known' },
  skills: ['SQL', 'Python', 'Tableau'], languages: ['English (IELTS 7.5)', 'Vietnamese (native)'],
  employmentHistory: [
    { company: 'Example Retail', title: 'Senior Data Analyst', start: '2021-03', end: 'present', achievements: ['Built pricing dashboards in SQL and Python.'] },
    { company: 'Sample Bank', title: 'Data Analyst', start: '2018-07', end: '2021-06', achievements: [] },
  ],
  education: [{ statement: 'B.Sc. Statistics, Vietnam National University', school: 'Vietnam National University', degree: 'B.Sc.', major: 'Statistics', period: '2014 – 2018' }],
  certifications: ['AWS Certified Cloud Practitioner', 'Google Data Analytics Certificate'],
  projects: [{ name: 'Pricing dashboard', description: 'weekly price-elasticity dashboard for 120 stores.' }],
  compensationExpectation: { min: 60000, max: 70000, currency: 'USD', period: 'year', basis: 'gross' },
};

async function aiProfile(text) {
  const service = new ProfilesService({}, {}, { isConfigured: () => true, parse: async () => aiAnswer }, {});
  return service.parseWithAi({ id: 'm-1', text }, 'fallback');
}

test('#155 AC-1: a complete résumé gives every field as known, with its value', async () => {
  const parsed = await aiProfile(read('complete.txt'));
  const fields = byField(profileFields(parsed, { displayName: 'Linh Pham', email: parsed.email, phone: parsed.phone }, source(segmentsOf(read('complete.txt')))));
  assert.deepEqual(Object.keys(fields), [...PROFILE_FIELDS]);
  for (const field of PROFILE_FIELDS) assert.equal(fields[field].status, 'known', field);
  assert.deepEqual(fields.languages.values, ['English (IELTS 7.5)', 'Vietnamese (native)']);
  assert.deepEqual(fields.certifications.values, ['AWS Certified Cloud Practitioner', 'Google Data Analytics Certificate']);
  assert.equal(fields.availability.values[0], '1 month (30 days)', 'availability is turned into days when it can be');
  assert.equal(parsed.availability.days, 30);
  assert.equal(parsed.email, 'linh.pham@example.test', 'email lower-cased');
  assert.equal(parsed.phone, '+84901234567', 'phone in E.164');
  assert.deepEqual(fields.education.values, ['Vietnam National University · B.Sc. · Statistics (2014 – 2018)'], 'school / degree / major / dates');
  assert.equal(fields.compensation_expectation.values[0], '60,000–70,000 USD / year, gross');
  assert.match(fields.projects.values[0], /^Pricing dashboard: /);
});

test('#155 AC-1: a sparse résumé shows the rest as missing, with nothing made up', () => {
  const text = read('sparse.txt');
  const parsed = new ProfileParserService().parse('m-1', segmentsOf(text), 'fallback');
  const fields = byField(profileFields(parsed, { displayName: 'Minh Nguyen', email: parsed.email, phone: null }, source(segmentsOf(text))));
  assert.equal(fields.name.status, 'known');
  assert.deepEqual(fields.name.values, ['Minh Nguyen']);
  for (const field of PROFILE_FIELDS.filter((f) => f !== 'name')) {
    assert.equal(fields[field].status, 'missing', field);
    assert.deepEqual(fields[field].values, [], field);
    assert.equal(fields[field].evidenceUnavailable, null, `${field}: nothing to locate`);
  }
});

test('#155 AC-1: §4.1 formats — location needs country and city, education its four parts, dates YYYY-MM; a name not in the text is to be confirmed', () => {
  const text = 'Profile summary\n\nWorked at Example Retail since spring 2019.';
  const fields = byField(profileFields(
    {
      displayName: 'resume-2026', location: { value: 'Hanoi', status: 'known', country: '', city: 'Hanoi' },
      employmentHistory: [{ company: 'Example Retail', title: 'Analyst', start: 'spring 2019', end: 'present' }],
      education: [{ statement: 'Hanoi University', school: 'Hanoi University', degree: '', major: '', period: '2010 – 2014' }],
    },
    { displayName: 'resume-2026', email: null, phone: null }, source(segmentsOf(text)),
  ));
  assert.deepEqual([fields.location.status, fields.location.incomplete], ['partial', ['country']]);
  assert.deepEqual([fields.education.status, fields.education.incomplete], ['partial', ['degree', 'major']]);
  assert.deepEqual([fields.employment_history.status, fields.employment_history.incomplete], ['partial', ['dates']], 'an unreadable date is kept as written and flagged');
  assert.match(fields.employment_history.values[0], /spring 2019/);
  assert.deepEqual([fields.name.status, fields.name.incomplete], ['partial', ['to_confirm']], 'a file-name fallback is to be confirmed');
});

test('#155 AC-1: a field read only in part is "partial", saying what is missing', () => {
  const fields = byField(profileFields(
    { displayName: 'A', employmentHistory: [{ company: 'Example Retail', title: 'Analyst', start: '', end: '' }], projects: [{ name: 'Pricing dashboard', description: '' }] },
    { displayName: 'A', email: null, phone: null }, null,
  ));
  assert.equal(fields.employment_history.status, 'partial');
  assert.deepEqual(fields.employment_history.incomplete, ['dates']);
  assert.equal(fields.projects.status, 'partial');
  assert.deepEqual(fields.projects.incomplete, ['description']);
});

test('#155: the local parser reads availability and certifications too', () => {
  const text = read('complete.txt');
  const parsed = new ProfileParserService().parse('m-1', segmentsOf(text), 'fallback');
  assert.equal(parsed.availability.value, '1 month');
  assert.equal(parsed.availability.days, 30);
  assert.equal(parsed.phone, '+84901234567');
  assert.equal(parsed.email, 'linh.pham@example.test');
  assert.deepEqual(parsed.certifications, ['AWS Certified Cloud Practitioner', 'Google Data Analytics Certificate']);
});

test('#155 AC-2: each value points at its résumé version, page and paragraph', async () => {
  // Two pages: contact details on page 1, the rest on page 2.
  const [first, ...rest] = read('complete.txt').split('\nExperience\n');
  const segments = [...splitText(first, 1), ...splitText(`Experience\n${rest.join('')}`, 2)].map((s, i) => ({ ...s, id: `s${i + 1}` }));
  const parsed = await aiProfile(read('complete.txt'));
  const fields = byField(profileFields(parsed, { displayName: 'Linh Pham', email: parsed.email, phone: parsed.phone }, source(segments)));
  const at = (field) => fields[field].evidence.map((e) => `p${e.page}¶${e.paragraph}`);
  assert.deepEqual(at('email'), ['p1¶1']);
  assert.deepEqual(at('phone'), ['p1¶1'], 'an E.164 phone is found by its digits');
  assert.deepEqual(at('employment_history'), ['p2¶1']);
  assert.deepEqual(at('education'), ['p2¶2']);
  assert.deepEqual(at('languages'), ['p2¶4']);
  assert.deepEqual(at('certifications'), ['p2¶5']);
  assert.deepEqual(at('projects'), ['p2¶6']);
  assert.deepEqual(at('compensation_expectation'), ['p2¶7']);
  assert.deepEqual(at('availability'), ['p2¶7']);
  const evidence = fields.certifications.evidence[0];
  assert.equal(evidence.resumeVersionId, 'rv-2');
  assert.equal(evidence.resumeVersion, 2);
  assert.equal(evidence.materialId, 'm-1');
  assert.ok(segments.some((s) => s.id === evidence.segmentId && s.text.includes('AWS Certified')));
  assert.match(evidence.quote, /AWS Certified/);
});

test('#155 AC-2: without readable source text the location is reported unavailable, never linked', async () => {
  const parsed = await aiProfile(read('complete.txt'));
  const fields = profileFields(parsed, { displayName: 'Linh Pham', email: parsed.email, phone: null }, source([], false));
  for (const field of fields.filter((f) => f.values.length)) {
    assert.deepEqual(field.evidence, [], field.field);
    assert.equal(field.evidenceUnavailable, 'source_unavailable', field.field);
  }
  const noVersion = profileFields(parsed, { displayName: 'Linh Pham', email: null, phone: null }, null);
  assert.equal(noVersion.find((f) => f.field === 'skills').evidenceUnavailable, 'source_unavailable');
  // A value the text doesn't contain (here a corrected location) has no location rather than a wrong one.
  const corrected = profileFields({ ...parsed, location: { value: 'Da Nang', status: 'known' }, corrections: [{ fieldPath: 'location' }] },
    { displayName: 'Linh Pham', email: null, phone: null }, source(segmentsOf(read('complete.txt'))));
  const location = corrected.find((f) => f.field === 'location');
  assert.equal(location.source, 'correction');
  assert.equal(location.evidenceUnavailable, 'not_located');
});

test('#155 AC-3: the candidate API returns the same fields, statuses and locations on every read', async () => {
  const text = read('complete.txt');
  const parsed = await aiProfile(text);
  const candidate = {
    id: 'c-1', displayName: 'Linh Pham', identityStatus: 'provisional', email: parsed.email, phone: parsed.phone, ownerId: 'hr-1',
    createdAt: new Date('2026-10-16'), lastMatchedAt: null, retention: 'standard',
    profiles: [{ ...parsed, version: 1, resumeVersionId: 'rv-2', parseStatus: 'succeeded', dataStatus: 'complete', corrections: [] }],
    resumeVersions: [{ id: 'rv-2', version: 2, materialId: 'm-1', uploadedAt: new Date(), source: 'paste', parseStatus: 'succeeded', isLatest: true,
      material: { id: 'm-1', name: 'Linh.txt', readStatus: 'available', errorCode: null, createdAt: new Date(), segments: segmentsOf(text) } }],
    recommendations: [], applications: [], sources: [],
  };
  const db = {
    candidate: { findFirst: async () => candidate },
    candidateJobRecommendation: { findFirst: async () => null },
    screeningEvaluation: { findFirst: async () => null },
  };
  const service = new CandidatesService(db, {}, { getMatchingStatuses: async () => new Map() });
  const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
  const first = (await service.get(identity, 'c-1')).candidate.profileFields;
  const second = (await service.get(identity, 'c-1')).candidate.profileFields;
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((f) => f.field), [...PROFILE_FIELDS]);
  assert.equal(first.find((f) => f.field === 'availability').evidence[0].resumeVersionId, 'rv-2');
});
