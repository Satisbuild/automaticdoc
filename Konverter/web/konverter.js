'use strict';
/* Konverter: browserudgaven af Bog-værktøjer. Alt behandles lokalt i browseren. */

const LIBS = {
  pdfLib: ['PDFLib', 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'],
  pdfjs: ['pdfjsLib', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'],
  jszip: ['JSZip', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'],
  tesseract: ['Tesseract', 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'],
};
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function loadLib(key) {
  const [name, url] = LIBS[key];
  if (window[name]) return Promise.resolve(window[name]);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => resolve(window[name]);
    s.onerror = () => reject(new Error('Kunne ikke hente en nødvendig del af siden. Tjek din internetforbindelse, og prøv igen.'));
    document.head.append(s);
  });
}

const MM = 72 / 25.4;
const SIZES = { a4: [595.28, 841.89], a5: [419.53, 595.28] };
const stem = (name) => name.replace(/\.[^.]+$/, '') || 'fil';
const ext = (name) => (name.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
const relPath = (f) => f.webkitRelativePath || f.name;
const natural = (a, b) => relPath(a).localeCompare(relPath(b), 'da', { numeric: true, sensitivity: 'base' });
const pause = () => new Promise((r) => setTimeout(r));
const clock = (s) => {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/* ---------- PDF-opsætning ---------- */

async function newPdf(title) {
  const { PDFDocument, StandardFonts } = await loadLib('pdfLib');
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const fonts = {
    R: await doc.embedFont(StandardFonts.TimesRoman),
    B: await doc.embedFont(StandardFonts.TimesRomanBold),
    I: await doc.embedFont(StandardFonts.TimesRomanItalic),
  };
  const allowed = new Set(fonts.R.getCharacterSet());
  const swap = { '­': '', '‐': '-', '‑': '-', 'ﬁ': 'fi', 'ﬂ': 'fl', ' ': ' ', '\t': ' ' };
  const state = { doc, fonts, replaced: 0 };
  state.clean = (text) => {
    let out = '';
    for (const c of text.normalize('NFC')) {
      if (c in swap) out += swap[c];
      else if (allowed.has(c.codePointAt(0))) out += c;
      else if (c.trim()) { out += '?'; state.replaced++; }
    }
    return out;
  };
  return state;
}

function wrap(text, font, size, width, indent = 0) {
  const lines = [];
  const space = font.widthOfTextAtSize(' ', size);
  let line = '', used = 0, room = width - indent;
  for (let word of text.split(/\s+/).filter(Boolean)) {
    let w = font.widthOfTextAtSize(word, size);
    while (w > width) { // ord der er bredere end hele linjen
      if (line) { lines.push(line); line = ''; used = 0; }
      room = width;
      let n = word.length;
      while (n > 1 && font.widthOfTextAtSize(word.slice(0, n), size) > width) n--;
      lines.push(word.slice(0, n));
      word = word.slice(n);
      w = font.widthOfTextAtSize(word, size);
    }
    if (line && used + space + w > room) {
      lines.push(line);
      line = word; used = w; room = width;
    } else {
      line = line ? `${line} ${word}` : word;
      used += (used ? space : 0) + w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLine(pdf, page, block, text, x, y, width, last, indent, scale) {
  const font = pdf.fonts[block.font || 'R'];
  const size = block.size * scale;
  const w = font.widthOfTextAtSize(text, size);
  if (block.align === 'center') {
    page.drawText(text, { x: x + (width - w) / 2, y, size, font });
    return;
  }
  const spaces = (text.match(/ /g) || []).length;
  const stretch = spaces ? (width - indent - w) / spaces : 0;
  const justify = block.align === 'justify' && !last && spaces && stretch > 0 && stretch < size;
  if (justify) page.pushOperators(PDFLib.setWordSpacing(stretch));
  page.drawText(text, { x: x + indent, y, size, font });
  if (justify) page.pushOperators(PDFLib.setWordSpacing(0));
}

function blockLines(pdf, block, width, scale) {
  const font = pdf.fonts[block.font || 'R'];
  return wrap(pdf.clean(block.text), font, block.size * scale, width, (block.indent || 0) * scale);
}

function blocksHeight(pdf, blocks, width, scale) {
  let h = 0;
  blocks.forEach((b, i) => {
    if (b.gap) { h += b.gap * scale; return; }
    if (i) h += (b.before || 0) * scale;
    h += blockLines(pdf, b, width, scale).length * b.leading * scale + (b.after || 0) * scale;
  });
  return h;
}

/* Tegner blokke på én side i den givne størrelse. */
function drawFixed(pdf, page, blocks, x, top, width, scale) {
  let y = top;
  blocks.forEach((b, i) => {
    if (b.gap) { y -= b.gap * scale; return; }
    if (i) y -= (b.before || 0) * scale;
    const lines = blockLines(pdf, b, width, scale);
    lines.forEach((t, n) => {
      y -= b.leading * scale;
      drawLine(pdf, page, b, t, x, y + b.leading * scale * 0.25, width, n === lines.length - 1, n ? 0 : (b.indent || 0) * scale, scale);
    });
    y -= (b.after || 0) * scale;
  });
}

/* Lader blokkene løbe over så mange sider, der er brug for. */
function drawFlow(pdf, blocks, size, margin, footer) {
  const [W, H] = size;
  const width = W - margin.x * 2;
  let page = null, y = 0, count = 0;
  const next = () => {
    page = pdf.doc.addPage(size);
    count++;
    y = H - margin.top;
    if (footer) footer(page, count);
  };
  next();
  for (const b of blocks) {
    if (b.pageBreak) { next(); continue; }
    if (b.gap) { y -= b.gap; continue; }
    if (y < H - margin.top) y -= b.before || 0;
    const lines = blockLines(pdf, b, width, 1);
    lines.forEach((t, n) => {
      if (y - b.leading < margin.bottom) next();
      y -= b.leading;
      drawLine(pdf, page, b, t, margin.x, y + b.leading * 0.25, width, n === lines.length - 1, n ? 0 : b.indent || 0, 1);
    });
    y -= b.after || 0;
  }
  return count;
}

const replacedNote = (pdf) => (pdf.replaced
  ? [`${pdf.replaced} tegn findes ikke i PDF-skrifttypen og står som "?" (fx emoji eller ikke-latinske bogstaver).`]
  : []);

/* ---------- Tekst til PDF ---------- */

function decodeText(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function splitPages(lines) {
  const pages = [[1, []]];
  for (const raw of lines) {
    const m = raw.match(/^\s*(\d+)\s*$/);
    if (m) {
      const n = +m[1], prev = pages[pages.length - 1][0];
      if (prev < n && n <= prev + 10) { pages.push([n, []]); continue; }
    }
    pages[pages.length - 1][1].push(raw.trimEnd());
  }
  return pages;
}

function textBlocks(lines) {
  const BODY = { size: 10.5, leading: 14.5, align: 'justify', after: 5 };
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim(), next = (lines[i + 1] || '').trim();
    if (!t) continue;
    if (t === '-') out.push({ gap: 8 });
    else if (/^\d+$/.test(t) || ['PROLOG', 'EPILOG'].includes(t.toUpperCase())) {
      out.push({ text: t, font: 'B', size: 22, leading: 28, align: 'center', before: 30, after: 4 });
      if (next && next.length < 40) {
        out.push({ text: next, font: 'I', size: 13, leading: 18, align: 'center', after: 18 });
        i++;
      }
    } else out.push({ text: t, ...BODY });
  }
  return out;
}

async function runText(files, opts, ui) {
  for (const file of files) {
    ui.status(`Laver ${file.name} …`);
    const lines = decodeText(await file.arrayBuffer()).split(/\r\n|\r|\n/);
    const pages = splitPages(lines);
    const pdf = await newPdf(stem(file.name));
    const size = SIZES.a5;
    const margin = { x: 16 * MM, top: 16 * MM, bottom: 20 * MM };
    const width = size[0] - 2 * margin.x, height = size[1] - margin.top - margin.bottom;
    const number = (page, n) => {
      if (n <= 1) return;
      const s = String(n);
      page.drawText(s, { x: (size[0] - pdf.fonts.R.widthOfTextAtSize(s, 9)) / 2, y: 10 * MM, size: 9, font: pdf.fonts.R });
    };
    const notes = [];
    let total;
    if (pages.length === 1) {
      // Ingen sidetal i filen: teksten løber bare over de sider, den fylder.
      total = drawFlow(pdf, textBlocks(lines), size, margin, number);
      notes.push(`${file.name} har ingen sidetal, så siderne er delt op automatisk.`);
    } else {
      let expected = 1;
      for (const [n, pageLines] of pages) {
        while (expected < n) {
          pdf.doc.addPage(size);
          notes.push(`Side ${expected} mangler i ${file.name}. Der er indsat en tom side.`);
          expected++;
        }
        const blocks = textBlocks(pageLines);
        let scale = 1;
        while (scale > 0.4 && blocksHeight(pdf, blocks, width, scale) > height) scale -= 0.02;
        const page = pdf.doc.addPage(size);
        drawFixed(pdf, page, blocks, margin.x, size[1] - margin.top, width, scale);
        number(page, n);
        expected = n + 1;
        if (n % 25 === 0) { ui.progress(n / pages[pages.length - 1][0]); await pause(); }
      }
      total = expected - 1;
    }
    ui.file(`${stem(file.name)}.pdf`, new Blob([await pdf.doc.save()], { type: 'application/pdf' }), `${total} sider`);
    [...notes, ...replacedNote(pdf)].forEach((n) => ui.warn(n));
  }
}

/* ---------- Læs PDF (fælles for Word og Kindle) ---------- */

const TERMINAL = '.!?:;…"”’»)]';
const KEEP_AFTER_HYPHEN = new Set(['og', 'eller', 'samt', 'til', 'som', 'and', 'or', 'nor', 'to', 'und', 'oder']);
const BULLET = /^\s*([•●▪◦‣■□*–—-]|\d{1,3}[.)]|[a-zA-Z][.)])\s/;
const isLower = (c) => !!c && /\p{Ll}/u.test(c);
const isUpperOrDigit = (c) => !!c && /[\p{Lu}\d]/u.test(c);
const parasText = (p) => p.runs.map((r) => r.t).join('');
const endsTerminal = (s) => !!s && TERMINAL.includes(s[s.length - 1]);

function matMul(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

/* Find billedernes placering på siden (i viewport-koordinater). */
function imageBoxes(ops, viewport, OPS) {
  const paints = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintJpegXObject].filter((v) => v !== undefined));
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [], boxes = [];
  ops.fnArray.forEach((fn, i) => {
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(m);
    else if (fn === OPS.restore) m = stack.pop() || m;
    else if (fn === OPS.transform) m = matMul(m, args);
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(m); if (args[0]) m = matMul(m, args[0]); }
    else if (fn === OPS.paintFormXObjectEnd) m = stack.pop() || m;
    else if (paints.has(fn)) {
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) =>
        viewport.convertToViewportPoint(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]));
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      boxes.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    }
  });
  return boxes;
}

function readLines(content, page, viewport) {
  const lines = [];
  let cur = null;
  const finish = () => { if (cur && cur.text.trim()) lines.push(cur); cur = null; };
  const styleOf = (fontName) => {
    let name = '';
    try { if (page.commonObjs.has(fontName)) name = (page.commonObjs.get(fontName).name || '').toLowerCase(); } catch { /* ukendt font */ }
    return { b: /bold|black|heavy|semibold|demi/.test(name), i: /italic|oblique/.test(name) };
  };
  for (const item of content.items) {
    if (item.str === undefined) continue;
    if (!item.str) { if (item.hasEOL) finish(); continue; }
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const size = Math.hypot(item.transform[2], item.transform[3]) || 10;
    const x1 = x + (item.width || 0);
    const sameLine = cur && Math.abs(y - cur.base) < cur.size * 0.5 && x >= cur.x1 - cur.size;
    if (!sameLine) finish();
    if (!cur) cur = { runs: [], text: '', sizes: {}, size, base: y, x0: x, x1, y0: y - size, y1: y };
    let text = item.str.replace(/\t/g, ' ');
    if (cur.text && !/\s$/.test(cur.text) && !/^\s/.test(text) && x - cur.x1 > size * 0.2) text = ` ${text}`;
    const style = styleOf(item.fontName);
    const lastRun = cur.runs[cur.runs.length - 1];
    if (lastRun && lastRun.b === style.b && lastRun.i === style.i) lastRun.t += text;
    else cur.runs.push({ t: text, ...style });
    cur.text += text;
    const key = Math.round(size * 2) / 2;
    cur.sizes[key] = (cur.sizes[key] || 0) + text.length;
    cur.size = +Object.entries(cur.sizes).sort((a, b) => b[1] - a[1])[0][0];
    cur.x1 = Math.max(cur.x1, x1);
    cur.y0 = Math.min(cur.y0, y - size);
    if (item.hasEOL) finish();
  }
  finish();
  return lines;
}

function appendRuns(runs, added) {
  added = added.map((r) => ({ ...r }));
  if (!runs.length) { runs.push(...added); return; }
  const last = runs[runs.length - 1];
  const prev = last.t, nxt = added[0].t;
  let sep = ' ', cut = 0;
  if (/\s$/.test(prev) || /^\s/.test(nxt)) sep = '';
  else if (prev.endsWith('­')) { sep = ''; cut = 1; }
  else if (prev.endsWith('-') && prev.length >= 2 && /[\p{L}\d]/u.test(prev[prev.length - 2])) {
    const first = nxt.match(/^[\p{L}\d_]+/u);
    if (first && KEEP_AFTER_HYPHEN.has(first[0].toLowerCase())) sep = ' ';
    else if (/\p{L}/u.test(prev[prev.length - 2]) && isLower(nxt[0])) { sep = ''; cut = 1; }
    else sep = '';
  }
  last.t = prev.slice(0, prev.length - cut) + sep;
  runs.push(...added);
}

function continuesWord(prev, next) {
  prev = prev.replace(/ +$/, '');
  const hyphen = prev.endsWith('­') || (prev.endsWith('-') && /\p{L}/u.test(prev[prev.length - 2] || ''));
  return hyphen && isLower(next.trimStart()[0]);
}

function linesToParas(lines, pno) {
  if (!lines.length) return [];
  const x0 = Math.min(...lines.map((l) => l.x0)), x1 = Math.max(...lines.map((l) => l.x1));
  const width = Math.max(x1 - x0, 1);
  const paras = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    const runs = [];
    cur.forEach((l) => appendRuns(runs, l.runs));
    const chars = cur.reduce((n, l) => n + l.text.length, 0) || 1;
    paras.push({ kind: 'p', runs, page: pno, nlines: cur.length, size: cur.reduce((n, l) => n + l.size * l.text.length, 0) / chars });
    cur = [];
  };
  for (const ln of lines) {
    if (cur.length) {
      const prev = cur[cur.length - 1];
      if (!continuesWord(prev.text, ln.text)) {
        const ends = endsTerminal(prev.text.trimEnd());
        const first = ln.text.trim().split(/\s+/)[0] || '';
        const firstW = (first.length + 1) * ln.size * 0.5;
        const short = x1 - prev.x1 > firstW * 1.15 + width * 0.02;
        const indented = ln.x0 > x0 + ln.size;
        const bigGap = ln.y0 - prev.y1 > prev.size * 0.8;
        const upper = isUpperOrDigit(ln.text.trimStart()[0]);
        if (bigGap || BULLET.test(ln.text) || Math.abs(ln.size - prev.size) > Math.max(1, prev.size * 0.2)
          || (ends && (short || indented)) || (short && upper)) flush();
      }
    }
    cur.push(ln);
  }
  flush();
  return paras;
}

function bodySize(items) {
  const sizes = {};
  for (const p of items) {
    if (p.kind !== 'p') continue;
    const k = Math.round(p.size * 2) / 2;
    sizes[k] = (sizes[k] || 0) + parasText(p).length;
  }
  const top = Object.entries(sizes).sort((a, b) => b[1] - a[1])[0];
  return top ? +top[0] : 10;
}

function mergeSplit(items, body) {
  const out = [];
  for (const p of items) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === 'p' && p.kind === 'p') {
      const a = parasText(prev).trimEnd(), b = parasText(p).trimStart();
      const lower = isLower(b[0]);
      if (a.length === 1 && /\p{L}/u.test(a) && prev.size > body * 1.5 && lower) { // stort forbogstav
        prev.runs = [{ ...prev.runs[0], t: a }, ...p.runs];
        prev.size = p.size;
        continue;
      }
      if (continuesWord(parasText(prev), b)
        || (lower && a && !endsTerminal(a) && Math.abs(prev.size - p.size) <= Math.max(0.6, body * 0.15))) {
        appendRuns(prev.runs, p.runs);
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

function classify(items, body) {
  for (const p of items) {
    if (p.kind !== 'p') continue;
    const t = parasText(p).trim();
    if (!t || t.length > 100 || p.nlines > 3 || !/\p{L}/u.test(t) || isLower(t[0]) || /[.,;!?"”»“]$/.test(t)) continue;
    if (p.size >= body * 1.4) p.kind = 'h1';
    else if (p.size >= body * 1.15) p.kind = 'h2';
  }
  return items;
}

const headerKey = (text) => text.trim().toLowerCase().replace(/\d+/g, '#');
const inMargin = (l, h) => l.y1 < h * 0.08 || l.y0 > h * 0.92;
const PAGE_NUMBER = /^[-–—\s]*(side|page|s\.)?\s*(#|[ivxlc]+)(\s*[-–]\s*#)?(\s*(af|of|\/)\s*#)?[-–—\s]*$/;

async function canvasToBytes(canvas) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
  return new Uint8Array(await blob.arrayBuffer());
}

async function extractPdf(file, opts, ui) {
  const pdfjs = await loadLib('pdfjs');
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), password: opts.password || undefined }).promise;
  } catch (e) {
    if (e && e.name === 'PasswordException') throw new Error(`${file.name} er låst. Skriv den rigtige adgangskode i feltet.`);
    throw new Error(`${file.name} kunne ikke læses som PDF.`);
  }
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    ui.status(`Læser side ${n} af ${doc.numPages} i ${file.name} …`);
    ui.progress((n - 1) / doc.numPages);
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();
    const lines = readLines(await page.getTextContent(), page, viewport);
    const area = viewport.width * viewport.height;
    let boxes = imageBoxes(ops, viewport, pdfjs.OPS)
      .map((b) => ({ ...b, area: ((b.x1 - b.x0) * (b.y1 - b.y0)) / area }))
      .filter((b) => b.area > 0.005);
    const blank = !lines.length && ops.fnArray.length < 5;
    let whole = false;
    if (lines.length) boxes = boxes.filter((b) => b.area < 0.85); // baggrund bag OCR-tekst
    else { boxes = []; whole = !blank; }
    const images = [];
    if (whole || boxes.length) {
      const SCALE = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width * SCALE);
      canvas.height = Math.ceil(viewport.height * SCALE);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: page.getViewport({ scale: SCALE }) }).promise;
      if (whole) {
        images.push({ kind: 'img', y0: 0, w: canvas.width, h: canvas.height, bytes: await canvasToBytes(canvas) });
      } else {
        for (const b of boxes) {
          const x = Math.max(0, Math.floor(b.x0 * SCALE)), y = Math.max(0, Math.floor(b.y0 * SCALE));
          const w = Math.min(canvas.width - x, Math.ceil((b.x1 - b.x0) * SCALE)), h = Math.min(canvas.height - y, Math.ceil((b.y1 - b.y0) * SCALE));
          if (w < 2 || h < 2) continue;
          const crop = document.createElement('canvas');
          crop.width = w; crop.height = h;
          crop.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
          images.push({ kind: 'img', y0: b.y0, w, h, bytes: await canvasToBytes(crop) });
        }
      }
      canvas.width = canvas.height = 0;
    }
    pages.push({ n, height: viewport.height, lines, images });
    page.cleanup();
  }
  const total = doc.numPages;
  await doc.destroy();

  if (opts.removeHeaders) {
    const counts = {};
    for (const p of pages) {
      new Set(p.lines.filter((l) => inMargin(l, p.height)).map((l) => headerKey(l.text))).forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
    }
    const limit = Math.max(3, total * 0.3);
    for (const p of pages) {
      p.lines = p.lines.filter((l) => {
        if (!inMargin(l, p.height)) return true;
        const k = headerKey(l.text);
        return !(counts[k] >= limit || PAGE_NUMBER.test(k) || !/[\p{L}\d#]/u.test(k));
      });
    }
  }

  let items = [];
  for (const p of pages) {
    const queue = [...p.images].sort((a, b) => a.y0 - b.y0);
    let group = [];
    const flush = () => { items.push(...linesToParas(group, p.n)); group = []; };
    for (const l of p.lines) {
      while (queue.length && queue[0].y0 < l.y0) { flush(); items.push(queue.shift()); }
      group.push(l);
    }
    flush();
    items.push(...queue);
  }
  const body = bodySize(items);
  items = classify(mergeSplit(items, body), body);
  return { items, pages: total, images: items.filter((i) => i.kind === 'img').length };
}

/* ---------- PDF til Word ---------- */

const xml = (s) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function docxBody(items, zip) {
  let imgNo = 0;
  const rels = [];
  const parts = items.map((it) => {
    if (it.kind === 'img') {
      imgNo++;
      const rid = `rImg${imgNo}`;
      zip.file(`word/media/billede${imgNo}.jpg`, it.bytes);
      rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/billede${imgNo}.jpg"/>`);
      const maxW = 5760000, maxH = 8100000; // ca. A4 minus margener, i EMU
      const emuW = it.w * 9525, emuH = it.h * 9525;
      const k = Math.min(1, maxW / emuW, maxH / emuH);
      const cx = Math.round(emuW * k), cy = Math.round(emuH * k);
      return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${imgNo}" name="Billede ${imgNo}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${imgNo}" name="billede${imgNo}.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
    const style = it.kind === 'h1' ? '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' : it.kind === 'h2' ? '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>' : '';
    const runs = it.runs.map((r) => {
      const pr = (r.b ? '<w:b/>' : '') + (r.i ? '<w:i/>' : '');
      return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(r.t)}</w:t></w:r>`;
    }).join('');
    return `<w:p>${style}${runs}</w:p>`;
  });
  return { parts: parts.join(''), rels: rels.join('') };
}

async function makeDocx(items, title) {
  const JSZip = await loadLib('jszip');
  const zip = new JSZip();
  const { parts, rels } = docxBody(items, zip);
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title></cp:coreProperties>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels}</Relationships>`);
  zip.file('word/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:sz w:val="22"/><w:lang w:val="da-DK"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${parts}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

async function runWord(files, opts, ui) {
  for (const file of files) {
    const { items, pages, images } = await extractPdf(file, opts, ui);
    ui.status(`Laver Word-filen til ${file.name} …`);
    ui.file(`${stem(file.name)}.docx`, await makeDocx(items, stem(file.name)), `${pages} sider, ${images} billeder`);
  }
}

/* ---------- PDF til Kindle (EPUB) ---------- */

async function makeEpub(items, title, author) {
  const JSZip = await loadLib('jszip');
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/style.css', 'body{font-family:serif;line-height:1.4}p{margin:0;text-indent:1.2em}h1+p,h2+p,img+p{text-indent:0}h1{font-size:1.6em;text-align:center;margin:1.5em 0 1em}h2{font-size:1.25em;margin:1.2em 0 .6em}img{max-width:100%;height:auto;display:block;margin:1em auto}');

  const chapters = [];
  const images = [];
  let cur = null, imgNo = 0;
  const start = (name) => { cur = { name, body: [] }; chapters.push(cur); };
  for (const it of items) {
    if (it.kind === 'img') {
      if (!cur) start(title);
      imgNo++;
      const file = `img${imgNo}.jpg`;
      zip.file(`OEBPS/${file}`, it.bytes);
      images.push(file);
      cur.body.push(`<div><img src="${file}" alt=""/></div>`);
      continue;
    }
    const text = parasText(it).trim();
    if (!text) continue;
    if (it.kind === 'h1') start(text);
    else if (!cur) start(title);
    const inner = it.runs.map((r) => {
      const t = xml(r.t);
      if (r.b && r.i) return `<b><i>${t}</i></b>`;
      if (r.b) return `<b>${t}</b>`;
      return r.i ? `<i>${t}</i>` : t;
    }).join('');
    cur.body.push(`<${it.kind}>${inner}</${it.kind}>`);
  }
  if (!chapters.length) start(title);

  const page = (name, body, extra = '') => `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"${extra} xml:lang="da" lang="da"><head><meta charset="UTF-8"/><title>${xml(name)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${body}</body></html>`;
  chapters.forEach((c, i) => zip.file(`OEBPS/kap${i + 1}.xhtml`, page(c.name, c.body.join('\n'))));
  const toc = chapters.map((c, i) => `<li><a href="kap${i + 1}.xhtml">${xml(c.name)}</a></li>`).join('');
  zip.file('OEBPS/nav.xhtml', page(title, `<nav epub:type="toc" id="toc"><h1>Indhold</h1><ol>${toc}</ol></nav>`, ' xmlns:epub="http://www.idpf.org/2007/ops"'));
  const id = `urn:uuid:${crypto.randomUUID()}`;
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${id}"/></head><docTitle><text>${xml(title)}</text></docTitle><navMap>${chapters.map((c, i) => `<navPoint id="n${i + 1}" playOrder="${i + 1}"><navLabel><text>${xml(c.name)}</text></navLabel><content src="kap${i + 1}.xhtml"/></navPoint>`).join('')}</navMap></ncx>`);
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${id}</dc:identifier><dc:title>${xml(title)}</dc:title>${author ? `<dc:creator>${xml(author)}</dc:creator>` : ''}<dc:language>da</dc:language><meta property="dcterms:modified">${modified}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="style.css" media-type="text/css"/>${chapters.map((_, i) => `<item id="k${i + 1}" href="kap${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('')}${images.map((f, i) => `<item id="i${i + 1}" href="${f}" media-type="image/jpeg"/>`).join('')}</manifest><spine toc="ncx">${chapters.map((_, i) => `<itemref idref="k${i + 1}"/>`).join('')}</spine></package>`);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/epub+zip' });
}

async function runKindle(files, opts, ui) {
  for (const file of files) {
    const { items, pages, images } = await extractPdf(file, opts, ui);
    ui.status(`Laver e-bogen til ${file.name} …`);
    const title = (files.length === 1 && opts.title.trim()) || stem(file.name);
    ui.file(`${stem(file.name)}.epub`, await makeEpub(items, title, opts.author.trim()), `${pages} sider, ${images} billeder`);
  }
}

/* ---------- Billeder til PDF (med søgbar tekst) ---------- */

async function loadImage(file) {
  const type = ext(file.name);
  const bitmap = await createImageBitmap(file);
  const size = [bitmap.width, bitmap.height];
  if (type === 'jpg' || type === 'jpeg' || type === 'png') {
    bitmap.close();
    return { bytes: new Uint8Array(await file.arrayBuffer()), png: type === 'png', size };
  }
  const canvas = document.createElement('canvas');
  canvas.width = size[0]; canvas.height = size[1];
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return { bytes: await canvasToBytes(canvas), png: false, size };
}

async function runImages(files, opts, ui) {
  const title = opts.title.trim() || 'Billeder';
  const pdf = await newPdf(title);
  let worker = null, current = 0;
  if (opts.ocr) {
    ui.status('Henter tekstgenkendelse (kun første gang) …');
    const Tesseract = await loadLib('tesseract');
    worker = await Tesseract.createWorker(['dan', 'eng'], 1, {
      logger: (m) => { if (m.status === 'recognizing text') ui.progress((current + m.progress) / files.length); },
    });
  }
  const allText = [];
  try {
    for (let i = 0; i < files.length; i++) {
      current = i;
      ui.status(`Behandler billede ${i + 1} af ${files.length} …`);
      ui.progress(i / files.length);
      const file = files[i];
      const img = await loadImage(file);
      const embedded = img.png ? await pdf.doc.embedPng(img.bytes) : await pdf.doc.embedJpg(img.bytes);
      const k = opts.size === 'a4' ? Math.min(SIZES.a4[0] / img.size[0], SIZES.a4[1] / img.size[1]) : 0.75;
      const W = img.size[0] * k, H = img.size[1] * k;
      const page = pdf.doc.addPage([W, H]);
      page.drawImage(embedded, { x: 0, y: 0, width: W, height: H });
      if (worker) {
        const { data } = await worker.recognize(file, {}, { blocks: true, text: true });
        allText.push(data.text || '');
        for (const block of data.blocks || []) for (const para of block.paragraphs) for (const line of para.lines) for (const word of line.words) {
          const t = pdf.clean(word.text).trim();
          if (!t) continue;
          const b = word.bbox;
          const unit = pdf.fonts.R.widthOfTextAtSize(t, 1);
          const size = Math.max(1, Math.min(((b.x1 - b.x0) * k) / unit, (b.y1 - b.y0) * k * 1.6));
          page.drawText(`${t} `, { x: b.x0 * k, y: H - b.y1 * k, size, font: pdf.fonts.R, opacity: 0 });
        }
      }
      await pause();
    }
  } finally {
    if (worker) await worker.terminate();
  }
  ui.file(`${title}.pdf`, new Blob([await pdf.doc.save()], { type: 'application/pdf' }), `${files.length} sider`);
  if (worker) ui.file(`${title}.txt`, new Blob([allText.join('\n\n')], { type: 'text/plain;charset=utf-8' }));
  replacedNote(pdf).forEach((n) => ui.warn(n));
}

/* ---------- Lyd til PDF ---------- */

async function decodeAudio(file) {
  const ctx = new OfflineAudioContext(1, 1, 16000);
  let buffer;
  try {
    buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error(`${file.name} kunne ikke afspilles i browseren, eller filen er for stor til hukommelsen. Prøv at dele lyden op i kortere filer.`);
  }
  const audio = new Float32Array(buffer.getChannelData(0));
  for (let c = 1; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < audio.length; i++) audio[i] += data[i];
  }
  if (buffer.numberOfChannels > 1) for (let i = 0; i < audio.length; i++) audio[i] /= buffer.numberOfChannels;
  return audio;
}

/* Klipper i den mest stille del af de sidste sekunder, så ingen ord deles over. */
function quietCut(audio, from, to) {
  const RATE = 16000, WIN = RATE / 10;
  let best = to, bestE = Infinity;
  for (let s = Math.max(from, to - 5 * RATE); s + WIN <= to; s += WIN) {
    let e = 0;
    for (let i = s; i < s + WIN; i += 8) e += Math.abs(audio[i]);
    if (e < bestE) { bestE = e; best = s + WIN / 2; }
  }
  return Math.floor(best);
}

function startSpeechWorker(model, ui) {
  const worker = new Worker('web/tale-worker.js', { type: 'module' });
  let waiting = null;
  const fail = (message) => { if (waiting) { const w = waiting; waiting = null; w.reject(new Error(message)); } };
  worker.onerror = () => fail('Talegenkendelsen kunne ikke starte. Tjek din internetforbindelse, og prøv igen.');
  worker.onmessage = ({ data }) => {
    if (data.type === 'download') {
      ui.status(`Henter talemodellen (kun første gang): ${Math.round(data.loaded / 1048576)} af ${Math.round(data.total / 1048576)} MB`);
      ui.progress(data.loaded / data.total);
    } else if (data.type === 'error') fail(`Talegenkendelsen fejlede: ${data.message}`);
    else if (waiting) { const w = waiting; waiting = null; w.resolve(data); }
  };
  const call = (msg, transfer) => new Promise((resolve, reject) => { waiting = { resolve, reject }; worker.postMessage(msg, transfer || []); });
  return {
    load: () => call({ type: 'load', model }),
    transcribe: (audio, language) => call({ type: 'transcribe', audio, language }, [audio.buffer]),
    stop: () => worker.terminate(),
  };
}

async function runAudio(files, opts, ui) {
  const title = opts.title.trim() || (files.length === 1 ? stem(files[0].name) : 'Lydbog');
  ui.status('Henter talemodellen (kun første gang) …');
  const speech = startSpeechWorker(opts.model, ui);
  const chapters = [];
  try {
    await speech.load();
    const RATE = 16000, BLOCK = 300 * RATE;
    const started = performance.now();
    for (let f = 0; f < files.length; f++) {
      const file = files[f];
      ui.status(`Læser ${file.name} …`);
      ui.progress(f / files.length);
      const audio = await decodeAudio(file);
      const paras = [];
      let current = [], lastEnd = 0;
      for (let pos = 0; pos < audio.length;) {
        const end = pos + BLOCK >= audio.length ? audio.length : quietCut(audio, pos, pos + BLOCK);
        const { chunks } = await speech.transcribe(audio.slice(pos, end), opts.language);
        for (const ch of chunks) {
          const text = (ch.text || '').trim();
          if (!text) continue;
          const startT = (ch.timestamp && ch.timestamp[0]) ?? lastEnd;
          const words = current.join(' ').split(/\s+/).length;
          if (current.length && (startT - lastEnd > 1.5 || (words > 120 && /[.!?]$/.test(current[current.length - 1])))) {
            paras.push(current.join(' '));
            current = [];
          }
          current.push(text);
          lastEnd = (ch.timestamp && ch.timestamp[1]) ?? startT;
        }
        lastEnd = 0;
        pos = end;
        const part = (f + pos / audio.length) / files.length;
        ui.progress(part);
        const spent = (performance.now() - started) / 1000;
        ui.status(`${file.name}: ${clock(pos / RATE)} af ${clock(audio.length / RATE)} (cirka ${clock((spent / part) * (1 - part))} tilbage)`);
      }
      if (current.length) paras.push(current.join(' '));
      chapters.push([stem(file.name), paras]);
    }
  } finally {
    speech.stop();
  }
  const sections = opts.merged ? [[title, chapters.flatMap(([, p]) => p)]] : chapters;

  ui.status('Laver PDF …');
  const pdf = await newPdf(title);
  const m = (opts.size === 'a5' ? 15 : 25) * MM;
  const blocks = [{ gap: 60 * MM }, { text: title, font: 'B', size: 26, leading: 32, align: 'center' }, { pageBreak: true }];
  sections.forEach(([name, paras], i) => {
    if (i) blocks.push({ pageBreak: true });
    if (sections.length > 1) blocks.push({ text: name, font: 'B', size: 18, leading: 22, after: 12 });
    paras.forEach((text) => blocks.push({ text, size: 12, leading: 17, align: 'justify', after: 8, indent: 12 }));
  });
  const count = drawFlow(pdf, blocks, SIZES[opts.size], { x: m, top: m, bottom: m });
  const txt = sections.map(([name, paras]) => `${sections.length > 1 ? `### ${name}\n\n` : ''}${paras.join('\n\n')}`).join('\n\n\n');
  ui.file(`${title}.pdf`, new Blob([await pdf.doc.save()], { type: 'application/pdf' }), `${count} sider`);
  ui.file(`${title}.txt`, new Blob([txt], { type: 'text/plain;charset=utf-8' }));
  replacedNote(pdf).forEach((n) => ui.warn(n));
}

/* ---------- HTML til PDF ---------- */

function resolvePath(base, ref) {
  let clean = ref.trim().split(/[?#]/)[0];
  try { clean = decodeURIComponent(clean); } catch { /* behold som den er */ }
  const parts = base.split('/').slice(0, -1);
  for (const seg of clean.replace(/\\/g, '/').split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/').toLowerCase();
}

function buildResources(files) {
  const map = new Map();
  for (const f of files) map.set(relPath(f).toLowerCase(), f);
  const urls = new Map();
  const urlFor = (base, ref) => {
    if (!ref || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref.trim())) return null;
    const key = resolvePath(base, ref);
    const file = map.get(key);
    if (!file) return null;
    if (!urls.has(key)) urls.set(key, URL.createObjectURL(file));
    return urls.get(key);
  };
  const fileFor = (base, ref) => map.get(resolvePath(base, ref));
  const revoke = () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear(); };
  return { urlFor, fileFor, revoke };
}

function rewriteCss(css, base, res) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q, ref) => {
    const u = res.urlFor(base, ref);
    return u ? `url("${u}")` : all;
  });
}

async function prepareHtml(file, res) {
  const base = relPath(file);
  const doc = new DOMParser().parseFromString(decodeText(await file.arrayBuffer()), 'text/html');
  doc.querySelectorAll('script, base, meta[http-equiv]').forEach((n) => n.remove());
  for (const link of doc.querySelectorAll('link[rel~="stylesheet"]')) {
    const css = res.fileFor(base, link.getAttribute('href') || '');
    if (css) {
      const style = doc.createElement('style');
      style.textContent = rewriteCss(decodeText(await css.arrayBuffer()), relPath(css), res);
      link.replaceWith(style);
    }
  }
  doc.querySelectorAll('style').forEach((s) => { s.textContent = rewriteCss(s.textContent, base, res); });
  doc.querySelectorAll('[style*="url("]').forEach((n) => n.setAttribute('style', rewriteCss(n.getAttribute('style'), base, res)));
  doc.querySelectorAll('[src]').forEach((n) => {
    const u = res.urlFor(base, n.getAttribute('src'));
    if (u) n.setAttribute('src', u);
  });
  const styles = [...doc.querySelectorAll('style, link[rel~="stylesheet"]')].map((n) => n.outerHTML);
  doc.body.querySelectorAll('style, link[rel~="stylesheet"]').forEach((n) => n.remove());
  return { styles, body: doc.body.innerHTML };
}

function composeHtml(title, parts, opts) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const styles = [...new Set(parts.flatMap((p) => p.styles))].join('\n');
  const body = parts.map((p) => p.body).join('<div style="break-before:page"></div>');
  const size = `${opts.size.toUpperCase()}${opts.landscape ? ' landscape' : ''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${styles}<style>@page{size:${size};margin:${+opts.margin || 0}mm}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${body}</body></html>`;
}

function printHtml(html) {
  document.querySelectorAll('.print-frame').forEach((n) => n.remove());
  const frame = document.createElement('iframe');
  frame.className = 'print-frame';
  frame.title = 'Udskrift';
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.onload = async () => {
    const doc = frame.contentDocument;
    await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
    if (doc.fonts) await doc.fonts.ready;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };
  frame.srcdoc = html;
  document.body.append(frame);
}

let htmlResources = null;
async function runHtml(files, opts, ui) {
  if (htmlResources) htmlResources.revoke();
  const res = htmlResources = buildResources(files);
  const pages = files.filter((f) => ['html', 'htm', 'xhtml'].includes(ext(f.name)) && !/\.backup\./i.test(f.name));
  if (!pages.length) throw new Error('Der er ingen HTML-filer i det, du har valgt.');
  const prepared = [];
  for (const f of pages) {
    ui.status(`Læser ${f.name} …`);
    prepared.push({ name: stem(f.name), ...(await prepareHtml(f, res)) });
  }
  if (prepared.length > 1) {
    const parts = relPath(pages[0]).split('/');
    const root = parts.length > 1 ? parts[0] : 'Samlet';
    ui.action(`Gem alle ${prepared.length} filer som én PDF`, () => printHtml(composeHtml(root, prepared, opts)));
  }
  prepared.forEach((p) => ui.action(`Gem ${p.name} som PDF`, () => printHtml(composeHtml(p.name, [p], opts))));
  ui.done('Klik herunder, og vælg "Gem som PDF" som printer i vinduet, der åbner.');
}

/* ---------- Værktøjerne ---------- */

const PASSWORD_OPT = '<label>Adgangskode (kun hvis PDF\'en er låst)<input name="password" type="password" autocomplete="off"></label>';
const HEADERS_OPT = '<label class="check"><input name="removeHeaders" type="checkbox"> Fjern sidetal og gentagne sidehoveder</label>';
const SIZE_OPT = (a, b) => `<label>Sidestørrelse<select name="size"><option value="${a}">${a.toUpperCase()}</option><option value="${b}">${b.toUpperCase()}</option></select></label>`;

const TOOLS = [
  {
    id: 'word', name: 'PDF til Word', run: runWord, accept: ['pdf'], label: 'Lav Word-fil',
    desc: 'Laver en PDF om til et Word-dokument med afsnit, overskrifter, fed og kursiv samt billeder.',
    opts: HEADERS_OPT + PASSWORD_OPT,
    note: 'Sider, der kun er et billede, kommer med som billede. Tabeller bliver til almindelig tekst.',
  },
  {
    id: 'kindle', name: 'PDF til Kindle', run: runKindle, accept: ['pdf'], label: 'Lav e-bog',
    desc: 'Laver en PDF om til en EPUB-bog med flydende tekst, der passer til skærmen.',
    opts: `<label>Titel (valgfri)<input name="title"></label><label>Forfatter (valgfri)<input name="author"></label>${HEADERS_OPT}${PASSWORD_OPT}`,
    note: 'Send EPUB-filen til din Kindle med Amazons "Send to Kindle". Browseren kan ikke lave AZW3-filer.',
  },
  {
    id: 'text', name: 'Tekst til PDF', run: runText, accept: ['txt'], label: 'Lav PDF',
    desc: 'Laver en tekstfil om til en A5-bog. Står sidetallet alene på en linje, passer siderne med den trykte bog.',
    opts: '',
  },
  {
    id: 'html', name: 'HTML til PDF', run: runHtml, accept: null, folder: true, label: 'Klargør filer',
    desc: 'Laver HTML-sider om til PDF. Vælg hele mappen, hvis siderne har billeder og typografi i andre filer.',
    opts: `${SIZE_OPT('a4', 'a5')}<label>Margen (mm)<input name="margin" type="number" min="0" max="50" value="15"></label><label class="check"><input name="landscape" type="checkbox"> Liggende</label>`,
    note: 'Browseren laver selve PDF\'en, så der kommer et printvindue, hvor du vælger "Gem som PDF". Scripts på siderne køres ikke.',
  },
  {
    id: 'images', name: 'Billeder til PDF', run: runImages, accept: ['png', 'jpg', 'jpeg', 'webp'], folder: true, label: 'Lav PDF',
    desc: 'Samler screenshots og andre billeder i én PDF, hvor teksten kan søges i og kopieres.',
    opts: '<label>Navn på PDF\'en (valgfri)<input name="title"></label><label>Sidestørrelse<select name="size"><option value="image">Som billedet</option><option value="a4">Tilpasset A4</option></select></label><label class="check"><input name="ocr" type="checkbox" checked> Gør teksten søgbar (dansk og engelsk)</label>',
    note: 'Billederne kommer i navnerækkefølge. Første gang hentes tekstgenkendelsen.',
  },
  {
    id: 'audio', name: 'Lyd til PDF', run: runAudio, accept: ['mp3', 'm4a', 'm4b', 'wav', 'flac', 'ogg', 'aac', 'wma'], folder: true, label: 'Lav PDF',
    desc: 'Skriver tale i lydfiler ned og samler det til en PDF og en tekstfil. Flere filer bliver til kapitler.',
    opts: `<label>Titel (valgfri)<input name="title"></label><label>Sprog<select name="language"><option value="danish">Dansk</option><option value="english">Engelsk</option><option value="">Find selv</option></select></label><label>Kvalitet<select name="model"><option value="small">Bedst (større download)</option><option value="base">Hurtig (mindre download)</option></select></label>${SIZE_OPT('a5', 'a4')}<label class="check"><input name="merged" type="checkbox"> Saml alt uden kapitler</label>`,
    note: 'Talemodellen hentes kun første gang. Hold fanebladet åbent imens. En lydbog kan tage flere timer på en computer uden godt grafikkort. Meget store filer skal deles op først.',
  },
];

/* ---------- Brugerflade ---------- */

const panel = document.getElementById('panel');
const nav = document.getElementById('tools');
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};
let busy = false;
let links = [];

function clearLinks() {
  links.forEach((u) => URL.revokeObjectURL(u));
  links = [];
}

function showTool(tool) {
  if (busy) return;
  clearLinks();
  [...nav.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === tool.id)));
  try { history.replaceState(null, '', `#${tool.id}`); } catch { /* kun bekvemmelighed */ }
  panel.replaceChildren();

  let files = [];
  const isPage = (f) => ['html', 'htm', 'xhtml'].includes(ext(f.name));
  const accepted = (f) => !tool.accept || tool.accept.includes(ext(f.name));
  const list = el('ul', { className: 'files' });
  const go = el('button', { className: 'go', type: 'button', textContent: tool.label, disabled: true });
  const output = el('div', { className: 'output' });
  output.setAttribute('aria-live', 'polite');

  const render = () => {
    const shown = tool.accept ? files : files.filter(isPage);
    list.replaceChildren(...shown.slice(0, 200).map((f) => el('li', {},
      el('span', { textContent: relPath(f) }),
      el('button', {
        type: 'button', textContent: '×', ariaLabel: `Fjern ${f.name}`,
        onclick: () => { files = files.filter((x) => x !== f); render(); },
      }))));
    if (shown.length > 200) list.append(el('li', { textContent: `… og ${shown.length - 200} flere` }));
    go.disabled = !shown.length;
  };
  const add = (incoming) => {
    const fresh = [...incoming];
    const good = fresh.filter(accepted);
    files = [...files, ...good.filter((f) => !files.some((x) => relPath(x) === relPath(f) && x.size === f.size))].sort(natural);
    render();
    output.replaceChildren();
    if (fresh.length && !good.length) {
      output.append(el('p', { className: 'msg bad', textContent: `Den filtype kan værktøjet ikke bruge. Det kan bruge: ${tool.accept.join(', ')}.` }));
    }
  };

  const acceptAttr = (tool.accept || ['html', 'htm', 'xhtml']).map((e) => `.${e}`).join(',');
  const input = el('input', { type: 'file', multiple: true, accept: acceptAttr, onchange: () => { add(input.files); input.value = ''; } });
  const drop = el('label', { className: 'drop' }, input, el('strong', { textContent: 'Vælg filer' }), ' eller træk dem hertil');
  ['dragover', 'dragenter'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); add(e.dataTransfer.files); });

  panel.append(el('h2', { textContent: tool.name }), el('p', { className: 'desc', textContent: tool.desc }), drop);
  if (tool.folder) {
    const dir = el('input', { type: 'file', hidden: true, onchange: () => { add(dir.files); dir.value = ''; } });
    dir.setAttribute('webkitdirectory', '');
    panel.append(el('p', { className: 'note' }, 'Eller ', el('button', { type: 'button', className: 'folder', textContent: 'vælg en hel mappe', onclick: () => dir.click() }), '.'), dir);
  }
  panel.append(list);
  const form = el('form', { className: 'opts', innerHTML: tool.opts, onsubmit: (e) => e.preventDefault() });
  if (tool.opts) panel.append(form);
  panel.append(go);
  if (tool.note) panel.append(el('p', { className: 'note', textContent: tool.note }));
  panel.append(output);

  go.onclick = async () => {
    const opts = {};
    form.querySelectorAll('input, select').forEach((i) => { opts[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
    busy = true;
    go.disabled = true;
    clearLinks();
    const statusLine = el('div');
    const bar = el('progress', { max: 1, value: 0 });
    const prog = el('div', { className: 'progress' }, statusLine, bar);
    const results = el('div', { className: 'results' });
    output.replaceChildren(prog, results);
    const ui = {
      status: (t) => { statusLine.textContent = t; },
      progress: (v) => { bar.value = Math.min(1, v); },
      file: (name, blob, info) => {
        const url = URL.createObjectURL(blob);
        links.push(url);
        const mb = blob.size / 1048576;
        const sizeText = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(blob.size / 1024))} KB`;
        results.append(el('a', { href: url, download: name, textContent: `Hent ${name} (${[info, sizeText].filter(Boolean).join(', ')})` }));
      },
      action: (text, fn) => results.append(el('button', { type: 'button', textContent: text, onclick: fn })),
      warn: (text) => output.append(el('p', { className: 'msg warn', textContent: text })),
      done: (text) => { prog.replaceChildren(el('span', { textContent: text })); },
    };
    try {
      await tool.run(files, opts, ui);
      if (prog.contains(bar)) ui.done('Færdig.');
    } catch (e) {
      console.error(e);
      prog.remove();
      output.prepend(el('p', { className: 'msg bad', textContent: e.message || 'Noget gik galt.' }));
    } finally {
      busy = false;
      go.disabled = false;
    }
  };
}

TOOLS.forEach((tool) => {
  const b = el('button', { type: 'button', textContent: tool.name, onclick: () => showTool(tool) });
  b.dataset.id = tool.id;
  nav.append(b);
});
showTool(TOOLS.find((t) => `#${t.id}` === location.hash) || TOOLS[0]);
window.addEventListener('beforeunload', (e) => { if (busy) e.preventDefault(); });
