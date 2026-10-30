import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, type CalculateFn, type Operation } from '../../api/calculator';
import { calculateWithDeadline } from '../../api/calculateWithDeadline';

// The reducer owns keypad state; Query owns request results and errors.
export function useCalculation(calculate: CalculateFn) {
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const { mutateAsync, reset: resetMutation } = useMutation({
    mutationKey: ['calculator', 'calculate'],
    retry: false,
    // Attempt immediately even when the browser reports offline, so the
    // network error/deadline can release the keypad instead of pausing it.
    networkMode: 'always',
    gcTime: 0,
    mutationFn: ({ operation, operands, controller }: {
      operation: Operation;
      operands: number[];
      controller: AbortController;
    }) => calculateWithDeadline(calculate, operation, operands, controller),
  });

  const run = useCallback(async (operation: Operation, operands: number[]) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await mutateAsync({ operation, operands, controller });
      if (!controller.signal.aborted) return { status: 'success' as const, result };
    } catch (error) {
      if (controllerRef.current === controller &&
        (!controller.signal.aborted || (error instanceof ApiError && error.code === 'request_timeout'))) {
        return { status: 'error' as const, error };
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [mutateAsync]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    resetMutation();
  }, [resetMutation]);
  return { run, reset };
}
