// An invalid request body is a 422 INVALID_SCHEMA (Core Record's shape) with the offending fields, not a bare 500.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const { ZodExceptionFilter } = require('../dist/http/zod-exception.filter');

test('a ZodError from request validation becomes 422 INVALID_SCHEMA in Core Record\'s shape', () => {
  const schema = z.object({ text: z.string().min(1), items: z.array(z.string()) }).strict();
  const result = schema.safeParse({ text: '', items: [1], extra: true });
  let status; let body;
  const host = { switchToHttp: () => ({ getResponse: () => ({ status: (code) => { status = code; return { json: (b) => { body = b; } }; } }) }) };
  new ZodExceptionFilter().catch(result.error, host);
  assert.equal(status, 422);
  assert.equal(body.code, 'INVALID_SCHEMA'); assert.equal(body.retryable, false); assert.equal(body.responsibleModule, 'jd');
  assert.deepEqual(body.fieldPaths.sort(), ['', 'items.0', 'text'].sort());
  assert.ok(body.details.fieldErrors.text);
});
