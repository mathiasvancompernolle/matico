export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
  const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_API_KEY;
  const FMP_KEY = process.env.FMP_API_KEY;
  const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

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
      try {
        const finnhubRes = await fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
        );
        const finnhubData = await finnhubRes.json();
        if (Array.isArray(finnhubData) && finnhubData.length > 0) {
          return res.json(finnhubData);
        }
      } catch (e) {}
      try {
        const newsRes = await fetch(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(symbol)}&sortBy=publishedAt&pageSize=5&language=nl,en&apiKey=${NEWSAPI_KEY}`
        );
        const newsData = await newsRes.json();
        const articles = (newsData.articles || []).map(a => ({
          headline: a.title,
          url: a.url,
          source: a.source?.name,
          datetime: Math.floor(new Date(a.publishedAt).getTime() / 1000),
          summary: a.description
        }));
        return res.json(articles);
      } catch (e) {}
      return res.json([]);
    }

    if (endpoint === 'profile') {
      const { symbol } = req.query;
      try {
        const finnhubRes = await fetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`
        );
        const finnhubData = await finnhubRes.json();
        if (finnhubData.name) return res.json(finnhubData);
      } catch (e) {}
      try {
        const fmpRes = await fetch(
          `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`
        );
        const fmpData = await fmpRes.json();
        if (fmpData[0]) {
          const p = fmpData[0];
          return res.json({
            name: p.companyName,
            country: p.country,
            finnhubIndustry: p.industry,
            marketCapitalization: p.mktCap / 1000000,
            weburl: p.website,
            logo: p.image
          });
        }
      } catch (e) {}
      return res.json({});
    }

    if (endpoint === 'metrics') {
      const { symbol } = req.query;
      try {
        const finnhubRes = await fetch(
          `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`
        );
        const finnhubData = await finnhubRes.json();
        if (finnhubData.metric) return res.json(finnhubData);
      } catch (e) {}
      try {
        const fmpRes = await fetch(
          `https://financialmodelingprep.com/api/v3/key-metrics-ttm/${symbol}?apikey=${FMP_KEY}`
        );
        const fmpData = await fmpRes.json();
        if (fmpData[0]) {
          return res.json({
            metric: {
              peNormalizedAnnual: fmpData[0].peRatioTTM,
              beta: fmpData[0].betaTTM,
              '52WeekHigh': fmpData[0]['52WeekHigh'],
              '52WeekLow': fmpData[0]['52WeekLow'],
            }
          });
        }
      } catch (e) {}
      return res.json({ metric: {} });
    }

    if (endpoint === 'ai-analyse') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { symbol, name, price, change } = body;
      let nieuwsContext = '';
      try {
        const newsRes = await fetch(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(name || symbol)}&sortBy=publishedAt&pageSize=3&language=en&apiKey=${NEWSAPI_KEY}`
        );
        const newsData = await newsRes.json();
        if (newsData.articles?.length > 0) {
          nieuwsContext = '\n\nLaatste nieuws:\n' + newsData.articles
            .slice(0, 3)
            .map(a => `- ${a.title} (${a.publishedAt?.slice(0, 10)})`)
            .join('\n');
        }
      } catch (e) {}
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': 'https://matico.vercel.app',
          'X-Title': 'Matico Portfolio Tracker'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Geef een korte beleggingsanalyse in het Nederlands voor ${name} (${symbol}). Huidige koers: ${price}, verandering vandaag: ${change}%.${nieuwsContext}\n\nGeef je analyse in maximaal 200 woorden. Wees concreet over risico's en kansen.`
          }]
        })
      });
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || 'Analyse niet beschikbaar.';
      return res.json({ analyse: text });
    }

    return res.status(400).json({ error: 'Onbekend endpoint' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server fout: ' + err.message });
  }
}
