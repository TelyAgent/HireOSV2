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

/** The candidate API for one stored profile and its résumé version — what the detail page receives. */
async function apiFields(parsed, text, contact) {
  const candidate = {
    id: 'c-1', displayName: parsed.displayName, identityStatus: 'provisional', email: contact.email, phone: contact.phone, ownerId: 'hr-1',
    createdAt: new Date('2026-10-16'), lastMatchedAt: null, retention: 'standard',
    profiles: [{ ...parsed, version: 1, resumeVersionId: 'rv-2', parseStatus: 'succeeded', dataStatus: 'complete', corrections: [] }],
    resumeVersions: [{ id: 'rv-2', version: 2, materialId: 'm-1', uploadedAt: new Date(), source: 'paste', parseStatus: 'succeeded', isLatest: true,
      material: { id: 'm-1', name: 'resume.txt', readStatus: 'available', errorCode: null, createdAt: new Date(), segments: segmentsOf(text) } }],
    recommendations: [], applications: [], sources: [],
  };
  const db = { candidate: { findFirst: async () => candidate }, candidateJobRecommendation: { findFirst: async () => null }, screeningEvaluation: { findFirst: async () => null } };
  const service = new CandidatesService(db, {}, { getMatchingStatuses: async () => new Map() });
  const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
  return [(await service.get(identity, 'c-1')).candidate.profileFields, (await service.get(identity, 'c-1')).candidate.profileFields];
}

test('#155 AC-3: through the candidate API, the complete and the sparse résumé give stable fields, statuses and locations', async () => {
  const fullText = read('complete.txt');
  const full = await aiProfile(fullText);
  const [a, b] = await apiFields(full, fullText, { email: full.email, phone: full.phone });
  assert.deepEqual(a, b, 'the same on every read (a refresh)');
  assert.ok(a.every((f) => f.status === 'known' && f.evidence.length > 0), 'complete: every field known and located');
  const sparseText = read('sparse.txt');
  const sparse = new ProfileParserService().parse('m-1', segmentsOf(sparseText), 'fallback');
  const [c, d] = await apiFields(sparse, sparseText, { email: null, phone: null });
  assert.deepEqual(c, d);
  assert.deepEqual(c.filter((f) => f.status !== 'missing').map((f) => f.field), ['name']);
  assert.ok(c.filter((f) => f.status === 'missing').every((f) => f.values.length === 0 && f.evidence.length === 0 && f.evidenceUnavailable === null));
});

test('#155 AC-2: each value of a list field is located on its own — one found value does not hide another', () => {
  const text = 'Skills: SQL, Python';
  const fields = byField(profileFields({ displayName: 'A', skills: ['SQL', 'Python', 'Tableau'] }, { displayName: 'A', email: null, phone: null }, source(segmentsOf(text))));
  assert.equal(fields.skills.evidence.length, 1, 'SQL and Python share a paragraph');
  assert.deepEqual(fields.skills.unlocatedValues, ['Tableau']);
  assert.equal(fields.skills.evidenceUnavailable, null);
});

test('#155 AC-2 (review): two jobs with the same title at different companies each point at their own paragraph', () => {
  const segments = [
    { id: 'p1', text: 'Senior Software Engineer at Acme, 2019-01 to 2021-06', page: 1 },
    { id: 'p2', text: 'Senior Software Engineer at Beta, 2021-07 to present', page: 2 },
  ];
  const jobs = [
    { company: 'Acme', title: 'Senior Software Engineer', start: '2019-01', end: '2021-06' },
    { company: 'Beta', title: 'Senior Software Engineer', start: '2021-07', end: 'present' },
  ];
  const f = byField(profileFields({ displayName: 'A', employmentHistory: jobs }, { displayName: 'A', email: null, phone: null }, source(segments))).employment_history;
  assert.deepEqual(f.evidence.map((e) => [e.segmentId, e.page]), [['p1', 1], ['p2', 2]]);
  assert.deepEqual(f.unlocatedValues, []);
  // A job whose company and title never appear together isn't pinned on some other line: it's named as not found.
  const g = byField(profileFields({ displayName: 'A', employmentHistory: [...jobs, { company: 'Gamma', title: 'Senior Software Engineer', start: '2018-01', end: '2018-12' }] },
    { displayName: 'A', email: null, phone: null }, source(segments))).employment_history;
  assert.deepEqual(g.unlocatedValues, ['Senior Software Engineer · Gamma (2018-01 – 2018-12)']);
  // Without a company the title is what there is to go on.
  const h = byField(profileFields({ displayName: 'A', employmentHistory: [{ company: '', title: 'Senior Software Engineer', start: '2019-01', end: '2021-06' }] },
    { displayName: 'A', email: null, phone: null }, source(segments))).employment_history;
  assert.equal(h.evidence[0].segmentId, 'p1');
});

test('#155 AC-2 (review): two stints of the same role at the same company are told apart by their start month', () => {
  const segments = [
    { id: 's1', text: 'Engineer, Acme — Jan 2015 to Jan 2017', page: 1 },
    { id: 's2', text: 'Engineer, Acme — 2021/01 to 2024/01', page: 2 },
  ];
  const stints = [
    { company: 'Acme', title: 'Engineer', start: '2015-01', end: '2017-01' },
    { company: 'Acme', title: 'Engineer', start: '2021-01', end: '2024-01' },
  ];
  const f = byField(profileFields({ displayName: 'A', employmentHistory: stints }, { displayName: 'A', email: null, phone: null }, source(segments))).employment_history;
  assert.deepEqual(f.evidence.map((e) => e.segmentId), ['s1', 's2']);
  assert.deepEqual(f.unlocatedValues, []);
  // When the months can't be found, the same company and title can't say which paragraph is which: not pinned.
  const undated = [{ id: 'u1', text: 'Engineer, Acme', page: 1 }, { id: 'u2', text: 'Engineer, Acme (again)', page: 2 }];
  const g = byField(profileFields({ displayName: 'A', employmentHistory: stints }, { displayName: 'A', email: null, phone: null }, source(undated))).employment_history;
  assert.deepEqual(g.evidence, []);
  assert.equal(g.evidenceUnavailable, 'not_located');
});

test('#155 AC-2 (review): two degrees from the same school point at their own paragraphs by year', () => {
  const segments = [{ id: 'e1', text: 'Fudan University — B.Sc. Computer Science, 2010 – 2014' }, { id: 'e2', text: 'Fudan University — M.Sc. Statistics, 2016 – 2018' }];
  const degrees = [
    { school: 'Fudan University', degree: 'B.Sc.', major: 'Computer Science', period: '2010 – 2014' },
    { school: 'Fudan University', degree: 'M.Sc.', major: 'Statistics', period: '2016 – 2018' },
  ];
  const f = byField(profileFields({ displayName: 'A', education: degrees }, { displayName: 'A', email: null, phone: null }, source(segments))).education;
  assert.deepEqual(f.evidence.map((e) => e.segmentId), ['e1', 'e2']);
  assert.deepEqual(f.unlocatedValues, []);
});

test('#155 AC-2 (review): back-to-back stints and consecutive degrees — the previous end is not the next start', () => {
  const segments = [
    { id: 'a1', text: 'Acme Analyst Jan 2015 – Jan 2017', page: 1 },
    { id: 'a2', text: 'Acme Analyst Jan 2017 – Jan 2019', page: 2 },
  ];
  const stints = [
    { company: 'Acme', title: 'Analyst', start: '2015-01', end: '2017-01' },
    { company: 'Acme', title: 'Analyst', start: '2017-01', end: '2019-01' },
  ];
  const f = byField(profileFields({ displayName: 'A', employmentHistory: stints }, { displayName: 'A', email: null, phone: null }, source(segments))).employment_history;
  assert.deepEqual(f.evidence.map((e) => e.segmentId), ['a1', 'a2']);
  assert.deepEqual(f.unlocatedValues, []);
  const current = [{ id: 'c1', text: 'Acme Analyst 2019-01 to 2021-10' }, { id: 'c2', text: 'Acme Analyst 2021-10 to present' }];
  const g = byField(profileFields({ displayName: 'A', employmentHistory: [
    { company: 'Acme', title: 'Analyst', start: '2019-01', end: '2021-10' }, { company: 'Acme', title: 'Analyst', start: '2021-10', end: 'present' },
  ] }, { displayName: 'A', email: null, phone: null }, source(current))).employment_history;
  assert.deepEqual(g.evidence.map((e) => e.segmentId), ['c1', 'c2'], 'an open-ended stint ends at "present"');
  const degrees = [{ id: 'd1', text: 'Fudan University B.Sc. 2010 – 2014' }, { id: 'd2', text: 'Fudan University M.Sc. 2014 – 2016' }];
  const h = byField(profileFields({ displayName: 'A', education: [
    { school: 'Fudan University', degree: 'B.Sc.', major: 'Math', period: '2010 – 2014' }, { school: 'Fudan University', degree: 'M.Sc.', major: 'Statistics', period: '2014 – 2016' },
  ] }, { displayName: 'A', email: null, phone: null }, source(degrees))).education;
  assert.deepEqual(h.evidence.map((e) => e.segmentId), ['d1', 'd2']);
  // "2017-1" is not found inside "2017-10".
  const october = [{ id: 'o1', text: 'Acme Analyst 2017-10 to 2018-10' }, { id: 'o2', text: 'Acme Analyst 2017-1 to 2017-6' }];
  const k = byField(profileFields({ displayName: 'A', employmentHistory: [
    { company: 'Acme', title: 'Analyst', start: '2017-01', end: '2017-06' }, { company: 'Acme', title: 'Analyst', start: '2017-10', end: '2018-10' },
  ] }, { displayName: 'A', email: null, phone: null }, source(october))).employment_history;
  assert.deepEqual(k.evidence.map((e) => e.segmentId), ['o2', 'o1']);
});

test('#155 AC-1/AC-2 (review): email and phone are this version\'s, not the identity record\'s first values', () => {
  const text = 'Linh Pham\nnew.mail@example.test';
  const candidate = { displayName: 'Linh Pham', email: 'old@example.test', phone: '+84901234567' };
  const fields = byField(profileFields({ displayName: 'Linh Pham', contact: { email: 'new.mail@example.test', phone: null } }, candidate, source(segmentsOf(text))));
  assert.deepEqual([fields.email.values, fields.email.source, fields.email.evidence.length], [['new.mail@example.test'], 'resume', 1]);
  assert.deepEqual([fields.phone.status, fields.phone.values], ['missing', []], 'this résumé gives no phone: not the record\'s old one');
  // A version from before contacts were recorded shows the record's values and says that's where they came from.
  const legacy = byField(profileFields({ displayName: 'Linh Pham' }, candidate, source(segmentsOf(text))));
  assert.deepEqual([legacy.email.values, legacy.email.source], [['old@example.test'], 'record']);
});

test('#155 (review): a parse records the version\'s contact; a correction carries it into the next version', async () => {
  const created = [];
  const profile = { id: 'p-1', version: 1, resumeVersionId: 'rv-1', displayName: 'Mai', dataStatus: 'complete', parserVersion: 'x', parseStatus: 'succeeded', sourceEntries: [],
    resumeVersionRefs: [], employmentHistory: [], skills: [], education: [], certifications: [], languages: [], projects: [], location: null, workAuthorization: null,
    compensationExpectation: null, missingFields: [], corrections: [], contact: { email: 'mai@example.test', phone: null } };
  const db = {
    candidate: { findFirst: async () => ({ id: 'c-1', displayName: 'Mai', email: 'mai@example.test', phone: null, profiles: [profile] }), update: async () => ({}) },
    candidateJobRecommendation: { findFirst: async () => null }, screeningEvaluation: { findFirst: async () => null },
    candidateProfile: { create: async ({ data }) => { created.push(data); return { id: 'p-2', ...data }; } },
    auditRecord: { create: async () => ({}) },
  };
  db.$transaction = async (fn) => fn(db);
  await new ProfilesService(db, {}, {}, {}).correct({ workspaceId: 'ws-1', actorId: 'hr-1', roles: [] }, 'c-1', { phone: '+84 90 111 2222' });
  assert.deepEqual(created[0].contact, { email: 'mai@example.test', phone: '+84 90 111 2222' });
});

test('#155 (review): a contact correction is measured against the version shown, not the identity record', async () => {
  const created = [];
  const audits = [];
  const profile = { id: 'p-2', version: 2, resumeVersionId: 'rv-2', displayName: 'Mai', dataStatus: 'complete', parserVersion: 'x', parseStatus: 'succeeded', sourceEntries: [],
    resumeVersionRefs: [], employmentHistory: [], skills: [], education: [], certifications: [], languages: [], projects: [], location: null, workAuthorization: null,
    compensationExpectation: null, missingFields: [], corrections: [], contact: { email: 'new@example.test', phone: null } };
  const db = {
    candidate: { findFirst: async () => ({ id: 'c-1', displayName: 'Mai', email: 'old@example.test', phone: null, profiles: [profile] }), update: async () => ({}) },
    candidateJobRecommendation: { findFirst: async () => null }, screeningEvaluation: { findFirst: async () => null },
    candidateProfile: { create: async ({ data }) => { created.push(data); return { id: 'p-3', ...data }; } },
    auditRecord: { create: async ({ data }) => audits.push(data) },
  };
  db.$transaction = async (fn) => fn(db);
  await new ProfilesService(db, {}, {}, {}).correct({ workspaceId: 'ws-1', actorId: 'hr-1', roles: [] }, 'c-1', { email: 'old@example.test' });
  assert.equal(created[0].contact.email, 'old@example.test', 'changing the version back to the old address is a change');
  const entry = created[0].corrections.find((c) => c.fieldPath === 'email');
  assert.deepEqual([entry.oldValue, entry.newValue], ['new@example.test', 'old@example.test']);
  // The page and the form show the version's contact.
  const { CandidatesService } = require('../dist/library/candidates.service');
  const shown = new CandidatesService({}, {}, {}).toFrontendCandidate({ id: 'c-1', displayName: 'Mai', identityStatus: 'provisional', email: 'old@example.test', phone: null, ownerId: 'hr-1', createdAt: new Date(), lastMatchedAt: null, retention: 'standard' }, profile);
  assert.equal(shown.contact.email, 'new@example.test');
});

test('#155 (review): correcting one contact on a version from before contacts were recorded keeps the other one', async () => {
  const created = [];
  const legacy = { id: 'p-1', version: 1, resumeVersionId: 'rv-1', displayName: 'Mai', dataStatus: 'complete', parserVersion: 'x', parseStatus: 'succeeded', sourceEntries: [],
    resumeVersionRefs: [], employmentHistory: [], skills: [], education: [], certifications: [], languages: [], projects: [], location: null, workAuthorization: null,
    compensationExpectation: null, missingFields: [], corrections: [], contact: null };
  const db = {
    candidate: { findFirst: async () => ({ id: 'c-1', displayName: 'Mai', email: 'mai@example.test', phone: '+84 90 123 4567', profiles: [legacy] }), update: async () => ({}) },
    candidateJobRecommendation: { findFirst: async () => null }, screeningEvaluation: { findFirst: async () => null },
    candidateProfile: { create: async ({ data }) => { created.push(data); return { id: 'p-2', ...data }; } },
    auditRecord: { create: async () => ({}) },
  };
  db.$transaction = async (fn) => fn(db);
  await new ProfilesService(db, {}, {}, {}).correct({ workspaceId: 'ws-1', actorId: 'hr-1', roles: [] }, 'c-1', { email: 'mai.tran@example.test' });
  assert.deepEqual(created[0].contact, { email: 'mai.tran@example.test', phone: '+84 90 123 4567' }, 'the phone the page showed stays');
  const shown = byField(profileFields({ ...created[0], corrections: created[0].corrections }, { displayName: 'Mai', email: 'mai.tran@example.test', phone: '+84 90 123 4567' }, null));
  assert.deepEqual([shown.phone.status, shown.phone.values], ['known', ['+84 90 123 4567']]);
  assert.equal(shown.email.source, 'correction');
});

test('#155 AC-2 (review): a salary is located where the résumé talks about pay, not at any matching amount', () => {
  const segments = [
    { id: 'x1', text: 'Reduced annual infrastructure costs by 60000 USD.' },
    { id: 'x2', text: 'Salary expectation: USD 60,000 – 70,000 per year, gross' },
  ];
  const pay = { min: 60000, max: 70000, currency: 'USD', period: 'year', basis: 'gross' };
  const f = byField(profileFields({ displayName: 'A', compensationExpectation: pay }, { displayName: 'A', email: null, phone: null }, source(segments))).compensation_expectation;
  assert.deepEqual(f.evidence.map((e) => e.segmentId), ['x2']);
  // With no paragraph about pay, the amount alone doesn't pin it.
  const g = byField(profileFields({ displayName: 'A', compensationExpectation: pay }, { displayName: 'A', email: null, phone: null }, source([segments[0]]))).compensation_expectation;
  assert.deepEqual([g.evidence, g.evidenceUnavailable], [[], 'not_located']);
});

test('#155 AC-2 (review): projects that open alike each find their own paragraph — the whole text counts', () => {
  const segments = [
    { id: 'j1', text: 'Project Alpha: Developed a scalable data processing platform for retail analytics.' },
    { id: 'j2', text: 'Project Beta: Developed a scalable data processing platform for healthcare reporting.' },
  ];
  const projects = [
    { name: 'Project Beta', description: 'Developed a scalable data processing platform for healthcare reporting.' },
    { name: 'Project Gamma', description: 'Developed a scalable data processing platform for logistics.' },
  ];
  const f = byField(profileFields({ displayName: 'A', projects }, { displayName: 'A', email: null, phone: null }, source(segments))).projects;
  assert.deepEqual(f.evidence.map((e) => e.segmentId), ['j2']);
  assert.deepEqual(f.unlocatedValues, ['Project Gamma: Developed a scalable data processing platform for logistics.']);
});

test('#192 (review): an evidence quote is located only if all of it is in the source', () => {
  const { locateQuote } = require('../dist/shared/locate-quote');
  const segs = [{ id: 's1', text: 'Built pricing dashboards in SQL and Python for 120 stores across three regions.' }];
  assert.equal(locateQuote(segs, 'Built pricing dashboards in SQL and Python for 120 stores across three regions. Managed a team of 500 engineers.'), null);
  assert.equal(locateQuote(segs, 'built pricing dashboards in SQL and Python for 120 stores')?.segmentId, 's1');
});

test('#155 AC-2 (review): an expected salary range is located where the whole range is, not at a current salary', () => {
  const pay = { min: 60000, max: 70000, currency: 'USD', period: 'year', basis: 'gross' };
  const at = (segments) => byField(profileFields({ displayName: 'A', compensationExpectation: pay }, { displayName: 'A', email: null, phone: null }, source(segments))).compensation_expectation;
  const both = at([{ id: 'c1', text: 'Current salary: 60,000 USD per year, gross.' }, { id: 'c2', text: 'Expected salary: 60,000–70,000 USD per year, gross.' }]);
  assert.deepEqual(both.evidence.map((e) => e.segmentId), ['c2']);
  assert.deepEqual(at([{ id: 'k1', text: 'Salary expectation: USD 60-70k/yr gross' }]).evidence.map((e) => e.segmentId), ['k1'], 'the range written short');
  const currentOnly = at([{ id: 'n1', text: 'Current salary: 60,000 USD per year, gross.' }]);
  assert.deepEqual([currentOnly.evidence, currentOnly.evidenceUnavailable], [[], 'not_located']);
  assert.equal(at([{ id: 'z1', text: 'Salary: 160,000 – 170,000 USD' }]).evidence.length, 0, '60,000 inside 160,000 is not it');
});

test('#155 AC-1: a location confirmed unchanged on paste keeps its country and city; one the user typed is theirs', () => {
  const { withConfirmedIdentity } = require('../dist/profiles/profiles.service');
  const parsed = { displayName: 'A', email: null, location: { value: 'Ho Chi Minh City, Vietnam', status: 'known', country: 'Vietnam', city: 'Ho Chi Minh City' }, missingFields: [] };
  const same = withConfirmedIdentity(parsed, { displayName: 'A', location: 'ho chi minh city, vietnam ' });
  assert.equal(same.location.country, 'Vietnam');
  const sameField = byField(profileFields(same, { displayName: 'A', email: null, phone: null }, null)).location;
  assert.deepEqual([sameField.status, sameField.incomplete], ['known', []]);
  const typed = withConfirmedIdentity(parsed, { displayName: 'A', location: 'Da Nang' });
  const typedField = byField(profileFields(typed, { displayName: 'A', email: null, phone: null }, null)).location;
  assert.deepEqual([typedField.status, typedField.source, typedField.values], ['known', 'correction', ['Da Nang']]);
});

test('#155 AC-1: availability with a decimal is read whole — 1.5 months is 45 days', () => {
  const { readAvailability } = require('../dist/profiles/field-formats');
  assert.equal(readAvailability('1.5 months notice').days, 45);
  assert.equal(readAvailability('2 weeks').days, 14);
  assert.equal(readAvailability('0.5个月').days, 15);
  // A negated "immediately" isn't zero days: the stated notice period counts, or the text alone stays.
  assert.equal(readAvailability('Not immediately available; 2 months notice').days, 60);
  assert.equal(readAvailability('Not immediately available').days, undefined);
  assert.equal(readAvailability('不能立即到岗').days, undefined);
  assert.equal(readAvailability('Available immediately').days, 0);
  assert.equal(readAvailability('随时到岗').days, 0);
  // Amounts in several units add up; a bare month or day is a date, not a duration.
  assert.equal(readAvailability('1 month and 2 weeks notice').days, 44);
  assert.equal(readAvailability('1个月零10天').days, 40);
  assert.equal(readAvailability('可于3月到岗').days, undefined);
  assert.equal(readAvailability('15日后到岗').days, undefined);
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
