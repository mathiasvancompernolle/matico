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
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=4mo&interval=1d`, { headers: UA });
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
  return { start: start.toISOString().slice(0, 10), eind: eind.toISOString().slice(0, 10), maand: eind.getUTCMonth(), jaar: eind.getUTCFullYear(), sleutel: eind.toISOString().slice(0, 7) };
}

async function haalMarktdata(rijen, p) {
  const symbolen = [...new Set(rijen.flatMap(r => (r.beleggingen || []).map(b => b.symbol)).filter(Boolean))];
  const koersen = {};
  await inGroepjes(symbolen, 8, async (s) => { koersen[s] = await reeks(yahooSymbool(s)); });
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
  return { koersen, naarEur };
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
    hallo: (n) => n ? `Hallo ${n},` : 'Hallo,', intro: (m) => `zo deed je portefeuille het in ${m}.`,
    waarde: (d) => `Waarde op ${d}`, resultaat: (m) => `Resultaat in ${m}`, portefeuilles: 'Per portefeuille',
    stijgers: 'Grootste stijgers', dalers: 'Grootste dalers', knop: 'Bekijk je portefeuille',
    noot: (d) => `Op basis van de slotkoersen van ${d}, omgerekend naar euro. Het resultaat telt de koersbeweging van wat je op het einde van de maand bezat; aankopen tijdens de maand tellen vanaf je aankoopprijs. Kapitas geeft geen beleggingsadvies.`,
    waarom: 'Je krijgt deze mail één keer per maand omdat je een account hebt bij Kapitas.', uit: 'Uitschrijven', inst: 'of pas het aan in Instellingen',
    voorbeeld: '[Voorbeeld] ',
  },
  fr: {
    locale: 'fr-BE', onderwerp: (m, pct) => `Votre portefeuille en ${m} : ${pct}`, kop: (m, j) => `Rapport mensuel ${m} ${j}`,
    hallo: (n) => n ? `Bonjour ${n},` : 'Bonjour,', intro: (m) => `voici comment votre portefeuille s'est comporté en ${m}.`,
    waarde: (d) => `Valeur au ${d}`, resultaat: (m) => `Résultat en ${m}`, portefeuilles: 'Par portefeuille',
    stijgers: 'Plus fortes hausses', dalers: 'Plus fortes baisses', knop: 'Voir votre portefeuille',
    noot: (d) => `Sur la base des cours de clôture du ${d}, convertis en euros. Le résultat reflète l'évolution des cours de ce que vous déteniez en fin de mois ; les achats du mois comptent à partir de votre prix d'achat. Kapitas ne fournit pas de conseil en investissement.`,
    waarom: 'Vous recevez cet e-mail une fois par mois parce que vous avez un compte Kapitas.', uit: 'Se désabonner', inst: 'ou modifiez-le dans les Paramètres',
    voorbeeld: '[Exemple] ',
  },
  en: {
    locale: 'en-GB', onderwerp: (m, pct) => `Your portfolio in ${m}: ${pct}`, kop: (m, j) => `Monthly report ${m} ${j}`,
    hallo: (n) => n ? `Hi ${n},` : 'Hi,', intro: (m) => `here's how your portfolio did in ${m}.`,
    waarde: (d) => `Value on ${d}`, resultaat: (m) => `Result in ${m}`, portefeuilles: 'Per portfolio',
    stijgers: 'Top risers', dalers: 'Top fallers', knop: 'View your portfolio',
    noot: (d) => `Based on closing prices of ${d}, converted to euro. The result reflects price changes of what you held at month end; purchases during the month count from your purchase price. Kapitas does not provide investment advice.`,
    waarom: 'You get this e-mail once a month because you have a Kapitas account.', uit: 'Unsubscribe', inst: 'or change it in Settings',
    voorbeeld: '[Preview] ',
  },
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function maakMail({ r, p, taal = 'nl', voornaam = '', uitschrijf, voorbeeld = false }) {
  const t = TEKST[taal] || TEKST.nl;
  const maand = (MAANDEN[taal] || MAANDEN.nl)[p.maand];
  const eur = (x, d = 0) => new Intl.NumberFormat(t.locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
  const pct = (x) => (x > 0 ? '+' : '') + new Intl.NumberFormat(t.locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(x);
  const metTeken = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + eur(Math.abs(x));
  const datum = new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(p.eind + 'T12:00:00Z'));
  const pos = r.winst >= 0, kleur = pos ? '#15803d' : '#b91c1c', bg = pos ? '#dcfce7' : '#fee2e2';
  const link = `${SITE}/?utm_source=maandrapport&utm_medium=email`;

  const rijHtml = (links, sub, rechts, rechtsKleur) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eef0f3;"><div style="font-size:14px;font-weight:600;color:#0f172a;">${esc(links)}</div>${sub ? `<div style="font-size:12px;color:#64748b;">${esc(sub)}</div>` : ''}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef0f3;font-size:14px;font-weight:600;color:${rechtsKleur || '#0f172a'};white-space:nowrap;">${rechts}</td></tr>`;
  const sectie = (titel, inhoud) => `<tr><td style="padding:8px 28px 4px;"><div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:12px 0 4px;">${titel}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inhoud}</table></td></tr>`;
  const naam = (s) => (s.naam || s.symbol).length > 34 ? (s.naam || s.symbol).slice(0, 32) + '…' : (s.naam || s.symbol);

  let blokken = '';
  if (r.perPortfolio.length > 1) blokken += sectie(t.portefeuilles, r.perPortfolio.map(x => rijHtml(x.naam, eur(x.waarde), pct(x.pct), x.pct >= 0 ? '#15803d' : '#b91c1c')).join(''));
  if (r.aantal >= 2 && r.stijgers.length) blokken += sectie(t.stijgers, r.stijgers.map(s => rijHtml(naam(s), metTeken(s.winst), pct(s.pct), '#15803d')).join(''));
  if (r.aantal >= 2 && r.dalers.length) blokken += sectie(t.dalers, r.dalers.map(s => rijHtml(naam(s), metTeken(s.winst), pct(s.pct), '#b91c1c')).join(''));

  const onderwerp = (voorbeeld ? t.voorbeeld : '') + t.onderwerp(maand, pct(r.pct));
  const html = `<!doctype html><html lang="${taal}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(onderwerp)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(t.resultaat(maand))}: ${metTeken(r.winst)} (${pct(r.pct)})</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1e3a8a;padding:22px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.5px;">Kapitas</td>
    <td align="right" style="font-size:13px;color:#c7d2fe;">${esc(t.kop(maand, p.jaar))}</td></tr></table></td></tr>
  <tr><td style="padding:26px 28px 6px;">
    <div style="font-size:15px;color:#334155;margin-bottom:18px;">${esc(t.hallo(voornaam))} ${esc(t.intro(maand))}</div>
    <div style="font-size:13px;color:#64748b;">${esc(t.waarde(datum))}</div>
    <div style="font-size:34px;font-weight:800;letter-spacing:-1px;margin:2px 0 10px;">${eur(r.waarde)}</div>
    <div style="font-size:13px;color:#64748b;margin-bottom:4px;">${esc(t.resultaat(maand))}</div>
    <span style="display:inline-block;background:${bg};color:${kleur};font-weight:700;font-size:15px;padding:6px 12px;border-radius:8px;">${metTeken(r.winst)} (${pct(r.pct)})</span>
  </td></tr>
  ${blokken}
  <tr><td align="center" style="padding:26px 28px 8px;"><a href="${link}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:10px;">${esc(t.knop)}</a></td></tr>
  <tr><td style="padding:14px 28px 26px;font-size:12px;line-height:1.6;color:#94a3b8;">${esc(t.noot(datum))}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td style="padding:16px 28px;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
  ${esc(t.waarom)}<br><a href="${uitschrijf}" style="color:#64748b;">${esc(t.uit)}</a> ${esc(t.inst)}.
</td></tr></table>
</td></tr></table></body></html>`;

  const tekst = [
    `${t.hallo(voornaam)} ${t.intro(maand)}`, '',
    `${t.waarde(datum)}: ${eur(r.waarde)}`, `${t.resultaat(maand)}: ${metTeken(r.winst)} (${pct(r.pct)})`, '',
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
      const rijen = perGebruiker[gebruiker.id] || [];
      const markt = await haalMarktdata(rijen, p);
      const r = rapportVoor(rijen, namenVoor(naamVan, gebruiker.id, rijen), markt, p);
      if (r.waarde <= 0) return res.status(200).json({ ok: false, reden: 'geen-beleggingen' });
      const uitschrijf = uitschrijfUrl(gebruiker.id);
      const m = maakMail({ r, p, taal: taalVan(gebruiker), voornaam: gebruiker.user_metadata?.voornaam, uitschrijf, voorbeeld: true });
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
    const markt = await haalMarktdata(ontvangers.flatMap(u => data.perGebruiker[u.id]), p);
    const mails = [];
    let overgeslagen = 0;
    for (const u of ontvangers) {
      const rijen = data.perGebruiker[u.id];
      const r = rapportVoor(rijen, namenVoor(data.naamVan, u.id, rijen), markt, p);
      if (r.waarde <= 0) { overgeslagen++; continue; }
      const uitschrijf = uitschrijfUrl(u.id);
      mails.push(mailObject(u.email, maakMail({ r, p, taal: taalVan(u), voornaam: u.user_metadata?.voornaam, uitschrijf }), uitschrijf));
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
module.exports.periode = periode;
module.exports.haalMarktdata = haalMarktdata;
