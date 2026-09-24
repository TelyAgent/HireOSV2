import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';

@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    response.status(422).json({
      code: 'INVALID_SCHEMA',
      message: 'Request validation failed.',
      retryable: false,
      fieldPaths: exception.issues.map((issue) => issue.path.join('.')),
      responsibleModule: 'core-record',
      suggestedAction: 'Fix the request fields and retry.',
      details: exception.flatten(),
    });
  }
}
