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
 * A line is a group heading when it ends with a colon, or when the lines under it are bullets or indented
 * further and it is not one itself. Plain lines — numbered or not — stay a flat list. `groups[i]` is the
 * heading of `items[i]`, "" for items before any heading.
 */
export function toGroupedLines(text: string): { items: string[]; groups: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const items: string[] = [];
  const groups: string[] = [];
  let group = "";
  lines.forEach((line, index) => {
    const next = lines[index + 1];
    const isBullet = BULLET.test(line);
    const opensGroup =
      !isBullet &&
      next !== undefined &&
      (/[:：]\s*$/.test(line) || BULLET.test(next) || INDENT(next) > INDENT(line));
    if (opensGroup) {
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
