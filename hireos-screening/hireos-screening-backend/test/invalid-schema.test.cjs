// Request validation failures use the platform's 422 INVALID_SCHEMA shape (hireos-core-record's).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const { invalidSchemaFromZod, invalidSchemaFromClassValidator } = require('../dist/http/invalid-schema');

test('a zod failure becomes 422 INVALID_SCHEMA with dotted field paths', () => {
  const result = z.object({ jd: z.object({ text: z.string().min(1) }), ids: z.array(z.string()) }).strict().safeParse({ jd: { text: '' }, ids: [1], extra: 1 });
  const error = invalidSchemaFromZod(result.error);
  const body = error.getResponse();
  assert.equal(error.getStatus(), 422);
  assert.equal(body.code, 'INVALID_SCHEMA'); assert.equal(body.retryable, false); assert.equal(body.responsibleModule, 'screening');
  assert.deepEqual(body.fieldPaths.sort(), ['', 'ids.0', 'jd.text'].sort());
  assert.ok(body.details.fieldErrors['jd.text'].length); assert.ok(body.details.formErrors.length, 'unknown keys are a form-level error');
});

test('class-validator errors (ValidationPipe) flatten nested properties the same way', () => {
  const error = invalidSchemaFromClassValidator([
    { property: 'email', constraints: { isEmail: 'email must be an email' } },
    { property: 'answers', children: [{ property: '0', children: [{ property: 'text', constraints: { isString: 'text must be a string' } }] }] },
  ]);
  const body = error.getResponse();
  assert.equal(error.getStatus(), 422);
  assert.deepEqual(body.fieldPaths, ['email', 'answers.0.text']);
  assert.deepEqual(body.details.fieldErrors['answers.0.text'], ['text must be a string']);
});
