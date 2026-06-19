const { put, get } = require('@vercel/blob');

const ALLE_BEL_SYMS = [
  'ABI.BR','ACKB.BR','AED.BR','AGS.BR','APAM.AS','ARGX.BR','AZE.BR',
  'DIE.BR','ELI.BR','GBLB.BR','KBC.BR','LOTB.BR','MELE.BR','MONT.BR',
  'SOLB.BR','SOF.BR','SYENS.BR','UCB.BR','UMI.BR','WDP.BR',
  'AGFB.BR','ATEB.BR','BAR.BR','BEKB.BR','BPOST.BR','BRDB.BR',
  'CPINV.BR','CFEB.BR','COMB.BR','ECONB.BR','EVS.BR','FAGR.BR',
  'GIMV.BR','HOMI.BR','IMMO.BR','IBAB.BR','KIN.BR','ONTEX.BR',
  'OBEL.BR','RET.BR','SHUR.BR','SIP.BR','TESS.BR','TINC.BR',
  'TITC.BR','XIOR.BR','CMBT.BR','VGP.BR','COLR.BR',
  'ACCE.BR','CYAD.BR','DECB.BR','EKOP.BR','EXM.BR','HYL.BR',
  'JENS.BR','NYR.BR','NYXH.BR','ONWD.BR','OPTI.BR','OXUR.BR',
  'QRF.BR','ROU.BR','SEQM.BR','TEXF.BR','VAN.BR','VASTN.BR',
  'WEB.BR','WEHB.BR',
];

const BLOB_KEY = 'belgisch-markt-cache.json';

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

  // POST/cron: bereken en sla op
  try {
    const resultaten = await Promise.all(ALLE_BEL_SYMS.map(async (sym) => {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=financialData,defaultKeyStatistics`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
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
    }));

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
