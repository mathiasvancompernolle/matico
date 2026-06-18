// api/cron-intraday.js
// Vercel Cron Job — elke 5 minuten tijdens beursuren
// Haalt koersen op en slaat portfoliowaarde op als intraday datapunt in Vercel Blob

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

async function haalKoers(symbol) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    if (d.c && d.c > 0) return d.c;
  } catch (e) {}
  return null;
}

async function laadUitBlob(bestandsnaam) {
  try {
    const r = await fetch(`https://blob.vercel-storage.com?prefix=${bestandsnaam}&limit=1`, {
      headers: { 'Authorization': `Bearer ${BLOB_TOKEN}` }
    });
    const lijst = await r.json();
    const blob = lijst.blobs?.[0];
    if (!blob) return null;
    const res = await fetch(blob.downloadUrl || blob.url);
    return await res.json();
  } catch (e) { return null; }
}

async function slaOpInBlob(bestandsnaam, data) {
  try {
    await fetch(`https://blob.vercel-storage.com/${bestandsnaam}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${BLOB_TOKEN}`,
        'Content-Type': 'application/json',
        'x-content-type': 'application/json',
        'x-allow-overwrite': '1',
        'x-add-random-suffix': '0',
      },
      body: JSON.stringify(data)
    });
    return true;
  } catch (e) { return false; }
}

export default async function handler(req, res) {
  // Vercel cron verificatie
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Alleen tijdens beursuren uitvoeren (ma-vr, 14:00-22:00 UTC)
  const nu = new Date();
  const dag = nu.getUTCDay(); // 0=zo, 6=za
  const uur = nu.getUTCHours();
  if (dag === 0 || dag === 6 || uur < 14 || uur >= 22) {
    return res.status(200).json({ overgeslagen: true, reden: 'Buiten beursuren' });
  }

  if (!BLOB_TOKEN) return res.status(500).json({ error: 'BLOB_TOKEN ontbreekt' });

  // Laad portfolio data uit Blob (gesynchroniseerd vanuit de browser)
  const portfolioData = await laadUitBlob('matico-portfolio.json');
  if (!portfolioData?.beleggingen?.length) {
    return res.status(200).json({ overgeslagen: true, reden: 'Geen portfolio data in Blob' });
  }

  const { beleggingen } = portfolioData;

  // Haal wisselkoers op
  let usdEur = 0.865;
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?from=USD&to=EUR`);
    const d = await r.json();
    if (d.rates?.EUR) usdEur = d.rates.EUR;
  } catch (e) {}

  const getMuntFactor = (munt) => {
    if (munt === 'USD') return usdEur;
    if (munt === 'GBP') return usdEur * 1.27;
    return 1;
  };

  // Haal koersen op voor alle symbolen
  const symbolen = [...new Set(beleggingen.map(b => b.symbol))];
  const koersen = {};
  await Promise.all(symbolen.map(async s => {
    const k = await haalKoers(s);
    if (k) koersen[s] = k;
  }));

  // Bereken portfoliowaarde
  const waarde = beleggingen.reduce((sum, b) => {
    const k = koersen[b.symbol];
    const prijs = k || b.kostprijs;
    return sum + prijs * b.aantal * getMuntFactor(b.munt || 'EUR');
  }, 0);

  if (waarde === 0) return res.status(200).json({ overgeslagen: true, reden: 'Waarde is 0' });

  // Laad bestaande intraday punten van vandaag
  const dagKey = nu.toISOString().slice(0, 10);
  const intradayBestandsnaam = `matico-intraday-${dagKey}.json`;
  const bestaande = await laadUitBlob(intradayBestandsnaam) || [];

  // Verwijder duplicaten van de laatste 3 minuten
  const drieMinGeleden = Date.now() / 1000 - 180;
  const gefilterd = Array.isArray(bestaande)
    ? bestaande.filter(p => p.t < drieMinGeleden)
    : [];

  // Voeg nieuw punt toe
  gefilterd.push({
    t: Math.floor(nu.getTime() / 1000),
    w: Math.round(waarde * 100) / 100
  });

  // Sla op in Blob
  await slaOpInBlob(intradayBestandsnaam, gefilterd);

  // Opschonen: verwijder intraday data ouder dan 2 dagen
  for (let i = 2; i <= 5; i++) {
    const oudeD = new Date(nu - i * 86400000);
    const oudeKey = `matico-intraday-${oudeD.toISOString().slice(0, 10)}.json`;
    try {
      await fetch(`https://blob.vercel-storage.com?prefix=${oudeKey}&limit=1`, {
        headers: { 'Authorization': `Bearer ${BLOB_TOKEN}` }
      }).then(r => r.json()).then(async lijst => {
        const blob = lijst.blobs?.[0];
        if (blob?.url) {
          await fetch(blob.url, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${BLOB_TOKEN}` }
          });
        }
      });
    } catch (e) {}
  }

  return res.status(200).json({
    success: true,
    timestamp: nu.toISOString(),
    aantalPunten: gefilterd.length,
    waarde: Math.round(waarde * 100) / 100,
    koersen
  });
}
