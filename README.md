# Verlofkalender

Een eenvoudige webapp om verlofuren en overuren per werkorganisatie te plannen en bij te houden.

## Functies

- Kalenderweergave voor verlof en overuren
- Organisaties toevoegen met eigen beginsaldo verlofuren en overuren
- Verlofuren worden afgetrokken van de juiste organisatie
- Overuren worden opgeteld bij het saldo van de juiste organisatie
- Lijstweergave met filters voor alle registraties
- Altijd zichtbaar totaalsaldo
- Apart VOV-saldo van 120 uur per account, gedeeld over alle organisaties
- VOV geldig van 21 september 2026 tot en met 30 juni 2027 (inclusief beide dagen), zonder reset bij de jaarwisseling
- VOV inplannen, filteren en verwijderen; verwijderen geeft de uren terug aan het VOV-saldo
- VOV telt niet mee in het gewone saldo verlof + overuren; na de einddatum wordt het VOV-saldo als verlopen getoond
- Responsive layout voor desktop, tablet en mobiel
- Online opslag en aanmelden via Supabase, met gegevens afgeschermd per account

## Gebruiken

Host de map als statische website, bijvoorbeeld via GitHub Pages, en meld je aan met je bestaande account.

De VOV-databasewijziging staat in `db/vov.sql` en is toegepast op de gekoppelde Supabase-database. De database controleert zowel de datums als de limiet van 120 uur, ook bij registraties vanuit meerdere toestellen. Bestaande verlof- en overurenregistraties blijven ongewijzigd.

## ZV in 2027

- Apart saldo van 105 dagen per account, gedeeld over alle organisaties.
- Alleen geldig van 1 januari tot en met 31 december 2027, nu al inplanbaar.
- Gebruik **Plan ZV in 2027** om meteen naar de kalender en ZV-invoer te gaan.
- Invoer in dagen (ook gedeeltelijk), maximaal 1 dag per kalenderdatum.
- Ingeplande dagen gaan van het saldo af; verwijderen geeft ze terug.
- ZV telt niet mee in de gewone verlofuren, overuren of VOV.
- Databasewijziging: `db/zv.sql`, toegepast op de gekoppelde Supabase-database. De database bewaakt de periode, de daglimiet en het totaalsaldo, ook over meerdere organisaties/toestellen.
- Controle van teller en formulier: `node check-zv.cjs`.
