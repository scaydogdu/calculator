import { useCallback, useEffect, useRef } from 'react';
import { ApiError, type CalculateFn, type Operation } from '../../api/calculator';

const REQUEST_TIMEOUT_MS = 20_000;

// The reducer owns UI state; this hook only owns each request's lifetime.
export function useCalculation(calculate: CalculateFn) {
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(async (operation: Operation, operands: number[]) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    let timedOut = false;
    const timeoutError = new ApiError('request_timeout', 'The calculator service took too long. Try again.', 0);
    let onAbort!: () => void;
    const interrupted = new Promise<never>((_, reject) => {
      onAbort = () => reject(timeoutError);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
      // Racing also releases this request if a transport ignores its abort signal.
      const result = await Promise.race([calculate(operation, operands, controller.signal), interrupted]);
      if (!controller.signal.aborted) return { status: 'success' as const, result };
    } catch (error) {
      if (timedOut) return { status: 'error' as const, error: timeoutError };
      if (!controller.signal.aborted) return { status: 'error' as const, error };
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', onAbort);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [calculate]);

  const reset = useCallback(() => controllerRef.current?.abort(), []);
  return { run, reset };
}
