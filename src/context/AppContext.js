import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [gebruiker, setGebruiker] = useState(() => {
    const saved = localStorage.getItem('matico_gebruiker');
    return saved ? JSON.parse(saved) : { voornaam: '', achternaam: '' };
  });

  const [beleggingen, setBeleggingen] = useState(() => {
    const saved = localStorage.getItem('matico_beleggingen');
    return saved ? JSON.parse(saved) : [];
  });

  const [verkochteBeleggingen, setVerkochteBeleggingen] = useState(() => {
    const saved = localStorage.getItem('matico_verkochte_beleggingen');
    return saved ? JSON.parse(saved) : [];
  });

  const [koersen, setKoersen] = useState({});
  const [activeNav, setActiveNav] = useState('overzicht');
  const [wisselkoers, setWisselkoers] = useState({ usdEur: 0.865 }); // live bijgewerkt

  useEffect(() => {
    localStorage.setItem('matico_gebruiker', JSON.stringify(gebruiker));
  }, [gebruiker]);

  useEffect(() => {
    localStorage.setItem('matico_beleggingen', JSON.stringify(beleggingen));
  }, [beleggingen]);

  useEffect(() => {
    localStorage.setItem('matico_verkochte_beleggingen', JSON.stringify(verkochteBeleggingen));
  }, [verkochteBeleggingen]);

  // Haal live wisselkoers op
  useEffect(() => {
    const haalWisselkoers = async () => {
      try {
        const res = await fetch('/api/data?endpoint=forex');
        const data = await res.json();
        if (data.usdEur) setWisselkoers(data);
      } catch (e) {
        console.error('Wisselkoers ophalen mislukt:', e);
      }
    };
    haalWisselkoers();
    const interval = setInterval(haalWisselkoers, 3600000); // elk uur
    return () => clearInterval(interval);
  }, []);

  const fetchKoers = async (symbol) => {
    try {
      const res = await fetch(`/api/data?endpoint=quote&symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (data.c) {
        setKoersen(prev => ({ ...prev, [symbol]: data }));
        return data;
      }
    } catch (e) {
      console.error('Koers ophalen mislukt:', e);
    }
    return null;
  };

  const refreshAlleKoersen = async () => {
    const symbolen = [...new Set(beleggingen.map(b => b.symbol))];
    for (const s of symbolen) {
      await fetchKoers(s);
    }
  };

  useEffect(() => {
    if (beleggingen.length > 0) refreshAlleKoersen();
  }, [beleggingen.length]);

  // ── Auto-refresh koersen ──
  // Bij laden altijd verversen, daarna elke 60 seconden
  useEffect(() => {
    if (beleggingen.length === 0) return;

    // Altijd verversen bij eerste load (ongeacht cache)
    refreshAlleKoersen();

    // Daarna elke 60 seconden
    const interval = setInterval(() => {
      refreshAlleKoersen();
    }, 60000);

    return () => clearInterval(interval);
  }, []);  // lege dependency → alleen bij mount

  const getMuntFactor = (munt) => {
    if (munt === 'USD') return wisselkoers.usdEur;
    if (munt === 'GBP') return wisselkoers.usdEur * 1.27; // GBP/EUR benadering
    return 1;
  };

  // Bereken portfolio totaal met live wisselkoers
  const portfolioWaarde = beleggingen.reduce((sum, b) => {
    const koers = koersen[b.symbol];
    const prijs = koers ? koers.c : b.kostprijs;
    const factor = getMuntFactor(b.munt || 'EUR');
    return sum + (prijs * b.aantal * factor);
  }, 0);

  const portfolioKostprijs = beleggingen.reduce((sum, b) => {
    const factor = getMuntFactor(b.munt || 'EUR');
    return sum + (b.kostprijs * b.aantal * factor);
  }, 0);

  const portfolioWinstVerlies = portfolioWaarde - portfolioKostprijs;
  const portfolioWinstPct = portfolioKostprijs > 0 ? (portfolioWinstVerlies / portfolioKostprijs) * 100 : 0;

  const dagWinst = beleggingen.reduce((sum, b) => {
    const koers = koersen[b.symbol];
    if (!koers) return sum;
    const factor = getMuntFactor(b.munt || 'EUR');
    return sum + ((koers.c - koers.pc) * b.aantal * factor);
  }, 0);

  const dagWinstPct = portfolioWaarde > 0 ? (dagWinst / (portfolioWaarde - dagWinst)) * 100 : 0;

  // ── Echte YTD: laad historische koers op 1 jan via Finnhub ──
  const [ytdKoersen, setYtdKoersen] = React.useState({});
  const [historischeKoersen, setHistorischeKoersen] = React.useState({}); // { 'NVDA_2026-06-03': 135.20, ... }

  // Haal koers op voor een specifieke datum (voor TWR berekening)
  const haalHistorischeKoers = React.useCallback(async (symbol, datum) => {
    const sleutel = `${symbol}_${datum}`;
    const cacheKey = `matico_hist_${sleutel}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setHistorischeKoersen(prev => ({ ...prev, [sleutel]: parseFloat(cached) }));
        return;
      }
    } catch (e) {}
    try {
      const d = new Date(datum);
      const van = Math.floor(d.getTime() / 1000) - 86400; // dag ervoor (weekend buffer)
      const tot = Math.floor(d.getTime() / 1000) + 86400 * 4; // 4 dagen later
      const res = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(symbol)}&van=${van}&tot=${tot}&resolutie=D`);
      const data = await res.json();
      if (data?.s === 'ok' && data?.c?.length > 0) {
        // Neem de koers het dichtst bij de gevraagde datum
        const koers = data.c[0];
        localStorage.setItem(cacheKey, String(koers));
        setHistorischeKoersen(prev => ({ ...prev, [sleutel]: koers }));
      }
    } catch (e) {}
  }, []);

  React.useEffect(() => {
    const nuJaar = new Date().getFullYear();
    const van = Math.floor(new Date(`${nuJaar}-01-02`).getTime() / 1000);
    const tot = Math.floor(new Date(`${nuJaar}-01-05`).getTime() / 1000);

    // Begin-jaar koersen voor effecten die voor 1 jan in bezit waren
    const alleSymbolen = [
      ...beleggingen,
      ...(verkochteBeleggingen || [])
    ].filter(b => b.datum && new Date(b.datum) < new Date(`${nuJaar}-01-01`));

    alleSymbolen.forEach(async (b) => {
      if (ytdKoersen[b.symbol]) return;
      const cacheKey = `matico_ytd_${b.symbol}_${nuJaar}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setYtdKoersen(prev => ({ ...prev, [b.symbol]: parseFloat(cached) }));
          return;
        }
      } catch (e) {}
      try {
        const res = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(b.symbol)}&van=${van}&tot=${tot}&resolutie=D`);
        const data = await res.json();
        if (data?.s === 'ok' && data?.c?.length > 0) {
          const eersteSlot = data.c[0];
          localStorage.setItem(cacheKey, String(eersteSlot));
          setYtdKoersen(prev => ({ ...prev, [b.symbol]: eersteSlot }));
        }
      } catch (e) {}
    });

    // Historische koersen ophalen voor alle aankoop/verkoopdatums in dit jaar
    const cashflowDatums = [];
    [...beleggingen, ...(verkochteBeleggingen || [])].forEach(b => {
      if (b.datum) {
        const d = new Date(b.datum);
        if (d.getFullYear() === nuJaar) cashflowDatums.push({ symbol: b.symbol, datum: b.datum });
      }
      if (b.verkoopdatum) {
        const vd = new Date(b.verkoopdatum);
        if (vd.getFullYear() === nuJaar) cashflowDatums.push({ symbol: b.symbol, datum: b.verkoopdatum });
      }
    });

    cashflowDatums.forEach(({ symbol, datum }) => {
      const sleutel = `${symbol}_${datum}`;
      if (!historischeKoersen[sleutel]) {
        haalHistorischeKoers(symbol, datum);
      }
    });
  }, [beleggingen.map(b => b.symbol).join(','), (verkochteBeleggingen || []).map(b => b.symbol).join(',')]);

  const berekenTWR = (inclVerkocht) => {
    // Echte Time-Weighted Return (TWR)
    const nuJaar = new Date().getFullYear();
    const eersteJan = new Date(`${nuJaar}-01-01`);
    const nu = new Date();

    const actief = beleggingen.map(b => ({ ...b, verkocht: false }));
    const verkocht = (verkochteBeleggingen || []).map(b => ({ ...b, verkocht: true }));
    const alleBel = inclVerkocht ? [...actief, ...verkocht] : actief;

    // Unieke sub-periode grenzen
    const grensDatums = new Set([eersteJan.toISOString().slice(0, 10)]);
    alleBel.forEach(b => {
      if (b.datum) { const d = new Date(b.datum); if (d > eersteJan && d <= nu) grensDatums.add(b.datum.slice(0, 10)); }
      if (b.verkoopdatum) { const vd = new Date(b.verkoopdatum); if (vd > eersteJan && vd <= nu) grensDatums.add(b.verkoopdatum.slice(0, 10)); }
    });
    const grenzen = [...grensDatums].sort();

    const waardeOp = (datumStr) => {
      const datum = new Date(datumStr);
      let waarde = 0;
      alleBel.forEach(b => {
        const aankoop = b.datum ? new Date(b.datum) : null;
        const verkoop = b.verkoopdatum ? new Date(b.verkoopdatum) : null;
        if (aankoop && datum < aankoop) return;
        if (verkoop && datum >= verkoop) return;
        const factor = getMuntFactor(b.munt || 'EUR');
        let koers;
        if (datumStr === eersteJan.toISOString().slice(0, 10)) {
          koers = ytdKoersen[b.symbol] || b.kostprijs;
        } else if (datumStr === grenzen[grenzen.length - 1]) {
          const k = koersen[b.symbol]; koers = k ? k.c : b.kostprijs;
        } else {
          const sleutel = `${b.symbol}_${b.datum?.slice(0, 10)}`;
          koers = historischeKoersen[sleutel] || b.kostprijs;
        }
        waarde += koers * b.aantal * factor;
      });
      return waarde;
    };

    let twr = 1;
    for (let i = 0; i < grenzen.length - 1; i++) {
      const bw = waardeOp(grenzen[i]);
      const ew = waardeOp(grenzen[i + 1]);
      if (bw > 0) twr *= (ew / bw);
    }

    // Laatste periode tot nu
    const laatste = grenzen[grenzen.length - 1];
    if (grenzen.length > 0) {
      const bw = waardeOp(laatste);
      let ew = 0;
      actief.forEach(b => {
        const aankoop = b.datum ? new Date(b.datum) : null;
        if (aankoop && nu < aankoop) return;
        const factor = getMuntFactor(b.munt || 'EUR');
        const k = koersen[b.symbol];
        ew += (k ? k.c : b.kostprijs) * b.aantal * factor;
      });
      if (bw > 0) twr *= (ew / bw);
    }

    return (twr - 1) * 100;
  };

  const ytdPct = berekenTWR(false);         // exclusief verkochte effecten (standaard, sidebar)
  const ytdPctInclVerkocht = berekenTWR(true); // inclusief verkochte effecten

  return (
    <AppContext.Provider value={{
      gebruiker, setGebruiker,
      beleggingen, setBeleggingen,
      verkochteBeleggingen, setVerkochteBeleggingen,
      koersen, fetchKoers, refreshAlleKoersen,
      activeNav, setActiveNav,
      wisselkoers, getMuntFactor,
      portfolioWaarde, portfolioKostprijs,
      portfolioWinstVerlies, portfolioWinstPct,
      dagWinst, dagWinstPct, ytdPct, ytdPctInclVerkocht
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
