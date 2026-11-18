// Getallen tonen op z'n Belgisch: komma als decimaalteken, punt als
// duizendtalscheiding (bv. 1.394,58). Zelfde gebruik als toFixed: het
// tweede argument is het aantal decimalen. Enkel voor wat op het scherm
// komt — niet voor invulvelden of berekeningen (die verwachten een punt).
export function getal(waarde, decimalen = 2) {
  const n = Number(waarde);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('nl-BE', { minimumFractionDigits: decimalen, maximumFractionDigits: decimalen });
}
