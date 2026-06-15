export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
  const AV_KEY_1 = process.env.ALPHAVANTAGE_API_KEY;
  const AV_KEY_2 = process.env.ALPHAVANTAGE_API_KEY_2;
  const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  const FMP_KEY = process.env.FMP_API_KEY;

  // Yahoo Finance headers
  const YF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json'
  };

  // Alpha Vantage met beide keys als fallback
  const uurVanDag = new Date().getHours();
  const AV_KEY = uurVanDag % 2 === 0 ? AV_KEY_1 : AV_KEY_2;
  const AV_KEY_BACKUP = uurVanDag % 2 === 0 ? AV_KEY_2 : AV_KEY_1;

  async function avFetch(url) {
    try {
      const r = await fetch(url.replace('__AV_KEY__', AV_KEY));
      const d = await r.json();
      if (!d.Information && !d.Note) return d;
    } catch (e) {}
    try {
      const r = await fetch(url.replace('__AV_KEY__', AV_KEY_BACKUP));
      return await r.json();
    } catch (e) {}
    return {};
  }

  // Yahoo Finance symbool omzetten
  function toYahooSymbol(symbol) {
    return symbol
      .replace('.DE', '.DE')   // XETRA blijft .DE
      .replace('.PA', '.PA')   // Paris blijft .PA
      .replace('VWCE.DE', 'VWCE.DE');
  }

  const { endpoint } = req.query;

  try {
    if (endpoint === 'quote') {
      const { symbol } = req.query;
      const isEuropees = symbol.includes('.DE') || symbol.includes('.PA') || symbol.includes('.AS') || symbol.includes('.BR') || symbol.includes('.L') || symbol.includes('.SW') || symbol.includes('.MI');

      // Voor Europese symbolen: gebruik Yahoo Finance direct (live koersen)
      if (isEuropees) {
        try {
          const yfSym = toYahooSymbol(symbol);
          const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?range=1d&interval=1m&events=div`;
          const yfRes = await fetch(yfUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
          const yfData = await yfRes.json();
          const result = yfData?.chart?.result?.[0];
          if (result) {
            const meta = result.meta;
            const quotes = result.indicators?.quote?.[0];
            const closes = quotes?.close?.filter(v => v != null) || [];
            const huidigeKoers = meta.regularMarketPrice || closes[closes.length - 1] || 0;
            const vorigeSlot = meta.chartPreviousClose || meta.previousClose || huidigeKoers;
            if (huidigeKoers > 0) {
              return res.json({
                c: huidigeKoers,
                pc: vorigeSlot,
                o: meta.regularMarketOpen || huidigeKoers,
                h: meta.regularMarketDayHigh || huidigeKoers,
                l: meta.regularMarketDayLow || huidigeKoers,
                v: meta.regularMarketVolume || 0,
              });
            }
          }
        } catch (e) { console.error('Yahoo quote fout:', e); }
      }

      // US symbolen: Finnhub (real-time)
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (d.c && d.c > 0) return res.json(d);
      } catch (e) {}

      // Laatste fallback: Yahoo Finance voor alles
      try {
        const yfSym = toYahooSymbol(symbol);
        const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?range=1d&interval=5m`;
        const yfRes = await fetch(yfUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const yfData = await yfRes.json();
        const result = yfData?.chart?.result?.[0];
        if (result?.meta?.regularMarketPrice) {
          const meta = result.meta;
          return res.json({
            c: meta.regularMarketPrice,
            pc: meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice,
            o: meta.regularMarketOpen || meta.regularMarketPrice,
            h: meta.regularMarketDayHigh || meta.regularMarketPrice,
            l: meta.regularMarketDayLow || meta.regularMarketPrice,
            v: meta.regularMarketVolume || 0,
          });
        }
      } catch (e) {}

      return res.json({ c: 0, pc: 0, o: 0, h: 0, l: 0, v: 0 });
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

    if (endpoint === 'forex-history') {
      // Historische wisselkoers naar EUR op een specifieke datum (voor "kostprijs in EUR" bij toevoegen)
      const { datum, van } = req.query; // datum = YYYY-MM-DD, van = broncurrency (USD/GBP/...)
      if (!van || van === 'EUR') {
        return res.json({ rate: 1, datum: datum || null });
      }
      // Frankfurter (ECB) — gratis, geen key nodig, geeft bij weekend/feestdag de laatst gekende koers
      try {
        const r = await fetch(`https://api.frankfurter.app/${datum}?from=${van}&to=EUR`);
        const d = await r.json();
        const rate = d?.rates?.EUR;
        if (rate) return res.json({ rate, datum: d.date || datum });
      } catch (e) {}
      // Fallback: huidige live koers
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=OANDA:${van}_EUR&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (d.c) return res.json({ rate: d.c, datum, fallback: true });
      } catch (e) {}
      const fallbackRates = { USD: 0.865, GBP: 1.17 };
      return res.json({ rate: fallbackRates[van] || 1, datum, fallback: true });
    }

    if (endpoint === 'candle') {
      const { symbol, tijdperk, van, tot, resolutie } = req.query;

      // ── Historische candle data via timestamp range (voor YTD berekening) ──
      if (van && tot) {
        try {
          const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolutie || 'D'}&from=${van}&to=${tot}&token=${FINNHUB_KEY}`);
          const d = await r.json();
          if (d?.s === 'ok' && d?.c?.length > 0) return res.json(d);
        } catch (e) {}
        try {
          const yfSym = toYahooSymbol(symbol);
          const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?period1=${van}&period2=${tot}&interval=1d`;
          const yfRes = await fetch(yfUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const yfData = await yfRes.json();
          const result = yfData?.chart?.result?.[0];
          if (result?.timestamp?.length > 0) {
            return res.json({ s: 'ok', t: result.timestamp, c: result.indicators.quote[0].close });
          }
        } catch (e) {}
        return res.json({ s: 'no_data' });
      }

      // ── Grafiek tijdperken (1D, 1W, 1M, 1J, YTD, 3J, 5J, Max) ──
      const yfRange = tijdperk === '1D' ? '5d'
        : tijdperk === '1W' ? '5d'
        : tijdperk === '1M' ? '1mo'
        : tijdperk === '1J' ? '1y'
        : tijdperk === 'YTD' ? 'ytd'
        : tijdperk === '3J' ? '3y'
        : tijdperk === '5J' ? '5y'
        : '10y';

      const yfInterval = tijdperk === '1D' ? '1d'
        : tijdperk === '1W' ? '1d'
        : tijdperk === '1M' ? '1d'
        : tijdperk === '1J' ? '1wk'
        : tijdperk === 'YTD' ? '1wk'
        : '1wk';

      try {
        const yfSym = toYahooSymbol(symbol);
        const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?range=${yfRange}&interval=${yfInterval}&events=div,splits`;
        const r = await fetch(yfUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
        const data = await r.json();
        const result = data?.chart?.result?.[0];

        if (result?.timestamp?.length > 0) {
          const timestamps = result.timestamp;
          const closes = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close || [];

          // Voor 1D: neem enkel de vorige slotkoers + huidige koers
          if (tijdperk === '1D') {
            const geldigeCloses = closes.filter(v => v != null);
            const vorigeSlot = geldigeCloses[geldigeCloses.length - 2] || geldigeCloses[geldigeCloses.length - 1];
            const huidig = result.meta.regularMarketPrice || geldigeCloses[geldigeCloses.length - 1];
            const vorigeTs = timestamps[timestamps.length - 2] || timestamps[timestamps.length - 1];
            const vorigeDatum = new Date(vorigeTs * 1000);
            const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
            const vorigeLabel = `${vorigeDatum.getDate()} ${maanden[vorigeDatum.getMonth()]}`;
            if (vorigeSlot && huidig) {
              return res.json({ punten: [
                { label: vorigeLabel, datum: vorigeDatum.toISOString().split('T')[0], prijs: Math.round(vorigeSlot * 100) / 100 },
                { label: 'Nu', datum: new Date().toISOString().split('T')[0], prijs: Math.round(huidig * 100) / 100 }
              ]});
            }
          }

          // Andere tijdperken: volledige reeks
          const punten = timestamps.map((t, i) => {
            if (closes[i] == null) return null;
            const datum = new Date(t * 1000);
            return {
              label: datum.toLocaleDateString('nl-BE', {
                day: 'numeric', month: 'short',
                year: (tijdperk === '3J' || tijdperk === '5J' || tijdperk === 'Max') ? 'numeric' : undefined
              }),
              datum: datum.toISOString().split('T')[0],
              prijs: Math.round(closes[i] * 100) / 100
            };
          }).filter(p => p !== null);

          if (punten.length > 0) return res.json({ punten });
        }
      } catch (e) { console.error('Candle fout:', e); }

      // Fallback: Finnhub voor US
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (d.c && d.c > 0 && d.pc && d.pc > 0) {
          return res.json({ punten: [
            { label: 'Gisteren', datum: new Date(Date.now() - 86400000).toISOString().split('T')[0], prijs: d.pc },
            { label: 'Nu', datum: new Date().toISOString().split('T')[0], prijs: d.c }
          ]});
        }
      } catch (e) {}

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
      let resultaat = {};
      try {
        const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (d.name) resultaat = { ...d };
      } catch (e) {}
      // FMP heeft betere dekking voor Europese/Aziatische/overige internationale aandelen
      // (sector, industry, bèta, land) — vult aan of vervangt lege Finnhub-data
      try {
        const r2 = await fetch(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`);
        const d2 = await r2.json();
        if (d2[0]) {
          const f = d2[0];
          resultaat.name = resultaat.name || f.companyName;
          resultaat.logo = resultaat.logo || f.image;
          resultaat.ceo = resultaat.ceo || f.ceo;
          resultaat.description = resultaat.description || f.description;
          resultaat.isin = resultaat.isin || f.isin;
          resultaat.employeeTotal = resultaat.employeeTotal || f.fullTimeEmployees;
          resultaat.sector = resultaat.sector || f.sector;
          resultaat.industry = resultaat.industry || f.industry;
          resultaat.beta = resultaat.beta || f.beta;
          resultaat.country = resultaat.country || f.country;
        }
      } catch (e) {}
      // Yahoo Finance (gratis, geen key) — meestal de beste dekking voor
      // Europese/Aziatische/overige internationale aandelen (bv. Prosus PRX.AS)
      if (!resultaat.sector || !resultaat.beta) {
        try {
          const yfSym = toYahooSymbol(symbol);
          const yfUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yfSym)}?modules=assetProfile,defaultKeyStatistics,price`;
          const yfRes = await fetch(yfUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
          const yfData = await yfRes.json();
          const yfResult = yfData?.quoteSummary?.result?.[0];
          if (yfResult) {
            const profiel = yfResult.assetProfile || {};
            const stats = yfResult.defaultKeyStatistics || {};
            const prijs = yfResult.price || {};
            resultaat.name = resultaat.name || prijs.longName || prijs.shortName;
            resultaat.sector = resultaat.sector || profiel.sector;
            resultaat.industry = resultaat.industry || profiel.industry;
            resultaat.country = resultaat.country || profiel.country;
            resultaat.description = resultaat.description || profiel.longBusinessSummary;
            resultaat.employeeTotal = resultaat.employeeTotal || profiel.fullTimeEmployees;
            const beta = stats?.beta?.raw;
            if (beta) resultaat.beta = resultaat.beta || beta;
          }
        } catch (e) {}
      }
      return res.json(resultaat);
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
        if (d.articles?.length > 0) nieuwsContext = '\n\nLaatste nieuws:\n' + d.articles.slice(0, 3).map(a => `- ${a.title} (${a.publishedAt?.slice(0, 10)})`).join('\n');
      } catch (e) {}
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'HTTP-Referer': 'https://matico-self.vercel.app', 'X-Title': 'Matico' },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku', max_tokens: 500,
          messages: [{ role: 'user', content: `Geef een korte beleggingsanalyse in het Nederlands voor ${name} (${symbol}). Huidige koers: ${price}, verandering vandaag: ${change}%.${nieuwsContext}\n\nGeef je analyse in maximaal 200 woorden.` }]
        })
      });
      const d = await r.json();
      return res.json({ analyse: d.choices?.[0]?.message?.content || 'Analyse niet beschikbaar.' });
    }

    if (endpoint === 'dividend') {
      const { symbol, van, tot } = req.query;
      
      // Probeer Finnhub dividend2 (geeft exDate, amount, paymentDate)
      try {
        const r = await fetch(`https://finnhub.io/api/v1/stock/dividend2?symbol=${symbol}&from=${van}&to=${tot}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) {
          // Normaliseer naar consistent formaat
          return res.json(d.map(item => ({
            exDate: item.exDate || item.date || '',
            paymentDate: item.paymentDate || item.date || '',
            amount: parseFloat(item.amount || item.adjDividend || 0),
            symbol: item.symbol || symbol,
          })));
        }
      } catch (e) {}

      // Fallback: FMP dividend history — normaliseer ook dit formaat
      try {
        const basis = symbol.split('.')[0];
        const r = await fetch(`https://financialmodelingprep.com/api/v3/historical/stock_dividend/${basis}?limit=20&apikey=${FMP_KEY}`);
        const d = await r.json();
        const hist = (d?.historical || []).filter(h => {
          const exD = new Date(h.date || '');
          return exD >= new Date(van) && exD <= new Date(tot);
        });
        if (hist.length > 0) return res.json(hist.map(h => ({
          exDate: h.date,
          paymentDate: h.paymentDate || h.date,
          amount: parseFloat(h.dividend || h.adjDividend || 0),
          symbol: basis,
        })));
      } catch (e) {}

      return res.json([]);
    }

    if (endpoint === 'etf-holdings') {
      const { symbol } = req.query;
      // Normaliseer symbool voor FMP (verwijder exchange suffix)
      const fmpSym = symbol.split('.')[0];
      try {
        // FMP ETF sector gewichten
        const [sectorRes, holdingsRes, countryRes] = await Promise.all([
          fetch(`https://financialmodelingprep.com/api/v3/etf-sector-weightings/${fmpSym}?apikey=${FMP_KEY}`),
          fetch(`https://financialmodelingprep.com/api/v3/etf-holder/${fmpSym}?apikey=${FMP_KEY}`),
          fetch(`https://financialmodelingprep.com/api/v3/etf-country-weightings/${fmpSym}?apikey=${FMP_KEY}`)
        ]);
        const sectoren = await sectorRes.json();
        const holdings = await holdingsRes.json();
        const landen = await countryRes.json();

        // Sector data verwerken
        const sectorData = Array.isArray(sectoren) ? sectoren.map(s => ({
          label: s.sector || s.weightPercentage,
          pct: parseFloat(s.weightPercentage) || 0
        })).filter(s => s.pct > 0) : [];

        // Land/regio data verwerken
        const landData = Array.isArray(landen) ? landen.map(l => ({
          label: l.country,
          pct: parseFloat(l.weightPercentage) || 0
        })).filter(l => l.pct > 0) : [];

        return res.json({
          sectoren: sectorData,
          landen: landData,
          holdings: Array.isArray(holdings) ? holdings.slice(0, 20) : []
        });
      } catch (e) {
        console.error('ETF holdings fout:', e);
        return res.json({ sectoren: [], landen: [], holdings: [] });
      }
    }

    return res.status(400).json({ error: 'Onbekend endpoint' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server fout: ' + err.message });
  }
}
