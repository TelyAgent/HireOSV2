// Run from hireos-screening-backend after `npm run build`: node scripts/gen-profile-fields-fixture.cjs
// Writes the candidate API's profileFields for the F02 samples, for the frontend's display and rendering tests
// (#155 AC-3). The backend test `profile-fields.test.cjs` fails when the written file and the API's output differ.
const fs = require('fs');
const path = require('path');
const { profileFieldsFixture, FIXTURE_PATH } = require(path.join(process.cwd(), 'test/fixtures/f02/profile-fields-fixture.cjs'));
(async () => {
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(await profileFieldsFixture(), null, 2) + '\n');
  console.log('wrote', FIXTURE_PATH);
})();
