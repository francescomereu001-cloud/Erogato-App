/** Pure, timezone-independent engine for liquidated-volume trends.
 * Amount is always `importoFinanziato`; this is not evidence of lost sales or churn.
 */
export type CoverageStatus = 'confirmed' | 'inferred' | 'unknown';
export type CoverageInterval = { from: string; to: string; source: string; status: CoverageStatus };
export type AnalysisContext = {
  month: string; // YYYY-MM
  dataAsOf: string; // civil date in Europe/Rome, YYYY-MM-DD
  monthState: 'open' | 'closed';
  importedAt?: string;
  coverage: CoverageInterval[];
  qualityIssues?: string[];
};
export type TrendRow = {
  id: string;
  dealerId: string;
  dealerLabel: string;
  liquidationDate: string | null;
  importoFinanziato: number;
};
export type TrendSettings = {
  minWorkingDays: number; watchDrop: number; strongDrop: number;
  minAbsoluteGap: number; minExpectedPractices: number;
  persistenceDays: number; madMultiplier: number;
};
export const DEFAULT_TREND_SETTINGS: TrendSettings = {
  minWorkingDays: 5, watchDrop: .15, strongDrop: .30, minAbsoluteGap: 10_000,
  minExpectedPractices: 3, persistenceDays: 3, madMultiplier: 2,
};
export type TrendState = 'strong-decline'|'slowdown'|'in-line'|'growth'|'strong-growth'|'not-assessable';
export type TrendPriority = 'high'|'monitor'|'informational';
export type MonthObservation = { month: string; amount: number; practices: number; cutoff: string; workingDays: number };
export type DealerTrend = {
  key: string; dealerId: string; dealerLabel: string; month: string; asOf: string;
  coverageStatus: CoverageStatus; commonWorkingDays: number; actualWorkingDays: number;
  actualAmount: number; comparableAmount: number; currentPractices: number;
  benchmark: number|null; benchmarkPractices: number|null; benchmarkMonths: string[];
  excludedMonths: { month: string; reason: string }[]; mad: number|null;
  deltaEuro: number|null; deltaPct: number|null; deficitEuro: number|null;
  previousMonth: MonthObservation|null; previousYear: MonthObservation|null;
  state: TrendState; priority: TrendPriority; persistentDays: number;
  title: string; cautions: string[]; explanation: string;
};
export type DealerUniverseItem = { id: string; label: string };

const HOLIDAYS = new Set(['01-01','01-06','04-25','05-01','06-02','08-15','11-01','12-08','12-25','12-26']);
const parts = (iso: string) => iso.slice(0, 10).split('-').map(Number) as [number, number, number];
const civil = (y:number,m:number,d:number) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const daysInMonth = (y:number,m:number) => new Date(Date.UTC(y,m,0)).getUTCDate();
function easter(y:number) { // Meeus/Jones/Butcher, returned as a civil date.
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31), day=(h+l-7*m+114)%31+1;
  return {month,day};
}
export function isItalianWorkingDay(iso:string, closures: string[] = []) {
  const [y,m,d]=parts(iso); const weekday=new Date(Date.UTC(y,m-1,d)).getUTCDay();
  if (weekday===0||weekday===6||HOLIDAYS.has(iso.slice(5))||closures.includes(iso)) return false;
  const e=easter(y); const easterUtc=Date.UTC(y,e.month-1,e.day)+86400000;
  return iso!==new Date(easterUtc).toISOString().slice(0,10);
}
export function workingDates(month:string, closures:string[]=[]){
  const [y,m]=month.split('-').map(Number); const out:string[]=[];
  for(let d=1;d<=daysInMonth(y,m);d++){const iso=civil(y,m,d);if(isItalianWorkingDay(iso,closures))out.push(iso);}
  return out;
}
export function previousMonth(month:string, offset=1){const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1-offset,1));return d.toISOString().slice(0,7);}
export function median(values:number[]):number|null {if(!values.length)return null;const v=[...values].sort((a,b)=>a-b),i=Math.floor(v.length/2);return v.length%2?v[i]:(v[i-1]+v[i])/2;}
export function classifyDelta(delta:number|null,s=DEFAULT_TREND_SETTINGS):TrendState {
  if(delta===null)return 'not-assessable';
  if(delta<=-s.strongDrop)return 'strong-decline'; if(delta<=-s.watchDrop)return 'slowdown';
  if(delta<s.watchDrop)return 'in-line'; if(delta<s.strongDrop)return 'growth'; return 'strong-growth';
}
function covering(intervals:CoverageInterval[],from:string,to:string):CoverageStatus {
  const candidates=intervals.filter(x=>x.from<=from&&x.to>=to);
  if(candidates.some(x=>x.status==='confirmed'))return 'confirmed';
  if(candidates.some(x=>x.status==='inferred'))return 'inferred'; return 'unknown';
}
function cutoffForK(month:string,k:number){const dates=workingDates(month);if(k<=0)return `${month}-00`;return dates[Math.min(k,dates.length)-1]||`${month}-${String(daysInMonth(...month.split('-').map(Number) as [number,number])).padStart(2,'0')}`;}
function observe(index:Map<string,TrendRow[]>,dealer:string,month:string,k:number):MonthObservation{
  const cutoff=cutoffForK(month,k), rows=index.get(`${dealer}|${month}`)||[];
  const included=rows.filter(r=>r.liquidationDate&&r.liquidationDate.slice(0,10)<=cutoff);
  return {month,cutoff,workingDays:k,amount:included.reduce((a,r)=>a+r.importoFinanziato,0),practices:included.length};
}
export function indexTrendRows(rows:TrendRow[]){
  const map=new Map<string,TrendRow[]>();
  for(const r of rows){if(!r.liquidationDate||!/^\d{4}-\d{2}-\d{2}/.test(r.liquidationDate)||!Number.isFinite(r.importoFinanziato))continue;
    const key=`${r.dealerId}|${r.liquidationDate.slice(0,7)}`;const list=map.get(key)||[];list.push(r);map.set(key,list);}
  return map;
}
function evaluateAt(dealer:string, month:string, k:number, index:Map<string,TrendRow[]>, context:AnalysisContext, settings:TrendSettings){
  const firstObservedMonth=[...index.keys()].filter(key=>key.startsWith(`${dealer}|`)).map(key=>key.slice(key.indexOf('|')+1)).sort()[0];
  const refs=Array.from({length:6},(_,i)=>previousMonth(month,i+1));
  const eligible=refs.map(ref=>{const common=Math.min(k,workingDates(ref).length);const to=cutoffForK(ref,common);return {ref,common,status:covering(context.coverage,`${ref}-01`,to)};});
  // The first practice is only a knowledge boundary: never manufacture zeroes
  // in months before the relationship becomes observable.
  const valid=eligible.filter(x=>x.status!=='unknown'&&Boolean(firstObservedMonth)&&x.ref>=firstObservedMonth);
  const common=Math.min(k,...valid.map(x=>x.common));
  const observations=valid.map(x=>observe(index,dealer,x.ref,common));
  const current=observe(index,dealer,month,common), b=median(observations.map(x=>x.amount));
  const bn=median(observations.map(x=>x.practices)); const delta=b!==null&&b>0?(current.amount-b)/b:null;
  const mad=b===null?null:median(observations.map(x=>Math.abs(x.amount-b)));
  const deficit=b===null?null:Math.max(0,b-current.amount);
  const strong=delta!==null&&delta<=-settings.strongDrop&&deficit!==null&&deficit>=settings.minAbsoluteGap&&(mad===0||mad===null||deficit>=settings.madMultiplier*mad);
  return {eligible,valid,common,observations,current,b,bn,delta,mad,deficit,strong};
}
export function buildDealerTrends(rows:TrendRow[],context:AnalysisContext,settings:TrendSettings=DEFAULT_TREND_SETTINGS,managedDealerUniverse?:DealerUniverseItem[]):DealerTrend[]{
  const index=indexTrendRows(rows), actualDates=workingDates(context.month).filter(d=>d<=context.dataAsOf);
  const currentCoverage=covering(context.coverage,`${context.month}-01`,context.dataAsOf);
  const actualK=actualDates.length;
  const dealers=new Map<string,string>();
  if (managedDealerUniverse) managedDealerUniverse.forEach(dealer=>dealers.set(dealer.id,dealer.label));
  else rows.forEach(r=>{if(r.liquidationDate&&r.liquidationDate.slice(0,7)<=context.month)dealers.set(r.dealerId,r.dealerLabel)});
  const result: DealerTrend[] = [...dealers].map(([dealerId,dealerLabel])=>{
    const e=evaluateAt(dealerId,context.month,actualK,index,context,settings);
    const actual=observe(index,dealerId,context.month,actualK);
    let persistent=0; for(let k=e.common;k>0&&persistent<settings.persistenceDays;k--){const x=evaluateAt(dealerId,context.month,k,index,context,settings);if(!x.strong)break;persistent++;}
    const prev=previousMonth(context.month), yoy=`${Number(context.month.slice(0,4))-1}${context.month.slice(4)}`;
    const comparison=(m:string)=>{const k=Math.min(actualK,workingDates(m).length);return covering(context.coverage,`${m}-01`,cutoffForK(m,k))==='unknown'?null:observe(index,dealerId,m,k)};
    const previousMonthObs=comparison(prev), previousYearObs=comparison(yoy);
    const yoyDelta=previousYearObs&&previousYearObs.amount>0?(actual.amount-previousYearObs.amount)/previousYearObs.amount:null;
    const yoyContradicts=yoyDelta!==null&&yoyDelta>=0&&previousYearObs!.practices>=settings.minExpectedPractices;
    const cautions=[...(context.qualityIssues||[])];
    if(currentCoverage!=='confirmed')cautions.push(currentCoverage==='inferred'?'Copertura inferita: priorità limitata al monitoraggio.':'Copertura non verificata.');
    if(e.valid.length<6)cautions.push(e.valid.length<3?'Storico insufficiente per un alert automatico.':'Supporto storico limitato (3–5 mesi).');
    if((e.bn||0)<settings.minExpectedPractices)cautions.push('Attività sporadica: segnale mensile poco informativo.');
    if(yoyContradicts)cautions.push('Sotto lo storico recente, ma non sotto lo stesso mese dell’anno scorso: escalation limitata.');
    if(e.mad!==null&&e.mad>0&&e.deficit!==null&&e.deficit<settings.madMultiplier*e.mad)cautions.push('Scostamento entro il filtro operativo di variabilità (2×MAD); non prova assenza di calo.');
    const high=e.strong&&e.common>=settings.minWorkingDays&&currentCoverage==='confirmed'&&!context.qualityIssues?.length&&e.valid.length===6&&(e.bn||0)>=settings.minExpectedPractices&&persistent>=settings.persistenceDays&&!yoyContradicts;
    const state=classifyDelta(e.delta,settings), priority:TrendPriority=high?'high':state==='in-line'||state==='growth'||state==='strong-growth'?'informational':'monitor';
    const title=actual.practices===0?(high?'Inattività anomala da verificare':'Nessuna erogazione nel periodo'):state==='strong-decline'?'Forte calo':state==='slowdown'?'Rallentamento':state==='strong-growth'||state==='growth'?'Crescita':'Andamento in linea';
    const explanation=e.b===null?`Confronto non disponibile al ${context.dataAsOf}.`:`Al ${e.common}° giorno lavorativo: ${e.current.amount.toFixed(2)} € contro mediana ${e.b.toFixed(2)} €; ${e.delta===null?'percentuale non disponibile':(e.delta*100).toFixed(1)+'%'}. ${e.current.practices} pratiche contro mediana ${e.bn}.`;
    return {key:`${dealerId}|${context.month}`,dealerId,dealerLabel,month:context.month,asOf:context.dataAsOf,coverageStatus:currentCoverage,commonWorkingDays:e.common,actualWorkingDays:actualK,actualAmount:actual.amount,comparableAmount:e.current.amount,currentPractices:e.current.practices,benchmark:e.b,benchmarkPractices:e.bn,benchmarkMonths:e.valid.map(x=>x.ref),excludedMonths:e.eligible.filter(x=>x.status==='unknown').map(x=>({month:x.ref,reason:'copertura non disponibile'})),mad:e.mad,deltaEuro:e.b===null?null:e.current.amount-e.b,deltaPct:e.delta,deficitEuro:e.deficit,previousMonth:previousMonthObs,previousYear:previousYearObs,state,priority,persistentDays:persistent,title,cautions,explanation};
  });
  const rank: Record<TrendPriority, number> = { high: 0, monitor: 1, informational: 2 };
  return result.sort((a,b)=>rank[a.priority]-rank[b.priority]||(b.deficitEuro||0)-(a.deficitEuro||0)||a.dealerId.localeCompare(b.dealerId));
}
