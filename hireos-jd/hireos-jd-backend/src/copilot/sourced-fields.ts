import type { JdFields } from './types';
import { separateUnsourced } from './unsourced-facts';

/**
 * Years of experience and pay figures a Copilot draft may state: only those in the user's own words (or their
 * file, link or pasted text) (#67). The model is told so, but this holds whatever it writes — the same check the
 * document AI already applies (#95). A list item carrying such a figure is left out whole, a summary loses only
 * the sentence; both come back as `toConfirm`.
 */
const LIST_FIELDS = ['responsibilities', 'mustHave', 'niceToHave', 'expectedOutcomes', 'successCriteria'] as const;
const GROUP_OF: Partial<Record<(typeof LIST_FIELDS)[number], 'mustHaveGroups' | 'niceToHaveGroups'>> = { mustHave: 'mustHaveGroups', niceToHave: 'niceToHaveGroups' };
const PROSE_FIELDS = ['roleSummary', 'businessProblem'] as const;

export function keepSourced(fields: JdFields, source: string): { fields: JdFields; toConfirm: string[] } {
  const out: JdFields = { ...fields };
  const toConfirm: string[] = [];

  for (const key of LIST_FIELDS) {
    const items = out[key];
    if (!items) continue;
    const keptIdx: number[] = [];
    items.forEach((item, i) => {
      if (separateUnsourced([item], true, source).toConfirm.length) toConfirm.push(item);
      else keptIdx.push(i);
    });
    if (keptIdx.length === items.length) continue;
    if (keptIdx.length) out[key] = keptIdx.map((i) => items[i]);
    else delete out[key];
    // A requirement's group heading goes with it (#86).
    const groupKey = GROUP_OF[key];
    const groups = groupKey ? out[groupKey] : undefined;
    if (groupKey && groups) {
      if (keptIdx.length) out[groupKey] = keptIdx.map((i) => groups[i] ?? '');
      else delete out[groupKey];
    }
  }

  for (const key of PROSE_FIELDS) {
    const text = out[key];
    if (!text) continue;
    const split = separateUnsourced([text], false, source);
    if (!split.toConfirm.length) continue;
    toConfirm.push(...split.toConfirm);
    if (split.items[0]) out[key] = split.items[0];
    else delete out[key];
  }
  return { fields: out, toConfirm };
}

/** The draft's reply with what was left out, so the user sees it and can add it themselves. */
export function withToConfirm(reply: string, toConfirm: string[]): string {
  if (!toConfirm.length) return reply;
  const zh = /[一-鿿]/.test(reply + toConfirm.join(''));
  const head = zh
    ? '以下内容含有你没有提供的经验年限或薪资数字，没有写入草稿；需要的话请确认后自己补上：'
    : 'These state years of experience or pay you did not give, so they were not written into the draft; confirm and add them yourself if they apply:';
  return [reply, '', head, ...toConfirm.map((x) => `- ${x}`)].join('\n');
}
