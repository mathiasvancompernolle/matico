// Beurstaks (TOB, taks op beursverrichtingen), België.
// Verschuldigd bij aankoop én bij verkoop, op het bedrag in euro, met een
// maximum per transactie.

export const TOB_TARIEVEN = [
  { id: '0.35', tarief: 0.0035, max: 1600, kort: '0,35%', label: '0,35% · aandelen, ETF buiten de EER (max. €1.600)' },
  { id: '0.12', tarief: 0.0012, max: 1300, kort: '0,12%', label: '0,12% · ETF geregistreerd in de EER, obligaties (max. €1.300)' },
  { id: '1.32', tarief: 0.0132, max: 4000, kort: '1,32%', label: '1,32% · kapitaliserend fonds geregistreerd in België (max. €4.000)' },
  { id: '0', tarief: 0, max: 0, kort: '0%', label: '0% · geen beurstaks (bv. crypto)' },
];

// Standaardtarief: crypto 0%; ETF zonder beurscode (Amerikaanse ETF, buiten de
// EER) 0,35%; in België geregistreerd kapitaliserend fonds (ISIN BE) 1,32%;
// andere ETF's (Europese UCITS) 0,12%; aandelen 0,35%.
export const standaardTob = (b, info) => {
  if (!b || b.type === 'crypto') return '0';
  if (b.type !== 'etf') return '0.35';
  const isin = info?.isin || b.isin || '';
  if (/^BE/.test(isin) && /acc|kapitalis/i.test(b.naam || '')) return '1.32';
  if (/^US/.test(isin) || !String(b.symbol || '').includes('.')) return '0.35';
  return '0.12';
};

export const tobInfo = (id) => TOB_TARIEVEN.find(x => x.id === id) || TOB_TARIEVEN[0];

// TOB in euro op een bedrag in euro (afgerond op de cent, met maximum)
export const berekenTob = (bedragEur, id) => {
  const t = tobInfo(id);
  return Math.round(Math.min((bedragEur || 0) * t.tarief, t.max || 0) * 100) / 100;
};
