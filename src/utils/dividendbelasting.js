// Belasting op dividenden voor een Belgische particuliere belegger.
//
// 1. Buitenlandse bronheffing: het land van het bedrijf houdt eerst een deel
//    in (bv. VS 15% met W-8BEN). Als Belgisch particulier krijg je die niet
//    terug via je aangifte en kan je ze niet verrekenen.
// 2. Belgische roerende voorheffing: 30% op wat er daarna overblijft.
//
// Netto = bruto × (1 − buitenlandse bronheffing) × (1 − 30%).
//
// Het land leiden we af uit de beurs (achtervoegsel van het symbool). Voor
// UCITS-ETF's (Ierland/Luxemburg) is er geen bronheffing voor de belegger.
// Dit zijn de standaardtarieven zonder terugvraagprocedure; sommige landen
// laten toe een deel terug te vragen via een (omslachtig) formulier.

export const BELGISCHE_RV = 0.30;

// Standaardtarief per beurs (zonder terugvraag)
const PER_BEURS = {
  '':    { land: 'Verenigde Staten', tarief: 0.15 }, // met W-8BEN; zonder 30%
  US:    { land: 'Verenigde Staten', tarief: 0.15 },
  BR:    { land: 'België', tarief: 0 },
  AS:    { land: 'Nederland', tarief: 0.15 },
  DE:    { land: 'Duitsland', tarief: 0.26375 },
  F:     { land: 'Duitsland', tarief: 0.26375 },
  PA:    { land: 'Frankrijk', tarief: 0.25 },
  MI:    { land: 'Italië', tarief: 0.26 },
  MC:    { land: 'Spanje', tarief: 0.19 },
  LS:    { land: 'Portugal', tarief: 0.25 },
  L:     { land: 'Verenigd Koninkrijk', tarief: 0 },
  IR:    { land: 'Ierland', tarief: 0.25 },
  SW:    { land: 'Zwitserland', tarief: 0.35 },
  VI:    { land: 'Oostenrijk', tarief: 0.275 },
  CO:    { land: 'Denemarken', tarief: 0.27 },
  HE:    { land: 'Finland', tarief: 0.35 },
  ST:    { land: 'Zweden', tarief: 0.30 },
  OL:    { land: 'Noorwegen', tarief: 0.25 },
  TO:    { land: 'Canada', tarief: 0.15 },
  T:     { land: 'Japan', tarief: 0.15315 },
  HK:    { land: 'Hongkong', tarief: 0 },
};

// Bedrijven waarvan het land afwijkt van de beurs waar ze noteren
const UITZONDERINGEN = {
  'SHELL.AS': { land: 'Verenigd Koninkrijk', tarief: 0 },
  'UNA.AS':   { land: 'Verenigd Koninkrijk', tarief: 0 },
  'ABI.BR':   { land: 'België', tarief: 0 },
  'UMG.AS':   { land: 'Nederland', tarief: 0.15 },
};

export function bronheffing(symbol, type) {
  const s = String(symbol || '').toUpperCase();
  if (type === 'crypto') return { land: null, tarief: 0 };
  if (UITZONDERINGEN[s]) return UITZONDERINGEN[s];
  const suffix = s.includes('.') ? s.split('.').pop() : '';
  // Europese ETF's (UCITS, meestal Iers of Luxemburgs): geen bronheffing
  if (type === 'etf' && suffix !== '' && suffix !== 'US') return { land: 'Ierland/Luxemburg (ETF)', tarief: 0 };
  return PER_BEURS[suffix] || { land: null, tarief: 0 };
}

// Deel van het bruto dividend dat je netto overhoudt
export function nettoFactor(symbol, type) {
  return (1 - bronheffing(symbol, type).tarief) * (1 - BELGISCHE_RV);
}

export function procent(x) {
  return `${(Math.round(x * 1000) / 10).toLocaleString('nl-BE')}%`;
}
