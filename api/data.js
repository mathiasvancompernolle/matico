// v16-etf-beurs
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
  const EODHD_KEY = process.env.EODHD_API_KEY;

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
      const { symbol, naam } = req.query;
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]; // 30 dagen ipv 7

      // 1. Finnhub company-news (werkt goed voor US aandelen)
      try {
        const r = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) return res.json(d.slice(0, 10));
      } catch (e) {}

      // 2. NewsAPI — gebruik bedrijfsnaam voor betere resultaten bij Europese aandelen/ETFs
      const zoekterm = naam || symbol.split('.')[0]; // bv. "Prosus" of "VWCE"
      try {
        const r = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(zoekterm)}&sortBy=publishedAt&pageSize=10&language=en&apiKey=${NEWSAPI_KEY}`);
        const d = await r.json();
        if (d.articles?.length > 0) return res.json(d.articles.map(a => ({
          headline: a.title,
          summary: a.description,
          url: a.url,
          source: a.source?.name,
          image: a.urlToImage,
          datetime: Math.floor(new Date(a.publishedAt).getTime() / 1000)
        })));
      } catch (e) {}

      // 3. EODHD nieuws (voor Europese aandelen)
      if (EODHD_KEY) {
        try {
          const r = await fetch(`https://eodhd.com/api/news?s=${symbol}&limit=10&api_token=${EODHD_KEY}&fmt=json`);
          const d = await r.json();
          if (Array.isArray(d) && d.length > 0) return res.json(d.map(a => ({
            headline: a.title,
            summary: a.content?.slice(0, 200),
            url: a.link,
            source: 'EODHD',
            datetime: Math.floor(new Date(a.date).getTime() / 1000)
          })));
        } catch (e) {}
      }

      return res.json([]);
    }

    if (endpoint === 'profile') {
      const { symbol } = req.query;
      let resultaat = {};
      // EODHD — beste gratis dekking voor Europese/Aziatische/internationale aandelen
      // Gewone fetch(), geen npm-package nodig. Geeft sector, industrie, bèta, land.
      try {
        const eoRes = await fetch(`https://eodhd.com/api/fundamentals/${symbol}?filter=General,Technicals&api_token=${EODHD_KEY}&fmt=json`);
        const eoData = await eoRes.json();
        if (eoData?.General?.Name) {
          const g = eoData.General;
          const t = eoData.Technicals || {};
          resultaat.name = g.Name;
          resultaat.sector = g.Sector;
          resultaat.industry = g.Industry;
          resultaat.country = g.CountryName;
          resultaat.description = g.Description;
          resultaat.isin = g.ISIN;
          resultaat.employeeTotal = g.FullTimeEmployees;
          if (t.Beta) resultaat.beta = t.Beta;
        }
      } catch (e) {}
      // Finnhub als aanvulling (logo)
      try {
        const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (d.name) {
          resultaat.name = resultaat.name || d.name;
          resultaat.logo = resultaat.logo || d.logo;
          resultaat.country = resultaat.country || d.country;
          resultaat.sector = resultaat.sector || d.finnhubIndustry;
        }
      } catch (e) {}
      // FMP als laatste aanvulling
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
          resultaat.sector = resultaat.sector || f.sector;
          resultaat.industry = resultaat.industry || f.industry;
          resultaat.beta = resultaat.beta || f.beta;
          resultaat.country = resultaat.country || f.country;
        }
      } catch (e) {}
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
      const EODHD_KEY = process.env.EODHD_API_KEY;
      
      // Probeer Finnhub dividend2
      try {
        const r = await fetch(`https://finnhub.io/api/v1/stock/dividend2?symbol=${symbol}&from=${van}&to=${tot}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) {
          return res.json(d.map(item => ({
            exDate: item.exDate || item.date || '',
            paymentDate: item.paymentDate || item.date || '',
            amount: parseFloat(item.amount || item.adjDividend || 0),
            symbol: item.symbol || symbol,
          })));
        }
      } catch (e) {}

      // Fallback: FMP dividend history
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

      // Fallback: EODHD — beste dekking voor Europese/internationale aandelen
      // Dividenden vallen onder de gratis EOD-tier van EODHD
      if (EODHD_KEY) {
        try {
          // EODHD verwacht symbool in formaat TICKER.EXCHANGE (bv. PRX.AS, SOFI.US, NVDA.US)
          const eoSym = symbol.includes('.') ? symbol : `${symbol}.US`;
          const r = await fetch(`https://eodhd.com/api/div/${eoSym}?from=${van}&to=${tot}&api_token=${EODHD_KEY}&fmt=json`);
          const d = await r.json();
          if (Array.isArray(d) && d.length > 0) {
            return res.json(d.map(item => ({
              exDate: item.date || '',
              paymentDate: item.paymentDate || item.date || '',
              amount: parseFloat(item.value || item.unadjustedValue || 0),
              currency: item.currency || 'EUR',
              symbol,
            })));
          }
        } catch (e) {}
      }

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

    // ── Marktindices ──────────────────────────────────────────────────────────
    if (endpoint === 'market-indices') {
      const { regio = 'lokaal' } = req.query;
      const indicesByRegio = {
        lokaal: [
          { symbol: '^BFX',   naam: 'BEL20 Index' },
          { symbol: 'BELM.BR',naam: 'BEL Midcap Index' },
          { symbol: 'BELS.BR',naam: 'BEL Smallcap Index' },
          { symbol: '^AEX',   naam: 'AEX Index' },
          { symbol: '^FCHI',  naam: 'CAC 40 Index' },
        ],
        europa: [
          { symbol: '^GDAXI', naam: 'DAX Index' },
          { symbol: '^IBEX',  naam: 'IBEX 35' },
          { symbol: '^FTSE',  naam: 'FTSE 100' },
          { symbol: '^STOXX50E', naam: 'Euro Stoxx 50' },
          { symbol: '^SMI',   naam: 'SMI Index' },
        ],
        'noord-amerika': [
          { symbol: '^GSPC',  naam: 'S&P 500' },
          { symbol: '^NDX',   naam: 'Nasdaq 100' },
          { symbol: '^DJI',   naam: 'Dow Jones' },
          { symbol: '^RUT',   naam: 'Russell 2000' },
          { symbol: '^TSX',   naam: 'TSX Composite' },
        ],
        'azie-pacific': [
          { symbol: '^N225',  naam: 'Nikkei 225' },
          { symbol: '^HSI',   naam: 'Hang Seng' },
          { symbol: '000001.SS', naam: 'Shanghai Composite' },
          { symbol: '^AXJO',  naam: 'ASX 200' },
          { symbol: '^KS11',  naam: 'KOSPI' },
        ],
      };
      const indices = indicesByRegio[regio] || indicesByRegio['lokaal'];
      try {
        const results = await Promise.all(indices.map(async (idx) => {
          try {
            const yahooSym = encodeURIComponent(idx.symbol);
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=5m&range=1d`;
            const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const d = await r.json();
            const meta = d?.chart?.result?.[0]?.meta || {};
            const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
            const validCloses = closes.filter(v => v !== null && v !== undefined);
            const prijs = meta.regularMarketPrice || meta.previousClose || 0;
            const prevClose = meta.previousClose || meta.chartPreviousClose || prijs;
            const change = prevClose ? ((prijs - prevClose) / prevClose) * 100 : 0;
            // Sparkline: laatste 20 datapunten
            const sparkline = validCloses.slice(-20).map(v => Math.round(v * 100) / 100);
            return { symbol: idx.symbol, naam: idx.naam, prijs, change, prevClose, sparkline };
          } catch (e) {
            return { symbol: idx.symbol, naam: idx.naam, prijs: 0, change: 0, prevClose: 0, sparkline: [] };
          }
        }));
        return res.json(results);
      } catch (e) {
        return res.json([]);
      }
    }

    // ── Marktnieuws ───────────────────────────────────────────────────────────
    if (endpoint === 'market-news') {
      try {
        const r = await fetch(
          `https://newsapi.org/v2/top-headlines?category=business&language=nl&pageSize=8&apiKey=${NEWSAPI_KEY}`
        );
        const d = await r.json();
        let artikelen = d?.articles || [];
        // Fallback: Engelstalig financieel nieuws
        if (artikelen.length === 0) {
          const r2 = await fetch(
            `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=8&apiKey=${NEWSAPI_KEY}`
          );
          const d2 = await r2.json();
          artikelen = d2?.articles || [];
        }
        const gefilterd = artikelen
          .filter(a => a.title && a.urlToImage)
          .slice(0, 6)
          .map(a => ({
            titel: a.title,
            beschrijving: a.description || '',
            url: a.url,
            afbeelding: a.urlToImage,
            bron: a.source?.name || '',
            datum: a.publishedAt,
          }));
        return res.json(gefilterd);
      } catch (e) {
        return res.json([]);
      }
    }


    // ── Aandelen regio: index candle + component quotes ───────────────────────
    if (endpoint === 'debug-version') {
      return res.json({ version: 'v14-alle-fixes', timestamp: new Date().toISOString() });
    }

    if (endpoint === 'aandelen-regio') {
      const { regio = 'belgie', subindex = 'bel20', periode = '1d' } = req.query;

      const componenten = {
        bel20: ['ABI.BR','ACKB.BR','AED.BR','AGS.BR','APAM.AS','ARGX.BR','AZE.BR','DIE.BR','ELI.BR','GBLB.BR','KBC.BR','LOTB.BR','MELE.BR','MONT.BR','SOLB.BR','SOF.BR','SYENS.BR','UCB.BR','UMI.BR','WDP.BR'],
        'bel-midcap': [
          'AGFB.BR',   // Agfa-Gevaert
          'ATEB.BR',   // Atenor
          'AZE.BR',    // Azelis
          'BAR.BR',    // Barco
          'BEKB.BR',   // Bekaert
          'BPOST.BR',  // Bpost
          'BREB.BR',   // Brederode
          'CPINV.BR',  // Care Property Invest
          'CFEB.BR',   // CFE
          'COMB.BR',   // Compagnie du Bois Sauvage
          'ECONB.BR',  // Econocom
          'EVS.BR',    // EVS Broadcast Equipment
          'FAGR.BR',   // Fagron
          'GIMB.BR',   // GIMV
          'HOMI.BR',   // Home Invest Belgium
          'IMMO.BR',   // Immobel
          'IBAB.BR',   // Ion Beam Applications
          'KIN.BR',    // Kinepolis
          'LOTB.BR',   // Lotus Bakeries
          'MELE.BR',   // Melexis
          'MONT.BR',   // Montea
          'ONTEX.BR',  // Ontex
          'OBEL.BR',   // Orange Belgium
          'RET.BR',    // Retail Estates
          'SHUR.BR',   // Shurgard
          'SIP.BR',    // Sipef
          'TESS.BR',   // Tessenderlo
          'TINC.BR',   // TINC
          'TITC.BR',   // Titan
          'XIOR.BR',   // Xior Student Housing
          'VIO.BR',    // Viohalco
          'CMBT.BR',   // CMB Tech
          'VGP.BR',    // VGP
          'COLR.BR',   // Colruyt
        ],
        'bel-smallcap': [
          'ACCE.BR',   // Accentis
          'CYAD.BR',   // Celyad Oncology
          'DECB.BR',   // Deceuninck
          'EKOP.BR',   // Ekopak
          'EXM.BR',    // Exmar
          'HYL.BR',    // Hyloris Pharmaceuticals
          'JEN.BR',   // Jensen-Group
          'NYR.BR',    // Nyrstar
          'NYXH.BR',   // Nyxoah
          'ONWD.BR',   // ONWARD Medical
          'OPTI.BR',   // Option
          'OXUR.BR',   // Oxurion
          'QRF.BR',    // Qrf
          'ROU.BR',    // Roularta Media Group
          'SEQM.BR',   // Sequana Medical
          'TEXF.BR',   // Texaf
          'VAN.BR',    // Van de Velde
          'VASTN.BR',  // Vastned
          'WEB.BR',    // Warehouses Estates Belgium
          'WEHB.BR',   // Wereldhave Belgium
        ],
        aex: ['ADYEN.AS','AGN.AS','AKZA.AS','ASML.AS','BESI.AS','DSFIR.AS','EXOR.AS','HEIA.AS','IMCD.AS','INGA.AS','KPN.AS','NN.AS','PHIA.AS','PRX.AS','RAND.AS','REN.AS','SHELL.AS','UNA.AS','URW.AS','WKL.AS'],
        sp500: [], // niet in gebruik
        nasdaq: [
          'NVDA','AAPL','MSFT','AMZN','GOOGL','GOOG','AVGO','TSLA','META','MU',
          'WMT','AMD','ASML','INTC','AMAT','LRCX','CSCO','ARM','COST','KLAC',
          'SNDK','NFLX','PLTR','TXN','MRVL','WDC','STX','QCOM','LIN','PANW',
          'ADI','TMUS','PEP','AMGN','CRWD','APP','GILD','ISRG','SHOP','BKNG',
          'SBUX','VRTX','PDD','CDNS','FTNT','MAR','CEG','MNST','ADP','SNPS',
          'CSX','ABNB','MELI','CMCSA','DDOG','NXPI','ADBE','MDLZ','MPWR','DASH',
          'ROST','INTC','ORLY','AEP','CINTAS','WBD','PCAR','REGN','BKR','MCHP',
          'FAST','FANG','EA','XEL','EXC','ODFL','TTWO','IDXX','CCEP','KDP',
          'ADSK','MSTR','PYPL','ALNY','PAYX','TRI','AXON','ROP','WDAY','GEHC',
          'CPRT','DXCM','KHC','VRSK','INSM','CTSH','ZS','CHTR','CSGP','WMT',
        ],
        nikkei: ['7203.T','9984.T','6758.T','8306.T','6861.T','7267.T','4063.T','6594.T','9433.T','8035.T'],
        hangseng: ['0700.HK','0941.HK','1299.HK','2318.HK','0005.HK','1398.HK','3690.HK','2020.HK','9988.HK','0388.HK'],
      };

      const indexSymbolen = {
        bel20: '^BFX', 'bel-midcap': 'BELM.BR', 'bel-smallcap': 'BELS.BR',
        aex: '^AEX', sp500: '^GSPC', nasdaq: '^NDX', nikkei: '^N225', hangseng: '^HSI',
      };

      // Grafiek interval+range (voor de index curve)
      const grafiekInterval = { '1d':'5m','1w':'1h','1m':'1d','3m':'1d','6m':'1wk','1j':'1wk','3j':'1mo','5j':'1mo','ytd':'1d','max':'3mo' }[periode] || '5m';
      const grafiekRange    = { '1d':'1d','1w':'5d','1m':'1mo','3m':'3mo','6m':'6mo','1j':'1y','3j':'3y','5j':'5y','ytd':'ytd','max':'max' }[periode] || '1d';

      const syms = componenten[subindex] || componenten['bel20'];
      const idxSym = indexSymbolen[subindex] || '^BFX';

      // ── Referentie range per periode voor component % berekening ────────────
      // Strategie: haal elke component op met range=X en gebruik:
      //   - meta.regularMarketPrice  → huidige live prijs
      //   - meta.chartPreviousClose  → slotkoers begin van de range (exact Saxo methode)
      // Yahoo's chartPreviousClose is de slotkoers net VOOR de gevraagde range → perfect.
      const nuMs = Date.now();
      const nuSec = Math.floor(nuMs / 1000);
      const SPD = 86400; // seconds per dag — aparte naam om naamconflict te vermijden

      // Bereken exacte maandag van huidige week in Brussels time (voor 1W)
      // Saxo "1W" = maandag t/m vandaag van de lopende beursweek
      // period1 timestamps voor 1j/3j/5j/max (range shorthand niet precies genoeg)
      // Enkel max gebruikt nog een timestamp — alle andere periodes via Yahoo range shorthand
      const periodeP1 = null; // alle periodes via range shorthand

      const gebruikTimestamp = periodeP1 !== null;
      const compRange = {
        '1d':  '1d',
        '1w':  '1wk',
        '1m':  '1mo',
        '3m':  '3mo',
        '6m':  '6mo',
        '1j':  '1y',
        '3j':  '3y',
        '5j':  '5y',
        'ytd': 'ytd',
        'max': '1d',   // Max: toon 1D change zoals Saxo
      }[periode] || null;

      try {
        // 1. Index candle data voor de grafiek
        const idxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(idxSym)}?interval=${grafiekInterval}&range=${grafiekRange}`;
        const idxRes = await fetch(idxUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const idxData = await idxRes.json();
        const idxResult = idxData?.chart?.result?.[0];
        const timestamps = idxResult?.timestamp || [];
        const closes = idxResult?.indicators?.quote?.[0]?.close || [];
        const prevClose = idxResult?.meta?.chartPreviousClose || idxResult?.meta?.previousClose || 0;
        const huidigePrijs = idxResult?.meta?.regularMarketPrice || 0;
        const grafiekData = timestamps.map((t, i) => ({
          t: t * 1000,
          v: closes[i] !== null && closes[i] !== undefined ? Math.round(closes[i] * 100) / 100 : null,
        })).filter(p => p.v !== null);

        // 2. Component quotes parallel — gebruik chartPreviousClose als referentie
        const fetchComp = (sym) => new Promise(async (resolve) => {
          const timer = setTimeout(() => resolve(null), 7000);
          try {
            // interval=1d — we gebruiken alleen meta.chartPreviousClose en regularMarketPrice
            const url = gebruikTimestamp
              ? `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&period1=${periodeP1}&period2=${nuSec}`
              : `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${compRange}`;
            const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            clearTimeout(timer);
            resolve(r);
          } catch { clearTimeout(timer); resolve(null); }
        });

const quoteResults = await Promise.all(syms.map(async (sym, idx) => {
          try {
            const r = await fetchComp(sym);
            if (!r) return null;
            const d = await r.json();
            const meta = d?.chart?.result?.[0]?.meta || {};
            const naamRaw = meta.longName || meta.shortName || sym;
            const naam = naamRaw.length > 22 ? naamRaw.slice(0, 21) + '…' : naamRaw;

            // Live prijs
            const prijs = meta.regularMarketPrice || 0;

            // Filter: als het aandeel niet lang genoeg genoteerd is voor deze periode → skip
            // IPO-filter: aandeel weggooien als het niet lang genoeg genoteerd was
            // Bereken verwachte startdatum op basis van periode
            const eersteTs = d?.chart?.result?.[0]?.timestamp?.[0] || 0;
            if (eersteTs > 0 && ['3j','5j'].includes(periode)) {
              const verwachtStartMs = {
                '3j':  nuMs - 3 * 366 * SPD * 1000,
                '5j':  nuMs - 5 * 366 * SPD * 1000,
              }[periode];
              // Tolerantie per periode: hoe langer de periode, hoe strikter
              // 5j: max 2 maanden tolerantie (Azelis IPO sept 2021 = 3 maanden na juni 2021 → gefilterd)
              // 3j: max 2 maanden tolerantie
              const tolerantieMs = 2 * 31 * SPD * 1000;
              if (eersteTs * 1000 > verwachtStartMs + tolerantieMs) return null;
            }

            // Referentieprijs: chartPreviousClose = slotkoers net vóór de gevraagde range/periode
            const referentie = meta.chartPreviousClose || meta.previousClose || prijs;
            const chg = referentie ? ((prijs - referentie) / referentie) * 100 : 0;



            return { symbol: sym, naam, prijs, change: chg, valuta: meta.currency || 'EUR' };
          } catch {
            return null;
          }
        }));

        const quotes = quoteResults.filter(Boolean);
        const gesorteerd = [...quotes].sort((a, b) => b.change - a.change);
        const stijgers = gesorteerd.slice(0, 5);
        const dalers   = [...gesorteerd].reverse().slice(0, 5);

        return res.json({ grafiek: grafiekData, prevClose, huidigePrijs, stijgers, dalers, alleQuotes: quotes });
      } catch (e) {
        console.error('aandelen-regio fout:', e);
        return res.json({ grafiek: [], prevClose: 0, huidigePrijs: 0, stijgers: [], dalers: [], alleQuotes: [] });
      }
    }

    // ── Belgisch marktoverzicht: stijgers/dalers 1D en 1M ────────────────────
    if (endpoint === 'belgisch-overzicht') {
      const ALLE_BEL_SYMS = [
        // BEL20
        'ABI.BR','ACKB.BR','AED.BR','AGS.BR','APAM.AS','ARGX.BR','AZE.BR',
        'DIE.BR','ELI.BR','GBLB.BR','KBC.BR','LOTB.BR','MELE.BR','MONT.BR',
        'SOLB.BR','SOF.BR','SYENS.BR','UCB.BR','UMI.BR','WDP.BR',
        // BEL Mid
        'AGFB.BR','ATEB.BR','BAR.BR','BEKB.BR','BPOST.BR','BREB.BR',
        'CPINV.BR','CFEB.BR','COMB.BR','ECONB.BR','EVS.BR','FAGR.BR',
        'GIMB.BR','IBAB.BR','KIN.BR','ONTEX.BR',
        'OBEL.BR','RET.BR','SHUR.BR','SIP.BR','TESS.BR','TINC.BR',
        'TITC.BR','XIOR.BR','CENER.BR','VGP.BR','COLR.BR',
        'TUB.BR','COFB.BR',
        // BEL Small
        'ACCE.BR','CYAD.BR','DECB.BR','EKOP.BR','EXM.BR','HYL.BR',
        'JEN.BR','NYR.BR','NYXH.BR','ONWD.BR','OPTI.BR','OXUR.BR',
        'QRF.BR','ROU.BR','SEQM.BR','TEXF.BR','VAN.BR','VASTN.BR',
        'WEB.BR','WEHB.BR',
      ];

      try {
        // Haal 1D en 1M data parallel op per aandeel
        const nuSec = Math.floor(Date.now() / 1000);
        const results = await Promise.all(ALLE_BEL_SYMS.map(async (sym) => {
          try {
            const [r1d, r1m] = await Promise.all([
              fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
              fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            ]);
            const [d1d, d1m] = await Promise.all([r1d.json(), r1m.json()]);
            const meta1d = d1d?.chart?.result?.[0]?.meta || {};
            const meta1m = d1m?.chart?.result?.[0]?.meta || {};
            const prijs = meta1d.regularMarketPrice || 0;
            const prev1d = meta1d.chartPreviousClose || meta1d.previousClose || prijs;
            const prev1m = meta1m.chartPreviousClose || meta1m.previousClose || prijs;
            const change1D = prev1d ? ((prijs - prev1d) / prev1d) * 100 : 0;
            const change1M = prev1m ? ((prijs - prev1m) / prev1m) * 100 : 0;
            const naamRaw = meta1d.longName || meta1d.shortName || sym;
            const naam = naamRaw.length > 24 ? naamRaw.slice(0, 23) + '…' : naamRaw;
            // Gemiddeld dagvolume 3 maanden → maat voor populariteit (zoals Saxo)
            const avgVol3M = meta1d.averageDailyVolume3Month || meta1d.averageDailyVolume10Day || 0;
            if (!prijs) return null;
            return { symbol: sym, naam, prijs, change1D, change1M, avgVol3M, valuta: meta1d.currency || 'EUR' };
          } catch { return null; }
        }));

        const quotes = results.filter(Boolean);

        // 1. Populariteit: top 5 op gemiddeld volume 3M (geen filter op richting)
        const populariteit = [...quotes]
          .sort((a, b) => b.avgVol3M - a.avgVol3M)
          .slice(0, 5);

        // 2. Stijgers/dalers 1M: gesorteerd op echte %1M prestatie
        const sort1M = [...quotes].sort((a, b) => b.change1M - a.change1M);
        const stijgers1M = sort1M.slice(0, 5);
        const dalers1M   = sort1M.slice(-5).reverse();

        return res.json({ populariteit, stijgers1M, dalers1M });
      } catch (e) {
        return res.json({ stijgers1D: [], dalers1D: [], stijgers1M: [], dalers1M: [] });
      }
    }

    // ── Markten overzicht: stijgers/dalers/populair BE + internationaal ────────
    if (endpoint === 'markten-overzicht') {
      const BLOB_KEY_OVERZICHT = 'markten-overzicht-cache.json';

      // Alle publieke Belgische aandelen: BEL20 + BEL Mid + BEL Small
      const ALLE_BEL = [
        // BEL20
        'ABI.BR','ACKB.BR','AED.BR','AGS.BR','APAM.AS','ARGX.BR','AZE.BR',
        'DIE.BR','ELI.BR','GBLB.BR','KBC.BR','LOTB.BR','MELE.BR','MONT.BR',
        'SOLB.BR','SOF.BR','SYENS.BR','UCB.BR','UMI.BR','WDP.BR',
        // BEL Mid
        'AGFB.BR','ATEB.BR','BAR.BR','BEKB.BR','BPOST.BR','BREB.BR',
        'CPINV.BR','CFEB.BR','COMB.BR','ECONB.BR','EVS.BR','FAGR.BR',
        'GIMB.BR','HOMI.BR','IMMO.BR','IBAB.BR','KIN.BR','ONTEX.BR',
        'OBEL.BR','RET.BR','SHUR.BR','SIP.BR','TESS.BR','TINC.BR',
        'TITC.BR','XIOR.BR','VIO.BR','CENER.BR','VGP.BR','COLR.BR',
        'TUB.BR','COFB.BR','CMBT.BR',
        // BEL Small
        'ACCE.BR','CYAD.BR','DECB.BR','EKOP.BR','EXM.BR','HYL.BR',
        'JEN.BR','NYR.BR','NYXH.BR','ONWD.BR','OPTI.BR','OXUR.BR',
        'QRF.BR','ROU.BR','SEQM.BR','TEXF.BR','VAN.BR','VASTN.BR',
        'WEB.BR','WEHB.BR',
      ];

      // Volgorde = populariteit op Saxo (handmatig bepaald op basis van volume/bekendheid)
      const INTL = [
        'SPCX','NVDA','MU','MSFT','INTC',
        'AAPL','AMZN','META','GOOGL','TSLA',
        'AMD','AVGO','ARM','PLTR','AMAT',
        'ASML','NFLX','WMT','COST','TXN',
      ];

      try {
        // Probeer live data op te halen
        const haaldataOp = async () => {
          const belResults = await Promise.all(ALLE_BEL.map(async (sym) => {
            try {
              // Gebruik chart API met range=5d → geeft altijd data, ook buiten beursurenre
              const r = await fetch(
                `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d`,
                { headers: { 'User-Agent': 'Mozilla/5.0' } }
              );
              const d = await r.json();
              const meta = d?.chart?.result?.[0]?.meta || {};
              const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
              const valids = closes.filter(v => v !== null && v !== undefined);
              const prijs = meta.regularMarketPrice || (valids.length > 0 ? valids[valids.length-1] : 0);
              const prev = meta.chartPreviousClose || meta.previousClose || prijs;
              const change1D = prev ? ((prijs - prev) / prev) * 100 : 0;
              const avgVol3M = meta.averageDailyVolume3Month || meta.averageDailyVolume10Day || 0;
              const marketCap = meta.marketCap || 0;
              const naamRaw = meta.longName || meta.shortName || sym;
              const naam = naamRaw.length > 16 ? naamRaw.slice(0, 15) + '…' : naamRaw;
              if (!prijs) return null;
              return { symbol: sym, naam, prijs, change1D, avgVol3M, marketCap, valuta: meta.currency || 'EUR' };
            } catch { return null; }
          }));

          const belQuotes = belResults.filter(Boolean);
          const sort1D = [...belQuotes].sort((a, b) => b.change1D - a.change1D);
          const stijgersBE = sort1D.filter(q => q.change1D > 0).slice(0, 5);
          const dalersBE = [...sort1D].reverse().filter(q => q.change1D < 0).slice(0, 5);
          const populairBE = [...belQuotes].sort((a, b) => b.avgVol3M - a.avgVol3M).slice(0, 5);

          const intlResults = await Promise.all(INTL.map(async (sym) => {
            try {
              const r = await fetch(
                `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d`,
                { headers: { 'User-Agent': 'Mozilla/5.0' } }
              );
              const d = await r.json();
              const meta = d?.chart?.result?.[0]?.meta || {};
              const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
              const valids = closes.filter(v => v !== null && v !== undefined);
              const prijs = meta.regularMarketPrice || (valids.length > 0 ? valids[valids.length-1] : 0);
              const prev = meta.chartPreviousClose || meta.previousClose || prijs;
              const change1D = prev ? ((prijs - prev) / prev) * 100 : 0;
              const avgVol3M = meta.averageDailyVolume3Month || meta.averageDailyVolume10Day || 0;
              const naamRaw = meta.longName || meta.shortName || sym;
              const naam = naamRaw.length > 16 ? naamRaw.slice(0, 15) + '…' : naamRaw;
              if (!prijs) return null;
              return { symbol: sym, naam, prijs, change1D, avgVol3M, valuta: meta.currency || 'USD' };
            } catch { return null; }
          }));

          const intlQuotes = intlResults.filter(Boolean);
          const populairIntl = [...intlQuotes].sort((a, b) => b.avgVol3M - a.avgVol3M).slice(0, 5);

          return { stijgersBE, dalersBE, populairBE, populairIntl };
        };

        const nieuweData = await haaldataOp();

        // Controleer of we geldige data hebben (niet leeg)
        const heeftData = nieuweData.stijgersBE.length > 0 || nieuweData.dalersBE.length > 0;

        if (heeftData) {
          return res.json(nieuweData);
        } else {
          return res.json({ stijgersBE: [], dalersBE: [], populairBE: [], populairIntl: [] });
        }
      } catch (e) {
        return res.json({ stijgersBE: [], dalersBE: [], populairBE: [], populairIntl: [] });
      }
    }

    // ── ETF pagina ────────────────────────────────────────────────────────────
    if (endpoint === 'etfs') {
      const { categorie = 'aandelen' } = req.query;

      // ETFs gesorteerd op beheerd vermogen (AUM) — grootste eerst
      // Alle genoteerd op Euronext Amsterdam (.AS) voor Belgische beleggers
      // ETF lijsten: ALLE aandelen ETFs van Saxo Investor
      const ETF_LIJSTEN = {
        aandelen: [
          // Gesorteerd op beheerd vermogen (AUM) - grootste eerst
          // Mega AUM (>100 mld USD)
          'IVV','SPY','VOO','VTI','QQQ','VEA','IUSQ.DE',
          // Large AUM (10-100 mld)
          'MMLP.MI','AMLP',
          'IWDA.AS','EUNL.DE','SWDA.MI','CSPX.AS','SXR8.DE','VWCE.DE','VWCE.AS',
          'VWO','VUSA.AS','VUSA.L','VUAA.DE','IS3N.DE','EMIM.L','EIMI.SW','EMIM.AS','EIMI.MI',
          'VXUS','VGK','VNQ','VPL','VWRL.AS','SCHD','VT',
          'IUSA.AS','IVV','CSPX.L','SPY5.AS','SWRD.AS','SWRD.DE',
          // Medium AUM (1-10 mld)
          'CNDX.AS','CNDX.PA','CNX1.L','ANAV.DE','PRIW.DE','WEBN.DE','F50A.DE',
          'LYMS.DE','ACWD.PA','SPYX.DE','FWIA.DE','PRIW.DE',
          'SMEA.AS','SMEA.MI','IEUA.AS','VHYL.AS','VFEM.AS',
          'SAEM.DE','SAEM.MI','AEEM.PA',
          'IWVL.DE','IWVL.MI','IWMO.DE','IS3Q.DE','MVOL.DE','MVEA.DE',
          'SEMI.DE','SEMI.MI','SEMI.AS','SMH','SMH.DE','SMH.MI','SOXX',
          'XDWD.DE','XZWD.DE','XSPX.DE','XEQW.DE','XDWU.DE',
          'EXV1.DE','EXSA.DE',
          'IITU.DE','IITU.SW','IYW','IGV',
          'WSML.DE','IUSQ.DE','ICLN','CLEA.MI',
          'GDX.MI',
          'DFNS.DE','DFNS.MI','WDEF.DE',
          '2B76.DE','RBOT.SW','RBOT.DE','ECAR.MI','AGED.MI',
          'BATT.MI','RENW.MI','GLGG.MI',
          'XAIX.DE','XAIX.MI','INDA','IIND.DE',
          'IJPA.MI','EXS2.DE','IJSE.DE','IJPN.AS',
          'IAEX.AS','EUEA.AS','SXRT.DE','CSSX5E.MI','EXV1.DE','ISF.SW','CUKX.SW','H50E.SW',
          'TDIV.AS','TGET.AS','TRET.AS',
          'VUKE.L','VGK','IEUA.AS','EUSC.DE','IESE.DE',
          // Sector & thema
          'XLE','XLI','WTCH.AS','COPX','4COP.DE','COPX.DE',
          'NUCL.DE','URA','SLVR.DE','SILV.DE','REMX.DE','TMET.MI',
          'DAPP.DE','BCHS.L','BCHN.MI','EMQP.L','EMQQ.DE',
          'ESPO.MI','SPCE.DE','XNET.MI',
          'FCBR.L','CIBR.MI','FSKY.L','FSKY.MI','FGRD.L','GRID.DE','GRID.MI',
          'IGF','INFR.MI','IPRV.SW','GLRE.L',
          'ICGA.AS','AAXJ','EWY','IESH.MI',
          'QDVA.DE','EMUE.DE','WQDE.DE','IWDE.DE','IWDH.MI',
          'TNOW.PA','CW8.PA','MWRD.PA','CNDX.PA',
          'MEUD.L','MEUD.PA','LYP6.DE','DEFS.PA','ETZ.PA','ESE.PA','PABUS.MI','PAPU.MI','PAEEM.PA','PAASI.PA','PUST.PA','PANXG.PA',
          'LYSP5.SW','C6E.SW','C6E.PA','AME6.DE','AME6.F','CSE6.SW','PABG.L','EPAB.PA','PAEP.L',
          'BJLE.F','BLUE.PA','BJLE.DE','EBLU.DE','EPEJ.PA','BPAC.PA','EMEC.DE','REUSE.PA','CEUD.MI','ENG.PA','EENG.MI','BINFG.MI',
          'JPCT.MI','JPCS.MI','JREU.MI',
          'IHI','MLPQ.L','MLPX.MI',
          'V3AA.AS','VFEM.AS','GREP.SW','EWLD.L',
          'JPSR.SW','PCSR.AS','CHSR.SW','UKSR.L','SP5H.MI',
          'LVLC.L','LVLC.F','IGDA.DE','IQSA.MI','IQSA.DE','IGAE.DE','NESG.MI','EQQQ.MI',
          'CHDVD.SW','SPAG.L','ISAG.MI','SPAG.MI','EMUE.DE',
          'XMJP.DE','XZWD.DE','XMUS.L','XMUK.L',
          'IESE.DE','IWY','SCHD',
        ],
        obligaties: [
          'AGGH.AS','IEAG.AS','IEGA.AS','XGSH.AS','IBGL.AS','EUNH.AS',
          'IBTS.AS','IEAC.AS','IUSB.AS','SUZE.AS','IBCI.AS','VGOV.AS','SEGA.AS','EUNA.AS',
          'IHYG.AS','SHYG.AS','IEMB.AS','VDEA.AS','ITPS.AS','AGGU.AS','FLOT.AS',
          'GOVS.AS','CORP.AS','HYLD.AS','EMBE.AS','XUHY.AS','IBTE.AS',
        ],
        gemengd: [
          'VNGA80.AS','VNGA60.AS','VNGA40.AS','VNGA20.AS','IMAP.AS','FLXA.AS',
          'XDEB.DE','MACK.DE',
        ],
        valuta: [
          'SGLD.AS','PHGP.AS','VZLD.AS','4GLD.AS','SSLV.AS','PHPT.AS',
          'PHPM.AS','ICOM.AS','CMOD.AS','LCOP.AS','GLDM','GLD','SLV','PPLT',
        ],
      };


      // Hardcoded TER en TOB lookup
      // TOB: 0.12% voor UCITS ETFs (IE/LU domicilie)
      //      1.32% voor niet-UCITS US ETFs (SPY, IVV, VOO, QQQ, VTI etc.)
      const ETF_META = {
        // Mega cap US ETFs (niet-UCITS → TOB 1.32%)
        'IVV':    { ter: 0.03, tob: 0.35 },
        'SPY':    { ter: 0.09, tob: 0.35 },
        'VOO':    { ter: 0.03, tob: 0.35 },
        'VTI':    { ter: 0.03, tob: 0.35 },
        'QQQ':    { ter: 0.20, tob: 0.35 },
        'VEA':    { ter: 0.05, tob: 0.35 },
        'VWO':    { ter: 0.08, tob: 0.35 },
        'VGK':    { ter: 0.09, tob: 0.35 },
        'VNQ':    { ter: 0.12, tob: 0.35 },
        'VPL':    { ter: 0.08, tob: 0.35 },
        'VXUS':   { ter: 0.07, tob: 0.35 },
        'VT':     { ter: 0.07, tob: 0.35 },
        'SCHD':   { ter: 0.06, tob: 0.35 },
        'SOXX':   { ter: 0.35, tob: 0.35 },
        'SMH':    { ter: 0.35, tob: 0.35 },
        'AMLP':   { ter: 0.85, tob: 0.35 },
        'ICLN':   { ter: 0.40, tob: 0.35 },
        'IGV':    { ter: 0.41, tob: 0.35 },
        'IGF':    { ter: 0.40, tob: 0.35 },
        'IHI':    { ter: 0.40, tob: 0.35 },
        'IYW':    { ter: 0.40, tob: 0.35 },
        'INDA':   { ter: 0.65, tob: 0.35 },
        'EWY':    { ter: 0.57, tob: 0.35 },
        'AAXJ':   { ter: 0.69, tob: 0.35 },
        'COPX':   { ter: 0.65, tob: 0.35 },
        'URA':    { ter: 0.69, tob: 0.35 },
        'XLE':    { ter: 0.09, tob: 0.35 },
        'XLI':    { ter: 0.09, tob: 0.35 },
        // UCITS ETFs (IE/LU domicilie → TOB 0.12%)
        'VWCE.DE':  { ter: 0.22, tob: 0.12 },
        'VWCE.AS':  { ter: 0.22, tob: 0.12 },
        'VWCE.MI':  { ter: 0.22, tob: 0.12 },
        'IWDA.AS':  { ter: 0.20, tob: 0.12 },
        'EUNL.DE':  { ter: 0.20, tob: 0.12 },
        'SWDA.MI':  { ter: 0.20, tob: 0.12 },
        'CSPX.AS':  { ter: 0.07, tob: 0.12 },
        'SXR8.DE':  { ter: 0.07, tob: 0.12 },
        'CSPX.L':   { ter: 0.07, tob: 0.12 },
        'IUSA.AS':  { ter: 0.07, tob: 0.12 },
        'EMIM.L':   { ter: 0.18, tob: 0.12 },
        'EIMI.SW':  { ter: 0.18, tob: 0.12 },
        'EMIM.AS':  { ter: 0.18, tob: 0.12 },
        'EIMI.MI':  { ter: 0.18, tob: 0.12 },
        'IS3N.DE':  { ter: 0.18, tob: 0.12 },
        'SWRD.AS':  { ter: 0.12, tob: 0.12 },
        'SWRD.DE':  { ter: 0.12, tob: 0.12 },
        'VUSA.AS':  { ter: 0.07, tob: 0.12 },
        'VUSA.L':   { ter: 0.07, tob: 0.12 },
        'VUAA.DE':  { ter: 0.07, tob: 0.12 },
        'VWRL.AS':  { ter: 0.22, tob: 0.12 },
        'LYMS.DE':  { ter: 0.22, tob: 0.12 },
        'ACWD.PA':  { ter: 0.17, tob: 0.12 },
        'PRIW.DE':  { ter: 0.05, tob: 0.12 },
        'WEBN.DE':  { ter: 0.07, tob: 0.12 },
        'F50A.DE':  { ter: 0.05, tob: 0.12 },
        'SMEA.AS':  { ter: 0.12, tob: 0.12 },
        'SMEA.MI':  { ter: 0.12, tob: 0.12 },
        'IEUA.AS':  { ter: 0.12, tob: 0.12 },
        'VHYL.AS':  { ter: 0.29, tob: 0.12 },
        'VFEM.AS':  { ter: 0.22, tob: 0.12 },
        'SAEM.DE':  { ter: 0.18, tob: 0.12 },
        'SAEM.MI':  { ter: 0.18, tob: 0.12 },
        'AEEM.PA':  { ter: 0.20, tob: 0.12 },
        'IWVL.DE':  { ter: 0.25, tob: 0.12 },
        'IWVL.MI':  { ter: 0.25, tob: 0.12 },
        'IWMO.DE':  { ter: 0.25, tob: 0.12 },
        'IS3Q.DE':  { ter: 0.25, tob: 0.12 },
        'MVOL.DE':  { ter: 0.35, tob: 0.12 },
        'MVEA.DE':  { ter: 0.20, tob: 0.12 },
        'SEMI.DE':  { ter: 0.35, tob: 0.12 },
        'SEMI.MI':  { ter: 0.35, tob: 0.12 },
        'SEMI.AS':  { ter: 0.35, tob: 0.12 },
        'SMH.DE':   { ter: 0.35, tob: 0.12 },
        'SMH.MI':   { ter: 0.35, tob: 0.12 },
        'XDWD.DE':  { ter: 0.20, tob: 0.12 },
        'XZWD.DE':  { ter: 0.20, tob: 0.12 },
        'XSPX.DE':  { ter: 0.05, tob: 0.12 },
        'XEQW.DE':  { ter: 0.20, tob: 0.12 },
        'XDWU.DE':  { ter: 0.25, tob: 0.12 },
        'EXV1.DE':  { ter: 0.51, tob: 0.12 },
        'EXSA.DE':  { ter: 0.20, tob: 0.12 },
        'IITU.DE':  { ter: 0.15, tob: 0.12 },
        'IITU.SW':  { ter: 0.15, tob: 0.12 },
        'WSML.DE':  { ter: 0.35, tob: 0.12 },
        'IUSQ.DE':  { ter: 0.20, tob: 0.12 },
        'CLEA.MI':  { ter: 0.65, tob: 0.12 },
        'GDX.MI':   { ter: 0.51, tob: 0.12 },
        'DFNS.DE':  { ter: 0.49, tob: 0.12 },
        'DFNS.MI':  { ter: 0.49, tob: 0.12 },
        'WDEF.DE':  { ter: 0.40, tob: 0.12 },
        '2B76.DE':  { ter: 0.40, tob: 0.12 },
        'RBOT.SW':  { ter: 0.40, tob: 0.12 },
        'RBOT.DE':  { ter: 0.40, tob: 0.12 },
        'ECAR.MI':  { ter: 0.40, tob: 0.12 },
        'AGED.MI':  { ter: 0.40, tob: 0.12 },
        'BATT.MI':  { ter: 0.49, tob: 0.12 },
        'RENW.MI':  { ter: 0.49, tob: 0.12 },
        'GLGG.MI':  { ter: 0.49, tob: 0.12 },
        'XAIX.DE':  { ter: 0.35, tob: 0.12 },
        'XAIX.MI':  { ter: 0.35, tob: 0.12 },
        'IIND.DE':  { ter: 0.65, tob: 0.12 },
        'IJPA.MI':  { ter: 0.12, tob: 0.12 },
        'EXS2.DE':  { ter: 0.12, tob: 0.12 },
        'IJSE.DE':  { ter: 0.12, tob: 0.12 },
        'IJPN.AS':  { ter: 0.12, tob: 0.12 },

        'IAEX.AS':  { ter: 0.30, tob: 0.12 },
        'EUEA.AS':  { ter: 0.10, tob: 0.12 },
        'SXRT.DE':  { ter: 0.10, tob: 0.12 },
        'CSSX5E.MI':{ ter: 0.10, tob: 0.12 },
        'TDIV.AS':  { ter: 0.38, tob: 0.12 },
        'TGET.AS':  { ter: 0.29, tob: 0.12 },
        'TRET.AS':  { ter: 0.25, tob: 0.12 },
        'VUKE.L':   { ter: 0.09, tob: 0.12 },
        'EUSC.DE':  { ter: 0.20, tob: 0.12 },
        'IESE.DE':  { ter: 0.20, tob: 0.12 },
        '4COP.DE':  { ter: 0.65, tob: 0.12 },
        'COPX.DE':  { ter: 0.65, tob: 0.12 },
        'SLVR.DE':  { ter: 0.65, tob: 0.12 },
        'SILV.DE':  { ter: 0.65, tob: 0.12 },
        'NUCL.DE':  { ter: 0.49, tob: 0.12 },
        'REMX.DE':  { ter: 0.57, tob: 0.12 },
        'TMET.MI':  { ter: 0.50, tob: 0.12 },
        'DAPP.DE':  { ter: 0.65, tob: 0.12 },
        'BCHS.L':   { ter: 0.65, tob: 0.12 },
        'BCHN.MI':  { ter: 0.65, tob: 0.12 },
        'EMQP.L':   { ter: 0.86, tob: 0.12 },
        'EMQQ.DE':  { ter: 0.86, tob: 0.12 },
        'ESPO.MI':  { ter: 0.55, tob: 0.12 },
        'SPCE.DE':  { ter: 0.40, tob: 0.12 },
        'FCBR.L':   { ter: 0.60, tob: 0.12 },
        'CIBR.MI':  { ter: 0.60, tob: 0.12 },
        'FSKY.L':   { ter: 0.60, tob: 0.12 },
        'FSKY.MI':  { ter: 0.60, tob: 0.12 },
        'FGRD.L':   { ter: 0.60, tob: 0.12 },
        'GRID.DE':  { ter: 0.60, tob: 0.12 },
        'GRID.MI':  { ter: 0.60, tob: 0.12 },
        'INFR.MI':  { ter: 0.65, tob: 0.12 },
        'IPRV.SW':  { ter: 0.75, tob: 0.12 },
        'ICGA.AS':  { ter: 0.65, tob: 0.12 },
        'QDVA.DE':  { ter: 0.20, tob: 0.12 },
        'EMUE.DE':  { ter: 0.18, tob: 0.12 },
        'WQDE.DE':  { ter: 0.38, tob: 0.12 },
        'IWDE.DE':  { ter: 0.20, tob: 0.12 },
        'IWDH.MI':  { ter: 0.55, tob: 0.12 },
        'CNDX.AS':  { ter: 0.33, tob: 0.12 },
        'ANAV.DE':  { ter: 0.14, tob: 0.12 },
        'MEUD.L':   { ter: 0.07, tob: 0.12 },
        'MEUD.PA':  { ter: 0.07, tob: 0.12 },
        'LYP6.DE':  { ter: 0.07, tob: 0.12 },
        'DEFS.PA':  { ter: 0.16, tob: 0.12 },
        'ETZ.PA':   { ter: 0.19, tob: 0.12 },
        'ESE.PA':   { ter: 0.19, tob: 0.12 },
        'PABUS.MI': { ter: 0.07, tob: 0.12 },
        'PAPU.MI':  { ter: 0.07, tob: 0.12 },
        'C6E.SW':   { ter: 0.18, tob: 0.12 },
        'C6E.PA':   { ter: 0.18, tob: 0.12 },
        'AME6.DE':  { ter: 0.18, tob: 0.12 },
        'AME6.F':   { ter: 0.18, tob: 0.12 },
        'CSE6.SW':  { ter: 0.18, tob: 0.12 },
        'FWIA.DE':  { ter: 0.15, tob: 0.12 },
        'LVLC.L':   { ter: 0.25, tob: 0.12 },
        'LVLC.F':   { ter: 0.25, tob: 0.12 },
        'IGDA.DE':  { ter: 0.30, tob: 0.12 },
        'IQSA.MI':  { ter: 0.30, tob: 0.12 },
        'IQSA.DE':  { ter: 0.30, tob: 0.12 },
        'IGAE.DE':  { ter: 0.30, tob: 0.12 },
        'NESG.MI':  { ter: 0.25, tob: 0.12 },
        'EQQQ.MI':  { ter: 0.25, tob: 0.12 },
        'CHDVD.SW': { ter: 0.15, tob: 0.12 },
        'SPAG.L':   { ter: 0.55, tob: 0.12 },
        'ISAG.MI':  { ter: 0.55, tob: 0.12 },
        'SPAG.MI':  { ter: 0.55, tob: 0.12 },
        'V3AA.AS':  { ter: 0.24, tob: 0.12 },
        'MMLP.MI':  { ter: 0.40, tob: 0.12 },
        'MLPQ.L':   { ter: 0.45, tob: 0.12 },
        'MLPX.MI':  { ter: 0.45, tob: 0.12 },
        'GREP.SW':  { ter: 0.25, tob: 0.12 },
        'EWLD.L':   { ter: 0.12, tob: 0.12 },
        'JPSR.SW':  { ter: 0.15, tob: 0.12 },
        'PCSR.AS':  { ter: 0.15, tob: 0.12 },
        'CHSR.SW':  { ter: 0.15, tob: 0.12 },
        'UKSR.L':   { ter: 0.23, tob: 0.12 },
        'SP5H.MI':  { ter: 0.25, tob: 0.12 },
        'JPCT.MI':  { ter: 0.19, tob: 0.12 },
        'JPCS.MI':  { ter: 0.55, tob: 0.12 },
        'JREU.MI':  { ter: 0.25, tob: 0.12 },
        'H50E.SW':  { ter: 0.05, tob: 0.12 },
        'ISEH.MI':  { ter: 0.20, tob: 0.12 },
        'PAEEM.PA': { ter: 0.17, tob: 0.12 },
        'PAASI.PA': { ter: 0.25, tob: 0.12 },
        'PANXG.PA': { ter: 0.15, tob: 0.12 },
        'ANX.MI':   { ter: 0.22, tob: 0.12 },
        'LYMS.DE':  { ter: 0.22, tob: 0.12 },
        'LYMS.MI':  { ter: 0.22, tob: 0.12 },
        'LYMS.PA':  { ter: 0.22, tob: 0.12 },
        'CNDX.PA':  { ter: 0.10, tob: 0.12 },
        'CW8.PA':   { ter: 0.38, tob: 0.12 },
        'MWRD.PA':  { ter: 0.12, tob: 0.12 },
        'TNOW.PA':  { ter: 0.18, tob: 0.12 },
        'AEEM.PA':  { ter: 0.20, tob: 0.12 },
        'EMEC.DE':  { ter: 0.30, tob: 0.12 },
        'REUSE.PA': { ter: 0.30, tob: 0.12 },
        'CEUD.MI':  { ter: 0.30, tob: 0.12 },
        'BJLE.F':   { ter: 0.30, tob: 0.12 },
        'BLUE.PA':  { ter: 0.30, tob: 0.12 },
        'BJLE.DE':  { ter: 0.30, tob: 0.12 },
        'EBLU.DE':  { ter: 0.30, tob: 0.12 },
        'EPEJ.PA':  { ter: 0.15, tob: 0.12 },
        'BPAC.PA':  { ter: 0.15, tob: 0.12 },
        'ENG.PA':   { ter: 0.31, tob: 0.12 },
        'EENG.MI':  { ter: 0.31, tob: 0.12 },
        'BINFG.MI': { ter: 0.40, tob: 0.12 },
        'XMJP.DE':  { ter: 0.20, tob: 0.12 },
        'XZWD.DE':  { ter: 0.20, tob: 0.12 },
        'SPY5.AS':  { ter: 0.03, tob: 0.12 },
        'VNGA80.AS':{ ter: 0.25, tob: 0.12 },
        'VNGA60.AS':{ ter: 0.25, tob: 0.12 },
        'VNGA40.AS':{ ter: 0.25, tob: 0.12 },
        'VNGA20.AS':{ ter: 0.25, tob: 0.12 },
        // Obligatie ETFs
        'AGGH.AS':  { ter: 0.10, tob: 0.12 },
        'IEAG.AS':  { ter: 0.17, tob: 0.12 },
        'IEGA.AS':  { ter: 0.09, tob: 0.12 },
        'XGSH.AS':  { ter: 0.15, tob: 0.12 },
        'IBGL.AS':  { ter: 0.20, tob: 0.12 },
        'EUNH.AS':  { ter: 0.09, tob: 0.12 },
        'IBTS.AS':  { ter: 0.20, tob: 0.12 },
        'IEAC.AS':  { ter: 0.20, tob: 0.12 },
        'IUSB.AS':  { ter: 0.25, tob: 0.12 },
        'SUZE.AS':  { ter: 0.09, tob: 0.12 },
        'IBCI.AS':  { ter: 0.09, tob: 0.12 },
        'VGOV.AS':  { ter: 0.07, tob: 0.12 },
        'SEGA.AS':  { ter: 0.15, tob: 0.12 },
        'EUNA.AS':  { ter: 0.20, tob: 0.12 },
        'IHYG.AS':  { ter: 0.50, tob: 0.12 },
        'SHYG.AS':  { ter: 0.40, tob: 0.12 },
        'IEMB.AS':  { ter: 0.45, tob: 0.12 },
        'VDEA.AS':  { ter: 0.25, tob: 0.12 },
        'ITPS.AS':  { ter: 0.10, tob: 0.12 },
        // Valuta ETFs
        'SGLD.AS':  { ter: 0.15, tob: 0.12 },
        'PHGP.AS':  { ter: 0.15, tob: 0.12 },
        'VZLD.AS':  { ter: 0.15, tob: 0.12 },
        'SSLV.AS':  { ter: 0.20, tob: 0.12 },
        'PHPT.AS':  { ter: 0.20, tob: 0.12 },
        'PHPM.AS':  { ter: 0.20, tob: 0.12 },
        'LCOP.AS':  { ter: 0.49, tob: 0.12 },
        'GLDM':     { ter: 0.10, tob: 0.35 },
        'GLD':      { ter: 0.40, tob: 0.35 },
        'SLV':      { ter: 0.50, tob: 0.35 },
        'PPLT':     { ter: 0.60, tob: 0.35 },
      };
      const { toonAlles = 'false' } = req.query;
      const syms = ETF_LIJSTEN[categorie] || ETF_LIJSTEN['aandelen'];

      try {
        const results = await Promise.all(syms.map(async (sym) => {
          try {
            const [r1d, r1m, r3m, r1j, r5j, rAum] = await Promise.all([
              fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
              fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
              fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=3mo`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
              fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1wk&range=1y`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
              fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1mo&range=5y`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
              fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=summaryDetail`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            ]);

            const [d1d, d1m, d3m, d1j, d5j, dAum] = await Promise.all([r1d.json(), r1m.json(), r3m.json(), r1j.json(), r5j.json(), rAum.json()]);

            const meta = d1d?.chart?.result?.[0]?.meta || {};
            const prijs = meta.regularMarketPrice || 0;
            if (!prijs) return null;

            // Beheerd vermogen via quoteSummary
            const totalAssets = dAum?.quoteSummary?.result?.[0]?.summaryDetail?.totalAssets?.raw || 0;

            const pct1D = (() => {
              const p = meta.regularMarketPrice || 0;
              const ref = meta.chartPreviousClose || meta.previousClose || p;
              return ref ? ((p - ref) / ref) * 100 : 0;
            })();

            const pctLang = (d) => {
              const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
              const valids = closes.filter(v => v !== null && v !== undefined);
              if (valids.length < 2) return null;
              return ((valids[valids.length-1] - valids[0]) / valids[0]) * 100;
            };

            const naamRaw = meta.longName || meta.shortName || sym;
            const naamVolledig = naamRaw;
            const naam = naamRaw.length > 40 ? naamRaw.slice(0, 39) + '…' : naamRaw;

            // TER en TOB via hardcoded lookup tabel
            const metaLookup = ETF_META[sym] || {};
            const ter = metaLookup.ter ?? null;
            const tob = metaLookup.tob ?? 0.12;

            // Beurs naam en status
            const exchangeMap = {
              'AMS': 'Euronext Amsterdam', 'EPA': 'Euronext Paris', 'PAR': 'Euronext Paris',
              'ETR': 'Xetra', 'XETR': 'Xetra', 'GER': 'Xetra',
              'MIL': 'Euronext Milan', 'BIT': 'Euronext Milan',
              'LSE': 'London SE', 'IOB': 'London SE',
              'SWX': 'SIX Swiss', 'VTX': 'SIX Swiss',
              'NMS': 'Nasdaq', 'NGM': 'Nasdaq', 'PCX': 'NYSE Arca', 'NYQ': 'NYSE',
            };
            const exchCode = (meta.exchangeName || meta.fullExchangeName || '').toUpperCase();
            const beurs = exchangeMap[exchCode] || meta.fullExchangeName || meta.exchangeName || '—';
            const marktOpen = meta.marketState === 'REGULAR';

            if (!prijs) return null;

            return {
              symbol: sym, naam, naamVolledig, prijs,
              valuta: meta.currency || 'EUR',
              totalAssets, ter, tob, beurs, marktOpen,
              pct1D, pct1M: pctLang(d1m), pct3M: pctLang(d3m),
              pct1J: pctLang(d1j), pct5J: pctLang(d5j),
            };
          } catch { return null; }
        }));

        // Sorteer op beheerd vermogen (grootste eerst)
        // Als totalAssets beschikbaar is → gebruik die, anders behoud volgorde van de lijst (al gesorteerd op AUM)
        const filtered = results.filter(Boolean);
        const heeftAum = filtered.some(e => e.totalAssets > 0);
        const gesorteerd = heeftAum
          ? filtered.sort((a, b) => b.totalAssets - a.totalAssets)
          : filtered; // lijst staat al in AUM volgorde

        // Top 10 of alles tonen
        const output = toonAlles === 'true' ? gesorteerd : gesorteerd.slice(0, 10);
        return res.json(output);
      } catch (e) {
        return res.json([]);
      }
    }
    return res.status(400).json({ error: 'Onbekend endpoint' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server fout: ' + err.message });
  }
}
