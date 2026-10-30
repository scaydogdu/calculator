import { useCallback, useEffect, useRef } from 'react';
import type { CalculateFn, Operation } from '../../api/calculator';

// The reducer owns UI state; this hook only owns each request's lifetime.
export function useCalculation(calculate: CalculateFn) {
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(async (operation: Operation, operands: number[]) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await calculate(operation, operands, controller.signal);
      if (!controller.signal.aborted) return { status: 'success' as const, result };
    } catch (error) {
      if (!controller.signal.aborted) return { status: 'error' as const, error };
    }
  }, [calculate]);

  const reset = useCallback(() => controllerRef.current?.abort(), []);
  return { run, reset };
}
