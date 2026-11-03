// Navigation, indstillinger, historik og backup. Starter appen.

const SAVE_FAILED_TEXT = 'Ændringen kunne ikke gemmes i browseren og forsvinder, når siden lukkes.';

// Adressen bestemmer visningen. Det virker også, når filen åbnes direkte, og
// browserens tilbageknap følger med.
function parseRoute() {
  const [view, arg] = location.hash.replace(/^#\/?/, '').split('/');
  if (view === 'indstillinger' || view === 'historik') return { view };
  if (view === 'dag' && isValidDateKey(arg || '')) return { view, dateKey: arg };
  if (view === 'kalender' && /^\d{4}-(0[1-9]|1[0-2])$/.test(arg || '')) {
    const [year, month] = arg.split('-').map(Number);
    return { view, year, month: month - 1 };
  }
  const today = new Date();
  return { view: 'kalender', year: today.getFullYear(), month: today.getMonth() };
}

function render() {
  const route = parseRoute();
  if (route.view === 'indstillinger') renderSettings();
  else if (route.view === 'historik') renderHistory();
  else if (route.view === 'dag') openDay(route.dateKey);
  else renderCalendar(route.year, route.month);

  const activeNav = route.view === 'dag' ? 'kalender' : route.view;
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === activeNav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

// Tegner visningen igen uden at miste brugerens plads, når man har trykket på en knap.
function rerenderKeepingFocus() {
  const active = document.activeElement;
  const action = active && active.dataset ? active.dataset.action : null;
  const arg = active && active.dataset ? active.dataset.arg : null;
  render();
  if (!action) return;
  const selector = arg ? `[data-action="${action}"][data-arg="${arg}"]` : `[data-action="${action}"]`;
  const target = document.querySelector(selector) || document.getElementById('view-title');
  if (target) target.focus({ preventScroll: true });
}

function showNotice(text, tone = 'info') {
  const notice = document.getElementById('notice');
  notice.textContent = text;
  notice.dataset.tone = tone;
  notice.hidden = false;
}

function clearNotice() {
  const notice = document.getElementById('notice');
  notice.hidden = true;
  notice.textContent = '';
}

function reportSave(saved) {
  if (!saved) showNotice(SAVE_FAILED_TEXT, 'error');
}

function askForConfirmation({ title, text, confirmLabel }) {
  const dialog = document.getElementById('confirm-dialog');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  document.getElementById('confirm-ok').textContent = confirmLabel;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
  });
}

/* ---------- Indstillinger ---------- */

function renderSettingsPreview() {
  const settings = appData.settings;
  const ownCost = calculateOwnFuelCost(settings.consumptionLitersPer100Km, settings.fuelPricePerLiter);
  const saving = describeSaving(roundKr(ownCost - GREJS_PRICE));
  return `
    <div><dt>Fast turlængde</dt><dd>${TRIP_DISTANCE_KM} km</dd></div>
    <div><dt>Egen tur koster</dt><dd>${formatMoney(ownCost)}</dd></div>
    <div><dt>Pris med Grejs</dt><dd>${formatMoney(GREJS_PRICE)}</dd></div>
    <div class="row-total"><dt>${saving.label} pr. Grejs-tur</dt><dd class="tone-${saving.tone}">${formatMoney(saving.amount)}</dd></div>`;
}

function renderSettings() {
  const settings = appData.settings;
  document.getElementById('view').innerHTML = `
    <div class="settings-layout">
      <section class="panel" aria-labelledby="view-title">
        <h1 id="view-title" tabindex="-1">Indstillinger</h1>
        <p class="lead">Værdierne gemmes automatisk og bruges på nye registreringer. Dage, du allerede har registreret, beholder deres egne værdier.</p>
        <div class="field">
          <label for="consumption">Bilens brændstofforbrug</label>
          <div class="input-unit">
            <input id="consumption" type="text" inputmode="decimal" autocomplete="off"
                   data-setting="consumptionLitersPer100Km" aria-describedby="consumption-error"
                   value="${formatNumber(settings.consumptionLitersPer100Km)}">
            <span>L/100 km</span>
          </div>
          <p id="consumption-error" class="field-error" hidden></p>
        </div>
        <div class="field">
          <label for="fuel-price">Brændstofpris</label>
          <div class="input-unit">
            <input id="fuel-price" type="text" inputmode="decimal" autocomplete="off"
                   data-setting="fuelPricePerLiter" aria-describedby="fuel-price-error"
                   value="${formatNumber(settings.fuelPricePerLiter)}">
            <span>kr./liter</span>
          </div>
          <p id="fuel-price-error" class="field-error" hidden></p>
        </div>
        <p id="settings-status" class="save-status" role="status"></p>
        <h2>Sådan ser en tur ud</h2>
        <dl id="settings-preview" class="rows">${renderSettingsPreview()}</dl>
      </section>
      <section class="panel" aria-labelledby="backup-title">
        <h2 id="backup-title">Backup</h2>
        <p class="lead">Dine data gemmes kun i denne browser på denne enhed. Rydder du browserdata, kan dine registreringer gå tabt. Eksportér en backup for en sikkerheds skyld.</p>
        <div class="button-row">
          <button class="button" type="button" data-action="export">Eksportér backup</button>
          <button class="button" type="button" data-action="import">Importér backup</button>
          <input id="import-file" type="file" accept=".json,application/json" hidden>
        </div>
        <h2>Nulstil</h2>
        <p class="lead">Sletter alle registreringer og indstillinger i GrejsKørsel. Det kan ikke fortrydes.</p>
        <button class="button button-danger" type="button" data-action="reset">Slet alle data</button>
      </section>
    </div>`;
}

function handleSettingInput(input) {
  const value = parsePositiveNumber(input.value);
  const error = document.getElementById(`${input.id}-error`);
  const status = document.getElementById('settings-status');

  // Ugyldige værdier gemmes ikke. Appen regner videre med den seneste gyldige værdi.
  if (value === null) {
    input.setAttribute('aria-invalid', 'true');
    error.textContent = 'Skriv et tal større end 0, fx 6,5.';
    error.hidden = false;
    status.textContent = '';
    return;
  }

  input.removeAttribute('aria-invalid');
  error.hidden = true;
  appData.settings[input.dataset.setting] = value;
  appData.settings.confirmed = true;
  const saved = saveData();
  status.textContent = saved ? 'Gemt' : '';
  reportSave(saved);
  document.getElementById('settings-preview').innerHTML = renderSettingsPreview();
}

/* ---------- Historik ---------- */

function renderHistoryRow(year, month, note) {
  const summary = calculateMonthlySummary(year, month, appData.days);
  const hasData = summary.grejsDays + summary.ownDays > 0;
  const saving = describeSaving(summary.saving);
  return `
    <li>
      <a class="history-row" href="#/kalender/${toMonthKey(year, month)}">
        <span class="history-month">
          <strong>${monthTitle(year, month)}</strong>
          <small>${note ? `${note} · ` : ''}${hasData
            ? `${summary.grejsDays} med Grejs · ${summary.ownDays} kørt selv · ${formatMoney(summary.grejsPaid)} betalt`
            : 'Ingen registreringer'}</small>
        </span>
        <span class="history-amount">
          <small>${saving.label}</small>
          <strong class="tone-${saving.tone}">${formatMoney(saving.amount)}</strong>
        </span>
      </a>
    </li>`;
}

function renderHistory() {
  const today = new Date();
  const recent = [];
  for (let offset = 0; offset < 4; offset += 1) {
    recent.push(shiftMonth(today.getFullYear(), today.getMonth(), -offset));
  }
  const recentKeys = recent.map((item) => toMonthKey(item.year, item.month));

  // Måneder uden for de seneste fire vises også, så længe der findes data i dem.
  const otherKeys = [...new Set(Object.keys(appData.days).map((key) => key.slice(0, 7)))]
    .filter((key) => !recentKeys.includes(key))
    .sort()
    .reverse();

  const total = summarizeDays(Object.values(appData.days));
  const totalSaving = describeSaving(total.saving);

  document.getElementById('view').innerHTML = `
    <section class="panel history-panel" aria-labelledby="view-title">
      <h1 id="view-title" tabindex="-1">Historik</h1>
      <p class="hero-label">${totalSaving.tone === 'negative' ? 'Samlet merpris' : 'Samlet besparelse'} for alle registrerede dage</p>
      <p class="hero-amount tone-${totalSaving.tone}">${formatMoney(totalSaving.amount)}</p>
      <h2>Seneste fire måneder</h2>
      <ul class="history-list">
        ${recent.map((item, index) => renderHistoryRow(item.year, item.month, index === 0 ? 'Denne måned' : '')).join('')}
      </ul>
      ${otherKeys.length ? `
        <h2>Andre måneder</h2>
        <ul class="history-list">
          ${otherKeys.map((key) => {
            const [year, month] = key.split('-').map(Number);
            return renderHistoryRow(year, month - 1, '');
          }).join('')}
        </ul>` : ''}
    </section>`;
}

/* ---------- Backup ---------- */

function exportBackup() {
  const backup = { app: 'GrejsKørsel', exportedAt: toDateKey(new Date()), ...appData };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `grejskoersel-backup-${toDateKey(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showNotice('Backupfilen er hentet.');
}

async function importBackup(file) {
  let text;
  try {
    text = await file.text();
  } catch (error) {
    showNotice('Filen kunne ikke læses.', 'error');
    return;
  }
  const result = parseBackup(text);
  if (result.error) {
    showNotice(`Importen blev afbrudt, og dine data er ikke ændret. ${result.error}`, 'error');
    return;
  }

  const importedCount = Object.keys(result.data.days).length;
  const currentCount = Object.keys(appData.days).length;
  const confirmed = await askForConfirmation({
    title: 'Overskriv dine data?',
    text: `Filen indeholder ${importedCount} registreringer. Dine nuværende ${currentCount} registreringer og dine indstillinger bliver erstattet.`,
    confirmLabel: 'Importér og overskriv',
  });
  if (!confirmed) return;

  appData = result.data;
  const saved = saveData();
  render();
  if (saved) showNotice(`Backuppen er importeret med ${importedCount} registreringer.`);
  else reportSave(false);
}

async function resetData() {
  const confirmed = await askForConfirmation({
    title: 'Slet alle data?',
    text: 'Alle registreringer og indstillinger i GrejsKørsel bliver slettet fra denne browser. Det kan ikke fortrydes.',
    confirmLabel: 'Slet alle data',
  });
  if (!confirmed) return;
  const cleared = clearStoredData();
  render();
  if (cleared) showNotice('Alle data er slettet.');
  else reportSave(false);
}

/* ---------- Hændelser ---------- */

function handleAction(action, arg) {
  const route = parseRoute();
  if (action === 'set-status') {
    reportSave(setDayStatus(route.dateKey, arg));
    rerenderKeepingFocus();
  } else if (action === 'clear-day') {
    reportSave(clearDayStatus(route.dateKey));
    rerenderKeepingFocus();
  } else if (action === 'confirm-defaults') {
    appData.settings.confirmed = true;
    reportSave(saveData());
    render();
    document.getElementById('view-title').focus({ preventScroll: true });
  } else if (action === 'export') {
    exportBackup();
  } else if (action === 'import') {
    document.getElementById('import-file').click();
  } else if (action === 'reset') {
    resetData();
  }
}

function startApp() {
  const status = loadData();
  render();
  if (!status.storageAvailable) {
    showNotice('Browseren tillader ikke, at GrejsKørsel gemmer data. Dine registreringer forsvinder, når siden lukkes.', 'error');
  } else if (status.damaged) {
    showNotice('Noget af det gemte indhold var ugyldigt og blev sprunget over. Du kan gendanne en backup under Indstillinger.', 'error');
  }

  window.addEventListener('hashchange', () => {
    clearNotice();
    render();
    window.scrollTo(0, 0);
    // Flytter fokus til den nye overskrift, så skærmlæsere og tastatur følger med.
    const title = document.getElementById('view-title');
    if (title) title.focus({ preventScroll: true });
  });

  const view = document.getElementById('view');
  view.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (button) handleAction(button.dataset.action, button.dataset.arg);
  });
  view.addEventListener('input', (event) => {
    if (event.target.dataset.setting) handleSettingInput(event.target);
  });
  view.addEventListener('focusout', (event) => {
    const input = event.target;
    if (input.dataset.setting && !input.hasAttribute('aria-invalid')) {
      input.value = formatNumber(appData.settings[input.dataset.setting]);
    }
  });
  view.addEventListener('change', (event) => {
    if (event.target.id !== 'import-file') return;
    const file = event.target.files[0];
    event.target.value = ''; // Så den samme fil kan vælges igen.
    if (file) importBackup(file);
  });

  // Holder siden opdateret, hvis den er åben i to faner, eller hvis datoen er skiftet,
  // mens den lå i baggrunden. Et felt, man er ved at skrive i, bliver ikke afbrudt.
  const refreshIfIdle = () => {
    const active = document.activeElement;
    if (!(active && active.dataset && active.dataset.setting)) rerenderKeepingFocus();
  };
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      loadData();
      refreshIfIdle();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshIfIdle();
  });
}

startApp();
