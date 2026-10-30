export type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'sqrt' | 'percentage';

export interface CalculateResponse {
  operation: Operation;
  operands: number[];
  result: number;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export type CalculateFn = (operation: Operation, operands: number[], signal?: AbortSignal) => Promise<CalculateResponse>;

export const calculate: CalculateFn = async (operation, operands, signal) => {
  let response: Response;
  try {
    response = await fetch('/api/v1/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, operands }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError('network_error', 'Could not reach the calculator service.', 0);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ErrorBody | null)?.error;
    throw new ApiError(
      error?.code ?? 'unknown_error',
      error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
    );
  }
  return body as CalculateResponse;
};
