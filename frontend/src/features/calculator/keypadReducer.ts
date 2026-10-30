import type { Operation } from '../../api/calculator';
import { formatNumber } from './format';
import { getOperation } from './operations';

export type BinaryOp = Exclude<Operation, 'sqrt'>;

export interface KeypadState {
  entry: string;
  right?: number; // Unrounded unary result used as the current second operand.
  left: number | null; // Raw backend result retained for continuation, or the selected first operand.
  operator: BinaryOp | null;
  expression: string;
  overwrite: boolean;
  error: string | null;
  pending: { operation: Operation; operands: number[]; label: string; then: BinaryOp | null } | null;
}

export type Action =
  | { type: 'digit'; digit: string } | { type: 'decimal' } | { type: 'backspace' }
  | { type: 'toggleSign' } | { type: 'clear' } | { type: 'operator'; op: BinaryOp }
  | { type: 'sqrt' } | { type: 'equals' }
  | { type: 'resolved'; result: number } | { type: 'failed'; message: string };

export const initialState: KeypadState = {
  entry: '0', left: null, operator: null, expression: '', overwrite: false, error: null, pending: null,
};

function operatorLabel(left: number, operation: BinaryOp): string {
  return operation === 'percentage' ? `${formatNumber(left)}% of` : `${formatNumber(left)} ${getOperation(operation).symbol}`;
}

function currentValue(state: KeypadState): number {
  return state.right ?? (state.overwrite && state.left !== null ? state.left : Number(state.entry));
}

function inputExpression(state: KeypadState): string {
  if (state.right !== undefined && state.operator && state.left !== null) return operatorLabel(state.left, state.operator);
  return state.overwrite && !state.operator ? '' : state.expression;
}

function binaryRequest(state: KeypadState, then: BinaryOp | null): KeypadState {
  if (state.left === null || state.operator === null || state.overwrite) return state;
  const right = state.right ?? Number(state.entry);
  const label = `${operatorLabel(state.left, state.operator)} ${formatNumber(right)}`;
  return { ...state, error: null, expression: label, pending: { operation: state.operator, operands: [state.left, right], label, then } };
}

// Pure input transitions only. Every arithmetic operation is a pending API request.
export function keypadReducer(state: KeypadState, action: Action): KeypadState {
  if (state.pending && action.type !== 'clear' && action.type !== 'resolved' && action.type !== 'failed') return state;

  switch (action.type) {
    case 'clear':
      return initialState;
    case 'digit': {
      if (!/^\d$/.test(action.digit)) return state;
      const entry = state.overwrite || state.right !== undefined ? '0' : state.entry;
      if (entry.replace(/\D/g, '').length >= 15) return state;
      return {
        ...state,
        entry: entry === '0' ? action.digit : entry + action.digit,
        right: undefined,
        left: state.overwrite && !state.operator ? null : state.left,
        expression: inputExpression(state),
        overwrite: false,
        error: null,
      };
    }
    case 'decimal': {
      const entry = state.overwrite || state.right !== undefined ? '0' : state.entry;
      if (entry.includes('.')) return state;
      return { ...state, right: undefined, entry: entry + '.', left: state.overwrite && !state.operator ? null : state.left, expression: inputExpression(state), overwrite: false, error: null };
    }
    case 'backspace': {
      if (state.overwrite || state.right !== undefined) return state;
      const entry = state.entry.slice(0, -1);
      return { ...state, entry: entry === '' || entry === '-' || entry === '-0' ? '0' : entry };
    }
    case 'toggleSign':
      if (state.right !== undefined) {
        const right = state.right === 0 ? 0 : -state.right;
        return { ...state, right, entry: formatNumber(right), error: null,
          expression: state.operator && state.left !== null ? `${operatorLabel(state.left, state.operator)} ${formatNumber(right)}` : state.expression };
      }
      if (state.overwrite && state.left !== null) {
        // Sign toggling edits an operand; preserve its raw precision and result protection.
        const left = state.left === 0 ? 0 : -state.left;
        return { ...state, left, entry: formatNumber(left), expression: state.operator ? operatorLabel(left, state.operator) : '', error: null };
      }
      return {
        ...state,
        entry: state.entry === '0' ? '0' : state.entry.startsWith('-') ? state.entry.slice(1) : '-' + state.entry,
        expression: inputExpression(state),
        overwrite: state.overwrite,
        error: null,
      };
    case 'operator': {
      if (state.operator && !state.overwrite) return binaryRequest(state, action.op);
      const left = currentValue(state);
      return { ...state, left, operator: action.op, expression: operatorLabel(left, action.op), overwrite: true, error: null };
    }
    case 'sqrt': {
      const operand = currentValue(state);
      const label = `√${formatNumber(operand)}`;
      return { ...state, expression: state.operator && state.left !== null && !state.overwrite
        ? `${operatorLabel(state.left, state.operator)} ${label}` : label, error: null, pending: { operation: 'sqrt', operands: [operand], label, then: null } };
    }
    case 'equals':
      return binaryRequest(state, null);
    case 'resolved': {
      if (!state.pending) return state;
      if (state.pending.operation === 'sqrt' && state.operator && state.left !== null) {
        if (state.overwrite) {
          return { ...state, entry: formatNumber(action.result), left: action.result, right: undefined,
            expression: operatorLabel(action.result, state.operator), pending: null, error: null };
        }
        return { ...state, entry: formatNumber(action.result), right: action.result,
          expression: `${operatorLabel(state.left, state.operator)} ${state.pending.label} =`, pending: null, error: null };
      }
      const next = state.pending.then;
      return {
        entry: formatNumber(action.result),
        left: action.result,
        operator: next,
        expression: next ? operatorLabel(action.result, next) : `${state.pending.label} =`,
        overwrite: true,
        error: null,
        pending: null,
      };
    }
    case 'failed':
      if (!state.pending) return state;
      return { ...state, right: undefined, left: null, operator: null, expression: state.pending.label, overwrite: true, error: action.message, pending: null };
  }
}
