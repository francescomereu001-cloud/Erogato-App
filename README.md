# Dealer Erogato App

Web app Vite + React per importare i file Excel del foglio `DATABASE`, unificare lo storico multiennio e visualizzare dashboard, dealer, pratiche e forecast.

## Funzioni incluse
- Upload manuale di file `.xlsx/.xlsm/.xls`
- Unificazione anni diversi in un archivio locale
- Deduplica base pratiche
- KPI: erogato, ticket medio, pratiche, provvigioni, polizze
- Ranking dealer
- Scheda singolo dealer
- Forecast mese per mese
- Backup / restore JSON

## Nota importante sulle provvigioni
Le provvigioni vengono sommate automaticamente **dalla colonna `PROVV` del foglio DATABASE**.
Se vuoi ricostruire il calcolo provvigionale da zero senza quella colonna, va aggiunta la formula esatta al codice.

## Avvio locale
npm install
npm run dev

## Build
npm install
npm run build

## Pubblicazione su Vercel
1. Crea un repository su GitHub
2. Carica questi file nel repository
3. Vai su Vercel e collega il repo
4. Framework preset: `Vite`
5. Build command: `npm run build`
6. Output directory: `dist`
7. Deploy
