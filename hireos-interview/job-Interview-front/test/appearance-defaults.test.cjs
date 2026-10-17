const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const storeSource = fs.readFileSync(path.join(__dirname, '../src/store/StoreContext.tsx'), 'utf8');
const initialStateSource = fs.readFileSync(path.join(__dirname, '../src/store/initialState.ts'), 'utf8');

test('#295: appearance defaults stay Light + Blue + Medium', () => {
  assert.match(initialStateSource, /theme: "light",\n\s+accent: "blue",\n\s+textSize: "medium"/);
  assert.match(storeSource, /case "RESET_PREFS"[\s\S]*?theme: "light",\n\s+accent: "blue",\n\s+textSize: "medium"/);
  assert.match(storeSource, /accent: p\.accent \|\| "blue"/);
  assert.match(storeSource, /Appearance reset to Light, Blue, Medium\./);
  assert.match(storeSource, /外观已重置为浅色、蓝色和中等字号。/);
});
