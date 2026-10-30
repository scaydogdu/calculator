import type { Operation } from '../../api/calculator';
import { getOperation } from './operations';

// Twelve significant digits hide float noise such as 0.1 + 0.2 = 0.30000000000000004.
export function formatNumber(n: number): string {
  return Number.isInteger(n) && Math.abs(n) < 1e15 ? String(n) : String(Number(n.toPrecision(12)));
}

export function formatExpression(operation: Operation, operands: number[], result: number): string {
  const [x, y] = operands.map(formatNumber);
  const r = formatNumber(result);
  switch (operation) {
    case 'sqrt':
      return `√${x} = ${r}`;
    case 'percentage':
      return `${x}% of ${y} = ${r}`;
    default:
      return `${x} ${getOperation(operation).symbol} ${y} = ${r}`;
  }
}
