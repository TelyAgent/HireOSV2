// #96 — the migration freezes a never-saved job's document on the server; it must be the same document this
// editor builds from the draft. The backend test checks its side against the same fixture.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDraftFromBackend } from '../src/features/workspace/docHelpers';
import { baselineOf, docMetaOf, type JdVersion } from '../src/features/workspace/versions';

const fixture = JSON.parse(readFileSync(resolve(__dirname, '../../hireos-jd-backend/test/fixtures/baseline-blocks.json'), 'utf8'));

describe('migration baseline (#96)', () => {
  it('AC-2: the editor builds the same blocks from a draft as the server-side baseline', () => {
    expect(buildDraftFromBackend(fixture.title, fixture.draft, fixture.jobId).blocks).toEqual(fixture.blocks);
  });

  it('AC-2: a baseline v1 is recognised, and restoring it does not copy the marker into the document', () => {
    const v1 = {
      versionNo: 1, code: 'JD-2026-0001@v1', title: 'Growth Lead', blocks: [], note: '', publishedBy: 'system:jd-baseline-migration', publishedAt: '2026-10-15T00:00:00.000Z',
      meta: { values: { level: 'Senior' }, shown: ['level'], baseline: { kind: 'migration_baseline', source: 'draft', migratedAt: '2026-10-15T00:00:00.000Z' } },
    } as JdVersion;
    expect(baselineOf(v1)?.source).toBe('draft');
    expect(docMetaOf(v1)).toEqual({ values: { level: 'Senior' }, shown: ['level'] });
    expect(baselineOf({ ...v1, meta: { values: {}, shown: [] } })).toBeNull();
  });
});
