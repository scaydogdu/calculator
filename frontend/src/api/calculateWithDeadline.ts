import { ApiError, type CalculateFn, type Operation } from './calculator';

const REQUEST_TIMEOUT_MS = 20_000;

// Settle even if a transport ignores AbortSignal, and retain the abort reason.
export async function calculateWithDeadline(
  calculate: CalculateFn,
  operation: Operation,
  operands: number[],
  querySignal: AbortSignal,
) {
  const deadline = new AbortController();
  const signal = AbortSignal.any([querySignal, deadline.signal]);
  signal.throwIfAborted();
  let onAbort!: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  const timer = setTimeout(() => {
    deadline.abort(new ApiError('request_timeout', 'The calculator service took too long. Try again.', 0));
  }, REQUEST_TIMEOUT_MS);
  try {
    return await Promise.race([calculate(operation, operands, signal), interrupted]);
  } catch (error) {
    // Some transports reject with a generic AbortError on deadline expiry.
    if (signal.aborted) throw signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
