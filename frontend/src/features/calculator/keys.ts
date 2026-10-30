import type { Action } from './keypadReducer';

interface KeyDefinition {
  id: string;
  label: string;
  ariaLabel: string;
  kind: 'digit' | 'op' | 'fn' | 'equals';
  action: Action;
  span?: 'wide' | 'tall';
}

export const KEYS: readonly KeyDefinition[] = [
  { id: 'clear', label: 'AC', ariaLabel: 'All clear', kind: 'fn', action: { type: 'clear' } },
  { id: 'backspace', label: '⌫', ariaLabel: 'Backspace', kind: 'fn', action: { type: 'backspace' } },
  { id: 'percentage', label: '%', ariaLabel: 'Percent of', kind: 'op', action: { type: 'operator', op: 'percentage' } },
  { id: 'divide', label: '÷', ariaLabel: 'Divide', kind: 'op', action: { type: 'operator', op: 'divide' } },
  { id: 'sqrt', label: '√x', ariaLabel: 'Square root', kind: 'fn', action: { type: 'sqrt' } },
  { id: 'power', label: 'xʸ', ariaLabel: 'Power', kind: 'fn', action: { type: 'operator', op: 'power' } },
  { id: 'sign', label: '±', ariaLabel: 'Toggle sign', kind: 'fn', action: { type: 'toggleSign' } },
  { id: 'multiply', label: '×', ariaLabel: 'Multiply', kind: 'op', action: { type: 'operator', op: 'multiply' } },
  { id: '7', label: '7', ariaLabel: '7', kind: 'digit', action: { type: 'digit', digit: '7' } },
  { id: '8', label: '8', ariaLabel: '8', kind: 'digit', action: { type: 'digit', digit: '8' } },
  { id: '9', label: '9', ariaLabel: '9', kind: 'digit', action: { type: 'digit', digit: '9' } },
  { id: 'subtract', label: '−', ariaLabel: 'Subtract', kind: 'op', action: { type: 'operator', op: 'subtract' } },
  { id: '4', label: '4', ariaLabel: '4', kind: 'digit', action: { type: 'digit', digit: '4' } },
  { id: '5', label: '5', ariaLabel: '5', kind: 'digit', action: { type: 'digit', digit: '5' } },
  { id: '6', label: '6', ariaLabel: '6', kind: 'digit', action: { type: 'digit', digit: '6' } },
  { id: 'add', label: '+', ariaLabel: 'Add', kind: 'op', action: { type: 'operator', op: 'add' } },
  { id: '1', label: '1', ariaLabel: '1', kind: 'digit', action: { type: 'digit', digit: '1' } },
  { id: '2', label: '2', ariaLabel: '2', kind: 'digit', action: { type: 'digit', digit: '2' } },
  { id: '3', label: '3', ariaLabel: '3', kind: 'digit', action: { type: 'digit', digit: '3' } },
  { id: 'equals', label: '=', ariaLabel: 'Equals', kind: 'equals', action: { type: 'equals' }, span: 'tall' },
  { id: '0', label: '0', ariaLabel: '0', kind: 'digit', action: { type: 'digit', digit: '0' }, span: 'wide' },
  { id: 'decimal', label: '.', ariaLabel: 'Decimal point', kind: 'digit', action: { type: 'decimal' } },
];

export function keyboardAction(key: string): Action | null {
  if (/^\d$/.test(key)) return { type: 'digit', digit: key };
  switch (key) {
    case '.': case ',': return { type: 'decimal' };
    case '+': return { type: 'operator', op: 'add' };
    case '-': return { type: 'operator', op: 'subtract' };
    case '*': case 'x': return { type: 'operator', op: 'multiply' };
    case '/': return { type: 'operator', op: 'divide' };
    case '^': return { type: 'operator', op: 'power' };
    case '%': return { type: 'operator', op: 'percentage' };
    case 'Enter': case '=': return { type: 'equals' };
    case 'Backspace': return { type: 'backspace' };
    case 'Escape': case 'Delete': return { type: 'clear' };
    case 'r': return { type: 'sqrt' };
    default: return null;
  }
}
