// Kategorier og automatisk kategorisering – kører helt lokalt og kan altid forklares.
//
// Hver kategori har en "kind", som styrer beregningerne (se analytics.js):
//   income   – indtægt          expense – forbrug
//   savings  – opsparing/investering (tælles ikke som forbrug som standard)
//   transfer – intern overførsel/kreditkortbetaling (udelukkes fra indtægt og forbrug)
//
// Rækkefølge ved kategorisering:
//   1. Manuelt valgt kategori røres aldrig automatisk.
//   2. Brugerens egne regler (laveste prioritetstal først).
//   3. Indbyggede regler. Sikre match (fx NETFLIX) giver kilden "default";
//      usikre match (fx "OK", "OVERFØRSEL") giver kun et forslag ("suggested"), som skal kontrolleres.
//   4. Ellers "Ukendt / skal kategoriseres".

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});

  const UNKNOWN_ID = 'other-unknown';

  // [id, navn, kind, farve, ikon, [[id, navn, kind?, ikon?]]]
  const GROUPS = [
    ['income', 'Indtægter', 'income', '#16a34a', 'income', [
      ['salary', 'Løn'], ['benefits', 'SU og offentlige ydelser'], ['pension', 'Pension'], ['refunds', 'Tilbagebetalinger'],
      ['interest', 'Renter og afkast'], ['other', 'Andre indtægter']]],
    ['housing', 'Bolig', 'expense', '#6366f1', 'home', [
      ['rent', 'Husleje eller boligafgift'], ['mortgage', 'Realkredit og boliglån'], ['electricity', 'El'], ['heating', 'Varme'],
      ['water', 'Vand'], ['internet', 'Internet'], ['maintenance', 'Vedligeholdelse'], ['insurance', 'Forsikring']]],
    ['food', 'Mad og dagligvarer', 'expense', '#f59e0b', 'cart', [
      ['groceries', 'Supermarked'], ['takeaway', 'Takeaway og levering'], ['restaurant', 'Restaurant og café'],
      ['canteen', 'Kantine'], ['snacks', 'Snacks og drikkevarer']]],
    ['transport', 'Transport og bil', 'expense', '#0ea5e9', 'car', [
      ['fuel', 'Brændstof og opladning'], ['carins', 'Bilforsikring'], ['repair', 'Værksted og vedligeholdelse'], ['carwash', 'Bilvask'],
      ['parking', 'Parkering og vejafgifter'], ['public', 'Offentlig transport'], ['taxi', 'Taxi og samkørsel'], ['bike', 'Cykel og andet transportudstyr']]],
    ['shopping', 'Hverdag og shopping', 'expense', '#ec4899', 'bag', [
      ['clothes', 'Tøj og sko'], ['electronics', 'Elektronik'], ['home', 'Boligudstyr'], ['care', 'Personlig pleje'], ['hair', 'Frisør'],
      ['gifts', 'Gaver'], ['hobby', 'Hobby og fritid'], ['games', 'Spil og underholdning']]],
    ['subs', 'Abonnementer og kommunikation', 'expense', '#8b5cf6', 'play', [
      ['streaming', 'Streaming'], ['phone', 'Telefon'], ['internet', 'Internet'], ['software', 'Software og apps'], ['memberships', 'Medlemskaber']]],
    ['family', 'Familie og sundhed', 'expense', '#14b8a6', 'heart', [
      ['kids', 'Børn'], ['pets', 'Kæledyr'], ['pharmacy', 'Medicin og apotek'], ['dental', 'Tandlæge og behandling'], ['sport', 'Træning og sport']]],
    ['finance', 'Økonomi', 'expense', '#64748b', 'bank', [
      ['insurance', 'Forsikringer'], ['fees', 'Bankgebyrer'], ['interest', 'Renter og låneomkostninger'], ['tax', 'Skat'],
      ['savings', 'Opsparing', 'savings'], ['investment', 'Investering', 'savings'], ['debt', 'Afdrag på gæld']]],
    ['travel', 'Rejser og oplevelser', 'expense', '#f97316', 'plane', [
      ['holiday', 'Ferie'], ['hotels', 'Hoteller'], ['flights', 'Fly og tog'], ['experiences', 'Oplevelser'], ['cinema', 'Biograf og koncerter']]],
    ['other', 'Andre poster', 'expense', '#94a3b8', 'dots', [
      ['cash', 'Kontanthævning'], ['mobilepay', 'MobilePay', null, 'phone'], ['transfer', 'Interne overførsler', 'transfer'], ['creditcard', 'Betaling af kreditkort', 'transfer'],
      ['unknown', 'Ukendt / skal kategoriseres'], ['misc', 'Diverse']]],
  ];

  const ICONS = ['income', 'home', 'cart', 'car', 'bag', 'play', 'heart', 'bank', 'plane', 'dots', 'gift', 'paw', 'bolt', 'phone', 'coffee', 'piggy', 'tag', 'star'];
  const COLORS = ['#16a34a', '#6366f1', '#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b', '#f97316', '#94a3b8', '#ef4444', '#84cc16', '#06b6d4', '#a855f7', '#eab308', '#0f766e'];

  function defaultCategories() {
    const out = [];
    GROUPS.forEach(([gid, gname, gkind, color, icon, subs], gi) => {
      out.push({ id: gid, name: gname, parentId: null, kind: gkind, color, icon, hidden: false, order: gi, builtin: true });
      subs.forEach(([sid, sname, skind, sicon], si) => {
        out.push({ id: gid + '-' + sid, name: sname, parentId: gid, kind: skind || gkind, color, icon: sicon || icon, hidden: false, order: si, builtin: true });
      });
    });
    return out;
  }

  // [kategori, sikkerhed, fortegn, nøgleord adskilt af |]
  //  sikkerhed: high = sikkert match, low = kun forslag.   fortegn: out = udgift, in = indtægt, any
  const BUILTIN = [
    ['income-salary', 'high', 'in', 'LØN|LOEN|LØNOVERFØRSEL|LØNINDBETALING|LØNUDBETALING|SALARY|PAYROLL'],
    ['income-benefits', 'high', 'in', 'SU|UDBETALING DANMARK|BØRNECHECK|BØRNE- OG UNGEYDELSE|BOLIGSTØTTE|DAGPENGE|A-KASSE|KONTANTHJÆLP'],
    ['income-pension', 'high', 'in', 'PENSION|ATP|FOLKEPENSION'],
    ['income-refunds', 'high', 'in', 'OVERSKYDENDE SKAT|SKATTESTYRELSEN|SKAT|REFUSION|TILBAGEBETALING'],
    ['income-interest', 'high', 'in', 'RENTE|RENTER|UDBYTTE'],
    ['finance-tax', 'high', 'out', 'RESTSKAT|SKATTESTYRELSEN|SKAT'],
    ['food-groceries', 'high', 'out', 'NETTO|REMA 1000|REMA1000|FØTEX|FOETEX|BILKA|LIDL|ALDI|MENY|SPAR|KVICKLY|SUPERBRUGSEN|DAGLI\'BRUGSEN|DAGLI BRUGSEN|COOP 365|COOP365|IRMA|LØVBJERG|ABC LAVPRIS|MIN KØBMAND|NEMLIG|NEMLIG.COM|LETKØB|FAKTA|SALLING'],
    ['food-takeaway', 'high', 'out', 'WOLT|JUST EAT|JUSTEAT|HUNGRY|FOODORA|DOMINOS|DOMINO\'S|PIZZA HUT'],
    ['food-restaurant', 'low', 'out', 'MCDONALDS|MC DONALDS|MCDONALD\'S|BURGER KING|SUNSET BOULEVARD|MAX BURGERS|STARBUCKS|JOE & THE JUICE|JOE AND THE JUICE|LAGKAGEHUSET|BAGERI|RESTAURANT|CAFE|CAFÉ|ESPRESSO HOUSE|BAREN'],
    ['food-canteen', 'high', 'out', 'KANTINE|CANTEEN'],
    ['food-snacks', 'low', 'out', '7-ELEVEN|7 ELEVEN|KIOSK'],
    ['transport-fuel', 'high', 'out', 'CIRCLE K|Q8|SHELL|INGO|UNO-X|F24|OK PLUS|IONITY|CLEVER|E.ON DRIVE|TESLA SUPERCHARGER|SPIRII|MONTA|ALLEGO'],
    ['transport-fuel', 'low', 'out', 'OK|BENZIN|TANKSTATION'],
    ['transport-parking', 'high', 'out', 'EASYPARK|PARKMAN|APCOA|ONEPARK|BROBIZZ|STOREBÆLT|STOREBAELT|ØRESUNDSBRON|SUND & BÆLT|PARKERING'],
    ['transport-public', 'high', 'out', 'DSB|REJSEKORT|MOVIA|MIDTTRAFIK|FYNBUS|METRO|NT NORDJYLLANDS|ARRIVA|SYDTRAFIK|LETBANEN'],
    ['transport-taxi', 'high', 'out', 'UBER|TAXA|DANTAXI|BOLT|TAXI'],
    ['transport-carwash', 'high', 'out', 'BILVASK|WASH WORLD|SPEEDWASH|SPEED WASH'],
    ['transport-repair', 'low', 'out', 'AUTOVÆRKSTED|VÆRKSTED|DÆKCENTER|EUROMASTER|SYNSHAL|APPLUS'],
    ['subs-streaming', 'high', 'out', 'NETFLIX|NETFLIX.COM|SPOTIFY|HBO|HBO MAX|MAX.COM|DISNEY PLUS|DISNEYPLUS|DISNEY+|VIAPLAY|TV 2 PLAY|TV2 PLAY|YOUTUBE PREMIUM|SKYSHOWTIME|DR+|MOFIBO|STORYTEL|PODIMO|NEXTORY|APPLE MUSIC'],
    ['subs-phone', 'high', 'out', 'TELMORE|TELIA|TELENOR|CBB|LEBARA|OISTER|CALL ME|CALLME|EESY|LALOG'],
    ['subs-internet', 'high', 'out', 'STOFA|WAOO|HIPER|FASTSPEED|KVIKNET|FULLRATE'],
    ['subs-internet', 'low', 'out', 'YOUSEE|NORLYS'],
    ['subs-software', 'high', 'out', 'MICROSOFT|ADOBE|DROPBOX|ICLOUD|OPENAI|CHATGPT|GOOGLE STORAGE|GOOGLE ONE|1PASSWORD|NOTION'],
    ['subs-software', 'low', 'out', 'APPLE.COM/BILL|APPLE.COM|GOOGLE|GOOGLE PLAY'],
    ['housing-electricity', 'high', 'out', 'ANDEL ENERGI|ØRSTED|ORSTED|EWII|VINDSTØD|ELSELSKAB|NORLYS EL|RADIUS|CERIUS|N1'],
    ['housing-heating', 'high', 'out', 'FJERNVARME|VARMEVÆRK|VARMEVAERK|NATURGAS|EVIDA'],
    ['housing-water', 'high', 'out', 'VANDVÆRK|VANDVAERK|VANDSELSKAB|AARHUS VAND|NOVAFOS|BIOFOS|VANDFORSYNING'],
    ['housing-water', 'low', 'out', 'HOFOR'],
    ['housing-rent', 'high', 'out', 'HUSLEJE|BOLIGAFGIFT|BOLIGFORENING|ANDELSBOLIGFORENING|BOLIGSELSKAB'],
    ['housing-mortgage', 'high', 'out', 'TOTALKREDIT|NYKREDIT|REALKREDIT DANMARK|BRF KREDIT|DLR KREDIT|REALKREDIT'],
    ['housing-maintenance', 'low', 'out', 'BAUHAUS|SILVAN|HARALD NYBORG|JEM & FIX|JEM OG FIX|STARK|XL-BYG|FLÜGGER|FLUGGER'],
    ['finance-insurance', 'high', 'out', 'TRYG|TOPDANMARK|ALM. BRAND|ALM BRAND|CODAN|GJENSIDIGE|IF FORSIKRING|LB FORSIKRING|FORSIKRING'],
    ['finance-fees', 'high', 'out', 'GEBYR|KORTGEBYR|ÅRSGEBYR|KONTOGEBYR|OVERTRÆKSRENTE'],
    ['finance-interest', 'low', 'out', 'RENTE|RENTER'],
    ['finance-savings', 'low', 'out', 'OPSPARING|BØRNEOPSPARING|BUDGETKONTO'],
    ['finance-investment', 'high', 'out', 'NORDNET|SAXO|AKTIESPAREKONTO'],
    ['finance-debt', 'low', 'out', 'AFDRAG|ANYDAY|VIABILL|KLARNA|RESURS'],
    ['shopping-care', 'high', 'out', 'MATAS|NORMAL|SAVERS'],
    ['shopping-hair', 'high', 'out', 'FRISØR|FRISOR|BARBER|HAIR'],
    ['shopping-clothes', 'high', 'out', 'H&M|ZALANDO|ZARA|BOOZT|VERO MODA|JACK & JONES|ONLY|DEICHMANN|SKORINGEN|NAME IT|BESTSELLER|UNIQLO|PRIMARK'],
    ['shopping-clothes', 'low', 'out', 'MAGASIN|INTERSPORT|SPORT 24|SPORTMASTER'],
    ['shopping-electronics', 'high', 'out', 'ELGIGANTEN|POWER|PROSHOP|KOMPLETT|APPLE STORE|FONA|EXPERT'],
    ['shopping-home', 'high', 'out', 'IKEA|JYSK|SØSTRENE GRENE|FLYING TIGER|TIGER|ILVA|BOLIA|IMERCO|BAHNE'],
    ['shopping-games', 'high', 'out', 'STEAM|STEAMGAMES|PLAYSTATION|XBOX|NINTENDO|EPIC GAMES'],
    ['shopping-hobby', 'low', 'out', 'PANDURO|BOG & IDÉ|BOG & IDE|ARK BOGHANDEL|SAXO.COM|ADLIBRIS'],
    ['shopping-gifts', 'low', 'out', 'GAVE|GAVEKORT|INTERFLORA|BLOMSTER'],
    ['family-kids', 'high', 'out', 'BR LEGETØJ|LEGEKÆDEN|VUGGESTUE|BØRNEHAVE|SFO|DAGPLEJE|PASNINGSORDNING|BABYSAM'],
    ['family-pets', 'high', 'out', 'MAXI ZOO|DYRLÆGE|DYRLAEGE|PETWORLD|PET WORLD|DYREKLINIK|AGRIA'],
    ['family-pharmacy', 'high', 'out', 'APOTEK|APOTEKET|APOTEKERNE'],
    ['family-dental', 'high', 'out', 'TANDLÆGE|TANDLAEGE|TANDKLINIK|FYSIOTERAPI|FYSIOTERAPEUT|KIROPRAKTOR|PSYKOLOG|OPTIKER|SYNOPTIK|PROFIL OPTIK'],
    ['family-sport', 'high', 'out', 'FITNESS WORLD|FITNESS DK|SATS|PUREGYM|LOOP FITNESS|FITNESS|SPORTSKLUB|BOLDKLUB|CROSSFIT'],
    ['travel-hotels', 'high', 'out', 'HOTEL|HOTELS.COM|BOOKING.COM|AIRBNB|SCANDIC|COMWELL|ZLEEP|CABINN|EXPEDIA'],
    ['travel-holiday', 'high', 'out', 'SPIES|TUI|APOLLO|BRAVO TOURS|NOVASOL|DANCENTER|CAMPING'],
    ['travel-flights', 'high', 'out', 'SAS|NORWEGIAN|RYANAIR|EASYJET|LUFTHANSA|KLM|WIZZ AIR|FLYBILLET|SJ AB'],
    ['travel-experiences', 'high', 'out', 'TIVOLI|LEGOLAND|BAKKEN|ZOOLOGISK HAVE|KØBENHAVNS ZOO|DEN BLÅ PLANET|LALANDIA|EXPERIMENTARIUM'],
    ['travel-cinema', 'high', 'out', 'NORDISK FILM|BIOGRAF|KINO|CINEMAXX|TICKETMASTER|BILLETLUGEN|BILLETNET|BIO '],
    // MobilePay-betalinger ud. Står efter butiksreglerne, så "MobilePay NETTO" stadig bliver Supermarked,
    // men før overførselsreglerne, så "MobilePay Overførsel" ikke bliver en intern overførsel.
    ['other-mobilepay', 'high', 'out', 'MOBILEPAY|MOBILE PAY|MOBILEPAY MYSHOP|MOBILEPAY BOX'],
    ['other-cash', 'high', 'out', 'HÆVNING|HAEVNING|KONTANTHÆVNING|PENGEAUTOMAT|GELDAUTOMAT|ATM|KONTANT'],
    ['other-creditcard', 'low', 'any', 'KREDITKORT|MASTERCARD BETALING|BETALING AF KORT|KORTAFREGNING|AFREGNING KREDITKORT'],
    ['other-transfer', 'low', 'any', 'OVERFØRSEL|OVERFORSEL|OVERF.|EGEN KONTO|FRA KONTO|TIL KONTO|EGENOVERFØRSEL'],
  ];

  const WORD = 'A-Z0-9ÆØÅÄÖÜÉ';
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function wordRe(kw) {
    return new RegExp('(?:^|[^' + WORD + '])' + reEsc(kw) + '(?=$|[^' + WORD + '])');
  }

  const BUILTIN_RULES = BUILTIN.map(([categoryId, confidence, sign, words], i) => ({
    id: 'builtin-' + i, categoryId, confidence, sign, keywords: words.split('|'),
    re: new RegExp(words.split('|').map((w) => '(?:^|[^' + WORD + '])' + reEsc(w) + '(?=$|[^' + WORD + '])').join('|')),
  }));

  // --- Normalisering af bankens tekst ------------------------------------------

  const PREFIXES = /^(?:(?:DANKORT|VISA|MASTERCARD|MC|MAESTRO)(?:[-/ ](?:DANKORT|KØB|KOB|NOTA))*|KORTKØB|KØB|NOTA|DK-NOTA|DANKORT-NOTA|VISA\/DANKORT|BS BETALING|BETALINGSSERVICE|PBS|LS BETALING)[\s:-]+/;
  function normalizeDescription(s) {
    let t = String(s == null ? '' : s).toUpperCase().replace(/\s+/g, ' ').trim();
    for (let i = 0; i < 3; i++) { const n = t.replace(PREFIXES, ''); if (n === t) break; t = n; }
    t = t
      .replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, ' ')
      .replace(/\b(?:X{2,}|\*+)\d*\b/g, ' ')
      .replace(/\b(?:KORT|KORTNR|NR|REF)\.?\s*\d+\b/g, ' ')
      .replace(/\b\d{5,}\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
    return t || String(s || '').toUpperCase().trim();
  }

  // Kort nøgle for "samme betalingsmodtager" (bruges til faste betalinger og regelforslag).
  function merchantKey(s) {
    const t = normalizeDescription(s).replace(/[0-9]/g, ' ').replace(/[^A-ZÆØÅÄÖÜÉ&+.' ]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = t.split(' ').filter((w) => w.length > 1 || w === '&');
    return words.slice(0, 3).join(' ');
  }
  function suggestKeyword(s) {
    const words = merchantKey(s).split(' ').filter(Boolean);
    if (!words.length) return normalizeDescription(s).slice(0, 30);
    return words[0].length >= 4 || words.length === 1 ? words[0] : words.slice(0, 2).join(' ');
  }

  // --- Regler ------------------------------------------------------------------

  const signOk = (sign, amount) => sign === 'any' || !sign || (sign === 'in' ? amount > 0 : amount < 0);

  function ruleMatches(rule, tx) {
    if (!rule.active || !rule.keyword) return false;
    if (rule.accountId && rule.accountId !== tx.accountId) return false;
    if (!signOk(rule.sign, tx.amount)) return false;
    const text = tx.descriptionNormalized || normalizeDescription(tx.descriptionOriginal);
    const orig = String(tx.descriptionOriginal || '').toUpperCase();
    const kw = String(rule.keyword).toUpperCase().trim();
    switch (rule.matchType) {
      case 'equals': return text === normalizeDescription(kw) || orig.trim() === kw;
      case 'startsWith': return text.startsWith(kw) || orig.startsWith(kw);
      case 'word': return wordRe(kw).test(text) || wordRe(kw).test(orig);
      default: return text.includes(kw) || orig.includes(kw);
    }
  }

  function sortRules(rules) {
    return rules.slice().sort((a, b) => (a.priority || 0) - (b.priority || 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  // ctx: { rules (brugerens, sorteret), disabledBuiltin: Set, categories: Map }
  // Returnerer kun forslaget – kalderen beslutter, om det må overskrive noget.
  function suggest(tx, ctx) {
    const cats = ctx.categories;
    for (const r of ctx.rules) {
      if (ruleMatches(r, tx) && (!cats || cats.has(r.categoryId))) {
        return { categoryId: r.categoryId, categorySource: 'rule', categoryRuleId: r.id, reason: 'Din regel "' + (r.name || r.keyword) + '"' };
      }
    }
    const text = tx.descriptionNormalized || normalizeDescription(tx.descriptionOriginal);
    // Penge retur fra en butik (fx "H&M RETUR") hører til butikkens kategori som refusion.
    const isReturn = tx.amount > 0 && /(^|[^A-ZÆØÅ])(RETUR|RETURNERING|REFUSION|REFUND|TILBAGEFØRSEL|TILBAGEFORSEL)/.test(text);
    for (const r of BUILTIN_RULES) {
      if (ctx.disabledBuiltin && ctx.disabledBuiltin.has(r.id)) continue;
      if (!(signOk(r.sign, tx.amount) || (isReturn && r.sign === 'out')) || !r.re.test(text)) continue;
      if (cats && (!cats.has(r.categoryId) || cats.get(r.categoryId).deleted)) continue;
      const kw = r.keywords.find((k) => wordRe(k).test(text));
      return {
        categoryId: r.categoryId,
        categorySource: r.confidence === 'high' ? 'default' : 'suggested',
        categoryRuleId: r.id,
        reason: (r.confidence === 'high' ? 'Indbygget regel: teksten indeholder "' : 'Usikkert forslag: teksten indeholder "') + kw + '"',
      };
    }
    return { categoryId: UNKNOWN_ID, categorySource: 'unknown', categoryRuleId: null, reason: 'Ingen regel passede' };
  }

  // Kategoriserer en transaktion på stedet. Manuelle valg bevares, medmindre overwriteManual.
  // Returnerer true, hvis noget blev ændret.
  function categorize(tx, ctx, opts) {
    if (tx.categorySource === 'manual' && !(opts && opts.overwriteManual)) return false;
    const s = suggest(tx, ctx);
    if (tx.categoryId === s.categoryId && tx.categorySource === s.categorySource && tx.categoryRuleId === s.categoryRuleId) return false;
    tx.categoryId = s.categoryId;
    tx.categorySource = s.categorySource;
    tx.categoryRuleId = s.categoryRuleId;
    tx.categoryReason = s.reason;
    return true;
  }

  function makeContext(rules, categories, disabledBuiltin) {
    return {
      rules: sortRules((rules || []).filter((r) => r.active)),
      categories: new Map((categories || []).map((c) => [c.id, c])),
      disabledBuiltin: new Set(disabledBuiltin || []),
    };
  }

  const SOURCE_LABEL = {
    manual: 'Valgt af dig', rule: 'Din regel', default: 'Indbygget regel', suggested: 'Forslag – kontrollér', unknown: 'Ikke kategoriseret',
  };

  GB.categories = {
    UNKNOWN_ID, GROUPS, ICONS, COLORS, BUILTIN_RULES, SOURCE_LABEL,
    defaultCategories, normalizeDescription, merchantKey, suggestKeyword,
    ruleMatches, sortRules, suggest, categorize, makeContext,
  };
})();
