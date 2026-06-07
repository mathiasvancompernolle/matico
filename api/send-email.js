// api/send-email.js — Vercel serverless function
// Verstuurt portfolio update e-mails via Resend

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Matico <onboarding@resend.dev>';

// Genereer HTML e-mail
function genereerEmailHTML({ gebruiker, beleggingen, totaalWaarde, dagWinst, dagPct, datum }) {
  const isPos = dagWinst >= 0;
  const kleur = isPos ? '#16a34a' : '#dc2626';
  const bg = isPos ? '#dcfce7' : '#fef2f2';
  const pijl = isPos ? '▲' : '▼';
  const maandNamen = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const d = new Date(datum);
  const dagNamen = ['zo','ma','di','wo','do','vr','za'];
  const datumLabel = `${dagNamen[d.getDay()]} ${d.getDate()} ${maandNamen[d.getMonth()]} ${d.getFullYear()}`;

  const beleggingRijen = beleggingen.map(b => {
    const isPos = b.dagWinst >= 0;
    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 0; font-size: 14px;">
          <strong>${b.symbol.split('.')[0]}</strong><br>
          <span style="color: #94a3b8; font-size: 12px;">${(b.naam || '').split(' ').slice(0,3).join(' ')}</span>
        </td>
        <td style="padding: 10px 0; text-align: right; font-size: 14px;">
          <strong>€${b.waarde.toFixed(2)}</strong><br>
          <span style="color: ${isPos ? '#16a34a' : '#dc2626'}; font-size: 12px;">
            ${isPos ? '+' : ''}${b.dagPct.toFixed(2)}%
          </span>
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 520px; margin: 32px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 24px 28px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="color: white; font-size: 20px; font-weight: 700;">📊 Matico</div>
        <div style="color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 2px;">Portfolio update</div>
      </div>
      <div style="color: rgba(255,255,255,0.8); font-size: 13px;">${datumLabel}</div>
    </div>

    <!-- Totale waarde -->
    <div style="padding: 24px 28px; border-bottom: 1px solid #f1f5f9;">
      ${gebruiker?.voornaam ? `<div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Goedemorgen, ${gebruiker.voornaam} 👋</div>` : ''}
      <div style="font-size: 13px; color: #94a3b8; margin-bottom: 6px;">Totale waarde</div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 32px; font-weight: 800; color: #0f172a;">€${totaalWaarde.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span style="background: ${bg}; color: ${kleur}; padding: 4px 10px; border-radius: 8px; font-size: 13px; font-weight: 600;">
          ${pijl} ${isPos ? '+' : ''}€${Math.abs(dagWinst).toFixed(2)} (${isPos ? '+' : ''}${dagPct.toFixed(2)}%)
        </span>
      </div>
    </div>

    <!-- Beleggingen -->
    <div style="padding: 20px 28px;">
      <div style="font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Je beleggingen</div>
      <table style="width: 100%; border-collapse: collapse;">
        ${beleggingRijen}
      </table>
    </div>

    <!-- CTA -->
    <div style="padding: 20px 28px; border-top: 1px solid #f1f5f9; text-align: center;">
      <a href="https://matico-self.vercel.app" style="display: inline-block; background: #6366f1; color: white; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none;">
        Bekijk volledig portfolio →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 28px; background: #f8fafc; text-align: center; font-size: 12px; color: #94a3b8;">
      Je ontvangt deze e-mail omdat je e-mailupdates hebt ingeschakeld in Matico.<br>
      <a href="https://matico-self.vercel.app" style="color: #6366f1;">Instellingen aanpassen</a>
    </div>
  </div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { naar, gebruiker, beleggingen, totaalWaarde, dagWinst, dagPct, datum, testmail } = req.body;

  if (!naar || !naar.includes('@')) {
    return res.status(400).json({ error: 'Ongeldig e-mailadres' });
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY niet geconfigureerd' });
  }

  const html = genereerEmailHTML({ gebruiker, beleggingen: beleggingen || [], totaalWaarde, dagWinst, dagPct, datum: datum || new Date().toISOString() });
  const onderwerp = testmail
    ? `[Test] Je Matico portfolio update`
    : `Je dagelijkse Matico portfolio update — €${(totaalWaarde || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [naar],
        subject: onderwerp,
        html,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Resend fout:', data);
      return res.status(500).json({ error: data.message || 'E-mail versturen mislukt' });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Send email error:', err);
    return res.status(500).json({ error: 'Server fout bij versturen' });
  }
}
