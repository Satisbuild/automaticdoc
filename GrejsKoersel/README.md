# GrejsKørsel

Holder styr på, hvilke dage man har kørt med Grejs, og hvor meget man har sparet i forhold til
brændstoffet i sin egen bil. Appen ligger på <https://automatikhelp.com/GrejsKoersel/> og kan også
åbnes direkte ved at dobbeltklikke på `index.html`.

Den bruger kun HTML, CSS og JavaScript uden biblioteker. Alle data gemmes i browserens LocalStorage
under nøglen `grejsKoerselData`.

## Filer

| Fil | Indhold |
|---|---|
| `js/calculations.js` | Faste værdier, beregninger og talformat |
| `js/storage.js` | LocalStorage og kontrol af backupfiler |
| `js/calendar.js` | Datoer, kalender, månedsoversigt og dagsvisning |
| `js/app.js` | Navigation, indstillinger, historik, backup og opstart |
| `css/style.css` | Design, lyst og mørkt tema og tilpasning til mobil |

## Regler for beregningen

- En tur er altid 50 km, og en Grejs-tur koster altid 15 kr. Værdierne står som konstanter i
  `js/calculations.js` og kan ikke ændres i appen eller med en backupfil.
- Egen tur = (50 / 100) × forbrug i L/100 km × brændstofpris pr. liter.
- Besparelse = egen tur − 15 kr. Er beløbet negativt, vises det som en merpris.
- Hver dag gemmer de brændstofværdier, den blev registreret med. Nye indstillinger ændrer derfor
  ikke gamle dage, heller ikke hvis en gammel dag rettes fra Ja til Nej. Fjernes registreringen,
  bruger dagen de aktuelle indstillinger, næste gang den registreres.
- Dage uden registrering tæller ikke med.

## Beskadigede data

Hvis de gemte data er ugyldige, starter appen med det, der stadig kan læses. Det oprindelige indhold
gemmes først under nøglen `grejsKoerselData_beskadiget`.
