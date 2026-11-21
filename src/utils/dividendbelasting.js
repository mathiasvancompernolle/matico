// Belasting op dividenden voor een Belgische particuliere belegger.
//
// 1. Buitenlandse bronheffing: het land van het bedrijf houdt eerst een deel
//    in (bv. VS 15% met W-8BEN). Als Belgisch particulier krijg je die niet
//    terug via je aangifte en kan je ze niet verrekenen.
// 2. Belgische roerende voorheffing: 30% op wat er daarna overblijft.
//
// Netto = bruto × (1 − buitenlandse bronheffing) × (1 − 30%).
//
// Welk land? Bij voorkeur het land van het bedrijf (uit het bedrijfsprofiel)
// en voor een ETF het vestigingsland (de eerste twee letters van de ISIN).
// Pas als dat onbekend is, valt de app terug op de beurs waar het noteert —
// want ASML op Nasdaq blijft Nederlands, en Shell in Amsterdam is Brits.
// Standaardtarieven zonder terugvraagprocedure.

export const BELGISCHE_RV = 0.30;

// Per land (ISO-code)
export const PER_LAND = {
  US: { land: 'Verenigde Staten', tarief: 0.15 },   // met W-8BEN; zonder 30%
  BE: { land: 'België', tarief: 0 },
  NL: { land: 'Nederland', tarief: 0.15 },
  DE: { land: 'Duitsland', tarief: 0.26375 },
  FR: { land: 'Frankrijk', tarief: 0.25 },
  IT: { land: 'Italië', tarief: 0.26 },
  ES: { land: 'Spanje', tarief: 0.19 },
  PT: { land: 'Portugal', tarief: 0.25 },
  GB: { land: 'Verenigd Koninkrijk', tarief: 0 },
  IE: { land: 'Ierland', tarief: 0.25 },
  LU: { land: 'Luxemburg', tarief: 0.15 },
  CH: { land: 'Zwitserland', tarief: 0.35 },
  AT: { land: 'Oostenrijk', tarief: 0.275 },
  DK: { land: 'Denemarken', tarief: 0.27 },
  FI: { land: 'Finland', tarief: 0.35 },
  SE: { land: 'Zweden', tarief: 0.30 },
  NO: { land: 'Noorwegen', tarief: 0.25 },
  CA: { land: 'Canada', tarief: 0.15 },
  JP: { land: 'Japan', tarief: 0.15315 },
  HK: { land: 'Hongkong', tarief: 0 },
  SG: { land: 'Singapore', tarief: 0 },
  KY: { land: 'Kaaimaneilanden', tarief: 0 },
  BM: { land: 'Bermuda', tarief: 0 },
  JE: { land: 'Jersey', tarief: 0 },
  CN: { land: 'China', tarief: 0.10 },
  TW: { land: 'Taiwan', tarief: 0.21 },
  KR: { land: 'Zuid-Korea', tarief: 0.22 },
  IN: { land: 'India', tarief: 0.20 },
  AU: { land: 'Australië', tarief: 0.30 },
  NZ: { land: 'Nieuw-Zeeland', tarief: 0.15 },
  BR: { land: 'Brazilië', tarief: 0 },
  MX: { land: 'Mexico', tarief: 0.10 },
  ZA: { land: 'Zuid-Afrika', tarief: 0.20 },
  IL: { land: 'Israël', tarief: 0.25 },
  PL: { land: 'Polen', tarief: 0.19 },
};

// Landnamen zoals profielbronnen ze geven → ISO-code
const NAAM_NAAR_CODE = {
  'united states': 'US', 'usa': 'US', 'belgium': 'BE', 'netherlands': 'NL', 'the netherlands': 'NL',
  'germany': 'DE', 'france': 'FR', 'italy': 'IT', 'spain': 'ES', 'portugal': 'PT',
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB', 'ireland': 'IE', 'luxembourg': 'LU',
  'switzerland': 'CH', 'austria': 'AT', 'denmark': 'DK', 'finland': 'FI', 'sweden': 'SE', 'norway': 'NO',
  'canada': 'CA', 'japan': 'JP', 'hong kong': 'HK', 'singapore': 'SG', 'cayman islands': 'KY', 'bermuda': 'BM',
  'jersey': 'JE', 'china': 'CN', 'taiwan': 'TW', 'south korea': 'KR', 'korea': 'KR', 'india': 'IN',
  'australia': 'AU', 'new zealand': 'NZ', 'brazil': 'BR', 'mexico': 'MX', 'south africa': 'ZA', 'israel': 'IL', 'poland': 'PL',
};

// Terugval: land afgeleid uit de beurs (achtervoegsel van het symbool)
const PER_BEURS = {
  '': 'US', US: 'US', BR: 'BE', AS: 'NL', DE: 'DE', F: 'DE', PA: 'FR', MI: 'IT', MC: 'ES', LS: 'PT',
  L: 'GB', IR: 'IE', SW: 'CH', VI: 'AT', CO: 'DK', HE: 'FI', ST: 'SE', OL: 'NO', TO: 'CA', T: 'JP', HK: 'HK',
  SI: 'SG', AX: 'AU', SA: 'BR', TW: 'TW', KS: 'KR', NS: 'IN', BO: 'IN', JO: 'ZA', TA: 'IL', WA: 'PL',
};

// Bekende uitzonderingen als het profiel ontbreekt
const UITZONDERINGEN = { 'SHELL.AS': 'GB', 'UNA.AS': 'GB', 'ABI.BR': 'BE', 'UMG.AS': 'NL' };

const naarCode = (land) => {
  if (!land) return null;
  const t = String(land).trim();
  if (/^[A-Z]{2}$/.test(t)) return t;
  return NAAM_NAAR_CODE[t.toLowerCase()] || null;
};

// info (optioneel): { land, isin } uit het bedrijfsprofiel
export function bronheffing(symbol, type, info = {}) {
  const s = String(symbol || '').toUpperCase();
  if (type === 'crypto') return { land: null, tarief: 0 };
  const isinLand = /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(info?.isin || '') ? info.isin.slice(0, 2) : null;

  if (type === 'etf') {
    // ETF: vestigingsland. Ierse en Luxemburgse (UCITS) ETF's houden voor de
    // belegger niets in; Amerikaanse ETF's 15%.
    const code = isinLand || (s.includes('.') && !s.endsWith('.US') ? 'IE' : 'US');
    if (code === 'IE' || code === 'LU') return { land: `${PER_LAND[code].land} (ETF)`, tarief: 0 };
    return PER_LAND[code] ? { land: `${PER_LAND[code].land} (ETF)`, tarief: PER_LAND[code].tarief } : { land: null, tarief: 0 };
  }

  const code = UITZONDERINGEN[s] || naarCode(info?.land) || isinLand
    || PER_BEURS[s.includes('.') ? s.split('.').pop() : ''];
  return PER_LAND[code] || { land: null, tarief: 0 };
}

// Deel van het bruto dividend dat je netto overhoudt
export function nettoFactor(symbol, type, info) {
  return (1 - bronheffing(symbol, type, info).tarief) * (1 - BELGISCHE_RV);
}

export function procent(x) {
  return `${(Math.round(x * 1000) / 10).toLocaleString('nl-BE')}%`;
}
