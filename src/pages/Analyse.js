import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { ChevronDown } from 'lucide-react';

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

// Sector mapping op basis van type/symbol
const SECTOR_MAP = {
  // ── VS ──
  NKE: 'Cyclische consumptiegoederen', NIKE: 'Cyclische consumptiegoederen',
  NVDA: 'Technologie', AMD: 'Technologie', AAPL: 'Technologie', MSFT: 'Technologie',
  GOOGL: 'Technologie', GOOG: 'Technologie', META: 'Communicatiediensten', AMZN: 'Cyclische consumptiegoederen',
  TSLA: 'Cyclische consumptiegoederen', BRK: 'Financiële dienstverlening', JPM: 'Financiële dienstverlening', BAC: 'Financiële dienstverlening',
  SOFI: 'Financiële dienstverlening', V: 'Financiële dienstverlening', MA: 'Financiële dienstverlening', PYPL: 'Financiële dienstverlening',
  JNJ: 'Gezondheidszorg', PFE: 'Gezondheidszorg', UNH: 'Gezondheidszorg', LLY: 'Gezondheidszorg',
  XOM: 'Energie', CVX: 'Energie', NFLX: 'Communicatiediensten', DIS: 'Communicatiediensten',
  KO: 'Defensieve consumptiegoederen', PEP: 'Defensieve consumptiegoederen', PG: 'Defensieve consumptiegoederen', WMT: 'Defensieve consumptiegoederen', COST: 'Defensieve consumptiegoederen',

  // ── Europa ──
  ASML: 'Technologie', SAP: 'Technologie', ADYEN: 'Financiële dienstverlening',
  MC: 'Cyclische consumptiegoederen',    // LVMH
  OR: 'Defensieve consumptiegoederen',   // L'Oréal
  NESN: 'Defensieve consumptiegoederen', ABI: 'Defensieve consumptiegoederen',
  NOVO: 'Gezondheidszorg', 'NOVO-B': 'Gezondheidszorg', ROG: 'Gezondheidszorg', PHIA: 'Gezondheidszorg', SAN: 'Financiële dienstverlening',
  SHELL: 'Energie', SHEL: 'Energie', TTE: 'Energie', BP: 'Energie',
  SIE: 'Industrie', AIR: 'Industrie', AIRP: 'Industrie',
  ALV: 'Financiële dienstverlening', ING: 'Financiële dienstverlening', BNP: 'Financiële dienstverlening', DBK: 'Financiële dienstverlening',
  VOW3: 'Cyclische consumptiegoederen', VOW: 'Cyclische consumptiegoederen', BMW: 'Cyclische consumptiegoederen', MBG: 'Cyclische consumptiegoederen', STLA: 'Cyclische consumptiegoederen',
  IBE: 'Nutsbedrijven', ENEL: 'Nutsbedrijven', ENGI: 'Nutsbedrijven',
  AZN: 'Gezondheidszorg', GSK: 'Gezondheidszorg', HSBA: 'Financiële dienstverlening', BATS: 'Defensieve consumptiegoederen',

  // ── Azië ──
  BABA: 'Cyclische consumptiegoederen', '9988': 'Cyclische consumptiegoederen',
  BIDU: 'Communicatiediensten', TCEHY: 'Communicatiediensten', '0700': 'Communicatiediensten',
  JD: 'Cyclische consumptiegoederen', PDD: 'Cyclische consumptiegoederen',
  TM: 'Cyclische consumptiegoederen', '7203': 'Cyclische consumptiegoederen',
  SONY: 'Technologie', '6758': 'Technologie',
  TSM: 'Technologie', '2330': 'Technologie',
  '005930': 'Technologie', SSNLF: 'Technologie', // Samsung

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
const ALLE_SECTOREN = [
  'Technologie', 'Financiële dienstverlening', 'Cyclische consumptiegoederen',
  'Defensieve consumptiegoederen', 'Gezondheidszorg', 'Communicatiediensten',
  'Industrie', 'Energie', 'Basismaterialen', 'Nutsbedrijven', 'Vastgoed',
];
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

// Live sector-/regiogewichten: voor ETF's die niet in de handmatige ETF_DB
// hierboven staan, gebruiken we de data die al via de etf-holdings endpoint
// wordt opgehaald (liveEtfData, ook gebruikt voor de holdings-tabel
// verderop) — zo krijgt élke ETF een echte spreiding i.p.v. "Overige"/
// "Wereldwijd". De backend (EODHD) levert regio's al in dezelfde
// Nederlandse bucketnamen als ETF_DB hierboven, dus geen extra vertaling
// nodig voor "landen" → regio.
const liveEtfSectorGewichten = (symbol, liveEtfData) => {
  const basis = symbol.toUpperCase().split('.')[0];
  const sectoren = liveEtfData[basis]?.sectoren;
  if (!sectoren || sectoren.length === 0) return null;
  const gewichten = {};
  sectoren.forEach(s => {
    const label = FMP_SECTOR_MAP[s.label] || 'Overige';
    gewichten[label] = (gewichten[label] || 0) + s.pct;
  });
  return gewichten;
};
const liveEtfRegioGewichten = (symbol, liveEtfData) => {
  const basis = symbol.toUpperCase().split('.')[0];
  const landen = liveEtfData[basis]?.landen;
  if (!landen || landen.length === 0) return null;
  const gewichten = {};
  landen.forEach(l => {
    const label = l.label || 'Overige';
    gewichten[label] = (gewichten[label] || 0) + l.pct;
  });
  return gewichten;
};

const getEtfGewichten = (sym, type, liveEtfData) => {
  const etf = zoekETF(sym);
  if (etf) return type === 'regio' ? etf.regio : etf.sector;
  return type === 'regio' ? liveEtfRegioGewichten(sym, liveEtfData) : liveEtfSectorGewichten(sym, liveEtfData);
};


function getSector(b, liveSectoren = {}) {
  const sym = b.symbol.toUpperCase().split('.')[0];
  if (isEtfBelegging(b)) return 'ETF';
  if (b.type === 'crypto') return 'Crypto';
  if (SECTOR_MAP[sym]) return SECTOR_MAP[sym];
  if (liveSectoren[sym]) return liveSectoren[sym];
  return 'Overige';
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
import SidebarToggleKnop from '../components/SidebarToggleKnop';

export function Analyse({ sidebarCollapsed, onToggleSidebar }) {
  const { beleggingen: beleggingenRaw, koersen, getMuntFactor, verkochteBeleggingen, t } = useApp();
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
  const [liveSectoren, setLiveSectoren] = useState({}); // { PRX: 'Cyclische consumptiegoederen', ... }
  const [etfDataLoading, setEtfDataLoading] = useState(false);

  const factor = (b) => getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);

  // ── Totale winst/verlies berekening ──
  const { kostprijs, huidigeWaarde, winst, winstPct, maxBar } = useMemo(() => {
    const actief = beleggingen;
    const verkocht = winstFilter === 'inclusief' ? (verkochteBeleggingen || []) : [];

    const kp = actief.reduce((s, b) => s + (b.kostprijs * b.aantal + (b.transactiekosten || 0)) * factor(b), 0)
      + verkocht.reduce((s, b) => s + (b.kostprijs * b.aantalVerkocht + (b.transactiekosten || 0)) * factor(b), 0);

    const hw = actief.reduce((s, b) => {
      const k = koersen[b.symbol];
      return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
    }, 0) + verkocht.reduce((s, b) => s + b.verkoopkoers * b.aantalVerkocht * factor(b), 0);

    const w = hw - kp;
    const wp = kp > 0 ? (w / kp) * 100 : 0;
    return { kostprijs: kp, huidigeWaarde: hw, winst: w, winstPct: wp, maxBar: Math.max(kp, hw) };
  }, [beleggingen, koersen, winstFilter, verkochteBeleggingen]);

  // ── Risicoprofiel (bèta benadering) ──
  // Live bèta state — wordt gevuld via Finnhub metrics API
  // Fallback BETA_MAP met actuele waarden (bijgewerkt juni 2026)
  const BETA_MAP_FALLBACK = {
    NVDA: 2.20, NKE: 1.28, SOFI: 1.85, MSFT: 0.90, AAPL: 1.18,
    AMZN: 1.15, TSLA: 2.10, GOOGL: 1.05, META: 1.22, AVGO: 1.48,
    JPM: 1.12, V: 0.98, MA: 1.02, AMD: 2.15, INTC: 0.92,
    COST: 0.72, JNJ: 0.62, UNH: 0.78, XOM: 0.98, CVX: 0.95,
    NFLX: 1.30, DIS: 1.15, KO: 0.58, PEP: 0.55, PG: 0.45, WMT: 0.52, PYPL: 1.50, LLY: 0.40,
    // Europa
    ASML: 1.30, SAP: 0.85, ADYEN: 1.35, MC: 1.10, OR: 0.55,
    NESN: 0.55, ABI: 0.85, NOVO: 0.45, 'NOVO-B': 0.45, ROG: 0.50, PHIA: 1.10,
    SHELL: 0.75, SHEL: 0.75, TTE: 0.85, BP: 0.85, SAN: 1.20, ING: 1.25, BNP: 1.30, DBK: 1.40,
    SIE: 1.10, AIR: 1.15, VOW3: 1.30, VOW: 1.30, BMW: 1.20, MBG: 1.15, STLA: 1.35,
    IBE: 0.55, ENEL: 0.70, ENGI: 0.65, AZN: 0.50, GSK: 0.55, HSBA: 1.05, BATS: 0.60, ALV: 0.95,
    // Azië
    BABA: 0.70, '9988': 0.70, BIDU: 1.10, TCEHY: 0.65, '0700': 0.65,
    JD: 0.80, PDD: 1.20, TM: 0.65, '7203': 0.65, SONY: 0.85, '6758': 0.85,
    TSM: 1.20, '2330': 1.20, '005930': 0.85, SSNLF: 0.85,
    // ETFs hebben lage bèta door spreiding
    VWCE: 0.98, VWRL: 0.98, IWDA: 0.95, SWRD: 0.95,
    EMIM: 0.88, EQQQ: 1.12, CSPX: 1.00, SXR8: 1.00,
    XDWD: 0.95, LCWD: 0.95, WEBG: 0.97,
  };
  const BETA_MAP = { ...BETA_MAP_FALLBACK, ...liveBetas };
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
    // Grenzen conform info-modal: Defensief <1.0, Neutraal 1.0-1.5, Offensief 1.5-2.5, Speculatief >2.5
    const label = gewogenBeta < 1.0 ? 'Defensief' : gewogenBeta < 1.5 ? 'Neutraal' : gewogenBeta < 2.5 ? 'Offensief' : 'Speculatief';
    const kleur = gewogenBeta < 1.0 ? 'var(--green)' : gewogenBeta < 1.5 ? '#1e3a8a' : gewogenBeta < 2.5 ? '#f97316' : 'var(--red)';
    const bolletjes = gewogenBeta < 1.0 ? 1 : gewogenBeta < 1.5 ? 2 : gewogenBeta < 2.5 ? 3 : 4;
    return { beta: gewogenBeta, risicoLabel: label, risicoKleur: kleur, aantalBolletjes: bolletjes, onbekendeBetas: [...new Set(onbekend)] };
  }, [beleggingen, koersen]);



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
        const gewichten = getEtfGewichten(b.symbol, isRegio ? 'regio' : 'sector', liveEtfData);
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
        const label = isRegio ? getRegio(b) : getSector(b, liveSectoren);
        map[label] = (map[label] || 0) + w;
      }
    });

    const data = Object.entries(map)
      .map(([label, w]) => ({ label, waarde: w, pct: (w / totaal) * 100 }))
      .filter(d => d.waarde > 0)
      .sort((a, b) => b.waarde - a.waarde);

    return { spreidingData: data, pieData: data };
  }, [beleggingen, koersen, spreidingTab, spreidingSubFilter, liveSectoren, liveEtfData]);

  // ── Concentratierisico ──
  // ── Live bèta ophalen via Finnhub metrics API ──
  useEffect(() => {
    const aandelen = beleggingen.filter(b => b.type !== 'etf' && b.type !== 'crypto');
    if (aandelen.length === 0) return;

    const CACHE_DUUR_BETA = 7 * 24 * 60 * 60 * 1000; // 7 dagen

    const laadBeta = async (b) => {
      const sym = b.symbol.toUpperCase().split('.')[0];
      const cacheKey = `matico_beta_${sym}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { beta, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DUUR_BETA) {
            return { sym, beta };
          }
        }
      } catch (e) {}

      try {
        const res = await fetch(`/api/data?endpoint=metrics&symbol=${b.symbol}`);
        const data = await res.json();
        const beta = data?.metric?.beta;
        if (beta && beta > 0) {
          localStorage.setItem(cacheKey, JSON.stringify({ beta, timestamp: Date.now() }));
          return { sym, beta };
        }
      } catch (e) {}

      // Fallback: bèta via profile-endpoint (FMP), heeft betere dekking voor Europese/Aziatische aandelen
      try {
        const res = await fetch(`/api/data?endpoint=profile&symbol=${b.symbol}`);
        const data = await res.json();
        const beta = data?.beta;
        if (beta && beta > 0) {
          localStorage.setItem(cacheKey, JSON.stringify({ beta, timestamp: Date.now() }));
          return { sym, beta };
        }
      } catch (e) {}
      return null;
    };

    Promise.all(aandelen.map(laadBeta)).then(results => {
      const nieuw = {};
      results.forEach(r => { if (r) nieuw[r.sym] = r.beta; });
      if (Object.keys(nieuw).length > 0) setLiveBetas(prev => ({ ...prev, ...nieuw }));
    });
  }, [beleggingen.map(b => b.symbol).join(',')]);

  // ── Live sector ophalen voor aandelen die niet in SECTOR_MAP staan ──
  // (vooral Europese/Aziatische/overige internationale aandelen, bv. Prosus)
  useEffect(() => {
    const onbekend = beleggingen.filter(b => {
      if (isEtfBelegging(b) || b.type === 'crypto') return false;
      const sym = b.symbol.toUpperCase().split('.')[0];
      return !SECTOR_MAP[sym] && !liveSectoren[sym];
    });
    if (onbekend.length === 0) return;

    const CACHE_DUUR_SECTOR = 30 * 24 * 60 * 60 * 1000; // 30 dagen

    const laadSector = async (b) => {
      const sym = b.symbol.toUpperCase().split('.')[0];
      const cacheKey = `matico_sector_${sym}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { sector, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DUUR_SECTOR) {
            return { sym, sector };
          }
        }
      } catch (e) {}

      try {
        const res = await fetch(`/api/data?endpoint=profile&symbol=${b.symbol}`);
        const data = await res.json();
        // FMP geeft 'sector' in het Engels; Finnhub geeft 'finnhubIndustry'. Map naar onze NL-labels.
        const ruweSector = data?.sector || data?.finnhubIndustry;
        const sector = FMP_SECTOR_MAP[ruweSector] || null;
        if (sector) {
          localStorage.setItem(cacheKey, JSON.stringify({ sector, timestamp: Date.now() }));
          return { sym, sector };
        }
      } catch (e) {}
      return null;
    };

    Promise.all(onbekend.map(laadSector)).then(results => {
      const nieuw = {};
      results.forEach(r => { if (r) nieuw[r.sym] = r.sector; });
      if (Object.keys(nieuw).length > 0) setLiveSectoren(prev => ({ ...prev, ...nieuw }));
    });
  }, [beleggingen.map(b => b.symbol).join(',')]);

  // ── Live ETF data laden via FMP + localStorage cache (1 maand) ──
  useEffect(() => {
    const etfSymbolen = [...new Set(beleggingen.filter(b => b.type === 'etf').map(b => b.symbol.toUpperCase().split('.')[0]))];
    if (etfSymbolen.length === 0) return;

    const CACHE_DUUR_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagen
    const nieuweData = {};

    const laadEtf = async (basis) => {
      // Check localStorage cache
      // v2: sleutel gewijzigd zodat oude, foutieve cache-entries (van vóór de
      // ETF-sectordata-fix) automatisch genegeerd worden i.p.v. tot 30 dagen
      // stale te blijven staan.
      const cacheKey = `matico_etf_v2_${basis}`;
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
        const res = await fetch(`/api/data?endpoint=etf-holdings&symbol=${basis}`);
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
        const sectorGewichten = getEtfGewichten(b.symbol, 'sector', liveEtfData);
        if (sectorGewichten) {
          Object.entries(sectorGewichten).forEach(([cat, pctInEtf]) => {
            sectorMap[cat] = (sectorMap[cat] || 0) + w * (pctInEtf / 100);
          });
        } else {
          const sectorFallback = isObligatieEtf(b) ? 'Overheid' : 'Overige';
          sectorMap[sectorFallback] = (sectorMap[sectorFallback] || 0) + w;
        }
        const regioGewichten = getEtfGewichten(b.symbol, 'regio', liveEtfData);
        if (regioGewichten) {
          Object.entries(regioGewichten).forEach(([cat, pctInEtf]) => {
            regioMap[cat] = (regioMap[cat] || 0) + w * (pctInEtf / 100);
          });
        } else {
          regioMap['Wereldwijd'] = (regioMap['Wereldwijd'] || 0) + w;
        }
      } else {
        const s = getSector(b, liveSectoren); const r = getRegio(b);
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

    // ── Suggesties voor de volgende belegging ──────────────────────────
    // Per dimensie (type/sector/regio) tonen we, enkel als er echt een
    // concentratie is, welke categorie het minst vertegenwoordigd is —
    // dat is de richting die de spreiding het meest zou verbeteren.
    const etfPct = posities.filter(p => p.type === 'etf').reduce((s, p) => s + p.pct, 0);
    const typeSuggestie = (aandelenPct > 60 && etfPct < 20)
      ? `Vooral individuele aandelen (${aandelenPct.toFixed(0)}%) — een brede ETF zou hier het meest aan bijdragen.`
      : null;

    const sectorZwakste = ALLE_SECTOREN
      .map(s => [s, sectorMap[s] || 0])
      .sort((a, b) => a[1] - b[1])[0];
    const sectorSuggestie = (topS[1] > 30 && sectorZwakste && sectorZwakste[0] !== topS[0])
      ? `${sectorZwakste[0]} (${sectorZwakste[1].toFixed(0)}%) is nu het minst vertegenwoordigd — kijk daar voor je volgende belegging.`
      : null;

    const regioZwakste = ALLE_REGIOS
      .map(r => [r, regioMap[r] || 0])
      .sort((a, b) => a[1] - b[1])[0];
    const regioSuggestie = (topR[1] > 50 && regioZwakste && regioZwakste[0] !== topR[0])
      ? `${regioZwakste[0]} (${regioZwakste[1].toFixed(0)}%) is nu het minst vertegenwoordigd — kijk daar voor je volgende belegging.`
      : null;

    return {
      grootstePct: posities[0]?.pct || 0, grootsteSym: posities[0]?.sym || '—',
      topSector: topS[0], topSectorPct: topS[1],
      topRegio: topR[0], topRegioPct: topR[1],
      typeSuggestie, sectorSuggestie, regioSuggestie,
      concentratieTips: tips,
    };
  }, [beleggingen, koersen, liveSectoren, liveEtfData]);

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
        kostenratio: live.expenseRatio || ETF_DB_XRAY[basis]?.kostenratio || 0,
        holdings: live.holdings.slice(0, 10).map(h => ({
          sym: h.asset || h.symbol || h.ticker || '?',
          naam: h.name || h.companyName || h.asset || '?',
          pct: parseFloat(h.weightPercentage || h.weight || h.pct || 0)
        })).filter(h => h.pct > 0)
      };
    }
    return ETF_DB_XRAY[basis] || null;
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

      // Tel het totaal aantal bedrijven in de ETF (uit database of live data)
      const basis = etf.symbol.toUpperCase().split('.')[0];
      const dbData = ETF_DB_XRAY[basis];
      const etfTotaalBedrijven = dbData?.totaalHoldings || (data.holdings.length * 10); // schatting als niet known
      totaalBedrijvenPerEtf += etfTotaalBedrijven;

      data.holdings.forEach(h => {
        const gewichtInPortfolio = etfGewicht * (h.pct / 100);
        if (!holdingMap[h.sym]) {
          holdingMap[h.sym] = { sym: h.sym, naam: h.naam, gewicht: 0, viaEtfs: [] };
        }
        holdingMap[h.sym].gewicht += gewichtInPortfolio;
        if (!holdingMap[h.sym].viaEtfs.find(v => v.sym === etf.symbol)) {
          holdingMap[h.sym].viaEtfs.push({ sym: etf.symbol, pct: h.pct });
        }
      });
    });

    return {
      alleHoldings: Object.values(holdingMap).sort((a, b) => b.gewicht - a.gewicht),
      totaalUniekeBedrijven: totaalBedrijvenPerEtf,
    };
  })();

  // Gemiddelde kostenratio gewogen op ETF-waarde
  const gemiddeldeKostenratio = (() => {
    const totaalEtfWaarde = etfs.reduce((s, b) => {
      const k = koersen[b.symbol]; return s + (k ? k.c : b.kostprijs) * b.aantal * (getMuntFactor ? getMuntFactor(b.munt || 'EUR') : 1);
    }, 0) || 1;
    const gewogen = etfs.reduce((s, b) => {
      const k = koersen[b.symbol];
      const w = (k ? k.c : b.kostprijs) * b.aantal * (getMuntFactor ? getMuntFactor(b.munt || 'EUR') : 1);
      const data = zoekXray(b.symbol);
      return s + (data?.kostenratio || 0) * (w / totaalEtfWaarde);
    }, 0);
    return gewogen;
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
              <span>{t('an_marktdaling_deel1')} {(beta * 10).toFixed(1)}%.</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{t('an_marktinvloed_beta')}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{beta.toFixed(2)}</div>
              </div>
              <div>
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
                {onbekendeBetas.length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{t('an_niet_meegenomen')}</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      {t('an_geen_marktinvloed')}
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
                  color: spreidingTab === tb ? 'white' : 'var(--text-secondary)',
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
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{waarde} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{pct.toFixed(0)}%</span></div>
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
                    color: valutaTab === tb ? 'white' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
                  }}>{tb === 'verdeling' ? t('an_valutaverdeling') : t('an_wisselkoerseffect')}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{t('an_van_portfolio_incl_etf')}</div>

            {valutaTab === 'verdeling' ? (() => {
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
                <div className="analyse-currency-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
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
                        <div className="analyse-currency-legend-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_KLEUREN[i % PIE_KLEUREN.length], display: 'inline-block' }} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{v.munt}</span>
                          </div>
                          <div className="analyse-currency-amount">
                            <span className="analyse-currency-value" style={{ fontSize: 13, fontWeight: 600, marginRight: 6 }}>€{fmt(v.waarde)}</span>
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
                  { maand: 'mei 26', effect: 0.4 },
                ],
                'YTD': [
                  { maand: 'jan 26', effect: -0.6 }, { maand: 'feb 26', effect: -0.4 },
                  { maand: 'maa 26', effect: 1.2 }, { maand: 'apr 26', effect: 0.3 },
                  { maand: 'mei 26', effect: 0.7 }, { maand: 'jun 26', effect: 1.8 },
                ],
                '1J': [
                  { maand: 'jun 25', effect: 0.3 }, { maand: 'jul 25', effect: -0.2 },
                  { maand: 'aug 25', effect: 0.8 }, { maand: 'sep 25', effect: -0.5 },
                  { maand: 'okt 25', effect: 1.1 }, { maand: 'nov 25', effect: 0.6 },
                  { maand: 'dec 25', effect: -0.3 }, { maand: 'jan 26', effect: -0.6 },
                  { maand: 'feb 26', effect: -0.4 }, { maand: 'maa 26', effect: 1.2 },
                  { maand: 'apr 26', effect: 0.3 }, { maand: 'jun 26', effect: 1.8 },
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
                    <span>{t('an_wisselkoersen_deel1')} {wisselkoersPeriode === 'YTD' ? t('an_periode_dit_jaar') : wisselkoersPeriode === '1M' ? t('an_periode_deze_maand') : t('an_periode_dit_jaar')} {t('an_wisselkoersen_deel2')} <strong style={{ color: isPos ? 'var(--green)' : 'var(--red)' }}>{isPos ? '+' : ''}{totaalEffect.toFixed(1)}%</strong>.</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t('an_etf_xray')}</div>
              {etfDataLoading ? (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                  ⟳ {t('an_data_laden')}
                </span>
              ) : (() => {
                const cacheKey = `matico_etf_v2_${etfs[0]?.symbol?.toUpperCase().split('.')[0]}`;
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
                <div style={{ fontSize: 28, fontWeight: 700 }}>{totaalUniekeBedrijven.toLocaleString('nl-BE')}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{t('an_gemiddelde_kostenratio')}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{gemiddeldeKostenratio.toFixed(2).replace('.', ',')}%</div>
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
                <div key={h.sym} className="analyse-etf-row" style={{
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
                      <img
                        src={`https://assets.parqet.com/logos/symbol/${h.sym.split('.')[0]}?format=png`}
                        alt={h.sym}
                        style={{ width: 26, height: 26, objectFit: 'contain' }}
                        onError={e => {
                          e.target.style.display = 'none';
                          e.target.parentNode.style.background = 'var(--accent-bg)';
                          e.target.parentNode.innerHTML = `<span style="color:var(--accent);font-weight:700;font-size:11px">${h.sym.split('.')[0].slice(0,2).toUpperCase()}</span>`;
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.naam}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.sym}</div>
                    </div>
                  </div>
                  {/* Gewicht */}
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                    {h.gewicht.toFixed(2)}%
                  </div>
                  {/* Via ETFs */}
                  <div className="analyse-etf-via" style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {h.viaEtfs.map(v => (
                      <div key={v.sym}>{v.sym} <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{v.pct.toFixed(2)}%</span></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Transactiekosten ── */}
        {(() => {
          const kostenActief = beleggingen.reduce((sum, b) => sum + (b.transactiekosten || 0) * factor(b), 0);
          const kostenVerkocht = (verkochteBeleggingen || []).reduce((sum, b) => sum + (b.transactiekosten || 0) * factor(b), 0);
          const totaalKosten = kostenActief + kostenVerkocht;
          const totaalGeïnvesteerd = beleggingen.reduce((sum, b) => sum + b.kostprijs * b.aantal * factor(b), 0);
          const kostenPct = totaalGeïnvesteerd > 0 ? (totaalKosten / totaalGeïnvesteerd) * 100 : 0;

          const kostenLijst = [
            ...beleggingen.map(b => ({ naam: b.naam || b.symbol, symbol: b.symbol, broker: b.broker || null, kosten: (b.transactiekosten || 0) * factor(b), investering: b.kostprijs * b.aantal * factor(b), status: 'actief' })),
            ...(verkochteBeleggingen || []).map(b => ({ naam: b.naam || b.symbol, symbol: b.symbol, broker: b.broker || null, kosten: (b.transactiekosten || 0) * factor(b), investering: b.kostprijs * (b.aantalVerkocht || b.aantal) * factor(b), status: 'verkocht' })),
          ].sort((a, b) => b.kosten - a.kosten);

          return (
            <div className="card" style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{t('an_transactiekosten')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{t('an_overzicht_kosten')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>€{totaalKosten.toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{kostenPct.toFixed(3)}% {t('an_van_geinvesteerd_kapitaal')}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: t('an_actieve_posities'), waarde: kostenActief, sub: `${beleggingen.filter(b => b.transactiekosten > 0).length} ${t('bel_transacties_suffix')}` },
                  { label: t('an_verkochte_posities'), waarde: kostenVerkocht, sub: `${(verkochteBeleggingen || []).filter(b => b.transactiekosten > 0).length} ${t('bel_transacties_suffix')}` },
                  { label: t('an_totaal_betaald'), waarde: totaalKosten, sub: `${kostenPct.toFixed(3)}% ${t('an_van_kapitaal')}`, accent: true },
                ].map(({ label, waarde, sub, accent }) => (
                  <div key={label} style={{ padding: '14px 16px', background: accent ? 'var(--accent-bg)' : 'var(--bg-subtle)', borderRadius: 10, border: `1px solid ${accent ? 'var(--accent)' : 'var(--border-light)'}` }}>
                    <div style={{ fontSize: 12, color: accent ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>€{waarde.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {kostenLijst.length > 0 ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>{t('an_per_belegging')}</div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 100px 100px 90px', padding: '10px 16px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <span>{t('bel_col_instrument')}</span>
                      <span style={{ textAlign: 'right' }}>{t('an_col_investering')}</span>
                      <span style={{ textAlign: 'right' }}>{t('an_col_kosten')}</span>
                      <span style={{ textAlign: 'right' }}>{t('an_col_pct_inv')}</span>
                      <span style={{ textAlign: 'right' }}>{t('an_col_broker')}</span>
                    </div>
                    {kostenLijst.map((b, idx) => {
                      const pct = b.investering > 0 ? (b.kosten / b.investering) * 100 : 0;
                      const BROKER_DOMEIN = { Saxo: 'home.saxo', DEGIRO: 'degiro.nl', Bitvavo: 'bitvavo.com' };
                      const brokerDomein = BROKER_DOMEIN[b.broker];
                      const brokerLabel = b.broker || t('an_manueel_broker');
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
                          <div style={{ textAlign: 'right', fontSize: 13, fontFamily: 'monospace' }}>€{b.investering.toFixed(2)}</div>
                          <div style={{ textAlign: 'right', fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: 'var(--red)' }}>€{b.kosten.toFixed(2)}</div>
                          <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>{pct.toFixed(3)}%</div>
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