// api/cron-email.js — Vercel Cron Job
// Elke weekdag om 20:00 UTC (= 22:00 Belgische zomertijd)

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const MATICO_EMAIL = process.env.MATICO_EMAIL;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const FROM_EMAIL = 'Matico <onboarding@resend.dev>';

async function haalKoersOp(symbol, munt) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    if (d.c && d.c > 0) return { c: d.c, pc: d.pc || d.c };
  } catch (e) {}
  return null;
}

function genereerEmailHTML({ gebruiker, beleggingen, koersen, totaalWaarde, dagWinst, dagPct, datum }) {
  const isPos = dagWinst >= 0;
  const kleur = isPos ? '#16a34a' : '#dc2626';
  const bg = isPos ? '#dcfce7' : '#fef2f2';
  const pijl = isPos ? '▲' : '▼';
  const maandNamen = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const dagNamen = ['zo','ma','di','wo','do','vr','za'];
  const d = new Date(datum);
  const datumLabel = `${dagNamen[d.getUTCDay()]} ${d.getUTCDate()} ${maandNamen[d.getUTCMonth()]}`;

  const beleggingRijen = beleggingen.map(b => {
    const koers = koersen[b.symbol];
    const factor = (b.munt || 'EUR') === 'USD' ? 0.92 : 1;
    const waarde = koers ? koers.c * b.aantal * factor : b.kostprijs * b.aantal;
    const dagVPct = koers && koers.pc > 0 ? ((koers.c - koers.pc) / koers.pc) * 100 : 0;
    const isP = dagVPct >= 0;
    const initialen = b.symbol.slice(0, 2).toUpperCase();
    const logo = b.logo
      ? `<img src="${b.logo}" width="32" height="32" style="border-radius:8px;object-fit:contain;border:1px solid #e2e8f0;background:white;padding:2px;vertical-align:middle;" />`
      : `<span style="display:inline-flex;width:32px;height:32px;border-radius:8px;background:#6366f1;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;vertical-align:middle;">${initialen}</span>`;
    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:12px 0;vertical-align:middle;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;">${logo}</td>
            <td>
              <div style="font-weight:600;font-size:14px;color:#0f172a;">${b.symbol.split('.')[0]}</div>
              <div style="color:#94a3b8;font-size:12px;">${(b.naam||'').split(' ').slice(0,3).join(' ')}</div>
            </td>
          </tr></table>
        </td>
        <td style="padding:12px 0;text-align:right;vertical-align:middle;">
          <div style="font-weight:600;font-size:14px;color:#0f172a;">€${waarde.toFixed(2)}</div>
          <div style="color:${isP?'#16a34a':'#dc2626'};font-size:12px;font-weight:500;">${isP?'+':''}${dagVPct.toFixed(2)}%</div>
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:24px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><div style="color:white;font-size:20px;font-weight:700;">📊 Matico</div><div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:2px;">Portfolio update</div></td>
        <td align="right"><div style="color:rgba(255,255,255,0.8);font-size:13px;">${datumLabel}</div></td>
      </tr></table>
    </div>
    <div style="padding:24px 28px;border-bottom:1px solid #f1f5f9;">
      ${gebruiker?.voornaam ? `<div style="font-size:14px;color:#64748b;margin-bottom:8px;">Goedenavond, ${gebruiker.voornaam} 👋</div>` : ''}
      <div style="font-size:13px;color:#94a3b8;margin-bottom:6px;">Totale waarde</div>
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px;"><span style="font-size:32px;font-weight:800;color:#0f172a;">€${totaalWaarde.toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></td>
        <td><span style="background:${bg};color:${kleur};padding:4px 10px;border-radius:8px;font-size:13px;font-weight:600;">${pijl} ${isPos?'+':''}€${Math.abs(dagWinst).toFixed(2)} (${isPos?'+':''}${dagPct.toFixed(2)}%)</span></td>
      </tr></table>
    </div>
    <div style="padding:20px 28px;">
      <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Je beleggingen</div>
      <table style="width:100%;border-collapse:collapse;">${beleggingRijen}</table>
    </div>
    <div style="padding:20px 28px;border-top:1px solid #f1f5f9;text-align:center;">
      <a href="https://matico-self.vercel.app" style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Bekijk volledig portfolio →</a>
    </div>
    <div style="padding:16px 28px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;">
      Updates worden verstuurd om 22:00 · elke dag (ma–vr)<br>
      <a href="https://matico-self.vercel.app" style="color:#6366f1;">Instellingen aanpassen</a>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (!MATICO_EMAIL || !RESEND_API_KEY || !FINNHUB_KEY || !BLOB_TOKEN) {
    return res.status(500).json({ error: 'Ontbrekende environment variables', missing: { MATICO_EMAIL: !MATICO_EMAIL, RESEND_API_KEY: !RESEND_API_KEY, FINNHUB_KEY: !FINNHUB_KEY, BLOB_TOKEN: !BLOB_TOKEN } });
  }

  // Beleggingen ophalen uit Vercel Blob
  let beleggingen = [], gebruiker = {};
  try {
    const listRes = await fetch('https://blob.vercel-storage.com?prefix=matico-portfolio', {
      headers: { 'Authorization': `Bearer ${BLOB_TOKEN}` },
    });
    const listData = await listRes.json();
    const blob = listData.blobs?.find(b => b.pathname === 'matico-portfolio.json');
    if (!blob) return res.status(500).json({ error: 'Geen portfolio gevonden — sync eerst via Instellingen' });
    const fileRes = await fetch(blob.downloadUrl);
    const data = await fileRes.json();
    beleggingen = data.beleggingen || [];
    gebruiker = data.gebruiker || {};
  } catch (err) {
    return res.status(500).json({ error: 'Blob ophalen mislukt: ' + err.message });
  }

  // Live koersen ophalen
  const koersen = {};
  await Promise.all(beleggingen.map(async (b) => {
    const koers = await haalKoersOp(b.symbol, b.munt);
    if (koers) koersen[b.symbol] = koers;
  }));

  // Totalen berekenen
  let totaalWaarde = 0, dagWinst = 0;
  beleggingen.forEach(b => {
    const k = koersen[b.symbol];
    const factor = (b.munt || 'EUR') === 'USD' ? 0.92 : 1;
    totaalWaarde += k ? k.c * b.aantal * factor : b.kostprijs * b.aantal;
    dagWinst += k ? (k.c - k.pc) * b.aantal * factor : 0;
  });
  const dagPct = (totaalWaarde - dagWinst) > 0 ? (dagWinst / (totaalWaarde - dagWinst)) * 100 : 0;

  const html = genereerEmailHTML({ gebruiker, beleggingen, koersen, totaalWaarde, dagWinst, dagPct, datum: new Date().toISOString() });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [MATICO_EMAIL],
        subject: `Je dagelijkse Matico portfolio update — €${totaalWaarde.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        html,
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message });
    return res.status(200).json({ success: true, totaalWaarde, dagWinst, aantalBeleggingen: beleggingen.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
