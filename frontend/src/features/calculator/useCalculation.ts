import { skipToken, useQuery } from '@tanstack/react-query';
import { ApiError, type CalculateFn } from '../../api/calculator';
import { calculateWithDeadline } from '../../api/calculateWithDeadline';
import type { KeypadState } from './keypadReducer';

export function useCalculation(pending: KeypadState['pending'], calculate: CalculateFn) {
  return useQuery({
    queryKey: ['calculator', pending?.operation ?? null, pending?.operands ?? []],
    queryFn: pending
      ? ({ signal }) => calculateWithDeadline(calculate, pending.operation, pending.operands, signal)
      : skipToken,
    // Results are deterministic; retain them until the normal inactive-cache GC.
    staleTime: Infinity,
    // Domain errors, malformed replies and deadlines need user input, not retries.
    retry: (failureCount, error) => failureCount < 1 && error instanceof ApiError &&
      (error.code === 'network_error' || error.status >= 500),
    retryDelay: 500,
  });
}
