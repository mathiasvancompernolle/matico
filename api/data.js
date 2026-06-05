export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
  const FMP_KEY = process.env.FMP_API_KEY;
  const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

  const { endpoint } = req.query;

  try {
    if (endpoint === 'quote') {
      const { symbol } = req.query;
      const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
      const data = await response.json();
      return res.json(data);
    }

    if (endpoint === 'search') {
      const { q } = req.query;
      const response = await fetch(`https://finnhub.io/api/v1/search?q=${q}&token=${FINNHUB_KEY}`);
      const data = await response.json();
      return res.json(data);
    }

    if (endpoint === 'forex') {
      try {
        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=OANDA:EUR_USD&token=${FINNHUB_KEY}`);
        const data = await response.json();
        const usdEur = data.c ? 1 / data.c : 0.865;
        return res.json({ usdEur });
      } catch (e) {
        return res.json({ usdEur: 0.865 });
      }
    }

    if (endpoint === 'candle') {
      const { symbol, tijdperk } = req.query;
      const now = Math.floor(Date.now() / 1000);
      let from, resolution;

      switch (tijdperk) {
        case '1D': from = now - 86400; resolution = '15'; break;
        case '1W': from = now - 7 * 86400; resolution = '60'; break;
        case '1M': from = now - 30 * 86400; resolution = 'D'; break;
        case '1J': from = now - 365 * 86400; resolution = 'W'; break;
        case 'YTD': from = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000); resolution = 'W'; break;
        case '3J': from = now - 3 * 365 * 86400; resolution = 'W'; break;
        case '5J': from = now - 5 * 365 * 86400; resolution = 'M'; break;
        case 'Max': from = now - 20 * 365 * 86400; resolution = 'M'; break;
        default: from = now - 86400; resolution = '15';
      }

      const response = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${FINNHUB_KEY}`
      );
      const data = await response.json();

      if (data.s === 'ok' && data.t) {
        const punten = data.t.map((t, i) => ({
          label: new Date(t * 1000).toLocaleDateString('nl-BE', {
            day: 'numeric', month: 'short',
            ...(tijdperk === '1D' ? { hour: '2-digit', minute: '2-digit' } : {})
          }),
          prijs: data.c[i]
        }));
        return res.json({ punten });
      }

      try {
        const fmpRes = await fetch(
          `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?timeseries=90&apikey=${FMP_KEY}`
        );
        const fmpData = await fmpRes.json();
        if (fmpData.historical) {
          const punten = fmpData.historical.slice(0, 60).reverse().map(d => ({
            label: new Date(d.date).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }),
            prijs: d.close
          }));
          return res.json({ punten });
        }
      } catch (e) {}

      return res.json({ punten: [] });
    }

    if (endpoint === 'news') {
      const { symbol } = req.query;
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      try {
        const finnhubRes = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
        const finnhubData = await finnhubRes.json();
        if (Array.isArray(finnhubData) && finnhubData.length > 0) return res.json(finnhubData);
      } catch (e) {}
      try {
        const newsRes = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(symbol)}&sortBy=publishedAt&pageSize=5&apiKey=${NEWSAPI_KEY}`);
        const newsData = await newsRes.json();
        const articles = (newsData.articles || []).map(a => ({
          headline: a.title, url: a.url, source: a.source?.name,
          datetime: Math.floor(new Date(a.publishedAt).getTime() / 1000)
        }));
        return res.json(articles);
      } catch (e) {}
      return res.json([]);
    }

    if (endpoint === 'profile') {
      const { symbol } = req.query;
      try {
        const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (d.name) {
          try {
            const fmpR = await fetch(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`);
            const fmpD = await fmpR.json();
            if (fmpD[0]) {
              d.ceo = fmpD[0].ceo;
              d.description = fmpD[0].description;
              d.isin = fmpD[0].isin;
              d.employeeTotal = fmpD[0].fullTimeEmployees;
            }
          } catch (e) {}
          return res.json(d);
        }
      } catch (e) {}
      try {
        const r = await fetch(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`);
        const d = await r.json();
        if (d[0]) return res.json({
          name: d[0].companyName, country: d[0].country,
          finnhubIndustry: d[0].industry, marketCapitalization: d[0].mktCap / 1000000,
          ceo: d[0].ceo, description: d[0].description, isin: d[0].isin,
          employeeTotal: d[0].fullTimeEmployees, ipo: d[0].ipoDate, weburl: d[0].website
        });
      } catch (e) {}
      return res.json({});
    }

    if (endpoint === 'metrics') {
      const { symbol } = req.query;
      try {
        const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (d.metric) return res.json(d);
      } catch (e) {}
      return res.json({ metric: {} });
    }

    if (endpoint === 'ai-analyse') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { symbol, name, price, change } = body;
      let nieuwsContext = '';
      try {
        const r = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(name || symbol)}&sortBy=publishedAt&pageSize=3&language=en&apiKey=${NEWSAPI_KEY}`);
        const d = await r.json();
        if (d.articles?.length > 0) {
          nieuwsContext = '\n\nLaatste nieuws:\n' + d.articles.slice(0, 3).map(a => `- ${a.title} (${a.publishedAt?.slice(0, 10)})`).join('\n');
        }
      } catch (e) {}
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': 'https://matico-self.vercel.app',
          'X-Title': 'Matico'
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
      return res.json({ analyse: data.choices?.[0]?.message?.content || 'Analyse niet beschikbaar.' });
    }

    return res.status(400).json({ error: 'Onbekend endpoint' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server fout: ' + err.message });
  }
}
