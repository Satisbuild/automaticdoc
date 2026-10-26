// Enkle SVG-grafer uden eksterne biblioteker (virker offline).
// Hver graf har en tekstlig opsummering (aria-label) og en datatabel som alternativ.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;
  const esc = U.esc;

  function niceMax(v) {
    if (v <= 0) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  const short = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return U.fmtNumber(v / 1e6, 1) + ' mio.';
    if (a >= 1e4) return U.fmtNumber(Math.round(v / 1000)) + 't';
    return U.fmtNumber(Math.round(v));
  };

  function table(head, rows) {
    return '<details class="chart-table"><summary>Vis tallene som tabel</summary><div class="table-wrap"><table class="compact"><thead><tr>' +
      head.map((h, i) => '<th' + (i ? ' class="r"' : '') + '>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map((r) => '<tr>' + r.map((c, i) => '<td' + (i ? ' class="r num"' : '') + '>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></details>';
  }

  // Søjler for indtægter og udgifter pr. måned.
  // data: [{ label, income, expense, partial }]
  function incomeExpense(data, opts) {
    const o = opts || {};
    const W = 640, H = o.height || 240, L = 48, R = 8, T = 12, B = 28;
    const max = niceMax(Math.max(100, ...data.map((d) => Math.max(d.income, d.expense))));
    const cw = (W - L - R) / Math.max(1, data.length);
    const bw = Math.min(26, cw * 0.32);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    let svg = '';
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i, yy = y(v);
      svg += '<line class="grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + esc(short(v)) + '</text>';
    }
    data.forEach((d, i) => {
      const cx = L + cw * i + cw / 2;
      const cls = d.partial ? ' partial' : '';
      const tip = d.label + (d.partial ? ' (ufuldstændig)' : '') + ' – Indtægter: ' + U.fmtMoney(d.income, { decimals: 0 }) + ', Udgifter: ' + U.fmtMoney(d.expense, { decimals: 0 });
      svg += '<rect class="hit" x="' + (cx - cw / 2) + '" y="' + T + '" width="' + cw + '" height="' + (H - T - B) + '" data-tip="' + esc(tip) + '"/>';
      svg += '<rect class="bar-income' + cls + '" x="' + (cx - bw - 1) + '" y="' + y(d.income) + '" width="' + bw + '" height="' + Math.max(0, H - B - y(d.income)) + '" rx="4" pointer-events="none"/>';
      svg += '<rect class="bar-expense' + cls + '" x="' + (cx + 1) + '" y="' + y(d.expense) + '" width="' + bw + '" height="' + Math.max(0, H - B - y(d.expense)) + '" rx="4" pointer-events="none"/>';
      svg += '<text x="' + cx + '" y="' + (H - 9) + '" text-anchor="middle">' + esc(d.label) + (d.partial ? '*' : '') + '</text>';
    });
    const totalI = U.sumAmounts(data, (d) => d.income), totalE = U.sumAmounts(data, (d) => d.expense);
    const aria = 'Søjlediagram over indtægter og udgifter for ' + data.length + ' måneder. I alt indtægter ' + U.fmtMoney(totalI, { decimals: 0 }) + ' og udgifter ' + U.fmtMoney(totalE, { decimals: 0 }) + '.';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(aria) + '">' + svg + '</svg>' +
      '<div class="legend"><span><i style="background:var(--chart-income)"></i>Indtægter</span><span><i style="background:var(--chart-expense)"></i>Udgifter</span>' +
      (data.some((d) => d.partial) ? '<span class="muted">* ufuldstændig måned</span>' : '') + '</div>' +
      table(['Måned', 'Indtægter', 'Udgifter', 'Netto'], data.map((d) => [d.label + (d.partial ? ' (ufuldstændig)' : ''), U.fmtMoney(d.income), U.fmtMoney(d.expense), U.fmtMoney(d.income - d.expense)]));
  }

  // Donut over fordeling. items: [{ label, value, color }]
  function donut(items, opts) {
    const o = opts || {};
    const total = items.reduce((s, x) => s + Math.max(0, x.value), 0);
    const size = 200, r = 78, sw = 26, c = 2 * Math.PI * r;
    let off = 0, arcs = '';
    for (const it of items) {
      if (it.value <= 0 || !total) continue;
      const len = (it.value / total) * c;
      const gap = items.length > 1 ? Math.min(2, len * 0.3) : 0;
      arcs += '<circle cx="100" cy="100" r="' + r + '" fill="none" style="stroke:' + esc(it.color) + '" stroke-width="' + sw + '" stroke-dasharray="' + Math.max(0, len - gap) + ' ' + (c - Math.max(0, len - gap)) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 100 100)" data-tip="' + esc(it.label + ': ' + U.fmtMoney(it.value, { decimals: 0 }) + ' (' + U.fmtPct((it.value / total) * 100) + ')') + '"/>';
      off += len;
    }
    if (!arcs) arcs = '<circle cx="100" cy="100" r="' + r + '" fill="none" style="stroke:var(--panel-3)" stroke-width="' + sw + '"/>';
    const aria = 'Cirkeldiagram: ' + items.slice(0, 6).map((x) => x.label + ' ' + U.fmtPct(total ? (x.value / total) * 100 : 0)).join(', ');
    return '<svg class="chart" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + esc(aria) + '" style="max-width:200px">' + arcs +
      '<text class="donut-center" x="100" y="100" text-anchor="middle">' + esc(o.center || U.fmtMoney(total, { decimals: 0 })) + '</text>' +
      '<text class="donut-sub" x="100" y="118" text-anchor="middle">' + esc(o.sub || 'i alt') + '</text></svg>';
  }

  // Linjer over tid. series: [{ label, color, values: [] }], labels: []
  function lines(series, labels, opts) {
    const o = opts || {};
    const W = 640, H = o.height || 220, L = 48, R = 12, T = 12, B = 28;
    const all = series.flatMap((s) => s.values.filter((v) => v != null));
    const max = niceMax(Math.max(100, ...all));
    const n = Math.max(1, labels.length - 1);
    const x = (i) => L + ((W - L - R) * i) / n;
    const y = (v) => T + (H - T - B) * (1 - v / max);
    let svg = '';
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i, yy = y(v);
      svg += '<line class="grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + esc(short(v)) + '</text>';
    }
    const step = Math.ceil(labels.length / 12);
    labels.forEach((l, i) => { if (i % step === 0 || i === labels.length - 1) svg += '<text x="' + x(i) + '" y="' + (H - 9) + '" text-anchor="middle">' + esc(l) + '</text>'; });
    for (const s of series) {
      const pts = s.values.map((v, i) => (v == null ? null : x(i) + ',' + y(v))).filter(Boolean);
      svg += '<polyline class="line" style="stroke:' + esc(s.color) + '" points="' + pts.join(' ') + '"/>';
      s.values.forEach((v, i) => { if (v != null) svg += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.5" style="fill:' + esc(s.color) + '" data-tip="' + esc(s.label + ', ' + labels[i] + ': ' + U.fmtMoney(v, { decimals: 0 })) + '"/>'; });
    }
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('Linjediagram: ' + series.map((s) => s.label).join(', ')) + '">' + svg + '</svg>' +
      '<div class="legend">' + series.map((s) => '<span><i style="background:' + esc(s.color) + '"></i>' + esc(s.label) + '</span>').join('') + '</div>' +
      table(['Periode'].concat(series.map((s) => s.label)), labels.map((l, i) => [l].concat(series.map((s) => (s.values[i] == null ? '–' : U.fmtMoney(s.values[i]))))));
  }

  // Lille ring til mål.
  function ring(pct, color) {
    const r = 30, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct || 0));
    return '<svg class="goal-ring" viewBox="0 0 74 74" role="img" aria-label="' + esc(U.fmtPct(p) + ' nået') + '"><circle cx="37" cy="37" r="' + r + '" fill="none" style="stroke:var(--panel-3)" stroke-width="8"/>' +
      '<circle cx="37" cy="37" r="' + r + '" fill="none" style="stroke:' + esc(color || 'var(--pos)') + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (c * p / 100) + ' ' + c + '" transform="rotate(-90 37 37)"/>' +
      '<text x="37" y="41" text-anchor="middle" style="font-size:13px;font-weight:700;fill:var(--text)">' + Math.round(p) + '%</text></svg>';
  }

  GB.charts = { incomeExpense, donut, lines, ring, table };
})();
