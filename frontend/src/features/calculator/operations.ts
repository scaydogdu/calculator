import type { Operation } from '../../api/calculator';

export interface OperationInfo {
  id: Operation;
  label: string;
  symbol: string;
  arity: 1 | 2;
}

export const OPERATIONS: readonly OperationInfo[] = [
  { id: 'add', label: 'Add', symbol: '+', arity: 2 },
  { id: 'subtract', label: 'Subtract', symbol: '−', arity: 2 },
  { id: 'multiply', label: 'Multiply', symbol: '×', arity: 2 },
  { id: 'divide', label: 'Divide', symbol: '÷', arity: 2 },
  { id: 'power', label: 'Power', symbol: '^', arity: 2 },
  { id: 'sqrt', label: 'Square root', symbol: '√', arity: 1 },
  { id: 'percentage', label: 'Percent of', symbol: '%', arity: 2 },
];

export function getOperation(id: Operation): OperationInfo {
  const info = OPERATIONS.find((o) => o.id === id);
  if (!info) throw new Error(`Unknown operation: ${id}`);
  return info;
}
