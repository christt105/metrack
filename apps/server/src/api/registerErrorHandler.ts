import type { FastifyError, FastifyInstance } from 'fastify';
import type { ApiErrorBody } from '@metrack/domain';
import type { Logger } from '../notify/Logger.js';
import { HttpError } from '../http/HttpError.js';
import { ApiError } from './ApiError.js';

interface Failure {
  status: number;
  body: ApiErrorBody;
}

function describe(error: unknown): Failure {
  if (error instanceof ApiError) {
    const body: ApiErrorBody = { error: error.message, code: error.code };
    if (error.details !== undefined) body.details = error.details;
    return { status: error.status, body };
  }
  if (error instanceof HttpError) {
    const missing = error.status === 404;
    return {
      status: missing ? 404 : 502,
      body: {
        error: error.message,
        code: missing ? 'provider_not_found' : 'provider_error',
      },
    };
  }
  if (error instanceof TypeError && error.message === 'fetch failed') {
    return { status: 502, body: { error: 'The provider is unreachable', code: 'provider_error' } };
  }
  const failure = error as FastifyError & { errcode?: number };
  if (failure.validation) {
    return {
      status: 400,
      body: { error: failure.message, code: 'validation_error', details: failure.validation },
    };
  }
  if (failure.code === 'ERR_SQLITE_ERROR') {
    if (failure.message.includes('UNIQUE constraint failed')) {
      return {
        status: 409,
        body: { error: 'Another record already has that unique value', code: 'conflict' },
      };
    }
    if (failure.message.includes('FOREIGN KEY constraint failed')) {
      return {
        status: 400,
        body: { error: 'The referenced record does not exist', code: 'invalid_reference' },
      };
    }
  }
  if (failure.statusCode && failure.statusCode >= 400 && failure.statusCode < 500) {
    return { status: failure.statusCode, body: { error: failure.message, code: 'bad_request' } };
  }
  return { status: 500, body: { error: 'Internal server error', code: 'internal_error' } };
}

/**
 * Answers every failure under `/api` with the same `{ error, code, details? }` body, and logs the
 * failures that are the server's fault.
 */
export function registerErrorHandler(app: FastifyInstance, logger?: Logger): void {
  app.setErrorHandler((error, request, reply) => {
    const { status, body } = describe(error);
    if (status >= 500 && logger) {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      logger.error(`${request.method} ${request.url} failed with ${status}: ${detail}`);
    }
    return reply.code(status).send(body);
  });
}
