// Keep rounded whole-number digits explicit as scientific notation.
export function formatNumber(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  const [mantissa, exponent] = n.toPrecision(12).split('e');
  const compact = mantissa.includes('.') ? mantissa.replace(/0+$/, '').replace(/\.$/, '') : mantissa;
  return exponent === undefined ? String(Number(compact)) : `${compact}e${exponent}`;
}
