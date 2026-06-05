export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  const { endpoint } = req.query;

  try {
    if (endpoint === 'quote') {
      const { symbol } = req.query;
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
      );
      const data = await response.json();
      return res.json(data);
    }

    if (endpoint === 'search') {
      const { q } = req.query;
      const response = await fetch(
        `https://finnhub.io/api/v1/search?q=${q}&token=${FINNHUB_KEY}`
      );
      const data = await response.json();
      return res.json(data);
    }

    if (endpoint === 'candle') {
      const { symbol, resolution, from, to } = req.query;
      const response = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
      );
      const data = await response.json();
      return res.json(data);
    }

    if (endpoint === 'news') {
      const { symbol } = req.query;
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const response = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
      );
      const data = await response.json();
      return res.json(data);
    }

    if (endpoint === 'profile') {
      const { symbol } = req.query;
      const response = await fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`
      );
      const data = await response.json();
      return res.json(data);
    }

    if (endpoint === 'metrics') {
      const { symbol } = req.query;
      const response = await fetch(
        `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`
      );
      const data = await response.json();
      return res.json(data);
    }

    if (endpoint === 'ai-analyse') {
      const { symbol, name, price, change } = req.body || req.query;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{
            role: 'user',
            content: `Geef een korte beleggingsanalyse in het Nederlands voor ${body.name || name} (${body.symbol || symbol}). Huidige koers: ${body.price || price}, verandering vandaag: ${body.change || change}%. Zoek het laatste nieuws op en geef je analyse in maximaal 200 woorden. Wees concreet over risico's en kansen.`
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || 'Analyse niet beschikbaar.';
      return res.json({ analyse: text });
    }

    return res.status(400).json({ error: 'Onbekend endpoint' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server fout: ' + err.message });
  }
}
