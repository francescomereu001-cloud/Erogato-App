import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManagedDealerScope, type DealerScopeRow } from './dealerScope.ts';
import { buildDealerTrends, workingDates, type AnalysisContext, type TrendRow } from './dealerTrend.ts';

type Fixture = DealerScopeRow & { id: string; date: string; amount: number };
const assignment = (id:string, year:number, label:string, code:string, agent='AG-1', date=`${year}-01-10`, amount=10_000):Fixture => ({
  id, year, dealerLabel:label, puntoVendita:code, agenteCode:agent, date, amount,
});
const context = (month:string):AnalysisContext => ({month,dataAsOf:`${month}-15`,monthState:'open',coverage:[{from:'2025-01-01',to:`${month}-15`,source:'fixture',status:'confirmed'}]});

function evaluate(fixtures:Fixture[], year:number, month:string) {
  const scope=buildManagedDealerScope(fixtures,year);
  const rows=fixtures.map((item):TrendRow|null=>{
    const dealerId=scope.dealerIdForRow(item);
    return dealerId ? {id:item.id,dealerId,dealerLabel:item.dealerLabel,liquidationDate:item.date,importoFinanziato:item.amount}:null;
  }).filter((row):row is TrendRow=>Boolean(row));
  return {scope,result:buildDealerTrends(rows,context(month),undefined,scope.dealers.map(({id,label})=>({id,label})))};
}

test('A/D: dealer solo storico e fuori gestione non entra, indipendentemente dal volume',()=>{
  const {result}=evaluate([assignment('a',2025,'Storico','A','OLD','2025-07-03',900_000)],2026,'2026-07');
  assert.deepEqual(result,[]);
});

test('B: dealer gestito resta valutabile con zero nel periodo',()=>{
  const fixtures=[assignment('b0',2025,'Gestito','B','AG-1','2025-12-05',30_000),assignment('b1',2026,'Gestito','B','AG-1','2026-01-05',25_000)];
  const {result}=evaluate(fixtures,2026,'2026-07');
  assert.equal(result.length,1); assert.equal(result[0].dealerId,'PV:B'); assert.equal(result[0].actualAmount,0);
});

test('C/F: gennaio usa dicembre precedente senza importare altri dealer storici',()=>{
  const fixtures=[
    assignment('c0',2025,'Gestito C','C','AG-1','2025-12-10',40_000),
    assignment('c1',2026,'Gestito C','C','AG-1','2026-01-03',5_000),
    assignment('x',2025,'Non gestito','X','OLD','2025-12-10',800_000),
  ];
  const {result}=evaluate(fixtures,2026,'2026-01');
  assert.deepEqual(result.map(item=>item.dealerId),['PV:C']);
  assert.equal(result[0].previousMonth?.amount,40_000);
});

test('E: codice mancante è ricondotto all’unica identità codificata nello stesso perimetro',()=>{
  const coded=assignment('e1',2026,'Dealer Uno','D1');
  const legacy:Fixture={...assignment('e2',2026,' dealer   uno ','','AG-1','2026-02-02'),puntoVendita:'',dealerCode:''};
  const {scope,result}=evaluate([coded,legacy],2026,'2026-07');
  assert.equal(scope.dealers.length,1); assert.equal(scope.dealerIdForRow(legacy),'PV:D1'); assert.equal(result.length,1);
});

test('omonimi in perimetri differenti non vengono fusi e record senza assegnazione non abilita gestione',()=>{
  const rows=[assignment('a',2026,'Omonimo','A','AG-1'),assignment('b',2026,'Omonimo','B','AG-2'),{...assignment('z',2026,'Ignoto','Z',''),agenteCode:'',subagente:'N/D'}];
  const scope=buildManagedDealerScope(rows,2026);
  assert.deepEqual(scope.dealers.map(d=>d.id),['PV:A','PV:B']); assert.equal(scope.excludedUnassigned,1);
});
