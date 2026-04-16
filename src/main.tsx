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
} from 'recharts';
import {
  Upload,
  Euro,
  Users,
  TrendingUp,
  Target,
  Trash2,
  ShieldCheck,
  Wallet,
  Download,
  Database,
  Building2,
  Search,
  Store,
  RefreshCw,
} from 'lucide-react';
import './styles.css';

type SourceRow = Record<string, unknown>;

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
  modPagamento: string;
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

type WorkbookImport = {
  fileName: string;
  rows: SourceRow[];
  databaseSheetName: string;
};

const STORAGE_KEY = 'dealer_erogato_app_v6';
const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const DEFAULT_2026_STAGIONALITA = [0.0422467773, 0.0679778571, 0.0611428174, 0.0612145238, 0.0556212658, 0.0852724183, 0.1160142533, 0.0483985297, 0.10272674, 0.1183406974, 0.0991278003, 0.1419163194];
const DEFAULT_SETTINGS: Settings = {
  annualTargetByYear: { 2026: 10200000 },
  stagionalitaByYear: { 2026: DEFAULT_2026_STAGIONALITA },
};

function euro(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(n || 0));
}
function euro0(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
}
function num(n: number, digits = 0) {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(n || 0));
}
function pct(n: number) {
  return `${num(Number(n || 0) * 100, 1)}%`;
}
function safeUpper(v: unknown) {
  return String(v ?? '').trim().toUpperCase();
}
function normalizeText(v: unknown) {
  return String(v ?? '').trim();
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
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0, 0);
  }
  if (typeof value === 'string') {
    const itDate = parseItalianDateString(value);
    if (itDate) return itDate;
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return new Date(direct.getFullYear(), direct.getMonth(), direct.getDate(), 12, 0, 0, 0);
    }
  }
  return null;
}
function normalizeProductLabel(code: string) {
  if (code === '31') return 'Prodotto 31';
  if (code === '21') return 'Prodotto 21';
  if (code === '24') return 'Prodotto 24';
  return code ? `Prodotto ${code}` : 'N/D';
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

async function readWorkbookFile(file: File): Promise<WorkbookImport> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: true });
      const databaseSheetName = workbook.SheetNames.find((name) => name.toUpperCase().includes('DATABASE')) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[databaseSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true }) as SourceRow[];
      resolve({ fileName: file.name, rows, databaseSheetName });
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
      const polizzaDaColonna = cleanNumber(pick(row, ['importo polizza ', 'IMPORTO POLIZZA', 'IMPORTO_POLIZZA']));
      const polizzaDaPagamento = cleanNumber(pick(row, ['MOD_PAGAMENTO']));
      const polizza = polizzaDaColonna || polizzaDaPagamento || 0;
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
        modPagamento: normalizeText(pick(row, ['MOD_PAGAMENTO'])),
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
  incoming.forEach((row) => {
    map.set(row.rowId, row);
  });
  return Array.from(map.values()).sort((a, b) => new Date(a.dateISO || 0).getTime() - new Date(b.dateISO || 0).getTime());
}

function monthSeriesFromRows(rows: AppRow[], year: number) {
  const data = MONTHS_IT.map((month, index) => ({
    month,
    monthShort: MONTHS_SHORT[index],
    monthIndex: index,
    erogato: 0,
    pratiche: 0,
    provvigioni: 0,
    polizze: 0,
  }));
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

function aggregateByField(rows: AppRow[], year: number, field: 'dealer' | 'subagente') {
  const map = new Map<string, { name: string; erogato: number; pratiche: number; provvigioni: number; polizze: number; ticketMedio: number }>();
  rows.filter((row) => row.year === year).forEach((row) => {
    const key = row[field] || 'N/D';
    if (!map.has(key)) {
      map.set(key, { name: key, erogato: 0, pratiche: 0, provvigioni: 0, polizze: 0, ticketMedio: 0 });
    }
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
    if (!map.has(key)) {
      map.set(key, { name: key, value: 0, pratiche: 0 });
    }
    const item = map.get(key)!;
    item.value += row.importoFinanziato;
    item.pratiche += 1;
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
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
    return {
      ...item,
      seasonality,
      stimato,
      workingDays,
      workedDays,
      mediaGg,
      ipotetico,
      deltaTarget: item.erogato - stimato,
      note,
    };
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

  return {
    annualTarget: target,
    projectedAnnual,
    ytd,
    gapToTarget: target ? projectedAnnual - target : 0,
    monthlyForecast,
  };
}

function KPI({ title, value, subtitle, icon: Icon }: { title: string; value: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="kpi-card">
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
  const [rows, setRows] = useState<AppRow[]>([]);
  const [importedFiles, setImportedFiles] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<'overview' | 'forecast' | 'dealers' | 'subagenti' | 'portfolio' | 'data'>('overview');
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [dealerFilter, setDealerFilter] = useState('ALL');
  const [subagenteFilter, setSubagenteFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('ALL');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { rows?: AppRow[]; importedFiles?: string[]; settings?: Settings };
      setRows(parsed.rows || []);
      setImportedFiles(parsed.importedFiles || []);
      setSettings({ ...DEFAULT_SETTINGS, ...(parsed.settings || {}) });
    } catch {
      // ignore broken cache
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, importedFiles, settings }));
  }, [rows, importedFiles, settings]);

  const availableYears = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => row.year))).sort((a, b) => a - b);
    return values.length ? values : [new Date().getFullYear()];
  }, [rows]);

  useEffect(() => {
    if (!availableYears.includes(Number(yearFilter))) {
      setYearFilter(String(availableYears[availableYears.length - 1]));
    }
  }, [availableYears, yearFilter]);

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

  const kpis = useMemo(() => {
    const erogato = filteredRows.reduce((sum, row) => sum + row.importoFinanziato, 0);
    const pratiche = filteredRows.length;
    const provvigioni = filteredRows.reduce((sum, row) => sum + row.provvigione, 0);
    const polizze = filteredRows.reduce((sum, row) => sum + row.polizza, 0);
    const dealerCount = new Set(filteredRows.map((row) => row.dealer)).size;
    return {
      erogato,
      pratiche,
      ticketMedio: pratiche ? erogato / pratiche : 0,
      provvigioni,
      polizze,
      dealerCount,
    };
  }, [filteredRows]);

  const monthlyData = useMemo(() => monthSeriesFromRows(filteredRows, currentYear), [filteredRows, currentYear]);
  const dealerRanking = useMemo(() => aggregateByField(filteredRows, currentYear, 'dealer').slice(0, 12), [filteredRows, currentYear]);
  const subagenteRanking = useMemo(() => aggregateByField(filteredRows, currentYear, 'subagente').slice(0, 12), [filteredRows, currentYear]);
  const dealerTable = useMemo(() => aggregateByField(filteredRows, currentYear, 'dealer'), [filteredRows, currentYear]);
  const subagenteTable = useMemo(() => aggregateByField(filteredRows, currentYear, 'subagente'), [filteredRows, currentYear]);
  const mix = useMemo(() => productMix(filteredRows, currentYear), [filteredRows, currentYear]);
  const forecast = useMemo(() => buildForecast(filteredRows, currentYear, settings, new Date()), [filteredRows, currentYear, settings]);

  const comparisonYears = useMemo(() => {
    const previous = currentYear - 1;
    if (!availableYears.includes(previous)) return [] as Record<string, number | string>[];
    const currentData = monthSeriesFromRows(rows, currentYear);
    const previousData = monthSeriesFromRows(rows, previous);
    return currentData.map((row, index) => ({
      month: row.monthShort,
      [currentYear]: row.erogato,
      [previous]: previousData[index]?.erogato || 0,
    }));
  }, [rows, currentYear, availableYears]);

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      let imported: AppRow[] = [];
      const fileNames: string[] = [];
      for (const file of files) {
        const parsed = await readWorkbookFile(file);
        imported = imported.concat(normalizeImportedRows(parsed.rows, parsed.fileName));
        fileNames.push(parsed.fileName);
      }
      setRows((previous) => mergeRows(previous, imported));
      setImportedFiles((previous) => Array.from(new Set([...previous, ...fileNames])));
    } finally {
      setUploading(false);
    }
  }

  function clearArchive() {
    setRows([]);
    setImportedFiles([]);
    setSettings(DEFAULT_SETTINGS);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ rows, importedFiles, settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dealer-erogato-backup.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result || '{}')) as { rows?: AppRow[]; importedFiles?: string[]; settings?: Settings };
        setRows(parsed.rows || []);
        setImportedFiles(parsed.importedFiles || []);
        setSettings({ ...DEFAULT_SETTINGS, ...(parsed.settings || {}) });
      } catch {
        window.alert('Backup non valido');
      }
    };
    reader.readAsText(file);
  }

  const progress = forecast.annualTarget ? Math.min((forecast.projectedAnnual / forecast.annualTarget) * 100, 100) : 0;
  const januaryCard = monthlyData[0];

  return (
    <div className="app-shell">
      <div className="page">
        <header className="hero">
          <div>
            <h1>Dealer Erogato App</h1>
            <p>Versione corretta con data di liquidazione, polizze da colonna dedicata, filtro filiale/subagente e gestione import multipli senza perdere gennaio.</p>
          </div>
          <div className="hero-actions">
            <label className="action-button primary">
              <Upload className="icon" />
              <span>{uploading ? 'Importazione...' : 'Carica Excel'}</span>
              <input type="file" accept=".xlsx,.xlsm,.xls" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
            </label>
            <button className="action-button" onClick={exportBackup}><Download className="icon" />Backup</button>
            <label className="action-button">
              <RefreshCw className="icon" />
              <span>Importa backup</span>
              <input type="file" accept=".json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) importBackup(file); }} />
            </label>
            <button className="action-button danger" onClick={clearArchive}><Trash2 className="icon" />Azzera archivio</button>
          </div>
        </header>

        <section className="banner-grid">
          <div className="banner-card info">
            <Database className="icon large" />
            <div>
              <div className="banner-title">Archivio locale</div>
              <div className="banner-value">{num(rows.length)} pratiche</div>
              <div className="banner-text">I file si importano direttamente dall'export banca. Non devi più aggiornare manualmente l'Excel storico.</div>
            </div>
          </div>
          <div className="banner-card success">
            <Target className="icon large" />
            <div>
              <div className="banner-title">Gennaio {currentYear}</div>
              <div className="banner-value">{januaryCard ? euro(januaryCard.erogato) : '-'}</div>
              <div className="banner-text">Valore calcolato usando sempre <strong>DATA_LIQUIDAZIONE</strong>.</div>
            </div>
          </div>
        </section>

        <section className="filters-card">
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
            </div>
          </div>
          {importedFiles.length > 0 && <div className="imported-files">File importati: {importedFiles.join(', ')}</div>}
        </section>

        <section className="kpi-grid">
          <KPI title="Erogato" value={euro0(kpis.erogato)} subtitle={`${num(kpis.pratiche)} pratiche`} icon={Euro} />
          <KPI title="Ticket medio" value={euro0(kpis.ticketMedio)} subtitle="Importo medio pratica" icon={TrendingUp} />
          <KPI title="Provvigioni" value={euro(kpis.provvigioni)} subtitle="PROVV oppure formula automatica" icon={Wallet} />
          <KPI title="Polizze" value={euro(kpis.polizze)} subtitle="Da importo polizza" icon={ShieldCheck} />
          <KPI title="Dealer attivi" value={num(kpis.dealerCount)} subtitle="Nel filtro corrente" icon={Users} />
          <KPI title="Forecast anno" value={euro0(forecast.projectedAnnual)} subtitle={forecast.annualTarget ? `Target ${euro0(forecast.annualTarget)}` : 'Target non impostato'} icon={Target} />
        </section>

        <nav className="tabs">
          {[
            ['overview', 'Overview'],
            ['forecast', 'Previsione'],
            ['dealers', 'Dealer'],
            ['subagenti', 'Filiali'],
            ['portfolio', 'Portafoglio'],
            ['data', 'Dati'],
          ].map(([key, label]) => (
            <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key as typeof tab)}>{label}</button>
          ))}
        </nav>

        {tab === 'overview' && (
          <div className="stack">
            <div className="panel-grid two-one">
              <div className="panel">
                <div className="panel-header"><h3>Erogato mese per mese</h3><span>Importo finanziato per data liquidazione</span></div>
                <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="monthShort" /><YAxis /><Tooltip formatter={(value: number) => euro(value)} /><Bar dataKey="erogato" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="panel">
                <div className="panel-header"><h3>Mix prodotto</h3><span>Ripartizione per prodotto</span></div>
                <div className="chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={mix} dataKey="value" nameKey="name" outerRadius={90} label /><Tooltip formatter={(value: number) => euro(value)} /></PieChart></ResponsiveContainer></div>
              </div>
            </div>
            {comparisonYears.length > 0 && (
              <div className="panel">
                <div className="panel-header"><h3>Confronto anno su anno</h3><span>{currentYear - 1} vs {currentYear}</span></div>
                <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={comparisonYears}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value: number) => euro(value)} /><Legend /><Line type="monotone" dataKey={String(currentYear - 1)} strokeWidth={2} dot={{ r: 3 }} /><Line type="monotone" dataKey={String(currentYear)} strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
              </div>
            )}
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

        {tab === 'dealers' && (
          <div className="stack">
            <div className="panel-grid two-one">
              <div className="panel">
                <div className="panel-header"><h3>Top dealer per erogato</h3><span>Dealer del periodo filtrato</span></div>
                <div className="chart tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={dealerRanking} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={210} /><Tooltip formatter={(value: number) => euro(value)} /><Bar dataKey="erogato" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="panel">
                <div className="panel-header"><h3>Sintesi dealer</h3><span>Prime posizioni</span></div>
                <div className="list-stack">
                  {dealerRanking.slice(0, 10).map((row, index) => (
                    <div key={row.name} className="list-item">
                      <div>
                        <div className="list-title">#{index + 1} {row.name}</div>
                        <div className="list-subtitle">{row.pratiche} pratiche · ticket {euro0(row.ticketMedio)}</div>
                      </div>
                      <div className="list-value">{euro0(row.erogato)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Tabella dealer</h3><span>Erogato, pratiche, ticket, provvigioni e polizze</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Dealer</th><th className="right">Erogato</th><th className="right">Pratiche</th><th className="right">Ticket medio</th><th className="right">Provvigioni</th><th className="right">Polizze</th></tr></thead>
                  <tbody>
                    {dealerTable.map((row) => (
                      <tr key={row.name}><td>{row.name}</td><td className="right">{euro(row.erogato)}</td><td className="right">{num(row.pratiche)}</td><td className="right">{euro(row.ticketMedio)}</td><td className="right">{euro(row.provvigioni)}</td><td className="right">{euro(row.polizze)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'subagenti' && (
          <div className="stack">
            <div className="panel-grid two-one">
              <div className="panel">
                <div className="panel-header"><h3>Top filiali / subagenti</h3><span>Ranking per DES_SUBAGENTE</span></div>
                <div className="chart tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={subagenteRanking} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={210} /><Tooltip formatter={(value: number) => euro(value)} /><Bar dataKey="erogato" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="panel">
                <div className="panel-header"><h3>Sintesi filiali</h3><span>Prime posizioni</span></div>
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
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Tabella filiali</h3><span>Subagente = filiale</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Filiale</th><th className="right">Erogato</th><th className="right">Pratiche</th><th className="right">Ticket medio</th><th className="right">Provvigioni</th><th className="right">Polizze</th></tr></thead>
                  <tbody>
                    {subagenteTable.map((row) => (
                      <tr key={row.name}><td>{row.name}</td><td className="right">{euro(row.erogato)}</td><td className="right">{num(row.pratiche)}</td><td className="right">{euro(row.ticketMedio)}</td><td className="right">{euro(row.provvigioni)}</td><td className="right">{euro(row.polizze)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'portfolio' && (
          <div className="panel">
            <div className="panel-header"><h3>Ultime pratiche</h3><span>Archivio filtrato ordinato per data liquidazione</span></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th><th>Dealer</th><th>Filiale</th><th>Cliente</th><th>Prodotto</th><th>Tabella</th><th className="right">Importo</th><th className="right">Provv.</th><th className="right">Polizza</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredRows].sort((a, b) => new Date(b.dateISO || 0).getTime() - new Date(a.dateISO || 0).getTime()).slice(0, 200).map((row) => (
                    <tr key={row.rowId}>
                      <td>{row.dateISO ? new Date(row.dateISO).toLocaleDateString('it-IT') : '-'}</td>
                      <td>{row.dealer}</td>
                      <td>{row.subagente}</td>
                      <td>{row.cliente}</td>
                      <td>{row.prodottoCode}</td>
                      <td>{row.tabella || '-'}</td>
                      <td className="right">{euro(row.importoFinanziato)}</td>
                      <td className="right">{euro(row.provvigione)}</td>
                      <td className="right">{euro(row.polizza)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div className="stack">
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
                      value={settings.stagionalitaByYear?.[currentYear]?.[index] ?? ''}
                      onChange={(e) => {
                        const copy = [...(settings.stagionalitaByYear?.[currentYear] || Array(12).fill(0))];
                        copy[index] = Number(e.target.value || 0);
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
                <div>• polizze: <strong>importo polizza</strong></div>
                <div>• provvigioni: <strong>PROVV</strong> oppure formula automatica (31 = 0,825%; resto = 0,55%)</div>
                <div>• deduplica robusta tra import successivi, senza eliminare i duplicati reali già presenti nel file</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
