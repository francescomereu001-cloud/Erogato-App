# Dealer Erogato App

Web app Vite/React per caricare gli export Excel della banca e costruire uno storico multianno.

## Avvio locale

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Note importanti

- data di riferimento: `DATA_LIQUIDAZIONE`
- erogato: `IMPORTO_FINANZIATO`
- dealer: `DES_CONVENZIONATO`
- filiale/subagente: `DES_SUBAGENTE`
- polizze: `importo polizza `
- provvigioni: `PROVV`; se mancano vengono ricalcolate con:
  - prodotto `31` = 0,825%
  - altri prodotti = 0,55%
