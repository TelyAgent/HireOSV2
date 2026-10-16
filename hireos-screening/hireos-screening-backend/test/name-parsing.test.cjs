// #164 -- a name line that carries a date isn't skipped for the next line, so a "Location:" label never becomes
// the name, and the résumé isn't sent to duplicate review on that false name.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MaterialsService } = require('../dist/intake/materials.service');
const { SecurityScanService } = require('../dist/intake/security-scan.service');
const { ProfileParserService, nameFromLine, locationFromLine } = require('../dist/profiles/profile-parser.service');
const { ImportsService } = require('../dist/intake/imports.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', 'f01', name));

async function extracted(name, mimetype) {
  const db = { material: { findFirst: async () => null, create: async ({ data }) => ({ id: 'm-1', ...data }) } };
  const service = new MaterialsService(db, new SecurityScanService(), { uploadMaterial: async () => null });
  const buffer = fixture(name);
  return (await service.saveUpload(identity, { originalname: name, mimetype, size: buffer.length, buffer })).material;
}

test('#164 AC-1: PDF and DOCX with a dated name line and a separate Location: line give the real name and a plain place', async () => {
  for (const [name, mime] of [['name-with-date.pdf', 'application/pdf'], ['name-with-date.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']]) {
    const material = await extracted(name, mime);
    const parsed = new ProfileParserService().parse(material.id, material.segments, 'Name With Date');
    assert.equal(parsed.displayName, 'Mai Tran', name);
    assert.equal(parsed.location.value, 'Hanoi, Vietnam', name);
    assert.doesNotMatch(parsed.displayName, /Location/);
  }
});

test('#164 AC-2: that résumé is not matched to a different candidate through a "Location" name', async () => {
  const material = await extracted('name-with-date.pdf', 'application/pdf');
  const signals = new ProfileParserService().parse(material.id, material.segments, 'name with date');
  const old = { id: 'c-old', displayName: 'Location Hanoi Vietnam', phone: null };
  const db = {
    material: { findFirst: async () => null },
    candidate: { findFirst: async () => null, findMany: async () => [old] },
  };
  const service = new ImportsService(db, {}, {}, {});
  service.findByNormalizedName = async (_w, _file, parsedName) => (/location/i.test(parsedName) ? { id: 'c-old', displayName: 'Location Hanoi Vietnam' } : null);
  const match = await service['findPossibleDuplicate']('ws-1', material, signals);
  assert.equal(match, null);
});

test('#164 AC-3: ordinary name lines still read as before; fields, headings and sentences never do', () => {
  for (const [line, name] of [
    ['Mai Tran', 'Mai Tran'], ['陈立', '陈立'], ['Lin Chen | Updated 2026-10', 'Lin Chen'], ['Nguyen Van An  2026年10月15日', 'Nguyen Van An'],
    ['Mary-Jane O\'Neil', 'Mary-Jane O\'Neil'],
  ]) assert.equal(nameFromLine(line), name, line);
  for (const line of ['Location: Hanoi, Vietnam', 'Based in Ho Chi Minh City, Vietnam.', 'mai@example.test', '居住地：上海', 'Professional Summary', 'I build data products for retail teams across the region', 'Phone: 0912 345 678']) {
    assert.equal(nameFromLine(line), null, line);
  }
  assert.equal(locationFromLine('Based in Ho Chi Minh City, Vietnam.'), 'Ho Chi Minh City, Vietnam');
  assert.equal(locationFromLine('Location: Hanoi, Vietnam'), 'Hanoi, Vietnam');
  assert.equal(locationFromLine('居住地：上海市浦东新区'), '上海市浦东新区');
});
