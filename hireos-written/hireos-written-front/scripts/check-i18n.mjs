#!/usr/bin/env node
// #235: every literal `t("…")` key used in src/ must have a zh entry in src/data/i18n.ts — otherwise the Chinese UI
// silently falls back to English. The dictionary is read by importing it (Node runs the .ts as is), so several
// entries on one line all count; every call on a line is checked, and a missing key is reported with where it's
// used. Limits: dynamic keys (t(variable), t(cond ? "a" : "b")) and text hard-coded without t() can't be checked
// statically — passing this check is not the same as the whole interface being translated.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(tsx?|jsx?)$/.test(name) && !path.endsWith("data/i18n.ts") ? [path] : [];
  });
}

/** Unescapes a JS string literal body the way the source means it. */
const unescape = (raw, quote) => JSON.parse(`"${raw.replace(/\\'/g, "'").replace(quote === '"' ? /(?!)/ : /"/g, '\\"')}"`);

/** Every literal t("…") key in the code, with its line — several on one line included. */
export function usedKeys(code) {
  const keys = [];
  const re = /\bt\(\s*(["'])((?:\\.|(?!\1).)*)\1\s*(?:,\s*(["'])((?:\\.|(?!\3).)*)\3\s*)?\)/g;
  for (const m of code.matchAll(re)) {
    const line = code.slice(0, m.index).split("\n").length;
    keys.push({ key: m[4] !== undefined ? unescape(m[4], m[3]) : unescape(m[2], m[1]), line });
  }
  return keys;
}

export async function missingKeys(srcDir = src) {
  const { ZH } = await import(pathToFileURL(join(srcDir, "data/i18n.ts")).href);
  const missing = new Map();
  for (const file of walk(srcDir)) {
    for (const { key, line } of usedKeys(readFileSync(file, "utf8"))) {
      if (!(key in ZH)) missing.set(key, [...(missing.get(key) || []), `${relative(root, file)}:${line}`]);
    }
  }
  return { missing, entries: Object.keys(ZH).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { missing, entries } = await missingKeys();
  if (missing.size) {
    console.error(`i18n: ${missing.size} key(s) used with t() have no zh translation in src/data/i18n.ts:`);
    for (const [key, places] of missing) console.error(`  - ${JSON.stringify(key)}  (${places.join(", ")})`);
    process.exit(1);
  }
  console.log(`i18n: all literal t() keys have zh translations (${entries} entries).`);
}
