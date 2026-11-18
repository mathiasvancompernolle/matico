const { put, get } = require('@vercel/blob');

const ALLE_BEL_SYMS = [
  'ABI.BR','ACKB.BR','AED.BR','AGS.BR','APAM.AS','ARGX.BR','AZE.BR',
  'DIE.BR','ELI.BR','GBLB.BR','KBC.BR','LOTB.BR','MELE.BR','MONT.BR',
  'SOLB.BR','SOF.BR','SYENS.BR','UCB.BR','UMI.BR','WDP.BR',
  // Tickers gecontroleerd bij Yahoo (nov. 2026) — zelfde notatie als api/data.js
  'AGFB.BR','ATEB.BR','BAR.BR','BEKB.BR','BPOST.BR','BREB.BR',
  'CPINV.BR','CFEB.BR','COMB.BR','ECONB.BR','EVS.BR','FAGR.BR',
  'GIMB.BR','HOMI.BR','IMMO.BR','IBAB.BR','KIN.BR','ONTEX.BR',
  'OBEL.BR','RET.BR','SHUR.BR','SIP.BR','TESB.BR','TINC.BR',
  'TITC.BR','XIOR.BR','CMBT.BR','VGP.BR','COLR.BR',
  'ACCB.BR','CYAD.BR','DECB.BR','EKOP.BR','EXM.BR','HYL.BR',
  'JEN.BR','NYR.BR','NYXH.BR','ONWD.BR','OPTI.BR','OXUR.BR',
  'QRF.BR','ROU.BR','SEQUA.BR','TEXF.BR','VAN.BR','VASTB.BR',
  'WEB.BR','WEHB.BR',
];

const BLOB_KEY = 'belgisch-markt-cache.json';
const UA = { 'User-Agent': 'Mozilla/5.0' };

// Yahoo's v10/quoteSummary geeft zonder sessie-cookie + "crumb" enkel
// "Unauthorized / Invalid Crumb" terug — daardoor bleven de lijsten leeg.
async function haalYahooSessie() {
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual' });
    const setCookie = cookieRes.headers.get('set-cookie');
    if (!setCookie) return null;
    const cookie = setCookie.split(';')[0];
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { ...UA, Cookie: cookie } });
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('<html') || crumb.length > 100) return null;
    return { cookie, crumb };
  } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // GET: lees gecachte data terug
  if (req.method === 'GET' && req.query.lees === '1') {
    try {
      const blob = await get(BLOB_KEY);
      if (!blob) return res.json({ consensusprognose: [], omzetgroei: [] });
      const text = await blob.text();
      return res.json(JSON.parse(text));
    } catch (e) {
      return res.json({ consensusprognose: [], omzetgroei: [] });
    }
  }

  // Herberekenen mag enkel door de Vercel Cron (die stuurt automatisch
  // "Authorization: Bearer <CRON_SECRET>" mee als die variabele bestaat).
  // Zo kan een buitenstaander deze zware functie niet blijven aanroepen.
  const geheim = process.env.CRON_SECRET;
  if (geheim && req.headers.authorization !== `Bearer ${geheim}`) {
    return res.status(401).json({ error: 'Niet toegestaan' });
  }

  // Cron: bereken en sla op
  try {
    const sessie = await haalYahooSessie();
    if (!sessie) return res.status(502).json({ error: 'Geen Yahoo-sessie (crumb) gekregen' });
    const yHeaders = { ...UA, Cookie: sessie.cookie };

    const haalOp = async (sym) => {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=financialData,defaultKeyStatistics&crumb=${encodeURIComponent(sessie.crumb)}`,
          { headers: yHeaders }
        );
        const d = await r.json();
        const fin = d?.quoteSummary?.result?.[0]?.financialData || {};
        const stats = d?.quoteSummary?.result?.[0]?.defaultKeyStatistics || {};

        const prijs = fin.currentPrice?.raw || 0;
        const koersdoel = fin.targetMeanPrice?.raw || 0;
        const koersdoelRendement = (prijs && koersdoel)
          ? ((koersdoel - prijs) / prijs) * 100
          : null;

        // Omzetgroei: revenueGrowth (YoY)
        const omzetgroei1J = fin.revenueGrowth?.raw != null
          ? fin.revenueGrowth.raw * 100
          : null;

        const naamRaw = fin.companyOfficers?.[0]?.name || sym;
        // Gebruik shortName uit een quote call
        const rq = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const dq = await rq.json();
        const meta = dq?.chart?.result?.[0]?.meta || {};
        const naam = (meta.longName || meta.shortName || sym).slice(0, 24);
        const huidigePrijs = meta.regularMarketPrice || prijs;

        return { symbol: sym, naam, prijs: huidigePrijs, koersdoelRendement, omzetgroei1J };
      } catch { return null; }
    };

    // In groepjes van 8 i.p.v. ~140 verzoeken tegelijk (anders blokkeert Yahoo)
    const resultaten = [];
    for (let i = 0; i < ALLE_BEL_SYMS.length; i += 8) {
      resultaten.push(...await Promise.all(ALLE_BEL_SYMS.slice(i, i + 8).map(haalOp)));
    }

    const valide = resultaten.filter(Boolean);

    const consensusprognose = valide
      .filter(r => r.koersdoelRendement !== null && r.koersdoelRendement > 0)
      .sort((a, b) => b.koersdoelRendement - a.koersdoelRendement)
      .slice(0, 5)
      .map(r => ({ ...r, koersdoelRendement: Math.round(r.koersdoelRendement * 100) / 100 }));

    const omzetgroei = valide
      .filter(r => r.omzetgroei1J !== null)
      .sort((a, b) => b.omzetgroei1J - a.omzetgroei1J)
      .slice(0, 5)
      .map(r => ({ ...r, omzetgroei1J: Math.round(r.omzetgroei1J * 100) / 100 }));

    const payload = {
      consensusprognose,
      omzetgroei,
      bijgewerkt: new Date().toISOString(),
    };

    await put(BLOB_KEY, JSON.stringify(payload), { access: 'public', addRandomSuffix: false });

    return res.json({ ok: true, consensusprognose: consensusprognose.length, omzetgroei: omzetgroei.length });
  } catch (e) {
    console.error('cron-markten fout:', e);
    return res.status(500).json({ error: e.message });
  }
};
