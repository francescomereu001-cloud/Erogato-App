# Mobile QA checklist

Target widths: iPhone 15/16 style viewports at 390px, 393px, 402px, 414px and 430px.

## Browsers
- Safari iOS: open the app, verify there is no unwanted horizontal page scroll outside complex tables.
- Chrome mobile: repeat the same navigation and data checks.

## Navigation
- Open **Altro** from the bottom navigation.
- Verify the full-width bottom sheet appears above the bottom nav, with backdrop and visible close button.
- Tap outside the sheet and verify it closes.
- Reopen **Altro**, choose Forecast & Target, Portafoglio, Filiali, Prodotti, Alert, Dealer Intelligence and Dati / Impostazioni; the sheet must close after each tab change.

## Forecast & Target persistence
- In **Dati / Impostazioni**, edit the annual target and one seasonality month.
- Refresh the page: local settings should appear immediately.
- Open the app on another device/browser after Supabase `app_settings` is available: the newest target/seasonality should be loaded remotely.
- Confirm an empty first render never resets valid target/seasonality values.

## Feature availability on mobile
- Forecast & Target: KPI cards, quarterly/monthly tables and settings are reachable and readable.
- Portafoglio: month selector and latest practices table work; table may scroll horizontally.
- Filiali: filters, KPI cards and branch tables are readable; complex tables may scroll horizontally.
- Prodotti: product and policy panels are visible and readable.
- Alert: alert cards and suggestions wrap without clipping.
- Dealer Intelligence: filters, KPI and dealer detail interactions work.
- Import files: import accepts the updated workbook columns and the simulation/real import flows remain reachable on mobile.
