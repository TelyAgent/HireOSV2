// #240 -- avatar initials are whole characters (grapheme clusters), never half a UTF-16 surrogate pair; the same
// module is used by every frontend.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initials, characters } from "../../src/lib/initials.ts";

const loneSurrogate = (s) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

test("#240 AC-1: extension-B Han characters, combining accents and emoji are never cut", () => {
  assert.equal(initials("李𠮷"), "李𠮷");
  assert.equal(initials("𠮷田"), "𠮷田");
  assert.equal(initials("émile"), "ÉM", "the accent stays with its letter");
  assert.equal(initials("👩‍💻 Dev"), "👩‍💻D", "a ZWJ emoji is one character");
  assert.equal(initials("Ana 👋🏽"), "A👋🏽", "a skin-tone emoji is one character");
  for (const name of ["李𠮷", "𠮷田", "👩‍💻 Dev", "𝒜lice Bob", "😀😀😀"]) assert.ok(!loneSurrogate(initials(name)), name);
});

test("#240 AC-2: words give their first characters; a name without spaces gives its first two", () => {
  assert.equal(initials("Mai Tran"), "MT");
  assert.equal(initials("José María López"), "JM");
  assert.equal(initials("陈立"), "陈立");
  assert.equal(initials("欧阳娜娜"), "欧阳");
  assert.equal(initials("محمد علي"), "مع");
  assert.equal(initials("alice"), "AL");
});

test("#240 AC-3: empty names give the fallback; without Intl.Segmenter code points are used, still never half a pair", () => {
  assert.equal(initials(""), "?");
  assert.equal(initials("   "), "?");
  assert.equal(initials(null), "?");
  assert.equal(initials(undefined, "--"), "--");
  const Segmenter = Intl.Segmenter;
  try {
    delete Intl.Segmenter;
    assert.equal(initials("李𠮷"), "李𠮷");
    assert.ok(!loneSurrogate(initials("😀😀😀")));
    assert.deepEqual(characters("a𠮷b"), ["a", "𠮷", "b"]);
  } finally {
    Intl.Segmenter = Segmenter;
  }
  const name = "李𠮷";
  initials(name);
  assert.equal(name, "李𠮷", "the name itself is untouched");
});

test("#240 AC-2: every frontend uses the same module", () => {
  const read = (path) => readFileSync(new URL(`../../../../${path}/src/lib/initials.ts`, import.meta.url), "utf8");
  const here = read("hireos-screening/hireos-screening-front");
  for (const front of ["hireos-identity/hireos-identity-front", "hireos-jd/hireos-jd-front", "hireos-interview/job-Interview-front", "hireos-written/hireos-written-front"]) {
    assert.equal(read(front), here, front);
  }
});
