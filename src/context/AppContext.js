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

  // Inclusief verkochte effecten: kostprijs + verkoopwaarde meenemen
  const portfolioWinstPctInclVerkocht = (() => {
    const kostprijsVerkocht = (verkochteBeleggingen || []).reduce((sum, b) => {
      const factor = getMuntFactor(b.munt || 'EUR');
      return sum + (b.kostprijs * (b.aantalVerkocht || b.aantal || 1) * factor);
    }, 0);
    const verkoopWaarde = (verkochteBeleggingen || []).reduce((sum, b) => {
      const factor = getMuntFactor(b.munt || 'EUR');
      return sum + ((b.verkoopkoers || b.kostprijs) * (b.aantalVerkocht || b.aantal || 1) * factor);
    }, 0);
    const totaalKostprijs = portfolioKostprijs + kostprijsVerkocht;
    const totaalWaarde = portfolioWaarde + verkoopWaarde;
    return totaalKostprijs > 0 ? ((totaalWaarde - totaalKostprijs) / totaalKostprijs) * 100 : 0;
  })();

  const dagWinst = beleggingen.reduce((sum, b) => {
    const koers = koersen[b.symbol];
    if (!koers) return sum;
    const factor = getMuntFactor(b.munt || 'EUR');
    return sum + ((koers.c - koers.pc) * b.aantal * factor);
  }, 0);

  const dagWinstPct = portfolioWaarde > 0 ? (dagWinst / (portfolioWaarde - dagWinst)) * 100 : 0;

  // ── Echte YTD: laad historische koers op 1 jan via Finnhub ──
  const [ytdKoersen, setYtdKoersen] = React.useState({});
  const [historischeKoersen, setHistorischeKoersen] = React.useState({});

  const haalHistorischeKoers = React.useCallback(async (symbol, datum) => {}, []);

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
  }, [beleggingen.map(b => b.symbol).join(','), (verkochteBeleggingen || []).map(b => b.symbol).join(',')]);

  const berekenTWR = (inclVerkocht) => {
    const nuJaar = new Date().getFullYear();
    const eersteJan = new Date(`${nuJaar}-01-01`);

    // Gewogen YTD-rendement:
    // - Effect in bezit vóór 1 jan → rendement tov gecachede beginjaarskoers
    // - Effect gekocht ná 1 jan → rendement tov aankoopprijs
    // - Verkocht effect → rendement tov beginjaarskoers of aankoopprijs, gewogen op startwaarde
    // Weging op startwaarde (niet huidige waarde) → correcte gewogen gemiddelde

    let teller = 0, noemer = 0;

    const verwerkBelegging = (b, prijsEind) => {
      const factor = getMuntFactor(b.munt || 'EUR');
      const aankoopDatum = b.datum ? new Date(b.datum) : null;
      let prijsStart, startWaarde;

      if (aankoopDatum && aankoopDatum <= eersteJan) {
        // In bezit op 1 jan → beginjaarskoers als startpunt
        prijsStart = ytdKoersen[b.symbol];
        if (!prijsStart || prijsStart <= 0) return; // geen data, sla over
        startWaarde = prijsStart * b.aantal * factor;
      } else {
        // Gekocht na 1 jan → aankoopprijs als startpunt
        prijsStart = b.kostprijs;
        if (!prijsStart || prijsStart <= 0) return;
        startWaarde = prijsStart * b.aantal * factor;
      }

      const rendement = (prijsEind - prijsStart) / prijsStart;
      teller += rendement * startWaarde;
      noemer += startWaarde;
    };

    // Actieve beleggingen
    beleggingen.forEach(b => {
      const k = koersen[b.symbol];
      const prijsNu = k ? k.c : b.kostprijs;
      verwerkBelegging(b, prijsNu);
    });

    // Verkochte beleggingen (enkel als inclVerkocht)
    if (inclVerkocht) {
      (verkochteBeleggingen || []).forEach(b => {
        const vd = b.verkoopdatum ? new Date(b.verkoopdatum) : null;
        if (!vd || vd.getFullYear() !== nuJaar) return;
        const prijsVerkoop = b.verkoopkoers || b.kostprijs;
        verwerkBelegging({ ...b, aantal: b.aantalVerkocht || b.aantal }, prijsVerkoop);
      });
    }

    if (noemer === 0) return 0;
    return (teller / noemer) * 100;
  };

  const ytdPct = berekenTWR(false);
  const ytdPctInclVerkocht = berekenTWR(true);

  return (
    <AppContext.Provider value={{
      gebruiker, setGebruiker,
      beleggingen, setBeleggingen,
      verkochteBeleggingen, setVerkochteBeleggingen,
      koersen, fetchKoers, refreshAlleKoersen,
      activeNav, setActiveNav,
      wisselkoers, getMuntFactor,
      portfolioWaarde, portfolioKostprijs,
      portfolioWinstVerlies, portfolioWinstPct, portfolioWinstPctInclVerkocht,
      dagWinst, dagWinstPct, ytdPct, ytdPctInclVerkocht
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
