import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDealerTrends, classifyDelta, isItalianWorkingDay, median, workingDates, type AnalysisContext, type TrendRow } from './dealerTrend.ts';

const row=(id:string,dealerId:string,date:string,amount:number):TrendRow=>({id,dealerId,dealerLabel:`Dealer ${dealerId}`,liquidationDate:date,importoFinanziato:amount});
const coverage=(from:string,to:string,status:'confirmed'|'inferred'='confirmed')=>[{from,to,status,source:'fixture'}];
const context=(month:string,asOf:string,from='2025-01-01',status:'confirmed'|'inferred'='confirmed'):AnalysisContext=>({month,dataAsOf:asOf,monthState:'open',coverage:coverage(from,asOf,status)});

test('mediana pari e soglie senza buchi',()=>{
  assert.equal(median([4,1,2,3]),2.5); assert.equal(median([]),null);
  assert.equal(classifyDelta(-.30),'strong-decline'); assert.equal(classifyDelta(-.15),'slowdown');
  assert.equal(classifyDelta(.149999),'in-line'); assert.equal(classifyDelta(.15),'growth'); assert.equal(classifyDelta(.30),'strong-growth');
});

test('calendario civile italiano: weekend, Pasquetta e zero giorni',()=>{
  assert.equal(isItalianWorkingDay('2026-04-06'),false); // Pasquetta
  assert.equal(isItalianWorkingDay('2026-04-07'),true);
  assert.equal(workingDates('2026-02').length,20);
});

test('confronta il decimo giorno con il decimo, non col consuntivo',()=>{
  const refs=['2026-02','2026-03','2026-04','2026-05','2026-06','2026-07']; const rows:TrendRow[]=[];
  for(const [i,m] of refs.entries()) { const wd=workingDates(m); rows.push(row(`a${i}`,'A',wd[9],50_000),row(`b${i}`,'A',wd[wd.length-1],50_000)); }
  rows.push(row('now','A',workingDates('2026-08')[9],50_000));
  const result=buildDealerTrends(rows,context('2026-08',workingDates('2026-08')[9]))[0];
  assert.equal(result.comparableAmount,50_000); assert.equal(result.benchmark,50_000); assert.equal(result.deltaPct,0);
});

test('cutoff è copertura portafoglio anche se dealer fermo e non inventa giorni',()=>{
  const rows=[row('old','A','2026-08-04',100)];
  const at15=buildDealerTrends(rows,context('2026-08','2026-08-15'))[0];
  assert.equal(at15.asOf,'2026-08-15'); assert.equal(at15.actualWorkingDays,10);
  const at9=buildDealerTrends(rows,context('2026-08','2026-08-09'))[0];
  assert.equal(at9.actualWorkingDays,5); assert.equal(at9.asOf,'2026-08-09');
});

test('mese coperto senza righe è zero; mese non coperto è escluso',()=>{
  const rows=[row('history','A','2026-01-08',12_000),row('other','B','2026-07-02',1)];
  const result=buildDealerTrends(rows,context('2026-08','2026-08-10','2026-01-01'))[0];
  assert.equal(result.actualAmount,0); assert.ok(result.benchmarkMonths.includes('2026-07'));
  const missing=buildDealerTrends(rows,context('2026-08','2026-08-10','2026-07-01'))[0];
  assert.equal(missing.benchmarkMonths.length,1); assert.equal(missing.benchmark,1);
});

test('preserva importi non lavorativi e non anticipa righe future',()=>{
  const rows=[row('sat','A','2026-08-08',500),row('future','A','2026-08-20',900)];
  const result=buildDealerTrends(rows,context('2026-08','2026-08-10'))[0];
  assert.equal(result.actualAmount,500);
});

test('calo piccolo resta osservato ma non urgente; stesso snapshot non crea persistenza',()=>{
  const rows:TrendRow[]=[]; for(let i=1;i<=6;i++){const m=`2026-0${i}`;const dates=workingDates(m);rows.push(row(`h${i}`,'A',dates[0],5_000),row(`h${i}b`,'A',dates[1],0),row(`h${i}c`,'A',dates[2],0));}
  rows.push(row('now','A','2026-07-01',2_500));
  const result=buildDealerTrends(rows,context('2026-07','2026-07-10'))[0];
  assert.equal(result.state,'strong-decline'); assert.equal(result.deficitEuro,2_500); assert.equal(result.priority,'monitor');
});

test('benchmark zero mantiene percentuale nulla e dealer storico resta nell’universo',()=>{
  const rows=[row('a','A','2026-01-02',0),row('b','B','2025-12-02',100)];
  const results=buildDealerTrends(rows,context('2026-02','2026-02-10','2025-08-01'));
  assert.deepEqual(new Set(results.map(x=>x.dealerId)),new Set(['A','B']));
  assert.equal(results.find(x=>x.dealerId==='A')!.deltaPct,null);
});

test('copertura inferita non genera alta priorità e chiave alert è unica',()=>{
  const rows:TrendRow[]=[]; for(let i=1;i<=6;i++){const m=`2026-0${i}`;const ds=workingDates(m);for(let p=0;p<3;p++)rows.push(row(`${m}-${p}`,'A',ds[p],10_000));}
  const result=buildDealerTrends(rows,context('2026-07','2026-07-10','2026-01-01','inferred'));
  assert.equal(result.length,1); assert.equal(result[0].priority,'monitor'); assert.match(result[0].cautions.join(' '),/inferita/);
});
