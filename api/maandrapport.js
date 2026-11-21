// api/maandrapport.js — maandelijkse e-mail met de stand van je portefeuille.
//
//  • Cron (Vercel, de 1e van de maand): GET met "Authorization: Bearer <CRON_SECRET>"
//    → stuurt iedereen die niet uitgeschreven is een rapport over de vorige maand.
//  • ?actie=voorbeeld (POST, met het Supabase-toegangstoken van de ingelogde
//    gebruiker) → stuurt enkel die gebruiker zijn eigen rapport, naar zijn eigen adres.
//  • ?actie=uitschrijven&u=<id>&t=<handtekening> (GET of POST) → zet het
//    maandrapport uit. POST = "one-click" uitschrijven vanuit de mailapp.
//
// Nodig in Vercel: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET
// (optioneel MAIL_AFZENDER, standaard "Kapitas <maandrapport@kapitas.be>").
const crypto = require('crypto');

const SUPA_URL = 'https://drdzcmxgqmohulngpgvk.supabase.co';
const SUPA_PUBLIEK = 'sb_publishable_Qpwzpsuy0Ed70CSBFu7Kug_BZFsZzrW';
const SITE = 'https://www.kapitas.be';
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

const geheimeSleutel = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const afzender = () => process.env.MAIL_AFZENDER || 'Kapitas <maandrapport@kapitas.be>';

// ───────────────────────── Supabase (server, met geheime sleutel) ─────────────────────────
const supaHeaders = () => {
  const k = geheimeSleutel();
  const h = { apikey: k, 'Content-Type': 'application/json' };
  if (k.startsWith('eyJ')) h.Authorization = `Bearer ${k}`; // oude service_role-JWT
  return h;
};
async function supa(pad, opties = {}) {
  const r = await fetch(SUPA_URL + pad, { ...opties, headers: { ...supaHeaders(), ...(opties.headers || {}) } });
  if (!r.ok) throw new Error(`Supabase ${pad.split('?')[0]}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
async function alleGebruikers() {
  const lijst = [];
  for (let p = 1; p <= 50; p++) {
    const d = await supa(`/auth/v1/admin/users?page=${p}&per_page=1000`);
    const u = d.users || [];
    lijst.push(...u);
    if (u.length < 1000) break;
  }
  return lijst;
}
async function zetMetadata(id, extra) {
  const u = await supa(`/auth/v1/admin/users/${id}`);
  return supa(`/auth/v1/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ user_metadata: { ...(u.user_metadata || {}), ...extra } }) });
}

// ───────────────────────── Uitschrijflink ─────────────────────────
const handtekening = (id) => crypto.createHmac('sha256', geheimeSleutel()).update('uitschrijven:' + id).digest('hex').slice(0, 32);
const uitschrijfUrl = (id) => `${SITE}/api/maandrapport?actie=uitschrijven&u=${id}&t=${handtekening(id)}`;
const geldig = (id, t) => {
  if (!id || !t || !geheimeSleutel()) return false;
  const a = Buffer.from(handtekening(id)), b = Buffer.from(String(t));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// ───────────────────────── Koersen (Yahoo, slotkoersen per dag) ─────────────────────────
const CRYPTO = new Set(['BTC','ETH','XRP','ADA','SOL','DOT','DOGE','MATIC','LINK','UNI','AVAX','ATOM','LTC','BCH','XLM','ALGO','VET','FIL','TRX','EOS','XMR','ETC','AAVE','COMP','MKR','SNX','CRV','SUSHI','YFI','1INCH']);
function yahooSymbool(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (/-USD$|-EUR$|-USDT$/.test(s)) return s;
  if (CRYPTO.has(s)) return s + '-USD';
  if (s.startsWith('BINANCE:') || s.startsWith('COINBASE:')) return s.split(':')[1].replace('USDT', '').replace('USD', '').replace('EUR', '') + '-USD';
  return symbol;
}
// Subeenheden: Britse pence, Zuid-Afrikaanse cent, Israëlische agora
const SUB = { GBP: ['GBp', 'GBX'], ZAR: ['ZAc'], ILS: ['ILA'] };
const normaliseer = (munt) => {
  for (const [basis, subs] of Object.entries(SUB)) if (subs.includes(munt)) return { munt: basis, deler: 100 };
  return { munt: String(munt || 'EUR').toUpperCase(), deler: 1 };
};
// +12u: Europese slotkoersen staan op middernacht lokale tijd = vorige dag in UTC
const dag = (ts) => new Date((ts + 43200) * 1000).toISOString().slice(0, 10);

async function reeks(sym) {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=2y&interval=1d`, { headers: UA });
    const x = (await r.json())?.chart?.result?.[0];
    if (!x) return null;
    const { munt, deler } = normaliseer(x.meta?.currency);
    const t = x.timestamp || [], c = x.indicators?.quote?.[0]?.close || [];
    const punten = [];
    t.forEach((ts, i) => { if (c[i] > 0) punten.push([dag(ts), c[i] / deler]); });
    return { munt, punten };
  } catch (e) { return null; }
}
const opDatum = (r, datum) => {
  let k = null;
  for (const [d, v] of r?.punten || []) { if (d <= datum) k = v; else break; }
  return k;
};
async function inGroepjes(items, n, f) {
  const uit = [];
  for (let i = 0; i < items.length; i += n) uit.push(...await Promise.all(items.slice(i, i + n).map(f)));
  return uit;
}

// ───────────────────────── Berekening ─────────────────────────
// Periode = de vorige kalendermaand (of de lopende, bij een voorbeeld vóór de 2e)
function periode(nu = new Date()) {
  const j = nu.getUTCFullYear(), m = nu.getUTCMonth();
  const eind = new Date(Date.UTC(j, m, 0));          // laatste dag vorige maand
  const start = new Date(Date.UTC(j, m - 1, 0));     // laatste dag van de maand daarvoor
  const jaarStart = new Date(Date.UTC(eind.getUTCFullYear() - 1, 11, 31)); // 31/12 van vorig jaar
  return { start: start.toISOString().slice(0, 10), eind: eind.toISOString().slice(0, 10), jaarStart: jaarStart.toISOString().slice(0, 10), maand: eind.getUTCMonth(), jaar: eind.getUTCFullYear(), sleutel: eind.toISOString().slice(0, 7) };
}

async function haalMarktdata(rijen, p) {
  const symbolen = [...new Set(rijen.flatMap(r => (r.beleggingen || []).map(b => b.symbol)).filter(Boolean))];
  const koersen = {};
  // Maatstaf: MSCI World in euro (zelfde als de bèta op de Analyse-pagina)
  const [bench] = await Promise.all([reeks('IWDA.AS'), inGroepjes(symbolen, 8, async (s) => { koersen[s] = await reeks(yahooSymbool(s)); })]);
  const munten = new Set();
  Object.values(koersen).forEach(k => k && munten.add(k.munt));
  rijen.forEach(r => (r.beleggingen || []).forEach(b => munten.add(normaliseer(b.munt).munt)));
  munten.delete('EUR');
  const fx = { EUR: null };
  await inGroepjes([...munten], 8, async (m) => { fx[m] = await reeks(`EUR${m}=X`); });
  // bedrag in munt m op datum d → euro
  const naarEur = (bedrag, m, d) => {
    if (m === 'EUR') return bedrag;
    const k = opDatum(fx[m], d) || fx[m]?.punten?.[0]?.[1];
    return k ? bedrag / k : null;
  };
  const benchRend = (van, tot) => { const a = opDatum(bench, van), b = opDatum(bench, tot); return a && b ? b / a - 1 : null; };
  return { koersen, naarEur, benchRend };
}

// Maand + sinds 1 januari + de wereldmarkt over dezelfde periodes
function volledigRapport(rijen, namen, markt, p) {
  const maand = rapportVoor(rijen, namen, markt, p);
  const jaar = rapportVoor(rijen, namen, markt, { ...p, start: p.jaarStart });
  return { ...maand, jaar: { winst: jaar.winst, pct: jaar.pct }, markt: { maand: markt.benchRend(p.start, p.eind), jaar: markt.benchRend(p.jaarStart, p.eind) } };
}

// Rapport van één gebruiker: waarde op het einde van de maand en het resultaat
// door koersbewegingen in die maand (bijkopen tellen mee vanaf de aankoopprijs).
function rapportVoor(rijen, portfolioNamen, markt, p) {
  const perPortfolio = [], perSymbool = {};
  let waarde = 0, begin = 0, winst = 0, zonderKoers = 0;
  for (const rij of rijen) {
    let pw = 0, pb = 0, pwinst = 0;
    for (const b of rij.beleggingen || []) {
      const aantal = Number(b.aantal) || 0;
      if (aantal <= 0 || (b.datum && b.datum > p.eind)) continue;
      const k = markt.koersen[b.symbol];
      const slot = opDatum(k, p.eind);
      if (!k || !slot) { zonderKoers++; continue; }
      const eindEur = markt.naarEur(slot, k.munt, p.eind);
      let basisEur;
      if (!b.datum || b.datum <= p.start) {
        const s = opDatum(k, p.start);
        basisEur = s ? markt.naarEur(s, k.munt, p.start) : null;
      } else {
        const { munt, deler } = normaliseer(b.munt);
        basisEur = markt.naarEur((Number(b.kostprijs) || 0) / deler, munt, b.datum);
      }
      if (eindEur == null || basisEur == null) { zonderKoers++; continue; }
      const w = aantal * eindEur, bw = aantal * basisEur;
      pw += w; pb += bw; pwinst += w - bw;
      const ps = perSymbool[b.symbol] || (perSymbool[b.symbol] = { symbol: b.symbol, naam: b.naam || b.symbol, waarde: 0, begin: 0 });
      ps.waarde += w; ps.begin += bw;
    }
    if (pw > 0) perPortfolio.push({ naam: portfolioNamen[rij.portfolio_id] || 'Portefeuille', waarde: pw, winst: pwinst, pct: pb > 0 ? pwinst / pb : 0 });
    waarde += pw; begin += pb; winst += pwinst;
  }
  const symbolen = Object.values(perSymbool).filter(s => s.begin > 0).map(s => ({ ...s, winst: s.waarde - s.begin, pct: s.waarde / s.begin - 1 }));
  symbolen.sort((a, b) => b.pct - a.pct);
  const stijgers = symbolen.filter(s => s.pct > 0).slice(0, 3);
  const dalers = symbolen.filter(s => s.pct < 0).reverse().slice(0, 3);
  return { waarde, winst, pct: begin > 0 ? winst / begin : 0, perPortfolio, stijgers, dalers, aantal: symbolen.length, zonderKoers };
}

// ───────────────────────── Mail ─────────────────────────
const MAANDEN = {
  nl: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const TEKST = {
  nl: {
    locale: 'nl-BE', onderwerp: (m, pct) => `Je portefeuille in ${m}: ${pct}`, kop: (m, j) => `Maandrapport ${m} ${j}`,
    hallo: (n) => n ? `Hallo ${n},` : 'Hallo,', intro: (m) => `hier is je overzicht van ${m}.`,
    waarde: (d) => `Waarde op ${d}`, dezeMaand: 'Deze maand', ditJaar: 'Sinds 1 januari', wereld: 'Wereldmarkt',
    wereldUitleg: 'MSCI World, in euro',
    oordeel: (verschil, m) => Math.abs(verschil) < 0.003
      ? `Je portefeuille deed het in ${m} ongeveer even goed als de wereldwijde aandelenmarkt.`
      : `Je portefeuille deed het in ${m} ${pp(Math.abs(verschil), 'nl-BE')} ${verschil > 0 ? 'beter' : 'minder goed'} dan de wereldwijde aandelenmarkt.`,
    portefeuilles: 'Per portefeuille', stijgers: 'Grootste stijgers', dalers: 'Grootste dalers', knop: 'Open Kapitas',
    noot: (d) => `Op basis van de slotkoersen van ${d}, omgerekend naar euro. Het resultaat telt de koersbeweging van wat je op het einde van de maand bezat; aankopen tijdens de periode tellen vanaf je aankoopprijs. De wereldmarkt is de iShares Core MSCI World-ETF. Kapitas geeft geen beleggingsadvies.`,
    waarom: 'Je krijgt deze mail één keer per maand omdat je een account hebt bij Kapitas.', uit: 'Uitschrijven', inst: 'of pas het aan in Instellingen',
    voorbeeld: '[Voorbeeld] ',
    nieuw: (u) => `<strong>Nieuw bij Kapitas:</strong> elke maand een kort overzicht van je portefeuille in je mailbox. Liever niet? <a href="${u}" style="color:#1e3a8a;">Schrijf je met één klik uit</a>.`,
  },
  fr: {
    locale: 'fr-BE', onderwerp: (m, pct) => `Votre portefeuille en ${m} : ${pct}`, kop: (m, j) => `Rapport mensuel ${m} ${j}`,
    hallo: (n) => n ? `Bonjour ${n},` : 'Bonjour,', intro: (m) => `voici votre aperçu ${/^[aeiou]/.test(m) ? "d'" : 'de '}${m}.`,
    waarde: (d) => `Valeur au ${d}`, dezeMaand: 'Ce mois-ci', ditJaar: 'Depuis le 1er janvier', wereld: 'Marché mondial',
    wereldUitleg: 'MSCI World, en euros',
    oordeel: (verschil, m) => Math.abs(verschil) < 0.003
      ? `En ${m}, votre portefeuille a fait à peu près aussi bien que le marché mondial des actions.`
      : `En ${m}, votre portefeuille a fait ${pp(Math.abs(verschil), 'fr-BE')} ${verschil > 0 ? 'de mieux' : 'de moins'} que le marché mondial des actions.`,
    portefeuilles: 'Par portefeuille', stijgers: 'Plus fortes hausses', dalers: 'Plus fortes baisses', knop: 'Ouvrir Kapitas',
    noot: (d) => `Sur la base des cours de clôture du ${d}, convertis en euros. Le résultat reflète l'évolution des cours de ce que vous déteniez en fin de mois ; les achats de la période comptent à partir de votre prix d'achat. Le marché mondial est l'ETF iShares Core MSCI World. Kapitas ne fournit pas de conseil en investissement.`,
    waarom: 'Vous recevez cet e-mail une fois par mois parce que vous avez un compte Kapitas.', uit: 'Se désabonner', inst: 'ou modifiez-le dans les Paramètres',
    voorbeeld: '[Exemple] ',
    nieuw: (u) => `<strong>Nouveau chez Kapitas :</strong> chaque mois, un bref aperçu de votre portefeuille dans votre boîte mail. Vous préférez ne pas le recevoir ? <a href="${u}" style="color:#1e3a8a;">Désabonnez-vous en un clic</a>.`,
  },
  en: {
    locale: 'en-GB', onderwerp: (m, pct) => `Your portfolio in ${m}: ${pct}`, kop: (m, j) => `Monthly report ${m} ${j}`,
    hallo: (n) => n ? `Hi ${n},` : 'Hi,', intro: (m) => `here's your overview of ${m}.`,
    waarde: (d) => `Value on ${d}`, dezeMaand: 'This month', ditJaar: 'Year to date', wereld: 'World market',
    wereldUitleg: 'MSCI World, in euro',
    oordeel: (verschil, m) => Math.abs(verschil) < 0.003
      ? `In ${m}, your portfolio did about as well as the global stock market.`
      : `In ${m}, your portfolio did ${pp(Math.abs(verschil), 'en-GB')} ${verschil > 0 ? 'better' : 'worse'} than the global stock market.`,
    portefeuilles: 'Per portfolio', stijgers: 'Top risers', dalers: 'Top fallers', knop: 'Open Kapitas',
    noot: (d) => `Based on closing prices of ${d}, converted to euro. The result reflects price changes of what you held at month end; purchases during the period count from your purchase price. The world market is the iShares Core MSCI World ETF. Kapitas does not provide investment advice.`,
    waarom: 'You get this e-mail once a month because you have a Kapitas account.', uit: 'Unsubscribe', inst: 'or change it in Settings',
    voorbeeld: '[Preview] ',
    nieuw: (u) => `<strong>New at Kapitas:</strong> a short overview of your portfolio in your inbox every month. Rather not? <a href="${u}" style="color:#1e3a8a;">Unsubscribe in one click</a>.`,
  },
};
// Verschil in procentpunt, bv. "1,2 procentpunt"
function pp(x, locale) {
  const n = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(x * 100);
  return locale.startsWith('fr') ? `${n} point${x * 100 >= 2 ? 's' : ''} de pourcentage` : locale.startsWith('en') ? `${n} percentage point${n === '1.0' ? '' : 's'}` : `${n} procentpunt`;
}
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GROEN = '#15803d', ROOD = '#b91c1c', GROEN_BG = '#dcfce7', ROOD_BG = '#fee2e2', INKT = '#0f172a', GRIJS = '#64748b', LIJN = '#e5e7eb', BLAUW = '#1e3a8a';

// nieuw = de gebruiker zag de melding in de app nog niet: dan bovenaan uitleggen
// waarom deze mail komt en hoe je je uitschrijft
function maakMail({ r, p, taal = 'nl', voornaam = '', uitschrijf, voorbeeld = false, nieuw = false }) {
  const t = TEKST[taal] || TEKST.nl;
  const maand = (MAANDEN[taal] || MAANDEN.nl)[p.maand];
  const eur = (x) => new Intl.NumberFormat(t.locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(x);
  const pct = (x) => x == null ? '–' : (x > 0 ? '+' : x < 0 ? '−' : '') + new Intl.NumberFormat(t.locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(x));
  const metTeken = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + eur(Math.abs(x));
  const kleurVan = (x) => x == null || Math.abs(x) < 0.0005 ? GRIJS : x > 0 ? GROEN : ROOD;
  const datum = new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(p.eind + 'T12:00:00Z'));
  const link = `${SITE}/?utm_source=maandrapport&utm_medium=email`;
  const naam = (s) => { const n = s.naam || s.symbol; return n.length > 32 ? n.slice(0, 30) + '…' : n; };
  const label = (x) => `<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:13px;font-weight:700;white-space:nowrap;background:${x >= 0 ? GROEN_BG : ROOD_BG};color:${x >= 0 ? GROEN : ROOD};">${pct(x)}</span>`;

  // Drie kerncijfers naast elkaar
  const vakje = (titel, groot, klein, kleur, pad) => `<td width="33%" valign="top" style="padding:${pad};"><div style="border:1px solid ${LIJN};border-radius:12px;padding:12px 12px 11px;">
    <div style="font-size:12px;color:${GRIJS};margin-bottom:4px;white-space:nowrap;">${titel}</div>
    <div style="font-size:19px;font-weight:800;color:${kleur};letter-spacing:-.3px;white-space:nowrap;">${groot}</div>
    <div style="font-size:12px;color:${GRIJS};margin-top:2px;white-space:nowrap;">${klein}</div></div></td>`;
  const vakjes = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>
    ${vakje(esc(t.dezeMaand), pct(r.pct), metTeken(r.winst), kleurVan(r.pct), '0 4px 0 0')}
    ${vakje(esc(t.ditJaar), pct(r.jaar?.pct), r.jaar ? metTeken(r.jaar.winst) : '', kleurVan(r.jaar?.pct), '0 2px')}
    ${vakje(esc(t.wereld), pct(r.markt?.maand), esc(t.wereldUitleg), kleurVan(r.markt?.maand), '0 0 0 4px')}
  </tr></table>`;
  const oordeel = r.markt?.maand != null ? t.oordeel(r.pct - r.markt.maand, maand) : null;

  const lijst = (titel, items) => `<tr><td style="padding:22px 28px 0;">
    <div style="font-size:13px;font-weight:700;color:${INKT};margin-bottom:6px;">${titel}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items.map((x, i) => `<tr>
      <td style="padding:10px 0;${i ? `border-top:1px solid ${LIJN};` : ''}"><div style="font-size:14px;font-weight:600;color:${INKT};">${esc(x.links)}</div><div style="font-size:12px;color:${GRIJS};margin-top:1px;">${x.sub}</div></td>
      <td align="right" style="padding:10px 0;${i ? `border-top:1px solid ${LIJN};` : ''}">${label(x.pct)}</td></tr>`).join('')}</table></td></tr>`;

  let blokken = '';
  if (r.perPortfolio.length > 1) blokken += lijst(esc(t.portefeuilles), r.perPortfolio.map(x => ({ links: x.naam, sub: eur(x.waarde), pct: x.pct })));
  if (r.aantal >= 2 && r.stijgers.length) blokken += lijst('▲ ' + esc(t.stijgers), r.stijgers.map(s => ({ links: naam(s), sub: metTeken(s.winst), pct: s.pct })));
  if (r.aantal >= 2 && r.dalers.length) blokken += lijst('▼ ' + esc(t.dalers), r.dalers.map(s => ({ links: naam(s), sub: metTeken(s.winst), pct: s.pct })));

  const onderwerp = (voorbeeld ? t.voorbeeld : '') + t.onderwerp(maand, pct(r.pct));
  const html = `<!doctype html><html lang="${taal}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(onderwerp)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INKT};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(t.dezeMaand)}: ${pct(r.pct)} · ${esc(t.ditJaar)}: ${pct(r.jaar?.pct)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border-top:4px solid ${BLAUW};">
  <tr><td style="padding:20px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:20px;font-weight:800;color:${BLAUW};letter-spacing:-.4px;">Kapitas</td>
    <td align="right" style="font-size:13px;color:${GRIJS};">${esc(t.kop(maand, p.jaar))}</td></tr></table></td></tr>
  ${nieuw ? `<tr><td style="padding:16px 28px 0;"><div style="background:#eef2ff;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.55;color:#1e293b;">${t.nieuw(uitschrijf)}</div></td></tr>` : ''}
  <tr><td style="padding:22px 28px 0;">
    <div style="font-size:15px;color:#334155;margin-bottom:16px;">${esc(t.hallo(voornaam))} ${esc(t.intro(maand))}</div>
    <div style="font-size:13px;color:${GRIJS};">${esc(t.waarde(datum))}</div>
    <div style="font-size:36px;font-weight:800;letter-spacing:-1px;margin-top:2px;">${eur(r.waarde)}</div>
    ${vakjes}
    ${oordeel ? `<div style="margin-top:14px;font-size:14px;line-height:1.5;color:#334155;">${esc(oordeel)}</div>` : ''}
  </td></tr>
  ${blokken}
  <tr><td align="center" style="padding:28px 28px 6px;"><a href="${link}" style="display:inline-block;background:${BLAUW};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:10px;">${esc(t.knop)} →</a></td></tr>
  <tr><td style="padding:16px 28px 24px;font-size:11.5px;line-height:1.6;color:#94a3b8;">${esc(t.noot(datum))}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td style="padding:16px 28px;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
  ${esc(t.waarom)}<br><a href="${uitschrijf}" style="color:${GRIJS};">${esc(t.uit)}</a> ${esc(t.inst)}.
</td></tr></table>
</td></tr></table></body></html>`;

  const tekst = [
    ...(nieuw ? [t.nieuw(uitschrijf).replace(/<[^>]+>/g, '') + ' ' + uitschrijf, ''] : []),
    `${t.hallo(voornaam)} ${t.intro(maand)}`, '',
    `${t.waarde(datum)}: ${eur(r.waarde)}`,
    `${t.dezeMaand}: ${pct(r.pct)} (${metTeken(r.winst)})`,
    ...(r.jaar ? [`${t.ditJaar}: ${pct(r.jaar.pct)} (${metTeken(r.jaar.winst)})`] : []),
    ...(r.markt?.maand != null ? [`${t.wereld} (${t.wereldUitleg}): ${pct(r.markt.maand)}`] : []),
    ...(oordeel ? ['', oordeel] : []), '',
    ...(r.perPortfolio.length > 1 ? [t.portefeuilles + ':', ...r.perPortfolio.map(x => `- ${x.naam}: ${eur(x.waarde)} (${pct(x.pct)})`), ''] : []),
    ...(r.aantal >= 2 && r.stijgers.length ? [t.stijgers + ':', ...r.stijgers.map(s => `- ${naam(s)}: ${pct(s.pct)}`), ''] : []),
    ...(r.aantal >= 2 && r.dalers.length ? [t.dalers + ':', ...r.dalers.map(s => `- ${naam(s)}: ${pct(s.pct)}`), ''] : []),
    `${t.knop}: ${link}`, '', t.noot(datum), '', `${t.waarom} ${t.uit}: ${uitschrijf}`,
  ].join('\n');
  return { onderwerp, html, tekst };
}

// ───────────────────────── Versturen (Resend) ─────────────────────────
async function verstuur(mails, idSleutel) {
  const res = [];
  for (let i = 0; i < mails.length; i += 100) {
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', ...(idSleutel ? { 'Idempotency-Key': `${idSleutel}-${i}` } : {}) },
      body: JSON.stringify(mails.slice(i, i + 100)),
    });
    res.push({ status: r.status, body: await r.text() });
  }
  return res;
}
const mailObject = (aan, m, uitschrijf) => ({
  from: afzender(), to: [aan], subject: m.onderwerp, html: m.html, text: m.tekst,
  headers: { 'List-Unsubscribe': `<${uitschrijf}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
});

async function portefeuilleData(filterId) {
  const f = filterId ? `&user_id=eq.${filterId}` : '';
  const [rijen, namen] = await Promise.all([
    supa(`/rest/v1/holdings?select=user_id,portfolio_id,beleggingen${f}&limit=100000`),
    supa(`/rest/v1/portfolios?select=user_id,portfolio_id,naam${f}&limit=100000`),
  ]);
  const naamVan = {};
  namen.forEach(n => { naamVan[n.user_id + '|' + n.portfolio_id] = n.naam; });
  const perGebruiker = {};
  rijen.forEach(r => { (perGebruiker[r.user_id] ||= []).push(r); });
  return { rijen, perGebruiker, naamVan };
}
const namenVoor = (naamVan, id, rijen) => Object.fromEntries(rijen.map(r => [r.portfolio_id, naamVan[id + '|' + r.portfolio_id]]));
const taalVan = (u) => ['nl', 'fr', 'en'].includes(u.user_metadata?.taal) ? u.user_metadata.taal : 'nl';
// Enkel de portefeuilles die de gebruiker koos (Instellingen); geen keuze = allemaal
const gekozenRijen = (u, rijen) => {
  const keuze = u.user_metadata?.maandrapportPortfolios;
  if (!Array.isArray(keuze) || keuze.length === 0) return rijen;
  const gefilterd = rijen.filter(r => keuze.includes(r.portfolio_id));
  return gefilterd.length ? gefilterd : rijen;
};

// ───────────────────────── Handler ─────────────────────────
const pagina = (titel, tekst) => `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(titel)} – Kapitas</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;padding:24px;box-sizing:border-box;">
<div style="max-width:440px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#1e3a8a;margin-bottom:20px;">Kapitas</div>
<h1 style="font-size:24px;margin:0 0 12px;color:#0f172a;">${esc(titel)}</h1><p style="color:#64748b;line-height:1.6;margin:0 0 24px;">${tekst}</p>
<a href="${SITE}/" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;">Naar Kapitas</a></div></body></html>`;

module.exports = async function handler(req, res) {
  const actie = req.query.actie || 'cron';
  try {
    if (!geheimeSleutel()) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY ontbreekt' });

    // ── Uitschrijven (link in de mail of one-click vanuit de mailapp) ──
    if (actie === 'uitschrijven') {
      const { u, t } = req.query;
      if (!geldig(u, t)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(400).send(pagina('Ongeldige link', 'Deze uitschrijflink klopt niet. Je kan het maandrapport ook uitzetten in Kapitas, onder Instellingen.'));
      }
      await zetMetadata(u, { maandrapport: false });
      if (req.method === 'POST') return res.status(200).json({ ok: true });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(pagina('Je bent uitgeschreven', 'Je krijgt geen maandrapport meer. Wil je het toch terug? Zet het weer aan in Kapitas, onder Instellingen.'));
    }

    // ── Voorbeeld naar jezelf (ingelogde gebruiker) ──
    if (actie === 'voorbeeld') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Gebruik POST' });
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const ur = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: SUPA_PUBLIEK, Authorization: `Bearer ${token}` } });
      if (!ur.ok) return res.status(401).json({ error: 'Niet ingelogd' });
      const gebruiker = await ur.json();
      const vorige = Date.parse(gebruiker.user_metadata?.laatsteVoorbeeldMail || 0);
      if (Date.now() - vorige < 2 * 60 * 1000) return res.status(429).json({ error: 'Wacht even voor je opnieuw een voorbeeld vraagt.' });
      const p = periode();
      const { perGebruiker, naamVan } = await portefeuilleData(gebruiker.id);
      const rijen = gekozenRijen(gebruiker, perGebruiker[gebruiker.id] || []);
      const markt = await haalMarktdata(rijen, p);
      const r = volledigRapport(rijen, namenVoor(naamVan, gebruiker.id, rijen), markt, p);
      if (r.waarde <= 0) return res.status(200).json({ ok: false, reden: 'geen-beleggingen' });
      const uitschrijf = uitschrijfUrl(gebruiker.id);
      const m = maakMail({ r, p, taal: taalVan(gebruiker), voornaam: gebruiker.user_metadata?.voornaam, uitschrijf, voorbeeld: true, nieuw: !gebruiker.user_metadata?.maandrapportGezien });
      const resultaat = await verstuur([mailObject(gebruiker.email, m, uitschrijf)]);
      await zetMetadata(gebruiker.id, { laatsteVoorbeeldMail: new Date().toISOString() });
      const ok = resultaat.every(x => x.status < 300);
      return res.status(ok ? 200 : 502).json({ ok, naar: gebruiker.email, ...(ok ? {} : { fout: resultaat }) });
    }

    // ── Maandelijkse verzending (enkel Vercel Cron) ──
    const geheim = process.env.CRON_SECRET;
    if (!geheim || req.headers.authorization !== `Bearer ${geheim}`) return res.status(401).json({ error: 'Niet toegestaan' });
    if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'RESEND_API_KEY ontbreekt' });

    const p = periode();
    const [gebruikers, data] = await Promise.all([alleGebruikers(), portefeuilleData()]);
    const ontvangers = gebruikers.filter(u => u.email && u.email_confirmed_at && u.user_metadata?.maandrapport !== false && data.perGebruiker[u.id]);
    const markt = await haalMarktdata(ontvangers.flatMap(u => gekozenRijen(u, data.perGebruiker[u.id])), p);
    const mails = [];
    let overgeslagen = 0;
    for (const u of ontvangers) {
      const rijen = gekozenRijen(u, data.perGebruiker[u.id]);
      const r = volledigRapport(rijen, namenVoor(data.naamVan, u.id, rijen), markt, p);
      if (r.waarde <= 0) { overgeslagen++; continue; }
      const uitschrijf = uitschrijfUrl(u.id);
      mails.push(mailObject(u.email, maakMail({ r, p, taal: taalVan(u), voornaam: u.user_metadata?.voornaam, uitschrijf, nieuw: !u.user_metadata?.maandrapportGezien }), uitschrijf));
    }
    const resultaat = mails.length ? await verstuur(mails, `maandrapport-${p.sleutel}`) : [];
    return res.status(200).json({ maand: p.sleutel, verstuurd: mails.length, overgeslagen, resultaat: resultaat.map(x => x.status) });
  } catch (e) {
    console.error('maandrapport', e);
    return res.status(500).json({ error: e.message });
  }
};

// Voor lokale tests
module.exports.maakMail = maakMail;
module.exports.rapportVoor = rapportVoor;
module.exports.volledigRapport = volledigRapport;
module.exports.periode = periode;
module.exports.haalMarktdata = haalMarktdata;
