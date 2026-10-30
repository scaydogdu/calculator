import { describe, expect, it } from 'vitest';
import { OPERATIONS, getOperation } from './operations';

describe('operations', () => {
  it('covers every backend operation once', () => {
    expect(OPERATIONS.map((o) => o.id)).toEqual(['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt', 'percentage']);
  });

  it('marks sqrt as unary and the rest as binary', () => {
    expect(getOperation('sqrt').arity).toBe(1);
    expect(OPERATIONS.filter((o) => o.arity === 2)).toHaveLength(6);
  });
});
