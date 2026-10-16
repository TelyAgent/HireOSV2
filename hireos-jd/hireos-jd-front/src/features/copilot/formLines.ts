/** Parsing of the manual form's multi-line fields (one item per line). */

const ITEM_MARKER = /^\s*(?:[-•*●·▪]|\d+[.)、])\s*/;
const BULLET = /^\s*[-•*●·▪]\s*/;
const INDENT = (line: string) => line.match(/^\s*/)![0].length;

/** Splits a textarea into list items, dropping bullets/numbering the user typed. */
export function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(ITEM_MARKER, "").trim())
    .filter(Boolean);
}

/**
 * Like `toLines`, but keeps the groups a long JD is written in (#86), e.g.
 *
 *   1.基础条件            ← group heading, kept as typed
 *   ● 计算机相关专业       ← items of that group
 *   2.专业能力
 *   ● 熟悉 RAG
 *
 * A line is a group heading when it ends with a colon, when the lines under it are indented further, or when
 * the whole text is written as headings over bullets — every plain line followed by bullets, at least twice.
 * A single plain line above some bullets ("1. 4+ years in B2B sales" / "- Fluent English") stays an item: when
 * in doubt, a line is kept as a requirement rather than turned into a heading. Plain lines — numbered or not —
 * stay a flat list. `groups[i]` is the heading of `items[i]`, "" for items before any heading.
 */
export function toGroupedLines(text: string): { items: string[]; groups: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const plain = lines.map((line, index) => ({ index, line })).filter(({ line }) => !BULLET.test(line));
  const overBullets = (index: number) => lines[index + 1] !== undefined && BULLET.test(lines[index + 1]);
  const headingsOverBullets = plain.length >= 2 && plain.every(({ index }) => overBullets(index));
  const opensGroup = (index: number) => {
    const line = lines[index];
    const next = lines[index + 1];
    if (BULLET.test(line) || next === undefined) return false;
    return /[:：]\s*$/.test(line) || INDENT(next) > INDENT(line) || headingsOverBullets;
  };

  const items: string[] = [];
  const groups: string[] = [];
  let group = "";
  lines.forEach((line, index) => {
    if (opensGroup(index)) {
      group = line.trim();
      return;
    }
    const item = line.replace(ITEM_MARKER, "").trim();
    if (!item) return;
    items.push(item);
    groups.push(group);
  });
  return { items, groups };
}
