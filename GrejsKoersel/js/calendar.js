// Datoer, kalenderen og visningen af den enkelte dag.

const MONTH_NAMES = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
const WEEKDAY_NAMES = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const WEEKDAY_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

// Datoer håndteres altid som lokale kalenderdatoer. toISOString() bruges ikke,
// fordi den regner i UTC og kan flytte datoen én dag.
function toDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

// Forskyder en måned. new Date klarer selv årsskiftet, også med negative måneder.
function shiftMonth(year, month, offset) {
  const date = new Date(year, month + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function monthTitle(year, month) {
  const name = MONTH_NAMES[month];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

function formatFullDate(date) {
  return `${WEEKDAY_NAMES[date.getDay()]} den ${date.getDate()}. ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function statusLabel(status) {
  if (status === 'yes') return 'Ja – kørt med Grejs';
  if (status === 'no') return 'Nej – kørt selv';
  return 'Ikke registreret';
}

function renderCalendar(year, month) {
  const today = new Date();
  const todayKey = toDateKey(today);
  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  // Dag 0 i næste måned er sidste dag i denne måned, så skudår kommer automatisk med.
  const dayCount = new Date(year, month + 1, 0).getDate();
  // getDay() starter ugen søndag. Her flyttes den, så mandag er 0.
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;

  let cells = '<span class="day-blank"></span>'.repeat(leadingBlanks);
  for (let dayNumber = 1; dayNumber <= dayCount; dayNumber += 1) {
    const date = new Date(year, month, dayNumber);
    const key = toDateKey(date);
    const status = appData.days[key] ? appData.days[key].status : 'none';
    const isToday = key === todayKey;
    const mark = status === 'yes' ? '✓' : status === 'no' ? '✕' : '';
    const label = `${formatFullDate(date)}${isToday ? ' (i dag)' : ''}: ${statusLabel(status)}`;
    cells += `
      <a class="day-cell status-${status}${isToday ? ' is-today' : ''}" href="#/dag/${key}"
         aria-label="${label}"${isToday ? ' aria-current="date"' : ''}>
        <span class="day-number">${dayNumber}</span>
        <span class="day-mark" aria-hidden="true">${mark}</span>
      </a>`;
  }

  const defaultsBanner = appData.settings.confirmed ? '' : `
    <div class="banner">
      <p>Beregningerne bruger standardværdierne ${formatNumber(appData.settings.consumptionLitersPer100Km)} L/100 km og
      ${formatMoney(appData.settings.fuelPricePerLiter)} pr. liter. Passer det til din bil?</p>
      <div class="banner-actions">
        <a class="button button-small" href="#/indstillinger">Ret indstillinger</a>
        <button class="button button-small" type="button" data-action="confirm-defaults">Ja, behold dem</button>
      </div>
    </div>`;

  document.getElementById('view').innerHTML = `
    ${defaultsBanner}
    <div class="calendar-layout">
      <section class="panel calendar-panel" aria-labelledby="view-title">
        <div class="calendar-head">
          <h1 id="view-title" tabindex="-1">${monthTitle(year, month)}</h1>
          <div class="calendar-controls">
            <a class="button button-small" href="#/kalender/${toMonthKey(previous.year, previous.month)}">‹ Forrige måned</a>
            ${isCurrentMonth ? '' : `<a class="button button-small" href="#/kalender/${todayKey.slice(0, 7)}">I dag</a>`}
            <a class="button button-small" href="#/kalender/${toMonthKey(next.year, next.month)}">Næste måned ›</a>
          </div>
        </div>
        <div class="weekdays" aria-hidden="true">
          ${WEEKDAY_SHORT.map((name) => `<span>${name}</span>`).join('')}
        </div>
        <div class="month-grid">${cells}</div>
        <ul class="legend">
          <li><span class="legend-dot status-yes" aria-hidden="true">✓</span>Ja – kørt med Grejs</li>
          <li><span class="legend-dot status-no" aria-hidden="true">✕</span>Nej – kørt selv</li>
          <li><span class="legend-dot status-none" aria-hidden="true"></span>Ikke registreret</li>
        </ul>
      </section>
      ${renderMonthSummary(year, month)}
    </div>`;
}

function renderMonthSummary(year, month) {
  const summary = calculateMonthlySummary(year, month, appData.days);
  const saving = describeSaving(summary.saving);
  const monthName = MONTH_NAMES[month];
  const heading = saving.tone === 'negative'
    ? `Merpris ved at vælge Grejs i ${monthName}`
    : `Samlet besparelse ved at vælge Grejs i ${monthName}`;

  return `
    <section class="panel summary-panel" aria-label="Oversigt for ${monthName}">
      <p class="hero-label">${heading}</p>
      <p class="hero-amount tone-${saving.tone}">${formatMoney(saving.amount)}</p>
      <dl class="rows">
        <div><dt>Dage med Grejs</dt><dd>${summary.grejsDays}</dd></div>
        <div><dt>Dage kørt selv</dt><dd>${summary.ownDays}</dd></div>
        <div><dt>Betalt til Grejs</dt><dd>${formatMoney(summary.grejsPaid)}</dd></div>
        <div><dt>Brændstof, Grejs-turene ville have kostet i egen bil</dt><dd>${formatMoney(summary.avoidedFuelCost)}</dd></div>
        <div class="row-separate"><dt>Brændstof på dage kørt selv</dt><dd>${formatMoney(summary.ownFuelCost)}</dd></div>
      </dl>
      <p class="fine-print">Fast turlængde: ${TRIP_DISTANCE_KM} km. Beregningen sammenligner kun brændstof med prisen for Grejs. Kun registrerede dage tæller med.</p>
    </section>`;
}

function renderDayResult(day) {
  if (!day) {
    return '<p class="result-empty">Ikke registreret endnu. Dagen tæller ikke med i oversigten.</p>';
  }

  const settings = appData.settings;
  const usesOtherValues = day.consumptionLitersPer100Km !== settings.consumptionLitersPer100Km
    || day.fuelPricePerLiter !== settings.fuelPricePerLiter;
  const valuesNote = `
    <p class="fine-print">Beregnet med ${formatNumber(day.consumptionLitersPer100Km)} L/100 km og
    ${formatMoney(day.fuelPricePerLiter)} pr. liter på en fast tur på ${TRIP_DISTANCE_KM} km.
    ${usesOtherValues ? 'Dine indstillinger er ændret siden. Vil du bruge de nye værdier, skal du fjerne registreringen og registrere dagen igen.' : ''}</p>`;

  if (day.status === 'no') {
    return `
      <dl class="rows">
        <div class="row-total"><dt>Brændstof i egen bil</dt><dd>${formatMoney(day.ownFuelCost)}</dd></div>
      </dl>
      <p class="fine-print">Dagen tæller ikke som en besparelse ved at køre med Grejs.</p>
      ${valuesNote}`;
  }

  const saving = describeSaving(day.saving);
  return `
    <dl class="rows">
      <div><dt>Samme tur i egen bil</dt><dd>${formatMoney(day.ownFuelCost)}</dd></div>
      <div><dt>Pris med Grejs</dt><dd>${formatMoney(day.grejsCost)}</dd></div>
      <div class="row-total"><dt>${saving.label}</dt><dd class="tone-${saving.tone}">${formatMoney(saving.amount)}</dd></div>
    </dl>
    ${saving.tone === 'negative' ? `<p class="fine-print">Grejs-turen koster ${formatMoney(saving.amount)} mere end brændstoffet til samme tur.</p>` : ''}
    ${valuesNote}`;
}

function openDay(dateKey) {
  const date = fromDateKey(dateKey);
  const day = appData.days[dateKey];
  const status = day ? day.status : 'none';
  const previous = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  document.getElementById('view').innerHTML = `
    <section class="panel day-panel" aria-labelledby="view-title">
      <a class="back-link" href="#/kalender/${dateKey.slice(0, 7)}">‹ Tilbage til kalenderen</a>
      <h1 id="view-title" tabindex="-1">${formatFullDate(date)}</h1>
      <h2 class="day-question">Har du kørt med Grejs i dag?</h2>
      <div class="choice-row">
        <button class="choice choice-yes${status === 'yes' ? ' is-selected' : ''}" type="button"
                data-action="set-status" data-arg="yes" aria-pressed="${status === 'yes'}">
          <strong>Ja</strong><span>Kørt med Grejs</span>
        </button>
        <button class="choice choice-no${status === 'no' ? ' is-selected' : ''}" type="button"
                data-action="set-status" data-arg="no" aria-pressed="${status === 'no'}">
          <strong>Nej</strong><span>Kørt selv</span>
        </button>
      </div>
      <div class="day-result">
        <p class="result-status status-text-${status}">${day ? `Registreret: ${statusLabel(status)}` : 'Status: Ikke registreret'}</p>
        ${renderDayResult(day)}
        ${day ? '<button class="button button-small" type="button" data-action="clear-day">Fjern registrering</button>' : ''}
      </div>
      <div class="day-nav">
        <a class="button" href="#/dag/${toDateKey(previous)}">‹ Forrige dag</a>
        <a class="button" href="#/dag/${toDateKey(next)}">Næste dag ›</a>
      </div>
    </section>`;
}

// Gemmer et Ja eller Nej for dagen.
function setDayStatus(dateKey, status) {
  const existing = appData.days[dateKey];
  // Rettes en dag fra Ja til Nej eller omvendt, beholdes dagens egne brændstofværdier.
  // Ellers ville en rettelse i en gammel måned give et nyt resultat, når priserne er ændret.
  const source = existing || appData.settings;
  appData.days[dateKey] = createDayRecord(status, source.consumptionLitersPer100Km, source.fuelPricePerLiter);
  return saveData();
}

function clearDayStatus(dateKey) {
  delete appData.days[dateKey];
  return saveData();
}
