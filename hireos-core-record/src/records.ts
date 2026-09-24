import { createHash } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Identity } from './auth/workspace.guard';

export type RequestMeta = {
  requestId?: string;
  correlationId?: string;
  idempotencyKey?: string;
};

export function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function requestHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function requireIdempotency(meta: RequestMeta) {
  if (!meta.idempotencyKey?.trim()) {
    throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  }
  return meta.idempotencyKey.trim();
}

export async function findIdempotent(
  tx: Prisma.TransactionClient,
  identity: Identity,
  operation: string,
  meta: RequestMeta,
  input: unknown,
) {
  const key = requireIdempotency(meta);
  const hash = requestHash(input);
  const prior = await tx.idempotencyKey.findUnique({
    where: { workspaceId_operation_key: { workspaceId: identity.workspaceId, operation, key } },
  });
  if (!prior) return { key, hash, prior: null as null };
  if (prior.requestHash !== hash) {
    throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
  }
  return { key, hash, prior };
}

export async function storeIdempotency(
  tx: Prisma.TransactionClient,
  identity: Identity,
  operation: string,
  key: string,
  hash: string,
  responseBody: unknown,
  responseStatus = 201,
) {
  await tx.idempotencyKey.create({
    data: {
      workspaceId: identity.workspaceId,
      operation,
      key,
      requestHash: hash,
      responseStatus,
      responseBody: json(responseBody),
    },
  });
}

export function parseVersion(value: string | undefined) {
  if (!value) return undefined;
  const version = Number(value);
  return Number.isInteger(version) && version > 0 ? version : undefined;
}

export function assertVersion(expected: number | undefined, current: number) {
  if (expected !== undefined && expected !== current) {
    throw new ConflictException({
      code: 'VERSION_CONFLICT',
      message: `The record has changed since it was read. Current version is ${current}.`,
    });
  }
}

export function notFound() {
  throw new NotFoundException({ code: 'NOT_FOUND' });
}
