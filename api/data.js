// v6-1W-fix
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
      return res.json({ version: 'v6-1W-fix', timestamp: new Date().toISOString() });
    }

    if (endpoint === 'aandelen-regio') {
      const { regio = 'belgie', subindex = 'bel20', periode = '1d' } = req.query;

      const componenten = {
        bel20: ['ABI.BR','ACKB.BR','AED.BR','AGS.BR','APAM.AS','ARGX.BR','AZE.BR','DIE.BR','ELI.BR','GBLB.BR','KBC.BR','LOTB.BR','MELE.BR','MONT.BR','SOLB.BR','SOF.BR','SYENS.BR','UCB.BR','UMI.BR','WDP.BR'],
        'bel-midcap': ['TINC.BR','OXUR.BR','BONE.BR','BERR.BR','ATENB.BR','AEDX.BR','ONTEX.BR','BEVE.BR','CFE.BR','CPIC.BR','MOBI.BR','SYENS.BR','TITC.BR','VGP.BR','EXMAR.BR'],
        'bel-smallcap': ['COMB.BR','CREI.BR','ESYB.BR','EVOC.BR','IBA.BR','KINB.BR','MELE.BR','NYRB.BR','REC.BR','SHUR.BR','SPAQ.BR','TITAN.BR','VASTB.BR'],
        aex: ['ADYEN.AS','AGN.AS','AKZA.AS','ASML.AS','BESI.AS','DSFIR.AS','EXOR.AS','HEIA.AS','IMCD.AS','INGA.AS','KPN.AS','NN.AS','PHIA.AS','PRX.AS','RAND.AS','REN.AS','SHELL.AS','UNA.AS','URW.AS','WKL.AS'],
        sp500: ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','BRK-B','LLY','AVGO','JPM'],
        nasdaq: ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','ADBE','COST'],
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
      const maandagDezeWeek = (() => {
        const brussels = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Brussels' }));
        const dagIndex = brussels.getDay(); // 0=zo,1=ma,2=di,3=wo,4=do,5=vr,6=za
        const diffNaarMa = dagIndex === 0 ? -6 : 1 - dagIndex;
        const ma = new Date(brussels);
        ma.setDate(brussels.getDate() + diffNaarMa);
        ma.setHours(0, 0, 0, 0);
        return Math.floor(ma.getTime() / 1000) - 2 * SPD; // 2 dagen eerder als feestdagbuffer
      })();

      // period1 timestamps voor periodes die Yahoo range niet precies genoeg aankan
      const periodeP1 = {
        '1w':  maandagDezeWeek,
        '1j':  nuSec - 370 * SPD,
        '3j':  nuSec - 3 * 366 * SPD,
        '5j':  nuSec - 5 * 366 * SPD,
        'max': nuSec - 20 * 366 * SPD,
      }[periode] || null;

      // Voor 1d/1m/3m/6m/ytd werkt Yahoo range shorthand perfect
      const gebruikTimestamp = periodeP1 !== null;
      const compRange = {
        '1d':  '1d',
        '1m':  '1mo',
        '3m':  '3mo',
        '6m':  '6mo',
        'ytd': 'ytd',
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

        const quoteResults = await Promise.all(syms.map(async (sym) => {
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
            // (bv Azelis IPO 2021 → heeft geen geldige 5j data)
            if (gebruikTimestamp) {
              const eersteTs = d?.chart?.result?.[0]?.timestamp?.[0] || 0;
              const verwachtStart = periodeP1 + 30 * SPD; // mag max 30 dagen later starten
              if (eersteTs > verwachtStart) return null; // data te kort → weggooien
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
    return res.status(400).json({ error: 'Onbekend endpoint' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server fout: ' + err.message });
  }
}
