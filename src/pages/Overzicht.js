import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEffectLogo, logoStijl } from '../components/EffectLogo';
import { koers as koersFmt } from '../utils/getal';
import { muntSymbool } from '../utils/munt';
import { useApp } from '../context/AppContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, ReferenceLine, ReferenceArea } from 'recharts';
import { SlidersHorizontal, GitCompare, Plus, ChevronDown, X, Check, Upload, Edit3 } from 'lucide-react';
import SidebarToggleKnop from '../components/SidebarToggleKnop';
import BeleggingDetail from '../components/BeleggingDetail';

import { getal } from '../utils/getal';
import { handeldeVandaag, leesDatum } from '../utils/handelsdag';
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

// Startdatum van 1W/1M/1J — dezelfde als in AppContext (periodeKoersen) en
// in de grafiek, zodat cijfers en grafiek over dezelfde periode gaan.
function periodeStart(tijdperk) {
  const nu = new Date();
  if (tijdperk === '1W') return new Date(nu - 7 * 86400000);
  if (tijdperk === '1M') return new Date(nu.getFullYear(), nu.getMonth() - 1, nu.getDate());
  if (tijdperk === '1J') return new Date(nu.getFullYear() - 1, nu.getMonth(), nu.getDate());
  return null;
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
  const nu = new Date();
  if (tijdperk === '1W') { const d = new Date(nu); d.setDate(d.getDate() - 7); return d; }
  if (tijdperk === '1M') { const d = new Date(nu); d.setMonth(d.getMonth() - 1); return d; }
  if (tijdperk === 'YTD') { return new Date(nu.getFullYear(), 0, 1); }
  if (tijdperk === '1J') { const d = new Date(nu); d.setFullYear(d.getFullYear() - 1); return d; }
  if (tijdperk === '3J') { const d = new Date(nu); d.setFullYear(d.getFullYear() - 3); return d; }
  if (tijdperk === '5J') { const d = new Date(nu); d.setFullYear(d.getFullYear() - 5); return d; }
  return null; // Max: vroegste beschikbare data, geen ondergrens nodig
}

// ETF uitgever mapping
const ETF_UITGEVERS = [
  { match: ['ishares','blackrock','ish '], label: 'iSH', kleur: '#00b140' },
  { match: ['vanguard','vang ftse','vang ','vang.'], label: 'VG', kleur: '#c8102e' },
  { match: ['amundi','lyx ','lyxor'], label: 'AM', kleur: '#0066cc' },
  { match: ['xtrackers','dws','xtr '], label: 'XT', kleur: '#003c88' },
  { match: ['invesco','inv '], label: 'IV', kleur: '#00205b' },
  { match: ['spdr','state street'], label: 'SPD', kleur: '#00a651' },
  { match: ['wisdomtree'], label: 'WT', kleur: '#f7941d' },
  { match: ['vaneck','van eck'], label: 'VE', kleur: '#003087' },
  { match: ['ubs'], label: 'UBS', kleur: '#e3000f' },
  { match: ['pimco'], label: 'PM', kleur: '#00205b' },
  { match: ['franklin','templeton'], label: 'FT', kleur: '#2e5eaa' },
  { match: ['fidelity'], label: 'FID', kleur: '#008a00' },
  { match: ['hsbc'], label: 'HSB', kleur: '#db0011' },
  { match: ['jpmorgan','jpm '], label: 'JPM', kleur: '#003087' },
];
const TICKER_ETF_MAP = {
  'VWCE': 'VG','VFEM': 'VG','VUSA': 'VG','VEUR': 'VG','VHYL': 'VG','VWRL': 'VG',
  'IWDA': 'iSH','CSPX': 'iSH','EIMI': 'iSH','IEMA': 'iSH','IUSA': 'iSH','ISAC': 'iSH',
  'SWRD': 'iSH','SPPW': 'iSH','EXSA': 'iSH',
  'XDWD': 'XT','XMAW': 'XT','XNAS': 'XT',
  'AMUN': 'AM',
};
const TICKER_KLEUREN = {
  'VG': '#c8102e','iSH': '#00b140','AM': '#0066cc','XT': '#003c88',
  'IV': '#00205b','SPD': '#00a651','WT': '#f7941d','VE': '#003087',
  'UBS': '#e3000f','PM': '#00205b','FT': '#2e5eaa','FID': '#008a00',
  'HSB': '#db0011','JPM': '#003087',
};
const CRYPTO_KLEUREN = {
  'BTC':'#f7931a','ETH':'#627eea','SOL':'#9945ff','XRP':'#00aae4',
  'ADA':'#0033ad','DOT':'#e6007a','DOGE':'#c2a633','AVAX':'#e84142',
  'LINK':'#2a5ada','MATIC':'#8247e5','SHIB':'#f00500','TON':'#0088cc',
  'BNB':'#f3ba2f','NEAR':'#00c08b','OP':'#ff0420','ARB':'#12aaff',
};

function BeleggingAvatar({ b }) {
  // Logo uit meerdere bronnen (zie components/EffectLogo.js)
  const { src, onError, rond, donker } = useEffectLogo(b);
  if (src) {
    return (
      <img src={src} alt={b.symbol}
        style={logoStijl(36, rond ? '50%' : 10, donker)}
        onError={onError} />
    );
  }
  const naamLower = (b.naam || b.symbol || '').toLowerCase();
  const symBase = (b.symbol || '').replace(/-EUR$|-USD$|-GBP$|-USDT$/,'').toUpperCase();
  const tickerBase = symBase.split('.')[0];

  // Crypto
  if (b.type === 'crypto' || symBase.match(/-EUR$|-USD$/)) {
    const kleur = CRYPTO_KLEUREN[symBase] || '#f7931a';
    return <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: kleur, color: 'white', fontWeight: 800, fontSize: 10 }}>{symBase.slice(0,3)}</div>;
  }

  // ETF via ticker
  const tickerLabel = TICKER_ETF_MAP[tickerBase];
  if (tickerLabel) {
    return <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: TICKER_KLEUREN[tickerLabel] || '#1e3a8a', color: 'white', fontWeight: 800, fontSize: 10 }}>{tickerLabel}</div>;
  }

  // ETF via naam
  if (b.type === 'etf') {
    const uitgever = ETF_UITGEVERS.find(u => u.match.some(m => naamLower.includes(m)));
    if (uitgever) return <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: uitgever.kleur, color: 'white', fontWeight: 800, fontSize: 10 }}>{uitgever.label}</div>;
    return <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e3a8a', color: 'white', fontWeight: 800, fontSize: 9 }}>ETF</div>;
  }

  // Aandeel fallback
  return <div className="belegging-avatar" style={{ flexShrink: 0 }}>{(b.symbol || '').slice(0,2).toUpperCase()}</div>;
}


export default function Overzicht({ onToevoegen, onImporteren, sidebarCollapsed, onToggleSidebar }) {
  const { gebruiker, beleggingen, koersen, refreshAlleKoersen, portfolioWaarde, portfolioWinstPct, portfolioWinstPctInclVerkocht, portfolioWinstVerlies, portfolioWinstVerliesInclVerkocht, dagWinst, dagWinstPct, getMuntFactor, fxOp, kostEur, verkoopEur, fxVersie, dividendUitkeringen, portfolioKostprijs, verkochteBeleggingen, ytdPct, ytdPctInclVerkocht, periodeKoersen, ytdKoersen, t } = useApp();

  // ── Schermbreedte bijhouden ──────────────────────────────────────────────
  // Nodig om bv. het aantal tijd-labels onder de grafiek af te stemmen op
  // de effectief beschikbare ruimte (op mobiel passen er veel minder dan
  // op een breed scherm, anders overlappen ze).
  const [breedte, setBreedte] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  useEffect(() => {
    const onResize = () => setBreedte(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isMobielScherm = breedte < 768;

  // ── Trek-om-te-verversen (pull-to-refresh), enkel op mobiel ──────────────
  const [pullAfstand, setPullAfstand] = useState(0);
  const [ververst, setVerverst] = useState(false);
  const pullStartY = useRef(null);
  const PULL_DREMPEL = 70;

  const onPullStart = (e) => {
    if (!isMobielScherm || ververst) return;
    const scrollEl = document.querySelector('.app-main');
    if (scrollEl && scrollEl.scrollTop > 0) return; // enkel bovenaan de pagina
    pullStartY.current = e.touches[0].clientY;
  };
  const onPullMove = (e) => {
    if (pullStartY.current == null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) setPullAfstand(Math.min(delta * 0.5, 90)); // met weerstand, max. 90px
  };
  const onPullEnd = async () => {
    if (pullStartY.current == null) return;
    pullStartY.current = null;
    if (pullAfstand >= PULL_DREMPEL) {
      setVerverst(true);
      setPullAfstand(PULL_DREMPEL);
      try { await refreshAlleKoersen(); } catch (e) {}
      setVerverst(false);
    }
    setPullAfstand(0);
  };

  // ── Swipe op een belegging-rij → onthult een "Verkopen"-snelknop ────────
  const SWIPE_ACTIE_BREEDTE = 84;
  const [swipeRowId, setSwipeRowId] = useState(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartXRef = useRef(null);
  const swipeBezigRef = useRef(false); // onderscheidt een swipe van een gewone tik

  const onRijTouchStart = (id, e) => {
    if (!isMobielScherm) return;
    if (swipeRowId && swipeRowId !== id) { setSwipeRowId(null); setSwipeX(0); }
    swipeStartXRef.current = e.touches[0].clientX;
    swipeBezigRef.current = false;
    setSwipeRowId(id);
  };
  const onRijTouchMove = (id, e) => {
    if (swipeStartXRef.current == null || swipeRowId !== id) return;
    const delta = e.touches[0].clientX - swipeStartXRef.current;
    if (Math.abs(delta) > 8) swipeBezigRef.current = true;
    const nieuweX = Math.max(-SWIPE_ACTIE_BREEDTE - 20, Math.min(0, delta));
    setSwipeX(nieuweX);
  };
  const onRijTouchEnd = (id) => {
    if (swipeRowId !== id) return;
    swipeStartXRef.current = null;
    if (swipeX <= -SWIPE_ACTIE_BREEDTE / 2) {
      setSwipeX(-SWIPE_ACTIE_BREEDTE);
    } else {
      setSwipeX(0);
      setSwipeRowId(null);
    }
  };
  const onRijKlik = (b) => {
    // Een swipe mag niet ook als tik gelden; en als de rij al open staat,
    // sluit een volgende tik hem eerst weer i.p.v. meteen het detail te openen.
    if (swipeBezigRef.current) { swipeBezigRef.current = false; return; }
    if (swipeRowId === b.id && swipeX !== 0) { setSwipeRowId(null); setSwipeX(0); return; }
    setDetailBelegging(b);
  };

  // ── Grafiek: indrukken en slepen om 2 momenten te vergelijken ───────────
  // Druk in op een punt, sleep naar een later (of vroeger) moment, en zie
  // ondertussen het verschil tussen die twee punten (in € en %). Loslaten
  // zet de grafiek terug naar normaal (gewone tik-tooltip per punt).
  const [sleepStart, setSleepStart] = useState(null); // { tijd, waarde }
  const [sleepEind, setSleepEind] = useState(null);
  const [aanHetSlepen, setAanHetSlepen] = useState(false);

  const grafiekSleepStart = (e) => {
    if (!e || e.activeLabel == null) return;
    const waarde = e.activePayload?.[0]?.value;
    if (waarde == null) return;
    setSleepStart({ tijd: e.activeLabel, waarde });
    setSleepEind({ tijd: e.activeLabel, waarde });
    setAanHetSlepen(true);
  };
  const grafiekSleepBeweeg = (e) => {
    if (!aanHetSlepen || !e || e.activeLabel == null) return;
    const waarde = e.activePayload?.[0]?.value;
    if (waarde == null) return;
    setSleepEind({ tijd: e.activeLabel, waarde });
  };
  const grafiekSleepEinde = () => {
    setAanHetSlepen(false);
    setSleepStart(null);
    setSleepEind(null);
  };

  // ── Check of dagpercentage getoond mag worden ──
  // Toon percentage als: beurs open OF beurs was vandaag open (tot middernacht)
  // Toon NIET als: weekend, feestdag of nieuwe dag zonder handel. We kijken
  // naar het tijdstip van de koers zelf, niet naar de klok (zie handelsdag.js).
  const isBeursOpen = (b) => handeldeVandaag(koersen[b.symbol], b.type, b.munt);
  const [tijdperk, setTijdperk] = useState('1D');
  // Elke 5 minuten een nieuwe "tick" zodat de 1D-grafiek vers blijft terwijl
  // iemand het scherm open laat staan — zonder dit bleef de intraday-lijn
  // precies op de koersen van het moment van laden staan, de rest van de dag.
  const [grafiekTick, setGrafiekTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setGrafiekTick(t => t + 1), 5 * 60000);
    return () => clearInterval(interval);
  }, []);
  const [weergave, setWeergave] = useState('waarde');
  // Ontvangen dividenden meetellen in winst en rendement (standaard aan)
  const [inclDividend, setInclDividend] = useState(() => {
    try { return localStorage.getItem('kapitas_incl_dividend') !== 'nee'; } catch (e) { return true; }
  });
  useEffect(() => { try { localStorage.setItem('kapitas_incl_dividend', inclDividend ? 'ja' : 'nee'); } catch (e) {} }, [inclDividend]);
  const [grafiekData, setGrafiekData] = useState([]);
  const [portfolioVorigeSlot, setPortfolioVorigeSlot] = useState(null);
  const [grafiekLoading, setGrafiekLoading] = useState(false);
  const [vergelijkOpen, setVergelijkOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [vergelijk1, setVergelijk1] = useState('msci');
  const [vergelijk2, setVergelijk2] = useState('geen');
  const [filterType, setFilterType] = useState('alle');
  const [filterSymbolen, setFilterSymbolen] = useState([]);
  const [filterBezit, setFilterBezit] = useState('inbezit'); // 'alles' | 'inbezit'
  const [detailBelegging, setDetailBelegging] = useState(null);
  // Sortering van de "Beleggingen"-lijst: standaard oudste-naar-nieuwste
  // (op aankoopdatum), maar zodra je zelf op een kolom klikt, onthouden we
  // die keuze — ze blijft staan tot je ze zelf weer wijzigt, ook na het
  // herladen van de pagina of opnieuw inloggen.
  const [sortCol, setSortCol] = useState(() => localStorage.getItem('matico_sort_col') || 'datum');
  const [sortDir, setSortDir] = useState(() => localStorage.getItem('matico_sort_dir') || 'asc');
  useEffect(() => {
    localStorage.setItem('matico_sort_col', sortCol);
    localStorage.setItem('matico_sort_dir', sortDir);
  }, [sortCol, sortDir]);
  const [toevoegenMenuOpen, setToevoegenMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const fabMenuRef = useRef(null); // de vaste "+"-knop (mobiel) heeft een eigen dropdown, apart van die in de header

  const begroeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('ov_goedemorgen');
    if (h < 18) return t('ov_goedemiddag');
    return t('ov_goedeavond');
  };

  useEffect(() => {
    const handler = (e) => {
      const inHeaderMenu = menuRef.current && menuRef.current.contains(e.target);
      const inFabMenu = fabMenuRef.current && fabMenuRef.current.contains(e.target);
      if (!inHeaderMenu && !inFabMenu) setToevoegenMenuOpen(false);
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

  // 'koersen' via een ref bijhouden: de grafiek-effect hieronder moet de
  // meest actuele koersen kunnen lezen (bv. als terugval als er geen
  // historische data is), maar mag NIET herstarten telkens koersen
  // verversen — anders wordt bij elke ververs-beurt (om de 3 minuten, of
  // vaker vlak na het laden) de volledige historiek van elk aandeel
  // opnieuw opgehaald, wat nodeloos veel Edge Requests veroorzaakt.
  const koersenRef = useRef(koersen);
  useEffect(() => { koersenRef.current = koersen; }, [koersen]);
  // Historische wisselkoers (zie AppContext.fxOp) — via ref, net als koersen
  const fxOpRef = useRef(fxOp);
  fxOpRef.current = fxOp;

  useEffect(() => {
    const laadGrafiek = async () => {
      if (beleggingVoorGrafiek.length === 0) { setGrafiekData([]); return; }
      setGrafiekLoading(true);

      // 1D: echte intraday-reeks (per minuut), samengevoegd over alle posities
      if (tijdperk === '1D') {
        const intradayData = {};
        const vorigeSlotPerSymbool = {};
        await Promise.all(beleggingVoorGrafiek.map(async (b) => {
          try {
            const res = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(b.symbol)}&tijdperk=1D`);
            const data = await res.json();
            if (data?.punten?.length > 1) intradayData[b.symbol] = data.punten;
            if (data?.vorigeSlot != null) vorigeSlotPerSymbool[b.symbol] = data.vorigeSlot;
          } catch (e) {}
        }));

        // Portfoliowaarde als alle posities nog op hun slotkoers van gisteren
        // stonden — dit vormt de stippellijn "slot vorige dag" in de grafiek.
        let portfolioSlot = 0;
        let portfolioSlotVolledig = true;
        beleggingVoorGrafiek.forEach(b => {
          const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
          const slot = vorigeSlotPerSymbool[b.symbol] ?? koersenRef.current[b.symbol]?.pc;
          if (slot == null) { portfolioSlotVolledig = false; return; }
          portfolioSlot += slot * b.aantal * factor;
        });
        setPortfolioVorigeSlot(portfolioSlotVolledig && beleggingVoorGrafiek.length > 0 ? Math.round(portfolioSlot * 100) / 100 : null);

        // De API geeft enkel nog punten van vandaag terug: heeft niemand
        // punten, dan is er vandaag nog op geen enkele beurs gehandeld.
        const iemandOpen = Object.keys(intradayData).length > 0;

        // Koers van een positie vóór haar eerste punt van vandaag (bv. een
        // Amerikaans aandeel om 11u): de slotkoers van de vorige handelsdag,
        // niet de huidige koers.
        const startKoers = (b) => vorigeSlotPerSymbool[b.symbol] ?? koersenRef.current[b.symbol]?.pc ?? koersenRef.current[b.symbol]?.c ?? b.kostprijs;

        if (Object.keys(intradayData).length > 0) {
          // Combineer de reeksen op WERKELIJK tijdstip, niet op index.
          // Vroeger werd de reeks met de meeste punten als "meester" genomen
          // en werden alle andere symbolen gewoon op positie i ernaast gelegd
          // (reeks[i]). Dat klopt alleen als elk symbool exact hetzelfde
          // aantal punten heeft, op exact dezelfde momenten. In de praktijk
          // heeft Yahoo's minuutdata regelmatig gaten (geen trade in een
          // bepaalde minuut) — vooral bij minder liquide Europese aandelen —
          // waardoor het aantal punten per symbool verschilt. Index i was dan
          // bv. 11u bij het ene aandeel maar 14u bij het andere, en de koers
          // van het verkeerde moment werd meegeteld. Zodra één symbool
          // "achterliep", werd zijn laatste (foute) koers voor de rest van de
          // dag herhaald — dat gaf precies het soort vlakke/vervormde lijn die
          // gerapporteerd werd.
          const tijdVanLabel = (label) => {
            const [u, m] = (label || '0:0').split(':').map(Number);
            return (u || 0) * 60 + (m || 0);
          };
          const alleTijdstippen = new Map(); // minuten-sinds-middernacht -> label
          Object.values(intradayData).forEach(reeks => {
            reeks.forEach(p => alleTijdstippen.set(tijdVanLabel(p.label), p.label));
          });
          const gesorteerdeTijden = Array.from(alleTijdstippen.keys()).sort((a, b) => a - b);

          // Per symbool: gebruik op elk tijdstip zijn eigen koers van dat
          // moment als die bestaat, anders de laatst gekende koers van dat
          // symbool (bv. nadat zijn beurs al gesloten is) — nooit de koers
          // van een ander symbool of een ander tijdstip.
          const laatsteKoersPerSymbool = {};
          const punten = gesorteerdeTijden.map((tMin) => {
            let totaalWaarde = 0;
            beleggingVoorGrafiek.forEach(b => {
              const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
              const reeks = intradayData[b.symbol];
              if (reeks) {
                const exact = reeks.find(p => tijdVanLabel(p.label) === tMin);
                if (exact) laatsteKoersPerSymbool[b.symbol] = exact.prijs;
                const koersNu = laatsteKoersPerSymbool[b.symbol];
                totaalWaarde += (koersNu != null ? koersNu : startKoers(b)) * b.aantal * factor;
              } else {
                const koers = koersenRef.current[b.symbol];
                totaalWaarde += (koers ? koers.c : b.kostprijs) * b.aantal * factor;
              }
            });
            const labelHuidig = alleTijdstippen.get(tMin);
            const tijdHuidig = new Date();
            tijdHuidig.setHours(Math.floor(tMin / 60), tMin % 60, 0, 0);
            return {
              label: labelHuidig,
              datum: new Date().toISOString().split('T')[0],
              tijd: tijdHuidig.getTime(),
              waarde: Math.round(totaalWaarde * 100) / 100,
              gesloten: !iemandOpen,
            };
          });

          setGrafiekData(punten);
          setGrafiekLoading(false);
          return;
        }

        // Vandaag nog nergens gehandeld (vóór 9u, weekend, feestdag): een
        // vlakke grijze lijn op de laatste waarde over het beursvenster —
        // geen "gisteren → nu"-lijn meer, want dit is de grafiek van vandaag.
        let laatsteWaarde = 0;
        beleggingVoorGrafiek.forEach(b => {
          const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
          const k = vorigeSlotPerSymbool[b.symbol] ?? koersenRef.current[b.symbol]?.c ?? b.kostprijs;
          laatsteWaarde += k * b.aantal * factor;
        });
        const opUur = (u) => { const d = new Date(); d.setHours(u, 0, 0, 0); return d.getTime(); };
        const vandaagIso = new Date().toISOString().split('T')[0];
        const w = Math.round(laatsteWaarde * 100) / 100;
        setGrafiekData([
          { label: '09:00', datum: vandaagIso, tijd: opUur(9), waarde: w, gesloten: true },
          { label: '21:50', datum: vandaagIso, tijd: opUur(21) + 50 * 60000, waarde: w, gesloten: true },
        ]);
        setGrafiekLoading(false);
        return;
      }

      // Bepaal API tijdperk
      setPortfolioVorigeSlot(null);
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

      // Zoekt de koers van een positie op (of net vóór) een bepaalde datum in
      // haar eigen candle-reeks — i.p.v. terug te vallen op de rauwe
      // array-index van het referentiepunt, wat verkeerd kan uitpakken als
      // deze reeks ergens een gaatje heeft (bv. een feestdag die enkel op één
      // beurs geldt) en daardoor voor die ene dag de verkeerde koers zou
      // gebruiken (en de dag erna weer "corrigeren").
      const vindPrijsOpDatum = (symbolData, doelDatum) => {
        if (!symbolData || symbolData.length === 0 || !doelDatum) return null;
        let beste = null;
        for (const p of symbolData) {
          if (!p.datum) continue;
          const pd = new Date(p.datum);
          if (pd <= doelDatum && (!beste || pd > new Date(beste.datum))) beste = p;
        }
        if (!beste) beste = symbolData.find(p => p.datum) || symbolData[0];
        return beste ? beste.prijs : null;
      };

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
            const factor = fxOpRef.current(b.munt || 'EUR', puntDatum); // wisselkoers van die dag
            const aankoopDatum = b.datum ? new Date(b.datum) : null;
            if (puntDatum && aankoopDatum && puntDatum < aankoopDatum) return;

            const symbolData = historischeData[b.symbol];
            if (symbolData) {
              const prijs = vindPrijsOpDatum(symbolData, puntDatum);
              if (prijs != null) totaalWaarde += prijs * b.aantal * factor;
            } else {
              const koers = koersenRef.current[b.symbol];
              totaalWaarde += (koers ? koers.c : b.kostprijs) * b.aantal * factor;
            }
          });

          // ── Verkochte beleggingen: tellen mee tussen aankoop- en verkoopdatum ──
          verkochtVoorGrafiek.forEach(b => {
            const factor = fxOpRef.current(b.munt || 'EUR', puntDatum); // wisselkoers van die dag
            const aankoopDatum = b.datum ? new Date(b.datum) : null;
            const verkoopDatum = parseDatum(b.verkoopdatum);

            // Punt valt buiten het venster van deze positie → niet meetellen
            if (puntDatum && aankoopDatum && puntDatum < aankoopDatum) return;
            if (puntDatum && verkoopDatum && puntDatum > verkoopDatum) return;

            const symbolData = historischeData[b.symbol];
            if (symbolData) {
              const prijs = vindPrijsOpDatum(symbolData, puntDatum);
              if (prijs != null) totaalWaarde += prijs * b.aantalVerkocht * factor;
            } else {
              // Geen historische data: gebruik verkoopkoers als benadering
              totaalWaarde += (b.verkoopkoers || b.kostprijs) * b.aantalVerkocht * factor;
            }
          });

          return { label: punt.label, datum: punt.datum, tijd: puntDatum ? puntDatum.getTime() : null, waarde: Math.round(totaalWaarde * 100) / 100 };
        })
        .filter(p => p.waarde > 0);

      // Elke unieke aankoop-/verkoopdatum krijgt een eigen punt op de exacte
      // datum, ook als dat tussen twee bestaande (bv. wekelijkse) datapunten
      // in valt — i.p.v. de gebeurtenis te laten aankleven aan het
      // dichtstbijzijnde bestaande punt, wat meerdere verschillende datums
      // ten onrechte samen zou tonen.
      const gebeurtenisDatums = new Set();
      beleggingVoorGrafiek.forEach(b => { if (b.datum) gebeurtenisDatums.add(new Date(b.datum).toISOString().slice(0, 10)); });
      verkochtVoorGrafiek.forEach(b => {
        if (b.datum) gebeurtenisDatums.add(new Date(b.datum).toISOString().slice(0, 10));
        const vd = parseDatum(b.verkoopdatum);
        if (vd && !isNaN(vd)) gebeurtenisDatums.add(vd.toISOString().slice(0, 10));
      });

      const maandKortInterp = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

      // Berekent de portefeuillewaarde op een willekeurige, exacte datum
      // (voor de ingevoegde aankoop-/verkooppunten hieronder), op basis van
      // dezelfde vindPrijsOpDatum-opzoeking als hierboven.
      const berekenWaardeOpDatum = (doelDatum) => {
        let totaal = 0;
        beleggingVoorGrafiek.forEach(b => {
          const factor = fxOpRef.current(b.munt || 'EUR', doelDatum); // wisselkoers van die dag
          const aankoopDatum = b.datum ? new Date(b.datum) : null;
          if (aankoopDatum && doelDatum < aankoopDatum) return;
          const prijs = vindPrijsOpDatum(historischeData[b.symbol], doelDatum);
          if (prijs != null) totaal += prijs * b.aantal * factor;
          else { const koers = koersenRef.current[b.symbol]; totaal += (koers ? koers.c : b.kostprijs) * b.aantal * factor; }
        });
        verkochtVoorGrafiek.forEach(b => {
          const factor = fxOpRef.current(b.munt || 'EUR', doelDatum); // wisselkoers van die dag
          const aankoopDatum = b.datum ? new Date(b.datum) : null;
          const verkoopDatum = parseDatum(b.verkoopdatum);
          if (aankoopDatum && doelDatum < aankoopDatum) return;
          if (verkoopDatum && doelDatum > verkoopDatum) return;
          const prijs = vindPrijsOpDatum(historischeData[b.symbol], doelDatum);
          if (prijs != null) totaal += prijs * b.aantalVerkocht * factor;
          else totaal += (b.verkoopkoers || b.kostprijs) * b.aantalVerkocht * factor;
        });
        return totaal;
      };

      gebeurtenisDatums.forEach(datumStr => {
        const datumObj = new Date(datumStr);
        if (isNaN(datumObj)) return;
        if (gecombineerd.some(p => p.datum === datumStr)) return; // al een exact punt aanwezig
        const eerste = gecombineerd.find(p => p.datum);
        const laatste = [...gecombineerd].reverse().find(p => p.datum);
        if (!eerste || !laatste) return;
        if (datumObj > new Date(laatste.datum)) return; // na het laatste punt: niet relevant

        // Vóór het allereerste bekende grafiekpunt: enkel tonen als deze datum
        // ook echt binnen de bedoelde periode valt (bv. "1J" = laatste jaar,
        // "YTD" = sinds 1 januari). Valt de aankoop van vóór dat venster,
        // dan zou dit de grafiek net onterecht verder laten teruglopen dan
        // de gekozen periode.
        if (datumObj < new Date(eerste.datum)) {
          if (begindatumFilter && datumObj < begindatumFilter) return;
          const benaderdeWaarde = berekenWaardeOpDatum(datumObj);
          if (benaderdeWaarde > 0) {
            gecombineerd.unshift({
              label: `${datumObj.getDate()} ${maandKortInterp[datumObj.getMonth()]}`,
              datum: datumStr,
              tijd: datumObj.getTime(),
              waarde: Math.round(benaderdeWaarde * 100) / 100,
            });
          }
          return;
        }

        let voor = null;
        for (let i = 0; i < gecombineerd.length - 1; i++) {
          const d1 = gecombineerd[i].datum ? new Date(gecombineerd[i].datum) : null;
          const d2 = gecombineerd[i + 1].datum ? new Date(gecombineerd[i + 1].datum) : null;
          if (d1 && d2 && datumObj >= d1 && datumObj <= d2) { voor = { index: i }; break; }
        }
        if (!voor) return;

        const nauwkeurigeWaarde = berekenWaardeOpDatum(datumObj);
        gecombineerd.splice(voor.index + 1, 0, {
          label: `${datumObj.getDate()} ${maandKortInterp[datumObj.getMonth()]}`,
          datum: datumStr,
          tijd: datumObj.getTime(),
          waarde: Math.round(nauwkeurigeWaarde * 100) / 100,
        });
      });

      // Elke periode (behalve 1D) toont een startpunt op €0 de dag vóór je
      // allereerste aankoop — maar enkel als die aankoop toevallig binnen de
      // huidige periode valt (bv. deze week begonnen met beleggen en dan naar
      // "1W" kijken). Bestond je portefeuille al vóór deze periode, dan zou
      // zo'n nulpunt net misleidend zijn, en laten we het dus achterwege.
      if (tijdperk !== '1D' && gecombineerd.length > 0) {
        const eersteMetDatum = gecombineerd.find(p => p.datum);
        if (eersteMetDatum) {
          const alleAankoopdatums = [
            ...beleggingVoorGrafiek.map(b => b.datum).filter(Boolean),
            ...verkochtVoorGrafiek.map(b => b.datum).filter(Boolean),
          ].map(d => new Date(d).toISOString().slice(0, 10));
          const absoluteEersteDatum = alleAankoopdatums.length > 0
            ? alleAankoopdatums.reduce((a, b) => a < b ? a : b)
            : null;

          if (absoluteEersteDatum && eersteMetDatum.datum === absoluteEersteDatum) {
            const eersteDatumObj = new Date(eersteMetDatum.datum);
            const dagErvoor = new Date(eersteDatumObj);
            dagErvoor.setDate(dagErvoor.getDate() - 1);
            const dagErvoorStr = dagErvoor.toISOString().slice(0, 10);
            if (!gecombineerd.some(p => p.datum === dagErvoorStr)) {
              gecombineerd.unshift({
                label: `${dagErvoor.getDate()} ${maandKortInterp[dagErvoor.getMonth()]}`,
                datum: dagErvoorStr,
                tijd: dagErvoor.getTime(),
                waarde: 0,
              });
            }
          }
        }
      }

      // Yahoo's dagelijkse candle-data toont de lopende, nog niet afgesloten
      // handelsdag soms nog niet — waardoor de grafiek een dag zou achterlopen
      // op het live cijfer bovenaan. Ontbreekt "vandaag" als laatste punt, dan
      // voegen we het zelf toe met de actuele koersen.
      const vandaagStr = new Date().toISOString().split('T')[0];
      const laatstePunt = gecombineerd[gecombineerd.length - 1];
      // Enkel als er vandaag ook echt gehandeld werd — anders (vóór 9u,
      // feestdag) zou dit een "vandaag"-punt met de koersen van gisteren zijn.
      const vandaagGehandeld = beleggingVoorGrafiek.some(b => handeldeVandaag(koersenRef.current[b.symbol], b.type, b.munt));
      if (vandaagGehandeld && (!laatstePunt || laatstePunt.datum !== vandaagStr)) {
        let liveWaarde = 0;
        beleggingVoorGrafiek.forEach(b => {
          const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
          const koers = koersenRef.current[b.symbol];
          liveWaarde += (koers ? koers.c : b.kostprijs) * b.aantal * factor;
        });
        if (liveWaarde > 0) {
          const maandKortVandaag = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
          const vandaagObj = new Date();
          gecombineerd.push({
            label: `${vandaagObj.getDate()} ${maandKortVandaag[vandaagObj.getMonth()]}`,
            datum: vandaagStr,
            tijd: vandaagObj.getTime(),
            waarde: Math.round(liveWaarde * 100) / 100,
          });
        }
      }

      // Beurzen zijn in het weekend gesloten — zaterdag en zondag tonen we
      // dus nooit in de grafiek, ongeacht waar ze precies vandaan kwamen
      // (candle-data, ingevoegd aankooppunt, nulpunt, of het "vandaag"-punt).
      const gefilterdOpWeekend = gecombineerd.filter(p => {
        if (!p.datum) return true;
        const dag = new Date(p.datum).getUTCDay(); // 0 = zondag, 6 = zaterdag
        return dag !== 0 && dag !== 6;
      });

      setGrafiekData(gefilterdOpWeekend);
      setGrafiekLoading(false);
    };

    laadGrafiek();
  }, [beleggingVoorGrafiek.length, tijdperk, filterType, filterSymbolen, filterBezit, (verkochteBeleggingen || []).length, grafiekTick, fxVersie]);

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
        case 'totaal': va = (ka ? ka.c : a.kostprijs) * a.aantal * fa - kostEur(a); vb = (kb ? kb.c : b.kostprijs) * b.aantal * fb - kostEur(b); break;
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
  }, [beleggingen, filterType, filterSymbolen, sortCol, sortDir, koersen, getMuntFactor]);

  // Winst/verlies op elk punt = (waarde − inleg) van wat je toen bezat
  // + de winst die je vóór dat punt al realiseerde met verkopen. Vroeger
  // ontbrak dat laatste: een verkoop met winst deed de lijn dan dalen.
  // Bedragen in euro aan de wisselkoers van de aankoop-/verkoopdag.
  // Netto ontvangen dividenden van de posities in de grafiek (zie AppContext)
  const verkochtInGrafiek = filterBezit === 'inbezit' ? [] : (verkochteBeleggingen || []).filter(b => {
    if (filterType !== 'alle' && b.type !== filterType) return false;
    if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return false;
    return true;
  });
  const divGrafiek = (inclDividend && tijdperk !== '1D' && dividendUitkeringen) ? dividendUitkeringen(beleggingVoorGrafiek, verkochtInGrafiek) : [];
  const divTot = (iso) => divGrafiek.reduce((s, d) => (iso && d.datum <= iso ? s + d.eur : s), 0);

  const winstDataRuw = grafiekData.map((d) => {
    const puntDatum = d.datum ? new Date(d.datum) : null;
    let aankoopwaarde = 0;
    let gerealiseerd = 0;
    beleggingVoorGrafiek.forEach(b => {
      const aankoopDatum = b.datum ? new Date(b.datum) : null;
      if (!puntDatum || !aankoopDatum || puntDatum >= aankoopDatum) aankoopwaarde += kostEur(b);
    });
    (filterBezit === 'inbezit' ? [] : (verkochteBeleggingen || [])).forEach(b => {
      if (filterType !== 'alle' && b.type !== filterType) return;
      if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return;
      const aankoopDatum = b.datum ? new Date(b.datum) : null;
      const verkoopDatum = leesDatum(b.verkoopdatum);
      const aantal = b.aantalVerkocht || b.aantal || 1;
      if (puntDatum && aankoopDatum && puntDatum < aankoopDatum) return;
      if (puntDatum && verkoopDatum && puntDatum > verkoopDatum) {
        gerealiseerd += verkoopEur(b) - kostEur(b, aantal); // al verkocht
        return;
      }
      aankoopwaarde += kostEur(b, aantal); // toen nog in bezit
    });
    return { ...d, waarde: d.waarde - aankoopwaarde + gerealiseerd + divTot(d.datum), inleg: Math.round(aankoopwaarde * 100) / 100 };
  });

  // Bij Totaal toont de lijn je totale winst sinds de eerste aankoop. Bij
  // een periode (1D, 1W, 1M, 1J, YTD, Laatste) start ze op €0 en toont ze
  // wat je in díé periode won of verloor — net als het cijfer bovenaan.
  const winstData = (() => {
    if (winstDataRuw.length === 0) return winstDataRuw;
    let basis = 0;
    if (tijdperk === '1D') basis = null; // zie hieronder
    else if (tijdperk !== 'Totaal') basis = winstDataRuw[0].waarde;
    return winstDataRuw.map(d => {
      const w = tijdperk === '1D'
        ? d.waarde + d.inleg - (portfolioVorigeSlot || grafiekData[0].waarde) // waarde − slot gisteren
        : d.waarde - basis;
      return { ...d, waarde: Math.round(w * 100) / 100 };
    });
  })();

  // Waarde-weergave: extra stippellijn "Ingelegd" (wat je erin stak op dat
  // moment). Zo zie je dat een sprong door een aankoop eigen geld is, en is
  // de ruimte tussen beide lijnen je winst of verlies.
  const waardeData = grafiekData.map((d, i) => (
    tijdperk === '1D' ? d : { ...d, inleg: winstData[i]?.inleg }
  ));

  // Rendement-weergave (tijdgewogen): per stap de koersbeweging, zonder het
  // effect van bijkopen of verkopen. Een aankoop van €5.000 geeft dus geen
  // sprong; enkel hoe je beleggingen zelf evolueerden telt.
  const rendementData = (() => {
    if (grafiekData.length === 0) return [];
    const dagStr = (dt) => dt.toISOString().slice(0, 10);
    const verkochtGefilterd = filterBezit === 'inbezit' ? [] : (verkochteBeleggingen || []).filter(b => {
      if (filterType !== 'alle' && b.type !== filterType) return false;
      if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return false;
      return true;
    });

    // Geld dat tussen punt i-1 en punt i in- of uitstroomde. Een aankoop telt
    // mee vanaf het eerste punt op of na de aankoopdatum, een verkochte
    // positie verdwijnt pas op het punt ná de verkoopdatum (zelfde regels
    // als de waardeberekening van de grafiek).
    const kasstroom = (vorige, huidige) => {
      if (!vorige || !huidige) return 0;
      let cf = 0;
      [...beleggingVoorGrafiek, ...verkochtGefilterd].forEach(b => {
        if (!b.datum) return;
        const a = dagStr(new Date(b.datum));
        const aantal = b.aantalVerkocht || b.aantal;
        if (a > vorige && a <= huidige) cf += kostEur(b, aantal);
      });
      verkochtGefilterd.forEach(b => {
        const v = leesDatum(b.verkoopdatum);
        if (!v) return;
        const vs = dagStr(v);
        if (vs >= vorige && vs < huidige) cf -= verkoopEur(b);
      });
      // Uitgekeerd dividend verlaat de portefeuille als geld: telt als opbrengst
      divGrafiek.forEach(d => { if (d.datum > vorige && d.datum <= huidige) cf -= d.eur; });
      return cf;
    };

    let groei = 1;
    return grafiekData.map((d, i) => {
      if (tijdperk === '1D') {
        const basis = portfolioVorigeSlot || grafiekData[0].waarde;
        return { ...d, waarde: basis > 0 ? Math.round((d.waarde / basis - 1) * 10000) / 100 : 0 };
      }
      if (i > 0) {
        const vorige = grafiekData[i - 1];
        const cf = kasstroom(vorige.datum, d.datum);
        const noemer = vorige.waarde + Math.max(cf, 0);
        if (noemer > 0) groei *= 1 + (d.waarde - vorige.waarde - cf) / noemer;
      }
      return { ...d, waarde: Math.round((groei - 1) * 10000) / 100 };
    });
  })();

  // Huidige waarde van enkel de gefilterde beleggingen
  const gefilterdeTotaalWaarde = beleggingVoorGrafiek.reduce((s, b) => {
    const k = koersen[b.symbol];
    const prijs = k ? k.c : b.kostprijs;
    const f = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
    return s + prijs * b.aantal * f;
  }, 0);

  const displayData = weergave === 'waarde' ? waardeData : weergave === 'rendement' ? rendementData : winstData;
  const isPct = weergave === 'rendement';
  const formatWaarde = (v) => isPct
    ? `${v >= 0 ? '+' : '-'}${getal(Math.abs(v || 0), 2)}%`
    : `€${(v || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // De 1D-grafiek toont altijd het venster 9u-22u (Belgische tijd) — de
  // Europese en Amerikaanse beursuren samen. Is de (gefilterde) selectie
  // echter uitsluitend crypto (bv. via de filter "enkel crypto"), dan is
  // zo'n beursuren-venster zinloos — dan tonen we gewoon de volle 24u, als
  // één ononderbroken lijn, net als bij een individueel crypto-effect.
  const alleenCrypto = beleggingVoorGrafiek.length > 0 && beleggingVoorGrafiek.every(b => b.type === 'crypto');
  const binnenBeursurenPortfolio = (label) => {
    const uur = parseInt((label || '').split(':')[0], 10);
    return !isNaN(uur) && uur >= 9 && uur < 22;
  };
  // De 1D-grafiek toont altijd het venster 9u (opening Europese beurzen) tot
  // 22u (sluiting Amerikaanse beurzen) — ongeacht of de portefeuille crypto
  // bevat. Enkel bij een portefeuille die uitsluitend uit crypto bestaat
  // tonen we de volle 24u, want daar is een "beursuren"-venster zinloos.
  const toontCryptoFilterPortfolio = tijdperk === '1D' && !alleenCrypto;
  const displayDataVoorWeekend = toontCryptoFilterPortfolio
    ? displayData.filter(d => binnenBeursurenPortfolio(d.label))
    : displayData;

  // Op de niet-intraday grafieken (alle periodes behalve 1D) mag het weekend
  // geen ruimte innemen op de as — vrijdag naar maandag moet er even breed
  // uitzien als eender welke andere opeenvolgende weekdag-stap. We rekenen
  // daarom de cumulatieve "weekend-duur" uit elk punt se tijdstip weg.
  const displayDataGefilterd = (tijdperk === '1D' || displayDataVoorWeekend.length === 0)
    ? displayDataVoorWeekend
    : (() => {
        const puntenMetTijd = displayDataVoorWeekend.filter(p => p.tijd != null);
        if (puntenMetTijd.length === 0) return displayDataVoorWeekend;
        const eersteDag = new Date(puntenMetTijd[0].tijd);
        eersteDag.setUTCHours(0, 0, 0, 0);
        const laatsteTijd = puntenMetTijd[puntenMetTijd.length - 1].tijd;
        const dagMs = 24 * 60 * 60 * 1000;

        const cumulatieveWeekendMs = new Map();
        let lopendeSom = 0;
        for (let t = eersteDag.getTime(); t <= laatsteTijd + dagMs; t += dagMs) {
          cumulatieveWeekendMs.set(t, lopendeSom);
          const dagVanWeek = new Date(t).getUTCDay();
          if (dagVanWeek === 0 || dagVanWeek === 6) lopendeSom += dagMs;
        }

        return displayDataVoorWeekend.map(p => {
          if (p.tijd == null) return p;
          const dagVanPunt = new Date(p.tijd);
          dagVanPunt.setUTCHours(0, 0, 0, 0);
          const weekendTotDeze = cumulatieveWeekendMs.get(dagVanPunt.getTime()) || 0;
          return { ...p, tijd: p.tijd - weekendTotDeze };
        });
      })();


  // ── Slimme X-as: meet werkelijk datumbereik, kies dan de beste interval ──
  const { xTicks, xTickFormatter } = (() => {
    const maandKort = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    const data = displayDataGefilterd.filter(d => d.tijd != null);
    if (data.length < 2) return { xTicks: undefined, xTickFormatter: v => v };

    // Voor het bepalen van dagbereik/groepering gebruiken we altijd de échte
    // kalenderdatum (het 'datum'-veld) — nooit het (voor het weekend
    // gecorrigeerde) 'tijd'-veld, want dat zou voor niet-triviale weekend-
    // correcties een verkeerde datum opleveren bij het terugvertalen.
    const echteD = (d) => d.datum ? new Date(d.datum) : new Date(d.tijd);
    const eersteD = echteD(data[0]);
    const laatsteD = echteD(data[data.length - 1]);
    const dagen = (laatsteD - eersteD) / (1000 * 60 * 60 * 24);

    if (dagen <= 2) {
      // Enkele dag(en): dynamische stapgrootte die vanzelf opschaalt naarmate
      // de dag vordert en er meer punten bijkomen — begint fijn (om de 10
      // min) en schakelt pas over naar grovere stappen (30 min, dan een uur)
      // zodra dat nodig is om de as leesbaar te houden.
      const naarMinuten = (t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
      const spanMinuten = naarMinuten(data[data.length - 1].tijd) - naarMinuten(data[0].tijd);
      // Op een smal (mobiel) scherm is er simpelweg geen plaats voor evenveel
      // "HH:MM"-labels als op desktop — minder ticks vragen voorkomt dat ze
      // over elkaar heen komen te staan.
      const doelTicks = isMobielScherm ? 5 : 16;
      // Tot 60 min was het grofste dat deze lijst kende — voor een volledige
      // handelsdag (~12-13u) kom je daarmee nooit onder de mobiele doelTicks
      // van 5 uit (780min/60u ≈ 13 ticks), dus viel het altijd terug op
      // uurlijkse labels die op een smal scherm over elkaar heen vallen.
      // 120/180/240 min toegevoegd zodat ook lange dagspannen genoeg kunnen
      // uitdunnen op mobiel (desktop kiest hier niets van, want 60 min
      // voldoet daar al aan doelTicks=16).
      const opties = [10, 30, 60, 120, 180, 240];
      let stap = opties[opties.length - 1];
      for (const optie of opties) {
        if (spanMinuten / optie <= doelTicks) { stap = optie; break; }
      }
      const gezienBuckets = new Set();
      const labelPerTijd = new Map();
      const ticks = data.filter(d => {
        const bucket = Math.floor(naarMinuten(d.tijd) / stap);
        if (gezienBuckets.has(bucket)) return false;
        gezienBuckets.add(bucket);
        return true;
      }).map(d => { labelPerTijd.set(d.tijd, d.label); return d.tijd; });
      return { xTicks: ticks, xTickFormatter: (t) => labelPerTijd.get(t) ?? new Date(t).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }) };
    }

    // Groepeerstrategie op basis van werkelijk bereik — groeperen op de
    // échte datum, niet op de (mogelijk gecorrigeerde) as-positie.
    let groepeerFn, formatFn;

    if (dagen <= 14) {
      groepeerFn = (dt) => dt.toDateString();
      formatFn = (dt) => `${dt.getDate()} ${maandKort[dt.getMonth()]}`;
    } else if (dagen <= 60) {
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      groepeerFn = (dt) => Math.floor(dt.getTime() / msPerWeek);
      formatFn = (dt) => `${dt.getDate()} ${maandKort[dt.getMonth()]}`;
    } else if (dagen <= 400) {
      groepeerFn = (dt) => `${dt.getFullYear()}-${dt.getMonth()}`;
      formatFn = (dt) => dt.getMonth() === 0 ? `jan '${String(dt.getFullYear()).slice(2)}` : maandKort[dt.getMonth()];
    } else if (dagen <= 900) {
      groepeerFn = (dt) => `${dt.getFullYear()}-Q${Math.floor(dt.getMonth()/3)}`;
      formatFn = (dt) => {
        const kwartaalMaand = Math.floor(dt.getMonth()/3) * 3;
        return kwartaalMaand === 0 ? `${dt.getFullYear()}` : maandKort[kwartaalMaand];
      };
    } else {
      groepeerFn = (dt) => dt.getFullYear();
      formatFn = (dt) => String(dt.getFullYear());
    }

    const gezien = new Set();
    const labelPerTijd = new Map();
    const ticks = data.filter(d => {
      const dt = echteD(d);
      const sleutel = groepeerFn(dt);
      if (gezien.has(sleutel)) return false;
      gezien.add(sleutel);
      labelPerTijd.set(d.tijd, formatFn(dt));
      return true;
    }).map(d => d.tijd);

    return { xTicks: ticks, xTickFormatter: (t) => labelPerTijd.get(t) ?? '' };
  })();
  const beursOpenPortfolio = beleggingen.some(b => isBeursOpen(b));

  // Voor 1D: bereken winst alleen op basis van beurzen die vandaag al open waren
  const dagWinst1D = beleggingen.reduce((s, b) => {
    if (!isBeursOpen(b)) return s; // sla gesloten beurzen over
    const koers = koersen[b.symbol];
    if (!koers) return s;
    const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
    return s + (koers.c - koers.pc) * b.aantal * factor;
  }, 0);

  // Noemer: de hele portefeuille bij het slot van gisteren — niet enkel de
  // posities waarvan de beurs al open is. Anders toonde bv. +2% op je
  // Europese helft om 11u als "+2% vandaag" voor de hele portefeuille.
  // (Koersen van vorige handelsdagen hebben pc = c, zie handelsdag.js.)
  const dagWaarde1D = beleggingen.reduce((s, b) => {
    const koers = koersen[b.symbol];
    const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
    return s + (koers ? koers.pc : b.kostprijs) * b.aantal * factor;
  }, 0);

  const dagWinstPct1D = dagWaarde1D > 0 ? (dagWinst1D / dagWaarde1D) * 100 : 0;

  // periodeWinst = waardeverandering van posities die al in bezit waren aan begin periode
  // (exclusief het effect van nieuwe aankopen — dat is geen rendement)
  const periodeWinstZonderDiv = (() => {
    if (tijdperk === '1D') return beursOpenPortfolio ? dagWinst1D : 0;

    const nuJaar = new Date().getFullYear();

    let startDatum;
    if (tijdperk === 'YTD') startDatum = new Date(`${nuJaar}-01-01`);
    else if (tijdperk === 'Laatste') return winstData.length > 1 ? winstData[winstData.length - 1].waarde : 0;
    else if (tijdperk === 'Totaal') return filterBezit === 'inbezit' ? portfolioWinstVerlies : (portfolioWinstVerliesInclVerkocht || portfolioWinstVerlies);
    else startDatum = periodeStart(tijdperk);

    const pK = tijdperk === 'YTD' ? ytdKoersen : (periodeKoersen[tijdperk] || {});
    // Startkoers × wisselkoers van de startdag; nu × live wisselkoers
    const fxStartDag = tijdperk === 'YTD' ? `${nuJaar}-01-02` : startDatum;

    let winst = 0;
    beleggingen.forEach(b => {
      const k = koersen[b.symbol];
      const munt = b.munt || 'EUR';
      const waardeNu = (k ? k.c : b.kostprijs) * b.aantal * getMuntFactor(munt);
      const aankoopDatum = b.datum ? new Date(b.datum) : null;

      if (aankoopDatum && aankoopDatum <= startDatum) {
        // In bezit voor start periode → gebruik startkoers
        const prijsStart = pK[b.symbol];
        if (prijsStart && prijsStart > 0) {
          winst += waardeNu - prijsStart * b.aantal * fxOp(munt, fxStartDag);
        }
      } else if (tijdperk === 'YTD' || ['1W','1M','1J'].includes(tijdperk)) {
        // Nieuwe aankopen: winst tov aankoopbedrag meenemen in teller (consistent met percentage)
        winst += waardeNu - kostEur(b);
      }
    });

    // Inclusief verkochte effecten
    if (filterBezit !== 'inbezit') {
      (verkochteBeleggingen || []).forEach(b => {
        const vd = leesDatum(b.verkoopdatum);
        if (!vd || vd < startDatum) return; // verkoop was voor deze periode
        const aankoopDatum = b.datum ? new Date(b.datum) : null;
        const aantal = b.aantalVerkocht || b.aantal || 1;
        if (aankoopDatum && aankoopDatum <= startDatum) {
          // Al in bezit voor start periode → gebruik startkoers
          const prijsStart = pK[b.symbol];
          if (prijsStart && prijsStart > 0) {
            winst += verkoopEur(b) - prijsStart * aantal * fxOp(b.munt || 'EUR', fxStartDag);
          }
        } else {
          // Gekocht én verkocht tijdens deze periode → aankoopbedrag als startpunt
          winst += verkoopEur(b) - kostEur(b, aantal);
        }
      });
    }
    return winst;
  })();

  // Netto ontvangen dividenden in deze periode (enkel als het vinkje aan
  // staat). 'Laatste' haalt zijn winst uit de grafiek, waar ze al in zitten.
  const divPeriode = (() => {
    if (!inclDividend || !dividendUitkeringen || tijdperk === '1D' || tijdperk === 'Laatste') return 0;
    const lijst = dividendUitkeringen(beleggingen, filterBezit === 'inbezit' ? [] : (verkochteBeleggingen || []));
    const start = tijdperk === 'Totaal' ? null
      : tijdperk === 'YTD' ? `${new Date().getFullYear()}-01-01`
      : periodeStart(tijdperk)?.toISOString().slice(0, 10);
    return lijst.reduce((s, d) => (!start || d.datum >= start ? s + d.eur : s), 0);
  })();
  const periodeWinst = periodeWinstZonderDiv + divPeriode;

  const periodeWinstPct = (() => {
    if (tijdperk === '1D') return beursOpenPortfolio ? dagWinstPct1D : 0;
    if (tijdperk === 'YTD') {
      // Noemer = startwaarde posities die op 1 jan in bezit waren
      const nuJaar = new Date().getFullYear();
      const eersteJan = new Date(`${nuJaar}-01-01`);
      let noemer = 0;
      const fxJan = (b) => fxOp(b.munt || 'EUR', `${nuJaar}-01-02`);
      beleggingen.forEach(b => {
        const aankoopDatum = b.datum ? new Date(b.datum) : null;
        if (aankoopDatum && aankoopDatum <= eersteJan) {
          const prijsStart = ytdKoersen[b.symbol];
          if (prijsStart && prijsStart > 0) noemer += prijsStart * b.aantal * fxJan(b);
        } else {
          // Dit jaar gekocht: de winst erop zit in de teller, dus de inleg
          // hoort in de noemer.
          noemer += kostEur(b);
        }
      });
      if (filterBezit !== 'inbezit') {
        (verkochteBeleggingen || []).forEach(b => {
          const vd = leesDatum(b.verkoopdatum);
          if (!vd || vd.getFullYear() !== nuJaar) return;
          const aankoopDatum = b.datum ? new Date(b.datum) : null;
          const aantal = b.aantalVerkocht || b.aantal || 1;
          if (aankoopDatum && aankoopDatum <= eersteJan) {
            const prijsStart = ytdKoersen[b.symbol];
            if (prijsStart && prijsStart > 0) noemer += prijsStart * aantal * fxJan(b);
          } else {
            noemer += kostEur(b, aantal);
          }
        });
      }
      return noemer > 0 ? (periodeWinst / noemer) * 100 : 0;
    }
    if (tijdperk === 'Totaal') {
      if (divPeriode !== 0 && portfolioKostprijs > 0) return (periodeWinst / portfolioKostprijs) * 100;
      return filterBezit === 'inbezit' ? portfolioWinstPct : portfolioWinstPctInclVerkocht;
    }

    // 1W, 1M, 1J: percentage = periodeWinst / startwaarde actieve posities
    // Noemer verandert NIET bij inclusief/exclusief — alleen de teller (periodeWinst) verandert
    if (['1W', '1M', '1J'].includes(tijdperk)) {
      const startDatum = periodeStart(tijdperk);
      const pK = periodeKoersen[tijdperk] || {};
      let startWaarde = 0;

      // Noemer = wat er in de periode "aan het werk" stond: de startwaarde
      // van wat je al had, plus wat je tijdens de periode bijkocht. Vroeger
      // telde de winst op nieuwe aankopen wél mee in de teller maar hun
      // inleg niet in de noemer — een grote aankoop deze week gaf dan een
      // veel te hoog percentage.
      beleggingen.forEach(b => {
        const aankoopDatum = b.datum ? new Date(b.datum) : null;
        if (aankoopDatum && aankoopDatum <= startDatum) {
          const prijsStart = pK[b.symbol];
          if (prijsStart && prijsStart > 0) startWaarde += prijsStart * b.aantal * fxOp(b.munt || 'EUR', startDatum);
        } else {
          startWaarde += kostEur(b);
        }
      });

      return startWaarde > 0 ? (periodeWinst / startWaarde) * 100 : 0;
    }

    // Laatste: grafiek-gebaseerd
    return grafiekData.length > 1 && grafiekData[0].waarde > 0
      ? (periodeWinst / grafiekData[0].waarde) * 100
      : 0;
  })();
  const periodeTekst = tijdperk === '1D' ? t('ov_prestatie_vandaag') : tijdperk === '1W' ? t('ov_prestatie_week') : tijdperk === '1M' ? t('ov_prestatie_maand') : tijdperk === '1J' ? t('ov_prestatie_jaar') : tijdperk === 'YTD' ? t('ov_prestatie_kalenderjaar') : tijdperk === 'Laatste' ? t('ov_prestatie_laatste') : t('ov_prestatie_eerste');
  const beursGesloten1D = tijdperk === '1D' && !beursOpenPortfolio;
  // Als beurs gesloten: forceer platte displayDataGefilterd zodat grafiek recht is
  const displayDataEff = beursGesloten1D && displayDataGefilterd.length > 0
    ? displayDataGefilterd.map(d => ({ ...d, waarde: displayDataGefilterd[0].waarde }))
    : displayDataGefilterd;
  // Rendement-weergave: het cijfer bovenaan wordt het tijdgewogen rendement
  // (= het eindpunt van de grafiek), zodat beide hetzelfde zeggen.
  const toontTwr = weergave === 'rendement' && tijdperk !== '1D' && rendementData.length > 1;
  const getoondPct = toontTwr ? rendementData[rendementData.length - 1].waarde : periodeWinstPct;

  // Kleur volgt of je in de periode winst of verlies maakte — niet of de
  // laatste waarde hoger is dan de eerste (dat is na een bijkoop altijd zo).
  const grafiekKleur = beursGesloten1D
    ? '#94a3b8'
    : (toontTwr ? getoondPct : periodeWinst) >= 0 ? '#1e3a8a' : '#ef4444';

  // Y-as domein: altijd strak rond de data, nooit vanaf 0
  // Y-as: nette gehele getallen, vaste stapgrootte, Totaal start bij 0
  const { yDomain, yTicks } = (() => {
    if (displayDataGefilterd.length < 2) return { yDomain: ['auto', 'auto'], yTicks: undefined };
    const waarden = displayDataGefilterd.map(d => d.waarde);
    if (weergave === 'waarde') displayDataGefilterd.forEach(d => { if (d.inleg != null) waarden.push(d.inleg); });
    if (weergave === 'waarde' && tijdperk === '1D' && portfolioVorigeSlot != null && !alleenCrypto) waarden.push(portfolioVorigeSlot);
    if (isPct) waarden.push(0); // de 0%-lijn altijd in beeld
    const min = Math.min(...waarden);
    const max = Math.max(...waarden);
    // Enkel de waarde-grafiek van Totaal begint bij €0; winst en rendement
    // kunnen negatief zijn en mogen niet afgesneden worden.
    const vanafNul = tijdperk === 'Totaal' && weergave === 'waarde' && min >= 0;
    const bodem = vanafNul ? 0 : min;
    const bereik = max - bodem;
    if (bereik === 0) return { yDomain: isPct ? [-1, 1] : [0, max * 1.2 || 1], yTicks: undefined };
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
    const axisMin = vanafNul ? 0 : Math.floor(bodem / niceStap) * niceStap;
    const axisMax = Math.ceil(max / niceStap) * niceStap;
    // Genereer tick-waarden (bij percentages ook stappen kleiner dan 1)
    const ticks = [];
    for (let t = axisMin; t <= axisMax + niceStap * 0.01; t += niceStap) {
      ticks.push(niceStap >= 1 ? Math.round(t) : Math.round(t * 100) / 100);
    }
    return { yDomain: [axisMin, axisMax], yTicks: ticks };
  })();

  return (
    <div
      style={{ padding: '0 0 40px', position: 'relative' }}
      onTouchStart={onPullStart}
      onTouchMove={onPullMove}
      onTouchEnd={onPullEnd}
    >
      {isMobielScherm && (pullAfstand > 0 || ververst) && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: pullAfstand,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          paddingBottom: 8, overflow: 'hidden', transition: pullStartY.current ? 'none' : 'height 0.2s',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '2.5px solid var(--border)', borderTopColor: 'var(--accent)',
            animation: (ververst || pullAfstand >= PULL_DREMPEL) ? 'spin 0.7s linear infinite' : 'none',
            transform: `rotate(${pullAfstand * 3}deg)`,
          }} />
        </div>
      )}
      <div className="page-header" style={{ marginBottom: isMobielScherm ? 14 : 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="mobiel-verbergen">
            <SidebarToggleKnop onToggleSidebar={onToggleSidebar} sidebarCollapsed={sidebarCollapsed} />
          </div>
          <h1>{begroeting()}, {gebruiker.voornaam}</h1>
        </div>
        <div className="mobiel-verbergen" style={{ position: 'relative' }} ref={menuRef}>
          <button className="btn btn-primary" onClick={() => setToevoegenMenuOpen(!toevoegenMenuOpen)} style={{ padding: '12px 20px', fontSize: 15 }}>
            <Plus size={18} /> {t('ov_beleggingen_toevoegen')} <ChevronDown size={16} />
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
                <Edit3 size={15} color="var(--text-muted)" /> {t('ov_manueel')}
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', fontSize: 14, borderTop: '1px solid var(--border-light)' }}
                onClick={() => { setToevoegenMenuOpen(false); onImporteren && onImporteren(); }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Upload size={15} color="var(--text-muted)" /> {t('ov_importeer')}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ov-sectie" style={{ marginBottom: isMobielScherm ? 14 : 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div className="time-tabs" style={{ display: 'inline-flex' }}>
          {TIJDPERKEN.map(t => (
            <button key={t} className={`time-tab ${tijdperk === t ? 'active' : ''}`} onClick={() => setTijdperk(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="ov-sectie">
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="overzicht-portfolio-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t('ov_portfolio')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{periodeTekst}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <div className="portfolio-waarde">
                  €{gefilterdeTotaalWaarde.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {(tijdperk === '1D' && !beursOpenPortfolio) ? (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '3px 10px', background: 'var(--bg)', borderRadius: 6, fontWeight: 500 }}>
                    — {t('ov_beurs_gesloten')}
                  </span>
                ) : (
                  <span className={`badge ${getoondPct >= 0 ? 'badge-green' : 'badge-red'}`} style={{ whiteSpace: 'nowrap' }}
                    title={toontTwr ? t('ov_rendement_uitleg') : undefined}>
                    {getoondPct >= 0 ? '▲' : '▼'} {getal(Math.abs(getoondPct), 2)}%{toontTwr ? ` ${t('ov_rendement').toLowerCase()}` : ''} ({periodeWinst >= 0 ? '+' : '-'}€{getal(Math.abs(periodeWinst), 2)})
                  </span>
                )}
              </div>
            </div>
            {/* Gsm: ronde icoonknoppen rechtsboven (namen als tooltip/voorlezer);
                een stipje toont dat er een filter actief is. */}
            {(() => {
              const filterActief = filterType !== 'alle' || filterSymbolen.length > 0 || filterBezit !== 'inbezit';
              const icoonKnop = { position: 'relative', width: 40, height: 40, padding: 0, borderRadius: '50%', justifyContent: 'center', flexShrink: 0 };
              const stip = <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-white)' }} />;
              return (
                <div className="overzicht-portfolio-actions" style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" title={t('ov_vergelijk')} aria-label={t('ov_vergelijk')}
                    style={isMobielScherm ? icoonKnop : { fontSize: 13 }} onClick={() => setVergelijkOpen(true)}>
                    <GitCompare size={isMobielScherm ? 18 : 15} />{!isMobielScherm && <> {t('ov_vergelijk')}</>}
                  </button>
                  <button className="btn btn-secondary" title={t('ov_filter')} aria-label={t('ov_filter')}
                    style={isMobielScherm ? icoonKnop : { fontSize: 13, position: 'relative' }} onClick={() => setFilterOpen(true)}>
                    <SlidersHorizontal size={isMobielScherm ? 18 : 15} />{!isMobielScherm && <> {t('ov_filter')}</>}
                    {filterActief && stip}
                  </button>
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {weergave === 'waarde' && tijdperk !== '1D' && beleggingen.length > 0 && (
              <span style={{ marginRight: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <svg width="22" height="4" aria-hidden="true"><line x1="0" y1="2" x2="22" y2="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 4" /></svg>
                {t('ov_ingelegd')}
              </span>
            )}
            {weergave === 'rendement' && beleggingen.length > 0 && (
              <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                {t('ov_rendement_uitleg')}
              </span>
            )}
            {tijdperk !== '1D' && beleggingen.length > 0 && (
              <label title={t('ov_incl_dividend_uitleg')} style={{
                marginRight: weergave === 'winst/verlies' ? 'auto' : 8, display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none',
              }}>
                <input type="checkbox" checked={inclDividend} onChange={e => setInclDividend(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', margin: 0, cursor: 'pointer' }} />
                {t('ov_incl_dividend')}
              </label>
            )}
            {['waarde', 'winst/verlies', 'rendement'].map(w => (
              <button key={w} onClick={() => setWeergave(w)} style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: weergave === w ? 'var(--text-primary)' : 'transparent',
                color: weergave === w ? 'var(--bg-white)' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize'
              }}>
                {w === 'waarde' ? t('ov_waarde') : w === 'rendement' ? t('ov_rendement') : t('ov_winst_verlies')}
              </button>
            ))}
          </div>

          {beleggingen.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <p>{t('ov_leeg_state')}</p>
            </div>
          ) : grafiekLoading ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 13 }}>{t('ov_grafiek_laden')}</span>
            </div>
          ) : (
            <div style={{ position: 'relative', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}>
              {beursGesloten1D && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'rgba(255,255,255,0.9)', borderRadius: 8,
                  padding: '6px 14px', fontSize: 12, color: 'var(--text-muted)',
                  fontWeight: 600, pointerEvents: 'none', zIndex: 5,
                  border: '1px solid var(--border)', whiteSpace: 'nowrap'
                }}>
                  🔒 {t('ov_beurs_gesloten')}
                </div>
              )}
            <ResponsiveContainer width="100%" height={isMobielScherm ? 240 : 220}>
              <AreaChart
                data={displayDataEff}
                margin={{ top: 5, right: isMobielScherm ? 18 : 5, bottom: 5, left: isMobielScherm ? 18 : 0 }}
                onMouseDown={grafiekSleepStart}
                onMouseMove={grafiekSleepBeweeg}
                onMouseUp={grafiekSleepEinde}
                onMouseLeave={grafiekSleepEinde}
                onTouchStart={grafiekSleepStart}
                onTouchMove={grafiekSleepBeweeg}
                onTouchEnd={grafiekSleepEinde}
              >
                <defs>
                  <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={grafiekKleur} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={grafiekKleur} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="tijd" type="number" domain={['dataMin', 'dataMax']} scale="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} ticks={xTicks} tickFormatter={xTickFormatter} interval={0} allowDuplicatedCategory={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => isPct
                    ? `${Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 2 })}%`
                    : (v < 0 ? '-€' : '€') + Math.abs(Math.round(v)).toLocaleString('nl-BE')}
                  domain={yDomain} ticks={yTicks} width={isPct ? 50 : 45} hide={isMobielScherm}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (aanHetSlepen) return null;
                    if (!active || !payload?.length) return null;
                    const datum = payload[0]?.payload?.datum;
                    const puntLabel = payload[0]?.payload?.label ?? label;
                    const waarde = (payload.find(p => p.dataKey === 'waarde') || payload[0])?.value;
                    const puntD = datum ? new Date(datum) : null;
                    const dagNaam = (tijdperk !== '1D' && puntD && !isNaN(puntD))
                      ? puntD.toLocaleDateString('nl-BE', { weekday: 'long', timeZone: 'UTC' }).replace(/^./, c => c.toUpperCase())
                      : null;
                    const beginPeriodeT = displayDataGefilterd.length > 0 && displayDataGefilterd[0].datum ? new Date(displayDataGefilterd[0].datum) : null;

                    // Op de intraday-weergave (1D) tonen we geen aankoop-/verkoopmarkeringen:
                    // een aankoop van vandaag zou daar een verwarrende sprong midden op de
                    // lijn geven. Bij alle andere (langere) periodes tonen we ze wel.
                    if (tijdperk === '1D') {
                      return (
                        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, boxShadow: 'var(--shadow-md)' }}>
                          <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 12 }}>{puntLabel}{dagNaam ? ` (${dagNaam})` : ''}</div>
                          <div style={{ fontWeight: 600, color: 'var(--accent)' }}>
                            {t('ov_tooltip_portfolio')} : {formatWaarde(waarde)}
                          </div>
                        </div>
                      );
                    }

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
                      if (!b.datum || !datum) return false;
                      const aankoopDStr = new Date(b.datum).toISOString().slice(0, 10);
                      // Bij Totaal/Laatste: beginPeriode IS de aankoopdatum, dus niet filteren
                      const filterOpBegin = tijdperk !== 'Totaal' && tijdperk !== 'Laatste';
                      if (filterOpBegin && beginPeriodeT && new Date(b.datum) < beginPeriodeT) return false;
                      return aankoopDStr === datum;
                    });

                    const verkopenOpDatum = (verkochteBeleggingen || []).filter(b => {
                      if (!b.verkoopdatum || !datum) return false;
                      const delen = b.verkoopdatum.split('/');
                      const verkoopD = delen.length === 3
                        ? new Date(`${delen[2]}-${delen[1]}-${delen[0]}`)
                        : new Date(b.verkoopdatum);
                      if (isNaN(verkoopD)) return false;
                      if (beginPeriodeT && verkoopD < beginPeriodeT) return false;
                      return verkoopD.toISOString().slice(0, 10) === datum;
                    });

                    const heeftEvents = aankopenOpDatum.length > 0 || verkopenOpDatum.length > 0;
                    const inlegPunt = weergave === 'waarde' ? payload[0]?.payload?.inleg : null;
                    return (
                      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, boxShadow: 'var(--shadow-md)' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 12 }}>{puntLabel}{dagNaam ? ` (${dagNaam})` : ''}</div>
                        <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: (heeftEvents || inlegPunt != null) ? 4 : 0 }}>
                          {t('ov_tooltip_portfolio')} : {formatWaarde(waarde)}
                        </div>
                        {inlegPunt != null && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: heeftEvents ? 8 : 0 }}>
                            {t('ov_ingelegd')} : {formatWaarde(inlegPunt)}
                            {' · '}
                            <span style={{ color: waarde - inlegPunt >= 0 ? 'var(--green)' : '#ef4444', fontWeight: 600 }}>
                              {waarde - inlegPunt >= 0 ? '+' : '-'}€{getal(Math.abs(waarde - inlegPunt), 2)}
                            </span>
                          </div>
                        )}
                        {aankopenOpDatum.map((b, i) => (
                          <div key={b.id + i} style={{ fontSize: 12, color: 'var(--green)', borderTop: '1px solid var(--border-light)', paddingTop: 6, marginTop: 2 }}>
                            🟢 {t('ov_tooltip_aankoop')} {b.naam} — {b.aantal} {t('ov_tooltip_st_a')} {muntSymbool(b.munt)}{koersFmt(b.kostprijs)}
                          </div>
                        ))}
                        {verkopenOpDatum.map((b, i) => {
                          const ms = muntSymbool(b.verkoopMunt || b.munt);
                          const wv = b.winstverlies || 0;
                          return (
                            <div key={b.id + i} style={{ fontSize: 12, color: '#ef4444', borderTop: '1px solid var(--border-light)', paddingTop: 6, marginTop: 2 }}>
                              🔴 {t('ov_tooltip_verkoop')} {b.naam} — {b.aantalVerkocht} {t('ov_tooltip_st_a')} {ms}{koersFmt(b.verkoopkoers)}
                              {' '}
                              <span style={{ color: wv >= 0 ? 'var(--green)' : '#ef4444', fontWeight: 600 }}>
                                ({wv >= 0 ? '+' : '-'}{ms}{getal(Math.abs(wv), 2)})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                {tijdperk === '1D' && portfolioVorigeSlot != null && !alleenCrypto && (
                  <ReferenceLine
                    y={portfolioVorigeSlot}
                    stroke="var(--text-muted)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: `Slot vorige dag: €${portfolioVorigeSlot.toLocaleString('nl-BE')}`, position: 'insideTopLeft', fontSize: 11, fill: 'var(--text-muted)' }}
                  />
                )}
                <Area type="monotone" dataKey="waarde" stroke={grafiekKleur} strokeWidth={2} fill="url(#portfolioGrad)" dot={(props) => {
                    const { cx, cy, payload, index } = props;
                    if (tijdperk === '1D') return <g key={index}></g>;
                    if (!payload || !payload.datum) return <g key={index}></g>;
                    const puntDatum = new Date(payload.datum);
                    const beginPeriode = displayDataGefilterd.length > 0 && displayDataGefilterd[0].datum ? new Date(displayDataGefilterd[0].datum) : null;

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
                      const aankoopDStr = new Date(b.datum).toISOString().slice(0, 10);
                      // Bij Totaal/Laatste: beginPeriode IS de aankoopdatum, dus niet filteren
                      const filterOpBP = tijdperk !== 'Totaal' && tijdperk !== 'Laatste';
                      if (filterOpBP && beginPeriode && new Date(b.datum) < beginPeriode) return false;
                      return aankoopDStr === payload.datum;
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
                      return verkoopD.toISOString().slice(0, 10) === payload.datum;
                    });

                    // Kleine, rustige markeringen; details (naam, aantal,
                    // koers) staan in de tooltip.
                    if (isVerkoop) {
                      return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3.5} fill="var(--bg-white)" stroke="#ef4444" strokeWidth={1.75} />;
                    }
                    if (isAankoop) {
                      return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3.5} fill="var(--bg-white)" stroke={grafiekKleur} strokeWidth={1.75} />;
                    }
                    return <g key={index}></g>;
                  }}
                  activeDot={{ r: 5, fill: grafiekKleur }} />
                {weergave === 'waarde' && tijdperk !== '1D' && (
                  <Area type="stepAfter" dataKey="inleg" stroke="var(--text-muted)" strokeWidth={1.5} fill="none"
                    strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />
                )}
                {isPct && <ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={1} />}
                {aanHetSlepen && sleepStart && sleepEind && sleepStart.tijd !== sleepEind.tijd && (() => {
                  const eerstePunt = sleepStart.tijd <= sleepEind.tijd ? sleepStart : sleepEind;
                  const laatstePunt = sleepStart.tijd <= sleepEind.tijd ? sleepEind : sleepStart;
                  const verschil = laatstePunt.waarde - eerstePunt.waarde;
                  const verschilPct = eerstePunt.waarde !== 0 ? (verschil / eerstePunt.waarde) * 100 : 0;
                  // Rendement: het rendement tússen de twee punten
                  const rendTussen = isPct ? ((1 + laatstePunt.waarde / 100) / (1 + eerstePunt.waarde / 100) - 1) * 100 : 0;
                  const positief = isPct ? rendTussen >= 0 : verschil >= 0;
                  const kleur = positief ? 'var(--green)' : 'var(--red)';
                  const tekst = isPct
                    ? `${positief ? '+' : '-'}${getal(Math.abs(rendTussen), 2)}%`
                    : `${positief ? '+' : '-'}€${Math.abs(verschil).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${positief ? '+' : '-'}${getal(Math.abs(verschilPct), 2)}%)`;
                  return (
                    <ReferenceArea
                      x1={eerstePunt.tijd}
                      x2={laatstePunt.tijd}
                      fill={kleur}
                      fillOpacity={0.12}
                      stroke={kleur}
                      strokeOpacity={0.5}
                      strokeDasharray="3 3"
                      label={(props) => {
                        const { viewBox } = props;
                        const breedte = Math.max(8 * tekst.length + 20, 90);
                        const hoogte = 24;
                        const x = viewBox.x + viewBox.width / 2 - breedte / 2;
                        const y = Math.max(viewBox.y + 6, 4);
                        return (
                          <g>
                            <rect x={x} y={y} width={breedte} height={hoogte} rx={6} fill={kleur} />
                            <text x={x + breedte / 2} y={y + hoogte / 2 + 4} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700}>
                              {tekst}
                            </text>
                          </g>
                        );
                      }}
                    />
                  );
                })()}
              </AreaChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {beleggingen.length > 0 && (
          <div className="card">
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t('ov_beleggingen_titel')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('ov_automatisch_opgevolgd')}</div>
            </div>
            <div className="tabel-header belegging-grid" style={{ marginTop: 16 }}>
              {[['naam',t('ov_col_naam')],['koers',t('ov_col_koers')],['waarde',t('ov_col_waarde')],['vandaag',t('ov_col_vandaag')],['totaal',t('ov_col_totaal')],['gewicht',t('ov_col_gewicht')]].map(([col, label]) => (
                <span key={col} onClick={() => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc'); } }}
                  style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {label}
                  <span style={{ fontSize: 10, color: sortCol === col ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700 }}>
                    {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↑↓'}
                  </span>
                </span>
              ))}
            </div>
            {(() => {
              // Meerdere aankopen van hetzelfde effect (bv. op verschillende
              // momenten) worden hier samengevoegd tot één rij — op de
              // Beleggingen-pagina blijven ze wél apart zichtbaar, want daar
              // is dat net nuttig om per aankoopmoment te zien.
              const perSymbool = new Map();
              gefilterdeBeleggingen.forEach(b => {
                if (!perSymbool.has(b.symbol)) perSymbool.set(b.symbol, []);
                perSymbool.get(b.symbol).push(b);
              });
              const gegroepeerdeBeleggingen = [...perSymbool.values()].map(lots => {
                const eerste = lots[0];
                const totaalAantal = lots.reduce((s, l) => s + l.aantal, 0);
                const totaleKostprijsBasis = lots.reduce((s, l) => s + l.kostprijs * l.aantal + (l.transactiekosten || 0), 0);
                const gewogenKostprijs = totaalAantal > 0 ? (totaleKostprijsBasis - lots.reduce((s, l) => s + (l.transactiekosten || 0), 0)) / totaalAantal : 0;
                const vroegsteDatum = lots.reduce((vroegste, l) => (!vroegste || (l.datum && new Date(l.datum) < new Date(vroegste))) ? l.datum : vroegste, null);
                return {
                  ...eerste,
                  id: `groep-${eerste.symbol}`,
                  aantal: totaalAantal,
                  kostprijs: gewogenKostprijs,
                  transactiekosten: lots.reduce((s, l) => s + (l.transactiekosten || 0), 0),
                  datum: vroegsteDatum,
                  _lots: lots, // volledige onderliggende aankopen, voor de detailweergave
                };
              });

              // Sorteren gebeurde hierboven al op de individuele aankopen —
              // dat zegt niets meer over de samengevoegde totalen, dus
              // sorteren we de gegroepeerde rijen hier opnieuw, op dezelfde
              // manier maar dan met de samengevoegde waarden.
              const totWaarde = gegroepeerdeBeleggingen.reduce((s, bb) => {
                const k = koersen[bb.symbol]; const f = getMuntFactor ? getMuntFactor(bb.munt || 'EUR') : ((bb.munt||'EUR')==='USD'?0.865:1);
                return s + (k ? k.c : bb.kostprijs) * bb.aantal * f;
              }, 0);
              gegroepeerdeBeleggingen.sort((a, b) => {
                let va, vb;
                const ka = koersen[a.symbol], kb = koersen[b.symbol];
                const fa = getMuntFactor ? getMuntFactor(a.munt || 'EUR') : ((a.munt||'EUR')==='USD'?0.865:1);
                const fb = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt||'EUR')==='USD'?0.865:1);
                switch (sortCol) {
                  case 'naam': va = a.naam?.toLowerCase(); vb = b.naam?.toLowerCase(); break;
                  case 'koers': va = ka ? ka.c : a.kostprijs; vb = kb ? kb.c : b.kostprijs; break;
                  case 'waarde': va = (ka ? ka.c : a.kostprijs) * a.aantal * fa; vb = (kb ? kb.c : b.kostprijs) * b.aantal * fb; break;
                  case 'vandaag': va = ka ? (ka.c - ka.pc) * a.aantal * fa : 0; vb = kb ? (kb.c - kb.pc) * b.aantal * fb : 0; break;
                  case 'totaal': va = (ka ? ka.c : a.kostprijs) * a.aantal * fa - kostEur(a); vb = (kb ? kb.c : b.kostprijs) * b.aantal * fb - kostEur(b); break;
                  case 'gewicht': va = totWaarde > 0 ? (ka?ka.c:a.kostprijs)*a.aantal*fa/totWaarde : 0; vb = totWaarde > 0 ? (kb?kb.c:b.kostprijs)*b.aantal*fb/totWaarde : 0; break;
                  default: va = a.datum ? new Date(a.datum).getTime() : 0; vb = b.datum ? new Date(b.datum).getTime() : 0; break;
                }
                if (va < vb) return sortDir === 'asc' ? -1 : 1;
                if (va > vb) return sortDir === 'asc' ? 1 : -1;
                return 0;
              });

              return gegroepeerdeBeleggingen;
            })().map(b => {
              const koers = koersen[b.symbol];
              const huidigePrijs = koers ? koers.c : b.kostprijs;
              const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
              const huidigeWaarde = huidigePrijs * b.aantal * factor;
              const kostprijs = kostEur(b); // aan de wisselkoers van de aankoopdag
              const winstTotaal = huidigeWaarde - kostprijs;
              const winstTotaalPct = kostprijs > 0 ? (winstTotaal / kostprijs) * 100 : 0;
              const beursOpen = isBeursOpen(b);
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
              const muntSym = muntSymbool(b.munt);

              return (
                <div key={b.id} style={{ position: 'relative', overflow: 'hidden' }}>
                  {isMobielScherm && (
                    <div
                      onClick={() => { setDetailBelegging(b); setSwipeRowId(null); setSwipeX(0); }}
                      style={{
                        position: 'absolute', top: 0, right: 0, bottom: 0, width: SWIPE_ACTIE_BREEDTE,
                        background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Detail
                    </div>
                  )}
                  <div
                    className={isMobielScherm ? 'ov-rij-mobiel' : 'tabel-rij belegging-grid'}
                    onClick={() => onRijKlik(b)}
                    onTouchStart={isMobielScherm ? (e) => onRijTouchStart(b.id, e) : undefined}
                    onTouchMove={isMobielScherm ? (e) => onRijTouchMove(b.id, e) : undefined}
                    onTouchEnd={isMobielScherm ? () => onRijTouchEnd(b.id) : undefined}
                    style={{
                      position: 'relative', zIndex: 1, background: 'var(--bg-white)',
                      transform: swipeRowId === b.id ? `translateX(${swipeX}px)` : 'translateX(0)',
                      transition: (swipeRowId === b.id && swipeStartXRef.current != null) ? 'none' : 'transform 0.2s',
                      ...(isMobielScherm ? { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' } : {}),
                    }}
                  >
                  {isMobielScherm ? (
                    // Gsm: compacte kaart — links naam, aantal, koers en dagbeweging;
                    // rechts waarde en totale winst/verlies
                    <>
                      <BeleggingAvatar b={b} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.naam}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.aantal} st. · {muntSym}{koersFmt(huidigePrijs)}
                        </div>
                        {beursOpen && (
                          <div style={{ fontSize: 12, fontWeight: 600, color: dagVPctRaw >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            Vandaag {dagVPctRaw >= 0 ? '+' : '-'}{getal(Math.abs(dagVPctRaw), 2)}%
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>€{getal(huidigeWaarde, 2)}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: winstTotaal >= 0 ? 'var(--green)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
                          {winstTotaal >= 0 ? '+' : '-'}€{getal(Math.abs(winstTotaal), 2)} · {winstTotaalPct >= 0 ? '+' : '-'}{getal(Math.abs(winstTotaalPct), 1)}%
                        </div>
                      </div>
                    </>
                  ) : (<>
                  <div className="belegging-naam">
                    <BeleggingAvatar b={b} />
                    <div>
                      <div className="belegging-naam-text">{b.naam}</div>
                      <div className="belegging-symbol">{b.symbol} · {b.aantal} st.</div>
                    </div>
                  </div>
                  <div className="koers-display"><span className="mobile-stat-label">{t('ov_col_koers')}</span>{muntSym}{koersFmt(huidigePrijs)}</div>
                  <div className="koers-display"><span className="mobile-stat-label">{t('ov_waarde')}</span>€{getal(huidigeWaarde, 2)}</div>
                  <div>
                    <span className="mobile-stat-label">{t('ov_vandaag')}</span>
                    {beursOpen ? (
                      <>
                        <span className={`mobile-hide-amount ${dagVPctRaw >= 0 ? 'pct-pos' : 'pct-neg'}`}>{dagVRaw >= 0 ? '+' : '-'}€{getal(Math.abs(dagVRaw), 2)}</span>
                        {' '}<span className={`badge ${dagVPctRaw >= 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11, padding: '2px 6px' }}>
                          {dagVPctRaw >= 0 ? '+' : ''}{getal(dagVPctRaw, 2)}%
                        </span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </div>
                  <div>
                    <span className="mobile-stat-label">{t('ov_totaal')}</span>
                    <span className={`mobile-hide-amount ${winstTotaal >= 0 ? 'pct-pos' : 'pct-neg'}`}>{winstTotaal >= 0 ? '+' : '-'}€{getal(Math.abs(winstTotaal), 2)}</span>
                    {' '}<span className={`badge ${winstTotaalPct >= 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11, padding: '2px 6px' }}>
                      {winstTotaalPct >= 0 ? '+' : ''}{getal(winstTotaalPct, 2)}%
                    </span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{getal(gewicht, 1)}%</div>
                  </>)}
                  </div>
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
              <h2>{t('ov_filter_titel')}</h2>
              <button className="modal-close" onClick={() => setFilterOpen(false)}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>

              <div className="filter-section">
                <h3>{t('ov_filter_type')}</h3>
                {['alle', 'aandeel', 'etf', 'crypto'].map(ty => (
                  <label key={ty} className="filter-option">
                    <input type="radio" checked={filterType === ty} onChange={() => setFilterType(ty)} />
                    {ty === 'alle' ? t('ov_filter_alle_types') : ty === 'aandeel' ? t('ov_type_aandeel') : ty === 'etf' ? t('ov_type_etf') : t('ov_type_crypto')}
                  </label>
                ))}
              </div>
              <div className="filter-section">
                <h3>{t('ov_filter_beleggingen')}</h3>
                {beleggingen.map(b => (
                  <label key={b.symbol} className="filter-option">
                    <input type="checkbox"
                      checked={filterSymbolen.length === 0 || filterSymbolen.includes(b.symbol)}
                      onChange={e => {
                        const alleSymbolen = beleggingen.map(bb => bb.symbol);
                        // Huidig actieve set: lege array = alles aan
                        const huidigActief = filterSymbolen.length === 0 ? alleSymbolen : [...filterSymbolen];
                        if (e.target.checked) {
                          // Toevoegen aan actieve set
                          const nieuw = huidigActief.includes(b.symbol) ? huidigActief : [...huidigActief, b.symbol];
                          // Als alles aangevinkt → reset naar leeg (= alles)
                          setFilterSymbolen(nieuw.length === alleSymbolen.length ? [] : nieuw);
                        } else {
                          // Verwijderen uit actieve set
                          setFilterSymbolen(huidigActief.filter(s => s !== b.symbol));
                        }
                      }} />
                    {b.symbol}
                  </label>
                ))}
              </div>
              <div className="filter-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                <h3>{t('ov_filter_weergave')}</h3>
                <label className="filter-option">
                  <input type="radio" checked={filterBezit === 'inbezit'} onChange={() => setFilterBezit('inbezit')} />
                  {t('ov_filter_enkel_bezit')}
                </label>
                <label className="filter-option">
                  <input type="radio" checked={filterBezit === 'alles'} onChange={() => setFilterBezit('alles')} />
                  {t('ov_filter_alles_incl')}
                </label>
              </div>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { setFilterType('alle'); setFilterSymbolen([]); setFilterBezit('inbezit'); }}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: 8,
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {t('ov_filter_wis')}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setFilterOpen(false)}>{t('ov_annuleren')}</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setFilterOpen(false)}>{t('ov_toepassen')}</button>
              </div>
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
  const { t } = useApp();
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
            <h2>{t('ov_prestatievergelijking')}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{t('ov_vergelijk_sub')}</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--accent-bg)', borderRadius: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t('ov_je_portfolio')}</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>{t('ov_vs')}</span>
            <VergelijkSelector value={vergelijk1} onChange={setVergelijk1} />
            <span style={{ color: 'var(--text-muted)' }}>{t('ov_vs')}</span>
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
              <Line type="monotone" dataKey="waarde" stroke="#1e3a8a" strokeWidth={2} dot={false} name="Portfolio" />
              {vergelijk1 !== 'geen' && <Line type="monotone" dataKey="benchmark1" stroke={opt1?.kleur} strokeWidth={2} dot={false} name={opt1?.label} />}
              {vergelijk2 !== 'geen' && <Line type="monotone" dataKey="benchmark2" stroke={opt2?.kleur} strokeWidth={2} dot={false} strokeDasharray="5 5" name={opt2?.label} />}
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vaste "+"-knop (enkel mobiel) — blijft zichtbaar tijdens het
          scrollen, in plaats van de header-knop die uit beeld verdwijnt
          zodra je naar beneden scrolt. */}
      {isMobielScherm && (
        <div ref={fabMenuRef} style={{ position: 'fixed', left: 18, bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)', zIndex: 250 }}>
          {toevoegenMenuOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
              background: 'white', border: '1px solid var(--border)', borderRadius: 10,
              boxShadow: 'var(--shadow-md)', minWidth: 200, overflow: 'hidden'
            }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer', fontSize: 14 }}
                onClick={() => { setToevoegenMenuOpen(false); onToevoegen(); }}
              >
                <Edit3 size={15} color="var(--text-muted)" /> {t('ov_manueel')}
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer', fontSize: 14, borderTop: '1px solid var(--border-light)' }}
                onClick={() => { setToevoegenMenuOpen(false); onImporteren && onImporteren(); }}
              >
                <Upload size={15} color="var(--text-muted)" /> {t('ov_importeer')}
              </div>
            </div>
          )}
          <button
            onClick={() => setToevoegenMenuOpen(v => !v)}
            style={{
              width: 56, height: 56, borderRadius: '50%', border: 'none',
              background: 'var(--accent)', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(30,58,138,0.4)',
            }}
            aria-label={t('ov_beleggingen_toevoegen')}
          >
            <Plus size={26} style={{ transform: toevoegenMenuOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
        </div>
      )}
    </div>
  );
}

function VergelijkSelector({ value, onChange }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const geselecteerd = VERGELIJK_OPTIES.find(o => o.id === value);
  const label = (o) => o.id === 'geen' ? t('ov_geen_vergelijking') : o.label;
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
        cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit'
      }}>
        {geselecteerd?.kleur && <span style={{ width: 10, height: 10, borderRadius: '50%', background: geselecteerd.kleur, display: 'inline-block' }} />}
        {geselecteerd && label(geselecteerd)}<ChevronDown size={14} />
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
              {label(o)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
