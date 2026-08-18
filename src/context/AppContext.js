import React, { createContext, useContext, useState, useEffect } from 'react';
import { vertaal, detecteerBrowserTaal } from '../translations';
import { supabase } from '../supabaseClient';

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

export function AppProvider({ children, supabaseGebruiker }) {
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

  // Het echte e-mailadres (en, als fallback, naam) komt van de Supabase-
  // sessie in App.js — die twee 'gebruiker'-objecten liepen voorheen
  // volledig los van elkaar, waardoor dit e-mailveld hier altijd leeg bleef.
  useEffect(() => {
    if (!supabaseGebruiker) return;
    setGebruiker(g => {
      if (g.email === supabaseGebruiker.email) return g; // niets veranderd
      return { ...g, email: supabaseGebruiker.email || g.email };
    });
  }, [supabaseGebruiker?.email]);

  // ── Dark mode ──
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('matico_darkmode') === 'true');

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('matico_darkmode', darkMode);
  }, [darkMode]);

  // ── Favorieten ──
  const [favorieten, setFavorieten] = useState(() => {
    try { return JSON.parse(localStorage.getItem('matico_favorieten') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('matico_favorieten', JSON.stringify(favorieten));
  }, [favorieten]);

  // meta = { symbol, naam, type, beurs } — voegt toe als nog niet aanwezig, verwijdert anders
  const toggleFavoriet = (meta) => {
    setFavorieten(prev => {
      const bestaat = prev.some(f => f.symbol === meta.symbol);
      if (bestaat) return prev.filter(f => f.symbol !== meta.symbol);
      return [...prev, meta];
    });
  };

  const isFavoriet = (symbol) => favorieten.some(f => f.symbol === symbol);

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

  // ── Supabase-synchronisatie: portefeuille aan het account hangen, niet
  // aan het toestel ──────────────────────────────────────────────────────
  // Zolang dit false is, wordt er nog niets naar Supabase geschreven (om te
  // voorkomen dat we bij het opstarten leeg/verouderd lokaal data over de
  // écht actuele Supabase-data heen zouden schrijven).
  const [supabaseGereed, setSupabaseGereed] = useState(false);

  const laadOfMigreerHoldings = async (userId, portfolioId, lokaleBeleggingen, lokaleVerkochte) => {
    const { data, error } = await supabase
      .from('holdings')
      .select('beleggingen, verkochte_beleggingen')
      .eq('user_id', userId)
      .eq('portfolio_id', portfolioId)
      .maybeSingle();

    if (error) { console.error('Holdings ophalen mislukt:', error); return; }

    if (data) {
      // Supabase heeft al data voor dit portfolio — dat is de waarheid.
      const nieuweBeleggingen = (data.beleggingen || []).map(b => herstelBelegging(b));
      const nieuweVerkochte = data.verkochte_beleggingen || [];
      setBeleggingen(nieuweBeleggingen);
      setVerkochteBeleggingen(nieuweVerkochte);
      localStorage.setItem(`matico_beleggingen_${portfolioId}`, JSON.stringify(nieuweBeleggingen));
      localStorage.setItem(`matico_verkochte_${portfolioId}`, JSON.stringify(nieuweVerkochte));
    } else {
      // Nog geen holdings-rij in Supabase voor dit portfolio (nieuw account,
      // of een bestaand account dat nog moet migreren) — de huidige lokale
      // data (uit localStorage) eenmalig omhoog sturen als beginpunt.
      const { error: upsertFout } = await supabase.from('holdings').upsert({
        user_id: userId, portfolio_id: portfolioId,
        beleggingen: lokaleBeleggingen, verkochte_beleggingen: lokaleVerkochte,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,portfolio_id' });
      if (upsertFout) console.error('Migratie van beleggingen naar Supabase mislukt:', upsertFout);
    }
  };

  useEffect(() => {
    const userId = supabaseGebruiker?.id;
    if (!userId) return;

    const initialiseer = async () => {
      const { data: remotePortfolios, error: pFout } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', userId);

      if (pFout) { console.error('Portfolios ophalen mislukt:', pFout); return; }

      let actueleId = actiefPortfolioId;

      if (remotePortfolios && remotePortfolios.length > 0) {
        const gesynchroniseerd = remotePortfolios
          .map(p => ({ id: p.portfolio_id, naam: p.naam, type: p.type, aangemaakt: p.aangemaakt }))
          .sort((a, b) => new Date(a.aangemaakt) - new Date(b.aangemaakt));
        localStorage.setItem('matico_portfolios', JSON.stringify(gesynchroniseerd));
        setPortfolios(gesynchroniseerd);
        actueleId = gesynchroniseerd.find(p => p.id === actiefPortfolioId) ? actiefPortfolioId : gesynchroniseerd[0]?.id;
        if (actueleId && actueleId !== actiefPortfolioId) setActiefPortfolioId(actueleId);
      } else {
        // Nieuw account op Supabase, of een bestaand account dat nog moet
        // migreren — stuur de huidige lokale portfolio's omhoog.
        const rijen = portfolios.map(p => ({
          user_id: userId, portfolio_id: p.id, naam: p.naam, type: p.type, aangemaakt: p.aangemaakt,
        }));
        if (rijen.length > 0) {
          const { error: upsertFout } = await supabase.from('portfolios').upsert(rijen, { onConflict: 'user_id,portfolio_id' });
          if (upsertFout) console.error('Migratie van portfolio-lijst naar Supabase mislukt:', upsertFout);
        }
      }

      if (actueleId) await laadOfMigreerHoldings(userId, actueleId, beleggingen, verkochteBeleggingen);
      setSupabaseGereed(true);
    };

    initialiseer();
  }, [supabaseGebruiker?.id]);

  // ── Portfolio wisselen ──
  const wisselPortfolio = async (id) => {
    if (id === actiefPortfolioId) return;
    localStorage.setItem('matico_actief_portfolio', id);
    setActiefPortfolioId(id);
    setKoersen({});
    // Eerst de lokale cache tonen (snel, geen laadspinner nodig)...
    try { setBeleggingen((JSON.parse(localStorage.getItem(`matico_beleggingen_${id}`) || '[]')).map(b => herstelBelegging(b))); } catch { setBeleggingen([]); }
    try { setVerkochteBeleggingen(JSON.parse(localStorage.getItem(`matico_verkochte_${id}`) || '[]')); } catch { setVerkochteBeleggingen([]); }
    // ...en dan de actuele data van Supabase ophalen — belangrijk op een
    // nieuw toestel, waar de lokale cache voor dit portfolio nog leeg is.
    const userId = supabaseGebruiker?.id;
    if (userId) {
      const { data, error } = await supabase
        .from('holdings')
        .select('beleggingen, verkochte_beleggingen')
        .eq('user_id', userId)
        .eq('portfolio_id', id)
        .maybeSingle();
      if (!error && data) {
        const nieuweBeleggingen = (data.beleggingen || []).map(b => herstelBelegging(b));
        setBeleggingen(nieuweBeleggingen);
        setVerkochteBeleggingen(data.verkochte_beleggingen || []);
        localStorage.setItem(`matico_beleggingen_${id}`, JSON.stringify(nieuweBeleggingen));
        localStorage.setItem(`matico_verkochte_${id}`, JSON.stringify(data.verkochte_beleggingen || []));
      }
    }
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
    const userId = supabaseGebruiker?.id;
    if (userId) {
      supabase.from('portfolios').upsert({ user_id: userId, portfolio_id: id, naam, type, aangemaakt: nieuw.aangemaakt }, { onConflict: 'user_id,portfolio_id' })
        .then(({ error }) => { if (error) console.error('Nieuw portfolio synchroniseren mislukt:', error); });
      supabase.from('holdings').upsert({ user_id: userId, portfolio_id: id, beleggingen: [], verkochte_beleggingen: [], updated_at: new Date().toISOString() }, { onConflict: 'user_id,portfolio_id' })
        .then(({ error }) => { if (error) console.error('Nieuw portfolio (holdings) synchroniseren mislukt:', error); });
    }
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
    const userId = supabaseGebruiker?.id;
    if (userId) {
      supabase.from('portfolios').delete().eq('user_id', userId).eq('portfolio_id', id)
        .then(({ error }) => { if (error) console.error('Portfolio verwijderen (Supabase) mislukt:', error); });
      supabase.from('holdings').delete().eq('user_id', userId).eq('portfolio_id', id)
        .then(({ error }) => { if (error) console.error('Holdings verwijderen (Supabase) mislukt:', error); });
    }
  };

  // ── Portfolio hernoemen ──
  const hernoemPortfolioFn = (id, nieuweNaam) => {
    const bijgewerkt = portfolios.map(p => p.id === id ? { ...p, naam: nieuweNaam } : p);
    localStorage.setItem('matico_portfolios', JSON.stringify(bijgewerkt));
    setPortfolios(bijgewerkt);
    const userId = supabaseGebruiker?.id;
    if (userId) {
      supabase.from('portfolios').update({ naam: nieuweNaam }).eq('user_id', userId).eq('portfolio_id', id)
        .then(({ error }) => { if (error) console.error('Portfolio hernoemen (Supabase) mislukt:', error); });
    }
  };

  // ── Actief portfolio object ──
  const actiefPortfolio = portfolios.find(p => p.id === actiefPortfolioId) || portfolios[0];

  // ── Opslaan per portfolio ──
  useEffect(() => {
    localStorage.setItem('matico_gebruiker', JSON.stringify(gebruiker));
  }, [gebruiker]);

  useEffect(() => {
    localStorage.setItem(`matico_beleggingen_${actiefPortfolioId}`, JSON.stringify(beleggingen));
    const userId = supabaseGebruiker?.id;
    if (supabaseGereed && userId) {
      supabase.from('holdings').upsert({
        user_id: userId, portfolio_id: actiefPortfolioId, beleggingen, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,portfolio_id' }).then(({ error }) => { if (error) console.error('Beleggingen synchroniseren mislukt:', error); });
    }
  }, [beleggingen, actiefPortfolioId]);

  useEffect(() => {
    localStorage.setItem(`matico_verkochte_${actiefPortfolioId}`, JSON.stringify(verkochteBeleggingen));
    const userId = supabaseGebruiker?.id;
    if (supabaseGereed && userId) {
      supabase.from('holdings').upsert({
        user_id: userId, portfolio_id: actiefPortfolioId, verkochte_beleggingen: verkochteBeleggingen, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,portfolio_id' }).then(({ error }) => { if (error) console.error('Verkochte beleggingen synchroniseren mislukt:', error); });
    }
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
    if (symbolen.length === 0) return;
    try {
      // Vroeger: één aanvraag per symbool (fetchKoers-lus) — dat werd al
      // gauw honderdduizenden Edge Requests per maand bij een portefeuille
      // met meerdere posities, ververst elke minuut. Nu: alle koersen van
      // de portefeuille in één keer via het batch-endpoint 'quotes'.
      const res = await fetch(`/api/data?endpoint=quotes&symbols=${encodeURIComponent(symbolen.join(','))}`);
      const data = await res.json();
      setKoersen(prev => {
        const bijgewerkt = { ...prev };
        symbolen.forEach(s => { if (data[s]?.c) bijgewerkt[s] = data[s]; });
        return bijgewerkt;
      });
    } catch (e) {}
  };

  useEffect(() => {
    if (beleggingen.length > 0) refreshAlleKoersen();
  }, [beleggingen.length, actiefPortfolioId]);

  useEffect(() => {
    if (beleggingen.length === 0) return;
    refreshAlleKoersen();
    // Om de 3 minuten i.p.v. elke minuut — koersen van een persoonlijke
    // portefeuille hoeven niet sneller te verversen dan dat, en dit
    // scheelt op zich al 3x minder aanvragen. Bovendien: enkel verversen
    // terwijl het tabblad ook echt zichtbaar is (geen zin om te blijven
    // pollen als iemand een ander tabblad/venster open heeft staan).
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refreshAlleKoersen();
    }, 3 * 60_000);
    const onZichtbaar = () => { if (document.visibilityState === 'visible') refreshAlleKoersen(); };
    document.addEventListener('visibilitychange', onZichtbaar);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onZichtbaar);
    };
  }, [actiefPortfolioId]);

  // ── Meldingen: nieuwe kwartaal-/jaarcijfers van portefeuille-aandelen ──
  // Een jaarrekening is in de praktijk gewoon het Q4-rapport, dus die wordt
  // hiermee automatisch mee gedekt. We checken via Yahoo's "mostRecentQuarter"
  // (endpoint cijfers-datum) en vergelijken dat met wat we de vorige keer al
  // zagen, per symbool opgeslagen in localStorage.
  const NIEUWE_CIJFERS_CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 12 uur

  const [meldingen, setMeldingen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('matico_meldingen') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('matico_meldingen', JSON.stringify(meldingen));
  }, [meldingen]);

  const markeerMeldingGelezen = (id) => {
    setMeldingen(prev => prev.map(m => m.id === id ? { ...m, gelezen: true } : m));
  };
  const markeerAlleMeldingenGelezen = () => {
    setMeldingen(prev => prev.map(m => ({ ...m, gelezen: true })));
  };
  const ongelezenMeldingen = meldingen.filter(m => !m.gelezen).length;

  // Hoeveel dagen op voorhand je een vooraankondiging krijgt ("dit bedrijf
  // publiceert binnenkort cijfers").
  const VOORAANKONDIGING_DAGEN = 7;

  const checkNieuweCijfers = async () => {
    // Enkel echte aandelen — ETF's zijn fondsen (geen kwartaalcijfers/
    // jaarrekening in de zin die hier bedoeld wordt) en crypto handelt
    // sowieso 24/7 zonder rapportageverplichting.
    const alleenAandelen = beleggingen.filter(b => b.type === 'aandeel');
    const symbolen = [...new Set(alleenAandelen.map(b => b.symbol))];
    if (symbolen.length === 0) return;
    try {
      const res = await fetch(`/api/data?endpoint=cijfers-datum&symbols=${encodeURIComponent(symbolen.join(','))}`);
      const data = await res.json();
      const nieuwe = [];
      const nu = Date.now();
      const vooraankondigingGrens = VOORAANKONDIGING_DAGEN * 24 * 60 * 60 * 1000;

      symbolen.forEach(symbol => {
        const info = data[symbol];
        if (!info) return;
        const belegging = alleenAandelen.find(b => b.symbol === symbol);
        const naam = belegging?.naam || symbol;

        // ── 1. Cijfers zijn net gepubliceerd (achteraf) ──
        const nieuweDatum = info.laatsteRapport;
        if (nieuweDatum) {
          const key = `matico_laatste_cijfers_${symbol}`;
          const vorigeDatum = localStorage.getItem(key);
          // Enkel een melding maken als we dit aandeel al eerder checkten
          // (dus een echt nieuw rapport t.o.v. wat we kenden) — bij de
          // allereerste check voor een symbool leggen we stilzwijgend de
          // basis vast.
          if (vorigeDatum && Number(vorigeDatum) < nieuweDatum) {
            nieuwe.push({
              id: `${symbol}_nieuw_${nieuweDatum}`,
              type: 'nieuw',
              symbol, naam,
              datum: new Date(nieuweDatum).toISOString(),
              gelezen: false,
              aangemaakt: new Date().toISOString(),
            });
          }
          if (!vorigeDatum || Number(vorigeDatum) < nieuweDatum) {
            localStorage.setItem(key, String(nieuweDatum));
          }
        }

        // ── 2. Cijfers komen binnenkort (vooraf, binnen VOORAANKONDIGING_DAGEN) ──
        const volgendeDatum = info.volgendeCijfers;
        if (volgendeDatum && volgendeDatum > nu && (volgendeDatum - nu) <= vooraankondigingGrens) {
          const key = `matico_aankondiging_${symbol}`;
          const alGemeld = localStorage.getItem(key);
          // Enkel melden als we voor déze specifieke datum nog geen
          // vooraankondiging gaven (voorkomt een nieuwe melding bij elke
          // 12-uurlijkse check zolang de datum ongewijzigd blijft).
          if (alGemeld !== String(volgendeDatum)) {
            nieuwe.push({
              id: `${symbol}_aankomend_${volgendeDatum}`,
              type: 'aankomend',
              symbol, naam,
              datum: new Date(volgendeDatum).toISOString(),
              gelezen: false,
              aangemaakt: new Date().toISOString(),
            });
            localStorage.setItem(key, String(volgendeDatum));
          }
        }
      });

      if (nieuwe.length > 0) {
        setMeldingen(prev => {
          const bestaandeIds = new Set(prev.map(m => m.id));
          const toeTeVoegen = nieuwe.filter(m => !bestaandeIds.has(m.id));
          return [...toeTeVoegen, ...prev].slice(0, 50);
        });
      }
      localStorage.setItem('matico_laatste_cijfercheck', String(Date.now()));
    } catch (e) {}
  };

  useEffect(() => {
    if (beleggingen.length === 0) return;
    const magChecken = () => (Date.now() - Number(localStorage.getItem('matico_laatste_cijfercheck') || 0)) > NIEUWE_CIJFERS_CHECK_INTERVAL;
    if (magChecken()) checkNieuweCijfers();
    const interval = setInterval(() => { if (magChecken()) checkNieuweCijfers(); }, 60 * 60_000);
    return () => clearInterval(interval);
  }, [actiefPortfolioId, beleggingen.length]);

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
      favorieten, toggleFavoriet, isFavoriet,
      meldingen, ongelezenMeldingen, markeerMeldingGelezen, markeerAlleMeldingenGelezen, checkNieuweCijfers,
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
