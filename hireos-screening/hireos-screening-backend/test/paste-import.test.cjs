// #160 #161 #167 -- "Paste profile": the user confirms the name, email and location read from the text before
// saving; a name is required (never taken from the email), and the import is recorded as a paste.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ImportsService } = require('../dist/intake/imports.service');
const { ProfilesService, withConfirmedIdentity } = require('../dist/profiles/profiles.service');
const { ProfileParserService } = require('../dist/profiles/profile-parser.service');
const { confirmedIdentityOf } = require('../dist/intake/confirmed-identity');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
const NO_NAME = 'pia.noname@example.test\nBased in Ho Chi Minh City, Vietnam.\nSkills: SQL, Python, Tableau\nThree years of data analysis for retail teams.';
const WITH_NAME = `Linh Pham\n${NO_NAME}`;

const profiles = new ProfilesService({}, new ProfileParserService(), {}, {});
const service = (overrides = {}) => Object.assign(new ImportsService({}, {}, profiles, {}), overrides);

test('#167 AC-1 / #160 AC-1: the preview reads name, email and a clean place; with no name line the name stays empty', () => {
  assert.deepEqual(service().previewPaste({ text: WITH_NAME }), { displayName: 'Linh Pham', email: 'pia.noname@example.test', location: 'Ho Chi Minh City, Vietnam' });
  const none = service().previewPaste({ text: NO_NAME });
  assert.equal(none.displayName, null, 'not "Pia Noname" from the email');
  assert.equal(none.location, 'Ho Chi Minh City, Vietnam');
});

test('#160 AC-3: a paste without a name is refused with a validation error, before anything is created', async () => {
  let batches = 0;
  const s = service({ createBatch: async () => { batches++; } });
  for (const body of [{ text: NO_NAME }, { text: NO_NAME, displayName: '   ' }]) {
    await assert.rejects(s.importPaste(identity, body), (e) => e.getStatus() === 422 && e.response.code === 'INVALID_SCHEMA' && e.response.fieldPaths.includes('displayName'));
  }
  assert.equal(batches, 0);
});

test('#160 AC-2 / #161 AC-1 / #167 AC-2: the confirmed values are what is imported, through the paste channel', async () => {
  const calls = [];
  const s = service({ createBatch: async (...args) => { calls.push(args); return { id: 'batch-1' }; } });
  await s.importPaste(identity, { text: WITH_NAME, displayName: 'Linh Phạm', email: 'linh@example.test', location: 'Hanoi, Vietnam' }, 'key-1');
  const [, files, channel, key, , confirmed] = calls[0];
  assert.equal(channel, 'paste');
  assert.equal(key, 'key-1');
  assert.deepEqual(confirmed, { displayName: 'Linh Phạm', email: 'linh@example.test', location: 'Hanoi, Vietnam' });
  assert.equal(files[0].buffer.toString('utf8'), WITH_NAME, 'the pasted text itself is stored unchanged');
  assert.equal(Buffer.from(files[0].originalname, 'latin1').toString('utf8'), 'Linh Phạm.txt');
});

test('#160 AC-2 / #167 AC-2: the candidate and the profile carry the confirmed name and place, not what parsing guessed', async () => {
  const material = { id: 'm-1', confirmedIdentity: { displayName: 'Linh Phạm', email: 'linh@example.test', location: 'Hanoi, Vietnam' } };
  const confirmed = confirmedIdentityOf(material);
  const created = [];
  const tx = {
    candidate: { create: async ({ data }) => { created.push(data); return { id: 'c-1' }; } },
    libraryEntry: { create: async () => ({}) },
    resumeVersion: { create: async ({ data }) => { created.push(data); return { id: 'rv-1' }; } },
    candidateSource: { create: async ({ data }) => { created.push(data); return {}; } },
    auditRecord: { create: async () => ({}) },
  };
  const core = { createCandidate: async (_i, input) => { created.push({ core: input }); return null; } };
  const s = new ImportsService({ $transaction: async (fn) => fn(tx) }, {}, profiles, core);
  await s['createCandidateFromMaterial'](identity, 'm-1', 'Linh Phạm.txt', 'paste', null, confirmed);
  assert.equal(created.find((d) => d.core).core.source, 'paste');
  assert.equal(created.find((d) => d.ownerId).displayName, 'Linh Phạm');
  assert.equal(created.find((d) => d.ownerId).email, 'linh@example.test');
  assert.equal(created.find((d) => d.version === 1).source, 'paste', '#161: the resume version says paste');
  assert.equal(created.find((d) => d.channel).channel, 'paste');

  const parsed = withConfirmedIdentity({ displayName: 'Based In Ho Chi Minh City', email: null, location: null, missingFields: ['location', 'education'] }, confirmed);
  assert.equal(parsed.displayName, 'Linh Phạm');
  assert.equal(parsed.location.value, 'Hanoi, Vietnam');
  assert.equal(parsed.location.status, 'known');
  assert.deepEqual(parsed.missingFields, ['education']);
});

test('#161 AC-2: a TXT through the file upload stays a manual upload', async () => {
  const calls = [];
  const s = service({ processOne: async (...args) => calls.push(args), finalizeBatch: async () => ({}), recordActivity: async () => {} });
  s.db = {
    ingestionOperation: { create: async () => ({ id: 'op-1', batch: { id: 'b-1' } }) },
    importItem: { create: async ({ data }) => ({ id: 'i-1', ...data }) },
  };
  const buffer = Buffer.from(WITH_NAME);
  await s.createBatch(identity, [{ originalname: 'linh.txt', mimetype: 'text/plain', size: buffer.length, buffer }]);
  assert.equal(calls[0][5], 'manual_upload');
  assert.equal(calls[0][6], undefined, 'no confirmed identity on an upload');
});
