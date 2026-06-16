// api/sync-beleggingen.js
// Slaat beleggingen op in Vercel Blob via directe REST API (geen @vercel/blob package nodig)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN niet ingesteld' });

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { beleggingen, gebruiker } = body;
      if (!beleggingen || !Array.isArray(beleggingen)) {
        return res.status(400).json({ error: 'Ongeldige data' });
      }
      const data = JSON.stringify({ beleggingen, gebruiker, bijgewerkt: new Date().toISOString() });
      // Vercel Blob REST API — PUT om bestand op te slaan
      const blobRes = await fetch('https://blob.vercel-storage.com/matico-portfolio.json', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          'x-content-type': 'application/json',
          'x-allow-overwrite': '1',
        },
        body: data,
      });
      if (!blobRes.ok) {
        const err = await blobRes.text();
        console.error('Blob PUT fout:', err);
        return res.status(500).json({ error: 'Blob opslaan mislukt', detail: err });
      }
      const result = await blobRes.json();
      return res.status(200).json({ success: true, url: result.url });
    } catch (err) {
      console.error('Sync error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      // Lijst opvragen en dan het bestand downloaden
      const listRes = await fetch('https://blob.vercel-storage.com?prefix=matico-portfolio', {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
      });
      const listData = await listRes.json();
      const blob = listData.blobs?.find(b => b.pathname === 'matico-portfolio.json');
      if (!blob) return res.status(404).json({ error: 'Geen data gevonden' });
      const fileRes = await fetch(blob.downloadUrl);
      const data = await fileRes.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
