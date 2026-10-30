import type { BinaryOp, Calculation } from '../../api/calculator';
import { formatNumber } from './format';
import { getOperation } from './operations';
export type { BinaryOp } from '../../api/calculator';

interface Pending {
  request: Calculation;
  label: string;
  target: 'expression' | 'operand' | 'selected';
}
export interface KeypadState {
  entry: string;
  value: number | null; // Raw backend result for the current operand.
  operands: number[]; // Committed operands preceding the editable entry.
  operators: BinaryOp[];
  expression: string;
  overwrite: boolean;
  error: string | null;
  pending: Pending | null;
}
export type Action =
  | { type: 'digit'; digit: string } | { type: 'decimal' } | { type: 'backspace' }
  | { type: 'toggleSign' } | { type: 'clear' } | { type: 'operator'; op: BinaryOp }
  | { type: 'sqrt' } | { type: 'equals' }
  | { type: 'resolved'; result: number } | { type: 'failed'; message: string };
export const initialState: KeypadState = {
  entry: '0', value: null, operands: [], operators: [], expression: '', overwrite: false, error: null, pending: null,
};
function operandLabel(n: number): string {
  const value = formatNumber(n);
  return n < 0 ? `(${value})` : value;
}
function prefix(operands: number[], operators: BinaryOp[]): string {
  return operands.map((value, index) => `${operandLabel(value)} ${operators[index] === 'percentage' ? '% of' : getOperation(operators[index]).symbol}`).join(' ');
}
function currentValue(state: KeypadState): number { return state.value ?? Number(state.entry); }
function edit(state: KeypadState, entry: string): KeypadState {
  return { ...state, entry, value: null, overwrite: false, error: null,
    expression: state.operators.length ? `${prefix(state.operands, state.operators)} ${entry.startsWith('-') ? `(${entry})` : entry}` : '' };
}

// This reducer records input and backend requests; it never evaluates an expression.
export function keypadReducer(state: KeypadState, action: Action): KeypadState {
  if (state.pending && !['clear', 'resolved', 'failed'].includes(action.type)) return state;
  switch (action.type) {
    case 'clear': return initialState;
    case 'digit': {
      if (!/^\d$/.test(action.digit)) return state;
      const entry = state.overwrite || state.value !== null ? '0' : state.entry;
      if (entry.replace(/\D/g, '').length >= 15) return state;
      return edit(state, entry === '0' ? action.digit : entry + action.digit);
    }
    case 'decimal': {
      const entry = state.overwrite || state.value !== null ? '0' : state.entry;
      return entry.includes('.') ? state : edit(state, entry + '.');
    }
    case 'backspace': {
      if (state.overwrite || state.value !== null) return state;
      const entry = state.entry.slice(0, -1);
      return edit(state, ['', '-', '-0'].includes(entry) ? '0' : entry);
    }
    case 'toggleSign': {
      if (state.overwrite && state.operators.length) {
        const value = -currentValue(state);
        const operands = [...state.operands.slice(0, -1), value];
        return { ...state, operands, entry: formatNumber(value), value, expression: prefix(operands, state.operators), error: null };
      }
      if (state.value !== null) {
        const value = -state.value;
        return { ...state, entry: formatNumber(value), value, error: null,
          expression: state.operators.length ? `${prefix(state.operands, state.operators)} ${operandLabel(value)}` : '' };
      }
      return edit(state, state.entry === '0' ? '0' : state.entry.startsWith('-') ? state.entry.slice(1) : '-' + state.entry);
    }
    case 'operator': {
      const replacing = state.overwrite && state.operators.length > 0;
      const operands = replacing ? state.operands : [...state.operands, currentValue(state)];
      const operators = replacing ? [...state.operators.slice(0, -1), action.op] : [...state.operators, action.op];
      return { ...state, operands, operators, expression: prefix(operands, operators), overwrite: true, error: null };
    }
    case 'equals': {
      if (!state.operators.length || state.overwrite) return state;
      const value = currentValue(state);
      const label = `${prefix(state.operands, state.operators)} ${operandLabel(value)}`;
      return { ...state, expression: label, pending: {
        request: { operands: [...state.operands, value], operators: state.operators }, label, target: 'expression',
      } };
    }
    case 'sqrt': {
      const value = currentValue(state);
      const selected = state.overwrite && state.operators.length > 0;
      const label = `√${operandLabel(value)}`;
      return { ...state, error: null, expression: state.operators.length && !selected ? `${prefix(state.operands, state.operators)} ${label}` : label,
        pending: { request: { operation: 'sqrt', operands: [value] }, label, target: selected ? 'selected' : 'operand' } };
    }
    case 'resolved': {
      if (!state.pending) return state;
      const value = action.result;
      const entry = formatNumber(value);
      if (state.pending.target === 'expression') {
        return { ...initialState, entry, value, overwrite: true, expression: `${state.pending.label} =` };
      }
      if (state.pending.target === 'selected') {
        const operands = [...state.operands.slice(0, -1), value];
        return { ...state, operands, entry, value, pending: null, expression: prefix(operands, state.operators) };
      }
      return { ...state, entry, value, overwrite: false, pending: null,
        expression: `${state.operators.length ? prefix(state.operands, state.operators) + ' ' : ''}${state.pending.label} =` };
    }
    case 'failed':
      return state.pending ? { ...initialState, entry: state.entry, expression: state.expression, overwrite: true, error: action.message } : state;
  }
}
