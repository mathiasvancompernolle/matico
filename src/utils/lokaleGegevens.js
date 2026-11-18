// Persoonlijke gegevens in localStorage horen bij één account.
//
// Vroeger werden ze nooit gewist: logde iemand uit en maakte een ander op
// dezelfde browser een nieuw account aan, dan "migreerde" Kapitas de lokale
// portefeuille van de eerste persoon naar het account van de tweede.
//
// Niet-persoonlijke caches (koersen, sectoren, bèta's, dividenden, dark mode,
// sortering, cookiekeuze) blijven gewoon staan.
const PERSOONLIJK = [
  'matico_beleggingen',
  'matico_verkochte',
  'matico_portfolios',
  'matico_actief_portfolio',
  'matico_manueel_',
  'matico_gebruiker',
  'matico_favorieten',
  'matico_meldingen',
  'matico_instellingen',
  'matico_laatste_cijfercheck',
];
const EIGENAAR = 'kapitas_eigenaar';

export function wisPersoonlijkeGegevens() {
  try {
    Object.keys(localStorage)
      .filter(k => PERSOONLIJK.some(p => k.startsWith(p)) || k === EIGENAAR)
      .forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

// Roep aan vóór de app de lokale gegevens inleest. Is er nog geen eigenaar
// bekend (bestaande gebruiker van vóór deze wijziging), dan wordt de huidige
// gebruiker eigenaar en blijft alles staan. Hoort de lokale data bij een
// ánder account, dan wissen we ze eerst.
export function bewaakEigenaar(userId) {
  if (!userId) return;
  try {
    const eigenaar = localStorage.getItem(EIGENAAR);
    if (eigenaar && eigenaar !== userId) wisPersoonlijkeGegevens();
    localStorage.setItem(EIGENAAR, userId);
  } catch (e) {}
}
