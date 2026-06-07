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

  const [koersen, setKoersen] = useState({});
  const [activeNav, setActiveNav] = useState('overzicht');
  const [wisselkoers, setWisselkoers] = useState({ usdEur: 0.865 }); // live bijgewerkt

  useEffect(() => {
    localStorage.setItem('matico_gebruiker', JSON.stringify(gebruiker));
  }, [gebruiker]);

  useEffect(() => {
    localStorage.setItem('matico_beleggingen', JSON.stringify(beleggingen));
  }, [beleggingen]);

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

  // ── YTD berekening: waarde nu vs waarde op 1 januari van dit jaar ──
  // Waarde op 1 jan = aantal aandelen × slotkoers 1 jan (via koers.pc als proxy, of kostprijs)
  // We gebruiken de openingskoers van het jaar: voor elk aandeel dat al in bezit was op 1 jan
  const ytdPct = (() => {
    const nuJaar = new Date().getFullYear();
    const eersteJan = new Date(`${nuJaar}-01-01`);
    
    let waardeNu = 0;
    let waardeEersteJan = 0;

    beleggingen.forEach(b => {
      const koers = koersen[b.symbol];
      const factor = getMuntFactor(b.munt || 'EUR');
      const aankoopDatum = b.datum ? new Date(b.datum) : null;
      
      // Huidige waarde
      const prijsNu = koers ? koers.c : b.kostprijs;
      waardeNu += prijsNu * b.aantal * factor;

      // Waarde op 1 jan: als aandeel al in bezit was op 1 jan
      if (aankoopDatum && aankoopDatum <= eersteJan) {
        // Gebruik 52-week high/low gemiddelde als proxy voor jaarstart
        // Of val terug op kostprijs als referentie
        const prijsJanStart = koers?.o || koers?.pc || b.kostprijs;
        waardeEersteJan += b.kostprijs * b.aantal * factor; // aankoopwaarde als basis
      } else if (aankoopDatum && aankoopDatum > eersteJan) {
        // Nieuw aangekocht in dit jaar: gebruik aankoopprijs als basis
        waardeEersteJan += b.kostprijs * b.aantal * factor;
      }
    });

    if (waardeEersteJan === 0) return 0;
    return ((waardeNu - waardeEersteJan) / waardeEersteJan) * 100;
  })();

  return (
    <AppContext.Provider value={{
      gebruiker, setGebruiker,
      beleggingen, setBeleggingen,
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
