import { describe, expect, it } from 'vitest';
import { isApiErrorResponse, throwApiError } from './errors';

describe('API error parsing', () => {
  it('recognizes the shared server error schema', () => {
    expect(isApiErrorResponse({
      success: false,
      error: { message: 'No token', code: 'AUTHENTICATION_ERROR' },
    })).toBe(true);
  });

  it('throws typed client errors from API error responses', async () => {
    const response = new Response(JSON.stringify({
      success: false,
      error: {
        message: 'q is required',
        code: 'BAD_REQUEST',
        details: { field: 'q' },
      },
    }), { status: 400 });

    await expect(throwApiError(response, 'fallback')).rejects.toMatchObject({
      name: 'ApiClientError',
      message: 'q is required',
      status: 400,
      code: 'BAD_REQUEST',
      details: { field: 'q' },
    });
  });

  it.each([
    [400, 'BAD_REQUEST', 'q is required'],
    [401, 'AUTHENTICATION_ERROR', 'No authentication token provided'],
    [403, 'AUTHORIZATION_ERROR', 'Insufficient permissions'],
    [500, 'INTERNAL_ERROR', 'Unexpected server error'],
  ])('preserves structured %i route errors without exposing details in the display message', async (status, code, message) => {
    const response = new Response(JSON.stringify({
      success: false,
      error: {
        message,
        code,
        details: { secret: 'server-only-token' },
      },
    }), { status });

    await expect(throwApiError(response, 'fallback')).rejects.toMatchObject({
      message,
      status,
      code,
      details: { secret: 'server-only-token' },
    });
  });
});
