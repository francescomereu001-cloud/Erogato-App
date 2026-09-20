# Contratto del contesto analitico

## Verifica dell'HEAD iniziale

La revisione è partita da `d2ac515`, che contiene il motore alert della PR #34. Non erano presenti commit successivi né un remote configurato nel checkout. Prima dell'intervento la catena era:

`Filtri rapidi -> yearFilter/dealerFilter/subagenteFilter/productFilter/search -> filteredRows`

mentre Andamento seguiva una catena parallela:

`Filtri Andamento -> trendYear/trendBranch/trendDealer/trendMacroProduct -> funzioni trend`

Inoltre confronti anno su anno, confronto del mese e fallback prodotti leggevano `activeRows` o aggregati esterni, il forecast ricavava il cutoff dalle righe filtrate, e reset non chiudeva dettaglio dealer né mese Portafoglio. Questi difetti sono stati riconfermati sull'HEAD.

## Contratto introdotto

1. **Perimetro**: `dealerScope` continua a stabilire l'universo gestito per gli alert. La presenza occasionale di una pratica non viene dichiarata anagrafica certificata.
2. **Contesto globale**: `AnalysisFilters` contiene periodo, identità dealer stabile, filiale, prodotto, macroprodotto, ricerca, fonte e raggruppamento. `selectCurrentRows` applica periodo e dimensioni; `selectHistoricalRows` mantiene le stesse dimensioni e apre soltanto il tempo per benchmark.
3. **Presentazione**: ordinamento Dealer, dettaglio aperto, mese Portafoglio e selezioni di riga restano locali e vengono puliti dal reset quando incompatibili.

Il raggruppamento giorno/settimana/mese non filtra righe. La copertura è calcolata sull'intera fonte attiva dell'anno e non sul dealer selezionato. Gli aggregati esterni non sostituiscono una selezione dettagliata vuota. In simulazione gli anni e le opzioni provengono dalle sole righe simulate.

## Matrice delle viste

| Vista | Periodo e dimensioni | Storico/confronto | Nota dichiarata |
| --- | --- | --- | --- |
| Executive | selezione corrente | stesse dimensioni, tempo aperto | classifica per erogato, indipendente dall'ordinamento Dealer |
| Andamento | stessi filtri globali | anno precedente omogeneo | mese/YTD aggiornano il periodo globale |
| Focus | selezione corrente | confronto omogeneo | approfondimento scelto entro la selezione |
| Dealer / Alert | identità stabile e perimetro gestito | storico del medesimo perimetro | ricerca cliente sospende il giudizio dealer |
| Prodotti / Filiali | selezione corrente | n/a | filtri locali dichiarati nei pannelli |
| Forecast & Target | produzione filtrata, copertura fonte | orizzonte annuale esplicito | target generale escluso per dealer/ricerca |
| Portafoglio | selezione corrente | n/a | quote sul denominatore filtrato; conteggio mostrato/totale |

## Limiti dati

Il database non espone ancora metadati autorevoli di acquisizione né una vera anagrafica assegnazioni separata dalle pratiche. La data di copertura è quindi marcata **inferita** dall'archivio della fonte attiva; se assente è `n/d`. Il perimetro dealer rimane prudenziale e non viene definito “certificato”. Target specifici per dealer non sono disponibili: il confronto è `n/d`, senza ripartizioni inventate.
