// Twelve significant digits hide float noise such as 0.1 + 0.2 = 0.30000000000000004.
export function formatNumber(n: number): string {
  return Number.isInteger(n) && Math.abs(n) < 1e15 ? String(n) : String(Number(n.toPrecision(12)));
}
