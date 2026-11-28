/*
 * GrejsRadio – stationsliste
 * ---------------------------------------------------------------------------
 * Alle stationer og streamadresser er samlet her, så de er nemme at opdatere.
 * Rækkefølgen i listen er også rækkefølgen for "Næste" og "Forrige".
 *
 * Felter:
 *   id         Unik nøgle (bruges i localStorage – må ikke ændres uden grund)
 *   name       Stationens navn
 *   tagline    Kort beskrivelse
 *   group      "dr" eller "andre" (styrer overskriften på siden)
 *   streamUrl  Streamadresse. Bruges ikke, hvis stationen har "regions".
 *   type       MIME-type for streamen (bruges til at tjekke, om browseren kan afspille den)
 *   regions    (valgfri) Regionale varianter: { id: { name, streamUrl } }
 *   logo       (valgfri) Sti til et logo, fx "assets/radio-logos/dr-p1.png".
 *              Er feltet tomt, vises et ensartet farvet mærke med "badge"-teksten.
 *   badge      Kort tekst til mærket, når der ikke er et logo
 *   colors     To farver til mærkets farveforløb
 *
 * Kilder (afprøvet november 2026):
 *   DR:            live-icy.dr.dk – DR's egne offentlige streams (svarer med icy-name P1, P2 osv.)
 *   NOVA, Radio Soft, The Voice, POP FM:
 *                  live-bauerdk.sharp-stream.com – Bauer Media Danmarks stream-CDN (Radioplay)
 *   Radio Viborg:  netradio.radioviborg.dk – stationens egen afspiller på radioviborg.dk
 *   Radio VLR:     netradio.vlr.dk – stationens egen afspiller på vlr.dk (Trekantområdet = Vejle)
 */
(function () {
  'use strict';

  var DR = 'https://live-icy.dr.dk/A/';
  var BAUER = 'https://live-bauerdk.sharp-stream.com/';

  var p4Regions = {
    'kbh':         { name: 'København',      streamUrl: DR + 'A08H.mp3' },
    'sjaelland':   { name: 'Sjælland',       streamUrl: DR + 'A11H.mp3' },
    'bornholm':    { name: 'Bornholm',       streamUrl: DR + 'A06H.mp3' },
    'fyn':         { name: 'Fyn',            streamUrl: DR + 'A07H.mp3' },
    'syd':         { name: 'Syd',            streamUrl: DR + 'A12H.mp3' },
    'esbjerg':     { name: 'Esbjerg',        streamUrl: DR + 'A15H.mp3' },
    'trekanten':   { name: 'Trekanten',      streamUrl: DR + 'A13H.mp3' },
    'oestjylland': { name: 'Østjylland',     streamUrl: DR + 'A14H.mp3' },
    'midtvest':    { name: 'Midt & Vest',    streamUrl: DR + 'A09H.mp3' },
    'nordjylland': { name: 'Nordjylland',    streamUrl: DR + 'A10H.mp3' }
  };

  var stations = [
    { id: 'dr-p1', name: 'DR P1', tagline: 'Samfund, kultur og debat', group: 'dr',
      streamUrl: DR + 'A03H.mp3', type: 'audio/mpeg', badge: 'P1', colors: ['#0ea5e9', '#1e3a8a'], logo: '' },
    { id: 'dr-p2', name: 'DR P2', tagline: 'Klassisk musik', group: 'dr',
      streamUrl: DR + 'A04H.mp3', type: 'audio/mpeg', badge: 'P2', colors: ['#a78bfa', '#4c1d95'], logo: '' },
    { id: 'dr-p3', name: 'DR P3', tagline: 'Hits og ny musik', group: 'dr',
      streamUrl: DR + 'A05H.mp3', type: 'audio/mpeg', badge: 'P3', colors: ['#34d399', '#065f46'], logo: '' },
    { id: 'dr-p4', name: 'DR P4', tagline: 'Regional radio', group: 'dr',
      regions: p4Regions, defaultRegion: 'kbh', type: 'audio/mpeg', badge: 'P4', colors: ['#fb923c', '#9a3412'], logo: '' },
    { id: 'dr-p5', name: 'DR P5', tagline: 'Danske klassikere og gode hits', group: 'dr',
      streamUrl: DR + 'A25H.mp3', type: 'audio/mpeg', badge: 'P5', colors: ['#f472b6', '#831843'], logo: '' },
    { id: 'dr-p6', name: 'DR P6 Beat', tagline: 'Rock, indie og alternativ musik', group: 'dr',
      streamUrl: DR + 'A29H.mp3', type: 'audio/mpeg', badge: 'P6', colors: ['#facc15', '#854d0e'], logo: '' },
    { id: 'dr-p8', name: 'DR P8 Jazz', tagline: 'Jazz døgnet rundt', group: 'dr',
      streamUrl: DR + 'A22H.mp3', type: 'audio/mpeg', badge: 'P8', colors: ['#2dd4bf', '#134e4a'], logo: '' },

    { id: 'nova', name: 'NOVA', tagline: 'Hits og underholdning', group: 'andre',
      streamUrl: BAUER + 'nova_dk_mp3', type: 'audio/mpeg', badge: 'NOVA', colors: ['#f43f5e', '#7f1d1d'], logo: '' },
    { id: 'radio-soft', name: 'Radio Soft', tagline: 'Bløde hits', group: 'andre',
      streamUrl: BAUER + 'radiosoft_dk_mp3', type: 'audio/mpeg', badge: 'Soft', colors: ['#93c5fd', '#1e40af'], logo: '' },
    { id: 'pop-fm', name: 'POP FM', tagline: 'Pop og hits', group: 'andre',
      streamUrl: BAUER + 'popfm_dk_mp3', type: 'audio/mpeg', badge: 'POP', colors: ['#e879f9', '#701a75'], logo: '' },
    { id: 'the-voice', name: 'The Voice', tagline: 'Hits, hiphop og R&B', group: 'andre',
      streamUrl: BAUER + 'thevoice_dk_mp3', type: 'audio/mpeg', badge: 'Voice', colors: ['#64748b', '#0f172a'], logo: '' },
    { id: 'radio-viborg', name: 'Radio Viborg', tagline: 'Lokalradio fra Viborg', group: 'andre',
      streamUrl: 'https://netradio.radioviborg.dk/vib11d', type: 'audio/mpeg', badge: 'VIB', colors: ['#4ade80', '#14532d'], logo: '' },
    { id: 'radio-vlr', name: 'Radio VLR', tagline: 'Lokalradio fra Vejle', group: 'andre',
      streamUrl: 'https://netradio.vlr.dk/vlr8d', type: 'audio/mpeg', badge: 'VLR', colors: ['#38bdf8', '#0c4a6e'], logo: '' }
  ];

  var groups = [
    { id: 'dr', title: 'DR' },
    { id: 'andre', title: 'Kommercielle og lokale' }
  ];

  window.GrejsRadio = window.GrejsRadio || {};
  window.GrejsRadio.stations = stations;
  window.GrejsRadio.groups = groups;
})();
