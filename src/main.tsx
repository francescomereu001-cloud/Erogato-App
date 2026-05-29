import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
  Cell,
} from 'recharts';
import {
  Upload,
  Euro,
  Users,
  TrendingUp,
  Target,
  Trash2,
  Wallet,
  Download,
  Database,
  Search,
  Store,
  RefreshCw,
  Boxes,
  ShieldAlert,
  CircleCheck,
  TriangleAlert,
  Home,
  CalendarDays,
  Siren,
  Package,
  Building2,
  BriefcaseBusiness,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
} from 'lucide-react';
import './styles.css';
import { supabase } from "./supabase";
type SourceRow = Record<string, unknown>;

const PRODUCT_COLORS = ['#2458E6', '#14B8A6', '#F59E0B', '#8B5CF6', '#0EA5E9', '#EC4899', '#22C55E', '#F97316'];

type AppRow = {
  rowId: string;
  stableIdentity: string;
  sourceFile: string;
  convenzionato: string;
  dealer: string;
  subagente: string;
  agente: string;
  situazione: string;
  cliente: string;
  codiceFiscale: string;
  prodottoCode: string;
  prodottoLabel: string;
  tabella: string;
  numeroRate: number;
  importoRata: number;
  importoFinanziato: number;
  importoNettoErogato: number;
  dataCaricamento: string | null;
  dataLiquidazione: string | null;
  indirizzo: string;
  cap: string;
  localita: string;
  provincia: string;
  provvigione: number;
  polizza: number;
  year: number;
  month: number;
  dateISO: string | null;
};

type Settings = {
  annualTargetByYear: Record<number, number>;
  stagionalitaByYear: Record<number, number[]>;
};

type ProductMonthlyMetric = {
  key: string;
  year: number;
  month: number;
  family: 'AUTO' | 'POS';
  amount: number;
};

type PolicyMonthlyMetric = {
  key: string;
  year: number;
  month: number;
  dealer: string | '__TOTAL__';
  amount: number;
};

type WorkbookImport = {
  fileName: string;
  rows: SourceRow[];
  databaseSheetName: string;
  productMonthly: ProductMonthlyMetric[];
  policyMonthly: PolicyMonthlyMetric[];
};

type ViewGranularity = 'monthly' | 'weekly' | 'daily';
type DataSourceMode = 'supabase' | 'local' | 'empty';
type DealerSortKey = 'erogato' | 'crescitaPct' | 'ticketMedio' | 'provvigioni';
type BranchMacroFilter = 'ALL' | 'AUTO' | 'POS';
type TrendPeriodMode = 'ytd' | 'month';
type TrendMacroFilter = 'ALL' | 'AUTO' | 'POS';
type TrendStatus = 'In crescita' | 'In calo' | 'Stabile' | 'Nuova';
type TrendFilters = {
  year: number;
  monthLimit: number;
  periodMode: TrendPeriodMode;
  macroProduct: TrendMacroFilter;
  branch: string;
  dealer: string;
};
type DealerDetailInsight = { key: string; label: string; positive: boolean };

type SmartDealerRow = {
  name: string;
  erogato: number;
  pratiche: number;
  ticketMedio: number;
  provvigioni: number;
  autoAmount: number;
  posAmount: number;
  autoPct: number;
  posPct: number;
  currentMonthErogato: number;
  previousMonthErogato: number;
  growthErogatoAbs: number;
  growthErogatoPct: number;
  currentMonthPratiche: number;
  previousMonthPratiche: number;
  growthPraticheAbs: number;
  statoDealer: 'Top' | 'In crescita' | 'Da presidiare' | 'In calo' | 'Dormiente';
  score: number;
  dealerType: 'AUTO' | 'POS/CASA' | 'MISTO' | 'DA VERIFICARE';
  activeMonthsCount: number;
  continuityLabel: string;
  suggestedAction: 'Consolidare' | 'Presidiare' | 'Recuperare' | 'Riattivare' | 'Sviluppare ticket' | 'Contattare' | 'Monitorare';
};

type AlertSeverity = 'alta' | 'media' | 'bassa' | 'positiva';
type DealerAlert = {
  key: string;
  dealer: string;
  tipo: string;
  severity: AlertSeverity;
  descrizione: string;
  dato: string;
  suggerimento: string;
};

const STORAGE_KEY = 'dealer_erogato_app_v8b';
const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MONTH_MAP: Record<string, number> = {
  gen: 1, gennaio: 1,
  feb: 2, febbraio: 2,
  mar: 3, marzo: 3,
  apr: 4, aprile: 4,
  mag: 5, maggio: 5,
  giu: 6, giugno: 6,
  lug: 7, luglio: 7,
  ago: 8, agosto: 8,
  set: 9, settembre: 9,
  ott: 10, ottobre: 10,
  nov: 11, novembre: 11,
  dic: 12, dicembre: 12,
};
const DEFAULT_2026_STAGIONALITA = [0.0422467773, 0.0679778571, 0.0611428174, 0.0612145238, 0.0556212658, 0.0852724183, 0.1160142533, 0.0483985297, 0.10272674, 0.1183406974, 0.0991278003, 0.1419163194];
const DEFAULT_SETTINGS: Settings = {
  annualTargetByYear: { 2026: 10200000 },
  stagionalitaByYear: { 2026: DEFAULT_2026_STAGIONALITA },
};
const AUTH_USERNAME = import.meta.env.VITE_APP_USERNAME;
const AUTH_PASSWORD = import.meta.env.VITE_APP_PASSWORD;

function euro(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, useGrouping: 'always' }).format(Number(n || 0));
}
function euro0(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(Number(n || 0));
}
function num(n: number, digits = 0) {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits, useGrouping: 'always' }).format(Number(n || 0));
}
function pct(n: number) {
  return `${num(Number(n || 0) * 100, 1)}%`;
}
function diffPct(current: number, previous: number) {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / previous;
}
function safeUpper(v: unknown) {
  return String(v ?? '').trim().toUpperCase();
}
function normalizeText(v: unknown) {
  return String(v ?? '').trim();
}
function normalizeMonthLabel(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace('.', '');
}
function cleanNumber(value: unknown) {
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
function pick(row: SourceRow, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return value as string;
  }
  return fallback;
}
function parseItalianDateString(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  return new Date(year, month, day, 12, 0, 0, 0);
}
function excelDateToDate(value: unknown): Date | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0, 0);
  }
  if (typeof value === 'string') {
    const it = parseItalianDateString(value);
    if (it) return it;
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return new Date(direct.getFullYear(), direct.getMonth(), direct.getDate(), 12, 0, 0, 0);
  }
  return null;
}
function normalizeProductLabel(code: string) {
  if (code === '31') return 'Prodotto 31';
  if (code === '21') return 'Prodotto 21';
  if (code === '24') return 'Prodotto 24';
  return code ? `Prodotto ${code}` : 'N/D';
}
function getProductFamilyFromCode(code: string): 'AUTO' | 'POS' | 'ALTRO' {
  // Regola operativa utente:
  // AUTO = 20, 21, 23, 36
  // POS = tutto il resto
  if (['20', '21', '23', '36'].includes(code)) return 'AUTO';
  return code ? 'POS' : 'ALTRO';
}

function getMacroProduct(row: AppRow): 'AUTO' | 'POS' {
  return getProductFamilyFromCode(String(row.prodottoCode || '')) === 'AUTO' ? 'AUTO' : 'POS';
}

function filterRowsForTrend(rows: AppRow[], filters: TrendFilters) {
  return rows.filter((row) => {
    if (!row.dateISO || !row.year || !row.month) return false;
    if (row.year !== filters.year && row.year !== filters.year - 1) return false;
    if (filters.periodMode === 'month' && row.month !== filters.monthLimit) return false;
    if (filters.periodMode === 'ytd' && (row.month < 1 || row.month > filters.monthLimit)) return false;
    if (filters.macroProduct !== 'ALL' && getMacroProduct(row) !== filters.macroProduct) return false;
    if (filters.branch !== 'ALL' && row.subagente !== filters.branch) return false;
    if (filters.dealer !== 'ALL' && row.dealer !== filters.dealer) return false;
    return true;
  });
}

function summarizeTrendRows(rows: AppRow[]) {
  const erogato = rows.reduce((sum, row) => sum + row.importoFinanziato, 0);
  const pratiche = rows.length;
  const provvigioni = rows.reduce((sum, row) => sum + row.provvigione, 0);
  return { erogato, pratiche, provvigioni, ticketMedio: pratiche ? erogato / pratiche : 0 };
}

function buildYtdTrendComparison(rows: AppRow[], filters: TrendFilters) {
  const trendRows = filterRowsForTrend(rows, filters);
  const currentRows = trendRows.filter((row) => row.year === filters.year);
  const previousRows = trendRows.filter((row) => row.year === filters.year - 1);
  const current = summarizeTrendRows(currentRows);
  const previous = summarizeTrendRows(previousRows);
  return {
    current,
    previous,
    deltaEuro: current.erogato - previous.erogato,
    deltaPct: diffPct(current.erogato, previous.erogato),
    previousHasData: previous.pratiche > 0 || previous.erogato > 0,
  };
}

function buildMonthlyYoYSeries(rows: AppRow[], filters: TrendFilters) {
  const baseFilters = { ...filters, periodMode: 'ytd' as TrendPeriodMode };
  const trendRows = filterRowsForTrend(rows, baseFilters);
  return Array.from({ length: filters.monthLimit }, (_, index) => {
    const month = index + 1;
    const current = trendRows
      .filter((row) => row.year === filters.year && row.month === month)
      .reduce((sum, row) => sum + row.importoFinanziato, 0);
    const previous = trendRows
      .filter((row) => row.year === filters.year - 1 && row.month === month)
      .reduce((sum, row) => sum + row.importoFinanziato, 0);
    return { month, monthShort: MONTHS_SHORT[index], [String(filters.year)]: current, [String(filters.year - 1)]: previous };
  });
}

function buildBranchTrendTable(rows: AppRow[], filters: TrendFilters) {
  const trendRows = filterRowsForTrend(rows, filters);
  const map = new Map<string, { filiale: string; currentRows: AppRow[]; previousRows: AppRow[] }>();
  trendRows.forEach((row) => {
    const filiale = (row.subagente || '').trim() || 'N/D';
    if (!map.has(filiale)) map.set(filiale, { filiale, currentRows: [], previousRows: [] });
    const bucket = map.get(filiale)!;
    if (row.year === filters.year) bucket.currentRows.push(row);
    if (row.year === filters.year - 1) bucket.previousRows.push(row);
  });

  return Array.from(map.values()).map((item) => {
    const current = summarizeTrendRows(item.currentRows);
    const previous = summarizeTrendRows(item.previousRows);
    const deltaEuro = current.erogato - previous.erogato;
    const deltaPct = diffPct(current.erogato, previous.erogato);
    let stato: TrendStatus = 'Stabile';
    if (previous.erogato === 0 && current.erogato > 0) stato = 'Nuova';
    else if (deltaPct !== null && deltaPct > 0.05) stato = 'In crescita';
    else if (deltaPct !== null && deltaPct < -0.05) stato = 'In calo';
    return {
      filiale: item.filiale,
      currentErogato: current.erogato,
      previousErogato: previous.erogato,
      deltaEuro,
      deltaPct,
      pratiche: current.pratiche,
      ticketMedio: current.ticketMedio,
      provvigioni: current.provvigioni,
      stato,
      previousHasData: previous.pratiche > 0 || previous.erogato > 0,
      currentTicketMedio: current.ticketMedio,
      previousTicketMedio: previous.ticketMedio,
    };
  }).sort((a, b) => b.currentErogato - a.currentErogato);
}

function buildBranchMacroMixTable(rows: AppRow[], filters: TrendFilters) {
  const currentRows = filterRowsForTrend(rows, { ...filters, macroProduct: 'ALL' }).filter((row) => row.year === filters.year);
  const map = new Map<string, { filiale: string; auto: number; pos: number }>();
  currentRows.forEach((row) => {
    const filiale = (row.subagente || '').trim() || 'N/D';
    if (!map.has(filiale)) map.set(filiale, { filiale, auto: 0, pos: 0 });
    const bucket = map.get(filiale)!;
    if (getMacroProduct(row) === 'AUTO') bucket.auto += row.importoFinanziato;
    else bucket.pos += row.importoFinanziato;
  });
  return Array.from(map.values()).map((row) => {
    const totale = row.auto + row.pos;
    return { ...row, totale, autoPct: totale ? row.auto / totale : 0, posPct: totale ? row.pos / totale : 0 };
  }).sort((a, b) => b.totale - a.totale);
}


type TrendCauseDealerRow = {
  dealer: string;
  currentErogato: number;
  previousErogato: number;
  deltaEuro: number;
  deltaPct: number | null;
  currentPratiche: number;
  previousPratiche: number;
  filialePrevalente: string;
  macroPrevalente: 'AUTO' | 'POS' | 'MISTO';
  status: 'Nuovo' | 'Perso' | null;
};

type TrendCauseBranchRow = {
  filiale: string;
  currentErogato: number;
  previousErogato: number;
  deltaEuro: number;
  deltaPct: number | null;
  mainPositiveDealer: string;
  mainNegativeDealer: string;
};

function buildTrendVariationCauses(rows: AppRow[], filters: TrendFilters) {
  const trendRows = filterRowsForTrend(rows, filters);
  const dealerMap = new Map<string, {
    dealer: string;
    currentRows: AppRow[];
    previousRows: AppRow[];
    branchAmounts: Map<string, number>;
    macroAmounts: Map<'AUTO' | 'POS', number>;
  }>();
  const branchMap = new Map<string, { filiale: string; currentRows: AppRow[]; previousRows: AppRow[] }>();

  trendRows.forEach((row) => {
    const dealer = (row.dealer || '').trim() || 'N/D';
    const filiale = (row.subagente || '').trim() || 'N/D';
    const macro = getMacroProduct(row);
    if (!dealerMap.has(dealer)) {
      dealerMap.set(dealer, { dealer, currentRows: [], previousRows: [], branchAmounts: new Map(), macroAmounts: new Map() });
    }
    const dealerBucket = dealerMap.get(dealer)!;
    if (row.year === filters.year) dealerBucket.currentRows.push(row);
    if (row.year === filters.year - 1) dealerBucket.previousRows.push(row);
    dealerBucket.branchAmounts.set(filiale, (dealerBucket.branchAmounts.get(filiale) || 0) + row.importoFinanziato);
    dealerBucket.macroAmounts.set(macro, (dealerBucket.macroAmounts.get(macro) || 0) + row.importoFinanziato);

    if (!branchMap.has(filiale)) branchMap.set(filiale, { filiale, currentRows: [], previousRows: [] });
    const branchBucket = branchMap.get(filiale)!;
    if (row.year === filters.year) branchBucket.currentRows.push(row);
    if (row.year === filters.year - 1) branchBucket.previousRows.push(row);
  });

  const dealerRows: TrendCauseDealerRow[] = Array.from(dealerMap.values()).map((item) => {
    const current = summarizeTrendRows(item.currentRows);
    const previous = summarizeTrendRows(item.previousRows);
    const deltaEuro = current.erogato - previous.erogato;
    const branchAmounts = Array.from(item.branchAmounts.entries()).sort((a, b) => b[1] - a[1]);
    const auto = item.macroAmounts.get('AUTO') || 0;
    const pos = item.macroAmounts.get('POS') || 0;
    const macroPrevalente: TrendCauseDealerRow['macroPrevalente'] = auto > 0 && pos > 0 ? 'MISTO' : (auto >= pos ? 'AUTO' : 'POS');
    return {
      dealer: item.dealer,
      currentErogato: current.erogato,
      previousErogato: previous.erogato,
      deltaEuro,
      deltaPct: diffPct(current.erogato, previous.erogato),
      currentPratiche: current.pratiche,
      previousPratiche: previous.pratiche,
      filialePrevalente: branchAmounts[0]?.[0] || 'N/D',
      macroPrevalente,
      status: previous.erogato === 0 && current.erogato > 0 ? 'Nuovo' : (previous.erogato > 0 && current.erogato === 0 ? 'Perso' : null),
    };
  });

  const positiveDealers = dealerRows.filter((row) => row.deltaEuro > 0).sort((a, b) => b.deltaEuro - a.deltaEuro).slice(0, 5);
  const negativeDealers = dealerRows.filter((row) => row.deltaEuro < 0).sort((a, b) => a.deltaEuro - b.deltaEuro).slice(0, 5);

  const branchRows: TrendCauseBranchRow[] = Array.from(branchMap.values()).map((item) => {
    const current = summarizeTrendRows(item.currentRows);
    const previous = summarizeTrendRows(item.previousRows);
    const deltaEuro = current.erogato - previous.erogato;
    const branchDealerRows = dealerRows.filter((dealer) => dealer.filialePrevalente === item.filiale);
    const mainPositive = branchDealerRows.filter((dealer) => dealer.deltaEuro > 0).sort((a, b) => b.deltaEuro - a.deltaEuro)[0];
    const mainNegative = branchDealerRows.filter((dealer) => dealer.deltaEuro < 0).sort((a, b) => a.deltaEuro - b.deltaEuro)[0];
    return {
      filiale: item.filiale,
      currentErogato: current.erogato,
      previousErogato: previous.erogato,
      deltaEuro,
      deltaPct: diffPct(current.erogato, previous.erogato),
      mainPositiveDealer: mainPositive ? mainPositive.dealer : '-',
      mainNegativeDealer: mainNegative ? mainNegative.dealer : '-',
    };
  }).sort((a, b) => Math.abs(b.deltaEuro) - Math.abs(a.deltaEuro));

  const currentTotal = dealerRows.reduce((sum, row) => sum + row.currentErogato, 0);
  const previousTotal = dealerRows.reduce((sum, row) => sum + row.previousErogato, 0);

  return {
    positiveDealers,
    negativeDealers,
    branchRows,
    hasSufficientData: currentTotal > 0 && previousTotal > 0,
  };
}

function buildTrendAlerts(rows: AppRow[], filters: TrendFilters, branchRows: ReturnType<typeof buildBranchTrendTable>) {
  const alerts: Array<{ key: string; severity: AlertSeverity; title: string; text: string }> = [];
  const strongDecline = branchRows.find((row) => row.deltaPct !== null && row.deltaPct <= -0.25 && row.previousErogato > 0);
  if (strongDecline) alerts.push({ key: 'branch-decline', severity: 'alta', title: 'Filiale in forte calo YoY', text: `${strongDecline.filiale}: ${euro0(strongDecline.deltaEuro)} (${pct(strongDecline.deltaPct || 0)})` });
  const strongGrowth = branchRows.find((row) => row.deltaPct !== null && row.deltaPct >= 0.25 && row.previousErogato > 0);
  if (strongGrowth) alerts.push({ key: 'branch-growth', severity: 'positiva', title: 'Filiale in forte crescita YoY', text: `${strongGrowth.filiale}: +${euro0(Math.abs(strongGrowth.deltaEuro))} (${pct(strongGrowth.deltaPct || 0)})` });
  const newBranch = branchRows.find((row) => row.stato === 'Nuova');
  if (newBranch) alerts.push({ key: 'new-branch', severity: 'media', title: 'Nuova filiale', text: `${newBranch.filiale}: nessun dato nello stesso periodo anno precedente.` });
  const ticketDown = branchRows.find((row) => row.previousTicketMedio > 0 && row.currentTicketMedio < row.previousTicketMedio * 0.9);
  if (ticketDown) alerts.push({ key: 'ticket-down', severity: 'bassa', title: 'Ticket medio in calo', text: `${ticketDown.filiale}: ${euro0(ticketDown.currentTicketMedio)} vs ${euro0(ticketDown.previousTicketMedio)} anno precedente.` });

  const macroDelta = (macro: TrendMacroFilter) => {
    if (macro === 'ALL') return null;
    const scoped = filterRowsForTrend(rows, { ...filters, macroProduct: macro });
    const current = scoped.filter((row) => row.year === filters.year).reduce((sum, row) => sum + row.importoFinanziato, 0);
    const previous = scoped.filter((row) => row.year === filters.year - 1).reduce((sum, row) => sum + row.importoFinanziato, 0);
    return { macro, current, previous, deltaPct: diffPct(current, previous) };
  };
  const macroWeak = [macroDelta('AUTO'), macroDelta('POS')]
    .filter((item): item is NonNullable<typeof item> => Boolean(item && item.previous > 0 && item.deltaPct !== null))
    .sort((a, b) => (a.deltaPct || 0) - (b.deltaPct || 0))[0];
  if (macroWeak && (macroWeak.deltaPct || 0) < 0) alerts.push({ key: 'weak-macro', severity: 'media', title: 'Macroprodotto più debole YoY', text: `${macroWeak.macro}: ${pct(macroWeak.deltaPct || 0)} rispetto allo stesso periodo.` });
  return alerts.slice(0, 5);
}
function workingDaysInMonth(year: number, monthIndex: number) {
  const date = new Date(year, monthIndex, 1);
  let count = 0;
  while (date.getMonth() === monthIndex) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) count += 1;
    date.setDate(date.getDate() + 1);
  }
  return count;
}
function workedDaysInMonth(year: number, monthIndex: number, referenceDate = new Date()) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const ref = referenceDate < start ? null : referenceDate > end ? end : referenceDate;
  if (!ref) return 0;
  const cursor = new Date(start);
  let count = 0;
  while (cursor <= ref) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function dateAtWorkingDayIndex(year: number, monthIndex: number, workingDayIndex: number) {
  if (workingDayIndex <= 0) return null;
  const cursor = new Date(year, monthIndex, 1);
  let count = 0;
  while (cursor.getMonth() === monthIndex) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
      if (count === workingDayIndex) return new Date(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

type DealerCategory = 'AUTO' | 'POS';
type DealerPortfolioStat = {
  dealer: string;
  category: DealerCategory;
  erogato: number;
  pratiche: number;
  ticketMedio: number;
  pesoTotalePct: number;
  pesoCategoriaPct: number;
};

function getDealerCategory(autoAmount: number, posAmount: number): DealerCategory {
  return autoAmount >= posAmount ? 'AUTO' : 'POS';
}

function buildDealerPortfolioStats(rows: AppRow[]) {
  const byDealer = new Map<string, { dealer: string; totale: number; pratiche: number; auto: number; pos: number }>();
  rows.forEach((row) => {
    const dealer = (row.dealer || '').trim() || 'N/D';
    const amount = Number(row.importoFinanziato);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!byDealer.has(dealer)) byDealer.set(dealer, { dealer, totale: 0, pratiche: 0, auto: 0, pos: 0 });
    const item = byDealer.get(dealer)!;
    item.totale += amount;
    item.pratiche += 1;
    const family = getProductFamilyFromCode(String(row.prodottoCode || ''));
    if (family === 'AUTO') item.auto += amount;
    else if (family === 'POS') item.pos += amount;
  });

  const base = Array.from(byDealer.values()).map((row) => ({
    dealer: row.dealer,
    category: getDealerCategory(row.auto, row.pos),
    erogato: row.totale,
    pratiche: row.pratiche,
    ticketMedio: row.pratiche ? row.totale / row.pratiche : 0,
  }));
  const totalErogato = base.reduce((sum, row) => sum + row.erogato, 0);
  const totalAutoDealers = base.filter((r) => r.category === 'AUTO').reduce((sum, row) => sum + row.erogato, 0);
  const totalPosDealers = base.filter((r) => r.category === 'POS').reduce((sum, row) => sum + row.erogato, 0);

  const stats: DealerPortfolioStat[] = base
    .map((row) => ({
      ...row,
      pesoTotalePct: totalErogato > 0 ? (row.erogato / totalErogato) * 100 : 0,
      pesoCategoriaPct: row.category === 'AUTO'
        ? (totalAutoDealers > 0 ? (row.erogato / totalAutoDealers) * 100 : 0)
        : (totalPosDealers > 0 ? (row.erogato / totalPosDealers) * 100 : 0),
    }))
    .sort((a, b) => b.erogato - a.erogato);

  return { stats, totalErogato, totalAutoDealers, totalPosDealers };
}

function buildDailyProgressComparison(rows: AppRow[], year: number, month: number) {
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousMonthYear = month === 1 ? year - 1 : year;
  const previousYear = year - 1;
  const maxDays = Math.max(
    new Date(year, month, 0).getDate(),
    new Date(previousMonthYear, previousMonth, 0).getDate(),
    new Date(previousYear, month, 0).getDate(),
  );

  const buildDailyTotals = (targetYear: number, targetMonth: number) => {
    const totals = new Map<number, number>();
    rows.forEach((row) => {
      if (row.year !== targetYear || row.month !== targetMonth || !row.dateISO) return;
      const day = new Date(row.dateISO).getDate();
      totals.set(day, (totals.get(day) || 0) + row.importoFinanziato);
    });
    return totals;
  };

  const currTotals = buildDailyTotals(year, month);
  const prevMonthTotals = buildDailyTotals(previousMonthYear, previousMonth);
  const prevYearTotals = buildDailyTotals(previousYear, month);

  let currCumulative = 0;
  let prevMonthCumulative = 0;
  let prevYearCumulative = 0;

  return Array.from({ length: maxDays }, (_, index) => {
    const day = index + 1;
    currCumulative += currTotals.get(day) || 0;
    prevMonthCumulative += prevMonthTotals.get(day) || 0;
    prevYearCumulative += prevYearTotals.get(day) || 0;
    return {
      day,
      label: `${day}`,
      corrente: currCumulative,
      mesePrecedente: prevMonthCumulative,
      annoScorso: prevYearCumulative,
    };
  });
}

function findBestMonthYtd(rows: AppRow[], year: number, upToMonth: number) {
  const totals = new Map<number, number>();
  rows.forEach((row) => {
    if (row.year !== year || row.month > upToMonth) return;
    totals.set(row.month, (totals.get(row.month) || 0) + row.importoFinanziato);
  });
  if (!totals.size) return null;
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0][0];
}
function detectWorkbookYear(rows: SourceRow[], fileName: string) {
  const years = rows
    .map((row) => excelDateToDate(pick(row, ['DATA_LIQUIDAZIONE', 'DATA_CARICAMENTO'])))
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.getFullYear());
  if (years.length) {
    const counts = new Map<number, number>();
    years.forEach((year) => counts.set(year, (counts.get(year) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }
  const match = fileName.match(/20\d{2}/);
  return match ? Number(match[0]) : new Date().getFullYear();
}

function parseProductMonthlyFromWorkbook(workbook: XLSX.WorkBook, year: number): ProductMonthlyMetric[] {
  const sheetName = workbook.SheetNames.find((name) => name.toUpperCase().includes('EROGATO PER PRODOTTO'));
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' }) as unknown[][];
  const headerRowIndex = rows.findIndex((row) => normalizeMonthLabel(row[0]) === 'prodotto');
  if (headerRowIndex < 0) return [];
  const header = rows[headerRowIndex].map(normalizeMonthLabel);
  const metrics: ProductMonthlyMetric[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const label = normalizeMonthLabel(row[0]);
    if (!label) continue;
    if (label.includes('totale')) break;
    const family: 'AUTO' | 'POS' | null = label.includes('auto') ? 'AUTO' : (label.includes('p.o.s') || label === 'pos' || label.includes('p o s') ? 'POS' : null);
    if (!family) continue;
    for (let col = 1; col < header.length; col += 1) {
      const month = MONTH_MAP[header[col]];
      if (!month) continue;
      metrics.push({
        key: `${year}|${month}|${family}`,
        year,
        month,
        family,
        amount: cleanNumber(row[col]),
      });
    }
  }
  return metrics;
}

function parsePolicyMonthlyFromWorkbook(workbook: XLSX.WorkBook, year: number): PolicyMonthlyMetric[] {
  const sheetName = workbook.SheetNames.find((name) => name.toUpperCase().includes('REPORT POLIZZE'));
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' }) as unknown[][];
  const monthHeaderIndex = rows.findIndex((row) => row.some((cell) => normalizeMonthLabel(cell) === 'totale complessivo') && row.some((cell) => MONTH_MAP[normalizeMonthLabel(cell)]));
  if (monthHeaderIndex < 0) return [];
  const header = rows[monthHeaderIndex].map(normalizeMonthLabel);
  const dataStartIndex = rows.findIndex((row, index) => index > monthHeaderIndex && normalizeMonthLabel(row[0]) === 'etichette di riga');
  const start = dataStartIndex >= 0 ? dataStartIndex + 1 : monthHeaderIndex + 1;
  const metrics: PolicyMonthlyMetric[] = [];
  for (let i = start; i < rows.length; i += 1) {
    const row = rows[i];
    const dealerLabel = normalizeText(row[0]);
    if (!dealerLabel) continue;
    const dealer = dealerLabel.toLowerCase().includes('totale complessivo') ? '__TOTAL__' : dealerLabel;
    for (let col = 1; col < header.length; col += 1) {
      const month = MONTH_MAP[header[col]];
      if (!month) continue;
      metrics.push({
        key: `${year}|${month}|${dealer}`,
        year,
        month,
        dealer,
        amount: cleanNumber(row[col]),
      });
    }
  }
  return metrics;
}

async function readWorkbookFile(file: File): Promise<WorkbookImport> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: true });
      const databaseSheetName = workbook.SheetNames.find((name) => name.toUpperCase().includes('DATABASE')) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[databaseSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true }) as SourceRow[];
      const year = detectWorkbookYear(rows, file.name);
      resolve({
        fileName: file.name,
        rows,
        databaseSheetName,
        productMonthly: parseProductMonthlyFromWorkbook(workbook, year),
        policyMonthly: parsePolicyMonthlyFromWorkbook(workbook, year),
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

function normalizeImportedRows(rows: SourceRow[], fileName: string): AppRow[] {
  const occurrence = new Map<string, number>();
  return rows
    .map((row) => {
      const liquidationDate = excelDateToDate(pick(row, ['DATA_LIQUIDAZIONE']));
      const loadingDate = excelDateToDate(pick(row, ['DATA_CARICAMENTO']));
      const referenceDate = liquidationDate || loadingDate;
      const amount = cleanNumber(pick(row, ['IMPORTO_FINANZIATO']));
      const netAmount = cleanNumber(pick(row, ['IMPORTO_NETTO_EROGATO']));
      const prodottoCode = normalizeText(pick(row, ['PRODOTTO']));
      let polizza = cleanNumber(pick(row, ['importo polizza ', 'IMPORTO POLIZZA', 'IMPORTO_POLIZZA']));
      let provvigione = cleanNumber(pick(row, ['PROVV', 'PROVVIGIONE']));
      if (!provvigione && amount > 0) {
        provvigione = prodottoCode === '31' ? amount * 0.00825 : amount * 0.0055;
      }
      if (!referenceDate || amount <= 0) return null;

      const stableIdentity = [
        safeUpper(pick(row, ['CONVENZIONATO'])),
        safeUpper(pick(row, ['CLIENTE'])),
        safeUpper(pick(row, ['CODICE_FISCALE_CLI'])),
        prodottoCode,
        amount.toFixed(2),
        cleanNumber(pick(row, ['NUMERO_RATE'])).toString(),
        `${referenceDate.getFullYear()}-${referenceDate.getMonth() + 1}-${referenceDate.getDate()}`,
      ].join('|');

      const occ = (occurrence.get(stableIdentity) || 0) + 1;
      occurrence.set(stableIdentity, occ);
      const rowId = `${stableIdentity}#${occ}`;
      const finalDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 12, 0, 0, 0);
      if (typeof pick(row, ['importo polizza ']) === 'string' && polizza === 0) {
        polizza = 0;
      }

      return {
        rowId,
        stableIdentity,
        sourceFile: fileName,
        convenzionato: normalizeText(pick(row, ['CONVENZIONATO'])),
        dealer: normalizeText(pick(row, ['DES_CONVENZIONATO'], 'N/D')) || 'N/D',
        subagente: normalizeText(pick(row, ['DES_SUBAGENTE'], 'N/D')) || 'N/D',
        agente: normalizeText(pick(row, ['DES_AGENTE'], 'N/D')) || 'N/D',
        situazione: normalizeText(pick(row, ['SITUAZIONE'])),
        cliente: normalizeText(pick(row, ['DES_CLIENTE'], 'N/D')) || 'N/D',
        codiceFiscale: normalizeText(pick(row, ['CODICE_FISCALE_CLI'])),
        prodottoCode,
        prodottoLabel: normalizeProductLabel(prodottoCode),
        tabella: normalizeText(pick(row, ['TABELLA_FINANZ'])),
        numeroRate: cleanNumber(pick(row, ['NUMERO_RATE'])),
        importoRata: cleanNumber(pick(row, ['IMPORTO_RATA'])),
        importoFinanziato: amount,
        importoNettoErogato: netAmount,
        dataCaricamento: loadingDate ? loadingDate.toISOString() : null,
        dataLiquidazione: liquidationDate ? liquidationDate.toISOString() : null,
        indirizzo: normalizeText(pick(row, ['INDIRIZZO_CLI'])),
        cap: normalizeText(pick(row, ['CAP_CLIENTE'])),
        localita: normalizeText(pick(row, ['LOCALITA_CLI'])),
        provincia: normalizeText(pick(row, ['PROVINCIA_CLI'])),
        provvigione,
        polizza,
        year: finalDate.getFullYear(),
        month: finalDate.getMonth() + 1,
        dateISO: finalDate.toISOString(),
      } as AppRow;
    })
    .filter((row): row is AppRow => Boolean(row));
}

function mergeRows(existing: AppRow[], incoming: AppRow[]) {
  const map = new Map(existing.map((row) => [row.rowId, row]));
  incoming.forEach((row) => map.set(row.rowId, row));
  return Array.from(map.values()).sort((a, b) => new Date(a.dateISO || 0).getTime() - new Date(b.dateISO || 0).getTime());
}
function mergeMetrics<T extends { key: string }>(existing: T[], incoming: T[]) {
  const map = new Map(existing.map((row) => [row.key, row]));
  incoming.forEach((row) => map.set(row.key, row));
  return Array.from(map.values());
}

function monthSeriesFromRows(rows: AppRow[], year: number) {
  const data = MONTHS_IT.map((month, index) => ({ month, monthShort: MONTHS_SHORT[index], monthIndex: index + 1, erogato: 0, pratiche: 0, provvigioni: 0, polizze: 0 }));
  rows.filter((row) => row.year === year).forEach((row) => {
    const bucket = data[row.month - 1];
    if (!bucket) return;
    bucket.erogato += row.importoFinanziato;
    bucket.pratiche += 1;
    bucket.provvigioni += row.provvigione;
    bucket.polizze += row.polizza;
  });
  return data;
}


function startOfWeek(dateISO: string) {
  const date = new Date(dateISO);
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function endOfWeek(dateISO: string) {
  const start = startOfWeek(dateISO);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function formatDateLabel(dateISO: string) {
  return new Date(dateISO).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function formatWeekLabel(dateISO: string) {
  const start = startOfWeek(dateISO);
  const end = endOfWeek(dateISO);
  return `${start.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`;
}

function getWeeklyKey(dateISO: string) {
  const start = startOfWeek(dateISO);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

function getDailyKey(dateISO: string) {
  return dateISO.slice(0, 10);
}

function timeSeriesFromRows(rows: AppRow[], year: number, granularity: ViewGranularity) {
  if (granularity === 'monthly') {
    return monthSeriesFromRows(rows, year).map((row) => ({
      key: `${year}-${String(row.monthIndex).padStart(2, '0')}`,
      label: row.monthShort,
      fullLabel: row.month,
      monthIndex: row.monthIndex,
      erogato: row.erogato,
      pratiche: row.pratiche,
      provvigioni: row.provvigioni,
      polizze: row.polizze,
    }));
  }

  const map = new Map<string, { key: string; label: string; fullLabel: string; erogato: number; pratiche: number; provvigioni: number; polizze: number; sortValue: number }>();
  rows.filter((row) => row.year === year && row.dateISO).forEach((row) => {
    const key = granularity === 'weekly' ? getWeeklyKey(row.dateISO!) : getDailyKey(row.dateISO!);
    const label = granularity === 'weekly' ? formatWeekLabel(row.dateISO!) : formatDateLabel(row.dateISO!);
    const fullLabel = granularity === 'weekly'
      ? `Settimana ${formatWeekLabel(row.dateISO!)}`
      : new Date(row.dateISO!).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    if (!map.has(key)) {
      map.set(key, {
        key,
        label,
        fullLabel,
        erogato: 0,
        pratiche: 0,
        provvigioni: 0,
        polizze: 0,
        sortValue: new Date(key).getTime(),
      });
    }

    const bucket = map.get(key)!;
    bucket.erogato += row.importoFinanziato;
    bucket.pratiche += 1;
    bucket.provvigioni += row.provvigione;
    bucket.polizze += row.polizza;
  });

  return Array.from(map.values()).sort((a, b) => a.sortValue - b.sortValue);
}

function rowMatchesPeriod(row: AppRow, granularity: ViewGranularity, periodKey: string) {
  if (!row.dateISO) return false;
  if (granularity === 'monthly') return row.month === Number(periodKey);
  if (granularity === 'weekly') return getWeeklyKey(row.dateISO) === periodKey;
  return getDailyKey(row.dateISO) === periodKey;
}

function productSeriesFromRows(rows: AppRow[], year: number) {
  const series = MONTHS_IT.map((month, index) => ({ month, monthShort: MONTHS_SHORT[index], monthIndex: index + 1, AUTO: 0, POS: 0 }));
  rows.filter((row) => row.year === year).forEach((row) => {
    const family = getProductFamilyFromCode(row.prodottoCode);
    if (family === 'ALTRO') return;
    series[row.month - 1][family] += row.importoFinanziato;
  });
  return series;
}
function commissionsByProductSeries(rows: AppRow[], year: number) {
  const series = MONTHS_IT.map((month, index) => ({ month, monthShort: MONTHS_SHORT[index], monthIndex: index + 1, AUTO: 0, POS: 0 }));
  rows.filter((row) => row.year === year).forEach((row) => {
    const family = getProductFamilyFromCode(row.prodottoCode);
    if (family === 'ALTRO') return;
    series[row.month - 1][family] += row.provvigione;
  });
  return series;
}

function productSeriesFromMetrics(metrics: ProductMonthlyMetric[], year: number) {
  const base = MONTHS_IT.map((month, index) => ({ month, monthShort: MONTHS_SHORT[index], monthIndex: index + 1, AUTO: 0, POS: 0 }));
  metrics.filter((metric) => metric.year === year).forEach((metric) => {
    base[metric.month - 1][metric.family] += metric.amount;
  });
  return base;
}

function aggregateByField(rows: AppRow[], year: number, field: 'dealer' | 'subagente') {
  const map = new Map<string, { name: string; erogato: number; pratiche: number; provvigioni: number; polizze: number; ticketMedio: number }>();
  rows.filter((row) => row.year === year).forEach((row) => {
    const key = row[field] || 'N/D';
    if (!map.has(key)) map.set(key, { name: key, erogato: 0, pratiche: 0, provvigioni: 0, polizze: 0, ticketMedio: 0 });
    const item = map.get(key)!;
    item.erogato += row.importoFinanziato;
    item.pratiche += 1;
    item.provvigioni += row.provvigione;
    item.polizze += row.polizza;
    item.ticketMedio = item.pratiche ? item.erogato / item.pratiche : 0;
  });
  return Array.from(map.values()).sort((a, b) => b.erogato - a.erogato);
}

function productMix(rows: AppRow[], year: number) {
  const map = new Map<string, { name: string; value: number; pratiche: number }>();
  rows.filter((row) => row.year === year).forEach((row) => {
    const key = row.prodottoLabel;
    if (!map.has(key)) map.set(key, { name: key, value: 0, pratiche: 0 });
    const item = map.get(key)!;
    item.value += row.importoFinanziato;
    item.pratiche += 1;
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

function monthWindow(referenceYear: number, referenceMonth: number, offset: number) {
  const d = new Date(referenceYear, referenceMonth - 1 + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function buildSmartDealerRows(rows: AppRow[], year: number, referenceMonth: number): SmartDealerRow[] {
  const current = monthWindow(year, referenceMonth, 0);
  const previous = monthWindow(year, referenceMonth, -1);
  const map = new Map<string, SmartDealerRow>();
  const dealerActiveMonths = new Map<string, Set<number>>();
  rows.filter((row) => row.year === year).forEach((row) => {
    const key = row.dealer || 'N/D';
    if (!dealerActiveMonths.has(key)) dealerActiveMonths.set(key, new Set<number>());
    dealerActiveMonths.get(key)!.add(row.month);
    if (!map.has(key)) {
      map.set(key, {
        name: key, erogato: 0, pratiche: 0, ticketMedio: 0, provvigioni: 0,
        autoAmount: 0, posAmount: 0, autoPct: 0, posPct: 0,
        currentMonthErogato: 0, previousMonthErogato: 0, growthErogatoAbs: 0, growthErogatoPct: 0,
        currentMonthPratiche: 0, previousMonthPratiche: 0, growthPraticheAbs: 0, statoDealer: 'Da presidiare', score: 0,
        dealerType: 'DA VERIFICARE', activeMonthsCount: 0, continuityLabel: '-', suggestedAction: 'Monitorare',
      });
    }
    const item = map.get(key)!;
    item.erogato += row.importoFinanziato;
    item.pratiche += 1;
    item.provvigioni += row.provvigione;
    const family = getProductFamilyFromCode(row.prodottoCode);
    if (family === 'AUTO') item.autoAmount += row.importoFinanziato;
    if (family === 'POS') item.posAmount += row.importoFinanziato;
    if (row.year === current.year && row.month === current.month) {
      item.currentMonthErogato += row.importoFinanziato;
      item.currentMonthPratiche += 1;
    }
    if (row.year === previous.year && row.month === previous.month) {
      item.previousMonthErogato += row.importoFinanziato;
      item.previousMonthPratiche += 1;
    }
  });

  const totals = Array.from(map.values());
  const maxErogato = Math.max(...totals.map((row) => row.erogato), 0);
  const avgTicket = totals.length ? totals.reduce((s, r) => s + (r.pratiche ? (r.erogato / r.pratiche) : 0), 0) / totals.length : 0;

  return totals.map((row) => {
    const totalMix = row.autoAmount + row.posAmount;
    row.ticketMedio = row.pratiche ? row.erogato / row.pratiche : 0;
    row.autoPct = totalMix ? row.autoAmount / totalMix : 0;
    row.posPct = totalMix ? row.posAmount / totalMix : 0;
    if (row.autoPct >= 0.8) row.dealerType = 'AUTO';
    else if (row.posPct >= 0.8) row.dealerType = 'POS/CASA';
    else if (row.autoPct > 0.2 && row.posPct > 0.2) row.dealerType = 'MISTO';
    else row.dealerType = 'DA VERIFICARE';
    row.growthErogatoAbs = row.currentMonthErogato - row.previousMonthErogato;
    row.growthPraticheAbs = row.currentMonthPratiche - row.previousMonthPratiche;
    row.growthErogatoPct = row.previousMonthErogato > 0 ? (row.growthErogatoAbs / row.previousMonthErogato) : (row.currentMonthErogato > 0 ? 1 : 0);

    const growthScore = Math.max(0, Math.min(20, (row.growthErogatoPct + 0.4) * 25));
    const volumeScore = maxErogato > 0 ? Math.min(30, (row.erogato / maxErogato) * 30) : 0;
    const ticketScore = avgTicket > 0 ? Math.max(0, Math.min(15, (row.ticketMedio / avgTicket) * 15)) : 0;
    const activityScore = Math.min(20, row.currentMonthPratiche * 2);
    const mixScore = row.autoPct > 0.2 && row.posPct > 0.2 ? 7 : 3;
    const continuityScore = row.previousMonthPratiche > 0 && row.currentMonthPratiche > 0 ? 8 : row.currentMonthPratiche > 0 ? 5 : 0;
    row.score = Math.round(Math.max(0, Math.min(100, growthScore + volumeScore + ticketScore + activityScore + mixScore + continuityScore)));

    if (row.currentMonthPratiche === 0 && row.previousMonthPratiche === 0) row.statoDealer = 'Dormiente';
    else if (row.score >= 78) row.statoDealer = 'Top';
    else if (row.growthErogatoPct >= 0.15) row.statoDealer = 'In crescita';
    else if (row.growthErogatoPct <= -0.25) row.statoDealer = 'In calo';
    else row.statoDealer = 'Da presidiare';

    const monthsSet = dealerActiveMonths.get(row.name) || new Set<number>();
    const monthsUpToCurrent = Array.from(monthsSet).filter((m) => m <= referenceMonth);
    row.activeMonthsCount = monthsUpToCurrent.length;
    const lastActiveMonth = monthsUpToCurrent.length ? Math.max(...monthsUpToCurrent) : 0;
    if (row.currentMonthPratiche === 0 && lastActiveMonth > 0) {
      const delta = Math.max(1, referenceMonth - lastActiveMonth);
      row.continuityLabel = delta === 1 ? 'Fermo mese corrente' : `Fermo da ${delta} mesi`;
    } else {
      row.continuityLabel = `${row.activeMonthsCount}/${referenceMonth} mesi attivo`;
    }

    if (row.ticketMedio < avgTicket * 0.7) row.suggestedAction = 'Sviluppare ticket';
    else if (row.statoDealer === 'Top') row.suggestedAction = 'Consolidare';
    else if (row.statoDealer === 'In crescita') row.suggestedAction = 'Presidiare';
    else if (row.statoDealer === 'In calo') row.suggestedAction = 'Recuperare';
    else if (row.statoDealer === 'Dormiente') row.suggestedAction = 'Riattivare';
    else if (row.score < 35) row.suggestedAction = 'Contattare';
    else row.suggestedAction = 'Monitorare';
    return row;
  });
}

function buildDealerAlerts(rows: SmartDealerRow[]): DealerAlert[] {
  const alerts: DealerAlert[] = [];
  const currentTotal = rows.reduce((sum, row) => sum + row.currentMonthErogato, 0);
  const activeAvgTicket = rows.filter((row) => row.currentMonthPratiche > 0).reduce((sum, row) => sum + row.ticketMedio, 0)
    / Math.max(rows.filter((row) => row.currentMonthPratiche > 0).length, 1);
  rows.forEach((row) => {
    if (row.previousMonthPratiche > 0 && row.currentMonthPratiche === 0) {
      alerts.push({
        key: `${row.name}-fermo`, dealer: row.name, tipo: 'Dealer fermo', severity: 'alta',
        descrizione: 'Dealer attivo il mese precedente ma senza pratiche nel mese corrente.',
        dato: `${row.previousMonthPratiche} pratiche precedenti → 0 correnti`,
        suggerimento: 'Contattare il dealer per capire il motivo del calo.',
      });
    }
    if (row.growthErogatoPct <= -0.3 && row.previousMonthErogato > 0) {
      alerts.push({ key: `${row.name}-calo`, dealer: row.name, tipo: 'Dealer in forte calo', severity: 'alta', descrizione: 'Calo erogato oltre soglia del 30% mese su mese.', dato: `${pct(row.growthErogatoPct)} (${euro(row.currentMonthErogato)} vs ${euro(row.previousMonthErogato)})`, suggerimento: 'Verificare se ci sono pratiche bloccate o non ancora liquidate.' });
    }
    const prevTicket = row.previousMonthPratiche ? row.previousMonthErogato / row.previousMonthPratiche : 0;
    const currTicket = row.currentMonthPratiche ? row.currentMonthErogato / row.currentMonthPratiche : 0;
    const ticketDelta = prevTicket > 0 ? (currTicket - prevTicket) / prevTicket : 0;
    if (prevTicket > 0 && ticketDelta <= -0.25) {
      alerts.push({ key: `${row.name}-ticket-calo`, dealer: row.name, tipo: 'Ticket medio in calo', severity: 'media', descrizione: 'Ticket medio in riduzione oltre il 25% sul mese precedente.', dato: `${pct(ticketDelta)} (${euro(currTicket)} vs ${euro(prevTicket)})`, suggerimento: 'Valutare azione commerciale per aumentare il ticket medio.' });
    }
    if (row.currentMonthPratiche > 0 && row.ticketMedio < activeAvgTicket * 0.7) {
      alerts.push({ key: `${row.name}-ticket-basso`, dealer: row.name, tipo: 'Dealer con basso ticket medio', severity: 'bassa', descrizione: 'Ticket medio significativamente inferiore alla media generale.', dato: `${euro(row.ticketMedio)} vs media ${euro(activeAvgTicket)}`, suggerimento: 'Valutare azione commerciale per aumentare il ticket medio.' });
    }
    if (row.growthErogatoPct >= 0.3 && row.previousMonthErogato > 0) {
      alerts.push({ key: `${row.name}-potenziale`, dealer: row.name, tipo: 'Dealer ad alto potenziale', severity: 'positiva', descrizione: 'Crescita erogato superiore al 30% mese su mese.', dato: `${pct(row.growthErogatoPct)} (${euro(row.currentMonthErogato)} vs ${euro(row.previousMonthErogato)})`, suggerimento: 'Presidiare il dealer perché sta crescendo.' });
    }
    const share = currentTotal > 0 ? row.currentMonthErogato / currentTotal : 0;
    if (share > 0.35) {
      alerts.push({ key: `${row.name}-concentrazione`, dealer: row.name, tipo: 'Concentrazione eccessiva', severity: 'media', descrizione: 'Peso del dealer troppo elevato sull’erogato mensile totale.', dato: `${pct(share)} del totale mese`, suggerimento: 'Ridurre la dipendenza da un singolo dealer.' });
    }
    if (row.currentMonthPratiche > 0 && row.currentMonthPratiche < 2 && row.previousMonthPratiche > 0) {
      alerts.push({ key: `${row.name}-volumi`, dealer: row.name, tipo: 'Volumi bassi', severity: 'media', descrizione: 'Dealer attivo in passato ma con volumi molto bassi nel mese corrente.', dato: `${row.currentMonthPratiche} pratiche correnti`, suggerimento: 'Contattare il dealer per capire il motivo del calo.' });
    }
  });
  const weight: Record<AlertSeverity, number> = { alta: 0, media: 1, bassa: 2, positiva: 3 };
  return alerts.sort((a, b) => weight[a.severity] - weight[b.severity]);
}

function buildForecast(rows: AppRow[], year: number, settings: Settings, referenceDate = new Date()) {
  const monthly = monthSeriesFromRows(rows, year);
  const target = Number(settings.annualTargetByYear?.[year] || 0);
  const stagionalita = settings.stagionalitaByYear?.[year] || DEFAULT_2026_STAGIONALITA;
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const monthlyForecast = monthly.map((item, index) => {
    const seasonality = Number(stagionalita[index] || 0);
    const stimato = target ? target * seasonality : 0;
    const workingDays = workingDaysInMonth(year, index);
    const workedDays = year < currentYear ? workingDays : year === currentYear ? workedDaysInMonth(year, index, referenceDate) : 0;
    const mediaGg = workedDays > 0 ? item.erogato / workedDays : 0;
    const ipotetico = mediaGg > 0 ? mediaGg * workingDays : item.erogato || stimato;
    let note = 'Futuro';
    if (year < currentYear || (year === currentYear && index < currentMonth)) note = 'Completato';
    if (year === currentYear && index === currentMonth) note = 'Mese corrente';
    return { ...item, seasonality, stimato, workingDays, workedDays, mediaGg, ipotetico, deltaTarget: item.erogato - stimato, note };
  });
  const ytd = monthlyForecast.reduce((sum, item, index) => {
    if (year < currentYear) return sum + item.erogato;
    if (year === currentYear && index <= currentMonth) return sum + item.erogato;
    return sum;
  }, 0);
  const projectedAnnual = monthlyForecast.reduce((sum, item, index) => {
    if (year < currentYear) return sum + item.erogato;
    if (year > currentYear) return sum + item.stimato;
    if (index < currentMonth) return sum + item.erogato;
    if (index === currentMonth) return sum + Math.max(item.erogato, item.ipotetico, item.stimato);
    return sum + item.stimato;
  }, 0);
  return { annualTarget: target, projectedAnnual, ytd, gapToTarget: target ? projectedAnnual - target : 0, monthlyForecast };
}

function KPI({ title, value, subtitle, icon: Icon, className = '' }: { title: string; value: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; className?: string }) {


  return (
    <div className={`kpi-card ${className}`.trim()}>
      <div>
        <div className="kpi-title">{title}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-subtitle">{subtitle}</div>
      </div>
      <div className="kpi-icon"><Icon className="icon" /></div>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (!AUTH_USERNAME || !AUTH_PASSWORD) return true;
    return sessionStorage.getItem('dealer_erogato_auth_ok') === '1';
  });
  const [authUsernameInput, setAuthUsernameInput] = useState('');
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const handleAuthSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authUsernameInput === AUTH_USERNAME && authPasswordInput === AUTH_PASSWORD) {
      sessionStorage.setItem('dealer_erogato_auth_ok', '1');
      setIsAuthenticated(true);
      setAuthError('');
      return;
    }
    setAuthError('Credenziali non valide.');
  };

  if (!isAuthenticated) {
    return (
      <div className="app-shell">
        <div className="app-container">
          <div className="panel" style={{ maxWidth: 420, margin: '80px auto' }}>
            <div className="panel-header">
              <h3>Area riservata</h3>
              <span>Inserisci le credenziali per continuare</span>
            </div>
            <form className="stack" onSubmit={handleAuthSubmit}>
              <input className="input" placeholder="Username" value={authUsernameInput} onChange={(e) => setAuthUsernameInput(e.target.value)} autoComplete="username" />
              <input className="input" placeholder="Password" type="password" value={authPasswordInput} onChange={(e) => setAuthPasswordInput(e.target.value)} autoComplete="current-password" />
              {authError ? <div className="muted" style={{ color: '#b42318' }}>{authError}</div> : null}
              <button type="submit" className="btn primary">Accedi</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const [rows, setRows] = useState<AppRow[]>([]);
  const [productMonthlyMetrics, setProductMonthlyMetrics] = useState<ProductMonthlyMetric[]>([]);
  const [policyMonthlyMetrics, setPolicyMonthlyMetrics] = useState<PolicyMonthlyMetric[]>([]);
  const [importedFiles, setImportedFiles] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<'executive' | 'trend' | 'focus' | 'forecast' | 'intelligence' | 'alerts' | 'products' | 'subagenti' | 'portfolio' | 'data'>('executive');
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [dealerFilter, setDealerFilter] = useState('ALL');
  const [subagenteFilter, setSubagenteFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('ALL');
  const [uploading, setUploading] = useState(false);
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('empty');
  const [viewGranularity, setViewGranularity] = useState<ViewGranularity>('monthly');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('');
  const [dealerSortKey, setDealerSortKey] = useState<DealerSortKey>('erogato');
  const [selectedDealerDetail, setSelectedDealerDetail] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [portfolioMonthFilter, setPortfolioMonthFilter] = useState('');
  const [branchMonthFilter, setBranchMonthFilter] = useState('ALL');
  const [branchMacroFilter, setBranchMacroFilter] = useState<BranchMacroFilter>('ALL');
  const [dealerWeightView, setDealerWeightView] = useState<'totale' | 'auto' | 'pos'>('totale');
  const [trendYear, setTrendYear] = useState(Number(new Date().getFullYear()));
  const [trendMonthLimit, setTrendMonthLimit] = useState(new Date().getMonth() + 1);
  const [trendPeriodMode, setTrendPeriodMode] = useState<TrendPeriodMode>('ytd');
  const [trendMacroProduct, setTrendMacroProduct] = useState<TrendMacroFilter>('ALL');
  const [trendBranch, setTrendBranch] = useState('ALL');
  const [trendDealer, setTrendDealer] = useState('ALL');

  const primaryMobileTabs: Array<[typeof tab, string, typeof Home]> = [
    ['executive', 'Executive', Home],
    ['trend', 'Andamento', TrendingUp],
    ['focus', 'Focus', CalendarDays],
    ['intelligence', 'Dealer', BriefcaseBusiness],
    ['alerts', 'Alert', Siren],
  ];
  const secondaryTabs: Array<[typeof tab, string, typeof Home]> = [
    ['products', 'Prodotti', Package],
    ['forecast', 'Forecast & Target', Target],
    ['subagenti', 'Filiali', Building2],
    ['portfolio', 'Portafoglio', Boxes],
    ['data', 'Dati / Impostazioni', Settings],
  ];

  const resetFilters = () => {
    setSearch('');
    setYearFilter(String(new Date().getFullYear()));
    setDealerFilter('ALL');
    setSubagenteFilter('ALL');
    setProductFilter('ALL');
    setViewGranularity('monthly');
    setBranchMonthFilter('ALL');
    setBranchMacroFilter('ALL');
    setTrendYear(new Date().getFullYear());
    setTrendMonthLimit(new Date().getMonth() + 1);
    setTrendPeriodMode('ytd');
    setTrendMacroProduct('ALL');
    setTrendBranch('ALL');
    setTrendDealer('ALL');
  };

useEffect(() => {
  const loadData = async () => {
    try {
      const pageSize = 1000;
      let from = 0;
      let done = false;
      let allData: Record<string, unknown>[] = [];

      while (!done) {
        const { data, error } = await supabase
          .from('pratiche')
          .select('*')
          .order('data_liquidazione', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data as Record<string, unknown>[]);
        }

        if (!data || data.length < pageSize) {
          done = true;
        } else {
          from += pageSize;
        }
      }

      if (allData.length > 0) {
        const mapped: AppRow[] = allData
          .map((r: Record<string, unknown>) => {
            const dateValue = typeof r.data_liquidazione === 'string' ? r.data_liquidazione : null;
            const baseDate = dateValue ? new Date(`${dateValue}T12:00:00`) : null;
            const dateISO = baseDate && !Number.isNaN(baseDate.getTime()) ? baseDate.toISOString() : null;
            const prodottoCode = normalizeText(r.prodotto);

            const stableIdentity = normalizeText(r.unique_key) || [
              safeUpper(r.dealer),
              safeUpper(r.cliente),
              safeUpper(r.codice_fiscale),
              prodottoCode,
              cleanNumber(r.importo_finanziato).toFixed(2),
              cleanNumber(r.numero_rate).toString(),
              dateValue || '',
            ].join('|');

            return {
              rowId: stableIdentity,
              stableIdentity,
              sourceFile: normalizeText(r.source_file),
              convenzionato: normalizeText(r.dealer),
              dealer: normalizeText(r.dealer) || 'N/D',
              subagente: normalizeText(r.subagente) || 'N/D',
              agente: '',
              situazione: '',
              cliente: normalizeText(r.cliente) || 'N/D',
              codiceFiscale: normalizeText(r.codice_fiscale),
              prodottoCode,
              prodottoLabel: normalizeProductLabel(prodottoCode),
              tabella: normalizeText(r.tabella),
              numeroRate: cleanNumber(r.numero_rate),
              importoRata: cleanNumber(r.importo_rata),
              importoFinanziato: cleanNumber(r.importo_finanziato),
              importoNettoErogato: cleanNumber(r.importo_finanziato),
              dataCaricamento: null,
              dataLiquidazione: dateISO,
              indirizzo: '',
              cap: '',
              localita: '',
              provincia: '',
              provvigione: cleanNumber(r.provvigione),
              polizza: cleanNumber(r.polizza),
              year: baseDate ? baseDate.getFullYear() : 0,
              month: baseDate ? baseDate.getMonth() + 1 : 0,
              dateISO,
            };
          })
          .filter((row) => row.year > 0);

        setRows(mapped);
        setImportedFiles(Array.from(new Set(mapped.map((row) => row.sourceFile).filter(Boolean))));
        setDataSourceMode('supabase');
        return;
      }
    } catch (error) {
      console.error('Errore caricamento Supabase:', error);
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setDataSourceMode('empty');
        return;
      }
      const parsed = JSON.parse(raw) as {
        rows?: AppRow[];
        importedFiles?: string[];
        settings?: Settings;
        productMonthlyMetrics?: ProductMonthlyMetric[];
        policyMonthlyMetrics?: PolicyMonthlyMetric[];
      };
      setRows(parsed.rows || []);
      setImportedFiles(parsed.importedFiles || []);
      setSettings({ ...DEFAULT_SETTINGS, ...(parsed.settings || {}) });
      setProductMonthlyMetrics(parsed.productMonthlyMetrics || []);
      setPolicyMonthlyMetrics(parsed.policyMonthlyMetrics || []);
      setDataSourceMode((parsed.rows || []).length ? 'local' : 'empty');
    } catch (error) {
      console.error('Errore lettura archivio locale:', error);
      setDataSourceMode('empty');
    }
  };

  loadData();
}, []);
      
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, importedFiles, settings, productMonthlyMetrics, policyMonthlyMetrics }));
  }, [rows, importedFiles, settings, productMonthlyMetrics, policyMonthlyMetrics]);

  const availableYears = useMemo(() => {
    const values = Array.from(new Set([...rows.map((row) => row.year), ...productMonthlyMetrics.map((m) => m.year), ...policyMonthlyMetrics.map((m) => m.year)])).sort((a, b) => a - b);
    return values.length ? values : [new Date().getFullYear()];
  }, [rows, productMonthlyMetrics, policyMonthlyMetrics]);

  useEffect(() => {
    if (!availableYears.includes(Number(yearFilter))) setYearFilter(String(availableYears[availableYears.length - 1]));
  }, [availableYears, yearFilter]);

  useEffect(() => {
    if (!availableYears.includes(trendYear)) setTrendYear(availableYears[availableYears.length - 1]);
  }, [availableYears, trendYear]);

  const trendBranches = useMemo(() => ['ALL', ...Array.from(new Set(rows.map((row) => row.subagente).filter(Boolean))).sort()], [rows]);
  const trendDealers = useMemo(() => ['ALL', ...Array.from(new Set(rows.map((row) => row.dealer).filter(Boolean))).sort()], [rows]);
  const trendFilters = useMemo<TrendFilters>(() => ({
    year: trendYear,
    monthLimit: trendMonthLimit,
    periodMode: trendPeriodMode,
    macroProduct: trendMacroProduct,
    branch: trendBranch,
    dealer: trendDealer,
  }), [trendYear, trendMonthLimit, trendPeriodMode, trendMacroProduct, trendBranch, trendDealer]);
  const trendComparison = useMemo(() => buildYtdTrendComparison(rows, trendFilters), [rows, trendFilters]);
  const trendMonthlySeries = useMemo(() => buildMonthlyYoYSeries(rows, trendFilters), [rows, trendFilters]);
  const trendBranchTable = useMemo(() => buildBranchTrendTable(rows, trendFilters), [rows, trendFilters]);
  const trendMacroMixTable = useMemo(() => buildBranchMacroMixTable(rows, trendFilters), [rows, trendFilters]);
  const trendVariationCauses = useMemo(() => buildTrendVariationCauses(rows, trendFilters), [rows, trendFilters]);
  const trendAlerts = useMemo(() => buildTrendAlerts(rows, trendFilters, trendBranchTable), [rows, trendFilters, trendBranchTable]);
  const trendPeriodLabel = trendPeriodMode === 'ytd' ? `YTD fino a ${MONTHS_IT[trendMonthLimit - 1]}` : `Solo ${MONTHS_IT[trendMonthLimit - 1]}`;
  const formatTrendPct = (value: number | null) => value === null ? 'n.d.' : pct(value);

  const renderTrendCauseDealer = (row: TrendCauseDealerRow) => (
    <div className="list-item" key={`trend-cause-dealer-${row.dealer}`}>
      <div>
        <div className="list-title">{row.dealer}</div>
        <div className="list-subtitle">{row.filialePrevalente} · {euro0(row.currentErogato)} vs {euro0(row.previousErogato)} · pratiche {num(row.currentPratiche)} vs {num(row.previousPratiche)}</div>
        <div className="trend-cause-meta">
          <span className="badge">{row.macroPrevalente}</span>
          {row.status ? <span className="badge">{row.status}</span> : null}
          <span className="muted">Delta %: {formatTrendPct(row.deltaPct)}</span>
        </div>
      </div>
      <div className="list-value">{euro0(row.deltaEuro)}</div>
    </div>
  );

  const currentYear = Number(yearFilter);
  const yearRows = useMemo(() => rows.filter((row) => row.year === currentYear), [rows, currentYear]);
  const dealers = useMemo(() => ['ALL', ...Array.from(new Set(yearRows.map((row) => row.dealer))).sort()], [yearRows]);
  const subagenti = useMemo(() => ['ALL', ...Array.from(new Set(yearRows.map((row) => row.subagente))).sort()], [yearRows]);
  const products = useMemo(() => ['ALL', ...Array.from(new Set(yearRows.map((row) => row.prodottoCode))).sort()], [yearRows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const yearOk = row.year === currentYear;
      const dealerOk = dealerFilter === 'ALL' || row.dealer === dealerFilter;
      const subagenteOk = subagenteFilter === 'ALL' || row.subagente === subagenteFilter;
      const productOk = productFilter === 'ALL' || row.prodottoCode === productFilter;
      const searchPool = [row.dealer, row.subagente, row.cliente, row.localita, row.codiceFiscale, row.tabella].join(' ').toLowerCase();
      const searchOk = !search || searchPool.includes(search.toLowerCase());
      return yearOk && dealerOk && subagenteOk && productOk && searchOk;
    });
  }, [rows, currentYear, dealerFilter, subagenteFilter, productFilter, search]);
  const filteredRowsAllYears = useMemo(() => {
    return rows.filter((row) => {
      const dealerOk = dealerFilter === 'ALL' || row.dealer === dealerFilter;
      const subagenteOk = subagenteFilter === 'ALL' || row.subagente === subagenteFilter;
      const productOk = productFilter === 'ALL' || row.prodottoCode === productFilter;
      const searchPool = [row.dealer, row.subagente, row.cliente, row.localita, row.codiceFiscale, row.tabella].join(' ').toLowerCase();
      const searchOk = !search || searchPool.includes(search.toLowerCase());
      return dealerOk && subagenteOk && productOk && searchOk;
    });
  }, [rows, dealerFilter, subagenteFilter, productFilter, search]);

  const hasExtraFilters = dealerFilter !== 'ALL' || subagenteFilter !== 'ALL' || productFilter !== 'ALL' || Boolean(search);
  const monthlyData = useMemo(() => monthSeriesFromRows(filteredRows, currentYear), [filteredRows, currentYear]);
  const timeSeriesData = useMemo(() => timeSeriesFromRows(filteredRows, currentYear, viewGranularity), [filteredRows, currentYear, viewGranularity]);
  const periodOptions = useMemo(() => {
    if (viewGranularity === 'monthly') {
      const monthsWithData = timeSeriesData.filter((row) => row.pratiche > 0 || row.erogato > 0);
      return monthsWithData.length ? monthsWithData : timeSeriesData;
    }
    return timeSeriesData;
  }, [timeSeriesData, viewGranularity]);
  const branchMonthOptions = useMemo(() => {
    const months = Array.from(new Set(filteredRows.map((row) => row.month))).filter((month) => month >= 1 && month <= 12).sort((a, b) => a - b);
    return months.length ? months : Array.from({ length: 12 }, (_, index) => index + 1);
  }, [filteredRows]);
  const branchFilteredRows = useMemo(() => filteredRows.filter((row) => {
    const monthOk = branchMonthFilter === 'ALL' || row.month === Number(branchMonthFilter);
    const family = getProductFamilyFromCode(row.prodottoCode);
    const macroOk = branchMacroFilter === 'ALL' || family === branchMacroFilter;
    return monthOk && macroOk;
  }), [filteredRows, branchMonthFilter, branchMacroFilter]);
  const branchFilterSummary = useMemo(() => {
    const monthLabel = branchMonthFilter === 'ALL' ? `Tutti i mesi ${currentYear}` : `${MONTHS_IT[Number(branchMonthFilter) - 1]} ${currentYear}`;
    const macroLabel = branchMacroFilter === 'ALL' ? 'Tutti i macroprodotti' : (branchMacroFilter === 'AUTO' ? 'Erogato AUTO' : 'POS');
    return `${monthLabel} · ${macroLabel}`;
  }, [branchMonthFilter, branchMacroFilter, currentYear]);
  const branchFilteredTotals = useMemo(() => ({
    erogato: branchFilteredRows.reduce((sum, row) => sum + row.importoFinanziato, 0),
    pratiche: branchFilteredRows.length,
    provvigioni: branchFilteredRows.reduce((sum, row) => sum + row.provvigione, 0),
    polizze: branchFilteredRows.reduce((sum, row) => sum + row.polizza, 0),
  }), [branchFilteredRows]);
  const branchDealerPeriodRows = useMemo(() => filteredRows.filter((row) => branchMonthFilter === 'ALL' || row.month === Number(branchMonthFilter)), [filteredRows, branchMonthFilter]);
  const branchDealerPeriodLabel = useMemo(() => {
    return branchMonthFilter === 'ALL' ? `Tutti i mesi ${currentYear}` : `${MONTHS_IT[Number(branchMonthFilter) - 1]} ${currentYear}`;
  }, [branchMonthFilter, currentYear]);
  const branchDealerLeaders = useMemo(() => {
    type DealerLeader = { dealer: string; erogato: number; pratiche: number; provvigioni: number; polizze: number; ticketMedio: number };
    type DealerLeaderSegment = {
      label: string;
      totalErogato: number;
      totalPratiche: number;
      dealers: Map<string, Omit<DealerLeader, 'ticketMedio'>>;
      topDealer: DealerLeader | null;
      topDealerPeso: number;
      topDealers: DealerLeader[];
    };
    type BranchDealerLeader = {
      branch: string;
      globale: DealerLeaderSegment;
      auto: DealerLeaderSegment;
      pos: DealerLeaderSegment;
    };
    const createSegment = (label: string): DealerLeaderSegment => ({
      label,
      totalErogato: 0,
      totalPratiche: 0,
      dealers: new Map(),
      topDealer: null,
      topDealerPeso: 0,
      topDealers: [],
    });
    const groups = new Map<string, BranchDealerLeader>();
    const addToSegment = (segment: DealerLeaderSegment, row: AppRow) => {
      const dealer = row.dealer || 'N/D';
      segment.totalErogato += row.importoFinanziato;
      segment.totalPratiche += 1;
      if (!segment.dealers.has(dealer)) segment.dealers.set(dealer, { dealer, erogato: 0, pratiche: 0, provvigioni: 0, polizze: 0 });
      const item = segment.dealers.get(dealer)!;
      item.erogato += row.importoFinanziato;
      item.pratiche += 1;
      item.provvigioni += row.provvigione;
      item.polizze += row.polizza;
    };

    branchDealerPeriodRows.forEach((row) => {
      const family = getProductFamilyFromCode(row.prodottoCode);
      if (family === 'ALTRO') return;
      const branch = row.subagente || 'N/D';
      if (!groups.has(branch)) {
        groups.set(branch, {
          branch,
          globale: createSegment('Globale'),
          auto: createSegment('Erogato AUTO'),
          pos: createSegment('POS'),
        });
      }
      const group = groups.get(branch)!;
      addToSegment(group.globale, row);
      addToSegment(family === 'AUTO' ? group.auto : group.pos, row);
    });

    const finalizeSegment = (segment: DealerLeaderSegment) => {
      const topDealers = Array.from(segment.dealers.values())
        .map((dealer) => ({ ...dealer, ticketMedio: dealer.pratiche ? dealer.erogato / dealer.pratiche : 0 }))
        .sort((a, b) => b.erogato - a.erogato);
      const topDealer = topDealers[0] || null;
      return {
        ...segment,
        topDealer,
        topDealerPeso: topDealer && segment.totalErogato > 0 ? topDealer.erogato / segment.totalErogato : 0,
        topDealers: topDealers.slice(0, 3),
      };
    };

    return Array.from(groups.values())
      .map((group) => ({
        branch: group.branch,
        globale: finalizeSegment(group.globale),
        auto: finalizeSegment(group.auto),
        pos: finalizeSegment(group.pos),
      }))
      .sort((a, b) => b.globale.totalErogato - a.globale.totalErogato || a.branch.localeCompare(b.branch));
  }, [branchDealerPeriodRows]);
  const subagenteRanking = useMemo(() => aggregateByField(branchFilteredRows, currentYear, 'subagente').slice(0, 12), [branchFilteredRows, currentYear]);
  const subagenteTable = useMemo(() => aggregateByField(branchFilteredRows, currentYear, 'subagente'), [branchFilteredRows, currentYear]);
  const mix = useMemo(() => productMix(filteredRows, currentYear), [filteredRows, currentYear]);
  const forecast = useMemo(() => buildForecast(filteredRows, currentYear, settings, new Date()), [filteredRows, currentYear, settings]);

  const comparisonYears = useMemo(() => {
    const previous = currentYear - 1;
    if (!availableYears.includes(previous)) return [] as Record<string, number | string>[];
    const currentData = monthSeriesFromRows(rows, currentYear);
    const previousData = monthSeriesFromRows(rows, previous);
    return currentData.map((row, index) => ({ month: row.monthShort, [currentYear]: row.erogato, [previous]: previousData[index]?.erogato || 0 }));
  }, [rows, currentYear, availableYears]);

  useEffect(() => {
    if (!periodOptions.length) {
      setSelectedPeriodKey('');
      return;
    }
    const hasCurrent = periodOptions.some((row) => (viewGranularity === 'monthly' ? String(row.monthIndex) : row.key) === selectedPeriodKey);
    if (!hasCurrent) {
      const fallback = periodOptions[periodOptions.length - 1];
      setSelectedPeriodKey(viewGranularity === 'monthly' ? String(fallback.monthIndex) : fallback.key);
    }
  }, [periodOptions, selectedPeriodKey, viewGranularity]);

  const selectedPeriodRows = useMemo(() => {
    if (!selectedPeriodKey) return [];
    return [...filteredRows]
      .filter((row) => rowMatchesPeriod(row, viewGranularity, selectedPeriodKey))
      .sort((a, b) => new Date(b.dateISO || 0).getTime() - new Date(a.dateISO || 0).getTime());
  }, [filteredRows, viewGranularity, selectedPeriodKey]);

  const selectedPeriodSummary = useMemo(() => {
    if (!selectedPeriodRows.length) return null;
    return {
      erogato: selectedPeriodRows.reduce((sum, row) => sum + row.importoFinanziato, 0),
      pratiche: selectedPeriodRows.length,
      provvigioni: selectedPeriodRows.reduce((sum, row) => sum + row.provvigione, 0),
      polizze: selectedPeriodRows.reduce((sum, row) => sum + row.polizza, 0),
    };
  }, [selectedPeriodRows]);

  const selectedPeriodMeta = useMemo(() => {
    return periodOptions.find((row) => (viewGranularity === 'monthly' ? String(row.monthIndex) : row.key) === selectedPeriodKey) || null;
  }, [periodOptions, selectedPeriodKey, viewGranularity]);
  const dailyExecutiveData = useMemo(() => {
    const map = new Map<string, { key: string; label: string; fullLabel: string; erogato: number; pratiche: number }>();
    filteredRows.forEach((row) => {
      if (!row.dateISO) return;
      if (!map.has(row.dateISO)) {
        const date = new Date(row.dateISO);
        map.set(row.dateISO, {
          key: row.dateISO,
          label: date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
          fullLabel: date.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
          erogato: 0,
          pratiche: 0,
        });
      }
      const bucket = map.get(row.dateISO)!;
      bucket.erogato += row.importoFinanziato;
      bucket.pratiche += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredRows]);
  const [selectedExecutiveDayKey, setSelectedExecutiveDayKey] = useState('');
  useEffect(() => {
    if (!dailyExecutiveData.length) {
      if (selectedExecutiveDayKey) setSelectedExecutiveDayKey('');
      return;
    }
    if (!dailyExecutiveData.some((item) => item.key === selectedExecutiveDayKey)) {
      setSelectedExecutiveDayKey(dailyExecutiveData[dailyExecutiveData.length - 1].key);
    }
  }, [dailyExecutiveData, selectedExecutiveDayKey]);
  const selectedExecutiveDayIndex = dailyExecutiveData.findIndex((item) => item.key === selectedExecutiveDayKey);
  const selectedExecutiveDay = selectedExecutiveDayIndex >= 0 ? dailyExecutiveData[selectedExecutiveDayIndex] : null;
  const goExecutiveDay = (direction: -1 | 1) => {
    if (!dailyExecutiveData.length || selectedExecutiveDayIndex < 0) return;
    const nextIndex = selectedExecutiveDayIndex + direction;
    if (nextIndex < 0 || nextIndex >= dailyExecutiveData.length) return;
    setSelectedExecutiveDayKey(dailyExecutiveData[nextIndex].key);
  };

  const periodLabel = viewGranularity === 'monthly' ? 'mese' : viewGranularity === 'weekly' ? 'settimana' : 'giorno';
  const chartTitle = viewGranularity === 'monthly' ? 'Erogato mese per mese' : viewGranularity === 'weekly' ? 'Erogato settimana per settimana' : 'Erogato giorno per giorno';

  const policyTotalsForYear = useMemo(() => {
    const totals = new Map<number, number>();
    policyMonthlyMetrics.filter((m) => m.year === currentYear && m.dealer === '__TOTAL__').forEach((m) => totals.set(m.month, m.amount));
    return totals;
  }, [policyMonthlyMetrics, currentYear]);
  const dealerPolicyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    policyMonthlyMetrics.filter((m) => m.year === currentYear && m.dealer !== '__TOTAL__').forEach((m) => totals.set(m.dealer, (totals.get(m.dealer) || 0) + m.amount));
    return totals;
  }, [policyMonthlyMetrics, currentYear]);

  const productMonthlySeries = useMemo(() => {
    // Fonte di verità: DATABASE.
    // Regola operativa:
    // AUTO = 20, 21, 23, 36
    // POS = tutto il resto.
    // Usiamo sempre le righe filtrate del DATABASE per evitare mismatch del foglio pivot.
    const fromRows = productSeriesFromRows(filteredRows, currentYear);
    const hasValues = fromRows.some((row) => row.AUTO > 0 || row.POS > 0);
    if (hasValues) return fromRows;

    // Fallback solo se non ci sono righe disponibili.
    const fromMetrics = productSeriesFromMetrics(productMonthlyMetrics, currentYear);
    return fromMetrics;
  }, [filteredRows, currentYear, productMonthlyMetrics]);
  const commissionMonthlyByProductSeries = useMemo(() => commissionsByProductSeries(filteredRows, currentYear), [filteredRows, currentYear]);
  const productMonthlyTotals = useMemo(() => productMonthlySeries.reduce((acc, row) => ({
    auto: acc.auto + row.AUTO,
    pos: acc.pos + row.POS,
  }), { auto: 0, pos: 0 }), [productMonthlySeries]);
  const commissionMonthlyByProductTotals = useMemo(() => commissionMonthlyByProductSeries.reduce((acc, row) => ({
    auto: acc.auto + row.AUTO,
    pos: acc.pos + row.POS,
  }), { auto: 0, pos: 0 }), [commissionMonthlyByProductSeries]);

  const kpis = useMemo(() => {
    const erogato = filteredRows.reduce((sum, row) => sum + row.importoFinanziato, 0);
    const pratiche = filteredRows.length;
    const provvigioni = filteredRows.reduce((sum, row) => sum + row.provvigione, 0);
    let polizze = filteredRows.reduce((sum, row) => sum + row.polizza, 0);
    if (subagenteFilter === 'ALL' && productFilter === 'ALL' && !search) {
      if (dealerFilter === 'ALL' && policyTotalsForYear.size > 0) {
        polizze = Array.from(policyTotalsForYear.values()).reduce((sum, value) => sum + value, 0);
      } else if (dealerFilter !== 'ALL' && dealerPolicyTotals.has(dealerFilter)) {
        polizze = dealerPolicyTotals.get(dealerFilter) || 0;
      }
    }
    const dealerCount = new Set(filteredRows.map((row) => row.dealer)).size;
    return { erogato, pratiche, ticketMedio: pratiche ? erogato / pratiche : 0, provvigioni, polizze, dealerCount };
  }, [filteredRows, dealerFilter, subagenteFilter, productFilter, search, policyTotalsForYear, dealerPolicyTotals]);

  const referenceMonth = useMemo(() => {
    const byYear = filteredRows.filter((row) => row.year === currentYear);
    if (!byYear.length) return new Date().getMonth() + 1;
    return Math.max(...byYear.map((row) => row.month));
  }, [filteredRows, currentYear]);

  const smartDealerTable = useMemo(() => {
    const data = buildSmartDealerRows(filteredRows, currentYear, referenceMonth);
    const sorters: Record<DealerSortKey, (a: SmartDealerRow, b: SmartDealerRow) => number> = {
      erogato: (a, b) => b.erogato - a.erogato,
      crescitaPct: (a, b) => b.growthErogatoPct - a.growthErogatoPct,
      ticketMedio: (a, b) => b.ticketMedio - a.ticketMedio,
      provvigioni: (a, b) => b.provvigioni - a.provvigioni,
    };
    return data.sort(sorters[dealerSortKey]);
  }, [filteredRows, currentYear, referenceMonth, dealerSortKey]);

  const dealerRanking = useMemo(() => smartDealerTable.slice(0, 12), [smartDealerTable]);
  const dealerDetail = useMemo(() => {
    if (!selectedDealerDetail) return null;
    const dealerRows = filteredRowsAllYears
      .filter((row) => row.dealer === selectedDealerDetail && row.dateISO)
      .sort((a, b) => new Date(a.dateISO || 0).getTime() - new Date(b.dateISO || 0).getTime());
    if (!dealerRows.length) return null;
    const nowDate = new Date();
    const latestDate = new Date(dealerRows[dealerRows.length - 1].dateISO!);
    const analysisDate = currentYear === nowDate.getFullYear() ? nowDate : latestDate;
    const currentMonth = analysisDate.getMonth() + 1;
    const prevMonthDate = new Date(analysisDate.getFullYear(), analysisDate.getMonth() - 1, 1);
    const currentYearValue = analysisDate.getFullYear();
    const prevYearValue = currentYearValue - 1;
    const ytdMonthLimit = currentMonth;

    const sum = (list: AppRow[]) => list.reduce((acc, row) => acc + row.importoFinanziato, 0);
    const count = (list: AppRow[]) => list.length;
    const ticket = (list: AppRow[]) => list.length ? sum(list) / list.length : 0;

    const last12Start = new Date(currentYearValue, currentMonth - 12, 1);
    const last12Rows = dealerRows.filter((r) => new Date(r.dateISO!) >= last12Start && new Date(r.dateISO!) <= analysisDate);
    const currentYearRows = dealerRows.filter((r) => r.year === currentYearValue);
    const ytdCurrentRows = dealerRows.filter((r) => r.year === currentYearValue && r.month <= ytdMonthLimit);
    const ytdPrevRows = dealerRows.filter((r) => r.year === prevYearValue && r.month <= ytdMonthLimit);
    const currentMonthRows = dealerRows.filter((r) => r.year === currentYearValue && r.month === currentMonth);
    const previousMonthRows = dealerRows.filter((r) => r.year === prevMonthDate.getFullYear() && r.month === (prevMonthDate.getMonth() + 1));

    const monthlyMap = new Map<string, { month: string; erogato: number; pratiche: number; ticketMedio: number; date: Date }>();
    dealerRows.forEach((r) => {
      const d = new Date(r.dateISO!);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const prev = monthlyMap.get(key);
      const erogato = (prev?.erogato || 0) + r.importoFinanziato;
      const pratiche = (prev?.pratiche || 0) + 1;
      monthlyMap.set(key, {
        month: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`,
        erogato,
        pratiche,
        ticketMedio: pratiche ? erogato / pratiche : 0,
        date: new Date(d.getFullYear(), d.getMonth(), 1),
      });
    });
    const last12Monthly = Array.from(monthlyMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-12);
    const insights: DealerDetailInsight[] = [];
    const ytdDelta = sum(ytdCurrentRows) - sum(ytdPrevRows);
    insights.push({ key: 'ytd', label: ytdDelta >= 0 ? 'Dealer in crescita rispetto allo stesso periodo dell’anno precedente' : 'Dealer in calo rispetto allo stesso periodo dell’anno precedente', positive: ytdDelta >= 0 });
    const monthDelta = sum(currentMonthRows) - sum(previousMonthRows);
    insights.push({ key: 'month', label: monthDelta >= 0 ? 'Il mese corrente è superiore al mese precedente' : 'Il mese corrente è inferiore al mese precedente', positive: monthDelta >= 0 });
    const praticheDelta = count(currentMonthRows) - count(previousMonthRows);
    insights.push({ key: 'pratiche', label: praticheDelta >= 0 ? 'Numero pratiche in aumento' : 'Numero pratiche in diminuzione', positive: praticheDelta >= 0 });
    const ticketDelta = ticket(currentMonthRows) - ticket(previousMonthRows);
    insights.push({ key: 'ticket', label: ticketDelta >= 0 ? 'Ticket medio in crescita' : 'Ticket medio in calo', positive: ticketDelta >= 0 });

    return { dealerRows, last12Monthly, insights, currentMonth, currentYearValue, prevYearValue, ytdMonthLimit, currentMonthRows, previousMonthRows, ytdCurrentRows, ytdPrevRows, currentYearRows, last12Rows, sum, count, ticket };
  }, [selectedDealerDetail, filteredRowsAllYears, currentYear]);
  const dealerAlerts = useMemo(() => buildDealerAlerts(smartDealerTable), [smartDealerTable]);
  const bestMonthYtd = useMemo(
    () => findBestMonthYtd(filteredRowsAllYears, currentYear, referenceMonth),
    [filteredRowsAllYears, currentYear, referenceMonth],
  );

  const dailyProgressComparison = useMemo(() => {
    const base = buildDailyProgressComparison(filteredRowsAllYears, currentYear, referenceMonth);

    const ytdMonths = Array.from({ length: referenceMonth }, (_, index) => index + 1);
    const cumulativeByMonth = new Map<number, number[]>();

    ytdMonths.forEach((month) => {
      const monthRows = filteredRowsAllYears.filter(
        (row) => row.year === currentYear && row.month === month && row.dateISO,
      );
      const dailyTotals = new Map<number, number>();

      monthRows.forEach((row) => {
        const day = new Date(row.dateISO!).getDate();
        dailyTotals.set(day, (dailyTotals.get(day) || 0) + row.importoFinanziato);
      });

      let cumulative = 0;
      const cumulativeSeries = base.map((row) => {
        cumulative += dailyTotals.get(row.day) || 0;
        return cumulative;
      });

      cumulativeByMonth.set(month, cumulativeSeries);
    });

    const withYearAverage = base.map((row, index) => {
      const total = ytdMonths.reduce(
        (sum, month) => sum + (cumulativeByMonth.get(month)?.[index] || 0),
        0,
      );
      const mediaAnnoCorrente = ytdMonths.length ? total / ytdMonths.length : 0;
      return { ...row, mediaAnnoCorrente };
    });

    if (!bestMonthYtd) {
      return withYearAverage.map((row) => ({ ...row, meseMiglioreYtd: 0 }));
    }

    const bestMonthRows = filteredRowsAllYears.filter(
      (row) => row.year === currentYear && row.month === bestMonthYtd && row.dateISO,
    );

    const bestDailyTotals = new Map<number, number>();
    bestMonthRows.forEach((row) => {
      const day = new Date(row.dateISO!).getDate();
      bestDailyTotals.set(day, (bestDailyTotals.get(day) || 0) + row.importoFinanziato);
    });

    let bestCumulative = 0;
    return withYearAverage.map((row) => {
      bestCumulative += bestDailyTotals.get(row.day) || 0;
      return { ...row, meseMiglioreYtd: bestCumulative };
    });
  }, [filteredRowsAllYears, currentYear, referenceMonth, bestMonthYtd]);

 async function handleFiles(fileList: FileList | null) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  setUploading(true);

  try {
    let importedRows: AppRow[] = [];
    let importedProducts: ProductMonthlyMetric[] = [];
    let importedPolicies: PolicyMonthlyMetric[] = [];
    const fileNames: string[] = [];

    for (const file of files) {
      const parsed = await readWorkbookFile(file);
      importedRows = importedRows.concat(normalizeImportedRows(parsed.rows, parsed.fileName));
      importedProducts = importedProducts.concat(parsed.productMonthly);
      importedPolicies = importedPolicies.concat(parsed.policyMonthly);
      fileNames.push(parsed.fileName);
    }

    const dedupedImportedRows = Array.from(
      new Map(importedRows.map((row) => [row.stableIdentity, row])).values()
    );

    const payloadMap = new Map<string, {
      unique_key: string;
      data_liquidazione: string | null;
      importo_finanziato: number;
      prodotto: number | null;
      dealer: string;
      subagente: string;
      provvigione: number;
      polizza: number;
      cliente: string;
      codice_fiscale: string;
      tabella: string;
      numero_rate: number;
      importo_rata: number;
      source_file: string;
    }>();

    for (const row of dedupedImportedRows) {
      const uniqueKey = String(row.stableIdentity || '').trim();
      if (!uniqueKey) continue;

      payloadMap.set(uniqueKey, {
        unique_key: uniqueKey,
        data_liquidazione: row.dateISO
          ? new Date(row.dateISO).toISOString().slice(0, 10)
          : null,
        importo_finanziato: Number(row.importoFinanziato || 0),
        prodotto: Number.isFinite(Number(row.prodottoCode)) ? Number(row.prodottoCode) : null,
        dealer: row.dealer || '',
        subagente: row.subagente || '',
        provvigione: Number(row.provvigione || 0),
        polizza: Number(row.polizza || 0),
        cliente: row.cliente || '',
        codice_fiscale: row.codiceFiscale || '',
        tabella: row.tabella || '',
        numero_rate: Number(row.numeroRate || 0),
        importo_rata: Number(row.importoRata || 0),
        source_file: row.sourceFile || ''
      });
    }

    const payload = Array.from(payloadMap.values());
    const chunkSize = 50;

    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const response = await fetch('/api/upsert-pratiche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: chunk }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.error || result?.details || `HTTP ${response.status}`;
        console.error('Errore API upsert-pratiche:', result || message, chunk);
        window.alert(`Errore nel salvataggio su Supabase: ${message}`);
        throw new Error(message);
      }
    }

    setRows((previous) => mergeRows(previous, dedupedImportedRows));
    setProductMonthlyMetrics((previous) => mergeMetrics(previous, importedProducts));
    setPolicyMonthlyMetrics((previous) => mergeMetrics(previous, importedPolicies));
    setImportedFiles((previous) => Array.from(new Set([...previous, ...fileNames])));
    setDataSourceMode('supabase');
  } catch (error) {
    console.error('Errore upload Excel:', error);
    if (error instanceof Error && !String(error.message).includes('Errore nel salvataggio su Supabase')) {
      window.alert(`Errore nel salvataggio su Supabase: ${error.message || 'errore sconosciuto'}`);
    }
  } finally {
    setUploading(false);
  }
}


  function clearArchive() {
    setRows([]);
    setImportedFiles([]);
    setProductMonthlyMetrics([]);
    setPolicyMonthlyMetrics([]);
    setSettings(DEFAULT_SETTINGS);
    window.localStorage.removeItem(STORAGE_KEY);
    setDataSourceMode('empty');
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ rows, importedFiles, settings, productMonthlyMetrics, policyMonthlyMetrics }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dealer-erogato-backup.json';
    link.click();
    URL.revokeObjectURL(url);
  }



  function exportDealerGrowthPdf() {
    if (!dealerDetail || !selectedDealerDetail) return;

    const formatPct = (value: number | null) => value === null ? 'n/d' : `${num(value * 100, 1)}%`;
    const ytdErogatoCurrent = dealerDetail.sum(dealerDetail.ytdCurrentRows);
    const ytdErogatoPrev = dealerDetail.sum(dealerDetail.ytdPrevRows);
    const ytdPraticheCurrent = dealerDetail.count(dealerDetail.ytdCurrentRows);
    const ytdPratichePrev = dealerDetail.count(dealerDetail.ytdPrevRows);
    const ytdTicketCurrent = dealerDetail.ticket(dealerDetail.ytdCurrentRows);
    const ytdTicketPrev = dealerDetail.ticket(dealerDetail.ytdPrevRows);

    const printable = window.open('', '_blank');
    if (!printable) return;

    const monthlyRows = dealerDetail.last12Monthly.map((m) => `
      <tr>
        <td>${m.month}</td>
        <td class="right">${euro(m.erogato)}</td>
        <td class="right">${num(m.pratiche)}</td>
        <td class="right">${euro(m.ticketMedio)}</td>
      </tr>`).join('');

    const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>Report Crescita ${selectedDealerDetail}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 28px; color: #0f172a; }
  .header { border-bottom: 2px solid #0ea5e9; padding-bottom: 12px; margin-bottom: 16px; }
  .title { font-size: 24px; font-weight: 700; }
  .subtitle { color: #334155; margin-top: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 16px 0; }
  .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; background: #f8fafc; }
  .label { font-size: 11px; color: #475569; text-transform: uppercase; }
  .value { font-size: 18px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; }
  th { background: #e2e8f0; text-align: left; }
  .right { text-align: right; }
  .foot { margin-top: 16px; font-size: 11px; color: #64748b; }
  @media print { body { margin: 16px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="title">Report crescita convenzione</div>
    <div class="subtitle">Dealer: <strong>${selectedDealerDetail}</strong> · Generato il ${new Date().toLocaleDateString('it-IT')}</div>
  </div>

  <div class="grid">
    <div class="card"><div class="label">Erogato ultimi 12 mesi</div><div class="value">${euro0(dealerDetail.sum(dealerDetail.last12Rows))}</div></div>
    <div class="card"><div class="label">Crescita YTD erogato</div><div class="value">${euro0(ytdErogatoCurrent - ytdErogatoPrev)} (${formatPct(diffPct(ytdErogatoCurrent, ytdErogatoPrev))})</div></div>
    <div class="card"><div class="label">Crescita YTD pratiche</div><div class="value">${num(ytdPraticheCurrent - ytdPratichePrev)} (${formatPct(diffPct(ytdPraticheCurrent, ytdPratichePrev))})</div></div>
    <div class="card"><div class="label">YTD ${dealerDetail.currentYearValue}</div><div class="value">${euro0(ytdErogatoCurrent)}</div></div>
    <div class="card"><div class="label">YTD ${dealerDetail.prevYearValue}</div><div class="value">${euro0(ytdErogatoPrev)}</div></div>
    <div class="card"><div class="label">Ticket YTD ${dealerDetail.currentYearValue} vs ${dealerDetail.prevYearValue}</div><div class="value">${euro0(ytdTicketCurrent)} / ${euro0(ytdTicketPrev)}</div></div>
  </div>

  <h3>Andamento ultimi 12 mesi</h3>
  <table>
    <thead><tr><th>Mese</th><th class="right">Erogato</th><th class="right">Pratiche</th><th class="right">Ticket medio</th></tr></thead>
    <tbody>${monthlyRows}</tbody>
  </table>

  <div class="foot">Documento ottimizzato per stampa PDF (A4): usa "Salva come PDF" nella finestra di stampa.</div>

  <script>window.onload = () => { setTimeout(() => window.print(), 250); };</script>
</body>
</html>`;

    printable.document.open();
    printable.document.write(html);
    printable.document.close();
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result || '{}')) as {
          rows?: AppRow[];
          importedFiles?: string[];
          settings?: Settings;
          productMonthlyMetrics?: ProductMonthlyMetric[];
          policyMonthlyMetrics?: PolicyMonthlyMetric[];
        };
        setRows(parsed.rows || []);
        setImportedFiles(parsed.importedFiles || []);
        setSettings({ ...DEFAULT_SETTINGS, ...(parsed.settings || {}) });
        setProductMonthlyMetrics(parsed.productMonthlyMetrics || []);
        setPolicyMonthlyMetrics(parsed.policyMonthlyMetrics || []);
        setDataSourceMode((parsed.rows || []).length ? 'local' : 'empty');
      } catch {
        window.alert('Backup non valido');
      }
    };
    reader.readAsText(file);
  }

  const progress = forecast.annualTarget ? Math.min((forecast.projectedAnnual / forecast.annualTarget) * 100, 100) : 0;
  const quarterlyProgress = useMemo(() => {
    const quarters = [
      { label: 'Q1', start: 0, end: 2 },
      { label: 'Q2', start: 3, end: 5 },
      { label: 'Q3', start: 6, end: 8 },
      { label: 'Q4', start: 9, end: 11 },
    ];
    return quarters.map((quarter) => {
      const months = forecast.monthlyForecast.slice(quarter.start, quarter.end + 1);
      const target = months.reduce((sum, month) => sum + month.stimato, 0);
      const actual = months.reduce((sum, month) => sum + month.erogato, 0);
      const projected = months.reduce((sum, month) => sum + Math.max(month.erogato, month.ipotetico, month.stimato), 0);
      const coverage = target > 0 ? projected / target : 0;
      return { ...quarter, target, actual, projected, coverage };
    });
  }, [forecast.monthlyForecast]);
  const now = new Date();
  const fallbackCurrentMonth = [...monthlyData].reverse().find((row) => row.erogato > 0)?.monthIndex || 1;
  const currentMonthIndex = currentYear === now.getFullYear() ? now.getMonth() + 1 : fallbackCurrentMonth;
  const currentMonthCard = monthlyData[currentMonthIndex - 1];
  const currentMonthLabel = MONTHS_IT[currentMonthIndex - 1];
  const previousYearSameMonth = monthSeriesFromRows(rows, currentYear - 1)[currentMonthIndex - 1];
  const monthVsPrevYear = previousYearSameMonth?.erogato ? (currentMonthCard?.erogato || 0) / previousYearSameMonth.erogato - 1 : 0;
  const previousMonthDate = new Date(currentYear, currentMonthIndex - 2, 1);
  const previousMonthYear = previousMonthDate.getFullYear();
  const previousMonthIndex = previousMonthDate.getMonth() + 1;
  const nowReference = new Date();
  const currentMonthWorkedDays = currentYear === nowReference.getFullYear() && currentMonthIndex === (nowReference.getMonth() + 1)
    ? workedDaysInMonth(currentYear, currentMonthIndex - 1, nowReference)
    : workingDaysInMonth(currentYear, currentMonthIndex - 1);
  const previousMonthCutoffDate = dateAtWorkingDayIndex(previousMonthYear, previousMonthIndex - 1, currentMonthWorkedDays);
  const currentMonthYtdErogato = filteredRowsAllYears.reduce((sum, row) => {
    if (row.year !== currentYear || row.month !== currentMonthIndex || !row.dateISO) return sum;
    const day = new Date(row.dateISO);
    if (day.getDay() === 0 || day.getDay() === 6) return sum;
    if (currentYear === nowReference.getFullYear() && currentMonthIndex === (nowReference.getMonth() + 1) && day > nowReference) return sum;
    return sum + row.importoFinanziato;
  }, 0);
  const previousMonthComparableErogato = filteredRowsAllYears.reduce((sum, row) => {
    if (row.year !== previousMonthYear || row.month !== previousMonthIndex || !row.dateISO || !previousMonthCutoffDate) return sum;
    const day = new Date(row.dateISO);
    if (day.getDay() === 0 || day.getDay() === 6 || day > previousMonthCutoffDate) return sum;
    return sum + row.importoFinanziato;
  }, 0);
  const monthVsPrevMonth = previousMonthComparableErogato > 0 ? (currentMonthYtdErogato / previousMonthComparableErogato) - 1 : 0;
  const topFiveDealers = smartDealerTable.slice(0, 5);
  const alertsBySeverity = useMemo(() => ({
    alta: dealerAlerts.filter((a) => a.severity === 'alta'),
    media: dealerAlerts.filter((a) => a.severity === 'media'),
    bassa: dealerAlerts.filter((a) => a.severity === 'bassa'),
    positiva: dealerAlerts.filter((a) => a.severity === 'positiva'),
  }), [dealerAlerts]);
  const dataQuality = useMemo(() => {
    const duplicates = new Map<string, number>();
    rows.forEach((r) => duplicates.set(r.stableIdentity, (duplicates.get(r.stableIdentity) || 0) + 1));
    return {
      dealerND: rows.filter((r) => !r.dealer || r.dealer === 'N/D').length,
      prodottoMancante: rows.filter((r) => !r.prodottoCode).length,
      provvigioneZero: rows.filter((r) => r.provvigione === 0).length,
      importiAnomali: rows.filter((r) => r.importoFinanziato > 200000 || r.importoFinanziato < 300).length,
      dateMancanti: rows.filter((r) => !r.dateISO).length,
      duplicate: Array.from(duplicates.values()).filter((v) => v > 1).length,
    };
  }, [rows]);

  const dealerWeightAnalytics = useMemo(() => {
    const { stats, totalErogato, totalAutoDealers, totalPosDealers } = buildDealerPortfolioStats(filteredRows);
    const autoStats = stats.filter((row) => row.category === 'AUTO');
    const posStats = stats.filter((row) => row.category === 'POS');
    const topDealer = stats[0] || null;
    const top5Peso = stats.slice(0, 5).reduce((sum, row) => sum + row.pesoTotalePct, 0);
    const topAutoDealer = autoStats[0] || null;
    const topPosDealer = posStats[0] || null;
    return { stats, autoStats, posStats, totalErogato, totalAutoDealers, totalPosDealers, topDealer, top5Peso, topAutoDealer, topPosDealer };
  }, [filteredRows]);


  const dealerWeightViewData = useMemo(() => {
    const baseRows = dealerWeightView === 'totale'
      ? dealerWeightAnalytics.stats
      : dealerWeightView === 'auto'
        ? dealerWeightAnalytics.autoStats
        : dealerWeightAnalytics.posStats;
    const tableRows = baseRows.slice(0, 15);
    const chartRows = baseRows.slice(0, 10).map((row) => ({ dealer: row.dealer, erogato: row.erogato, category: row.category }));
    const otherRows = baseRows.slice(10);
    if (otherRows.length) {
      chartRows.push({
        dealer: 'Altri dealer',
        erogato: otherRows.reduce((sum, row) => sum + row.erogato, 0),
        category: dealerWeightView === 'pos' ? 'POS' : 'AUTO',
      });
    }
    const subtitle = dealerWeightView === 'totale'
      ? 'Incidenza dei principali dealer sull’erogato filtrato'
      : dealerWeightView === 'auto'
        ? 'Incidenza dei dealer AUTO sul totale dealer AUTO'
        : 'Incidenza dei dealer POS sul totale dealer POS';
    return { tableRows, chartRows, subtitle };
  }, [dealerWeightView, dealerWeightAnalytics]);

  const portfolioMonthOptions = useMemo(() => {
    const months = new Map<string, { key: string; year: number; month: number; label: string }>();
    filteredRows.forEach((row) => {
      if (!row.dateISO || !row.year || !row.month) return;
      const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
      if (!months.has(key)) months.set(key, { key, year: row.year, month: row.month, label: `${MONTHS_IT[row.month - 1]} ${row.year}` });
    });
    return Array.from(months.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredRows]);

  useEffect(() => {
    if (!portfolioMonthOptions.length) {
      if (portfolioMonthFilter) setPortfolioMonthFilter('');
      return;
    }
    const currentMonthKey = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const hasCurrentMonth = portfolioMonthOptions.some((m) => m.key === currentMonthKey);
    const fallback = portfolioMonthOptions[portfolioMonthOptions.length - 1]?.key || '';
    const desired = hasCurrentMonth ? currentMonthKey : fallback;
    if (!portfolioMonthFilter || !portfolioMonthOptions.some((m) => m.key === portfolioMonthFilter)) {
      setPortfolioMonthFilter(desired);
    }
  }, [portfolioMonthOptions, portfolioMonthFilter, currentYear]);

  const portfolioLatestRows = useMemo(() => {
    if (!portfolioMonthFilter) return [];
    return [...filteredRows]
      .filter((row) => row.dateISO && `${row.year}-${String(row.month).padStart(2, '0')}` === portfolioMonthFilter)
      .sort((a, b) => new Date(b.dateISO || 0).getTime() - new Date(a.dateISO || 0).getTime())
      .slice(0, 200);
  }, [filteredRows, portfolioMonthFilter]);

  const sectionTitles: Record<typeof tab, string> = {
    executive: 'Executive Dashboard',
    trend: 'Andamento',
    focus: 'Focus Mese',
    intelligence: 'Dealer Intelligence',
    alerts: 'Alert Center',
    products: 'Prodotti',
    forecast: 'Forecast & Target',
    subagenti: 'Filiali',
    portfolio: 'Portafoglio',
    data: 'Dati / Impostazioni',
  };

  return (
    <div className="app-shell">
      <div className="main-layout">
        <aside className="sidebar">
          <div className="sidebar-brand">Dealer Erogato App</div>
          <div className="mobile-nav"><Menu className="icon" /> Navigazione</div>
          {[...primaryMobileTabs, ...secondaryTabs].map(([key, label, Icon]) => (
            <button key={key} className={`sidebar-item ${tab === key ? 'active' : ''}`} onClick={() => setTab(key as typeof tab)}>
              <Icon className="icon" /> <span>{label}</span>
            </button>
          ))}
        </aside>
        <div className="main-area">
          <header className="topbar">
            <div>
              <div className="topbar-title">{sectionTitles[tab]}</div>
              <div className="topbar-meta">
                <span className="topbar-chip">Anno: {currentYear}</span>
                <span className="topbar-chip">Fonte: {dataSourceMode === 'supabase' ? 'Supabase' : dataSourceMode === 'local' ? 'Locale' : 'Vuoto'}</span>
                <span className="topbar-chip">Pratiche: {num(rows.length)}</span>
              </div>
            </div>
            <div className="hero-actions">
              <div className="desktop-actions">
                <label className="action-button primary"><Upload className="icon" /><span>{uploading ? 'Importazione...' : 'Carica Excel'}</span><input type="file" accept=".xlsx,.xlsm,.xls" multiple hidden onChange={(e) => handleFiles(e.target.files)} /></label>
                <button className="action-button" onClick={exportBackup}><Download className="icon" />Backup</button>
                <label className="action-button"><RefreshCw className="icon" /><span>Importa backup</span><input type="file" accept=".json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) importBackup(file); }} /></label>
                <button className="action-button danger" onClick={clearArchive}><Trash2 className="icon" />Azzera archivio</button>
              </div>
              <div className="mobile-actions-menu">
                <button className="action-button primary" onClick={() => setActionsOpen((v) => !v)}><Menu className="icon" />Azioni</button>
                {actionsOpen && (
                  <div className="actions-popover">
                    <label className="action-button primary"><Upload className="icon" /><span>{uploading ? 'Importazione...' : 'Carica Excel'}</span><input type="file" accept=".xlsx,.xlsm,.xls" multiple hidden onChange={(e) => {handleFiles(e.target.files); setActionsOpen(false);}} /></label>
                    <button className="action-button" onClick={() => { exportBackup(); setActionsOpen(false); }}><Download className="icon" />Backup</button>
                    <label className="action-button"><RefreshCw className="icon" /><span>Importa backup</span><input type="file" accept=".json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) { importBackup(file); setActionsOpen(false);} }} /></label>
                    <button className="action-button danger" onClick={() => { clearArchive(); setActionsOpen(false); }}><Trash2 className="icon" />Azzera archivio</button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="content-area">

        <section className="filters-card">
          <button className="mobile-filter-toggle action-button ghost" onClick={() => setMobileFiltersOpen((v) => !v)}><Search className="icon" />Filtri {mobileFiltersOpen ? <X className="icon" /> : null}</button>
          <div className={`filters-content ${mobileFiltersOpen ? "open" : ""}`}>
          <div className="filters-headline">
            <div>
              <strong>Filtri rapidi</strong>
              <div className="muted">Configura la vista in pochi tocchi, poi approfondisci con i grafici.</div>
            </div>
            <button className="action-button ghost" onClick={resetFilters}>
              <RefreshCw className="icon" /> Reset filtri
            </button>
          </div>
          <div className="filters-top">
            <div className="search-wrap">
              <Search className="search-icon" />
              <input className="input search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca dealer, filiale, cliente, tabella" />
            </div>
            <div className="filters-grid">
              <select className="select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>{availableYears.map((year) => <option key={year} value={String(year)}>{year}</option>)}</select>
              <select className="select" value={dealerFilter} onChange={(e) => setDealerFilter(e.target.value)}>{dealers.map((dealer) => <option key={dealer} value={dealer}>{dealer === 'ALL' ? 'Tutti i dealer' : dealer}</option>)}</select>
              <select className="select" value={subagenteFilter} onChange={(e) => setSubagenteFilter(e.target.value)}>{subagenti.map((sub) => <option key={sub} value={sub}>{sub === 'ALL' ? 'Tutte le filiali' : sub}</option>)}</select>
              <select className="select" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>{products.map((product) => <option key={product} value={product}>{product === 'ALL' ? 'Tutti i prodotti' : product}</option>)}</select>
              <select className="select" value={viewGranularity} onChange={(e) => setViewGranularity(e.target.value as ViewGranularity)}>
                <option value="monthly">Vista mensile</option>
                <option value="weekly">Vista settimanale</option>
                <option value="daily">Vista giornaliera</option>
              </select>
            </div>
          </div>
          <div className="quick-pills">
            <button className={`pill ${viewGranularity === 'daily' ? 'active' : ''}`} onClick={() => setViewGranularity('daily')}>Vista Giornaliera</button>
            <button className={`pill ${viewGranularity === 'weekly' ? 'active' : ''}`} onClick={() => setViewGranularity('weekly')}>Vista Settimanale</button>
            <button className={`pill ${viewGranularity === 'monthly' ? 'active' : ''}`} onClick={() => setViewGranularity('monthly')}>Vista Mensile</button>
            <button className={`pill ${yearFilter === String(currentYear) ? 'active' : ''}`} onClick={() => setYearFilter(String(currentYear))}>Anno corrente</button>
          </div>
          </div>
        </section>

        <section className="kpi-grid">
          <KPI title="Erogato" value={euro0(kpis.erogato)} subtitle={`${num(kpis.pratiche)} pratiche`} icon={Euro} />
          <KPI title="Ticket medio" value={euro0(kpis.ticketMedio)} subtitle="Importo medio pratica" icon={TrendingUp} />
          <KPI title="Provvigioni" value={euro(kpis.provvigioni)} subtitle="PROVV o formula automatica" icon={Wallet} />
          <KPI title="Dealer attivi" value={num(kpis.dealerCount)} subtitle="Nel filtro corrente" icon={Users} />
          <KPI title="Forecast anno" value={euro0(forecast.projectedAnnual)} subtitle={forecast.annualTarget ? `Target ${euro0(forecast.annualTarget)}` : 'Target non impostato'} icon={Target} />
        </section>

        {tab === 'executive' && (
          <div className="stack">
            <section className="panel executive-daily-banner">
              <div className="panel-header">
                <h3>Riepilogo giornaliero erogato</h3>
                <span>Consulta giorno per giorno erogato e pratiche</span>
              </div>
              {selectedExecutiveDay ? (
                <div className="executive-daily-controls">
                  <button className="action-button ghost" onClick={() => goExecutiveDay(-1)} disabled={selectedExecutiveDayIndex <= 0}>
                    <ChevronLeft className="icon" /> Giorno precedente
                  </button>
                  <select className="select executive-daily-select" value={selectedExecutiveDay.key} onChange={(e) => setSelectedExecutiveDayKey(e.target.value)}>
                    {dailyExecutiveData.map((day) => <option key={day.key} value={day.key}>{day.fullLabel}</option>)}
                  </select>
                  <button className="action-button ghost" onClick={() => goExecutiveDay(1)} disabled={selectedExecutiveDayIndex >= dailyExecutiveData.length - 1}>
                    Giorno successivo <ChevronRight className="icon" />
                  </button>
                  <div className="readonly"><strong>Erogato:</strong> {euro(selectedExecutiveDay.erogato)}</div>
                  <div className="readonly"><strong>Pratiche erogate:</strong> {num(selectedExecutiveDay.pratiche)}</div>
                </div>
              ) : (
                <div className="muted">Nessuna pratica giornaliera disponibile nei filtri correnti.</div>
              )}
            </section>
            <section className="dashboard-grid">
              <KPI title="Erogato mese corrente" value={euro0(currentMonthCard?.erogato || 0)} subtitle={currentMonthLabel} icon={CalendarDays} className="kpi-card--highlight" />
              <KPI title="Pratiche" value={num(kpis.pratiche)} subtitle="Totale pratiche" icon={Users} />
              <KPI title="Ticket medio" value={euro0(kpis.ticketMedio)} subtitle="Importo medio" icon={TrendingUp} />
              <KPI title="Provvigioni" value={euro0(kpis.provvigioni)} subtitle="Anno selezionato" icon={Wallet} />
              <KPI title="Forecast anno" value={euro0(forecast.projectedAnnual)} subtitle="Proiezione" icon={Target} />
              <KPI title="Dealer attivi" value={num(kpis.dealerCount)} subtitle="Nel filtro corrente" icon={Users} />
            </section>
            <div className="panel-grid two-one">
              <div className="panel">
                <div className="panel-header"><h3>Top 5 dealer</h3><span>Classifica sintetica</span></div>
                <div className="list-stack">{topFiveDealers.map((d, i) => <div className="list-item" key={`exe-${d.name}`}><div><div className="list-title">#{i + 1} {d.name}</div><div className="list-subtitle">{d.statoDealer} · score {d.score}/100</div></div><div className="list-value">{euro0(d.erogato)}</div></div>)}</div>
              </div>
              <div className="panel">
                <div className="panel-header"><h3>Alert urgenti</h3><span>Priorità alta</span></div>
                <div className="list-stack">{alertsBySeverity.alta.slice(0, 5).map((a) => <div className="list-item" key={`exe-alert-${a.key}`}><div><div className="list-title">{a.dealer}</div><div className="list-subtitle">{a.tipo} · {a.dato}</div></div><span className="badge">{a.severity}</span></div>)}</div>
              </div>
            </div>
            <div className="panel-grid two-one">
              <div className="panel">
                <div className="panel-header"><h3>{chartTitle}</h3><span>Importo finanziato per data liquidazione</span></div>
                <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={timeSeriesData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" interval="preserveStartEnd" angle={viewGranularity === 'daily' ? -35 : 0} textAnchor={viewGranularity === 'daily' ? 'end' : 'middle'} height={viewGranularity === 'daily' ? 70 : 30} /><YAxis /><Tooltip formatter={(value: number) => euro(value)} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''} /><Bar dataKey="erogato" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="panel">
                <div className="panel-header"><h3>Mix prodotto</h3><span>Ripartizione per prodotto</span></div>
                <div className="chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={mix} dataKey="value" nameKey="name" outerRadius={92} innerRadius={40} paddingAngle={2} labelLine={false} label={({ percent }) => percent && percent >= 0.08 ? `${(percent * 100).toFixed(0)}%` : ""}>{mix.map((entry, index) => <Cell key={`mix-${entry.name}`} fill={PRODUCT_COLORS[index % PRODUCT_COLORS.length]} />)}</Pie><Tooltip formatter={(value: number) => euro(value)} /><Legend verticalAlign="bottom" height={44} wrapperStyle={{ fontSize: "12px", color: "#5c6f8f" }} /></PieChart></ResponsiveContainer></div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Dettaglio pratiche per {periodLabel}</h3>
                <span>Seleziona il {periodLabel} da analizzare e consulta i KPI sintetici</span>
              </div>
              <div className="filters-grid period-grid">
                <select className="select" value={selectedPeriodKey} onChange={(e) => setSelectedPeriodKey(e.target.value)}>
                  {periodOptions.map((item) => (
                    <option key={item.key} value={viewGranularity === 'monthly' ? String(item.monthIndex) : item.key}>{item.fullLabel}</option>
                  ))}
                </select>
                <div className="readonly">{selectedPeriodSummary ? `${num(selectedPeriodSummary.pratiche)} pratiche` : 'Nessuna pratica'}</div>
                <div className="readonly">{selectedPeriodSummary ? euro(selectedPeriodSummary.erogato) : '-'}</div>
                <div className="readonly">{selectedPeriodSummary ? euro(selectedPeriodSummary.provvigioni) : '-'}</div>
              </div>
              <div className="period-summary muted">{selectedPeriodMeta ? `Periodo selezionato: ${selectedPeriodMeta.fullLabel}` : `Nessun ${periodLabel} disponibile nel filtro corrente.`}</div>
            </div>

            {comparisonYears.length > 0 && viewGranularity === 'monthly' && (
              <div className="panel">
                <div className="panel-header"><h3>Confronto anno su anno</h3><span>{currentYear - 1} vs {currentYear}</span></div>
                <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={comparisonYears}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value: number) => euro(value)} /><Legend /><Line type="monotone" dataKey={String(currentYear - 1)} stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} /><Line type="monotone" dataKey={String(currentYear)} stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
              </div>
            )}

            {viewGranularity === 'monthly' && (
              <div className="panel">
                <div className="panel-header">
                  <h3>Avanzamento giornaliero mese vs storico</h3>
<span>{MONTHS_IT[referenceMonth - 1]} {currentYear} vs mese precedente, anno scorso, mese top YTD e media anno corrente</span>
                </div>
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyProgressComparison}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => euro(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="corrente" name={`${currentYear}`} stroke="#0ea5e9" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="mesePrecedente" name="Mese precedente" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="annoScorso" name={`${currentYear - 1}`} stroke="#8b5cf6" strokeWidth={2} dot={false} />
<Line
  type="monotone"
  dataKey="meseMiglioreYtd"
  name={bestMonthYtd ? `Mese top YTD (${MONTHS_IT[bestMonthYtd - 1]})` : 'Mese top YTD'}
  stroke="#22c55e"
  strokeWidth={2}
  dot={false}
/>
<Line
  type="monotone"
  dataKey="mediaAnnoCorrente"
  name="Media anno corrente"
  stroke="#ef4444"
  strokeWidth={2}
  dot={false}
/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'trend' && (
          <div className="stack">
            <section className="panel">
              <div className="panel-header">
                <h3>Filtri Andamento</h3>
                <span>Analisi da DATA_LIQUIDAZIONE / dateISO sulle righe normalizzate del database</span>
              </div>
              <div className="filters-grid trend-filters-grid">
                <select className="select" value={trendYear} onChange={(e) => setTrendYear(Number(e.target.value))}>{availableYears.map((year) => <option key={`trend-year-${year}`} value={year}>{year}</option>)}</select>
                <select className="select" value={trendMonthLimit} onChange={(e) => setTrendMonthLimit(Number(e.target.value))}>{MONTHS_IT.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>
                <select className="select" value={trendPeriodMode} onChange={(e) => setTrendPeriodMode(e.target.value as TrendPeriodMode)}>
                  <option value="ytd">YTD fino al mese selezionato</option>
                  <option value="month">Solo mese selezionato</option>
                </select>
                <select className="select" value={trendMacroProduct} onChange={(e) => setTrendMacroProduct(e.target.value as TrendMacroFilter)}>
                  <option value="ALL">Tutti i macroprodotti</option>
                  <option value="AUTO">AUTO</option>
                  <option value="POS">POS</option>
                </select>
                <select className="select" value={trendBranch} onChange={(e) => setTrendBranch(e.target.value)}>{trendBranches.map((branch) => <option key={`trend-branch-${branch}`} value={branch}>{branch === 'ALL' ? 'Tutte le filiali' : branch}</option>)}</select>
                <select className="select" value={trendDealer} onChange={(e) => setTrendDealer(e.target.value)}>{trendDealers.map((dealer) => <option key={`trend-dealer-${dealer}`} value={dealer}>{dealer === 'ALL' ? 'Tutti i dealer' : dealer}</option>)}</select>
              </div>
              <div className="muted trend-filter-note">Periodo: <strong>{trendPeriodLabel}</strong> · Confronto {trendYear} vs {trendYear - 1}</div>
            </section>

            <section className="dashboard-grid">
              <KPI title="Erogato periodo corrente" value={euro0(trendComparison.current.erogato)} subtitle={`${trendPeriodLabel} ${trendYear}`} icon={Euro} className="kpi-card--highlight" />
              <KPI title="Erogato anno precedente" value={euro0(trendComparison.previous.erogato)} subtitle={trendComparison.previousHasData ? `${trendYear - 1}` : 'Nessun dato anno precedente'} icon={CalendarDays} />
              <KPI title="Delta euro" value={euro0(trendComparison.deltaEuro)} subtitle={trendComparison.deltaEuro >= 0 ? 'Variazione positiva' : 'Variazione negativa'} icon={TrendingUp} />
              <KPI title="Delta percentuale" value={formatTrendPct(trendComparison.deltaPct)} subtitle={trendComparison.deltaPct === null ? 'n.d. con precedente zero' : 'YoY'} icon={Target} />
              <KPI title="Pratiche" value={num(trendComparison.current.pratiche)} subtitle="Periodo corrente" icon={Users} />
              <KPI title="Ticket medio" value={euro0(trendComparison.current.ticketMedio)} subtitle={`Provvigioni ${euro0(trendComparison.current.provvigioni)}`} icon={Wallet} />
            </section>

            <div className="panel-grid two-one">
              <section className="panel">
                <div className="panel-header"><h3>Andamento mensile anno su anno</h3><span>Da gennaio a {MONTHS_IT[trendMonthLimit - 1]} · rispetta filiale, dealer e macroprodotto</span></div>
                <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendMonthlySeries}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="monthShort" /><YAxis /><Tooltip formatter={(value: number) => euro(value)} /><Legend /><Line type="monotone" dataKey={String(trendYear - 1)} stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} /><Line type="monotone" dataKey={String(trendYear)} stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
              </section>
              <section className="panel">
                <div className="panel-header"><h3>Alert andamento</h3><span>Massimo 5 insight automatici</span></div>
                <div className="list-stack">
                  {trendAlerts.map((alert) => <div className={`list-item alert-card ${alert.severity}`} key={alert.key}><div><div className="list-title">{alert.title}</div><div className="list-subtitle">{alert.text}</div></div><span className="badge">{alert.severity}</span></div>)}
                  {!trendAlerts.length && <div className="muted">Nessun alert rilevante nel periodo selezionato.</div>}
                </div>
              </section>
            </div>

            <section className="panel">
              <div className="panel-header"><h3>Cause della variazione</h3><span>Dealer e filiali che spiegano crescita o calo rispetto all’anno precedente</span></div>
              {!trendVariationCauses.hasSufficientData ? (
                <div className="muted">Dati insufficienti per il confronto</div>
              ) : (
                <div className="stack">
                  <div className="mini-grid trend-causes-grid">
                    <div className="mini-card">
                      <div className="panel-header"><h3>Top contributori positivi</h3><span>Primi 5 dealer per delta €</span></div>
                      <div className="list-stack">
                        {trendVariationCauses.positiveDealers.map(renderTrendCauseDealer)}
                        {!trendVariationCauses.positiveDealers.length && <div className="muted">Nessun contributore positivo nel periodo selezionato.</div>}
                      </div>
                    </div>
                    <div className="mini-card">
                      <div className="panel-header"><h3>Top contributori negativi</h3><span>Primi 5 dealer per calo €</span></div>
                      <div className="list-stack">
                        {trendVariationCauses.negativeDealers.map(renderTrendCauseDealer)}
                        {!trendVariationCauses.negativeDealers.length && <div className="muted">Nessun contributore negativo nel periodo selezionato.</div>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="panel-header"><h3>Sintesi per filiale</h3><span>Delta commerciale e dealer che incidono di più</span></div>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Filiale</th><th className="right">Erogato corrente</th><th className="right">Erogato anno precedente</th><th className="right">Delta €</th><th className="right">Delta %</th><th>Principale dealer positivo</th><th>Principale dealer negativo</th></tr></thead>
                        <tbody>
                          {trendVariationCauses.branchRows.map((row) => (
                            <tr key={`trend-cause-branch-${row.filiale}`}>
                              <td>{row.filiale}</td>
                              <td className="right">{euro(row.currentErogato)}</td>
                              <td className="right">{euro(row.previousErogato)}</td>
                              <td className="right">{euro(row.deltaEuro)}</td>
                              <td className="right">{row.deltaPct === null ? <span className="badge">n.d.</span> : formatTrendPct(row.deltaPct)}</td>
                              <td>{row.mainPositiveDealer}</td>
                              <td>{row.mainNegativeDealer}</td>
                            </tr>
                          ))}
                          {!trendVariationCauses.branchRows.length && <tr><td colSpan={7}>Dati insufficienti per il confronto</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header"><h3>Ranking filiali YTD</h3><span>Delta % n.d. quando il precedente è zero; le filiali nuove sono evidenziate</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Filiale</th><th className="right">Erogato periodo corrente</th><th className="right">Erogato periodo anno precedente</th><th className="right">Delta €</th><th className="right">Delta %</th><th className="right">Pratiche</th><th className="right">Ticket medio</th><th className="right">Provvigioni</th><th>Stato</th></tr></thead>
                  <tbody>
                    {trendBranchTable.map((row) => (
                      <tr key={`trend-branch-${row.filiale}`}>
                        <td>{row.filiale}</td>
                        <td className="right">{euro(row.currentErogato)}</td>
                        <td className="right">{euro(row.previousErogato)}</td>
                        <td className="right">{euro(row.deltaEuro)}</td>
                        <td className="right">{row.deltaPct === null ? <span className="badge">n.d.</span> : formatTrendPct(row.deltaPct)}</td>
                        <td className="right">{num(row.pratiche)}</td>
                        <td className="right">{euro(row.ticketMedio)}</td>
                        <td className="right">{euro(row.provvigioni)}</td>
                        <td><span className="badge">{row.stato === 'Nuova' ? 'Nuova filiale' : row.stato}</span>{!row.previousHasData && row.stato !== 'Nuova' ? <div className="muted">Nessun dato anno precedente</div> : null}</td>
                      </tr>
                    ))}
                    {!trendBranchTable.length && <tr><td colSpan={9}>Nessuna filiale disponibile nel periodo selezionato.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header"><h3>Mix macroprodotto per filiale</h3><span>AUTO = prodotti 20, 21, 23, 36 · POS = tutto il resto</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Filiale</th><th className="right">Erogato AUTO</th><th className="right">Peso AUTO %</th><th className="right">Erogato POS</th><th className="right">Peso POS %</th><th className="right">Totale</th></tr></thead>
                  <tbody>
                    {trendMacroMixTable.map((row) => <tr key={`trend-mix-${row.filiale}`}><td>{row.filiale}</td><td className="right">{euro(row.auto)}</td><td className="right">{pct(row.autoPct)}</td><td className="right">{euro(row.pos)}</td><td className="right">{pct(row.posPct)}</td><td className="right">{euro(row.totale)}</td></tr>)}
                    {!trendMacroMixTable.length && <tr><td colSpan={6}>Nessun dato macroprodotto disponibile nel periodo selezionato.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {tab === 'products' && (
          <div className="stack">
            <div className="panel">
              <div className="panel-header"><h3>Erogato per prodotto mese per mese</h3><span>Vista POS / AUTO</span></div>
              <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={productMonthlySeries}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="monthShort" /><YAxis /><Tooltip formatter={(value: number) => euro(value)} /><Legend /><Bar dataKey="AUTO" radius={[8, 8, 0, 0]} /><Bar dataKey="POS" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Dettaglio prodotto</h3><span>Totali mensili AUTO e POS</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Mese</th><th className="right">AUTO</th><th className="right">POS</th><th className="right">Totale</th></tr></thead>
                  <tbody>
                    {productMonthlySeries.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td className="right">{euro(row.AUTO)}</td>
                        <td className="right">{euro(row.POS)}</td>
                        <td className="right">{euro(row.AUTO + row.POS)}</td>
                      </tr>
                    ))}
                    <tr className="table-total-row">
                      <td>Totale</td>
                      <td className="right">{euro(productMonthlyTotals.auto)}</td>
                      <td className="right">{euro(productMonthlyTotals.pos)}</td>
                      <td className="right">{euro(productMonthlyTotals.auto + productMonthlyTotals.pos)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Provvigioni per mese e prodotto</h3><span>Vista mensile AUTO / POS</span></div>
              <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={commissionMonthlyByProductSeries}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="monthShort" /><YAxis /><Tooltip formatter={(value: number) => euro(value)} /><Legend /><Bar dataKey="AUTO" radius={[8, 8, 0, 0]} /><Bar dataKey="POS" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Mese</th><th className="right">Provv. AUTO</th><th className="right">Provv. POS</th><th className="right">Totale provv.</th></tr></thead>
                  <tbody>
                    {commissionMonthlyByProductSeries.map((row) => (
                      <tr key={`provv-${row.month}`}>
                        <td>{row.month}</td>
                        <td className="right">{euro(row.AUTO)}</td>
                        <td className="right">{euro(row.POS)}</td>
                        <td className="right">{euro(row.AUTO + row.POS)}</td>
                      </tr>
                    ))}
                    <tr className="table-total-row">
                      <td>Totale</td>
                      <td className="right">{euro(commissionMonthlyByProductTotals.auto)}</td>
                      <td className="right">{euro(commissionMonthlyByProductTotals.pos)}</td>
                      <td className="right">{euro(commissionMonthlyByProductTotals.auto + commissionMonthlyByProductTotals.pos)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'forecast' && (
          <div className="stack">
            <div className="mini-grid four">
              <div className="mini-card"><div className="mini-label">Target anno</div><div className="mini-value">{euro0(forecast.annualTarget)}</div></div>
              <div className="mini-card"><div className="mini-label">YTD reale</div><div className="mini-value">{euro0(forecast.ytd)}</div></div>
              <div className="mini-card"><div className="mini-label">Proiezione fine anno</div><div className="mini-value">{euro0(forecast.projectedAnnual)}</div></div>
              <div className="mini-card"><div className="mini-label">Gap vs target</div><div className="mini-value">{euro0(forecast.gapToTarget)}</div></div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Avanzamento target</h3><span>Copertura stimata del target annuale</span></div>
              <div className="progress"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
              <div className="muted">Copertura stimata: <strong>{forecast.annualTarget ? pct(forecast.projectedAnnual / forecast.annualTarget) : '-'}</strong></div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Avanzamento target per trimestre</h3><span>Target trimestrale derivato dalla stagionalità annuale</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Trimestre</th><th className="right">Target</th><th className="right">Reale</th><th className="right">Proiezione</th><th className="right">Copertura</th></tr></thead>
                  <tbody>
                    {quarterlyProgress.map((quarter) => (
                      <tr key={quarter.label}>
                        <td>{quarter.label}</td>
                        <td className="right">{euro(quarter.target)}</td>
                        <td className="right">{euro(quarter.actual)}</td>
                        <td className="right">{euro(quarter.projected)}</td>
                        <td className="right">{quarter.target ? pct(quarter.coverage) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Tabella previsione erogato</h3><span>Con reale, stimato, media giornaliera e mese ipotetico</span></div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mese</th><th className="right">Erogato reale</th><th className="right">Stagionalità</th><th className="right">Erogato stimato</th><th className="right">GG lavorativi</th><th className="right">GG lavorati</th><th className="right">Media GG</th><th className="right">Erogato ipotetico</th><th className="right">Delta vs stimato</th><th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.monthlyForecast.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td className="right">{euro(row.erogato)}</td>
                        <td className="right">{pct(row.seasonality)}</td>
                        <td className="right">{euro(row.stimato)}</td>
                        <td className="right">{num(row.workingDays)}</td>
                        <td className="right">{num(row.workedDays)}</td>
                        <td className="right">{row.mediaGg ? euro(row.mediaGg) : '-'}</td>
                        <td className="right">{euro(row.ipotetico)}</td>
                        <td className="right">{euro(row.deltaTarget)}</td>
                        <td><span className="badge">{row.note}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'intelligence' && (
          <div className="stack">
            <div className="panel-grid two-one">
              <div className="panel">
                <div className="panel-header"><h3>Classifica Dealer Intelligente</h3><span>Ranking dinamico sul periodo filtrato</span></div>
                <div className="chart tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={dealerRanking} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={210} /><Tooltip formatter={(value: number) => euro(value)} /><Bar dataKey="erogato" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="panel">
                <div className="panel-header"><h3>Sintesi dealer</h3><span>Mese corrente vs mese precedente</span></div>
                <div className="list-stack">
                  {dealerRanking.slice(0, 10).map((row, index) => (
                    <div key={row.name} className="list-item">
                      <div>
                        <div className="list-title">#{index + 1} {row.name}</div>
                        <div className="list-subtitle">{row.pratiche} pratiche · crescita {pct(row.growthErogatoPct)} · stato {row.statoDealer}</div>
                      </div>
                      <div className="list-value">{euro0(row.erogato)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {!dealerDetail && <div className="panel">
              <div className="panel-header"><h3>Tabella dealer intelligente</h3><span>Ordinabile per KPI commerciali</span></div>
              <div className="filters-grid">
                <select className="select" value={dealerSortKey} onChange={(e) => setDealerSortKey(e.target.value as DealerSortKey)}>
                  <option value="erogato">Ordina per erogato totale</option>
                  <option value="crescitaPct">Ordina per crescita %</option>
                  <option value="ticketMedio">Ordina per ticket medio</option>
                  <option value="provvigioni">Ordina per provvigioni</option>
                </select>
                <div className="readonly">Mese analisi crescita: {MONTHS_IT[referenceMonth - 1]}</div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Dealer</th><th className="right">Score</th><th className="right">Erogato</th><th className="right">Pratiche</th><th className="right">Ticket medio</th><th className="right">Provvigioni</th><th>Tipo dealer</th><th>Continuità</th><th>Azione consigliata</th><th className="right">Erogato mese corrente</th><th className="right">Erogato mese prec.</th><th className="right">Var. %</th><th className="right">Pratiche mese corr./prec.</th><th>Stato dealer</th><th>Dettaglio</th></tr></thead>
                  <tbody>
                    {smartDealerTable.map((row) => (
                      <tr key={row.name} onDoubleClick={() => setSelectedDealerDetail(row.name)} className="dealer-row-clickable"><td>{row.name}</td><td className="right"><span className="badge">{row.score}</span></td><td className="right">{euro(row.erogato)}</td><td className="right">{num(row.pratiche)}</td><td className="right">{euro(row.ticketMedio)}</td><td className="right">{euro(row.provvigioni)}</td><td><span className="badge">{row.dealerType}</span></td><td><span className="badge">{row.continuityLabel}</span></td><td><span className="badge">{row.suggestedAction}</span></td><td className="right">{euro(row.currentMonthErogato)}</td><td className="right">{euro(row.previousMonthErogato)}</td><td className="right">{pct(row.growthErogatoPct)}</td><td className="right">{num(row.currentMonthPratiche)} / {num(row.previousMonthPratiche)}</td><td><span className="badge">{row.statoDealer}</span></td><td><button className="action-button ghost" onClick={() => setSelectedDealerDetail(row.name)}>Apri scheda</button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>}
            {dealerDetail && (
              <div className="panel">
                <div className="panel-header"><h3>Scheda dealer: {selectedDealerDetail}</h3><div className="hero-actions"><button className="action-button" onClick={exportDealerGrowthPdf}><Download className="icon" />Report PDF dealer</button><button className="action-button" onClick={() => setSelectedDealerDetail(null)}><Home className="icon" />Torna alla lista dealer</button></div></div>
                <section className="kpi-grid">
                  <KPI title="Erogato totale storico" value={euro0(dealerDetail.sum(dealerDetail.dealerRows))} icon={Euro} />
                  <KPI title="Erogato ultimi 12 mesi" value={euro0(dealerDetail.sum(dealerDetail.last12Rows))} icon={CalendarDays} />
                  <KPI title="Erogato anno corrente" value={euro0(dealerDetail.sum(dealerDetail.currentYearRows))} icon={TrendingUp} />
                  <KPI title="Pratiche totali" value={num(dealerDetail.count(dealerDetail.dealerRows))} icon={Users} />
                  <KPI title="Pratiche anno corrente" value={num(dealerDetail.count(dealerDetail.currentYearRows))} icon={Users} />
                  <KPI title="Ticket medio anno corrente" value={euro0(dealerDetail.ticket(dealerDetail.currentYearRows))} icon={Target} />
                  <KPI title="Ticket medio ultimi 12 mesi" value={euro0(dealerDetail.ticket(dealerDetail.last12Rows))} icon={Target} />
                </section>
                <div className="mini-grid three">
                  <div className="mini-card"><div className="mini-label">Crescita YTD erogato</div><div className="mini-value">{euro0(dealerDetail.sum(dealerDetail.ytdCurrentRows) - dealerDetail.sum(dealerDetail.ytdPrevRows))} {diffPct(dealerDetail.sum(dealerDetail.ytdCurrentRows), dealerDetail.sum(dealerDetail.ytdPrevRows)) === null ? '(n/d)' : pct(diffPct(dealerDetail.sum(dealerDetail.ytdCurrentRows), dealerDetail.sum(dealerDetail.ytdPrevRows)) || 0)}</div></div>
                  <div className="mini-card"><div className="mini-label">Crescita YTD pratiche</div><div className="mini-value">{num(dealerDetail.count(dealerDetail.ytdCurrentRows) - dealerDetail.count(dealerDetail.ytdPrevRows))} {diffPct(dealerDetail.count(dealerDetail.ytdCurrentRows), dealerDetail.count(dealerDetail.ytdPrevRows)) === null ? '(n/d)' : pct(diffPct(dealerDetail.count(dealerDetail.ytdCurrentRows), dealerDetail.count(dealerDetail.ytdPrevRows)) || 0)}</div></div>
                  <div className="mini-card"><div className="mini-label">Crescita YTD ticket medio</div><div className="mini-value">{euro0(dealerDetail.ticket(dealerDetail.ytdCurrentRows) - dealerDetail.ticket(dealerDetail.ytdPrevRows))}</div></div>
                </div>
                <div className="mini-grid three">
                  <div className="mini-card"><div className="mini-label">Erogato mese corr./prec.</div><div className="mini-value">{euro0(dealerDetail.sum(dealerDetail.currentMonthRows))} / {euro0(dealerDetail.sum(dealerDetail.previousMonthRows))}</div></div>
                  <div className="mini-card"><div className="mini-label">Pratiche mese corr./prec.</div><div className="mini-value">{num(dealerDetail.count(dealerDetail.currentMonthRows))} / {num(dealerDetail.count(dealerDetail.previousMonthRows))}</div></div>
                  <div className="mini-card"><div className="mini-label">Ticket mese corr./prec.</div><div className="mini-value">{euro0(dealerDetail.ticket(dealerDetail.currentMonthRows))} / {euro0(dealerDetail.ticket(dealerDetail.previousMonthRows))}</div></div>
                </div>
                <div className="panel-header"><h3>Andamento ultimi 12 mesi</h3></div>
                <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={dealerDetail.last12Monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis yAxisId="left" tickFormatter={(value: number) => euro0(value)} /><YAxis yAxisId="right" orientation="right" allowDecimals={false} tickFormatter={(value: number) => num(value)} /><Tooltip formatter={(value: number, name: string, item: { dataKey?: string }) => (item?.dataKey === 'pratiche' || name === 'Pratiche') ? num(value) : euro(value)} /><Legend /><Line type="monotone" dataKey="erogato" name="Erogato" yAxisId="left" stroke="#0ea5e9" strokeWidth={3} /><Line type="monotone" dataKey="pratiche" name="Pratiche" yAxisId="right" stroke="#22c55e" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
                <div className="table-wrap"><table><thead><tr><th>Mese</th><th className="right">Erogato</th><th className="right">Pratiche</th><th className="right">Ticket medio</th></tr></thead><tbody>{dealerDetail.last12Monthly.map((m) => <tr key={m.month}><td>{m.month}</td><td className="right">{euro(m.erogato)}</td><td className="right">{num(m.pratiche)}</td><td className="right">{euro(m.ticketMedio)}</td></tr>)}</tbody></table></div>
                <div className="panel-header"><h3>Insight commerciali automatici</h3></div>
                <div className="quick-pills">{dealerDetail.insights.map((i) => <span key={i.key} className={`pill ${i.positive ? 'active' : ''}`}>{i.label}</span>)}</div>
                <div className="panel-header"><h3>Pratiche dealer</h3><span>Ordinate dalla più recente</span></div>
                <div className="table-wrap"><table><thead><tr><th>Data liquidazione</th><th className="right">Importo</th><th>Prodotto</th><th className="right">Numero rate</th><th className="right">Provvigione</th><th>Situazione</th></tr></thead><tbody>{[...dealerDetail.dealerRows].sort((a, b) => new Date(b.dateISO || 0).getTime() - new Date(a.dateISO || 0).getTime()).slice(0, 500).map((row) => <tr key={`dealer-${row.rowId}`}><td>{row.dateISO ? new Date(row.dateISO).toLocaleDateString('it-IT') : '-'}</td><td className="right">{euro(row.importoFinanziato || row.importoNettoErogato)}</td><td>{row.prodottoLabel || row.prodottoCode || '-'}</td><td className="right">{num(row.numeroRate)}</td><td className="right">{euro(row.provvigione)}</td><td>{row.situazione || '-'}</td></tr>)}</tbody></table></div>
              </div>
            )}
          </div>
        )}
        {tab === 'alerts' && (
          <div className="stack">
            {(['alta', 'media', 'bassa', 'positiva'] as AlertSeverity[]).map((sev) => (
              <div className="panel" key={sev}>
                <div className="panel-header"><h3>Alert {sev}</h3><span>{alertsBySeverity[sev].length} elementi</span></div>
                <div className="list-stack">
                  {alertsBySeverity[sev].map((a) => (
                    <div key={a.key} className="list-item">
                      <div>
                        <div className="list-title">{sev === 'alta' ? <ShieldAlert className="inline-icon" /> : sev === 'positiva' ? <CircleCheck className="inline-icon" /> : <TriangleAlert className="inline-icon" />} {a.dealer} · {a.tipo}</div>
                        <div className="list-subtitle">{a.descrizione} · {a.dato}</div>
                      </div>
                      <div className="badge">{a.suggerimento}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'focus' && (
          <div className="stack">
            <div className="mini-grid four">
              <div className="mini-card"><div className="mini-label">Focus mese</div><div className="mini-value">{MONTHS_IT[referenceMonth - 1]}</div></div>
              <div className="mini-card"><div className="mini-label">Erogato mese</div><div className="mini-value">{euro0(currentMonthCard?.erogato || 0)}</div></div>
              <div className="mini-card"><div className="mini-label">Vs mese precedente (YTD)</div><div className="mini-value">{pct(monthVsPrevMonth)}</div><div className="mini-note">Vs anno precedente: {pct(monthVsPrevYear)}</div></div>
              <div className="mini-card"><div className="mini-label">Dealer top 5</div><div className="mini-value">{num(topFiveDealers.length)}</div></div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Top dealer del mese</h3><span>Riepilogo operativo</span></div>
              <div className="list-stack">{topFiveDealers.map((d, i) => <div className="list-item" key={d.name}><div><div className="list-title">#{i + 1} {d.name}</div><div className="list-subtitle">{d.statoDealer} · {num(d.currentMonthPratiche)} pratiche · score {d.score}/100</div></div><div className="list-value">{euro0(d.currentMonthErogato)}</div></div>)}</div>
            </div>
          </div>
        )}

        {tab === 'subagenti' && (
          <div className="stack">
            <div className="panel">
              <div className="panel-header"><h3>Filtri filiali</h3><span>Seleziona mese e macroprodotto per aggiornare grafico, sintesi e tabella</span></div>
              <div className="filters-grid branch-filters-grid">
                <select className="select" value={branchMonthFilter} onChange={(e) => setBranchMonthFilter(e.target.value)}>
                  <option value="ALL">Tutti i mesi</option>
                  {branchMonthOptions.map((month) => <option key={month} value={String(month)}>{MONTHS_IT[month - 1]}</option>)}
                </select>
                <select className="select" value={branchMacroFilter} onChange={(e) => setBranchMacroFilter(e.target.value as BranchMacroFilter)}>
                  <option value="ALL">Tutti i macroprodotti</option>
                  <option value="AUTO">Erogato AUTO</option>
                  <option value="POS">POS</option>
                </select>
                <div className="mini-card branch-filter-card"><div className="mini-label">Periodo / macroprodotto</div><div className="mini-value">{branchFilterSummary}</div></div>
                <div className="mini-card branch-filter-card"><div className="mini-label">Erogato filtrato</div><div className="mini-value">{euro0(branchFilteredTotals.erogato)}</div><div className="mini-note">{num(branchFilteredTotals.pratiche)} pratiche</div></div>
                <div className="mini-card branch-filter-card"><div className="mini-label">Provvigioni / polizze</div><div className="mini-value">{euro0(branchFilteredTotals.provvigioni)}</div><div className="mini-note">Polizze {euro0(branchFilteredTotals.polizze)}</div></div>
              </div>
            </div>
            <div className="panel-grid two-one">
              <div className="panel">
                <div className="panel-header"><h3>Top filiali / subagenti</h3><span>{branchFilterSummary}</span></div>
                <div className="chart tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={subagenteRanking} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={210} /><Tooltip formatter={(value: number) => euro(value)} /><Bar dataKey="erogato" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="panel">
                <div className="panel-header"><h3>Sintesi filiali</h3><span>Prime posizioni · {branchFilterSummary}</span></div>
                <div className="list-stack">
                  {subagenteRanking.slice(0, 10).map((row, index) => (
                    <div key={row.name} className="list-item">
                      <div>
                        <div className="list-title"><Store className="inline-icon" /> #{index + 1} {row.name}</div>
                        <div className="list-subtitle">{row.pratiche} pratiche · ticket {euro0(row.ticketMedio)}</div>
                      </div>
                      <div className="list-value">{euro0(row.erogato)}</div>
                    </div>
                  ))}
                  {!subagenteRanking.length && <div className="empty-state">Nessuna filiale disponibile per i filtri selezionati.</div>}
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Tabella filiali</h3><span>Subagente = filiale · {branchFilterSummary}</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Filiale</th><th className="right">Erogato</th><th className="right">Pratiche</th><th className="right">Ticket medio</th><th className="right">Provvigioni</th><th className="right">Polizze</th></tr></thead>
                  <tbody>
                    {subagenteTable.map((row) => (
                      <tr key={row.name}><td>{row.name}</td><td className="right">{euro(row.erogato)}</td><td className="right">{num(row.pratiche)}</td><td className="right">{euro(row.ticketMedio)}</td><td className="right">{euro(row.provvigioni)}</td><td className="right">{euro(row.polizze)}</td></tr>
                    ))}
                    {!subagenteTable.length && <tr><td colSpan={6}>Nessuna filiale disponibile per i filtri selezionati.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Top dealer per filiale</h3><span>Top globali, AUTO e POS per filiale · {branchDealerPeriodLabel}</span></div>
              <div className="table-wrap">
                <table className="branch-dealer-table">
                  <thead><tr><th>Filiale</th><th>Top globale</th><th>Top AUTO</th><th>Top POS</th></tr></thead>
                  <tbody>
                    {branchDealerLeaders.map((row) => (
                      <tr key={row.branch}>
                        <td>{row.branch}</td>
                        {[row.globale, row.auto, row.pos].map((segment) => (
                          <td key={`${row.branch}-${segment.label}`}>
                            <div className="dealer-leader-cell">
                              <div className="dealer-leader-title"><span className="badge">{segment.label}</span></div>
                              {segment.topDealer ? (
                                <>
                                  <div className="dealer-leader-main">{segment.topDealer.dealer}</div>
                                  <div className="dealer-leader-meta">{euro0(segment.topDealer.erogato)} · peso {pct(segment.topDealerPeso)} · {num(segment.topDealer.pratiche)} / {num(segment.totalPratiche)} pratiche</div>
                                  <div className="dealer-breakdown-list">
                                    {segment.topDealers.map((dealer, index) => (
                                      <div key={`${row.branch}-${segment.label}-${dealer.dealer}`}><strong>#{index + 1} {dealer.dealer}</strong> · {euro0(dealer.erogato)} · ticket {euro0(dealer.ticketMedio)}</div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div className="dealer-leader-empty">Nessun dato</div>
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!branchDealerLeaders.length && <tr><td colSpan={4}>Nessun dealer disponibile per il periodo selezionato.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'portfolio' && (
          <div className="stack">
            <div className="panel">
              <div className="panel-header"><h3>Peso dealer su erogato</h3><span>{dealerWeightViewData.subtitle}</span></div>
              <div className="mini-grid four">
                <div className="mini-card"><div className="mini-label">Dealer più pesante</div><div className="mini-value">{dealerWeightAnalytics.topDealer?.dealer || '-'}</div><div className="mini-note">{dealerWeightAnalytics.topDealer ? `${euro0(dealerWeightAnalytics.topDealer.erogato)} · ${pct(dealerWeightAnalytics.topDealer.pesoTotalePct / 100)}` : 'Nessun dato'}</div></div>
                <div className="mini-card"><div className="mini-label">Peso Top 5 dealer</div><div className="mini-value">{pct(dealerWeightAnalytics.top5Peso / 100)}</div><div className="mini-note">Incidenza cumulata</div></div>
                <div className="mini-card"><div className="mini-label">Dealer AUTO più rilevante</div><div className="mini-value">{dealerWeightAnalytics.topAutoDealer?.dealer || '-'}</div><div className="mini-note">{dealerWeightAnalytics.topAutoDealer ? `${euro0(dealerWeightAnalytics.topAutoDealer.erogato)} · ${pct(dealerWeightAnalytics.topAutoDealer.pesoCategoriaPct / 100)}` : 'Nessun dato'}</div></div>
                <div className="mini-card"><div className="mini-label">Dealer POS più rilevante</div><div className="mini-value">{dealerWeightAnalytics.topPosDealer?.dealer || '-'}</div><div className="mini-note">{dealerWeightAnalytics.topPosDealer ? `${euro0(dealerWeightAnalytics.topPosDealer.erogato)} · ${pct(dealerWeightAnalytics.topPosDealer.pesoCategoriaPct / 100)}` : 'Nessun dato'}</div></div>
              </div>
              <div className="quick-pills">
                <button className={`pill ${dealerWeightView === 'totale' ? 'active' : ''}`} onClick={() => setDealerWeightView('totale')}>Totale</button>
                <button className={`pill ${dealerWeightView === 'auto' ? 'active' : ''}`} onClick={() => setDealerWeightView('auto')}>Dealer AUTO</button>
                <button className={`pill ${dealerWeightView === 'pos' ? 'active' : ''}`} onClick={() => setDealerWeightView('pos')}>Dealer POS</button>
              </div>
              <div className="chart tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={dealerWeightViewData.chartRows} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="dealer" width={190} /><Tooltip formatter={(value: number) => euro(value)} /><Legend /><Bar dataKey="erogato" name="Erogato" fill="#2563eb">{dealerWeightViewData.chartRows.map((entry, index) => <Cell key={`dealer-weight-cell-${entry.dealer}-${index}`} fill={entry.category === 'AUTO' ? '#2563eb' : '#22c55e'} />)}</Bar></BarChart></ResponsiveContainer></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Dealer</th><th>Categoria dealer</th><th className="right">Erogato</th><th className="right">Pratiche</th><th className="right">Peso %</th><th className="right">Ticket medio</th></tr></thead>
                  <tbody>
                    {dealerWeightViewData.tableRows.map((row) => <tr key={`dw-${dealerWeightView}-${row.dealer}`}><td>{row.dealer}</td><td><span className="badge">{row.category}</span></td><td className="right">{euro(row.erogato)}</td><td className="right">{num(row.pratiche)}</td><td className="right">{pct((dealerWeightView === 'totale' ? row.pesoTotalePct : row.pesoCategoriaPct) / 100)}</td><td className="right">{euro(row.ticketMedio)}</td></tr>)}
                    {!dealerWeightViewData.tableRows.length && <tr><td colSpan={6}>Nessun dealer disponibile nel filtro corrente.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Ultime pratiche</h3><span>Vista mensile ordinata per data liquidazione</span></div>
              <div className="filters-grid period-grid">
                <select className="select" value={portfolioMonthFilter} onChange={(e) => setPortfolioMonthFilter(e.target.value)}>
                  {portfolioMonthOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                <div className="readonly">{portfolioLatestRows.length} pratiche</div>
              </div>
              <div className="table-wrap"><table><thead><tr><th>Data</th><th>Dealer</th><th>Filiale</th><th>Cliente</th><th>Prodotto</th><th>Tabella</th><th className="right">Importo</th><th className="right">Provv.</th><th className="right">Polizza</th></tr></thead><tbody>{portfolioLatestRows.map((row) => <tr key={row.rowId}><td>{row.dateISO ? new Date(row.dateISO).toLocaleDateString('it-IT') : '-'}</td><td>{row.dealer}</td><td>{row.subagente}</td><td>{row.cliente}</td><td>{row.prodottoCode}</td><td>{row.tabella || '-'}</td><td className="right">{euro(row.importoFinanziato)}</td><td className="right">{euro(row.provvigione)}</td><td className="right">{euro(row.polizza)}</td></tr>)}{!portfolioLatestRows.length && <tr><td colSpan={9}>Nessuna pratica per il mese selezionato.</td></tr>}</tbody></table></div>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div className="stack">
            <div className="mini-grid four">
              <div className="mini-card"><div className="mini-label">Dealer N/D</div><div className="mini-value">{num(dataQuality.dealerND)}</div></div>
              <div className="mini-card"><div className="mini-label">Prodotto mancante</div><div className="mini-value">{num(dataQuality.prodottoMancante)}</div></div>
              <div className="mini-card"><div className="mini-label">Provvigione zero</div><div className="mini-value">{num(dataQuality.provvigioneZero)}</div></div>
              <div className="mini-card"><div className="mini-label">Possibili duplicati</div><div className="mini-value">{num(dataQuality.duplicate)}</div></div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Impostazioni forecast</h3><span>Target annuale e stagionalità</span></div>
              <div className="settings-grid">
                <div>
                  <div className="muted">Anno</div>
                  <div className="readonly">{currentYear}</div>
                </div>
                <div>
                  <div className="muted">Target annuale</div>
                  <input className="input" value={settings.annualTargetByYear?.[currentYear] || ''} onChange={(e) => setSettings((prev) => ({ ...prev, annualTargetByYear: { ...prev.annualTargetByYear, [currentYear]: Number(e.target.value || 0) } }))} />
                </div>
                <div>
                  <div className="muted">Somma stagionalità</div>
                  <div className="readonly">{pct((settings.stagionalitaByYear?.[currentYear] || []).reduce((sum, value) => sum + Number(value || 0), 0))}</div>
                </div>
              </div>
              <div className="months-grid">
                {MONTHS_IT.map((month, index) => (
                  <div key={month}>
                    <div className="month-label">{month}</div>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={((settings.stagionalitaByYear?.[currentYear]?.[index] || 0) * 100).toFixed(2)}
                      onChange={(e) => {
                        const copy = [...(settings.stagionalitaByYear?.[currentYear] || Array(12).fill(0))];
                        copy[index] = Number(e.target.value || 0) / 100;
                        setSettings((prev) => ({ ...prev, stagionalitaByYear: { ...prev.stagionalitaByYear, [currentYear]: copy } }));
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Note operative</h3><span>Cosa legge questa versione</span></div>
              <div className="notes">
                <div>• data riferimento: <strong>DATA_LIQUIDAZIONE</strong></div>
                <div>• erogato: <strong>IMPORTO_FINANZIATO</strong></div>
                <div>• dealer: <strong>DES_CONVENZIONATO</strong></div>
                <div>• filiale: <strong>DES_SUBAGENTE</strong></div>
                <div>• polizze: <strong>REPORT POLIZZE</strong> quando presente, altrimenti colonna database</div>
                <div>• vista prodotto: <strong>EROGATO PER PRODOTTO</strong> quando presente, altrimenti classificazione da codice prodotto</div>
                <div>• provvigioni: <strong>PROVV</strong> oppure formula automatica (31 = 0,825%; resto = 0,55%)</div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>File importati</h3><span>Storico file caricati nella sessione archivio</span></div>
              <div className="list-stack">
                {importedFiles.length ? importedFiles.map((file) => (
                  <div key={file} className="list-item">
                    <div className="list-title">{file}</div>
                  </div>
                )) : <div className="muted">Nessun file importato.</div>}
              </div>
            </div>
          </div>
        )}
          </div>
          <nav className="bottom-nav">
            {primaryMobileTabs.map(([key, label, Icon]) => (
              <button key={key} className={`bottom-nav-item ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}><Icon className="icon" /><span>{label}</span></button>
            ))}
            <div className="bottom-nav-more">
              <button className={`bottom-nav-item ${secondaryTabs.some(([key]) => key === tab) ? 'active' : ''}`} onClick={() => setMoreOpen((v) => !v)}><MoreHorizontal className="icon" /><span>Altro</span></button>
              {moreOpen && (
                <div className="more-popover">
                  {secondaryTabs.map(([key, label, Icon]) => (
                    <button key={key} className={`sidebar-item ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setMoreOpen(false); }}><Icon className="icon" /><span>{label}</span></button>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
