// GrejsOpsparing – brugerflade, sider og håndtering af knapper og formularer.
// Afhænger af calculations.js (GOCalc), storage.js (GOStorage) og charts.js (GOCharts).

(function () {
  'use strict';

  const C = window.GOCalc;
  const S = window.GOStorage;
  const G = window.GOCharts;

  const loaded = S.loadData();
  let data = loaded.data;
  let model = null;

  const ui = {
    route: 'oversigt',
    filter: { type: 'all', from: '', to: '', q: '' },
    period: '1y',
    horizon: 3,
    storageWarning: loaded.warning,
  };

  const ROUTES = ['oversigt', 'transaktioner', 'renter', 'maal', 'grafer', 'indstillinger'];

  // ---------- Formatering ----------

  const moneyFormats = new Map();
  function moneyFormat(decimals) {
    const key = data.settings.currency + decimals;
    if (!moneyFormats.has(key)) {
      moneyFormats.set(key, new Intl.NumberFormat('da-DK', {
        style: 'currency', currency: data.settings.currency,
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      }));
    }
    return moneyFormats.get(key);
  }

  // Beløb i øre -> "25.000,00 kr."
  function money(ore) {
    return moneyFormat(2).format(Math.round(ore) / 100);
  }
  // Kroner (til grafer) -> "25.000,00 kr."
  function moneyKr(kr) {
    return moneyFormat(2).format(kr);
  }
  // Kroner til grafakser -> "25.000 kr." / "1,2 mio. kr."
  function moneyAxis(kr) {
    const abs = Math.abs(kr);
    if (abs >= 1e6) return (kr / 1e6).toLocaleString('da-DK', { maximumFractionDigits: 1 }) + ' mio.';
    return moneyFormat(0).format(kr);
  }

  const CURRENCY_AFFIX = { DKK: 'kr.', EUR: '€', SEK: 'kr', NOK: 'kr', USD: '$', GBP: '£' };
  const CURRENCY_NAMES = {
    DKK: 'Danske kroner (DKK)', EUR: 'Euro (EUR)', SEK: 'Svenske kroner (SEK)',
    NOK: 'Norske kroner (NOK)', USD: 'Amerikanske dollar (USD)', GBP: 'Britiske pund (GBP)',
  };

  function pct(fraction) {
    return (fraction * 100).toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
  }

  function rateText(rate) {
    return rate.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' %';
  }

  function rateInput(rate) {
    return rate.toLocaleString('da-DK', { maximumFractionDigits: 3, useGrouping: false });
  }

  function amountInput(ore) {
    if (!ore) return '';
    return (ore / 100).toLocaleString('da-DK', { minimumFractionDigits: ore % 100 ? 2 : 0, maximumFractionDigits: 2 });
  }

  const dateFormats = {
    long: new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    short: new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    dayMonth: new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    monthYear: new Intl.DateTimeFormat('da-DK', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    monthLong: new Intl.DateTimeFormat('da-DK', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };

  function fmtDay(day, style) {
    return dateFormats[style || 'short'].format(new Date(day * C.DAY_MS));
  }
  function fmtDate(key, style) {
    return fmtDay(C.parseDateKey(key), style);
  }

  function monthsBetween(fromDay, toDay) {
    const a = C.dayParts(fromDay);
    const b = C.dayParts(toDay);
    return (b.y - a.y) * 12 + (b.m - a.m) + (b.d >= a.d ? 0 : -1);
  }

  function durationText(fromDay, toDay) {
    const months = Math.max(0, monthsBetween(fromDay, toDay));
    if (months === 0) {
      const days = toDay - fromDay;
      return days <= 0 ? 'i dag' : 'om ' + days + (days === 1 ? ' dag' : ' dage');
    }
    const y = Math.floor(months / 12);
    const m = months % 12;
    const parts = [];
    if (y) parts.push(y + (y === 1 ? ' år' : ' år'));
    if (m) parts.push(m + (m === 1 ? ' måned' : ' måneder'));
    return 'om ' + parts.join(' og ');
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // ---------- Ikoner ----------

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    up: '<path d="M7 17 17 7M8 7h9v9"/>',
    down: '<path d="M17 7 7 17M16 17H7V8"/>',
    wallet: '<path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5"/><path d="M16.5 13.5h.01"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    upload: '<path d="M12 15V3m0 0L8 7m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  };

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  // ---------- Model: alt, der regnes ud fra data ----------

  function buildModel() {
    const today = C.todayKey();
    const ledger = C.computeLedger(data, today);
    const monthly = data.plan.monthlyAmount;
    const dom = data.plan.dayOfMonth;
    const goal = data.goal.amount;
    const horizonEnd = C.addMonths(ledger.todayDay, 120);
    const projection = C.project(ledger, data, { endDay: horizonEnd, monthly, dayOfMonth: dom, recordCredits: true });
    const rate = C.rateOnDate(data.interest.rates, today);
    const nextCreditDay = C.nextPeriodEnd(ledger.todayDay, data.interest.compounding);
    const nextCredit = projection.credits.find((c) => c.day === nextCreditDay);
    const at = (months) => {
      const day = C.addMonths(ledger.todayDay, months);
      return Object.assign({ months, day }, C.projectionAt(projection, ledger, day));
    };
    return {
      today,
      ledger,
      projection,
      rate,
      at,
      snapshots: [at(3), at(6), at(12)],
      goal,
      missing: Math.max(0, goal - ledger.balance),
      progress: goal > 0 ? Math.min(1, Math.max(0, ledger.balance / goal)) : 0,
      goalDate: goal > 0 ? C.findGoalDate(ledger, data, goal, monthly, dom) : null,
      required: goal > 0 && data.goal.targetDate ? C.requiredMonthly(ledger, data, goal, data.goal.targetDate, dom) : null,
      nextCreditDay,
      nextCreditAmount: nextCredit ? nextCredit.amount : 0,
      interestStarted: ledger.interestFromDay <= ledger.todayDay,
    };
  }

  // ---------- Gem ændringer ----------

  function clone(value) {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  // Alle ændringer går herigennem: kopiér data, ret kopien, kontrollér at saldoen aldrig bliver
  // negativ, gem i LocalStorage, og tegn siden igen. Returnerer en fejltekst eller null.
  function commit(mutate, message) {
    const draft = clone(data);
    mutate(draft);
    const check = C.computeLedger(draft, C.todayKey());
    if (check.negative) {
      return 'Det kan ikke lade sig gøre, fordi saldoen så ville blive negativ den ' + fmtDate(check.negative.date, 'long') +
        ' (' + money(check.negative.balance) + '). Du kan ikke hæve flere penge, end der står på opsparingen.';
    }
    const res = S.saveData(draft);
    if (!res.ok) return res.error;
    data = draft;
    render();
    if (message) toast(message, 'success');
    return null;
  }

  // Højeste beløb, der kan hæves på en given dato, uden at saldoen bliver negativ senere.
  function maxWithdrawable(dateKey) {
    let base = 0;
    let min = Infinity;
    for (const r of model.ledger.rows) {
      if (r.date <= dateKey) base = r.balanceAfter;
      else min = Math.min(min, r.balanceAfter);
    }
    return Math.max(0, Math.min(base, min));
  }

  // ---------- Små UI-hjælpere ----------

  let toastTimer = null;
  function toast(message, kind) {
    const el = document.getElementById('toast');
    el.className = 'toast toast-' + (kind || 'info');
    el.innerHTML = icon(kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'info') + '<span>' + esc(message) + '</span>';
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.hidden = true; }, 250);
    }, kind === 'error' ? 6500 : 3200);
  }

  function setFieldError(form, name, message) {
    const el = form.querySelector('[data-error-for="' + name + '"]');
    const input = form.elements[name];
    if (el) el.textContent = message || '';
    if (input && input.setAttribute) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function clearErrors(form) {
    form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    const general = form.querySelector('.form-error');
    if (general) general.textContent = '';
  }

  function setFormError(form, message) {
    const el = form.querySelector('.form-error');
    if (el) el.textContent = message;
    else toast(message, 'error');
  }

  function focusFirstError(form) {
    const el = form.querySelector('[aria-invalid="true"]');
    if (el) el.focus();
  }

  // Tom streng -> 0, ellers et gyldigt beløb. Returnerer { value } eller { error }.
  function readOptionalAmount(text) {
    if (!text.trim()) return { value: 0 };
    const v = C.parseAmount(text);
    return v === null ? { error: 'Skriv et gyldigt beløb, fx 2.000 eller 2000,50.' } : { value: v };
  }

  function confirmDialog(opts) {
    const dlg = document.getElementById('confirm-dialog');
    if (!dlg.showModal) return Promise.resolve(window.confirm(opts.title + '\n\n' + (opts.plain || '')));
    document.getElementById('confirm-title').textContent = opts.title;
    document.getElementById('confirm-text').innerHTML = opts.html;
    const ok = document.getElementById('confirm-ok');
    ok.textContent = opts.ok || 'OK';
    ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
    dlg.showModal();
    return new Promise((resolve) => {
      const done = (value) => {
        dlg.removeEventListener('close', onClose);
        ok.onclick = null;
        if (dlg.open) dlg.close();
        resolve(value);
      };
      const onClose = () => done(false);
      ok.onclick = () => done(true);
      dlg.addEventListener('close', onClose);
    });
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Tema ----------

  function effectiveTheme() {
    if (data.settings.theme !== 'system') return data.settings.theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme() {
    const root = document.documentElement;
    if (data.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', data.settings.theme);
    const dark = effectiveTheme() === 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0b1220' : '#f3f6f9');
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.innerHTML = icon(dark ? 'sun' : 'moon');
      btn.setAttribute('aria-label', dark ? 'Skift til lyst tema' : 'Skift til mørkt tema');
      btn.title = btn.getAttribute('aria-label');
    }
  }

  // Temaet sættes, før siden tegnes igen, så graferne får de rigtige farver.
  function setTheme(theme) {
    data.settings.theme = S.THEMES.includes(theme) ? theme : 'system';
    const res = S.saveData(data);
    if (!res.ok) toast(res.error, 'error');
    applyTheme();
    render();
  }

  // ---------- Fælles byggesten ----------

  function pageHead(title, text, actions) {
    return '<header class="page-head"><div><h1>' + title + '</h1>' + (text ? '<p>' + text + '</p>' : '') + '</div>' +
      (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</header>';
  }

  function kpi(label, value, sub, tone, iconName) {
    return '<article class="kpi kpi-' + tone + '">' +
      '<div class="kpi-top"><span class="kpi-label">' + label + '</span><span class="kpi-icon">' + icon(iconName) + '</span></div>' +
      '<p class="kpi-value">' + value + '</p>' +
      (sub ? '<p class="kpi-sub">' + sub + '</p>' : '') +
      '</article>';
  }

  function progressBar(fraction, label) {
    const p = Math.round(fraction * 1000) / 10;
    return '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '" aria-label="' + esc(label) + '">' +
      '<div class="progress-fill' + (fraction >= 1 ? ' done' : '') + '" style="width:' + Math.min(100, p) + '%"></div></div>';
  }

  function segmented(action, current, options, label) {
    return '<div class="segmented" role="group" aria-label="' + esc(label) + '">' +
      options.map(([value, text]) =>
        '<button type="button" data-action="' + action + '" data-value="' + value + '" aria-pressed="' + (String(current) === String(value)) + '">' + text + '</button>'
      ).join('') + '</div>';
  }

  function amountField(id, name, label, value, hint) {
    return '<label class="field" for="' + id + '"><span class="field-label">' + label + '</span>' +
      '<span class="input-affix"><input id="' + id + '" name="' + name + '" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(value || '') + '">' +
      '<span class="affix">' + CURRENCY_AFFIX[data.settings.currency] + '</span></span>' +
      (hint ? '<small class="hint">' + hint + '</small>' : '') +
      '<small class="field-error" data-error-for="' + name + '"></small></label>';
  }

  function banners() {
    const out = [];
    if (ui.storageWarning === 'unavailable') {
      out.push(banner('alert', 'warn', 'Browseren tillader ikke LocalStorage (fx i et privat vindue). Dine ændringer bliver ikke gemt, når siden lukkes.'));
    } else if (ui.storageWarning === 'damaged') {
      out.push(banner('alert', 'warn', 'De gemte data kunne ikke læses og er lagt til side som sikkerhedskopi. Har du en backupfil, kan du importere den under <a href="#/indstillinger">Indstillinger</a>.'));
    }
    if (data.transactions.length >= 3) {
      const last = data.settings.lastExport ? Date.parse(data.settings.lastExport) : null;
      const days = last ? Math.floor((Date.now() - last) / C.DAY_MS) : null;
      if (days === null || days > 30) {
        out.push(banner('download', 'info',
          (days === null ? 'Du har endnu ikke taget en backup.' : 'Det er ' + days + ' dage siden din sidste backup.') +
          ' Dine data findes kun i denne browser. <button type="button" class="link-btn" data-action="export-json">Download backup nu</button>'));
      }
    }
    return out.join('');
  }

  function banner(iconName, tone, html) {
    return '<div class="banner banner-' + tone + '">' + icon(iconName) + '<p>' + html + '</p></div>';
  }

  function rateSummary() {
    const comp = data.interest.compounding === 'yearly' ? 'tilskrives årligt' : 'tilskrives månedligt';
    if (model.rate <= 0) return 'Ingen rente indstillet · <a href="#/renter">Indstil rente</a>';
    return rateText(model.rate) + ' i årlig rente, ' + comp;
  }

  function goalDateText(short) {
    const g = model.goalDate;
    if (!model.goal) return { value: '—', sub: '<a href="#/maal">Sæt et opsparingsmål</a>' };
    if (g.reached) return { value: 'Nået', sub: 'Du har nået dit mål' };
    if (!g.day) {
      return { value: 'Ikke med nuværende plan', sub: data.plan.monthlyAmount ? 'Hæv den månedlige opsparing' : '<a href="#/maal">Indstil en fast månedlig opsparing</a>' };
    }
    return { value: fmtDay(g.day, short ? 'monthYear' : 'long'), sub: durationText(model.ledger.todayDay, g.day) };
  }

  // ---------- Side: Oversigt ----------

  function viewOverview() {
    const L = model.ledger;
    const hasTx = data.transactions.length > 0;
    const gd = goalDateText(true);
    const goalBlock = model.goal
      ? '<div class="hero-goal">' +
          '<div class="hero-goal-head"><span>' + icon('target') + esc(data.goal.name || 'Opsparingsmål') + '</span><strong>' + pct(model.progress) + '</strong></div>' +
          progressBar(model.progress, 'Målopnåelse') +
          '<div class="hero-goal-foot"><span>' + money(L.balance) + ' af ' + money(model.goal) + '</span><span>' +
          (model.missing ? 'Mangler ' + money(model.missing) : 'Målet er nået') + '</span></div>' +
        '</div>'
      : '<div class="hero-goal hero-goal-empty">' + icon('target') + '<div><strong>Intet opsparingsmål endnu</strong><p>Sæt et mål og se, hvor langt du er, og hvornår du når det.</p></div><a class="btn btn-soft" href="#/maal">Sæt mål</a></div>';

    const hero =
      '<section class="hero card">' +
        '<div class="hero-main">' +
          '<p class="eyebrow">Nuværende opsparing</p>' +
          '<p class="hero-amount">' + money(L.balance) + '</p>' +
          '<p class="hero-sub">' + rateSummary() + '</p>' +
          '<div class="hero-actions">' +
            '<button type="button" class="btn btn-primary" data-action="focus" data-target="dep-amount">' + icon('plus') + 'Tilføj penge</button>' +
            '<button type="button" class="btn btn-soft" data-action="focus" data-target="wd-amount">' + icon('minus') + 'Hæv penge</button>' +
          '</div>' +
        '</div>' + goalBlock +
      '</section>';

    const welcome = hasTx ? '' :
      '<section class="card welcome">' + icon('spark', 'welcome-icon') +
        '<div><h2>Velkommen til GrejsOpsparing</h2><p>Start med at registrere den første indbetaling nedenfor. Vil du først se, hvordan det hele virker, kan du indlæse eksempeldata og nulstille bagefter.</p></div>' +
        '<button type="button" class="btn btn-soft" data-action="demo">Indlæs eksempeldata</button>' +
      '</section>';

    const kpis =
      '<section class="kpi-grid">' +
        kpi('Indbetalt i alt', money(L.totalDeposits), L.depositCount + (L.depositCount === 1 ? ' indbetaling' : ' indbetalinger'), 'deposit', 'up') +
        kpi('Hævet i alt', money(L.totalWithdrawals), L.withdrawalCount + (L.withdrawalCount === 1 ? ' hævning' : ' hævninger'), 'withdrawal', 'down') +
        kpi('Optjente renter', money(L.interestEarned), L.accrued >= 1 ? '+ ' + money(L.accrued) + ' påløbet, ikke tilskrevet' : 'Tilskrevet til kontoen', 'interest', 'percent') +
        kpi('Mangler til målet', model.goal ? money(model.missing) : '—', model.goal ? pct(model.progress) + ' af målet er nået' : '<a href="#/maal">Intet mål sat</a>', 'goal', 'target') +
        kpi('Forventet målopnåelse', gd.value, gd.sub, 'neutral', 'flag') +
      '</section>';

    const today = model.today;
    const depositForm =
      '<form class="card form-card" data-form="deposit" novalidate>' +
        '<div class="card-head"><span class="icon-badge tone-deposit">' + icon('plus') + '</span><div><h2>Tilføj penge</h2><p>Registrér en indbetaling til opsparingen</p></div></div>' +
        amountField('dep-amount', 'amount', 'Beløb') +
        '<label class="field" for="dep-desc"><span class="field-label">Beskrivelse <em>valgfri</em></span><input id="dep-desc" name="description" maxlength="' + S.MAX_DESCRIPTION + '" placeholder="Fx Løn, Fødselsdag, Ekstra opsparing" autocomplete="off"></label>' +
        '<div class="chips">' + ['Løn', 'Fødselsdag', 'Ekstra opsparing', 'Gave'].map((t) => '<button type="button" class="chip" data-action="fill" data-target="dep-desc" data-value="' + t + '">' + t + '</button>').join('') + '</div>' +
        '<label class="field" for="dep-date"><span class="field-label">Dato</span><input id="dep-date" type="date" name="date" value="' + today + '" max="' + today + '"><small class="hint">Dagens dato er valgt automatisk. Du kan ændre den, hvis indbetalingen skete tidligere.</small><small class="field-error" data-error-for="date"></small></label>' +
        '<button class="btn btn-primary btn-block">' + icon('plus') + 'Tilføj indbetaling</button>' +
      '</form>';

    const withdrawForm =
      '<form class="card form-card" data-form="withdrawal" novalidate>' +
        '<div class="card-head"><span class="icon-badge tone-withdrawal">' + icon('minus') + '</span><div><h2>Fjern penge</h2><p>Til rådighed: <strong>' + money(L.balance) + '</strong></p></div></div>' +
        amountField('wd-amount', 'amount', 'Beløb') +
        '<label class="field" for="wd-desc"><span class="field-label">Beskrivelse <em>valgfri</em></span><input id="wd-desc" name="description" maxlength="' + S.MAX_DESCRIPTION + '" placeholder="Fx Bilreparation, Køb, Ferie" autocomplete="off"></label>' +
        '<div class="chips">' + ['Bilreparation', 'Køb', 'Ferie', 'Regning'].map((t) => '<button type="button" class="chip" data-action="fill" data-target="wd-desc" data-value="' + t + '">' + t + '</button>').join('') +
          (L.balance > 0 ? '<button type="button" class="chip chip-outline" data-action="withdraw-all">Hæv alt</button>' : '') + '</div>' +
        '<label class="field" for="wd-date"><span class="field-label">Dato</span><input id="wd-date" type="date" name="date" value="' + today + '" max="' + today + '"><small class="hint">Dagens dato er valgt automatisk.</small><small class="field-error" data-error-for="date"></small></label>' +
        '<button class="btn btn-danger-soft btn-block"' + (L.balance > 0 ? '' : ' disabled') + '>' + icon('minus') + 'Hæv beløb</button>' +
      '</form>';

    const monthly = data.plan.monthlyAmount;
    const forecastCard =
      '<section class="card">' +
        '<div class="card-title-row"><h2>Prognose</h2><a class="link" href="#/maal">Ret plan</a></div>' +
        '<p class="muted small">' + (monthly
          ? 'Med fast opsparing på <strong>' + money(monthly) + '</strong> om måneden og ' + (model.rate > 0 ? rateText(model.rate) + ' i rente.' : 'uden rente.')
          : 'Uden fast månedlig opsparing – kun ' + (model.rate > 0 ? 'renterne får saldoen til at vokse.' : 'den nuværende saldo.') + ' <a href="#/maal">Indstil en plan</a>.') + '</p>' +
        '<div class="forecast-list">' +
          model.snapshots.map((s) =>
            '<div class="forecast-item"><span class="forecast-label">Om ' + s.months + ' måneder<small>' + fmtDay(s.day) + '</small></span>' +
            '<span class="forecast-value">' + money(s.balance) + '<small>' + (s.interest ? 'heraf ' + money(s.interest) + ' i nye renter' : 'ingen nye renter') + '</small></span></div>'
          ).join('') +
        '</div>' +
        '<p class="muted tiny">Prognosen er et skøn og ændrer ikke din faktiske saldo.</p>' +
      '</section>';

    const recentRows = L.rows.slice().sort((a, b) => b.seq - a.seq).slice(0, 6);
    const recent =
      '<section class="card">' +
        '<div class="card-title-row"><h2>Seneste bevægelser</h2><a class="link" href="#/transaktioner">Se alle</a></div>' +
        (recentRows.length
          ? '<ul class="recent-list">' + recentRows.map(recentItem).join('') + '</ul>'
          : '<p class="empty">Ingen bevægelser endnu.</p>') +
      '</section>';

    return banners() + hero + welcome + kpis +
      '<section class="grid-2">' + depositForm + withdrawForm + '</section>' +
      '<section class="grid-2">' + forecastCard + recent + '</section>';
  }

  const TYPE_ICON = { deposit: 'up', withdrawal: 'down', interest: 'percent' };

  function signedMoney(r) {
    return (r.type === 'withdrawal' ? '−' : '+') + money(r.amount);
  }

  function recentItem(r) {
    return '<li><span class="icon-badge small tone-' + r.type + '">' + icon(TYPE_ICON[r.type]) + '</span>' +
      '<span class="recent-text"><strong>' + esc(r.description || S.TYPE_LABELS[r.type]) + '</strong><small>' + fmtDate(r.date) + ' · ' + S.TYPE_LABELS[r.type] + '</small></span>' +
      '<span class="recent-amount amount-' + r.type + '">' + signedMoney(r) + '<small>Saldo ' + money(r.balanceAfter) + '</small></span></li>';
  }

  // ---------- Side: Transaktioner ----------

  function filteredRows() {
    const f = ui.filter;
    const q = f.q.trim().toLowerCase();
    return model.ledger.rows
      .filter((r) => (f.type === 'all' || r.type === f.type) &&
        (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) &&
        (!q || (r.description || '').toLowerCase().includes(q) || S.TYPE_LABELS[r.type].toLowerCase().includes(q)))
      .sort((a, b) => b.seq - a.seq);
  }

  function viewTransactions() {
    const f = ui.filter;
    return pageHead('Transaktioner', 'Alle bevægelser på opsparingen. Renter tilskrives automatisk og kan ikke rettes.',
      '<button type="button" class="btn btn-soft" data-action="export-csv-filtered">' + icon('download') + 'Eksportér CSV</button>') +
      '<section class="card filter-bar">' +
        segmented('filter-type', f.type, [['all', 'Alle'], ['deposit', 'Indbetalinger'], ['withdrawal', 'Hævninger'], ['interest', 'Renter']], 'Type') +
        '<div class="filter-fields">' +
          '<label class="field compact"><span class="field-label">Fra dato</span><input type="date" data-filter="from" value="' + esc(f.from) + '"></label>' +
          '<label class="field compact"><span class="field-label">Til dato</span><input type="date" data-filter="to" value="' + esc(f.to) + '"></label>' +
          '<label class="field compact grow"><span class="field-label">Søg</span><input type="search" data-filter="q" value="' + esc(f.q) + '" placeholder="Søg i beskrivelser"></label>' +
          '<button type="button" class="btn btn-ghost" data-action="filter-reset">Nulstil filter</button>' +
        '</div>' +
      '</section>' +
      '<div id="tx-list">' + txList() + '</div>';
  }

  function txList() {
    const rows = filteredRows();
    let dep = 0;
    let wd = 0;
    let int = 0;
    for (const r of rows) {
      if (r.type === 'deposit') dep += r.amount;
      else if (r.type === 'withdrawal') wd += r.amount;
      else int += r.amount;
    }
    const summary =
      '<div class="summary-strip">' +
        '<span><strong>' + rows.length + '</strong> ' + (rows.length === 1 ? 'bevægelse' : 'bevægelser') + '</span>' +
        '<span class="amount-deposit">Ind: ' + money(dep) + '</span>' +
        '<span class="amount-withdrawal">Ud: ' + money(wd) + '</span>' +
        '<span class="amount-interest">Renter: ' + money(int) + '</span>' +
      '</div>';
    if (!rows.length) {
      return summary + '<section class="card"><p class="empty">' + (data.transactions.length ? 'Ingen bevægelser passer til filteret.' : 'Der er ingen bevægelser endnu. <a href="#/oversigt">Tilføj den første indbetaling</a>.') + '</p></section>';
    }
    return summary +
      '<section class="card table-card"><table class="tx-table">' +
        '<thead><tr><th>Dato</th><th>Type</th><th>Beskrivelse</th><th class="num">Beløb</th><th class="num">Saldo efter</th><th><span class="sr-only">Handlinger</span></th></tr></thead>' +
        '<tbody>' + rows.map((r) =>
          '<tr>' +
            '<td data-label="Dato">' + fmtDate(r.date) + '</td>' +
            '<td data-label="Type"><span class="badge badge-' + r.type + '">' + S.TYPE_LABELS[r.type] + '</span></td>' +
            '<td data-label="Beskrivelse" class="desc">' + (r.description ? esc(r.description) : '<span class="muted">—</span>') + '</td>' +
            '<td data-label="Beløb" class="num amount-' + r.type + '">' + signedMoney(r) + '</td>' +
            '<td data-label="Saldo efter" class="num">' + money(r.balanceAfter) + '</td>' +
            '<td class="row-actions">' + (r.kind === 'tx'
              ? '<button type="button" class="icon-btn" data-action="edit-tx" data-id="' + esc(r.id) + '" aria-label="Ret transaktion" title="Ret">' + icon('edit') + '</button>' +
                '<button type="button" class="icon-btn danger" data-action="delete-tx" data-id="' + esc(r.id) + '" aria-label="Slet transaktion" title="Slet">' + icon('trash') + '</button>'
              : '<span class="muted tiny">Automatisk</span>') + '</td>' +
          '</tr>').join('') + '</tbody>' +
      '</table></section>';
  }

  // ---------- Side: Renter ----------

  function viewInterest() {
    const L = model.ledger;
    const I = data.interest;
    const monthly = data.plan.monthlyAmount;
    const eff = C.effectiveAnnualRate(model.rate, I.compounding);
    const startText = I.startDate ? fmtDate(I.startDate, 'long') : (L.firstTxDay !== null ? fmtDay(L.firstTxDay, 'long') + ' (første indbetaling)' : 'første indbetaling');
    const changes = I.rates.filter((r) => r.from);

    const settingsForm =
      '<form class="card form-card" data-form="interest" novalidate>' +
        '<div class="card-head"><span class="icon-badge tone-interest">' + icon('percent') + '</span><div><h2>Renteindstillinger</h2><p>Bruges til både optjente og forventede renter</p></div></div>' +
        '<label class="field" for="int-rate"><span class="field-label">Årlig rente</span><span class="input-affix"><input id="int-rate" name="rate" inputmode="decimal" autocomplete="off" value="' + rateInput(model.rate) + '"><span class="affix">%</span></span>' +
          (changes.length ? '<small class="hint">Retter den rente, der gælder i dag. Brug renteændringer for at skifte rente fra en bestemt dato.</small>' : '') +
          '<small class="field-error" data-error-for="rate"></small></label>' +
        '<label class="field" for="int-comp"><span class="field-label">Rentetilskrivning</span><select id="int-comp" name="compounding">' +
          '<option value="monthly"' + (I.compounding === 'monthly' ? ' selected' : '') + '>Månedligt (sidste dag i måneden)</option>' +
          '<option value="yearly"' + (I.compounding === 'yearly' ? ' selected' : '') + '>Årligt (31. december)</option>' +
        '</select></label>' +
        '<label class="field" for="int-start"><span class="field-label">Startdato for renteberegning <em>valgfri</em></span><input id="int-start" type="date" name="startDate" value="' + esc(I.startDate || '') + '">' +
          '<small class="hint">Lad feltet stå tomt for at beregne renter fra første indbetaling.</small><small class="field-error" data-error-for="startDate"></small></label>' +
        '<button class="btn btn-primary btn-block">Gem renteindstillinger</button>' +
      '</form>';

    const changesCard =
      '<section class="card form-card">' +
        '<div class="card-head"><span class="icon-badge tone-neutral">' + icon('calendar') + '</span><div><h2>Renteændringer</h2><p>Har banken ændret renten undervejs? Tilføj den nye rente fra den dato, den gælder.</p></div></div>' +
        '<ul class="rate-list">' +
          I.rates.map((r) => '<li><span>' + (r.from ? 'Fra ' + fmtDate(r.from, 'long') : 'Fra ' + esc(startText)) + '</span><strong>' + rateText(r.rate) + '</strong>' +
            (r.from ? '<button type="button" class="icon-btn danger" data-action="delete-rate" data-from="' + r.from + '" aria-label="Slet renteændring" title="Slet">' + icon('trash') + '</button>' : '<span class="icon-btn-spacer"></span>') + '</li>').join('') +
        '</ul>' +
        '<form class="inline-form" data-form="rate-change" novalidate>' +
          '<label class="field compact"><span class="field-label">Ny rente</span><span class="input-affix"><input name="rate" inputmode="decimal" autocomplete="off" placeholder="2,5"><span class="affix">%</span></span><small class="field-error" data-error-for="rate"></small></label>' +
          '<label class="field compact"><span class="field-label">Gælder fra</span><input type="date" name="from" value="' + model.today + '"><small class="field-error" data-error-for="from"></small></label>' +
          '<button class="btn btn-soft">' + icon('plus') + 'Tilføj</button>' +
        '</form>' +
      '</section>';

    const in12 = model.at(12);
    const nextText = model.interestStarted
      ? fmtDay(model.nextCreditDay, 'long')
      : 'Renten starter ' + fmtDay(L.interestFromDay, 'long');
    const kpis =
      '<section class="kpi-grid">' +
        kpi('Optjente renter', money(L.interestEarned), 'Tilskrevet til kontoen indtil i dag', 'interest', 'percent') +
        kpi('Påløbne renter', money(L.accrued), 'Optjent, men endnu ikke tilskrevet', 'interest', 'clock') +
        kpi('Næste rentetilskrivning', model.nextCreditAmount ? '≈ ' + money(model.nextCreditAmount) : money(0), nextText, 'neutral', 'calendar') +
        kpi('Forventede renter, 12 mdr.', money(in12.interest), monthly ? 'Med ' + money(monthly) + ' om måneden' : 'Uden faste indbetalinger', 'goal', 'chart') +
        kpi('Effektiv årlig rente', rateText(eff), I.compounding === 'monthly' ? 'Renters rente ved månedlig tilskrivning' : 'Årlig tilskrivning', 'neutral', 'spark') +
      '</section>';

    const horizons = [[3, '3 måneder'], [6, '6 måneder'], [12, '1 år'], [36, '3 år'], [60, '5 år'], [120, '10 år']];
    const table =
      '<section class="card">' +
        '<div class="card-title-row"><h2>Forventede renter fremover</h2><a class="link" href="#/maal">Ret månedlig opsparing</a></div>' +
        '<p class="muted small">Fra i dag med nuværende saldo' + (monthly ? ', ' + money(monthly) + ' indbetalt den ' + data.plan.dayOfMonth + '. hver måned' : ' og ingen faste indbetalinger') + ' og ' + rateText(model.rate) + ' i rente.</p>' +
        '<div class="table-scroll"><table class="simple-table"><thead><tr><th>Periode</th><th class="num">Forventet saldo</th><th class="num">Nye indbetalinger</th><th class="num">Forventede renter</th></tr></thead><tbody>' +
          horizons.map(([m, label]) => { const s = model.at(m); return '<tr><td>' + label + '<small class="muted block">' + fmtDay(s.day) + '</small></td><td class="num strong">' + money(s.balance) + '</td><td class="num">' + money(s.deposits) + '</td><td class="num amount-interest">' + money(s.interest) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' +
      '</section>';

    const assumptions =
      '<section class="card">' +
        '<h2>' + icon('info') + 'Sådan regnes renten</h2>' +
        '<ul class="assumptions">' +
          '<li>Renten beregnes <strong>dagligt</strong> af saldoen ved dagens slutning: saldo × årlig rente ÷ 365.</li>' +
          '<li>Indbetalinger giver rente fra og med den dag, de er registreret. Hævninger stopper renten på beløbet fra samme dag.</li>' +
          '<li>Den beregnede rente samles op som <strong>påløbne renter</strong> og tilskrives ' + (I.compounding === 'yearly' ? 'den 31. december' : 'på sidste dag i hver måned') + '. Først da indgår den i saldoen og giver selv rente.</li>' +
          '<li>Tilskrevne renter afrundes til hele øre og vises som automatiske rækker i transaktionshistorikken.</li>' +
          '<li>Renten regnes fra ' + esc(startText) + '. Renteændringer gælder fra den angivne dato og frem.</li>' +
          '<li>Prognosen antager, at den nuværende rente fortsætter, og at den faste månedlige opsparing indbetales hver måned. Der regnes ikke med skat af renter, gebyrer eller negative renter.</li>' +
        '</ul>' +
      '</section>';

    const credits = L.credits.slice().reverse();
    const history =
      '<section class="card">' +
        '<h2>Tilskrevne renter</h2>' +
        (credits.length
          ? '<div class="table-scroll capped"><table class="simple-table"><thead><tr><th>Dato</th><th class="num">Rente</th><th class="num">Saldo efter</th></tr></thead><tbody>' +
            credits.map((c) => '<tr><td>' + fmtDate(c.date, 'long') + '</td><td class="num amount-interest">+' + money(c.amount) + '</td><td class="num">' + money(c.balanceAfter) + '</td></tr>').join('') +
            '</tbody></table></div>'
          : '<p class="empty">Der er endnu ikke tilskrevet renter.' + (model.rate > 0 ? ' Første tilskrivning sker ' + fmtDay(model.nextCreditDay, 'long') + '.' : ' Indstil en rente ovenfor.') + '</p>') +
      '</section>';

    return pageHead('Renter', 'Indstil renten og se, hvad du har tjent, og hvad du kan forvente at tjene.') +
      '<section class="grid-2">' + settingsForm + changesCard + '</section>' + kpis + table +
      '<section class="grid-2">' + assumptions + history + '</section>';
  }

  // ---------- Side: Mål & plan ----------

  function viewGoal() {
    const L = model.ledger;
    const goal = data.goal;
    const plan = data.plan;

    const top = model.goal
      ? '<section class="card goal-hero">' +
          '<div class="goal-hero-head"><div><p class="eyebrow">' + icon('target') + 'Dit mål</p><h2>' + esc(goal.name || 'Opsparingsmål') + '</h2>' +
            (goal.targetDate ? '<p class="muted">Ønsket slutdato: ' + fmtDate(goal.targetDate, 'long') + '</p>' : '') + '</div>' +
            '<p class="goal-percent">' + pct(model.progress) + '</p></div>' +
          progressBar(model.progress, 'Målopnåelse') +
          '<div class="goal-stats">' +
            '<div><span>Nuværende opsparing</span><strong>' + money(L.balance) + '</strong></div>' +
            '<div><span>Mål</span><strong>' + money(model.goal) + '</strong></div>' +
            '<div><span>Mangler</span><strong>' + money(model.missing) + '</strong></div>' +
            '<div><span>Forventet nået</span><strong>' + goalDateText(false).value + '</strong></div>' +
          '</div>' +
        '</section>'
      : '<section class="card welcome">' + icon('target', 'welcome-icon') + '<div><h2>Sæt dit opsparingsmål</h2><p>Skriv, hvad du sparer op til, og hvor meget du skal bruge. Så viser GrejsOpsparing, hvor langt du er, og hvad du skal spare op hver måned.</p></div></section>';

    const goalForm =
      '<form class="card form-card" data-form="goal" novalidate>' +
        '<div class="card-head"><span class="icon-badge tone-goal">' + icon('target') + '</span><div><h2>Opsparingsmål</h2><p>Ret dit mål når som helst</p></div></div>' +
        '<label class="field" for="goal-name"><span class="field-label">Hvad sparer du op til? <em>valgfri</em></span><input id="goal-name" name="name" maxlength="60" value="' + esc(goal.name) + '" placeholder="Fx Ny bil, Ferie, Buffer"></label>' +
        amountField('goal-amount', 'amount', 'Mål', amountInput(goal.amount)) +
        '<label class="field" for="goal-date"><span class="field-label">Ønsket slutdato <em>valgfri</em></span><input id="goal-date" type="date" name="targetDate" min="' + C.dayToKey(model.ledger.todayDay + 1) + '" value="' + esc(goal.targetDate || '') + '"><small class="field-error" data-error-for="targetDate"></small></label>' +
        '<div class="btn-row"><button class="btn btn-primary">Gem mål</button>' + (model.goal ? '<button type="button" class="btn btn-ghost" data-action="remove-goal">Fjern mål</button>' : '') + '</div>' +
      '</form>';

    const days = [];
    for (let d = 1; d <= 31; d++) days.push('<option value="' + d + '"' + (plan.dayOfMonth === d ? ' selected' : '') + '>Den ' + d + '.' + (d > 28 ? ' (sidste dag i korte måneder)' : '') + '</option>');
    const planForm =
      '<form class="card form-card" data-form="plan" novalidate>' +
        '<div class="card-head"><span class="icon-badge tone-deposit">' + icon('calendar') + '</span><div><h2>Fast månedlig opsparing</h2><p>Bruges kun til prognoser</p></div></div>' +
        amountField('plan-amount', 'amount', 'Beløb pr. måned', amountInput(plan.monthlyAmount), 'Skriv 0 eller lad feltet stå tomt, hvis du ikke har en fast opsparing.') +
        '<label class="field" for="plan-day"><span class="field-label">Indbetales</span><select id="plan-day" name="dayOfMonth">' + days.join('') + '</select></label>' +
        '<p class="note">' + icon('info') + 'Planen er en prognose og ændrer ikke din saldo. Kun de indbetalinger, du selv registrerer, ændrer den faktiske opsparing.</p>' +
        '<button class="btn btn-primary btn-block">Gem plan</button>' +
      '</form>';

    return pageHead('Mål & plan', 'Følg dit mål, og se hvad der skal til for at nå det.') +
      top + '<section class="grid-2">' + goalForm + planForm + '</section>' + planResults();
  }

  function planResults() {
    const L = model.ledger;
    const plan = data.plan;
    const parts = [];

    if (model.goal) {
      const g = model.goalDate;
      let reach;
      if (g.reached) {
        reach = '<p class="big-line">' + icon('check') + 'Du har allerede nået dit mål.</p>';
      } else if (g.day) {
        reach = '<p class="big-line">Med din plan når du målet <strong>' + fmtDay(g.day, 'long') + '</strong> (' + durationText(L.todayDay, g.day) + ').</p>' +
          '<p class="muted">Indtil da indbetaler du ' + money(g.deposits) + ' og tjener ca. ' + money(g.interest) + ' i renter.</p>';
      } else {
        reach = '<p class="big-line">Med den nuværende plan og rente når du ikke målet.</p><p class="muted">' +
          (plan.monthlyAmount ? 'Prøv at hæve den månedlige opsparing.' : 'Indstil en fast månedlig opsparing for at få en forventet dato.') + '</p>';
      }

      let need = '';
      const r = model.required;
      if (r) {
        const target = fmtDate(data.goal.targetDate, 'long');
        if (r.status === 'past') need = '<p class="warn-line">' + icon('alert') + 'Den ønskede slutdato ' + target + ' er passeret. Vælg en ny dato.</p>';
        else if (r.status === 'interest-only') need = '<p>Renterne alene får dig i mål inden ' + target + ' – du behøver ikke at spare mere op.</p>';
        else if (r.status === 'no-deposits') need = '<p class="warn-line">' + icon('alert') + 'Der er ingen indbetalingsdage før ' + target + '. Du mangler ' + money(r.missing) + ', som skal sættes ind på én gang.</p>';
        else if (r.status === 'ok') {
          const diff = plan.monthlyAmount - r.monthly;
          need = '<div class="need-box"><span>For at nå målet ' + target + ' skal du spare ca.</span><strong>' + money(r.monthly) + ' om måneden</strong>' +
            '<span class="muted small">' + r.deposits + ' indbetalinger · uden renter ville det være ' + money(r.withoutInterest) + ' om måneden</span>' +
            (plan.monthlyAmount ? '<span class="pill ' + (diff >= 0 ? 'pill-good' : 'pill-bad') + '">' + (diff >= 0 ? 'Din plan er ' + money(diff) + ' over det nødvendige' : 'Din plan mangler ' + money(-diff) + ' om måneden') + '</span>' : '') +
          '</div>';
        }
      } else if (!g.reached) {
        need = '<p class="muted">Angiv en ønsket slutdato for at se, hvor meget du skal spare op hver måned.</p>';
      }
      parts.push('<section class="card"><h2>Sådan når du målet</h2>' + reach + need + '</section>');
    }

    parts.push(
      '<section class="kpi-grid kpi-grid-4">' +
        model.snapshots.map((s) => kpi('Om ' + s.months + ' måneder', money(s.balance), fmtDay(s.day, 'long') + (s.interest ? ' · heraf ' + money(s.interest) + ' i renter' : ''), 'deposit', 'chart')).join('') +
        kpi('Om 3 år', money(model.at(36).balance), fmtDay(model.at(36).day, 'long'), 'interest', 'chart') +
      '</section>');
    return parts.join('');
  }

  // ---------- Side: Grafer ----------

  function periodStartDay() {
    const t = model.ledger.todayDay;
    if (ui.period === '1m') return C.addMonths(t, -1);
    if (ui.period === '6m') return C.addMonths(t, -6);
    if (ui.period === '1y') return C.addMonths(t, -12);
    return model.ledger.firstTxDay !== null ? model.ledger.firstTxDay : t;
  }

  function viewCharts() {
    const L = model.ledger;
    const start = periodStartDay();
    const flows = C.aggregateFlows(L.rows, start, L.todayDay, 'day');
    let dep = 0;
    let wd = 0;
    let int = 0;
    for (const f of flows) { dep += f.deposits; wd += f.withdrawals; int += f.interest; }
    const before = L.series.filter((s) => s.day < start);
    const startBalance = before.length ? before[before.length - 1].balance : 0;
    const change = L.balance - startBalance;

    return pageHead('Grafer og statistik', 'Se udviklingen i din opsparing.',
      segmented('period', ui.period, [['1m', '1 md.'], ['6m', '6 mdr.'], ['1y', '1 år'], ['all', 'Alle data']], 'Periode')) +
      '<section class="kpi-grid kpi-grid-4">' +
        kpi('Ændring i perioden', (change >= 0 ? '+' : '−') + money(Math.abs(change)), 'Fra ' + money(startBalance) + ' til ' + money(L.balance), change >= 0 ? 'deposit' : 'withdrawal', 'chart') +
        kpi('Indbetalt i perioden', money(dep), '', 'deposit', 'up') +
        kpi('Hævet i perioden', money(wd), '', 'withdrawal', 'down') +
        kpi('Renter i perioden', money(int), '', 'interest', 'percent') +
      '</section>' +
      '<section class="chart-grid">' +
        '<article class="card chart-card wide"><h2>Opsparingens udvikling</h2><div class="chart-box"><canvas id="chart-balance" aria-label="Graf over saldoens udvikling" role="img"></canvas></div></article>' +
        '<article class="card chart-card"><h2>Indbetalinger og hævninger ' + (ui.period === '1m' ? 'pr. dag' : 'pr. måned') + '</h2><div class="chart-box"><canvas id="chart-flows" aria-label="Søjlediagram over indbetalinger, hævninger og renter" role="img"></canvas></div></article>' +
        '<article class="card chart-card"><h2>Egne indbetalinger og renter</h2><p class="muted small">Hvad din nuværende saldo består af</p><div class="chart-box small"><canvas id="chart-composition" aria-label="Fordeling mellem egne penge og renter" role="img"></canvas></div></article>' +
        '<article class="card chart-card wide"><div class="card-title-row"><h2>Prognose for den fremtidige opsparing</h2>' +
          segmented('horizon', ui.horizon, [[1, '1 år'], [3, '3 år'], [5, '5 år'], [10, '10 år']], 'Prognosens længde') + '</div>' +
          '<p class="muted small">' + (data.plan.monthlyAmount ? money(data.plan.monthlyAmount) + ' om måneden' : 'Ingen fast månedlig opsparing') + ' og ' + rateText(model.rate) + ' i rente.</p>' +
          '<div class="chart-box"><canvas id="chart-forecast" aria-label="Prognose for opsparingen" role="img"></canvas></div></article>' +
      '</section>';
  }

  function drawCharts() {
    const L = model.ledger;
    const start = periodStartDay();
    const longSpan = L.todayDay - start > 400;

    // Saldo: én værdi pr. dag, tyndet ud til højst ca. 370 punkter.
    let series = L.series.filter((s) => s.day >= start);
    if (series.length > 370) {
      const step = Math.ceil(series.length / 370);
      series = series.filter((s, i) => i % step === 0 || i === series.length - 1);
    }
    G.balance('chart-balance', {
      labels: series.map((s) => fmtDay(s.day, longSpan ? 'monthYear' : 'dayMonth')),
      values: series.map((s) => s.balance / 100),
    }, moneyKr, moneyAxis);

    const gran = ui.period === '1m' ? 'day' : 'month';
    const flows = C.aggregateFlows(L.rows, start, L.todayDay, gran);
    G.flows('chart-flows', {
      labels: flows.map((f) => gran === 'day' ? fmtDate(f.key, 'dayMonth') : fmtDate(f.key + '-01', 'monthYear')),
      deposits: flows.map((f) => f.deposits / 100),
      withdrawals: flows.map((f) => f.withdrawals / 100),
      interest: flows.map((f) => f.interest / 100),
    }, moneyKr, moneyAxis);

    const interest = Math.min(L.interestEarned, L.balance);
    G.composition('chart-composition', { own: Math.max(0, L.balance - interest) / 100, interest: Math.max(0, interest) / 100 }, moneyKr);

    const months = ui.horizon * 12;
    const labels = [];
    const withI = [];
    const withoutI = [];
    for (let n = 0; n <= months; n++) {
      const day = C.addMonths(L.todayDay, n);
      const p = C.projectionAt(model.projection, L, day);
      labels.push(fmtDay(day, 'monthYear'));
      withI.push(p.balance / 100);
      withoutI.push((L.balance + p.deposits) / 100);
    }
    G.forecast('chart-forecast', { labels, withInterest: withI, withoutInterest: withoutI, goal: model.goal / 100 }, moneyKr, moneyAxis);
  }

  // ---------- Side: Indstillinger ----------

  function viewSettings() {
    const L = model.ledger;
    const last = data.settings.lastExport;
    const canShare = !!(navigator.canShare && window.File && (() => {
      try { return navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }); } catch (e) { return false; }
    })());

    const general =
      '<section class="card form-card">' +
        '<div class="card-head"><span class="icon-badge tone-neutral">' + icon('spark') + '</span><div><h2>Generelt</h2><p>Udseende og valuta</p></div></div>' +
        '<div class="field"><span class="field-label">Tema</span>' + segmented('theme', data.settings.theme, [['system', 'Følg enheden'], ['light', 'Lyst'], ['dark', 'Mørkt']], 'Tema') + '</div>' +
        '<label class="field" for="set-currency"><span class="field-label">Valuta</span><select id="set-currency" data-setting="currency">' +
          S.CURRENCIES.map((c) => '<option value="' + c + '"' + (data.settings.currency === c ? ' selected' : '') + '>' + CURRENCY_NAMES[c] + '</option>').join('') +
        '</select><small class="hint">Ændrer kun, hvordan beløb vises. Beløbene omregnes ikke.</small></label>' +
      '</section>';

    const savings =
      '<form class="card form-card" data-form="quick-settings" novalidate>' +
        '<div class="card-head"><span class="icon-badge tone-deposit">' + icon('wallet') + '</span><div><h2>Opsparing</h2><p>Rente, mål og månedlig opsparing samlet ét sted</p></div></div>' +
        '<div class="field-grid">' +
          '<label class="field" for="qs-rate"><span class="field-label">Årlig rente</span><span class="input-affix"><input id="qs-rate" name="rate" inputmode="decimal" value="' + rateInput(model.rate) + '"><span class="affix">%</span></span><small class="field-error" data-error-for="rate"></small></label>' +
          '<label class="field" for="qs-comp"><span class="field-label">Rentetilskrivning</span><select id="qs-comp" name="compounding">' +
            '<option value="monthly"' + (data.interest.compounding === 'monthly' ? ' selected' : '') + '>Månedligt</option>' +
            '<option value="yearly"' + (data.interest.compounding === 'yearly' ? ' selected' : '') + '>Årligt</option></select></label>' +
          amountField('qs-goal', 'goal', 'Opsparingsmål', amountInput(data.goal.amount)) +
          amountField('qs-monthly', 'monthly', 'Månedlig opsparing', amountInput(data.plan.monthlyAmount)) +
        '</div>' +
        '<button class="btn btn-primary">Gem indstillinger</button>' +
      '</form>';

    const backup =
      '<section class="card backup">' +
        '<div class="card-head"><span class="icon-badge tone-interest">' + icon('share') + '</span><div><h2>Backup og gendannelse</h2><p>Flyt din opsparing til en anden computer eller mobil</p></div></div>' +
        '<ol class="steps">' +
          '<li><strong>Eksportér</strong> på den enhed, hvor dine data er. Du får en lille JSON-fil.</li>' +
          '<li><strong>Flyt filen</strong> til den nye enhed – fx med e-mail, USB, OneDrive, AirDrop eller Google Drev.</li>' +
          '<li><strong>Importér</strong> filen på den nye enhed. Alt bliver genskabt: transaktioner, renter, mål og indstillinger.</li>' +
        '</ol>' +
        '<div class="backup-grid">' +
          '<div class="backup-box">' +
            '<h3>' + icon('download') + 'Eksportér opsparing</h3>' +
            '<p class="muted small">' + data.transactions.length + ' transaktioner · saldo ' + money(L.balance) + '<br>Sidste backup: ' + (last ? fmtDay(Math.floor(Date.parse(last) / C.DAY_MS), 'long') : 'aldrig') + '</p>' +
            '<div class="btn-row"><button type="button" class="btn btn-primary" data-action="export-json">' + icon('download') + 'Download JSON-fil</button>' +
            (canShare ? '<button type="button" class="btn btn-soft" data-action="share-json">' + icon('share') + 'Del fil</button>' : '') + '</div>' +
          '</div>' +
          '<div class="backup-box">' +
            '<h3>' + icon('upload') + 'Importér opsparing</h3>' +
            '<p class="muted small">Vælg en JSON-fil, der er eksporteret fra GrejsOpsparing. Filen kontrolleres, før noget bliver overskrevet.</p>' +
            '<label class="btn btn-soft file-btn">' + icon('upload') + 'Vælg backupfil<input type="file" id="import-file" accept=".json,application/json" hidden></label>' +
            '<p class="form-error" id="import-error" role="alert"></p>' +
          '</div>' +
          '<div class="backup-box">' +
            '<h3>' + icon('file') + 'Historik til Excel</h3>' +
            '<p class="muted small">Hele transaktionshistorikken inkl. renter som CSV-fil, der kan åbnes i Excel.</p>' +
            '<button type="button" class="btn btn-soft" data-action="export-csv"' + (L.rows.length ? '' : ' disabled') + '>' + icon('download') + 'Eksportér CSV</button>' +
          '</div>' +
        '</div>' +
      '</section>';

    const danger =
      '<section class="card danger-zone">' +
        '<div class="card-head"><span class="icon-badge tone-withdrawal">' + icon('alert') + '</span><div><h2>Nulstil opsparingen</h2><p>Sletter alle transaktioner, renter, mål og indstillinger i denne browser. Det kan ikke fortrydes.</p></div></div>' +
        '<button type="button" class="btn btn-danger" data-action="reset">' + icon('trash') + 'Nulstil opsparingen</button>' +
      '</section>';

    const about =
      '<p class="muted tiny about">Alle data gemmes lokalt i denne browser (LocalStorage, ' + (S.storageSize() / 1024).toLocaleString('da-DK', { maximumFractionDigits: 1 }) + ' kB). Intet sendes til en server, og der kræves ikke login. Når siden først er indlæst, virker den også uden internet.</p>';

    return pageHead('Indstillinger', 'Tilpas GrejsOpsparing, og flyt dine data mellem enheder.') +
      '<section class="grid-2">' + general + savings + '</section>' + backup + danger + about;
  }

  // ---------- Router og tegning ----------

  const VIEWS = {
    oversigt: viewOverview,
    transaktioner: viewTransactions,
    renter: viewInterest,
    maal: viewGoal,
    grafer: viewCharts,
    indstillinger: viewSettings,
  };

  function readRoute() {
    const r = (location.hash || '').replace(/^#\/?/, '');
    return ROUTES.includes(r) ? r : 'oversigt';
  }

  function render() {
    model = buildModel();
    G.destroyAll();
    document.getElementById('view').innerHTML = VIEWS[ui.route]();
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === ui.route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.getElementById('header-balance').textContent = money(model.ledger.balance);
    if (ui.route === 'grafer') drawCharts();
  }

  function onRoute() {
    const next = readRoute();
    const changed = next !== ui.route;
    ui.route = next;
    render();
    if (changed) {
      window.scrollTo(0, 0);
      const h = document.querySelector('#view h1, #view .hero-amount');
      if (h) h.setAttribute('tabindex', '-1');
    }
  }

  // ---------- Formularer ----------

  function readTxFields(form, type, isEdit) {
    clearErrors(form);
    const amount = C.parseAmount(form.elements.amount.value);
    const date = form.elements.date.value;
    const description = form.elements.description.value.trim();
    let ok = true;
    if (!form.elements.amount.value.trim()) { setFieldError(form, 'amount', 'Skriv et beløb.'); ok = false; }
    else if (amount === null) { setFieldError(form, 'amount', 'Skriv et gyldigt beløb større end 0, fx 2.000 eller 2000,50.'); ok = false; }
    if (C.parseDateKey(date) === null) { setFieldError(form, 'date', 'Vælg en gyldig dato.'); ok = false; }
    else if (date > C.todayKey()) { setFieldError(form, 'date', 'Datoen kan ikke ligge i fremtiden. Brug den faste månedlige opsparing til planer.'); ok = false; }
    if (ok && type === 'withdrawal' && !isEdit) {
      const max = maxWithdrawable(date);
      if (amount > max) {
        const when = date < C.todayKey() ? ' på den valgte dato' : '';
        setFieldError(form, 'amount', max > 0
          ? 'Du kan højst hæve ' + money(max) + when + (when || !/\.$/.test(money(max)) ? '.' : '')
          : 'Der er ingen penge på opsparingen at hæve' + when + '.');
        ok = false;
      }
    }
    if (!ok) { focusFirstError(form); return null; }
    return { amount, date, description };
  }

  function addTransaction(form, type) {
    const fields = readTxFields(form, type);
    if (!fields) return;
    const tx = {
      id: S.newId(), type, amount: fields.amount, date: fields.date, description: fields.description,
      createdAt: new Date().toISOString(),
    };
    const err = commit((d) => { d.transactions.push(tx); },
      (type === 'deposit' ? money(tx.amount) + ' er lagt ind på opsparingen.' : money(tx.amount) + ' er hævet fra opsparingen.'));
    if (err) setFieldError(form, 'amount', err);
  }

  const FORMS = {
    deposit: (form) => addTransaction(form, 'deposit'),
    withdrawal: (form) => addTransaction(form, 'withdrawal'),

    interest(form) {
      clearErrors(form);
      const rate = C.parseRate(form.elements.rate.value);
      const start = form.elements.startDate.value;
      let ok = true;
      if (rate === null) { setFieldError(form, 'rate', 'Skriv en rente mellem 0 og 100, fx 2 eller 2,25.'); ok = false; }
      if (start && C.parseDateKey(start) === null) { setFieldError(form, 'startDate', 'Vælg en gyldig dato.'); ok = false; }
      if (!ok) return focusFirstError(form);
      const err = commit((d) => {
        setCurrentRate(d, rate);
        d.interest.compounding = form.elements.compounding.value === 'yearly' ? 'yearly' : 'monthly';
        d.interest.startDate = start || null;
      }, 'Renteindstillingerne er gemt.');
      if (err) setFormError(form, err);
    },

    'rate-change'(form) {
      clearErrors(form);
      const rate = C.parseRate(form.elements.rate.value);
      const from = form.elements.from.value;
      let ok = true;
      if (rate === null) { setFieldError(form, 'rate', 'Skriv en rente mellem 0 og 100.'); ok = false; }
      if (C.parseDateKey(from) === null) { setFieldError(form, 'from', 'Vælg en gyldig dato.'); ok = false; }
      if (!ok) return focusFirstError(form);
      const err = commit((d) => {
        d.interest.rates = d.interest.rates.filter((r) => r.from !== from);
        d.interest.rates.push({ from, rate });
        d.interest.rates.sort((a, b) => (a.from === null ? -1 : b.from === null ? 1 : a.from < b.from ? -1 : 1));
      }, 'Renteændringen er tilføjet.');
      if (err) setFormError(form, err);
    },

    goal(form) {
      clearErrors(form);
      const amount = C.parseAmount(form.elements.amount.value);
      const target = form.elements.targetDate.value;
      let ok = true;
      if (amount === null) { setFieldError(form, 'amount', 'Skriv et gyldigt mål større end 0, fx 50.000.'); ok = false; }
      if (target && C.parseDateKey(target) === null) { setFieldError(form, 'targetDate', 'Vælg en gyldig dato.'); ok = false; }
      else if (target && target <= C.todayKey()) { setFieldError(form, 'targetDate', 'Slutdatoen skal ligge efter i dag.'); ok = false; }
      if (!ok) return focusFirstError(form);
      const err = commit((d) => {
        d.goal = { name: form.elements.name.value.trim().slice(0, 60), amount, targetDate: target || null };
      }, 'Dit opsparingsmål er gemt.');
      if (err) setFormError(form, err);
    },

    plan(form) {
      clearErrors(form);
      const res = readOptionalAmount(form.elements.amount.value === '0' ? '' : form.elements.amount.value);
      if (res.error) { setFieldError(form, 'amount', res.error); return focusFirstError(form); }
      const day = Number(form.elements.dayOfMonth.value);
      const err = commit((d) => {
        d.plan = { monthlyAmount: res.value, dayOfMonth: day >= 1 && day <= 31 ? day : 1 };
      }, res.value ? 'Den faste månedlige opsparing er gemt.' : 'Den faste månedlige opsparing er slået fra.');
      if (err) setFormError(form, err);
    },

    'quick-settings'(form) {
      clearErrors(form);
      const rate = C.parseRate(form.elements.rate.value);
      const goal = readOptionalAmount(form.elements.goal.value);
      const monthly = readOptionalAmount(form.elements.monthly.value === '0' ? '' : form.elements.monthly.value);
      let ok = true;
      if (rate === null) { setFieldError(form, 'rate', 'Skriv en rente mellem 0 og 100.'); ok = false; }
      if (goal.error) { setFieldError(form, 'goal', goal.error); ok = false; }
      if (monthly.error) { setFieldError(form, 'monthly', monthly.error); ok = false; }
      if (!ok) return focusFirstError(form);
      const err = commit((d) => {
        setCurrentRate(d, rate);
        d.interest.compounding = form.elements.compounding.value === 'yearly' ? 'yearly' : 'monthly';
        d.goal.amount = goal.value;
        if (!goal.value) d.goal = { name: '', amount: 0, targetDate: null };
        d.plan.monthlyAmount = monthly.value;
      }, 'Indstillingerne er gemt.');
      if (err) setFormError(form, err);
    },
  };

  // Retter den rente, der gælder i dag (den seneste periode, der er startet).
  function setCurrentRate(d, rate) {
    const today = C.todayKey();
    let target = d.interest.rates.find((r) => r.from === null);
    for (const r of d.interest.rates) if (r.from && r.from <= today) target = r;
    target.rate = rate;
  }

  // ---------- Ret og slet transaktioner ----------

  function openEdit(id) {
    const tx = data.transactions.find((t) => t.id === id);
    if (!tx) return;
    const dlg = document.getElementById('edit-dialog');
    const form = document.getElementById('edit-form');
    form.dataset.id = id;
    clearErrors(form);
    form.elements.type.value = tx.type;
    form.elements.amount.value = amountInput(tx.amount);
    form.elements.date.value = tx.date;
    form.elements.date.max = C.todayKey();
    form.elements.description.value = tx.description;
    document.getElementById('edit-affix').textContent = CURRENCY_AFFIX[data.settings.currency];
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute('open', '');
    form.elements.amount.focus();
  }

  function saveEdit(form) {
    const type = form.elements.type.value === 'withdrawal' ? 'withdrawal' : 'deposit';
    const fields = readTxFields(form, type, true);
    if (!fields) return;
    const id = form.dataset.id;
    if (!data.transactions.some((t) => t.id === id)) {
      setFormError(form, 'Transaktionen findes ikke længere. Den kan være slettet i en anden fane.');
      return;
    }
    const err = commit((d) => {
      const tx = d.transactions.find((t) => t.id === id);
      Object.assign(tx, { type, amount: fields.amount, date: fields.date, description: fields.description });
    }, 'Transaktionen er rettet, og saldoen er regnet igen.');
    if (err) {
      setFormError(form, err);
      return;
    }
    closeEdit();
  }

  function closeEdit() {
    const dlg = document.getElementById('edit-dialog');
    if (!dlg.open) return;
    if (dlg.close) dlg.close();
    else dlg.removeAttribute('open');
  }

  async function deleteTx(id) {
    const tx = data.transactions.find((t) => t.id === id);
    if (!tx) return;
    const yes = await confirmDialog({
      title: 'Slet transaktion?',
      html: 'Du er ved at slette <strong>' + esc(S.TYPE_LABELS[tx.type].toLowerCase()) + 'en på ' + money(tx.amount) + '</strong> fra ' + fmtDate(tx.date, 'long') +
        (tx.description ? ' (' + esc(tx.description) + ')' : '') + '. Saldo, renter og alle beregninger bliver regnet igen.',
      plain: S.TYPE_LABELS[tx.type] + ' på ' + money(tx.amount),
      ok: 'Slet',
      danger: true,
    });
    if (!yes) return;
    const err = commit((d) => { d.transactions = d.transactions.filter((t) => t.id !== id); }, 'Transaktionen er slettet.');
    if (err) toast(err, 'error');
  }

  // ---------- Backup ----------

  function backupName(ext) {
    return 'grejsopsparing-' + (ext === 'csv' ? 'historik' : 'backup') + '-' + C.todayKey() + '.' + ext;
  }

  function markExported() {
    data.settings.lastExport = new Date().toISOString();
    S.saveData(data);
  }

  function exportJSON() {
    download(backupName('json'), S.exportJSON(data), 'application/json');
    markExported();
    render();
    toast('Backupfilen er downloadet. Gem den et sikkert sted, eller flyt den til din anden enhed.', 'success');
  }

  async function shareJSON() {
    const file = new File([S.exportJSON(data)], backupName('json'), { type: 'application/json' });
    try {
      await navigator.share({ files: [file], title: 'GrejsOpsparing backup' });
      markExported();
      render();
      toast('Backupfilen er delt.', 'success');
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('Filen kunne ikke deles. Brug "Download JSON-fil" i stedet.', 'error');
    }
  }

  function exportCSV(rows) {
    if (!rows.length) return toast('Der er ingen bevægelser at eksportere.', 'error');
    const chronological = rows.slice().sort((a, b) => a.seq - b.seq);
    download(backupName('csv'), S.rowsToCSV(chronological, data.settings.currency), 'text/csv;charset=utf-8');
    toast('CSV-filen med ' + rows.length + ' bevægelser er downloadet.', 'success');
  }

  function importFile(file) {
    const errEl = document.getElementById('import-error');
    errEl.textContent = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      errEl.textContent = 'Filen er for stor til at være en backup fra GrejsOpsparing.';
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => { errEl.textContent = 'Filen kunne ikke læses.'; };
    reader.onload = async () => {
      const res = S.parseBackup(String(reader.result));
      if (!res.ok) {
        errEl.textContent = res.error;
        toast('Importen blev stoppet: ' + res.error, 'error');
        return;
      }
      const check = C.computeLedger(res.data, C.todayKey());
      if (check.negative) {
        errEl.textContent = 'Filen indeholder hævninger, der er større end saldoen (' + fmtDate(check.negative.date, 'long') + '). Den blev ikke importeret.';
        return;
      }
      const cur = model.ledger;
      const yes = await confirmDialog({
        title: 'Overskriv dine nuværende data?',
        html:
          '<span class="compare"><span><small>Backupfilen' + (res.exportedAt ? ' fra ' + fmtDay(Math.floor(Date.parse(res.exportedAt) / C.DAY_MS), 'long') : '') + '</small>' +
            '<strong>' + money(check.balance) + '</strong>' + res.data.transactions.length + ' transaktioner</span>' +
          '<span><small>Nuværende data</small><strong>' + money(cur.balance) + '</strong>' + data.transactions.length + ' transaktioner</span></span>' +
          'Alle nuværende transaktioner, mål og indstillinger i denne browser bliver erstattet af indholdet i filen.',
        plain: 'Nuværende data bliver erstattet af backupfilen.',
        ok: 'Overskriv og importér',
        danger: true,
      });
      if (!yes) return;
      res.data.settings.lastExport = res.data.settings.lastExport || new Date().toISOString();
      const saved = S.saveData(res.data);
      if (!saved.ok) {
        errEl.textContent = saved.error;
        return;
      }
      data = res.data;
      moneyFormats.clear();
      ui.storageWarning = null;
      applyTheme();
      render();
      toast('Opsparingen er gendannet med ' + data.transactions.length + ' transaktioner.', 'success');
    };
    reader.readAsText(file);
  }

  async function resetAll() {
    const dlg = document.getElementById('reset-dialog');
    const input = document.getElementById('reset-input');
    const ok = document.getElementById('reset-ok');
    input.value = '';
    ok.disabled = true;
    if (!dlg.showModal) {
      if (window.prompt('Skriv NULSTIL for at slette alle data') !== 'NULSTIL') return;
      return doReset();
    }
    dlg.showModal();
    input.focus();
  }

  function doReset() {
    const theme = data.settings.theme;
    const fresh = S.createDefaultData();
    fresh.settings.theme = theme;
    const res = S.saveData(fresh);
    if (!res.ok) return toast(res.error, 'error');
    data = fresh;
    moneyFormats.clear();
    ui.filter = { type: 'all', from: '', to: '', q: '' };
    location.hash = '#/oversigt';
    render();
    toast('Opsparingen er nulstillet.', 'success');
  }

  // ---------- Eksempeldata ----------

  function loadDemo() {
    const t = C.parseDateKey(C.todayKey());
    const start = C.addMonths(t, -14);
    const p = C.dayParts(start);
    const first = Date.UTC(p.y, p.m, 1) / C.DAY_MS;
    const txs = [];
    const add = (day, type, kr, description) => {
      if (day > t) return;
      txs.push({ id: S.newId(), type, amount: kr * 100, date: C.dayToKey(day), description, createdAt: new Date((day * C.DAY_MS) + 43200000 + txs.length).toISOString() });
    };
    add(first, 'deposit', 15000, 'Startindskud');
    for (let i = 1; i <= 14; i++) {
      const m = C.addMonths(first, i);
      add(m, 'deposit', 2000, 'Løn');
      if (i === 4) add(m + 9, 'deposit', 1000, 'Fødselsdag');
      if (i === 6) add(m + 14, 'withdrawal', 3200, 'Bilreparation');
      if (i === 9) add(m + 3, 'deposit', 1500, 'Ekstra opsparing');
      if (i === 11) add(m + 20, 'withdrawal', 1800, 'Køb');
    }
    const err = commit((d) => {
      d.transactions = txs;
      d.interest = { rates: [{ from: null, rate: 2 }], compounding: 'monthly', startDate: null };
      d.goal = { name: 'Ny bil', amount: 10000000, targetDate: C.dayToKey(C.addMonths(t, 30)) };
      d.plan = { monthlyAmount: 200000, dayOfMonth: 1 };
    }, 'Eksempeldata er indlæst. Du kan nulstille under Indstillinger.');
    if (err) toast(err, 'error');
  }

  // ---------- Hændelser ----------

  const ACTIONS = {
    focus(el) {
      const input = document.getElementById(el.dataset.target);
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus({ preventScroll: true });
      }
    },
    fill(el) {
      const input = document.getElementById(el.dataset.target);
      if (input) { input.value = el.dataset.value; input.focus(); }
    },
    'withdraw-all'() {
      const input = document.getElementById('wd-amount');
      input.value = amountInput(maxWithdrawable(document.getElementById('wd-date').value || C.todayKey()));
      input.focus();
    },
    demo() {
      if (data.transactions.length) return;
      loadDemo();
    },
    'filter-type'(el) { ui.filter.type = el.dataset.value; render(); },
    'filter-reset'() { ui.filter = { type: 'all', from: '', to: '', q: '' }; render(); },
    period(el) { ui.period = el.dataset.value; render(); },
    horizon(el) { ui.horizon = Number(el.dataset.value); render(); },
    theme(el) { setTheme(el.dataset.value); },
    'edit-tx'(el) { openEdit(el.dataset.id); },
    'delete-tx'(el) { deleteTx(el.dataset.id); },
    'delete-rate'(el) {
      const from = el.dataset.from;
      const err = commit((d) => { d.interest.rates = d.interest.rates.filter((r) => r.from !== from); }, 'Renteændringen er slettet.');
      if (err) toast(err, 'error');
    },
    async 'remove-goal'() {
      const yes = await confirmDialog({ title: 'Fjern opsparingsmålet?', html: 'Dit mål og din ønskede slutdato bliver fjernet. Transaktionerne påvirkes ikke.', ok: 'Fjern mål', danger: true });
      if (!yes) return;
      const err = commit((d) => { d.goal = { name: '', amount: 0, targetDate: null }; }, 'Opsparingsmålet er fjernet.');
      if (err) toast(err, 'error');
    },
    'export-json': exportJSON,
    'share-json': shareJSON,
    'export-csv'() { exportCSV(model.ledger.rows); },
    'export-csv-filtered'() { exportCSV(filteredRows()); },
    reset: resetAll,
    'edit-cancel': closeEdit,
    'confirm-cancel'() { document.getElementById('confirm-dialog').close(); },
    'reset-cancel'() { document.getElementById('reset-dialog').close(); },
    'reset-export'() { exportJSON(); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) {
      e.preventDefault();
      fn(el);
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.id === 'edit-form') {
      e.preventDefault();
      saveEdit(form);
      return;
    }
    if (form.id === 'reset-form') {
      e.preventDefault();
      if (document.getElementById('reset-input').value.trim().toUpperCase() !== 'NULSTIL') return;
      document.getElementById('reset-dialog').close();
      doReset();
      return;
    }
    const handler = FORMS[form.dataset.form];
    if (handler) {
      e.preventDefault();
      handler(form);
    }
  });

  let filterTimer = null;
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.filter) {
      ui.filter[el.dataset.filter] = el.value;
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => {
        const list = document.getElementById('tx-list');
        if (list) list.innerHTML = txList();
      }, el.type === 'search' ? 150 : 0);
    }
    if (el.id === 'reset-input') {
      document.getElementById('reset-ok').disabled = el.value.trim().toUpperCase() !== 'NULSTIL';
    }
    if (el.getAttribute('aria-invalid') === 'true') {
      el.removeAttribute('aria-invalid');
      const err = el.closest('.field') && el.closest('.field').querySelector('.field-error');
      if (err) err.textContent = '';
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'import-file') {
      importFile(el.files && el.files[0]);
      el.value = '';
    }
    if (el.dataset.setting === 'currency') {
      const value = el.value;
      moneyFormats.clear();
      const err = commit((d) => { d.settings.currency = S.CURRENCIES.includes(value) ? value : 'DKK'; }, 'Valutaen er ændret.');
      if (err) toast(err, 'error');
    }
  });

  document.getElementById('theme-toggle').addEventListener('click', () => {
    setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
  });

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (data.settings.theme === 'system') { applyTheme(); if (ui.route === 'grafer') render(); } };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }

  // Er appen åben i to faner, holdes de synkrone.
  window.addEventListener('storage', (e) => {
    if (e.key !== S.STORAGE_KEY) return;
    data = S.loadData().data;
    moneyFormats.clear();
    applyTheme();
    render();
  });

  // Skifter datoen ved midnat, mens siden er åben, regnes alt igen.
  let lastDay = C.todayKey();
  setInterval(() => {
    if (C.todayKey() !== lastDay) { lastDay = C.todayKey(); render(); }
  }, 60000);

  window.addEventListener('hashchange', onRoute);

  ui.route = readRoute();
  applyTheme();
  render();
  document.documentElement.classList.add('ready');

  // Offline: sitets fælles service worker gemmer GrejsOpsparing og Chart.js.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => console.info('service worker not registered', e));
    });
  }
})();
