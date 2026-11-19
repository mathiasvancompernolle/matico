// Hoort een koers bij de handelsdag van vandaag (Belgische tijd)?
//
// Vroeger keek Kapitas enkel naar de klok ("na 9u is de Europese beurs open,
// na 15u30 de Amerikaanse"). Dat ging mis: 's ochtends bevatte een koers nog
// de beweging van gisteren (die dan als "vandaag" werd getoond), op
// feestdagen gaf het een dagresultaat terwijl de beurs dicht was, en na
// sluiting van één beurs verdween haar dagresultaat. Nu kijken we naar het
// tijdstip van de koers zelf (veld `t`, unix-seconden, van de API).

export function brusselDatum(ms) {
  // 'sv-SE' geeft YYYY-MM-DD
  return new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' });
}

function oudeKlokSchatting(munt) {
  const nu = new Date();
  const dag = nu.getUTCDay();
  if (dag === 0 || dag === 6) return false;
  const tijdUTC = nu.getUTCHours() * 60 + nu.getUTCMinutes();
  return (munt || 'EUR') === 'EUR' ? tijdUTC >= 8 * 60 : tijdUTC >= 14 * 60 + 30;
}

export function handeldeVandaag(koers, type, munt) {
  if (type === 'crypto') return true;
  if (!koers) return false;
  if (!koers.t) return oudeKlokSchatting(munt);
  return brusselDatum(koers.t * 1000) === brusselDatum(Date.now());
}

// Een koers van een vorige handelsdag heeft vandaag nog niet bewogen: de
// "vorige slotkoers" is dan gewoon de laatste koers, en de dagwinst 0.
export function normaliseerKoers(koers) {
  if (!koers || !koers.t || !koers.c) return koers;
  if (brusselDatum(koers.t * 1000) === brusselDatum(Date.now())) return koers;
  if (koers.pc === koers.c) return koers;
  return { ...koers, pc: koers.c, d: 0, dp: 0 };
}

// Datums komen voor als "2026-11-19" en (oudere verkopen) als "19/11/2026".
// new Date("19/11/2026") is ongeldig, dus altijd via deze functie.
export function leesDatum(str) {
  if (!str) return null;
  const delen = String(str).split('/');
  const d = delen.length === 3 ? new Date(`${delen[2]}-${delen[1].padStart(2, '0')}-${delen[0].padStart(2, '0')}`) : new Date(str);
  return isNaN(d) ? null : d;
}

// Elke datumvorm (Date, "2026-11-19", "2026-11-19T…", "19/11/2026") → "2026-11-19"
export function naarIsoDatum(x) {
  if (!x) return null;
  if (x instanceof Date) return isNaN(x) ? null : x.toISOString().slice(0, 10);
  const s = String(x);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = leesDatum(s);
  return d ? d.toISOString().slice(0, 10) : null;
}

export function normaliseerKoersen(koersen) {
  const uit = {};
  Object.keys(koersen || {}).forEach(s => { uit[s] = normaliseerKoers(koersen[s]); });
  return uit;
}
