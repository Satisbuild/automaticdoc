# GrejsOpsparing

Et personligt opsparingsprogram i ren HTML, CSS og JavaScript. Det holder styr på saldo, renter og opsparingsmål, og alle data gemmes lokalt i browseren (LocalStorage). Der er ingen server, ingen database og intet login.

## Funktioner

- **Oversigt:** nuværende saldo, indbetalt, hævet, optjente renter, hvad der mangler til målet og hvornår målet forventes nået.
- **Tilføj og fjern penge:** med beløb, beskrivelse og dato. Dagens dato er valgt på forhånd. Man kan ikke hæve mere, end der står på kontoen, heller ikke tilbagedateret.
- **Renter:** årlig rente, månedlig eller årlig tilskrivning, valgfri startdato og renteændringer fra en bestemt dato. Optjente (tilskrevne), påløbne og forventede renter vises hver for sig.
- **Mål og plan:** opsparingsmål med fremskridtsbar, ønsket slutdato, nødvendig månedlig opsparing og forventet måldato. Den faste månedlige opsparing er kun en prognose og ændrer aldrig saldoen.
- **Transaktioner:** historik med saldo efter hver bevægelse. Den kan filtreres på type, dato og tekst, og transaktioner kan rettes og slettes. Alt regnes igen bagefter.
- **Grafer** (Chart.js): saldoens udvikling, indbetalinger, hævninger og renter pr. måned, saldoens sammensætning og en prognose. Perioden kan sættes til 1 md., 6 mdr., 1 år eller alle data.
- **Backup og gendannelse:** eksport og import af JSON-fil (filen kontrolleres, og man bekræfter, før noget overskrives), CSV-eksport til Excel og deling af filen på mobil.
- **Indstillinger:** valuta, lyst og mørkt tema, rente, mål, månedlig opsparing og nulstilling (man skal skrive NULSTIL for at bekræfte).
- **Offline:** sitets fælles service worker (`/sw.js`) gemmer appen og Chart.js, så den virker uden internet, når den først er indlæst.

## Sådan regnes renten

- Renten beregnes hver dag af saldoen ved dagens slutning: saldo × årlig rente ÷ 365.
- Den samles op som påløbne renter og tilskrives på sidste dag i måneden (eller den 31. december ved årlig tilskrivning). Først derefter giver den selv rente.
- Tilskrevne renter afrundes til hele øre og vises som automatiske rækker i historikken.
- Alle beløb regnes i øre (heltal), så der ikke opstår afrundingsfejl.
- Historik og prognose bruger samme beregning (`simulate` i `js/calculations.js`).

## Filer

| Fil | Indhold |
| --- | --- |
| `index.html` | Sidens skelet, menu og dialoger |
| `css/style.css` | Design, lyst og mørkt tema, mobil-layout |
| `js/calculations.js` | Alle beregninger (rente, prognose, mål). Ingen DOM. |
| `js/storage.js` | LocalStorage, validering, backup og CSV |
| `js/charts.js` | Graferne med Chart.js |
| `js/script.js` | Sider, formularer og knapper |
| `tests/tests.html` | Test af beregningerne. Åbn den i en browser. |

## Dataformat (backupfil)

```json
{
  "app": "GrejsOpsparing",
  "format": 1,
  "exportedAt": "2026-11-20T12:00:00.000Z",
  "data": {
    "version": 1,
    "settings": { "currency": "DKK", "theme": "system", "lastExport": null },
    "interest": { "rates": [{ "from": null, "rate": 2 }], "compounding": "monthly", "startDate": null },
    "goal": { "name": "Ny bil", "amount": 10000000, "targetDate": "2029-05-20" },
    "plan": { "monthlyAmount": 200000, "dayOfMonth": 1 },
    "transactions": [
      { "id": "…", "type": "deposit", "amount": 2500000, "date": "2026-01-05", "description": "Løn", "createdAt": "…" }
    ]
  }
}
```

Beløb er i øre: `2500000` = 25.000,00 kr.
