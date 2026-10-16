// Run from hireos-screening-backend after `npm run build`: node scripts/gen-profile-fields-fixture.cjs
// Writes the candidate API's profileFields for the F02 samples, for the frontend's display tests (#155 AC-3).
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const { profileFields } = require(root + '/dist/profiles/profile-fields');
const { ProfileParserService } = require(root + '/dist/profiles/profile-parser.service');
const { ProfilesService } = require(root + '/dist/profiles/profiles.service');
const { splitText } = require(root + '/dist/intake/materials.service');
const read = (n) => fs.readFileSync(path.join(root, 'test/fixtures/f02', n), 'utf8');
const segs = (t) => splitText(t).map((s, i) => ({ ...s, id: `s${i + 1}` }));
const src = (t, readable = true) => ({ resumeVersionId: 'rv-2', resumeVersion: 2, materialId: 'm-1', readable, segments: readable ? segs(t) : [] });
const answer = {
  displayName: 'Linh Pham', email: 'Linh.Pham@Example.test', phone: '+84 90 123 4567',
  location: { value: 'Ho Chi Minh City, Vietnam', status: 'known', country: 'Vietnam', city: 'Ho Chi Minh City' }, workAuthorization: { value: '', status: 'unknown' },
  availability: { value: '1 month', status: 'known' }, skills: ['SQL', 'Python', 'Tableau'], languages: ['English (IELTS 7.5)', 'Vietnamese (native)'],
  employmentHistory: [
    { company: 'Example Retail', title: 'Senior Data Analyst', start: '2021-03', end: 'present', achievements: [] },
    { company: 'Sample Bank', title: 'Data Analyst', start: '2018-07', end: '2021-06', achievements: [] },
  ],
  education: [{ statement: 'B.Sc. Statistics, Vietnam National University', school: 'Vietnam National University', degree: 'B.Sc.', major: 'Statistics', period: '2014 – 2018' }],
  certifications: ['AWS Certified Cloud Practitioner', 'Google Data Analytics Certificate'],
  projects: [{ name: 'Pricing dashboard', description: 'weekly price-elasticity dashboard for 120 stores.' }],
  compensationExpectation: { min: 60000, max: 70000, currency: 'USD', period: 'year', basis: 'gross' },
};
(async () => {
  const ai = { isConfigured: () => true, parse: async () => answer };
  const full = await new ProfilesService({}, {}, ai, {}).parseWithAi({ id: 'm-1', text: read('complete.txt') }, 'x');
  const sparse = new ProfileParserService().parse('m-1', segs(read('sparse.txt')), 'fallback');
  const out = {
    complete: profileFields(full, { displayName: full.displayName, email: full.email, phone: full.phone }, src(read('complete.txt'))),
    sparse: profileFields(sparse, { displayName: sparse.displayName, email: null, phone: null }, src(read('sparse.txt'))),
    partlyLocated: profileFields({ ...full, skills: ['SQL', 'Python', 'Kubernetes'] }, { displayName: full.displayName, email: full.email, phone: full.phone }, src(read('complete.txt'))),
    sourceUnavailable: profileFields(full, { displayName: full.displayName, email: full.email, phone: full.phone }, src('', false)),
  };
  const target = path.join(root, '../hireos-screening-front/test/unit/fixtures/profile-fields.json');
  fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
  console.log('wrote', target);
})();
