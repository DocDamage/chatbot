export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const error = candidate.error;
  return candidate.success === false
    && !!error
    && typeof error === 'object'
    && typeof (error as Record<string, unknown>).message === 'string'
    && typeof (error as Record<string, unknown>).code === 'string';
}

export async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (isApiErrorResponse(body)) {
    throw new ApiClientError(
      body.error.message,
      response.status,
      body.error.code,
      body.error.details
    );
  }

  throw new ApiClientError(fallbackMessage, response.status, `HTTP_${response.status}`);
}
