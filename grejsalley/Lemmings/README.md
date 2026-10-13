# GrejsAlley Lemmings

Et Lemmings-inspireret puslespil til GrejsAlley. Små "grejser" går automatisk gennem banen, og spilleren giver dem evner, så nok af dem når sikkert til udgangen. Spillet har 20 baner i 5 verdener og otte evner. Al grafik og lyd er lavet af koden selv. Der bruges ingen filer eller materialer fra det originale Lemmings.

Spillet er ren HTML, CSS og JavaScript. Der er ingen build-trin, ingen frameworks og ingen eksterne afhængigheder (heller ikke skrifttyper eller CDN'er).

## Start spillet lokalt

Den nemmeste måde er at åbne `index.html` direkte i en browser (Chrome, Edge eller Firefox). Spillet bruger almindelige `<script>`-filer og ingen ES-moduler, så det virker også via `file://`.

Du kan også starte en lille webserver fra mappen `grejsalley/`, så linket fra hjemmesiden og stierne opfører sig præcis som på GitHub Pages:

```bash
cd grejsalley
npx serve .          # eller: python -m http.server 8000
# åbn http://localhost:8000/Lemmings/
```

## Filer og systemer

| Fil | Indhold |
| --- | --- |
| `index.html` | Skærme (menu, banevalg, spil), HUD og et SVG-ikonsæt |
| `css/style.css` | Hele brugerfladen, inklusive mobil-, landskabs- og touch-layout |
| `js/level.js` | Terræn i pixelgitter (luft/jord/stål/klods), figurer der tegner terrænet, og bygning af baner |
| `js/lemming.js` | Grejsens model og grundtilstande: gå, falde, klatre, gå ud, drukne, splat |
| `js/abilities.js` | De otte evner: regler for tildeling og logik for bygger, bryder, minearbejder, graver og stopper |
| `js/game.js` | Ét spil på en bane: frigivelse, fast simulationstakt, tid, sejr/nederlag, eksplosioner og atombombe |
| `js/levels-data.js` | Alle verdener og baner som data |
| `js/themes.js` | Farver, baggrunde og terrænpaletter pr. verden |
| `js/render.js` | Canvas-tegning: parallax-baggrund, terræn, grejser, partikler og minikort |
| `js/input.js` | Mus, touch (træk, knib-zoom), hjul og tastatur |
| `js/ui.js` | HUD, banevalg og dialoger (intro, pause, resultat, indstillinger) |
| `js/audio.js` | Syntetiserede lydeffekter og musik (Web Audio) |
| `js/save.js` | Fremskridt og indstillinger i `localStorage` |
| `js/main.js` | Styring af skærme, spil-loop, hastighed, pause og baneflow |
| `tools/verify.js` | Automatisk test: kører alle baner med en scriptet løsning |

Simulationen (`level.js`, `lemming.js`, `abilities.js`, `game.js`) rører ikke DOM'en. Den kører med fast takt (20 tik i sekundet ved 1×), så spillet går lige hurtigt uanset skærmens billedfrekvens. 2× og 4× kører bare flere tik pr. billede.

## Tilføj en ny bane

Tilføj et objekt sidst i `GL.LEVELS` i `js/levels-data.js`. Banerne låses op i den rækkefølge, de står i listen.

```js
{
  id: 'ice-5', world: 'ice', name: 'Min nye bane',
  intro: 'Kort forklaring, som vises før banen starter.',
  w: 600, h: 180,                 // størrelse i bane-pixels (en grejs er 10 px høj)
  count: 20, required: 15,        // antal grejser og hvor mange der skal reddes
  best: 19,                       // valgfri: bedst mulige resultat (= 3 stjerner)
  time: 240,                      // tidsgrænse i sekunder
  rate: 40,                       // laveste frigivelseshastighed (1-99)
  skills: { builder: 3, digger: 2 },
  entrance: { x: 80, y: 40, dir: 1 },   // dir 1 = går mod højre
  exit: { x: 540, y: 140 },             // y sættes automatisk ned på jorden
  hazards: [{ type: 'water', x: 300, y: 150, w: 40, h: 30 }],   // water | lava | acid
  terrain: [
    ['land', 0, 600, 180, [[0, 140], [300, 130], [600, 140]], 'd', 1],
    ['rect', 300, 130, 40, 50, 'a'],        // skær et hul
    ['rect', 420, 90, 12, 50, 's'],         // stålvæg
  ],
},
```

Terræn-figurerne tegnes i rækkefølge:

- `['land', x0, x1, bund, [[x,y]...], mat, ruhed]` er jord med en blød overflade gennem kontrolpunkterne.
- `['ceil', x0, x1, [[x,y]...], mat, ruhed]` er et loft, der fyldes fra toppen og ned.
- `['rect', x, y, b, h, mat]`, `['poly', [[x,y]...], mat]` og `['ellipse', cx, cy, rx, ry, mat]` er simple former.
- `['blob', cx, cy, rx, ry, mat, seed]` er en naturlig, ujævn klippe.
- Materialet `mat` er en af:
  - `'d'`: jord, som kan graves
  - `'s'`: stål, som ikke kan graves
  - `'a'`: luft, som skærer et hul

En ny verden kræver en post i `GL.WORLDS` med `theme` sat til et af temaerne i `js/themes.js`. Du kan også tilføje et nyt tema dér.

Gode tommelfingerregler:

- Fald på over 60 px er dødelige, og et skridt op på over 6 px er en væg.
- Trappen fra en Bygger stiger 12 px over ca. 40 px.
- Hvis en Graver laver en skakt, falder de næste grejser hele vejen ned. Hold derfor afstanden fra overfladen til bunden under 60 px.
- Klippetoppe, der stikker ud over væggen, stopper Klatrere.

Kør derefter testen: `node tools/verify.js`. Tilføj også en løsning til den nye bane i `SOLUTIONS` i `tools/verify.js`. Testen tjekker tre ting: at banen kan klares, hvor mange der kan reddes, og at den **ikke** kan klares uden evner.

## Ændr antallet af evner i en bane

Ret `skills` i banens objekt, for eksempel `skills: { climber: 5, floater: 5, builder: 2 }`. Evner, der ikke står i listen, er 0 og vises som deaktiverede i værktøjslinjen. De otte nøgler er `climber`, `floater`, `bomber`, `blocker`, `builder`, `basher`, `miner` og `digger`.

## Ændr grafik og lyd

- **Farver og baggrunde pr. verden** ligger i `js/themes.js`. Her styres himmel, parallax-lag med træer, grantræer, kaktusser, pyramider og fabrikker, terrænets farver, stål, klodser, luge og udgang.
- **Grejsernes udseende** ligger i `js/render.js`. Farverne findes i `LC` øverst, positurerne i `poseFor()` og selve tegningen i `drawBody()`.
- **Terrænets tekstur** laves pr. pixel i `dirtColor()`, `steelColor()` og `brickColor()` i `js/render.js`.
- **Lyd** syntetiseres i `js/audio.js`. Effekterne ligger i `play()`, og melodierne pr. verden i `SONGS`. Hvis du hellere vil bruge lydfiler, så læg dem i `assets/audio/` og afspil dem med `new Audio('assets/audio/xxx.mp3')` fra `play()`.
- **Ikoner** er SVG-symboler øverst i `index.html`. Favicon og logo ligger i `assets/images/`.

## Udgiv på GitHub Pages

Alle stier er relative, så mappen virker direkte på GitHub Pages:

1. Commit og push mappen `grejsalley/Lemmings/` sammen med resten af sitet.
2. Spillet ligger derefter på `https://<dit-domæne>/grejsalley/Lemmings/`.
3. Det er linket fra `grejsalley/GREJSALLEY.html` (kortet "GrejsAlley Lemmings").

Sitets pre-commit-hook (`tools/update-sw.js`) lægger automatisk de nye filer ind i offline-cachen i `sw.js`.

## Kendte begrænsninger

- Når mange grejser står præcis oven i hinanden, vælger et klik den, der bedst kan tage den valgte evne, men ikke nødvendigvis den, man havde tænkt sig. Pause (Space) gør det lettere at ramme den rigtige.
- Lyd kræver et klik eller tastetryk først, fordi browserne blokerer automatisk afspilning.
- Fremskridt gemmes kun i den aktuelle browser (`localStorage`). Der er ingen konto og ingen synkronisering mellem enheder.
