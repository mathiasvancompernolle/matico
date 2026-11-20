import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { SECTOR_MAP_FALLBACK, BETA_MAP_FALLBACK } from '../data/marktclassificatie';

// ── Helpers ──────────────────────────────────────────────────────
const fmt = (v) => v.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ACCENT = '#1e3a8a';
const PIE_KLEUREN = ['#1e3a8a', '#d97706', '#059669', '#dc2626', '#3b82f6', '#7c3aed', '#ea580c', '#0891b2', '#65a30d', '#db2777', '#0d9488', '#ca8a04'];

// Bekende ETF-tickers (komen overeen met de ETF_DB/ETF_VALUTA-databases hieronder).
// Hiermee herkennen we een belegging ook als ETF wanneer het symbool bekend is,
// zelfs als het type-veld bij het toevoegen abusievelijk niet op 'etf' staat.
const KNOWN_ETF_SYMBOLS = new Set([
  'CNDX', 'CSPX', 'CSX5', 'EEM', 'EMIM', 'EQQQ', 'GWL', 'IEMA', 'IMEU', 'IUSA', 'IVV',
  'IWDA', 'LCWD', 'PRAW', 'QQQ', 'SMEA', 'SPY', 'SWRD', 'SXR8', 'VWCE', 'VWRL', 'WEBG', 'XDWD', 'XWLD'
]);
const isEtfBelegging = (b) => b.type === 'etf' || KNOWN_ETF_SYMBOLS.has((b.symbol || '').toUpperCase().split('.')[0]);

// Obligatie-ETF's (vooral staatsobligaties) hebben geen GICS-sector — dat
// classificatiesysteem is uitsluitend voor aandelen ontworpen. Wanneer de
// live sector-data dus leeg terugkomt (geen fout, gewoon niet van
// toepassing), tonen we daarom "Overheid" i.p.v. het misleidende "Overige"
// (dat een datagat suggereert i.p.v. "deze vraag is hier niet relevant").
// Eerst een kleine lijst bekende (vooral Europese UCITS) staatsobligatie-
// ETF-tickers, aangevuld met een naam-keyword-check als vangnet voor
// tickers die hier nog niet in staan.
const OBLIGATIE_ETF_SYMBOLS = new Set([
  'IBGS', 'IBGL', 'IBGM', 'IBTS', 'IBTM', 'IBTL', 'IEAG', 'IGLS', 'IGLT', 'IGLO',
  'VGOV', 'VETY', 'AGGH', 'AGGU', 'EMB', 'IEF', 'IEI', 'TLT', 'SHY', 'GOVT',
  'BND', 'AGG', 'VGIT', 'VGLT', 'VGSH', 'SPTL', 'SPTS', 'SGLO', 'DTLA',
]);
const OBLIGATIE_KEYWORDS = ['bond', 'treasury', 'govt', 'government', 'gilt', 'bund', 'sovereign', 'obligatie', 'staatslening'];
const isObligatieEtf = (b) => {
  const sym = (b.symbol || '').toUpperCase().split('.')[0];
  if (OBLIGATIE_ETF_SYMBOLS.has(sym)) return true;
  const naam = (b.naam || '').toLowerCase();
  return OBLIGATIE_KEYWORDS.some(w => naam.includes(w));
};

// Sector mapping op basis van type/symbol — gedeeld met Instellingen.js
// (Data-kwaliteit-tab) via ../data/marktclassificatie, zodat beide pagina's
// altijd hetzelfde tonen voor eenzelfde ticker.
const SECTOR_MAP = SECTOR_MAP_FALLBACK;
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

// FMP/Finnhub/EODHD sectoren (Engels) → Nederlandse labels
const FMP_SECTOR_MAP = {
  'Technology': 'Technologie', 'Information Technology': 'Technologie',
  'Semiconductors': 'Technologie', 'Semiconductor': 'Technologie',
  'Software': 'Technologie', 'Software—Application': 'Technologie', 'Software—Infrastructure': 'Technologie',
  'Hardware': 'Technologie', 'Computer Hardware': 'Technologie',
  'Electronic Technology': 'Technologie', 'Electronics': 'Technologie',
  'Internet Content & Information': 'Technologie',
  'Financial Services': 'Financiële dienstverlening', 'Financial': 'Financiële dienstverlening', 'Financials': 'Financiële dienstverlening',
  'Banks': 'Financiële dienstverlening', 'Banks—Diversified': 'Financiële dienstverlening',
  'Insurance': 'Financiële dienstverlening', 'Asset Management': 'Financiële dienstverlening',
  'Capital Markets': 'Financiële dienstverlening', 'Credit Services': 'Financiële dienstverlening',
  'Finance': 'Financiële dienstverlening',
  'Consumer Cyclical': 'Cyclische consumptiegoederen', 'Consumer Discretionary': 'Cyclische consumptiegoederen',
  'Retail': 'Cyclische consumptiegoederen', 'Automobiles': 'Cyclische consumptiegoederen',
  'Auto Manufacturers': 'Cyclische consumptiegoederen', 'Footwear & Accessories': 'Cyclische consumptiegoederen',
  'Apparel Manufacturing': 'Cyclische consumptiegoederen', 'Apparel Retail': 'Cyclische consumptiegoederen',
  'Specialty Retail': 'Cyclische consumptiegoederen', 'E-Commerce': 'Cyclische consumptiegoederen',
  'Leisure': 'Cyclische consumptiegoederen', 'Hotels & Entertainment Services': 'Cyclische consumptiegoederen',
  'Textiles, Apparel & Luxury Goods': 'Cyclische consumptiegoederen',
  'Textile Manufacturing': 'Cyclische consumptiegoederen',
  'Consumer Defensive': 'Defensieve consumptiegoederen', 'Consumer Staples': 'Defensieve consumptiegoederen',
  'Food': 'Defensieve consumptiegoederen', 'Beverages': 'Defensieve consumptiegoederen',
  'Household & Personal Products': 'Defensieve consumptiegoederen', 'Tobacco': 'Defensieve consumptiegoederen',
  'Healthcare': 'Gezondheidszorg', 'Health Care': 'Gezondheidszorg',
  'Biotechnology': 'Gezondheidszorg', 'Pharmaceuticals': 'Gezondheidszorg',
  'Medical Devices': 'Gezondheidszorg', 'Drug Manufacturers': 'Gezondheidszorg',
  'Drug Manufacturers—General': 'Gezondheidszorg',
  'Communication Services': 'Communicatiediensten', 'Telecommunication Services': 'Communicatiediensten',
  'Telecommunications': 'Communicatiediensten', 'Media': 'Communicatiediensten',
  'Entertainment': 'Communicatiediensten', 'Broadcasting': 'Communicatiediensten',
  'Internet Services': 'Communicatiediensten',
  'Industrials': 'Industrie', 'Industrial': 'Industrie',
  'Aerospace & Defense': 'Industrie', 'Transportation': 'Industrie',
  'Construction': 'Industrie', 'Machinery': 'Industrie',
  'Energy': 'Energie', 'Oil & Gas': 'Energie', 'Oil, Gas & Consumable Fuels': 'Energie',
  'Basic Materials': 'Basismaterialen', 'Materials': 'Basismaterialen',
  'Chemicals': 'Basismaterialen', 'Metals & Mining': 'Basismaterialen',
  'Utilities': 'Nutsbedrijven',
  'Real Estate': 'Vastgoed', 'REITs': 'Vastgoed',
};

// Alle mogelijke sector-/regiobuckets die de app gebruikt (voor het opsporen
// van de minst vertegenwoordigde categorie bij diversificatiesuggesties)
// Lopende kosten (TER, %) van veelgebruikte ETF's waarvoor de databron
// geen kostenratio geeft
const KOSTENRATIO_EXTRA = {
  VFEM: 0.22, VFEA: 0.22, VWRL: 0.19, VWRA: 0.19, VUSA: 0.07, VUAA: 0.07, VEUR: 0.10, VEVE: 0.12,
  IBGS: 0.20, IBCI: 0.09, AGGH: 0.10, EUNA: 0.10, IEMA: 0.18, EIMI: 0.18, IUSN: 0.35, IWMO: 0.30,
  MEUD: 0.07, LCUW: 0.12, XDWD: 0.19, XDEW: 0.20, XMME: 0.18, ZPRV: 0.30, ZPRX: 0.30,
};
const ALLE_SECTOREN = [
  'Technologie', 'Financiële dienstverlening', 'Cyclische consumptiegoederen',
  'Defensieve consumptiegoederen', 'Gezondheidszorg', 'Communicatiediensten',
  'Industrie', 'Energie', 'Basismaterialen', 'Nutsbedrijven', 'Vastgoed',
];
// Gewicht in de wereldwijde aandelenmarkt (MSCI ACWI, bij benadering, in %)
const WERELD_SECTOR = {
  'Technologie': 26, 'Financiële dienstverlening': 17, 'Industrie': 11,
  'Cyclische consumptiegoederen': 10.5, 'Gezondheidszorg': 9.5, 'Communicatiediensten': 8.5,
  'Defensieve consumptiegoederen': 5.5, 'Energie': 3.7, 'Basismaterialen': 3.5,
  'Nutsbedrijven': 2.6, 'Vastgoed': 2,
};
const WERELD_REGIO = {
  'Noord-Amerika': 65, 'Europa - Ontwikkeld': 12, 'Azië - Opkomend': 8, 'Japan': 5,
  'Azië - Ontwikkeld': 3.5, 'Verenigd Koninkrijk': 3.3, 'Australazië': 1.7,
  'Afrika/Midden-Oosten': 1.3, 'Latijns-Amerika': 0.8, 'Europa - Opkomend': 0.3,
};
const ALLE_REGIOS = [
  'Noord-Amerika', 'Europa - Ontwikkeld', 'Europa - Opkomend',
  'Azië - Ontwikkeld', 'Azië - Opkomend', 'Japan', 'Verenigd Koninkrijk',
  'Australazië', 'Afrika/Midden-Oosten', 'Latijns-Amerika',
];

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
  // ── Nieuw toegevoegd (juli 2026) — met bron geverifieerd ──────────────
  // iShares Core MSCI World (Xetra-notering) — zelfde fonds als IWDA/SWRD
  EUNL: {
    regio: { 'Noord-Amerika': 72.1, 'Europa - Ontwikkeld': 13.8, 'Japan': 6.2, 'Azië - Ontwikkeld': 4.1, 'Verenigd Koninkrijk': 2.9, 'Australazië': 0.9 },
    sector: { 'Technologie': 25.2, 'Financiële dienstverlening': 15.8, 'Gezondheidszorg': 12.1, 'Industrie': 11.3, 'Cyclische consumptiegoederen': 10.4, 'Communicatiediensten': 8.6, 'Defensieve consumptiegoederen': 6.8, 'Energie': 4.5, 'Basismaterialen': 3.2, 'Nutsbedrijven': 2.1 }
  },
  // Vanguard S&P 500 UCITS ETF — zelfde index als IVV/SPY/IUSA/CSPX
  VOO: {
    regio: { 'Noord-Amerika': 99.5, 'Overige': 0.5 },
    sector: { 'Technologie': 33.03, 'Financiële dienstverlening': 14.00, 'Cyclische consumptiegoederen': 10.35, 'Communicatiediensten': 9.77, 'Gezondheidszorg': 9.30, 'Industrie': 8.57, 'Defensieve consumptiegoederen': 5.49, 'Energie': 2.97, 'Nutsbedrijven': 2.39, 'Vastgoed': 2.04, 'Basismaterialen': 1.88 }
  },
  VUSA: {
    regio: { 'Noord-Amerika': 99.5, 'Overige': 0.5 },
    sector: { 'Technologie': 33.03, 'Financiële dienstverlening': 14.00, 'Cyclische consumptiegoederen': 10.35, 'Communicatiediensten': 9.77, 'Gezondheidszorg': 9.30, 'Industrie': 8.57, 'Defensieve consumptiegoederen': 5.49, 'Energie': 2.97, 'Nutsbedrijven': 2.39, 'Vastgoed': 2.04, 'Basismaterialen': 1.88 }
  },
  // iShares Core MSCI EM IMI (LSE-notering) — zelfde fonds als EMIM
  EIMI: {
    regio: { 'China': 27.5, 'India': 18.2, 'Taiwan': 16.8, 'Zuid-Korea': 11.3, 'Brazilië': 5.4, 'Saudi-Arabië': 4.1, 'Zuid-Afrika': 3.2, 'Mexico': 2.8, 'Overige opkomende markten': 10.7 },
    sector: { 'Financiële dienstverlening': 22.4, 'Technologie': 20.1, 'Cyclische consumptiegoederen': 13.8, 'Communicatiediensten': 9.6, 'Energie': 6.8, 'Industrie': 6.4, 'Basismaterialen': 6.2, 'Gezondheidszorg': 4.8, 'Defensieve consumptiegoederen': 4.5, 'Vastgoed': 3.2, 'Nutsbedrijven': 2.2 }
  },
  // iShares Core EURO STOXX 50 (dubbele notering) — zelfde fonds als CSX5
  CSSX5E: {
    regio: { 'Frankrijk': 38.2, 'Duitsland': 27.4, 'Nederland': 12.8, 'Spanje': 9.6, 'Finland': 4.2, 'Italië': 3.9, 'Ierland': 2.1, 'België': 1.8 },
    sector: { 'Financiële dienstverlening': 19.8, 'Industrie': 17.4, 'Technologie': 12.6, 'Gezondheidszorg': 11.8, 'Defensieve consumptiegoederen': 10.4, 'Energie': 7.9, 'Cyclische consumptiegoederen': 7.2, 'Basismaterialen': 5.6, 'Nutsbedrijven': 4.8, 'Overige': 2.5 }
  },
  // Vanguard Total Stock Market ETF — sector via Yahoo (juli 2026), regio 100% VS
  VTI: {
    regio: { 'Noord-Amerika': 99.5, 'Overige': 0.5 },
    sector: { 'Technologie': 36.07, 'Financiële dienstverlening': 11.76, 'Industrie': 10.15, 'Gezondheidszorg': 9.66, 'Cyclische consumptiegoederen': 9.40, 'Communicatiediensten': 9.13, 'Defensieve consumptiegoederen': 4.29, 'Energie': 3.15, 'Vastgoed': 2.33, 'Nutsbedrijven': 2.17, 'Basismaterialen': 1.89 }
  },
  // Vanguard FTSE Emerging Markets UCITS ETF — sector rechtstreeks bevestigd
  // via de live Yahoo-data van de app zelf (juli 2026); regio via TradingView
  // (zelfde FTSE Emerging Index als de Acc-variant VFEA)
  VFEM: {
    regio: { 'Azië - Opkomend': 77.97, 'Afrika/Midden-Oosten': 10.60, 'Latijns-Amerika': 5.02, 'Europa - Opkomend': 4.11, 'Noord-Amerika': 2.30 },
    sector: { 'Technologie': 34.07, 'Financiële dienstverlening': 20.68, 'Cyclische consumptiegoederen': 9.17, 'Communicatiediensten': 7.1, 'Basismaterialen': 6.95, 'Industrie': 6.88, 'Energie': 4.07, 'Defensieve consumptiegoederen': 3.33, 'Gezondheidszorg': 3.30, 'Nutsbedrijven': 2.86, 'Vastgoed': 1.59 }
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

// ── Regio's: altijd dezelfde buckets ─────────────────────────────
// Sommige bronnen (en oudere ETF_DB-regels) geven landen ("China",
// "Frankrijk") of Engelse landnamen; andere geven regio's. Alles wordt hier
// naar één set regio's omgezet, zodat de grafiek geen mengeling van landen,
// regio's en verschillende soorten "Overige" meer toont.
const LAND_NAAR_REGIO = {
  // Nederlands
  'Verenigde Staten': 'Noord-Amerika', 'Canada': 'Noord-Amerika',
  'Frankrijk': 'Europa - Ontwikkeld', 'Duitsland': 'Europa - Ontwikkeld', 'Nederland': 'Europa - Ontwikkeld',
  'Spanje': 'Europa - Ontwikkeld', 'Finland': 'Europa - Ontwikkeld', 'Italië': 'Europa - Ontwikkeld',
  'Ierland': 'Europa - Ontwikkeld', 'België': 'Europa - Ontwikkeld', 'Zwitserland': 'Europa - Ontwikkeld',
  'Zweden': 'Europa - Ontwikkeld', 'Denemarken': 'Europa - Ontwikkeld', 'Noorwegen': 'Europa - Ontwikkeld',
  'Oostenrijk': 'Europa - Ontwikkeld', 'Portugal': 'Europa - Ontwikkeld', 'Luxemburg': 'Europa - Ontwikkeld',
  'Polen': 'Europa - Opkomend', 'Griekenland': 'Europa - Opkomend', 'Turkije': 'Europa - Opkomend', 'Hongarije': 'Europa - Opkomend', 'Tsjechië': 'Europa - Opkomend',
  'China': 'Azië - Opkomend', 'India': 'Azië - Opkomend', 'Taiwan': 'Azië - Opkomend', 'Zuid-Korea': 'Azië - Opkomend',
  'Indonesië': 'Azië - Opkomend', 'Thailand': 'Azië - Opkomend', 'Maleisië': 'Azië - Opkomend', 'Filipijnen': 'Azië - Opkomend',
  'Hongkong': 'Azië - Ontwikkeld', 'Singapore': 'Azië - Ontwikkeld', 'Japan': 'Japan',
  'Australië': 'Australazië', 'Nieuw-Zeeland': 'Australazië',
  'Brazilië': 'Latijns-Amerika', 'Mexico': 'Latijns-Amerika', 'Chili': 'Latijns-Amerika', 'Peru': 'Latijns-Amerika', 'Colombia': 'Latijns-Amerika',
  'Saudi-Arabië': 'Afrika/Midden-Oosten', 'Zuid-Afrika': 'Afrika/Midden-Oosten', 'Verenigde Arabische Emiraten': 'Afrika/Midden-Oosten',
  'Qatar': 'Afrika/Midden-Oosten', 'Koeweit': 'Afrika/Midden-Oosten', 'Israël': 'Afrika/Midden-Oosten',
  'Overige Europa': 'Europa - Ontwikkeld',
  // Engels (zoals profielbronnen het land geven)
  'United States': 'Noord-Amerika', 'USA': 'Noord-Amerika', 'US': 'Noord-Amerika',
  'France': 'Europa - Ontwikkeld', 'Germany': 'Europa - Ontwikkeld', 'Netherlands': 'Europa - Ontwikkeld',
  'Spain': 'Europa - Ontwikkeld', 'Italy': 'Europa - Ontwikkeld', 'Ireland': 'Europa - Ontwikkeld', 'Belgium': 'Europa - Ontwikkeld',
  'Switzerland': 'Europa - Ontwikkeld', 'Sweden': 'Europa - Ontwikkeld', 'Denmark': 'Europa - Ontwikkeld', 'Norway': 'Europa - Ontwikkeld',
  'Austria': 'Europa - Ontwikkeld', 'Luxembourg': 'Europa - Ontwikkeld',
  'United Kingdom': 'Verenigd Koninkrijk', 'UK': 'Verenigd Koninkrijk', 'GB': 'Verenigd Koninkrijk',
  'South Korea': 'Azië - Opkomend', 'Korea': 'Azië - Opkomend', 'Hong Kong': 'Azië - Ontwikkeld',
  'Australia': 'Australazië', 'New Zealand': 'Australazië', 'Brazil': 'Latijns-Amerika',
  'Saudi Arabia': 'Afrika/Midden-Oosten', 'South Africa': 'Afrika/Midden-Oosten', 'Israel': 'Afrika/Midden-Oosten',
  'Cayman Islands': 'Azië - Opkomend', // vooral Chinese bedrijven (Alibaba, ...)
  // Landcodes
  NL: 'Europa - Ontwikkeld', BE: 'Europa - Ontwikkeld', DE: 'Europa - Ontwikkeld', FR: 'Europa - Ontwikkeld', IE: 'Europa - Ontwikkeld', CH: 'Europa - Ontwikkeld', CA: 'Noord-Amerika', JP: 'Japan', CN: 'Azië - Opkomend',
};
const REGIO_BUCKETS = new Set([...ALLE_REGIOS]);
const naarRegio = (label) => (REGIO_BUCKETS.has(label) ? label : (LAND_NAAR_REGIO[label] || null));

// Zet { label: % } om naar regio-buckets. "Overige"/onbekende stukjes
// vallen weg en de rest wordt herschaald naar 100%.
const normaliseerRegios = (gewichten) => {
  if (!gewichten) return null;
  const uit = {};
  Object.entries(gewichten).forEach(([label, pct]) => {
    const r = naarRegio(label);
    if (r && pct > 0) uit[r] = (uit[r] || 0) + pct;
  });
  const som = Object.values(uit).reduce((s, v) => s + v, 0);
  if (som <= 0) return null;
  Object.keys(uit).forEach(k => { uit[k] = (uit[k] / som) * 100; });
  return uit;
};
// Sectoren: "Overige" laten we weg en we herschalen naar 100%
const normaliseerSectoren = (gewichten) => {
  if (!gewichten) return null;
  const uit = {};
  Object.entries(gewichten).forEach(([label, pct]) => {
    const s = ALLE_SECTOREN.includes(label) ? label : (FMP_SECTOR_MAP[label] || null);
    if (s && pct > 0) uit[s] = (uit[s] || 0) + pct;
  });
  const som = Object.values(uit).reduce((s, v) => s + v, 0);
  if (som <= 0) return null;
  Object.keys(uit).forEach(k => { uit[k] = (uit[k] / som) * 100; });
  return uit;
};

// Live gegevens (etf-holdings endpoint), per basissymbool bewaard
const liveEtfSectorGewichten = (symbol, liveEtfData) => {
  const basis = symbol.toUpperCase().split('.')[0];
  const sectoren = liveEtfData[basis]?.sectoren;
  if (!sectoren || sectoren.length === 0) return null;
  const gewichten = {};
  sectoren.forEach(s => { gewichten[s.label] = (gewichten[s.label] || 0) + s.pct; });
  return normaliseerSectoren(gewichten);
};
const liveEtfRegioGewichten = (symbol, liveEtfData) => {
  const basis = symbol.toUpperCase().split('.')[0];
  const landen = liveEtfData[basis]?.landen;
  if (!landen || landen.length === 0) return null;
  const gewichten = {};
  landen.forEach(l => { gewichten[l.label] = (gewichten[l.label] || 0) + l.pct; });
  return normaliseerRegios(gewichten);
};

// Als laatste vangnet: herken het soort index uit de naam van de ETF
// (bv. "State Street SPDR MSCI All Country World UCITS ETF" → wereldwijd
// inclusief opkomende markten). Zo valt bijna geen enkele ETF nog terug op
// "Wereldwijd" of "Overige".
const ETF_FAMILIES = [
  { test: /all[- ]?world|acwi|all country|all-country|ftse global all cap/, voorbeeld: 'VWCE' },
  { test: /emerging|opkomende|\bem\b|\bemim\b/, voorbeeld: 'VFEM' },
  { test: /nasdaq/, voorbeeld: 'EQQQ' },
  { test: /s&p ?500|s&p500/, voorbeeld: 'CSPX' },
  { test: /\bworld\b|msci world|developed/, voorbeeld: 'IWDA' },
  { test: /euro ?stoxx|eurozone|\bemu\b/, voorbeeld: 'CSX5' },
  { test: /europe|stoxx 600|europa/, voorbeeld: 'SMEA' },
  { test: /\busa\b|\bus\b|united states|total (stock )?market/, voorbeeld: 'VTI' },
  { test: /japan|nikkei|topix/, regio: { 'Japan': 100 } },
];
const herkenEtfFamilie = (b) => {
  const tekst = `${(b.naam || '').toLowerCase()} ${(b.symbol || '').toLowerCase()}`;
  return ETF_FAMILIES.find(f => f.test.test(tekst)) || null;
};
// Obligatie-ETF's: regio volgt de munt/het gebied van de obligaties
const obligatieRegio = (b) => {
  const naam = (b.naam || '').toLowerCase();
  if (/\beur\b|euro|eurozone|bund|oat\b/.test(naam)) return { 'Europa - Ontwikkeld': 100 };
  if (/\busd\b|us treasury|u\.s\.|treasury/.test(naam)) return { 'Noord-Amerika': 100 };
  if (/gilt|\bgbp\b/.test(naam)) return { 'Verenigd Koninkrijk': 100 };
  return null;
};

// Volgorde: sector → live (actueel) → vaste lijst → herkende index.
//           regio  → vaste lijst → live landen → herkende index.
const getEtfGewichten = (sym, type, liveEtfData, b = { symbol: sym }) => {
  const etf = zoekETF(sym);
  const familie = herkenEtfFamilie(b);
  const famEtf = familie?.voorbeeld ? ETF_DB[familie.voorbeeld] : null;
  if (type === 'sector') {
    if (isObligatieEtf(b)) return { 'Overheid': 100 };
    return liveEtfSectorGewichten(sym, liveEtfData)
      || normaliseerSectoren(etf?.sector)
      || normaliseerSectoren(famEtf?.sector);
  }
  if (isObligatieEtf(b)) return obligatieRegio(b) || normaliseerRegios(etf?.regio) || null;
  return normaliseerRegios(etf?.regio)
    || liveEtfRegioGewichten(sym, liveEtfData)
    || normaliseerRegios(famEtf?.regio || familie?.regio);
};


function getSector(b, liveSectoren = {}) {
  const sym = b.symbol.toUpperCase().split('.')[0];
  if (isEtfBelegging(b)) return 'ETF';
  if (b.type === 'crypto') return 'Crypto';
  if (SECTOR_MAP[sym]) return SECTOR_MAP[sym];
  if (liveSectoren[sym]) return liveSectoren[sym];
  return 'Overige';
}

function getRegio(b, liveLanden = {}) {
  // Crypto heeft geen land of regio (vroeger telde het als Noord-Amerika,
  // omdat het symbool geen beurscode heeft)
  if (b.type === 'crypto') return 'Crypto (geen regio)';
  const sym = b.symbol.toUpperCase();
  const delen = sym.split('.');
  const basis = delen[0];
  const extensie = delen.length > 1 ? delen[delen.length - 1] : null;

  // 1. Exacte symboolmatch (bijv. NVDA, ASML)
  if (SYMBOOL_REGIO[basis]) return SYMBOOL_REGIO[basis];

  // 2. Land van het bedrijf (uit het bedrijfsprofiel) — juister dan de beurs
  if (liveLanden[basis] && naarRegio(liveLanden[basis])) return naarRegio(liveLanden[basis]);

  // 3. Beursextensie (bijv. .AS → Amsterdam, .DE → Duitsland)
  if (extensie && EXTENSIE_REGIO[extensie]) return EXTENSIE_REGIO[extensie];

  // 4. Geen extensie en niet bekend → vermoedelijk VS (NYSE/NASDAQ)
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
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{getal(pct, 2)}%</span>
        </div>
      </div>
      <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: kleur, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Hoofd Analyse component ───────────────────────────────────────
import SidebarToggleKnop from '../components/SidebarToggleKnop';

import { getal } from '../utils/getal';
export function Analyse({ sidebarCollapsed, onToggleSidebar }) {
  const { beleggingen: beleggingenRaw, koersen, getMuntFactor, fxOp, kostEur, verkoopEur, verkochteBeleggingen, t } = useApp();
  // "1 transactie" / "12 transacties"
  const aantalTransacties = (n) => `${n} ${n === 1 ? t('bel_transactie_suffix') : t('bel_transacties_suffix')}`;
  // Belegging-type normaliseren: bekende ETF-tickers (VWCE, IWDA, ...) tellen altijd
  // als ETF voor Spreiding/Sectoren/Regio/Valuta/ETF X-ray, ook als het type-veld
  // bij het toevoegen niet correct op 'etf' werd gezet.
  const beleggingen = useMemo(
    () => beleggingenRaw.map(b => (b.type !== 'etf' && isEtfBelegging(b)) ? { ...b, type: 'etf' } : b),
    [beleggingenRaw]
  );
  const [winstFilter, setWinstFilter] = useState('exclusief'); // 'exclusief' | 'inclusief'
  const [winstDropdown, setWinstDropdown] = useState(false);
  const [spreidingTab, setSpreidingTab] = useState('Type');
  const [spreidingAlles, setSpreidingAlles] = useState(true);
  const [spreidingSubFilter, setSpreidingSubFilter] = useState('Alles');
  const [spreidingDropdownOpen, setSpreidingDropdownOpen] = useState(false);
  const [valutaTab, setValutaTab] = useState('verdeling'); // 'verdeling' | 'wisselkoers'
  const [wisselkoersPeriode, setWisselkoersPeriode] = useState('YTD');
  const [wisselkoersDropdown, setWisselkoersDropdown] = useState(false);
  const [liveEtfData, setLiveEtfData] = useState({});
  const [liveBetas, setLiveBetas] = useState({});
  // Per effect: beweeglijkheid (per jaar) en maandrendementen in euro
  const [liveRisico, setLiveRisico] = useState({});
  // Gsm-weergave (smalle lijsten i.p.v. tabellen)
  const [isGsm, setIsGsm] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const opResize = () => setIsGsm(window.innerWidth < 768);
    window.addEventListener('resize', opResize);
    return () => window.removeEventListener('resize', opResize);
  }, []);
  const [liveSectoren, setLiveSectoren] = useState({}); // { PRX: 'Cyclische consumptiegoederen', ... }
  const [liveLanden, setLiveLanden] = useState({}); // { PRX: 'Netherlands', ... } (land van het bedrijf)
  const [etfDataLoading, setEtfDataLoading] = useState(false);

  const factor = (b) => getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);

  // ── Totale winst/verlies berekening ──
  const { kostprijs, huidigeWaarde, winst, winstPct, maxBar } = useMemo(() => {
    const actief = beleggingen;
    const verkocht = winstFilter === 'inclusief' ? (verkochteBeleggingen || []) : [];

    // Aankoop en verkoop in euro aan de wisselkoers van die dag
    const kp = actief.reduce((s, b) => s + kostEur(b), 0)
      + verkocht.reduce((s, b) => s + kostEur(b, b.aantalVerkocht), 0);

    const hw = actief.reduce((s, b) => {
      const k = koersen[b.symbol];
      return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
    }, 0) + verkocht.reduce((s, b) => s + verkoopEur(b), 0);

    const w = hw - kp;
    const wp = kp > 0 ? (w / kp) * 100 : 0;
    return { kostprijs: kp, huidigeWaarde: hw, winst: w, winstPct: wp, maxBar: Math.max(kp, hw) };
  }, [beleggingen, koersen, winstFilter, verkochteBeleggingen, getMuntFactor, kostEur, verkoopEur]);

  // ── Risicoprofiel (bèta benadering) ──
  // Live bèta state — wordt gevuld via Finnhub metrics API
  // BETA_MAP_FALLBACK komt uit ../data/marktclassificatie — gedeeld met
  // Instellingen.js zodat beide pagina's dezelfde bèta tonen per ticker.
  const BETA_MAP = BETA_MAP_FALLBACK;
  const [risicoInfoOpen, setRisicoInfoOpen] = useState(false);
  const { beta, risicoLabel, risicoKleur, aantalBolletjes, betaPerBelegging, volatiliteit } = useMemo(() => {
    const totaal = beleggingen.reduce((s, b) => {
      const k = koersen[b.symbol]; return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
    }, 0) || 1;
    const onbekend = [];
    // Bèta per belegging. Vroeger kreeg alles zonder gekende bèta 1,0 —
    // ook een staatsobligatie-ETF (in werkelijkheid ~0) en crypto (veel
    // beweeglijker dan de aandelenmarkt).
    // 1) berekend uit de koershistoriek (elk effect, zie api 'beta')
    // 2) anders een vaste waarde of schatting
    const geschat = new Set();
    const betaVan = (b) => {
      if (typeof liveBetas[b.symbol] === 'number') return liveBetas[b.symbol];
      geschat.add(b.symbol);
      const sym = b.symbol.split('.')[0].toUpperCase();
      if (BETA_MAP[sym]) return BETA_MAP[sym];
      if (b.type === 'crypto') return 2.0;            // schatting
      if (b.type === 'etf') {
        if (isObligatieEtf(b)) return 0.05;           // staatsobligaties
        const fam = herkenEtfFamilie(b)?.voorbeeld;
        const FAMILIE_BETA = { VWCE: 1.0, IWDA: 1.0, CSPX: 1.0, VTI: 1.0, SMEA: 1.0, CSX5: 1.05, EQQQ: 1.15, VFEM: 0.85 };
        if (fam && FAMILIE_BETA[fam]) return FAMILIE_BETA[fam];
      }
      return null;
    };
    const perBelegging = [];
    const gewogenBeta = beleggingen.reduce((s, b) => {
      const k = koersen[b.symbol];
      const w = (k ? k.c : b.kostprijs) * b.aantal * factor(b) / totaal;
      const bt = betaVan(b);
      if (bt == null) onbekend.push(b.symbol);
      perBelegging.push({ symbol: b.symbol, naam: b.naam, beta: bt, geschat: geschat.has(b.symbol), gewicht: w, vol: liveRisico[b.symbol]?.vol ?? null });
      return s + (bt == null ? 1.0 : bt) * w;
    }, 0);
    // Grenzen conform info-modal: Defensief <1.0, Neutraal 1.0-1.5, Offensief 1.5-2.5, Speculatief >2.5
    // Afronden op 2 decimalen, net zoals op het scherm: anders kreeg een bèta
    // van 0,997 (getoond als "1,00") het label "Defensief".
    const afgerond = Math.round(gewogenBeta * 100) / 100;
    // Zelfde effect meermaals (bv. aparte aankopen) samenvoegen
    const samen = {};
    perBelegging.forEach(r => { if (samen[r.symbol]) samen[r.symbol].gewicht += r.gewicht; else samen[r.symbol] = { ...r }; });
    const lijst = Object.values(samen).sort((a, b) => b.gewicht - a.gewicht);

    // ── Beweeglijkheid (volatiliteit) van de hele portefeuille ──
    // Per maand het gewogen rendement van je huidige beleggingen (in euro);
    // daarvan de spreiding, omgerekend naar een jaar. Zo telt mee dat
    // beleggingen elkaar deels uitmiddelen. Effecten zonder koershistoriek
    // in een bepaalde maand tellen die maand niet mee (gewichten herschaald).
    let vol = null;
    const metReeks = lijst.filter(r => liveRisico[r.symbol]?.rend);
    const gedekt = metReeks.reduce((s, r) => s + r.gewicht, 0);
    if (gedekt >= 0.8) {
      const maanden = [...new Set(metReeks.flatMap(r => Object.keys(liveRisico[r.symbol].rend)))].sort();
      const reeks = [];
      maanden.forEach(m => {
        let som = 0, gew = 0;
        metReeks.forEach(r => { const v = liveRisico[r.symbol].rend[m]; if (typeof v === 'number') { som += v * r.gewicht; gew += r.gewicht; } });
        if (gew >= gedekt * 0.5) reeks.push(som / gew);
      });
      if (reeks.length >= 12) {
        const g = reeks.reduce((s, v) => s + v, 0) / reeks.length;
        const sd = Math.sqrt(reeks.reduce((s, v) => s + (v - g) ** 2, 0) / (reeks.length - 1));
        vol = sd * Math.sqrt(12);
      }
    }

    // Risiconiveau op basis van de beweeglijkheid; zolang die (nog) niet
    // gekend is op basis van de bèta.
    const niveau = vol != null
      ? (vol < 0.10 ? 0 : vol < 0.18 ? 1 : vol < 0.30 ? 2 : 3)
      : (afgerond < 1.0 ? 0 : afgerond < 1.5 ? 1 : afgerond < 2.5 ? 2 : 3);
    const label = ['Defensief', 'Neutraal', 'Offensief', 'Speculatief'][niveau];
    const kleur = ['var(--green)', 'var(--accent)', '#f97316', 'var(--red)'][niveau];
    return { beta: afgerond, risicoLabel: label, risicoKleur: kleur, aantalBolletjes: niveau + 1, betaPerBelegging: lijst, volatiliteit: vol };
  }, [beleggingen, koersen, getMuntFactor, liveBetas, liveRisico]);



  // ── Spreiding berekening ──
  const { spreidingData, pieData } = useMemo(() => {
    // Welke beleggingen tonen op basis van subfilter
    const gefilterd = beleggingen.filter(b => {
      if (spreidingTab === 'Type') return true;
      if (spreidingSubFilter === 'Alles') return true;
      if (spreidingSubFilter === 'Aandelen') return b.type !== 'etf' && b.type !== 'crypto';
      if (spreidingSubFilter === 'ETFs') return b.type === 'etf';
      return true;
    });

    // Totaal = enkel de gefilterde beleggingen zodat % klopt per subfilter
    const totaal = gefilterd.reduce((s, b) => {
      const k = koersen[b.symbol]; return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
    }, 0) || 1;

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
        const gewichten = getEtfGewichten(b.symbol, isRegio ? 'regio' : 'sector', liveEtfData, b);
        if (gewichten) {
          // Verdeel ETF waarde proportioneel over regio's/sectoren
          Object.entries(gewichten).forEach(([cat, pctInEtf]) => {
            map[cat] = (map[cat] || 0) + w * (pctInEtf / 100);
          });
        } else {
          // Geen sectordata: bij obligatie-ETF's is dat normaal (GICS-sectoren
          // bestaan niet voor obligaties) — toon dan "Overheid" i.p.v. het
          // misleidende "Overige". Regio blijft "Wereldwijd" zoals voorheen.
          const fallback = isRegio ? 'Wereldwijd' : (isObligatieEtf(b) ? 'Overheid' : 'Overige');
          map[fallback] = (map[fallback] || 0) + w;
        }
      } else {
        // Directe aandelen: gebruik sector/regio mapping
        const label = isRegio ? getRegio(b, liveLanden) : getSector(b, liveSectoren);
        map[label] = (map[label] || 0) + w;
      }
    });

    const data = Object.entries(map)
      .map(([label, w]) => ({ label, waarde: w, pct: (w / totaal) * 100 }))
      .filter(d => d.waarde > 0)
      .sort((a, b) => b.waarde - a.waarde);

    return { spreidingData: data, pieData: data };
  }, [beleggingen, koersen, spreidingTab, spreidingSubFilter, liveSectoren, liveLanden, liveEtfData, getMuntFactor]);

  // ── Concentratierisico ──
  // ── Live bèta ophalen via Finnhub metrics API ──
  useEffect(() => {
    // Alle effecten: aandelen, ETF's en crypto (uniek per symbool)
    const aandelen = [...new Map(beleggingen.map(b => [b.symbol, b])).values()];
    if (aandelen.length === 0) return;

    const CACHE_DUUR_BETA = 7 * 24 * 60 * 60 * 1000; // 7 dagen

    const laadBeta = async (b) => {
      const sym = b.symbol;
      const cacheKey = `kapitas_risico_v2_${sym}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { beta, vol, rend, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DUUR_BETA) {
            return { sym, beta, vol, rend };
          }
        }
      } catch (e) {}

      // Berekend uit 5 jaar koershistoriek in euro t.o.v. de wereldmarkt
      try {
        const res = await fetch(`/api/data?endpoint=beta&symbol=${encodeURIComponent(b.symbol)}`);
        const data = await res.json();
        const beta = typeof data?.beta === 'number' && Number.isFinite(data.beta) ? data.beta : null;
        const vol = typeof data?.volatiliteit === 'number' ? data.volatiliteit : null;
        const rend = data?.maandRendementen && Object.keys(data.maandRendementen).length >= 2 ? data.maandRendementen : null;
        if (beta != null || vol != null) {
          try { localStorage.setItem(cacheKey, JSON.stringify({ beta, vol, rend, timestamp: Date.now() })); } catch (e) {}
          return { sym, beta, vol, rend };
        }
      } catch (e) {}
      return null;
    };

    Promise.all(aandelen.map(laadBeta)).then(results => {
      const nieuw = {};
      const risico = {};
      results.forEach(r => {
        if (!r) return;
        if (r.beta != null) nieuw[r.sym] = r.beta;
        risico[r.sym] = { vol: r.vol ?? null, rend: r.rend || null };
      });
      if (Object.keys(nieuw).length > 0) setLiveBetas(prev => ({ ...prev, ...nieuw }));
      if (Object.keys(risico).length > 0) setLiveRisico(prev => ({ ...prev, ...risico }));
    });
  }, [beleggingen.map(b => b.symbol).join(',')]);

  // ── Live sector ophalen voor aandelen die niet in SECTOR_MAP staan ──
  // (vooral Europese/Aziatische/overige internationale aandelen, bv. Prosus)
  useEffect(() => {
    const onbekend = beleggingen.filter(b => {
      if (isEtfBelegging(b) || b.type === 'crypto') return false;
      const sym = b.symbol.toUpperCase().split('.')[0];
      return (!SECTOR_MAP[sym] && !liveSectoren[sym]) || !liveLanden[sym];
    });
    if (onbekend.length === 0) return;

    const CACHE_DUUR_SECTOR = 30 * 24 * 60 * 60 * 1000; // 30 dagen

    const laadSector = async (b) => {
      const sym = b.symbol.toUpperCase().split('.')[0];
      // v2: bewaart ook het land van het bedrijf (voor de regio)
      const cacheKey = `matico_sector_v2_${sym}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { sector, land, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DUUR_SECTOR) {
            return { sym, sector, land };
          }
        }
      } catch (e) {}

      try {
        const res = await fetch(`/api/data?endpoint=profile&symbol=${b.symbol}`);
        const data = await res.json();
        // FMP geeft 'sector' in het Engels; Finnhub geeft 'finnhubIndustry'. Map naar onze NL-labels.
        const ruweSector = data?.sector || data?.finnhubIndustry;
        const sector = FMP_SECTOR_MAP[ruweSector] || null;
        const land = data?.country || null;
        if (sector || land) {
          localStorage.setItem(cacheKey, JSON.stringify({ sector, land, timestamp: Date.now() }));
          return { sym, sector, land };
        }
      } catch (e) {}
      return null;
    };

    Promise.all(onbekend.map(laadSector)).then(results => {
      const nieuw = {}; const landen = {};
      results.forEach(r => { if (r?.sector) nieuw[r.sym] = r.sector; if (r?.land) landen[r.sym] = r.land; });
      if (Object.keys(nieuw).length > 0) setLiveSectoren(prev => ({ ...prev, ...nieuw }));
      if (Object.keys(landen).length > 0) setLiveLanden(prev => ({ ...prev, ...landen }));
    });
  }, [beleggingen.map(b => b.symbol).join(',')]);

  // ── Live ETF data laden via FMP + localStorage cache (1 maand) ──
  useEffect(() => {
    // Volledig symbool (bv. SPYY.DE): zonder beurscode vond de bron de ETF
    // niet en viel alles terug op "Wereldwijd"/"Overige".
    const volledig = {};
    beleggingen.filter(b => b.type === 'etf').forEach(b => { volledig[b.symbol.toUpperCase().split('.')[0]] = b.symbol; });
    const etfSymbolen = Object.keys(volledig);
    if (etfSymbolen.length === 0) return;

    const CACHE_DUUR_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagen
    const nieuweData = {};

    const laadEtf = async (basis) => {
      // Check localStorage cache
      // v2: sleutel gewijzigd zodat oude, foutieve cache-entries (van vóór de
      // ETF-sectordata-fix) automatisch genegeerd worden i.p.v. tot 30 dagen
      // stale te blijven staan.
      const cacheKey = `matico_etf_v3_${basis}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DUUR_MS) {
            return { basis, data };
          }
        }
      } catch (e) {}

      // Haal live data op via FMP
      try {
        const res = await fetch(`/api/data?endpoint=etf-holdings&symbol=${encodeURIComponent(volledig[basis] || basis)}`);
        const data = await res.json();
        // Enkel als bruikbaar beschouwen (en dus cachen) als er echte sectordata is,
        // of holdings met een effectief gewicht (niet enkel namen zonder percentages) —
        // dit voorkomt dat onvolledige data 30 dagen lang blijft "hangen".
        const heeftSectoren = data?.sectoren?.length > 0;
        const heeftBruikbareHoldings = data?.holdings?.length > 0 && data.holdings.some(h => h.weightPercentage > 0);
        if (data && (heeftSectoren || heeftBruikbareHoldings)) {
          localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
          return { basis, data };
        }
        // Enkel de kostenratio gekend: wel gebruiken, niet lang bewaren
        if (data?.expenseRatio > 0) return { basis, data };
      } catch (e) { console.error('ETF data fout:', e); }
      return null;
    };

    setEtfDataLoading(true);
    Promise.all(etfSymbolen.map(laadEtf)).then(results => {
      const nieuw = {};
      results.forEach(r => { if (r) nieuw[r.basis] = r.data; });
      setLiveEtfData(prev => ({ ...prev, ...nieuw }));
      setEtfDataLoading(false);
    });
  }, [beleggingen.filter(b => b.type === 'etf').map(b => b.symbol).join(',')]);

    const { grootstePct, grootsteSym, topSector, topSectorPct, topRegio, topRegioPct, typeSuggestie, sectorSuggestie, regioSuggestie, concentratieTips } = useMemo(() => {
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
      if (b.type === 'etf') {
        // Zelfde doorrekening als de spreidingstaart: verdeel de ETF-waarde
        // proportioneel over de sectoren/regio's die het fonds echt bevat,
        // i.p.v. de hele positie als één blok "ETF" te labelen.
        const sectorGewichten = getEtfGewichten(b.symbol, 'sector', liveEtfData, b);
        if (sectorGewichten) {
          Object.entries(sectorGewichten).forEach(([cat, pctInEtf]) => {
            sectorMap[cat] = (sectorMap[cat] || 0) + w * (pctInEtf / 100);
          });
        } else {
          const sectorFallback = isObligatieEtf(b) ? 'Overheid' : 'Overige';
          sectorMap[sectorFallback] = (sectorMap[sectorFallback] || 0) + w;
        }
        const regioGewichten = getEtfGewichten(b.symbol, 'regio', liveEtfData, b);
        if (regioGewichten) {
          Object.entries(regioGewichten).forEach(([cat, pctInEtf]) => {
            regioMap[cat] = (regioMap[cat] || 0) + w * (pctInEtf / 100);
          });
        } else {
          regioMap['Wereldwijd'] = (regioMap['Wereldwijd'] || 0) + w;
        }
      } else {
        const s = getSector(b, liveSectoren); const r = getRegio(b, liveLanden);
        sectorMap[s] = (sectorMap[s] || 0) + w;
        regioMap[r] = (regioMap[r] || 0) + w;
      }
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
    // Een (brede) ETF is zelf al gespreid over veel bedrijven: een groot gewicht
    // daarin is iets anders dan een groot gewicht in één aandeel.
    const grootsteIsEtf = posities[0]?.type === 'etf';
    if (posities[0]?.pct > 50 && grootsteIsEtf) {
      tips.push(`${posities[0].sym} maakt ${getal(posities[0].pct, 0)}% van je portfolio uit. Omdat het een ETF is, is dat bedrag zelf al over veel bedrijven gespreid. Kijk vooral welke regio's en sectoren deze ETF volgt.`);
    } else if (posities[0]?.pct > 50) {
      tips.push(`${posities[0].sym} maakt ${getal(posities[0].pct, 0)}% van je portfolio uit. Dat is een erg hoge concentratie — bij een koersdaling van 10% daalt je portfolio al met ${getal((posities[0].pct * 0.1), 1)}%.`);
    } else if (posities[0]?.pct > 30 && !grootsteIsEtf) {
      tips.push(`${posities[0].sym} is je grootste positie met ${getal(posities[0].pct, 0)}%. Overweeg of dit gewicht past bij je risicoprofiel.`);
    }

    // 2. Top 2 posities nemen te veel in
    if (aantalPosities >= 3 && top2Pct > 70 && !(posities[0]?.type === 'etf' && posities[1]?.type === 'etf')) {
      tips.push(`Je twee grootste posities (${posities[0]?.sym} en ${posities[1]?.sym}) maken samen ${getal(top2Pct, 0)}% uit. Grotere spreiding verlaagt je risico.`);
    }

    // 3. Sector concentratie
    // 'Overige'/'Onbekend' is geen echte sector (data ontbreekt) — daar geen sectorrisico over melden
    const echteTopSector = !['Overige', 'Onbekend', '—'].includes(topS[0]);
    if (topS[1] > 60 && echteTopSector) {
      tips.push(`${getal(topS[1], 0)}% van je portfolio zit in ${topS[0]}. Een sectorcrisis zou een grote impact hebben.`);
    } else if (topS[1] > 40 && top2S.length > 1 && echteTopSector) {
      tips.push(`${getal(topS[1], 0)}% zit indirect in ${topS[0]}, na doorrekening van je ETF-posities. ${top2S[1] ? getal(top2S[1][1], 0) + '% in ' + top2S[1][0] + '.' : ''}`);
    }

    // 4. Regio concentratie
    if (topR[1] > 80) {
      tips.push(`${getal(topR[1], 0)}% is indirect blootgesteld aan ${topR[0]}. Geografische spreiding naar andere regio's kan het risico verlagen.`);
    } else if (topR[1] > 60) {
      tips.push(`${getal(topR[1], 0)}% is indirect blootgesteld aan ${topR[0]}.`);
    }

    // 5. Te weinig posities
    if (aantalPosities === 1) {
      tips.push(`Je hebt slechts 1 positie. Voeg meer beleggingen toe voor betere spreiding.`);
    } else if (aantalPosities === 2 && aandelenPct > 50) {
      tips.push(`Met slechts 2 posities is je portfolio weinig gespreid. Overweeg een brede ETF toe te voegen.`);
    }

    // 6. Geen ETF in portfolio
    if (!beleggingen.some(b => b.type === 'etf') && aantalPosities < 5) {
      tips.push(`Je portfolio bestaat enkel uit individuele aandelen. Een brede ETF zoals VWCE kan eenvoudig voor extra spreiding zorgen.`);
    }

    // 7. Alles goed — positieve tip
    if (tips.length === 0) {
      tips.push(`Je portfolio is goed gespreid over ${aantalPosities} posities, ${Object.keys(sectorMap).length} sectoren en ${Object.keys(regioMap).filter(k => k !== 'Crypto (geen regio)').length} regio's.`);
    }

    // ── Suggesties voor de volgende belegging ──────────────────────────
    // Per dimensie (type/sector/regio) tonen we, enkel als er echt een
    // concentratie is, welke categorie het minst vertegenwoordigd is —
    // dat is de richting die de spreiding het meest zou verbeteren.
    const etfPct = posities.filter(p => p.type === 'etf').reduce((s, p) => s + p.pct, 0);
    const typeSuggestie = (aandelenPct > 60 && etfPct < 20)
      ? `Vooral individuele aandelen (${getal(aandelenPct, 0)}%) — een brede ETF zou hier het meest aan bijdragen.`
      : null;

    // Vroeger: de kleinste categorie (vaak iets onbelangrijks met 0%, zoals
    // "Europa - Opkomend"). Nu: de categorie die het verst onder haar gewicht
    // in de wereldwijde aandelenmarkt (MSCI ACWI, bij benadering) zit —
    // enkel als dat verschil echt iets betekent (minstens 5 procentpunt).
    const ondergewicht = (map, wereld) => Object.entries(wereld)
      .map(([k, w]) => [k, map[k] || 0, w])
      .sort((a, b) => (b[2] - b[1]) - (a[2] - a[1]))[0];
    const sOnder = ondergewicht(sectorMap, WERELD_SECTOR);
    const sectorSuggestie = (sOnder && sOnder[2] - sOnder[1] >= 5)
      ? `${sOnder[0]} is ondervertegenwoordigd: ${getal(sOnder[1], 0)}% in je portfolio, tegenover ongeveer ${getal(sOnder[2], 0)}% in de wereldwijde aandelenmarkt.`
      : null;

    const rOnder = ondergewicht(regioMap, WERELD_REGIO);
    const regioSuggestie = (rOnder && rOnder[2] - rOnder[1] >= 5)
      ? `${rOnder[0]} is ondervertegenwoordigd: ${getal(rOnder[1], 0)}% in je portfolio, tegenover ongeveer ${getal(rOnder[2], 0)}% in de wereldwijde aandelenmarkt.`
      : null;

    return {
      grootstePct: posities[0]?.pct || 0, grootsteSym: posities[0]?.sym || '—',
      topSector: topS[0], topSectorPct: topS[1],
      topRegio: topR[0], topRegioPct: topR[1],
      typeSuggestie, sectorSuggestie, regioSuggestie,
      concentratieTips: tips,
    };
  }, [beleggingen, koersen, liveSectoren, liveLanden, liveEtfData, getMuntFactor]);

  // ── Valutaverdeling (ook gebruikt voor het wisselkoerseffect) ──
  const valutaVerdeling = useMemo(() => {
    // Valutaverdeling: ETFs uitgesplitst per valuta via regio gewichten
    // Valuta per ETF — uitgesplitst op basis van werkelijke blootstelling
    // Dezelfde prefix-matching als de spreiding-database (VWCE.DE → VWCE, IWDA.AS → IWDA)
    const ETF_VALUTA = {
      // Vanguard FTSE All-World (VWCE / VWRL) — wereldwijd gespreide valutamix
      VWCE: { USD: 64.8, EUR: 12.1, JPY: 5.8, GBP: 3.2, TWD: 2.1, KRW: 1.8, CHF: 1.4, AUD: 1.3, CAD: 2.8, HKD: 1.2, Overige: 3.5 },
      VWRL: { USD: 64.8, EUR: 12.1, JPY: 5.8, GBP: 3.2, TWD: 2.1, KRW: 1.8, CHF: 1.4, AUD: 1.3, CAD: 2.8, HKD: 1.2, Overige: 3.5 },
      // iShares Core MSCI World (IWDA / SWRD) — ontwikkelde markten, geen EM
      IWDA: { USD: 72.1, EUR: 13.8, JPY: 6.2, GBP: 2.9, CHF: 1.8, AUD: 0.9, CAD: 1.2, HKD: 0.6, Overige: 0.5 },
      SWRD: { USD: 72.1, EUR: 13.8, JPY: 6.2, GBP: 2.9, CHF: 1.8, AUD: 0.9, CAD: 1.2, HKD: 0.6, Overige: 0.5 },
      // iShares Emerging Markets (EMIM / IEMA / EEM) — opkomende markten
      EMIM: { TWD: 16.8, INR: 13.2, CNY: 12.4, KRW: 11.3, BRL: 5.4, ZAR: 3.8, SAR: 4.1, MXN: 2.8, HKD: 4.2, USD: 8.6, Overige: 17.4 },
      IEMA: { TWD: 16.8, INR: 13.2, CNY: 12.4, KRW: 11.3, BRL: 5.4, ZAR: 3.8, SAR: 4.1, MXN: 2.8, HKD: 4.2, USD: 8.6, Overige: 17.4 },
      EEM:  { TWD: 16.8, INR: 13.2, CNY: 12.4, KRW: 11.3, BRL: 5.4, ZAR: 3.8, SAR: 4.1, MXN: 2.8, HKD: 4.2, USD: 8.6, Overige: 17.4 },
      // Invesco NASDAQ-100 (EQQQ / CNDX / QQQ) — bijna volledig USD
      EQQQ: { USD: 95.2, EUR: 2.1, TWD: 1.2, Overige: 1.5 },
      CNDX: { USD: 95.2, EUR: 2.1, TWD: 1.2, Overige: 1.5 },
      QQQ:  { USD: 95.2, EUR: 2.1, TWD: 1.2, Overige: 1.5 },
      // iShares S&P 500 (CSPX / SXR8 / IUSA / IVV / SPY) — 100% USD
      CSPX: { USD: 99.5, Overige: 0.5 },
      SXR8: { USD: 99.5, Overige: 0.5 },
      IUSA: { USD: 99.5, Overige: 0.5 },
      IVV:  { USD: 99.5, Overige: 0.5 },
      SPY:  { USD: 99.5, Overige: 0.5 },
      // Xtrackers MSCI World (XDWD / XWLD)
      XDWD: { USD: 71.8, EUR: 14.2, JPY: 6.4, GBP: 2.8, CHF: 1.9, AUD: 0.9, CAD: 1.2, HKD: 0.5, Overige: 0.3 },
      XWLD: { USD: 71.8, EUR: 14.2, JPY: 6.4, GBP: 2.8, CHF: 1.9, AUD: 0.9, CAD: 1.2, HKD: 0.5, Overige: 0.3 },
      // Amundi MSCI World / Prime All Country (LCWD / WEBG / PRAW)
      LCWD: { USD: 71.5, EUR: 14.0, JPY: 6.3, GBP: 3.1, CHF: 1.8, AUD: 0.9, CAD: 1.2, HKD: 0.6, Overige: 0.6 },
      WEBG: { USD: 64.2, EUR: 12.8, JPY: 5.9, GBP: 3.1, TWD: 2.1, KRW: 1.8, CHF: 1.4, AUD: 1.1, CAD: 2.6, HKD: 1.2, Overige: 3.8 },
      PRAW: { USD: 64.2, EUR: 12.8, JPY: 5.9, GBP: 3.1, TWD: 2.1, KRW: 1.8, CHF: 1.4, AUD: 1.1, CAD: 2.6, HKD: 1.2, Overige: 3.8 },
      // iShares Core EURO STOXX 50 (CSX5) — volledig EUR
      CSX5: { EUR: 100.0 },
      // iShares Core MSCI Europe (SMEA / IMEU) — mix Europese valuta
      SMEA: { GBP: 22.4, EUR: 58.6, CHF: 14.8, SEK: 2.1, DKK: 1.2, NOK: 0.9 },
      IMEU: { GBP: 22.4, EUR: 58.6, CHF: 14.8, SEK: 2.1, DKK: 1.2, NOK: 0.9 },
      // SPDR (GWL)
      GWL:  { USD: 99.5, Overige: 0.5 },
    };
    // Opzoeken op ticker; anders via het soort index (uit de naam) of,
    // bij obligaties, de munt van de obligaties. Vroeger telde een ETF
    // die niet in de lijst stond (bv. SPYY, VFEM) voor 100% als de munt
    // waarin hij noteert (euro), terwijl hij vooral in dollar belegt.
    const FAMILIE_VALUTA = { VWCE: 'VWCE', IWDA: 'IWDA', CSPX: 'CSPX', VTI: 'CSPX', EQQQ: 'EQQQ', VFEM: 'EMIM', SMEA: 'SMEA', CSX5: 'CSX5' };
    const zoekETFValuta = (b) => {
      const basis = b.symbol.toUpperCase().split('.')[0];
      if (ETF_VALUTA[basis]) return ETF_VALUTA[basis];
      if (isObligatieEtf(b)) {
        const naam = (b.naam || '').toLowerCase();
        if (/\beur\b|euro/.test(naam)) return { EUR: 100 };
        if (/\busd\b|treasury/.test(naam)) return { USD: 100 };
        return null;
      }
      const fam = herkenEtfFamilie(b);
      if (fam?.regio?.Japan) return { JPY: 100 };
      return fam?.voorbeeld && FAMILIE_VALUTA[fam.voorbeeld] ? ETF_VALUTA[FAMILIE_VALUTA[fam.voorbeeld]] : null;
    };

    const totaal = beleggingen.reduce((s, b) => {
      const k = koersen[b.symbol]; return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
    }, 0) || 1;
    const valutaMap = {};
    beleggingen.forEach(b => {
      const k = koersen[b.symbol];
      const w = (k ? k.c : b.kostprijs) * b.aantal * factor(b);
      const etfValuta = b.type === 'etf' ? zoekETFValuta(b) : null;
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
      .sort((a, b) => (a.munt === 'Overige') - (b.munt === 'Overige') || b.waarde - a.waarde);
    return valutaData;
  }, [beleggingen, koersen, getMuntFactor]);

  // ── Echte wisselkoersen (ECB) voor het wisselkoerseffect ──
  // Vroeger toonde dit tabblad vaste, verzonnen cijfers.
  const [fxReeksen, setFxReeksen] = useState({});
  const vreemdeMunten = valutaVerdeling
    .filter(v => v.munt !== 'EUR' && v.munt !== 'Overige' && v.pct >= 0.3)
    .map(v => v.munt).sort().join(',');
  useEffect(() => {
    if (!vreemdeMunten) return;
    const start = new Date(); start.setFullYear(start.getFullYear() - 1); start.setDate(start.getDate() - 40);
    const startIso = start.toISOString().slice(0, 10);
    vreemdeMunten.split(',').forEach(async (munt) => {
      const key = `kapitas_fxreeks_${munt}`;
      try {
        const c = JSON.parse(localStorage.getItem(key) || 'null');
        if (c && c.start <= startIso && Date.now() - c.ts < 12 * 3600_000) { setFxReeksen(prev => ({ ...prev, [munt]: c.rates })); return; }
      } catch (e) {}
      try {
        const d = await (await fetch(`/api/data?endpoint=forex-history&reeks=1&van=${munt}&datum=${startIso}`)).json();
        if (d?.rates && Object.keys(d.rates).length > 0) {
          try { localStorage.setItem(key, JSON.stringify({ rates: d.rates, start: startIso, ts: Date.now() })); } catch (e) {}
          setFxReeksen(prev => ({ ...prev, [munt]: d.rates }));
        }
      } catch (e) {}
    });
  }, [vreemdeMunten]);

  // ── ETF X-ray database ──
  const etfs = beleggingen.filter(b => b.type === 'etf');
  const ETF_DB_XRAY = {
    VWCE: {
      kostenratio: 0.19,
      totaalHoldings: 3768,
      holdings: [
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 4.66 },
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 3.90 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 3.02 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 2.54 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 2.23 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 1.98 },
        { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 1.42 },
        { sym: 'AVGO.US', naam: 'Broadcom Inc', pct: 1.38 },
        { sym: 'GOOG.US', naam: 'Alphabet Inc Class C', pct: 1.21 },
        { sym: '2330.TW', naam: 'Taiwan Semiconductor Manufacturing Co. Ltd.', pct: 0.98 },
      ],
    },
    VWRL: {
      kostenratio: 0.19,
      totaalHoldings: 3768,
      holdings: [
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 4.66 },
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 3.90 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 3.02 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 2.54 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 2.23 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 1.98 },
        { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 1.42 },
        { sym: 'AVGO.US', naam: 'Broadcom Inc', pct: 1.38 },
        { sym: 'GOOG.US', naam: 'Alphabet Inc Class C', pct: 1.21 },
        { sym: '2330.TW', naam: 'Taiwan Semiconductor Manufacturing Co. Ltd.', pct: 0.98 },
      ],
    },
    IWDA: {
      kostenratio: 0.20,
      totaalHoldings: 1397,
      holdings: [
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 5.62 },
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 4.53 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 3.47 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 2.78 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 2.24 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 2.18 },
        { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 1.52 },
        { sym: 'AVGO.US', naam: 'Broadcom Inc', pct: 1.48 },
        { sym: 'GOOG.US', naam: 'Alphabet Inc Class C', pct: 1.41 },
        { sym: 'JPM.US', naam: 'JPMorgan Chase & Co.', pct: 1.28 },
      ],
    },
    SWRD: {
      kostenratio: 0.12,
      totaalHoldings: 1397,
      holdings: [
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 5.62 },
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 4.53 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 3.47 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 2.78 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 2.24 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 2.18 },
        { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 1.52 },
        { sym: 'AVGO.US', naam: 'Broadcom Inc', pct: 1.48 },
        { sym: 'GOOG.US', naam: 'Alphabet Inc Class C', pct: 1.41 },
        { sym: 'JPM.US', naam: 'JPMorgan Chase & Co.', pct: 1.28 },
      ],
    },
    EMIM: {
      kostenratio: 0.18,
      totaalHoldings: 2793,
      holdings: [
        { sym: '2330.TW', naam: 'Taiwan Semiconductor Manufacturing Co. Ltd.', pct: 12.45 },
        { sym: 'SMSN.IL', naam: 'Samsung Electronics Co. Ltd.', pct: 6.45 },
        { sym: '000660.KS', naam: 'SK hynix Inc.', pct: 4.91 },
        { sym: '700.HK', naam: 'Tencent Holdings Ltd.', pct: 2.54 },
        { sym: '9988.HK', naam: 'Alibaba Group Holding Ltd.', pct: 1.96 },
        { sym: 'RELIANCE.NS', naam: 'Reliance Industries Ltd.', pct: 1.82 },
        { sym: 'INFY.NS', naam: 'Infosys Ltd.', pct: 1.24 },
        { sym: 'ICICIBANK.NS', naam: 'ICICI Bank Ltd.', pct: 1.18 },
        { sym: 'TCS.NS', naam: 'Tata Consultancy Services Ltd.', pct: 1.12 },
        { sym: 'MELI.US', naam: 'MercadoLibre Inc.', pct: 0.96 },
      ],
    },
    EQQQ: {
      kostenratio: 0.30,
      totaalHoldings: 101,
      holdings: [
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 8.60 },
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 7.09 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 5.07 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 4.82 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 4.74 },
        { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 3.98 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 3.54 },
        { sym: 'GOOG.US', naam: 'Alphabet Inc Class C', pct: 3.21 },
        { sym: 'AVGO.US', naam: 'Broadcom Inc', pct: 3.08 },
        { sym: 'COST.US', naam: 'Costco Wholesale Corp.', pct: 2.64 },
      ],
    },
    CNDX: {
      kostenratio: 0.20,
      totaalHoldings: 101,
      holdings: [
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 8.72 },
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 8.14 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 7.98 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 5.62 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 4.88 },
        { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 4.12 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 3.94 },
      ],
    },
    CSPX: {
      kostenratio: 0.07,
      totaalHoldings: 503,
      holdings: [
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 7.62 },
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 6.84 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 4.96 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 3.65 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 2.99 },
        { sym: 'AVGO.US', naam: 'Broadcom Inc', pct: 2.67 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 2.54 },
        { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 2.11 },
        { sym: 'GOOG.US', naam: 'Alphabet Inc Class C', pct: 1.98 },
        { sym: 'JPM.US', naam: 'JPMorgan Chase & Co.', pct: 1.76 },
      ],
    },
    SXR8: {
      kostenratio: 0.07,
      totaalHoldings: 503,
      holdings: [
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 7.62 },
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 6.84 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 4.96 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 3.65 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 2.99 },
        { sym: 'AVGO.US', naam: 'Broadcom Inc', pct: 2.67 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 2.54 },
        { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 2.11 },
        { sym: 'GOOG.US', naam: 'Alphabet Inc Class C', pct: 1.98 },
        { sym: 'JPM.US', naam: 'JPMorgan Chase & Co.', pct: 1.76 },
      ],
    },
    XDWD: {
      kostenratio: 0.19,
      totaalHoldings: 1397,
      holdings: [
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 4.92 },
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 4.48 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 3.82 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 3.18 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 2.11 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 1.98 },
        { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 1.64 },
        { sym: 'AVGO.US', naam: 'Broadcom Inc', pct: 1.52 },
      ],
    },
    LCWD: {
      kostenratio: 0.14,
      totaalHoldings: 1397,
      holdings: [
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 4.95 },
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 4.50 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 3.84 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 3.20 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 2.12 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 1.99 },
      ],
    },
    WEBG: {
      kostenratio: 0.07,
      totaalHoldings: 3768,
      holdings: [
        { sym: 'NVDA.US', naam: 'NVIDIA Corporation', pct: 1.78 },
        { sym: 'AAPL.US', naam: 'Apple Inc', pct: 1.51 },
        { sym: 'MSFT.US', naam: 'Microsoft Corporation', pct: 1.16 },
        { sym: 'AMZN.US', naam: 'Amazon.com Inc', pct: 0.97 },
        { sym: 'GOOGL.US', naam: 'Alphabet Inc Class A', pct: 0.85 },
        { sym: 'META.US', naam: 'Meta Platforms Inc.', pct: 0.51 },
        { sym: 'TSLA.US', naam: 'Tesla Inc', pct: 0.42 },
      ],
    },
    CSX5: {
      kostenratio: 0.10,
      totaalHoldings: 50,
      holdings: [
        { sym: 'ASML.AS', naam: 'ASML Holding NV', pct: 7.42 },
        { sym: 'SAP.DE', naam: 'SAP SE', pct: 5.18 },
        { sym: 'LVMH.PA', naam: 'LVMH Moet Hennessy Louis Vuitton SE', pct: 4.87 },
        { sym: 'SIE.DE', naam: 'Siemens AG', pct: 4.12 },
        { sym: 'TTE.PA', naam: 'TotalEnergies SE', pct: 3.98 },
        { sym: 'AIR.PA', naam: 'Airbus SE', pct: 3.76 },
        { sym: 'SAN.PA', naam: 'Sanofi SA', pct: 3.54 },
        { sym: 'BNP.PA', naam: 'BNP Paribas SA', pct: 3.21 },
        { sym: 'ALV.DE', naam: 'Allianz SE', pct: 3.08 },
        { sym: 'IBE.MC', naam: 'Iberdrola SA', pct: 2.87 },
      ],
    },
    SMEA: {
      kostenratio: 0.12,
      totaalHoldings: 434,
      holdings: [
        { sym: 'ASML.AS', naam: 'ASML Holding NV', pct: 3.84 },
        { sym: 'NOVN.SW', naam: 'Novartis AG', pct: 2.98 },
        { sym: 'ROG.SW', naam: 'Roche Holding AG', pct: 2.76 },
        { sym: 'NESN.SW', naam: 'Nestle SA', pct: 2.54 },
        { sym: 'AZN.L', naam: 'AstraZeneca PLC', pct: 2.41 },
        { sym: 'HSBA.L', naam: 'HSBC Holdings PLC', pct: 2.18 },
        { sym: 'SHEL.L', naam: 'Shell PLC', pct: 2.04 },
        { sym: 'SAP.DE', naam: 'SAP SE', pct: 1.98 },
        { sym: 'NOVO-B.CO', naam: 'Novo Nordisk A/S', pct: 1.87 },
        { sym: 'ULVR.L', naam: 'Unilever PLC', pct: 1.76 },
      ],
    },
  };

  // Zoek ETF data: eerst live FMP data, dan hardcoded fallback
  const zoekXray = (symbol) => {
    const basis = symbol.toUpperCase().split('.')[0];
    const live = liveEtfData[basis];
    if (live?.holdings?.length > 0) {
      // Converteer FMP formaat naar intern formaat
      return {
        // Onbekende kostenratio = null (niet 0%: dat trok het gemiddelde omlaag)
        kostenratio: live.expenseRatio || ETF_DB_XRAY[basis]?.kostenratio || KOSTENRATIO_EXTRA[basis] || null,
        totaalHoldings: ETF_DB_XRAY[basis]?.totaalHoldings,
        holdings: live.holdings.slice(0, 10).map(h => ({
          // Obligaties e.d. hebben vaak geen ticker: dan lege sym (niet '?'),
          // anders werden ze allemaal samengeteld onder één '?'-rij.
          sym: h.asset || h.symbol || h.ticker || '',
          naam: h.name || h.companyName || h.asset || 'Onbekend',
          pct: parseFloat(h.weightPercentage || h.weight || h.pct || 0)
        })).filter(h => h.pct > 0)
      };
    }
    if (ETF_DB_XRAY[basis]) return { ...ETF_DB_XRAY[basis], kostenratio: live?.expenseRatio || ETF_DB_XRAY[basis].kostenratio };
    if (live?.expenseRatio) return { kostenratio: live.expenseRatio, holdings: [] };
    if (KOSTENRATIO_EXTRA[basis]) return { kostenratio: KOSTENRATIO_EXTRA[basis], holdings: [] };
    return null;
  };

  // Ongeveer aantal posities per soort index (als de ETF niet in de lijst staat)
  const aantalPosities = (etf) => {
    const basis = etf.symbol.toUpperCase().split('.')[0];
    if (ETF_DB_XRAY[basis]?.totaalHoldings) return ETF_DB_XRAY[basis].totaalHoldings;
    const naam = (etf.naam || '').toLowerCase();
    if (/acwi|all country/.test(naam)) return 2500;     // MSCI ACWI
    const fam = herkenEtfFamilie(etf)?.voorbeeld;
    const PER_FAMILIE = { VWCE: 3700, IWDA: 1350, CSPX: 503, VTI: 3600, EQQQ: 101, VFEM: 2100, SMEA: 420, CSX5: 50 };
    return (fam && PER_FAMILIE[fam]) || null;
  };

  // Bereken gecombineerde holdings over alle ETFs
  const { alleHoldings, totaalUniekeBedrijven } = (() => {
    const totaalPortfolio = beleggingen.reduce((s, b) => {
      const k = koersen[b.symbol]; return s + (k ? k.c : b.kostprijs) * b.aantal * (getMuntFactor ? getMuntFactor(b.munt || 'EUR') : 1);
    }, 0) || 1;

    const holdingMap = {}; // sym → { naam, gewichtInPortfolio, viaEtfs }
    let totaalBedrijvenPerEtf = 0;

    etfs.forEach(etf => {
      const data = zoekXray(etf.symbol);
      if (!data) return;
      const k = koersen[etf.symbol];
      const etfWaarde = (k ? k.c : etf.kostprijs) * etf.aantal * (getMuntFactor ? getMuntFactor(etf.munt || 'EUR') : 1);
      const etfGewicht = (etfWaarde / totaalPortfolio) * 100;

      // Aantal bedrijven: brede index-ETF's bevatten grotendeels dezelfde
      // bedrijven (een wereld-ETF bevat ook de bedrijven van een S&P 500- of
      // opkomende-markten-ETF). Optellen telde ze dubbel; de grootste ETF is
      // een goede benadering van het aantal unieke bedrijven. Obligatie-ETF's
      // bevatten geen bedrijven en tellen niet mee.
      const etfTotaalBedrijven = isObligatieEtf(etf) ? 0 : (aantalPosities(etf) || 0);
      totaalBedrijvenPerEtf = Math.max(totaalBedrijvenPerEtf, etfTotaalBedrijven);

      data.holdings.forEach(h => {
        const gewichtInPortfolio = etfGewicht * (h.pct / 100);
        const sleutel = h.sym || h.naam;
        if (!holdingMap[sleutel]) {
          holdingMap[sleutel] = { sym: h.sym, naam: h.naam, gewicht: 0, viaEtfs: [] };
        }
        holdingMap[sleutel].gewicht += gewichtInPortfolio;
        if (!holdingMap[sleutel].viaEtfs.find(v => v.sym === etf.symbol)) {
          holdingMap[sleutel].viaEtfs.push({ sym: etf.symbol, pct: h.pct });
        }
      });
    });

    return {
      alleHoldings: Object.values(holdingMap).sort((a, b) => b.gewicht - a.gewicht),
      totaalUniekeBedrijven: totaalBedrijvenPerEtf,
    };
  })();

  // Gemiddelde kostenratio gewogen op ETF-waarde — enkel over ETF's waarvan
  // de kostenratio gekend is (een onbekende telde vroeger als 0%).
  const { gemiddeldeKostenratio, etfsZonderKosten } = (() => {
    const waarde = (b) => { const k = koersen[b.symbol]; return (k ? k.c : b.kostprijs) * b.aantal * (getMuntFactor ? getMuntFactor(b.munt || 'EUR') : 1); };
    const gekend = etfs.filter(b => zoekXray(b.symbol)?.kostenratio > 0);
    const totaal = gekend.reduce((s, b) => s + waarde(b), 0);
    const gewogen = totaal > 0 ? gekend.reduce((s, b) => s + zoekXray(b.symbol).kostenratio * (waarde(b) / totaal), 0) : 0;
    return { gemiddeldeKostenratio: gewogen, etfsZonderKosten: etfs.filter(b => !gekend.includes(b)).map(b => b.symbol) };
  })();

  if (beleggingen.length === 0) {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SidebarToggleKnop onToggleSidebar={onToggleSidebar} sidebarCollapsed={sidebarCollapsed} />
            <h1>{t('an_titel')}</h1>
          </div>
        </div>
        <div style={{ padding: '0 32px' }}>
          <div className="empty-state card"><h3>{t('an_leeg_titel')}</h3><p>{t('an_leeg_tekst')}</p></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 60px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SidebarToggleKnop onToggleSidebar={onToggleSidebar} sidebarCollapsed={sidebarCollapsed} />
          <h1>{t('an_titel')}</h1>
        </div>
      </div>
      <div style={{ padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Rij 1: Totale winst/verlies + Risicoprofiel ── */}
        <div className="analyse-row-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Totale winst/verlies */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{t('an_totale_winst')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{t('an_van_je_portfolio')}</div>
              </div>
              {/* Dropdown filter */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setWinstDropdown(o => !o)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit'
                }}>
                  {winstFilter === 'exclusief' ? t('an_exclusief_verkocht') : t('an_inclusief_verkocht')}
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
                        {opt === 'exclusief' ? t('an_exclusief_verkocht') : t('an_inclusief_verkocht')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Staven */}
            <div style={{ marginBottom: 20 }}>
              {[
                { label: t('an_kostprijs'), waarde: kostprijs, kleur: 'var(--text-muted)' },
                { label: t('an_huidige_waarde'), waarde: huidigeWaarde, kleur: ACCENT },
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
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('an_winst_verlies_totaal')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: winst >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {winst >= 0 ? '+' : '-'}€{fmt(Math.abs(winst))}
                </span>
                <span style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: winst >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
                  color: winst >= 0 ? 'var(--green)' : 'var(--red)'
                }}>
                  {winst >= 0 ? '+' : ''}{getal(winstPct, 2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Risicoprofiel */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t('an_risicoprofiel')}</div>
              <button onClick={() => setRisicoInfoOpen(true)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center',
                borderRadius: '50%', transition: 'color 0.15s'
              }} title={t('an_risico_info_title')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{t('an_van_je_portfolio')}</div>

            <div style={{
              padding: '12px 16px', background: 'var(--accent-bg)',
              border: '1px solid var(--accent-light)', borderRadius: 10, marginBottom: 24, fontSize: 13,
              color: 'var(--accent)', display: 'flex', alignItems: 'flex-start', gap: 8
            }}>
              <span>💡</span>
              <span>{t('an_marktdaling_deel1')} {getal((beta * 10), 1)}%.</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{t('an_beweeglijkheid')}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {volatiliteit != null ? `${getal(volatiliteit * 100, 0)}%` : '—'}
                  {volatiliteit != null && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>{t('an_per_jaar')}</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{t('an_marktinvloed_beta')}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{getal(beta, 2)}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{t('an_risiconiveau')}</div>
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
                  <h2 style={{ fontSize: 20, fontWeight: 700 }}>{t('an_wat_is_risicoprofiel')}</h2>
                  <button onClick={() => setRisicoInfoOpen(false)} style={{
                    background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer',
                    borderRadius: 8, padding: '4px 8px', color: 'var(--text-muted)', fontSize: 14
                  }}>✕</button>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 24 }}>
                  {t('an_risico_uitleg')}
                </p>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t('an_vier_risiconiveaus')}</div>
                {[
                  { label: t('an_risico_defensief'), kleur: 'var(--green)', beschrijving: t('an_risico_defensief_desc') },
                  { label: t('an_risico_neutraal'), kleur: '#1e3a8a', beschrijving: t('an_risico_neutraal_desc') },
                  { label: t('an_risico_offensief'), kleur: '#f97316', beschrijving: t('an_risico_offensief_desc') },
                  { label: t('an_risico_speculatief'), kleur: 'var(--red)', beschrijving: t('an_risico_speculatief_desc') },
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
                {betaPerBelegging.length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Per belegging</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 12 }}>
                      Beweeglijkheid: hoeveel de koers gemiddeld per jaar schommelt (een wereldwijde ETF ± 13%). Bèta: hoe sterk ze meebeweegt met de wereldwijde aandelenmarkt (MSCI World); 1,0 = even sterk, 0 = los van de markt. Berekend uit de koersen van de laatste 5 jaar, in euro.
                    </p>
                    {betaPerBelegging.map(r => (
                      <div key={r.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.naam || r.symbol}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.symbol} · {getal(r.gewicht * 100, 1)}% van je portefeuille</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.vol != null ? `${getal(r.vol * 100, 0)}% / jaar` : '—'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            bèta {getal(r.beta == null ? 1 : r.beta, 2)}{r.beta == null ? ' (onbekend)' : r.geschat ? ' (schatting)' : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Spreiding ── */}
        <div className="card">
          <div className="analyse-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t('an_spreiding')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{t('an_van_je_portfolio')}</div>
            </div>
            <div className="analyse-tab-group" style={{ display: 'flex', gap: 4 }}>
              {['Type', 'Sectoren', 'Regio'].map(tb => (
                <button key={tb} onClick={() => { setSpreidingTab(tb); setSpreidingSubFilter('Alles'); setSpreidingDropdownOpen(false); }} style={{
                  padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)',
                  background: spreidingTab === tb ? 'var(--text-primary)' : 'transparent',
                  color: spreidingTab === tb ? 'var(--bg-white)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
                }}>{tb === 'Type' ? t('an_tab_type') : tb === 'Sectoren' ? t('an_tab_sectoren') : t('an_tab_regio')}</button>
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
                  {spreidingSubFilter === 'Alles' ? t('an_alles') : spreidingSubFilter === 'Aandelen' ? t('ov_type_aandeel') : t('ov_type_etf')} <ChevronDown size={13} />
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
                        {opt === 'Alles' ? t('an_alles') : opt === 'Aandelen' ? t('ov_type_aandeel') : t('ov_type_etf')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="analyse-spread-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32, alignItems: 'flex-start' }}>
            {/* Donut — sticky naast de legenda */}
            <div className="analyse-spread-donut" style={{ position: 'sticky', top: 0, height: 260 }}>
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
                        <span style={{ color: kleur, marginLeft: 8 }}>{getal(value, 2)}%</span>
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
        <div className="analyse-row-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Concentratierisico */}
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('an_concentratierisico')}</div>
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
              { label: t('an_grootste_positie'), waarde: grootsteSym, pct: grootstePct, suggestie: typeSuggestie },
              { label: t('an_top_sector'), waarde: topSector, pct: topSectorPct, suggestie: sectorSuggestie },
              { label: t('an_top_regio'), waarde: topRegio, pct: topRegioPct, suggestie: regioSuggestie },
            ].map(({ label, waarde, pct, suggestie }) => (
              <div key={label} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{waarde} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{getal(pct, 0)}%</span></div>
                <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: ACCENT, borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
                {suggestie && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <span style={{ flexShrink: 0 }}>→</span>
                    <span>{suggestie}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Valutablootstelling */}
          <div className="card">
            <div className="analyse-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t('an_valutablootstelling')}</div>
              <div className="analyse-tab-group" style={{ display: 'flex', gap: 4 }}>
                {['verdeling', 'wisselkoers'].map(tb => (
                  <button key={tb} onClick={() => setValutaTab(tb)} style={{
                    padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)',
                    background: valutaTab === tb ? 'var(--text-primary)' : 'transparent',
                    color: valutaTab === tb ? 'var(--bg-white)' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
                  }}>{tb === 'verdeling' ? t('an_valutaverdeling') : t('an_wisselkoerseffect')}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{t('an_van_portfolio_incl_etf')}</div>

            {valutaTab === 'verdeling' ? (() => {
              const valutaData = valutaVerdeling;
              // 'Overige' grijs (anders dezelfde kleur als de eerste munt)
              const valutaKleur = (v, i) => v.munt === 'Overige' ? '#94a3b8' : PIE_KLEUREN[i % PIE_KLEUREN.length];

              return (
                <div className="analyse-currency-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={valutaData} dataKey="pct" nameKey="munt" cx="50%" cy="50%" innerRadius={50} outerRadius={88} paddingAngle={2}>
                          {valutaData.map((v, i) => <Cell key={i} fill={valutaKleur(v, i)} />)}
                        </Pie>
                        <Tooltip content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const { name, value, payload: p } = payload[0];
                          const kleur = p.fill || PIE_KLEUREN[0];
                          return (
                            <div style={{ background: 'white', border: `1.5px solid ${kleur}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
                              <span style={{ color: kleur, fontWeight: 700 }}>{name}</span>
                              <span style={{ color: kleur, marginLeft: 8 }}>{getal(value, 2)}%</span>
                            </div>
                          );
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    {valutaData.map((v, i) => (
                      <div key={v.munt} style={{ marginBottom: 8 }}>
                        <div className="analyse-currency-legend-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: valutaKleur(v, i), display: 'inline-block' }} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{v.munt}</span>
                          </div>
                          <div className="analyse-currency-amount">
                            <span className="analyse-currency-value" style={{ fontSize: 13, fontWeight: 600, marginRight: 6 }}>€{fmt(v.waarde)}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{getal(v.pct, 2)}%</span>
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${v.pct}%`, background: valutaKleur(v, i), borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })() : (() => {
              // Wisselkoerseffect: per periode de verandering van elke vreemde munt
              // tegenover de euro (ECB), gewogen met je huidige valutaverdeling.
              const koersOp = (rates, iso) => {
                let r = null;
                for (const d of Object.keys(rates).sort()) { if (d <= iso) r = rates[d]; else break; }
                return r;
              };
              const valutaNu = valutaVerdeling;
              const metReeks = valutaNu.filter(v => fxReeksen[v.munt]);
              const nu = new Date();
              const iso = (d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
              const MK = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
              const grenzen = [];
              if (wisselkoersPeriode === '1M') {
                for (let i = 4; i >= 1; i--) {
                  const tot = new Date(nu); tot.setDate(nu.getDate() - 7 * (i - 1));
                  const van = new Date(tot); van.setDate(tot.getDate() - 7);
                  grenzen.push({ label: `${tot.getDate()} ${MK[tot.getMonth()]}`, van: iso(van), tot: iso(tot) });
                }
              } else {
                const start = wisselkoersPeriode === 'YTD'
                  ? new Date(nu.getFullYear(), 0, 1)
                  : new Date(nu.getFullYear() - 1, nu.getMonth() + 1, 1);
                for (let m = new Date(start); m <= nu; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
                  const van = new Date(m.getFullYear(), m.getMonth(), 0);          // laatste dag vorige maand
                  const eind = new Date(m.getFullYear(), m.getMonth() + 1, 0);     // laatste dag deze maand
                  grenzen.push({ label: `${MK[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`, van: iso(van), tot: iso(eind > nu ? nu : eind) });
                }
              }
              const periodeData = grenzen.map(g => ({
                maand: g.label,
                effect: Math.round(metReeks.reduce((som, v) => {
                  const a = koersOp(fxReeksen[v.munt], g.van), b = koersOp(fxReeksen[v.munt], g.tot);
                  return a && b ? som + (v.pct / 100) * (b / a - 1) * 100 : som;
                }, 0) * 100) / 100,
              }));
              const totaalEffect = (periodeData.reduce((f, d) => f * (1 + d.effect / 100), 1) - 1) * 100;
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
                    <span>{!vreemdeMunten
                      ? t('an_geen_vreemde_valuta')
                      : metReeks.length === 0
                        ? t('an_data_laden')
                        : <>{t('an_wisselkoersen_deel1')} {wisselkoersPeriode === 'YTD' ? t('an_periode_dit_jaar') : wisselkoersPeriode === '1M' ? t('an_periode_deze_maand') : t('an_periode_afgelopen_jaar')} {t('an_wisselkoersen_deel2')} <strong style={{ color: isPos ? 'var(--green)' : 'var(--red)' }}>{isPos ? '+' : '-'}{getal(Math.abs(totaalEffect), 2)}%</strong>{t('an_wisselkoersen_deel3')}</>}</span>
                  </div>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={periodeData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                        <XAxis dataKey="maand" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                          tickFormatter={v => `${v > 0 ? '+' : ''}${getal(v, 1)}%`} />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t('an_etf_xray')}</div>
              {etfDataLoading ? (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                  ⟳ {t('an_data_laden')}
                </span>
              ) : (() => {
                const cacheKey = `matico_etf_v3_${etfs[0]?.symbol?.toUpperCase().split('.')[0]}`;
                try {
                  const cached = localStorage.getItem(cacheKey);
                  if (cached) {
                    const { timestamp } = JSON.parse(cached);
                    const datum = new Date(timestamp).toLocaleDateString('nl-BE');
                    return (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                        ✓ {t('an_bijgewerkt_op')} {datum}
                      </span>
                    );
                  }
                } catch (e) {}
                return null;
              })()}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>{t('an_top_holdings_bijgewerkt')}</div>

            {/* Stats */}
            <div className="analyse-etf-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{t('an_aantal_etfs')}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{etfs.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{t('an_aantal_bedrijven')}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }} title="Ongeveer: brede ETF's bevatten grotendeels dezelfde bedrijven">{totaalUniekeBedrijven > 0 ? `± ${totaalUniekeBedrijven.toLocaleString('nl-BE')}` : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{t('an_gemiddelde_kostenratio')}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{gemiddeldeKostenratio > 0 ? `${getal(gemiddeldeKostenratio, 2)}%` : '—'}</div>
                {etfsZonderKosten.length > 0 && (
                  <div className="analyse-etf-noot" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>zonder {etfsZonderKosten.join(', ')} (kostenratio onbekend)</div>
                )}
              </div>
            </div>

            {/* Holdings tabel */}
            <div style={{ borderTop: '1px solid var(--border-light)' }}>
              {/* Sectietitel */}
              <div style={{ padding: '10px 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                {t('an_top10_bedrijven')}
              </div>
              <div className="analyse-etf-row" style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                <span>{t('ov_col_naam')}</span>
                <span style={{ textAlign: 'right' }}>{t('an_col_gewicht_portfolio')}</span>
                <span className="analyse-etf-via" style={{ textAlign: 'right' }}>{t('an_col_via')}</span>
              </div>
              {alleHoldings.slice(0, 10).map((h, i) => (
                <div key={h.sym || h.naam} className="analyse-etf-row" style={{
                  display: 'grid', gridTemplateColumns: '1fr 160px 1fr',
                  padding: '11px 0', borderBottom: '1px solid var(--border-light)', alignItems: 'center'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Naam + symbool */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, overflow: 'hidden',
                      border: '1px solid var(--border)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'white'
                    }}>
                      {!h.sym ? (
                        <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 11 }}>{h.naam.slice(0, 2).toUpperCase()}</span>
                      ) : <img
                        src={`https://assets.parqet.com/logos/symbol/${h.sym.split('.')[0]}?format=png`}
                        alt={h.sym}
                        style={{ width: 26, height: 26, objectFit: 'contain' }}
                        onError={e => {
                          e.target.style.display = 'none';
                          e.target.parentNode.style.background = 'var(--accent-bg)';
                          e.target.parentNode.innerHTML = `<span style="color:var(--accent);font-weight:700;font-size:11px">${h.sym.split('.')[0].slice(0,2).toUpperCase()}</span>`;
                        }}
                      />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.naam}</div>
                      {h.sym && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.sym}</div>}
                    </div>
                  </div>
                  {/* Gewicht */}
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                    {getal(h.gewicht, 2)}%
                  </div>
                  {/* Via ETFs */}
                  <div className="analyse-etf-via" style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {h.viaEtfs.map(v => (
                      <div key={v.sym}>{v.sym} <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{getal(v.pct, 2)}%</span></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Transactiekosten ── */}
        {(() => {
          // Kosten in euro aan de wisselkoers van de transactiedag. Bij verkochte
          // posities tellen ook de kosten en beurstaks (TOB) van de verkoop mee.
          const fx = (munt, datum) => (fxOp ? fxOp(munt || 'EUR', datum) : getMuntFactor(munt || 'EUR'));
          const aankoopKostenEur = (b) => (b.transactiekosten || 0) * fx(b.munt, b.datum);
          const verkoopKostenEur = (b) => ((b.verkoopkosten || 0) + (b.tob || 0)) * fx(b.verkoopMunt || b.munt, b.verkoopdatum);
          // (bij een ingevuld ontvangen bedrag blijven dit de opgegeven kosten; het
          // wisselkoersverschil van de broker is geen transactiekost)
          const investeringEur = (b, aantal) => b.kostprijs * aantal * fx(b.munt, b.datum);
          const kostenActief = beleggingen.reduce((sum, b) => sum + aankoopKostenEur(b), 0);
          const kostenVerkocht = (verkochteBeleggingen || []).reduce((sum, b) => sum + aankoopKostenEur(b) + verkoopKostenEur(b), 0);
          const totaalKosten = kostenActief + kostenVerkocht;
          // Noemer = alles waarop die kosten betaald werden (ook verkochte posities)
          const totaalGeïnvesteerd = beleggingen.reduce((sum, b) => sum + investeringEur(b, b.aantal), 0)
            + (verkochteBeleggingen || []).reduce((sum, b) => sum + investeringEur(b, b.aantalVerkocht || b.aantal), 0);
          const kostenPct = totaalGeïnvesteerd > 0 ? (totaalKosten / totaalGeïnvesteerd) * 100 : 0;

          const kostenLijst = [
            ...beleggingen.map(b => ({ naam: b.naam || b.symbol, symbol: b.symbol, broker: b.broker || null, kosten: aankoopKostenEur(b), investering: investeringEur(b, b.aantal), status: 'actief' })),
            ...(verkochteBeleggingen || []).map(b => ({ naam: b.naam || b.symbol, symbol: b.symbol, broker: b.broker || null, kosten: aankoopKostenEur(b) + verkoopKostenEur(b), investering: investeringEur(b, b.aantalVerkocht || b.aantal), status: 'verkocht' })),
          ].sort((a, b) => b.kosten - a.kosten);

          return (
            <div className="card" style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{t('an_transactiekosten')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{t('an_overzicht_kosten')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>€{getal(totaalKosten, 2)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{getal(kostenPct, 3)}% {t('an_van_geinvesteerd_kapitaal')}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: t('an_actieve_posities'), waarde: kostenActief, sub: aantalTransacties(beleggingen.filter(b => b.transactiekosten > 0).length) },
                  { label: t('an_verkochte_posities'), waarde: kostenVerkocht, sub: aantalTransacties((verkochteBeleggingen || []).filter(b => b.transactiekosten > 0 || b.verkoopkosten > 0 || b.tob > 0).length) },
                  { label: t('an_totaal_betaald'), waarde: totaalKosten, sub: `${getal(kostenPct, 3)}% ${t('an_van_kapitaal')}`, accent: true },
                ].map(({ label, waarde, sub, accent }) => (
                  <div key={label} style={{ padding: '14px 16px', background: accent ? 'var(--accent-bg)' : 'var(--bg-subtle)', borderRadius: 10, border: `1px solid ${accent ? 'var(--accent)' : 'var(--border-light)'}` }}>
                    <div style={{ fontSize: 12, color: accent ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>€{getal(waarde, 2)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {kostenLijst.length > 0 ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>{t('an_per_belegging')}</div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    {!isGsm && <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 100px 100px 90px', padding: '10px 16px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <span>{t('bel_col_instrument')}</span>
                      <span style={{ textAlign: 'right' }}>{t('an_col_investering')}</span>
                      <span style={{ textAlign: 'right' }}>{t('an_col_kosten')}</span>
                      <span style={{ textAlign: 'right' }}>{t('an_col_pct_inv')}</span>
                      <span style={{ textAlign: 'right' }}>{t('an_col_broker')}</span>
                    </div>}
                    {kostenLijst.map((b, idx) => {
                      const pct = b.investering > 0 ? (b.kosten / b.investering) * 100 : 0;
                      const BROKER_DOMEIN = { Saxo: 'home.saxo', DEGIRO: 'degiro.nl', Bitvavo: 'bitvavo.com' };
                      const brokerDomein = BROKER_DOMEIN[b.broker];
                      const brokerLabel = b.broker || t('an_manueel_broker');
                      const kostKleur = b.kosten > 0 ? 'var(--red)' : 'var(--text-muted)';
                      if (isGsm) {
                        return (
                          <div key={b.symbol + idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: idx < kostenLijst.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.naam}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {b.symbol}{b.status === 'verkocht' && <span style={{ color: 'var(--red)', fontWeight: 600 }}> · {t('an_verkocht_label')}</span>} · {brokerLabel}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Geïnvesteerd €{getal(b.investering, 2)}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: kostKleur, fontVariantNumeric: 'tabular-nums' }}>€{getal(b.kosten, 2)}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{getal(pct, 2)}%</div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={b.symbol + idx} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 100px 100px 90px', padding: '12px 16px', borderBottom: idx < kostenLijst.length - 1 ? '1px solid var(--border-light)' : 'none', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                              {b.symbol.split('.')[0].slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{b.naam}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                                <span>{b.symbol}</span>
                                {b.status === 'verkocht' && <span style={{ color: 'var(--red)', fontWeight: 600 }}>{t('an_verkocht_label')}</span>}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 13, fontFamily: 'monospace' }}>€{getal(b.investering, 2)}</div>
                          <div style={{ textAlign: 'right', fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: kostKleur }}>€{getal(b.kosten, 2)}</div>
                          <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>{getal(pct, 3)}%</div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                            {brokerDomein ? (
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${brokerDomein}&sz=64`}
                                alt={b.broker}
                                title={b.broker}
                                style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }}
                              />
                            ) : (
                              <span style={{
                                display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                                fontSize: 10, fontWeight: 700, color: 'white', background: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                              }}>
                                {brokerLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                  {t('an_geen_transactiekosten')}
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}