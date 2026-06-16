// api/sync-beleggingen.js
// Slaat beleggingen + gebruiker op in Vercel Blob zodat de cron job ze kan lezen

import { put, head } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { beleggingen, gebruiker } = body;
      if (!beleggingen || !Array.isArray(beleggingen)) {
        return res.status(400).json({ error: 'Ongeldige data' });
      }
      const data = JSON.stringify({ beleggingen, gebruiker, bijgewerkt: new Date().toISOString() });
      const blob = await put('matico-portfolio.json', data, {
        access: 'private',
        contentType: 'application/json',
        allowOverwrite: true,
      });
      return res.status(200).json({ success: true, url: blob.url });
    } catch (err) {
      console.error('Sync error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const { downloadUrl } = await head('matico-portfolio.json');
      const r = await fetch(downloadUrl);
      const data = await r.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(404).json({ error: 'Geen data gevonden' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
