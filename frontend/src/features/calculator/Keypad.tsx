import { KEYS } from './keys';
import type { InputAction, BinaryOp } from './keypadReducer';

interface KeypadProps {
  onAction: (action: InputAction) => void;
  operator: BinaryOp | null;
  overwrite: boolean;
}

export function Keypad({ onAction, operator, overwrite }: KeypadProps) {
  return (
    <div className="keypad" aria-label="Calculator keys">
      {KEYS.map((key) => (
        <button
          key={key.id}
          type="button"
          className={`key key-${key.kind}${key.span ? ` key-${key.span}` : ''}`}
          aria-label={key.ariaLabel}
          aria-pressed={key.action.type === 'operator' ? operator === key.action.op && overwrite : undefined}
          onClick={() => onAction(key.action)}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
