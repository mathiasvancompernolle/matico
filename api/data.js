// v16-etf-beurs
// ── In-memory cache ────────────────────────────────────────────────────────
// TTL per endpoint type (milliseconden):
//   Beurs gesloten: data verandert niet → lange TTL
//   Beurs open: koersen bewegen → korte TTL
//   Statische data: nieuws, profielen → middellange TTL
const _cache = {};

function beursIsOpen() {
  const nu = new Date();
  const dag = nu.getUTCDay(); // 0=zo, 6=za
  if (dag === 0 || dag === 6) return false;
  // Europese beurzen: 07:00-17:30 UTC / US: 13:30-20:00 UTC
  const uur = nu.getUTCHours();
  return (uur >= 7 && uur < 20); // ruime range: ergens een beurs open
}

const TTL = {
  // Live koersen: kort als beurs open, lang als gesloten
  quote:            () => beursIsOpen() ? 60_000        : 15 * 60_000,   // 1 min / 15 min
  forex:            () => beursIsOpen() ? 60_000        : 60 * 60_000,   // 1 min / 1 uur
  'forex-history':  () => 4 * 60 * 60_000,                              // 4 uur
  candle:           () => beursIsOpen() ? 2 * 60_000    : 30 * 60_000,  // 2 min / 30 min
  // Marktoverzichten: iets langer
  'aandelen-regio': () => beursIsOpen() ? 3 * 60_000    : 20 * 60_000,  // 3 min / 20 min
  'belgisch-overzicht': () => beursIsOpen() ? 5 * 60_000 : 30 * 60_000, // 5 min / 30 min
  'markten-overzicht':  () => beursIsOpen() ? 3 * 60_000 : 20 * 60_000, // 3 min / 20 min
  'market-indices': () => beursIsOpen() ? 2 * 60_000    : 20 * 60_000,  // 2 min / 20 min
  etfs:             () => beursIsOpen() ? 5 * 60_000    : 30 * 60_000,  // 5 min / 30 min
  // Statische/langzame data
  news:             () => 10 * 60_000,   // 10 min
  'market-news':    () => 10 * 60_000,   // 10 min
  profile:          () => 24 * 60 * 60_000, // 24 uur
  metrics:          () => 60 * 60_000,      // 1 uur
  dividend:         () => 6 * 60 * 60_000,  // 6 uur
  'etf-holdings':   () => 6 * 60 * 60_000,  // 6 uur
  search:           () => 5 * 60_000,        // 5 min
  'ai-analyse':     () => 30 * 60_000,       // 30 min (duur endpoint)
};

function getCached(key) {
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) {
    delete _cache[key];
    return null;
  }
  return entry.data;
}

function setCached(key, data, ttl) {
  _cache[key] = { data, ts: Date.now(), ttl };
}

// Cache key op basis van volledige query string
function cacheKey(req) {
  const q = req.query;
  return Object.keys(q).sort().map(k => `${k}=${q[k]}`).join('&');
}

module.exports = async function handler(req, res) {
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
    if (!symbol) return symbol;
    // Crypto: BTC → BTC-USD, ETH → ETH-USD (als geen suffix)
    const cryptoSymbolen = ['BTC','ETH','XRP','ADA','SOL','DOT','DOGE','MATIC','LINK','UNI','AVAX','ATOM','LTC','BCH','XLM','ALGO','VET','FIL','TRX','EOS','XMR','ETC','AAVE','COMP','MKR','SNX','CRV','SUSHI','YFI','1INCH'];
    const sym = symbol.toUpperCase();
    // Al in Yahoo formaat (BTC-USD, ETH-EUR etc.)
    if (sym.includes('-USD') || sym.includes('-EUR') || sym.includes('-USDT')) return sym;
    // Losse crypto ticker zonder suffix
    if (cryptoSymbolen.includes(sym)) return sym + '-USD';
    // Finnhub crypto formaat (BINANCE:BTCUSDT → BTC-USD)
    if (sym.startsWith('BINANCE:') || sym.startsWith('COINBASE:')) {
      const basis = sym.split(':')[1].replace('USDT','').replace('USD','').replace('EUR','');
      return basis + '-USD';
    }
    return symbol
      .replace('.DE', '.DE')
      .replace('.PA', '.PA');
  }

  const { endpoint } = req.query;

  try {
    // ── Cache check + write-through wrapper ─────────────────────────────────
    const noCacheEndpoints = ['debug-version'];
    const _key = cacheKey(req);
    
    if (!noCacheEndpoints.includes(endpoint)) {
      const cached = getCached(_key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }
      res.setHeader('X-Cache', 'MISS');
    }

    // Wrap res.json zodat elke response automatisch gecached wordt
    const _origJson = res.json.bind(res);
    res.json = (data) => {
      if (!noCacheEndpoints.includes(endpoint) && data && !data.error) {
        const ttl = TTL[endpoint] ? TTL[endpoint]() : 5 * 60_000;
        setCached(_key, data, ttl);
      }
      return _origJson(data);
    };

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
      if (!q) return res.json({ resultaten: [] });

      try {
        // Yahoo Finance search — dekt aandelen, ETFs én crypto
        const r = await fetch(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`,
          { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
        );
        const d = await r.json();
        const quotes = d?.quotes || [];
        const resultaten = quotes
          .filter(q => ['EQUITY','ETF','MUTUALFUND','CRYPTOCURRENCY'].includes(q.quoteType))
          .map(q => ({
            naam: q.longname || q.shortname || q.symbol,
            symbol: q.symbol,
            beurs: q.exchange || q.fullExchangeName || '',
            type: q.quoteType === 'CRYPTOCURRENCY' ? 'crypto'
                : q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND' ? 'etf'
                : 'aandeel',
            valuta: q.currency || 'EUR',
          }));

        // Volledige crypto EUR lijst
        const CRYPTO_EUR = {
          'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'SOL': 'Solana', 'XRP': 'XRP',
          'ADA': 'Cardano', 'DOT': 'Polkadot', 'DOGE': 'Dogecoin', 'AVAX': 'Avalanche',
          'LINK': 'Chainlink', 'MATIC': 'Polygon', 'UNI': 'Uniswap', 'LTC': 'Litecoin',
          'BCH': 'Bitcoin Cash', 'XLM': 'Stellar', 'ATOM': 'Cosmos', 'ALGO': 'Algorand',
          'VET': 'VeChain', 'FIL': 'Filecoin', 'TRX': 'TRON', 'ETC': 'Ethereum Classic',
          'AAVE': 'Aave', 'COMP': 'Compound', 'MKR': 'Maker', 'SNX': 'Synthetix',
          'CRV': 'Curve', 'SUSHI': 'SushiSwap', 'YFI': 'Yearn.finance', 'SAND': 'The Sandbox',
          'MANA': 'Decentraland', 'AXS': 'Axie Infinity', 'THETA': 'Theta', 'FTM': 'Fantom',
          'NEAR': 'NEAR Protocol', 'ICP': 'Internet Computer', 'HBAR': 'Hedera',
          'EOS': 'EOS', 'XMR': 'Monero', 'NEO': 'NEO', 'WAVES': 'Waves',
          'ZEC': 'Zcash', 'DASH': 'Dash', 'XTZ': 'Tezos', 'BAT': 'Basic Attention Token',
          'ZIL': 'Zilliqa', 'ENJ': 'Enjin Coin', 'CHZ': 'Chiliz', 'HOT': 'Holo',
          'OMG': 'OMG Network', 'IOTA': 'IOTA', 'NANO': 'Nano', 'RVN': 'Ravencoin',
          'ONE': 'Harmony', 'ANKR': 'Ankr', 'CRO': 'Cronos', 'SHIB': 'Shiba Inu',
          'LUNA': 'Terra Luna', 'APE': 'ApeCoin', 'GMT': 'STEPN', 'OP': 'Optimism',
          'ARB': 'Arbitrum', 'SUI': 'Sui', 'SEI': 'Sei', 'TIA': 'Celestia',
          'INJ': 'Injective', 'RUNE': 'THORChain', 'STX': 'Stacks', 'FLOKI': 'Floki',
          'PEPE': 'Pepe', 'WLD': 'Worldcoin', 'JUP': 'Jupiter', 'PYTH': 'Pyth',
          'TON': 'Toncoin', 'NOT': 'Notcoin', 'BONK': 'Bonk',
        };

        // Voor crypto uit zoekresultaten: voeg EUR variant toe
        const extraCrypto = [];
        const gezienEur = new Set(resultaten.map(r => r.symbol));

        resultaten.forEach(r => {
          if (r.type === 'crypto') {
            const basis = r.symbol.replace(/-USD$|-GBP$|-EUR$|-USDT$/,'');
            const eurSym = basis + '-EUR';
            if (!gezienEur.has(eurSym)) {
              gezienEur.add(eurSym);
              extraCrypto.push({
                naam: CRYPTO_EUR[basis] ? CRYPTO_EUR[basis] + ' EUR' : (r.naam || basis) + ' EUR',
                symbol: eurSym, beurs: 'CCC', type: 'crypto', valuta: 'EUR',
              });
            }
          }
        });

        // Ook directe EUR match tonen als gebruiker naam van crypto typt
        const qLower = q.toLowerCase();
        Object.entries(CRYPTO_EUR).forEach(([sym, naam]) => {
          const eurSym = sym + '-EUR';
          if (!gezienEur.has(eurSym) &&
              (naam.toLowerCase().includes(qLower) || sym.toLowerCase().includes(qLower))) {
            gezienEur.add(eurSym);
            extraCrypto.push({ naam: naam + ' EUR', symbol: eurSym, beurs: 'CCC', type: 'crypto', valuta: 'EUR' });
          }
        });

        return res.json({ resultaten: [...resultaten, ...extraCrypto] });
      } catch (e) {
        // Fallback: Finnhub
        try {
          const r = await fetch(`https://finnhub.io/api/v1/search?q=${q}&token=${FINNHUB_KEY}`);
          const d = await r.json();
          const resultaten = (d?.result || []).map(r => ({
            naam: r.description, symbol: r.symbol, beurs: r.type, type: 'aandeel'
          }));
          return res.json({ resultaten });
        } catch (e2) {
          return res.json({ resultaten: [] });
        }
      }
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
        : tijdperk === '3M' ? '3mo'
        : tijdperk === '6M' ? '6mo'
        : tijdperk === '1J' ? '1y'
        : tijdperk === 'YTD' ? 'ytd'
        : tijdperk === '3J' ? '3y'
        : tijdperk === '5J' ? '5y'
        : '10y';

      const yfInterval = tijdperk === '1D' ? '1d'
        : tijdperk === '1W' ? '1d'
        : tijdperk === '1M' ? '1d'
        : tijdperk === '3M' ? '1d'
        : tijdperk === '6M' ? '1wk'
        : tijdperk === '1J' ? '1wk'
        : tijdperk === 'YTD' ? '1wk'
        : '1wk';

      try {
        const yfSym = toYahooSymbol(symbol);
        // Probeer eerst met v8 endpoint
        let result = null;
        const urls = [
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?range=${yfRange}&interval=${yfInterval}&events=div,splits`,
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?range=${yfRange}&interval=${yfInterval}`,
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?range=${yfRange}&interval=${yfInterval}&includePrePost=false`,
        ];
        const hdrs = [
          { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
          { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'application/json' },
          { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com' },
        ];
        for (let i = 0; i < urls.length; i++) {
          try {
            const r = await fetch(urls[i], { headers: hdrs[i] || hdrs[0] });
            const data = await r.json();
            result = data?.chart?.result?.[0];
            if (result?.timestamp?.length > 1) break;
          } catch(e) {}
        }

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
      // Bepaal type + logo via Yahoo Finance quoteType
      try {
        const yfSym = toYahooSymbol(symbol);
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?interval=1d&range=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta) {
          const qt = (meta.instrumentType || meta.quoteType || '').toUpperCase();
          if (qt === 'ETF' || qt === 'MUTUALFUND') {
            resultaat.type = 'etf';
            // ETF logo via naam van de uitgever
            if (!resultaat.logo) {
              const naam = (resultaat.name || symbol).toLowerCase();
              if (naam.includes('ishares') || naam.includes('blackrock')) resultaat.logo = 'https://logo.clearbit.com/ishares.com';
              else if (naam.includes('vanguard')) resultaat.logo = 'https://logo.clearbit.com/vanguard.com';
              else if (naam.includes('amundi')) resultaat.logo = 'https://logo.clearbit.com/amundi.com';
              else if (naam.includes('xtrackers') || naam.includes('dws')) resultaat.logo = 'https://logo.clearbit.com/dws.com';
              else if (naam.includes('invesco')) resultaat.logo = 'https://logo.clearbit.com/invesco.com';
              else if (naam.includes('spdr') || naam.includes('state street')) resultaat.logo = 'https://logo.clearbit.com/ssga.com';
              else if (naam.includes('wisdomtree')) resultaat.logo = 'https://logo.clearbit.com/wisdomtree.com';
              else if (naam.includes('vaneck')) resultaat.logo = 'https://logo.clearbit.com/vaneck.com';
              else if (naam.includes('lyxor')) resultaat.logo = 'https://logo.clearbit.com/lyxor.com';
              else if (naam.includes('ubs')) resultaat.logo = 'https://logo.clearbit.com/ubs.com';
              else if (naam.includes('pimco')) resultaat.logo = 'https://logo.clearbit.com/pimco.com';
              else if (naam.includes('franklin')) resultaat.logo = 'https://logo.clearbit.com/franklintempleton.com';
              else if (naam.includes('fidelity')) resultaat.logo = 'https://logo.clearbit.com/fidelity.com';
            }
          }
          else if (qt === 'CRYPTOCURRENCY') {
            resultaat.type = 'crypto';
            // Crypto logo via CoinGecko (gratis, geen key)
            if (!resultaat.logo) {
              const basis = symbol.replace(/-EUR$|-USD$|-GBP$|-USDT$/,'').toLowerCase();
              const coinMap = {
                'btc': 'bitcoin', 'eth': 'ethereum', 'sol': 'solana', 'xrp': 'ripple',
                'ada': 'cardano', 'dot': 'polkadot', 'doge': 'dogecoin', 'avax': 'avalanche-2',
                'link': 'chainlink', 'matic': 'matic-network', 'uni': 'uniswap', 'ltc': 'litecoin',
                'bch': 'bitcoin-cash', 'xlm': 'stellar', 'atom': 'cosmos', 'algo': 'algorand',
                'vet': 'vechain', 'fil': 'filecoin', 'trx': 'tron', 'etc': 'ethereum-classic',
                'aave': 'aave', 'shib': 'shiba-inu', 'bnb': 'binancecoin', 'ton': 'the-open-network',
                'near': 'near', 'op': 'optimism', 'arb': 'arbitrum', 'sui': 'sui',
                'inj': 'injective-protocol', 'rune': 'thorchain', 'pepe': 'pepe',
                'wld': 'worldcoin-wld', 'bonk': 'bonk', 'apt': 'aptos',
              };
              const geckoId = coinMap[basis];
              if (geckoId) {
                resultaat.logo = `https://assets.coingecko.com/coins/images/${geckoId}/small/${geckoId}.png`;
                // Betere aanpak: gebruik CoinGecko API
                try {
                  const cgRes = await fetch(`https://api.coingecko.com/api/v3/coins/${geckoId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`);
                  const cgData = await cgRes.json();
                  if (cgData?.image?.small) resultaat.logo = cgData.image.small;
                  if (!resultaat.name) resultaat.name = cgData?.name;
                } catch (e) {}
              }
            }
          }
          else if (qt === 'EQUITY') resultaat.type = 'aandeel';
          else if (!resultaat.type) resultaat.type = 'aandeel';
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
            const laag52w = meta.fiftyTwoWeekLow || meta.regularMarketDayLow || 0;
            const hoog52w = meta.fiftyTwoWeekHigh || meta.regularMarketDayHigh || 0;
            const isin = meta.isin || '';
            const beurs = meta.fullExchangeName || meta.exchangeName || '';
            const valuta = meta.currency || 'EUR';
            const verschil = prijs - prevClose;
            return { symbol: idx.symbol, naam: idx.naam, prijs, change, prevClose, verschil, sparkline, laag52w, hoog52w, isin, beurs, valuta };
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
          'ONTEX.BR',  // Ontex
          'OBEL.BR',   // Orange Belgium
          'RET.BR',    // Retail Estates
          'SHUR.BR',   // Shurgard
          'SIP.BR',    // Sipef
          'TESB.BR',   // Tessenderlo Chemie
          'TINC.BR',   // TINC
          'TITC.BR',   // Titan
          'XIOR.BR',   // Xior Student Housing
          'AZE.BR',    // Azelis Group
          'LOTB.BR',   // Lotus Bakeries
          'MELE.BR',   // Melexis
          'MONT.BR',   // Montea
        ],
        'bel-smallcap': [
          'ACCB.BR',   // Accentis
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
          'SEQUA.BR',  // Sequana Medical
          'TEXF.BR',   // Texaf
          'VAN.BR',    // Van de Velde
          'VASTB.BR',  // Vastned
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



            const open = meta.regularMarketOpen || 0;
            const hoog = meta.regularMarketDayHigh || 0;
            const laag = meta.regularMarketDayLow || 0;
            const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
            const verschil = prijs - prevClose;
            const volume = meta.regularMarketVolume || 0;
            const marktKap = meta.marketCap || meta.sharesOutstanding * prijs || 0;
            const beurs = meta.fullExchangeName || meta.exchangeName || '—';
            return { symbol: sym, naam, prijs, change: chg, valuta: meta.currency || 'EUR', open, hoog, laag, prevClose, verschil, volume, marktKap, beurs };
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
        'OBEL.BR','RET.BR','SHUR.BR','SIP.BR','TESB.BR','TINC.BR',
        'TITC.BR','XIOR.BR','CENER.BR','VGP.BR','COLR.BR',
        'TUB.BR','COFB.BR',
        // BEL Small
        'ACCB.BR','CYAD.BR','DECB.BR','EKOP.BR','EXM.BR','HYL.BR',
        'JEN.BR','NYR.BR','NYXH.BR','ONWD.BR','OPTI.BR','OXUR.BR',
        'QRF.BR','ROU.BR','SEQUA.BR','TEXF.BR','VAN.BR','VASTB.BR',
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
        'OBEL.BR','RET.BR','SHUR.BR','SIP.BR','TESB.BR','TINC.BR',
        'TITC.BR','XIOR.BR','VIO.BR','CENER.BR','VGP.BR','COLR.BR',
        'TUB.BR','COFB.BR','CMBT.BR',
        // BEL Small
        'ACCB.BR','CYAD.BR','DECB.BR','EKOP.BR','EXM.BR','HYL.BR',
        'JEN.BR','NYR.BR','NYXH.BR','ONWD.BR','OPTI.BR','OXUR.BR',
        'QRF.BR','ROU.BR','SEQUA.BR','TEXF.BR','VAN.BR','VASTB.BR',
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
          // Nieuw toegevoegd (vooraan zodat ze zeker worden opgehaald)
          'MWRE.DE','MWRD.MI','PABUS.MI','LYPG.DE','ETSZ.DE',
          'GLUG.MI','GLGG.L','JREU.MI','SPYI.DE','SPPY.DE',
          'ICHD.AS','QUTM.DE','QNTM.MI',
          // Gesorteerd op beheerd vermogen (AUM) - grootste eerst
          // Mega AUM (>100 mld USD)
          'SPY','VOO','VTI','QQQ','VEA',
          // Large AUM (10-100 mld)
          'MMLP.MI','AMLP',
          'SWDA.SW','IWDA.L','IWDG.L','IWDA.AS','EUNL.DE','SWDA.MI','IVV','CSSPX.MI','CSSPX.SW','CSPX.AS','VWCE.DE','VWCE.AS',
          'VWO','VUSA.AS','VUSA.L','VUAA.DE','IS3N.DE','EMIM.L','EIMI.SW','EMIM.AS','EIMI.MI',
          'VXUS','VGK','VNQ','VPL','VWRL.AS','SCHD','VT',
          'IUSA.AS','CSPX.L','SPY5.AS','SWRD.AS','SWRD.DE',
          // Medium AUM (1-10 mld)
          'CNDX.L','CNDX.AS','CNDX.PA','CNX1.L','ANAU.MI','ANAV.DE','PRIW.DE','WEBN.DE','F50A.DE',
          'LYMS.DE','ACWD.PA','SPYX.DE','FWIA.DE','PRIW.DE',
          'IMEA.SW','IMAE.AS','EUNK.DE','SMEA.AS','SMEA.MI','IMEU.AS','IEUA.AS','VHYL.AS','VFEM.AS',
          'EDM2.DE','EMEG.MI','EDM4.DE','AYEM.DE','OM3Y.DE','SAEM.DE','IEMA.AS','SEMA.SW','SAEM.MI','AEEM.PA',
          'IWFV.L','IS3S.DE','IWVL.DE','IWVL.MI','IS3R.DE','IWMO.DE','IS3Q.DE','MINV.L','MVOL.DE','MVEW.DE','SXR0.DE','MVEA.DE',
          'SEC0.DE','SEC0.DE','SEME.MI','SEMI.DE','SEMI.MI','SEMI.AS','SMH','SMH.DE','SMH.MI','SOXX',
          'XDWD.DE','XZWD.DE','XSPX.DE','XEQW.DE','XDWU.DE',
          'EXV1.DE','EXSA.DE',
          'IITU.DE','IITU.SW','IYW','IGV',
          'IUSQ.DE','IUSN.DE','WSML.DE','ICLN','IQQH.DE','INRG.MI','CLEA.MI',
          'IAUP.SW','IS0E.DE','GDX.MI',
          'DFNS.DE','DFNS.MI','WDEF.DE',
          '2B76.DE','RBOT.SW','RBOT.DE','GCAR.L','ECAR.MI','AGED.MI',
          'BATG.L','BATT.MI','RENG.L','RENW.MI','GLGG.MI',
          'XAIX.DE','XAIX.MI','INDA','QDV5.DE','IIND.DE',
          'EUNN.DE','SJPA.MI','SJPA.L','CJPA.SW','JPNH.SW','IJPN.AS','IJPA.MI','EXS2.DE','IJSE.DE','IJPN.AS',
          'IAEX.AS','IUES.SW','IUSE.MI','EXH1.DE','EUEA.AS','SXRT.DE','CSSX5E.MI','EXV1.DE','ISF.SW','CUKX.SW','H50E.SW',
          'TDIV.AS','TGET.AS','TRET.AS',
          'VUKE.L','VGK','IEUA.AS','EUSC.DE','SLMC.DE','IUSK.DE','SLUS.DE','GPSA.L','SGAS.DE','IESE.DE',
          // Sector & thema
          'XLE','XLI','WTCH.AS','COPX','4COP.DE','COPX.DE',
          'NUCL.DE','URA','SLVR.DE','SILV.DE','REMX.DE','TMET.MI',
          'DAPP.DE','BCHS.L','BCHN.MI','EMQP.L','EMQQ.DE',
          'ESPO.MI','SPCE.DE','XNET.MI',
          'FCBR.L','CIBR.MI','FSKY.L','FSKY.MI','FGRD.L','GRID.DE','GRID.MI',
          'IGF','INFR.MI','GLRE.L',
          'IPRV.SW','IPRV.SW','AAXJ','ICHN.AS','ISDE.L','SUSM.L','ISDW.L','ISDU.L','SUAS.L','ICGA.AS','AAXJ','EWY','IESH.MI',
          'QDVX.DE','QDVW.DE','QDVE.DE','IUIT.SW','QDVA.DE','CBUC.DE','EDMU.DE','SAUA.MI','EMND.DE','EMUE.DE','SAWD.SW','SNAW.DE','WQDE.DE','IWDE.DE','IWDE.MI','IWDH.MI',
          'TNOW.PA','CW8.PA','CNDX.PA',
          'MEUD.L','MEUD.PA','LYP6.DE','DEFS.PA','ETZ.PA','ESE.PA','PAPU.MI','PAEEM.PA','PAASI.PA','PUST.PA','PANXG.PA',
          'LYSP5.SW','C6E.PA','AME6.DE','AME6.F','CSE6.SW','PABG.L','EPAB.PA','PAEP.L',
          'BJLE.F','BLUE.PA','BJLE.DE','EBLU.DE','EPEJ.PA','BPAC.PA','EMEC.DE','REUSE.PA','CEUD.MI','ENG.PA','EENG.MI','BINFG.MI',
          'JPCT.MI','TEMP.MI','JPCS.MI','JREU.MI',
          'IHI','IHI','MLPQ.L','MLPX.MI',
          'V3AA.AS','VFEM.AS','GREP.SW','EWLD.L',
          'JPSR.SW','PCSR.AS','CHSR.SW','UKSR.L','SP5H.MI',
          'LVLC.L','LVLC.F','IGDA.DE','IQSA.MI','IQSA.DE','IGAE.DE','NESG.MI','EQQQ.MI',
          'CHDVD.SW','SPAG.L','ISAG.MI','SPAG.MI','CBUC.DE','EDMU.DE','SAUA.MI','EMND.DE','EMUE.DE',
          'SGAJ.DE','XMJP.DE','XZWD.DE','XMUS.L','XMUK.L',
          'SLMC.DE','IUSK.DE','SLUS.DE','GPSA.L','SGAS.DE','IESE.DE','IWY','SCHD',
        ],
        obligaties: [
          // iShares Core obligaties (hoge AUM, meest verhandeld)
          'AGGH.AS','AGGH.DE','AGGH.L','AGGH.MI',          // iShares Core Global Aggregate Bond
          'IEGA.AS','SXRM.DE',                              // iShares Core EUR Govt Bond
          'IEAC.AS','IEAC.DE','IEAC.L',                    // iShares Core EUR Corp Bond
          'IBCI.AS','IBCI.DE',                              // iShares EUR Inflation Linked Govt Bond
          'IHYG.DE','IHYG.L','IHYG.MI',                    // iShares EUR High Yield Corp Bond
          'IBTS.AS','IBTS.DE','IBTS.MI',                   // iShares USD Treasury Bond 1-3yr
          'IBGL.AS',                                        // iShares EUR Govt Bond 15-30yr
          'IEAG.AS',                                        // iShares EUR Aggregate Bond ESG SRI
          // iShares USD Treasury
          'SHY','IEF','TLT',                                // US Treasury ETFs (Nasdaq/NYSE)
          'TIP',                                            // iShares TIPS Bond ETF
          'ITPE.DE','IBC5.DE',                              // iShares $ TIPS EUR Hedged
          'IDTL.L','IBTL.DE',                              // iShares USD Treasury 20+yr
          'IBTM.L',                                         // iShares USD Treasury 3-7yr
          'IBTD.L',                                         // iShares USD Treasury 7-10yr
          'IBTA.L',                                         // iShares USD Treasury 0-1yr
          'IBTS.L',                                         // iShares USD Treasury 1-3yr LSE
          'IBTE.DE',                                        // iShares USD Treasury 1-3yr EUR Hedged
          'STIP.AS',                                        // iShares $ TIPS 0-5
          'ITPG.L','ITPS.L',                               // iShares $ TIPS LSE
          // iShares EUR Govt maturity buckets
          'IBGS.AS','IBGS.L',                              // iShares EUR Govt Bond 1-3yr
          'IBGE.DE','IBGE.MI',                             // iShares EUR Govt Bond 1-3yr Acc
          'IBGK.AS','IBGK.DE',                             // iShares EUR Govt Bond 3-5yr
          'IBGN.AS',                                        // iShares EUR Govt Bond 3-7yr
          'IBGM.AS',                                        // iShares EUR Govt Bond 5-7yr
          'IBGP.AS',                                        // iShares EUR Govt Bond 7-10yr
          'IBGX.AS',                                        // iShares EUR Govt Bond 10-15yr
          // IBGO.AS geeft zelfde data als IBGL.AS op Yahoo - verwijderd
          'IDTG.DE',                                        // iShares EUR Govt Bond 20yr Target Dur
          'IGBE.DE',                                        // iShares EUR Govt Bond Climate
          'IBGZ.DE',                                        // iShares EUR Govt Bond 0-1yr
          // iShares EUR Corp ESG
          'QDVL.DE','QDVL.MI',                             // iShares EUR Corp Bond 0-3yr ESG SRI Dist
          'IE3E.DE',                                        // iShares EUR Corp Bond 0-3yr ESG SRI Acc
          'PAAC.DE',                                        // iShares EUR Corp Bond ESG Paris Aligned
          'SUAE.DE',                                        // iShares EUR Corp Bond ESG SRI
                    // iShares EUR HY Corp Bond ESG SRI - SRHE tickers geven aandelen ETF op Yahoo
          'AYE2.DE',                                        // iShares EUR HY Corp Bond ESG SRI Acc
          // iShares USD HY & Corp
          'HYG',                                            // iShares iBoxx USD HY Corp Bond ETF
          'AGG',                                            // iShares Core US Aggregate Bond ETF
          'IHYU.DE','IHYU.MI','IHYU.L',                    // iShares USD High Yield Corp Bond
          'HYLD.DE',                                        // iShares USD HY Corp Bond EUR Hedged
          'SDHY.L',                                         // iShares USD Short Duration HY
          'SDIG.L','SDCB.L',                               // iShares USD Short Duration Corp Bond
          'LQDA.L','LQDE.L',                               // iShares USD Corp Bond
          'SUDE.DE',                                        // iShares $ Corp Bond ESG SRI
          'LQDH.L',                                         // iShares USD Corp Bond Interest Rate Hedged
          'SHYG.L',                                         // iShares USD HY Corp Bond ESG
          'IEGE.DE',                                        // iShares Treasury Bond 7-10yr EUR Hedged
          'FLOT.L',                                         // iShares USD Floating Rate Bond
                    // iShares USD Ultrashort Bond - IUSU.L is S&P 500 Utilities op Yahoo
          'SUDA.DE',                                        // iShares USD Development Bank Bonds
          'IBTE.DE',                                        // iShares USD Treasury 1-3yr EUR Hedged
          // iShares EM Bond
          'IEMB.DE','IEMB.MI','IEMB.L',                   // iShares J.P. Morgan USD EM Bond
          'EMB',                                            // iShares JP Morgan USD EM Bond ETF
          'LEMB',                                           // iShares JP Morgan EM Local Currency Bond ETF
          'EMHE.DE','EMH5.MI','EMHE.L',                    // iShares JPM USD EM Bond EUR Hedged
          'EMLD.MI','SEML.L',                               // iShares JP Morgan EM Local Govt Bond
          'AEMB.L',                                         // iShares JP Morgan Advanced EM Bond
          // iShares Global
          'IGLO.DE','IGLO.L',                              // iShares Global Govt Bond
          // IGLG.L geeft Physical Gold op Yahoo - verwijderd
          'CORP.L','CORP.MI',                              // iShares Global Corp Bond
          'CRPH.DE',                                        // iShares Global Corp Bond EUR Hedged
          'IGLB.L',                                         // iShares Global Inflation Linked
          'IGIL.DE',                                        // iShares Global Inflation Linked XETR
          'IUAG.L',                                         // iShares US Aggregate Bond
          'IMBS.L',                                         // iShares US Mortgage Backed Securities
          'IGLT.L',                                         // iShares Core UK Gilts
          'GHYG.DE','GHYG.MI','GHYG.L','GHYG.SW',         // iShares Global HY Corp Bond
          'SUGA.DE',                                        // iShares Global Aggregate Bond ESG SRI
          'IBC7.DE',                                        // iShares Fallen Angel HY Corp Bond EUR Hedged
          'SUEF.DE',                                        // iShares EU Corp Bond ex Financials 1-5yr ESG SRI
          'IITB.MI',                                        // iShares Italy Govt Bond
          'CNYB.AS',                                        // iShares China CNY Bond
          'IB27.MI','IB28.MI',                             // iShares iBonds Dec 2027/2028 EUR Corp
          'GROE.DE',                                        // iShares EUR Green Bond
          'EUNT.DE',                                        // iShares EUR Ultrashort Bond
          'ERNE.DE','ERNE.AS',                             // iShares EUR Ultrashort Bond
          'SESG.DE',                                        // iShares EUR Ultrashort Bond ESG
          // Vanguard obligaties
          'BND','BNDX','BSV',                              // Vanguard Bond ETFs US
          'VGGT.DE',                                        // Vanguard Global Govt Bond
          // VGOV.DE geeft verkeerde data op Yahoo
          'VAGF.DE','VAGF.MI',                             // Vanguard Global Aggregate Bond
          'VECP.AS','VECP.DE',                             // Vanguard EUR Corporate Bond
          'VETY.DE','VETY.AS','VETY.MI',                  // Vanguard EUR Eurozone Govt Bond
          'VUCP.AS',                                        // Vanguard USD Corporate Bond
          'VUTY.AS','VUTY.MI',                             // Vanguard USD Treasury Bond
          'VDEM.AS',                                        // Vanguard USD EM Govt Bond
          'VGOV.L',                                         // Vanguard UK Gilt
          'VDST.L',                                         // Vanguard US Treasury 0-1 Year
          // Amundi obligaties
          'C3M.MI','AM3A.PA','AM3A.DE',                    // Amundi Euro Govt Bond 1-3Y
          'AM3E.PA','AM3E.MI',                             // Amundi Euro Govt Bond 3-5Y
          'AM3G.PA','AM3G.MI',                             // Amundi Euro Govt Bond 7-10Y
          'AM3H.PA',                                        // Amundi Euro Govt Bond 10-15Y
                    // Amundi Euro Corp Bond 0-3Y ESG - SHC tickers zijn foute Yahoo mappings
          'ULTE.MI','ULTE.DE',                             // Amundi Euro Corp Bond 0-1Y ESG
          'CRPE.PA',                                        // Amundi Euro Corporate Bond ESG
          'EGBG.MI','EGBG.PA',                             // Amundi Euro Govt Tilted Green Bond
          'AHYG.MI',                                        // Amundi EUR High Yield Corp Bond ESG
          // INFL.MI/PA geeft Amundi Euro Inflation Expectations (inflatie swap) op Yahoo
          'SHT.MI',                                         // Amundi US Treasury Bond 1-3Y
                    // Amundi US Treasury 7-10Y - AMEU tickers geven foutieve data op Yahoo
          'TIPU.L',                                         // Amundi US Tips Inflation-Linked Bond
          'HYLD2.L',                                        // Amundi USD High Yield Corp Bond ESG
          'HYLDE.MI',                                       // Amundi USD HY Corp Bond EUR Hedged
          'GGRE.L',                                         // Amundi Global Aggregate Green Bond
          'AGGH2.PA',                                       // Amundi Core Global Govt Bond EUR Hedged
          // PRAM.DE geeft Amundi Prime Emerging Markets (aandelen) op Yahoo
          //'PRAD.DE','PRAA.DE',                  // Amundi Prime Euro Govt Bond
          'FLTC.PA',                                        // Amundi Floating Rate Euro Corporate ESG
          // Xtrackers obligaties
          'XBLR.DE','XBLR.MI',                             // Xtrackers II EUR Corporate Bond
          'XHY1.DE','XHY1.SW',                             // Xtrackers II EUR HY Corporate Bond
          'XHY3.DE',                                        // Xtrackers II EUR HY Corporate Bond Acc
          'XGSH.DE',                                        // Xtrackers II Eurozone Govt Bond
          'XGSG.DE',                                        // Xtrackers II Eurozone Govt Bond 1-3yr
          'XGIG.MI',                                        // Xtrackers II Eurozone Inflation Linked Bond
          'XGGB.L','XGGB.SW',                              // Xtrackers II Global Govt Bond
          'XGGG.MI','XGGG.DE',                             // Xtrackers II Global Govt Bond EUR Hedged
          'XGAG.DE',                                        // Xtrackers II Global Aggregate Bond Swap
          'XUTD.DE',                                        // Xtrackers II US Treasuries
          'XJSE.DE',                                        // Xtrackers II Japan Govt Bond
          'XESR.DE',                                        // Xtrackers ESG EUR Corp Bond SRI PAB
          'XZGE.DE',                                        // Xtrackers Eurozone Govt Bond ESG Tilted
          'XHY7.MI',                                        // Xtrackers Rolling Target Mat EUR HY
          // State Street SPDR
          'BIL',                                            // State Street SPDR BBG 1-3 Month T-Bill ETF
          'JNK',                                            // State Street SPDR BBG High Yield Bond ETF
          'SPXB.DE','SPXB.SW',                             // SPDR Bloomberg 1-3 Month T-Bill UCITS
          'GLAG.DE','GLAE.DE',                             // SPDR BBG Global Aggregate Bond
          'GLGE.MI','GLGE.DE',                             // SPDR BBG 1-3Y EUR Govt Bond
          'GLGG2.MI',                                       // SPDR BBG 10+ Y Euro Govt Bond
          'GLTL.L',                                         // SPDR BBG 15+Y Gilt
          'GLSC.L',                                         // SPDR BBG Sterling Corp Bond
          'GLUK.L',                                         // SPDR BBG UK Gilt
          'SEMG.MI',                                        // State St SPDR ICE BofA 0-5Y EM USD Govt Bond
          'EMDL.MI',                                        // State Street SPDR BBG EM Local Bond
          // UBS
          'TIPS.SW',                                        // UBS BBG TIPS 1-10
          'ULCO.SW',                                        // UBS BBG US Liquid Corp
          'SDBB.SW',                                        // UBS Sustainable Development Bank Bonds
          'EMSU.SW',                                        // UBS BBG USD EM Sovereign
          'SULCO.SW',                                       // UBS BBG MSCI US Liquid Corp Sustainable
          'SEURC.SW',                                       // UBS BBG MSCI Euro Area Liquid Corp Sustainable
          // VanEck
          'CORP2.AS',                                       // VanEck iBoxx EUR Corporates
          'TSOV.AS',                                        // VanEck iBoxx EUR Sovereign 1-10
          'TSOV2.AS',                                       // VanEck iBoxx EUR Sov Capped AAA-AA 1-5
          // BNPP
          'SRPE.MI',                                        // BNPP Easy EUR Corp Bond SRI PAB
          // PIMCO
          'STHS.L',                                         // PIMCO ShTerm HY Corp Bond
          'STYLD.L','STYLD.MI',                            // PIMCO Advtge US Short-Term HY Corp Bond
          'STHS2.MI',                                       // PIMCO US Short-Term HY Corp Bond
          // JPMorgan
          'JHYU.L',                                         // JPM Global HY Corp Bond
          'BB3M.L',                                         // JPM BetaBuilders US Treasury 0-3M
          'JPMF.MI','JPMF.DE',                             // JP Morgan EUR Ultra-Short Income Active
          // L&G
          'EMGB.MI',                                        // L&G EM Govt Bond USD 0-5 Year Screened
          // WisdomTree
                    // WisdomTree AT1 CoCo Bond - COCO.MI is cacao op Yahoo, foute ticker
          // Invesco
          // AT1.DE geeft Aroundtown SA aandeel op Yahoo - verwijderd
          'IBGE2.DE',                                       // Invesco Euro Govt Bond 1-3 Year
          // === BATCH 6 - Resterende Saxo tickers ===
          'AMEU.L','AMEU.DE',   // Amundi US Treasury 7-10Y (AMEU.MI geeft S&P Europe 350 aandelen)
          'SECA.DE',   // iShares EUR Government Bond Climate XETR
          'GHYS2.L',   // iShares Global HY Corp Bond Acc LSE
          'GROE2.DE',  // iShares EUR Green Bond XETR variant
          'IBGO.AS',   // iShares EUR Govt Bond 15-30yr Acc AMS
          'IBTB.L','IBTU.L',   // iShares USD Treasury 1-3yr LSE varianten
          'IGLS.L','IGLV.L',   // iShares Global Govt Bond LSE USD2
          'IHYH.L',    // iShares USD HY Corp Bond LSE variant
                    // INFL.MI/PA geeft Amundi Euro Inflation Expectations (swap ETF) - verwijderd
          'ISAC.DE',   // iShares Core EUR Corp Bond XETR
                    // PRAM.DE geeft Amundi Prime Emerging Markets (aandelen) - verwijderd
          'SHC.DE','SHC.MI',   // Amundi Euro Corp Bond 0-3Y ESG
          'SHYU.L','SHYU2.L',  // iShares USD HY Corp Bond LSE varianten
          'EHYA.AS',   // iShares EUR HY Corp Bond ESG SRI AMS
          'SUSE.DE',   // iShares EUR Corp Bond 0-3yr ESG SRI XETR
          'VGOV.DE',   // Vanguard Global Govt Bond XETR
          'XCB1.DE','XCB1.MI', // Xtrackers II EUR Corporate Bond alternatieven
          // Correcte Yahoo tickers voor iShares Xetra obligaties
          'EUNA.DE','EUN5.DE','EUNW.DE','IUS7.DE','EUN3.DE',
          'EUNH.DE','IUSM.DE','EUN4.DE','IS0R.DE','HYLE.DE',
          'IEAC.MI',
          // === CORRECTE YAHOO TICKERS VOOR ONTBREKENDE OBLIGATIE ETFs ===
          // === BATCH 5 ===
          // iShares Fallen Angel correcte Yahoo ticker
          'WNGE.L',    // iShares Fallen Angels HY Corp Bond EUR Hedged LSE (= FALE.DE/MI)
          'WIGG.L',    // iShares Fallen Angels HY Corp Bond GBP Hedged LSE
          // Amundi extra MIL varianten
          'AM3E.MI',   // Amundi Euro Govt Bond 3-5Y MIL (hertest)
          'AM3G.MI',   // Amundi Euro Govt Bond 7-10Y MIL (hertest)
          'EGBG.MI',   // Amundi Euro Govt Tilted Green Bond MIL (hertest)
          'AHYG.MI',   // Amundi EUR HY Corp Bond ESG MIL (hertest)
          'SHT.MI',    // Amundi US Treasury Bond 1-3Y MIL (hertest)
          'ULTE.MI',   // Amundi Euro Corp Bond 0-1Y MIL (hertest)
          // iShares Global Inflation Linked extra
          'IGIL.DE',   // iShares Global Inflation Linked Govt Bond XETR
          'IGLB.DE',   // iShares Global Inflation Linked Bond XETR
          // iShares EUR Green Bond
          'GROE.DE',   // iShares EUR Green Bond XETR
          'EUGR.DE',   // iShares EUR Green Bond XETR variant
          // iShares EU Corp Bond ex Financials
          'SUEF.L',    // iShares EU Corp Bond ex Financials LSE
          // iShares Ultrashort
          'ERNE.DE',   // iShares EUR Ultrashort Bond XETR (hertest)
          // SPDR extra
          'GLAG.DE',   // SPDR BBG Global Aggregate XETR (hertest)
          'GLAE.DE',   // SPDR BBG Global Aggregate EUR Dist XETR (hertest)
          'GLGE.MI',   // SPDR BBG 1-3Y EUR Govt Bond MIL (hertest)
          'GLGE.DE',   // SPDR BBG 1-3Y EUR Govt Bond XETR (hertest)
          'GLGG2.DE',  // SPDR BBG 10+Y Euro Govt Bond XETR (hertest)
          'GLSC.MI',   // SPDR BBG Sterling Corp Bond MIL (hertest)
          'SEMG.MI',   // SPDR ICE BofA 0-5Y EM Govt Bond MIL (hertest)
          'EMDL.MI',   // SPDR BBG EM Local Bond MIL (hertest)
          // Xtrackers extra
          'XESR.MI',   // Xtrackers ESG EUR Corp Bond SRI PAB MIL (hertest)
          'XZGE.MI',   // Xtrackers Eurozone Govt Bond ESG Tilted MIL (hertest)
          'XGAG.MI',   // Xtrackers II Global Aggregate Bond MIL (hertest)
          'XGSG.L',    // Xtrackers II Global Govt Bond EUR Hedged LSE (hertest)
          'XBLR.L',    // Xtrackers II EUR Corp Bond LSE (hertest)
          'XHY3.MI',   // Xtrackers II EUR HY Corp Bond Acc MIL (hertest)
          // VanEck
          'TSOV.DE',   // VanEck iBoxx EUR Sovereign XETR (hertest)
          'CORP2.DE',  // VanEck iBoxx EUR Corporates XETR (hertest)
          'TSOV2.DE',  // VanEck iBoxx EUR Sov Capped XETR (hertest)
          // JPMorgan
          'JPMF.PA',   // JPMorgan EUR Ultra-Short Income PAR (hertest)
          // L&G
          'EMGB.DE',   // L&G EM Govt Bond USD XETR (hertest)
          'EMGB.MI',   // L&G EM Govt Bond USD MIL (hertest)
          // UBS
          'ULCO.DE',   // UBS BBG US Liquid Corp XETR (hertest)
          'SDBB.DE',   // UBS Sustainable Dev Bank Bonds XETR (hertest)
          'EMSU.MI',   // UBS BBG USD EM Sovereign MIL (hertest)
          // === BATCH 4 ===
          // Amundi Euro Govt Bond - correcte PAR tickers (MT* serie)
          'MTA.PA',    // Amundi Euro Govt Bond 1-3Y PAR (= AM3A.PA variant)
          'MTC.PA',    // Amundi Euro Govt Bond 5-7Y PAR
          'MTF.PA',    // Amundi Euro Govt Bond 15+Y PAR
          'MTH.PA',    // Amundi Euro Govt Bond 25+Y PAR
          'MTI.PA',    // Amundi Euro Govt Inflation-Linked Bond PAR
          'AHYE.PA',   // Amundi EUR HY Bond ESG PAR (= AHYG.MI variant)
          // iShares ESG bond - correcte Yahoo tickers (SUOE/OM3F/UEEF serie)
          'SUOE.L',    // iShares EUR Corp Bond ESG SRI Dist LSE (= SUAE.DE variant)
          'OM3F.DE',   // iShares EUR Corp Bond ESG SRI Dist XETR (= SUAE.DE variant)
          'UEEF.DE',   // iShares $ HY Corp Bond ESG SRI EUR Hedged XETR (= SUHY.DE variant)
          'SUOA.AS',   // iShares $ Corp Bond ESG SRI Acc AMS (= SUDE.DE variant)
          'SUSE.MI',   // iShares EUR Corp Bond 0-3yr ESG SRI Dist MIL
          'SUSE.SW',   // iShares EUR Corp Bond 0-3yr ESG SRI Dist SWX
          'SUSU.L',    // iShares $ Corp Bond 0-3yr ESG SRI Dist LSE (= SDBU.DE variant)
          // Amundi extra MIL/XETR
                    // EGBG.DE al eerder verwijderd - skip
          'CRPE.PA',   // Amundi EUR Corp Bond ESG PAR (al in lijst als CRPE.MI)
          'AHYG.PA',   // Amundi EUR HY Corp Bond ESG PAR
                    // ULTE.PA geeft YieldMax ULTY (compleet fout) - verwijderd
          'SHT.PA',    // Amundi US Treasury Bond 1-3Y PAR
          // iShares Fallen Angel / Global Infl
          'FALE.L',    // iShares Fallen Angel HY Corp Bond EUR Hedged LSE
          'SUEF.MI',   // iShares EU Corp Bond ex Financials MIL
          'IGIL.MI',   // iShares Global Inflation Linked MIL (hertest)
          'IGIL.L',    // iShares Global Inflation Linked LSE
          // iShares EUR Green Bond
          'GROE.L',    // iShares EUR Green Bond LSE
          'EUGR.L',    // iShares EUR Green Bond LSE variant
          // iShares Ultrashort/USD extras
          'ERNE.DE',   // iShares EUR Ultrashort Bond XETR
                    // SESG.L geeft Saturna Sustainable ESG Equity (aandelen) - verwijderd
          'SLQD.MI',   // iShares USD Short Duration Corp Bond MIL
          'SDBU.MI',   // iShares $ Corp Bond ESG SRI MIL
          // VanEck
          'TSOV2.DE',  // VanEck iBoxx EUR Sov Capped AAA-AA XETR
          // SPDR extra varianten
          'GLGE.L',    // SPDR BBG 1-3Y EUR Govt Bond LSE
          'GLGG2.L',   // SPDR BBG 10+Y Euro Govt Bond LSE
          'GLSC.MI',   // SPDR BBG Sterling Corp Bond MIL
          'GLUK.MI',   // SPDR BBG UK Gilt MIL
          'SPXB.MI',   // SPDR Bloomberg 1-3M T-Bill MIL
          // JPMorgan
          'JPMF.PA',   // JP Morgan EUR Ultra-Short Income PAR
          // iShares iBonds extra
          'IB28X.MI',  // iShares iBonds Dec 2028 Crossover MIL (hertest)
          'IB28X.DE',  // iShares iBonds Dec 2028 Crossover XETR
          // Xtrackers ESG/Tilted
          'XESR.MI',   // Xtrackers ESG EUR Corp Bond SRI PAB MIL
          'XZGE.MI',   // Xtrackers Eurozone Govt Bond ESG Tilted MIL
          'XGIG.DE',   // Xtrackers II Eurozone Inflation Linked XETR
          'XGAG.MI',   // Xtrackers II Global Aggregate Bond MIL
          'XGSG.L',    // Xtrackers II Global Govt Bond EUR Hedged LSE
          'XBLR.L',    // Xtrackers II EUR Corp Bond LSE
          'XHY1.MI',   // Xtrackers II Rolling Target Mat EUR HY MIL
          'XHY3.MI',   // Xtrackers II EUR HY Corp Bond Acc MIL
          // === BATCH 3 ===
          // Xtrackers alternatieven (Acc versies)
          'XHYA.DE',   // Xtrackers II EUR HY Corp Bond Acc XETR
          'XHYA.MI',   // Xtrackers II EUR HY Corp Bond Acc MIL
          'XGLE.L',    // Xtrackers II Eurozone Govt Bond LSE
          // Xtrackers Global Govt Bond varianten
          'DBZB.MI',   // Xtrackers II Global Govt Bond MIL
          'DBZB.L',    // Xtrackers II Global Govt Bond LSE
          'DBZB.SW',   // Xtrackers II Global Govt Bond SWX
          // Xtrackers EUR Corp Bond varianten
          'XBLR.L',    // Xtrackers II EUR Corp Bond LSE
          'XBLR.SW',   // Xtrackers II EUR Corp Bond SWX
          // Xtrackers Infl Linked
          'XGIG.DE',   // Xtrackers II Eurozone Inflation Linked XETR
          'XGIG.L',    // Xtrackers II Global Inflation Linked LSE
          'XGIN.DE',   // Xtrackers II Global Inflation Linked EUR Hedged XETR
          // iShares Amundi Xetra alternatieven
          'CRPE.DE',   // Amundi EUR Corp Bond ESG XETR
                    // EGBG.DE al eerder verwijderd - skip
                    // AHYG.DE geeft Amundi Index Solutions Amundi Global (foute naam) - verwijderd
          'SHT.DE',    // Amundi US Treasury Bond 1-3Y XETR
                    // ULTE.L toont geen data - verwijderd
          // iShares extra varianten
          'IGLB.L',    // iShares Global Inflation Linked LSE
          'CRPH.MI',   // iShares Global Corp Bond EUR Hedged MIL
          'GHYG.DE',   // iShares Global HY Corp Bond XETR  
          'GHYG.SW',   // iShares Global HY Corp Bond SWX
          'IBC7.MI',   // iShares Fallen Angel HY EUR Hedged MIL
          'SUEF.DE',   // iShares EU Corp Bond ex Financials XETR
          'GROE.MI',   // iShares EUR Green Bond MIL
          'EUGR.MI',   // iShares EUR Green Bond MIL variant
          'ERNE.MI',   // iShares EUR Ultrashort Bond MIL variant
          'SDCB.DE',   // iShares USD Short Duration Corp Bond XETR
          'HYLD.MI',   // iShares USD HY Corp Bond EUR Hedged MIL
          'EMHE.SW',   // iShares JPM USD EM Bond EUR Hedged SWX
          // SPDR extra
          'GLAG.DE',   // SPDR BBG Global Aggregate XETR
          'GLAE.DE',   // SPDR BBG Global Aggregate EUR Dist XETR
          'GLGE.MI',   // SPDR BBG 1-3Y EUR Govt Bond MIL
          'GLGE.DE',   // SPDR BBG 1-3Y EUR Govt Bond XETR
          'GLGG2.DE',  // SPDR BBG 10+Y Euro Govt Bond XETR
          'GLSC.DE',   // SPDR BBG Sterling Corp Bond XETR
          'GLUK.DE',   // SPDR BBG UK Gilt XETR
          'SEMG.DE',   // SPDR ICE BofA 0-5Y EM USD Govt Bond XETR
          'EMDL.DE',   // SPDR BBG EM Local Bond XETR
          // VanEck
          'TSOV.DE',   // VanEck iBoxx EUR Sovereign XETR
          'CORP2.DE',  // VanEck iBoxx EUR Corporates XETR
          // UBS SWX
          'TIPS2.SW',  // UBS BBG TIPS 1-10 SWX variant
          // PIMCO
          'PIMCO.MI',  // PIMCO HY variant MIL
          'STHS2.DE',  // PIMCO US ShTerm HY XETR
          // Amundi PAR & MIL varianten
          'AM3E.DE',   // Amundi Euro Govt Bond 3-5Y XETR
          'AM3G.DE',   // Amundi Euro Govt Bond 7-10Y XETR
                    // GGRE.MI geeft WisdomTree Global Quality Dividend Growth (aandelen) - verwijderd
          'FLTC.MI',   // Amundi Floating Rate Euro Corp MIL
          'AGGH2.MI',  // Amundi Core Global Govt Bond EUR Hedged MIL
          // iShares Xetra - EUN* serie (Eurozone Govt Bond maturity buckets)
          'EUN6.DE',   // iShares EUR Govt Bond 0-1yr XETR (= IBGZ.DE)
                    // EUN7.DE geeft geen volledige data
          'EUN8.DE',   // iShares EUR Govt Bond 10-15yr XETR (= IBGX.AS variant)
          'EUNH.AS',   // iShares Core EUR Govt Bond AMS variant
          // iShares Xetra - IS0* serie (Treasury/HY)
          'IS04.DE',   // iShares $ Treasury Bond 20+yr XETR (= IBTL.DE)
          'IS0H.DE',   // iShares EUR Govt Bond 3-5yr XETR (= IBGK.DE)
          'SXRQ.DE',   // iShares EUR Govt Bond 7-10yr ETF Acc XETR (= IBGP/SXRQ)
                    // SXRG.DE geeft iShares MSCI USA Small Cap op Yahoo - verwijderd
          // iShares Milan varianten
          'IBGZ.MI',   // iShares EUR Govt Bond 10-15yr MIL
          'IBGK.MI',   // iShares EUR Govt Bond 3-5yr MIL
          'IBGE.MI',   // iShares EUR Govt Bond 1-3yr MIL variant
          // Vanguard Xetra
          'VGEA.DE',   // Vanguard EUR Eurozone Govt Bond XETR (= VETY.DE)
          'VGEA.MI',   // Vanguard EUR Eurozone Govt Bond MIL
          // Xtrackers bond Xetra
          'DBZB.DE',   // Xtrackers II EUR Corporate Bond (= XBLR.DE)
          'DBZB.MI',   // Xtrackers II EUR Corporate Bond MIL
          'DBXG.DE',   // Xtrackers II Eurozone Govt Bond (= XGSH.DE)
          'DBXR.DE',   // Xtrackers II Eurozone Govt Bond 1-3yr (= XGSG.DE)
                    // DXET.DE geeft Xtrackers Euro Stoxx 50 (aandelen) op Yahoo - verwijderd
          'DXEM.DE',   // Xtrackers II Global Aggregate Swap (= XGAG.DE)
          'XHY3.MI',   // Xtrackers II EUR HY Bond MIL
          'XGSH.MI',   // Xtrackers II Eurozone Govt Bond MIL
          // Amundi PAR varianten
          'AM3E.MI',   // Amundi Euro Govt Bond 3-5Y MIL
          'AM3G.MI',   // Amundi Euro Govt Bond 7-10Y MIL
          'EGBG.MI',   // Amundi Euro Govt Tilted Green Bond MIL
          'AHYG.MI',   // Amundi EUR HY Corp Bond ESG MIL
          'ULTE.MI',   // Amundi Euro Corp Bond 0-1Y MIL
          'SHT.MI',    // Amundi US Treasury Bond 1-3Y MIL
          // SPDR Xetra
          'SPXB.MI',   // SPDR BBG 1-3 Month T-Bill MIL
          'GLAG.MI',   // SPDR BBG Global Aggregate MIL
          'GLAE.MI',   // SPDR BBG Global Aggregate EUR Dist MIL
          'SYBJ.DE',   // SPDR BBG Euro HY Bond XETR (= SPXB.DE variant)
          // VanEck AMS
          'CORP2.MI',  // VanEck iBoxx EUR Corporates MIL
          'TSOV.MI',   // VanEck iBoxx EUR Sovereign MIL
          // Vanguard AMS/MIL varianten
          'VDEM.MI',   // Vanguard USD EM Govt Bond MIL
          'VUTY.DE',   // Vanguard USD Treasury Bond XETR
          'VECP.MI',   // Vanguard EUR Corp Bond MIL
          // UBS SWX
          'ULCO.DE',   // UBS BBG US Liquid Corp XETR
          'SDBB.DE',   // UBS Sustainable Dev Bank Bonds XETR
          // iShares SWX varianten
          'IABT.SW',   // iShares $ Treasury Bond 1-3yr SWX variant
          'IBTM.SW',   // iShares $ Treasury Bond 7-10yr SWX variant
          // PIMCO
          'STHS.MI',   // PIMCO ShTerm HY Corp Bond MIL (= STHS2.MI)
          'STYLD.DE',  // PIMCO Advtge US ShTerm HY XETR
          // JPMorgan
          'JPMF.DE',   // JP Morgan EUR Ultra-Short Income XETR
          // L&G
          'EMGB.DE',   // L&G EM Govt Bond USD 0-5yr XETR
          // Amundi extras
                    // USCP.DE geeft Ossiam Shiller Barclays op Yahoo - verwijderd
          'GGRE.DE',   // Amundi Global Aggregate Green Bond XETR
          'FLTC.MI',   // Amundi Floating Rate Euro Corp MIL
          'CRPE.MI',   // Amundi Euro Corp Bond ESG MIL
          'HYLDE.DE',  // Amundi USD HY EUR Hedged XETR
          'HYLD2.DE',  // Amundi USD HY LSE variant XETR
          // iShares extra varianten
          'IBTE.L',    // iShares $ Treasury Bond 1-3yr EUR Hedged LSE (was IBTE.DE)
          'SUHY.MI',   // iShares USD HY Corp Bond ESG SRI MIL
          'SDBU.MI',   // iShares $ Corp Bond ESG SRI MIL
          'CRHE.DE',   // iShares Corp Bond Interest Rate Hdg ESG XETR
          'SUIA.MI',   // iShares EUR Aggregate Bond ESG SRI MIL
          'SE15.MI',   // iShares EUR Corp Bond 0-3yr ESG SRI MIL
          'EUGR.MI',   // iShares EUR Green Bond MIL
          'SE06.MI',   // iShares EUR Ultrashort Bond MIL
          'ERNS.MI',   // iShares Euro Corp Bond ESG SRI MIL
          'EMLB.MI',   // iShares JP Morgan EM Local Govt Bond MIL
          'IBTF.DE',   // iShares $ Treasury Bond 1-3yr Acc XETR
          'SLQD.DE',   // iShares USD Short Duration Corp Bond XETR
          'STIP.DE',   // iShares USD TIPS 0-5 XETR
          'IBTA2.DE',  // iShares USD Treasury Bond 0-1yr XETR variant
          'DTLA.MI',   // iShares USD Treasury Bond 20+yr EUR Hedged MIL
          'IB28X.DE',  // iShares iBonds Dec 2028 Crossover XETR
          'PAAC.MI',   // iShares EUR Corp Bond ESG Paris MIL
          'SUAE.MI',   // iShares EUR Corp Bond ESG SRI MIL
          'SUDE.MI',   // iShares $ Corp Bond ESG SRI MIL
          'IEGE.MI',   // iShares Treasury Bond 7-10yr EUR Hedged MIL
          'EMHE.DE',   // iShares JPM USD EM Bond EUR Hedged XETR
          'AEMB.DE',   // iShares JP Morgan Advanced EM Bond XETR
          'IGLB.DE',   // iShares Global Inflation Linked XETR
          'IGIL.MI',   // iShares Global Inflation Linked MIL
          'GHYG.DE',   // iShares Global HY Corp Bond XETR
                    // SUGA.MI geeft WisdomTree Sugar (grondstoffen) op Yahoo - verwijderd
          'IBC7.MI',   // iShares Fallen Angel HY EUR Hedged MIL
          'SUEF.MI',   // iShares EU Corp Bond ex Financials MIL
          'GROE.MI',   // iShares EUR Green Bond MIL variant
          'ERNE.DE',   // iShares EUR Ultrashort Bond XETR
                    // SESG.MI geeft Saturna Sustainable ESG (aandelen) op Yahoo - verwijderd
          // === BATCH 2 - gevonden via searches ===
          // Xtrackers bond MIL/XETR alternatieven
          'XHYG.MI',  // Xtrackers II EUR HY Corp Bond MIL (= XHY3.DE variant)
          'XHYG.DE','XHYG.SW', // Xtrackers II EUR HY Corp Bond XETR + CHF SWX
          'XGLE.MI',  // Xtrackers II Eurozone Govt Bond MIL (= XGSH.DE variant)
          'XGLE.DE',  // Xtrackers II Eurozone Govt Bond XETR
          'XGIN.MI',  // Xtrackers II Global Inflation-Linked Bond EUR Hedged MIL
          // SPDR bond varianten
          'SPFE.DE',  // SPDR Bloomberg Global Aggregate Bond EUR Hedged XETR
          'SPFE.MI',  // SPDR Bloomberg Global Aggregate Bond EUR Hedged MIL
          'SYBB.DE',  // SPDR Bloomberg Euro Government Bond XETR
          'SYBB.MI',  // SPDR Bloomberg Euro Government Bond MIL
          // Amundi extra varianten
          'AM3E.DE',  // Amundi Euro Govt Bond 3-5Y XETR
          'AM3G.DE',  // Amundi Euro Govt Bond 7-10Y XETR
          'AM3H.MI',  // Amundi Euro Govt Bond 10-15Y MIL
          'ULCO.MI',  // UBS BBG US Liquid Corp MIL
          'SDBB.MI',  // UBS Sustainable Dev Bank Bonds MIL
          'EMSU.MI',  // UBS BBG USD EM Sovereign MIL
          // iShares extra varianten
          'IBGK.AS',  // iShares EUR Govt Bond 3-5yr AMS (nieuwe poging)
          'IBGN.AS',  // iShares EUR Govt Bond 3-7yr AMS
          'IBGP.AS',  // iShares EUR Govt Bond 7-10yr AMS
          'IBGX.MI',  // iShares EUR Govt Bond 3-5yr MIL
          'IBGM.MI',  // iShares EUR Govt Bond 7-10yr MIL
          'IBGL.MI',  // iShares EUR Govt Bond 15-30yr MIL
          'AEMB.MI',  // iShares JP Morgan Advanced EM Bond MIL
          'EMHE.L',   // iShares JPM USD EM Bond EUR Hedged LSE (was EMHE.L)
          'GHYG.MI',  // iShares Global HY Corp Bond MIL
          'IGLB.MI',  // iShares Global Inflation Linked MIL
          'IGIL.DE',  // iShares Global Inflation Linked XETR
          // VanEck bond varianten
          'CORP2.MI', // VanEck iBoxx EUR Corporates MIL
          'TSOV.MI',  // VanEck iBoxx EUR Sovereign MIL
          'TSOV2.MI', // VanEck iBoxx EUR Sov Capped AAA-AA 1-5 MIL
          // BNPP bond
          'SRPE.DE',  // BNPP Easy EUR Corp Bond SRI PAB XETR
          // JPMorgan bond
          'JPMF.DE',  // JP Morgan EUR Ultra-Short Income XETR (hertest)
          // Amundi Inflation-Linked
          'INFL.DE',  // Amundi EUR Govt Inflation-Linked Bond XETR
          // Ontbrekende tickers
          'AHYG2.DE','CGBH.PA','AM3A.MI',                   // Amundi extras
          'USCP.L',                                           // Amundi USD Corp Bond PAB
          // BIL/JNK/SHY/IEF/TLT/AGG/HYG/TIP/EMB/LEMB/BSV - staan al hoger in de lijst
          'VETY.SW','VAGS.DE',                               // Vanguard extras
          'XGCB.MI','XGIG3.SW','XGIG2.L',                  // Xtrackers extras
          'SDBU.DE','SUHY.DE',                               // iShares USD HY ESG SRI XETR
                    // iShares Core EUR Corp Bond XETR/MIL - ISAC tickers geven aandelen ETF op Yahoo
          'CSBGU0.MI',                                       // iShares Core EUR Govt Bond MIL
          'AGGU.L','AGGG.L','AGGH.SW',                      // iShares Core Global Aggregate Bond
          'CRHE.L','IS15.L',                                 // iShares Corp Bond extras
          'SUIA.DE','SE15.DE','SUA0.DE',                    // iShares EUR Corp Bond ESG extras
          'IBGE.L',                                          // iShares EUR Govt Bond 1-3yr Acc LSE
          'EUGR.DE',                                         // iShares EUR Green Bond XETR
          'SE06.DE','ERNS.DE',                               // iShares EUR Ultrashort extras
          'IBCI.MI',                                         // iShares Euro Inflation Linked MIL
                    'GHYS.L',                                 // iShares Global HY Bond Acc LSE
          'SEMB.L','EMLB.DE','EMCB.L',                      // iShares EM Bond extras
          'IBTF.L','SLQD.L',                                 // iShares USD Corp/Treasury extras
          'STIP.L','IBTA2.L',                                // iShares TIPS/Treasury extras
          'IBTL.L','DTLA.DE',                                // iShares USD Treasury 20+yr
          'CBU7.AS',                                         // iShares USD Treasury 3-7yr AMS
          'IB28X.MI',                                        // iShares iBonds Dec 2028 Crossover
          // === BATCH 7 - Nieuwe Saxo tickers (juni 2026) ===
          // AMUNDI
          'U13H.MI',   // Amundi US Treasury Bond 1-3Y MIL
          'AEHY.DE',   // Amundi Core EUR High Yield Bond XETR
          'GOVH.PA',   // Amundi Core Glbl Govt Bond EUR Hdg Acc PAR
          'ECR1.MI',   // Amundi Euro Corp Bond 0-1y ESG MIL
          'ECRP3.PA',  // Amundi Euro Corporate Bond 0-3Y ESG PAR
          'ECRP.PA',   // Amundi Euro Corporate Bond ESG PAR
          'MTE.PA',    // Amundi Euro Government Bond 10-15Y Acc PAR
          'EM35.MI',   // Amundi Euro Government Bond 3-5Y MIL
          'EM710.MI',  // Amundi Euro Government Bond 7-10Y DR MIL
          'CB3.MI',    // Amundi Euro Govt Tilted Green Bond MIL
          'AFRN.PA',   // Amundi Floating Rate Euro Corporate ESG PAR
          'CLIM.L',    // Amundi Global Aggregate Green Bond DR LSE
          'PRAR.DE',   // Amundi Prime Euro Government Bond Acc XETR
          'PR1R.DE',   // Amundi Prime Euro Government Bond Dist XETR
          'PRAB.DE',   // Amundi Prime Euro Govt Bond 0-1Y Acc XETR
          '7USH.DE',   // Amundi US Treasury 7-10 EUR Hedged XETR
          'US7.MI',    // Amundi US Treasury 7-10 USD MIL
          'U71H.L',    // Amundi US Treasury Bond 7-10Y GBP LSE
          'USIX.L',    // Amundi USD Corporate Bond PAB LSE
          'USYH.MI',   // Amundi USD HY Corp ESG EUR Hedged MIL
          'UHYG.L',    // Amundi USD High Yield Corp Bond ESG LSE
          // BNPP
          'SRIC.MI',   // BNPP Easy EUR Corp Bond SRI PAB MIL
          // iSHARES nieuw
          'CBUP.DE',   // iShares EUR Green Bond ~248 XETR
          '36BA.DE',   // iShares $ Corp Bond ESG SRI ~3.87 XETR
          '5UOA.DE',   // iShares $ Corp Bond ESG SRI ~4.64 XETR
          'DHYG.L',    // iShares $ High Yield Corp Bond ESG LSE
          'TI5A.AS',   // iShares $ TIPS 0-5 USD Acc AMS
          'IRCP.L',    // iShares Corp Bnd IR Hdg ESG SRI LSE
          'EUNS.DE',   // iShares EU CorpBnd exFincls 1-5y ESG XETR
          'CBUJ.DE',   // iShares EUR Corp Bond ESG Paris-AC XETR
          'SECA.DE',   // iShares EUR Government Bond Climate XETR
          'CBE3.L',    // iShares EUR Govt Bond 1-3yr Acc LSE
          'IS05.DE',   // iShares EUR Govt Bond 20yr Target Dur XETR
          'IEGY.AS',   // iShares EUR Govt Bond 5-7yr AMS
          'GRON.DE',   // iShares EUR Green Bond ~3.95 XETR
          'EHYA.AS',   // iShares EUR HY Corp Bond ESG SRI AMS
          'EHYG.L',    // iShares EUR HY Corp Bond ESG GBP LSE
          'EUED.DE',   // iShares EUR Ultrashort Bond ESG XETR
          'CBE7.AS',   // iShares Euro Government Bond 3-7y Acc AMS
          'IBC7.DE',   // iShares Fallen Angel HY Corp EUR Hdg XETR
          'AEGE.DE',   // iShares Global Aggregate Bond ESG SRI XETR
          'IBCQ.DE',   // iShares Global Corporate Bond EUR Hedged XETR
          'EMSA.L',    // iShares JP Morgan Advanced $ EM Bond LSE
          'EMCR.L',    // iShares JP Morgan USD EM Corp Bond LSE
          'EMBE.MI',   // iShares JPM USD EM Bond EUR Hedged MIL
          'IBB1.DE',   // iShares Treasury Bond 7-10yr EUR Hedged XETR
          'UEEG.DE',   // iShares USD Development Bank Bonds XETR
          'DHYA.L',    // iShares USD High Yield Corp Bond ESG LSE
          'IBC2.DE',   // iShares USD HY Corp Bond EUR Hedged XETR
          'IHYA.L',    // iShares USD High Yield Corp Bond Acc LSE
          'SDIA.L',    // iShares USD Short Duration Corp Bond Acc LSE
          'TIP5.L',    // iShares USD TIPS 0-5 LSE
          '2B7S.DE',   // iShares USD Treasury Bond 1-3yr EUR Hdg XETR
          'ERNA.L',    // iShares USD Ultrashort Bond LSE
          // JPMORGAN
          'JEST.DE',   // JP Morgan EUR Ultra-Short Income Active XETR
          'BB3M.L',    // JPM BetaBuilders US Treasury 0-3M LSE
          'JHYU.L',    // JPM Global HY Corp Bond MF LSE
          // L&G
          'EMD5.MI',   // L&G EM Govt Bond USD 0-5Y Screened MIL
          // PIMCO
          'STHE.MI',   // PIMCO Advtge US ST HY Corp Bond EUR MIL
          'STHY.MI',   // PIMCO US ST HY Corp Bond EUR MIL
          'LDCE.DE',   // PIMCO Advg Euro Low Duration Corp Bond XETR
          // SPDR
          'TBIL.SW',   // SPDR Bloomberg 1-3 Month T-Bill SWX
          // STATE STREET
          'LGOV.MI',   // State St SPDR BBG 10+Y Euro GovBd MIL
          'SYB3.DE',   // State St SPDR BBG 1-3Y Euro GovBd XETR
          'UKCO.L',    // State St SPDR BBG Sterling CorpBd LSE
          'EMH5.MI',   // State St SPDR ICE BofA 0-5Y EM USD MIL
          'EMLD.MI',   // State Street SPDR BBG EM Local Bd MIL
          // UBS
          'CBSEU.SW',  // UBS BBG MSCI Euro Area Corp Sust SWX
          'CBSUST.SW', // UBS BBG MSCI US Liquid Corp Sust SWX
          'TIP1S.SW',  // UBS BBG TIPS 1-10 SWX
          'CBUSS.SW',  // UBS BBG US Liquid Corp SWX
          'SBEMS.SW',  // UBS BBG USD EM Sovereign SWX
          'MDBC.SW',   // UBS Sustainable Dev Bank Bonds SWX
          // VANECK
          'TCBT.AS',   // VanEck iBoxx EUR Corporates AMS
          'TAT.AS',    // VanEck iBoxx EUR Sov Capped AAA-AA 1-5 AMS
          'TGBT.AS',   // VanEck iBoxx EUR Sovereign 1-10 AMS
          // VANGUARD
          'VGGF.DE',   // Vanguard Global Government Bond XETR
          'VEMT.AS',   // Vanguard USD EM Govt Bond AMS
          // WISDOMTREE
          'COBO.MI',   // WisdomTree AT1 CoCo Bond Hedged MIL
          // XTRACKERS
          'XB4F.DE',   // Xtrackers ESG EUR Corp Bond SRI PAB XETR
          'XGBE.MI',   // Xtrackers EUR Corporate Green Bond MIL
          'XEZB.DE',   // Xtrackers Eurozone Govt Bond ESG Tilted XETR
          'XGSG.L',    // Xtrackers Global Government Bond LSE
          'DBXP.DE',   // Xtrackers II Eurozone Govt Bond 1-3 XETR
          'XG7G.SW',   // Xtrackers II Glbl Infl CHF Hdg SWX
          'XBAE.DE',   // Xtrackers II Global Aggregate Bond Swap XETR
        ],
        gemengd: [
          'VNGA80.AS','VNGA60.AS','VNGA40.AS','VNGA20.AS','IMAP.AS','FLXA.AS',
          'XDEB.DE','MACK.DE',
          // === BATCH 8 - Gemengde ETFs (juni 2026) ===
          // Amplify / Invesco US
          'YYY',       // Amplify CEF High Income ETF NYSE
          'PCEF',      // Invesco CEF Income Composite ETF NYSE
          'CVY',       // Invesco Zacks Multi-Asset Income ETF NYSE
          'AOA',       // iShares Core 80/20 Aggressive Allocation ETF NYSE
          'IYLD',      // iShares Morningstar Multi Asset Income ETF BATS
          // Global Balanced Fund
          'ROE.DE','ROE_NEW.MI', // Global Balanced Fund UCITS ETF XETR + MIL
          // iShares Portfolio UCITS
          'MACV.DE','MACV.MI',   // iShares Conservative Portfolio XETR + MIL
          'MODR.DE','MODR.MI',   // iShares Moderate Portfolio XETR + MIL
          'MAGR.DE','MAGR.MI',   // iShares Growth Portfolio XETR + MIL
          // State Street SPDR Multi-Asset
          'ZPRI.DE',   // State St SPDR MS MultiAst Glbl Infr XETR EUR
          'MAGI.L',    // State St SPDR MS MultiAst Glbl Infr LSE USD
          'GIN.L',     // State St SPDR MS MultiAst Glbl Infr LSE GBP
          // VanEck Multi-Asset
          'NTM.AS',    // VanEck Multiasset Balanced AMS
          'DTM.AS',    // VanEck Multiasset Conservative AMS
          'TOF.AS',    // VanEck Multiasset Growth AMS
          // Vanguard LifeStrategy - nieuwe varianten
          'VNGA20.MI','V20A.AS','V20A.DE','V20D.AS','V20D.DE','VNGD20.MI',
          'VNGA40.MI','V40A.DE','V40D.AS','V40D.DE','VNGD40.MI',
          'VNGA60.MI','V60A.AS','V60A.DE','V60D.AS','V60D.DE','VNGD60.MI',
          'VNGA80.MI','V80A.AS','V80A.DE','V80D.AS','V80D.DE','VNGD80.MI',
          // WisdomTree
          'NTSG.DE',   // WisdomTree Global Efficient Core XETR
          // Xtrackers Portfolio
          'XS7W.DE','XS7W.MI',   // Xtrackers Portfolio Income XETR + MIL
          'XQUI.DE','XQUI.MI',   // Xtrackers Portfolio XETR + MIL
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
        'SWDA.SW':  { ter: 0.20, tob: 0.12 },
        'IWDA.L':   { ter: 0.20, tob: 0.12 },
        'IWDG.L':   { ter: 0.20, tob: 0.12 },
        'IWDA.AS':  { ter: 0.20, tob: 0.12 },
        'EUNL.DE':  { ter: 0.20, tob: 0.12 },
        'SWDA.MI':  { ter: 0.20, tob: 0.12 },
        'IVV':      { ter: 0.03, tob: 0.35 },
        'CSSPX.MI': { ter: 0.07, tob: 0.12 },
        'CSSPX.SW': { ter: 0.07, tob: 0.12 },
        'CSPX.AS':  { ter: 0.07, tob: 0.12 },
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
        'IMEA.SW':  { ter: 0.12, tob: 0.12 },
        'IMAE.AS':  { ter: 0.12, tob: 0.12 },
        'EUNK.DE':  { ter: 0.12, tob: 0.12 },
        'SMEA.AS':  { ter: 0.12, tob: 0.12 },
        'SMEA.MI':  { ter: 0.12, tob: 0.12 },
        'IMEU.AS':  { ter: 0.12, tob: 0.12 },
        'IEUA.AS':  { ter: 0.12, tob: 0.12 },
        'VHYL.AS':  { ter: 0.29, tob: 0.12 },
        'VFEM.AS':  { ter: 0.22, tob: 0.12 },
        'EDM2.DE':  { ter: 0.18, tob: 0.12 },
        'EMEG.MI':  { ter: 0.18, tob: 0.12 },
        'EDM4.DE':  { ter: 0.18, tob: 0.12 },
        'AYEM.DE':  { ter: 0.18, tob: 0.12 },
        'OM3Y.DE':  { ter: 0.18, tob: 0.12 },
        'SAEM.DE':  { ter: 0.18, tob: 0.12 },
        'IEMA.AS':  { ter: 0.18, tob: 0.12 },
        'SEMA.SW':  { ter: 0.18, tob: 0.12 },
        'SAEM.MI':  { ter: 0.18, tob: 0.12 },
        'AEEM.PA':  { ter: 0.20, tob: 0.12 },
        'IWFV.L':   { ter: 0.25, tob: 0.12 },
        'IS3S.DE':  { ter: 0.25, tob: 0.12 },
        'IWVL.DE':  { ter: 0.25, tob: 0.12 },
        'IWVL.MI':  { ter: 0.25, tob: 0.12 },
        'IS3R.DE':  { ter: 0.25, tob: 0.12 },
        'IWMO.DE':  { ter: 0.25, tob: 0.12 },
        'IS3Q.DE':  { ter: 0.25, tob: 0.12 },
        'MINV.L':   { ter: 0.35, tob: 0.12 },
        'MVOL.DE':  { ter: 0.35, tob: 0.12 },
        'MVEW.DE':  { ter: 0.20, tob: 0.12 },
        'SXR0.DE':  { ter: 0.20, tob: 0.12 },
        'MVEA.DE':  { ter: 0.20, tob: 0.12 },
        'SEC0.DE':  { ter: 0.35, tob: 0.12 },
        'SEME.MI':  { ter: 0.35, tob: 0.12 },
        'SEC0.DE':  { ter: 0.35, tob: 0.12 },
        'SEME.MI':  { ter: 0.35, tob: 0.12 },
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
        'IUSN.DE':  { ter: 0.35, tob: 0.12 },
        'WSML.DE':  { ter: 0.35, tob: 0.12 },
        'SSAC.SW':  { ter: 0.20, tob: 0.12 },
        'IUSQ.AS':  { ter: 0.20, tob: 0.12 },
        'IUSQ.DE':  { ter: 0.20, tob: 0.12 },
        'IQQH.DE':  { ter: 0.65, tob: 0.12 },
        'INRG.MI':  { ter: 0.65, tob: 0.12 },
        'CLEA.MI':  { ter: 0.65, tob: 0.12 },
        'IAUP.SW':  { ter: 0.55, tob: 0.12 },
        'IS0E.DE':  { ter: 0.55, tob: 0.12 },
        'GDX.MI':   { ter: 0.51, tob: 0.12 },
        'DFNS.DE':  { ter: 0.49, tob: 0.12 },
        'DFNS.MI':  { ter: 0.49, tob: 0.12 },
        'WDEF.DE':  { ter: 0.40, tob: 0.12 },
        '2B76.DE':  { ter: 0.40, tob: 0.12 },
        'RBOT.SW':  { ter: 0.40, tob: 0.12 },
        'RBOT.DE':  { ter: 0.40, tob: 0.12 },
        'GCAR.L':   { ter: 0.40, tob: 0.12 },
        'ECAR.MI':  { ter: 0.40, tob: 0.12 },
        'AGED.MI':  { ter: 0.40, tob: 0.12 },
        'BATG.L':   { ter: 0.49, tob: 0.12 },
        'BATT.MI':  { ter: 0.49, tob: 0.12 },
        'RENG.L':   { ter: 0.49, tob: 0.12 },
        'RENW.MI':  { ter: 0.49, tob: 0.12 },
        'GLGG.MI':  { ter: 0.49, tob: 0.12 },
        'XAIX.DE':  { ter: 0.35, tob: 0.12 },
        'XAIX.MI':  { ter: 0.35, tob: 0.12 },
        'QDV5.DE':  { ter: 0.65, tob: 0.12 },
        'IIND.DE':  { ter: 0.65, tob: 0.12 },
        'EUNN.DE':  { ter: 0.12, tob: 0.12 },
        'SJPA.MI':  { ter: 0.12, tob: 0.12 },
        'SJPA.L':   { ter: 0.12, tob: 0.12 },
        'CJPA.SW':  { ter: 0.12, tob: 0.12 },
        'JPNH.SW':  { ter: 0.12, tob: 0.12 },
        'IJPN.AS':  { ter: 0.12, tob: 0.12 },
        'IJPA.MI':  { ter: 0.12, tob: 0.12 },
        'EXS2.DE':  { ter: 0.12, tob: 0.12 },
        'IJSE.DE':  { ter: 0.12, tob: 0.12 },
        'IJPN.AS':  { ter: 0.12, tob: 0.12 },

        'IAEX.AS':  { ter: 0.30, tob: 0.12 },
        'IUES.SW':  { ter: 0.15, tob: 0.12 },
        'IUSE.MI':  { ter: 0.15, tob: 0.12 },
        'EXH1.DE':  { ter: 0.60, tob: 0.12 },
        'EUEA.AS':  { ter: 0.10, tob: 0.12 },
        'SXRT.DE':  { ter: 0.10, tob: 0.12 },
        'CSSX5E.MI':{ ter: 0.10, tob: 0.12 },
        'TDIV.AS':  { ter: 0.38, tob: 0.12 },
        'TGET.AS':  { ter: 0.29, tob: 0.12 },
        'TRET.AS':  { ter: 0.25, tob: 0.12 },
        'VUKE.L':   { ter: 0.09, tob: 0.12 },
        'EUSC.DE':  { ter: 0.20, tob: 0.12 },
        'SLMC.DE':  { ter: 0.20, tob: 0.12 },
        'IUSK.DE':  { ter: 0.20, tob: 0.12 },
        'SLUS.DE':  { ter: 0.20, tob: 0.12 },
        'GPSA.L':   { ter: 0.20, tob: 0.12 },
        'SGAS.DE':  { ter: 0.20, tob: 0.12 },
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
        'IGF':      { ter: 0.40, tob: 0.35 },
        'INFR.MI':  { ter: 0.65, tob: 0.12 },
        'IPRV.SW':  { ter: 0.75, tob: 0.12 },
        'ICHN.AS':  { ter: 0.65, tob: 0.12 },
        'ISDE.L':   { ter: 0.65, tob: 0.12 },
        'SUSM.L':   { ter: 0.65, tob: 0.12 },
        'ISDW.L':   { ter: 0.65, tob: 0.12 },
        'ISDU.L':   { ter: 0.65, tob: 0.12 },
        'SUAS.L':   { ter: 0.20, tob: 0.12 },
        'ICGA.AS':  { ter: 0.65, tob: 0.12 },
        'QDVX.DE':  { ter: 0.20, tob: 0.12 },
        'QDVW.DE':  { ter: 0.20, tob: 0.12 },
        'QDVE.DE':  { ter: 0.20, tob: 0.12 },
        'IUIT.SW':  { ter: 0.20, tob: 0.12 },
        'QDVA.DE':  { ter: 0.20, tob: 0.12 },
        'CBUC.DE':  { ter: 0.18, tob: 0.12 },
        'EDMU.DE':  { ter: 0.18, tob: 0.12 },
        'SAUA.MI':  { ter: 0.18, tob: 0.12 },
        'EMND.DE':  { ter: 0.18, tob: 0.12 },
        'EMUE.DE':  { ter: 0.18, tob: 0.12 },
        'SAWD.SW':  { ter: 0.20, tob: 0.12 },
        'SNAW.DE':  { ter: 0.20, tob: 0.12 },
        'WQDE.DE':  { ter: 0.38, tob: 0.12 },
        'IWDE.DE':  { ter: 0.20, tob: 0.12 },
        'IWDE.MI':  { ter: 0.20, tob: 0.12 },
        'IWDH.MI':  { ter: 0.55, tob: 0.12 },
        'CNDX.L':   { ter: 0.33, tob: 0.12 },
        'CNDX.AS':  { ter: 0.33, tob: 0.12 },
        'ANAU.MI':  { ter: 0.14, tob: 0.12 },
        'ANAV.DE':  { ter: 0.14, tob: 0.12 },
        'MEUD.L':   { ter: 0.07, tob: 0.12 },
        'MEUD.PA':  { ter: 0.07, tob: 0.12 },
        'LYP6.DE':  { ter: 0.07, tob: 0.12 },
        'DEFS.PA':  { ter: 0.16, tob: 0.12 },
        'ETZ.PA':   { ter: 0.19, tob: 0.12 },
        'ESE.PA':   { ter: 0.19, tob: 0.12 },
        'PABUS.MI': { ter: 0.07, tob: 0.12 },
        'PAPU.MI':  { ter: 0.07, tob: 0.12 },
        'C6E.PA':   { ter: 0.18, tob: 0.12 },
        'AME6.DE':  { ter: 0.18, tob: 0.12 },
        'AME6.F':   { ter: 0.18, tob: 0.12 },
        'CSE6.SW':  { ter: 0.18, tob: 0.12 },
        'FWIA.DE':  { ter: 0.15, tob: 0.12 },
        'LVLC.L':   { ter: 0.25, tob: 0.12 },
        'LVLC.DE':  { ter: 0.25, tob: 0.12 },
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
        'TEMP.MI':  { ter: 0.55, tob: 0.12 },
        'JPCS.MI':  { ter: 0.55, tob: 0.12 },
        'JREU.MI':  { ter: 0.25, tob: 0.12 },
        // Nieuw toegevoegd
        'IAGB.SW':  { ter: 0.15, tob: 0.35 },
        'ISAG.L':   { ter: 0.55, tob: 0.12 },
        'NUCL.MI':  { ter: 0.55, tob: 0.12 },
        'MWRE.DE':  { ter: 0.12, tob: 0.12 },
        'MWRD.MI':  { ter: 0.12, tob: 0.12 },
        'LYPG.DE':  { ter: 0.30, tob: 0.12 },
        'ETSZ.DE':  { ter: 0.19, tob: 0.12 },
        'GLUG.MI':  { ter: 0.49, tob: 0.12 },
        'GLGG.L':   { ter: 0.49, tob: 0.12 },
        'JREU.MI':  { ter: 0.20, tob: 0.12 },
        'SPYI.DE': { ter: 0.17, tob: 0.12 },
        'SPPY.DE':  { ter: 0.03, tob: 0.12 },
        'ICHD.AS':  { ter: 0.40, tob: 0.12 },
        'QUTM.DE':  { ter: 0.55, tob: 0.12 },
        'QNTM.MI':  { ter: 0.55, tob: 0.12 },
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
        'SGAJ.DE':  { ter: 0.20, tob: 0.12 },
        'XMJP.DE':  { ter: 0.20, tob: 0.12 },
        'XZWD.DE':  { ter: 0.20, tob: 0.12 },
        'SPY5.AS':  { ter: 0.03, tob: 0.12 },
        'VNGA80.AS':{ ter: 0.25, tob: 0.12 },
        'VNGA60.AS':{ ter: 0.25, tob: 0.12 },
        'VNGA40.AS':{ ter: 0.25, tob: 0.12 },
        'VNGA20.AS':{ ter: 0.25, tob: 0.12 },
        // Obligatie ETFs
        // iShares Core
        'AGGH.AS':  { ter: 0.10, tob: 0.12 }, 'AGGH.DE':  { ter: 0.10, tob: 0.12 },
        'AGGH.L':   { ter: 0.10, tob: 0.12 }, 'AGGH.MI':  { ter: 0.10, tob: 0.12 },
        'IEAG.AS':  { ter: 0.17, tob: 0.12 },
        'IEGA.AS':  { ter: 0.09, tob: 0.12 }, 'SXRM.DE':  { ter: 0.09, tob: 0.12 },
        'IEAC.AS':  { ter: 0.20, tob: 0.12 }, 'IEAC.DE':  { ter: 0.20, tob: 0.12 }, 'IEAC.L': { ter: 0.20, tob: 0.12 },
        'IBCI.AS':  { ter: 0.09, tob: 0.12 }, 'IBCI.DE':  { ter: 0.09, tob: 0.12 },
        'IHYG.DE':  { ter: 0.50, tob: 0.12 }, 'IHYG.L':   { ter: 0.50, tob: 0.12 }, 'IHYG.MI': { ter: 0.50, tob: 0.12 },
        'IBTS.AS':  { ter: 0.20, tob: 0.12 }, 'IBTS.DE':  { ter: 0.20, tob: 0.12 }, 'IBTS.MI': { ter: 0.20, tob: 0.12 },
        'IBGL.AS':  { ter: 0.20, tob: 0.12 },
        // iShares USD Treasury
        'SHY':      { ter: 0.15, tob: 0.35 }, 'IEF':      { ter: 0.15, tob: 0.35 }, 'TLT': { ter: 0.15, tob: 0.35 },
        'TIP':      { ter: 0.19, tob: 0.35 },
        'ITPE.DE':  { ter: 0.12, tob: 0.12 }, 'IBC5.DE':  { ter: 0.12, tob: 0.12 },
        'IDTL.L':   { ter: 0.20, tob: 0.12 }, 'IBTL.DE':  { ter: 0.20, tob: 0.12 },
        'IBTM.L':   { ter: 0.20, tob: 0.12 }, 'IBTD.L':   { ter: 0.20, tob: 0.12 },
        'IBTA.L':   { ter: 0.07, tob: 0.12 }, 'IBTS.L':   { ter: 0.20, tob: 0.12 },
        'IBTE.DE':  { ter: 0.25, tob: 0.12 },
        'STIP.AS':  { ter: 0.10, tob: 0.12 }, 'ITPG.L':   { ter: 0.10, tob: 0.12 }, 'ITPS.L': { ter: 0.10, tob: 0.12 },
        // iShares EUR Govt maturity
        'IBGS.AS':  { ter: 0.20, tob: 0.12 }, 'IBGS.L':   { ter: 0.20, tob: 0.12 },
        'IBGE.DE':  { ter: 0.20, tob: 0.12 }, 'IBGE.MI':  { ter: 0.20, tob: 0.12 },
        'IBGK.AS':  { ter: 0.20, tob: 0.12 }, 'IBGK.DE':  { ter: 0.20, tob: 0.12 },
        'IBGN.AS':  { ter: 0.20, tob: 0.12 }, 'IBGM.AS':  { ter: 0.20, tob: 0.12 },
        'IBGP.AS':  { ter: 0.20, tob: 0.12 }, 'IBGX.AS':  { ter: 0.20, tob: 0.12 },
        'IBGO.AS':  { ter: 0.20, tob: 0.12 },
        'IDTG.DE':  { ter: 0.35, tob: 0.12 }, 'IGBE.DE':  { ter: 0.09, tob: 0.12 },
        'IBGZ.DE':  { ter: 0.09, tob: 0.12 },
        // iShares EUR Corp ESG
        'QDVL.DE':  { ter: 0.12, tob: 0.12 }, 'QDVL.MI':  { ter: 0.12, tob: 0.12 },
        'IE3E.DE':  { ter: 0.12, tob: 0.12 }, 'PAAC.DE':  { ter: 0.15, tob: 0.12 },
        'SUAE.DE':  { ter: 0.20, tob: 0.12 },
        'SRHE.DE':  { ter: 0.25, tob: 0.12 }, 'SRHE.AS':  { ter: 0.25, tob: 0.12 }, 'SRHE.L': { ter: 0.25, tob: 0.12 },
        'AYE2.DE':  { ter: 0.25, tob: 0.12 },
        // iShares USD HY & Corp
        'HYG':      { ter: 0.49, tob: 0.35 }, 'AGG':      { ter: 0.03, tob: 0.35 },
        'IHYU.DE':  { ter: 0.50, tob: 0.12 }, 'IHYU.MI':  { ter: 0.50, tob: 0.12 }, 'IHYU.L': { ter: 0.50, tob: 0.12 },
        'HYLD.DE':  { ter: 0.50, tob: 0.12 }, 'SDHY.L':   { ter: 0.45, tob: 0.12 },
        'SDIG.L':   { ter: 0.20, tob: 0.12 }, 'SDCB.L':   { ter: 0.20, tob: 0.12 },
        'LQDA.L':   { ter: 0.20, tob: 0.12 }, 'LQDE.L':   { ter: 0.20, tob: 0.12 },
        'SUDE.DE':  { ter: 0.25, tob: 0.12 }, 'LQDH.L':   { ter: 0.25, tob: 0.12 },
        'SHYG.L':   { ter: 0.50, tob: 0.12 }, 'IEGE.DE':  { ter: 0.25, tob: 0.12 },
        'FLOT.L':   { ter: 0.10, tob: 0.12 }, 'IUSU.L':   { ter: 0.09, tob: 0.12 },
        'SUDA.DE':  { ter: 0.15, tob: 0.12 },
        // iShares EM Bond
        'IEMB.DE':  { ter: 0.45, tob: 0.12 }, 'IEMB.MI':  { ter: 0.45, tob: 0.12 }, 'IEMB.L': { ter: 0.45, tob: 0.12 },
        'EMB':      { ter: 0.40, tob: 0.35 }, 'LEMB':     { ter: 0.30, tob: 0.35 },
        'EMHE.DE':  { ter: 0.50, tob: 0.12 }, 'EMHE.MI':  { ter: 0.50, tob: 0.12 }, 'EMHE.L': { ter: 0.50, tob: 0.12 },
        'SEML.MI':  { ter: 0.50, tob: 0.12 }, 'SEML.L':   { ter: 0.50, tob: 0.12 },
        'AEMB.L':   { ter: 0.45, tob: 0.12 },
        // iShares Global
        'IGLO.DE':  { ter: 0.20, tob: 0.12 }, 'IGLO.L':   { ter: 0.20, tob: 0.12 }, 'IGLG.L': { ter: 0.20, tob: 0.12 },
        'CORP.L':   { ter: 0.20, tob: 0.12 }, 'CORP.MI':  { ter: 0.20, tob: 0.12 },
        'CRPH.DE':  { ter: 0.25, tob: 0.12 }, 'IGLB.L':   { ter: 0.20, tob: 0.12 },
        'IGIL.DE':  { ter: 0.20, tob: 0.12 }, 'IUAG.L':   { ter: 0.25, tob: 0.12 },
        'IMBS.L':   { ter: 0.25, tob: 0.12 }, 'IGLT.L':   { ter: 0.07, tob: 0.12 },
        'GHYG.DE':  { ter: 0.50, tob: 0.12 }, 'GHYG.MI':  { ter: 0.50, tob: 0.12 },
        'GHYG.L':   { ter: 0.50, tob: 0.12 }, 'GHYG.SW':  { ter: 0.50, tob: 0.12 },
        'SUGA.DE':  { ter: 0.10, tob: 0.12 }, 'FALE.DE':  { ter: 0.50, tob: 0.12 },
        'SUEF.DE':  { ter: 0.20, tob: 0.12 }, 'IITB.MI':  { ter: 0.09, tob: 0.12 },
        'CNYB.AS':  { ter: 0.35, tob: 0.12 },
        'IB27.MI':  { ter: 0.12, tob: 0.12 }, 'IB28.MI':  { ter: 0.12, tob: 0.12 },
        'GROE.DE':  { ter: 0.20, tob: 0.12 }, 'EUNT.DE':  { ter: 0.09, tob: 0.12 },
        'ERNE.DE':  { ter: 0.09, tob: 0.12 }, 'ERNE.AS':  { ter: 0.09, tob: 0.12 },
        'SESG.DE':  { ter: 0.09, tob: 0.12 },
        // Vanguard
        'BND':      { ter: 0.03, tob: 0.35 }, 'BNDX':     { ter: 0.07, tob: 0.35 }, 'BSV': { ter: 0.04, tob: 0.35 },
        'VGOV.DE':  { ter: 0.10, tob: 0.12 }, 'VGGT.DE':  { ter: 0.10, tob: 0.12 },
        'VAGF.DE':  { ter: 0.10, tob: 0.12 }, 'VAGF.MI':  { ter: 0.10, tob: 0.12 },
        'VECP.AS':  { ter: 0.09, tob: 0.12 }, 'VECP.DE':  { ter: 0.09, tob: 0.12 },
        'VETY.DE':  { ter: 0.07, tob: 0.12 }, 'VETY.AS':  { ter: 0.07, tob: 0.12 }, 'VETY.MI': { ter: 0.07, tob: 0.12 },
        'VUCP.AS':  { ter: 0.09, tob: 0.12 },
        'VUTY.AS':  { ter: 0.07, tob: 0.12 }, 'VUTY.MI':  { ter: 0.07, tob: 0.12 },
        'VDEM.AS':  { ter: 0.25, tob: 0.12 }, 'VGOV.L':   { ter: 0.07, tob: 0.12 },
        'VDST.L':   { ter: 0.07, tob: 0.12 },
        // Amundi
        'C3M.MI':   { ter: 0.05, tob: 0.12 }, 'AM3A.PA':  { ter: 0.05, tob: 0.12 }, 'AM3A.DE': { ter: 0.05, tob: 0.12 },
        'AM3E.PA':  { ter: 0.05, tob: 0.12 }, 'AM3E.MI':  { ter: 0.05, tob: 0.12 },
        'AM3G.PA':  { ter: 0.05, tob: 0.12 }, 'AM3G.MI':  { ter: 0.05, tob: 0.12 },
        'AM3H.PA':  { ter: 0.05, tob: 0.12 },
        'SHC.MI':   { ter: 0.12, tob: 0.12 }, 'SHC.PA':   { ter: 0.12, tob: 0.12 }, 'SHC.DE': { ter: 0.12, tob: 0.12 },
        'ULTE.MI':  { ter: 0.12, tob: 0.12 }, 'ULTE.DE':  { ter: 0.12, tob: 0.12 },
        'CRPE.PA':  { ter: 0.14, tob: 0.12 },
        'EGBG.MI':  { ter: 0.14, tob: 0.12 }, 'EGBG.PA':  { ter: 0.14, tob: 0.12 },
        'AHYG.MI':  { ter: 0.45, tob: 0.12 },
        'INFL.MI':  { ter: 0.09, tob: 0.12 }, 'INFL.PA':  { ter: 0.09, tob: 0.12 },
        'SHT.MI':   { ter: 0.07, tob: 0.12 },
        'AMEU.L':   { ter: 0.07, tob: 0.12 }, 'AMEU.DE':  { ter: 0.15, tob: 0.12 }, 'AMEU.MI': { ter: 0.07, tob: 0.12 },
        'TIPU.L':   { ter: 0.09, tob: 0.12 }, 'HYLD2.L':  { ter: 0.45, tob: 0.12 }, 'HYLDE.MI': { ter: 0.45, tob: 0.12 },
        'GGRE.L':   { ter: 0.10, tob: 0.12 }, 'AGGH2.PA': { ter: 0.10, tob: 0.12 },
        'PRAM.DE':  { ter: 0.05, tob: 0.12 }, 'PRAD.DE':  { ter: 0.05, tob: 0.12 }, 'PRAA.DE': { ter: 0.05, tob: 0.12 },
        'FLTC.PA':  { ter: 0.10, tob: 0.12 },
        // Xtrackers
        'XBLR.DE':  { ter: 0.16, tob: 0.12 }, 'XBLR.MI':  { ter: 0.16, tob: 0.12 },
        'XHY1.DE':  { ter: 0.35, tob: 0.12 }, 'XHY1.SW':  { ter: 0.35, tob: 0.12 },
        'XHY3.DE':  { ter: 0.35, tob: 0.12 },
        'XGSH.DE':  { ter: 0.15, tob: 0.12 }, 'XGSG.DE':  { ter: 0.15, tob: 0.12 },
        'XGIG.MI':  { ter: 0.20, tob: 0.12 },
        'XGGB.L':   { ter: 0.20, tob: 0.12 }, 'XGGB.SW':  { ter: 0.20, tob: 0.12 },
        'XGGG.MI':  { ter: 0.25, tob: 0.12 }, 'XGGG.DE':  { ter: 0.25, tob: 0.12 },
        'XGAG.DE':  { ter: 0.20, tob: 0.12 }, 'XUTD.DE':  { ter: 0.15, tob: 0.12 },
        'XJSE.DE':  { ter: 0.15, tob: 0.12 }, 'XESR.DE':  { ter: 0.16, tob: 0.12 },
        'XZGE.DE':  { ter: 0.15, tob: 0.12 }, 'XHY7.MI':  { ter: 0.35, tob: 0.12 },
        // State Street SPDR
        'BIL':      { ter: 0.14, tob: 0.35 }, 'JNK':      { ter: 0.40, tob: 0.35 },
        'SPXB.DE':  { ter: 0.10, tob: 0.12 }, 'SPXB.SW':  { ter: 0.10, tob: 0.12 },
        'GLAG.DE':  { ter: 0.10, tob: 0.12 }, 'GLAE.DE':  { ter: 0.10, tob: 0.12 },
        'GLGE.MI':  { ter: 0.15, tob: 0.12 }, 'GLGE.DE':  { ter: 0.15, tob: 0.12 },
        'GLGG2.MI': { ter: 0.20, tob: 0.12 }, 'GLTL.L':   { ter: 0.15, tob: 0.12 },
        'GLSC.L':   { ter: 0.20, tob: 0.12 }, 'GLUK.L':   { ter: 0.15, tob: 0.12 },
        'SEMG.MI':  { ter: 0.55, tob: 0.12 }, 'EMDL.MI':  { ter: 0.55, tob: 0.12 },
        // UBS
        'TIPS.SW':  { ter: 0.20, tob: 0.12 }, 'ULCO.SW':  { ter: 0.18, tob: 0.12 },
        'SDBB.SW':  { ter: 0.20, tob: 0.12 }, 'EMSU.SW':  { ter: 0.47, tob: 0.12 },
        'SULCO.SW': { ter: 0.18, tob: 0.12 }, 'SEURC.SW': { ter: 0.18, tob: 0.12 },
        // VanEck
        'CORP2.AS': { ter: 0.10, tob: 0.12 }, 'TSOV.AS':  { ter: 0.10, tob: 0.12 }, 'TSOV2.AS': { ter: 0.10, tob: 0.12 },
        // BNPP
        'SRPE.MI':  { ter: 0.18, tob: 0.12 },
        // PIMCO
        'STHS.L':   { ter: 0.55, tob: 0.12 }, 'STYLD.L':  { ter: 0.75, tob: 0.12 }, 'STYLD.MI': { ter: 0.75, tob: 0.12 },
        'STHS2.MI': { ter: 0.55, tob: 0.12 },
        // JPMorgan
        'JGHY.L':   { ter: 0.40, tob: 0.12 }, 'BBIL.L':   { ter: 0.07, tob: 0.12 },
        'JPMF.MI':  { ter: 0.18, tob: 0.12 }, 'JPMF.DE':  { ter: 0.18, tob: 0.12 },
        // L&G, WisdomTree, Invesco
        'EMGB.MI':  { ter: 0.35, tob: 0.12 },
        'COCO.MI':  { ter: 0.35, tob: 0.12 },
        'AT1.DE':   { ter: 0.39, tob: 0.12 }, 'IBGE2.DE': { ter: 0.10, tob: 0.12 },
        // === BATCH 7 META ===
        'U13H.MI':  { ter: 0.15, tob: 0.12 }, 'AEHY.DE':  { ter: 0.25, tob: 0.12 },
        'GOVH.PA':  { ter: 0.10, tob: 0.12 }, 'ECR1.MI':  { ter: 0.09, tob: 0.12 },
        'ECRP3.PA': { ter: 0.12, tob: 0.12 }, 'ECRP.PA':  { ter: 0.14, tob: 0.12 },
        'MTE.PA':   { ter: 0.14, tob: 0.12 }, 'EM35.MI':  { ter: 0.14, tob: 0.12 },
        'EM710.MI': { ter: 0.14, tob: 0.12 }, 'CB3.MI':   { ter: 0.14, tob: 0.12 },
        'AFRN.PA':  { ter: 0.14, tob: 0.12 }, 'CLIM.L':   { ter: 0.10, tob: 0.12 },
        'PRAR.DE':  { ter: 0.05, tob: 0.12 }, 'PR1R.DE':  { ter: 0.05, tob: 0.12 },
        'PRAB.DE':  { ter: 0.05, tob: 0.12 }, '7USH.DE':  { ter: 0.15, tob: 0.12 },
        'US7.MI':   { ter: 0.15, tob: 0.12 }, 'U71H.L':   { ter: 0.15, tob: 0.12 },
        'USIX.L':   { ter: 0.20, tob: 0.12 }, 'USYH.MI':  { ter: 0.35, tob: 0.12 },
        'UHYG.L':   { ter: 0.35, tob: 0.12 }, 'SRIC.MI':  { ter: 0.25, tob: 0.12 },
        'CBUP.DE':  { ter: 0.20, tob: 0.12 }, '36BA.DE':  { ter: 0.15, tob: 0.12 },
        '5UOA.DE':  { ter: 0.12, tob: 0.12 }, 'DHYG.L':   { ter: 0.25, tob: 0.12 },
        'TI5A.AS':  { ter: 0.10, tob: 0.12 }, 'IRCP.L':   { ter: 0.25, tob: 0.12 },
        'EUNS.DE':  { ter: 0.09, tob: 0.12 }, 'CBUJ.DE':  { ter: 0.14, tob: 0.12 },
        'SECA.DE':  { ter: 0.09, tob: 0.12 }, 'CBE3.L':   { ter: 0.09, tob: 0.12 },
        'IS05.DE':  { ter: 0.09, tob: 0.12 }, 'IEGY.AS':  { ter: 0.09, tob: 0.12 },
        'GRON.DE':  { ter: 0.20, tob: 0.12 }, 'EHYA.AS':  { ter: 0.25, tob: 0.12 },
        'EHYG.L':   { ter: 0.25, tob: 0.12 }, 'EUED.DE':  { ter: 0.09, tob: 0.12 },
        'CBE7.AS':  { ter: 0.09, tob: 0.12 }, 'IBC7.DE':  { ter: 0.25, tob: 0.12 },
        'AEGE.DE':  { ter: 0.17, tob: 0.12 }, 'IBCQ.DE':  { ter: 0.25, tob: 0.12 },
        'EMSA.L':   { ter: 0.45, tob: 0.12 }, 'EMCR.L':   { ter: 0.50, tob: 0.12 },
        'EMBE.MI':  { ter: 0.45, tob: 0.12 }, 'IBB1.DE':  { ter: 0.10, tob: 0.12 },
        'UEEG.DE':  { ter: 0.15, tob: 0.12 }, 'DHYA.L':   { ter: 0.25, tob: 0.12 },
        'IBC2.DE':  { ter: 0.25, tob: 0.12 }, 'IHYA.L':   { ter: 0.50, tob: 0.12 },
        'SDIA.L':   { ter: 0.20, tob: 0.12 }, 'TIP5.L':   { ter: 0.10, tob: 0.12 },
        '2B7S.DE':  { ter: 0.07, tob: 0.12 }, 'ERNA.L':   { ter: 0.09, tob: 0.12 },
        'JEST.DE':  { ter: 0.18, tob: 0.12 }, 'BB3M.L':   { ter: 0.07, tob: 0.12 },
        'JHYU.L':   { ter: 0.40, tob: 0.12 }, 'EMD5.MI':  { ter: 0.25, tob: 0.12 },
        'STHE.MI':  { ter: 0.55, tob: 0.12 }, 'STHY.MI':  { ter: 0.55, tob: 0.12 },
        'TBIL.SW':  { ter: 0.10, tob: 0.12 }, 'LGOV.MI':  { ter: 0.15, tob: 0.12 },
        'SYB3.DE':  { ter: 0.15, tob: 0.12 }, 'UKCO.L':   { ter: 0.20, tob: 0.12 },
        'EMH5.MI':  { ter: 0.50, tob: 0.12 }, 'EMLD.MI':  { ter: 0.50, tob: 0.12 },
        'CBSEU.SW': { ter: 0.18, tob: 0.12 }, 'CBSUST.SW':{ ter: 0.18, tob: 0.12 },
        'TIP1S.SW': { ter: 0.25, tob: 0.12 }, 'CBUSS.SW': { ter: 0.18, tob: 0.12 },
        'SBEMS.SW': { ter: 0.23, tob: 0.12 }, 'MDBC.SW':  { ter: 0.18, tob: 0.12 },
        'TCBT.AS':  { ter: 0.10, tob: 0.12 }, 'TAT.AS':   { ter: 0.07, tob: 0.12 },
        'TGBT.AS':  { ter: 0.07, tob: 0.12 }, 'VGGF.DE':  { ter: 0.10, tob: 0.12 },
        'VEMT.AS':  { ter: 0.25, tob: 0.12 }, 'COBO.MI':  { ter: 0.39, tob: 0.12 },
        'XB4F.DE':  { ter: 0.15, tob: 0.12 }, 'XGBE.MI':  { ter: 0.15, tob: 0.12 },
        'XEZB.DE':  { ter: 0.09, tob: 0.12 }, 'XGSG.L':   { ter: 0.20, tob: 0.12 },
        'DBXP.DE':  { ter: 0.15, tob: 0.12 }, 'XG7G.SW':  { ter: 0.25, tob: 0.12 },
        'XBAE.DE':  { ter: 0.15, tob: 0.12 },
        'XHYG.SW':  { ter: 0.35, tob: 0.12 }, // Xtrackers II EUR HY Corp Bond CHF SWX
        'LDCE.DE':  { ter: 0.39, tob: 0.12 }, // PIMCO Advg Euro Low Duration Corp Bond XETR
        // === BATCH 8 META - Gemengde ETFs ===
        'YYY':      { ter: 0.00, tob: 0.35 }, 'PCEF':     { ter: 0.00, tob: 0.35 },
        'CVY':      { ter: 0.00, tob: 0.35 }, 'AOA':      { ter: 0.08, tob: 0.35 },
        'IYLD':     { ter: 0.00, tob: 0.35 }, 'GGRO.TO':  { ter: 0.20, tob: 0.12 },
        'ROE.DE':   { ter: 0.69, tob: 0.12 }, 'ROE_NEW.MI': { ter: 0.69, tob: 0.12 },
        'MACV.DE':  { ter: 0.29, tob: 0.12 }, 'MACV.MI':  { ter: 0.29, tob: 0.12 },
        'MODR.DE':  { ter: 0.27, tob: 0.12 }, 'MODR.MI':  { ter: 0.27, tob: 0.12 },
        'MAGR.DE':  { ter: 0.27, tob: 0.12 }, 'MAGR.MI':  { ter: 0.27, tob: 0.12 },
        'ZPRI.DE':  { ter: 0.40, tob: 0.12 }, 'MAGI.L':   { ter: 0.40, tob: 0.12 },
        'GIN.L':    { ter: 0.40, tob: 0.12 }, 'NTM.AS':   { ter: 0.30, tob: 0.12 },
        'DTM.AS':   { ter: 0.28, tob: 0.12 }, 'TOF.AS':   { ter: 0.32, tob: 0.12 },
        'VNGA20.MI':{ ter: 0.25, tob: 1.32 }, 'V20A.AS':  { ter: 0.25, tob: 1.32 },
        'V20A.DE':  { ter: 0.25, tob: 1.32 }, 'V20D.AS':  { ter: 0.25, tob: 0.12 },
        'V20D.DE':  { ter: 0.25, tob: 0.12 }, 'VNGD20.MI':{ ter: 0.25, tob: 0.12 },
        'VNGA40.MI':{ ter: 0.25, tob: 1.32 }, 'V40A.DE':  { ter: 0.25, tob: 1.32 },
        'V40D.AS':  { ter: 0.25, tob: 0.12 }, 'V40D.DE':  { ter: 0.25, tob: 0.12 },
        'VNGD40.MI':{ ter: 0.25, tob: 0.12 }, 'VNGA60.MI':{ ter: 0.25, tob: 1.32 },
        'V60A.AS':  { ter: 0.25, tob: 1.32 }, 'V60A.DE':  { ter: 0.25, tob: 1.32 },
        'V60D.AS':  { ter: 0.25, tob: 0.12 }, 'V60D.DE':  { ter: 0.25, tob: 0.12 },
        'VNGD60.MI':{ ter: 0.25, tob: 0.12 }, 'VNGA80.MI':{ ter: 0.25, tob: 1.32 },
        'V80A.AS':  { ter: 0.25, tob: 1.32 }, 'V80A.DE':  { ter: 0.25, tob: 1.32 },
        'V80D.AS':  { ter: 0.25, tob: 0.12 }, 'V80D.DE':  { ter: 0.25, tob: 0.12 },
        'VNGD80.MI':{ ter: 0.25, tob: 0.12 }, 'NTSG.DE':  { ter: 0.25, tob: 0.12 },
        'XS7W.DE':  { ter: 0.65, tob: 0.12 }, 'XS7W.MI':  { ter: 0.65, tob: 0.12 },
        'XQUI.DE':  { ter: 0.70, tob: 0.12 }, 'XQUI.MI':  { ter: 0.70, tob: 0.12 },

        // Correcte Yahoo Xetra obligatie tickers
        // Nieuwe obligatie tickers
        'EUN6.DE': { ter: 0.09, tob: 0.12 }, 'EUN7.DE': { ter: 0.20, tob: 0.12 },
        'EUN8.DE': { ter: 0.20, tob: 0.12 }, 'EUNH.AS': { ter: 0.09, tob: 0.12 },
        'IS04.DE': { ter: 0.20, tob: 0.12 }, 'IS0H.DE': { ter: 0.20, tob: 0.12 },
        'SXRQ.DE': { ter: 0.20, tob: 0.12 }, 'SXRG.DE': { ter: 0.35, tob: 0.12 },
        'IBGZ.MI': { ter: 0.20, tob: 0.12 }, 'IBGK.MI': { ter: 0.20, tob: 0.12 },
        'IBGE.MI': { ter: 0.20, tob: 0.12 }, 'VGEA.DE': { ter: 0.07, tob: 0.12 },
        'VGEA.MI': { ter: 0.07, tob: 0.12 }, 'DBZB.DE': { ter: 0.16, tob: 0.12 },
        'DBZB.MI': { ter: 0.16, tob: 0.12 }, 'DBXG.DE': { ter: 0.15, tob: 0.12 },
        'DBXR.DE': { ter: 0.15, tob: 0.12 }, 'DXET.DE': { ter: 0.35, tob: 0.12 },
        'DXEM.DE': { ter: 0.20, tob: 0.12 }, 'XHY3.MI': { ter: 0.35, tob: 0.12 },
        'XGSH.MI': { ter: 0.15, tob: 0.12 }, 'AM3E.MI': { ter: 0.05, tob: 0.12 },
        'AM3G.MI': { ter: 0.05, tob: 0.12 }, 'EGBG.MI': { ter: 0.14, tob: 0.12 },
        'AHYG.MI': { ter: 0.45, tob: 0.12 }, 'ULTE.MI': { ter: 0.12, tob: 0.12 },
        'SHT.MI':  { ter: 0.07, tob: 0.12 }, 'SPXB.MI': { ter: 0.10, tob: 0.12 },
        'GLAG.MI': { ter: 0.10, tob: 0.12 }, 'GLAE.MI': { ter: 0.10, tob: 0.12 },
        'SYBJ.DE': { ter: 0.20, tob: 0.12 }, 'CORP2.MI': { ter: 0.10, tob: 0.12 },
        'TSOV.MI': { ter: 0.10, tob: 0.12 }, 'VDEM.MI': { ter: 0.25, tob: 0.12 },
        'VUTY.DE': { ter: 0.07, tob: 0.12 }, 'VECP.MI': { ter: 0.09, tob: 0.12 },
        'ULCO.DE': { ter: 0.18, tob: 0.12 }, 'SDBB.DE': { ter: 0.20, tob: 0.12 },
        'IABT.SW': { ter: 0.20, tob: 0.12 }, 'IBTM.SW': { ter: 0.20, tob: 0.12 },
        'STHS.MI': { ter: 0.55, tob: 0.12 }, 'STYLD.DE': { ter: 0.75, tob: 0.12 },
        'JPMF.DE': { ter: 0.18, tob: 0.12 }, 'EMGB.DE': { ter: 0.35, tob: 0.12 },
        'USCP.DE': { ter: 0.10, tob: 0.12 }, 'GGRE.DE': { ter: 0.10, tob: 0.12 },
        'FLTC.MI': { ter: 0.10, tob: 0.12 }, 'CRPE.MI': { ter: 0.14, tob: 0.12 },
        'HYLDE.DE': { ter: 0.45, tob: 0.12 }, 'HYLD2.DE': { ter: 0.45, tob: 0.12 },
        'IBTE.L':  { ter: 0.25, tob: 0.12 }, 'SUHY.MI': { ter: 0.50, tob: 0.12 },
        'SDBU.MI': { ter: 0.25, tob: 0.12 }, 'CRHE.DE': { ter: 0.25, tob: 0.12 },
        'SUIA.MI': { ter: 0.20, tob: 0.12 }, 'SE15.MI': { ter: 0.12, tob: 0.12 },
        'EUGR.MI': { ter: 0.20, tob: 0.12 }, 'SE06.MI': { ter: 0.09, tob: 0.12 },
        'ERNS.MI': { ter: 0.14, tob: 0.12 }, 'EMLB.MI': { ter: 0.50, tob: 0.12 },
        'IBTF.DE': { ter: 0.07, tob: 0.12 }, 'SLQD.DE': { ter: 0.20, tob: 0.12 },
        'STIP.DE': { ter: 0.10, tob: 0.12 }, 'IBTA2.DE': { ter: 0.07, tob: 0.12 },
        'DTLA.MI': { ter: 0.20, tob: 0.12 }, 'IB28X.DE': { ter: 0.15, tob: 0.12 },
        'PAAC.MI': { ter: 0.15, tob: 0.12 }, 'SUAE.MI': { ter: 0.20, tob: 0.12 },
        'SUDE.MI': { ter: 0.25, tob: 0.12 }, 'IEGE.MI': { ter: 0.25, tob: 0.12 },
        'EMHE.DE': { ter: 0.50, tob: 0.12 }, 'AEMB.DE': { ter: 0.45, tob: 0.12 },
        'IGLB.DE': { ter: 0.20, tob: 0.12 }, 'IGIL.MI': { ter: 0.20, tob: 0.12 },
        'GHYG.DE': { ter: 0.50, tob: 0.12 }, 'SUGA.MI': { ter: 0.10, tob: 0.12 },
        'FALE.MI': { ter: 0.50, tob: 0.12 }, 'SUEF.MI': { ter: 0.20, tob: 0.12 },
        'GROE.MI': { ter: 0.20, tob: 0.12 }, 'ERNE.DE': { ter: 0.09, tob: 0.12 },
        'SESG.MI': { ter: 0.09, tob: 0.12 },
        'XHYG.MI': { ter: 0.35, tob: 0.12 }, 'XHYG.DE': { ter: 0.35, tob: 0.12 },
        'XGLE.MI': { ter: 0.15, tob: 0.12 }, 'XGLE.DE': { ter: 0.15, tob: 0.12 },
        'XGIN.MI': { ter: 0.25, tob: 0.12 }, 'SPFE.DE': { ter: 0.10, tob: 0.12 },
        'SPFE.MI': { ter: 0.10, tob: 0.12 }, 'SYBB.DE': { ter: 0.15, tob: 0.12 },
        'SYBB.MI': { ter: 0.15, tob: 0.12 }, 'AM3E.DE': { ter: 0.05, tob: 0.12 },
        'AM3G.DE': { ter: 0.05, tob: 0.12 }, 'AM3H.MI': { ter: 0.05, tob: 0.12 },
        'ULCO.MI': { ter: 0.18, tob: 0.12 }, 'SDBB.MI': { ter: 0.20, tob: 0.12 },
        'EMSU.MI': { ter: 0.47, tob: 0.12 }, 'IBGX.MI': { ter: 0.20, tob: 0.12 },
        'IBGM.MI': { ter: 0.20, tob: 0.12 }, 'IBGL.MI': { ter: 0.20, tob: 0.12 },
        'AEMB.MI': { ter: 0.45, tob: 0.12 }, 'GHYG.MI': { ter: 0.50, tob: 0.12 },
        'IGLB.MI': { ter: 0.20, tob: 0.12 }, 'CORP2.MI': { ter: 0.10, tob: 0.12 },
        'TSOV.MI': { ter: 0.10, tob: 0.12 }, 'TSOV2.MI': { ter: 0.10, tob: 0.12 },
        'SRPE.DE': { ter: 0.18, tob: 0.12 }, 'INFL.DE': { ter: 0.09, tob: 0.12 },
        'EUNA.DE': { ter: 0.1, tob: 0.12 },
        'EUN5.DE': { ter: 0.09, tob: 0.12 },
        'EUNW.DE': { ter: 0.5, tob: 0.12 },
        'IUS7.DE': { ter: 0.45, tob: 0.12 },
        'EUN3.DE': { ter: 0.2, tob: 0.12 },
        'EUNH.DE': { ter: 0.09, tob: 0.12 },
        'IUSM.DE': { ter: 0.2, tob: 0.12 },
        'EUN4.DE': { ter: 0.17, tob: 0.12 },
        'IS0R.DE': { ter: 0.5, tob: 0.12 },
        'HYLE.DE': { ter: 0.5, tob: 0.12 },
        'IEAC.MI': { ter: 0.09, tob: 0.12 },
        // Ontbrekende obligatie ETFs
        'AHYG2.DE': { ter: 0.25, tob: 0.12 }, 'CGBH.PA':  { ter: 0.10, tob: 0.12 },
        'AM3A.MI':  { ter: 0.05, tob: 0.12 }, 'USCP.L':   { ter: 0.10, tob: 0.12 },
        'BIL':      { ter: 0.14, tob: 0.35 }, 'JNK':      { ter: 0.40, tob: 0.35 },
        'SHY':      { ter: 0.15, tob: 0.35 }, 'IEF':      { ter: 0.15, tob: 0.35 },
        'TLT':      { ter: 0.15, tob: 0.35 }, 'AGG':      { ter: 0.03, tob: 0.35 },
        'HYG':      { ter: 0.49, tob: 0.35 }, 'TIP':      { ter: 0.19, tob: 0.35 },
        'EMB':      { ter: 0.40, tob: 0.35 }, 'LEMB':     { ter: 0.30, tob: 0.35 },
        'BSV':      { ter: 0.04, tob: 0.35 },
        'VETY.SW':  { ter: 0.07, tob: 0.12 }, 'VAGS.DE':  { ter: 0.10, tob: 0.12 },
        'XGCB.MI':  { ter: 0.15, tob: 0.12 }, 'XGIG3.SW': { ter: 0.25, tob: 0.12 },
        'XGIG2.L':  { ter: 0.25, tob: 0.12 }, 'SDBU.DE':  { ter: 0.25, tob: 0.12 },
        'SUHY.DE':  { ter: 0.50, tob: 0.12 }, 'ISAC.MI':  { ter: 0.09, tob: 0.12 },
        'ISAC.DE':  { ter: 0.09, tob: 0.12 }, 'CSBGU0.MI':{ ter: 0.09, tob: 0.12 },
        'AGGU.L':   { ter: 0.10, tob: 0.12 }, 'AGGG.L':   { ter: 0.10, tob: 0.12 },
        'AGGH.SW':  { ter: 0.10, tob: 0.12 }, 'CRHE.L':   { ter: 0.25, tob: 0.12 },
        'IS15.L':   { ter: 0.20, tob: 0.12 }, 'SUIA.DE':  { ter: 0.20, tob: 0.12 },
        'SE15.DE':  { ter: 0.12, tob: 0.12 }, 'SUA0.DE':  { ter: 0.14, tob: 0.12 },
        'IBGE.L':   { ter: 0.20, tob: 0.12 }, 'EUGR.DE':  { ter: 0.20, tob: 0.12 },
        'SE06.DE':  { ter: 0.09, tob: 0.12 }, 'ERNS.DE':  { ter: 0.14, tob: 0.12 },
        'IBCI.MI':  { ter: 0.09, tob: 0.12 }, 'IGLS.L':   { ter: 0.20, tob: 0.12 },
        'GHYS.L':   { ter: 0.50, tob: 0.12 }, 'SEMB.L':   { ter: 0.45, tob: 0.12 },
        'EMLB.DE':  { ter: 0.50, tob: 0.12 }, 'EMCB.L':   { ter: 0.50, tob: 0.12 },
        'IBTF.L':   { ter: 0.07, tob: 0.12 }, 'SLQD.L':   { ter: 0.20, tob: 0.12 },
        'STIP.L':   { ter: 0.10, tob: 0.12 }, 'IBTA2.L':  { ter: 0.07, tob: 0.12 },
        'IBTL.L':   { ter: 0.20, tob: 0.12 }, 'DTLA.DE':  { ter: 0.20, tob: 0.12 },
        'CBU7.AS':  { ter: 0.07, tob: 0.12 }, 'IB28X.MI': { ter: 0.15, tob: 0.12 },
        // Oud
        'XGSH.AS':  { ter: 0.15, tob: 0.12 },
        'EUNH.AS':  { ter: 0.09, tob: 0.12 },
        'IUSB.AS':  { ter: 0.25, tob: 0.12 },
        'SUZE.AS':  { ter: 0.09, tob: 0.12 },
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

      // Bij toonAlles=false: eerste 80 ophalen, sorteren op volume → top 10 teruggeven
      // Bij toonAlles=true: alles in batches van 40 concurrent ophalen
      const teOphalen = toonAlles === 'true' ? syms : syms.slice(0, 80);

      const exchangeMap = {
        'AMS': 'Euronext Amsterdam', 'EPA': 'Euronext Paris', 'PAR': 'Euronext Paris',
        'ETR': 'Xetra', 'XETR': 'Xetra', 'GER': 'Xetra',
        'MIL': 'Euronext Milan', 'BIT': 'Euronext Milan',
        'LSE': 'London SE', 'IOB': 'London SE',
        'SWX': 'SIX Swiss', 'VTX': 'SIX Swiss',
        'NMS': 'Nasdaq', 'NGM': 'Nasdaq', 'PCX': 'NYSE Arca', 'NYQ': 'NYSE',
      };

      async function fetchEtf(sym) {
        try {
          const [r1d, r1m, r3m, r1j, r5j] = await Promise.all([
            fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=3mo`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1wk&range=1y`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
            fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1mo&range=5y`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
          ]);
          const [d1d, d1m, d3m, d1j, d5j] = await Promise.all([r1d.json(), r1m.json(), r3m.json(), r1j.json(), r5j.json()]);
          const meta = d1d?.chart?.result?.[0]?.meta || {};
          const prijs = meta.regularMarketPrice || 0;
          if (!prijs) return null;
          const pct1D = (() => {
            const ref = meta.chartPreviousClose || meta.previousClose || prijs;
            return ref ? ((prijs - ref) / ref) * 100 : 0;
          })();
          const pctLang = (d) => {
            const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
            const valids = closes.filter(v => v != null);
            if (valids.length < 2) return null;
            return ((valids[valids.length-1] - valids[0]) / valids[0]) * 100;
          };
          const naamRaw = meta.longName || meta.shortName || sym;
          const naam = naamRaw.length > 40 ? naamRaw.slice(0, 39) + '…' : naamRaw;
          const metaLookup = ETF_META[sym] || {};
          const exchCode = (meta.exchangeName || meta.fullExchangeName || '').toUpperCase();
          return {
            symbol: sym, naam, naamVolledig: naamRaw, prijs,
            valuta: meta.currency || 'EUR',
            volume: meta.regularMarketVolume || 0,
            totalAssets: 0,
            ter: metaLookup.ter ?? null,
            tob: metaLookup.tob ?? 0.12,
            beurs: exchangeMap[exchCode] || meta.fullExchangeName || meta.exchangeName || '—',
            marktOpen: meta.marketState === 'REGULAR',
            marktState: meta.marketState || 'CLOSED',
            timezone: meta.exchangeTimezoneShortName || meta.exchangeTimezoneName || '',
            pct1D, pct1M: pctLang(d1m), pct3M: pctLang(d3m),
            pct1J: pctLang(d1j), pct5J: pctLang(d5j),
          };
        } catch { return null; }
      }

      try {
        // Alle tickers tegelijk parallel - geen sequentiële batches
        // Verwerk in batches van 40 concurrent om timeout te vermijden
        const CONCURRENT = 40;
        const allResults = [];
        for (let i = 0; i < teOphalen.length; i += CONCURRENT) {
          const batch = teOphalen.slice(i, i + CONCURRENT);
          const batchResults = await Promise.all(batch.map(sym => fetchEtf(sym)));
          allResults.push(...batchResults);
        }
        const filtered = allResults.filter(Boolean);
        const output = toonAlles === 'true'
          ? filtered
          : [...filtered].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 10);
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
