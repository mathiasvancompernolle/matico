import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { SlidersHorizontal, GitCompare, Plus, ChevronDown, X, Check, Upload, Edit3 } from 'lucide-react';
import BeleggingDetail from '../components/BeleggingDetail';

const TIJDPERKEN = ['1D', '1W', '1M', '1J', 'YTD', 'Laatste', 'Totaal'];
const VERGELIJK_OPTIES = [
  { id: 'geen', label: 'Geen vergelijking' },
  { id: 'msci', label: 'MSCI World', kleur: '#22c55e' },
  { id: 'sp500', label: 'S&P 500', kleur: '#f59e0b' },
  { id: 'bel20', label: 'BEL 20', kleur: '#8b5cf6' },
  { id: 'bitcoin', label: 'Bitcoin', kleur: '#f97316' },
];

// Bereken het juiste API tijdperk op basis van tijdperk en beleggingen
function getApiTijdperk(tijdperk, beleggingen) {
  if (tijdperk === 'Laatste') {
    // Meest recente aankoopdatum
    const datums = beleggingen.filter(b => b.datum).map(b => new Date(b.datum));
    if (datums.length === 0) return '1M';
    const meestRecent = new Date(Math.max(...datums));
    const dagVerschil = Math.floor((Date.now() - meestRecent.getTime()) / 86400000);
    if (dagVerschil <= 7) return '1W';
    if (dagVerschil <= 30) return '1M';
    if (dagVerschil <= 365) return '1J';
    if (dagVerschil <= 1095) return '3J';
    return '5J';
  }
  if (tijdperk === 'Totaal') {
    // Vroegste aankoopdatum
    const datums = beleggingen.filter(b => b.datum).map(b => new Date(b.datum));
    if (datums.length === 0) return 'Max';
    const vroegste = new Date(Math.min(...datums));
    const dagVerschil = Math.floor((Date.now() - vroegste.getTime()) / 86400000);
    if (dagVerschil <= 30) return '1M';
    if (dagVerschil <= 365) return '1J';
    if (dagVerschil <= 1095) return '3J';
    if (dagVerschil <= 1825) return '5J';
    return 'Max';
  }
  return tijdperk;
}

// Bereken begindatum voor "Laatste" filtering
function getBegindatumVoorTijdperk(tijdperk, beleggingen) {
  if (tijdperk === 'Laatste') {
    const datums = beleggingen.filter(b => b.datum).map(b => new Date(b.datum));
    if (datums.length === 0) return null;
    return new Date(Math.max(...datums)); // meest recente aankoop
  }
  if (tijdperk === 'Totaal') {
    const datums = beleggingen.filter(b => b.datum).map(b => new Date(b.datum));
    if (datums.length === 0) return null;
    return new Date(Math.min(...datums)); // vroegste aankoop
  }
  return null; // Voor andere tijdperken filtert de API al correct
}

export default function Overzicht({ onToevoegen, onImporteren }) {
  const { gebruiker, beleggingen, koersen, refreshAlleKoersen, portfolioWaarde, dagWinst, dagWinstPct, getMuntFactor, verkochteBeleggingen } = useApp();

  // ── Check of dagpercentage getoond mag worden ──
  // Toon percentage als: beurs open OF beurs was vandaag open (tot middernacht)
  // Toon NIET als: weekend of nieuwe dag begonnen zonder dat beurs al open was
  const isBeursOpen = (munt) => {
    const nu = new Date();
    // Gebruik UTC-dag (consistent met de UTC-tijdscheck hieronder), anders loopt
    // dit rond middernacht lokale tijd (CEST = UTC+2) uit elkaar.
    const dag = nu.getUTCDay(); // 0=zo, 6=za
    if (dag === 0 || dag === 6) return false; // weekend: nooit tonen

    // Doordeweeks: toon percentage van vandaag tot middernacht
    // (beurs was vandaag open, resultaat mag zichtbaar blijven)
    const uurUTC = nu.getUTCHours();
    const minUTC = nu.getUTCMinutes();
    const tijdUTC = uurUTC * 60 + minUTC;

    if (munt === 'EUR') {
      // Xetra: 08:00-17:30 CET = 07:00-16:30 UTC
      // Toon van opening tot middernacht (00:00 UTC)
      return tijdUTC >= 7 * 60; // vanaf opening tot einde dag
    } else {
      // NYSE/NASDAQ: 09:30-16:00 ET = 13:30-20:00 UTC
      // Toon van opening tot middernacht (00:00 UTC)
      return tijdUTC >= 13 * 60 + 30; // vanaf opening tot einde dag
    }
  };
  const [tijdperk, setTijdperk] = useState('1D');
  const [weergave, setWeergave] = useState('waarde');
  const [grafiekData, setGrafiekData] = useState([]);
  const [grafiekLoading, setGrafiekLoading] = useState(false);
  const [vergelijkOpen, setVergelijkOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [vergelijk1, setVergelijk1] = useState('msci');
  const [vergelijk2, setVergelijk2] = useState('geen');
  const [filterType, setFilterType] = useState('alle');
  const [filterSymbolen, setFilterSymbolen] = useState([]);
  const [filterBezit, setFilterBezit] = useState('inbezit'); // 'alles' | 'inbezit'
  const [detailBelegging, setDetailBelegging] = useState(null);
  const [sortCol, setSortCol] = useState('datum'); // standaard: oudste naar nieuwste
  const [sortDir, setSortDir] = useState('asc');
  const [toevoegenMenuOpen, setToevoegenMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const begroeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Goede morgen';
    if (h < 18) return 'Goede middag';
    return 'Goede avond';
  };

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setToevoegenMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Gefilterde beleggingen ook voor grafiek gebruiken
  const beleggingVoorGrafiek = beleggingen.filter(b => {
    if (filterType !== 'alle' && b.type !== filterType) return false;
    if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return false;
    return true;
  });

  useEffect(() => {
    const laadGrafiek = async () => {
      if (beleggingVoorGrafiek.length === 0) { setGrafiekData([]); return; }
      setGrafiekLoading(true);

      // 1D: vorige handelsdag en nu
      if (tijdperk === '1D') {
        const nu = new Date();
        const dag = nu.getDay();
        const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

        // Bepaal datum van vorige handelsdag
        const vorigeD = new Date(nu);
        if (dag === 1) vorigeD.setDate(nu.getDate() - 3); // ma → vr
        else if (dag === 0) vorigeD.setDate(nu.getDate() - 2); // zo → vr
        else vorigeD.setDate(nu.getDate() - 1); // doordeweeks → gisteren
        const vorigeHandelsDag = `${vorigeD.getDate()} ${maanden[vorigeD.getMonth()]}`;

        // Haal werkelijke slotkoers van vorige handelsdag op via candle API
        const vanTs = Math.floor(new Date(vorigeD.getFullYear(), vorigeD.getMonth(), vorigeD.getDate(), 0, 0, 0).getTime() / 1000);
        const totTs = Math.floor(new Date(vorigeD.getFullYear(), vorigeD.getMonth(), vorigeD.getDate(), 23, 59, 59).getTime() / 1000);

        let gisterenWaarde = 0;
        let nuWaarde = 0;

        // Haal voor elk aandeel de slotkoers van vorige handelsdag op
        const slotKoersen = {};
        await Promise.all(beleggingVoorGrafiek.map(async (b) => {
          const cacheKey = `matico_slot_${b.symbol}_${vorigeD.toDateString()}`;
          try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) { slotKoersen[b.symbol] = parseFloat(cached); return; }
          } catch (e) {}
          try {
            const res = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(b.symbol)}&van=${vanTs}&tot=${totTs}&resolutie=D`);
            const data = await res.json();
            if (data?.s === 'ok' && data?.c?.length > 0) {
              const slot = data.c[data.c.length - 1];
              localStorage.setItem(cacheKey, String(slot));
              slotKoersen[b.symbol] = slot;
            }
          } catch (e) {}
        }));

        beleggingVoorGrafiek.forEach(b => {
          const koers = koersen[b.symbol];
          const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
          const slotVorige = slotKoersen[b.symbol] || koers?.pc || b.kostprijs;
          const prijsNu = koers?.c || b.kostprijs;
          gisterenWaarde += slotVorige * b.aantal * factor;
          nuWaarde += prijsNu * b.aantal * factor;
        });

        const iemandOpen = beleggingVoorGrafiek.some(b => isBeursOpen(b.munt || 'EUR'));
        if (!iemandOpen) {
          setGrafiekData([
            { label: vorigeHandelsDag, waarde: Math.round(gisterenWaarde * 100) / 100, gesloten: true },
            { label: 'Nu', waarde: Math.round(gisterenWaarde * 100) / 100, gesloten: true }
          ]);
        } else {
          setGrafiekData([
            { label: vorigeHandelsDag, waarde: Math.round(gisterenWaarde * 100) / 100 },
            { label: 'Nu', waarde: Math.round(nuWaarde * 100) / 100 }
          ]);
        }
        setGrafiekLoading(false);
        return;
      }

      // Bepaal API tijdperk
      const apiTijdperk = getApiTijdperk(tijdperk, beleggingVoorGrafiek);

      // Helper: parse dd/mm/yyyy of yyyy-mm-dd naar Date
      const parseDatum = (str) => {
        if (!str) return null;
        const d = str.split('/');
        if (d.length === 3) return new Date(`${d[2]}-${d[1]}-${d[0]}`);
        return new Date(str);
      };

      // Gefilterde verkochte beleggingen (ook op filterType/filterSymbolen/filterBezit)
      const verkochtVoorGrafiek = filterBezit === 'inbezit' ? [] : (verkochteBeleggingen || []).filter(b => {
        if (filterType !== 'alle' && b.type !== filterType) return false;
        if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return false;
        return true;
      });

      // Alle symbolen: actief + verkocht (deduped)
      const alleSymbolen = [...new Set([
        ...beleggingVoorGrafiek.map(b => b.symbol),
        ...verkochtVoorGrafiek.map(b => b.symbol)
      ])];

      const historischeData = {};

      for (const symbol of alleSymbolen) {
        try {
          const res = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(symbol)}&tijdperk=${apiTijdperk}`);
          const data = await res.json();
          if (data.punten && data.punten.length > 1) {
            historischeData[symbol] = data.punten;
          }
        } catch (e) { console.error('Historische data fout:', e); }
      }

      if (Object.keys(historischeData).length === 0) {
        setGrafiekLoading(false);
        return;
      }

      // Gebruik het symbool met de meeste datapunten als tijdsas
      const eersteSymbol = Object.keys(historischeData).reduce((a, b) =>
        historischeData[a].length >= historischeData[b].length ? a : b
      );
      const allePunten = historischeData[eersteSymbol];

      // Bepaal begindatum voor "Laatste" filtering
      const begindatumFilter = getBegindatumVoorTijdperk(tijdperk, beleggingVoorGrafiek);

      // Combineer per datumpunt — actieve + verkochte beleggingen, elk met hun tijdvenster
      const gecombineerd = allePunten
        .filter(punt => {
          if (begindatumFilter && punt.datum) {
            return new Date(punt.datum) >= begindatumFilter;
          }
          return true;
        })
        .map((punt, i) => {
          const puntDatum = punt.datum ? new Date(punt.datum) : null;
          let totaalWaarde = 0;

          // ── Actieve beleggingen: tellen mee vanaf aankoopdatum ──
          beleggingVoorGrafiek.forEach(b => {
            const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
            const aankoopDatum = b.datum ? new Date(b.datum) : null;
            if (puntDatum && aankoopDatum && puntDatum < aankoopDatum) return;

            const symbolData = historischeData[b.symbol];
            if (symbolData) {
              let gevondenPunt = punt.datum ? symbolData.find(p => p.datum === punt.datum) : null;
              if (!gevondenPunt) gevondenPunt = symbolData[Math.min(i, symbolData.length - 1)];
              if (gevondenPunt) totaalWaarde += gevondenPunt.prijs * b.aantal * factor;
            } else {
              const koers = koersen[b.symbol];
              totaalWaarde += (koers ? koers.c : b.kostprijs) * b.aantal * factor;
            }
          });

          // ── Verkochte beleggingen: tellen mee tussen aankoop- en verkoopdatum ──
          verkochtVoorGrafiek.forEach(b => {
            const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
            const aankoopDatum = b.datum ? new Date(b.datum) : null;
            const verkoopDatum = parseDatum(b.verkoopdatum);

            // Punt valt buiten het venster van deze positie → niet meetellen
            if (puntDatum && aankoopDatum && puntDatum < aankoopDatum) return;
            if (puntDatum && verkoopDatum && puntDatum > verkoopDatum) return;

            const symbolData = historischeData[b.symbol];
            if (symbolData) {
              let gevondenPunt = punt.datum ? symbolData.find(p => p.datum === punt.datum) : null;
              if (!gevondenPunt) gevondenPunt = symbolData[Math.min(i, symbolData.length - 1)];
              if (gevondenPunt) totaalWaarde += gevondenPunt.prijs * b.aantalVerkocht * factor;
            } else {
              // Geen historische data: gebruik verkoopkoers als benadering
              totaalWaarde += (b.verkoopkoers || b.kostprijs) * b.aantalVerkocht * factor;
            }
          });

          return { label: punt.label, datum: punt.datum, waarde: Math.round(totaalWaarde * 100) / 100 };
        })
        .filter(p => p.waarde > 0);

      setGrafiekData(gecombineerd);
      setGrafiekLoading(false);
    };

    laadGrafiek();
  }, [beleggingVoorGrafiek.length, koersen, tijdperk, filterType, filterSymbolen, filterBezit, (verkochteBeleggingen || []).length]);

  useEffect(() => {
    refreshAlleKoersen();
    const interval = setInterval(refreshAlleKoersen, 60000);
    return () => clearInterval(interval);
  }, []);

  const gefilterdeBeleggingen = useMemo(() => {
    const lijst = beleggingen.filter(b => {
      if (filterType !== 'alle' && b.type !== filterType) return false;
      if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return false;
      return true;
    });
    const parseDatum = (s) => { if (!s) return 0; const d = s.split('/'); return d.length === 3 ? new Date(`${d[2]}-${d[1]}-${d[0]}`).getTime() : new Date(s).getTime(); };
    return [...lijst].sort((a, b) => {
      let va, vb;
      const ka = koersen[a.symbol], kb = koersen[b.symbol];
      const fa = getMuntFactor ? getMuntFactor(a.munt || 'EUR') : ((a.munt||'EUR')==='USD'?0.865:1);
      const fb = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt||'EUR')==='USD'?0.865:1);
      switch (sortCol) {
        case 'naam': va = a.naam?.toLowerCase(); vb = b.naam?.toLowerCase(); break;
        case 'koers': va = ka ? ka.c : a.kostprijs; vb = kb ? kb.c : b.kostprijs; break;
        case 'waarde': va = (ka ? ka.c : a.kostprijs) * a.aantal * fa; vb = (kb ? kb.c : b.kostprijs) * b.aantal * fb; break;
        case 'vandaag': va = ka ? (ka.c - ka.pc) * a.aantal * fa : 0; vb = kb ? (kb.c - kb.pc) * b.aantal * fb : 0; break;
        case 'totaal': va = (ka ? ka.c : a.kostprijs) * a.aantal * fa - a.kostprijs * a.aantal * fa; vb = (kb ? kb.c : b.kostprijs) * b.aantal * fb - b.kostprijs * b.aantal * fb; break;
        case 'gewicht': {
          const tot = lijst.reduce((s,bb) => { const k=koersen[bb.symbol]; const f=getMuntFactor?getMuntFactor(bb.munt||'EUR'):((bb.munt||'EUR')==='USD'?0.865:1); return s+(k?k.c:bb.kostprijs)*bb.aantal*f; }, 0);
          va = tot > 0 ? (ka?ka.c:a.kostprijs)*a.aantal*fa/tot : 0;
          vb = tot > 0 ? (kb?kb.c:b.kostprijs)*b.aantal*fb/tot : 0; break;
        }
        default: va = parseDatum(a.datum); vb = parseDatum(b.datum); break; // datum
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [beleggingen, filterType, filterSymbolen, sortCol, sortDir, koersen]);

  // Winst/verlies = huidige waarde - aankoopwaarde van alle posities actief op die datum
  const winstData = grafiekData.map((d) => {
    const puntDatum = d.datum ? new Date(d.datum) : null;
    const parseDatum = (str) => {
      if (!str) return null;
      const delen = str.split('/');
      if (delen.length === 3) return new Date(`${delen[2]}-${delen[1]}-${delen[0]}`);
      return new Date(str);
    };
    let aankoopwaarde = 0;
    // Actieve beleggingen
    beleggingVoorGrafiek.forEach(b => {
      const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
      const aankoopDatum = b.datum ? new Date(b.datum) : null;
      if (!puntDatum || !aankoopDatum || puntDatum >= aankoopDatum) {
        aankoopwaarde += b.kostprijs * b.aantal * factor;
      }
    });
    // Verkochte beleggingen: kostprijs telt alleen mee terwijl de positie open was (niet bij inbezit-filter)
    (filterBezit === 'inbezit' ? [] : (verkochteBeleggingen || [])).forEach(b => {
      if (filterType !== 'alle' && b.type !== filterType) return;
      if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return;
      const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
      const aankoopDatum = b.datum ? new Date(b.datum) : null;
      const verkoopDatum = parseDatum(b.verkoopdatum);
      if (puntDatum && aankoopDatum && puntDatum < aankoopDatum) return;
      if (puntDatum && verkoopDatum && puntDatum > verkoopDatum) return;
      aankoopwaarde += b.kostprijs * b.aantalVerkocht * factor;
    });
    return { ...d, waarde: Math.round((d.waarde - aankoopwaarde) * 100) / 100 };
  });

  // Huidige waarde van enkel de gefilterde beleggingen
  const gefilterdeTotaalWaarde = beleggingVoorGrafiek.reduce((s, b) => {
    const k = koersen[b.symbol];
    const prijs = k ? k.c : b.kostprijs;
    const f = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
    return s + prijs * b.aantal * f;
  }, 0);

  const displayData = weergave === 'waarde' ? grafiekData : winstData;

  // ── Slimme X-as: meet werkelijk datumbereik, kies dan de beste interval ──
  const { xTicks, xTickFormatter } = (() => {
    const maandKort = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    const data = displayData;
    if (data.length < 2) return { xTicks: undefined, xTickFormatter: v => v };

    const eersteD = data.find(d => d.datum)?.datum ? new Date(data.find(d => d.datum).datum) : null;
    const laatsteD = [...data].reverse().find(d => d.datum)?.datum ? new Date([...data].reverse().find(d => d.datum).datum) : null;
    if (!eersteD || !laatsteD) return { xTicks: undefined, xTickFormatter: v => v };

    const dagen = (laatsteD - eersteD) / (1000 * 60 * 60 * 24);

    // Kies groeperingsstrategie op basis van werkelijk bereik
    let groepeerFn, formatFn;

    if (dagen <= 2) {
      // Enkele dag(en): per uur
      const stap = Math.max(1, Math.floor(data.length / 6));
      const ticks = data.filter((_, i) => i % stap === 0 || i === data.length - 1).map(d => d.label);
      return { xTicks: ticks, xTickFormatter: v => v };
    }

    if (dagen <= 14) {
      // Tot 2 weken: elke dag
      groepeerFn = d => new Date(d.datum).toDateString();
      formatFn = d => { const dt = new Date(d.datum); return `${dt.getDate()} ${maandKort[dt.getMonth()]}`; };
    } else if (dagen <= 60) {
      // Tot 2 maanden: elke week
      groepeerFn = d => { const dt = new Date(d.datum); return `${dt.getFullYear()}-${Math.ceil(dt.getDate()/7)}-${dt.getMonth()}`; };
      formatFn = d => { const dt = new Date(d.datum); return `${dt.getDate()} ${maandKort[dt.getMonth()]}`; };
    } else if (dagen <= 400) {
      // Tot ~1 jaar: elke maand
      groepeerFn = d => { const dt = new Date(d.datum); return `${dt.getFullYear()}-${dt.getMonth()}`; };
      formatFn = d => {
        const dt = new Date(d.datum);
        // Bij jaarwisseling jaar erbij
        if (dt.getMonth() === 0 || dt === eersteD) return `jan '${String(dt.getFullYear()).slice(2)}`;
        return maandKort[dt.getMonth()];
      };
    } else if (dagen <= 900) {
      // Tot ~2.5 jaar: elk kwartaal
      groepeerFn = d => { const dt = new Date(d.datum); return `${dt.getFullYear()}-Q${Math.floor(dt.getMonth()/3)}`; };
      formatFn = d => {
        const dt = new Date(d.datum);
        const kwartaalMaand = Math.floor(dt.getMonth()/3) * 3;
        if (kwartaalMaand === 0) return `${dt.getFullYear()}`;
        return maandKort[kwartaalMaand];
      };
    } else {
      // Meer dan 2.5 jaar: elk jaar
      groepeerFn = d => new Date(d.datum).getFullYear();
      formatFn = d => String(new Date(d.datum).getFullYear());
    }

    // Filter data tot 1 tick per groep
    const gezien = new Set();
    const ticks = data.filter(d => {
      if (!d.datum) return false;
      const sleutel = groepeerFn(d);
      if (gezien.has(sleutel)) return false;
      gezien.add(sleutel);
      return true;
    }).map(d => d.label);

    // Formatter zoekt het datapunt terug op label
    const formatter = (label) => {
      const punt = data.find(d => d.label === label);
      if (!punt?.datum) return label;
      return formatFn(punt);
    };

    return { xTicks: ticks, xTickFormatter: formatter };
  })();
  const beursOpenPortfolio = beleggingen.some(b => isBeursOpen(b.munt || 'EUR'));

  // Voor 1D: bereken winst alleen op basis van beurzen die vandaag al open waren
  const dagWinst1D = beleggingen.reduce((s, b) => {
    if (!isBeursOpen(b.munt || 'EUR')) return s; // sla gesloten beurzen over
    const koers = koersen[b.symbol];
    if (!koers) return s;
    const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
    return s + (koers.c - koers.pc) * b.aantal * factor;
  }, 0);

  const dagWaarde1D = beleggingen.reduce((s, b) => {
    if (!isBeursOpen(b.munt || 'EUR')) return s;
    const koers = koersen[b.symbol];
    const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
    return s + (koers ? koers.pc : b.kostprijs) * b.aantal * factor;
  }, 0);

  const dagWinstPct1D = dagWaarde1D > 0 ? (dagWinst1D / dagWaarde1D) * 100 : 0;

  const periodeWinst = tijdperk === '1D'
    ? (beursOpenPortfolio ? dagWinst1D : 0)
    : (grafiekData.length > 1 ? grafiekData[grafiekData.length-1].waarde - grafiekData[0].waarde : 0);

  const periodeWinstPct = (() => {
    if (tijdperk === '1D') return beursOpenPortfolio ? dagWinstPct1D : 0;
    if (tijdperk !== 'YTD') {
      return grafiekData.length > 1 && grafiekData[0].waarde > 0
        ? (periodeWinst / grafiekData[0].waarde) * 100
        : 0;
    }
    // YTD: TWR berekening die de filter (inclusief/exclusief verkochte effecten) respecteert
    const nuJaar = new Date().getFullYear();
    const eersteJan = new Date(`${nuJaar}-01-01`);
    let gewogenTeller = 0, gewogenNoemer = 0;

    // Actieve beleggingen (gefilterd op type/symbolen)
    beleggingVoorGrafiek.forEach(b => {
      const koers = koersen[b.symbol];
      const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
      const prijsNu = koers ? koers.c : b.kostprijs;
      const aankoopDatum = b.datum ? new Date(b.datum) : null;
      const waardeNu = prijsNu * b.aantal * factor;
      let rendement = 0;
      if (aankoopDatum && aankoopDatum <= eersteJan) {
        const cached = (() => { try { const c = localStorage.getItem(`matico_ytd_${b.symbol}_${nuJaar}`); return c ? parseFloat(c) : null; } catch { return null; } })();
        const prijsStart = cached && cached > 0 ? cached : b.kostprijs;
        rendement = prijsStart > 0 ? (prijsNu - prijsStart) / prijsStart : 0;
      } else {
        rendement = b.kostprijs > 0 ? (prijsNu - b.kostprijs) / b.kostprijs : 0;
      }
      gewogenTeller += rendement * waardeNu;
      gewogenNoemer += waardeNu;
    });

    // Verkochte effecten (enkel bij "inclusief" filter)
    if (filterBezit !== 'inbezit') {
      (verkochteBeleggingen || []).filter(b => {
        if (filterType !== 'alle' && b.type !== filterType) return false;
        if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return false;
        const vd = (() => { if (!b.verkoopdatum) return null; const d = b.verkoopdatum.split('/'); return d.length === 3 ? new Date(`${d[2]}-${d[1]}-${d[0]}`) : new Date(b.verkoopdatum); })();
        return vd && vd.getFullYear() === nuJaar;
      }).forEach(b => {
        const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
        const aankoopDatum = b.datum ? new Date(b.datum) : null;
        const prijsVerkoop = b.verkoopkoers || b.kostprijs;
        const waardeVerkoop = prijsVerkoop * (b.aantalVerkocht || b.aantal || 1) * factor;
        let rendement = 0;
        if (aankoopDatum && aankoopDatum <= eersteJan) {
          const cached = (() => { try { const c = localStorage.getItem(`matico_ytd_${b.symbol}_${nuJaar}`); return c ? parseFloat(c) : null; } catch { return null; } })();
          const prijsStart = cached && cached > 0 ? cached : b.kostprijs;
          rendement = prijsStart > 0 ? (prijsVerkoop - prijsStart) / prijsStart : 0;
        } else {
          rendement = b.kostprijs > 0 ? (prijsVerkoop - b.kostprijs) / b.kostprijs : 0;
        }
        gewogenTeller += rendement * waardeVerkoop;
        gewogenNoemer += waardeVerkoop;
      });
    }

    return gewogenNoemer > 0 ? (gewogenTeller / gewogenNoemer) * 100 : 0;
  })();
  const periodeTekst = tijdperk === '1D' ? 'Prestatie vandaag' : tijdperk === '1W' ? 'Prestatie deze week' : tijdperk === '1M' ? 'Prestatie deze maand' : tijdperk === '1J' ? 'Prestatie dit jaar' : tijdperk === 'YTD' ? 'Prestatie dit kalenderjaar' : tijdperk === 'Laatste' ? 'Prestatie sinds laatste aankoop' : 'Prestatie sinds eerste aankoop';
  const beursGesloten1D = tijdperk === '1D' && !beursOpenPortfolio;
  // Als beurs gesloten: forceer platte displayData zodat grafiek recht is
  const displayDataEff = beursGesloten1D && displayData.length > 0
    ? displayData.map(d => ({ ...d, waarde: displayData[0].waarde }))
    : displayData;
  const grafiekKleur = beursGesloten1D
    ? '#94a3b8'
    : displayData.length > 1 && displayData[displayData.length-1]?.waarde >= displayData[0]?.waarde ? '#6366f1' : '#ef4444';

  // Y-as domein: altijd strak rond de data, nooit vanaf 0
  // Y-as: nette gehele getallen, vaste stapgrootte, Totaal start bij 0
  const { yDomain, yTicks } = (() => {
    if (displayData.length < 2) return { yDomain: ['auto', 'auto'], yTicks: undefined };
    const min = Math.min(...displayData.map(d => d.waarde));
    const max = Math.max(...displayData.map(d => d.waarde));
    const bodem = tijdperk === 'Totaal' ? 0 : min;
    const bereik = max - bodem;
    if (bereik === 0) return { yDomain: [0, max * 1.2], yTicks: undefined };
    // Kies een nette stapgrootte: 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, ...
    const doelTicks = 5;
    const ruwStap = bereik / doelTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(ruwStap)));
    const genormaliseerd = ruwStap / magnitude;
    const niceStap = genormaliseerd < 1.5 ? 1 * magnitude
      : genormaliseerd < 3.5 ? 2 * magnitude
      : genormaliseerd < 7.5 ? 5 * magnitude
      : 10 * magnitude;
    // Snap min/max naar veelvouden van de stapgrootte
    const axisMin = tijdperk === 'Totaal' ? 0 : Math.floor(bodem / niceStap) * niceStap;
    const axisMax = Math.ceil(max / niceStap) * niceStap;
    // Genereer tick-waarden
    const ticks = [];
    for (let t = axisMin; t <= axisMax + niceStap * 0.01; t += niceStap) {
      ticks.push(Math.round(t));
    }
    return { yDomain: [axisMin, axisMax], yTicks: ticks };
  })();

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>{begroeting()}, {gebruiker.voornaam}</h1>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button className="btn btn-primary" onClick={() => setToevoegenMenuOpen(!toevoegenMenuOpen)}>
            <Plus size={16} /> Beleggingen toevoegen <ChevronDown size={14} />
          </button>
          {toevoegenMenuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'white', border: '1px solid var(--border)', borderRadius: 10,
              boxShadow: 'var(--shadow-md)', zIndex: 20, minWidth: 180, overflow: 'hidden'
            }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', fontSize: 14 }}
                onClick={() => { setToevoegenMenuOpen(false); onToevoegen(); }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Edit3 size={15} color="var(--text-muted)" /> Manueel
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', fontSize: 14, borderTop: '1px solid var(--border-light)' }}
                onClick={() => { setToevoegenMenuOpen(false); onImporteren && onImporteren(); }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Upload size={15} color="var(--text-muted)" /> Importeer
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 32px', marginBottom: 24 }}>
        <div className="time-tabs" style={{ display: 'inline-flex' }}>
          {TIJDPERKEN.map(t => (
            <button key={t} className={`time-tab ${tijdperk === t ? 'active' : ''}`} onClick={() => setTijdperk(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 32px' }}>
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="overzicht-portfolio-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Portfolio</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{periodeTekst}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <div className="portfolio-waarde">
                  €{gefilterdeTotaalWaarde.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {(tijdperk === '1D' && !beursOpenPortfolio) ? (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '3px 10px', background: 'var(--bg)', borderRadius: 6, fontWeight: 500 }}>
                    — Beurs gesloten
                  </span>
                ) : (
                  <span className={`badge ${periodeWinstPct >= 0 ? 'badge-green' : 'badge-red'}`}>
                    {periodeWinstPct >= 0 ? '▲' : '▼'} {Math.abs(periodeWinstPct).toFixed(2)}% ({periodeWinst >= 0 ? '+' : ''}€{Math.abs(periodeWinst).toFixed(2)})
                  </span>
                )}
              </div>
            </div>
            <div className="overzicht-portfolio-actions" style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => setVergelijkOpen(true)}>
                <GitCompare size={15} /> Vergelijk
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => setFilterOpen(true)}>
                <SlidersHorizontal size={15} /> Filter
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 12 }}>
            {['waarde', 'winst/verlies'].map(w => (
              <button key={w} onClick={() => setWeergave(w)} style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: weergave === w ? 'var(--text-primary)' : 'transparent',
                color: weergave === w ? 'white' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize'
              }}>
                {w.charAt(0).toUpperCase() + w.slice(1)}
              </button>
            ))}
          </div>

          {beleggingen.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <p>Voeg beleggingen toe om je portfolio te zien</p>
            </div>
          ) : grafiekLoading ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 13 }}>Grafiek laden...</span>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {beursGesloten1D && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'rgba(255,255,255,0.9)', borderRadius: 8,
                  padding: '6px 14px', fontSize: 12, color: 'var(--text-muted)',
                  fontWeight: 600, pointerEvents: 'none', zIndex: 5,
                  border: '1px solid var(--border)', whiteSpace: 'nowrap'
                }}>
                  🔒 Beurs gesloten
                </div>
              )}
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={displayDataEff} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={grafiekKleur} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={grafiekKleur} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} ticks={xTicks} tickFormatter={xTickFormatter} interval={0} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => '€' + Math.round(v).toLocaleString('nl-BE')}
                  domain={yDomain} ticks={yTicks} width={45}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const datum = payload[0]?.payload?.datum;
                    const waarde = payload[0]?.value;
                    const puntD = datum ? new Date(datum) : null;
                    const beginPeriodeT = displayData.length > 0 && displayData[0].datum ? new Date(displayData[0].datum) : null;

                    // Aankopen: actieve + (als niet inbezit-filter) verkochte beleggingen
                    const alleAankopen = [
                      ...beleggingVoorGrafiek,
                      ...(filterBezit === 'inbezit' ? [] : (verkochteBeleggingen || []).filter(b => {
                        if (filterType !== 'alle' && b.type !== filterType) return false;
                        if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return false;
                        return true;
                      }).map(b => ({ ...b, aantal: b.aantalVerkocht })))
                    ];
                    const aankopenOpDatum = alleAankopen.filter(b => {
                      if (!b.datum || !puntD) return false;
                      const aankoopD = new Date(b.datum);
                      // Bij Totaal/Laatste: beginPeriode IS de aankoopdatum, dus niet filteren
                      const filterOpBegin = tijdperk !== 'Totaal' && tijdperk !== 'Laatste';
                      if (filterOpBegin && beginPeriodeT && aankoopD < beginPeriodeT) return false;
                      const verschilDit = Math.abs(puntD - aankoopD);
                      const dichtstbij = displayData.reduce((best, p) => {
                        if (!p.datum) return best;
                        const v = Math.abs(new Date(p.datum) - aankoopD);
                        return v < best ? v : best;
                      }, Infinity);
                      return verschilDit === dichtstbij;
                    });

                    const verkopenOpDatum = (verkochteBeleggingen || []).filter(b => {
                      if (!b.verkoopdatum || !puntD) return false;
                      const delen = b.verkoopdatum.split('/');
                      const verkoopD = delen.length === 3
                        ? new Date(`${delen[2]}-${delen[1]}-${delen[0]}`)
                        : new Date(b.verkoopdatum);
                      if (isNaN(verkoopD)) return false;
                      if (beginPeriodeT && verkoopD < beginPeriodeT) return false;
                      const verschilDit = Math.abs(puntD - verkoopD);
                      const dichtstbij = displayData.reduce((best, p) => {
                        if (!p.datum) return best;
                        const v = Math.abs(new Date(p.datum) - verkoopD);
                        return v < best ? v : best;
                      }, Infinity);
                      return verschilDit === dichtstbij;
                    });

                    const heeftEvents = aankopenOpDatum.length > 0 || verkopenOpDatum.length > 0;
                    return (
                      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, boxShadow: 'var(--shadow-md)' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 12 }}>{label}</div>
                        <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: heeftEvents ? 8 : 0 }}>
                          Portfolio : €{(waarde || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {aankopenOpDatum.map((b, i) => (
                          <div key={b.id + i} style={{ fontSize: 12, color: 'var(--green)', borderTop: '1px solid var(--border-light)', paddingTop: 6, marginTop: 2 }}>
                            🟢 Aankoop {b.naam} — {b.aantal} st. à {b.munt === 'USD' ? '$' : '€'}{b.kostprijs.toFixed(2)}
                          </div>
                        ))}
                        {verkopenOpDatum.map((b, i) => {
                          const ms = (b.verkoopMunt || b.munt || 'EUR') === 'USD' ? '$' : '€';
                          const wv = b.winstverlies || 0;
                          return (
                            <div key={b.id + i} style={{ fontSize: 12, color: '#ef4444', borderTop: '1px solid var(--border-light)', paddingTop: 6, marginTop: 2 }}>
                              🔴 Verkoop {b.naam} — {b.aantalVerkocht} st. à {ms}{b.verkoopkoers?.toFixed(2)}
                              {' '}
                              <span style={{ color: wv >= 0 ? 'var(--green)' : '#ef4444', fontWeight: 600 }}>
                                ({wv >= 0 ? '+' : ''}{ms}{Math.abs(wv).toFixed(2)})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="waarde" stroke={grafiekKleur} strokeWidth={2} fill="url(#portfolioGrad)" dot={(props) => {
                    const { cx, cy, payload, index } = props;
                    if (!payload || !payload.datum) return <g key={index}></g>;
                    const puntDatum = new Date(payload.datum);
                    const beginPeriode = displayData.length > 0 && displayData[0].datum ? new Date(displayData[0].datum) : null;

                    // Check aankoop dot — actieve + (als niet inbezit-filter) verkochte beleggingen
                    const alleAankoopDots = [
                      ...beleggingVoorGrafiek,
                      ...(filterBezit === 'inbezit' ? [] : (verkochteBeleggingen || []).filter(b => {
                        if (filterType !== 'alle' && b.type !== filterType) return false;
                        if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return false;
                        return true;
                      }))
                    ];
                    const isAankoop = alleAankoopDots.some(b => {
                      if (!b.datum) return false;
                      const aankoopD = new Date(b.datum);
                      // Bij Totaal/Laatste: beginPeriode IS de aankoopdatum, dus niet filteren
                      const filterOpBP = tijdperk !== 'Totaal' && tijdperk !== 'Laatste';
                      if (filterOpBP && beginPeriode && aankoopD < beginPeriode) return false;
                      const verschilDit = Math.abs(puntDatum - aankoopD);
                      const dichtstbij = displayData.reduce((best, p) => {
                        if (!p.datum) return best;
                        const v = Math.abs(new Date(p.datum) - aankoopD);
                        return v < best ? v : best;
                      }, Infinity);
                      return verschilDit === dichtstbij;
                    });

                    // Check verkoop dot (niet tonen bij inbezit-filter)
                    const isVerkoop = filterBezit !== 'inbezit' && (verkochteBeleggingen || []).some(b => {
                      if (!b.verkoopdatum) return false;
                      // Converteer dd/mm/yyyy naar datum
                      const delen = b.verkoopdatum.split('/');
                      const verkoopD = delen.length === 3
                        ? new Date(`${delen[2]}-${delen[1]}-${delen[0]}`)
                        : new Date(b.verkoopdatum);
                      if (isNaN(verkoopD)) return false;
                      if (beginPeriode && verkoopD < beginPeriode) return false;
                      const verschilDit = Math.abs(puntDatum - verkoopD);
                      const dichtstbij = displayData.reduce((best, p) => {
                        if (!p.datum) return best;
                        const v = Math.abs(new Date(p.datum) - verkoopD);
                        return v < best ? v : best;
                      }, Infinity);
                      return verschilDit === dichtstbij;
                    });

                    if (isVerkoop) {
                      return <circle key={`dot-${index}`} cx={cx} cy={cy} r={6} fill="white" stroke="#ef4444" strokeWidth={2.5} />;
                    }
                    if (isAankoop) {
                      return <circle key={`dot-${index}`} cx={cx} cy={cy} r={6} fill="white" stroke={grafiekKleur} strokeWidth={2.5} />;
                    }
                    return <g key={index}></g>;
                  }}
                  activeDot={{ r: 5, fill: grafiekKleur }} />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {beleggingen.length > 0 && (
          <div className="card">
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Beleggingen</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Automatisch opgevolgd door Matico</div>
            </div>
            <div className="tabel-header belegging-grid" style={{ marginTop: 16 }}>
              {[['naam','Naam'],['koers','Koers'],['waarde','Huidige waarde'],['vandaag','Winst/verlies vandaag'],['totaal','Winst/verlies totaal'],['gewicht','Gewicht']].map(([col, label]) => (
                <span key={col} onClick={() => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc'); } }}
                  style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {label}
                  <span style={{ fontSize: 10, color: sortCol === col ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700 }}>
                    {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↑↓'}
                  </span>
                </span>
              ))}
            </div>
            {gefilterdeBeleggingen.map(b => {
              const koers = koersen[b.symbol];
              const huidigePrijs = koers ? koers.c : b.kostprijs;
              const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
              const huidigeWaarde = huidigePrijs * b.aantal * factor;
              const kostprijs = b.kostprijs * b.aantal * factor;
              const winstTotaal = huidigeWaarde - kostprijs;
              const winstTotaalPct = kostprijs > 0 ? (winstTotaal / kostprijs) * 100 : 0;
              const beursOpen = isBeursOpen(b.munt || 'EUR');
              const dagVRaw = koers ? (koers.c - koers.pc) * b.aantal * factor : 0;
              const dagVPctRaw = koers && koers.pc > 0 ? ((koers.c - koers.pc) / koers.pc) * 100 : 0;
              const dagV = beursOpen ? dagVRaw : 0;
              const dagVPct = beursOpen ? dagVPctRaw : 0;
              const portfolioTotaal = beleggingen.reduce((s, bb) => {
                const k = koersen[bb.symbol]; const p = k ? k.c : bb.kostprijs;
                const f = getMuntFactor ? getMuntFactor(bb.munt || 'EUR') : ((bb.munt || 'EUR') === 'USD' ? 0.865 : 1);
                return s + p * bb.aantal * f;
              }, 0);
              const gewicht = portfolioTotaal > 0 ? (huidigeWaarde / portfolioTotaal) * 100 : 0;
              const muntSym = (b.munt || 'EUR') === 'USD' ? '$' : '€';

              return (
                <div key={b.id} className="tabel-rij belegging-grid" onClick={() => setDetailBelegging(b)}>
                  <div className="belegging-naam">
                    {b.logo
                      ? <img src={b.logo} alt={b.symbol} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'contain', border: '1px solid var(--border)', background: 'white', padding: 2 }} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                      : null}
                    <div className="belegging-avatar" style={{ display: b.logo ? 'none' : 'flex' }}>{b.symbol.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div className="belegging-naam-text">{b.naam}</div>
                      <div className="belegging-symbol">{b.symbol} · {b.aantal} st.</div>
                    </div>
                  </div>
                  <div className="koers-display"><span className="mobile-stat-label">Koers</span>{muntSym}{huidigePrijs.toFixed(2)}</div>
                  <div className="koers-display"><span className="mobile-stat-label">Waarde</span>€{huidigeWaarde.toFixed(2)}</div>
                  <div>
                    <span className="mobile-stat-label">Vandaag</span>
                    {beursOpen ? (
                      <>
                        <span className={`mobile-hide-amount ${dagVPctRaw >= 0 ? 'pct-pos' : 'pct-neg'}`}>{dagVRaw >= 0 ? '+' : ''}€{Math.abs(dagVRaw).toFixed(2)}</span>
                        {' '}<span className={`badge ${dagVPctRaw >= 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11, padding: '2px 6px' }}>
                          {dagVPctRaw >= 0 ? '+' : ''}{dagVPctRaw.toFixed(2)}%
                        </span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </div>
                  <div>
                    <span className="mobile-stat-label">Totaal</span>
                    <span className={`mobile-hide-amount ${winstTotaal >= 0 ? 'pct-pos' : 'pct-neg'}`}>{winstTotaal >= 0 ? '+' : ''}€{Math.abs(winstTotaal).toFixed(2)}</span>
                    {' '}<span className={`badge ${winstTotaalPct >= 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11, padding: '2px 6px' }}>
                      {winstTotaalPct >= 0 ? '+' : ''}{winstTotaalPct.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{gewicht.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {filterOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 49 }} onClick={() => setFilterOpen(false)} />
          <div className="filter-panel">
            <div className="modal-header">
              <h2>Filter</h2>
              <button className="modal-close" onClick={() => setFilterOpen(false)}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div className="filter-section">
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent)' }}
                  onClick={() => { setFilterType('alle'); setFilterSymbolen([]); setFilterBezit('alles'); }}>Wis alle filters</button>
              </div>
              <div className="filter-section">
                <h3>Type belegging</h3>
                {['alle', 'aandeel', 'etf', 'crypto'].map(t => (
                  <label key={t} className="filter-option">
                    <input type="radio" checked={filterType === t} onChange={() => setFilterType(t)} />
                    {t === 'alle' ? 'Alle types' : t.charAt(0).toUpperCase() + t.slice(1) + (t === 'etf' ? 's' : 'en')}
                  </label>
                ))}
              </div>
              <div className="filter-section">
                <h3>Beleggingen</h3>
                {beleggingen.map(b => (
                  <label key={b.symbol} className="filter-option">
                    <input type="checkbox"
                      checked={filterSymbolen.length === 0 || filterSymbolen.includes(b.symbol)}
                      onChange={e => {
                        if (e.target.checked) setFilterSymbolen(prev => prev.filter(s => s !== b.symbol));
                        else setFilterSymbolen(prev => [...(prev.length === 0 ? beleggingen.map(bb => bb.symbol) : prev)].filter(s => s !== b.symbol));
                      }} />
                    {b.symbol}
                  </label>
                ))}
              </div>
              <div className="filter-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                <h3>Weergave</h3>
                <label className="filter-option">
                  <input type="radio" checked={filterBezit === 'alles'} onChange={() => setFilterBezit('alles')} />
                  Alles (incl. verkochte effecten)
                </label>
                <label className="filter-option">
                  <input type="radio" checked={filterBezit === 'inbezit'} onChange={() => setFilterBezit('inbezit')} />
                  Enkel effecten in bezit
                </label>
              </div>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setFilterOpen(false)}>Annuleren</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setFilterOpen(false)}>Toepassen</button>
            </div>
          </div>
        </>
      )}

      {vergelijkOpen && (
        <VergelijkModal
          onClose={() => setVergelijkOpen(false)}
          vergelijk1={vergelijk1} setVergelijk1={setVergelijk1}
          vergelijk2={vergelijk2} setVergelijk2={setVergelijk2}
          portfolioData={winstData} tijdperk={tijdperk} setTijdperk={setTijdperk}
        />
      )}

      {detailBelegging && (
        <BeleggingDetail belegging={detailBelegging} onClose={() => setDetailBelegging(null)} />
      )}
    </div>
  );
}

function VergelijkModal({ onClose, vergelijk1, setVergelijk1, vergelijk2, setVergelijk2, portfolioData, tijdperk, setTijdperk }) {
  const data = portfolioData.map((d, i) => ({
    ...d,
    benchmark1: vergelijk1 !== 'geen' ? (Math.random() - 0.51) * 0.3 * i : undefined,
    benchmark2: vergelijk2 !== 'geen' ? (Math.random() - 0.49) * 0.25 * i : undefined,
  }));
  const opt1 = VERGELIJK_OPTIES.find(o => o.id === vergelijk1);
  const opt2 = VERGELIJK_OPTIES.find(o => o.id === vergelijk2);

  return (
    <div className="vergelijk-modal" onClick={onClose}>
      <div className="vergelijk-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Prestatievergelijking</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Vergelijk de prestatie van je portfolio met benchmarks</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--accent-bg)', borderRadius: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Je portfolio</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>vs</span>
            <VergelijkSelector value={vergelijk1} onChange={setVergelijk1} />
            <span style={{ color: 'var(--text-muted)' }}>vs</span>
            <VergelijkSelector value={vergelijk2} onChange={setVergelijk2} />
            <div style={{ marginLeft: 'auto' }}>
              <div className="time-tabs" style={{ display: 'inline-flex' }}>
                {['1W', '1M', '1J', 'YTD', 'Laatste', 'Totaal'].map(t => (
                  <button key={t} className={`time-tab ${tijdperk === t ? 'active' : ''}`} onClick={() => setTijdperk(t)} style={{ fontSize: 12 }}>{t}</button>
                ))}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1) + '%'} />
              <Tooltip formatter={v => v.toFixed(2) + '%'} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
              <Line type="monotone" dataKey="waarde" stroke="#6366f1" strokeWidth={2} dot={false} name="Portfolio" />
              {vergelijk1 !== 'geen' && <Line type="monotone" dataKey="benchmark1" stroke={opt1?.kleur} strokeWidth={2} dot={false} name={opt1?.label} />}
              {vergelijk2 !== 'geen' && <Line type="monotone" dataKey="benchmark2" stroke={opt2?.kleur} strokeWidth={2} dot={false} strokeDasharray="5 5" name={opt2?.label} />}
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function VergelijkSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const geselecteerd = VERGELIJK_OPTIES.find(o => o.id === value);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
        cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit'
      }}>
        {geselecteerd?.kleur && <span style={{ width: 10, height: 10, borderRadius: '50%', background: geselecteerd.kleur, display: 'inline-block' }} />}
        {geselecteerd?.label}<ChevronDown size={14} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: 180 }}>
          {VERGELIJK_OPTIES.map(o => (
            <div key={o.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 13,
              background: o.id === value ? 'var(--accent-bg)' : 'transparent'
            }} onClick={() => { onChange(o.id); setOpen(false); }}>
              {o.id === value && <Check size={14} color="var(--accent)" />}
              {o.kleur && <span style={{ width: 10, height: 10, borderRadius: '50%', background: o.kleur, display: 'inline-block', marginLeft: o.id === value ? 0 : 18 }} />}
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
