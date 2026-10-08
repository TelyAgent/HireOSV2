/**
 * Loads the Question Bank from hireos-written-backend (`GET /api/questions`) into the QUESTIONS
 * fixture dict -- same "merge real records into the fixture dicts" pattern as realTasksMerge.ts, so
 * the bank page, question detail page and the plan drawer's "From Question Bank" picker all read it
 * unchanged.
 */
import { QUESTIONS, type Question } from "./fixtures";
import { listBankQuestions, type RealBankQuestion } from "./writtenApi";

export function toBankQuestion(q: RealBankQuestion): Question {
  return {
    id: q.id,
    code: q.code,
    title: q.title,
    type: q.type,
    roles: q.roles,
    competencies: q.competencies,
    difficulty: q.difficulty,
    estMinutes: q.estMinutes,
    language: q.language,
    version: q.version,
    status: q.status,
    author: q.author ?? "system",
    favorite: q.favorite,
    prompt: q.prompt,
    materials: [],
    deliverables: q.deliverables,
    usageCount: 0,
    seenByCount: 0,
  };
}

/** Replaces the bank part of QUESTIONS with the backend list -- a question deleted elsewhere (another
 * tab, another user) disappears too. Case-scoped questions (see Question.caseScoped) are left alone. */
export async function loadBankQuestionsIntoFixtures(): Promise<void> {
  const questions = await listBankQuestions();
  for (const existing of Object.values(QUESTIONS)) {
    if (!existing.caseScoped) delete QUESTIONS[existing.id];
  }
  for (const q of questions) QUESTIONS[q.id] = toBankQuestion(q);
}
