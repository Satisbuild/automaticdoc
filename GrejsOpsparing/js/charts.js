// Grafer med Chart.js. Farverne læses fra CSS-variablerne, så graferne følger lyst/mørkt tema.
// Hvis Chart.js ikke kunne hentes (fx første besøg uden internet), vises en besked i stedet.

(function (global) {
  'use strict';

  const instances = new Map();

  function available() {
    return typeof global.Chart !== 'undefined';
  }

  function palette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name).trim();
    return {
      text: v('--text'),
      muted: v('--muted'),
      grid: v('--chart-grid'),
      surface: v('--surface'),
      primary: v('--chart-balance'),
      primaryFill: v('--chart-balance-fill'),
      deposit: v('--chart-deposit'),
      withdrawal: v('--chart-withdrawal'),
      interest: v('--chart-interest'),
      goal: v('--chart-goal'),
      plain: v('--chart-plain'),
    };
  }

  function showFallback(canvas, text) {
    const box = canvas.parentElement;
    box.innerHTML = '<p class="chart-empty">' + text + '</p>';
  }

  function mount(id, config, emptyText) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (!available()) {
      showFallback(canvas, 'Graferne kræver internet første gang, siden åbnes. Prøv igen, når du er online.');
      return;
    }
    if (emptyText) {
      showFallback(canvas, emptyText);
      return;
    }
    if (instances.has(id)) instances.get(id).destroy();
    instances.set(id, new global.Chart(canvas, config));
  }

  function destroyAll() {
    for (const chart of instances.values()) chart.destroy();
    instances.clear();
  }

  function baseOptions(c, fmt, fmtAxis) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 450 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: c.muted, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, font: { size: 12 } },
        },
        tooltip: {
          backgroundColor: c.surface,
          titleColor: c.text,
          bodyColor: c.text,
          borderColor: c.grid,
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: { label: (ctx) => ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y) },
        },
      },
      scales: {
        x: {
          ticks: { color: c.muted, maxTicksLimit: 7, maxRotation: 0, autoSkipPadding: 12, font: { size: 11 } },
          grid: { display: false },
          border: { color: c.grid },
        },
        y: {
          ticks: { color: c.muted, callback: (v) => fmtAxis(v), maxTicksLimit: 6, font: { size: 11 } },
          grid: { color: c.grid },
          border: { display: false },
        },
      },
    };
  }

  // Saldoens udvikling over tid.
  function balance(id, d, fmt, fmtAxis) {
    const c = palette();
    const empty = d.values.length < 2 ? 'Der er endnu ikke nok bevægelser i perioden til at tegne en graf.' : null;
    const options = baseOptions(c, fmt, fmtAxis);
    options.plugins.legend.display = false;
    mount(id, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [{
          label: 'Saldo',
          data: d.values,
          borderColor: c.primary,
          backgroundColor: c.primaryFill,
          fill: 'origin',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0,
          stepped: d.stepped ? 'before' : false,
        }],
      },
      options,
    }, empty);
  }

  // Indbetalinger, hævninger og renter pr. måned (eller pr. dag).
  function flows(id, d, fmt, fmtAxis) {
    const c = palette();
    const any = d.deposits.some(Boolean) || d.withdrawals.some(Boolean) || d.interest.some(Boolean);
    const options = baseOptions(c, fmt, fmtAxis);
    mount(id, {
      type: 'bar',
      data: {
        labels: d.labels,
        datasets: [
          { label: 'Indbetalinger', data: d.deposits, backgroundColor: c.deposit, borderRadius: 4, maxBarThickness: 28 },
          { label: 'Hævninger', data: d.withdrawals, backgroundColor: c.withdrawal, borderRadius: 4, maxBarThickness: 28 },
          { label: 'Renter', data: d.interest, backgroundColor: c.interest, borderRadius: 4, maxBarThickness: 28 },
        ],
      },
      options,
    }, any ? null : 'Ingen indbetalinger, hævninger eller renter i perioden.');
  }

  // Hvor meget af saldoen er egne penge, og hvor meget er renter?
  function composition(id, d, fmt) {
    const c = palette();
    const total = d.own + d.interest;
    mount(id, {
      type: 'doughnut',
      data: {
        labels: ['Egne indbetalinger (netto)', 'Optjente renter'],
        datasets: [{
          data: [d.own, d.interest],
          backgroundColor: [c.deposit, c.interest],
          borderColor: c.surface,
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { color: c.muted, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, font: { size: 12 } } },
          tooltip: {
            backgroundColor: c.surface, titleColor: c.text, bodyColor: c.text, borderColor: c.grid, borderWidth: 1, padding: 10,
            callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + fmt(ctx.parsed) + (total ? ' (' + ((ctx.parsed / total) * 100).toLocaleString('da-DK', { maximumFractionDigits: 1 }) + ' %)' : '') },
          },
        },
      },
    }, total > 0 ? null : 'Der er ingen penge på opsparingen endnu.');
  }

  // Prognose for den fremtidige opsparing.
  function forecast(id, d, fmt, fmtAxis) {
    const c = palette();
    const datasets = [
      { label: 'Forventet saldo med renter', data: d.withInterest, borderColor: c.primary, backgroundColor: c.primaryFill, fill: 'origin', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25 },
      { label: 'Uden renter', data: d.withoutInterest, borderColor: c.plain, borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 3, tension: 0, fill: false },
    ];
    if (d.goal > 0) {
      datasets.push({ label: 'Opsparingsmål', data: d.labels.map(() => d.goal), borderColor: c.goal, borderDash: [2, 4], borderWidth: 2, pointRadius: 0, pointHoverRadius: 0, fill: false });
    }
    mount(id, { type: 'line', data: { labels: d.labels, datasets }, options: baseOptions(c, fmt, fmtAxis) });
  }

  global.GOCharts = { available, destroyAll, balance, flows, composition, forecast };
})(window);
