import { describe, expect, it } from 'vitest';
import { initialState, keypadReducer, type Action, type KeypadState } from './keypadReducer';

const digit = (value: string): Action => ({ type: 'digit', digit: value });
const op = (value: 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'percentage'): Action => ({ type: 'operator', op: value });
const equals: Action = { type: 'equals' };
const resolved = (result: number): Action => ({ type: 'resolved', result });
const failed = (message: string): Action => ({ type: 'failed', message });
const decimal: Action = { type: 'decimal' };
const backspace: Action = { type: 'backspace' };
const sign: Action = { type: 'toggleSign' };
const clear: Action = { type: 'clear' };
const sqrt: Action = { type: 'sqrt' };
const apply = (...actions: Action[]): KeypadState => actions.reduce(keypadReducer, initialState);
const digits = (text: string): Action[] => [...text].map(digit);
const sum = (): KeypadState => apply(digit('2'), op('add'), digit('3'), equals, resolved(5));
const zeroDivision = (): KeypadState => apply(digit('1'), op('divide'), digit('0'), equals, failed("You can't divide by zero."));

// Expected requests/results are literal fixtures from the acceptance table;
// this helper only checks the recorded request, never computes arithmetic.
function request(state: KeypadState, operation: string, operands: number[], label: string, then: string | null = null) {
  expect(state.pending).toEqual({ operation, operands, label, then });
}

describe('keypad acceptance K1–K26', () => {
  it('K1: starts at zero without an expression, error or request', () => {
    expect(initialState).toEqual({ entry: '0', left: null, operator: null, expression: '', overwrite: false, error: null, pending: null });
  });
  it('K2: records addition and displays the backend result', () => {
    const state = apply(digit('2'), op('add'), digit('3'), equals);
    request(state, 'add', [2, 3], '2 + 3');
    expect(keypadReducer(state, resolved(5))).toMatchObject({ expression: '2 + 3 =', entry: '5', pending: null });
  });
  it('K3: chains left to right using the returned result as the next operand', () => {
    const first = apply(digit('2'), op('add'), digit('3'), op('multiply'));
    request(first, 'add', [2, 3], '2 + 3', 'multiply');
    const chained = keypadReducer(first, resolved(5));
    expect(chained).toMatchObject({ expression: '5 ×', entry: '5', left: 5, operator: 'multiply', overwrite: true });
    const next = [digit('4'), equals].reduce(keypadReducer, chained);
    request(next, 'multiply', [5, 4], '5 × 4');
    expect(keypadReducer(next, resolved(20))).toMatchObject({ expression: '5 × 4 =', entry: '20' });
  });
  it('K4: replaces an operator before the second operand without a request', () => {
    expect(apply(digit('2'), op('add'), op('multiply'))).toMatchObject({ expression: '2 ×', entry: '2', operator: 'multiply', pending: null });
  });
  it('K5: ignores equals without a second operand', () => {
    const state = apply(digit('2'), op('add'));
    expect(keypadReducer(state, equals)).toEqual(state);
  });
  it('K6: requests square root of the displayed number', () => {
    const state = apply(digit('9'), sqrt);
    request(state, 'sqrt', [9], '√9');
    expect(keypadReducer(state, resolved(3))).toMatchObject({ expression: '√9 =', entry: '3' });
  });
  it('K7: defines percentage as the first operand percent of the second', () => {
    const state = apply(...digits('15'), op('percentage'), ...digits('200'), equals);
    request(state, 'percentage', [15, 200], '15% of 200');
    expect(keypadReducer(state, resolved(30))).toMatchObject({ expression: '15% of 200 =', entry: '30' });
  });
  it('K8: requests exponentiation', () => {
    const state = apply(digit('2'), op('power'), ...digits('10'), equals);
    request(state, 'power', [2, 10], '2 ^ 10');
    expect(keypadReducer(state, resolved(1024))).toMatchObject({ expression: '2 ^ 10 =', entry: '1024' });
  });
  it('K9: keeps the failing expression and operand with the supplied error copy', () => {
    const state = apply(digit('1'), op('divide'), digit('0'), equals);
    request(state, 'divide', [1, 0], '1 ÷ 0');
    expect(keypadReducer(state, failed("You can't divide by zero."))).toMatchObject({ expression: '1 ÷ 0', entry: '0', error: "You can't divide by zero.", pending: null, overwrite: true });
  });
  it('K10: a digit after an error starts clean', () => {
    expect(keypadReducer(zeroDivision(), digit('7'))).toMatchObject({ expression: '', entry: '7', error: null, operator: null, left: null, pending: null });
  });
  it('K11: starts a fractional entry with zero', () => {
    expect(apply(decimal, digit('5')).entry).toBe('0.5');
  });
  it('K12: ignores a second decimal point', () => {
    expect(apply(digit('1'), decimal, decimal, digit('2')).entry).toBe('1.2');
  });
  it('K13: prevents leading zeros', () => {
    expect(apply(digit('0'), digit('0'), digit('7')).entry).toBe('7');
  });
  it('K14: removes the last entered digit', () => {
    expect(apply(...digits('123'), backspace).entry).toBe('12');
  });
  it('K15: keeps zero when deleting the last digit or deleting again', () => {
    expect(apply(digit('5'), backspace, backspace).entry).toBe('0');
  });
  it('K16: does not edit a completed result with backspace', () => {
    expect(keypadReducer(sum(), backspace)).toMatchObject({ expression: '2 + 3 =', entry: '5' });
  });
  it('K17: toggles the sign and keeps zero unsigned', () => {
    expect(apply(digit('5'), sign).entry).toBe('-5');
    expect(apply(digit('0'), sign).entry).toBe('0');
    expect(apply(digit('5'), sign, sign).entry).toBe('5');
  });
  it('K18: limits manual entry to fifteen digits', () => {
    expect(apply(...digits('9999999999999999')).entry).toBe('999999999999999');
  });
  it('K19: typing after a result starts a new calculation', () => {
    expect(keypadReducer(sum(), digit('7'))).toMatchObject({ expression: '', entry: '7', left: null, operator: null, pending: null });
  });
  it('K20: uses a previous result as the next first operand', () => {
    const state = [op('multiply'), digit('2'), equals].reduce(keypadReducer, sum());
    request(state, 'multiply', [5, 2], '5 × 2');
    expect(keypadReducer(state, resolved(10))).toMatchObject({ expression: '5 × 2 =', entry: '10' });
  });
  it('K21: AC resets initial, editing, operator, pending, result and error states', () => {
    const states = [initialState, apply(...digits('123')), apply(digit('2'), op('add')), apply(digit('2'), op('add'), digit('3'), equals), sum(), zeroDivision()];
    for (const state of states) expect(keypadReducer(state, clear)).toEqual(initialState);
  });
  it('K22: ignores input during a request and ignores late settlement after AC', () => {
    const state = apply(digit('2'), op('add'), digit('3'), equals);
    for (const action of [digit('9'), decimal, backspace, sign, op('multiply'), sqrt, equals]) {
      expect(keypadReducer(state, action)).toEqual(state);
    }
    const cleared = keypadReducer(state, clear);
    expect(keypadReducer(cleared, resolved(5))).toEqual(initialState);
    expect(keypadReducer(cleared, failed('late failure'))).toEqual(initialState);
  });
  it('K23: retains the operand and expression on network failure', () => {
    const state = apply(digit('2'), op('add'), digit('3'), equals);
    expect(keypadReducer(state, failed("Couldn't reach the calculator service. Try again."))).toMatchObject({ expression: '2 + 3', entry: '3', error: "Couldn't reach the calculator service. Try again.", pending: null });
  });
  it('K24: sends negative square roots to the backend and shows its mapped error', () => {
    const state = apply(digit('4'), sign, sqrt);
    request(state, 'sqrt', [-4], '√-4');
    expect(keypadReducer(state, failed('Square root needs a number of 0 or more.'))).toMatchObject({ expression: '√-4', entry: '-4', error: 'Square root needs a number of 0 or more.' });
  });
  it('K25: sends power overflow to the backend and shows its mapped error', () => {
    const state = apply(digit('2'), op('power'), ...digits('1024'), equals);
    request(state, 'power', [2, 1024], '2 ^ 1024');
    expect(keypadReducer(state, failed('That result is too large to show.'))).toMatchObject({ expression: '2 ^ 1024', entry: '1024', error: 'That result is too large to show.' });
  });
  it('K26: formats raw floating point results to twelve significant digits', () => {
    const state = apply(digit('0'), decimal, digit('1'), op('add'), digit('0'), decimal, digit('2'), equals);
    request(state, 'add', [0.1, 0.2], '0.1 + 0.2');
    expect(keypadReducer(state, resolved(0.30000000000000004))).toMatchObject({ expression: '0.1 + 0.2 =', entry: '0.3' });
  });
});

describe('formatted result editing', () => {
  it('keeps a signed scientific result protected from digit/backspace edits', () => {
    const state = apply(...digits('10'), op('power'), ...digits('21'), equals, resolved(1e21), sign, backspace);
    expect(state.entry).toBe('-1e+21');
    expect(keypadReducer(state, digit('7'))).toMatchObject({ entry: '7', expression: '', pending: null });
  });
});

describe('continuation preserves backend precision and sign', () => {
  it('uses the raw result both after Equals and during direct chaining', () => {
    const afterEquals = apply(digit('1'), op('divide'), digit('3'), equals, resolved(0.3333333333333333));
    expect(afterEquals.entry).toBe('0.333333333333');
    const continued = [op('multiply'), digit('3'), equals].reduce(keypadReducer, afterEquals);
    const chained = apply(digit('1'), op('divide'), digit('3'), op('multiply'), resolved(0.3333333333333333), digit('3'), equals);
    request(continued, 'multiply', [0.3333333333333333, 3], '0.333333333333 × 3');
    request(chained, 'multiply', [0.3333333333333333, 3], '0.333333333333 × 3');
    expect(keypadReducer(continued, resolved(1)).entry).toBe('1');
    expect(keypadReducer(chained, resolved(1)).entry).toBe('1');
  });
  it('uses a raw result for a following square root', () => {
    const state = apply(digit('1'), op('divide'), digit('3'), equals, resolved(0.3333333333333333), sqrt);
    request(state, 'sqrt', [0.3333333333333333], '√0.333333333333');
  });
  it('sign changes keep the selected first operand and expression consistent', () => {
    const signed = apply(digit('5'), op('add'), sign);
    expect(signed).toMatchObject({ entry: '-5', left: -5, expression: '-5 +', overwrite: true });
    expect(keypadReducer(signed, sign)).toMatchObject({ entry: '5', left: 5, expression: '5 +' });
    const state = [op('multiply'), digit('2'), equals].reduce(keypadReducer, signed);
    request(state, 'multiply', [-5, 2], '-5 × 2');
  });
  it('sign changes on a result retain raw precision for the next request', () => {
    const state = apply(digit('1'), op('divide'), digit('3'), equals, resolved(0.3333333333333333), sign, op('multiply'), digit('3'), equals);
    request(state, 'multiply', [-0.3333333333333333, 3], '-0.333333333333 × 3');
  });
  it('a fresh decimal entry discards the previous cached result', () => {
    const state = [decimal, digit('5'), op('add'), digit('1'), equals].reduce(keypadReducer, sum());
    request(state, 'add', [0.5, 1], '0.5 + 1');
  });
});

describe('unary operands inside binary expressions', () => {
  it('resumes a sum after square root of its second operand', () => {
    const state = apply(digit('9'), op('add'), ...digits('16'), sqrt, resolved(4), equals);
    request(state, 'add', [9, 4], '9 + 4');
    expect(keypadReducer(state, resolved(13)).entry).toBe('13');
  });
  it('keeps the unrounded unary result as the second operand', () => {
    const state = apply(digit('1'), op('add'), digit('2'), sqrt, resolved(1.4142135623730951), equals);
    request(state, 'add', [1, 1.4142135623730951], '1 + 1.41421356237');
  });
  it('can chain a new operator after transforming the second operand', () => {
    const state = apply(digit('9'), op('add'), ...digits('16'), sqrt, resolved(4), op('multiply'));
    request(state, 'add', [9, 4], '9 + 4', 'multiply');
  });
  it('new digits replace a unary result and backspace does not edit it', () => {
    const state = apply(digit('9'), op('add'), ...digits('16'), sqrt, resolved(4), backspace, digit('5'), equals);
    request(state, 'add', [9, 5], '9 + 5');
  });
  it('updates the cached unary operand on sign changes', () => {
    const state = apply(digit('9'), op('add'), digit('2'), sqrt, resolved(1.4142135623730951), sign, equals);
    request(state, 'add', [9, -1.4142135623730951], '9 + -1.41421356237');
  });
  it('transforms a selected first operand without dropping its operator', () => {
    const state = apply(digit('9'), op('add'), sqrt, resolved(3), digit('2'), equals);
    request(state, 'add', [3, 2], '3 + 2');
  });
  it('keeps decimal zero text through sign changes', () => {
    expect(apply(digit('0'), decimal, digit('0'), sign, digit('5')).entry).toBe('-0.05');
    expect(apply(decimal, sign, sign, digit('5')).entry).toBe('0.5');
  });
});

describe('unary continuation display', () => {
  it('keeps the sum visible while the unary request is pending', () => {
    const state = apply(digit('9'), op('add'), ...digits('16'), sqrt);
    expect(state.expression).toBe('9 + √16');
  });
  it('updates the operand expression after changing a resumed unary result sign', () => {
    const state = apply(digit('9'), op('add'), ...digits('16'), sqrt, resolved(4), sign);
    expect(state.expression).toBe('9 + -4');
  });
});

describe('replacing a resumed unary operand', () => {
  it('removes the completed unary expression when a new digit replaces its value', () => {
    const state = apply(digit('9'), op('add'), ...digits('16'), sqrt, resolved(4), digit('5'));
    expect(state).toMatchObject({ entry: '5', expression: '9 +' });
  });
  it('removes the completed unary expression when a decimal starts a replacement value', () => {
    const state = apply(digit('9'), op('add'), ...digits('16'), sqrt, resolved(4), decimal, digit('5'));
    expect(state).toMatchObject({ entry: '0.5', expression: '9 +' });
  });
});
