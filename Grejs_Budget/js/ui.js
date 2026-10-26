// Små UI-byggesten: ikoner, beløb, kategorichips, fremskridtsbjælker, dialoger og beskeder.
// Al dynamisk tekst sættes ind via esc() – banktekster behandles altid som data, aldrig som HTML.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;
  const esc = U.esc;

  GB.views = GB.views || {};

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const icon = (name, cls) => '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';

  // Beløb med fortegn. Indtægter vises med "+" og grøn farve; udgifter med "−".
  function money(kr, opts) {
    const o = opts || {};
    const cls = ['num'];
    if (o.color !== false) { if (kr > 0 && o.sign) cls.push('pos'); }
    if (o.cls) cls.push(o.cls);
    return '<span class="' + cls.join(' ') + '">' + esc(U.fmtMoney(kr, o)) + '</span>';
  }
  const txAmount = (t) => money(t.amount, { sign: true }) + (t.currency && t.currency !== 'DKK' ? ' <span class="badge">' + esc(t.currency) + '</span>' : '');

  function catOf(id) {
    const c = GB.store.byId.categories.get(id);
    return c || GB.store.byId.categories.get(GB.categories.UNKNOWN_ID) || { id, name: 'Ukendt', color: '#94a3b8', icon: 'dots' };
  }
  function catName(id, withGroup) {
    const c = catOf(id);
    if (!withGroup || !c.parentId) return c.name;
    const g = GB.store.byId.categories.get(c.parentId);
    return (g ? g.name + ' › ' : '') + c.name;
  }
  function catDot(c, size) {
    return '<span class="cat-dot" style="background:' + esc(c.color) + (size ? ';width:' + size + 'px;height:' + size + 'px' : '') + '">' + icon(c.icon || 'dots') + '</span>';
  }
  function catChip(id, opts) {
    const c = catOf(id);
    const o = opts || {};
    const tag = o.button ? 'button type="button"' : 'span';
    const attrs = o.button ? ' data-action="' + esc(o.button) + '" data-id="' + esc(o.txId || '') + '" title="Skift kategori"' : '';
    return '<' + tag + ' class="chip"' + attrs + '>' + catDot(c) + '<span class="chip-text">' + esc(c.name) + '</span></' + (o.button ? 'button' : 'span') + '>';
  }
  function catIcon(id) {
    const c = catOf(id);
    return '<span class="cat-icon" style="background:' + esc(c.color) + '">' + icon(c.icon || 'dots') + '</span>';
  }

  const LEVEL_ICON = { ok: 'check', notice: 'info', warn: 'alert', over: 'alert' };
  function bar(pct, level, opts) {
    const w = Math.max(0, Math.min(100, pct || 0));
    const o = opts || {};
    return '<div class="bar ' + (level || '') + (o.thin ? ' thin' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct || 0) + '"' + (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + '><span style="width:' + w.toFixed(1) + '%"></span>' +
      (o.marker != null ? '<i class="marker" style="left:' + Math.max(0, Math.min(100, o.marker)).toFixed(1) + '%"></i>' : '') + '</div>';
  }
  function levelBadge(level, label) {
    return '<span class="badge ' + esc(level) + '">' + icon(LEVEL_ICON[level] || 'info') + esc(label) + '</span>';
  }

  function empty(iconName, title, text, actions) {
    return '<div class="empty">' + icon(iconName) + '<h3>' + esc(title) + '</h3>' + (text ? '<p>' + text + '</p>' : '') + (actions ? '<div class="row" style="justify-content:center">' + actions + '</div>' : '') + '</div>';
  }

  function trend(ch, invert) {
    if (!ch || ch.pct == null || Math.abs(ch.diff) < 0.5) return '';
    const up = ch.diff > 0;
    const good = invert ? !up : up;
    return '<span class="trend ' + (good ? 'pos' : 'neg') + '">' + icon(up ? 'up' : 'down') + U.fmtPct(Math.abs(ch.pct)) + '</span>';
  }

  // --- Beskeder ----------------------------------------------------------------

  function toast(msg, type, action) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = icon(type === 'error' || type === 'warn' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>' + (action ? '<button type="button">' + esc(action.label) + '</button>' : '');
    if (action) el.querySelector('button').addEventListener('click', () => { action.onClick(); el.remove(); });
    box.appendChild(el);
    setTimeout(() => el.remove(), type === 'error' ? 9000 : action ? 7000 : 3800);
  }

  // --- Dialoger ----------------------------------------------------------------

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  // dialog({ title, body, wide, actions: [{ label, value, primary, danger, close: false, onClick(el) }], onOpen(el) })
  // Lukkes med Esc, klik udenfor eller en knap. Promise giver knappens value (null ved annullering).
  function dialog(opts) {
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const back = document.createElement('div');
      back.className = 'dialog-backdrop';
      const id = U.uid('dlg');
      const actions = opts.actions || [{ label: 'Luk', value: null }];
      back.innerHTML = '<div class="dialog' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '">' +
        '<div class="dialog-head"><h2 id="' + id + '">' + esc(opts.title) + '</h2><button type="button" class="btn ghost icon-only sm" data-close aria-label="Luk">' + icon('x') + '</button></div>' +
        '<div class="dialog-body">' + (opts.body || '') + '</div>' +
        '<div class="dialog-foot">' + actions.map((a, i) => '<button type="button" class="btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger solid' : '') + '" data-i="' + i + '">' + esc(a.label) + '</button>').join('') + '</div></div>';
      document.body.appendChild(back);
      const dlg = back.firstElementChild;
      let done = false;
      function close(v) {
        if (done) return;
        done = true;
        back.remove();
        document.removeEventListener('keydown', onKey, true);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* ignorer */ }
        resolve(v);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
        if (e.key === 'Tab') {
          const f = $$(FOCUSABLE, dlg).filter((x) => x.offsetParent !== null);
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      }
      document.addEventListener('keydown', onKey, true);
      back.addEventListener('mousedown', (e) => { if (e.target === back) close(null); });
      $('[data-close]', dlg).addEventListener('click', () => close(null));
      $$('.dialog-foot [data-i]', dlg).forEach((b) => b.addEventListener('click', async () => {
        const a = actions[+b.dataset.i];
        if (a.onClick) {
          const r = await a.onClick(dlg);
          if (r === false) return;
          close(r === undefined ? a.value : r);
          return;
        }
        close(a.value);
      }));
      dlg.addEventListener('submit', (e) => e.preventDefault());
      if (opts.onOpen) opts.onOpen(dlg, close);
      const first = $('[autofocus]', dlg) || $$(FOCUSABLE, $('.dialog-body', dlg))[0] || $('.dialog-foot .primary', dlg) || $('.dialog-foot button', dlg);
      if (first) first.focus();
    });
  }

  function confirm(o) {
    return dialog({
      title: o.title,
      body: '<p>' + (o.html || esc(o.message)) + '</p>',
      actions: [{ label: o.cancelLabel || 'Annullér', value: false }, { label: o.confirmLabel || 'OK', value: true, primary: !o.danger, danger: !!o.danger }],
    }).then((v) => v === true);
  }

  // --- Formularfelter ----------------------------------------------------------

  function options(list, selected) {
    return list.map(([v, l, extra]) => '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + (extra || '') + '>' + esc(l) + '</option>').join('');
  }
  // Kategorivælger grupperet efter hovedkategori.
  function categoryOptions(selected, opts) {
    const o = opts || {};
    const cats = GB.store.data.categories.filter((c) => !c.deleted);
    const groups = cats.filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
    let html = o.allLabel ? '<option value="">' + esc(o.allLabel) + '</option>' : '';
    for (const g of groups) {
      if (g.hidden && !o.includeHidden && g.id !== selected) continue;
      const subs = cats.filter((c) => c.parentId === g.id && (!c.hidden || o.includeHidden || c.id === selected)).sort((a, b) => a.order - b.order);
      html += '<optgroup label="' + esc(g.name) + '">';
      if (o.allowGroups) html += '<option value="' + esc(g.id) + '"' + (g.id === selected ? ' selected' : '') + '>' + esc(g.name) + ' (hele gruppen)</option>';
      for (const s of subs) html += '<option value="' + esc(s.id) + '"' + (s.id === selected ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      html += '</optgroup>';
    }
    return html;
  }
  function accountOptions(selected, allLabel) {
    const accs = GB.store.data.accounts.slice().sort((a, b) => a.name.localeCompare(b.name, 'da'));
    return (allLabel ? '<option value="">' + esc(allLabel) + '</option>' : '') + accs.map((a) => '<option value="' + esc(a.id) + '"' + (a.id === selected ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('');
  }
  function accountName(id) { const a = GB.store.byId.accounts.get(id); return a ? a.name : 'Ukendt konto'; }

  // Læser et dansk beløb fra et inputfelt ("1.234,50" eller "1234.5").
  function readAmount(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    const mode = /,\d{1,2}$/.test(s) || (s.includes(',') && !s.includes('.')) ? 'comma' : (/\.\d{1,2}$/.test(s) ? 'dot' : 'comma');
    const r = GB.importer.parseAmount(s, mode);
    return r.value != null ? r.value : null;
  }
  const amountInputValue = (kr) => (kr == null || kr === '' ? '' : String(U.round2(kr)).replace('.', ','));

  // Tooltip til grafer (elementer med data-tip).
  function initTooltips() {
    let tip = null;
    const show = (e) => {
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (!t) { if (tip) tip.hidden = true; return; }
      if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; document.body.appendChild(tip); }
      tip.textContent = t.getAttribute('data-tip');
      tip.hidden = false;
      const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
      const y = Math.max(8, e.clientY - tip.offsetHeight - 10);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    document.addEventListener('mousemove', show);
    document.addEventListener('scroll', () => { if (tip) tip.hidden = true; }, true);
  }

  GB.ui = {
    $, $$, esc, icon, money, txAmount, catOf, catName, catChip, catDot, catIcon, bar, levelBadge, empty, trend,
    toast, dialog, confirm, options, categoryOptions, accountOptions, accountName, readAmount, amountInputValue, initTooltips,
  };
})();
