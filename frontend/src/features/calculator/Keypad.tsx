import { KEYS } from './keys';
import type { Action, BinaryOp } from './keypadReducer';

interface KeypadProps {
  onAction: (action: Action) => void;
  operator: BinaryOp | null;
  overwrite: boolean;
  busy: boolean;
}

export function Keypad({ onAction, operator, overwrite, busy }: KeypadProps) {
  return (
    <div className="keypad" aria-label="Calculator keys">
      {KEYS.map((key) => (
        <button
          key={key.id}
          type="button"
          className={`key key-${key.kind}${key.span ? ` key-${key.span}` : ''}`}
          aria-label={key.ariaLabel}
          aria-pressed={key.action.type === 'operator' ? operator === key.action.op && overwrite : undefined}
          aria-disabled={busy && key.action.type !== 'clear' ? true : undefined}
          onClick={() => onAction(key.action)}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
