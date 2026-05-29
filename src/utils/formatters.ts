export function euro(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, useGrouping: 'always' }).format(Number(n || 0));
}
export function euro0(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(Number(n || 0));
}
export function num(n: number, digits = 0) {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits, useGrouping: 'always' }).format(Number(n || 0));
}
export function pct(n: number) {
  return `${num(Number(n || 0) * 100, 1)}%`;
}
export function diffPct(current: number, previous: number) {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / previous;
}
