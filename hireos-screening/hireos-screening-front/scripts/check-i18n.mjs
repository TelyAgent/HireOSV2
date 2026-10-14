#!/usr/bin/env node
// Issue #26 AC-9: every literal `t("…")` key used in src/ must have a zh entry in src/data/i18n.ts.
// Dynamic keys (t(variable), t(cap(x))) can't be checked statically and are skipped.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

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

export function usedKeys(code) {
  const keys = [];
  // t("source") or t("source", "key") — the second literal, when present, is the lookup key.
  const re = /\bt\(\s*(["'])((?:\\.|(?!\1).)*)\1\s*(?:,\s*(["'])((?:\\.|(?!\3).)*)\3\s*)?\)/g;
  for (const m of code.matchAll(re)) keys.push(m[4] !== undefined ? unescape(m[4], m[3]) : unescape(m[2], m[1]));
  return keys;
}

export function zhKeys(i18nSource) {
  const body = i18nSource.slice(i18nSource.indexOf("export const ZH"), i18nSource.indexOf("\n};", i18nSource.indexOf("export const ZH")));
  const keys = new Set();
  for (const m of body.matchAll(/^\s*(?:"((?:\\.|[^"\\])*)"|([A-Za-z_$][\w$]*))\s*:/gm)) keys.add(m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2]);
  return keys;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const zh = zhKeys(readFileSync(join(src, "data/i18n.ts"), "utf8"));
  const missing = new Map();
  for (const file of walk(src)) {
    for (const key of usedKeys(readFileSync(file, "utf8"))) {
      if (!zh.has(key)) missing.set(key, [...(missing.get(key) || []), relative(root, file)]);
    }
  }
  if (missing.size) {
    console.error(`i18n: ${missing.size} key(s) used with t() have no zh translation in src/data/i18n.ts:`);
    for (const [key, files] of missing) console.error(`  - ${JSON.stringify(key)}  (${[...new Set(files)].join(", ")})`);
    process.exit(1);
  }
  console.log(`i18n: all literal t() keys have zh translations (${zh.size} entries).`);
}
