'use strict';
/* GREJS BASE BUILDER - ui.js: panels, auth, live events, boot */

/* =====================================================================
   UI PANELS
   ===================================================================== */
const UI = {
  cur: null,   // { w, render } - re-rendered when the server state changes
  panel(title, opts, render) {
    const w = Modal.open(title, '', Object.assign({}, opts, { onClose: () => { if (UI.cur && UI.cur.w === w) UI.cur = null; if (opts && opts.onClose) opts.onClose(); } }));
    UI.cur = { w: w, render: render, tab: opts && opts.tab };
    const tabs = $$('.tab', w);
    tabs.forEach(tb => tb.onclick = () => { Sound.play('click'); tabs.forEach(x => x.classList.toggle('on', x === tb)); UI.cur.tab = tb.dataset.tab; render(w, UI.cur.tab); });
    render(w, UI.cur.tab);
    return w;
  },
  refreshOpen() { if (UI.cur && UI.cur.live !== false && UI.cur.render && document.body.contains(UI.cur.w) && UI.cur.auto) UI.cur.render(UI.cur.w, UI.cur.tab); },
};
function lockedReason(t) {
  const th = D.unlockTH(t);
  if (th > S.me.th) return 'Town Hall ' + th;
  if (countBuilt(t) >= D.maxCount(t, S.me.th)) return 'Max built - upgrade Town Hall';
  return null;
}

/* ---- SHOP ---------------------------------------------------------------- */
UI.shop = function (tab) {
  const w = UI.panel('BUILD', { tabs: [['resources', 'RESOURCES'], ['army', 'ARMY'], ['defenses', 'DEFENSES'], ['traps', 'TRAPS']], tab: tab || 'defenses' }, function (w, tab) {
    const list = D.SHOP[tab];
    const res = displayRes();
    Modal.setBody(w, '<div class="grid">' + list.map(t => {
      const d = D.bdef(t), why = lockedReason(t), owned = countBuilt(t), max = D.maxCount(t, S.me.th);
      const c = D.cost(t, 1, owned), tm = D.buildTime(t, 1);
      const poor = res[c.r] < c.a;
      return '<div class="card shopcard ' + (why ? 'locked' : '') + '" data-t="' + t + '" style="cursor:' + (why ? 'not-allowed' : 'pointer') + '">' +
        '<div class="ct">' + esc(d.name) + '</div><canvas width="200" height="140"></canvas>' +
        '<div class="row" style="justify-content:space-between;font-weight:900;font-size:.85em"><span>' + (why ? '🔒 ' + why : 'Built ' + owned + '/' + max) + '</span><span>' + (tm ? '⏱ ' + fmtTime(tm) : '') + '</span></div>' +
        '<div class="row" style="justify-content:center;margin-top:.3em"><span class="pill" style="' + (poor ? 'color:#c0201a' : '') + '">' + icon(c.r) + fmt(c.a) + '</span></div></div>';
    }).join('') + '</div><div class="note center" style="margin-top:.8em">Free builders: ' + freeBuilders() + '/' + S.me.builders + ' · Walls, traps and hero altars are built instantly.</div>');
    $$('.shopcard', w).forEach(el => {
      const t = el.dataset.t;
      const cv = el.querySelector('canvas'), cx = cv.getContext('2d');
      cx.drawImage(buildingIcon(t, 1, 100), 0, 0, 200, 140);
      el.onclick = () => {
        const why = lockedReason(t);
        if (why) { Sound.play('error'); toast(why, 'bad'); return; }
        const tm = D.buildTime(t, 1);
        if (tm > 0 && freeBuilders() <= 0) { Sound.play('error'); toast('All builders are busy', 'bad'); return; }
        Sound.play('click'); startPlace(t);
      };
    });
  });
  UI.cur.auto = true;
  return w;
};

/* ---- BUILDING INFO ----------------------------------------------------- */
function statRows(t, lv) {
  const d = D.bdef(t), rows = [];
  rows.push(['Hitpoints', fmt(D.bhp(t, Math.max(1, lv)))]);
  if (d.atk) { const a = D.atkStats(t, lv); rows.push(['Damage per second', a.dps + (a.ramp ? ' (ramps up x8)' : '')], ['Range', a.range + (a.min ? ' (blind ' + a.min + ')' : '') + ' tiles'], ['Targets', a.ground && a.air ? 'Ground & Air' : a.air ? 'Air' : 'Ground']); if (a.splash) rows.push(['Splash', a.splash + ' tiles']); }
  if (d.trap) { const p = D.trapStats(t, lv); if (p.dmg) rows.push(['Damage', p.dmg]); if (p.cap) rows.push(['Launches up to', p.cap + ' housing']); if (p.freezeTicks) rows.push(['Freeze', (p.freezeTicks / 10).toFixed(1) + 's']); rows.push(['Targets', p.ground && p.air ? 'Ground & Air' : p.air ? 'Air' : 'Ground']); }
  if (d.prod) rows.push(['Production', fmt(D.production(t, lv)) + ' / hour']);
  const st = D.storage(t, lv);
  for (const r of D.RES) if (st[r]) rows.push(['Stores ' + (r === 'dark' ? 'Dark Elixir' : r[0].toUpperCase() + r.slice(1)), fmt(st[r])]);
  if (t === 'armycamp') rows.push(['Housing', D.armyCap(lv)]);
  if (t === 'spellfactory') rows.push(['Spell space', D.spellCap(lv)]);
  if (t === 'barracks' || t === 'darkbarracks') rows.push(['Unlocks', D.TROOPS.filter(id => !!D.tdef(id).dark === (t === 'darkbarracks') && D.tdef(id).bar <= lv).map(id => D.tdef(id).name).join(', ')]);
  if (t === 'blacksmith') rows.push(['Equipment max level', D.equipMax(lv)]);
  return rows;
}
UI.buildingInfo = function (b) {
  const d = D.bdef(b.t), lv = Math.max(1, b.lv);
  const max = b.t === 'townhall' ? D.MAX_TH : D.maxLevel(b.t, S.me.th);
  const cur = statRows(b.t, lv), nxt = lv < max ? statRows(b.t, lv + 1) : null;
  let html = '<div class="row" style="align-items:flex-start;gap:1em;flex-wrap:wrap"><canvas id="infoCv" width="240" height="170" style="width:12em;height:8.5em"></canvas><div style="flex:1;min-width:14em"><div class="note" style="font-size:1em;line-height:1.4">' + esc(d.desc || '') + '</div>';
  html += '<table style="width:100%;margin-top:.6em;border-collapse:collapse;font-weight:800">' + cur.map((r, i) => '<tr style="border-bottom:1px solid rgba(255,255,255,.1)"><td style="padding:.3em 0" class="muted">' + r[0] + '</td><td style="text-align:right">' + r[1] + (nxt && nxt[i] && nxt[i][1] !== r[1] ? ' <span style="color:#9cff6b">→ ' + nxt[i][1] + '</span>' : '') + '</td></tr>').join('') + '</table>';
  if (nxt) { const c = D.cost(b.t, lv + 1), tm = D.buildTime(b.t, lv + 1); html += '<div class="row" style="margin-top:.7em;gap:.5em"><span class="pill">Next level ' + (lv + 1) + '</span><span class="pill">' + icon(c.r) + fmt(c.a) + '</span>' + (tm ? '<span class="pill">⏱ ' + fmtTime(tm) + '</span>' : '<span class="pill">instant</span>') + '</div>'; }
  else html += '<div class="pill" style="margin-top:.7em">' + (lv >= D.maxLevel(b.t, D.MAX_TH) && b.t !== 'townhall' ? 'Max level' : 'Upgrade your Town Hall to go further') + '</div>';
  html += '</div></div>';
  const w = Modal.open(esc(d.name) + ' · LEVEL ' + b.lv, html, { size: 'mid' });
  $('#infoCv', w).getContext('2d').drawImage(buildingIcon(b.t, lv, 120), 0, 0, 240, 170);
};

/* ---- ARMY: troops, spells, laboratory --------------------------------- */
UI.army = function (tab) {
  const w = UI.panel('ARMY', { tabs: [['troops', 'TROOPS'], ['spells', 'SPELLS'], ['lab', 'LABORATORY']], tab: tab || 'troops' }, function (w, tab) {
    if (tab === 'lab') return labView(w);
    const kind = tab, me = S.me, isSp = kind === 'spells';
    const def = id => (isSp ? D.sdef(id) : D.tdef(id));
    const used = Object.keys(me.army[kind]).reduce((n, id) => n + me.army[kind][id] * def(id).housing, 0);
    const queued = me.queue[kind].reduce((n, q) => n + q.n * def(q.id).housing, 0);
    const cap = isSp ? me.spellCap : me.armyCap;
    const sn = serverNow();
    let left = 0;
    if (me.queue[kind].length && me.queue.tStart[kind] != null) {
      left = me.queue[kind].reduce((s, q) => s + q.n * def(q.id).time, 0) - (sn - me.queue.tStart[kind]) / 1000;
    }
    const ids = isSp ? D.SPELLS : D.TROOPS;
    const ready = id => isSp ? bestLv('spellfactory') >= D.sdef(id).fac : bestLv(D.tdef(id).dark ? 'darkbarracks' : 'barracks') >= D.tdef(id).bar;
    const why = id => isSp ? 'Spell Factory lv ' + D.sdef(id).fac : (D.tdef(id).dark ? 'Dark Barracks lv ' : 'Barracks lv ') + D.tdef(id).bar;
    const res = displayRes();
    let h = '<div class="capline">' + (isSp ? 'SPELLS' : 'ARMY CAMPS') + '<div class="bar"><i style="width:' + (cap ? clamp(used / cap * 100, 0, 100) : 0) + '%"></i></div>' + used + '/' + cap + (queued ? ' <span class="muted">(+' + queued + ' training)</span>' : '') + '</div>';
    if (!cap) h += '<div class="card" style="margin-bottom:.8em">' + (isSp ? 'Build a Spell Factory (Town Hall 5) to brew spells.' : 'Build an Army Camp to house troops.') + '</div>';
    h += '<div class="h" style="margin:.3em 0">READY</div><div class="qrow" id="armyRow">' + (Object.keys(me.army[kind]).filter(id => me.army[kind][id] > 0).map(id => '<div class="qitem" data-dismiss="' + id + '" title="' + esc(def(id).name) + '"><canvas width="64" height="64"></canvas><span class="n">x' + me.army[kind][id] + '</span><span class="x">✕</span></div>').join('') || '<span class="note">Nothing ready yet</span>') + '</div>';
    h += '<div class="row" style="margin:.6em 0 .3em"><span class="h">TRAINING</span><span class="spacer"></span>' + (left > 0 ? '<span class="pill">⏱ ' + fmtTime(left) + '</span>' : '') + '</div><div class="qrow">' +
      (me.queue[kind].map((q, i) => '<div class="qitem" data-untrain="' + i + '" title="Cancel (full refund)"><canvas width="64" height="64"></canvas><span class="n">x' + q.n + '</span><span class="x">−</span></div>').join('') || '<span class="note">Queue is empty - tap a ' + (isSp ? 'spell' : 'troop') + ' below</span>') + '</div>';
    h += '<div class="sep"></div><div class="grid">' + ids.map(id => {
      const d = def(id), lv = (isSp ? me.spellLv : me.troopLv)[id] || 1, ok = ready(id);
      const c = isSp ? D.spellBrewCost(id, lv) : D.troopTrainCost(id, lv);
      return '<div class="card tcard ' + (ok ? '' : 'locked') + '" data-train="' + id + '"><span class="lvtag">LV ' + lv + '</span><span class="housing">' + d.housing + '</span><canvas width="128" height="128"></canvas><div class="ct">' + esc(d.name) + '</div>' +
        (ok ? '<div class="row" style="justify-content:center;gap:.3em;margin-top:.2em"><span class="pill" style="' + (res[c.r] < c.a ? 'color:#c0201a' : '') + '">' + icon(c.r) + fmt(c.a) + '</span><span class="pill">⏱' + fmtTime(d.time) + '</span></div><div class="row" style="justify-content:center;gap:.3em;margin-top:.35em"><button class="btn small" data-n="1">+1</button><button class="btn small blue" data-n="5">+5</button></div>' : '<div class="note" style="color:#6a4a24;font-weight:900">🔒 ' + why(id) + '</div>') + '</div>';
    }).join('') + '</div>';
    Modal.setBody(w, h);
    $$('[data-dismiss] canvas', w).forEach(cv => cv.getContext('2d').drawImage(portrait(cv.parentNode.dataset.dismiss, 64), 0, 0));
    $$('[data-untrain] canvas', w).forEach(cv => cv.getContext('2d').drawImage(portrait(me.queue[kind][+cv.parentNode.dataset.untrain].id, 64), 0, 0));
    $$('.tcard canvas', w).forEach(cv => cv.getContext('2d').drawImage(portrait(cv.parentNode.dataset.train, 128), 0, 0));
    $$('.tcard', w).forEach(el => {
      const id = el.dataset.train;
      $$('[data-n]', el).forEach(btn => btn.onclick = async ev => { ev.stopPropagation(); Sound.play('click'); const r = await act('troops/train', { kind: kind, id: id, n: +btn.dataset.n }); if (r) Sound.play('coin'); });
    });
    $$('[data-untrain]', w).forEach(el => el.onclick = () => { Sound.play('click'); act('troops/untrain', { kind: kind, index: +el.dataset.untrain, n: 1 }); });
    $$('[data-dismiss]', w).forEach(el => el.onclick = async () => {
      const id = el.dataset.dismiss;
      if (!(await confirmBox('REMOVE?', 'Remove one ' + esc(def(id).name) + ' from your army? There is no refund.', 'REMOVE', 'red'))) return;
      act('troops/dismiss', { kind: kind, id: id, n: 1 });
    });
  });
  UI.cur.auto = true;
  return w;
};
function labView(w) {
  const me = S.me, labLv = bestLv('laboratory'), sn = serverNow(), res = displayRes();
  let h = '';
  if (!labLv) { Modal.setBody(w, '<div class="card">Build a Laboratory (Town Hall 3) to research stronger troops and spells.</div>'); return; }
  if (me.lab) {
    const d = D.tdef(me.lab.id) || D.sdef(me.lab.id), k = clamp((sn - me.lab.start) / (me.lab.end - me.lab.start), 0, 1);
    h += '<div class="card dark row" style="margin-bottom:.8em"><canvas id="labCur" width="96" height="96" style="width:3.5em;height:3.5em"></canvas><div style="flex:1"><div class="ct">Researching ' + esc(d.name) + ' → level ' + me.lab.to + '</div><div class="bar" style="margin-top:.3em"><i style="width:' + k * 100 + '%"></i></div></div><span class="pill">⏱ ' + fmtTime((me.lab.end - sn) / 1000) + '</span></div>';
  }
  h += '<div class="note" style="margin-bottom:.6em">Laboratory level ' + labLv + ' · one research at a time</div><div class="grid">';
  const entries = D.TROOPS.map(id => ['troop', id]).concat(D.SPELLS.map(id => ['spell', id]));
  for (const [kind, id] of entries) {
    const d = kind === 'troop' ? D.tdef(id) : D.sdef(id);
    const lv = (kind === 'troop' ? me.troopLv : me.spellLv)[id] || 1;
    const max = kind === 'troop' ? D.TROOP_MAX_LV : D.SPELL_MAX_LV;
    const unlocked = kind === 'troop' ? bestLv(d.dark ? 'darkbarracks' : 'barracks') >= d.bar : bestLv('spellfactory') >= d.fac;
    let foot;
    if (!unlocked) foot = '<div class="note" style="color:#6a4a24;font-weight:900">🔒 Unlock first</div>';
    else if (lv >= max) foot = '<div class="pill">MAX</div>';
    else {
      const u = kind === 'troop' ? D.troopUpgrade(id, lv + 1) : D.spellUpgrade(id, lv + 1);
      foot = labLv < u.lab ? '<div class="note" style="color:#6a4a24;font-weight:900">Needs Lab lv ' + u.lab + '</div>'
        : '<div class="row" style="justify-content:center;gap:.3em"><span class="pill" style="' + (res[u.r] < u.a ? 'color:#c0201a' : '') + '">' + icon(u.r) + fmt(u.a) + '</span><span class="pill">⏱' + fmtTime(u.time) + '</span></div><button class="btn small" style="margin-top:.35em" data-res="' + kind + ':' + id + '" ' + (me.lab ? 'disabled' : '') + '>RESEARCH</button>';
    }
    h += '<div class="card tcard ' + (unlocked ? '' : 'locked') + '"><span class="lvtag">LV ' + lv + '</span><canvas width="128" height="128" data-p="' + id + '"></canvas><div class="ct">' + esc(d.name) + '</div>' + foot + '</div>';
  }
  h += '</div>';
  Modal.setBody(w, h);
  $$('canvas[data-p]', w).forEach(cv => cv.getContext('2d').drawImage(portrait(cv.dataset.p, 128), 0, 0));
  if (me.lab) $('#labCur', w).getContext('2d').drawImage(portrait(me.lab.id, 96), 0, 0);
  $$('[data-res]', w).forEach(b => b.onclick = async () => { const [kind, id] = b.dataset.res.split(':'); Sound.play('click'); if (await act('lab/research', { kind: kind, id: id }, 'Research started')) Sound.play('build'); });
}

/* ---- HEROES + FORGE ---------------------------------------------------- */
UI.heroes = function (tab) {
  const w = UI.panel('HEROES', { tabs: [['heroes', 'HEROES'], ['forge', 'BLACKSMITH']], tab: tab || 'heroes' }, function (w, tab) {
    const me = S.me, sn = serverNow(), res = displayRes();
    if (tab === 'forge') {
      const bs = bestLv('blacksmith'), max = D.equipMax(bs);
      let h = '<div class="row wrap" style="margin-bottom:.8em;gap:.5em"><span class="pill">' + icon('shiny') + fmt(res.shiny) + '</span><span class="pill">' + icon('glowy') + fmt(res.glowy) + '</span><span class="pill">' + icon('starry') + fmt(res.starry) + '</span><span class="spacer"></span><span class="note">Win PvP attacks and campaign levels to earn Ore.</span></div>';
      if (!bs) h += '<div class="card" style="margin-bottom:.8em">Build a Blacksmith (Town Hall 6) to unlock Hero Equipment.</div>';
      h += '<div class="grid wide">' + D.EQUIPMENT.map(id => {
        const e = D.edef(id), lv = me.equipment[id] || 0, fx = D.equipEffect(id, Math.max(1, lv));
        const fxTxt = Object.keys(fx).map(k => k.replace(/([A-Z])/g, ' $1').toLowerCase() + ' ' + fx[k]).join(' · ');
        let foot;
        if (!lv) foot = '<div class="note" style="font-weight:900">🔒 Blacksmith lv ' + e.bs + '</div>';
        else if (lv >= max) foot = '<span class="pill">MAX for this Blacksmith</span>';
        else { const c = D.equipUpgrade(id, lv + 1); foot = '<div class="row wrap" style="gap:.3em">' + D.ORES.filter(o => c[o]).map(o => '<span class="pill" style="' + (res[o] < c[o] ? 'color:#ff8a7a' : '') + '">' + icon(o) + fmt(c[o]) + '</span>').join('') + '<span class="spacer"></span><button class="btn small" data-forge="' + id + '">FORGE</button></div>'; }
        return '<div class="card dark ' + (lv ? '' : 'locked') + '"><div class="row"><canvas width="96" height="96" data-eq="' + id + '" style="width:3.6em;height:3.6em"></canvas><div style="flex:1"><div class="ct">' + esc(e.name) + ' <span class="muted">' + (lv ? 'lv ' + lv + '/' + max : '') + '</span></div><div class="note">' + esc(e.desc) + '</div><div class="note" style="color:#9cff6b">' + esc(fxTxt) + '</div></div></div><div style="margin-top:.4em">' + foot + '</div></div>';
      }).join('') + '</div>';
      Modal.setBody(w, h);
      $$('canvas[data-eq]', w).forEach(cv => cv.getContext('2d').drawImage(equipIcon(cv.dataset.eq, 96), 0, 0));
      $$('[data-forge]', w).forEach(b => b.onclick = async () => { Sound.play('click'); if (await act('equipment/forge', { id: b.dataset.forge }, 'Equipment upgraded!')) Sound.play('done'); });
      return;
    }
    let h = '<div class="plist">';
    for (const id of D.HEROES) {
      const d = D.hdef(id), hs = me.heroes[id];
      if (!hs) {
        const alt = d.altar, th = D.unlockTH(alt);
        h += '<div class="card dark hero-card locked"><canvas width="160" height="160" data-h="' + id + '"></canvas><div><div class="ct" style="font-size:1.3em">' + esc(d.name) + '</div><div class="note">' + esc(d.desc) + '</div><div class="pill" style="margin-top:.5em">🔒 Build the ' + esc(D.bdef(alt).name) + ' (Town Hall ' + th + ', ' + fmt(D.bdef(alt).cost.c) + ' Dark Elixir)</div></div></div>';
        continue;
      }
      const st = D.heroStats(id, hs.lv, hs.equip.filter(Boolean).map(e => [e, me.equipment[e] || 1]));
      const max = D.heroMax(id, me.th), job = me.jobs.find(j => j.kind === 'h' && j.hero === id);
      let up;
      if (job) up = '<span class="pill">⏱ upgrading → ' + job.to + ' · ' + fmtTime((job.end - sn) / 1000) + '</span>';
      else if (hs.lv >= max) up = '<span class="pill">Max level for Town Hall ' + me.th + '</span>';
      else { const u = D.heroUpgrade(id, hs.lv + 1); up = '<button class="btn small" data-hup="' + id + '">UPGRADE <span class="cost">' + icon('dark') + fmt(u.a) + '</span> · ' + fmtTime(u.time) + '</button>'; }
      h += '<div class="card dark hero-card"><canvas width="160" height="160" data-h="' + id + '"></canvas><div><div class="row"><div class="ct" style="font-size:1.3em">' + esc(d.name) + '</div><span class="pill">LV ' + hs.lv + '/' + max + '</span></div>' +
        '<div class="statline"><span class="pill">❤ ' + fmt(st.hp) + '</span><span class="pill">⚔ ' + st.dps + ' dps</span><span class="pill">➶ ' + d.range + '</span><span class="pill">' + (d.target === 'defense' ? 'targets defenses' : 'targets anything') + '</span></div>' +
        '<div class="note"><b style="color:var(--gold)">' + esc(d.ability) + ':</b> ' + esc(d.abilityDesc) + '</div>' +
        '<div class="slots">' + [0, 1].map(s => { const e = hs.equip[s]; return '<div class="slot ' + (e ? 'filled' : '') + '" data-slot="' + id + ':' + s + '">' + (e ? '<canvas width="48" height="48" data-eq="' + e + '" style="width:1.6em;height:1.6em"></canvas>' + esc(D.edef(e).name) + ' lv' + (me.equipment[e] || 1) : '+ Equipment slot') + '</div>'; }).join('') + '</div>' +
        '<div style="margin-top:.5em">' + up + '</div>' + (job ? '<div class="note">Upgrading heroes sit out of battles and defense.</div>' : '') + '</div></div>';
    }
    h += '</div>';
    Modal.setBody(w, h);
    $$('canvas[data-h]', w).forEach(cv => { const c = cv.getContext('2d'); c.clearRect(0, 0, 160, 160); c.save(); c.translate(80, 140); drawUnitShape(c, cv.dataset.h, 0, 0, 1, performance.now() / 1000, 0, 2.6); c.restore(); });
    $$('canvas[data-eq]', w).forEach(cv => cv.getContext('2d').drawImage(equipIcon(cv.dataset.eq, 48), 0, 0));
    $$('[data-hup]', w).forEach(b => b.onclick = async () => { Sound.play('click'); if (await act('hero/upgrade', { id: b.dataset.hup }, 'Hero upgrade started')) Sound.play('build'); });
    $$('[data-slot]', w).forEach(el => el.onclick = () => { const [hero, slot] = el.dataset.slot.split(':'); pickEquipment(hero, +slot); });
  });
  UI.cur.auto = true;
  return w;
};
function pickEquipment(hero, slot) {
  const me = S.me, owned = D.EQUIPMENT.filter(e => me.equipment[e]);
  const w = Modal.open('EQUIP', owned.length ? '<div class="plist">' + owned.map(e => {
    const on = Object.keys(me.heroes).find(h => me.heroes[h].equip.includes(e));
    return '<div class="prow" data-e="' + e + '"><canvas width="64" height="64" data-eq="' + e + '"></canvas><div style="flex:1"><div class="nm">' + esc(D.edef(e).name) + ' lv' + me.equipment[e] + '</div><div class="sub">' + esc(D.edef(e).desc) + (on ? ' · on ' + esc(D.hdef(on).name) : '') + '</div></div></div>';
  }).join('') + '<div class="prow" data-e=""><div class="nm">Remove</div></div></div>' : '<div class="card">No equipment yet - build a Blacksmith.</div>', { size: 'narrow' });
  $$('canvas[data-eq]', w).forEach(cv => cv.getContext('2d').drawImage(equipIcon(cv.dataset.eq, 64), 0, 0));
  $$('[data-e]', w).forEach(el => el.onclick = async () => { Sound.play('click'); Modal.close(w); await act('hero/equip', { hero: hero, slot: slot, eq: el.dataset.e || null }); });
}

/* ---- ATTACK: find a player -------------------------------------------- */
function armySummary() {
  const me = S.me;
  const troops = Object.keys(me.army.troops).filter(k => me.army.troops[k] > 0);
  const heroes = Object.keys(me.heroes).filter(h => !heroBusy(h));
  const housing = troops.reduce((n, id) => n + me.army.troops[id] * D.tdef(id).housing, 0);
  return { troops: troops, heroes: heroes, housing: housing, empty: !troops.length && !heroes.length };
}
UI.attack = function () {
  const st = { page: 1, sort: 'trophies', filter: 'attackable', search: '' };
  const w = UI.panel('ATTACK', { tab: 'list' }, async function (w) {
    const a = armySummary();
    const head = '<div class="card dark row wrap" style="margin-bottom:.8em;gap:.8em"><div style="flex:1;min-width:12em"><div class="ct">FIND A PLAYER</div><div class="note">Real players from the server. Attack their saved base - they do not need to be online.</div>' +
      '<div class="note" style="margin-top:.3em;color:' + (a.empty ? '#ff8a7a' : '#9cff6b') + '">' + (a.empty ? '⚠ Your army is empty - train troops first!' : 'Army ready: ' + a.housing + '/' + S.me.armyCap + ' housing' + (a.heroes.length ? ' + ' + a.heroes.length + ' hero' + (a.heroes.length > 1 ? 'es' : '') : '')) + '</div></div>' +
      '<button class="btn big" id="findOpp" style="--c1:#ff7a3a;--c2:#b0300a" ' + (a.empty ? 'disabled' : '') + '>' + icon('dice') + ' FIND OPPONENT</button></div>' +
      '<div class="searchrow"><input id="pSearch" placeholder="Search player…" maxlength="16" value="' + esc(st.search) + '">' +
      '<select id="pSort"><option value="trophies">Trophies</option><option value="th">Town Hall</option><option value="level">Level</option><option value="online">Recently online</option><option value="name">Name</option></select>' +
      '<select id="pFilter"><option value="attackable">Attackable</option><option value="all">All players</option><option value="online">Online now</option></select></div>' +
      '<div id="pList" class="plist"><div class="note center">Loading players…</div></div><div class="pager" id="pPager"></div>';
    Modal.setBody(w, head);
    $('#pSort', w).value = st.sort; $('#pFilter', w).value = st.filter;
    $('#findOpp', w).onclick = () => { Sound.play('click'); startAttack(null); };
    let deb = null;
    $('#pSearch', w).oninput = e => { clearTimeout(deb); deb = setTimeout(() => { st.search = e.target.value.trim(); st.page = 1; load(); }, 350); };
    $('#pSort', w).onchange = e => { st.sort = e.target.value; st.page = 1; load(); };
    $('#pFilter', w).onchange = e => { st.filter = e.target.value; st.page = 1; load(); };
    async function load() {
      const box = $('#pList', w);
      if (!box) return;
      try {
        const q = '?page=' + st.page + '&sort=' + st.sort + (st.filter !== 'all' ? '&filter=' + st.filter : '') + (st.search ? '&search=' + encodeURIComponent(st.search) : '');
        const r = await Net.get('/players' + q);
        if (!document.body.contains(box)) return;
        box.innerHTML = r.players.length ? r.players.map(playerRow).join('') : '<div class="card center">No players found' + (st.filter === 'attackable' ? ' that you can attack right now. Try "All players".' : '.') + '</div>';
        paintIcons(box); bindPlayerRows(box, r.players);
        const pg = $('#pPager', w);
        pg.innerHTML = '<button class="btn small grey" data-p="-1" ' + (st.page <= 1 ? 'disabled' : '') + '>◀</button><span class="h">PAGE ' + r.page + ' / ' + r.pages + '</span><button class="btn small grey" data-p="1" ' + (st.page >= r.pages ? 'disabled' : '') + '>▶</button>';
        $$('[data-p]', pg).forEach(b => b.onclick = () => { st.page += +b.dataset.p; Sound.play('click'); load(); });
      } catch (e) { box.innerHTML = '<div class="card center">' + esc(e.message) + '</div>'; }
    }
    load();
  });
  return w;
};
function playerRow(p) {
  const status = p.online ? '<span class="dot on"></span>Online' : '<span class="dot"></span>' + (p.lastSeen ? ago(p.lastSeen) : 'offline');
  return '<div class="prow ' + (p.self ? 'me' : '') + '" data-pid="' + p.id + '"><canvas width="96" height="96" data-av="' + p.avatar + '"></canvas><div style="flex:1;min-width:0"><div class="nm">' + esc(p.name) + (p.self ? ' (you)' : '') + '</div>' +
    '<div class="sub"><span class="badge-th">TH' + p.th + '</span><span>' + icon('trophy') + fmt(p.trophies) + '</span><span>Lv ' + p.level + '</span><span>' + status + '</span>' + (p.shielded ? '<span>' + icon('shield') + 'shield</span>' : '') + '</div></div>' +
    (p.self ? '' : '<button class="btn" style="--c1:#ff7a3a;--c2:#b0300a" data-atk="' + p.id + '" ' + (p.attackable ? '' : 'disabled title="' + esc(p.reason || '') + '"') + '>ATTACK</button>') + '</div>';
}
function bindPlayerRows(box, players) {
  $$('canvas[data-av]', box).forEach(cv => drawAvatar(cv, +cv.dataset.av));
  $$('[data-atk]', box).forEach(b => b.onclick = ev => { ev.stopPropagation(); Sound.play('click'); startAttack(b.dataset.atk); });
  $$('[data-pid]', box).forEach(r => r.onclick = () => { Sound.play('click'); UI.profile(r.dataset.pid); });
  $$('[data-atk][disabled]', box).forEach(b => { b.parentNode.title = b.title; });
}
async function startAttack(target) {
  if (armySummary().empty) { toast('Train some troops first!', 'bad'); Sound.play('error'); return; }
  toast(target ? 'Preparing battle…' : 'Searching for an opponent…');
  try {
    const d = target ? await Net.post('/attack/start', { target: target }) : await Net.post('/attack/find');
    Battle.start(d, 'pvp');
  } catch (e) { Sound.play('error'); toast(esc(e.message), 'bad'); }
}

/* ---- PROFILE ------------------------------------------------------------ */
UI.profile = async function (id) {
  const me = S.me;
  if (!id || id === me.id) return UI.myProfile();
  let p;
  try { p = await Net.get('/player/' + id); } catch (e) { toast(esc(e.message), 'bad'); return; }
  const w = Modal.open('PLAYER PROFILE', '<div class="row" style="gap:1em;flex-wrap:wrap"><canvas width="160" height="160" id="pfAv" style="width:7em;height:7em;border-radius:1em"></canvas><div style="flex:1"><div class="h" style="font-size:1.8em">' + esc(p.name) + '</div>' +
    '<div class="row wrap" style="gap:.4em;margin:.3em 0"><span class="badge-th">TH' + p.th + '</span><span class="pill">' + icon('trophy') + fmt(p.trophies) + '</span><span class="pill">Level ' + p.level + '</span><span class="pill">' + (p.online ? '<span class="dot on"></span>Online' : '<span class="dot"></span>' + ago(p.lastSeen)) + '</span></div>' +
    '<div class="note">Best trophies ' + fmt(p.bestTrophies) + ' · Campaign ' + p.campaignStars + '/600 ★ · Playing since ' + new Date(p.createdAt).toLocaleDateString() + '</div></div></div>' +
    '<div class="grid" style="margin-top:1em">' + [['Total attacks', p.stats.attacks], ['Attack wins', p.stats.attackWins], ['Defenses', p.stats.defenses], ['Defense wins', p.stats.defenseWins]].map(r => '<div class="card center"><div class="note" style="color:#6a4a24;font-weight:900">' + r[0] + '</div><div class="h" style="font-size:1.6em;color:#3a2410;text-shadow:none">' + fmt(r[1]) + '</div></div>').join('') + '</div>' +
    (Object.keys(p.heroes).length ? '<div class="row wrap" style="margin-top:.8em;gap:.4em">' + Object.keys(p.heroes).map(h => '<span class="pill">' + icon('crown') + esc(D.hdef(h).name) + ' lv' + p.heroes[h] + '</span>').join('') + '</div>' : '') +
    '<div class="center" style="margin-top:1em">' + (p.attackable ? '<button class="btn big" style="--c1:#ff7a3a;--c2:#b0300a" id="pfAtk">' + icon('attack') + ' ATTACK</button>' : '<div class="pill">' + esc(p.reason || '') + '</div>') + '</div>', { size: 'mid' });
  drawAvatar($('#pfAv', w), p.avatar);
  const b = $('#pfAtk', w); if (b) b.onclick = () => { Sound.play('click'); startAttack(p.id); };
};
UI.myProfile = function () {
  const w = UI.panel('PROFILE', { tabs: [['me', 'PROFILE'], ['ach', 'ACHIEVEMENTS']], tab: 'me' }, function (w, tab) {
    const me = S.me;
    if (tab === 'ach') {
      Modal.setBody(w, '<div class="plist">' + D.ACH.map(a => {
        const done = me.ach[a.id] | 0, val = me.achValues[a.id] || 0, max = a.tiers.length;
        const goal = a.tiers[Math.min(done, max - 1)], ready = done < max && val >= goal;
        const rw = done < max ? D.ACH_REWARD[done] : null;
        return '<div class="card ach"><div class="tier">' + starsHtml(done, max) + '</div><div style="flex:1"><div class="ct">' + esc(a.name) + '</div><div class="note" style="color:#6a4a24">' + esc(a.desc.replace('{n}', fmt(goal))) + '</div><div class="bar" style="margin-top:.3em"><i style="width:' + clamp(val / goal * 100, 0, 100) + '%"></i></div></div>' +
          (done >= max ? '<span class="pill">DONE</span>' : '<div class="center"><div class="row" style="gap:.2em;justify-content:center;font-size:.8em">' + Object.keys(rw).map(k => '<span class="pill">' + icon(k) + fmt(rw[k]) + '</span>').join('') + '</div><button class="btn small" data-claim="' + a.id + '" ' + (ready ? '' : 'disabled') + ' style="margin-top:.3em">CLAIM</button></div>') + '</div>';
      }).join('') + '</div>');
      $$('[data-claim]', w).forEach(b => b.onclick = async () => { Sound.play('click'); if (await act('achievements/claim', { id: b.dataset.claim }, 'Reward claimed!')) Sound.play('done'); });
      return;
    }
    const s = me.stats;
    Modal.setBody(w, '<div class="row" style="gap:1em;flex-wrap:wrap"><canvas width="160" height="160" id="myAv" style="width:7em;height:7em;border-radius:1em"></canvas><div style="flex:1"><div class="h" style="font-size:1.8em">' + esc(me.name) + '</div>' +
      '<div class="row wrap" style="gap:.4em;margin:.3em 0"><span class="badge-th">TH' + me.th + '</span><span class="pill">' + icon('trophy') + fmt(me.trophies) + ' (best ' + fmt(me.bestTrophies) + ')</span><span class="pill">Level ' + me.level + ' · ' + me.levelInfo.into + '/' + me.levelInfo.need + ' xp</span><span class="pill">★ ' + me.campaignStars + '/600</span></div></div></div>' +
      '<div class="h" style="margin:.8em 0 .3em">AVATAR</div><div class="row wrap" style="gap:.4em" id="avPick">' + AV.map((a, i) => '<canvas width="80" height="80" data-av="' + i + '" style="width:3em;height:3em;border-radius:.6em;cursor:pointer;' + (i === me.avatar ? 'box-shadow:0 0 0 3px var(--gold)' : 'opacity:.75') + '"></canvas>').join('') + '</div>' +
      '<div class="grid" style="margin-top:1em">' + [['Total attacks', s.attacks], ['Total wins', s.attackWins], ['Defenses', s.defenses], ['Defense wins', s.defenseWins], ['Gold looted', s.goldLooted], ['Elixir looted', s.elixirLooted], ['Campaign wins', s.campaignWins || 0]].map(r => '<div class="card center"><div class="note" style="color:#6a4a24;font-weight:900">' + r[0] + '</div><div class="h" style="font-size:1.4em;color:#3a2410;text-shadow:none">' + fmt(r[1]) + '</div></div>').join('') + '</div>' +
      '<div class="row wrap" style="justify-content:center;gap:.6em;margin-top:1em"><button class="btn purple" id="pfLog">BATTLE LOG</button><button class="btn blue" id="pfPw">CHANGE PASSWORD</button><button class="btn red" id="pfOut">LOG OUT</button></div>');
    drawAvatar($('#myAv', w), me.avatar);
    $$('#avPick canvas', w).forEach(cv => { drawAvatar(cv, +cv.dataset.av); cv.onclick = () => { Sound.play('click'); act('profile/avatar', { avatar: +cv.dataset.av }); }; });
    $('#pfLog', w).onclick = () => { Modal.close(w); UI.log('attacks'); };
    $('#pfOut', w).onclick = () => App.logout();
    $('#pfPw', w).onclick = () => changePassword();
  });
  UI.cur.auto = true;
  return w;
};
function changePassword() {
  const w = Modal.open('CHANGE PASSWORD', '<form id="pwForm" style="display:flex;flex-direction:column;gap:.6em"><div class="field"><label>Current password</label><input type="password" name="current" autocomplete="current-password" required></div><div class="field"><label>New password (min 8)</label><input type="password" name="password" minlength="8" autocomplete="new-password" required></div><div class="err" id="pwErr"></div><button class="btn" type="submit">SAVE</button></form>', { size: 'narrow' });
  $('#pwForm', w).onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    try { await Net.post('/auth/password', { current: f.elements.namedItem('current').value, password: f.elements.namedItem('password').value }); toast('Password changed - other devices were logged out', 'good'); Modal.close(w); }
    catch (err) { $('#pwErr', w).textContent = err.message; }
  };
}

/* ---- LEADERBOARD ---------------------------------------------------------- */
UI.leaderboard = function () {
  UI.panel('LEADERBOARD', { tabs: [['trophies', 'TROPHIES'], ['level', 'LEVEL'], ['th', 'TOWN HALL'], ['campaign', 'CAMPAIGN']], tab: 'trophies' }, async function (w, by) {
    Modal.setBody(w, '<div class="note center">Loading…</div>');
    try {
      const r = await Net.get('/leaderboard?by=' + by);
      if (!UI.cur || UI.cur.tab !== by) return;
      const val = p => by === 'trophies' ? icon('trophy') + fmt(p.trophies) : by === 'level' ? 'Lv ' + p.level : by === 'th' ? 'TH ' + p.th + ' · ' + icon('trophy') + fmt(p.trophies) : '★ ' + p.campaignStars;
      const row = (p, me) => '<div class="prow ' + (me || p.id === S.me.id ? 'me' : '') + '" data-pid="' + p.id + '"><span class="rank r' + p.rank + '">' + p.rank + '</span><canvas width="96" height="96" data-av="' + (p.avatar || 0) + '"></canvas><div style="flex:1;min-width:0"><div class="nm">' + esc(p.name) + '</div><div class="sub"><span class="badge-th">TH' + p.th + '</span>' + (p.online ? '<span><span class="dot on"></span> online</span>' : '') + '</div></div><div class="h" style="color:#3a2410;text-shadow:none;font-size:1.15em">' + val(p) + '</div></div>';
      Modal.setBody(w, '<div class="plist">' + r.top.map(p => row(p)).join('') + '</div>' + (r.me && r.me.rank > r.top.length ? '<div class="sep"></div>' + row(Object.assign({ avatar: S.me.avatar }, r.me), true) : ''));
      bindPlayerRows(Modal.body(w), []);
    } catch (e) { Modal.setBody(w, '<div class="card center">' + esc(e.message) + '</div>'); }
  });
};

/* ---- BATTLE LOG ------------------------------------------------------------- */
UI.log = function (tab) {
  UI.panel('BATTLE LOG', { tabs: [['defenses', 'DEFENSES'], ['attacks', 'ATTACKS'], ['campaign', 'CAMPAIGN']], tab: tab || (S.unseen ? 'defenses' : 'attacks') }, async function (w, type) {
    Modal.setBody(w, '<div class="note center">Loading…</div>');
    try {
      const r = await Net.get('/battles?type=' + type);
      if (!UI.cur || UI.cur.tab !== type) return;
      if (!r.battles.length) { Modal.setBody(w, '<div class="card center">Nothing here yet.</div>'); return; }
      Modal.setBody(w, '<div class="plist">' + r.battles.map(b => logRow(b, type)).join('') + '</div>');
      bindLog(w);
      if (type === 'defenses' && S.unseen) { S.unseen = 0; Net.post('/notifications/seen').catch(() => {}); }
    } catch (e) { Modal.setBody(w, '<div class="card center">' + esc(e.message) + '</div>'); }
  });
};
function logRow(b, type) {
  const when = new Date(b.at).toLocaleString();
  if (type === 'campaign') return '<div class="prow"><div style="flex:1"><div class="nm">' + esc(b.level.name) + '</div><div class="sub">' + when + ' · ' + b.pct + '%' + (b.newStars ? ' · +' + b.newStars + ' new ★' : '') + '</div></div>' + starsHtml(b.stars) + '</div>';
  const def = type === 'defenses';
  const other = def ? b.attacker : b.defender;
  const won = def ? b.stars === 0 : b.stars > 0;
  const loot = ['gold', 'elixir', 'dark'].filter(r => b.loot[r]).map(r => '<span>' + icon(r) + (def ? '-' : '+') + fmt(b.loot[r]) + '</span>').join(' ');
  const tr = def ? b.trophies : b.trophies;
  return '<div class="prow" style="' + (won ? '' : 'background:linear-gradient(180deg,#f7d4c4,#e2a896)') + '"><canvas width="96" height="96" data-av="' + (other.avatar || 0) + '"></canvas><div style="flex:1;min-width:0"><div class="nm">' + (def ? 'Attacked by ' : 'You attacked ') + esc(other.name) + ' <span class="badge-th">TH' + other.th + '</span></div>' +
    '<div class="sub"><span>' + when + '</span><span>' + b.pct + '% destroyed</span><span>' + icon('trophy') + (tr > 0 ? '+' : '') + tr + '</span>' + loot + '</div></div>' + starsHtml(b.stars) +
    '<button class="btn small blue" data-replay="' + b.id + '">' + icon('eye') + ' REPLAY</button></div>';
}
function bindLog(w) {
  $$('canvas[data-av]', w).forEach(cv => drawAvatar(cv, +cv.dataset.av));
  $$('[data-replay]', w).forEach(b => b.onclick = () => { Sound.play('click'); watchReplay(b.dataset.replay); });
}
async function watchReplay(id) {
  try {
    const r = await Net.get('/battle/' + id + '/replay');
    Battle.start({ id: id, base: r.base, army: r.army, lootPer: r.lootPer, lootTotal: null, maxTicks: D.BATTLE_TICKS }, 'replay', { cmds: r.cmds, endTick: r.endTick, summary: r.summary });
  } catch (e) { toast(esc(e.message), 'bad'); }
}

/* ---- BATTLE RESULT ------------------------------------------------------- */
UI.battleResult = function (r, b) {
  const won = r.stars > 0;
  let body = '<div class="victory ' + (won ? '' : 'lose') + '">' + (won ? 'VICTORY!' : 'DEFEAT') + '</div>' +
    '<div class="result-stars">' + [0, 1, 2].map(() => ICONS.star).join('') + '</div><div class="big-pct">' + r.pct + '% <span style="font-size:.5em" class="muted">DESTROYED</span></div>';
  if (r.kind === 'pvp') {
    body += '<div class="sep"></div><div class="center note h">LOOT</div><div class="lootline">' + ['gold', 'elixir', 'dark'].map(k => '<span>' + icon(k) + '+' + fmt(r.loot[k]) + '</span>').join('') + '</div>' +
      '<div class="lootline" style="margin-top:.4em"><span>' + icon('trophy') + (r.trophies > 0 ? '+' : '') + r.trophies + '</span>' + D.ORES.filter(o => r.ore[o]).map(o => '<span>' + icon(o) + '+' + r.ore[o] + '</span>').join('') + '</div>';
  } else if (r.kind === 'campaign') {
    const rw = r.reward || {};
    const items = Object.keys(rw).filter(k => k !== 'xp' && rw[k] > 0);
    body += '<div class="sep"></div><div class="center note h">' + (r.newStars ? 'REWARD FOR ' + r.newStars + ' NEW STAR' + (r.newStars > 1 ? 'S' : '') : 'NO NEW STARS - NO REWARD') + '</div>' + (items.length ? '<div class="lootline">' + items.map(k => '<span>' + icon(k) + '+' + fmt(rw[k]) + '</span>').join('') + '</div>' : '');
  }
  const used = r.used && r.used.troops ? Object.keys(r.used.troops) : [];
  if (used.length) body += '<div class="center note" style="margin-top:.6em">Troops used: ' + used.map(id => r.used.troops[id] + ' ' + esc(D.tdef(id).name)).join(', ') + '</div>';
  body += '<div class="row" style="justify-content:center;gap:1em;margin-top:1em">' + (r.kind === 'pvp' ? '<button class="btn blue" data-rp>' + icon('eye') + ' REPLAY</button>' : '') + '<button class="btn big" data-home>RETURN HOME</button></div>';
  const w = Modal.open(r.kind === 'campaign' ? esc(b.data.level.name) : 'BATTLE RESULT', body, { size: 'narrow', onClose: () => { if (S.scene === 'battle' && Battle.b && Battle.b.ended) Battle.exit(); } });
  const stars = $$('.result-stars .star', w);
  stars.forEach((s, i) => { if (i < r.stars) setTimeout(() => { s.classList.add('on'); Sound.play('star'); }, 400 + i * 450); });
  Sound.play(won ? 'victory' : 'defeat');
  w.querySelector('[data-home]').onclick = () => Modal.close(w);
  const rp = w.querySelector('[data-rp]');
  if (rp) rp.onclick = () => { Modal.stack.pop(); w.remove(); Battle.exit(); watchReplay(r.id); };
};

/* ---- NOTIFICATIONS: "YOUR BASE WAS ATTACKED!" ------------------------------ */
UI.attacked = function (list) {
  if (!list.length) return;
  const w = Modal.open('YOUR BASE WAS ATTACKED!', '<div class="plist">' + list.map(d => {
    const lost = ['gold', 'elixir', 'dark'].filter(r => d.loot[r]).map(r => '<span>' + icon(r) + '-' + fmt(d.loot[r]) + '</span>').join(' ');
    return '<div class="card dark"><div class="row"><canvas width="96" height="96" data-av="' + (d.attacker.avatar || 0) + '" style="width:3em;height:3em;border-radius:.6em"></canvas><div style="flex:1"><div class="note">Attacker</div><div class="ct" style="font-size:1.25em">' + esc(d.attacker.name) + ' <span class="badge-th">TH' + d.attacker.th + '</span></div><div class="note">' + ago(d.at) + '</div></div>' + starsHtml(d.stars) + '</div>' +
      '<div class="row wrap" style="gap:.8em;margin-top:.5em;font-family:var(--font-h)"><span>' + d.pct + '% destroyed</span>' + (lost || '<span>No loot lost</span>') + '<span>' + icon('trophy') + (d.trophies > 0 ? '+' : '') + d.trophies + '</span><span class="spacer"></span><button class="btn small blue" data-replay="' + d.id + '">VIEW BATTLE</button></div>' +
      (d.stars === 0 ? '<div class="note" style="color:#9cff6b;margin-top:.3em">Your defenses held! 🛡</div>' : '') + '</div>';
  }).join('') + '</div><div class="center" style="margin-top:1em"><button class="btn" data-ok>OK</button></div>', { size: 'mid', onClose: () => { S.unseen = 0; Net.post('/notifications/seen').catch(() => {}); } });
  bindLog(w);
  w.querySelector('[data-ok]').onclick = () => Modal.close(w);
  Sound.play('alarm');
};

/* ---- CAMPAIGN -------------------------------------------------------------- */
function worldStars(w) { let n = 0; for (let l = 1; l <= D.LEVELS_PER_WORLD; l++) n += S.me.camp[w + '_' + l] | 0; return n; }
function levelOpen(w, l) {
  if (S.me.th < D.worldReqTH(w)) return false;
  if (w === 1 && l === 1) return true;
  const prev = l > 1 ? w + '_' + (l - 1) : (w - 1) + '_' + D.LEVELS_PER_WORLD;
  return (S.me.camp[prev] | 0) > 0;
}
UI.campaign = function () {
  UI.panel('CAMPAIGN', { tab: 'map' }, function render(w, tab) {
    const view = UI.cur.world;
    if (!view) {
      Modal.setBody(w, '<div class="row" style="margin-bottom:.8em"><div class="note" style="flex:1">Single player · 20 worlds · 200 levels · every 10th level is a boss. Your army is used up in battle.</div><span class="pill" style="font-size:1.1em">★ ' + S.me.campaignStars + ' / 600</span></div><div class="worlds">' + D.WORLDS.map((wd, i) => {
        const n = i + 1, open = levelOpen(n, 1), st = worldStars(n);
        return '<div class="world ' + (open ? '' : 'locked') + '" data-w="' + n + '" style="background:linear-gradient(160deg,' + wd.sky + ' 0%,' + wd.ground + ' 55%,' + shade(wd.ground, -0.35) + ' 100%)"><span class="wnum">' + n + '</span>' + (open ? '' : '<span class="lock">🔒 ' + (S.me.th < D.worldReqTH(n) ? 'TH ' + D.worldReqTH(n) : 'locked') + '</span>') + '<div class="wn">' + esc(wd.name) + '</div><div class="ws">★ ' + st + '/30</div></div>';
      }).join('') + '</div>');
      $$('[data-w]', w).forEach(el => el.onclick = () => {
        const n = +el.dataset.w;
        if (!levelOpen(n, 1)) { Sound.play('error'); toast(S.me.th < D.worldReqTH(n) ? 'Requires Town Hall ' + D.worldReqTH(n) : 'Beat the previous world first', 'bad'); return; }
        Sound.play('click'); UI.cur.world = n; render(w);
      });
      return;
    }
    const wd = D.WORLDS[view - 1];
    let h = '<div class="row" style="margin-bottom:.4em"><button class="btn small grey" id="cBack">◀ WORLDS</button><div class="h" style="flex:1;font-size:1.3em;text-align:center">' + view + '. ' + esc(wd.name) + '</div><span class="pill">★ ' + worldStars(view) + '/30</span></div>' +
      '<div class="levels" style="border-radius:1em;background:linear-gradient(180deg,' + rgba(wd.sky, .5) + ',' + rgba(wd.ground, .6) + ')">';
    let nextSet = false;
    for (let l = 1; l <= D.LEVELS_PER_WORLD; l++) {
      const st = S.me.camp[view + '_' + l] | 0, open = levelOpen(view, l), boss = l === D.LEVELS_PER_WORLD;
      const next = open && !st && !nextSet; if (next) nextSet = true;
      h += '<div class="lnode ' + (boss ? 'boss ' : '') + (open ? '' : 'locked ') + (next ? 'next' : '') + '" data-l="' + l + '"><div class="disc">' + (boss ? '☠' : l) + '</div>' + starsHtml(st) + '</div>';
    }
    h += '</div>';
    Modal.setBody(w, h);
    $('#cBack', w).onclick = () => { Sound.play('click'); UI.cur.world = null; render(w); };
    $$('[data-l]', w).forEach(el => el.onclick = () => {
      const l = +el.dataset.l;
      if (!levelOpen(view, l)) { Sound.play('error'); toast('Beat the previous level first', 'bad'); return; }
      Sound.play('click'); levelPreview(view, l);
    });
  });
  UI.cur.auto = true;
};
async function levelPreview(w, l) {
  let lv;
  try { lv = await Net.get('/campaign/level/' + w + '/' + l); } catch (e) { toast(esc(e.message), 'bad'); return; }
  const st = S.me.camp[w + '_' + l] | 0;
  const counts = {};
  for (const b of lv.base.buildings) if (D.bdef(b.t).cat !== 'trap' && b.t !== 'wall') counts[b.t] = (counts[b.t] || 0) + 1;
  const walls = lv.base.buildings.filter(b => b.t === 'wall').length;
  const rw = Object.keys(lv.reward).filter(k => k !== 'xp' && lv.reward[k] > 0);
  const a = armySummary();
  const m = Modal.open(esc(lv.name), '<div class="row" style="justify-content:center">' + starsHtml(st) + '</div>' +
    '<canvas id="lvPrev" width="520" height="280" style="width:100%;height:auto;border-radius:1em;margin:.5em 0;background:' + D.WORLDS[w - 1].ground + '"></canvas>' +
    '<div class="row wrap" style="gap:.3em">' + Object.keys(counts).map(t => '<span class="pill">' + counts[t] + '× ' + esc(D.bdef(t).name) + '</span>').join('') + (walls ? '<span class="pill">' + walls + '× Wall</span>' : '') + '</div>' +
    '<div class="sep"></div><div class="note center">' + (st >= 3 ? 'All rewards collected - play for fun!' : 'Rewards are paid per new star (⅓ each):') + '</div><div class="lootline" style="margin-top:.3em">' + rw.map(k => '<span>' + icon(k) + fmt(lv.reward[k]) + '</span>').join('') + '</div>' +
    '<div class="note center" style="margin-top:.6em;color:' + (a.empty ? '#ff8a7a' : '#9cff6b') + '">' + (a.empty ? 'Your army is empty - train troops first!' : 'Your army: ' + a.housing + ' housing' + (a.heroes.length ? ' + ' + a.heroes.length + ' hero(es)' : '')) + '</div>' +
    '<div class="center" style="margin-top:.8em"><button class="btn big" id="lvGo" style="--c1:#ff7a3a;--c2:#b0300a" ' + (a.empty ? 'disabled' : '') + '>' + icon('attack') + ' ATTACK</button></div>', { size: 'mid' });
  previewBase($('#lvPrev', m), lv.base, D.WORLDS[w - 1]);
  $('#lvGo', m).onclick = async () => {
    Sound.play('click');
    try { const d = await Net.post('/campaign/start', { w: w, l: l }); Battle.start(d, 'campaign', { level: { w: w, l: l } }); }
    catch (e) { Sound.play('error'); toast(esc(e.message), 'bad'); }
  };
}
function previewBase(cv, base, theme) {
  const c = cv.getContext('2d');
  const sc = cv.width / (D.GRID * TW) * 0.98;
  c.save(); c.translate(cv.width / 2, 8); c.scale(sc, sc);
  poly(c, [iso(0, 0), iso(D.GRID, 0), iso(D.GRID, D.GRID), iso(0, D.GRID)], theme.ground2, 'rgba(0,0,0,.2)', 4);
  const list = base.buildings.filter(b => D.bdef(b.t).cat !== 'trap').slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
  for (const b of list) {
    const [wx, wy] = iso(b.x, b.y);
    if (b.t === 'wall') blit(c, wallSprite(b.lv, 0), wx, wy);
    else blit(c, spriteFor(b.t, b.lv, 3, false), wx, wy);
  }
  c.restore();
}

/* ---- SETTINGS ----------------------------------------------------------------- */
UI.settings = function () {
  const w = Modal.open('SETTINGS', '<div style="display:flex;flex-direction:column;gap:.9em;font-weight:800">' +
    '<label class="row">Sound effects<span class="spacer"></span><input type="range" min="0" max="1" step="0.05" id="sSound" value="' + SET.sound + '"></label>' +
    '<label class="row">Music<span class="spacer"></span><input type="range" min="0" max="1" step="0.05" id="sMusic" value="' + SET.music + '"></label>' +
    '<label class="row">Graphics<span class="spacer"></span><select id="sQual"><option value="high">High</option><option value="low">Low (faster)</option></select></label>' +
    '<label class="row">Screen shake<span class="spacer"></span><input type="checkbox" id="sShake" ' + (SET.shake ? 'checked' : '') + '></label>' +
    '<label class="row">Damage numbers<span class="spacer"></span><input type="checkbox" id="sNum" ' + (SET.numbers ? 'checked' : '') + '></label>' +
    '<div class="sep"></div><div class="note">Logged in as <b>' + esc(S.me.name) + '</b>. Your village, army and progress are stored on the Grejs server - these settings are the only thing kept in this browser.</div>' +
    '<div class="note">Server: ' + esc(API) + '</div>' +
    '<div class="row" style="justify-content:center;gap:.8em"><button class="btn blue" id="sHelp">HOW TO PLAY</button><button class="btn red" id="sOut">LOG OUT</button></div></div>', { size: 'narrow' });
  $('#sQual', w).value = SET.quality;
  $('#sSound', w).oninput = e => { SET.sound = +e.target.value; Sound.volumes(); saveSettings(); };
  $('#sSound', w).onchange = () => Sound.play('coin');
  $('#sMusic', w).oninput = e => { SET.music = +e.target.value; Sound.volumes(); saveSettings(); };
  $('#sQual', w).onchange = e => { SET.quality = e.target.value; saveSettings(); SPR.clear(); PORT.clear(); GLOW.clear(); resize(); makeGround(S.scene === 'battle' && Battle.b ? Battle.b.theme : homeTheme()); };
  $('#sShake', w).onchange = e => { SET.shake = e.target.checked; saveSettings(); };
  $('#sNum', w).onchange = e => { SET.numbers = e.target.checked; saveSettings(); };
  $('#sOut', w).onclick = () => App.logout();
  $('#sHelp', w).onclick = () => UI.help();
};
UI.help = function () {
  Modal.open('HOW TO PLAY', '<div style="line-height:1.6;font-weight:700">' +
    '<p><b style="color:var(--gold)">BUILD</b> - open the shop, place buildings (green = OK, red = blocked). Builders do one job each. Drag a selected building to move it.</p>' +
    '<p><b style="color:var(--gold)">RESOURCES</b> - mines and collectors fill your storages while you are away. Bigger storages, bigger loot for attackers too!</p>' +
    '<p><b style="color:var(--gold)">ARMY</b> - train troops in the Barracks, brew spells, research upgrades in the Laboratory.</p>' +
    '<p><b style="color:var(--gold)">ATTACK</b> - pick a real player from the list or let FIND OPPONENT match you. Tap outside their base to deploy. 50% destruction, the Town Hall and 100% each give a star. Loot and trophies are calculated by the server.</p>' +
    '<p><b style="color:var(--gold)">DEFENSE</b> - other players attack your saved base while you are offline. After a heavy attack you get a shield. Check the battle log to watch replays.</p>' +
    '<p><b style="color:var(--gold)">HEROES</b> - build their altars, upgrade them with Dark Elixir and forge equipment at the Blacksmith with Ore.</p>' +
    '<p><b style="color:var(--gold)">CAMPAIGN</b> - 20 worlds, 200 levels, 600 stars. Rewards for every new star.</p>' +
    '<p class="note">Mouse: drag to pan, wheel to zoom, keys 1-9 pick battle cards. Touch: drag, pinch to zoom, hold to deploy a stream of troops.</p></div>', { size: 'mid' });
};

/* ---- bottom bar ---------------------------------------------------------- */
const NAV = {
  shop: () => UI.shop(), army: () => UI.army('troops'), heroes: () => UI.heroes('heroes'), attack: () => UI.attack(),
  campaign: () => UI.campaign(), leaderboard: () => UI.leaderboard(), log: () => UI.log(), settings: () => UI.settings(),
};
$$('[data-nav]').forEach(b => b.onclick = () => { Sound.init(); Sound.play('click'); Modal.closeAll(); if (Home.place) cancelPlace(); NAV[b.dataset.nav](); });
$('#meBox').onclick = () => { Sound.init(); Sound.play('click'); Modal.closeAll(); UI.myProfile(); };

/* =====================================================================
   LIVE (Server-Sent Events): presence, attack alerts
   ===================================================================== */
const Live = {
  es: null, retry: null, beat: null,
  async connect() {
    this.close();
    if (!Net.token) return;
    try {
      const { ticket } = await Net.post('/stream/ticket');
      const es = new EventSource(API + '/api/stream?ticket=' + encodeURIComponent(ticket));
      this.es = es;
      const online = e => { try { S.online = JSON.parse(e.data).online; updateHud(true); } catch (x) { /* ignore */ } };
      es.addEventListener('hello', online);
      es.addEventListener('global', online);
      es.addEventListener('under_attack', e => {
        const d = JSON.parse(e.data);
        toast('⚔ ' + esc(d.by) + ' is attacking your base right now!', 'attack');
        Sound.play('alarm');
      });
      es.addEventListener('attacked', e => {
        const d = JSON.parse(e.data);
        S.unseen++;
        refreshMe();
        if (S.scene === 'home' && !Modal.top()) UI.attacked([d]);
        else toast('Your base was attacked by ' + esc(d.attacker.name) + ' - ' + d.stars + '★ ' + d.pct + '%', 'attack');
      });
      es.onerror = () => { es.close(); if (this.es === es) { this.es = null; this.retry = setTimeout(() => this.connect(), 8000); } };
    } catch (e) { this.retry = setTimeout(() => this.connect(), 15000); }
    // heartbeat fallback in case a proxy blocks the stream
    this.beat = setInterval(() => { if (!this.es && Net.token) Net.post('/presence').then(r => { S.online = r.online; }).catch(() => {}); }, 60000);
  },
  close() { if (this.es) { this.es.close(); this.es = null; } clearTimeout(this.retry); clearInterval(this.beat); },
};

/* =====================================================================
   APP: auth screens, enter/leave the game
   ===================================================================== */
const App = {
  async enter(me) {
    $('#auth').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    S.scene = 'home';
    S.me = null;
    setMe(me);
    drawAvatar($('#meAvatar'), me.avatar);
    makeGround(homeTheme());
    cam.z = clamp(Math.min(W / 2200, H / 1200) * 1.3, minZoom(), 1.4); cam.x = 0; cam.y = 640;
    Live.connect();
    if (me.activeBattle) Net.post('/battle/' + me.activeBattle + '/end', { endTick: 0 }).then(r => setMe(r.me)).catch(() => {});
    try {
      const n = await Net.get('/notifications');
      S.unseen = n.defenses.length;
      if (n.defenses.length) UI.attacked(n.defenses);
      else if (!localStorage.getItem('gbbSeenHelp')) { localStorage.setItem('gbbSeenHelp', '1'); UI.help(); }
    } catch (e) { /* ignore */ }
  },
  logout() {
    Net.post('/auth/logout').catch(() => {});
    this.loggedOut();
  },
  loggedOut(msg) {
    Net.save(null);
    Live.close();
    Modal.closeAll();
    if (Battle.b) { Battle.b = null; $('#bhud').classList.add('hidden'); }
    S.me = null; S.scene = 'home';
    $('#hud').classList.add('hidden');
    showAuth('main');
    if (msg) toast(esc(msg), 'bad');
  },
};
// keep the avatar in the HUD in sync
const _setMe = setMe;
setMe = function (me) { _setMe(me); if (me) drawAvatar($('#meAvatar'), me.avatar); };

function showAuth(which) {
  $('#auth').classList.remove('hidden');
  $('#authMain').classList.toggle('hidden', which !== 'main');
  $('#authLogin').classList.toggle('hidden', which !== 'login');
  $('#authRegister').classList.toggle('hidden', which !== 'register');
  const f = which === 'login' ? $('#loginForm input') : which === 'register' ? $('#registerForm input') : null;
  if (f) setTimeout(() => f.focus(), 50);
}
$$('[data-auth]').forEach(b => b.onclick = e => { e.preventDefault(); Sound.init(); Sound.play('click'); showAuth(b.dataset.auth === 'back' ? 'main' : b.dataset.auth); });
$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('[type=submit]');
  $('#loginErr').textContent = ''; btn.disabled = true;
  try {
    const r = await Net.post('/auth/login', { login: f.elements.namedItem('login').value.trim(), password: f.elements.namedItem('password').value });
    Net.save(r.token, f.elements.namedItem('remember').checked);
    f.elements.namedItem('password').value = '';
    Sound.play('done');
    App.enter(r.me);
  } catch (err) { $('#loginErr').textContent = err.message; Sound.play('error'); }
  btn.disabled = false;
};
$('#registerForm').onsubmit = async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('[type=submit]');
  $('#registerErr').textContent = '';
  if (f.elements.namedItem('password').value !== f.elements.namedItem('password2').value) { $('#registerErr').textContent = 'Passwords do not match'; return; }
  btn.disabled = true;
  try {
    const r = await Net.post('/auth/register', { username: f.elements.namedItem('username').value.trim(), email: f.elements.namedItem('email').value.trim(), password: f.elements.namedItem('password').value });
    Net.save(r.token, f.elements.namedItem('remember').checked);
    f.elements.namedItem('password').value = f.elements.namedItem('password2').value = '';
    Sound.play('victory');
    App.enter(r.me);
    toast('Welcome to Grejs Base Builder, ' + esc(r.me.name) + '! You have a 24h shield.', 'good', 5000);
  } catch (err) { $('#registerErr').textContent = err.message; Sound.play('error'); }
  btn.disabled = false;
};

/* demo village behind the login screen */
let demoBase = null;
function drawDemo(c, t) {
  if (!demoBase) demoBase = D.campaignLevel(4, 6).base.buildings.filter(b => D.bdef(b.t).cat !== 'trap').slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const walls = new Set(demoBase.filter(b => b.t === 'wall').map(b => b.x + ',' + b.y));
  for (const b of demoBase) {
    const [wx, wy] = iso(b.x, b.y);
    if (b.t === 'wall') blit(c, wallSprite(b.lv, (walls.has((b.x + 1) + ',' + b.y) ? 1 : 0) | (walls.has(b.x + ',' + (b.y + 1)) ? 2 : 0)), wx, wy);
    else { blit(c, spriteFor(b.t, b.lv, 3, false), wx, wy); drawLive(c, { t: b.t, lv: b.lv, s: D.bdef(b.t).size, i: b.x * 41 + b.y }, t, wx, wy); }
  }
  cam.x = Math.sin(t * 0.05) * 160; cam.y = 640 + Math.cos(t * 0.04) * 60;
}

/* =====================================================================
   BOOT
   ===================================================================== */
function loadScript(src) {
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('load failed')); document.head.appendChild(s); });
}
async function boot() {
  $('#loadRetry').classList.add('hidden');
  $('#loadMsg').textContent = 'Connecting to the Grejs server…';
  try {
    const v = Math.floor(Date.now() / 300000);
    if (!window.GBData) await loadScript(API + '/shared/gamedata.js?v=' + v);
    if (!window.GBSim) await loadScript(API + '/shared/sim.js?v=' + v);
    D = window.GBData; GBSim = window.GBSim;
    const h = await fetch(API + '/api/health').then(r => r.json());
    if (!h.db) throw new Error('db');
    S.online = h.online || 0;
    $('#authOnline').innerHTML = '<span class="dot on"></span><span>' + (h.online ? h.online + ' players online' : 'Server online') + '</span>';
  } catch (e) {
    $('#loadMsg').textContent = 'Cannot reach the Grejs server. Check your connection and try again.';
    $('#loadRetry').classList.remove('hidden');
    return;
  }
  resize();
  makeGround(homeTheme());
  cam.z = clamp(Math.min(W / 2200, H / 1200) * 1.3, minZoom(), 1.4);
  if (!booted) { booted = true; requestAnimationFrame(frame); }
  Net.load();
  if (Net.token) {
    try { const me = await Net.get('/me'); $('#loading').classList.add('hidden'); App.enter(me); return; }
    catch (e) { if (e.status === 401) Net.save(null); }
  }
  $('#loading').classList.add('hidden');
  showAuth('main');
}
let booted = false;
$('#loadRetry').onclick = () => boot();
paintIcons(document);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.me && S.scene === 'home') refreshMe(); });
boot();
