import { useCallback, useEffect, useReducer } from 'react';
import { ApiError, calculate as apiCalculate, type CalculateFn } from '../../api/calculator';
import { Display } from './Display';
import { Keypad } from './Keypad';
import { keyboardAction } from './keys';
import { initialState, keypadReducer, type Action } from './keypadReducer';
import { useCalculation } from './useCalculation';

const ERROR_COPY = new Map<string, string>([
  ['invalid_response', 'The calculator service sent an invalid response. Try again.'],
  ['division_by_zero', "You can't divide by zero."],
  ['negative_sqrt', 'Square root needs a number of 0 or more.'],
  ['network_error', "Couldn't reach the calculator service. Try again."],
]);

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'result_out_of_range') {
    return error.message && error.message !== 'result is not a finite number'
      ? error.message : 'This calculation has no finite real result.';
  }
  if (error instanceof ApiError) return ERROR_COPY.get(error.code) ?? (error.message || 'Something went wrong. Try again.');
  return 'Something went wrong. Try again.';
}

interface CalculatorProps {
  calculate?: CalculateFn;
}

export function Calculator({ calculate = apiCalculate }: CalculatorProps) {
  const [state, dispatch] = useReducer(keypadReducer, initialState);
  const { run, reset } = useCalculation(calculate);
  const { pending } = state;

  const send = useCallback((action: Action) => {
    if (action.type === 'clear') reset();
    dispatch(action);
  }, [reset]);

  useEffect(() => {
    if (!pending) return;
    void run(pending.operation, pending.operands).then((outcome) => {
      // Aborted requests produce no outcome, including after AC or unmount.
      if (!outcome) return;
      if (outcome.status === 'success') dispatch({ type: 'resolved', result: outcome.result.result });
      else dispatch({ type: 'failed', message: errorMessage(outcome.error) });
    });
  }, [pending, run]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey) return;
      if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement) return;
      const action = keyboardAction(event.key);
      if (!action) return;
      event.preventDefault();
      send(action);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [send]);

  return (
    <section className="calculator" aria-label="Calculator" aria-busy={pending !== null}>
      <Display expression={state.expression} entry={state.entry} error={state.error} busy={pending !== null} />
      <Keypad onAction={send} operator={state.operator} overwrite={state.overwrite} busy={pending !== null} />
    </section>
  );
}
