# PDF Konverter – Kombinér

Et selvstændigt webværktøj, der samler PDF'er, Word-dokumenter og billeder i én PDF-fil.
Alt foregår i browseren: filerne uploades ikke, gemmes ikke og sendes ikke nogen steder hen.

## Brug

Åbn `index.html` direkte, eller host mappen som en statisk side (fx GitHub Pages).
Der kræves ingen server, database eller Node.js. Bibliotekerne hentes fra et CDN, så
første besøg kræver internet.

1. Tilføj filer (knap, klik på feltet eller træk dem ind fra Stifinder).
2. Arrangér rækkefølgen: træk i kortene, eller brug pilene. PDF'er med flere sider kan
   udvides, så de enkelte sider kan flyttes.
3. Vælg filnavn og sideopsætning, og tryk **Saml og download PDF**.

## Understøttede filtyper

| Type | Sådan håndteres den |
| --- | --- |
| PDF (`.pdf`) | Siderne kopieres direkte og beholder deres egen størrelse og retning. Krypterede eller adgangskodebeskyttede PDF'er afvises med en forklaring. |
| Word (`.docx`) | Gengives i browseren og indsættes som billeder af siderne. Teksten kan derfor ikke markeres i den færdige PDF, og avanceret layout (tekstbokse, diagrammer, SmartArt, ligninger, spalter) kan afvige fra Word. Siden viser en advarsel, når dokumentet indeholder den slags. Sider deles ved Words egne sideskift og ellers mellem tekstlinjer, aldrig gennem en linje. |
| Billeder (`.png`, `.jpg`, `.jpeg`, `.webp`) | Lægges på en side efter indstillingerne uden at blive strakt. Telefonbilleder med EXIF-rotation vendes rigtigt. |

Gamle Word-filer (`.doc`), Excel, PowerPoint, HEIC m.fl. understøttes ikke endnu. Siden
siger det tydeligt og foreslår at gemme filen som PDF eller `.docx` først.

Indstillingerne for sidestørrelse, retning, tilpasning og margener gælder kun billeder og
Word-sider. Eksisterende PDF-sider ændres ikke.

## Filer

- `index.html`: struktur og brugerflade
- `style.css`: design, layout, animationer og mobilvisning
- `app.js`: filhåndtering, forhåndsvisning, sortering, konvertering og samling
- `README.md`: denne fil

## Biblioteker

Alle hentes med faste versioner. Hvis et af dem ikke kan hentes, viser siden en fejl.

- [pdf-lib](https://pdf-lib.js.org/) 1.17.1: opretter og samler PDF'en
- [PDF.js](https://mozilla.github.io/pdf.js/) 3.11.174: miniaturer og forhåndsvisning af PDF-sider
- [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) 0.3.7 + [JSZip](https://stuk.github.io/jszip/) 3.10.1: gengiver Word-dokumenter
- [html2canvas](https://html2canvas.hertzen.com/) 1.4.1: gør de gengivne Word-sider til billeder

Word-bibliotekerne hentes først, når der tilføjes en `.docx`-fil.
