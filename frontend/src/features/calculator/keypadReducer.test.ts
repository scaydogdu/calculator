import { describe, expect, it } from 'vitest';
import { initialState, keypadReducer, type Action } from './keypadReducer';
import type { BinaryOp } from '../../api/calculator';

const digit = (digit: string): Action => ({ type: 'digit', digit });
const op = (op: BinaryOp): Action => ({ type: 'operator', op });
const equals: Action = { type: 'equals' };
const resolved = (result: number): Action => ({ type: 'resolved', result });
const failed: Action = { type: 'failed', message: 'Service unavailable' };
const decimal: Action = { type: 'decimal' };
const backspace: Action = { type: 'backspace' };
const sign: Action = { type: 'toggleSign' };
const clear: Action = { type: 'clear' };
const sqrt: Action = { type: 'sqrt' };
const apply = (...actions: Action[]) => actions.reduce(keypadReducer, initialState);
const digits = (text: string) => [...text].map(digit);
const sum = () => apply(digit('2'), op('add'), digit('3'), equals, resolved(5));

describe('expression input', () => {
  it('records every operand and operator without evaluating until Equals', () => {
    const state = apply(digit('2'), op('add'), digit('3'), op('multiply'), digit('4'));
    expect(state).toMatchObject({ operands: [2, 3], operators: ['add', 'multiply'], entry: '4', expression: '2 + 3 × 4', pending: null });
    const pending = keypadReducer(state, equals);
    expect(pending.pending).toEqual({ request: { operands: [2, 3, 4], operators: ['add', 'multiply'] }, label: '2 + 3 × 4', target: 'expression' });
    expect(keypadReducer(pending, resolved(14))).toMatchObject({ entry: '14', value: 14, expression: '2 + 3 × 4 =', operators: [], operands: [], pending: null });
  });
  it('replaces an unfilled operator, ignoring incomplete Equals', () => {
    const state = apply(digit('2'), op('add'), op('multiply'));
    expect(state).toMatchObject({ operands: [2], operators: ['multiply'], expression: '2 ×', pending: null });
    expect(keypadReducer(state, equals)).toEqual(state);
    expect(apply(digit('2'), equals).pending).toBeNull();
  });
  it('sends power chains intact and renders percentage as percent of', () => {
    expect(apply(digit('2'), op('power'), digit('3'), op('power'), digit('2'), equals).pending?.request)
      .toEqual({ operands: [2, 3, 2], operators: ['power', 'power'] });
    expect(apply(...digits('15'), op('percentage'), ...digits('200'), equals).expression).toBe('15 % of 200');
  });
  it('uses raw results when continuing, changing sign or taking square root', () => {
    const raw = 1 / 3;
    const result = apply(digit('1'), op('divide'), digit('3'), equals, resolved(raw));
    expect(result.entry).toBe('0.333333333333');
    expect([sign, op('multiply'), digit('3'), equals].reduce(keypadReducer, result).pending?.request)
      .toEqual({ operands: [-raw, 3], operators: ['multiply'] });
    expect(keypadReducer(result, sqrt).pending?.request).toEqual({ operation: 'sqrt', operands: [raw] });
  });
  it('shows signed operands in parentheses and updates a selected operand', () => {
    const state = apply(digit('5'), op('add'), sign);
    expect(state).toMatchObject({ operands: [-5], expression: '(-5) +', entry: '-5' });
    expect(keypadReducer(state, sign).expression).toBe('5 +');
    expect([op('multiply'), digit('2'), equals].reduce(keypadReducer, state).pending?.request)
      .toEqual({ operands: [-5, 2], operators: ['multiply'] });
  });
});

describe('entry editing and recovery', () => {
  it('handles decimals, signs, backspace and leading zeros', () => {
    expect(apply(decimal, digit('5')).entry).toBe('0.5');
    expect(apply(digit('1'), decimal, decimal, digit('2')).entry).toBe('1.2');
    expect(apply(digit('0'), digit('0'), digit('7')).entry).toBe('7');
    expect(apply(...digits('123'), backspace).entry).toBe('12');
    expect(apply(digit('5'), backspace, backspace).entry).toBe('0');
    expect(apply(digit('5'), sign, backspace).entry).toBe('0');
    expect(apply(digit('0'), sign).entry).toBe('0');
    expect(apply(digit('5'), sign, sign).entry).toBe('5');
    expect(apply(decimal, digit('0'), sign, digit('5')).entry).toBe('-0.05');
    expect(apply(decimal, sign, sign, digit('5')).entry).toBe('0.5');
  });
  it('limits input to fifteen digits and rejects non-digits', () => {
    expect(apply(...digits('9999999999999999')).entry).toBe('999999999999999');
    expect(apply(digit('x'))).toEqual(initialState);
  });
  it('protects computed numbers from editing and starts fresh on a digit or decimal', () => {
    const state = apply(digit('1'), op('power'), digit('2'), equals, resolved(1e21), sign);
    expect(keypadReducer(state, backspace).entry).toBe('-1e+21');
    expect(keypadReducer(state, digit('7'))).toMatchObject({ entry: '7', expression: '', value: null });
    expect([decimal, digit('5')].reduce(keypadReducer, sum())).toMatchObject({ entry: '0.5', value: null });
    expect(apply(digit('9'), op('add'), decimal, digit('5')).expression).toBe('9 + 0.5');
  });
  it('clears all states and ignores input or late settlement while appropriate', () => {
    const pending = apply(digit('2'), op('add'), digit('3'), equals);
    for (const action of [digit('9'), decimal, backspace, sign, op('multiply'), sqrt, equals])
      expect(keypadReducer(pending, action)).toEqual(pending);
    const error = keypadReducer(pending, failed);
    expect(error).toMatchObject({ expression: '2 + 3', entry: '3', error: 'Service unavailable', pending: null, operators: [] });
    expect(keypadReducer(error, digit('7'))).toMatchObject({ entry: '7', error: null, expression: '' });
    for (const state of [initialState, pending, error, sum(), apply(digit('7'))])
      expect(keypadReducer(state, clear)).toEqual(initialState);
    expect(apply(resolved(5))).toEqual(initialState);
    expect(apply(failed)).toEqual(initialState);
  });
});

describe('square root applies to the current operand', () => {
  it('requests standalone square roots, including domain failures', () => {
    const state = apply(digit('9'), sqrt);
    expect(state.pending).toEqual({ request: { operation: 'sqrt', operands: [9] }, label: '√9', target: 'operand' });
    expect(keypadReducer(state, resolved(3))).toMatchObject({ entry: '3', expression: '√9 =', value: 3, pending: null });
    expect(apply(digit('4'), sign, sqrt).expression).toBe('√(-4)');
  });
  it('preserves the whole expression when transforming its current operand', () => {
    const pending = apply(digit('9'), op('add'), ...digits('16'), sqrt);
    expect(pending.expression).toBe('9 + √16');
    const state = keypadReducer(pending, resolved(4));
    expect(state.expression).toBe('9 + √16 =');
    expect([op('multiply'), digit('2'), equals].reduce(keypadReducer, state).pending?.request)
      .toEqual({ operands: [9, 4, 2], operators: ['add', 'multiply'] });
  });
  it('preserves raw unary precision on Equals and sign changes', () => {
    const state = apply(digit('9'), op('add'), digit('2'), sqrt, resolved(Math.SQRT2), sign);
    expect(state.expression).toBe('9 + (-1.41421356237)');
    expect(keypadReducer(state, equals).pending?.request).toEqual({ operands: [9, -Math.SQRT2], operators: ['add'] });
  });
  it('replaces a unary result on input and protects it from backspace', () => {
    const state = apply(digit('9'), op('add'), ...digits('16'), sqrt, resolved(4));
    expect(keypadReducer(state, backspace)).toEqual(state);
    expect(keypadReducer(state, digit('5'))).toMatchObject({ entry: '5', expression: '9 + 5', value: null });
    expect([decimal, digit('5'), equals].reduce(keypadReducer, state).pending?.request)
      .toEqual({ operands: [9, 0.5], operators: ['add'] });
  });
  it('transforms the selected operand without discarding its operator', () => {
    const state = apply(digit('9'), op('add'), sqrt, resolved(3));
    expect(state).toMatchObject({ operands: [3], expression: '3 +', entry: '3', overwrite: true });
    expect([digit('2'), equals].reduce(keypadReducer, state).pending?.request).toEqual({ operands: [3, 2], operators: ['add'] });
  });
});

// Literal acceptance fixtures: no frontend arithmetic or result oracle.
describe('keypad acceptance K1–K26 with expression precedence', () => {
  const cases = [
    { name: 'K1 initial state', actions: [], want: { entry: '0', expression: '', pending: null, error: null } },
    { name: 'K2 addition', actions: [digit('2'), op('add'), digit('3'), equals, resolved(5)], want: { entry: '5', expression: '2 + 3 =' } },
    { name: 'K3 chain remains unevaluated until Equals', actions: [digit('2'), op('add'), digit('3'), op('multiply'), digit('4'), equals], request: { operands: [2, 3, 4], operators: ['add', 'multiply'] }, want: { expression: '2 + 3 × 4' } },
    { name: 'K4 operator replacement', actions: [digit('2'), op('add'), op('multiply')], want: { operands: [2], operators: ['multiply'], pending: null } },
    { name: 'K5 incomplete Equals', actions: [digit('2'), op('add'), equals], want: { entry: '2', expression: '2 +', pending: null } },
    { name: 'K6 square root', actions: [digit('9'), sqrt], request: { operation: 'sqrt', operands: [9] }, want: { expression: '√9' } },
    { name: 'K7 percent of', actions: [...digits('15'), op('percentage'), ...digits('200'), equals], request: { operands: [15, 200], operators: ['percentage'] }, want: { expression: '15 % of 200' } },
    { name: 'K8 power', actions: [digit('2'), op('power'), ...digits('10'), equals], request: { operands: [2, 10], operators: ['power'] }, want: { expression: '2 ^ 10' } },
    { name: 'K9 retain failing expression', actions: [digit('1'), op('divide'), digit('0'), equals, failed], want: { entry: '0', expression: '1 ÷ 0', error: 'Service unavailable', pending: null } },
    { name: 'K10 new digit after error', actions: [digit('1'), op('divide'), digit('0'), equals, failed, digit('7')], want: { entry: '7', expression: '', error: null } },
    { name: 'K11 fractional entry', actions: [decimal, digit('5')], want: { entry: '0.5' } },
    { name: 'K12 duplicate decimal', actions: [digit('1'), decimal, decimal, digit('2')], want: { entry: '1.2' } },
    { name: 'K13 leading zeros', actions: [digit('0'), digit('0'), digit('7')], want: { entry: '7' } },
    { name: 'K14 backspace', actions: [...digits('123'), backspace], want: { entry: '12' } },
    { name: 'K15 deleting the last digit', actions: [digit('5'), backspace, backspace], want: { entry: '0' } },
    { name: 'K16 result backspace protection', actions: [digit('2'), op('add'), digit('3'), equals, resolved(5), backspace], want: { entry: '5', value: 5, expression: '2 + 3 =' } },
    { name: 'K17 sign toggle', actions: [digit('5'), sign, sign], want: { entry: '5' } },
    { name: 'K18 fifteen digit limit', actions: [...digits('1234567890123456')], want: { entry: '123456789012345' } },
    { name: 'K19 digit starts fresh after result', actions: [digit('2'), op('add'), digit('3'), equals, resolved(5), digit('7')], want: { entry: '7', expression: '', operands: [], operators: [] } },
    { name: 'K20 continue from result', actions: [digit('2'), op('add'), digit('3'), equals, resolved(5), op('multiply'), digit('2'), equals], request: { operands: [5, 2], operators: ['multiply'] }, want: { expression: '5 × 2' } },
    { name: 'K21 AC during request', actions: [digit('2'), op('add'), digit('3'), equals, clear], want: initialState },
    { name: 'K22 late settlement after AC', actions: [digit('2'), op('add'), digit('3'), equals, clear, resolved(5), failed], want: initialState },
    { name: 'K23 network error preserves current operand', actions: [digit('2'), op('add'), digit('3'), equals, failed], want: { entry: '3', expression: '2 + 3', error: 'Service unavailable' } },
    { name: 'K24 negative square root reaches server', actions: [digit('4'), sign, sqrt], request: { operation: 'sqrt', operands: [-4] }, want: { expression: '√(-4)' } },
    { name: 'K25 overflowing power reaches server', actions: [digit('2'), op('power'), ...digits('1024'), equals], request: { operands: [2, 1024], operators: ['power'] }, want: { expression: '2 ^ 1024' } },
    { name: 'K26 retain raw floating point result', actions: [decimal, digit('1'), op('add'), decimal, digit('2'), equals, resolved(0.30000000000000004)], want: { entry: '0.3', value: 0.30000000000000004, expression: '0.1 + 0.2 =' } },
  ];
  it.each(cases)('$name', ({ actions, want, ...test }) => {
    const state = apply(...actions);
    expect(state).toMatchObject(want);
    if ('request' in test) expect(state.pending?.request).toEqual(test.request);
  });
});
