export type PeriodSelection =
  | { mode: 'year'; year: number }
  | { mode: 'ytd'; year: number; throughMonth: number }
  | { mode: 'month'; year: number; month: number }
  | { mode: 'range'; year: number; from: string; to: string };

export type AnalysisSource = 'real' | 'simulation';
export type ChartGrouping = 'daily' | 'weekly' | 'monthly';

export type AnalysisFilters = {
  period: PeriodSelection;
  dealerId: string;
  branch: string;
  product: string;
  macroProduct: 'ALL' | 'AUTO' | 'POS';
  search: string;
  source: AnalysisSource;
  grouping: ChartGrouping;
};

export type AnalyticsRow = {
  year: number;
  month: number;
  dateISO: string | null;
  dealerCode?: string;
  puntoVendita?: string;
  convenzionato?: string;
  dealer: string;
  subagente: string;
  prodottoCode: string;
  cliente?: string;
  codiceFiscale?: string;
  tabella?: string;
  localita?: string;
  importoFinanziato: number;
};

export const ALL = 'ALL';

export function defaultAnalysisFilters(realYear: number): AnalysisFilters {
  return {
    period: { mode: 'year', year: realYear },
    dealerId: ALL,
    branch: ALL,
    product: ALL,
    macroProduct: ALL,
    search: '',
    source: 'real',
    grouping: 'monthly',
  };
}

export function dealerIdentity(row: Pick<AnalyticsRow, 'dealerCode' | 'puntoVendita' | 'convenzionato' | 'dealer'>): string {
  const point = normalizeQuery(row.puntoVendita || '');
  if (point) return `PV:${point}`;
  const agreement = normalizeQuery(row.convenzionato || '');
  if (agreement) return `CONV:${agreement}`;
  const code = normalizeQuery(row.dealerCode || '');
  return code ? `DEALER:${code}` : `LABEL:${normalizeQuery(row.dealer)}`;
}

export function normalizeQuery(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('it-IT');
}

export function matchesDimensions(row: AnalyticsRow, filters: AnalysisFilters): boolean {
  const dealerOk = filters.dealerId === ALL || dealerIdentity(row) === filters.dealerId;
  const branchOk = filters.branch === ALL || row.subagente === filters.branch;
  const productOk = filters.product === ALL || row.prodottoCode === filters.product;
  const family = ['20', '21', '23', '36'].includes(row.prodottoCode.trim()) ? 'AUTO' : 'POS';
  const macroOk = filters.macroProduct === ALL || family === filters.macroProduct;
  const needle = normalizeQuery(filters.search);
  const haystack = normalizeQuery([row.cliente, row.codiceFiscale, row.tabella, row.localita].filter(Boolean).join(' '));
  return dealerOk && branchOk && productOk && macroOk && (!needle || haystack.includes(needle));
}

export function matchesPeriod(row: AnalyticsRow, period: PeriodSelection): boolean {
  if (row.year !== period.year) return false;
  if (period.mode === 'year') return true;
  if (period.mode === 'ytd') return row.month <= period.throughMonth;
  if (period.mode === 'month') return row.month === period.month;
  const date = row.dateISO?.slice(0, 10);
  return Boolean(date && date >= period.from && date <= period.to);
}

/** Current selection. Period and non-temporal dimensions are both applied. */
export function selectCurrentRows<T extends AnalyticsRow>(rows: readonly T[], filters: AnalysisFilters): T[] {
  return rows.filter((row) => matchesDimensions(row, filters) && matchesPeriod(row, filters.period));
}

/** Historical comparison scope. It deliberately keeps time open while preserving every other dimension. */
export function selectHistoricalRows<T extends AnalyticsRow>(rows: readonly T[], filters: AnalysisFilters): T[] {
  return rows.filter((row) => matchesDimensions(row, filters));
}

export function periodForPreviousYear(period: PeriodSelection): PeriodSelection {
  if (period.mode === 'range') {
    return { ...period, year: period.year - 1, from: shiftIsoYear(period.from, -1), to: shiftIsoYear(period.to, -1) };
  }
  return { ...period, year: period.year - 1 };
}

function shiftIsoYear(iso: string, amount: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const maxDay = new Date(Date.UTC(year + amount, month, 0)).getUTCDate();
  return `${year + amount}-${String(month).padStart(2, '0')}-${String(Math.min(day, maxDay)).padStart(2, '0')}`;
}

export function selectPreviousRows<T extends AnalyticsRow>(rows: readonly T[], filters: AnalysisFilters): T[] {
  const previous = periodForPreviousYear(filters.period);
  return rows.filter((row) => matchesDimensions(row, filters) && matchesPeriod(row, previous));
}

export function sourceDataAsOf(rows: readonly AnalyticsRow[]): string | null {
  const dates = rows.map((row) => row.dateISO?.slice(0, 10) || '').filter(Boolean).sort();
  return dates[dates.length - 1] || null;
}

export function summarize(rows: readonly AnalyticsRow[]) {
  const amount = rows.reduce((sum, row) => sum + row.importoFinanziato, 0);
  return { amount, count: rows.length, average: rows.length ? amount / rows.length : null };
}

export function activeFilterLabels(filters: AnalysisFilters): Array<{ key: keyof AnalysisFilters | 'period'; label: string }> {
  const labels: Array<{ key: keyof AnalysisFilters | 'period'; label: string }> = [];
  const p = filters.period;
  labels.push({ key: 'period', label: p.mode === 'year' ? `Anno ${p.year}` : p.mode === 'ytd' ? `YTD ${p.year} fino al mese ${p.throughMonth}` : p.mode === 'month' ? `Mese ${String(p.month).padStart(2, '0')}/${p.year}` : `${p.from} – ${p.to}` });
  if (filters.dealerId !== ALL) labels.push({ key: 'dealerId', label: `Dealer ${filters.dealerId.replace(/^(PV|CONV|DEALER|LABEL):/, '')}` });
  if (filters.branch !== ALL) labels.push({ key: 'branch', label: `Filiale ${filters.branch}` });
  if (filters.product !== ALL) labels.push({ key: 'product', label: `Prodotto ${filters.product}` });
  if (filters.macroProduct !== ALL) labels.push({ key: 'macroProduct', label: `Macro ${filters.macroProduct}` });
  if (filters.search.trim()) labels.push({ key: 'search', label: `Ricerca “${filters.search.trim()}”` });
  if (filters.source === 'simulation') labels.push({ key: 'source', label: 'Fonte simulazione' });
  return labels;
}
