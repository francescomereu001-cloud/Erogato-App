import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultAnalysisFilters, dealerIdentity, selectCurrentRows, selectHistoricalRows, selectPreviousRows, sourceDataAsOf, summarize, type AnalyticsRow } from './analyticsContext.ts';

const row = (year: number, month: number, dealerCode: string, dealer: string, subagente: string, prodottoCode: string, amount = 100, cliente = 'Cliente'): AnalyticsRow => ({
  year, month, dealerCode, dealer, subagente, prodottoCode, importoFinanziato: amount, cliente,
  dateISO: `${year}-${String(month).padStart(2, '0')}-15T12:00:00.000Z`,
});
const rows = [
  row(2025, 1, 'D1', 'Omonimo', 'F1', '20', 100), row(2026, 1, 'D1', 'Omonimo', 'F1', '20', 200),
  row(2025, 1, 'D2', 'Omonimo', 'F2', '99', 300), row(2026, 1, 'D2', 'Omonimo', 'F2', '99', 400),
];

test('current and historical selectors preserve dimensions and stable homonym identities', () => {
  const filters = { ...defaultAnalysisFilters(2026), dealerId: dealerIdentity(rows[0]), branch: 'F1', product: '20' };
  assert.deepEqual(selectCurrentRows(rows, filters).map(r => r.importoFinanziato), [200]);
  assert.deepEqual(selectHistoricalRows(rows, filters).map(r => r.importoFinanziato), [100, 200]);
  assert.deepEqual(selectPreviousRows(rows, filters).map(r => r.importoFinanziato), [100]);
});

test('grouping is presentation-only and never changes totals or average calculation', () => {
  const base = defaultAnalysisFilters(2026);
  const totals = (['daily', 'weekly', 'monthly'] as const).map(grouping => summarize(selectCurrentRows(rows, { ...base, grouping })));
  assert.deepEqual(totals, [{ amount: 600, count: 2, average: 300 }, { amount: 600, count: 2, average: 300 }, { amount: 600, count: 2, average: 300 }]);
});

test('empty selection stays empty and source coverage does not depend on it', () => {
  const filters = { ...defaultAnalysisFilters(2026), search: 'inesistente' };
  assert.deepEqual(selectCurrentRows(rows, filters), []);
  assert.equal(sourceDataAsOf(selectCurrentRows(rows, filters)), null);
  assert.equal(sourceDataAsOf(rows), '2026-01-15');
});

test('client search is normalized and affects rows without changing dealer selection', () => {
  const searchable = [...rows, row(2026, 2, 'D3', 'Fermo', 'F1', '20', 0, '  Mario   Rossi ')];
  const filters = { ...defaultAnalysisFilters(2026), search: 'mario rossi' };
  assert.equal(selectCurrentRows(searchable, filters).length, 1);
  assert.equal(filters.dealerId, 'ALL');
});
