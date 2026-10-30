import { describe, expect, it } from 'vitest';
import { parseOperand, validateInputs } from './validation';

describe('parseOperand', () => {
  it.each([
    ['42', 42], ['-3.5', -3.5], ['+7', 7], ['.5', 0.5], ['5.', 5], ['1e3', 1000], ['  8  ', 8],
  ])('accepts %j', (raw, value) => {
    expect(parseOperand(raw)).toEqual({ ok: true, value });
  });

  it('asks for a number when empty', () => {
    expect(parseOperand('   ')).toEqual({ ok: false, error: 'Enter a number.' });
  });

  it.each(['abc', '1,5', '0x10', '1e', '--1', 'Infinity', '1e999'])('rejects %j', (raw) => {
    expect(parseOperand(raw)).toEqual({ ok: false, error: 'Not a valid number.' });
  });
});

describe('validateInputs', () => {
  it('returns both operands for binary operations', () => {
    expect(validateInputs(2, '2', '3')).toEqual({ ok: true, operands: [2, 3] });
  });

  it('ignores the second input for unary operations', () => {
    expect(validateInputs(1, '9', 'junk')).toEqual({ ok: true, operands: [9] });
  });

  it('reports an error per field', () => {
    expect(validateInputs(2, 'x', '')).toEqual({
      ok: false,
      errors: { a: 'Not a valid number.', b: 'Enter a number.' },
    });
  });
});
