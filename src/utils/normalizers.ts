export function safeUpper(v: unknown) {
  return String(v ?? '').trim().toUpperCase();
}
export function normalizeText(v: unknown) {
  return String(v ?? '').trim();
}
export function normalizeMonthLabel(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace('.', '');
}
export function cleanNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) return 0;
    const normalized = cleaned.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
export function normalizeProductLabel(code: string) {
  if (code === '31') return 'Prodotto 31';
  if (code === '21') return 'Prodotto 21';
  if (code === '24') return 'Prodotto 24';
  return code ? `Prodotto ${code}` : 'N/D';
}
export function getProductFamilyFromCode(code: string): 'AUTO' | 'POS' | 'ALTRO' {
  // Regola operativa utente:
  // AUTO = 20, 21, 23, 36
  // POS = tutto il resto
  if (['20', '21', '23', '36'].includes(code)) return 'AUTO';
  return code ? 'POS' : 'ALTRO';
}
