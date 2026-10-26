// Budgetter.
//
// Månedsbudget (gemmes pr. måned, id = "ÅÅÅÅ-MM"):
//   { id, month, expectedIncome, savingsTarget, total, lines: [{ categoryId, amount, rollover, accountId }] }
//   Findes der ikke et budget for en måned, bruges det seneste tidligere budget ("videreført").
//   total = samlet udgiftsbudget; er det tomt, bruges summen af kategorilinjerne.
// Periodebudget (fx ferie eller julegaver):
//   { id, name, from, to, amount, categoryIds: [], accountId }
// Forbrug beregnes altid med calc.spentIn/summarize fra analytics.js, så interne overførsler
// ikke tæller, og refusioner behandles ens overalt.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;

  const DEFAULT_THRESHOLDS = { notice: 70, warn: 90 };

  function planFor(plans, mk) {
    const exact = plans.find((p) => p.month === mk);
    if (exact) return { plan: exact, inherited: false, fromMonth: mk };
    const earlier = plans.filter((p) => p.month < mk).sort((a, b) => b.month.localeCompare(a.month))[0];
    return earlier ? { plan: earlier, inherited: true, fromMonth: earlier.month } : { plan: null, inherited: false, fromMonth: null };
  }

  function status(spent, budget, th) {
    const t = Object.assign({}, DEFAULT_THRESHOLDS, th || {});
    const left = U.round2(budget - spent);
    if (!(budget > 0)) return { pct: null, left, level: spent > 0 ? 'over' : 'ok', label: spent > 0 ? 'Intet budget' : 'Ikke brugt' };
    const pct = (spent / budget) * 100;
    if (spent > budget + 0.004) return { pct, left, level: 'over', label: 'Overskredet' };
    if (pct >= t.warn) return { pct, left, level: 'warn', label: 'Tæt på grænsen' };
    if (pct >= t.notice) return { pct, left, level: 'notice', label: 'Hold øje' };
    return { pct, left, level: 'ok', label: 'Inden for budget' };
  }

  function filterMonth(txs, mk, accountId) {
    const from = U.monthStart(mk), to = U.monthEnd(mk);
    return txs.filter((t) => t.date >= from && t.date <= to && (!accountId || t.accountId === accountId));
  }

  // Ubrugt beløb fra tidligere måneder for en linje med rollover (højst 12 måneder tilbage,
  // aldrig negativt – et overskredet budget trækkes ikke fra næste måned).
  function carryOver(plans, mk, line, txs, calc) {
    let carry = 0;
    const months = [];
    for (let i = 12; i >= 1; i--) months.push(U.addMonthKey(mk, -i));
    for (const m of months) {
      const { plan } = planFor(plans, m);
      const l = plan && plan.lines.find((x) => x.categoryId === line.categoryId && (x.accountId || null) === (line.accountId || null));
      if (!l || !l.rollover) { carry = 0; continue; }
      const spent = calc.spentIn(filterMonth(txs, m, l.accountId), l.categoryId);
      carry = Math.max(0, U.round2(l.amount + carry - spent));
    }
    return carry;
  }

  // Alle tal til budgetvisningen for en måned.
  function evaluate(plans, mk, txs, calc, thresholds) {
    const { plan, inherited, fromMonth } = planFor(plans, mk);
    const monthTxs = filterMonth(txs, mk);
    const sum = calc.summarize(monthTxs);
    if (!plan) return { plan: null, month: mk, summary: sum, lines: [] };
    const lines = plan.lines.map((l) => {
      const t = l.accountId ? monthTxs.filter((x) => x.accountId === l.accountId) : monthTxs;
      const spent = calc.spentIn(t, l.categoryId);
      const carry = l.rollover ? carryOver(plans, mk, l, txs, calc) : 0;
      const budget = U.round2(l.amount + carry);
      return Object.assign({ line: l, spent, carry, budget }, status(spent, budget, thresholds));
    });
    const linesTotal = U.sumAmounts(plan.lines, (l) => l.amount);
    const totalBudget = plan.total > 0 ? plan.total : linesTotal;
    return {
      plan, inherited, fromMonth, month: mk, summary: sum, lines, linesTotal, totalBudget,
      total: status(sum.expense, totalBudget, thresholds),
      savingsTarget: plan.savingsTarget || 0, expectedIncome: plan.expectedIncome || 0,
    };
  }

  // Forslag ud fra gennemsnittet af de valgte (hele) måneder. Rundes op til nærmeste 50 kr.
  function suggest(txs, calc, months, categories) {
    if (!months.length) return null;
    const totals = new Map();
    let income = 0, expense = 0, savings = 0;
    for (const m of months) {
      const s = calc.summarize(filterMonth(txs, m));
      income += s.income; expense += s.expense; savings += s.savings;
      for (const [cat, v] of s.byCategory) totals.set(cat, (totals.get(cat) || 0) + v);
    }
    const n = months.length;
    const up = (v) => Math.ceil(v / n / 50) * 50;
    const lines = [...totals]
      .filter(([cat, v]) => v / n >= 25 && categories.has(cat))
      .sort((a, b) => b[1] - a[1])
      .map(([categoryId, v]) => ({ categoryId, amount: up(v), rollover: false, accountId: null, average: U.round2(v / n) }));
    return {
      months, expectedIncome: Math.floor(income / n / 100) * 100, total: up(expense), savingsTarget: Math.max(0, Math.floor(savings / n / 100) * 100),
      lines, averageExpense: U.round2(expense / n),
    };
  }

  // Hele måneder med data (ikke den igangværende og ikke delvise måneder).
  function completeMonths(range, today, count) {
    if (!range || !range.from) return [];
    const out = [];
    let mk = U.addMonthKey(U.monthKey(today), -1);
    for (let i = 0; i < 36 && out.length < count; i++, mk = U.addMonthKey(mk, -1)) {
      if (U.monthEnd(mk) < range.from) break;
      if (GB.analytics.monthCoverage(mk, range, today).complete) out.push(mk);
    }
    return out.reverse();
  }

  function periodStatus(pb, txs, calc, thresholds) {
    const set = new Set(pb.categoryIds || []);
    const inRange = txs.filter((t) => t.date >= pb.from && t.date <= pb.to && (!pb.accountId || t.accountId === pb.accountId));
    let spent = 0;
    if (!set.size) spent = calc.summarize(inRange).expense;
    else for (const id of set) spent += calc.spentIn(inRange, id);
    spent = U.round2(spent);
    return Object.assign({ spent, budget: pb.amount }, status(spent, pb.amount, thresholds));
  }

  function copyPlan(plan, toMonth) {
    return {
      id: toMonth, month: toMonth, expectedIncome: plan.expectedIncome || 0, savingsTarget: plan.savingsTarget || 0, total: plan.total || 0,
      lines: plan.lines.map((l) => Object.assign({}, l)), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }

  GB.budgets = { DEFAULT_THRESHOLDS, planFor, status, evaluate, suggest, completeMonths, periodStatus, copyPlan, carryOver, filterMonth };
})();
