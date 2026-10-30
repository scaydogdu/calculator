import { describe, expect, it } from 'vitest';
import { formatExpression, formatNumber } from './format';

describe('formatNumber', () => {
  it.each([
    [5, '5'], [0.1 + 0.2, '0.3'], [1 / 3, '0.333333333333'], [-2.5, '-2.5'], [1e21, '1e+21'], [1.2345678901234568e29, '1.23456789012e+29'],
  ])('formats %d as %s', (n, s) => {
    expect(formatNumber(n)).toBe(s);
  });
});

describe('formatExpression', () => {
  it('formats binary operations with their symbol', () => {
    expect(formatExpression('divide', [12, 4], 3)).toBe('12 ÷ 4 = 3');
  });
  it('formats sqrt', () => {
    expect(formatExpression('sqrt', [16], 4)).toBe('√16 = 4');
  });
  it('formats percentage', () => {
    expect(formatExpression('percentage', [15, 200], 30)).toBe('15% of 200 = 30');
  });
});
