import type { Prisma } from '@prisma/client';

/**
 * Creates (or, for the same candidate + job, reuses) the case and its "plan ready, test not yet
 * sent" task -- shared by the screening hand-off and the new-task entry so both land a case in
 * exactly the same starting state. An existing task is left alone: if someone already started
 * working it, a repeat intake shouldn't reopen or retitle it.
 */
export async function upsertCaseWithTask(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string; candidateId: string; jobId: string; candidateName: string;
    create: Omit<Prisma.CaseUncheckedCreateInput, 'workspaceId' | 'candidateId' | 'jobId'>;
    update: Prisma.CaseUncheckedUpdateInput;
  },
) {
  const { workspaceId, candidateId, jobId } = input;
  const kase = await tx.case.upsert({
    where: { workspaceId_candidateId_jobId: { workspaceId, candidateId, jobId } },
    create: { workspaceId, candidateId, jobId, status: 'linked', ...input.create },
    update: input.update,
  });
  const task = await tx.task.upsert({
    where: { caseId: kase.id },
    create: { workspaceId, caseId: kase.id, title: `${input.candidateName} — plan ready, test not yet sent`, type: 'invite_pending', status: 'open' },
    update: {},
  });
  return { caseId: kase.id, taskId: task.id };
}
