export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
  const AV_KEY = process.env.ALPHAVANTAGE_API_KEY;
  const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  const FMP_KEY = process.env.FMP_API_KEY;

  const { endpoint } = req.query;

  try {
    if (endpoint === 'quote') {
      const { symbol } = req.query;
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
      return res.json(await r.json());
    }

    if (endpoint === 'search') {
      const { q } = req.query;
      const r = await fetch(`https://finnhub.io/api/v1/search?q=${q}&token=${FINNHUB_KEY}`);
      return res.json(await r.json());
    }

    if (endpoint === 'forex') {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=OANDA:EUR_USD&token=${FINNHUB_KEY}`);
        const d = await r.json();
        return res.json({ usdEur: d.c ? 1 / d.c : 0.865 });
      } catch (e) {
        return res.json({ usdEur: 0.865 });
      }
    }

    if (endpoint === 'candle') {
      const { symbol, tijdperk } = req.query;

      // 1D: intradag data per uur
      if (tijdperk === '1D') {
        try {
          const r = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=60min&outputsize=compact&apikey=${AV_KEY}`);
          const d = await r.json();
          const tijdreeks = d['Time Series (60min)'];
          if (tijdreeks) {
            const vandaag = new Date().toISOString().split('T')[0];
            const gisteren = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const punten = Object.entries(tijdreeks)
              .filter(([t]) => t.startsWith(vandaag) || t.startsWith(gisteren))
              .slice(0, 24)
              .reverse()
              .map(([t, w]) => ({
                label: t.split(' ')[1].slice(0, 5),
                prijs: parseFloat(w['4. close'])
              }));
            if (punten.length > 0) return res.json({ punten });
          }
        } catch (e) { console.error('1D fout:', e); }
      }

      // Bereken aantal dagen
      const dagen = tijdperk === '1W' ? 7
        : tijdperk === '1M' ? 30
        : tijdperk === '1J' ? 365
        : tijdperk === 'YTD' ? Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 86400000)
        : tijdperk === '3J' ? 1095
        : tijdperk === '5J' ? 1825
        : 5000;

      // Korte periodes: dagelijkse data
      if (dagen <= 100) {
        try {
          const r = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${AV_KEY}`);
          const d = await r.json();
          const tijdreeks = d['Time Series (Daily)'];
          if (tijdreeks) {
            const vanafDatum = new Date();
            vanafDatum.setDate(vanafDatum.getDate() - dagen);
            const punten = Object.entries(tijdreeks)
              .filter(([datum]) => new Date(datum) >= vanafDatum)
              .reverse()
              .map(([datum, w]) => ({
                label: new Date(datum).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }),
                prijs: parseFloat(w['4. close'])
              }));
            if (punten.length > 0) return res.json({ punten });
          }
        } catch (e) { console.error('Daily fout:', e); }
      }

      // Lange periodes: wekelijkse data (minder data, sneller)
      if (dagen > 100) {
        try {
          const r = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=${symbol}&apikey=${AV_KEY}`);
          const d = await r.json();
          const tijdreeks = d['Weekly Time Series'];
          if (tijdreeks) {
            const vanafDatum = new Date();
            vanafDatum.setDate(vanafDatum.getDate() - dagen);
            const punten = Object.entries(tijdreeks)
              .filter(([datum]) => new Date(datum) >= vanafDatum)
              .reverse()
              .map(([datum, w]) => ({
                label: new Date(datum).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: dagen > 365 ? 'numeric' : undefined }),
                prijs: parseFloat(w['4. close'])
              }));
            if (punten.length > 0) return res.json({ punten });
          }
        } catch (e) { console.error('Weekly fout:', e); }
      }

      return res.json({ punten: [] });
    }

    if (endpoint === 'news') {
      const { symbol } = req.query;
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      try {
        const r = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) return res.json(d);
      } catch (e) {}
      try {
        const r = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(symbol)}&sortBy=publishedAt&pageSize=5&apiKey=${NEWSAPI_KEY}`);
        const d = await r.json();
        return res.json((d.articles || []).map(a => ({
          headline: a.title, url: a.url, source: a.source?.name,
          datetime: Math.floor(new Date(a.publishedAt).getTime() / 1000)
        })));
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
            const r2 = await fetch(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`);
            const d2 = await r2.json();
            if (d2[0]) {
              d.ceo = d2[0].ceo;
              d.description = d2[0].description;
              d.isin = d2[0].isin;
              d.employeeTotal = d2[0].fullTimeEmployees;
            }
          } catch (e) {}
          return res.json(d);
        }
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
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
      const d = await r.json();
      return res.json({ analyse: d.choices?.[0]?.message?.content || 'Analyse niet beschikbaar.' });
    }

    return res.status(400).json({ error: 'Onbekend endpoint' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server fout: ' + err.message });
  }
}
