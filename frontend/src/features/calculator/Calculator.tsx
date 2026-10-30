import { useEffect } from 'react';
import { calculate as apiCalculate, type CalculateFn } from '../../api/calculator';
import { Display } from './Display';
import { Keypad } from './Keypad';
import { keyboardAction } from './keys';
import { useCalculator } from './useCalculator';

export function Calculator({ calculate = apiCalculate }: { calculate?: CalculateFn }) {
  const { state, send } = useCalculator(calculate);
  const busy = state.pending !== null;

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
    <section className="calculator" aria-label="Calculator" aria-busy={busy}>
      <p className="evaluation-mode">Evaluates left to right · 2 + 3 × 4 = 20</p>
      <Display expression={state.expression} entry={state.entry} error={state.error} busy={busy} />
      <Keypad onAction={send} operator={state.operator} overwrite={state.overwrite} busy={busy} />
    </section>
  );
}
