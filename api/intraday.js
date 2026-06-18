// api/intraday.js
// Leest intraday datapunten uit Vercel Blob voor de 1D grafiek

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { dag } = req.query;
  if (!dag) return res.status(400).json({ error: 'dag parameter vereist' });

  if (!BLOB_TOKEN) return res.status(200).json([]);

  try {
    const bestandsnaam = `matico-intraday-${dag}.json`;
    const r = await fetch(`https://blob.vercel-storage.com?prefix=${bestandsnaam}&limit=1`, {
      headers: { 'Authorization': `Bearer ${BLOB_TOKEN}` }
    });
    const lijst = await r.json();
    const blob = lijst.blobs?.[0];
    if (!blob) return res.status(200).json([]);

    const dataRes = await fetch(blob.downloadUrl || blob.url);
    const data = await dataRes.json();
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (e) {
    return res.status(200).json([]);
  }
}
