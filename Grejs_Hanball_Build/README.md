# Grejs_Handball_Build

Taktisk håndboldprogram: tegn, gem og afspil systemer, og vis dem til holdet på storskærm. Programmet ligger
på <https://automatikhelp.com/Grejs_Hanball_Build/> og kan også åbnes ved at dobbeltklikke på `index.html`.

Det bruger kun HTML, CSS og JavaScript uden biblioteker og uden backend. Banen tegnes på et canvas. Hvert system
gemmes i browserens LocalStorage under nøglen `grejsHandball.system.<id>`, og indstillinger under `grejsHandball.prefs`.

## Filer

| Fil | Indhold |
|---|---|
| `js/model.js` | Datamodel, geometri, beregning af sekvensen, kontrol af importerede data. Ingen DOM. |
| `js/render.js` | Tegner bane, pile, spillere og bold. Bruges til skærm, PNG, print og miniaturer. |
| `js/storage.js` | LocalStorage, JSON-format, import og download |
| `js/templates.js` | Spillerliste og færdige skabeloner |
| `js/app.js` | Tilstand, fortryd/gentag, autosave, afspilning |
| `js/editor.js` | Interaktion på banen med mus, pen og touch |
| `js/ui.js` | Paneler, tidslinje, bibliotek, eksport, præsentation, genveje, opstart |
| `tests/run-tests.js` | Test af beregningerne: `node tests/run-tests.js` |

## Sådan hænger trin og positioner sammen

Positioner gemmes ikke pr. trin. Spillerne har én startposition, og hvert trin har pile:

- En **løbe- eller forsvarspil** flytter spilleren. En spiller har højst én bevægelse pr. trin.
- En **afleverings- eller skudpil** flytter bolden fra det sted, bolden er, til en modtager eller et punkt.
- `compile()` regner resten ud. Derfor slår en rettelse i et tidligt trin igennem i resten af sekvensen,
  og ingen spiller kan teleportere.

Et trin vises, som det ser ud **før** det sker, med pile og skygger, der viser, hvad der kommer til at ske.
Derfor flytter et træk i trin 1 spilleren, mens et træk fra trin 2 og frem laver en løbepil.

## Filformat

`{ "format": "grejs-handball-build", "version": 1, "system": { ... } }`, eller `"systems": [ ... ]` for en
sikkerhedskopi. Ved import renses alt af `normalizeSystem()`, og et eksisterende system overskrives aldrig.
