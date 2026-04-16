
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, LineChart, Line, Legend } from 'recharts';
import { Upload, Euro, Users, TrendingUp, Target, Trash2, ShieldCheck, Wallet, Download, Database, Building2, Search } from 'lucide-react';
import './styles.css';

type Row = {
  appId: string; uniqueKey: string; sourceFile: string; convenzionato: string; dealer: string; subagente: string;
  agente: string; situazione: string; cliente: string; codiceFiscale: string; prodotto: string; prodottoCode: string;
  tabella: string; numeroRate: number; importoRata: number; importoFinanziato: number; importoNettoErogato: number;
  dataCaricamento: string | null; dataLiquidazione: string | null; modPagamento: string; indirizzo: string; cap: string;
  localita: string; provincia: string; provvigione: number; polizza: number; year: number; month: number; dateISO: string | null;
};
type Settings = { annualTargetByYear: Record<number, number>; stagionalitaByYear: Record<number, number[]> };

const STORAGE_KEY = 'dealer_erogato_app_v2';
const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const DEFAULT_2026_STAGIONALITA = [0.0422467773,0.0679778571,0.0611428174,0.0612145238,0.0556212658,0.0852724183,0.1160142533,0.0483985297,0.10272674,0.1183406974,0.0991278003,0.1419163194];
const DEFAULT_SETTINGS: Settings = { annualTargetByYear: {2026: 10200000}, stagionalitaByYear: {2026: DEFAULT_2026_STAGIONALITA} };

function euro(n:number){ return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n||0));}
function num(n:number,digits=0){ return new Intl.NumberFormat('it-IT',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(Number(n||0));}
function pct(n:number){ return `${num(Number(n||0)*100,1)}%`; }
function safeUpper(v:unknown){ return String(v ?? '').trim().toUpperCase(); }
function cleanNumber(value:unknown){ if(typeof value==='number') return Number.isFinite(value)?value:0; if(typeof value==='string'){ const normalized=value.replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''); const parsed=Number(normalized); return Number.isFinite(parsed)?parsed:0;} return 0; }
function excelDateToDate(value:unknown): Date | null { if(!value && value!==0) return null; if(value instanceof Date) return value; if(typeof value==='number'){ const utcDays=Math.floor(value-25569); const utcValue=utcDays*86400; return new Date(utcValue*1000);} if(typeof value==='string'){ const direct=new Date(value); if(!Number.isNaN(direct.getTime())) return direct; const match=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if(match){ const d=Number(match[1]); const m=Number(match[2])-1; const y=Number(match[3].length===2 ? `20${match[3]}` : match[3]); return new Date(y,m,d);} } return null; }
function normalizeProduct(code:unknown){ const raw=safeUpper(code); if(['20','21'].includes(raw)) return 'AUTO'; if(['30','31'].includes(raw)) return 'POS'; return raw || 'N/D';}
function pick(row: Record<string, unknown>, keys: string[], fallback=''){ for(const key of keys){ if(row[key]!==undefined && row[key]!==null && row[key]!=='') return row[key] as string;} return fallback; }
function workingDaysInMonth(year:number, monthIndex:number){ const date=new Date(year,monthIndex,1); let count=0; while(date.getMonth()===monthIndex){ const day=date.getDay(); if(day!==0 && day!==6) count+=1; date.setDate(date.getDate()+1);} return count; }
function workedDaysInMonth(year:number, monthIndex:number, referenceDate=new Date()){ const start=new Date(year,monthIndex,1); const end=new Date(year,monthIndex+1,0); const ref=referenceDate<start ? null : referenceDate>end ? end : referenceDate; if(!ref) return 0; let count=0; const date=new Date(start); while(date<=ref){ const day=date.getDay(); if(day!==0 && day!==6) count+=1; date.setDate(date.getDate()+1);} return count; }

async function readWorkbookFile(file: File){
  return new Promise<{fileName:string, rows: Record<string, unknown>[], databaseSheetName:string}>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const databaseSheetName = workbook.SheetNames.find((name) => name.toUpperCase().includes('DATABASE')) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[databaseSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      resolve({ fileName: file.name, rows: rows as Record<string, unknown>[], databaseSheetName });
    };
    reader.readAsArrayBuffer(file);
  });
}

function normalizeRows(rows: Record<string, unknown>[], fileName: string): Row[] {
  return rows.map((row, index) => {
    const liquidationDate = excelDateToDate(pick(row, ['DATA_LIQUIDAZIONE', 'Data liquidazione']));
    const loadingDate = excelDateToDate(pick(row, ['DATA_CARICAMENTO', 'Data caricamento']));
    const date = liquidationDate || loadingDate;
    const year = date ? date.getFullYear() : null;
    const month = date ? date.getMonth() + 1 : null;
    const dealer = pick(row, ['DES_CONVENZIONATO', 'RAGIONE_SOCIALE_DLR', 'DEALER'], 'N/D');
    const clientCode = pick(row, ['CLIENTE', 'ID_CLIENTE']);
    const fiscalCode = pick(row, ['CODICE_FISCALE_CLI', 'CF']);
    const amount = cleanNumber(pick(row, ['IMPORTO_FINANZIATO', 'IMPORTO FINANZIATO']));
    const netAmount = cleanNumber(pick(row, ['IMPORTO_NETTO_EROGATO', 'IMPORTO NETTO EROGATO']));
    const provvigione = cleanNumber(pick(row, ['PROVV', 'PROVVIGIONE']));
    const polizza = cleanNumber(pick(row, ['importo polizza ', 'IMPORTO_POLIZZA', 'IMPORTO POLIZZA']));
    const product = normalizeProduct(pick(row, ['PRODOTTO', 'CODICE_PRODOTTO']));
    const numeroRate = cleanNumber(pick(row, ['NUMERO_RATE', 'N_RATE']));
    const tabella = pick(row, ['TABELLA_FINANZ', 'TABELLA']);
    const subagente = pick(row, ['DES_SUBAGENTE', 'SUBAGENTE'], 'N/D');
    const cliente = pick(row, ['DES_CLIENTE', 'CLIENTE_NOME'], 'N/D');
    const dataKey = date ? date.toISOString().slice(0, 10) : '';
    const uniqueKey = [safeUpper(pick(row, ['CONVENZIONATO'])), safeUpper(clientCode), safeUpper(fiscalCode), amount, numeroRate, product, dataKey].join('|');
    return {
      appId: `${fileName}-${index + 1}`, uniqueKey, sourceFile: fileName, convenzionato: pick(row, ['CONVENZIONATO']),
      dealer, subagente, agente: pick(row, ['DES_AGENTE', 'AGENTE'], 'N/D'), situazione: pick(row, ['SITUAZIONE'], ''),
      cliente, codiceFiscale: fiscalCode, prodotto: product, prodottoCode: pick(row, ['PRODOTTO']), tabella, numeroRate,
      importoRata: cleanNumber(pick(row, ['IMPORTO_RATA', 'RATA'])), importoFinanziato: amount, importoNettoErogato: netAmount,
      dataCaricamento: loadingDate ? loadingDate.toISOString() : null, dataLiquidazione: liquidationDate ? liquidationDate.toISOString() : null,
      modPagamento: pick(row, ['MOD_PAGAMENTO']), indirizzo: pick(row, ['INDIRIZZO_CLI']), cap: pick(row, ['CAP_CLIENTE']),
      localita: pick(row, ['LOCALITA_CLI']), provincia: pick(row, ['PROVINCIA_CLI']), provvigione, polizza,
      year: year || new Date().getFullYear(), month: month || 1, dateISO: date ? date.toISOString() : null,
    };
  }).filter((r) => r.importoFinanziato > 0 && r.year);
}

function mergeUniqueRows(existing: Row[], incoming: Row[]) {
  const map = new Map(existing.map((r) => [r.uniqueKey, r]));
  incoming.forEach((r) => { const prev = map.get(r.uniqueKey); if (!prev) map.set(r.uniqueKey, r); else map.set(r.uniqueKey, { ...prev, ...r }); });
  return Array.from(map.values()).sort((a, b) => new Date(a.dateISO || 0).getTime() - new Date(b.dateISO || 0).getTime());
}
function monthSeriesFromRows(rows: Row[], year: number){ const data = MONTHS_IT.map((label, idx) => ({monthIndex:idx,month:label,monthShort:MONTHS_SHORT[idx],erogato:0,pratiche:0,provvigioni:0,polizze:0})); rows.filter((r)=>r.year===year).forEach((r)=>{ const item=data[(r.month||1)-1]; item.erogato+=r.importoFinanziato; item.pratiche+=1; item.provvigioni+=r.provvigione; item.polizze+=r.polizza;}); return data; }
function topDealers(rows: Row[], year:number, limit=12){ const map=new Map<string, any>(); rows.filter((r)=>r.year===year).forEach((r)=>{ if(!map.has(r.dealer)) map.set(r.dealer,{dealer:r.dealer,erogato:0,pratiche:0,provvigioni:0,polizze:0,ticketMedio:0}); const item=map.get(r.dealer); item.erogato+=r.importoFinanziato; item.pratiche+=1; item.provvigioni+=r.provvigione; item.polizze+=r.polizza; item.ticketMedio=item.pratiche ? item.erogato/item.pratiche : 0;}); return Array.from(map.values()).sort((a,b)=>b.erogato-a.erogato).slice(0,limit);}
function dealerSummary(rows: Row[], year:number){ const map=new Map<string, any>(); rows.filter((r)=>r.year===year).forEach((r)=>{ if(!map.has(r.dealer)) map.set(r.dealer,{dealer:r.dealer,erogato:0,pratiche:0,provvigioni:0,polizze:0,subagenti:new Set<string>()}); const item=map.get(r.dealer); item.erogato+=r.importoFinanziato; item.pratiche+=1; item.provvigioni+=r.provvigione; item.polizze+=r.polizza; if(r.subagente && r.subagente!=='N/D') item.subagenti.add(r.subagente);}); return Array.from(map.values()).map((d)=>({...d,subagentiCount:d.subagenti.size,ticketMedio:d.pratiche ? d.erogato/d.pratiche : 0})).sort((a,b)=>b.erogato-a.erogato);}
function productMix(rows: Row[], year:number){ const map=new Map<string, any>(); rows.filter((r)=>r.year===year).forEach((r)=>{ if(!map.has(r.prodotto)) map.set(r.prodotto,{name:r.prodotto,value:0,pratiche:0}); const item=map.get(r.prodotto); item.value+=r.importoFinanziato; item.pratiche+=1;}); return Array.from(map.values()).sort((a,b)=>b.value-a.value);}
function buildForecast(rows: Row[], year:number, settings:Settings, referenceDate=new Date()){ const monthly=monthSeriesFromRows(rows,year); const target=Number(settings?.annualTargetByYear?.[year]||0); const stagionalita=settings?.stagionalitaByYear?.[year] || DEFAULT_2026_STAGIONALITA; const refYear=referenceDate.getFullYear(); const refMonth=referenceDate.getMonth(); const isCurrentYear=year===refYear; const currentMonthIndex=isCurrentYear ? refMonth : year < refYear ? 11 : -1; const monthlyForecast=monthly.map((m,idx)=>{ const real=m.erogato; const seasonality=Number(stagionalita[idx]||0); const stimato=target ? target*seasonality : 0; const workingDays=workingDaysInMonth(year,idx); const workedDays=isCurrentYear ? workedDaysInMonth(year,idx,referenceDate) : year<refYear ? workingDays : 0; const mediaGg=workedDays>0 && real>0 ? real/workedDays : 0; const ipotetico=mediaGg>0 ? mediaGg*workingDays : real || stimato; let note='Futuro'; if(year<refYear || (isCurrentYear && idx<currentMonthIndex)) note='Completato'; if(isCurrentYear && idx===currentMonthIndex) note='Mese corrente'; return {...m,seasonality,stimato,workingDays,workedDays,mediaGg,ipotetico,note,deltaTarget:real-stimato};}); const ytd=monthlyForecast.reduce((sum,m,idx)=>{ if(year<refYear) return sum+m.erogato; if(year===refYear && idx<=currentMonthIndex) return sum+m.erogato; return sum;},0); const projectedAnnual=monthlyForecast.reduce((sum,m,idx)=>{ if(year<refYear) return sum+m.erogato; if(year>refYear) return sum+(m.stimato||0); if(idx<currentMonthIndex) return sum+m.erogato; if(idx===currentMonthIndex) return sum+Math.max(m.ipotetico,m.erogato,m.stimato); return sum+(m.stimato||0);},0); return {annualTarget:target,projectedAnnual,ytd,gapToTarget:target ? projectedAnnual-target : 0,monthlyForecast}; }
function KPI({ title, value, subtitle, icon: Icon }: {title:string; value:string; subtitle?:string; icon:any}) { return <div className="card kpi"><div><div className="muted small">{title}</div><div className="kpi-value">{value}</div>{subtitle ? <div className="muted xs">{subtitle}</div> : null}</div><div className="icon-box"><Icon size={18} /></div></div></div>; }

function App(){
  const [rows,setRows]=React.useState<Row[]>([]);
  const [settings,setSettings]=React.useState<Settings>(DEFAULT_SETTINGS);
  const [search,setSearch]=React.useState('');
  const [yearFilter,setYearFilter]=React.useState(String(new Date().getFullYear()));
  const [dealerFilter,setDealerFilter]=React.useState('ALL');
  const [productFilter,setProductFilter]=React.useState('ALL');
  const [selectedDealer,setSelectedDealer]=React.useState('ALL');
  const [uploading,setUploading]=React.useState(false);
  const [importedFiles,setImportedFiles]=React.useState<string[]>([]);
  const [tab,setTab]=React.useState('overview');

  React.useEffect(()=>{ const raw=window.localStorage.getItem(STORAGE_KEY); if(!raw) return; try{ const parsed=JSON.parse(raw); setRows(parsed.rows || []); setSettings({ ...DEFAULT_SETTINGS, ...(parsed.settings || {})}); setImportedFiles(parsed.importedFiles || []);}catch{} },[]);
  React.useEffect(()=>{ window.localStorage.setItem(STORAGE_KEY, JSON.stringify({rows,settings,importedFiles})); },[rows,settings,importedFiles]);

  const availableYears=React.useMemo(()=>{ const years=Array.from(new Set(rows.map((r)=>r.year))).sort((a,b)=>a-b); return years.length ? years : [new Date().getFullYear()]; },[rows]);
  React.useEffect(()=>{ if(!availableYears.includes(Number(yearFilter))) setYearFilter(String(availableYears[availableYears.length-1])); },[availableYears,yearFilter]);
  const filteredRows=React.useMemo(()=>rows.filter((r)=>{ const yearOk=!yearFilter || String(r.year)===String(yearFilter); const dealerOk=dealerFilter==='ALL' || r.dealer===dealerFilter; const productOk=productFilter==='ALL' || r.prodotto===productFilter; const searchOk=!search || [r.dealer,r.subagente,r.localita,r.provincia,r.cliente,r.tabella].join(' ').toLowerCase().includes(search.toLowerCase()); return yearOk && dealerOk && productOk && searchOk;}),[rows,yearFilter,dealerFilter,productFilter,search]);
  const currentYear=Number(yearFilter);
  const dealers=React.useMemo(()=>['ALL', ...Array.from(new Set(rows.filter((r)=>String(r.year)===String(currentYear)).map((r)=>r.dealer))).sort()],[rows,currentYear]);
  const products=React.useMemo(()=>['ALL', ...Array.from(new Set(rows.filter((r)=>String(r.year)===String(currentYear)).map((r)=>r.prodotto))).sort()],[rows,currentYear]);
  const dealerList=React.useMemo(()=>['ALL', ...dealerSummary(rows,currentYear).map((d)=>d.dealer)],[rows,currentYear]);
  const kpis=React.useMemo(()=>{ const erogato=filteredRows.reduce((sum,r)=>sum+r.importoFinanziato,0); const pratiche=filteredRows.length; const ticketMedio=pratiche ? erogato/pratiche : 0; const provvigioni=filteredRows.reduce((sum,r)=>sum+r.provvigione,0); const polizze=filteredRows.reduce((sum,r)=>sum+r.polizza,0); const dealerCount=new Set(filteredRows.map((r)=>r.dealer)).size; return {erogato,pratiche,ticketMedio,provvigioni,polizze,dealerCount}; },[filteredRows]);
  const monthlyData=React.useMemo(()=>monthSeriesFromRows(filteredRows,currentYear),[filteredRows,currentYear]);
  const ranking=React.useMemo(()=>topDealers(filteredRows,currentYear),[filteredRows,currentYear]);
  const mix=React.useMemo(()=>productMix(filteredRows,currentYear),[filteredRows,currentYear]);
  const forecast=React.useMemo(()=>buildForecast(filteredRows,currentYear,settings,new Date()),[filteredRows,currentYear,settings]);
  const dealerTable=React.useMemo(()=>dealerSummary(filteredRows,currentYear),[filteredRows,currentYear]);
  const selectedDealerRows=React.useMemo(()=>selectedDealer==='ALL' ? [] : filteredRows.filter((r)=>r.dealer===selectedDealer),[filteredRows,selectedDealer]);
  const selectedDealerMonthly=React.useMemo(()=>monthSeriesFromRows(selectedDealerRows,currentYear),[selectedDealerRows,currentYear]);
  const selectedDealerKpi=React.useMemo(()=>{ if(selectedDealer==='ALL') return null; const erogato=selectedDealerRows.reduce((sum,r)=>sum+r.importoFinanziato,0); const pratiche=selectedDealerRows.length; const provvigioni=selectedDealerRows.reduce((sum,r)=>sum+r.provvigione,0); const polizze=selectedDealerRows.reduce((sum,r)=>sum+r.polizza,0); return {erogato,pratiche,provvigioni,polizze,ticketMedio: pratiche ? erogato/pratiche : 0}; },[selectedDealer,selectedDealerRows]);
  const comparisonYears=React.useMemo(()=>{ const prev=currentYear-1; if(!availableYears.includes(prev)) return []; const current=monthSeriesFromRows(rows,currentYear).map((m)=>({month:m.monthShort,[currentYear]:m.erogato})); const previous=monthSeriesFromRows(rows,prev).map((m)=>m.erogato); return current.map((item,idx)=>({...item,[prev]:previous[idx]||0})); },[rows,currentYear,availableYears]);

  async function handleFiles(fileList: FileList | null){ const files=Array.from(fileList || []); if(!files.length) return; setUploading(true); try{ let incoming: Row[]=[]; for(const file of files){ const parsed=await readWorkbookFile(file); incoming=incoming.concat(normalizeRows(parsed.rows,parsed.fileName)); } setImportedFiles((prev)=>Array.from(new Set([...prev, ...files.map((f)=>f.name)]))); setRows((prev)=>mergeUniqueRows(prev,incoming)); } finally{ setUploading(false); } }
  function clearData(){ setRows([]); setSettings(DEFAULT_SETTINGS); setImportedFiles([]); window.localStorage.removeItem(STORAGE_KEY); }
  function importJson(file: File){ const reader=new FileReader(); reader.onload=(e)=>{ try{ const parsed=JSON.parse(String(e.target?.result || '{}')); setRows(parsed.rows || []); setSettings({ ...DEFAULT_SETTINGS, ...(parsed.settings || {})}); setImportedFiles(parsed.importedFiles || []);}catch{ alert('File backup non valido'); } }; reader.readAsText(file); }
  function exportJson(){ const blob=new Blob([JSON.stringify({rows,settings,importedFiles},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='dealer-erogato-backup.json'; a.click(); URL.revokeObjectURL(url); }
  const progress=forecast.annualTarget ? Math.min((forecast.projectedAnnual/forecast.annualTarget)*100,100) : 0;

  return <div className="app-shell"><div className="container">
    <div className="header"><div><h1>Dealer Erogato App</h1><p className="muted">Storico multianno unificato, upload manuale Excel e forecast mese per mese basato sul tuo foglio DATABASE.</p></div><div className="actions">
      <label className="button"><Upload size={16} />{uploading ? 'Importazione...' : 'Carica Excel'}<input type="file" accept=".xlsx,.xlsm,.xls" multiple hidden onChange={(e)=>handleFiles(e.target.files)} /></label>
      <button className="button secondary" onClick={exportJson}><Download size={16}/>Backup dati</button>
      <label className="button secondary"><Download size={16}/>Importa backup<input type="file" accept=".json" hidden onChange={(e)=>{ const file=e.target.files?.[0]; if(file) importJson(file); }} /></label>
      <button className="button secondary" onClick={clearData}><Trash2 size={16}/>Azzera archivio</button>
    </div></div>

    <div className="card banner"><div className="banner-title">Come usare i tuoi Excel</div><div className="muted">Puoi continuare a caricare i file con la stessa impostazione del foglio <strong>DATABASE</strong>, riga per riga, come fai oggi. Gli anni precedenti li devi importare anche loro, ma solo una volta: 2024, 2025, 2026 e poi aggiungi i nuovi file man mano.</div><div className="badges"><span className="badge">1. Esporta Excel dalla banca</span><span className="badge">2. Caricalo nell'app</span><span className="badge">3. Lo storico si aggiorna</span><span className="badge">4. Salva backup JSON</span></div></div>

    <div className="card toolbar"><div className="archive"><div className="icon-box"><Database size={18}/></div><div><div className="muted small">Archivio locale</div><div>{num(rows.length)} pratiche caricate</div></div></div>
      <div className="toolbar-right"><div className="search-wrap"><Search size={16} className="search-icon" /><input className="input search" placeholder="Cerca dealer, città, cliente, tabella" value={search} onChange={(e)=>setSearch(e.target.value)} /></div>
        <select className="select" value={yearFilter} onChange={(e)=>setYearFilter(e.target.value)}>{availableYears.map((y)=><option key={y} value={String(y)}>{y}</option>)}</select>
        <select className="select" value={dealerFilter} onChange={(e)=>setDealerFilter(e.target.value)}>{dealers.map((d)=><option key={d} value={d}>{d==='ALL' ? 'Tutti i dealer' : d}</option>)}</select>
        <select className="select" value={productFilter} onChange={(e)=>setProductFilter(e.target.value)}>{products.map((p)=><option key={p} value={p}>{p==='ALL' ? 'Tutti i prodotti' : p}</option>)}</select>
      </div>{importedFiles.length>0 ? <div className="muted xs files">File importati: {importedFiles.join(', ')}</div> : null}</div>

    <div className="grid kpi-grid">
      <KPI title="Erogato" value={euro(kpis.erogato)} subtitle={`${num(kpis.pratiche)} pratiche`} icon={Euro} />
      <KPI title="Ticket medio" value={euro(kpis.ticketMedio)} subtitle="Importo medio pratica" icon={TrendingUp} />
      <KPI title="Provvigioni" value={euro(kpis.provvigioni)} subtitle="Somma PROVV caricata" icon={Wallet} />
      <KPI title="Polizze" value={euro(kpis.polizze)} subtitle="Importo polizze" icon={ShieldCheck} />
      <KPI title="Dealer attivi" value={num(kpis.dealerCount)} subtitle="Nel filtro corrente" icon={Users} />
      <KPI title="Forecast anno" value={euro(forecast.projectedAnnual)} subtitle={forecast.annualTarget ? `Target ${euro(forecast.annualTarget)}` : 'Imposta target'} icon={Target} />
    </div>

    <div className="tabs">{['overview','forecast','dealers','dealerCard','portfolio','data'].map((t)=><button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{({overview:'Overview',forecast:'Previsione',dealers:'Dealer',dealerCard:'Scheda dealer',portfolio:'Portafoglio',data:'Dati'} as any)[t]}</button>)}</div>

    {tab==='overview' && <div className="stack"><div className="grid two-one">
      <div className="card"><div className="card-title">Erogato mese per mese</div><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="monthShort" /><YAxis /><Tooltip formatter={(v:number)=>euro(v)} /><Bar dataKey="erogato" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></div></div>
      <div className="card"><div className="card-title">Mix prodotto</div><div className="chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={mix} dataKey="value" nameKey="name" outerRadius={95} label /><Tooltip formatter={(v:number)=>euro(v)} /></PieChart></ResponsiveContainer></div></div>
    </div>{comparisonYears.length>0 && <div className="card"><div className="card-title">Confronto anno su anno</div><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={comparisonYears}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v:number)=>euro(v)} /><Legend /><Line type="monotone" dataKey={String(currentYear-1)} strokeWidth={2} dot={{r:3}} /><Line type="monotone" dataKey={String(currentYear)} strokeWidth={3} dot={{r:4}} /></LineChart></ResponsiveContainer></div></div>}</div>}

    {tab==='forecast' && <div className="stack"><div className="grid four"><div className="card mini"><div className="muted small">Target anno</div><div className="big">{euro(forecast.annualTarget)}</div></div><div className="card mini"><div className="muted small">YTD reale</div><div className="big">{euro(forecast.ytd)}</div></div><div className="card mini"><div className="muted small">Proiezione fine anno</div><div className="big">{euro(forecast.projectedAnnual)}</div></div><div className="card mini"><div className="muted small">Gap vs target</div><div className="big">{euro(forecast.gapToTarget)}</div></div></div>
      <div className="card"><div className="card-title">Avanzamento target</div><div className="progress"><div className="progress-bar" style={{width:`${progress}%`}} /></div><div className="muted small">Copertura stimata target: <strong>{forecast.annualTarget ? pct(forecast.projectedAnnual/forecast.annualTarget) : '-'}</strong></div></div>
      <div className="card"><div className="card-title">Tabella previsione erogato</div><div className="table-wrap"><table><thead><tr><th>Mese</th><th className="right">Erogato reale</th><th className="right">Stagionalità</th><th className="right">Erogato stimato</th><th className="right">GG lavorativi</th><th className="right">GG lavorati</th><th className="right">Media GG</th><th className="right">Erogato ipotetico</th><th className="right">Delta vs stimato</th><th>Note</th></tr></thead><tbody>{forecast.monthlyForecast.map((m:any)=><tr key={m.month}><td>{m.month}</td><td className="right">{euro(m.erogato)}</td><td className="right">{pct(m.seasonality)}</td><td className="right">{euro(m.stimato)}</td><td className="right">{num(m.workingDays)}</td><td className="right">{num(m.workedDays)}</td><td className="right">{m.mediaGg ? euro(m.mediaGg) : '-'}</td><td className="right">{euro(m.ipotetico)}</td><td className="right">{euro(m.deltaTarget)}</td><td><span className="badge">{m.note}</span></td></tr>)}</tbody></table></div></div>
    </div>}

    {tab==='dealers' && <div className="stack"><div className="grid two-one">
      <div className="card"><div className="card-title">Top dealer per erogato</div><div className="chart tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={ranking} layout="vertical" margin={{left:20,right:20}}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="dealer" width={220} /><Tooltip formatter={(v:number)=>euro(v)} /><Bar dataKey="erogato" radius={[0,8,8,0]} /></BarChart></ResponsiveContainer></div></div>
      <div className="card"><div className="card-title">Sintesi ranking</div><div className="stack compact">{ranking.slice(0,10).map((item:any,i:number)=><div key={item.dealer} className="list-item"><div><div className="small-strong">#{i+1} {item.dealer}</div><div className="muted xs">{item.pratiche} pratiche · ticket {euro(item.ticketMedio)}</div></div><div className="small-strong">{euro(item.erogato)}</div></div>)}</div></div>
    </div><div className="card"><div className="card-title">Tabella dealer</div><div className="table-wrap"><table><thead><tr><th>Dealer</th><th className="right">Erogato</th><th className="right">Pratiche</th><th className="right">Ticket medio</th><th className="right">Provvigioni</th><th className="right">Polizze</th><th className="right">Subagenti</th></tr></thead><tbody>{dealerTable.map((d:any)=><tr key={d.dealer}><td>{d.dealer}</td><td className="right">{euro(d.erogato)}</td><td className="right">{num(d.pratiche)}</td><td className="right">{euro(d.ticketMedio)}</td><td className="right">{euro(d.provvigioni)}</td><td className="right">{euro(d.polizze)}</td><td className="right">{num(d.subagentiCount)}</td></tr>)}</tbody></table></div></div></div>}

    {tab==='dealerCard' && <div className="stack"><div className="card"><div className="card-title">Scheda singolo dealer</div><select className="select maxw" value={selectedDealer} onChange={(e)=>setSelectedDealer(e.target.value)}>{dealerList.map((d)=><option key={d} value={d}>{d==='ALL' ? 'Seleziona un dealer' : d}</option>)}</select></div>
      {selectedDealerKpi ? <><div className="grid five"><KPI title="Dealer" value={selectedDealer} subtitle="Scheda attiva" icon={Building2} /><KPI title="Erogato" value={euro(selectedDealerKpi.erogato)} subtitle={`${num(selectedDealerKpi.pratiche)} pratiche`} icon={Euro} /><KPI title="Ticket medio" value={euro(selectedDealerKpi.ticketMedio)} subtitle="Media pratica" icon={TrendingUp} /><KPI title="Provvigioni" value={euro(selectedDealerKpi.provvigioni)} subtitle="Periodo filtrato" icon={Wallet} /><KPI title="Polizze" value={euro(selectedDealerKpi.polizze)} subtitle="Periodo filtrato" icon={ShieldCheck} /></div><div className="card"><div className="card-title">Trend mensile dealer</div><div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={selectedDealerMonthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="monthShort" /><YAxis /><Tooltip formatter={(v:number)=>euro(v)} /><Bar dataKey="erogato" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></div></div></> : <div className="card muted">Seleziona un dealer per vedere la scheda dedicata.</div>}
    </div>}

    {tab==='portfolio' && <div className="card"><div className="card-title">Ultime pratiche</div><div className="table-wrap"><table><thead><tr><th>Data</th><th>Dealer</th><th>Cliente</th><th>Prodotto</th><th>Tabella</th><th className="right">Importo</th><th className="right">Provv.</th><th className="right">Polizza</th><th>Subagente</th></tr></thead><tbody>{[...filteredRows].sort((a,b)=>new Date(b.dateISO || 0).getTime()-new Date(a.dateISO || 0).getTime()).slice(0,150).map((r)=><tr key={r.appId}><td>{r.dateISO ? new Date(r.dateISO).toLocaleDateString('it-IT') : '-'}</td><td>{r.dealer}</td><td>{r.cliente}</td><td>{r.prodotto}</td><td>{r.tabella || '-'}</td><td className="right">{euro(r.importoFinanziato)}</td><td className="right">{euro(r.provvigione)}</td><td className="right">{euro(r.polizza)}</td><td>{r.subagente}</td></tr>)}</tbody></table></div></div>}

    {tab==='data' && <div className="stack"><div className="card"><div className="card-title">Impostazioni forecast</div><div className="grid three"><div><div className="muted small">Anno</div><div className="readonly">{currentYear}</div></div><div><div className="muted small">Target annuale</div><input className="input" value={settings.annualTargetByYear?.[currentYear] || ''} onChange={(e)=>setSettings((prev)=>({...prev, annualTargetByYear: {...prev.annualTargetByYear, [currentYear]: Number(e.target.value || 0)}}))} /></div><div><div className="muted small">Somma stagionalità</div><div className="readonly">{pct((settings.stagionalitaByYear?.[currentYear] || []).reduce((s,v)=>s+Number(v||0),0))}</div></div></div><div className="grid six mt">{MONTHS_IT.map((month,idx)=><div key={month}><div className="muted xs">{month}</div><input className="input" value={settings.stagionalitaByYear?.[currentYear]?.[idx] ?? ''} onChange={(e)=>{ const copy=[...(settings.stagionalitaByYear?.[currentYear] || Array(12).fill(0))]; copy[idx]=Number(e.target.value || 0); setSettings((prev)=>({...prev, stagionalitaByYear: {...prev.stagionalitaByYear, [currentYear]: copy}})); }} /></div>)}</div></div>
      <div className="card"><div className="card-title">Note operative</div><div className="notes"><div>• legge il foglio DATABASE del tuo Excel</div><div>• unifica più anni nello stesso archivio</div><div>• evita i duplicati con una chiave pratica base</div><div>• salva tutto nel browser locale</div><div>• consente backup e ripristino tramite JSON</div><div>• somma automaticamente le provvigioni dalla colonna PROVV del DATABASE</div></div></div>
    </div>}
  </div></div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
