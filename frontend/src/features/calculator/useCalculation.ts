import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type CalculateFn, type CalculateResponse, type Operation } from '../../api/calculator';

export type CalculationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: CalculateResponse }
  | { status: 'error'; message: string };

export function useCalculation(calculate: CalculateFn) {
  const [state, setState] = useState<CalculationState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(
    async (operation: Operation, operands: number[]) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ status: 'loading' });
      try {
        const result = await calculate(operation, operands, controller.signal);
        if (controller.signal.aborted) return;
        setState({ status: 'success', result });
        return { status: 'success' as const, result };
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
        });
        return { status: 'error' as const, error: err };
      }
    },
    [calculate],
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState({ status: 'idle' });
  }, []);

  return { state, run, reset };
}
