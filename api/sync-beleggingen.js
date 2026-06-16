// api/sync-beleggingen.js
// Slaat beleggingen op in Vercel Blob via directe REST API

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN niet ingesteld' });

  // Haal store hostname op uit token (formaat: vercel_blob_rw_STOREID_...)
  const storeId = TOKEN.split('_')[3] || '';

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { beleggingen, gebruiker } = body;
      if (!beleggingen || !Array.isArray(beleggingen)) {
        return res.status(400).json({ error: 'Ongeldige data' });
      }
      const data = JSON.stringify({ beleggingen, gebruiker, bijgewerkt: new Date().toISOString() });

      const blobRes = await fetch(`https://blob.vercel-storage.com/matico-portfolio.json`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          'x-content-type': 'application/json',
          'x-allow-overwrite': '1',
          'x-add-random-suffix': '0',
        },
        body: data,
      });

      const resultText = await blobRes.text();
      if (!blobRes.ok) {
        console.error('Blob PUT fout:', resultText);
        return res.status(500).json({ error: 'Blob opslaan mislukt', detail: resultText });
      }

      let result;
      try { result = JSON.parse(resultText); } catch { result = {}; }
      return res.status(200).json({ success: true, url: result.url });
    } catch (err) {
      console.error('Sync POST error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      // Gebruik de juiste Vercel Blob list endpoint
      const listRes = await fetch(`https://blob.vercel-storage.com?prefix=matico-portfolio.json&limit=1`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
      });
      const listText = await listRes.text();
      let listData;
      try { listData = JSON.parse(listText); } catch { return res.status(500).json({ error: 'List parse fout', detail: listText }); }

      const blob = listData.blobs?.[0];
      if (!blob?.downloadUrl && !blob?.url) {
        return res.status(404).json({ error: 'Geen portfolio gevonden', blobs: listData.blobs });
      }

      const fileRes = await fetch(blob.downloadUrl || blob.url);
      const data = await fileRes.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
