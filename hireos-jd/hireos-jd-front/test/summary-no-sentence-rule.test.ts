// Issue #93 AC-4 — the role summary is judged by having content, not by its number of sentences.
import { describe, expect, it } from 'vitest';
import { buildDraftFromBackend } from '../src/features/workspace/docHelpers';
import { evaluateJob } from '../src/features/workspace/completeness';
import type { Job } from '../src/data/types';

const job = { id: 'job-93', title: 'Data Analyst', location: 'Shanghai', headcount: 1 } as unknown as Job;
const summaryRow = (roleSummary: string) => {
  const draft = buildDraftFromBackend('Data Analyst', { roleSummary, responsibilities: ['Build dashboards for sales', 'Run weekly reviews', 'Own data quality'], requirements: [], internalCompensation: null, publicCompensation: null } as never, 'job-93');
  return evaluateJob(job, draft).rows.find((r) => r.item.id === 'B1')!;
};

describe('role summary (#93 AC-4)', () => {
  it('one non-empty sentence passes without a sentence-count hint or Weak', () => {
    const row = summaryRow('Turns sales data into weekly decisions for the commercial team.');
    expect(row.ok).toBe(true);
    expect(row.weak).toBeFalsy();
    expect(JSON.stringify(row)).not.toMatch(/sentence|句/);
  });

  it('a long summary is not Weak for its length in sentences either', () => {
    const row = summaryRow('One. Two things matter. Three is here. Four is also here. Five more. Six now. Seven at last.');
    expect(row.weak).toBeFalsy();
  });
});
