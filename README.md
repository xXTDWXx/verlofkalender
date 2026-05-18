# Verlofkalender

Een eenvoudige webapp om verlofuren en overuren per werkorganisatie te plannen en bij te houden.

## Functies

- Kalenderweergave voor verlof en overuren
- Organisaties toevoegen met eigen beginsaldo verlofuren en overuren
- Verlofuren worden afgetrokken van de juiste organisatie
- Overuren worden opgeteld bij het saldo van de juiste organisatie
- Lijstweergave met filters voor alle registraties
- Altijd zichtbaar totaalsaldo
- Responsive layout voor desktop, tablet en mobiel
- Lokale opslag in de browser via `localStorage`

## Lokaal draaien

Open `index.html` direct in je browser, of start de PowerShell-server:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\server.ps1 -Port 5173
```

Daarna open je:

```text
http://localhost:5173/
```
