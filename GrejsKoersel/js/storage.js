// Gemmer og læser data i LocalStorage og tjekker backupfiler.

const STORAGE_KEY = 'grejsKoerselData';
// Beskadigede data flyttes hertil i stedet for at blive overskrevet.
const DAMAGED_KEY = 'grejsKoerselData_beskadiget';

let appData = createDefaultData();

function createDefaultData() {
  return {
    settings: {
      consumptionLitersPer100Km: DEFAULT_CONSUMPTION,
      fuelPricePerLiter: DEFAULT_FUEL_PRICE,
      tripDistanceKm: TRIP_DISTANCE_KM,
      grejsPrice: GREJS_PRICE,
      confirmed: false, // false, indtil brugeren har taget stilling til sine bilværdier
    },
    days: {},
  };
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Sikrer, at nøglen er en rigtig kalenderdato, så 2026-02-31 bliver afvist.
function isValidDateKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

// Bygger registreringen op igen ud fra de gemte brændstofværdier. Så kan en redigeret
// fil ikke ændre prisen på en Grejs-tur eller give en forkert besparelse.
function normalizeDay(raw) {
  if (!isPlainObject(raw)) return null;
  if (raw.status !== 'yes' && raw.status !== 'no') return null;
  if (!isPositiveNumber(raw.consumptionLitersPer100Km)) return null;
  if (!isPositiveNumber(raw.fuelPricePerLiter)) return null;
  return createDayRecord(raw.status, raw.consumptionLitersPer100Km, raw.fuelPricePerLiter);
}

function normalizeSettings(raw) {
  if (!isPlainObject(raw)) return null;
  if (!isPositiveNumber(raw.consumptionLitersPer100Km)) return null;
  if (!isPositiveNumber(raw.fuelPricePerLiter)) return null;
  return {
    consumptionLitersPer100Km: raw.consumptionLitersPer100Km,
    fuelPricePerLiter: raw.fuelPricePerLiter,
    tripDistanceKm: TRIP_DISTANCE_KM,
    grejsPrice: GREJS_PRICE,
    confirmed: raw.confirmed === true,
  };
}

function loadData() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    appData = createDefaultData();
    return { storageAvailable: false, damaged: false };
  }
  if (raw === null) {
    appData = createDefaultData();
    return { storageAvailable: true, damaged: false };
  }

  const data = createDefaultData();
  let damaged = false;
  try {
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) throw new Error('Forkert format');

    const settings = normalizeSettings(parsed.settings);
    if (settings) data.settings = settings;
    else damaged = true;

    if (isPlainObject(parsed.days)) {
      for (const key of Object.keys(parsed.days)) {
        const day = isValidDateKey(key) ? normalizeDay(parsed.days[key]) : null;
        if (day) data.days[key] = day;
        else damaged = true;
      }
    } else {
      damaged = true;
    }
  } catch (error) {
    damaged = true;
  }

  // Næste gem overskriver det ødelagte indhold, så det gemmes først.
  if (damaged) {
    try {
      localStorage.setItem(DAMAGED_KEY, raw);
    } catch (error) {
      // Appen skal stadig kunne starte, selvom kopien ikke kan gemmes.
    }
  }
  appData = data;
  return { storageAvailable: true, damaged };
}

// Giver false, hvis browseren ikke ville gemme, fx ved privat browsing eller fuld kvote.
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    return true;
  } catch (error) {
    return false;
  }
}

// Fjerner kun GrejsKørsels egne nøgler. Andre apps på samme domæne bruger også LocalStorage.
function clearStoredData() {
  appData = createDefaultData();
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DAMAGED_KEY);
    return true;
  } catch (error) {
    return false;
  }
}

// Tjekker en backupfil. En fil med fejl afvises helt, så en import aldrig
// overskriver brugerens data med halve data.
function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { error: 'Filen er ikke en gyldig JSON-fil.' };
  }
  if (!isPlainObject(parsed) || !isPlainObject(parsed.days)) {
    return { error: 'Filen er ikke en backup fra GrejsKørsel.' };
  }
  const settings = normalizeSettings(parsed.settings);
  if (!settings) {
    return { error: 'Backupfilen mangler gyldige indstillinger.' };
  }
  const days = {};
  for (const key of Object.keys(parsed.days)) {
    const day = isValidDateKey(key) ? normalizeDay(parsed.days[key]) : null;
    if (!day) {
      return { error: `Backupfilen har en ugyldig registrering (${String(key).slice(0, 20)}).` };
    }
    days[key] = day;
  }
  settings.confirmed = true;
  return { data: { settings, days } };
}
