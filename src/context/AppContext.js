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

  React.useEffect(() => {
    const nuJaar = new Date().getFullYear();
    const van = Math.floor(new Date(`${nuJaar}-01-02`).getTime() / 1000); // 2 jan (1 jan is feestdag)
    const tot = Math.floor(new Date(`${nuJaar}-01-05`).getTime() / 1000); // eerste handelsdag

    beleggingen.forEach(async (b) => {
      if (ytdKoersen[b.symbol]) return; // al geladen
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
        // Finnhub candle: { c: [slotkoersen], t: [timestamps], s: 'ok' }
        if (data?.s === 'ok' && data?.c?.length > 0) {
          const eersteSlot = data.c[0];
          localStorage.setItem(cacheKey, String(eersteSlot));
          setYtdKoersen(prev => ({ ...prev, [b.symbol]: eersteSlot }));
        }
      } catch (e) {}
    });
  }, [beleggingen.map(b => b.symbol).join(',')]);

  const ytdPct = (() => {
    // Time-Weighted Return (TWR) — zoals Trading212, Bolero, Degiro
    // Alle effecten: aandelen, ETFs, crypto, én verkochte posities die dit jaar bezit waren
    const nuJaar = new Date().getFullYear();
    const eersteJan = new Date(`${nuJaar}-01-01`);

    let gewogenTeller = 0;
    let gewogenNoemer = 0;

    // Actieve beleggingen
    beleggingen.forEach(b => {
      const koers = koersen[b.symbol];
      const factor = getMuntFactor(b.munt || 'EUR');
      const prijsNu = koers ? koers.c : b.kostprijs;
      const aankoopDatum = b.datum ? new Date(b.datum) : null;
      const waardeNu = prijsNu * b.aantal * factor;

      let rendement = 0;
      if (aankoopDatum && aankoopDatum <= eersteJan) {
        // In bezit op 1 jan → gebruik koers begin jaar als startpunt
        const prijsStart = ytdKoersen[b.symbol];
        if (prijsStart && prijsStart > 0) {
          rendement = (prijsNu - prijsStart) / prijsStart;
        } else {
          // Geen historische koers → aankoopprijs als fallback
          rendement = b.kostprijs > 0 ? (prijsNu - b.kostprijs) / b.kostprijs : 0;
        }
      } else {
        // Gekocht na 1 jan → aankoopprijs als startpunt
        if (b.kostprijs > 0) {
          rendement = (prijsNu - b.kostprijs) / b.kostprijs;
        }
      }

      gewogenTeller += rendement * waardeNu;
      gewogenNoemer += waardeNu;
    });

    // Verkochte beleggingen die dit jaar in bezit waren
    (verkochteBeleggingen || []).forEach(b => {
      const factor = getMuntFactor(b.munt || 'EUR');
      const aankoopDatum = b.datum ? new Date(b.datum) : null;
      const verkoopdatumParsed = (() => {
        if (!b.verkoopdatum) return null;
        const d = b.verkoopdatum.split('/');
        return d.length === 3 ? new Date(`${d[2]}-${d[1]}-${d[0]}`) : new Date(b.verkoopdatum);
      })();

      // Alleen meetellen als verkoop in dit jaar was
      if (!verkoopdatumParsed || verkoopdatumParsed.getFullYear() !== nuJaar) return;

      const prijsVerkoop = b.verkoopkoers || b.kostprijs;
      const waardeVerkoop = prijsVerkoop * (b.aantalVerkocht || b.aantal || 1) * factor;

      let rendement = 0;
      if (aankoopDatum && aankoopDatum <= eersteJan) {
        const prijsStart = ytdKoersen[b.symbol];
        if (prijsStart && prijsStart > 0) {
          rendement = (prijsVerkoop - prijsStart) / prijsStart;
        } else {
          rendement = b.kostprijs > 0 ? (prijsVerkoop - b.kostprijs) / b.kostprijs : 0;
        }
      } else {
        rendement = b.kostprijs > 0 ? (prijsVerkoop - b.kostprijs) / b.kostprijs : 0;
      }

      gewogenTeller += rendement * waardeVerkoop;
      gewogenNoemer += waardeVerkoop;
    });

    if (gewogenNoemer === 0) return 0;
    return (gewogenTeller / gewogenNoemer) * 100;
  })();

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
      dagWinst, dagWinstPct, ytdPct
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
