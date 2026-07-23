import { diffPct, euro, euro0, num } from './formatters';

export type DealerReportRow = {
  dateISO: string | null;
  importoFinanziato: number;
  importoNettoErogato: number;
  prodottoLabel: string;
  prodottoCode: string;
  numeroRate: number;
  provvigione: number;
  situazione: string;
};

export type DealerReportMonthly = {
  month: string;
  erogato: number;
  pratiche: number;
  ticketMedio: number;
  rateMedie: number | null;
  provvigioni: number;
  date: Date;
};

export type DealerReportData = {
  dealerName: string;
  generatedAt: Date;
  updatedAt: Date;
  currentYearValue: number;
  prevYearValue: number;
  ytdMonthLimit: number;
  statoDealer: string;
  continuityLabel: string;
  suggestedAction: string;
  dealerType: string;
  dealerRows: DealerReportRow[];
  last12Rows: DealerReportRow[];
  ytdCurrentRows: DealerReportRow[];
  ytdPrevRows: DealerReportRow[];
  prevYearRows: DealerReportRow[];
  currentMonthRows: DealerReportRow[];
  previousMonthRows: DealerReportRow[];
  last12Monthly: DealerReportMonthly[];
  insights: { key: string; label: string; positive: boolean }[];
  sum: (rows: any[]) => number;
  count: (rows: any[]) => number;
  ticket: (rows: any[]) => number;
  avgRates: (rows: any[]) => number | null;
  rateCoverage: (rows: any[]) => number | null;
};

const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtPct(value: number | null) {
  return value === null ? 'n/d' : `${num(value * 100, 1)}%`;
}

function fmtRates(value: number | null) {
  return value === null ? 'n/d' : num(value, 1);
}

function variationClass(current: number, previous: number) {
  return current - previous >= 0 ? 'pos' : 'neg';
}

function comparisonRow(label: string, current: number | null, previous: number | null, formatter: (value: number) => string) {
  const hasValues = current !== null && previous !== null;
  const abs = hasValues ? current - previous : null;
  const pct = hasValues ? diffPct(current, previous) : null;
  const klass = hasValues ? variationClass(current, previous) : '';
  return `<tr><td>${escapeHtml(label)}</td><td class="right">${current === null ? 'n/d' : formatter(current)}</td><td class="right">${previous === null ? 'n/d' : formatter(previous)}</td><td class="right ${klass}">${abs === null ? 'n/d' : formatter(abs)}</td><td class="right ${klass}">${fmtPct(pct)}</td></tr>`;
}

export function buildDealerReportHtml(data: DealerReportData) {
  const ytdErogatoCurrent = data.sum(data.ytdCurrentRows);
  const ytdErogatoPrev = data.sum(data.ytdPrevRows);
  const ytdPraticheCurrent = data.count(data.ytdCurrentRows);
  const ytdPratichePrev = data.count(data.ytdPrevRows);
  const ytdTicketCurrent = data.ticket(data.ytdCurrentRows);
  const ytdTicketPrev = data.ticket(data.ytdPrevRows);
  const ytdRatesCurrent = data.avgRates(data.ytdCurrentRows);
  const ytdRatesPrev = data.avgRates(data.ytdPrevRows);
  const prevYearErogato = data.sum(data.prevYearRows);
  const ytdPolizzeCurrent = data.ytdCurrentRows.filter((r) => r.prodottoLabel.toLowerCase().includes('polizza') || r.prodottoCode.toLowerCase().includes('pol')).length;
  const ytdPolizzePrev = data.ytdPrevRows.filter((r) => r.prodottoLabel.toLowerCase().includes('polizza') || r.prodottoCode.toLowerCase().includes('pol')).length;
  const maxMonthly = Math.max(...data.last12Monthly.map((m) => m.erogato), 1);
  const bestMonth = data.last12Monthly.reduce((best, m) => m.erogato > best.erogato ? m : best, data.last12Monthly[0]);
  const generated = data.generatedAt.toLocaleDateString('it-IT');
  const footer = `Generato il ${generated} · Dealer Erogato App — uso interno`;
  const coverage = data.rateCoverage(data.ytdCurrentRows);

  const monthlyRows = data.last12Monthly.map((m) => `<tr><td>${escapeHtml(m.month)}</td><td class="right">${euro(m.erogato)}</td><td class="right">${num(m.pratiche)}</td><td class="right">${euro(m.ticketMedio)}</td><td class="right">${fmtRates(m.rateMedie)}</td><td class="right">${euro(m.provvigioni)}</td></tr>`).join('');
  const lastRows = [...data.dealerRows].sort((a, b) => new Date(b.dateISO || 0).getTime() - new Date(a.dateISO || 0).getTime()).slice(0, 12).map((r) => `<tr><td>${r.dateISO ? new Date(r.dateISO).toLocaleDateString('it-IT') : 'n/d'}</td><td class="right">${euro(r.importoFinanziato || r.importoNettoErogato)}</td><td>${escapeHtml(r.prodottoLabel || r.prodottoCode || 'n/d')}</td><td class="right">${r.numeroRate > 0 ? num(r.numeroRate) : 'n/d'}</td><td class="right">${euro(r.provvigione)}</td><td>${escapeHtml(r.situazione || 'n/d')}</td></tr>`).join('');
  const bars = data.last12Monthly.map((m) => `<div class="bar-item"><div class="bar-label">${escapeHtml(m.month)}</div><div class="bar-track"><div class="bar" style="width:${Math.max(2, (m.erogato / maxMonthly) * 100)}%"></div></div><div class="bar-value">${euro0(m.erogato)}</div></div>`).join('');
  const insightList = data.insights.map((i) => `<li class="${i.positive ? 'pos' : 'neg'}">${escapeHtml(i.label)}</li>`).join('');

  return `<!doctype html><html lang="it"><head><meta charset="utf-8" /><title>Report commerciale dealer - ${escapeHtml(data.dealerName)}</title><style>
  @page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:#0f172a;background:#fff;margin:0;font-size:11px}.page{min-height:269mm;page-break-after:always;position:relative;padding-bottom:12mm}.page:last-child{page-break-after:auto}.hero{background:linear-gradient(135deg,#0b2f6b,#2458e6);color:#fff;border-radius:18px;padding:18px 20px;margin-bottom:14px}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:10px;opacity:.8}.title{font-size:26px;font-weight:800;margin:4px 0}.dealer{font-size:18px;font-weight:700}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}.chip{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:12px;padding:8px}.chip b{display:block;font-size:9px;text-transform:uppercase;opacity:.78;margin-bottom:3px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.card{border:1px solid #dbe5f4;border-radius:14px;padding:10px;background:#f8fbff}.label{color:#64748b;text-transform:uppercase;font-weight:700;font-size:9px}.value{font-size:17px;font-weight:800;margin-top:4px;color:#0b2f6b}.sub{color:#64748b;font-size:10px;margin-top:2px}h2{font-size:14px;margin:14px 0 8px;color:#0b2f6b}table{width:100%;border-collapse:collapse;page-break-inside:auto}tr{page-break-inside:avoid}th{background:#eef5ff;color:#1e3a8a;text-align:left;text-transform:uppercase;font-size:9px;letter-spacing:.04em}th,td{border-bottom:1px solid #e2e8f0;padding:6px}.right{text-align:right}.pos{color:#15803d}.neg{color:#b91c1c}.focus{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.bar-item{display:grid;grid-template-columns:54px 1fr 70px;gap:7px;align-items:center;margin:5px 0}.bar-track{height:10px;background:#eaf1fb;border-radius:999px;overflow:hidden}.bar{height:100%;background:#2458e6;border-radius:999px}.bar-value{text-align:right;font-weight:700}.note{border-left:4px solid #2458e6;background:#f8fbff;padding:9px;border-radius:10px;color:#334155}.footer{position:absolute;bottom:0;left:0;right:0;color:#64748b;border-top:1px solid #e2e8f0;padding-top:5px;font-size:9px}.two{display:grid;grid-template-columns:1.2fr .8fr;gap:12px}ul{margin:6px 0 0 18px;padding:0}li{margin:3px 0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{break-after:page}.page:last-child{break-after:auto}}
  </style></head><body>
  <section class="page"><div class="hero"><div class="eyebrow">Report commerciale dealer</div><div class="title">Sintesi commerciale</div><div class="dealer">${escapeHtml(data.dealerName)}</div><div class="meta"><div class="chip"><b>Dati aggiornati</b>${data.updatedAt.toLocaleDateString('it-IT')}</div><div class="chip"><b>Periodo YTD</b>Gen-${MONTHS_IT[data.ytdMonthLimit - 1]} ${data.currentYearValue}</div><div class="chip"><b>Stato</b>${escapeHtml(data.statoDealer)}</div><div class="chip"><b>Continuità</b>${escapeHtml(data.continuityLabel)}</div><div class="chip"><b>Azione</b>${escapeHtml(data.suggestedAction)}</div><div class="chip"><b>Tipo dealer</b>${escapeHtml(data.dealerType)}</div></div></div>
  <div class="grid"><div class="card"><div class="label">Erogato YTD</div><div class="value">${euro0(ytdErogatoCurrent)}</div></div><div class="card"><div class="label">Erogato anno precedente</div><div class="value">${euro0(prevYearErogato)}</div></div><div class="card"><div class="label">Pratiche YTD</div><div class="value">${num(ytdPraticheCurrent)}</div></div><div class="card"><div class="label">Ticket medio YTD</div><div class="value">${euro0(ytdTicketCurrent)}</div></div><div class="card"><div class="label">Rate medie YTD</div><div class="value">${fmtRates(ytdRatesCurrent)}</div><div class="sub">${coverage === null ? 'Numero rate non disponibile' : `Disponibile sul ${fmtPct(coverage)} delle pratiche YTD`}</div></div><div class="card"><div class="label">Polizze YTD</div><div class="value">${num(ytdPolizzeCurrent)}</div></div></div>
  <h2>Confronto YTD anno corrente vs stesso periodo anno precedente</h2><table><thead><tr><th>KPI</th><th class="right">${data.currentYearValue}</th><th class="right">${data.prevYearValue}</th><th class="right">Var. assoluta</th><th class="right">Var. %</th></tr></thead><tbody>${comparisonRow('Erogato', ytdErogatoCurrent, ytdErogatoPrev, euro0)}${comparisonRow('Pratiche', ytdPraticheCurrent, ytdPratichePrev, (v) => num(v))}${comparisonRow('Ticket medio', ytdTicketCurrent, ytdTicketPrev, euro0)}${comparisonRow('Rate medie', ytdRatesCurrent, ytdRatesPrev, (v) => num(v, 1))}${comparisonRow('Polizze', ytdPolizzeCurrent, ytdPolizzePrev, (v) => num(v))}</tbody></table>
  <h2>Focus mensile</h2><div class="focus"><div class="card"><div class="label">Erogato corr./prec.</div><div class="value">${euro0(data.sum(data.currentMonthRows))}</div><div class="sub">Prec. ${euro0(data.sum(data.previousMonthRows))}</div></div><div class="card"><div class="label">Pratiche corr./prec.</div><div class="value">${num(data.count(data.currentMonthRows))}</div><div class="sub">Prec. ${num(data.count(data.previousMonthRows))}</div></div><div class="card"><div class="label">Ticket corr./prec.</div><div class="value">${euro0(data.ticket(data.currentMonthRows))}</div><div class="sub">Prec. ${euro0(data.ticket(data.previousMonthRows))}</div></div><div class="card"><div class="label">Rate medie corr./prec.</div><div class="value">${fmtRates(data.avgRates(data.currentMonthRows))}</div><div class="sub">Prec. ${fmtRates(data.avgRates(data.previousMonthRows))}</div></div></div>
  <h2>Andamento erogato anno precedente</h2>${bars}<h2>Insight commerciali automatici</h2><ul>${insightList}</ul><div class="footer">${escapeHtml(footer)}</div></section>
  <section class="page"><h2>Dettaglio operativo ultimi 12 mesi</h2><table><thead><tr><th>Mese</th><th class="right">Erogato</th><th class="right">Pratiche</th><th class="right">Ticket medio</th><th class="right">Rate medie</th><th class="right">Provvigioni</th></tr></thead><tbody>${monthlyRows}</tbody></table><div class="two"><div><h2>Ultime pratiche liquidate</h2><table><thead><tr><th>Data</th><th class="right">Importo</th><th>Prodotto</th><th class="right">Rate</th><th class="right">Provvigione</th><th>Situazione</th></tr></thead><tbody>${lastRows}</tbody></table></div><div><h2>Sintesi operativa</h2><div class="note"><b>Mese migliore:</b> ${bestMonth ? `${escapeHtml(bestMonth.month)} (${euro0(bestMonth.erogato)})` : 'n/d'}<br/><b>Continuità:</b> ${escapeHtml(data.continuityLabel)}<br/><b>Azione suggerita:</b> ${escapeHtml(data.suggestedAction)}</div><h2>Nota metodologica</h2><div class="note">Le rate medie sono calcolate come media aritmetica del numero di rate delle pratiche liquidate con valore maggiore di zero. I valori mancanti o pari a zero sono esclusi.</div></div></div><div class="footer">${escapeHtml(footer)}</div></section><script>window.onload=()=>{setTimeout(()=>window.print(),250);};</script></body></html>`;
}
