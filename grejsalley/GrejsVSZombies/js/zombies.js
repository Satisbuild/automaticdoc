'use strict';
/* =====================================================================
   GREJS VS ZOMBIES - zombies.js
   44 zombietyper + 10 bosser. Data, særlige evner (hooks, som game.js
   kalder) og tegning. Zombier tegnes af en parametrisk "dukke" med
   udskiftelige hatte, rustninger, genstande og kropstyper.
   Origo er ved fødderne; zombier vender mod venstre.
   ===================================================================== */
GVZ.Zombies = (function () {
  const U = GVZ.U, A = GVZ.A, k = A.k;

  /* ---------------------------------------------------------------
     Tegnedele
     --------------------------------------------------------------- */
  function limb(ctx, pts, w, col) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineWidth = w + 5; ctx.strokeStyle = k(A.INK); ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = k(col); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }
  function leg(ctx, hx, hy, ph, L, len) {
    len = len || 44;
    const fx = hx + Math.sin(ph) * 11, lift = Math.max(0, Math.cos(ph)) * 6;
    const kx = (hx + fx) / 2 - 5, ky = hy + len * 0.5 - lift * 0.5;
    limb(ctx, [hx, hy, kx, ky, fx, -lift], 10, L.pants || '#5b5f8a');
    A.ell(ctx, fx - 5, -lift - 2, 10, 5, 0, L.shoe || '#3b2a20', 2.4);
  }
  function headShape(ctx, L, z, t, eatOpen) {
    const skin = L.skin || '#a3b98c';
    // hals
    A.rrect(ctx, -6, -6, 12, 14, 4, U.shade(skin, -0.15), 2.4);
    ctx.beginPath();
    ctx.moveTo(-18, -2); ctx.bezierCurveTo(-24, -24, -14, -40, 2, -40); ctx.bezierCurveTo(18, -40, 24, -22, 20, -4);
    ctx.quadraticCurveTo(14, 8, 0, 8); ctx.quadraticCurveTo(-14, 8, -18, -2); ctx.closePath();
    ctx.fillStyle = A.rg(ctx, -2, -18, 26, U.shade(skin, 0.18), U.shade(skin, -0.12)); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
    // plamager
    ctx.fillStyle = k(U.shade(skin, -0.22));
    ctx.beginPath(); ctx.ellipse(10, -28, 4, 3, 0.4, 0, Math.PI * 2); ctx.ellipse(14, -10, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    // øjne (vender mod venstre)
    const bl = (t + (z.seed || 0) * 2) % 5 < 0.12 ? 0.9 : 0;
    const angry = L.angry ? 0.8 : 0;
    A.eye(ctx, -11, -20, 7.5, -0.5, 0.1, bl, { white: L.eyeWhite || '#f4f0d0', pupil: 0.32, pupilCol: L.pupil || '#2a0a0a', brow: angry ? -0.8 : 0 });
    A.eye(ctx, 3, -22, 6, -0.6, 0.2, bl, { white: L.eyeWhite || '#f4f0d0', pupil: 0.3, pupilCol: L.pupil || '#2a0a0a', brow: angry ? 0.8 : 0 });
    // mund
    const mo = eatOpen;
    ctx.beginPath(); ctx.moveTo(-16, -4); ctx.quadraticCurveTo(-8, 2 + mo * 8, 2, -2); ctx.quadraticCurveTo(-8, -6 + mo * 2, -16, -4);
    ctx.fillStyle = k('#3a1414'); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = k(A.INK); ctx.stroke();
    ctx.fillStyle = k('#efe6c4'); ctx.fillRect(-12, -5, 3, 3 + mo * 2); ctx.fillRect(-6, -4.5, 3, 3);
    // hår
    if (L.hair) {
      ctx.strokeStyle = k(L.hair); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-2, -39); ctx.quadraticCurveTo(-6, -48, -12, -46); ctx.moveTo(4, -40); ctx.quadraticCurveTo(6, -50, 12, -47); ctx.moveTo(10, -37); ctx.quadraticCurveTo(18, -42, 20, -36); ctx.stroke(); ctx.lineCap = 'butt';
    }
  }
  /* ---------------- Hatte/rustninger ---------------- */
  function hat(ctx, z, L, t) {
    const af = z.armorMax ? z.armor / z.armorMax : 1;
    const h = L.hat;
    if (!h) return;
    if (['pot', 'kettle', 'helmet', 'imperial', 'hardhat', 'robohelm'].includes(h) && z.armorMax && z.armor <= 0) return;
    ctx.save();
    if (h === 'pot') {
      ctx.translate(2, -38); ctx.rotate(0.15);
      A.poly(ctx, [-18, 0, 18, 0, 14, -26, -14, -26], '#d0703a', 3);
      A.rrect(ctx, -20, -30, 40, 8, 3, '#e08a4a', 3);
      if (af < 0.66) { ctx.strokeStyle = k(A.INK); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(-2, -12); ctx.lineTo(-8, -4); ctx.stroke(); }
      if (af < 0.33) { ctx.fillStyle = k('#2a1b12'); ctx.beginPath(); ctx.moveTo(10, -22); ctx.lineTo(16, -12); ctx.lineTo(8, -14); ctx.fill(); }
      A.leaf(ctx, 4, -30, 14, 5, -1.2, '#5aa83a');
    } else if (h === 'kettle') {
      ctx.translate(2, -36); ctx.rotate(0.1);
      ctx.beginPath(); ctx.moveTo(-22, 2); ctx.bezierCurveTo(-24, -30, 24, -30, 22, 2); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -28, 2, '#d8dde8', '#7f8796'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.rrect(ctx, -25, -2, 50, 7, 3, '#9aa2b0', 3);
      ctx.strokeStyle = k(A.INK); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -24, 7, Math.PI, 0); ctx.stroke();
      A.rrect(ctx, 20, -16, 14, 6, 3, '#9aa2b0', 2.4);
      A.shine(ctx, -10, -16, 6, 4);
      if (af < 0.66) { ctx.fillStyle = k('#59606c'); ctx.beginPath(); ctx.arc(-8, -10, 4, 0, Math.PI * 2); ctx.arc(10, -6, 3, 0, Math.PI * 2); ctx.fill(); }
      if (af < 0.33) { ctx.fillStyle = k('#59606c'); ctx.beginPath(); ctx.arc(2, -18, 5, 0, Math.PI * 2); ctx.arc(-14, -4, 4, 0, Math.PI * 2); ctx.fill(); }
    } else if (h === 'helmet' || h === 'imperial') {
      const gold = h === 'imperial';
      ctx.translate(1, -38);
      ctx.beginPath(); ctx.moveTo(-23, 22); ctx.lineTo(-23, -4); ctx.bezierCurveTo(-22, -32, 22, -32, 23, -4); ctx.lineTo(23, 22); ctx.lineTo(10, 22); ctx.lineTo(10, 6); ctx.lineTo(-10, 6); ctx.lineTo(-10, 22); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -30, 22, gold ? '#ffe28a' : '#e1e6ef', gold ? '#a0681c' : '#6c7584'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.fillStyle = k('#1a1a22'); ctx.fillRect(-20, 0, 40, 4);
      if (gold) { A.poly(ctx, [-6, -26, 0, -46, 6, -26], '#d8323a', 2.4); A.circ(ctx, 0, -14, 4, '#d8323a', 2); }
      else { ctx.fillStyle = k('#c0283a'); ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(20, -46, 30, -30); ctx.quadraticCurveTo(14, -34, 4, -24); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = k(A.INK); ctx.stroke(); }
      A.shine(ctx, -12, -14, 5, 7);
      if (af < 0.5) { ctx.fillStyle = k('#4a4f5a'); ctx.beginPath(); ctx.arc(12, -10, 4, 0, Math.PI * 2); ctx.arc(-14, 12, 3, 0, Math.PI * 2); ctx.fill(); }
    } else if (h === 'hardhat') {
      ctx.translate(2, -34);
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.bezierCurveTo(-22, -28, 22, -28, 22, 0); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -26, 0, '#ffe066', '#e0a21c'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.rrect(ctx, -28, -2, 48, 6, 3, '#e0a21c', 2.6);
      A.circ(ctx, -4, -14, 5, '#fff8c0', 2); A.glow(ctx, -12, -14, 30, '#fff8c0', 0.35);
    } else if (h === 'robohelm') {
      ctx.translate(2, -24);
      A.rrect(ctx, -24, -22, 46, 36, 10, '#b8c6e0', 3);
      ctx.fillStyle = 'rgba(80,220,255,.35)'; U.roundRect(ctx, -21, -16, 30, 20, 6); ctx.fill();
      A.stem(ctx, 10, -22, 14, -40, 0, 2, '#9aa6b8'); A.circ(ctx, 14, -42, 4, Math.sin(t * 8) > 0 ? '#ff4a4a' : '#7a2a2a', 2);
    } else if (h === 'cap') {
      ctx.translate(2, -36);
      A.rrect(ctx, -20, -6, 40, 9, 4, '#e8423a', 2.6);
      ctx.fillStyle = k('#ffffff'); ctx.fillRect(-18, -3, 36, 2);
      ctx.strokeStyle = k('#e8423a'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(18, -2); ctx.quadraticCurveTo(28, 2 + Math.sin(t * 9) * 3, 34, -4); ctx.stroke();
    } else if (h === 'wrap') {
      ctx.translate(0, -18);
      ctx.strokeStyle = k('#efe6c8'); ctx.lineWidth = 6;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-20, -18 + i * 7); ctx.lineTo(20, -22 + i * 8); ctx.stroke(); }
      ctx.strokeStyle = k('#c9bd9a'); ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-20, -15 + i * 7); ctx.lineTo(20, -19 + i * 8); ctx.stroke(); }
    } else if (h === 'pharaoh') {
      ctx.translate(2, -30);
      A.poly(ctx, [-24, 30, -22, -6, -10, -18, 10, -18, 22, -6, 24, 30, 14, 30, 12, 0, -12, 0, -14, 30], '#2a5ad6', 3);
      ctx.strokeStyle = k('#ffd23f'); ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-22, 2 + i * 7); ctx.lineTo(-14, 2 + i * 7); ctx.moveTo(14, 2 + i * 7); ctx.lineTo(22, 2 + i * 7); ctx.stroke(); }
      A.circ(ctx, 0, -14, 4, '#ffd23f', 2);
    } else if (h === 'bandana') {
      ctx.translate(2, -30);
      ctx.beginPath(); ctx.moveTo(-22, 2); ctx.bezierCurveTo(-22, -20, 22, -20, 22, 2); ctx.closePath();
      ctx.fillStyle = k('#c8283a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.fillStyle = k('#ffffff'); [[-10, -6], [4, -10], [12, -2]].forEach((d) => { ctx.beginPath(); ctx.arc(d[0], d[1], 2, 0, Math.PI * 2); ctx.fill(); });
      A.poly(ctx, [20, -2, 34, 4 + Math.sin(t * 5) * 2, 30, -8], '#c8283a', 2.4);
    } else if (h === 'tricorn') {
      ctx.translate(2, -36);
      A.poly(ctx, [-30, 2, -18, -22, 0, -14, 18, -22, 30, 2, 0, 6], '#2a2a3a', 3);
      ctx.strokeStyle = k('#ffd23f'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-28, 1); ctx.lineTo(0, 5); ctx.lineTo(28, 1); ctx.stroke();
      ctx.fillStyle = k('#f4f0d0'); ctx.beginPath(); ctx.arc(0, -6, 4, 0, Math.PI * 2); ctx.fill();
    } else if (h === 'cowboy') {
      ctx.translate(2, -34);
      A.ell(ctx, 0, 0, 34, 8, 0.05, '#a0703a', 3);
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.bezierCurveTo(-18, -26, -4, -22, 0, -18); ctx.bezierCurveTo(4, -22, 18, -26, 16, 0); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -26, 0, '#c08a4a', '#8a5a2a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.fillStyle = k('#4a2a14'); ctx.fillRect(-16, -6, 32, 4);
    } else if (h === 'witch') {
      ctx.translate(2, -36);
      A.ell(ctx, 0, 0, 32, 7, 0, '#3a2350', 3);
      A.poly(ctx, [-16, -2, 16, -2, 8, -30, 22 + Math.sin(t * 2) * 3, -50, 0, -34], '#3a2350', 3);
      ctx.fillStyle = k('#9a5ad6'); ctx.fillRect(-15, -8, 30, 4);
      A.star(ctx, -4, -16, 4, 2, 5, 0, '#ffe14a', 1.2);
    } else if (h === 'hood') {
      ctx.translate(0, -18);
      ctx.beginPath(); ctx.moveTo(-26, 26); ctx.bezierCurveTo(-30, -20, -10, -36, 6, -32); ctx.bezierCurveTo(26, -28, 30, 0, 26, 26); ctx.lineTo(12, 26); ctx.bezierCurveTo(16, 0, 8, -16, -4, -16); ctx.bezierCurveTo(-18, -16, -20, 4, -14, 26); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -34, 26, '#3a2a4a', '#1a1024'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
    } else if (h === 'fur') {
      ctx.translate(0, -34);
      for (let i = 0; i < 7; i++) A.circ(ctx, -20 + i * 7, -2 - Math.sin(i) * 4, 8, '#eef3ff', 2);
    } else if (h === 'beanie') {
      ctx.translate(2, -32);
      ctx.beginPath(); ctx.moveTo(-21, 0); ctx.bezierCurveTo(-22, -28, 22, -28, 21, 0); ctx.closePath();
      ctx.fillStyle = k('#3aa0e0'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.rrect(ctx, -23, -4, 46, 8, 4, '#ffffff', 2.4);
      A.circ(ctx, 0, -24, 6, '#ffffff', 2.4);
    } else if (h === 'drivercap') {
      ctx.translate(2, -34);
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.bezierCurveTo(-20, -20, 20, -20, 20, 0); ctx.closePath();
      ctx.fillStyle = k('#2a3a6a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.poly(ctx, [-20, -2, -36, 2, -20, 4], '#1a2440', 2.4);
    } else if (h === 'tophat') {
      ctx.translate(2, -36);
      A.ell(ctx, 0, 0, 26, 6, 0, '#1a1a24', 3);
      A.rrect(ctx, -15, -30, 30, 30, 3, '#1a1a24', 3);
      ctx.fillStyle = k('#c0283a'); ctx.fillRect(-15, -8, 30, 5);
    } else if (h === 'mask') {
      ctx.translate(-4, -22);
      for (let i = 0; i < 5; i++) A.leaf(ctx, 0, -18, 26, 6, -Math.PI / 2 + (i - 2) * 0.35, ['#e83a3a', '#ffd23f', '#3ad06a', '#3aa0e0', '#e83a3a'][i], false);
      A.rrect(ctx, -18, -18, 34, 30, 10, '#c8913a', 3);
      ctx.fillStyle = k('#1a0a0a'); ctx.beginPath(); ctx.ellipse(-8, -6, 4, 5, 0, 0, Math.PI * 2); ctx.ellipse(6, -6, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = k('#ffffff'); ctx.fillRect(-10, 4, 18, 3);
    } else if (h === 'headband') {
      ctx.translate(2, -26);
      A.rrect(ctx, -21, -4, 42, 7, 3, '#ff3ad6', 2.4);
    }
    ctx.restore();
  }
  /* ---------------- Genstande, der holdes ---------------- */
  function heldFront(ctx, z, L, t) {
    const it = L.held;
    if (!it) return;
    const sf = z.shieldMax ? z.shieldHp / z.shieldMax : 1;
    if ((it === 'gate' || it === 'sarco' || it === 'tower' || it === 'energy') && z.shieldMax && z.shieldHp <= 0) return;
    ctx.save();
    if (it === 'gate') {
      ctx.translate(-30, -50); ctx.rotate(-0.05);
      A.rrect(ctx, -10, -34, 22, 70, 3, '#b07a42', 3);
      ctx.strokeStyle = k('#6e4523'); ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-10, -26 + i * 18); ctx.lineTo(12, -26 + i * 18); ctx.stroke(); }
      ctx.fillStyle = k('#7a7f8a'); ctx.fillRect(-8, -20, 4, 6); ctx.fillRect(-8, 16, 4, 6);
      if (sf < 0.66) A.poly(ctx, [12, -10, 2, -4, 12, 4], '#2a1b12', 0);
      if (sf < 0.33) A.poly(ctx, [-10, 20, 0, 26, -10, 34], '#2a1b12', 0);
    } else if (it === 'sarco') {
      ctx.translate(-30, -54);
      ctx.beginPath(); ctx.moveTo(-6, -48); ctx.quadraticCurveTo(12, -50, 14, -30); ctx.lineTo(16, 46); ctx.lineTo(-8, 46); ctx.lineTo(-12, -30); ctx.quadraticCurveTo(-14, -46, -6, -48); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -50, 46, '#ffd86a', '#c48a1c'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.fillStyle = k('#2a5ad6'); ctx.fillRect(-10, -10, 24, 6); ctx.fillRect(-9, 6, 24, 6);
      A.eye(ctx, 0, -30, 5, -0.5, 0, 0, { white: '#ffffff' });
      if (sf < 0.5) { ctx.strokeStyle = k(A.INK); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 20); ctx.lineTo(4, 28); ctx.lineTo(-4, 36); ctx.stroke(); }
    } else if (it === 'tower') {
      ctx.translate(-28, -52);
      A.rrect(ctx, -12, -40, 24, 80, 8, '#b8323a', 3);
      ctx.strokeStyle = k('#ffd23f'); ctx.lineWidth = 3; U.roundRect(ctx, -8, -34, 16, 68, 6); ctx.stroke();
      A.circ(ctx, 0, 0, 7, '#ffd23f', 2.4);
    } else if (it === 'energy') {
      const a = 0.25 + sf * 0.4 + Math.sin(t * 6) * 0.05;
      ctx.translate(-30, -55);
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 50, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(90,230,255,' + a * 0.6 + ')'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(160,250,255,' + (a + 0.2) + ')'; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-10, i * 13); ctx.lineTo(10, i * 13 + 4); ctx.stroke(); }
    } else if (it === 'flag') {
      ctx.translate(-26, -64);
      A.stem(ctx, 0, 30, 0, -40, 0, 3, '#7a5a3a');
      ctx.beginPath(); ctx.moveTo(0, -40);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-i * 6, -40 + Math.sin(t * 6 + i) * 3);
      for (let i = 6; i >= 0; i--) ctx.lineTo(-i * 6, -14 + Math.sin(t * 6 + i) * 3);
      ctx.closePath(); ctx.fillStyle = k('#c0283a'); ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.circ(ctx, -18, -27, 5, '#f4f0d0', 1.6);
    } else if (it === 'pole' && !z.jumped) {
      ctx.translate(-20, -58); ctx.rotate(-0.15);
      ctx.lineCap = 'round'; ctx.strokeStyle = k(A.INK); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-36, -2); ctx.lineTo(40, 4); ctx.stroke();
      ctx.strokeStyle = k('#e8d06a'); ctx.lineWidth = 4; ctx.stroke(); ctx.lineCap = 'butt';
    } else if (it === 'piano' && z.armor > 0) {
      ctx.translate(-30, -50);
      A.rrect(ctx, -34, -40, 60, 70, 6, '#3a2418', 3);
      A.rrect(ctx, -38, -6, 68, 12, 3, '#f4f0e6', 2.4);
      ctx.fillStyle = k('#1a1010'); for (let i = 0; i < 8; i++) ctx.fillRect(-34 + i * 8, -6, 4, 7);
      A.rrect(ctx, -30, 30, 6, 10, 2, '#2a1a10', 2); A.rrect(ctx, 16, 30, 6, 10, 2, '#2a1a10', 2);
    } else if (it === 'car' && z.armor > 0) {
      // tegnes i body
    } else if (it === 'cutlass') {
      ctx.translate(-30, -66); ctx.rotate(-0.5 + Math.sin(t * 4) * 0.1);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-10, -26, -4, -44); ctx.quadraticCurveTo(4, -24, 6, 0); ctx.closePath();
      ctx.fillStyle = k('#dfe6f0'); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.rrect(ctx, -6, 0, 14, 5, 2, '#ffd23f', 2);
    } else if (it === 'staff') {
      ctx.translate(-30, -60);
      A.stem(ctx, 0, 60, 0, -30, 0, 4, L.staffCol || '#7a5a3a');
      A.glow(ctx, 0, -36, 24, L.orb || '#7affc0', 0.6);
      A.circ(ctx, 0, -36, 7, L.orb || '#7affc0', 2.4);
    } else if (it === 'rock') {
      if (!(z.throwT > 0 && z.throwT < 0.5)) A.ball(ctx, -26, -76, 11, '#b0a89a', '#6a6258');
    } else if (it === 'snowball') {
      if (!(z.throwT > 0 && z.throwT < 0.5)) A.ball(ctx, -26, -76, 10, '#ffffff', '#b8d8ff');
    } else if (it === 'pistol' || it === 'slingshot') {
      ctx.translate(-36, -72);
      if (it === 'pistol') { A.rrect(ctx, -16, -5, 22, 8, 2, '#5a5f6a', 2.4); A.rrect(ctx, 0, -2, 7, 12, 2, '#7a4a2a', 2); }
      else { ctx.strokeStyle = k('#7a4a2a'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 0); ctx.lineTo(-8, -10); ctx.moveTo(0, 0); ctx.lineTo(8, -10); ctx.stroke(); }
    } else if (it === 'broom') {
      ctx.translate(-10, -50); ctx.rotate(0.6);
      A.stem(ctx, -40, 0, 40, 0, 0, 4, '#8a5a2a');
      A.poly(ctx, [40, -8, 64, -14, 66, 14, 40, 8], '#d8b04a', 2.4);
    } else if (it === 'spear') {
      ctx.translate(-24, -60);
      A.stem(ctx, 0, 60, 0, -40, 0, 4, '#6a4a2a');
      A.poly(ctx, [-6, -38, 0, -58, 6, -38], '#d8dde8', 2.4);
    } else if (it === 'dynamite' && !z.blasted) {
      ctx.translate(-26, -74);
      A.rrect(ctx, -10, -4, 20, 8, 3, '#d8323a', 2.4);
      ctx.strokeStyle = k(A.INK); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(16, -8, 14, -12); ctx.stroke();
      if (Math.sin(t * 20) > 0) A.glow(ctx, 14, -12, 10, '#ffe14a', 0.9);
    } else if (it === 'club') {
      ctx.translate(-34, -90); ctx.rotate(-0.4 + (z.smashT > 0 ? Math.sin(Math.min(1, z.smashT) * Math.PI) * 1.4 : 0));
      ctx.beginPath(); ctx.moveTo(-6, 60); ctx.lineTo(6, 60); ctx.lineTo(14, -20); ctx.quadraticCurveTo(0, -34, -14, -20); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -30, 60, '#b07a42', '#6e4523'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
    } else if (it === 'boombox') {
      ctx.translate(26, -64);
      A.rrect(ctx, -16, -12, 32, 22, 4, '#3a3a4a', 2.6);
      A.circ(ctx, -7, -1, 6 + Math.abs(Math.sin(t * 8)) * 1.5, '#9a9aaa', 2); A.circ(ctx, 8, -1, 6 + Math.abs(Math.sin(t * 8)) * 1.5, '#9a9aaa', 2);
    } else if (it === 'vine') {
      if (!z.jumped) { ctx.strokeStyle = k('#3a7a2a'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-18, -80); ctx.quadraticCurveTo(-30, -160, -10, -260); ctx.stroke(); }
    }
    ctx.restore();
  }
  function torso(ctx, L, z, t, w, h) {
    const shirt = L.shirt || '#7a6a4a';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2 + 2, -h); ctx.quadraticCurveTo(0, -h - 4, w / 2, -h + 2); ctx.lineTo(w / 2 - 2, 0);
    // laset kant
    for (let i = 0; i < 5; i++) ctx.lineTo(w / 2 - 2 - (i + 0.5) * (w / 5), (i % 2 ? 5 : 0));
    ctx.closePath();
    ctx.fillStyle = A.vg(ctx, -h, 0, U.shade(shirt, 0.15), U.shade(shirt, -0.2)); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
    if (L.tie) { A.poly(ctx, [-3, -h + 2, 3, -h + 2, 5, -h * 0.35, 0, -h * 0.25, -5, -h * 0.35], L.tie, 2); }
    if (L.vest) { ctx.fillStyle = k(L.vest); ctx.fillRect(-w / 2 + 3, -h + 4, 8, h - 8); ctx.fillRect(w / 2 - 11, -h + 4, 8, h - 8); }
    if (L.plate) {
      A.rrect(ctx, -w / 2 - 2, -h + 2, w + 4, h * 0.7, 8, L.plate, 2.6);
      A.shine(ctx, -w / 4, -h + 10, 4, 6);
    }
    if (z.hp < z.maxHp * 0.5) { ctx.fillStyle = k(L.skin || '#a3b98c'); ctx.beginPath(); ctx.ellipse(w * 0.15, -h * 0.4, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = k(A.INK); ctx.stroke(); }
  }
  /* Humanoid-dukken */
  function humanoid(ctx, z, t, L) {
    const sc = L.scale || 1;
    ctx.save(); ctx.scale(sc, sc);
    const ph = z.walk || 0, eating = z.state === 'eat';
    const bob = Math.abs(Math.sin(ph)) * 3;
    const big = L.body === 'big';
    const legLen = big ? 40 : 44, hipY = -legLen;
    const tw = big ? 60 : 34, th = big ? 52 : 40;
    // ben
    leg(ctx, 4, hipY, ph + Math.PI, L, legLen);
    if (L.extraBack) L.extraBack(ctx, z, t, hipY - th);
    // bagarm
    const sh = hipY - th + 8 - bob;
    const armSw = eating ? Math.sin(t * 12) * 6 : Math.sin(ph) * 4;
    limb(ctx, [8, sh, -10 + armSw, sh + 14, -24 + armSw, sh + 10], big ? 13 : 8, U.shade(L.shirt || '#7a6a4a', -0.15));
    A.circ(ctx, -26 + armSw, sh + 10, big ? 8 : 5, L.skin || '#a3b98c', 2.2);
    leg(ctx, -4, hipY, ph, L, legLen);
    ctx.save(); ctx.translate(0, hipY - bob); ctx.rotate(L.lean == null ? -0.1 : L.lean);
    torso(ctx, L, z, t, tw, th);
    // hoved
    ctx.save();
    const hy = -th - (big ? 2 : 6);
    const nod = eating ? Math.sin(t * 12) * 0.12 : Math.sin(ph * 0.5) * 0.04;
    ctx.translate(big ? -18 : -4, hy); ctx.rotate(nod + (z.hp < z.maxHp * 0.25 ? 0.25 : 0));
    if (big) ctx.scale(0.85, 0.85);
    if (L.hat === 'hood' || L.hat === 'pharaoh') hat(ctx, z, L, t);
    headShape(ctx, L, z, t, eating ? Math.abs(Math.sin(t * 12)) : 0.15);
    if (L.hat !== 'hood' && L.hat !== 'pharaoh') hat(ctx, z, L, t);
    if (L.beard) { ctx.fillStyle = k(L.beard); ctx.beginPath(); ctx.moveTo(-16, 0); ctx.quadraticCurveTo(-6, 22, 8, 2); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = k(A.INK); ctx.stroke(); }
    if (L.patch) { ctx.fillStyle = k('#1a1a1a'); ctx.beginPath(); ctx.ellipse(-11, -20, 8, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = k('#1a1a1a'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, -26); ctx.lineTo(16, -34); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
    // forarm (mistes under 50% liv)
    const fsh = hipY - th + 10 - bob;
    if (z.hp >= z.maxHp * 0.5 || L.keepArm) {
      const reach = eating ? Math.sin(t * 12 + 1) * 7 : Math.sin(ph + 1) * 4;
      limb(ctx, [-6, fsh, -22 + reach, fsh + 6, -36 + reach, fsh + 2], big ? 13 : 8, L.shirt || '#7a6a4a');
      A.circ(ctx, -38 + reach, fsh + 2, big ? 9 : 5.5, L.skin || '#a3b98c', 2.2);
    } else {
      limb(ctx, [-6, fsh, -12, fsh + 6], big ? 13 : 8, L.shirt || '#7a6a4a');
    }
    heldFront(ctx, z, L, t);
    ctx.restore();
  }

  /* ---------------- Specialkroppe ---------------- */
  function drawScarab(ctx, z, t) {
    const ph = z.walk || 0;
    ctx.save(); ctx.scale(0.8, 0.8);
    for (let i = 0; i < 3; i++) { const o = Math.sin(ph * 2 + i) * 4; limb(ctx, [-10 + i * 10, -12, -16 + i * 12 + o, -2], 3, '#2a1a40'); }
    A.ell(ctx, 0, -20, 26, 16, 0, '#2a8a7a', 3);
    ctx.fillStyle = A.vg(ctx, -36, -4, '#7af0d0', '#1a5a6a'); ctx.beginPath(); ctx.ellipse(4, -22, 22, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = k(A.INK); ctx.stroke();
    ctx.strokeStyle = k(A.INK); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -36); ctx.lineTo(4, -8); ctx.stroke();
    A.circ(ctx, -24, -18, 10, '#1a4a4a', 2.4);
    A.eye(ctx, -28, -20, 4, -0.5, 0, 0, { white: '#ffef6a' });
    A.poly(ctx, [-32, -12, -40, -6, -32, -6], '#e0d6b0', 1.4);
    A.shine(ctx, -4, -30, 8, 4);
    ctx.restore();
  }
  function drawParrot(ctx, z, t) {
    const fl = Math.sin(t * 14) * 0.6;
    ctx.save(); ctx.translate(0, -120 + Math.sin(t * 3) * 6);
    if (z.carry) { ctx.save(); ctx.translate(0, 34); ctx.scale(0.6, 0.6); try { GVZ.Plants.BY[z.carry.id].draw(ctx, z.carry, t); } catch (e) {} ctx.restore(); }
    ctx.save(); ctx.rotate(fl); A.poly(ctx, [8, -6, 30, -36, 40, -26, 20, 0], '#3a9ad6', 2.6); ctx.restore();
    A.ell(ctx, 0, 0, 24, 16, -0.1, '#e8402a', 3);
    A.poly(ctx, [20, 4, 46, 10, 40, 0, 46, -4, 20, -4], '#2a7ad6', 2.4);
    A.circ(ctx, -22, -10, 13, '#e8402a', 2.6);
    A.poly(ctx, [-32, -12, -46, -4, -34, 0], '#ffd23f', 2.2);
    A.eye(ctx, -24, -14, 5, -0.5, 0, 0, { white: '#f4f0a0' });
    ctx.save(); ctx.rotate(-fl); A.poly(ctx, [6, -4, 20, -40, 30, -34, 18, 2], '#2ab06a', 2.6); ctx.restore();
    ctx.fillStyle = k('#9aa0a0'); ctx.beginPath(); ctx.ellipse(6, 6, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawCar(ctx, z, t, L) {
    if (z.armor <= 0) { humanoid(ctx, z, t, L); return; }
    const sh = Math.sin(t * 20) * 1;
    ctx.save(); ctx.translate(0, sh);
    ctx.save(); ctx.translate(14, -60); ctx.scale(0.9, 0.9);
    // chauffør
    ctx.translate(0, 12); headShape(ctx, L, z, t, 0.2); hat(ctx, z, L, t);
    ctx.restore();
    const af = z.armor / z.armorMax;
    ctx.beginPath(); ctx.moveTo(-58, -14); ctx.lineTo(-54, -40); ctx.lineTo(-20, -46); ctx.lineTo(-6, -72); ctx.lineTo(40, -72); ctx.lineTo(54, -44); ctx.lineTo(62, -40); ctx.lineTo(62, -14); ctx.closePath();
    ctx.fillStyle = A.vg(ctx, -72, -14, '#ff7a5a', '#b8283a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
    ctx.fillStyle = 'rgba(160,220,255,.55)'; ctx.beginPath(); ctx.moveTo(-14, -46); ctx.lineTo(-2, -66); ctx.lineTo(16, -66); ctx.lineTo(16, -46); ctx.closePath(); ctx.fill(); ctx.stroke();
    A.circ(ctx, -56, -32, 5, '#fff8c0', 2); A.glow(ctx, -62, -32, 26, '#fff8c0', 0.4);
    if (af < 0.6) { ctx.strokeStyle = k(A.INK); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -40); ctx.lineTo(20, -30); ctx.lineTo(14, -22); ctx.stroke(); }
    if (af < 0.3) { A.glow(ctx, 40, -70, 30, '#666666', 0.5); }
    for (const x of [-34, 36]) { A.circ(ctx, x, -12, 13, '#2a2a30', 3); A.circ(ctx, x, -12, 5, '#9a9aa8', 2); ctx.save(); ctx.translate(x, -12); ctx.rotate(-t * 8); ctx.strokeStyle = k('#5a5a68'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  function drawMech(ctx, z, t, L) {
    const ph = z.walk || 0, sm = z.smashT > 0 ? Math.sin(Math.min(1, z.smashT) * Math.PI) : 0;
    ctx.save(); ctx.scale(1.25, 1.25);
    for (const s of [1, -1]) {
      const fx = s * 12 + Math.sin(ph + (s > 0 ? Math.PI : 0)) * 10;
      limb(ctx, [s * 10, -50, fx - 4, -24, fx, -4], 14, '#6a7488');
      A.rrect(ctx, fx - 16, -10, 26, 10, 3, '#4a5468', 2.6);
    }
    A.rrect(ctx, -36, -104, 70, 58, 14, '#9aa8c4', 3);
    ctx.fillStyle = k('#6a7894'); ctx.fillRect(-30, -66, 58, 6);
    A.circ(ctx, 0, -80, 10, z.laserT > 0 ? '#ff4a4a' : '#5ae0ff', 2.4); A.glow(ctx, 0, -80, 30, z.laserT > 0 ? '#ff4a4a' : '#5ae0ff', 0.5);
    // cockpit med zombie
    ctx.save(); ctx.translate(-6, -112); ctx.scale(0.7, 0.7); headShape(ctx, L, z, t, 0.2); ctx.restore();
    A.ell(ctx, -6, -124, 26, 22, 0, null, 3); ctx.fillStyle = 'rgba(160,230,255,.3)'; ctx.fill();
    ctx.save(); ctx.translate(-34, -94); ctx.rotate(-0.3 - sm * 1.2);
    A.rrect(ctx, -10, -6, 16, 44, 6, '#7a88a4', 3);
    A.rrect(ctx, -18, 36, 30, 22, 6, '#5a6680', 3);
    ctx.restore();
    ctx.save(); ctx.translate(34, -94); A.rrect(ctx, -6, -6, 14, 40, 6, '#7a88a4', 3); ctx.restore();
    ctx.restore();
  }
  function drawImpRide(ctx, z, t) {
    if (z.thrown || z.hp < z.maxHp * 0.5) return;
    ctx.save(); ctx.translate(30, -150); ctx.scale(0.55, 0.55);
    humanoid(ctx, { walk: 0, hp: 1, maxHp: 1, state: 'walk', seed: 3 }, t, LOOKS.mini);
    ctx.restore();
  }
  function balloon(ctx, z, t) {
    if (!z.flying) return;
    const sw = Math.sin(t * 2 + (z.seed || 0)) * 4;
    ctx.strokeStyle = k('#f4f0d0'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-14, -90); ctx.quadraticCurveTo(-10 + sw, -130, -6 + sw, -150); ctx.stroke();
    A.ball(ctx, -6 + sw, -172, 22, '#ff8ad5', '#c02a8a');
    A.poly(ctx, [-10 + sw, -150, -2 + sw, -150, -6 + sw, -146], '#c02a8a', 1.5);
  }
  function jetpack(ctx, z, t) {
    A.rrect(ctx, 10, -88, 18, 36, 6, '#8a94a8', 2.6);
    const f = 14 + Math.sin(t * 30) * 5;
    ctx.beginPath(); ctx.moveTo(12, -52); ctx.quadraticCurveTo(19, -52 + f, 26, -52); ctx.closePath();
    ctx.fillStyle = A.vg(ctx, -52, -52 + f, '#fff07a', '#ff4a1f'); ctx.fill();
  }
  function wings(ctx, z, t) {
    const fl = Math.sin(t * 10) * 0.5;
    for (const s of [1, -1]) {
      ctx.save(); ctx.translate(6, -76); ctx.rotate(s * (0.5 + fl * s) - 0.2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(48, -20); ctx.quadraticCurveTo(40, -6, 46, 4); ctx.quadraticCurveTo(32, 0, 30, 10); ctx.quadraticCurveTo(18, 4, 0, 6); ctx.closePath();
      ctx.fillStyle = k('#3a1a3a'); ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.restore();
    }
  }
  function cape(ctx, z, t, top) {
    ctx.beginPath(); ctx.moveTo(10, top + 4); ctx.quadraticCurveTo(30 + Math.sin(t * 3) * 6, top + 40, 26, -10); ctx.lineTo(8, -14); ctx.closePath();
    ctx.fillStyle = k('#7a1a2a'); ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = k(A.INK); ctx.stroke();
  }
  function cannon(ctx, z, t) {
    ctx.save(); ctx.translate(-50, 0);
    A.circ(ctx, 0, -12, 12, '#6a4a2a', 3); A.circ(ctx, 0, -12, 4, '#3a2a1a', 0);
    const rec = z.throwT > 0 && z.throwT < 0.4 ? (0.4 - z.throwT) * 20 : 0;
    ctx.save(); ctx.translate(rec, -22); ctx.rotate(-0.35);
    A.rrect(ctx, -38, -10, 48, 20, 8, '#3a3a44', 3); A.ell(ctx, -38, 0, 5, 10, 0, '#1a1a20', 2);
    ctx.restore();
    ctx.restore();
  }

  /* ---------------------------------------------------------------
     Udseender
     --------------------------------------------------------------- */
  const LOOKS = {
    shambler: { shirt: '#7a6a4a', tie: '#b8283a', pants: '#4a4f72', hair: '#3a2a1a' },
    flag: { shirt: '#6a7a4a', tie: '#2a5ad6', pants: '#4a4f72', held: 'flag', hair: '#3a2a1a' },
    pothead: { shirt: '#7a5a4a', tie: '#3a8a3a', pants: '#3f4a6a', hat: 'pot' },
    sprinter: { shirt: '#e8e8f0', pants: '#2a4ad6', hat: 'cap', skin: '#98b88a', lean: -0.25 },
    kettle: { shirt: '#6a5a7a', tie: '#c0a03a', pants: '#3a3a5a', hat: 'kettle' },
    shieldbearer: { shirt: '#8a6a3a', pants: '#4a4a3a', held: 'gate', hair: '#5a3a1a' },
    polejumper: { shirt: '#e8c03a', pants: '#2a2a3a', held: 'pole', hat: 'headband', lean: -0.2 },
    brute: { shirt: '#5a4a3a', pants: '#3a3a4a', body: 'big', scale: 1.15, skin: '#94ad80', angry: true, hair: '#2a1a0a' },
    tosser: { shirt: '#9a7a5a', pants: '#5a4a3a', held: 'rock', hat: 'bandana' },
    gnawer: { shirt: '#5a3a3a', pants: '#3a2a2a', skin: '#b0b47a', angry: true, beard: '#4a3a2a' },
    splitter: { shirt: '#a04ad6', pants: '#4a2a6a', skin: '#a8c890', hair: '#2a1a3a' },
    mini: { shirt: '#c0603a', pants: '#3a3a4a', scale: 0.62, skin: '#b0c890', angry: true },
    warden: { shirt: '#3a5a8a', pants: '#2a3a5a', held: 'staff', orb: '#9ae0ff', plate: '#9aa8c0', hat: 'tophat' },
    berserker: { shirt: '#8a2a2a', pants: '#3a1a1a', angry: true, skin: '#b89a80', hat: 'headband', hair: '#c83a1a' },
    sidestepper: { shirt: '#e86a3a', pants: '#2a2a3a', hat: 'cap', lean: -0.05 },
    balloon: { shirt: '#5a9ad6', pants: '#3a3a5a', hair: '#e8c03a' },
    giant: { shirt: '#5a5a3a', pants: '#3a3a2a', body: 'big', scale: 1.6, held: 'club', angry: true, skin: '#8aa478', keepArm: true },
    digger: { shirt: '#7a6a5a', pants: '#4a3a2a', hat: 'hardhat', beard: '#5a4a3a' },
    mummy: { shirt: '#e6ddc0', pants: '#d8cfb0', skin: '#c8c09a', hat: 'wrap', eyeWhite: '#ffe680', pupil: '#3a2a0a' },
    sarcophagus: { shirt: '#e6ddc0', pants: '#d8cfb0', skin: '#c8c09a', hat: 'pharaoh', held: 'sarco' },
    swashbuckler: { shirt: '#f0e8d8', vest: '#2a2a3a', pants: '#5a3a2a', hat: 'bandana', held: 'cutlass', patch: true },
    cannoneer: { shirt: '#3a3a6a', pants: '#2a2a3a', hat: 'tricorn', beard: '#2a1a0a' },
    pianist: { shirt: '#1a1a24', tie: '#ffffff', pants: '#1a1a24', held: 'piano', hat: 'tophat' },
    gunslinger: { shirt: '#c08a4a', vest: '#5a3a1a', pants: '#3a3a5a', hat: 'cowboy', held: 'pistol' },
    prospector: { shirt: '#a04a3a', pants: '#3a4a6a', hat: 'hardhat', held: 'dynamite', beard: '#d0d0d0' },
    shieldbot: { shirt: '#b8c6e0', pants: '#6a7488', skin: '#a8c0c8', hat: 'robohelm', held: 'energy' },
    jetpack: { shirt: '#4ad0e0', pants: '#3a4a6a', hat: 'robohelm', skin: '#a8c0c8' },
    hologram: { shirt: '#5ae0ff', pants: '#3aa0d6', skin: '#9ae8ff', hair: '#5ae0ff' },
    mech: { skin: '#a8c0c8' },
    knight: { shirt: '#5a5a6a', pants: '#4a4a5a', hat: 'helmet', plate: '#c8d0dc' },
    necromancer: { shirt: '#2a1a3a', pants: '#1a1024', hat: 'hood', held: 'staff', orb: '#7affa0', staffCol: '#3a2a2a', eyeWhite: '#c8ffd0' },
    witch: { shirt: '#4a2a6a', pants: '#2a1a3a', hat: 'witch', held: 'broom', skin: '#a8c890', hair: '#2a1a1a' },
    vampire: { shirt: '#1a1a24', vest: '#7a1a2a', pants: '#1a1a24', skin: '#c8d0d8', hair: '#1a1a1a', angry: true, pupil: '#c0102a' },
    skater: { shirt: '#3aa0e0', pants: '#2a3a6a', hat: 'beanie', lean: -0.3, shoe: '#e8e8f0' },
    snowballer: { shirt: '#e86a6a', pants: '#3a3a6a', hat: 'beanie', held: 'snowball' },
    yeti: { shirt: '#eef3ff', pants: '#d8e4f0', skin: '#b8d0e8', body: 'big', scale: 1.3, hat: 'fur', angry: true },
    driver: { shirt: '#2a3a6a', pants: '#2a2a3a', hat: 'drivercap', held: 'car' },
    breakdancer: { shirt: '#ffd23f', pants: '#e83a8a', hat: 'cap', held: 'boombox' },
    vineswinger: { shirt: '#5a8a3a', pants: '#6a4a2a', held: 'vine', hair: '#2a1a0a', skin: '#a8b07a' },
    toad: { shirt: '#5aa83a', pants: '#3a6a2a', skin: '#8ad06a', body: 'big', scale: 1.05, eyeWhite: '#ffef6a' },
    shaman: { shirt: '#a85a2a', pants: '#5a3a1a', hat: 'mask', held: 'staff', orb: '#ff9ad5' },
    imperial: { shirt: '#5a1a2a', pants: '#2a1a1a', hat: 'imperial', held: 'tower', plate: '#ffd86a' },
  };

  /* ---------------------------------------------------------------
     Zombiedata
     ab = evner (læses af game.js). Hooks: init, tick (returner true for
     at springe standard-bevægelse over), onDeath.
     --------------------------------------------------------------- */
  const L = [];
  function def(d) { d.look = LOOKS[d.id] || LOOKS.shambler; L.push(d); return d; }

  def({ id: 'shambler', name: 'Gåeren', w: 0, hp: 200, speed: 19, eat: 60, cost: 1, desc: 'En helt almindelig zombie. Langsom og dum - men der kommer mange af dem.', tip: 'Én Kernekanon klarer en Gåer på ca. 15 sekunder.' });
  def({ id: 'flag', name: 'Fanebæreren', w: 0, hp: 200, speed: 27, eat: 60, cost: 1, desc: 'Bærer zombiernes fane og fører de store bølger an.', tip: 'Når han dukker op, kommer der en stor bølge.' });
  def({ id: 'pothead', name: 'Pottehovedet', w: 0, hp: 200, armor: 370, speed: 19, eat: 60, cost: 2, desc: 'Har fundet en urtepotte og bruger den som hjelm.', tip: 'Potten tager skade først. Gift går udenom.' });
  def({ id: 'sprinter', name: 'Sprinteren', w: 0, hp: 170, speed: 40, eat: 60, cost: 2, desc: 'Træningstøj og ingen tålmodighed. Løber direkte mod dit forsvar.', tip: 'Isknop og Slimknop sænker farten.' });
  def({ id: 'kettle', name: 'Kedelhovedet', w: 0, hp: 200, armor: 1100, speed: 19, eat: 60, cost: 4, desc: 'En stålkedel på hovedet gør ham næsten uskadelig for almindelige skud.', tip: 'Gift og eksplosioner er effektive. Kvikjord sluger ham.' });
  def({ id: 'shieldbearer', name: 'Lågebæreren', w: 0, hp: 200, shield: 900, speed: 19, eat: 60, cost: 4, desc: 'Gemmer sig bag en havelåge, der stopper skud forfra.', tip: 'Kasteplanter (Bombebær, Græskarkaster) og Piggebold rammer over lågen.' });
  def({ id: 'polejumper', name: 'Stangspringeren', w: 0, hp: 340, speed: 36, eat: 60, cost: 3, ab: { jump: 1 }, desc: 'Springer over den første plante, han møder, med sin stang.', tip: 'Stenrod er for høj til at springe over.' });
  def({ id: 'brute', name: 'Bøffen', w: 0, hp: 1400, speed: 15, eat: 130, cost: 7, heavy: true, desc: 'Stor, sur og sulten. Tygger planter i halvt så lang tid.', tip: 'Brug Tomatbombe eller Kvikjord.' });
  def({ id: 'tosser', name: 'Stenkasteren', w: 0, hp: 300, speed: 19, eat: 60, cost: 4, ab: { thrower: { range: 4, every: 5, dmg: 120, proj: 'rock' } }, desc: 'Kaster sten på planter flere felter foran sig.', tip: 'Sæt barrierer foran - eller nedkæmp ham hurtigt.' });
  def({ id: 'gnawer', name: 'Gnaveren', w: 0, hp: 320, speed: 22, eat: 240, cost: 3, desc: 'Har tænder som en bæver. Æder forsvarsplanter fire gange hurtigere.', tip: 'Fang ham før han når dine vægge.' });
  def({ id: 'splitter', name: 'Splitteren', w: 0, hp: 500, speed: 18, eat: 60, cost: 4, ab: { split: 2 }, desc: 'Når han besejres, deler han sig i to Pjokker.', tip: 'Områdeskade klarer også Pjokkerne.' });
  def({ id: 'mini', name: 'Pjokken', w: 0, hp: 90, speed: 34, eat: 50, cost: 1, small: true, desc: 'En lillebitte, hurtig zombie. Bliver kastet, splittet og sendt i forvejen.', tip: 'Dør af få skud.' });
  def({ id: 'warden', name: 'Vogteren', w: 0, hp: 500, armor: 200, speed: 17, eat: 60, cost: 6, ab: { ward: { every: 6, amt: 160, rad: 1.6 } }, desc: 'Beskytter zombierne omkring sig med skinnende skjolde.', tip: 'Prioritér ham - Lynkløver og Tornlanse er gode.' });
  def({ id: 'berserker', name: 'Den Rasende', w: 0, hp: 650, speed: 15, eat: 80, cost: 4, ab: { berserk: 1 }, desc: 'Jo mere han bliver skadet, jo hurtigere og vildere løber han.', tip: 'Gør ham langsom, eller dræb ham med ét stort slag.' });
  def({ id: 'sidestepper', name: 'Sidetrinneren', w: 0, hp: 360, speed: 22, eat: 60, cost: 3, ab: { lane: { every: 6 } }, desc: 'Skifter række uden varsel og finder huller i dit forsvar.', tip: 'Hav forsvar i alle rækker.' });
  def({ id: 'balloon', name: 'Ballonfyren', w: 0, hp: 200, speed: 18, eat: 60, cost: 3, ab: { fly: 'balloon' }, desc: 'Svæver over planterne i en ballon. Almindelige skud flyver under ham.', tip: 'Nålepude og Lynkløver rammer ballonen. Blæsebælg blæser ham væk.' });
  def({ id: 'giant', name: 'Kæmpen', w: 0, hp: 3000, speed: 12, eat: 0, cost: 15, heavy: true, ab: { smash: 1, imp: 1 }, desc: 'En kæmpe med en træstamme som kølle. Knuser planter i ét slag og kaster en Pjok bag dit forsvar.', tip: 'Brug alt du har: eksplosioner, frost og Kvikjord (den skader ham).' });
  def({ id: 'digger', name: 'Graveren', w: 0, hp: 300, armor: 100, speed: 22, eat: 60, cost: 4, ab: { dig: 1 }, desc: 'Graver sig under dit forsvar og angriber bagfra.', tip: 'Piggebold skyder bagud. Knoldmine og eksplosioner rammer under jorden.' });
  // Sandstormens Rige
  def({ id: 'mummy', name: 'Mumien', w: 2, hp: 280, speed: 16, eat: 60, cost: 2, resist: { fire: 1.5, ice: 0.5 }, ab: { tomb: 1 }, desc: 'Gammel og tør. Når han falder, efterlader han en gravsten.', tip: 'Brænder godt. Gravsten blokerer lige skud.' });
  def({ id: 'scarab', name: 'Skarabæsværmen', w: 2, hp: 80, speed: 38, eat: 40, cost: 2.5, small: true, ab: { swarm: 3 }, desc: 'Små hurtige biller, der altid kommer i flok.', tip: 'Piggebold og Laserlilje klarer flokke.' });
  def({ id: 'sarcophagus', name: 'Sarkofagbæreren', w: 2, hp: 260, shield: 1600, speed: 16, eat: 60, cost: 6, desc: 'Gemmer sig bag et gyldent sarkofaglåg.', tip: 'Kasteplanter rammer bag låget.' });
  // Piratbugten
  def({ id: 'swashbuckler', name: 'Svingpiraten', w: 3, hp: 320, speed: 20, eat: 60, cost: 3, ab: { swingIn: 1 }, desc: 'Svinger sig ind fra skibet i et reb og lander midt på banen.', tip: 'Han springer over dine forreste rækker - hav forsvar længere tilbage.' });
  def({ id: 'parrot', name: 'Ådselpapegøjen', w: 3, hp: 160, speed: 30, eat: 0, cost: 4, ab: { fly: 'bird', snatch: 1 }, desc: 'En zombiepapegøje, der flyver hen og stjæler en af dine planter.', tip: 'Nålepude og Blæsebælg. Dræb den, før den flyver væk med planten.' });
  def({ id: 'cannoneer', name: 'Kanonéren', w: 3, hp: 420, speed: 18, eat: 60, cost: 5, ab: { cannon: { every: 6.5, dmg: 280, shots: 4 } }, desc: 'Stiller sig op i kanten af banen og beskyder dine planter.', tip: 'Langtrækkende skydeplanter rammer ham, mens han lader.' });
  // Det Vilde Vest
  def({ id: 'pianist', name: 'Klavermanden', w: 4, hp: 400, armor: 700, speed: 15, eat: 60, cost: 7, ab: { crush: 1 }, desc: 'Skubber et klaver foran sig, der flader alle planter ud.', tip: 'Stenrod stopper klaveret. Tornmåtte smadrer det.' });
  def({ id: 'gunslinger', name: 'Pistoleroen', w: 4, hp: 420, speed: 19, eat: 60, cost: 4, ab: { gunner: { range: 3.2, every: 2.4, dmg: 45 } }, desc: 'Stopper på afstand og skyder dine planter i stykker.', tip: 'Kasteplanter og lange skud rammer ham.' });
  def({ id: 'prospector', name: 'Guldgraveren', w: 4, hp: 320, speed: 20, eat: 60, cost: 4, ab: { blast: 4 }, desc: 'Tænder sin dynamit og flyver bag om dit forsvar.', tip: 'Piggebold og Bumerangblad rammer bagud.' });
  // Neonfremtiden
  def({ id: 'shieldbot', name: 'Skjoldrobotten', w: 5, hp: 420, shield: 650, speed: 18, eat: 60, cost: 6, resist: { poison: 0, elec: 1.5 }, ab: { regenShield: 160 }, desc: 'Et energiskjold, der lader sig op igen, hvis du holder pause.', tip: 'Lyn gør tredobbelt skade på skjoldet. Hold presset.' });
  def({ id: 'jetpack', name: 'Jetpakkeren', w: 5, hp: 280, speed: 34, eat: 60, cost: 4, resist: { poison: 0 }, ab: { fly: 'jet' }, desc: 'Suser hen over planterne på en jetpakke.', tip: 'Nålepude, Lynkløver og Laserlilje Lv3 rammer flyvende.' });
  def({ id: 'hologram', name: 'Holo-zombien', w: 5, hp: 360, speed: 20, eat: 60, cost: 4, resist: { poison: 0 }, ab: { phase: { every: 4.5, dur: 2 } }, desc: 'Flimrer mellem dimensioner og er immun, mens han er gennemsigtig.', tip: 'Gennemborende og områdeangreb er bedst.' });
  def({ id: 'mech', name: 'Meka-kæmpen', w: 5, hp: 3800, speed: 11, eat: 0, cost: 18, heavy: true, resist: { poison: 0, elec: 1.4 }, ab: { smash: 1, laser: { every: 8, dmg: 300 } }, desc: 'En kæmperobot med en zombie i cockpittet. Knuser planter og skyder med laser.', tip: 'Lyn og eksplosioner.' });
  // Skyggernes Slot
  def({ id: 'knight', name: 'Ridderen', w: 6, hp: 300, armor: 1800, speed: 17, eat: 70, cost: 6, resist: { poison: 0.5 }, desc: 'Tung rustning fra top til tå.', tip: 'Gennemborende Tornlanse Lv5 og eksplosioner.' });
  def({ id: 'necromancer', name: 'Nekromantikeren', w: 6, hp: 520, speed: 16, eat: 60, cost: 7, ab: { raise: { every: 9 } }, desc: 'Vækker nye zombier op af jorden omkring sig.', tip: 'Nedkæmp ham hurtigt, ellers vokser hæren.' });
  def({ id: 'witch', name: 'Heksen', w: 6, hp: 420, speed: 18, eat: 60, cost: 5, ab: { hex: { every: 7, range: 3.5, dur: 8 } }, desc: 'Forhekser planter, så de ikke kan angribe i en periode.', tip: 'Hun har ikke meget liv - fokusér skud.' });
  def({ id: 'vampire', name: 'Vampyren', w: 6, hp: 460, speed: 20, eat: 0, cost: 5, ab: { fly: 'wings', swoop: { every: 5, dmg: 160 } }, desc: 'Flyver over dit forsvar og dykker ned for at suge liv fra planterne.', tip: 'Han kan rammes af alt, når han dykker.' });
  // Den Frosne Grænse
  def({ id: 'skater', name: 'Skøjteløberen', w: 7, hp: 320, speed: 46, eat: 60, cost: 3, resist: { ice: 0 }, desc: 'Glider lynhurtigt hen over isen. Kan ikke gøres langsom af frost.', tip: 'Vægge stopper ham. Ild og gift virker fint.' });
  def({ id: 'snowballer', name: 'Snekasteren', w: 7, hp: 360, speed: 18, eat: 60, cost: 4, ab: { thrower: { range: 4, every: 6, dmg: 40, proj: 'snow', freeze: 5 } }, desc: 'Kaster snebolde, der fryser dine planter fast.', tip: 'Ildblomst tør frosne planter op.' });
  def({ id: 'yeti', name: 'Yetien', w: 7, hp: 1900, speed: 13, eat: 150, cost: 9, heavy: true, resist: { ice: 0, fire: 1.4 }, ab: { regen: 12 }, desc: 'En vandrende snebjørn af en zombie. Heler sig selv og er immun over for frost.', tip: 'Ild gør ekstra skade.' });
  // Den Forladte Storby
  def({ id: 'driver', name: 'Bilisten', w: 8, hp: 260, armor: 1100, speed: 21, eat: 60, cost: 8, ab: { crush: 1, car: 1 }, desc: 'Kører hen over dine planter i en rusten bil.', tip: 'Tornmåtte punkterer bilen. Stenrod stopper den.' });
  def({ id: 'breakdancer', name: 'Breakeren', w: 8, hp: 380, speed: 21, eat: 60, cost: 4, ab: { kick: { every: 5 } }, desc: 'Sparker zombierne foran sig fremad med sine dansetrin.', tip: 'Nedkæmp ham før han sender andre afsted.' });
  // Den Giftige Jungle
  def({ id: 'vineswinger', name: 'Lianesvingeren', w: 9, hp: 360, speed: 22, eat: 60, cost: 4, ab: { jump: 2 }, desc: 'Svinger over de to første planter i en lian.', tip: 'Stenrod er for høj.' });
  def({ id: 'toad', name: 'Giftfrøen', w: 9, hp: 640, speed: 16, eat: 70, cost: 5, resist: { poison: 0 }, ab: { toxicBite: 40 }, desc: 'Immun over for gift - og forgifter de planter, den æder.', tip: 'Ild og eksplosioner.' });
  def({ id: 'shaman', name: 'Shamanen', w: 9, hp: 460, speed: 17, eat: 60, cost: 6, ab: { heal: { every: 2, amt: 70, rad: 1.6 } }, desc: 'Heler zombierne omkring sig med sin stav.', tip: 'Prioritér ham først.' });
  // Zombieimperiet
  def({ id: 'imperial', name: 'Kejservagten', w: 10, hp: 600, armor: 800, shield: 800, speed: 18, eat: 80, cost: 10, resist: { fire: 0.8, ice: 0.8, poison: 0.8, elec: 0.8 }, desc: 'Kejserens elitevagt med skjold, rustning og modstand mod alt.', tip: 'Kombinér kastere, gift og eksplosioner.' });

  /* ---------------------------------------------------------------
     Bosser - én pr. verden
     --------------------------------------------------------------- */
  const BOSSES = {};
  function boss(d) { BOSSES[d.id] = d; return d; }

  function bossFace(ctx, x, y, s, t, rage) {
    A.eye(ctx, x - s * 0.5, y, s * 0.32, -0.6, 0.1, 0, { white: rage ? '#ffd0a0' : '#f4f0c0', pupil: 0.35, pupilCol: rage ? '#c0102a' : '#2a0a0a', brow: -1, lw: 3 });
    A.eye(ctx, x + s * 0.3, y - s * 0.05, s * 0.26, -0.6, 0.1, 0, { white: rage ? '#ffd0a0' : '#f4f0c0', pupil: 0.35, pupilCol: rage ? '#c0102a' : '#2a0a0a', brow: 1, lw: 3 });
    A.mouth(ctx, x - s * 0.1, y + s * 0.6, s * 0.9, 'teeth', 0.4 + Math.abs(Math.sin(t * 2)) * 0.3);
  }
  boss({
    id: 'kompost', name: 'Kompostkongen', hp: 9000, weak: 'fire', attacks: ['summon', 'lob', 'stomp'], pool: ['shambler', 'pothead', 'sprinter', 'kettle'],
    desc: 'En kæmpe, rådden kompostbunke med krone. Hersker over haveaffaldet.', weakText: 'Ild gør dobbelt skade. Eksplosioner tæt på lammer ham.',
    draw(ctx, b, t) {
      const br = Math.sin(t * 1.5) * 4, rage = b.phase >= 2;
      ctx.beginPath(); ctx.moveTo(-120, 0); ctx.bezierCurveTo(-140, -160 - br, -40, -250 - br, 20, -240 - br); ctx.bezierCurveTo(100, -230, 140, -120, 110, 0); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -250, 0, '#8a7a3a', '#3a2a14'); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.save(); ctx.clip();
      [[-70, -60, '#e85a3a'], [40, -40, '#ffd23f'], [-20, -140, '#7ad04a'], [60, -120, '#c8a07a'], [-90, -120, '#9a5ad6'], [10, -80, '#e8e0c0']].forEach((c, i) => {
        ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(i); A.ell(ctx, 0, 0, 18, 10, 0, c[2], 2.4); ctx.restore();
      });
      A.speckle(ctx, -120, -240, 240, 240, 60, '#2a1a0a', 5, 3);
      ctx.restore();
      ctx.save(); ctx.translate(10, -238 - br);
      A.poly(ctx, [-44, 0, -50, -40, -24, -18, 0, -50, 24, -18, 50, -40, 44, 0], '#ffd23f', 3);
      A.circ(ctx, 0, -14, 6, '#e8323a', 2);
      ctx.restore();
      bossFace(ctx, -10, -150 - br, 70, t, rage);
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 90 - 20, -110); ctx.rotate(s * 0.3 + Math.sin(t * 2 + s) * 0.15 - (b.atkAnim || 0) * s * 0.8); limb(ctx, [0, 0, -40 * s * -1 - 40, 40, -70, 70], 22, '#6a5a2a'); ctx.restore(); }
    },
  });
  boss({
    id: 'farao', name: 'Sandfaraoen', hp: 12500, weak: 'fire', attacks: ['summon', 'sandstorm', 'beam'], pool: ['mummy', 'scarab', 'sarcophagus', 'pothead'],
    desc: 'En ældgammel konge, vækket af sandstormen. Hans øjne skyder stråler.', weakText: 'Ild gør dobbelt skade. Hans skjoldfase brydes af ild og eksplosioner.',
    shieldPhase: true,
    draw(ctx, b, t) {
      const fl = Math.sin(t * 1.2) * 6, rage = b.phase >= 2;
      ctx.save(); ctx.translate(0, fl);
      A.poly(ctx, [-90, -10, -100, -170, -60, -250, 60, -250, 100, -170, 90, -10], '#e6ddc0', 4);
      ctx.strokeStyle = k('#c9bd9a'); ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(-95, -20 - i * 19); ctx.lineTo(95, -30 - i * 18); ctx.stroke(); }
      ctx.save(); ctx.translate(0, -230);
      A.poly(ctx, [-90, 120, -84, -10, -40, -60, 40, -60, 84, -10, 90, 120, 56, 120, 50, 20, -50, 20, -56, 120], '#2a5ad6', 4);
      ctx.strokeStyle = k('#ffd23f'); ctx.lineWidth = 5;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-86, 0 + i * 18); ctx.lineTo(-56, 0 + i * 18); ctx.moveTo(56, i * 18); ctx.lineTo(86, i * 18); ctx.stroke(); }
      A.circ(ctx, 0, -40, 12, '#ffd23f', 3);
      ctx.restore();
      A.rrect(ctx, -54, -220, 108, 110, 30, '#c8c09a', 4);
      bossFace(ctx, -6, -180, 60, t, rage);
      if (b.beamCharge > 0) { A.glow(ctx, -30, -180, 60, '#ffd23f', b.beamCharge); }
      ctx.restore();
    },
  });
  boss({
    id: 'raadskaeg', name: 'Kaptajn Rådskæg', hp: 15500, weak: 'explode', attacks: ['summon', 'volley', 'anchor'], pool: ['swashbuckler', 'pothead', 'kettle', 'parrot', 'cannoneer'],
    desc: 'Kaptajn på det sunkne zombieskib. Fyrer bredsider ind over haven.', weakText: 'Eksplosioner gør dobbelt skade.',
    draw(ctx, b, t) {
      const rock = Math.sin(t * 1.3) * 0.04, rage = b.phase >= 2;
      ctx.save(); ctx.rotate(rock);
      ctx.beginPath(); ctx.moveTo(-80, -60); ctx.lineTo(140, -90); ctx.lineTo(150, 10); ctx.lineTo(-40, 10); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -90, 10, '#8a5a30', '#4a2a14'); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.strokeStyle = k('#3a2010'); ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-70 + i * 10, -60 + i * 18); ctx.lineTo(146, -88 + i * 24); ctx.stroke(); }
      for (let i = 0; i < 3; i++) { A.circ(ctx, -10 + i * 50, -40 - i * 2, 10, '#1a1a20', 3); }
      A.stem(ctx, 90, -90, 90, -330, 0, 10, '#6a4a2a');
      ctx.beginPath(); ctx.moveTo(96, -310); ctx.quadraticCurveTo(150 + Math.sin(t * 2) * 8, -240, 96, -140); ctx.closePath();
      ctx.fillStyle = k('#d8d0b8'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.save(); ctx.translate(20, -90); ctx.scale(1.9, 1.9);
      humanoid(ctx, { walk: 0, hp: 1, maxHp: 1, state: 'walk', seed: 7 }, t, { shirt: '#7a1a2a', vest: '#2a2a3a', pants: '#2a2a3a', hat: 'tricorn', beard: '#3a6a2a', patch: true, angry: rage, held: 'cutlass', keepArm: true });
      ctx.restore();
      ctx.restore();
    },
  });
  boss({
    id: 'larry', name: 'Lokomotiv-Larry', hp: 18500, weak: 'ice', attacks: ['summon', 'charge', 'dynamite'], pool: ['gunslinger', 'prospector', 'pianist', 'kettle', 'sprinter'],
    desc: 'Et fuldt dampende zombie-lokomotiv. Sender løbske minevogne ned gennem rækkerne.', weakText: 'Frost køler kedlen: dobbelt skade og frost lammer ham længere.',
    draw(ctx, b, t) {
      const sh = Math.sin(t * 16) * 1.5, rage = b.phase >= 2;
      ctx.save(); ctx.translate(0, sh);
      for (let i = 0; i < 3; i++) { const st = (t * 0.8 + i / 3) % 1; ctx.globalAlpha = 1 - st; A.circ(ctx, -40 + st * 20, -250 - st * 90, 20 + st * 30, '#d8d8e0', 0); ctx.globalAlpha = 1; }
      A.rrect(ctx, -110, -180, 230, 150, 20, '#2a2a34', 4);
      A.rrect(ctx, -110, -200, 150, 110, 50, '#3a3a48', 4);
      A.rrect(ctx, -60, -260, 34, 70, 6, '#2a2a34', 4);
      A.rrect(ctx, 50, -250, 70, 100, 8, '#7a2a2a', 4);
      ctx.fillStyle = 'rgba(255,220,120,.5)'; ctx.fillRect(62, -236, 46, 36);
      A.circ(ctx, -110, -145, 30, '#ffd23f', 4); A.glow(ctx, -130, -145, 70, '#fff07a', 0.4);
      bossFace(ctx, -110, -150, 40, t, rage);
      A.poly(ctx, [-130, -40, -170, 0, -100, 0, -100, -40], '#8a8a96', 3);
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(-70 + i * 55, -24); A.circ(ctx, 0, 0, 26, '#c0283a', 4); A.circ(ctx, 0, 0, 8, '#2a2a34', 2); ctx.rotate(-t * 4); ctx.strokeStyle = k(A.INK); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.stroke(); ctx.restore(); }
      ctx.restore();
    },
  });
  boss({
    id: 'zombot', name: 'Mega-Zombot 3000', hp: 22000, weak: 'elec', attacks: ['laser', 'missiles', 'summon'], pool: ['shieldbot', 'jetpack', 'hologram', 'kettle', 'berserker'],
    desc: 'Fremtidens ultimative kampmaskine. Energiskjold, laser og missiler.', weakText: 'Lyn gør dobbelt skade og bryder energiskjoldet.',
    shieldPhase: true,
    draw(ctx, b, t) {
      const hov = Math.sin(t * 2) * 6, rage = b.phase >= 2;
      ctx.save(); ctx.translate(0, hov);
      A.glow(ctx, 0, -10, 90, '#5ae0ff', 0.3);
      A.rrect(ctx, -100, -230, 200, 190, 30, '#9aa8c4', 4);
      ctx.fillStyle = k('#6a7894'); ctx.fillRect(-90, -120, 180, 10);
      A.rrect(ctx, -70, -300, 140, 80, 20, '#b8c6e0', 4);
      ctx.fillStyle = rage ? 'rgba(255,60,60,.8)' : 'rgba(90,230,255,.8)'; U.roundRect(ctx, -56, -282, 112, 34, 12); ctx.fill();
      A.circ(ctx, -26 + Math.sin(t * 2) * 10, -265, 8, '#ffffff', 0); A.circ(ctx, 26 + Math.sin(t * 2) * 10, -265, 8, '#ffffff', 0);
      ctx.save(); ctx.translate(0, -175); ctx.scale(1.3, 1.3); headShape(ctx, { skin: '#a8c0c8' }, b, t, 0.3); ctx.restore();
      for (const s of [-1, 1]) { A.rrect(ctx, s * 110 - 20, -210, 40, 120, 14, '#7a88a4', 4); A.rrect(ctx, s * 110 - 26, -100, 52, 40, 10, '#5a6680', 4); }
      A.ell(ctx, 0, -30, 80, 16, 0, '#5a6680', 4);
      ctx.fillStyle = 'rgba(120,240,255,' + (0.5 + Math.sin(t * 20) * 0.3) + ')'; ctx.beginPath(); ctx.ellipse(0, -18, 60, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
  });
  boss({
    id: 'drage', name: 'Dragezombien', hp: 26000, weak: 'ice', attacks: ['firebreath', 'summonBats', 'lob'], pool: ['knight', 'necromancer', 'witch', 'vampire', 'kettle'],
    desc: 'En udød drage fra slottets dybeste kælder. Spyr grønne flammer.', weakText: 'Frost gør dobbelt skade og stopper hans ildånde.',
    draw(ctx, b, t) {
      const fl = Math.sin(t * 3) * 0.3, rage = b.phase >= 2;
      for (const s of [1, -1]) {
        ctx.save(); ctx.translate(40, -200); ctx.rotate(s * (0.4 + fl) - 0.6);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(160, -80); ctx.quadraticCurveTo(140, -30, 150, 0); ctx.quadraticCurveTo(110, -10, 100, 20); ctx.quadraticCurveTo(60, 0, 0, 20); ctx.closePath();
        ctx.fillStyle = k('#3a2a4a'); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = k(A.INK); ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.moveTo(-60, 0); ctx.bezierCurveTo(-90, -120, 20, -200, 80, -150); ctx.bezierCurveTo(130, -100, 110, -20, 90, 0); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -200, 0, '#6a8a5a', '#2a3a2a'); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.strokeStyle = k('#c8d0b8'); ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(20, -80, 30 + i * 9, 2.4, 3.6); ctx.stroke(); }
      ctx.save(); ctx.translate(-60, -190 + Math.sin(t * 1.5) * 8);
      A.stem(ctx, 80, 60, 20, 10, -20, 30, '#5a7a4a');
      ctx.beginPath(); ctx.moveTo(-70, 10); ctx.lineTo(-10, -30); ctx.lineTo(40, -20); ctx.lineTo(50, 30); ctx.lineTo(-60, 36); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -30, 36, '#7a9a6a', '#3a5a3a'); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.poly(ctx, [10, -26, 30, -60, 34, -22], '#e8e0c0', 3); A.poly(ctx, [-10, -28, 0, -56, 12, -28], '#e8e0c0', 3);
      A.eye(ctx, -6, -6, 9, -0.6, 0, 0, { white: rage ? '#ff6a3a' : '#c8ff6a', pupil: 0.3, brow: -1 });
      for (let i = 0; i < 4; i++) A.poly(ctx, [-60 + i * 12, 32, -54 + i * 12, 44, -48 + i * 12, 32], '#f4f0d0', 2);
      if (b.beamCharge > 0) A.glow(ctx, -70, 20, 60, '#7aff5a', b.beamCharge);
      ctx.restore();
    },
  });
  boss({
    id: 'frostjaette', name: 'Frostjætten', hp: 30000, weak: 'fire', attacks: ['freeze', 'iceblock', 'stomp', 'summon'], pool: ['skater', 'snowballer', 'yeti', 'giant', 'kettle'],
    desc: 'Et bjerg af is og vrede. Fryser din have til en gletsjer.', weakText: 'Ild gør dobbelt skade. Ildblomster tør hans frost op.',
    shieldPhase: true,
    draw(ctx, b, t) {
      const br = Math.sin(t * 1.2) * 3, rage = b.phase >= 2;
      A.poly(ctx, [-110, 0, -130, -140, -80, -250 - br, 0, -280 - br, 80, -250 - br, 130, -150, 110, 0], '#bfe4ff', 4);
      ctx.save(); A.poly(ctx, [-110, 0, -130, -140, -80, -250 - br, 0, -280 - br, 80, -250 - br, 130, -150, 110, 0], null, 0); ctx.clip();
      ctx.fillStyle = k('#8fc4ef'); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-120 + i * 45, 0); ctx.lineTo(-90 + i * 45, -280); ctx.lineTo(-70 + i * 45, -280); ctx.lineTo(-100 + i * 45, 0); ctx.fill(); }
      ctx.restore();
      for (let i = 0; i < 5; i++) A.poly(ctx, [-80 + i * 40, -250 - br, -66 + i * 40, -310 - br - (i % 2) * 20, -52 + i * 40, -250 - br], '#e9f8ff', 3);
      bossFace(ctx, -10, -170 - br, 80, t, rage);
      ctx.fillStyle = k('#e9f8ff'); ctx.beginPath(); ctx.moveTo(-70, -110); ctx.quadraticCurveTo(-10, -40, 50, -110); ctx.quadraticCurveTo(-10, -80, -70, -110); ctx.fill();
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 110, -140); ctx.rotate(s * 0.4 - (b.atkAnim || 0) * 0.7); A.rrect(ctx, -26, 0, 52, 120, 24, '#9fd0f5', 4); ctx.restore(); }
    },
  });
  boss({
    id: 'bulldozer', name: 'Bulldozer-Bossen', hp: 34000, weak: 'pierce', attacks: ['charge', 'cars', 'summon'], pool: ['driver', 'breakdancer', 'kettle', 'gnawer', 'berserker'],
    desc: 'Byens nedrivningsboss. Kører alt ned og kaster vragbiler efter dig.', weakText: 'Gennemborende angreb (torne, laser) gør dobbelt skade.',
    draw(ctx, b, t) {
      const sh = Math.sin(t * 18) * 1.5, rage = b.phase >= 2;
      ctx.save(); ctx.translate(0, sh);
      A.rrect(ctx, -60, -200, 170, 140, 14, '#ffc23a', 4);
      ctx.fillStyle = k('#1a1a20'); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-60 + i * 30, -60); ctx.lineTo(-45 + i * 30, -60); ctx.lineTo(-30 + i * 30, -80); ctx.lineTo(-45 + i * 30, -80); ctx.fill(); }
      A.rrect(ctx, 0, -300, 100, 110, 10, '#ffc23a', 4);
      ctx.fillStyle = 'rgba(160,220,255,.5)'; ctx.fillRect(12, -288, 76, 60);
      ctx.save(); ctx.translate(50, -238); ctx.scale(1.2, 1.2); headShape(ctx, { skin: '#9ab88a', angry: true }, b, t, 0.3); hat(ctx, b, { hat: 'hardhat' }, t); ctx.restore();
      A.rrect(ctx, -70, -60, 190, 56, 26, '#2a2a30', 4);
      for (let i = 0; i < 5; i++) A.circ(ctx, -44 + i * 38, -32, 16, '#5a5a68', 3);
      ctx.save(); ctx.translate(-80, -120 + (b.atkAnim || 0) * 30);
      A.poly(ctx, [0, -90, -70, -100, -90, 40, -10, 30], '#e0a21c', 4);
      ctx.strokeStyle = k('#8a6a1a'); ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-74 - i * 2, -80 + i * 30); ctx.lineTo(-6, -76 + i * 28); ctx.stroke(); }
      ctx.restore();
      A.poly(ctx, [-20, -120, -80, -150, -80, -100, -20, -80], '#c08a2a', 3);
      ctx.restore();
      if (rage) A.glow(ctx, 50, -320, 50, '#ff4a1f', 0.5);
    },
  });
  boss({
    id: 'hydra', name: 'Gift-Hydraen', hp: 38000, weak: 'fire', attacks: ['poisonLob', 'grab', 'summon', 'beam'], pool: ['vineswinger', 'toad', 'shaman', 'kettle', 'gnawer'],
    desc: 'En trehovedet gift-slange fra junglens dybeste sump.', weakText: 'Ild gør dobbelt skade og brænder giften væk.',
    shieldPhase: true,
    draw(ctx, b, t) {
      const rage = b.phase >= 2;
      A.ell(ctx, 30, -50, 110, 60, 0, '#3a7a3a', 4);
      A.speckle(ctx, -60, -100, 180, 90, 30, '#5aaa4a', 6, 4);
      for (let i = 0; i < 3; i++) {
        const sw = Math.sin(t * 1.6 + i * 2) * 20, hx = -60 + i * 40 + sw, hy = -200 - (i === 1 ? 60 : 0) + Math.cos(t * 1.3 + i) * 10;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(20 + i * 30, -80); ctx.quadraticCurveTo(80 + i * 10, -140 - i * 20, hx + 20, hy + 20);
        ctx.lineWidth = 40; ctx.strokeStyle = k(A.INK); ctx.stroke(); ctx.lineWidth = 33; ctx.strokeStyle = k('#4a9a3a'); ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.save(); ctx.translate(hx, hy);
        ctx.beginPath(); ctx.moveTo(-50, 10); ctx.quadraticCurveTo(-30, -36, 20, -30); ctx.quadraticCurveTo(44, -10, 30, 24); ctx.quadraticCurveTo(-10, 30, -50, 10); ctx.closePath();
        ctx.fillStyle = A.vg(ctx, -36, 30, '#9ae06a', '#3a8a3a'); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = k(A.INK); ctx.stroke();
        A.eye(ctx, -6, -12, 8, -0.6, 0, 0, { white: rage ? '#ff9a3a' : '#ffef6a', pupil: 0.25, brow: -1 });
        ctx.fillStyle = k('#3a1010'); ctx.beginPath(); ctx.moveTo(-48, 10); ctx.lineTo(-10, 8); ctx.lineTo(-40, 20); ctx.fill();
        A.poly(ctx, [-40, 10, -36, 18, -32, 10], '#ffffff', 1.4);
        ctx.restore();
      }
    },
  });
  boss({
    id: 'kejser', name: 'Zombiekejseren', hp: 45000, weak: 'none', attacks: ['summon', 'beam', 'volley', 'charge', 'freeze', 'grab'], pool: ['imperial', 'kettle', 'knight', 'giant', 'mech', 'jetpack', 'shaman', 'warden'],
    desc: 'Herskeren over hele zombieimperiet. Bruger alle de andre bossers tricks.', weakText: 'Ingen svaghed - men tre faser. Hold alle rækker forsvaret.',
    shieldPhase: true,
    draw(ctx, b, t) {
      const rage = b.phase >= 2;
      A.rrect(ctx, -110, -320, 220, 320, 30, '#5a1a2a', 4);
      ctx.strokeStyle = k('#ffd23f'); ctx.lineWidth = 6; U.roundRect(ctx, -96, -306, 192, 292, 24); ctx.stroke();
      A.circ(ctx, 0, -290, 22, '#ffd23f', 4);
      ctx.save(); ctx.translate(0, -40); ctx.scale(2.3, 2.3);
      humanoid(ctx, { walk: 0, hp: 1, maxHp: 1, state: 'walk', seed: 9 }, t, { shirt: '#7a1a8a', plate: '#ffd86a', pants: '#2a1a2a', skin: '#8aa478', angry: rage, keepArm: true, held: 'staff', orb: rage ? '#ff3a3a' : '#c07aff', lean: 0 });
      ctx.restore();
      ctx.save(); ctx.translate(-8, -172);
      A.poly(ctx, [-34, 0, -38, -36, -18, -16, 0, -44, 18, -16, 38, -36, 34, 0], '#ffd23f', 3);
      [-18, 0, 18].forEach((x, i) => A.circ(ctx, x, -6, 4, ['#3aa0e0', '#e8323a', '#3ad06a'][i], 1.6));
      ctx.restore();
      if (rage) A.glow(ctx, 0, -160, 140, '#c07aff', 0.25 + Math.sin(t * 4) * 0.1);
    },
  });

  /* ---------------------------------------------------------------
     Tegnefunktion
     --------------------------------------------------------------- */
  function draw(ctx, z, t) {
    const d = z.def, L = d.look;
    if (d.id === 'scarab') return drawScarab(ctx, z, t);
    if (d.id === 'parrot') return drawParrot(ctx, z, t);
    if (d.id === 'mech') return drawMech(ctx, z, t, L);
    if (d.id === 'driver') return drawCar(ctx, z, t, L);
    if (d.id === 'cannoneer' && z.state === 'cannon') cannon(ctx, z, t);
    const fly = z.flying;
    ctx.save();
    if (fly && d.ab && d.ab.fly === 'jet') ctx.translate(0, -60 + Math.sin(t * 4) * 4);
    if (fly && d.ab && d.ab.fly === 'wings') ctx.translate(0, -70 + Math.sin(t * 3) * 6 + (z.swoopY || 0));
    if (fly && d.ab && d.ab.fly === 'balloon') ctx.translate(0, -50 + Math.sin(t * 2) * 3);
    if (d.id === 'balloon') balloon(ctx, z, t);
    if (d.id === 'jetpack') jetpack(ctx, z, t);
    if (d.id === 'vampire') { wings(ctx, z, t); cape(ctx, z, t, -84); }
    if (d.id === 'giant') { drawImpRide(ctx, z, t); }
    humanoid(ctx, z, t, L);
    ctx.restore();
  }
  function drawBoss(ctx, b, t) { b.def.draw(ctx, b, t); }

  /* Ikoner til leksikon og bane-intro */
  const iconCache = new Map();
  function iconURL(id, size, locked) {
    const key = id + '|' + size + '|' + (locked ? 1 : 0);
    if (iconCache.has(key)) return iconCache.get(key);
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const isBoss = !!BOSSES[id];
    const d = isBoss ? BOSSES[id] : BY[id];
    const fake = { def: d, walk: 0.6, hp: 1, maxHp: 1, armor: 1, armorMax: 1, shieldHp: 1, shieldMax: 1, state: 'walk', seed: 1, flying: !!(d.ab && d.ab.fly), phase: 0 };
    ctx.translate(size / 2, size * 0.92);
    let sc = size / 150;
    if (isBoss) sc = size / 380;
    else if (d.look && d.look.scale) sc /= Math.max(1, d.look.scale * 0.9);
    if (d.id === 'giant' || d.id === 'mech') sc *= 0.75;
    if (fake.flying) { ctx.translate(0, size * 0.25); sc *= 0.8; }
    ctx.scale(sc, sc);
    if (locked) A.setTint('#1a1530', 0.92);
    try { if (isBoss) d.draw(ctx, fake, 0.5); else draw(ctx, fake, 0.5); } catch (e) { /* ignorer */ }
    A.clearTint();
    const u = c.toDataURL();
    iconCache.set(key, u);
    return u;
  }

  const BY = {};
  L.forEach((d, i) => { d.order = i; BY[d.id] = d; d.ab = d.ab || {}; d.resist = d.resist || {}; });
  return { LIST: L, BY, BOSSES, LOOKS, draw, drawBoss, iconURL, humanoid, headShape };
})();
