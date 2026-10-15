import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';

/**
 * Request bodies are validated with zod `schema.parse(raw)` throughout this service; without this
 * filter an invalid body surfaced as a bare 500. Every ZodError that reaches here is a request
 * validation failure -- parses of AI output are all caught inside their services and reported as
 * LLM_INVALID_OUTPUT. Same 422 INVALID_SCHEMA shape as hireos-core-record's ZodExceptionFilter, so
 * a validation error reads the same whichever HireOS service rejected it.
 */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    response.status(422).json({
      code: 'INVALID_SCHEMA',
      message: 'Request validation failed.',
      retryable: false,
      fieldPaths: exception.issues.map((issue) => issue.path.join('.')),
      responsibleModule: 'jd',
      suggestedAction: 'Fix the request fields and retry.',
      details: exception.flatten(),
    });
  }
}
