import { UnprocessableEntityException } from '@nestjs/common';
import type { ZodError } from 'zod';

const MODULE = 'interview';

/**
 * A request that fails schema validation, in the same 422 INVALID_SCHEMA shape hireos-core-record
 * (and hireos-jd) use, so a validation error reads the same whichever HireOS service rejected it.
 * Only for checks on what the caller sent -- business-rule refusals keep their own codes, and a
 * parse of stored or AI data that fails is a server error, not this.
 */
export function invalidSchema(fieldErrors: Record<string, string[]>, formErrors: string[] = []) {
  return new UnprocessableEntityException({
    code: 'INVALID_SCHEMA',
    message: 'Request validation failed.',
    retryable: false,
    fieldPaths: [...(formErrors.length ? [''] : []), ...Object.keys(fieldErrors)],
    responsibleModule: MODULE,
    suggestedAction: 'Fix the request fields and retry.',
    details: { formErrors, fieldErrors },
  });
}

export function invalidSchemaFromZod(error: ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];
  for (const issue of error.issues) {
    if (!issue.path.length) { formErrors.push(issue.message); continue; }
    const path = issue.path.join('.');
    (fieldErrors[path] ||= []).push(issue.message);
  }
  return invalidSchema(fieldErrors, formErrors);
}

type ClassValidatorError = { property: string; constraints?: Record<string, string>; children?: ClassValidatorError[] };

/** For the global ValidationPipe (class-validator DTOs): nested errors flatten to dotted field paths. */
export function invalidSchemaFromClassValidator(errors: ClassValidatorError[]) {
  const fieldErrors: Record<string, string[]> = {};
  const walk = (list: ClassValidatorError[], prefix: string) => {
    for (const error of list) {
      const path = prefix ? `${prefix}.${error.property}` : error.property;
      if (error.constraints) (fieldErrors[path] ||= []).push(...Object.values(error.constraints));
      if (error.children?.length) walk(error.children, path);
    }
  };
  walk(errors, '');
  return invalidSchema(fieldErrors);
}
