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

  useEffect(() => {
    localStorage.setItem('matico_gebruiker', JSON.stringify(gebruiker));
  }, [gebruiker]);

  useEffect(() => {
    localStorage.setItem('matico_beleggingen', JSON.stringify(beleggingen));
  }, [beleggingen]);

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

  // Bereken portfolio totaal
  const portfolioWaarde = beleggingen.reduce((sum, b) => {
    const koers = koersen[b.symbol];
    const prijs = koers ? koers.c : b.kostprijs;
    const munt = b.munt || 'EUR';
    // Eenvoudige conversie: USD naar EUR ~0.92
    const factor = munt === 'USD' ? 0.92 : 1;
    return sum + (prijs * b.aantal * factor);
  }, 0);

  const portfolioKostprijs = beleggingen.reduce((sum, b) => {
    const munt = b.munt || 'EUR';
    const factor = munt === 'USD' ? 0.92 : 1;
    return sum + (b.kostprijs * b.aantal * factor);
  }, 0);

  const portfolioWinstVerlies = portfolioWaarde - portfolioKostprijs;
  const portfolioWinstPct = portfolioKostprijs > 0 ? (portfolioWinstVerlies / portfolioKostprijs) * 100 : 0;

  const dagWinst = beleggingen.reduce((sum, b) => {
    const koers = koersen[b.symbol];
    if (!koers) return sum;
    const munt = b.munt || 'EUR';
    const factor = munt === 'USD' ? 0.92 : 1;
    return sum + ((koers.c - koers.pc) * b.aantal * factor);
  }, 0);

  const dagWinstPct = portfolioWaarde > 0 ? (dagWinst / (portfolioWaarde - dagWinst)) * 100 : 0;

  return (
    <AppContext.Provider value={{
      gebruiker, setGebruiker,
      beleggingen, setBeleggingen,
      koersen, fetchKoers, refreshAlleKoersen,
      activeNav, setActiveNav,
      portfolioWaarde, portfolioKostprijs,
      portfolioWinstVerlies, portfolioWinstPct,
      dagWinst, dagWinstPct
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
