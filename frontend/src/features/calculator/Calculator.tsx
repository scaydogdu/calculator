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
      <Display expression={state.expression} entry={state.entry} error={state.error} busy={busy} />
      <Keypad onAction={send} operator={state.operators.at(-1) ?? null} overwrite={state.overwrite} busy={busy} />
    </section>
  );
}
