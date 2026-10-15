/**
 * Quick Start (M1): the user answers three questions; a full draft is only generated once all three have
 * a real answer and there's a job title the user can confirm (#65 #66).
 */

/** Marker in a conversation's `missingFields`: the job title is an AI suggestion the user hasn't confirmed. */
export const TITLE_UNCONFIRMED = 'title_unconfirmed';

export const QUICK_START_QUESTIONS = {
  zh: ['你遇到了什么困难，让你想招人？', '你希望候选人解决什么问题？', '候选人必须具备哪些硬技能？'],
  en: [
    'What difficulty are you running into that makes you want to hire?',
    'What problem do you want the candidate to solve?',
    'What hard skills must the candidate have?',
  ],
} as const;

export type QuickStartAssessment = {
  /** Whether each question has a real answer: difficulty, problem, hard skills. */
  answered: [boolean, boolean, boolean];
  /** A job title the answers support; null when none can reasonably be suggested. */
  title: string | null;
  /** The user stated the title themselves (then it needs no confirmation). */
  titleFromUser: boolean;
};

export const QUICK_START_ASSESS_PROMPT = [
  '你是招聘 JD 助手。用户在“快速开始”里回答 3 个问题（可能写在一条或多条消息里）：',
  '1. 遇到了什么困难想招人；2. 希望候选人解决什么问题；3. 候选人必须具备哪些硬技能。',
  '逐题判断是否有实质回答：随意字符、单个字母、“不知道”、与问题无关的内容都算没有回答。只回答了前两题时，第 3 题就是没有回答。',
  '再判断能否根据回答合理地提出一个职位名称：只有回答清楚指向某类岗位时才给出；回答含糊（例如“事情很乱”“整理一下”“耐心、好奇、友善”）时给 null，不要硬猜。',
  '如果用户自己明确写了职位名称，用它，并把 titleFromUser 设为 true。',
  '只输出 JSON：{"answered":[bool,bool,bool],"title":string|null,"titleFromUser":bool}。',
].join('\n');

/** A floor no model output can lower: answers with almost no letters (e.g. a lone "a") answer nothing. */
export function tooThinToAssess(answers: string): boolean {
  return (answers.match(/\p{L}/gu) ?? []).length < 3;
}

/** Parses the model's assessment defensively; anything unexpected counts as "not answered / no title". */
export function parseAssessment(raw: string): QuickStartAssessment {
  try {
    const value = JSON.parse(raw) as { answered?: unknown; title?: unknown; titleFromUser?: unknown };
    const answered = Array.isArray(value.answered) ? value.answered : [];
    const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim().slice(0, 200) : null;
    return {
      answered: [answered[0] === true, answered[1] === true, answered[2] === true],
      title,
      titleFromUser: title !== null && value.titleFromUser === true,
    };
  } catch {
    return { answered: [false, false, false], title: null, titleFromUser: false };
  }
}

const isZh = (text: string) => /[一-鿿]/.test(text);

/** The follow-up when something is missing: only the unanswered questions, or the job title (#65 AC-1, #66 AC-3). */
export function followUp(assessment: QuickStartAssessment, answers: string): string | null {
  const lang = isZh(answers) ? 'zh' : 'en';
  const questions: readonly string[] = QUICK_START_QUESTIONS[lang];
  const missing = assessment.answered.map((ok, i) => (ok ? null : questions[i])).filter((q): q is string => q !== null);
  if (missing.length) {
    const head =
      lang === 'zh'
        ? missing.length === 3
          ? '我还没拿到能用来写 JD 的回答。请回答这 3 个问题（每行一个）：'
          : '还差下面的问题没有回答，补上后我就开始写 JD：'
        : missing.length === 3
          ? 'I don’t have answers I can write a JD from yet. Please answer these 3 questions (one per line):'
          : 'One more thing before I write the JD — please answer:';
    return [head, ...missing.map((q, i) => `${i + 1}. ${q}`)].join('\n');
  }
  if (!assessment.title) {
    return lang === 'zh'
      ? '根据这些回答，我还不能确定这是什么职位。请告诉我职位名称（例如“运营经理”“数据分析师”），我再开始写 JD。'
      : 'From these answers I can’t tell which role this is yet. What’s the job title (e.g. “Operations Manager”, “Data Analyst”)? Then I’ll write the JD.';
  }
  return null;
}
