export type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'sqrt' | 'percentage';

export interface CalculateResponse {
  operation: Operation;
  operands: number[];
  result: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCalculateResponse(value: unknown, operation: Operation, operands: number[]): value is CalculateResponse {
  return isRecord(value) && value.operation === operation &&
    Array.isArray(value.operands) && value.operands.length === operands.length &&
    value.operands.every((operand, index) => typeof operand === 'number' && Number.isFinite(operand) && operand === operands[index]) &&
    typeof value.result === 'number' && Number.isFinite(value.result);
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
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    throw new ApiError(
      typeof error?.code === 'string' ? error.code : 'unknown_error',
      typeof error?.message === 'string' ? error.message : `Request failed with status ${response.status}.`,
      response.status,
    );
  }
  if (!isCalculateResponse(body, operation, operands)) {
    throw new ApiError('invalid_response', 'The calculator service sent an invalid response. Try again.', response.status);
  }
  return body;
};
