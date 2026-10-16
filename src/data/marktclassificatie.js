// ── Gedeelde harde fallback-tabellen voor sector/bèta ───────────────────────
// Deze tabellen worden gebruikt door zowel Analyse.js (spreiding/risicoprofiel)
// als Instellingen.js (Data-kwaliteit-tab). Ze stonden vroeger apart gekopieerd
// in beide bestanden, met als gevolg dat Analyse al een concrete sector/bèta
// toonde voor bekende tickers (via deze fallback) terwijl Data-kwaliteit
// datzelfde symbool als "Ontbreekt" markeerde — want die pagina kende deze
// fallback-tabellen niet en keek enkel naar manuele invoer + live API-data.
// Door beide pagina's uit dezelfde bron te laten lezen, tonen ze altijd
// hetzelfde beeld.

// Sector mapping op basis van ticker (hardcoded, geen live data nodig)
export const SECTOR_MAP_FALLBACK = {
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

// Bèta mapping op basis van ticker (hardcoded, bijgewerkt juni 2026)
export const BETA_MAP_FALLBACK = {
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
