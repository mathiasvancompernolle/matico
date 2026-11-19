// Getallen tonen op z'n Belgisch: komma als decimaalteken, punt als
// duizendtalscheiding (bv. 1.394,58). Zelfde gebruik als toFixed: het
// tweede argument is het aantal decimalen. Enkel voor wat op het scherm
// komt — niet voor invulvelden of berekeningen (die verwachten een punt).
export function getal(waarde, decimalen = 2) {
  const n = Number(waarde);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('nl-BE', { minimumFractionDigits: decimalen, maximumFractionDigits: decimalen });
}

// Koersen: goedkope effecten (vooral crypto, bv. $0,1023) hebben meer
// decimalen nodig — met vaste 2 decimalen werd dat $0,10 en een trapgrafiek.
export function koersDecimalen(waarde) {
  const a = Math.abs(Number(waarde));
  if (!Number.isFinite(a) || a >= 1) return 2;
  if (a >= 0.01) return 4;
  if (a >= 0.0001) return 6;
  return 8;
}
export function koers(waarde) {
  return getal(waarde, koersDecimalen(waarde));
}
// Voor invulvelden (met punt, zonder afronding naar 2 decimalen)
export function koersInvoer(waarde) {
  const n = Number(waarde);
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(koersDecimalen(n))));
}
