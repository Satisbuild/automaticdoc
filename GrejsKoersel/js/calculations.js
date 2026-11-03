// Beregninger og talformat. Filen rører hverken siden eller LocalStorage.

// Faste værdier. De står kun her, så de ikke kan ændres i appen eller med en backupfil.
const TRIP_DISTANCE_KM = 50;
const GREJS_PRICE = 15;

const DEFAULT_CONSUMPTION = 6.5;
const DEFAULT_FUEL_PRICE = 15;

const moneyFormat = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' });
const numberFormat = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 3 });

function formatMoney(amount) {
  return moneyFormat.format(amount);
}

function formatNumber(value) {
  return numberFormat.format(value);
}

// Runder til hele ører, så de viste beløb også passer, når de lægges sammen.
function roundKr(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

// Læser et tal, som brugeren har skrevet. Både "6,5" og "6.5" er gyldige.
// Giver null, hvis teksten ikke er et tal større end 0.
function parsePositiveNumber(text) {
  const clean = String(text).trim();
  if (!/^(\d+[.,]?\d*|[.,]\d+)$/.test(clean)) return null;
  const value = Number(clean.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Liter brugt = (50 km / 100) × forbrug i L/100 km
// Pris for egen tur = liter brugt × brændstofpris pr. liter
function calculateOwnFuelCost(consumption, fuelPrice) {
  const liters = (TRIP_DISTANCE_KM / 100) * consumption;
  return roundKr(liters * fuelPrice);
}

// Besparelse pr. Grejs-tur = pris for egen tur − 15 kr. Beløbet er negativt, hvis
// brændstoffet er billigst. Dage kørt selv giver ingen besparelse.
function calculateDaySaving(dayRecord) {
  if (dayRecord.status !== 'yes') return 0;
  return roundKr(dayRecord.ownFuelCost - GREJS_PRICE);
}

// Laver en dagsregistrering, som gemmer de værdier, den er beregnet med.
function createDayRecord(status, consumption, fuelPrice) {
  const record = {
    status,
    consumptionLitersPer100Km: consumption,
    fuelPricePerLiter: fuelPrice,
    ownFuelCost: calculateOwnFuelCost(consumption, fuelPrice),
  };
  if (status === 'yes') {
    record.grejsCost = GREJS_PRICE;
    record.saving = calculateDaySaving(record);
  }
  return record;
}

// Lægger de enkelte dages gemte beløb sammen. Dagene kan være beregnet med forskellige
// brændstofpriser, så man kan ikke bare gange antal dage med én besparelse.
function summarizeDays(dayRecords) {
  const summary = {
    grejsDays: 0,
    ownDays: 0,
    grejsPaid: 0,
    avoidedFuelCost: 0,
    ownFuelCost: 0,
    saving: 0,
  };
  for (const day of dayRecords) {
    if (day.status === 'yes') {
      summary.grejsDays += 1;
      summary.grejsPaid += day.grejsCost;
      summary.avoidedFuelCost += day.ownFuelCost;
      summary.saving += day.saving;
    } else {
      summary.ownDays += 1;
      summary.ownFuelCost += day.ownFuelCost;
    }
  }
  summary.grejsPaid = roundKr(summary.grejsPaid);
  summary.avoidedFuelCost = roundKr(summary.avoidedFuelCost);
  summary.ownFuelCost = roundKr(summary.ownFuelCost);
  summary.saving = roundKr(summary.saving);
  return summary;
}

// Måneden er 0-baseret (0 = januar). Kun registrerede dage findes i `days`.
function calculateMonthlySummary(year, month, days) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const records = Object.keys(days)
    .filter((key) => key.startsWith(prefix))
    .map((key) => days[key]);
  return summarizeDays(records);
}

// Oversætter et beløb til det, der skal stå på siden, så en merpris aldrig
// bliver vist som en besparelse.
function describeSaving(amount) {
  if (amount < 0) {
    return { label: 'Merpris', amount: -amount, tone: 'negative' };
  }
  return { label: 'Besparelse', amount, tone: amount > 0 ? 'positive' : 'neutral' };
}
