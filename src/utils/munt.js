// Munten: teken en keuzelijst, gedeeld door de hele app.
// Vroeger kende de app enkel EUR/USD/GBP: een aandeel in CHF, JPY of DKK
// kreeg een €-teken en werd als euro gerekend.

const TEKENS = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', KRW: '₩', ILS: '₪', TRY: '₺', PLN: 'zł ' };

export function muntSymbool(munt) {
  const m = (munt || 'EUR').toUpperCase();
  return TEKENS[m] || `${m} `;
}

// Keuzelijst in formulieren (meest gebruikte eerst)
export const MUNTEN = [
  'EUR', 'USD', 'GBP', 'CHF', 'SEK', 'DKK', 'NOK', 'PLN', 'CZK', 'HUF',
  'JPY', 'HKD', 'SGD', 'CNY', 'KRW', 'INR', 'AUD', 'NZD', 'CAD', 'MXN', 'BRL', 'ZAR', 'ILS', 'TRY',
];
