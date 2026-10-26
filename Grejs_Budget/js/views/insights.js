// Indsigter – forklarlige konklusioner. Klik for at se de transaktioner, der ligger bag.

(function () {
  'use strict';
  const GB = globalThis.GB;
  const UI = GB.ui, S = GB.store;
  const { esc, icon } = UI;

  function render(root, c) {
    if (!S.data.transactions.length) {
      root.innerHTML = '<div class="card">' + UI.empty('spark', 'Ingen indsigter endnu', 'Indsigter laves ud fra dine importerede transaktioner.', '<a class="btn primary" href="#/importer">Importér data</a>') + '</div>';
      return;
    }
    const list = GB.insights.generate(c, S.data);
    root.innerHTML = '<p class="lead">Indsigterne bygger kun på de data, du har importeret, og på de regler, der står under <a href="#/indstillinger">Indstillinger</a>. Klik på en indsigt for at se de transaktioner, den bygger på.</p>' +
      '<div class="card mt"><div class="card-head"><h2>' + icon('spark') + 'Indsigter</h2><span class="sub">' + esc(c.label) + '</span></div>' +
      (list.length ? '<div class="insights">' + list.map((x, i) => GB.views.overview.insightBtn(x, i)).join('') + '</div>' : UI.empty('check', 'Intet at bemærke', 'Der er ikke fundet noget særligt i den valgte periode.')) + '</div>' +
      '<div class="note mt">' + icon('info') + '<div><p><b>Sådan laves indsigterne</b></p><p>Sammenligninger med forrige måned vises kun, når der er data for begge måneder. Er den aktuelle måned ikke slut, sammenlignes kun de samme dage. Der vises ingen procent, hvis sammenligningsgrundlaget er 0. Grejs Budget giver ingen garantier om fremtiden.</p></div></div>';
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-insight]');
      if (b) { const a = list[+b.dataset.insight].action; GB.app.go(a.route, a.params); }
    });
  }

  GB.views.insights = { render };
})();
