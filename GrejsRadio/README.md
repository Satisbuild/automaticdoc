# GrejsRadio

Internetradio med danske stationer – ren HTML, CSS og JavaScript uden frameworks eller backend.

## Filer

| Fil | Indhold |
| --- | --- |
| `index.html` | Siden |
| `css/grejsradio.css` | Al styling (mørkt tema som forsiden, responsivt) |
| `js/stations.js` | **Alle stationer og streamadresser** – ret her |
| `js/storage.js` | Gemmer valg i `localStorage` (nøgle `grejsRadio`) |
| `js/player.js` | Afspilleren: ét `<audio>`-element, status og fejlhåndtering |
| `js/media-session.js` | Låseskærm, mediepanel og høretelefonknapper (Media Session API) |
| `js/app.js` | Brugerfladen: liste, favoritter, filter, visning, tastatur |
| `assets/radio-logos/` | Plads til officielle logoer (valgfrit) |

## Streams

Alle adresser er hentet fra stationernes egne afspillere/CDN'er og afprøvet (november 2026):

- **DR P1–P8**: `https://live-icy.dr.dk/A/…` (DR's egne streams). P4 har en region pr. landsdel – vælges på siden.
- **NOVA, Radio Soft, POP FM, The Voice**: `https://live-bauerdk.sharp-stream.com/…` (Bauer Media / Radioplay).
- **Radio Viborg**: `https://netradio.radioviborg.dk/vib11d` (fra radioviborg.dk).
- **Radio VLR (Vejle)**: `https://netradio.vlr.dk/vlr8d` – Trekantområdet-udgaven fra vlr.dk.

Holder en stream op med at virke, viser radioen en fejlbesked med "Prøv igen", og de andre stationer virker stadig.
Ret blot adressen i `js/stations.js`.

## Gemte indstillinger

Sidste station, lydstyrke, lyd fra/til, favoritter, visning (gitter/liste), filter og P4-region.

## Godt at vide

- Browsere tillader ikke, at lyd starter af sig selv. Radioen husker den sidste station, men man skal trykke afspil.
- På iPhone/iPad kan en hjemmeside ikke styre lydstyrken; der bruges telefonens knapper (mute virker).
- Næste/forrige på låseskærm og høretelefoner afhænger af telefon og browser.
