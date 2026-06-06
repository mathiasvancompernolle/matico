import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { ChevronDown, X } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────
const fmt = (v) => v.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ACCENT = '#6366f1';
const PIE_KLEUREN = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16', '#ec4899', '#14b8a6', '#a855f7', '#eab308'];

// Sector mapping op basis van type/symbol
const SECTOR_MAP = {
  NKE: 'Cyclische consumptiegoederen', NIKE: 'Cyclische consumptiegoederen',
  NVDA: 'Technologie', AMD: 'Technologie', AAPL: 'Technologie', MSFT: 'Technologie',
  GOOGL: 'Technologie', META: 'Technologie', AMZN: 'Technologie',
  TSLA: 'Cyclische consumptiegoederen', BRK: 'Financiën', JPM: 'Financiën', BAC: 'Financiën',
  SOFI: 'Financiën', V: 'Financiën', MA: 'Financiën',
  JNJ: 'Gezondheidszorg', PFE: 'Gezondheidszorg', UNH: 'Gezondheidszorg',
  XOM: 'Energie', CVX: 'Energie',
  ETF: 'ETF',
};
// Regio op basis van beursextensie (.AS, .DE, .L, enz.)
const EXTENSIE_REGIO = {
  // Euronext Amsterdam
  AS: 'Europa - Ontwikkeld',
  // Duitsland (Xetra / Frankfurt)
  DE: 'Europa - Ontwikkeld', F: 'Europa - Ontwikkeld', XETRA: 'Europa - Ontwikkeld',
  // Parijs
  PA: 'Europa - Ontwikkeld',
  // Brussel
  BR: 'Europa - Ontwikkeld',
  // Londen
  L: 'Verenigd Koninkrijk',
  // Zwitserland
  SW: 'Europa - Ontwikkeld', VX: 'Europa - Ontwikkeld',
  // Stockholm / Scandinavië
  ST: 'Europa - Ontwikkeld', HE: 'Europa - Ontwikkeld', CO: 'Europa - Ontwikkeld', OL: 'Europa - Ontwikkeld',
  // Madrid
  MC: 'Europa - Ontwikkeld',
  // Milaan
  MI: 'Europa - Ontwikkeld',
  // Lissabon
  LS: 'Europa - Ontwikkeld',
  // Wenen
  VI: 'Europa - Ontwikkeld',
  // Warschau
  WA: 'Europa - Opkomend',
  // Tokyo
  T: 'Japan', TYO: 'Japan',
  // Hong Kong
  HK: 'Azië - Ontwikkeld',
  // Singapore
  SI: 'Azië - Ontwikkeld',
  // Australië
  AX: 'Australazië',
  // Canada
  TO: 'Noord-Amerika', V: 'Noord-Amerika', CN: 'Noord-Amerika',
  // Brazilië
  SA: 'Latijns-Amerika',
  // Korea
  KS: 'Azië - Ontwikkeld', KQ: 'Azië - Ontwikkeld',
  // Taiwan
  TW: 'Azië - Ontwikkeld',
  // India
  NS: 'Azië - Opkomend', BO: 'Azië - Opkomend',
  // China
  SS: 'Azië - Opkomend', SZ: 'Azië - Opkomend',
  // VS (geen extensie of US extensie)
  US: 'Noord-Amerika', NYSE: 'Noord-Amerika', NASDAQ: 'Noord-Amerika',
};

// Bekende symbolen zonder extensie (vooral grote VS-aandelen)
const SYMBOOL_REGIO = {
  NKE: 'Noord-Amerika', NVDA: 'Noord-Amerika', AAPL: 'Noord-Amerika', MSFT: 'Noord-Amerika',
  GOOGL: 'Noord-Amerika', GOOG: 'Noord-Amerika', META: 'Noord-Amerika', AMZN: 'Noord-Amerika',
  TSLA: 'Noord-Amerika', SOFI: 'Noord-Amerika', V: 'Noord-Amerika', MA: 'Noord-Amerika',
  JPM: 'Noord-Amerika', BAC: 'Noord-Amerika', WMT: 'Noord-Amerika', JNJ: 'Noord-Amerika',
  PG: 'Noord-Amerika', XOM: 'Noord-Amerika', CVX: 'Noord-Amerika', HD: 'Noord-Amerika',
  AVGO: 'Noord-Amerika', LLY: 'Noord-Amerika', UNH: 'Noord-Amerika', COST: 'Noord-Amerika',
  AMD: 'Noord-Amerika', INTC: 'Noord-Amerika', NFLX: 'Noord-Amerika', PYPL: 'Noord-Amerika',
  // Bekende Europese zonder extensie
  ASML: 'Europa - Ontwikkeld', SHELL: 'Verenigd Koninkrijk', SAP: 'Europa - Ontwikkeld',
  NOVO: 'Europa - Ontwikkeld', NESN: 'Europa - Ontwikkeld', ROG: 'Europa - Ontwikkeld',
};

function getSector(b) {
  const sym = b.symbol.toUpperCase().split('.')[0];
  if (b.type === 'etf') return 'ETF';
  if (b.type === 'crypto') return 'Crypto';
  return SECTOR_MAP[sym] || 'Overige';
}

function getRegio(b) {
  const sym = b.symbol.toUpperCase();
  const delen = sym.split('.');
  const basis = delen[0];
  const extensie = delen.length > 1 ? delen[delen.length - 1] : null;

  // 1. Exacte symboolmatch (bijv. NVDA, ASML)
  if (SYMBOOL_REGIO[basis]) return SYMBOOL_REGIO[basis];

  // 2. Beursextensie (bijv. .AS → Amsterdam, .DE → Duitsland)
  if (extensie && EXTENSIE_REGIO[extensie]) return EXTENSIE_REGIO[extensie];

  // 3. Geen extensie en niet bekend → vermoedelijk VS (NYSE/NASDAQ)
  if (delen.length === 1) return 'Noord-Amerika';

  return 'Overige';
}

// ── Staaf component ───────────────────────────────────────────────
function Staaf({ label, waarde, pct, kleur }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: kleur, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 14, fontWeight: 600, marginRight: 8 }}>€{fmt(waarde)}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{pct.toFixed(2)}%</span>
        </div>
      </div>
      <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: kleur, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Hoofd Analyse component ───────────────────────────────────────
export function Analyse() {
  const { beleggingen, koersen, getMuntFactor, verkochteBeleggingen } = useApp();
  const [winstFilter, setWinstFilter] = useState('exclusief'); // 'exclusief' | 'inclusief'
  const [winstDropdown, setWinstDropdown] = useState(false);
  const [spreidingTab, setSpreidingTab] = useState('Type');
  const [spreidingAlles, setSpreidingAlles] = useState(true);
  const [spreidingSubFilter, setSpreidingSubFilter] = useState('Alles');
  const [spreidingDropdownOpen, setSpreidingDropdownOpen] = useState(false);
  const [valutaTab, setValutaTab] = useState('verdeling'); // 'verdeling' | 'wisselkoers'
  const [wisselkoersPeriode, setWisselkoersPeriode] = useState('YTD');
  const [wisselkoersDropdown, setWisselkoersDropdown] = useState(false);

  const factor = (b) => getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);

  // ── Totale winst/verlies berekening ──
  const { kostprijs, huidigeWaarde, winst, winstPct, maxBar } = useMemo(() => {
    const actief = beleggingen;
    const verkocht = winstFilter === 'inclusief' ? (verkochteBeleggingen || []) : [];

    const kp = actief.reduce((s, b) => s + b.kostprijs * b.aantal * factor(b), 0)
      + verkocht.reduce((s, b) => s + b.kostprijs * b.aantalVerkocht * factor(b), 0);

    const hw = actief.reduce((s, b) => {
      const k = koersen[b.symbol];
      return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
    }, 0) + verkocht.reduce((s, b) => s + b.verkoopkoers * b.aantalVerkocht * factor(b), 0);

    const w = hw - kp;
    const wp = kp > 0 ? (w / kp) * 100 : 0;
    return { kostprijs: kp, huidigeWaarde: hw, winst: w, winstPct: wp, maxBar: Math.max(kp, hw) };
  }, [beleggingen, koersen, winstFilter, verkochteBeleggingen]);

  // ── Risicoprofiel (bèta benadering) ──
  const BETA_MAP = { NVDA: 1.96, NKE: 0.85, SOFI: 1.72, MSFT: 0.90, AAPL: 1.20, AMZN: 1.15, TSLA: 2.10 };
  const [risicoInfoOpen, setRisicoInfoOpen] = useState(false);
  const { beta, risicoLabel, risicoKleur, aantalBolletjes, onbekendeBetas } = useMemo(() => {
    const totaal = beleggingen.reduce((s, b) => {
      const k = koersen[b.symbol]; return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
    }, 0) || 1;
    const onbekend = [];
    const gewogenBeta = beleggingen.reduce((s, b) => {
      const k = koersen[b.symbol];
      const w = (k ? k.c : b.kostprijs) * b.aantal * factor(b) / totaal;
      const sym = b.symbol.split('.')[0];
      if (!BETA_MAP[sym]) onbekend.push(b.symbol);
      return s + (BETA_MAP[sym] || 1.0) * w;
    }, 0);
    const label = gewogenBeta < 0.8 ? 'Defensief' : gewogenBeta < 1.2 ? 'Gematigd' : gewogenBeta < 1.6 ? 'Neutraal' : 'Offensief';
    const kleur = gewogenBeta < 0.8 ? 'var(--green)' : gewogenBeta < 1.2 ? '#f59e0b' : gewogenBeta < 1.6 ? '#f97316' : 'var(--red)';
    const bolletjes = gewogenBeta < 0.8 ? 1 : gewogenBeta < 1.2 ? 2 : gewogenBeta < 1.6 ? 3 : 4;
    return { beta: gewogenBeta, risicoLabel: label, risicoKleur: kleur, aantalBolletjes: bolletjes, onbekendeBetas: [...new Set(onbekend)] };
  }, [beleggingen, koersen]);



  // ── Spreiding berekening ──
  const { spreidingData, pieData } = useMemo(() => {
    // ── ETF gewichtendatabase (regio + sector) ──────────────────────
    // Symbolen worden gematcht op prefix: VWCE.DE → VWCE, IWDA.AS → IWDA, enz.
    const ETF_DB = {
      // Vanguard FTSE All-World (VWCE / VWRL)
      VWCE: {
        regio: { 'Noord-Amerika': 64.45, 'Europa - Ontwikkeld': 10.92, 'Azië - Ontwikkeld': 6.13, 'Japan': 5.83, 'Azië - Opkomend': 5.15, 'Verenigd Koninkrijk': 3.19, 'Australazië': 1.67, 'Afrika/Midden-Oosten': 1.34, 'Latijns-Amerika': 1.03, 'Europa - Opkomend': 0.29 },
        sector: { 'Technologie': 29.0, 'Financiële dienstverlening': 16.1, 'Industrie': 11.0, 'Cyclische consumptiegoederen': 9.4, 'Communicatiediensten': 8.8, 'Gezondheidszorg': 8.0, 'Defensieve consumptiegoederen': 4.9, 'Energie': 4.2, 'Basismaterialen': 3.8, 'Nutsbedrijven': 2.7, 'Vastgoed': 1.9 }
      },
      VWRL: {
        regio: { 'Noord-Amerika': 64.45, 'Europa - Ontwikkeld': 10.92, 'Azië - Ontwikkeld': 6.13, 'Japan': 5.83, 'Azië - Opkomend': 5.15, 'Verenigd Koninkrijk': 3.19, 'Australazië': 1.67, 'Afrika/Midden-Oosten': 1.34, 'Latijns-Amerika': 1.03, 'Europa - Opkomend': 0.29 },
        sector: { 'Technologie': 29.0, 'Financiële dienstverlening': 16.1, 'Industrie': 11.0, 'Cyclische consumptiegoederen': 9.4, 'Communicatiediensten': 8.8, 'Gezondheidszorg': 8.0, 'Defensieve consumptiegoederen': 4.9, 'Energie': 4.2, 'Basismaterialen': 3.8, 'Nutsbedrijven': 2.7, 'Vastgoed': 1.9 }
      },
      // iShares Core MSCI World (IWDA / SWRD)
      IWDA: {
        regio: { 'Noord-Amerika': 72.1, 'Europa - Ontwikkeld': 13.8, 'Japan': 6.2, 'Azië - Ontwikkeld': 4.1, 'Verenigd Koninkrijk': 2.9, 'Australazië': 0.9 },
        sector: { 'Technologie': 25.2, 'Financiële dienstverlening': 15.8, 'Gezondheidszorg': 12.1, 'Industrie': 11.3, 'Cyclische consumptiegoederen': 10.4, 'Communicatiediensten': 8.6, 'Defensieve consumptiegoederen': 6.8, 'Energie': 4.5, 'Basismaterialen': 3.2, 'Nutsbedrijven': 2.1 }
      },
      SWRD: {
        regio: { 'Noord-Amerika': 72.1, 'Europa - Ontwikkeld': 13.8, 'Japan': 6.2, 'Azië - Ontwikkeld': 4.1, 'Verenigd Koninkrijk': 2.9, 'Australazië': 0.9 },
        sector: { 'Technologie': 25.2, 'Financiële dienstverlening': 15.8, 'Gezondheidszorg': 12.1, 'Industrie': 11.3, 'Cyclische consumptiegoederen': 10.4, 'Communicatiediensten': 8.6, 'Defensieve consumptiegoederen': 6.8, 'Energie': 4.5, 'Basismaterialen': 3.2, 'Nutsbedrijven': 2.1 }
      },
      // iShares Emerging Markets (EMIM / EEM / IEMA)
      EMIM: {
        regio: { 'China': 27.5, 'India': 18.2, 'Taiwan': 16.8, 'Zuid-Korea': 11.3, 'Brazilië': 5.4, 'Saudi-Arabië': 4.1, 'Zuid-Afrika': 3.2, 'Mexico': 2.8, 'Overige opkomende markten': 10.7 },
        sector: { 'Financiële dienstverlening': 22.4, 'Technologie': 20.1, 'Cyclische consumptiegoederen': 13.8, 'Communicatiediensten': 9.6, 'Energie': 6.8, 'Industrie': 6.4, 'Basismaterialen': 6.2, 'Gezondheidszorg': 4.8, 'Defensieve consumptiegoederen': 4.5, 'Vastgoed': 3.2, 'Nutsbedrijven': 2.2 }
      },
      IEMA: {
        regio: { 'China': 27.5, 'India': 18.2, 'Taiwan': 16.8, 'Zuid-Korea': 11.3, 'Brazilië': 5.4, 'Saudi-Arabië': 4.1, 'Zuid-Afrika': 3.2, 'Mexico': 2.8, 'Overige opkomende markten': 10.7 },
        sector: { 'Financiële dienstverlening': 22.4, 'Technologie': 20.1, 'Cyclische consumptiegoederen': 13.8, 'Communicatiediensten': 9.6, 'Energie': 6.8, 'Industrie': 6.4, 'Basismaterialen': 6.2, 'Gezondheidszorg': 4.8, 'Defensieve consumptiegoederen': 4.5, 'Vastgoed': 3.2, 'Nutsbedrijven': 2.2 }
      },
      EEM: {
        regio: { 'China': 27.5, 'India': 18.2, 'Taiwan': 16.8, 'Zuid-Korea': 11.3, 'Brazilië': 5.4, 'Saudi-Arabië': 4.1, 'Zuid-Afrika': 3.2, 'Mexico': 2.8, 'Overige opkomende markten': 10.7 },
        sector: { 'Financiële dienstverlening': 22.4, 'Technologie': 20.1, 'Cyclische consumptiegoederen': 13.8, 'Communicatiediensten': 9.6, 'Energie': 6.8, 'Industrie': 6.4, 'Basismaterialen': 6.2, 'Gezondheidszorg': 4.8, 'Defensieve consumptiegoederen': 4.5, 'Vastgoed': 3.2, 'Nutsbedrijven': 2.2 }
      },
      // Invesco NASDAQ-100 (EQQQ / QQQ / CNDX)
      EQQQ: {
        regio: { 'Noord-Amerika': 94.8, 'Europa - Ontwikkeld': 2.1, 'Azië - Ontwikkeld': 1.8, 'Overige': 1.3 },
        sector: { 'Technologie': 51.2, 'Communicatiediensten': 16.8, 'Cyclische consumptiegoederen': 14.3, 'Gezondheidszorg': 6.4, 'Industrie': 4.8, 'Financiële dienstverlening': 3.1, 'Defensieve consumptiegoederen': 1.8, 'Overige': 1.6 }
      },
      CNDX: {
        regio: { 'Noord-Amerika': 94.8, 'Europa - Ontwikkeld': 2.1, 'Azië - Ontwikkeld': 1.8, 'Overige': 1.3 },
        sector: { 'Technologie': 51.2, 'Communicatiediensten': 16.8, 'Cyclische consumptiegoederen': 14.3, 'Gezondheidszorg': 6.4, 'Industrie': 4.8, 'Financiële dienstverlening': 3.1, 'Defensieve consumptiegoederen': 1.8, 'Overige': 1.6 }
      },
      QQQ: {
        regio: { 'Noord-Amerika': 94.8, 'Europa - Ontwikkeld': 2.1, 'Azië - Ontwikkeld': 1.8, 'Overige': 1.3 },
        sector: { 'Technologie': 51.2, 'Communicatiediensten': 16.8, 'Cyclische consumptiegoederen': 14.3, 'Gezondheidszorg': 6.4, 'Industrie': 4.8, 'Financiële dienstverlening': 3.1, 'Defensieve consumptiegoederen': 1.8, 'Overige': 1.6 }
      },
      // iShares S&P 500 (CSPX / SXR8 / IVV / SPY / IUSA)
      CSPX: {
        regio: { 'Noord-Amerika': 99.5, 'Overige': 0.5 },
        sector: { 'Technologie': 29.3, 'Financiële dienstverlening': 13.8, 'Gezondheidszorg': 12.4, 'Cyclische consumptiegoederen': 10.9, 'Communicatiediensten': 8.9, 'Industrie': 8.4, 'Defensieve consumptiegoederen': 6.2, 'Energie': 3.7, 'Nutsbedrijven': 2.5, 'Basismaterialen': 2.3, 'Vastgoed': 2.1 }
      },
      SXR8: {
        regio: { 'Noord-Amerika': 99.5, 'Overige': 0.5 },
        sector: { 'Technologie': 29.3, 'Financiële dienstverlening': 13.8, 'Gezondheidszorg': 12.4, 'Cyclische consumptiegoederen': 10.9, 'Communicatiediensten': 8.9, 'Industrie': 8.4, 'Defensieve consumptiegoederen': 6.2, 'Energie': 3.7, 'Nutsbedrijven': 2.5, 'Basismaterialen': 2.3, 'Vastgoed': 2.1 }
      },
      IUSA: {
        regio: { 'Noord-Amerika': 99.5, 'Overige': 0.5 },
        sector: { 'Technologie': 29.3, 'Financiële dienstverlening': 13.8, 'Gezondheidszorg': 12.4, 'Cyclische consumptiegoederen': 10.9, 'Communicatiediensten': 8.9, 'Industrie': 8.4, 'Defensieve consumptiegoederen': 6.2, 'Energie': 3.7, 'Nutsbedrijven': 2.5, 'Basismaterialen': 2.3, 'Vastgoed': 2.1 }
      },
      IVV: {
        regio: { 'Noord-Amerika': 99.5, 'Overige': 0.5 },
        sector: { 'Technologie': 29.3, 'Financiële dienstverlening': 13.8, 'Gezondheidszorg': 12.4, 'Cyclische consumptiegoederen': 10.9, 'Communicatiediensten': 8.9, 'Industrie': 8.4, 'Defensieve consumptiegoederen': 6.2, 'Energie': 3.7, 'Nutsbedrijven': 2.5, 'Basismaterialen': 2.3, 'Vastgoed': 2.1 }
      },
      SPY: {
        regio: { 'Noord-Amerika': 99.5, 'Overige': 0.5 },
        sector: { 'Technologie': 29.3, 'Financiële dienstverlening': 13.8, 'Gezondheidszorg': 12.4, 'Cyclische consumptiegoederen': 10.9, 'Communicatiediensten': 8.9, 'Industrie': 8.4, 'Defensieve consumptiegoederen': 6.2, 'Energie': 3.7, 'Nutsbedrijven': 2.5, 'Basismaterialen': 2.3, 'Vastgoed': 2.1 }
      },
      // Xtrackers MSCI World (XDWD / XWLD)
      XDWD: {
        regio: { 'Noord-Amerika': 71.8, 'Europa - Ontwikkeld': 14.2, 'Japan': 6.4, 'Azië - Ontwikkeld': 3.9, 'Verenigd Koninkrijk': 2.8, 'Australazië': 0.9 },
        sector: { 'Technologie': 24.9, 'Financiële dienstverlening': 15.6, 'Gezondheidszorg': 12.3, 'Industrie': 11.5, 'Cyclische consumptiegoederen': 10.2, 'Communicatiediensten': 8.4, 'Defensieve consumptiegoederen': 7.1, 'Energie': 4.4, 'Basismaterialen': 3.3, 'Nutsbedrijven': 2.3 }
      },
      XWLD: {
        regio: { 'Noord-Amerika': 71.8, 'Europa - Ontwikkeld': 14.2, 'Japan': 6.4, 'Azië - Ontwikkeld': 3.9, 'Verenigd Koninkrijk': 2.8, 'Australazië': 0.9 },
        sector: { 'Technologie': 24.9, 'Financiële dienstverlening': 15.6, 'Gezondheidszorg': 12.3, 'Industrie': 11.5, 'Cyclische consumptiegoederen': 10.2, 'Communicatiediensten': 8.4, 'Defensieve consumptiegoederen': 7.1, 'Energie': 4.4, 'Basismaterialen': 3.3, 'Nutsbedrijven': 2.3 }
      },
      // Amundi MSCI World / Prime All Country (LCWD / CW8 / WEBG / PRAW)
      LCWD: {
        regio: { 'Noord-Amerika': 71.5, 'Europa - Ontwikkeld': 14.0, 'Japan': 6.3, 'Azië - Ontwikkeld': 4.2, 'Verenigd Koninkrijk': 3.1, 'Australazië': 0.9 },
        sector: { 'Technologie': 25.1, 'Financiële dienstverlening': 15.9, 'Gezondheidszorg': 12.0, 'Industrie': 11.2, 'Cyclische consumptiegoederen': 10.6, 'Communicatiediensten': 8.5, 'Defensieve consumptiegoederen': 6.9, 'Energie': 4.3, 'Basismaterialen': 3.4, 'Nutsbedrijven': 2.1 }
      },
      WEBG: {
        regio: { 'Noord-Amerika': 64.2, 'Europa - Ontwikkeld': 10.8, 'Japan': 5.9, 'Azië - Ontwikkeld': 6.1, 'Azië - Opkomend': 5.4, 'Verenigd Koninkrijk': 3.1, 'Australazië': 1.6, 'Latijns-Amerika': 1.1, 'Overige': 1.8 },
        sector: { 'Technologie': 28.8, 'Financiële dienstverlening': 16.0, 'Industrie': 10.9, 'Cyclische consumptiegoederen': 9.5, 'Communicatiediensten': 8.7, 'Gezondheidszorg': 8.1, 'Defensieve consumptiegoederen': 4.8, 'Energie': 4.1, 'Basismaterialen': 3.7, 'Nutsbedrijven': 2.6, 'Vastgoed': 2.8 }
      },
      PRAW: {
        regio: { 'Noord-Amerika': 64.2, 'Europa - Ontwikkeld': 10.8, 'Japan': 5.9, 'Azië - Ontwikkeld': 6.1, 'Azië - Opkomend': 5.4, 'Verenigd Koninkrijk': 3.1, 'Australazië': 1.6, 'Latijns-Amerika': 1.1, 'Overige': 1.8 },
        sector: { 'Technologie': 28.8, 'Financiële dienstverlening': 16.0, 'Industrie': 10.9, 'Cyclische consumptiegoederen': 9.5, 'Communicatiediensten': 8.7, 'Gezondheidszorg': 8.1, 'Defensieve consumptiegoederen': 4.8, 'Energie': 4.1, 'Basismaterialen': 3.7, 'Nutsbedrijven': 2.6, 'Vastgoed': 2.8 }
      },
      // iShares Core EURO STOXX 50 (CSX5 / EUE / EUEA)
      CSX5: {
        regio: { 'Frankrijk': 38.2, 'Duitsland': 27.4, 'Nederland': 12.8, 'Spanje': 9.6, 'Finland': 4.2, 'Italië': 3.9, 'Ierland': 2.1, 'België': 1.8 },
        sector: { 'Financiële dienstverlening': 19.8, 'Industrie': 17.4, 'Technologie': 12.6, 'Gezondheidszorg': 11.8, 'Defensieve consumptiegoederen': 10.4, 'Energie': 7.9, 'Cyclische consumptiegoederen': 7.2, 'Basismaterialen': 5.6, 'Nutsbedrijven': 4.8, 'Overige': 2.5 }
      },
      // iShares Core MSCI Europe (SMEA / IMEU / IEUA)
      SMEA: {
        regio: { 'Verenigd Koninkrijk': 22.4, 'Frankrijk': 18.3, 'Zwitserland': 14.8, 'Duitsland': 12.6, 'Nederland': 7.2, 'Zweden': 5.4, 'Denemarken': 4.8, 'Spanje': 4.2, 'Overige Europa': 10.3 },
        sector: { 'Financiële dienstverlening': 18.6, 'Industrie': 16.2, 'Gezondheidszorg': 14.8, 'Defensieve consumptiegoederen': 13.4, 'Technologie': 8.9, 'Cyclische consumptiegoederen': 8.2, 'Energie': 6.8, 'Basismaterialen': 5.9, 'Nutsbedrijven': 4.4, 'Vastgoed': 2.8 }
      },
      IMEU: {
        regio: { 'Verenigd Koninkrijk': 22.4, 'Frankrijk': 18.3, 'Zwitserland': 14.8, 'Duitsland': 12.6, 'Nederland': 7.2, 'Zweden': 5.4, 'Denemarken': 4.8, 'Spanje': 4.2, 'Overige Europa': 10.3 },
        sector: { 'Financiële dienstverlening': 18.6, 'Industrie': 16.2, 'Gezondheidszorg': 14.8, 'Defensieve consumptiegoederen': 13.4, 'Technologie': 8.9, 'Cyclische consumptiegoederen': 8.2, 'Energie': 6.8, 'Basismaterialen': 5.9, 'Nutsbedrijven': 4.4, 'Vastgoed': 2.8 }
      },
      // SPDR S&P 500 ETF / World
      GWL: {
        regio: { 'Noord-Amerika': 99.5, 'Overige': 0.5 },
        sector: { 'Technologie': 29.3, 'Financiële dienstverlening': 13.8, 'Gezondheidszorg': 12.4, 'Cyclische consumptiegoederen': 10.9, 'Communicatiediensten': 8.9, 'Industrie': 8.4, 'Defensieve consumptiegoederen': 6.2, 'Energie': 3.7, 'Nutsbedrijven': 2.5, 'Basismaterialen': 2.3, 'Vastgoed': 2.1 }
      },
    };

    // Zoek ETF op symboolprefix (VWCE.DE → VWCE, IWDA.AS → IWDA, enz.)
    const zoekETF = (symbol) => {
      if (!symbol) return null;
      const sym = symbol.toUpperCase();
      if (ETF_DB[sym]) return ETF_DB[sym];
      const basis = sym.split('.')[0];
      if (ETF_DB[basis]) return ETF_DB[basis];
      return null;
    };

    const getEtfGewichten = (sym, type) => {
      const etf = zoekETF(sym);
      if (etf) return type === 'regio' ? etf.regio : etf.sector;
      return null;
    };

    // Totaal portfolio waarde (altijd op basis van alle beleggingen voor % berekening)
    const totaal = beleggingen.reduce((s, b) => {
      const k = koersen[b.symbol]; return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
    }, 0) || 1;

    // Welke beleggingen tonen op basis van subfilter
    const gefilterd = beleggingen.filter(b => {
      if (spreidingTab === 'Type') return true;
      if (spreidingSubFilter === 'Alles') return true;
      if (spreidingSubFilter === 'Aandelen') return b.type !== 'etf' && b.type !== 'crypto';
      if (spreidingSubFilter === 'ETFs') return b.type === 'etf';
      return true;
    });

    // Type tab: simpele groepering
    if (spreidingTab === 'Type') {
      const map = {};
      beleggingen.forEach(b => {
        const k = koersen[b.symbol];
        const w = (k ? k.c : b.kostprijs) * b.aantal * factor(b);
        const label = b.type === 'etf' ? 'ETFs' : b.type === 'crypto' ? 'Crypto' : 'Aandelen';
        map[label] = (map[label] || 0) + w;
      });
      const data = Object.entries(map)
        .map(([label, w]) => ({ label, waarde: w, pct: (w / totaal) * 100 }))
        .sort((a, b) => b.waarde - a.waarde);
      return { spreidingData: data, pieData: data };
    }

    // Sectoren of Regio: ETFs uitgesplitst op basis van interne gewichten
    const isRegio = spreidingTab === 'Regio';
    // gewichten worden nu via getEtfGewichten(sym, type) opgehaald
    const map = {};

    gefilterd.forEach(b => {
      const k = koersen[b.symbol];
      const w = (k ? k.c : b.kostprijs) * b.aantal * factor(b);

      if (b.type === 'etf') {
        const gewichten = getEtfGewichten(b.symbol, isRegio ? 'regio' : 'sector');
        if (gewichten) {
          // Verdeel ETF waarde proportioneel over regio's/sectoren
          Object.entries(gewichten).forEach(([cat, pctInEtf]) => {
            map[cat] = (map[cat] || 0) + w * (pctInEtf / 100);
          });
        } else {
          // Geen data: toon als "Wereldwijd" of "Overige"
          const fallback = isRegio ? 'Wereldwijd' : 'Overige';
          map[fallback] = (map[fallback] || 0) + w;
        }
      } else {
        // Directe aandelen: gebruik sector/regio mapping
        const label = isRegio ? getRegio(b) : getSector(b);
        map[label] = (map[label] || 0) + w;
      }
    });

    const data = Object.entries(map)
      .map(([label, w]) => ({ label, waarde: w, pct: (w / totaal) * 100 }))
      .filter(d => d.waarde > 0)
      .sort((a, b) => b.waarde - a.waarde);

    return { spreidingData: data, pieData: data };
  }, [beleggingen, koersen, spreidingTab, spreidingSubFilter]);

  // ── Concentratierisico ──
  const { grootstePct, grootsteSym, topSector, topSectorPct, topRegio, topRegioPct, concentratieTips } = useMemo(() => {
    const totaal = beleggingen.reduce((s, b) => {
      const k = koersen[b.symbol]; return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
    }, 0) || 1;
    const posities = beleggingen.map(b => {
      const k = koersen[b.symbol];
      return { sym: b.symbol, naam: b.naam, pct: ((k ? k.c : b.kostprijs) * b.aantal * factor(b) / totaal) * 100, type: b.type };
    }).sort((a, b) => b.pct - a.pct);
    const sectorMap = {}; const regioMap = {};
    beleggingen.forEach(b => {
      const k = koersen[b.symbol];
      const w = ((k ? k.c : b.kostprijs) * b.aantal * factor(b) / totaal) * 100;
      const s = getSector(b); const r = getRegio(b);
      sectorMap[s] = (sectorMap[s] || 0) + w;
      regioMap[r] = (regioMap[r] || 0) + w;
    });
    const topS = Object.entries(sectorMap).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
    const topR = Object.entries(regioMap).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
    const top2S = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]).slice(0, 2);
    const top2R = Object.entries(regioMap).sort((a, b) => b[1] - a[1]).slice(0, 2);
    const aantalPosities = posities.length;
    const aandelenPct = posities.filter(p => p.type !== 'etf' && p.type !== 'crypto').reduce((s, p) => s + p.pct, 0);
    const top2Pct = posities.slice(0, 2).reduce((s, p) => s + p.pct, 0);

    // Slimme tips genereren op basis van de werkelijke cijfers
    const tips = [];

    // 1. Eén positie domineert
    if (posities[0]?.pct > 50) {
      tips.push(`${posities[0].sym} maakt ${posities[0].pct.toFixed(0)}% van je portfolio uit. Dat is een erg hoge concentratie — bij een koersdaling van 10% daalt je portfolio al met ${(posities[0].pct * 0.1).toFixed(1)}%.`);
    } else if (posities[0]?.pct > 30) {
      tips.push(`${posities[0].sym} is je grootste positie met ${posities[0].pct.toFixed(0)}%. Overweeg of dit gewicht past bij je risicoprofiel.`);
    }

    // 2. Top 2 posities nemen te veel in
    if (aantalPosities >= 3 && top2Pct > 70) {
      tips.push(`Je twee grootste posities (${posities[0]?.sym} en ${posities[1]?.sym}) maken samen ${top2Pct.toFixed(0)}% uit. Grotere spreiding verlaagt je risico.`);
    }

    // 3. Sector concentratie
    if (topS[1] > 60) {
      tips.push(`${topS[1].toFixed(0)}% van je portfolio zit in ${topS[0]}. Een sectorcrisis zou een grote impact hebben.`);
    } else if (topS[1] > 40 && top2S.length > 1) {
      tips.push(`${topS[1].toFixed(0)}% zit indirect in ${topS[0]}, na doorrekening van je ETF-posities. ${top2S[1] ? top2S[1][1].toFixed(0) + '% in ' + top2S[1][0] + '.' : ''}`);
    }

    // 4. Regio concentratie
    if (topR[1] > 80) {
      tips.push(`${topR[1].toFixed(0)}% is indirect blootgesteld aan ${topR[0]}. Geografische spreiding naar andere regio's kan het risico verlagen.`);
    } else if (topR[1] > 60) {
      tips.push(`${topR[1].toFixed(0)}% is indirect blootgesteld aan ${topR[0]}.`);
    }

    // 5. Te weinig posities
    if (aantalPosities === 1) {
      tips.push(`Je hebt slechts 1 positie. Voeg meer beleggingen toe voor betere spreiding.`);
    } else if (aantalPosities === 2 && aandelenPct > 50) {
      tips.push(`Met slechts 2 posities is je portfolio weinig gespreid. Overweeg een breed ETF toe te voegen.`);
    }

    // 6. Geen ETF in portfolio
    if (!beleggingen.some(b => b.type === 'etf') && aantalPosities < 5) {
      tips.push(`Je portfolio bestaat enkel uit individuele aandelen. Een breed ETF zoals VWCE kan eenvoudig voor extra spreiding zorgen.`);
    }

    // 7. Alles goed — positieve tip
    if (tips.length === 0) {
      tips.push(`Je portfolio is goed gespreid over ${aantalPosities} posities, ${Object.keys(sectorMap).length} sectoren en ${Object.keys(regioMap).length} regio's.`);
    }

    return {
      grootstePct: posities[0]?.pct || 0, grootsteSym: posities[0]?.sym || '—',
      topSector: topS[0], topSectorPct: topS[1],
      topRegio: topR[0], topRegioPct: topR[1],
      concentratieTips: tips,
    };
  }, [beleggingen, koersen]);

  // ── ETF X-ray (simulatie met top holdings) ──
  const etfs = beleggingen.filter(b => b.type === 'etf');
  const ETF_HOLDINGS = {
    'VWCE.XETRA': [
      { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 1.82 },
      { sym: 'AAPL.US', naam: 'Apple Inc', pct: 1.53 },
      { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 1.18 },
      { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 0.99 },
      { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 0.87 },
      { sym: 'AVGO.US', naam: 'Broadcom Inc', pct: 0.75 },
      { sym: 'GOOG.US', naam: 'Alphabet Inc Class C', pct: 0.71 },
      { sym: '2330.TW', naam: 'Taiwan Semiconductor Manufacturing Co. Ltd.', pct: 0.64 },
      { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 0.52 },
      { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 0.43 },
    ],
  };

  if (beleggingen.length === 0) {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div className="page-header" style={{ marginBottom: 24 }}><h1>Analyse</h1></div>
        <div style={{ padding: '0 32px' }}>
          <div className="empty-state card"><h3>Nog geen beleggingen</h3><p>Voeg beleggingen toe om je portfolio te analyseren</p></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 60px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}><h1>Analyse</h1></div>
      <div style={{ padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Rij 1: Totale winst/verlies + Risicoprofiel ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Totale winst/verlies */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Totale winst/verlies</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Van je portfolio</div>
              </div>
              {/* Dropdown filter */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setWinstDropdown(o => !o)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit'
                }}>
                  {winstFilter === 'exclusief' ? 'Exclusief verkochte beleggingen' : 'Inclusief verkochte beleggingen'}
                  <ChevronDown size={13} />
                </button>
                {winstDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white',
                    border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)',
                    zIndex: 20, minWidth: 240, overflow: 'hidden'
                  }}>
                    {['exclusief', 'inclusief'].map(opt => (
                      <div key={opt} onClick={() => { setWinstFilter(opt); setWinstDropdown(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
                          cursor: 'pointer', fontSize: 13, fontWeight: winstFilter === opt ? 600 : 400,
                          background: winstFilter === opt ? 'var(--accent-bg)' : 'transparent',
                          color: winstFilter === opt ? 'var(--accent)' : 'var(--text-primary)'
                        }}
                        onMouseEnter={e => { if (winstFilter !== opt) e.currentTarget.style.background = 'var(--bg)'; }}
                        onMouseLeave={e => { if (winstFilter !== opt) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {winstFilter === opt && <span style={{ fontSize: 14 }}>✓</span>}
                        {opt === 'exclusief' ? 'Exclusief verkochte beleggingen' : 'Inclusief verkochte beleggingen'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Staven */}
            <div style={{ marginBottom: 20 }}>
              {[
                { label: 'Kostprijs', waarde: kostprijs, kleur: 'var(--text-muted)' },
                { label: 'Huidige waarde', waarde: huidigeWaarde, kleur: ACCENT },
              ].map(({ label, waarde, kleur }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: kleur, display: 'inline-block' }} />
                      {label}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>€{fmt(waarde)}</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--border-light)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(waarde / maxBar) * 100}%`, background: kleur, borderRadius: 5, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Winst/verlies totaal</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: winst >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {winst >= 0 ? '+' : ''}€{fmt(Math.abs(winst))}
                </span>
                <span style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: winst >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
                  color: winst >= 0 ? 'var(--green)' : 'var(--red)'
                }}>
                  {winst >= 0 ? '+' : ''}{winstPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Risicoprofiel */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Risicoprofiel</div>
              <button onClick={() => setRisicoInfoOpen(true)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center',
                borderRadius: '50%', transition: 'color 0.15s'
              }} title="Meer info over risicoprofiel">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Van je portfolio</div>

            <div style={{
              padding: '12px 16px', background: 'var(--accent-bg)',
              border: '1px solid var(--accent-light)', borderRadius: 10, marginBottom: 24, fontSize: 13,
              color: 'var(--accent)', display: 'flex', alignItems: 'flex-start', gap: 8
            }}>
              <span>💡</span>
              <span>Bij een marktdaling van 10%, daalt jouw portfolio gemiddeld {(beta * 10).toFixed(1)}%.</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Marktinvloed (Bèta)</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{beta.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Risiconiveau</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: i <= aantalBolletjes ? risicoKleur : 'var(--border)'
                      }} />
                    ))}
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: `${risicoKleur}20`, color: risicoKleur
                  }}>{risicoLabel}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Risico info modal */}
          {risicoInfoOpen && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }} onClick={() => setRisicoInfoOpen(false)}>
              <div style={{
                background: 'var(--bg-white)', borderRadius: 16, padding: '32px',
                width: 520, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)', position: 'relative'
              }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700 }}>Wat is het risicoprofiel?</h2>
                  <button onClick={() => setRisicoInfoOpen(false)} style={{
                    background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer',
                    borderRadius: 8, padding: '4px 8px', color: 'var(--text-muted)', fontSize: 14
                  }}>✕</button>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 24 }}>
                  Het risicoprofiel is gebaseerd op de marktinvloed van je totale portfolio, oftewel de bèta in beursjargon.
                  Het meet hoe sterk je beleggingen reageren op marktbewegingen. Een marktinvloed van 1,0 betekent dat
                  je portfolio gemiddeld evenveel beweegt als de markt.
                </p>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>De vier risiconiveaus die Matico gebruikt</div>
                {[
                  { label: 'Defensief', kleur: 'var(--green)', beschrijving: 'Bèta lager dan 1,0. Bij een marktdaling van 10% daalt je portfolio gemiddeld minder dan 10%.' },
                  { label: 'Neutraal', kleur: '#6366f1', beschrijving: 'Bèta van 1,0 tot 1,5. Je portfolio beweegt grofweg mee met de markt, met iets hogere uitslagen.' },
                  { label: 'Offensief', kleur: '#f97316', beschrijving: 'Bèta van 1,5 tot 2,5. Je portfolio reageert duidelijk sterker op marktbewegingen.' },
                  { label: 'Speculatief', kleur: 'var(--red)', beschrijving: 'Bèta vanaf 2,5. Zeer hoge gevoeligheid voor schommelingen, met grotere op- en neerwaartse bewegingen.' },
                ].map(({ label, kleur, beschrijving }) => (
                  <div key={label} style={{
                    border: `1px solid var(--border)`, borderLeft: `4px solid ${kleur}`,
                    borderRadius: 10, padding: '14px 16px', marginBottom: 12
                  }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: `${kleur}18`, color: kleur, marginBottom: 8
                    }}>{label}</span>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{beschrijving}</p>
                  </div>
                ))}
                {onbekendeBetas.length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Niet meegenomen in berekening</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      Voor deze aandelen of ETF's was er geen marktinvloed beschikbaar in onze databron:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {onbekendeBetas.map(sym => <li key={sym} style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{sym}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Spreiding ── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Spreiding</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Van je portfolio</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['Type', 'Sectoren', 'Regio'].map(t => (
                <button key={t} onClick={() => { setSpreidingTab(t); setSpreidingSubFilter('Alles'); setSpreidingDropdownOpen(false); }} style={{
                  padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)',
                  background: spreidingTab === t ? 'var(--text-primary)' : 'transparent',
                  color: spreidingTab === t ? 'white' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Subfilter dropdown (niet bij Type) */}
          {spreidingTab !== 'Type' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setSpreidingDropdownOpen(o => !o)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                  border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit'
                }}>
                  {spreidingSubFilter} <ChevronDown size={13} />
                </button>
                {spreidingDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white',
                    border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)',
                    zIndex: 20, minWidth: 130, overflow: 'hidden'
                  }}>
                    {['Alles', 'Aandelen', 'ETFs'].map(opt => (
                      <div key={opt} onClick={() => { setSpreidingSubFilter(opt); setSpreidingDropdownOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
                          cursor: 'pointer', fontSize: 13,
                          fontWeight: spreidingSubFilter === opt ? 600 : 400,
                          background: spreidingSubFilter === opt ? 'var(--accent-bg)' : 'transparent',
                          color: spreidingSubFilter === opt ? 'var(--accent)' : 'var(--text-primary)'
                        }}
                        onMouseEnter={e => { if (spreidingSubFilter !== opt) e.currentTarget.style.background = 'var(--bg)'; }}
                        onMouseLeave={e => { if (spreidingSubFilter !== opt) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {spreidingSubFilter === opt && <span style={{ fontSize: 12 }}>✓</span>}
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32, alignItems: 'flex-start' }}>
            {/* Donut — sticky naast de legenda */}
            <div style={{ position: 'sticky', top: 0, height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="pct" nameKey="label" cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_KLEUREN[i % PIE_KLEUREN.length]} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const { name, value, payload: p } = payload[0];
                    const kleur = p.fill || PIE_KLEUREN[0];
                    return (
                      <div style={{
                        background: 'white', border: `1.5px solid ${kleur}`,
                        borderRadius: 8, padding: '7px 12px', fontSize: 13,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
                      }}>
                        <span style={{ color: kleur, fontWeight: 700 }}>{name}</span>
                        <span style={{ color: kleur, marginLeft: 8 }}>{value.toFixed(2)}%</span>
                      </div>
                    );
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legenda — volledig uitklappen, geen scroll */}
            <div>
              {spreidingData.map((item, i) => (
                <Staaf key={item.label} label={item.label} waarde={item.waarde} pct={item.pct} kleur={PIE_KLEUREN[i % PIE_KLEUREN.length]} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Rij 3: Concentratierisico + Valutablootstelling ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Concentratierisico */}
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Concentratierisico</div>
            {concentratieTips.map((tip, i) => (
              <div key={i} style={{
                padding: '11px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent-light)',
                borderRadius: 10, marginBottom: 12, fontSize: 13, color: 'var(--accent)',
                display: 'flex', alignItems: 'flex-start', gap: 8
              }}>
                <span style={{ flexShrink: 0 }}>💡</span>
                <span style={{ lineHeight: 1.5 }}>{tip}</span>
              </div>
            ))}
            {[
              { label: 'Grootste positie', waarde: grootsteSym, pct: grootstePct },
              { label: 'Top sector', waarde: topSector, pct: topSectorPct },
              { label: 'Top regio', waarde: topRegio, pct: topRegioPct },
            ].map(({ label, waarde, pct }) => (
              <div key={label} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{waarde} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{pct.toFixed(0)}%</span></div>
                <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: ACCENT, borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Valutablootstelling */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Valutablootstelling</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['verdeling', 'wisselkoers'].map(t => (
                  <button key={t} onClick={() => setValutaTab(t)} style={{
                    padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)',
                    background: valutaTab === t ? 'var(--text-primary)' : 'transparent',
                    color: valutaTab === t ? 'white' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
                  }}>{t === 'verdeling' ? 'Valutaverdeling' : 'Wisselkoerseffect'}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Van je portfolio, inclusief ETF-blootstelling</div>

            {valutaTab === 'verdeling' ? (() => {
              // Valutaverdeling: ETFs uitgesplitst per valuta via regio gewichten
              const ETF_VALUTA = {
                VWCE: { USD: 64.8, EUR: 12.1, JPY: 5.8, GBP: 3.2, TWD: 2.1, KRW: 1.8, CHF: 1.4, AUD: 1.3, CAD: 2.8, HKD: 1.2, Overige: 3.5 },
                IWDA: { USD: 72.1, EUR: 13.8, JPY: 6.2, GBP: 2.9, CHF: 1.8, AUD: 0.9, CAD: 1.2, HKD: 0.6, Overige: 0.5 },
                EQQQ: { USD: 95.2, EUR: 2.1, Overige: 2.7 },
                CSPX: { USD: 99.5, Overige: 0.5 },
                SXR8: { USD: 99.5, Overige: 0.5 },
                EMIM: { TWD: 16.8, INR: 13.2, CNY: 12.4, KRW: 11.3, BRL: 5.4, ZAR: 3.8, SAR: 4.1, MXN: 2.8, Overige: 30.2 },
              };
              const zoekETFValuta = (sym) => {
                const basis = sym.toUpperCase().split('.')[0];
                return ETF_VALUTA[basis] || null;
              };

              const totaal = beleggingen.reduce((s, b) => {
                const k = koersen[b.symbol]; return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
              }, 0) || 1;
              const valutaMap = {};
              beleggingen.forEach(b => {
                const k = koersen[b.symbol];
                const w = (k ? k.c : b.kostprijs) * b.aantal * factor(b);
                const etfValuta = b.type === 'etf' ? zoekETFValuta(b.symbol) : null;
                if (etfValuta) {
                  Object.entries(etfValuta).forEach(([munt, pctInEtf]) => {
                    valutaMap[munt] = (valutaMap[munt] || 0) + w * (pctInEtf / 100);
                  });
                } else {
                  const munt = b.munt || 'EUR';
                  valutaMap[munt] = (valutaMap[munt] || 0) + w;
                }
              });
              const valutaData = Object.entries(valutaMap)
                .map(([munt, w]) => ({ munt, waarde: w, pct: (w / totaal) * 100 }))
                .filter(v => v.pct >= 0.1)
                .sort((a, b) => b.waarde - a.waarde);

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={valutaData} dataKey="pct" nameKey="munt" cx="50%" cy="50%" innerRadius={50} outerRadius={88} paddingAngle={2}>
                          {valutaData.map((_, i) => <Cell key={i} fill={PIE_KLEUREN[i % PIE_KLEUREN.length]} />)}
                        </Pie>
                        <Tooltip content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const { name, value, payload: p } = payload[0];
                          const kleur = p.fill || PIE_KLEUREN[0];
                          return (
                            <div style={{ background: 'white', border: `1.5px solid ${kleur}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
                              <span style={{ color: kleur, fontWeight: 700 }}>{name}</span>
                              <span style={{ color: kleur, marginLeft: 8 }}>{value.toFixed(2)}%</span>
                            </div>
                          );
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    {valutaData.map((v, i) => (
                      <div key={v.munt} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_KLEUREN[i % PIE_KLEUREN.length], display: 'inline-block' }} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{v.munt}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, marginRight: 6 }}>€{fmt(v.waarde)}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.pct.toFixed(2)}%</span>
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${v.pct}%`, background: PIE_KLEUREN[i % PIE_KLEUREN.length], borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })() : (() => {
              // Wisselkoerseffect tab
              const WISSELKOERS_DATA = {
                '1M': [
                  { maand: 'mei '26', effect: 0.4 },
                ],
                'YTD': [
                  { maand: 'jan '26', effect: -0.6 }, { maand: 'feb '26', effect: -0.4 },
                  { maand: 'maa '26', effect: 1.2 }, { maand: 'apr '26', effect: 0.3 },
                  { maand: 'mei '26', effect: 0.7 }, { maand: 'jun '26', effect: 1.8 },
                ],
                '1J': [
                  { maand: 'jun '25', effect: 0.3 }, { maand: 'jul '25', effect: -0.2 },
                  { maand: 'aug '25', effect: 0.8 }, { maand: 'sep '25', effect: -0.5 },
                  { maand: 'okt '25', effect: 1.1 }, { maand: 'nov '25', effect: 0.6 },
                  { maand: 'dec '25', effect: -0.3 }, { maand: 'jan '26', effect: -0.6 },
                  { maand: 'feb '26', effect: -0.4 }, { maand: 'maa '26', effect: 1.2 },
                  { maand: 'apr '26', effect: 0.3 }, { maand: 'jun '26', effect: 1.8 },
                ],
              };
              const periodeData = WISSELKOERS_DATA[wisselkoersPeriode] || WISSELKOERS_DATA['YTD'];
              const totaalEffect = periodeData.reduce((s, d) => s + d.effect, 0);
              const isPos = totaalEffect >= 0;

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setWisselkoersDropdown(o => !o)} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                        border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit'
                      }}>
                        {wisselkoersPeriode} <ChevronDown size={13} />
                      </button>
                      {wisselkoersDropdown && (
                        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 20, overflow: 'hidden' }}>
                          {['1M', 'YTD', '1J'].map(p => (
                            <div key={p} onClick={() => { setWisselkoersPeriode(p); setWisselkoersDropdown(false); }}
                              style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: wisselkoersPeriode === p ? 600 : 400, background: wisselkoersPeriode === p ? 'var(--accent-bg)' : 'transparent', color: wisselkoersPeriode === p ? 'var(--accent)' : 'var(--text-primary)' }}
                              onMouseEnter={e => { if (wisselkoersPeriode !== p) e.currentTarget.style.background = 'var(--bg)'; }}
                              onMouseLeave={e => { if (wisselkoersPeriode !== p) e.currentTarget.style.background = 'transparent'; }}
                            >{p}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent-light)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>💡</span>
                    <span>Wisselkoersen hebben je rendement {wisselkoersPeriode === 'YTD' ? 'dit jaar' : wisselkoersPeriode === '1M' ? 'deze maand' : 'dit jaar'} <strong style={{ color: isPos ? 'var(--green)' : 'var(--red)' }}>{isPos ? '+' : ''}{totaalEffect.toFixed(1)}%</strong> beïnvloed.</span>
                  </div>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={periodeData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                        <XAxis dataKey="maand" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                          tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`} />
                        <ReferenceLine y={0} stroke="var(--border)" />
                        <Bar dataKey="effect" radius={[3, 3, 0, 0]}>
                          {periodeData.map((d, i) => (
                            <Cell key={i} fill={d.effect >= 0 ? ACCENT : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── ETF X-ray ── */}
        {etfs.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>ETF X-ray</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Top holdings van je ETFs</div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
              {[
                { label: 'Aantal ETFs', waarde: etfs.length },
                { label: 'Aantal bedrijven', waarde: etfs.reduce((s, b) => s + (ETF_HOLDINGS[b.symbol]?.length || 0), 0) },
                { label: 'Gemiddelde kostenratio', waarde: '0,00%' },
              ].map(({ label, waarde }) => (
                <div key={label}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{waarde}</div>
                </div>
              ))}
            </div>

            {/* Holdings tabel */}
            <div style={{ borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 200px', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                <span>Naam</span><span style={{ textAlign: 'right' }}>Gewicht in portfolio</span><span style={{ textAlign: 'right' }}>Via</span>
              </div>
              {etfs.flatMap(etf => (ETF_HOLDINGS[etf.symbol] || []).map(h => ({
                ...h, etfSym: etf.symbol
              }))).sort((a, b) => b.pct - a.pct).map((h, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 160px 200px',
                  padding: '12px 0', borderBottom: '1px solid var(--border-light)', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: 'var(--accent-bg)',
                      color: 'var(--accent)', fontWeight: 700, fontSize: 11,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {h.sym.split('.')[0].slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.naam}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.sym}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>{h.pct.toFixed(2)}%</div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>{h.etfSym} {h.pct.toFixed(2)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Overige exports ongewijzigd ───────────────────────────────────
export function Dividend() {
  const { beleggingen } = useApp();
  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}><h1>Dividend</h1></div>
      <div style={{ padding: '0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[{ label: 'Verwacht dit jaar', value: '€0,00' }, { label: 'Ontvangen dit jaar', value: '€0,00' }, { label: 'Totaal ontvangen', value: '€0,00' }].map(({ label, value }) => (
            <div key={label} className="card">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Dividend per belegging</h3>
          {beleggingen.length === 0 ? <div className="empty-state"><p>Voeg beleggingen toe die dividend uitkeren</p></div>
            : beleggingen.map(b => (
              <div key={b.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="belegging-avatar">{b.symbol.slice(0, 2)}</div>
                  <div><div style={{ fontWeight: 600 }}>{b.naam}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.symbol}</div></div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Geen dividenddata beschikbaar</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export function Belastingen() {
  const { beleggingen, koersen } = useApp();
  const totaalMeerwaarde = beleggingen.reduce((sum, b) => {
    const koers = koersen[b.symbol]; const huidigePrijs = koers ? koers.c : b.kostprijs;
    const factor = (b.munt || 'EUR') === 'USD' ? 0.92 : 1;
    return sum + (huidigePrijs - b.kostprijs) * b.aantal * factor;
  }, 0);
  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}><h1>Belastingen</h1></div>
      <div style={{ padding: '0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Totale meerwaarde</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: totaalMeerwaarde >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totaalMeerwaarde >= 0 ? '+' : ''}€{Math.abs(totaalMeerwaarde).toFixed(2)}
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Meerwaardebelasting (10%)</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>€{Math.max(0, totaalMeerwaarde * 0.10).toFixed(2)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Indicatief — raadpleeg een belastingadviseur</div>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Overzicht per belegging</h3>
          {beleggingen.map(b => {
            const koers = koersen[b.symbol]; const huidigePrijs = koers ? koers.c : b.kostprijs;
            const factor = (b.munt || 'EUR') === 'USD' ? 0.92 : 1;
            const winst = (huidigePrijs - b.kostprijs) * b.aantal * factor;
            return (
              <div key={b.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="belegging-avatar">{b.symbol.slice(0, 2)}</div>
                  <div><div style={{ fontWeight: 600 }}>{b.naam}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.symbol}</div></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: winst >= 0 ? 'var(--green)' : 'var(--red)' }}>{winst >= 0 ? '+' : ''}€{winst.toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Meerwaarde</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Instellingen() {
  const { gebruiker, setGebruiker } = useApp();
  const [voornaam, setVoornaam] = useState(gebruiker.voornaam);
  const [achternaam, setAchternaam] = useState(gebruiker.achternaam);
  const [opgeslagen, setOpgeslagen] = useState(false);
  const opslaan = () => { setGebruiker({ voornaam, achternaam }); setOpgeslagen(true); setTimeout(() => setOpgeslagen(false), 2000); };
  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}><h1>Instellingen</h1></div>
      <div style={{ padding: '0 32px' }}>
        <div className="card" style={{ maxWidth: 500 }}>
          <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>Persoonlijke gegevens</h3>
          <div className="form-group"><label className="form-label">Voornaam</label><input type="text" className="form-input" value={voornaam} onChange={e => setVoornaam(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Achternaam</label><input type="text" className="form-input" value={achternaam} onChange={e => setAchternaam(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={opslaan} style={{ marginTop: 8 }}>{opgeslagen ? '✓ Opgeslagen!' : 'Opslaan'}</button>
        </div>
        <div className="card" style={{ maxWidth: 500, marginTop: 16 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Over Matico</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Matico is je persoonlijke portfolio tracker. Real-time koersen via Finnhub.io, AI-analyses via Claude (Anthropic). Alle data wordt lokaal in je browser opgeslagen.</p>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>Versie 1.0.0 · © 2026 Matico</div>
        </div>
      </div>
    </div>
  );
}
