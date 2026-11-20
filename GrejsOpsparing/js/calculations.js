// Alle økonomiske beregninger i GrejsOpsparing.
// Filen kender ikke til DOM eller LocalStorage, så den kan testes for sig selv (se tests/).
//
// Beløb regnes ALTID i øre (heltal), så 0,1 + 0,2 aldrig bliver 0,30000000000000004.
// Datoer er tekst på formen "ÅÅÅÅ-MM-DD" og regnes om til dagnumre (dage siden 1970-01-01, UTC),
// så sommertid aldrig giver en dag for meget eller for lidt.
//
// Rentemodel (samme som de fleste danske opsparingskonti):
//   - Renten beregnes hver dag af saldoen ved dagens slutning: saldo × årlig rente / 365.
//   - Den beregnede rente samles op ("påløbne renter") og tilskrives kontoen på sidste dag i
//     måneden (månedlig tilskrivning) eller den 31. december (årlig tilskrivning).
//   - Først når renten er tilskrevet, indgår den i saldoen og giver selv rente (renters rente).
//   - Tilskrevet rente afrundes til hele øre.

(function (global) {
  'use strict';

  const DAY_MS = 86400000;
  const DAYS_PER_YEAR = 365;
  const MAX_AMOUNT = 100000000000; // 1 mia. kr. i øre

  // ---------- Datoer ----------

  function parseDateKey(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof key === 'string' ? key : '');
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const t = Date.UTC(y, mo - 1, d);
    const dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return t / DAY_MS;
  }

  function dayToKey(day) {
    return new Date(day * DAY_MS).toISOString().slice(0, 10);
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  // Dagens dato i brugerens egen tidszone.
  function todayKey(now) {
    const d = now || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dayParts(day) {
    const dt = new Date(day * DAY_MS);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  }

  // Lægger n måneder til. 31. januar + 1 måned = 28./29. februar.
  function addMonths(day, n) {
    const p = dayParts(day);
    const total = p.m + n;
    const y = p.y + Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12;
    return Date.UTC(y, m, Math.min(p.d, daysInMonth(y, m))) / DAY_MS;
  }

  function isPeriodEnd(day, compounding) {
    const p = dayParts(day);
    if (compounding === 'yearly') return p.m === 11 && p.d === 31;
    return p.d === daysInMonth(p.y, p.m);
  }

  // Næste dag (efter `day`), hvor renten tilskrives.
  function nextPeriodEnd(day, compounding) {
    const p = dayParts(day);
    if (compounding === 'yearly') {
      const end = Date.UTC(p.y, 11, 31) / DAY_MS;
      return end > day ? end : Date.UTC(p.y + 1, 11, 31) / DAY_MS;
    }
    const end = Date.UTC(p.y, p.m, daysInMonth(p.y, p.m)) / DAY_MS;
    if (end > day) return end;
    const nm = p.m === 11 ? 0 : p.m + 1;
    const ny = p.m === 11 ? p.y + 1 : p.y;
    return Date.UTC(ny, nm, daysInMonth(ny, nm)) / DAY_MS;
  }

  // Er `day` den dag i måneden, hvor den faste opsparing indbetales?
  // Vælger man den 31., bruges sidste dag i korte måneder.
  function isPlanDay(day, dayOfMonth) {
    const p = dayParts(day);
    return p.d === Math.min(dayOfMonth, daysInMonth(p.y, p.m));
  }

  function countPlanDays(fromDay, toDay, dayOfMonth) {
    let count = 0;
    for (let d = fromDay; d <= toDay; d++) if (isPlanDay(d, dayOfMonth)) count++;
    return count;
  }

  // ---------- Indtastning ----------

  // Læser et beløb skrevet på dansk eller engelsk: "1.234,50", "1234,5", "1234.50", "2 000 kr".
  // Returnerer øre (heltal > 0) eller null, hvis teksten ikke er et gyldigt beløb.
  function parseAmount(text) {
    if (typeof text === 'number') text = String(text);
    if (typeof text !== 'string') return null;
    let s = text.trim().toLowerCase().replace(/kr\.?|dkk/g, '').replace(/[\s ]/g, '');
    if (!s || !/^[0-9.,]+$/.test(s)) return null;
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
      // Den sidste af de to er decimaltegnet.
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        if (!/^\d{1,3}(\.\d{3})*,\d+$/.test(s)) return null;
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        if (!/^\d{1,3}(,\d{3})*\.\d+$/.test(s)) return null;
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      if ((s.match(/,/g) || []).length > 1) {
        if (!/^\d{1,3}(,\d{3})+$/.test(s)) return null;
        s = s.replace(/,/g, '');
      } else {
        s = s.replace(',', '.');
      }
    } else if (hasDot) {
      // "1.000" og "12.500.000" er tusindtalsseparatorer; "12.5" er decimaler.
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
      else if ((s.match(/\./g) || []).length > 1) return null;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const [whole, frac = ''] = s.split('.');
    const ore = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
    if (!Number.isSafeInteger(ore) || ore <= 0 || ore > MAX_AMOUNT) return null;
    return ore;
  }

  // Rente i procent: "2", "2,5", "2.25". Tilladt: 0–100 med højst 3 decimaler.
  function parseRate(text) {
    if (typeof text === 'number') text = String(text);
    if (typeof text !== 'string') return null;
    const s = text.trim().replace('%', '').replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
    const r = Number(s);
    return r >= 0 && r <= 100 ? r : null;
  }

  // ---------- Renter ----------

  // Renteperioder: [{ from: null | "ÅÅÅÅ-MM-DD", rate: 2.5 }]. Den første periode (from = null)
  // gælder fra rentens startdato; de øvrige er renteændringer fra en bestemt dato.
  function makeRateFn(rates) {
    const list = (rates || [])
      .map((r) => ({ from: r.from ? parseDateKey(r.from) : -Infinity, rate: Number(r.rate) || 0 }))
      .sort((a, b) => a.from - b.from);
    return function rateOn(day) {
      let rate = 0;
      for (const r of list) {
        if (r.from <= day) rate = r.rate;
        else break;
      }
      return rate;
    };
  }

  function rateOnDate(rates, key) {
    return makeRateFn(rates)(parseDateKey(key));
  }

  // Effektiv årlig rente, når renten tilskrives flere gange om året.
  function effectiveAnnualRate(ratePercent, compounding) {
    const r = ratePercent / 100;
    if (compounding === 'yearly') return ratePercent;
    return (Math.pow(1 + r / 12, 12) - 1) * 100;
  }

  // Kører kontoen dag for dag. Al rentelogik ligger her, så historik og prognose regnes ens.
  function simulate(o) {
    let balance = o.balance || 0;
    let accrued = o.accrued || 0;
    for (let day = o.startDay; day <= o.endDay; day++) {
      const events = o.eventsFn(day);
      if (events) {
        for (const ev of events) {
          balance += ev.amount;
          if (o.onEvent) o.onEvent(ev, balance, day);
        }
      }
      if (day >= o.interestFromDay && balance > 0) {
        const rate = o.rateFn(day);
        if (rate > 0) accrued += (balance * rate) / 100 / DAYS_PER_YEAR;
      }
      if (isPeriodEnd(day, o.compounding)) {
        const credit = Math.round(accrued);
        accrued = 0;
        if (credit > 0) {
          balance += credit;
          if (o.onCredit) o.onCredit(day, credit, balance);
        }
      }
      if (o.onDayEnd) o.onDayEnd(day, balance, accrued);
      if (o.stopWhen && o.stopWhen(day, balance)) return { balance, accrued, stoppedAt: day };
    }
    return { balance, accrued, stoppedAt: null };
  }

  function sortTransactions(txs) {
    return txs.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  function signedAmount(tx) {
    return tx.type === 'deposit' ? tx.amount : -tx.amount;
  }

  // Den faktiske konto fra første transaktion til i dag: saldo, totaler, tilskrevne renter,
  // saldo efter hver bevægelse og en daglig saldoserie til graferne.
  function computeLedger(data, today) {
    const todayDay = parseDateKey(today);
    const txs = sortTransactions(data.transactions || []);
    const interest = data.interest || {};
    const startSetting = interest.startDate ? parseDateKey(interest.startDate) : null;
    const firstTxDay = txs.length ? parseDateKey(txs[0].date) : null;
    const interestFromDay = startSetting !== null ? startSetting : firstTxDay !== null ? firstTxDay : Infinity;

    const result = {
      todayDay,
      interestFromDay,
      firstTxDay,
      balance: 0,
      accrued: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      depositCount: 0,
      withdrawalCount: 0,
      interestEarned: 0,
      credits: [],
      rows: [],
      series: [],
      negative: null,
    };
    if (!txs.length) return result;

    const byDay = new Map();
    for (const tx of txs) {
      const d = parseDateKey(tx.date);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push({ amount: signedAmount(tx), tx });
    }
    const lastTxDay = parseDateKey(txs[txs.length - 1].date);
    let seq = 0;
    let interestCum = 0;
    let depositsCum = 0;
    let withdrawalsCum = 0;

    const sim = simulate({
      startDay: Math.min(firstTxDay, interestFromDay),
      endDay: Math.max(todayDay, lastTxDay),
      eventsFn: (d) => byDay.get(d),
      rateFn: makeRateFn(interest.rates),
      interestFromDay,
      compounding: interest.compounding,
      onEvent(ev, balance) {
        const tx = ev.tx;
        if (tx.type === 'deposit') {
          result.totalDeposits += tx.amount;
          result.depositCount++;
          depositsCum += tx.amount;
        } else {
          result.totalWithdrawals += tx.amount;
          result.withdrawalCount++;
          withdrawalsCum += tx.amount;
        }
        result.rows.push({
          kind: 'tx', id: tx.id, type: tx.type, amount: tx.amount, date: tx.date,
          description: tx.description || '', balanceAfter: balance, seq: seq++,
        });
        if (balance < 0 && !result.negative) result.negative = { date: tx.date, id: tx.id, balance };
      },
      onCredit(day, amount, balance) {
        interestCum += amount;
        const row = {
          kind: 'interest', id: 'rente-' + day, type: 'interest', amount, date: dayToKey(day),
          description: 'Rentetilskrivning', balanceAfter: balance, seq: seq++,
        };
        result.rows.push(row);
        result.credits.push(row);
      },
      onDayEnd(day, balance, accrued) {
        if (day >= firstTxDay) {
          result.series.push({ day, balance, interest: interestCum, deposits: depositsCum, withdrawals: withdrawalsCum, accrued });
        }
      },
    });
    result.balance = sim.balance;
    result.accrued = sim.accrued;
    result.interestEarned = interestCum;
    return result;
  }

  // Prognose fra i morgen og frem: den faste månedlige opsparing indbetales på planens dag,
  // og renten regnes på præcis samme måde som på den rigtige konto.
  function project(ledger, data, opts) {
    const startDay = ledger.todayDay + 1;
    const monthly = Math.max(0, Math.round(opts.monthly || 0));
    const dayOfMonth = opts.dayOfMonth || 1;
    const interest = data.interest || {};
    const record = opts.record !== false;
    const out = { startDay, balances: [], interestCum: [], depositsCum: [], credits: [], goalDay: null, balance: 0, accrued: 0, deposits: 0, interest: 0 };
    const planEvent = [{ amount: monthly }];
    let deposits = 0;
    let interestSum = 0;

    const sim = simulate({
      startDay,
      endDay: opts.endDay,
      balance: ledger.balance,
      accrued: ledger.accrued,
      eventsFn: (d) => (monthly > 0 && isPlanDay(d, dayOfMonth) ? planEvent : null),
      rateFn: makeRateFn(interest.rates),
      // Uden transaktioner og startdato begynder renten, når de første penge kommer ind.
      interestFromDay: Number.isFinite(ledger.interestFromDay) ? ledger.interestFromDay : startDay,
      compounding: interest.compounding,
      onEvent(ev) { deposits += ev.amount; },
      onCredit(day, amount) {
        interestSum += amount;
        if (opts.recordCredits) out.credits.push({ day, amount });
      },
      onDayEnd(day, balance) {
        if (record) {
          out.balances.push(balance);
          out.interestCum.push(interestSum);
          out.depositsCum.push(deposits);
        }
      },
      stopWhen: opts.goal ? (day, balance) => balance >= opts.goal : null,
    });
    out.goalDay = sim.stoppedAt;
    out.balance = sim.balance;
    out.accrued = sim.accrued;
    out.deposits = deposits;
    out.interest = interestSum;
    return out;
  }

  // Saldo, renter og indbetalinger på en bestemt fremtidig dag i en prognose.
  function projectionAt(projection, ledger, day) {
    const i = day - projection.startDay;
    if (i < 0) return { balance: ledger.balance, interest: 0, deposits: 0 };
    const j = Math.min(i, projection.balances.length - 1);
    return { balance: projection.balances[j], interest: projection.interestCum[j], deposits: projection.depositsCum[j] };
  }

  const GOAL_HORIZON_YEARS = 100;

  // Hvornår nås målet med den nuværende plan og rente? null = ikke inden for 100 år.
  function findGoalDate(ledger, data, goal, monthly, dayOfMonth) {
    if (!(goal > 0)) return null;
    if (ledger.balance >= goal) return { reached: true, day: ledger.todayDay, deposits: 0, interest: 0 };
    const p = project(ledger, data, {
      endDay: ledger.todayDay + GOAL_HORIZON_YEARS * DAYS_PER_YEAR,
      monthly, dayOfMonth, goal, record: false,
    });
    if (p.goalDay === null) return { reached: false, day: null };
    return { reached: false, day: p.goalDay, deposits: p.deposits, interest: p.interest, balance: p.balance };
  }

  // Hvor meget skal man spare op hver måned for at have `goal` på `targetKey`?
  // Findes med binær søgning direkte i prognosen, så renten tælles præcis med.
  function requiredMonthly(ledger, data, goal, targetKey, dayOfMonth) {
    const targetDay = parseDateKey(targetKey);
    if (targetDay === null || !(goal > 0)) return { status: 'none' };
    if (ledger.balance >= goal) return { status: 'reached' };
    if (targetDay <= ledger.todayDay) return { status: 'past' };
    const deposits = countPlanDays(ledger.todayDay + 1, targetDay, dayOfMonth);
    const missing = goal - ledger.balance;
    const at = (m) => project(ledger, data, { endDay: targetDay, monthly: m, dayOfMonth, record: false }).balance;
    if (at(0) >= goal) return { status: 'interest-only', monthly: 0, deposits };
    if (deposits === 0) return { status: 'no-deposits', missing };
    let lo = 0;
    let hi = missing; // én indbetaling af hele restbeløbet når altid målet
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (at(mid) >= goal) hi = mid;
      else lo = mid;
    }
    return {
      status: 'ok',
      monthly: Math.ceil(hi / 100) * 100, // rundet op til hele kroner
      withoutInterest: Math.ceil(missing / deposits / 100) * 100,
      deposits,
      missing,
    };
  }

  // ---------- Statistik til grafer ----------

  // Summerer indbetalinger, hævninger og renter pr. dag eller pr. måned fra `fromDay`.
  function aggregateFlows(rows, fromDay, toDay, granularity) {
    const buckets = new Map();
    const keyOf = (dateKey) => (granularity === 'day' ? dateKey : dateKey.slice(0, 7));
    // Lav tomme spande for hele perioden, så tomme måneder også vises.
    if (Number.isFinite(fromDay)) {
      if (granularity === 'day') {
        for (let d = fromDay; d <= toDay; d++) buckets.set(dayToKey(d), { deposits: 0, withdrawals: 0, interest: 0 });
      } else {
        const p = dayParts(fromDay);
        let d = Date.UTC(p.y, p.m, 1) / DAY_MS;
        while (d <= toDay) {
          buckets.set(dayToKey(d).slice(0, 7), { deposits: 0, withdrawals: 0, interest: 0 });
          d = addMonths(d, 1);
        }
      }
    }
    for (const r of rows) {
      const day = parseDateKey(r.date);
      if (day < fromDay || day > toDay) continue;
      const k = keyOf(r.date);
      if (!buckets.has(k)) buckets.set(k, { deposits: 0, withdrawals: 0, interest: 0 });
      const b = buckets.get(k);
      if (r.type === 'deposit') b.deposits += r.amount;
      else if (r.type === 'withdrawal') b.withdrawals += r.amount;
      else b.interest += r.amount;
    }
    return [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([key, v]) => ({ key, ...v }));
  }

  const api = {
    DAY_MS, DAYS_PER_YEAR, MAX_AMOUNT,
    parseDateKey, dayToKey, todayKey, dayParts, daysInMonth, addMonths, isPeriodEnd, nextPeriodEnd,
    isPlanDay, countPlanDays, parseAmount, parseRate, makeRateFn, rateOnDate, effectiveAnnualRate,
    simulate, sortTransactions, computeLedger, project, projectionAt, findGoalDate, requiredMonthly,
    aggregateFlows,
  };
  global.GOCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
