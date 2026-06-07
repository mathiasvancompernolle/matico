// api/cron-email.js — Vercel Cron Job
// Wordt elke 30 min getriggerd, checkt wie een e-mail moet krijgen

export default async function handler(req, res) {
  // Vercel cron authenticatie
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // In productie: haal e-mailinstellingen op uit een database
  // Voor nu: de client stuurt zelf de e-mail bij het juiste tijdstip
  // via de /api/send-email endpoint (triggered vanuit de browser)
  
  return res.status(200).json({ ok: true, message: 'Cron actief — e-mails worden verstuurd via client trigger' });
}
