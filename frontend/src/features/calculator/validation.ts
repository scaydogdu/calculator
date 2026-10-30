export type ParseResult = { ok: true; value: number } | { ok: false; error: string };
export type FieldErrors = { a?: string; b?: string };
export type ValidationResult = { ok: true; operands: number[] } | { ok: false; errors: FieldErrors };

// Plain decimal or scientific notation. Rejects hex, commas and "Infinity",
// which Number() would otherwise accept or misread.
const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

export function parseOperand(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, error: 'Enter a number.' };
  const value = Number(trimmed);
  if (!NUMBER_PATTERN.test(trimmed) || !Number.isFinite(value)) {
    return { ok: false, error: 'Not a valid number.' };
  }
  return { ok: true, value };
}

export function validateInputs(arity: 1 | 2, a: string, b: string): ValidationResult {
  const operands: number[] = [];
  const errors: FieldErrors = {};

  const first = parseOperand(a);
  if (first.ok) operands.push(first.value);
  else errors.a = first.error;

  if (arity === 2) {
    const second = parseOperand(b);
    if (second.ok) operands.push(second.value);
    else errors.b = second.error;
  }

  return errors.a || errors.b ? { ok: false, errors } : { ok: true, operands };
}
