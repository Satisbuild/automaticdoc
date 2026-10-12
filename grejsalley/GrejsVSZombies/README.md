# Grejs vs Zombies

Tower defense i Grejs-universet til GrejsAlley. Plant, saml sol og forsvar Grejs' hus mod zombiehorderne gennem 10 verdener.

Alt er almindelig HTML, CSS og JavaScript uden build-trin. Al grafik tegnes i koden på Canvas, og al lyd og musik genereres med Web Audio – der er ingen billed- eller lydfiler, og intet er kopieret fra andre spil.

## Indhold

- **39 planter** i fem kategorier (ressource, angreb, forsvar, fælde, støtte) – hver med egen tegning, evne, Plant Power og 6 niveauer (nye evner på Lv3 og Lv5)
- **44 zombietyper** + **10 bosser** med flere faser, svagheder og skjoldfaser
- **10 verdener × 15 baner = 150 kampagnebaner**: almindelige baner, specialbaner (beskyt planter, solmål, blomsterlinje, plantegrænse, tidsgrænse, få kort, ingen kværnere), transportbånd, faste udvalg, stormbaner og bosskampe
- Verdensmekanikker: gravsten, sandstorme, vand og flydeblade, vindstød, minevogne, kraftfelter, nat, isrækker, snestorme, bilvrag, sammenstyrtninger, giftsumpe og lianer
- **Plant Power**, 5 evner, stjerner og stjernekister, XP og spillerniveau, frø og mønter til opgraderinger, frøbutik, 18 medaljer
- **Endless Survival**, **daglige udfordringer** (ens for alle på samme dag), **10 specialudfordringer** og **3 skattejagter**
- Plante-, zombie- og bosleksikon
- Automatisk gemning i LocalStorage med versionsnummer, fejlsikret indlæsning, eksport/import og nulstilling

## Start spillet

Åbn `index.html` via en webserver (fx VS Code Live Server eller `npx http-server` fra repoets rod) og gå til `/grejsalley/GrejsVSZombies/`. Spillet er også linket fra GrejsAlley-forsiden og virker offline via sitets service worker.

Styring: mus/touch. Tastatur i kamp: `1-9` vælg plante · `S` skovl · `Q` Plant Power · `F` hastighed · `Mellemrum` saml alt · `Esc` pause.

## Filer

| Fil | Indhold |
| --- | --- |
| `index.html` | Skærme og HUD |
| `css/style.css` | Brugerflade, responsivt layout |
| `js/core.js` | Hjælpefunktioner og tegnekit (toning, øjne, blade, gradienter) |
| `js/audio.js` | Lydeffekter og musik pr. verden (Web Audio) |
| `js/plants.js` | Plantedata, opgraderingsskalering, adfærd, Plant Power og tegning |
| `js/zombies.js` | Zombie- og bossdata, evner og den parametriske zombietegning |
| `js/worlds.js` | Verdener, baggrunde, vejr og banegeneratoren (alle spiltyper) |
| `js/progression.js` | Gemmesystem, økonomi, XP, opgraderinger, medaljer og butik |
| `js/game.js` | Kampmotoren (kan køre uden tegning til automatiske test) |
| `js/ui.js` | Alle menuer, loadout, kamp-HUD, input og resultater |
| `js/main.js` | Opstart |

## Nyt indhold

Planter, zombier, bosser og verdener er data. En ny plante tilføjes med et `def({...})`-kald i `plants.js` (stats, `tick`, `power`, `draw`), en ny zombie i `zombies.js`, og banerne bygges automatisk ud fra verdensdata og skabelonen i `worlds.js` – motoren skal ikke omskrives.
