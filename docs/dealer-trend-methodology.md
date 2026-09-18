# Andamento dealer — metodologia operativa

## Cosa misura (e cosa non misura)

Il motore misura l'**EROGATO LIQUIDATO**, usando esclusivamente `importoFinanziato` delle pratiche con una data di liquidazione attendibile. Non usa il netto erogato. Lo scostamento non dimostra un calo delle vendite complessive, la perdita del cliente, un passaggio alla concorrenza o pratiche bloccate: queste sono ipotesi da verificare fuori dall'app.

La data civile è trattata come `YYYY-MM-DD` nel calendario italiano. Sabati e festivi servono ad allineare l'orizzonte, ma una liquidazione valida avvenuta in quei giorni resta nel totale. Gli importi sono inclusi solo se la data è entro il cutoff civile del k-esimo giorno lavorativo.

## Contesto, copertura e legacy

Il contesto contiene mese, cutoff `dataAsOf`, stato aperto/chiuso, intervalli e stato di copertura (`confirmed`, `inferred`, `unknown`). La copertura appartiene al dataset, non all'ultima pratica del dealer. In assenza di metadati sorgente, l'app usa la massima data valida del portafoglio come fallback **inferito** e impedisce la priorità alta. La data di caricamento resta distinta e non viene promossa a data di liquidazione; le nuove righe prive di liquidazione vengono escluse dal motore.

L'archivio corrente non dispone di snapshot di acquisizione né di una colonna di copertura certificata: la validazione è pertanto esplorativa. La conferma persistente del cutoff e la gestione transazionale dei batch richiedono una migrazione additiva futura; nessuna migrazione o modifica ai dati di produzione è inclusa. Un errore durante le richieste di import non certifica o avanza la copertura.

L'identità preferisce il codice punto vendita, altrimenti il codice convenzionato. In mancanza di codice usa una chiave prudente e non fonde automaticamente omonimi. Per i nuovi import l'occorrenza conserva pratiche distinte con gli stessi attributi; la ripetizione dello stesso file mantiene chiavi deterministiche.

## Formula e regole operative

La finestra `H` sono i sei mesi di calendario immediatamente precedenti, senza mese corrente o futuro. Un mese coperto dopo la prima osservazione del dealer senza righe vale zero; un mese non coperto o anteriore al limite osservabile è mancante.

* `kCommon = min(k corrente, giorni lavorativi dei riferimenti validi)`;
* `B = mediana(C(dealer, mese, kCommon) per mese in H)` (per campione pari: media dei due valori centrali);
* `X = C(dealer, mese analizzato, kCommon)`;
* `deltaEuro = X - B`; `deltaPct = B > 0 ? (X-B)/B : null`; `deficit = max(0, B-X)`;
* `BN` è la mediana dei conteggi e `MAD = mediana(abs(C-B))` sugli stessi riferimenti.

Soglie iniziali da calibrare: 5 giorni comuni, monitoraggio da -15%, forte calo da -30%, gap minimo €10.000, almeno 3 pratiche attese, persistenza su 3 distinti cutoff lavorativi, filtro variabilità `deficit >= 2×MAD` quando MAD è positivo. Il moltiplicatore MAD è un filtro operativo, non un test statistico o una confidenza. Con tre–cinque mesi la priorità resta monitoraggio; con meno di tre il confronto è descrittivo. Un YoY non negativo con almeno tre pratiche nel riferimento limita l'escalation.

## Replay storico riproducibile

Per verificare le regole, ordinare i mesi di origine cronologicamente e, a ciascuna origine, passare al motore soltanto copertura e liquidazioni disponibili fino a quel cutoff. Registrare per mese precedente, mediana a 3 mesi, mediana a 6 mesi e YoY: copertura, errore assoluto in euro, errore con segno e stabilità del segnale. Non usare MAPE quando il consuntivo è zero. Riservare gli ultimi mesi come verifica finale prima di scegliere o tarare una regola.

I test automatici usano solo fixture anonime. Non è stato eseguito un backtest su dati reali e, senza snapshot storici degli import, un replay delle liquidazioni finali non può ricostruire i ritardi originali. Eventuali segnali rientrati entro fine mese vanno chiamati “segnali riassorbiti”, non falsi positivi certificati.
