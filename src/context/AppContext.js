import React, { createContext, useContext, useState, useEffect } from 'react';
import { vertaal, detecteerBrowserTaal } from '../translations';

const AppContext = createContext();

// ── Portfolio helpers ──────────────────────────────────────────
const laadPortfolios = () => {
  try {
    const saved = localStorage.getItem('matico_portfolios');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  // Migreer bestaande data naar eerste portfolio
  const bestaandeBeleggingen = (() => { try { return JSON.parse(localStorage.getItem('matico_beleggingen') || '[]'); } catch { return []; } })();
  const bestaandeVerkochte = (() => { try { return JSON.parse(localStorage.getItem('matico_verkochte_beleggingen') || '[]'); } catch { return []; } })();
  // Gebruik voornaam van gebruiker als die beschikbaar is
  const voornaam = (() => { try { const g = JSON.parse(localStorage.getItem('matico_gebruiker') || '{}'); return g.voornaam || ''; } catch { return ''; } })();
  const portfolioNaam = voornaam ? `${voornaam}'s portfolio` : 'Mijn portfolio';
  const defaultPortfolio = { id: 'portfolio_1', naam: portfolioNaam, type: 'standaard', aangemaakt: new Date().toISOString() };
  localStorage.setItem(`matico_beleggingen_portfolio_1`, JSON.stringify(bestaandeBeleggingen));
  localStorage.setItem(`matico_verkochte_portfolio_1`, JSON.stringify(bestaandeVerkochte));
  localStorage.setItem('matico_portfolios', JSON.stringify([defaultPortfolio]));
  return [defaultPortfolio];
};

const laadActiefPortfolioId = (portfolios) => {
  const saved = localStorage.getItem('matico_actief_portfolio');
  if (saved && portfolios.find(p => p.id === saved)) return saved;
  return portfolios[0]?.id || 'portfolio_1';
};

// Auto-detecteer type op basis van naam en symbool
function detecteerType(b) {
  if (b.type && b.type !== 'aandeel') return b.type; // al correct (etf/crypto)
  const naam = (b.naam || '').toLowerCase();
  const sym = (b.symbol || '').toUpperCase();
  // Crypto: symbool eindigt op -EUR, -USD, -GBP
  if (sym.match(/-EUR$|-USD$|-GBP$|-USDT$/)) return 'crypto';
  // ETF: naam bevat bekende uitgevers of UCITS/ETF keyword
  const etfNamen = ['ishares','blackrock','vanguard','vang ftse','vang ','amundi','xtrackers','dws','invesco','spdr','wisdomtree','vaneck','lyxor','ubs etf','pimco','franklin','fidelity','hsbc etf','ucits','index etf',' etf ','etf acc','etf dist'];
  if (etfNamen.some(n => naam.includes(n))) return 'etf';
  // ETF: Europese beurssuffixen (niet .BR want dat zijn Belgische aandelen)
  const etfSuffixen = ['.DE','.PA','.MI','.SW'];
  if (etfSuffixen.some(s => sym.includes(s))) return 'etf';
  return b.type || 'aandeel';
}

// Herstel ontbrekende namen
const BEKENDE_NAMEN = {
  'PRX.AS': 'Prosus NV', 'SOFI': 'SoFi Technologies Inc',
  'SOL-EUR': 'Solana EUR', 'SOL-USD': 'Solana USD',
  'BTC-EUR': 'Bitcoin EUR', 'BTC-USD': 'Bitcoin USD',
  'ETH-EUR': 'Ethereum EUR', 'ETH-USD': 'Ethereum USD',
  'ADA-EUR': 'Cardano EUR', 'XRP-EUR': 'XRP EUR',
  'VWCE.DE': 'Vanguard FTSE All-World UCITS ETF',
  'VFEM.DE': 'Vanguard FTSE Emerging Markets UCITS ETF',
};
const BEKENDE_LOGOS = {
  'PRX.AS': 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/PRX.png',
  'PRX': 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/PRX.png',
};

function herstelBelegging(b) {
  return {
    ...b,
    type: detecteerType(b),
    naam: b.naam || BEKENDE_NAMEN[b.symbol] || b.symbol,
    logo: b.logo || BEKENDE_LOGOS[b.symbol] || '',
  };
}

export function AppProvider({ children }) {
  const [gebruiker, setGebruiker] = useState(() => {
    const saved = localStorage.getItem('matico_gebruiker');
    const parsed = saved ? JSON.parse(saved) : { voornaam: '', achternaam: '' };
    // Enkel bij het allereerste bezoek (nog geen opgeslagen taalvoorkeur)
    // gokken we op basis van de browser-/systeemtaal. Eenmaal opgeslagen
    // (handmatig of via deze gok) blijft die voorkeur vast staan, ook als
    // de gebruiker zijn browsertaal nadien wijzigt.
    if (!parsed.taal) parsed.taal = detecteerBrowserTaal();
    return parsed;
  });

  // Vertaalfunctie, gebonden aan de huidige taalvoorkeur van de gebruiker
  const t = (sleutel) => vertaal(gebruiker.taal || 'nl', sleutel);

  // ── Dark mode ──
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('matico_darkmode') === 'true');

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('matico_darkmode', darkMode);
  }, [darkMode]);

  // ── Multi-portfolio state ──
  const [portfolios, setPortfolios] = useState(() => laadPortfolios());
  const [actiefPortfolioId, setActiefPortfolioId] = useState(() => {
    const ps = laadPortfolios();
    return laadActiefPortfolioId(ps);
  });

  // Hernoem het eerste portfolio naar de voornaam van de gebruiker als het nog een generieke naam heeft
  useEffect(() => {
    if (!gebruiker.voornaam) return;
    const eerstePortfolio = portfolios.find(p => p.id === 'portfolio_1');
    if (eerstePortfolio && (eerstePortfolio.naam === 'Mijn portfolio' || eerstePortfolio.naam === 'Portfolio 1' || eerstePortfolio.naam === `Portfolio 1`)) {
      const nieuweNaam = `${gebruiker.voornaam}'s portfolio`;
      const bijgewerkt = portfolios.map(p => p.id === 'portfolio_1' ? { ...p, naam: nieuweNaam } : p);
      localStorage.setItem('matico_portfolios', JSON.stringify(bijgewerkt));
      setPortfolios(bijgewerkt);
    }
  }, [gebruiker.voornaam]);

  const [beleggingen, setBeleggingen] = useState(() => {
    const ps = laadPortfolios();
    const id = laadActiefPortfolioId(ps);
    try {
      const raw = JSON.parse(localStorage.getItem(`matico_beleggingen_${id}`) || '[]');
      return raw.map(b => herstelBelegging(b));
    } catch { return []; }
  });

  const [verkochteBeleggingen, setVerkochteBeleggingen] = useState(() => {
    const ps = laadPortfolios();
    const id = laadActiefPortfolioId(ps);
    try { return JSON.parse(localStorage.getItem(`matico_verkochte_${id}`) || '[]'); } catch { return []; }
  });

  const [koersen, setKoersen] = useState({});
  const [activeNav, setActiveNav] = useState('overzicht');
  const [wisselkoers, setWisselkoers] = useState({ usdEur: 0.865 });

  // ── Portfolio wisselen ──
  const wisselPortfolio = (id) => {
    if (id === actiefPortfolioId) return;
    localStorage.setItem('matico_actief_portfolio', id);
    setActiefPortfolioId(id);
    setKoersen({});
    try { setBeleggingen((JSON.parse(localStorage.getItem(`matico_beleggingen_${id}`) || '[]')).map(b => herstelBelegging(b))); } catch { setBeleggingen([]); }
    try { setVerkochteBeleggingen(JSON.parse(localStorage.getItem(`matico_verkochte_${id}`) || '[]')); } catch { setVerkochteBeleggingen([]); }
  };

  // ── Portfolio toevoegen ──
  const voegPortfolioToe = (naam, type) => {
    const id = `portfolio_${Date.now()}`;
    const nieuw = { id, naam, type, aangemaakt: new Date().toISOString() };
    const bijgewerkt = [...portfolios, nieuw];
    localStorage.setItem('matico_portfolios', JSON.stringify(bijgewerkt));
    localStorage.setItem(`matico_beleggingen_${id}`, JSON.stringify([]));
    localStorage.setItem(`matico_verkochte_${id}`, JSON.stringify([]));
    setPortfolios(bijgewerkt);
    wisselPortfolio(id);
    return nieuw;
  };

  // ── Portfolio verwijderen ──
  const verwijderPortfolio = (id) => {
    if (portfolios.length <= 1) return; // minimaal 1 portfolio
    const bijgewerkt = portfolios.filter(p => p.id !== id);
    localStorage.setItem('matico_portfolios', JSON.stringify(bijgewerkt));
    localStorage.removeItem(`matico_beleggingen_${id}`);
    localStorage.removeItem(`matico_verkochte_${id}`);
    setPortfolios(bijgewerkt);
    if (actiefPortfolioId === id) wisselPortfolio(bijgewerkt[0].id);
  };

  // ── Portfolio hernoemen ──
  const hernoemPortfolioFn = (id, nieuweNaam) => {
    const bijgewerkt = portfolios.map(p => p.id === id ? { ...p, naam: nieuweNaam } : p);
    localStorage.setItem('matico_portfolios', JSON.stringify(bijgewerkt));
    setPortfolios(bijgewerkt);
  };

  // ── Actief portfolio object ──
  const actiefPortfolio = portfolios.find(p => p.id === actiefPortfolioId) || portfolios[0];

  // ── Opslaan per portfolio ──
  useEffect(() => {
    localStorage.setItem('matico_gebruiker', JSON.stringify(gebruiker));
  }, [gebruiker]);

  useEffect(() => {
    localStorage.setItem(`matico_beleggingen_${actiefPortfolioId}`, JSON.stringify(beleggingen));
  }, [beleggingen, actiefPortfolioId]);

  useEffect(() => {
    localStorage.setItem(`matico_verkochte_${actiefPortfolioId}`, JSON.stringify(verkochteBeleggingen));
  }, [verkochteBeleggingen, actiefPortfolioId]);

  // ── Live wisselkoers ──
  useEffect(() => {
    const haalWisselkoers = async () => {
      try {
        const res = await fetch('/api/data?endpoint=forex');
        const data = await res.json();
        if (data.usdEur) setWisselkoers(data);
      } catch (e) {}
    };
    haalWisselkoers();
    const interval = setInterval(haalWisselkoers, 3600000);
    return () => clearInterval(interval);
  }, []);

  const fetchKoers = async (symbol) => {
    try {
      const res = await fetch(`/api/data?endpoint=quote&symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (data.c) { setKoersen(prev => ({ ...prev, [symbol]: data })); return data; }
    } catch (e) {}
    return null;
  };

  const refreshAlleKoersen = async () => {
    const symbolen = [...new Set(beleggingen.map(b => b.symbol))];
    for (const s of symbolen) await fetchKoers(s);
  };

  useEffect(() => {
    if (beleggingen.length > 0) refreshAlleKoersen();
  }, [beleggingen.length, actiefPortfolioId]);

  useEffect(() => {
    if (beleggingen.length === 0) return;
    refreshAlleKoersen();
    const interval = setInterval(() => refreshAlleKoersen(), 60000);
    return () => clearInterval(interval);
  }, [actiefPortfolioId]);

  const getMuntFactor = (munt) => {
    if (munt === 'USD') return wisselkoers.usdEur;
    if (munt === 'GBP') return wisselkoers.usdEur * 1.27;
    return 1;
  };

  const portfolioWaarde = beleggingen.reduce((sum, b) => {
    const koers = koersen[b.symbol];
    const prijs = koers ? koers.c : b.kostprijs;
    const factor = getMuntFactor(b.munt || 'EUR');
    return sum + (prijs * b.aantal * factor);
  }, 0);

  const portfolioKostprijs = beleggingen.reduce((sum, b) => {
    const factor = getMuntFactor(b.munt || 'EUR');
    return sum + ((b.kostprijs * b.aantal + (b.transactiekosten || 0)) * factor);
  }, 0);

  const portfolioWinstVerlies = portfolioWaarde - portfolioKostprijs;
  const portfolioWinstPct = portfolioKostprijs > 0 ? (portfolioWinstVerlies / portfolioKostprijs) * 100 : 0;

  const portfolioWinstPctInclVerkocht = (() => {
    const gerealiseerdeWinst = (verkochteBeleggingen || []).reduce((sum, b) => {
      const factor = getMuntFactor(b.munt || 'EUR');
      return sum + (((b.verkoopkoers - b.kostprijs) * (b.aantalVerkocht || b.aantal || 1) - (b.transactiekosten || 0)) * factor);
    }, 0);
    const totaalWinst = portfolioWinstVerlies + gerealiseerdeWinst;
    return portfolioKostprijs > 0 ? (totaalWinst / portfolioKostprijs) * 100 : 0;
  })();

  const dagWinst = beleggingen.reduce((sum, b) => {
    const koers = koersen[b.symbol];
    if (!koers) return sum;
    const factor = getMuntFactor(b.munt || 'EUR');
    return sum + ((koers.c - koers.pc) * b.aantal * factor);
  }, 0);

  const dagWinstPct = portfolioWaarde > 0 ? (dagWinst / (portfolioWaarde - dagWinst)) * 100 : 0;

  const [ytdKoersen, setYtdKoersen] = React.useState({});
  const [historischeKoersen, setHistorischeKoersen] = React.useState({});
  const [periodeKoersen, setPeriodeKoersen] = React.useState({});

  const haalHistorischeKoers = React.useCallback(async (symbol, datum) => {}, []);

  const haalPeriodeKoers = React.useCallback(async (symbol, periodeKey, vanTimestamp) => {
    const cacheKey = `matico_periode_${periodeKey}_${symbol}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { koers, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          setPeriodeKoersen(prev => ({ ...prev, [periodeKey]: { ...(prev[periodeKey] || {}), [symbol]: koers } }));
          return;
        }
      }
    } catch (e) {}
    try {
      const res = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(symbol)}&van=${vanTimestamp}&tot=${vanTimestamp + 86400 * 5}&resolutie=D`);
      const data = await res.json();
      if (data?.s === 'ok' && data?.c?.length > 0) {
        const koers = data.c[0];
        localStorage.setItem(cacheKey, JSON.stringify({ koers, timestamp: Date.now() }));
        setPeriodeKoersen(prev => ({ ...prev, [periodeKey]: { ...(prev[periodeKey] || {}), [symbol]: koers } }));
      }
    } catch (e) {}
  }, []);

  React.useEffect(() => {
    setYtdKoersen({});
    setPeriodeKoersen({});
  }, [actiefPortfolioId]);

  React.useEffect(() => {
    const nuJaar = new Date().getFullYear();
    const van = Math.floor(new Date(`${nuJaar}-01-02`).getTime() / 1000);
    const alleSymbolen = [...beleggingen, ...(verkochteBeleggingen || [])]
      .filter(b => b.datum && new Date(b.datum) < new Date(`${nuJaar}-01-01`));
    alleSymbolen.forEach(async (b) => {
      if (ytdKoersen[b.symbol]) return;
      const cacheKey = `matico_ytd_${b.symbol}_${nuJaar}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) { setYtdKoersen(prev => ({ ...prev, [b.symbol]: parseFloat(cached) })); return; }
      } catch (e) {}
      try {
        const res = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(b.symbol)}&van=${van}&tot=${van + 86400 * 4}&resolutie=D`);
        const data = await res.json();
        if (data?.s === 'ok' && data?.c?.length > 0) {
          localStorage.setItem(cacheKey, String(data.c[0]));
          setYtdKoersen(prev => ({ ...prev, [b.symbol]: data.c[0] }));
        }
      } catch (e) {}
    });
  }, [beleggingen.map(b => b.symbol).join(','), (verkochteBeleggingen || []).map(b => b.symbol).join(','), actiefPortfolioId]);

  React.useEffect(() => {
    const nu = new Date();
    const periodes = {
      '1W': Math.floor(new Date(nu - 7 * 86400000).getTime() / 1000),
      '1M': Math.floor(new Date(nu - 30 * 86400000).getTime() / 1000),
      '1J': Math.floor(new Date(nu - 365 * 86400000).getTime() / 1000),
    };
    const alleBel = [...beleggingen, ...(verkochteBeleggingen || [])];
    alleBel.forEach(b => {
      Object.entries(periodes).forEach(([key, van]) => {
        const aankoopDatum = b.datum ? new Date(b.datum) : null;
        if (aankoopDatum && aankoopDatum.getTime() / 1000 < van) {
          if (!periodeKoersen[key]?.[b.symbol]) haalPeriodeKoers(b.symbol, key, van);
        }
      });
    });
  }, [beleggingen.map(b => b.symbol).join(','), (verkochteBeleggingen || []).map(b => b.symbol).join(','), actiefPortfolioId]);

  const berekenTWR = (inclVerkocht) => {
    const nuJaar = new Date().getFullYear();
    const eersteJan = new Date(`${nuJaar}-01-01`);
    let teller = 0, noemer = 0;

    beleggingen.forEach(b => {
      const k = koersen[b.symbol];
      const prijsNu = k ? k.c : b.kostprijs;
      const factor = getMuntFactor(b.munt || 'EUR');
      const aankoopDatum = b.datum ? new Date(b.datum) : null;
      if (aankoopDatum && aankoopDatum <= eersteJan) {
        const prijsStart = ytdKoersen[b.symbol];
        if (!prijsStart || prijsStart <= 0) return;
        teller += (prijsNu - prijsStart) * b.aantal * factor;
        noemer += prijsStart * b.aantal * factor;
      } else {
        teller += (prijsNu - b.kostprijs) * b.aantal * factor;
      }
    });

    if (inclVerkocht) {
      (verkochteBeleggingen || []).forEach(b => {
        const vd = b.verkoopdatum ? new Date(b.verkoopdatum) : null;
        if (!vd || vd.getFullYear() !== nuJaar) return;
        const factor = getMuntFactor(b.munt || 'EUR');
        const aankoopDatum = b.datum ? new Date(b.datum) : null;
        const prijsVerkoop = b.verkoopkoers || b.kostprijs;
        const aantal = b.aantalVerkocht || b.aantal || 1;
        if (aankoopDatum && aankoopDatum <= eersteJan) {
          const prijsStart = ytdKoersen[b.symbol];
          if (!prijsStart || prijsStart <= 0) return;
          teller += (prijsVerkoop - prijsStart) * aantal * factor;
          noemer += prijsStart * aantal * factor;
        } else {
          teller += (prijsVerkoop - b.kostprijs) * aantal * factor;
        }
      });
    }

    if (noemer === 0) return 0;
    return (teller / noemer) * 100;
  };

  const ytdPct = berekenTWR(false);
  const ytdPctInclVerkocht = berekenTWR(true);

  return (
    <AppContext.Provider value={{
      gebruiker, setGebruiker, t,
      darkMode, setDarkMode,
      portfolios, actiefPortfolio, actiefPortfolioId,
      wisselPortfolio, voegPortfolioToe, verwijderPortfolio,
      hernoemPortfolio: hernoemPortfolioFn,
      beleggingen, setBeleggingen,
      verkochteBeleggingen, setVerkochteBeleggingen,
      koersen, fetchKoers, refreshAlleKoersen,
      activeNav, setActiveNav,
      wisselkoers, getMuntFactor,
      portfolioWaarde, portfolioKostprijs,
      portfolioWinstVerlies, portfolioWinstPct, portfolioWinstPctInclVerkocht,
      portfolioWinstVerliesInclVerkocht: (() => {
        const verkoopWinst = (verkochteBeleggingen || []).reduce((sum, b) => {
          const factor = getMuntFactor(b.munt || 'EUR');
          return sum + (((b.verkoopkoers - b.kostprijs) * (b.aantalVerkocht || b.aantal || 1) - (b.transactiekosten || 0)) * factor);
        }, 0);
        return portfolioWinstVerlies + verkoopWinst;
      })(),
      dagWinst, dagWinstPct, ytdPct, ytdPctInclVerkocht, periodeKoersen, ytdKoersen
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
