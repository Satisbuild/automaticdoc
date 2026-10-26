// Indsigter: korte, forklarlige konklusioner ud fra de importerede data.
// Hver indsigt har en forklaring (why), en periode og en henvisning til de transaktioner,
// den bygger på. Der vises ingen procent, når sammenligningsgrundlaget er 0, og en
// igangværende måned sammenlignes kun med de samme dage i forrige måned.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;

  // c: kontekst fra GB.app.ctx(). data: GB.store.data
  function generate(c, data, opts) {
    const o = opts || {};
    const calc = c.calc;
    const out = [];
    const cats = calc.categories;
    const name = (id) => (cats.get(id) ? cats.get(id).name : 'Ukendt');
    const lower = (s) => s.charAt(0).toLocaleLowerCase('da-DK') + s.slice(1);
    const txs = c.txs;
    if (!txs.length) return out;

    // 1. Ukategoriserede og usikre forslag i perioden
    const review = c.periodTxs.filter((t) => t.categorySource === 'unknown' || t.categorySource === 'suggested');
    if (review.length) {
      const unk = review.filter((t) => t.categorySource === 'unknown').length;
      out.push({
        kind: 'warn', icon: 'tag', prio: 5,
        text: unk ? 'Du har ' + unk + ' transaktion' + (unk === 1 ? '' : 'er') + ', der endnu ikke er kategoriseret.' : review.length + ' transaktion' + (review.length === 1 ? '' : 'er') + ' har kun en foreslået kategori og bør kontrolleres.',
        why: c.label + (unk && review.length > unk ? ' · desuden ' + (review.length - unk) + ' usikre forslag' : ''),
        action: { route: 'transactions', params: { review: true, from: c.range.from, to: c.range.to } },
      });
    }

    // 2. Ændringer i forbrug pr. kategori i forhold til forrige måned
    const curMk = U.monthKey(c.range.to > c.today ? c.today : c.range.to);
    const prevMk = U.addMonthKey(curMk, -1);
    const running = c.today >= U.monthStart(curMk) && c.today <= U.monthEnd(curMk);
    const lastDay = running ? U.parts(c.today).d : 31;
    const inMonth = (mk) => {
      const from = U.monthStart(mk);
      const to = U.iso(+mk.slice(0, 4), +mk.slice(5, 7), Math.min(lastDay, U.daysInMonth(+mk.slice(0, 4), +mk.slice(5, 7))));
      return { from, to, list: txs.filter((t) => t.date >= from && t.date <= to) };
    };
    const hasPrev = c.dataRange.from && c.dataRange.from <= U.addDays(U.monthStart(prevMk), 2);
    if (hasPrev) {
      const a = inMonth(curMk), b = inMonth(prevMk);
      const sa = calc.summarize(a.list), sb = calc.summarize(b.list);
      const scope = running ? ' (1.–' + lastDay + '. i begge måneder)' : '';
      const changes = [];
      for (const id of new Set([...sa.byCategory.keys(), ...sb.byCategory.keys()])) {
        const cur = sa.byCategory.get(id) || 0, prev = sb.byCategory.get(id) || 0;
        const ch = GB.analytics.change(cur, prev);
        if (prev >= 150 && Math.abs(ch.diff) >= 200 && ch.pct != null && Math.abs(ch.pct) >= 15 && id !== 'other-unknown') changes.push({ id, cur, prev, ch });
      }
      changes.sort((x, y) => Math.abs(y.ch.diff) - Math.abs(x.ch.diff));
      for (const x of changes.slice(0, 3)) {
        const more = x.ch.diff > 0;
        out.push({
          kind: more ? 'info' : 'good', icon: more ? 'up' : 'down', prio: 3,
          text: 'Du har brugt ' + U.fmtMoney(Math.abs(x.ch.diff), { decimals: 0 }) + (more ? ' mere' : ' mindre') + ' på ' + lower(name(x.id)) + ' end i ' + U.MONTHS[+prevMk.slice(5, 7) - 1] + '.',
          why: name(x.id) + ': ' + U.fmtMoney(x.cur, { decimals: 0 }) + ' i ' + U.fmtMonth(curMk) + ' mod ' + U.fmtMoney(x.prev, { decimals: 0 }) + ' i ' + U.fmtMonth(prevMk) + ' (' + (more ? '+' : '−') + U.fmtPct(Math.abs(x.ch.pct)) + ')' + scope,
          action: { route: 'transactions', params: { categoryId: x.id, from: b.from, to: a.to } },
        });
      }
    }

    // 3. Største udgiftsområder i perioden
    const sum = calc.summarize(c.periodTxs);
    const groups = [...sum.byGroup].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    if (groups.length >= 2 && sum.expense > 0) {
      const [g1, v1] = groups[0], [g2, v2] = groups[1];
      out.push({
        kind: 'info', icon: 'chart', prio: 2,
        text: name(g1) + ' er dit største udgiftsområde, og ' + lower(name(g2)) + ' er det næststørste.',
        why: c.label + ': ' + name(g1) + ' ' + U.fmtMoney(v1, { decimals: 0 }) + ' (' + U.fmtPct((v1 / sum.expense) * 100) + '), ' + name(g2) + ' ' + U.fmtMoney(v2, { decimals: 0 }) + ' (' + U.fmtPct((v2 / sum.expense) * 100) + ') af ' + U.fmtMoney(sum.expense, { decimals: 0 }) + ' i alt',
        action: { route: 'transactions', params: { categoryId: g1, from: c.range.from, to: c.range.to } },
      });
    }

    // 4. Streaming / abonnementer pr. måned
    const rec = data.recurring.filter((r) => r.status === 'confirmed' && r.categoryId === 'subs-streaming');
    if (rec.length) {
      const m = rec.reduce((s, r) => s + GB.recurring.monthlyEquivalent(r), 0);
      out.push({
        kind: 'info', icon: 'play', prio: 2,
        text: 'Dine registrerede streamingbetalinger udgør cirka ' + U.fmtMoney(m, { decimals: 0 }) + ' om måneden.',
        why: 'Ud fra ' + rec.length + ' bekræftede faste betalinger: ' + rec.map((r) => r.name).join(', '),
        action: { route: 'recurring' },
      });
    } else {
      const months = GB.budgets.completeMonths(c.dataRange, c.today, 3);
      if (months.length) {
        const from = U.monthStart(months[0]), to = U.monthEnd(months[months.length - 1]);
        const s = calc.spentIn(txs.filter((t) => t.date >= from && t.date <= to), 'subs-streaming');
        if (s > 0) out.push({
          kind: 'info', icon: 'play', prio: 1,
          text: 'Du bruger i gennemsnit cirka ' + U.fmtMoney(s / months.length, { decimals: 0 }) + ' om måneden på streaming.',
          why: 'Gennemsnit af ' + months.length + ' hele måned' + (months.length === 1 ? '' : 'er') + ' (' + U.fmtMonth(months[0], true) + ' – ' + U.fmtMonth(months[months.length - 1], true) + ')',
          action: { route: 'transactions', params: { categoryId: 'subs-streaming', from, to } },
        });
      }
    }

    // 5. Budgetter i den aktuelle måned
    const todayMk = U.monthKey(c.today);
    const ev = GB.budgets.evaluate(data.budgets, todayMk, txs, calc, c.settings.thresholds);
    if (ev.plan) {
      const daysLeft = U.daysBetween(c.today, U.monthEnd(todayMk));
      for (const l of ev.lines.filter((x) => x.level !== 'ok' && x.budget > 0).sort((a, b) => b.pct - a.pct).slice(0, 3)) {
        out.push({
          kind: 'warn', icon: 'target', prio: 4,
          text: l.level === 'over'
            ? 'Budgettet til ' + lower(name(l.line.categoryId)) + ' er overskredet med ' + U.fmtMoney(-l.left, { decimals: 0 }) + '.'
            : 'Dit budget til ' + lower(name(l.line.categoryId)) + ' er ' + U.fmtPct(l.pct) + ' brugt, og der er ' + daysLeft + ' dage tilbage af måneden.',
          why: U.capitalize(U.fmtMonth(todayMk)) + ': ' + U.fmtMoney(l.spent, { decimals: 0 }) + ' af ' + U.fmtMoney(l.budget, { decimals: 0 }),
          action: { route: 'transactions', params: { categoryId: l.line.categoryId, from: U.monthStart(todayMk), to: U.monthEnd(todayMk) } },
        });
      }
    }

    // 6. Ubekræftede faste betalinger
    if (!o.skipRecurring) {
      const sug = GB.recurring.detect(txs, data.recurring, calc, c.dataRange.to).filter((s) => !s.stale);
      if (sug.length) out.push({
        kind: 'info', icon: 'repeat', prio: 3,
        text: sug.length === 1 ? 'Der er fundet en mulig fast betaling, som du ikke har bekræftet endnu.' : 'Der er fundet ' + sug.length + ' mulige faste betalinger, som du ikke har bekræftet endnu.',
        why: 'Fx ' + sug.slice(0, 3).map((s) => s.name + ' (' + GB.recurring.FREQUENCIES[s.frequency].label.toLowerCase() + ')').join(', '),
        action: { route: 'recurring' },
      });
    }

    // 7. Mulige overførsler mellem egne konti
    const pairs = GB.analytics.findTransferPairs(c.periodTxs.filter((t) => calc.classify(t).type !== 'transfer'));
    if (pairs.length && data.accounts.length > 1) {
      out.push({
        kind: 'warn', icon: 'swap', prio: 4,
        text: pairs.length + ' mulige overførsler mellem dine egne konti er ikke markeret som interne.',
        why: 'Samme beløb ud af én konto og ind på en anden inden for 4 dage. Markér dem, så de ikke tælles som både indtægt og forbrug.',
        action: { route: 'transactions', params: { ids: pairs.flat().map((t) => t.id), pairs: true } },
      });
    }

    // 8. Fremmed valuta uden kurs og mulige dubletter
    if (sum.foreign) out.push({
      kind: 'warn', icon: 'alert', prio: 4, text: sum.foreign + ' transaktioner i fremmed valuta tælles ikke med, fordi der mangler en kurs.',
      why: 'Åbn transaktionen og angiv kursen til DKK. Grejs Budget henter ikke kurser fra internettet.',
      action: { route: 'transactions', params: { ids: c.periodTxs.filter((t) => calc.classify(t).type === 'foreign').map((t) => t.id) } },
    });
    const dups = c.periodTxs.filter((t) => t.duplicateOf && t.needsReview);
    if (dups.length) out.push({
      kind: 'warn', icon: 'copy', prio: 4, text: dups.length + ' mulige dubletter blev importeret og venter på din kontrol.',
      why: 'Du valgte at importere dem, selvom en ens transaktion fandtes i forvejen.',
      action: { route: 'transactions', params: { ids: dups.map((t) => t.id) } },
    });

    // 9. Opsparing
    if (sum.savings > 0) out.push({
      kind: 'good', icon: 'piggy', prio: 1, text: 'Du har sat ' + U.fmtMoney(sum.savings, { decimals: 0 }) + ' til side i perioden.',
      why: c.label + ': transaktioner i kategorierne Opsparing og Investering',
      action: { route: 'transactions', params: { ids: c.periodTxs.filter((t) => calc.classify(t).type === 'savings').map((t) => t.id) } },
    });

    return out.sort((a, b) => b.prio - a.prio);
  }

  GB.insights = { generate };
})();
