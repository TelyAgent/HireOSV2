const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const storeSource = fs.readFileSync(path.join(__dirname, '../src/store/StoreContext.tsx'), 'utf8');
const initialStateSource = fs.readFileSync(path.join(__dirname, '../src/store/initialState.ts'), 'utf8');
const modalSource = fs.readFileSync(path.join(__dirname, '../src/components/AppearanceModal.tsx'), 'utf8');
const stylesSource = fs.readFileSync(path.join(__dirname, '../src/index.css'), 'utf8');
const reviewSource = fs.readFileSync(path.join(__dirname, '../src/pages/project/ReviewPage.tsx'), 'utf8');

test('#295: appearance defaults stay Light + Blue + Medium', () => {
  assert.match(initialStateSource, /theme: "light",\n\s+accent: "blue",\n\s+textSize: "medium"/);
  assert.match(storeSource, /case "RESET_PREFS"[\s\S]*?theme: "light",\n\s+accent: "blue",\n\s+textSize: "medium"/);
  assert.match(storeSource, /accent: p\.accent \|\| "blue"/);
  assert.match(storeSource, /Appearance reset to Light, Blue, Medium\./);
  assert.match(storeSource, /外观已重置为浅色、蓝色和中等字号。/);
});

test('#291: the portal dialog receives theme tokens and readable controls', () => {
  assert.match(modalSource, /className=\{`appearance-modal appearance-\$\{state\.textSize\}`\}/);
  assert.match(stylesSource, /\.appearance-modal \.ant-modal-content[\s\S]*?background: var\(--surface\) !important/);
  assert.match(stylesSource, /\.appearance-modal \.ant-radio-button-wrapper[\s\S]*?color: var\(--ink-2\) !important/);
  assert.match(stylesSource, /\.appearance-modal \.ant-radio-button-wrapper-checked[^\{]*\{[\s\S]*?color: var\(--brand\) !important/);
});

test('#288: Unknown scores explain the missing evidence and are not presented as zero', () => {
  assert.match(reviewSource, /score == null/);
  assert.match(reviewSource, /Unknown is not zero\./);
  assert.match(reviewSource, /There is not enough human evidence to score this requirement yet\./);
  assert.match(reviewSource, /entry\.card\.expectedEvidence/);
});
