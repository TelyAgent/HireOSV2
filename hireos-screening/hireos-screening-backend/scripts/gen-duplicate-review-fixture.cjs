// Run from hireos-screening-backend after `npm run build`: node scripts/gen-duplicate-review-fixture.cjs
// Writes the duplicate review API's answer for the frontend's rendering test (#151 AC-3). The backend test
// `identity-scoring.test.cjs` fails when the written file and the API's current answer differ.
const fs = require('fs');
const path = require('path');
const { reviewResponse } = require(path.join(process.cwd(), 'test/fixtures/f03/review-check.cjs'));
(async () => {
  const target = path.join(process.cwd(), '../hireos-screening-front/test/unit/fixtures/duplicate-review.json');
  fs.writeFileSync(target, JSON.stringify(await reviewResponse(), null, 2) + '\n');
  console.log('wrote', target);
})();
