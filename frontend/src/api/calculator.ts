export type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'sqrt' | 'percentage';

export type BinaryOp = Exclude<Operation, 'sqrt'>;
export type Calculation = { operation: Operation; operands: number[] } | { operands: number[]; operators: BinaryOp[] };
export interface CalculateResponse { result: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

export type CalculateFn = (request: Calculation, signal?: AbortSignal) => Promise<CalculateResponse>;

export const calculate: CalculateFn = async (request, signal) => {
  let response: Response;
  try {
    response = await fetch('operators' in request ? '/api/v1/evaluate' : '/api/v1/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError('network_error', 'Could not reach the calculator service.', 0);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    throw new ApiError(
      typeof error?.code === 'string' ? error.code : 'unknown_error',
      typeof error?.message === 'string' ? error.message : `Request failed with status ${response.status}.`,
      response.status,
    );
  }
  if (!isRecord(body) || typeof body.result !== 'number' || !Number.isFinite(body.result)) {
    throw new ApiError('invalid_response', 'The calculator service sent an invalid response. Try again.', response.status);
  }
  return { result: body.result };
};
