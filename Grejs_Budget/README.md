# Grejs Budget

Grejs Budget er en webapp til privatøkonomi. Du importerer bankudtog fra flere måneder og konti, får transaktionerne kategoriseret automatisk, lægger et budget og følger udviklingen måned for måned.

**Alle data bliver i din browser på din egen enhed.** Der er ingen server, intet login, ingen bankforbindelse, ingen sporing og ingen eksterne tjenester. Sidens sikkerhedspolitik (`Content-Security-Policy`, `connect-src 'self'`) forhindrer desuden teknisk, at siden sender data til andre servere.

## Sådan åbner du appen

| Måde | Sådan | Offline |
|---|---|---|
| Hjemmesiden | Åbn `/Grejs_Budget/` på hjemmesiden (via https) | Ja, efter første besøg. Kan installeres som app |
| Lokalt med Node.js | Dobbeltklik på `Start Grejs Budget.bat`, eller kør `node Grejs_Budget/scripts/start-lokalt.js` | Ja (localhost) |
| Direkte som fil | Åbn `index.html` i browseren | Nej, men alt andet virker |

Kom hurtigt i gang: klik **Prøv med eksempeldata** på forsiden. Eksempeldata kan fjernes igen med ét klik under *Indstillinger → Eksempeldata*.

## Funktioner

- **Import** af CSV/TXT (komma, semikolon eller tabulator; UTF-8 eller Windows-1252), Excel (XLSX), **PDF**, OFX/QFX og QIF. Importguiden har 6 trin: filer → konto → kolonner → kontrol → dubletter → bekræft. Danske tal (`1.234,56`) og datoformater genkendes. Rækker, der ikke kan læses, springes over med en begrundelse og bliver aldrig til 0 kr.
- **Dubletkontrol**: overlappende måneder og filer, der importeres igen, tælles ikke dobbelt. Mulige dubletter vises til kontrol. Intet slettes automatisk, og to ens køb i samme fil importeres begge. En hel import kan fortrydes under *Importhistorik*.
- **Transaktioner**: søgning, filtre, sortering, redigering af flere på én gang, tags og noter. Bankens oprindelige værdier gemmes altid, så rettelser kan ses i en ændringshistorik og gendannes.
- **Kategorier og regler**: 10 hovedkategorier med underkategorier og en lokal, forklarlig regelmotor. Dine egne regler går forud for de indbyggede. Usikre match markeres som forslag. Manuelt valgte kategorier overskrives aldrig uden din tilladelse.
- **Budgetter**: månedsbudget pr. kategori, forslag ud fra 3 eller 6 hele måneder (du godkender selv beløbene), overførsel af ubrugt beløb, kopiering til næste måned og periodebudgetter (fx ferie).
- **Overblik, månedssammenligning, faste betalinger, mål og opsparing, indsigter og rapporter** med CSV-eksport og udskrift, så du kan gemme som PDF.
- **Lyst og mørkt tema**, desktop og mobil. Alle grafer har en datatabel som alternativ.

## PDF-kontoudtog

PDF-filer fra netbanken eller fra Chromes **Udskriv → Gem som PDF** kan importeres. Teksten læses lokalt med [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0), som ligger uændret i `assets/libraries/pdfjs-6.4.299/` og først indlæses, når der vælges en PDF. Derefter genskaber `js/pdf-import.js` tabellen:

- Har udtoget en overskriftsrække (fx *Dato | Tekst | Beløb | Saldo*), placeres teksten under de rigtige kolonner – også når overskriften gentages på hver side, og når tekst fylder to linjer.
- Ellers læses hver linje som *dato … tekst … beløb [saldo]*, også med minus bagefter (`129,00-`).
- Datoer uden årstal (fx `05.01`) får årstallet fra udtogets periode.
- PDF'er med adgangskode kan åbnes; adgangskoden bruges kun i browseren og gemmes ikke.
- Scannede PDF'er (billeder uden tekst) kan ikke læses – det får man besked om.

Resultatet går gennem den almindelige importguide, så kolonner, beløb og dubletter kan kontrolleres, før noget gemmes. CSV eller Excel fra netbanken er stadig det mest præcise. PDF-import kræver, at appen åbnes via hjemmesiden eller `Start Grejs Budget.bat` (ikke direkte som fil).

## Beregningsregler (ens overalt)

Beløb gemmes med fortegn: positive tal er penge ind og negative tal er penge ud. Summer regnes i øre. Alle sider bruger de samme funktioner i `js/analytics.js`:

- Interne overførsler og *Betaling af kreditkort* tæller hverken som indtægt eller forbrug, så kortkøb ikke dobbelttælles.
- Opsparing og investering vises for sig og tæller ikke som forbrug. Det kan ændres i indstillinger.
- Refusioner, fx returvarer, trækkes fra forbruget i kategorien. De kan i stedet tælles som indtægt.
- Kontanthævning er forbrug. Det kan ændres i indstillinger.
- Beløb i fremmed valuta tælles først med, når du har angivet en kurs. Der hentes ingen kurser fra internettet.
- *Netto = indtægter − udgifter.* Tallet er beregnet ud fra de importerede data og svarer ikke nødvendigvis til saldoen på din bankkonto.

## Sikkerhedskopi og gendannelse

Data ligger i browserens IndexedDB. De **synkroniseres ikke** mellem enheder og browsere, og de forsvinder, hvis browserdata ryddes, eller hvis du bruger privat browsing.

**Safari (Mac, iPhone og iPad):** Safari kan slette data fra hjemmesider, der ikke er brugt i 7 dage. Det undgås ved at tilføje Grejs Budget til Dock (Mac: *Arkiv → Føj til Dock*) eller til hjemmeskærmen (*Del → Føj til hjemmeskærm*) og åbne den derfra.

- **Lav en sikkerhedskopi:** *Indstillinger → Sikkerhedskopi → Hent sikkerhedskopi* (eller *Rapporter → Fuld sikkerhedskopi*). Du får én JSON-fil med alle transaktioner, kategorier, regler, budgetter, konti, mål, faste betalinger og indstillinger.
- **Gendan eller flyt til en anden enhed:** *Indstillinger → Gendan fra fil*. Filen kontrolleres først. Ugyldige filer og filer fra en nyere version afvises, uden at noget ændres. Før en gendannelse erstatter dine nuværende data, får du vist præcis, hvad der erstattes, og du får tilbudt at hente en kopi af dem først.

## Eksempeldata

Mappen `eksempeldata/` indeholder opdigtede bankfiler i forskellige formater til at afprøve importguiden:

| Fil | Indhold |
|---|---|
| `lonkonto_2026-01_til_2026-03.csv` | Semikolon, decimalkomma, `DD.MM.ÅÅÅÅ`, UTF-8 med BOM |
| `lonkonto_2026-03_til_2026-04.csv` | Overlapper marts, så dubletkontrollen kan afprøves |
| `kreditkort_2026.csv` | Komma, decimalpunktum, `ÅÅÅÅ-MM-DD`, separate debet- og kreditkolonner og transaktions-ID |
| `opsparing_2026.xlsx` | Excel med rigtige datoceller |
| `aeldre_bankfil_ansi_med_fejl.csv` | Windows-1252, tabulator, æ/ø/å og tre bevidst fejlbehæftede rækker |
| `kontoudtog_lonkonto_2026.pdf` | PDF fra Chrome ("Gem som PDF"), tabel med overskrift over 3 sider |
| `kreditkort_udtog_2026.pdf` | PDF uden overskrift, datoer uden årstal og minus bagefter |

Filerne laves med `node Grejs_Budget/scripts/make-sample-data.js` og `node Grejs_Budget/scripts/make-sample-pdf.js` (PDF'erne kræver Chrome eller Edge).

## Udvikling og test

Appen består af almindelig HTML, CSS og JavaScript uden build-trin. Det eneste tredjepartsbibliotek er pdf.js til PDF-import, som ligger lokalt. Grafer og XLSX-læser er skrevet til appen. Alt caches, så appen også virker offline.

```text
Grejs_Budget/
├── index.html, manifest.webmanifest, service-worker.js
├── css/      style.css, responsive.css, print.css
├── js/       util, import, pdf-import, categorization, transactions, analytics, budgets, recurring,
│             insights, export, sample-data, storage, ui, charts, actions, app
│   └── views/  én fil pr. side
├── assets/   grejs-budget-logo.png, icons/, libraries/pdfjs-6.4.299/
├── eksempeldata/
└── scripts/  run-tests.js, stamp-service-worker.js, make-sample-data.js, make-sample-pdf.js, start-lokalt.js
```

- `node Grejs_Budget/scripts/run-tests.js` kører de automatiske tests. De dækker import i alle formater (inkl. genskabelse af tabeller fra PDF), datoer og decimaler, dubletter, kategorisering, beregningsregler, budgetter, faste betalinger, eksport og backup, et datasæt med 10.000 transaktioner, og at koden ikke laver netværkskald.
- `node Grejs_Budget/scripts/stamp-service-worker.js` versionerer CSS/JS (`?v=hash`) og opdaterer offline-listen i `service-worker.js`.
- Begge dele køres automatisk af `.githooks/pre-commit`.
- Datamodellen har et versionsnummer (`SCHEMA` i `js/storage.js`). Ændres den, tilføjes en migration i `MIGRATIONS`, som både bruges ved opstart og ved gendannelse af ældre sikkerhedskopier.
