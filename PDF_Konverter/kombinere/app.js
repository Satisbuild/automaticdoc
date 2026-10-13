/* ==========================================================================
   PDF KONVERTER – APP
   1) Biblioteker  2) Tilstand & hjælpere  3) Tilføj filer  4) Forberedelse
      (PDF, billeder, Word)  5) Samling til én PDF  6) Visning  7) Flytning
      (knapper, træk og slip, PDF-sider)  8) Forhåndsvisning  9) Opstart
   Alle filer behandles i browseren. Intet filindhold sendes nogen steder hen.
   ========================================================================== */
'use strict';

(() => {
  /* ---------- 1) Biblioteker (hentes fra CDN med faste versioner) ---------- */
  const LIBS = {
    pdfLib: { name: 'pdf-lib', global: 'PDFLib', url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js' },
    pdfjs: { name: 'PDF.js', global: 'pdfjsLib', url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' },
    jszip: { name: 'JSZip', global: 'JSZip', url: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' },
    docx: { name: 'docx-preview', global: 'docx', url: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.7/dist/docx-preview.min.js', deps: ['jszip'] },
    html2canvas: { name: 'html2canvas', global: 'html2canvas', url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' },
  };
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const libPromises = {};

  class LibError extends Error {
    constructor(lib) {
      super(`Biblioteket ${lib} kunne ikke indlæses. Tjek din internetforbindelse, og genindlæs siden.`);
      this.name = 'LibError';
    }
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      const timer = setTimeout(() => reject(new Error('timeout')), 30000);
      s.src = url;
      s.async = true;
      s.onload = () => { clearTimeout(timer); resolve(); };
      s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error('load')); };
      document.head.appendChild(s);
    });
  }

  function loadLib(key) {
    if (!libPromises[key]) {
      const lib = LIBS[key];
      libPromises[key] = (async () => {
        for (const dep of lib.deps || []) await loadLib(dep);
        if (!window[lib.global]) await loadScript(lib.url);
        const api = window[lib.global];
        if (!api) throw new Error('mangler');
        if (key === 'pdfjs') api.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        return api;
      })().catch((err) => {
        delete libPromises[key]; // et nyt forsøg er muligt senere
        throw err instanceof LibError ? err : new LibError(lib.name);
      });
    }
    return libPromises[key];
  }

  /* ---------- 2) Tilstand & hjælpere ---------- */
  const state = {
    items: [],
    building: false,
    buildCurrentId: null,
    result: null,
  };
  let idSeq = 0;

  const KINDS = {
    pdf: { label: 'PDF', icon: 'i-pdf' },
    docx: { label: 'Word', icon: 'i-word' },
    image: { label: 'Billede', icon: 'i-image' },
  };
  const EXT_KIND = { pdf: 'pdf', docx: 'docx', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image' };
  const UNSUPPORTED = {
    doc: 'Gamle Word-filer (.doc) understøttes ikke endnu. Gem filen som .docx eller PDF i Word.',
    docm: 'Word-filer med makroer understøttes ikke. Gem filen som .docx eller PDF.',
    rtf: 'RTF understøttes ikke endnu. Gem filen som .docx eller PDF.',
    odt: 'OpenDocument (.odt) understøttes ikke endnu. Gem filen som .docx eller PDF.',
    xls: 'Excel-filer understøttes ikke endnu. Gem arket som PDF i Excel.',
    xlsx: 'Excel-filer understøttes ikke endnu. Gem arket som PDF i Excel.',
    ppt: 'PowerPoint-filer understøttes ikke endnu. Gem præsentationen som PDF.',
    pptx: 'PowerPoint-filer understøttes ikke endnu. Gem præsentationen som PDF.',
    heic: 'HEIC-billeder understøttes ikke endnu. Gem billedet som JPG eller PNG.',
    heif: 'HEIF-billeder understøttes ikke endnu. Gem billedet som JPG eller PNG.',
  };
  const STATUS_TEXT = { loading: 'Indlæser', converting: 'Konverterer', ready: 'Klar', error: 'Fejl', processing: 'Behandles' };

  const PT_PER_MM = 72 / 25.4;
  const PAGE_SIZES = {
    a4: [595.28, 841.89],
    a3: [841.89, 1190.55],
    a5: [419.53, 595.28],
    letter: [612, 792],
  };
  const MAX_IMAGE_SIDE = 8000;      // større billeder skaleres ned ved omkodning
  const BIG_FILE_BYTES = 150 * 1024 * 1024;

  class UserError extends Error {
    constructor(message) { super(message); this.name = 'UserError'; }
  }
  class Removed extends Error {
    constructor() { super('removed'); this.name = 'Removed'; }
  }

  const $ = (sel) => document.querySelector(sel);
  const el = {
    fileInput: $('#fileInput'),
    pickBtn: $('#pickBtn'),
    dropzone: $('#dropzone'),
    dropOverlay: $('#dropOverlay'),
    list: $('#fileList'),
    empty: $('#emptyState'),
    summary: $('#filesSummary'),
    orderHint: $('#orderHint'),
    clearBtn: $('#clearBtn'),
    buildBtn: $('#buildBtn'),
    buildHint: $('#buildHint'),
    progress: $('#progress'),
    progressText: $('#progressText'),
    progressCount: $('#progressCount'),
    progressBar: $('#progressBar'),
    progressFill: $('#progressFill'),
    progressFile: $('#progressFile'),
    result: $('#result'),
    resultText: $('#resultText'),
    resultLink: $('#resultLink'),
    restartBtn: $('#restartBtn'),
    optName: $('#optName'),
    optSize: $('#optSize'),
    optOrientation: $('#optOrientation'),
    optFit: $('#optFit'),
    optMargin: $('#optMargin'),
    libBanner: $('#libBanner'),
    toasts: $('#toasts'),
    announcer: $('#announcer'),
    previewDialog: $('#previewDialog'),
    previewTitle: $('#previewTitle'),
    previewBody: $('#previewBody'),
    confirmDialog: $('#confirmDialog'),
    steps: document.querySelectorAll('.step'),
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;
  const extOf = (name) => (name.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',')} MB`;
  }
  const pagesText = (n) => `${n} ${n === 1 ? 'side' : 'sider'}`;
  const filesText = (n) => `${n} ${n === 1 ? 'fil' : 'filer'}`;

  function isMemoryError(err) {
    return err instanceof RangeError || /out of memory|allocation|array buffer/i.test(String(err && err.message));
  }
  function friendlyError(err) {
    if (err instanceof UserError || err instanceof LibError) return err.message;
    if (isMemoryError(err)) return 'Browseren løb tør for hukommelse. Prøv med færre eller mindre filer.';
    return 'Filen kunne ikke læses. Den er måske ødelagt.';
  }

  function sniff(bytes) {
    const b = bytes;
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
    if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg';
    if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
        && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
    if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04) return 'zip';
    const head = b.subarray(0, 1024);
    for (let i = 0; i + 4 < head.length; i++) {
      if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46 && head[i + 4] === 0x2D) return 'pdf';
    }
    return null;
  }

  // EXIF-orientering i JPEG (1 = normal). Telefonbilleder er ofte gemt roteret.
  function jpegOrientation(b) {
    let o = 2;
    while (o + 10 < b.length) {
      if (b[o] !== 0xFF) return 1;
      const marker = b[o + 1];
      const len = (b[o + 2] << 8) | b[o + 3];
      if (marker === 0xDA) return 1;
      if (marker === 0xE1 && b[o + 4] === 0x45 && b[o + 5] === 0x78 && b[o + 6] === 0x69 && b[o + 7] === 0x66) {
        const t = o + 10;
        const le = b[t] === 0x49;
        const r16 = (p) => (le ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1]);
        const r32 = (p) => (le
          ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0
          : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0);
        const ifd = t + r32(t + 4);
        if (ifd + 2 > b.length) return 1;
        const n = r16(ifd);
        for (let i = 0; i < n; i++) {
          const e = ifd + 2 + i * 12;
          if (e + 10 > b.length) break;
          if (r16(e) === 0x0112) return r16(e + 8) || 1;
        }
        return 1;
      }
      o += 2 + len;
    }
    return 1;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new RangeError('canvas'))), type, quality);
    });
  }

  function loadImageElement(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new UserError('Billedet kunne ikke læses. Filen er måske ødelagt.'));
      img.src = url;
    });
  }

  function trackUrl(item, blobOrUrl) {
    const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    item.urls.push(url);
    return url;
  }

  function disposeItem(item) {
    item.removed = true;
    for (const url of item.urls) URL.revokeObjectURL(url);
    item.urls = [];
    if (item.pdfjsDoc) item.pdfjsDoc.then((d) => d.destroy()).catch(() => {});
    item.pdfjsDoc = null;
    item.bytes = null;
    item.docxPages = null;
  }

  /* ---------- Beskeder ---------- */
  function toast(kind, title, text, ms = 7000) {
    const node = document.createElement('div');
    node.className = `toast toast-${kind}`;
    node.innerHTML = `${icon(kind === 'ok' ? 'i-check' : 'i-alert')}
      <div class="toast-body"><p class="toast-title">${esc(title)}</p>${text ? `<p class="toast-text">${esc(text)}</p>` : ''}</div>
      <button type="button" class="icon-btn" aria-label="Luk besked">${icon('i-x')}</button>`;
    const close = () => node.remove();
    node.querySelector('button').addEventListener('click', close);
    el.toasts.appendChild(node);
    if (ms) setTimeout(close, ms);
  }

  function announce(text) {
    el.announcer.textContent = '';
    setTimeout(() => { el.announcer.textContent = text; }, 30);
  }

  function showLibBanner(err) {
    el.libBanner.textContent = err.message;
    el.libBanner.hidden = false;
  }

  function confirmDialog(title, text, okLabel) {
    return new Promise((resolve) => {
      const d = el.confirmDialog;
      d.querySelector('#confirmTitle').textContent = title;
      d.querySelector('#confirmText').textContent = text;
      d.querySelector('#confirmOk').textContent = okLabel;
      d.returnValue = '';
      d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
      d.showModal();
    });
  }

  /* ---------- 3) Tilføj filer ---------- */
  function addFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    if (state.building) {
      toast('warn', 'Vent et øjeblik', 'Du kan tilføje flere filer, når den igangværende samling er færdig.');
      return;
    }
    const rejected = [];
    let added = 0;
    for (const file of files) {
      const ext = extOf(file.name);
      const kind = EXT_KIND[ext];
      if (!kind) { rejected.push({ name: file.name, ext }); continue; }
      const item = {
        id: ++idSeq, file, name: file.name, size: file.size, ext, kind,
        status: 'loading', error: null, warnings: [],
        pageCount: null, thumbUrl: null, urls: [], removed: false,
        bytes: null, pageOrder: null, pageThumbs: null, expanded: false, pdfjsDoc: null,
        docxPages: null, imageType: null, imageWidth: 0, imageHeight: 0, needsRaster: false,
      };
      state.items.push(item);
      added++;
      if (file.size > BIG_FILE_BYTES) {
        toast('warn', 'Meget stor fil', `${file.name} fylder ${formatSize(file.size)}. Browseren kan løbe tør for hukommelse.`);
      }
      prepare(item);
    }
    if (rejected.length) {
      const reasons = [...new Set(rejected.map((r) => UNSUPPORTED[r.ext]).filter(Boolean))];
      toast('error',
        rejected.length === 1 ? `${rejected[0].name} understøttes ikke` : `${rejected.length} filer understøttes ikke`,
        `${rejected.length > 1 ? rejected.map((r) => r.name).join(', ') + '. ' : ''}${reasons.join(' ') || 'Understøttede filtyper er PDF, Word (.docx), PNG, JPG og WebP.'}`,
        10000);
    }
    if (added) {
      state.result = null;
      announce(`${filesText(added)} tilføjet. ${filesText(state.items.length)} i alt.`);
    }
    render();
  }

  async function removeItem(id) {
    const idx = state.items.findIndex((i) => i.id === id);
    if (idx < 0 || state.building) return;
    const [item] = state.items.splice(idx, 1);
    disposeItem(item);
    state.result = null;
    render();
    announce(`${item.name} er fjernet.`);
    // Flyt fokus til en fornuftig knap, så tastaturbrugere ikke mister deres plads.
    const next = state.items[idx] || state.items[idx - 1];
    const target = next ? el.list.querySelector(`[data-key="${next.id}:remove"]`) : el.pickBtn;
    if (target) target.focus();
  }

  async function clearAll(ask) {
    if (!state.items.length || state.building) return;
    if (ask && !(await confirmDialog('Fjern alle filer?', `Alle ${filesText(state.items.length)} fjernes fra listen. Dine originale filer på computeren påvirkes ikke.`, 'Fjern alle'))) return;
    state.items.forEach(disposeItem);
    state.items = [];
    setResult(null);
    render();
    announce('Alle filer er fjernet.');
    el.pickBtn.focus();
  }

  /* ---------- 4) Forberedelse af filer ---------- */
  let docxQueue = Promise.resolve();

  function prepare(item) {
    const run = async () => {
      try {
        if (item.removed) return;
        if (item.size === 0) throw new UserError('Filen er tom.');
        if (item.kind === 'pdf') await preparePdf(item);
        else if (item.kind === 'image') await prepareImage(item);
        else await prepareDocx(item);
        if (item.removed) return;
        item.status = 'ready';
      } catch (err) {
        if (item.removed || err instanceof Removed) return;
        console.warn(item.name, err);
        item.status = 'error';
        item.error = friendlyError(err);
        if (err instanceof LibError) showLibBanner(err);
      }
      render();
    };
    // Word-filer gengives én ad gangen, så hukommelsen ikke løber løbsk.
    if (item.kind === 'docx') docxQueue = docxQueue.then(run);
    else run();
  }

  async function readBytes(item) {
    try {
      return new Uint8Array(await item.file.arrayBuffer());
    } catch (err) {
      if (isMemoryError(err)) throw err;
      throw new UserError('Filen kunne ikke læses. Er den flyttet eller slettet?');
    }
  }

  // --- PDF ---
  async function preparePdf(item) {
    const PDFLib = await loadLib('pdfLib');
    const bytes = await readBytes(item);
    if (sniff(bytes) !== 'pdf') throw new UserError('Filen ser ikke ud til at være en gyldig PDF.');
    let doc;
    try {
      doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    } catch (err) {
      if (isMemoryError(err)) throw err;
      if (err && (err.name === 'EncryptedPDFError' || /encrypt/i.test(err.message))) {
        throw new UserError(await describeEncryptedPdf(bytes));
      }
      throw new UserError('PDF\'en er ødelagt og kan ikke læses.');
    }
    let n;
    try {
      n = doc.getPageCount();
    } catch (err) {
      throw new UserError('PDF\'en er ødelagt og kan ikke læses.');
    }
    if (!n) throw new UserError('PDF\'en indeholder ingen sider.');
    if (item.removed) throw new Removed();
    item.bytes = bytes;
    item.pageCount = n;
    item.pageOrder = Array.from({ length: n }, (_, i) => i);
    item.pageThumbs = new Array(n).fill(null);
    // Miniature af første side (ikke kritisk, hvis den fejler).
    item.status = 'ready';
    render();
    renderPdfThumb(item, 0, 140).then((url) => {
      if (!url || item.removed) return;
      item.thumbUrl = url;
      item.pageThumbs[0] = url;
      render();
    }).catch(() => {});
  }

  async function describeEncryptedPdf(bytes) {
    try {
      const pdfjs = await loadLib('pdfjs');
      const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false });
      try {
        await task.promise;
      } finally {
        task.destroy();
      }
    } catch (err) {
      if (err && err.name === 'PasswordException') {
        return 'PDF\'en er beskyttet med en adgangskode og kan ikke samles. Fjern adgangskoden og prøv igen.';
      }
    }
    return 'PDF\'en er krypteret (beskyttet mod ændringer) og kan ikke samles. Åbn den i en PDF-læser og vælg "Udskriv som PDF" for at lave en ubeskyttet kopi.';
  }

  function getPdfJsDoc(item) {
    if (!item.pdfjsDoc) {
      item.pdfjsDoc = loadLib('pdfjs').then((pdfjs) =>
        // isEvalSupported: false lukker for en kendt sikkerhedsfejl i ældre PDF.js-versioner.
        pdfjs.getDocument({ data: item.bytes.slice(), isEvalSupported: false }).promise);
      item.pdfjsDoc.catch(() => { item.pdfjsDoc = null; });
    }
    return item.pdfjsDoc;
  }

  async function renderPdfPageCanvas(item, pageIndex, cssWidth) {
    const doc = await getPdfJsDoc(item);
    const page = await doc.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1 });
    const scale = (cssWidth / base.width) * Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
    return canvas;
  }

  async function renderPdfThumb(item, pageIndex, cssWidth) {
    if (item.removed || !item.bytes) return null;
    const canvas = await renderPdfPageCanvas(item, pageIndex, cssWidth);
    if (item.removed) return null;
    return trackUrl(item, await canvasToBlob(canvas, 'image/jpeg', 0.82));
  }

  // --- Billeder ---
  async function prepareImage(item) {
    const bytes = await readBytes(item);
    const type = sniff(bytes);
    if (!['png', 'jpeg', 'webp'].includes(type)) {
      throw new UserError('Filen ser ikke ud til at være et gyldigt billede (PNG, JPG eller WebP).');
    }
    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[type];
    const url = trackUrl(item, new Blob([bytes], { type: mime }));
    const img = await loadImageElement(url);
    if (!img.naturalWidth || !img.naturalHeight) throw new UserError('Billedet er tomt eller ødelagt.');
    if (item.removed) throw new Removed();
    item.bytes = bytes;
    item.imageType = type;
    item.imageMime = mime;
    item.imageWidth = img.naturalWidth;   // browseren har allerede taget højde for EXIF-rotation
    item.imageHeight = img.naturalHeight;
    item.needsRaster = type === 'webp' || (type === 'jpeg' && jpegOrientation(bytes) > 1);
    item.thumbUrl = url;
    item.pageCount = 1;
  }

  // Tegner billedet på et lærred (bruges til WebP og roterede JPG'er).
  async function rasterizeImage(item) {
    const img = await loadImageElement(item.thumbUrl);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    const shrink = Math.min(1, MAX_IMAGE_SIDE / Math.max(w, h));
    w = Math.max(1, Math.round(w * shrink));
    h = Math.max(1, Math.round(h * shrink));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // JPEG har ingen gennemsigtighed; PNG beholder den.
    const asJpeg = item.imageType === 'jpeg';
    if (asJpeg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await canvasToBlob(canvas, asJpeg ? 'image/jpeg' : 'image/png', 0.92);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: asJpeg ? 'jpeg' : 'png' };
  }

  // --- Word (.docx) ---
  const DOCX_RENDER_SCALE = 2; // ca. 190 dpi

  async function prepareDocx(item) {
    item.status = 'converting';
    render();
    const [JSZip, docxLib] = await Promise.all([loadLib('jszip'), loadLib('docx'), loadLib('html2canvas')])
      .then(([, d]) => [window.JSZip, d]);
    const bytes = await readBytes(item);
    if (sniff(bytes) !== 'zip') throw new UserError('Filen ser ikke ud til at være et gyldigt Word-dokument (.docx).');

    let zip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch (err) {
      if (isMemoryError(err)) throw err;
      throw new UserError('Word-dokumentet er ødelagt og kan ikke åbnes.');
    }
    const docEntry = zip.file('word/document.xml');
    if (!docEntry) {
      if (zip.file('EncryptedPackage') || zip.file('EncryptionInfo')) throw new UserError('Word-dokumentet er beskyttet med en adgangskode.');
      throw new UserError('Filen er ikke et Word-dokument (indholdet mangler).');
    }
    const xml = await docEntry.async('string');
    const analysis = analyzeDocx(xml);
    if (item.removed) throw new Removed();

    const stage = document.createElement('div');
    stage.className = 'docx-stage';
    const host = document.createElement('div');
    host.className = 'docx-host';
    stage.appendChild(host);
    document.body.appendChild(stage);
    try {
      try {
        await docxLib.renderAsync(bytes, host, host, {
          className: 'docx',
          inWrapper: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false, // brug Words egne sideskift, hvor de findes
          ignoreWidth: false,
          ignoreHeight: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
          experimental: true,
        });
      } catch (err) {
        if (isMemoryError(err)) throw err;
        throw new UserError('Word-dokumentet kunne ikke gengives. Gem det som PDF i Word og prøv igen.');
      }
      await waitForAssets(host);
      if (item.removed) throw new Removed();

      const sections = [...host.querySelectorAll(':scope > section.docx')];
      if (!sections.length) throw new UserError('Word-dokumentet blev tomt ved konverteringen.');

      // Kontrollér, at teksten faktisk kom med, så en fil aldrig ser konverteret ud uden at være det.
      const renderedChars = sections.reduce((n, s) => n + s.textContent.replace(/\s+/g, '').length, 0);
      if (analysis.chars > 20 && renderedChars < analysis.chars * 0.5) {
        throw new UserError('Kun en del af teksten kunne gengives. Gem dokumentet som PDF i Word og prøv igen.');
      }
      const warnings = [];
      if (analysis.chars > 20 && renderedChars < analysis.chars * 0.95) warnings.push('Noget af teksten kom muligvis ikke med.');
      const renderedImages = host.querySelectorAll('img').length;
      if (renderedImages < analysis.pictures) warnings.push('Nogle billeder i dokumentet kunne ikke vises.');
      if (analysis.complex.length) warnings.push(`Dokumentet indeholder ${analysis.complex.join(', ')}, som måske ikke ser helt ud som i Word.`);

      const pages = [];
      for (const section of sections) {
        if (item.removed) throw new Removed();
        pages.push(...await rasterizeSection(section));
      }
      if (!pages.length) throw new UserError('Word-dokumentet blev tomt ved konverteringen.');
      if (item.removed) throw new Removed();

      item.docxPages = pages;
      item.pageCount = pages.length;
      item.warnings = warnings;
      item.thumbUrl = trackUrl(item, pages[0].thumb);
    } finally {
      stage.remove();
    }
  }

  function analyzeDocx(xml) {
    let chars = 0;
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let m;
    while ((m = re.exec(xml))) chars += m[1].replace(/\s+/g, '').replace(/&[a-z#0-9]+;/gi, 'x').length;
    const count = (pattern) => (xml.match(pattern) || []).length;
    const complex = [];
    if (/<w:txbxContent/.test(xml)) complex.push('tekstbokse');
    // Kun elementer – navnerummene står i alle Word-filer og siger ikke noget.
    if (/<(c|cx):chart[\s/>]/.test(xml)) complex.push('diagrammer');
    if (/<dgm:relIds[\s/>]/.test(xml)) complex.push('SmartArt');
    if (/<m:oMath/.test(xml)) complex.push('ligninger');
    if (/<w:object/.test(xml)) complex.push('indlejrede objekter');
    if (/<w:cols [^>]*w:num="[2-9]/.test(xml)) complex.push('spalter');
    return { chars, pictures: count(/<pic:pic[\s>]/g), complex };
  }

  async function waitForAssets(root) {
    const imgs = [...root.querySelectorAll('img')];
    await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
    }))));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await nextFrame();
    await nextFrame();
  }

  // Finder steder, hvor en side kan deles, uden at skære igennem tekstlinjer eller billeder.
  function collectBlockedIntervals(section) {
    const top = section.getBoundingClientRect().top;
    const spans = [];
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.trim()) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.height > 0) spans.push([r.top - top, r.bottom - top]);
      }
    }
    for (const media of section.querySelectorAll('img, svg, canvas, video')) {
      const r = media.getBoundingClientRect();
      if (r.height > 0) spans.push([r.top - top, r.bottom - top]);
    }
    spans.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [a, b] of spans) {
      const last = merged[merged.length - 1];
      if (last && a < last[1] - 0.5) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    }
    return merged;
  }

  function measureSection(section) {
    const rect = section.getBoundingClientRect();
    const cs = getComputedStyle(section);
    const totalH = rect.height;
    const pageH = parseFloat(cs.minHeight) || rect.width * Math.SQRT2;
    return {
      width: rect.width,
      totalH,
      pageH,
      padTop: parseFloat(cs.paddingTop) || 0,
      padBottom: parseFloat(cs.paddingBottom) || 0,
      blocked: totalH > pageH + 2 ? collectBlockedIntervals(section) : [],
    };
  }

  // html2canvas tegner tekst et par pixels anderledes end browseren. Derfor flyttes et
  // snit op til den nærmeste helt hvide pixelrække, så ingen bogstaver bliver skåret over.
  function refineCut(shot, shotStart, start, cut, scale) {
    const ctx = shot.getContext('2d', { willReadFrequently: true });
    const bottom = Math.floor((cut - shotStart) * scale);
    const top = Math.max(Math.ceil((start + 40 - shotStart) * scale), bottom - Math.round(48 * scale));
    if (bottom <= top || bottom > shot.height) return cut;
    const data = ctx.getImageData(0, top, shot.width, bottom - top).data;
    const rowLen = shot.width * 4;
    for (let y = bottom - top - 1; y >= 0; y--) {
      let blank = true;
      for (let i = y * rowLen; i < (y + 1) * rowLen; i += 4) {
        if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) { blank = false; break; }
      }
      if (blank) return shotStart + (top + y + 1) / scale;
    }
    return cut; // fx tabeller med lodrette streger: brug layoutets snit
  }

  async function rasterizeSection(section) {
    const m = measureSection(section);
    const scale = DOCX_RENDER_SCALE;
    const pageW = Math.round(m.width * scale);
    const pageHpx = Math.round(m.pageH * scale);
    const maxChunk = Math.floor(14000 / scale); // lærreder må ikke blive for høje

    // Sektionen tegnes i bidder, så hvert lærred holder sig under browserens grænser.
    let shot = null;
    let shotStart = 0;
    let shotEnd = 0;
    const ensureShot = async (a, b) => {
      if (shot && a >= shotStart && b <= shotEnd) return;
      if (shot) shot.width = shot.height = 0;
      shotStart = a;
      shotEnd = Math.min(m.totalH, Math.max(b, a + maxChunk));
      shot = await window.html2canvas(section, {
        scale,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        x: 0,
        y: shotStart,
        width: Math.ceil(m.width),
        height: Math.ceil(shotEnd - shotStart),
      });
    };

    const pages = [];
    let start = 0;
    for (let n = 0; n < 2000; n++) {
      const offset = n === 0 ? 0 : m.padTop;
      let end;
      const last = m.totalH - start <= m.pageH - offset + 1;
      if (last) {
        end = m.totalH;
      } else {
        // Find et snit, der ikke rammer en tekstlinje eller et billede.
        const limit = start + Math.max(40, m.pageH - offset - m.padBottom);
        end = limit;
        const hit = m.blocked.find(([a, b]) => a < limit && b > limit);
        if (hit && hit[0] > start + 40) end = hit[0];
      }
      await ensureShot(start, end);
      if (!last) end = refineCut(shot, shotStart, start, end, scale);

      const canvas = document.createElement('canvas');
      canvas.width = pageW;
      canvas.height = pageHpx;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, pageW, pageHpx);
      const sy = Math.round((start - shotStart) * scale);
      const dy = Math.round(offset * scale);
      const sh = Math.min(Math.round((end - start) * scale), shot.height - sy, pageHpx - dy);
      const sw = Math.min(pageW, shot.width);
      if (sh > 0) ctx.drawImage(shot, 0, sy, sw, sh, 0, dy, sw, sh);
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      pages.push({
        bytes: new Uint8Array(await blob.arrayBuffer()),
        blob,
        thumb: pages.length ? null : await makeThumb(canvas, 160),
        widthPt: m.width * 0.75,
        heightPt: m.pageH * 0.75,
      });
      canvas.width = canvas.height = 0;
      if (last) break;
      start = end;
    }
    if (shot) shot.width = shot.height = 0;
    return pages;
  }

  async function makeThumb(canvas, width) {
    const t = document.createElement('canvas');
    t.width = width;
    t.height = Math.round(canvas.height * (width / canvas.width));
    t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
    return canvasToBlob(t, 'image/jpeg', 0.8);
  }

  /* ---------- 5) Samling til én PDF ---------- */
  function readSettings() {
    let name = el.optName.value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^\.+/, '');
    if (!name) name = 'samlet-dokument.pdf';
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    return {
      filename: name,
      size: el.optSize.value,
      orientation: el.optOrientation.value,
      fit: el.optFit.value,
      margin: Number(el.optMargin.value) * PT_PER_MM,
    };
  }

  // Lægger et billede (eller en Word-side) på en ny side efter indstillingerne – uden at forvrænge det.
  function addImagePage(out, embedded, contentW, contentH, opts) {
    const m = opts.margin;
    let pageW;
    let pageH;
    if (opts.size === 'original') {
      pageW = contentW + 2 * m;
      pageH = contentH + 2 * m;
    } else {
      [pageW, pageH] = PAGE_SIZES[opts.size] || PAGE_SIZES.a4;
      const landscape = opts.orientation === 'landscape' || (opts.orientation === 'auto' && contentW > contentH);
      if (landscape) [pageW, pageH] = [pageH, pageW];
    }
    const availW = Math.max(1, pageW - 2 * m);
    const availH = Math.max(1, pageH - 2 * m);
    let scale = Math.min(availW / contentW, availH / contentH);
    if (opts.fit === 'shrink') scale = Math.min(scale, 1);
    const w = contentW * scale;
    const h = contentH * scale;
    const page = out.addPage([pageW, pageH]);
    page.drawImage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
  }

  async function embedImageItem(out, item) {
    if (!item.needsRaster) {
      try {
        return item.imageType === 'png' ? await out.embedPng(item.bytes) : await out.embedJpg(item.bytes);
      } catch (err) {
        if (isMemoryError(err)) throw err;
        // Sjældne PNG/JPG-varianter: tegn billedet om og prøv igen.
      }
    }
    const r = await rasterizeImage(item);
    return r.type === 'png' ? out.embedPng(r.bytes) : out.embedJpg(r.bytes);
  }

  async function build() {
    if (state.building) return;
    const blocker = buildBlocker();
    if (blocker) { toast('warn', 'Kan ikke samle endnu', blocker); return; }

    const items = state.items.slice();
    const opts = readSettings();
    state.building = true;
    setResult(null);
    render();
    setProgress('Forbereder filer', 0, items.length, '');

    let failed = null;
    try {
      const PDFLib = await loadLib('pdfLib');
      const out = await PDFLib.PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        state.buildCurrentId = item.id;
        render();
        const label = item.kind === 'pdf' ? 'Samler PDF-sider' : item.kind === 'docx' ? 'Indsætter Word-dokument' : 'Indsætter billede';
        setProgress(label, i, items.length, item.name);
        await nextFrame();
        try {
          if (item.kind === 'pdf') {
            const src = await PDFLib.PDFDocument.load(item.bytes, { updateMetadata: false });
            const copied = await out.copyPages(src, item.pageOrder);
            copied.forEach((p) => out.addPage(p));
          } else if (item.kind === 'image') {
            const img = await embedImageItem(out, item);
            addImagePage(out, img, item.imageWidth * 0.75, item.imageHeight * 0.75, opts);
          } else {
            for (const p of item.docxPages) {
              const img = await out.embedJpg(p.bytes);
              addImagePage(out, img, p.widthPt, p.heightPt, opts);
            }
          }
        } catch (err) {
          failed = item;
          throw err;
        }
      }
      state.buildCurrentId = null;
      setProgress('Gør download klar', items.length, items.length, opts.filename);
      await nextFrame();
      out.setTitle(opts.filename.replace(/\.pdf$/i, ''));
      out.setProducer('PDF Konverter');
      out.setCreator('PDF Konverter');
      const bytes = await out.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setResult({ url, filename: opts.filename, files: items.length, pages: out.getPageCount(), size: blob.size });
      download(url, opts.filename);
      toast('ok', 'PDF\'en er klar', `${opts.filename} · ${pagesText(out.getPageCount())}`, 5000);
      announce(`PDF'en er klar med ${pagesText(out.getPageCount())}. Download er startet.`);
    } catch (err) {
      console.error(err);
      const msg = friendlyError(err);
      if (failed && !(err instanceof LibError) && !isMemoryError(err)) {
        failed.status = 'error';
        failed.error = `Kunne ikke indsættes i PDF'en. ${msg}`;
        toast('error', `${failed.name} kunne ikke behandles`, 'Fjern filen, eller prøv igen.', 10000);
      } else {
        toast('error', 'PDF\'en kunne ikke oprettes', msg, 10000);
        if (err instanceof LibError) showLibBanner(err);
      }
    } finally {
      state.building = false;
      state.buildCurrentId = null;
      el.progress.hidden = true;
      render();
    }
  }

  function download(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function setResult(result) {
    if (state.result && state.result.url && (!result || result.url !== state.result.url)) {
      URL.revokeObjectURL(state.result.url);
    }
    state.result = result;
  }

  function setProgress(text, done, total, file) {
    el.progress.hidden = false;
    el.progressText.textContent = text;
    el.progressCount.textContent = `${Math.min(done + (done < total ? 1 : 0), total)} af ${total}`;
    el.progressFill.style.width = `${total ? (done / total) * 100 : 0}%`;
    el.progressBar.setAttribute('aria-valuemax', String(total));
    el.progressBar.setAttribute('aria-valuenow', String(done));
    el.progressFile.textContent = file;
  }

  function buildBlocker() {
    const items = state.items;
    if (!items.length) return 'Tilføj mindst én fil for at komme i gang.';
    const busy = items.filter((i) => i.status === 'loading' || i.status === 'converting').length;
    if (busy) return `Vent, mens ${busy === 1 ? '1 fil' : `${busy} filer`} gøres klar.`;
    const errors = items.filter((i) => i.status === 'error').length;
    if (errors) return `Fjern ${errors === 1 ? 'filen' : `de ${errors} filer`} med fejl for at fortsætte.`;
    return '';
  }

  /* ---------- 6) Visning ---------- */
  let renderQueued = false;
  let sorting = null; // aktiv træk-og-slip-handling

  function render() {
    if (sorting) { renderQueued = true; return; }
    const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;

    const items = state.items;
    el.list.innerHTML = items.map((item, idx) => cardHtml(item, idx, items.length)).join('');
    el.empty.hidden = items.length > 0;
    el.clearBtn.hidden = items.length === 0;
    el.clearBtn.disabled = state.building;
    el.orderHint.hidden = items.length < 2;
    const pages = items.reduce((n, i) => n + (i.pageCount || 0), 0);
    el.summary.textContent = items.length ? `${filesText(items.length)}${pages ? ` · ${pagesText(pages)}` : ''}` : '';

    const blocker = buildBlocker();
    el.buildBtn.disabled = !!blocker || state.building;
    el.buildHint.textContent = state.building ? 'Arbejder …' : blocker;
    el.buildHint.hidden = !el.buildHint.textContent;
    for (const input of [el.optName, el.optSize, el.optOrientation, el.optFit, el.optMargin]) input.disabled = state.building;

    // Resultat
    const r = state.result;
    el.result.hidden = !r;
    if (r) {
      el.resultText.textContent = `${filesText(r.files)} samlet til ${pagesText(r.pages)} · ${formatSize(r.size)} · ${r.filename}`;
      el.resultLink.href = r.url;
      el.resultLink.download = r.filename;
    }

    // Trin-indikator
    const current = r ? 3 : items.length ? 2 : 1;
    el.steps.forEach((s) => {
      const n = Number(s.dataset.step);
      s.classList.toggle('is-active', n === current);
      s.classList.toggle('is-done', n < current);
    });

    observePageThumbs();

    if (focusKey) {
      const target = document.querySelector(`[data-key="${focusKey}"]`);
      if (target && !target.disabled) target.focus();
      else if (target) {
        const card = target.closest('.card');
        const alt = card && card.querySelector('[data-action="up"]:not(:disabled), [data-action="down"]:not(:disabled), [data-action="remove"]');
        if (alt) alt.focus();
      }
    }
  }

  function cardHtml(item, idx, total) {
    const kind = KINDS[item.kind];
    const locked = state.building;
    const processing = state.buildCurrentId === item.id;
    const status = processing ? 'processing' : item.status;
    const meta = [
      `<span class="chip chip-${item.kind}">${esc(item.ext.toUpperCase())}</span>`,
      `<span>${formatSize(item.size)}</span>`,
      item.pageCount ? `<span>${pagesText(item.pageCount)}</span>` : '',
      `<span class="status status-${status}">${STATUS_TEXT[status]}</span>`,
    ].join('');
    const thumb = item.thumbUrl
      ? `<img src="${esc(item.thumbUrl)}" alt="">`
      : (item.status === 'loading' || item.status === 'converting') ? '<span class="spinner" aria-hidden="true"></span>' : icon(kind.icon);
    const canPreview = item.status === 'ready';
    const notes = [
      ...item.warnings.map((w) => `<p class="card-note warn">${icon('i-alert')}<span>${esc(w)}</span></p>`),
      item.error ? `<p class="card-note error">${icon('i-alert')}<span>${esc(item.error)}</span></p>` : '',
      item.kind === 'docx' && item.status === 'ready'
        ? `<p class="card-note warn">${icon('i-alert')}<span>Word-sider indsættes som billeder, så teksten kan ikke markeres i den færdige PDF.</span></p>` : '',
    ].join('');
    const reordered = item.pageOrder && item.pageOrder.some((p, i) => p !== i);
    const pagesToggle = item.kind === 'pdf' && item.status === 'ready' && item.pageCount > 1
      ? `<button type="button" class="link-btn" data-action="toggle-pages" data-key="${item.id}:toggle-pages" aria-expanded="${item.expanded}">
           ${icon('i-pages')}${item.expanded ? 'Skjul sider' : 'Arrangér sider'}${reordered ? ' (ændret)' : ''}
         </button>` : '';
    const name = esc(item.name);

    return `
      <li class="card${item.status === 'error' ? ' is-error' : ''}${processing ? ' is-active' : ''}" data-id="${item.id}">
        <span class="card-index" aria-hidden="true">${idx + 1}</span>
        <button type="button" class="handle" data-action="handle" data-key="${item.id}:handle" ${locked ? 'disabled' : ''}
          aria-label="Flyt ${name}, nummer ${idx + 1} af ${total}. Brug pil op og pil ned.">${icon('i-grip')}</button>
        <button type="button" class="thumb kind-${item.kind}" data-action="preview" data-key="${item.id}:preview"
          ${canPreview ? '' : 'disabled'} aria-label="Forhåndsvis ${name}">${thumb}</button>
        <div class="card-body">
          <p class="card-name" title="${name}">${name}</p>
          <div class="card-meta">${meta}</div>
          ${notes}
          ${pagesToggle}
        </div>
        <div class="card-actions">
          <button type="button" class="icon-btn" data-action="up" data-key="${item.id}:up" ${idx === 0 || locked ? 'disabled' : ''} aria-label="Flyt ${name} op">${icon('i-up')}</button>
          <button type="button" class="icon-btn" data-action="down" data-key="${item.id}:down" ${idx === total - 1 || locked ? 'disabled' : ''} aria-label="Flyt ${name} ned">${icon('i-down')}</button>
          <button type="button" class="icon-btn" data-action="preview" data-key="${item.id}:preview2" ${canPreview ? '' : 'disabled'} aria-label="Forhåndsvis ${name}">${icon('i-eye')}</button>
          <button type="button" class="icon-btn danger" data-action="remove" data-key="${item.id}:remove" ${locked ? 'disabled' : ''} aria-label="Fjern ${name}">${icon('i-trash')}</button>
        </div>
        ${item.expanded && item.kind === 'pdf' ? pagesHtml(item, locked) : ''}
      </li>`;
  }

  function pagesHtml(item, locked) {
    const n = item.pageOrder.length;
    const reordered = item.pageOrder.some((p, i) => p !== i);
    const tiles = item.pageOrder.map((p, pos) => {
      const thumb = item.pageThumbs[p];
      return `
        <li class="page-tile" data-page-pos="${pos}" draggable="${locked ? 'false' : 'true'}">
          <button type="button" class="page-thumb" data-action="page-preview" data-pos="${pos}" data-key="${item.id}:pp${p}" aria-label="Forhåndsvis side ${p + 1}">
            ${thumb ? `<img src="${esc(thumb)}" alt="">` : `<span class="spinner" data-lazy-page="${p}" aria-hidden="true"></span>`}
          </button>
          <span class="page-label">${pos + 1}${p !== pos ? ` <s title="Oprindelig side">(${p + 1})</s>` : ''}</span>
          <span class="page-moves">
            <button type="button" class="icon-btn" data-action="page-left" data-pos="${pos}" data-key="${item.id}:pl${p}" ${pos === 0 || locked ? 'disabled' : ''} aria-label="Flyt side ${p + 1} tidligere">${icon('i-left')}</button>
            <button type="button" class="icon-btn" data-action="page-right" data-pos="${pos}" data-key="${item.id}:pr${p}" ${pos === n - 1 || locked ? 'disabled' : ''} aria-label="Flyt side ${p + 1} senere">${icon('i-right')}</button>
          </span>
        </li>`;
    }).join('');
    return `
      <div class="pages">
        <div class="pages-head">
          <span>Sidernes rækkefølge i ${esc(item.name)}. Træk en side, eller brug pilene.</span>
          ${reordered ? `<button type="button" class="link-btn" data-action="page-reset" data-key="${item.id}:page-reset" ${locked ? 'disabled' : ''}>${icon('i-refresh')}Nulstil rækkefølge</button>` : ''}
        </div>
        <ol class="pages-grid" aria-label="Sider i ${esc(item.name)}">${tiles}</ol>
      </div>`;
  }

  // Miniaturer af PDF-sider tegnes først, når de kommer i syne.
  let thumbObserver = null;
  const thumbQueue = [];
  let thumbBusy = false;

  function observePageThumbs() {
    const spots = el.list.querySelectorAll('[data-lazy-page]');
    if (!spots.length) return;
    if (!thumbObserver) {
      thumbObserver = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          thumbObserver.unobserve(e.target);
          const card = e.target.closest('.card');
          if (!card) continue;
          thumbQueue.push({ id: Number(card.dataset.id), page: Number(e.target.dataset.lazyPage) });
        }
        pumpThumbs();
      }, { rootMargin: '200px' });
    }
    spots.forEach((s) => thumbObserver.observe(s));
  }

  async function pumpThumbs() {
    if (thumbBusy) return;
    thumbBusy = true;
    let changed = false;
    while (thumbQueue.length) {
      const { id, page } = thumbQueue.shift();
      const item = state.items.find((i) => i.id === id);
      if (!item || item.removed || !item.pageThumbs || item.pageThumbs[page]) continue;
      try {
        item.pageThumbs[page] = await renderPdfThumb(item, page, 110);
        changed = true;
      } catch (err) {
        console.warn('miniature', err);
      }
      if (changed && thumbQueue.length % 4 === 0) { render(); changed = false; }
    }
    thumbBusy = false;
    if (changed) render();
  }

  /* ---------- 7) Flytning ---------- */
  function moveItem(from, to) {
    const items = state.items;
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    state.result = null;
    render();
    announce(`${item.name} er flyttet til plads ${to + 1} af ${items.length}.`);
  }

  function movePage(item, from, to) {
    const order = item.pageOrder;
    if (from === to || to < 0 || to >= order.length) return;
    const [p] = order.splice(from, 1);
    order.splice(to, 0, p);
    state.result = null;
    render();
    announce(`Side ${p + 1} er flyttet til plads ${to + 1} af ${order.length}.`);
  }

  // Klik på knapper i listen
  el.list.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const card = btn.closest('.card');
    const item = card && state.items.find((i) => i.id === Number(card.dataset.id));
    if (!item) return;
    const idx = state.items.indexOf(item);
    const pos = Number(btn.dataset.pos);
    switch (btn.dataset.action) {
      case 'up': moveItem(idx, idx - 1); break;
      case 'down': moveItem(idx, idx + 1); break;
      case 'remove': removeItem(item.id); break;
      case 'preview': openPreview(item); break;
      case 'toggle-pages': item.expanded = !item.expanded; render(); break;
      case 'page-left': if (!state.building) movePage(item, pos, pos - 1); break;
      case 'page-right': if (!state.building) movePage(item, pos, pos + 1); break;
      case 'page-reset':
        if (!state.building) { item.pageOrder.sort((a, b) => a - b); state.result = null; render(); announce('Siderækkefølgen er nulstillet.'); }
        break;
      case 'page-preview': openPreview(item, pos); break;
      default: break;
    }
  });

  // Tastatur på håndtaget: pil op/ned flytter kortet.
  el.list.addEventListener('keydown', (e) => {
    const handle = e.target.closest('.handle');
    if (!handle || state.building) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const idx = state.items.findIndex((i) => i.id === Number(handle.closest('.card').dataset.id));
    moveItem(idx, e.key === 'ArrowUp' ? idx - 1 : idx + 1);
  });

  // --- Træk og slip af kort (mus: hele kortet, touch: håndtaget) ---
  let suppressClick = false;

  el.list.addEventListener('pointerdown', (e) => {
    if (state.building || e.button !== 0 || sorting) return;
    const card = e.target.closest('.card');
    if (!card) return;
    const onHandle = !!e.target.closest('.handle');
    if (e.pointerType !== 'mouse' && !onHandle) return;
    if (!onHandle && e.target.closest('button, a, input, select, .pages')) return;
    const cards = [...el.list.children];
    const from = cards.indexOf(card);
    if (from < 0) return;
    sorting = {
      pointerId: e.pointerId, card, cards, from, to: from,
      startY: e.clientY, startScroll: window.scrollY, active: false,
      mids: [], height: 0,
    };
    card.setPointerCapture(e.pointerId);
    if (onHandle) e.preventDefault();
  });

  el.list.addEventListener('pointermove', (e) => {
    const s = sorting;
    if (!s || e.pointerId !== s.pointerId) return;
    const dy = e.clientY - s.startY + (window.scrollY - s.startScroll);
    if (!s.active) {
      if (Math.abs(dy) < 6) return;
      s.active = true;
      const gap = parseFloat(getComputedStyle(el.list).rowGap) || 10;
      s.height = s.card.getBoundingClientRect().height + gap;
      s.mids = s.cards.map((c) => { const r = c.getBoundingClientRect(); return r.top + window.scrollY + r.height / 2; });
      s.card.classList.add('is-dragging');
      el.list.classList.add('is-sorting');
      document.body.classList.add('is-dragging-card');
    }
    e.preventDefault();
    s.card.style.transform = `translateY(${dy}px)`;
    const center = s.mids[s.from] + dy;
    let to = 0;
    s.mids.forEach((m, i) => { if (i !== s.from && m < center) to++; });
    s.to = to;
    s.cards.forEach((c, i) => {
      if (i === s.from) return;
      let shift = 0;
      if (s.from < to && i > s.from && i <= to) shift = -s.height;
      if (to < s.from && i >= to && i < s.from) shift = s.height;
      c.style.transform = shift ? `translateY(${shift}px)` : '';
    });
    // Rul automatisk, når kortet trækkes mod kanten.
    const edge = 70;
    if (e.clientY < edge) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 14);
  });

  function endSort(commit) {
    const s = sorting;
    if (!s) return;
    sorting = null;
    s.cards.forEach((c) => { c.style.transform = ''; });
    s.card.classList.remove('is-dragging');
    el.list.classList.remove('is-sorting');
    document.body.classList.remove('is-dragging-card');
    if (s.active) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
    if (s.active && commit && s.to !== s.from) moveItem(s.from, s.to);
    else if (renderQueued) { renderQueued = false; render(); }
  }
  el.list.addEventListener('pointerup', (e) => { if (sorting && e.pointerId === sorting.pointerId) endSort(true); });
  el.list.addEventListener('pointercancel', () => endSort(false));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sorting) endSort(false); });

  // --- Træk og slip af PDF-sider (indbygget drag-and-drop) ---
  let pageDrag = null;
  el.list.addEventListener('dragstart', (e) => {
    const tile = e.target.closest && e.target.closest('.page-tile');
    if (!tile || state.building) return;
    pageDrag = { id: Number(tile.closest('.card').dataset.id), from: Number(tile.dataset.pagePos) };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'side');
    tile.classList.add('is-dragged');
  });
  el.list.addEventListener('dragover', (e) => {
    if (!pageDrag) return;
    const tile = e.target.closest('.page-tile');
    if (!tile || Number(tile.closest('.card').dataset.id) !== pageDrag.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.list.querySelectorAll('.page-tile.is-drop').forEach((t) => t !== tile && t.classList.remove('is-drop'));
    tile.classList.add('is-drop');
  });
  el.list.addEventListener('drop', (e) => {
    if (!pageDrag) return;
    const tile = e.target.closest('.page-tile');
    e.preventDefault();
    const drag = pageDrag;
    pageDrag = null;
    if (!tile) { render(); return; }
    const item = state.items.find((i) => i.id === drag.id);
    if (item) movePage(item, drag.from, Number(tile.dataset.pagePos));
  });
  el.list.addEventListener('dragend', () => {
    if (pageDrag) { pageDrag = null; render(); }
  });

  /* ---------- 8) Forhåndsvisning ---------- */
  let previewToken = 0;
  const previewUrls = [];

  function closePreviewCleanup() {
    previewToken++;
    el.previewBody.innerHTML = '';
    while (previewUrls.length) URL.revokeObjectURL(previewUrls.pop());
  }

  async function openPreview(item, startPos = 0) {
    closePreviewCleanup();
    const token = previewToken;
    el.previewTitle.textContent = item.name;
    el.previewDialog.showModal();
    const body = el.previewBody;
    body.scrollTop = 0;

    if (item.kind === 'image') {
      body.innerHTML = `<figure class="preview-page"><img src="${esc(item.thumbUrl)}" alt="${esc(item.name)}">
        <figcaption class="preview-caption">${item.imageWidth} × ${item.imageHeight} px</figcaption></figure>`;
      return;
    }

    const notes = item.warnings.map((w) => `<p class="card-note warn preview-note">${icon('i-alert')}<span>${esc(w)}</span></p>`).join('');
    const order = item.kind === 'pdf' ? item.pageOrder : item.docxPages.map((_, i) => i);
    body.innerHTML = notes + order.map((p, pos) => `
      <figure class="preview-page" data-pos="${pos}" data-page="${p}">
        <div class="placeholder"><span class="spinner" aria-hidden="true"></span></div>
        <figcaption class="preview-caption">Side ${pos + 1} af ${order.length}${item.kind === 'pdf' && p !== pos ? ` (oprindelig side ${p + 1})` : ''}</figcaption>
      </figure>`).join('');

    const figures = [...body.querySelectorAll('.preview-page')];
    const width = Math.min(820, body.clientWidth - 40);
    const draw = async (fig) => {
      const p = Number(fig.dataset.page);
      try {
        let node;
        if (item.kind === 'pdf') {
          node = await renderPdfPageCanvas(item, p, width);
          node.style.width = `${width}px`;
        } else {
          const url = URL.createObjectURL(item.docxPages[p].blob);
          previewUrls.push(url);
          node = new Image();
          node.src = url;
          node.alt = `Side ${p + 1}`;
        }
        if (token !== previewToken) return;
        fig.querySelector('.placeholder').replaceWith(node);
      } catch (err) {
        if (token !== previewToken) return;
        fig.querySelector('.placeholder').textContent = 'Siden kunne ikke vises.';
      }
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        if (token === previewToken) draw(e.target);
      }
    }, { root: body, rootMargin: '600px' });
    figures.forEach((f) => io.observe(f));
    el.previewDialog.addEventListener('close', () => io.disconnect(), { once: true });
    if (startPos > 0 && figures[startPos]) figures[startPos].scrollIntoView({ block: 'start' });
  }

  el.previewDialog.addEventListener('close', closePreviewCleanup);
  el.previewDialog.addEventListener('click', (e) => {
    if (e.target === el.previewDialog || e.target.closest('[data-close]')) el.previewDialog.close();
  });

  /* ---------- Upload: knap, felt og træk ind fra Stifinder ---------- */
  el.pickBtn.addEventListener('click', (e) => { e.stopPropagation(); el.fileInput.click(); });
  el.dropzone.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', () => {
    addFiles(el.fileInput.files);
    el.fileInput.value = ''; // så den samme fil kan vælges igen
  });

  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    dragDepth++;
    el.dropOverlay.hidden = false;
    el.dropzone.classList.add('is-over');
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) { el.dropOverlay.hidden = true; el.dropzone.classList.remove('is-over'); }
  });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    el.dropOverlay.hidden = true;
    el.dropzone.classList.remove('is-over');
    addFiles(e.dataTransfer.files);
  });

  /* ---------- Øvrige knapper ---------- */
  el.buildBtn.addEventListener('click', build);
  el.clearBtn.addEventListener('click', () => clearAll(true));
  el.restartBtn.addEventListener('click', () => {
    state.items.forEach(disposeItem);
    state.items = [];
    setResult(null);
    render();
    announce('Klar til en ny samling.');
    el.pickBtn.focus();
  });
  for (const input of [el.optSize, el.optOrientation, el.optFit, el.optMargin, el.optName]) {
    input.addEventListener('change', () => { if (state.result) { setResult(null); render(); } });
  }
  el.optName.addEventListener('blur', () => { el.optName.value = readSettings().filename; });

  /* ---------- 9) Opstart ---------- */
  render();
  loadLib('pdfLib').catch(showLibBanner);
  loadLib('pdfjs').catch(() => {}); // kun til miniaturer – fejl vises, når det er relevant
})();
