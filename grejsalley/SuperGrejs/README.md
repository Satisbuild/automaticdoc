# Super Grejs

Et originalt 2D-platformspil til GrejsAlley: løb, hop, stamp på fjender, saml mønter og power-ups, find hemmelige rum og warp-rør, og besejr en boss i slutningen af hver verden.

- **10 figurer** – Jones, Langvad, Grejs, Buss, Joe, Luske, Muggel, Jeppe Gobi, Polly L og Ossy (samme evner, forskelligt udseende)
- **8 verdener × 4 baner = 32 håndbyggede baner**, hver 4. bane er en fæstning med boss
- **Konto, venner og rangliste** (kun højeste verden nået) via en separat backend

Alt er HTML, CSS og almindelig JavaScript (ingen build-trin). Al grafik tegnes i koden som pixel-art, og al lyd og musik genereres med Web Audio – der er ingen billed- eller lydfiler, og intet er kopieret fra andre spil.

---

## Start spillet

### Lokalt (anbefalet under udvikling)

Spillet skal køre fra en lokal webserver (ikke ved at dobbeltklikke på filen), ellers kan backenden ikke kalde det på grund af CORS.

**VS Code Live Server:** højreklik `index.html` → *Open with Live Server*. Den åbner normalt <http://127.0.0.1:5500/grejsalley/SuperGrejs/index.html>.

**Eller med Node:**

```bash
cd C:\Users\mecha\Documents\Github\automaticdoc
npx http-server -p 5500 -a 127.0.0.1
```

og åbn <http://127.0.0.1:5500/grejsalley/SuperGrejs/>.

Spillet kan spilles uden backend. Konto, venner og rangliste kræver, at backenden kører (se `C:\Users\mecha\Desktop\Codening\Backend\SuperGrejs\README.md`).

### Hvor finder spillet backenden?

Det styres i `js/config.js`:

- På `localhost` / `127.0.0.1` bruges `http://127.0.0.1:3001/api`.
- Andre steder bruges `PROD_API`. **Den er tom**, indtil backenden er hostet – så er online-funktionerne slået fra, men spillet virker. Når backenden kører på HTTPS, sæt fx:
  ```js
  const PROD_API = 'https://supergrejs-api.dit-domæne.dk/api';
  ```
  og tilføj spillets adresse (fx `https://automatikhelp.com`) til `CLIENT_ORIGIN` i backendens `.env`.
- Til test kan adressen overstyres i browserkonsollen: `localStorage.setItem('sg_api', 'http://127.0.0.1:3001/api')`.

Der står ingen hemmeligheder i frontend – kun den offentlige API-adresse.

---

## Styring

| Handling | Tastatur | Touch | Gamepad |
|---|---|---|---|
| Gå | ← → / A D | ◀ ▶ | Venstre stick / D-pad |
| Hop (hold for højere hop) | Mellemrum / W / ↑ | HOP | A |
| Løb / skyd energikugler | Shift / J | LØB | B / X |
| Duk, gå ind i rør og døre | ↓ / S | ▼ | Ned |
| Pause | Esc / P | II-knappen | Start |
| Bekræft i menuer | Enter | Tryk | – |

Tasterne kan ændres under **Indstillinger**. Touchknapperne vises automatisk på touch-skærme (kan slås til/fra). På touch-enheder tegnes spilverdenen over en bund-stribe, så knapperne aldrig dækker banen.

Hopets højde afhænger af, hvor længe hop holdes nede, og af farten (løb giver længere og højere hop). Fysikken kører med fast tidsskridt (1/120 s), så den er ens ved 30, 60 og 144 FPS. Alle fysik-konstanter står samlet i `js/physics.js` (`C`).

---

## Indhold

| Verden | Tema | Nye ting | Boss |
|---|---|---|---|
| 1 Grønne Grejsmarker | Græs | Blokke, rør, skjoldbiller, fjeder, faldende platforme | Brumle Bulder |
| 2 Møntminen | Grotte | Minevogne over pigge, faldende sten, hemmelige lommer, lodret skakt | Grav-Gustav |
| 3 Skyhøj | Skyer | Vind (med- og modvind), skyplatforme, kanoner, mini-boss | Stormfuglen Vindolf |
| 4 Lava-laboratoriet | Lab | Lava, glødere, stempler, smuldrebroer, gnisterobotter | Doktor Magmus |
| 5 Frostfjeldet | Sne | Is (glat), istapper, snestorm, warp-grotte | Iskolossen Frosti |
| 6 Mørkeskoven | Nat | Mørke med lys omkring figuren, tornranker, flagermus, giftsump, døre, mini-boss | Rodkongen |
| 7 Mekanikkens by | Fabrik | Transportbånd, stempelgader, roterende platforme, lodret tårn | Tandhjulstyrannen |
| 8 Kaosfæstningen | Kaos | Alt kombineret | Kaos-Kejseren Grumulus (3 faser) |

**Power-ups:** Kraftfrugt (stor form), Energiblomst (skyd energikugler), Stjernekerne (uovervindelig), Ekstralivs-kapsel. Et hit tager én form ad gangen (energi → stor → lille → mister liv). 100 mønter = ekstra liv.

**Fjender:** Småskramler, Skjoldbille (skjoldet kan sparkes), Rørgnasker, Luftdrøne, Gnisterobot, Hoppeklat, Kanontårn med piggkugler, Gløder, Glødestang, Stempel, Istap/faldsten, Natflagermus, Tornranke og to mini-bosser (Panserbillen, Kæmpe-Skramler).

**Bosser** varsler altid deres angreb (rødt udråbstegn, rystelse eller advarselsmarkering). Hop på hovedet, når de ikke har pigge fremme – især når de er svimle efter et angreb. Energikugler giver lidt skade.

**Hemmeligheder:** bonusrum bag rør (1-1, 1-2, 2-1, 5-1), falske vægge og skjulte lommer (2-1), usynlige blokke (fx 6-1, 8-3), en skjult rute på taget med fjeder (1-2), og **warp-rør**: 1-2 → verden 2, 3-2 → verden 4, 5-3 → verden 6.

**Andet:** verdenskort med låste/gennemførte baner, checkpoints, timer (under 60 s bliver musikken hurtigere), pausemenu, resultatskærm, game over og en slutsekvens efter 8-4.

---

## Progression og online

- Lokal progression gemmes i `localStorage` pr. profil (gæst eller den bruger, der er logget ind). Gæste-fremskridt følger ikke med over på en konto.
- Når en ny verden låses op og man er logget ind, sendes den til serveren. Resultatskærmen viser først "Gemt online", når serveren har bekræftet det; ellers vises en fejl med **Prøv igen**, og spillet prøver også igen fra hovedmenuen.
- Serveren er sandheden for ranglisten. Den accepterer kun én verden frem ad gangen, så warp-rør fører højst én verden frem.
- Login-tokenet gemmes i `localStorage` sammen med sit udløbstidspunkt og slettes ved udløb, log ud eller hvis serveren afviser det. Adgangskoder gemmes aldrig i browseren.
- `localStorage` bruges ellers kun til indstillinger (lyd, taster, touch, valgt figur).

---

## Filer

| Fil | Indhold |
|---|---|
| `index.html` | Siden: canvas, HUD, touchknapper, skærm-container, scripts |
| `manifest.webmanifest`, `assets/images/icon.svg` | Ikon og PWA-oplysninger |
| `css/style.css` | Farver, knapper, felter, grundlayout |
| `css/menu.css` | Alle menuer og skærme (hovedmenu, figurvælger, kort, venner, indstillinger ...) |
| `css/game.css` | HUD, bossbar, toast, touchknapper |
| `js/config.js` | Adressen til backend-API'et |
| `js/util.js` | Hjælpefunktioner og sikker `localStorage` |
| `js/audio.js` | Lydeffekter og musik (Web Audio-synth og lille sequencer med egne melodier) |
| `js/input.js` | Tastatur (kan omdefineres), touch og gamepad |
| `js/art.js` | Pixel-painter, temaer, tiles, fjender, genstande, baggrunde og dekorationer |
| `js/characters.js` | De 10 figurer: data, beskrivelser, poser og tegning |
| `js/physics.js` | Fysik-konstanter, tile-koder og kollision |
| `js/levels.js` | Bane-bygger (kommandoer til jord, blokke, rør, fjender ...) og register |
| `js/levels-data.js` | Alle 32 baner, bonusrum og verdensinfo |
| `js/powerups.js` | Power-ups og spillerens former |
| `js/entities.js` | Fjender, platforme, fjedre, checkpoints, mål, genstande, projektiler |
| `js/bosses.js` | Bosser, angreb (som generatorer) og bosstegninger |
| `js/player.js` | Spillerens styring, hop, duk, rør, døre, skade og død |
| `js/renderer.js` | Tegning: parallax, tiles, partikler, vejr, mørke, overgange |
| `js/game.js` | Spillogik: baner, rum, kollisioner, blokke, liv, timer, kamera, bossarena, mål |
| `js/api.js` | REST-klient med timeout og danske fejlbeskeder |
| `js/auth.js` | Login-session og progression (lokal + online-synkronisering) |
| `js/ui.js` | Alle skærme, HUD, toast og bossbar |
| `js/app.js` | Opstart, hovedløkke, tilstande og flow mellem skærme |

### Ny bane eller ændring

Baner bygges med kommandoer i `js/levels-data.js` – fysikmotoren skal ikke røres. Koordinater er tiles, og `y` måles fra bunden (jorden er `y = 0-1`). Eksempel:

```js
define('1-1', { name: 'Første skridt', theme: 'grass', time: 300 }, L => {
  const m = L.room('main', 200, 18);
  m.ground(0, 199, 2);          // jord fra x=0 til 199
  m.startAt(3, 2);
  m.put(16, 5, 'B?BPB');        // mursten, mønt-blok, power-up-blok ...
  m.pipe(46, 2, 4, { to: { room: 'bonus1', x: 4, y: 2 } });
  m.enemy('skramler', 24, 2);
  m.gap(60, 61);                // hul
  m.checkpoint(102, 2);
  m.goalAt(184, 2);
});
```

Tegnforklaringen til `put()` står øverst i `js/levels.js`.

---

## Status

**Færdigt**
- Spilbar motor med præcis styring, variabel hop, løb, duk, hjørnekorrektion, coyote-tid og hop-buffer
- 10 figurer, 8 verdener, 32 baner, 8 bosser og 2 mini-bosser
- Alle blokke, mønter, power-ups, checkpoints, hemmelige rum, døre og 3 warp-rør
- HUD, pausemenu, indstillinger (lyd, taster, touch, skærmryst, mindre blink), verdenskort, resultat, game over og slutning
- Konto, venner og rangliste mod backenden – testet hele vejen igennem i Chrome
- Tastatur, touch og gamepad; responsivt på mobil (bedst i liggende format)

**Testet**
- Ingen JavaScript-fejl ved indlæsning eller i de testede skærme
- Alle 8 bosser kan besejres ved at hoppe på dem (automatisk test)
- En automatisk testbot gennemfører størstedelen af banerne; resten (lodrette baner og sektioner med bevægelige platforme og døre) er kontrolleret med hop-simulering og manuel gennemgang

**Kan forbedres senere**
- Gæste-fremskridt flyttes ikke automatisk over på en ny konto
- Baner er afprøvet automatisk og med simulering, men ikke spillet igennem af mennesker fra start til slut – sværhedsgraden kan trænge til finjustering efter rigtig spiltest
- `PROD_API` skal udfyldes, når backenden er hostet
