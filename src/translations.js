// Centraal vertaalwoordenboek. Structuur: VERTALINGEN[taalcode][sleutel].
// Nieuwe pagina's voegen hier gewoon hun eigen sleutels aan toe — het is
// bewust plat gehouden (geen geneste categorieën) zodat het makkelijk
// doorzoekbaar en uit te breiden blijft.
export const VERTALINGEN = {
  nl: {
    // Navigatie (Sidebar + TopNav)
    nav_overzicht: 'Overzicht',
    nav_beleggingen: 'Beleggingen',
    nav_analyse: 'Analyse',
    nav_dividend: 'Dividend',
    nav_belastingen: 'Belastingen',
    nav_instellingen: 'Instellingen',
    nav_portefeuille: 'Portefeuille',
    nav_markten: 'Markten',
    platform_label: 'Platform',

    // Profielmenu
    profiel_mijn_profiel: 'Mijn profiel',
    profiel_mijn_profiel_sub: 'Account & instellingen',
    profiel_billing: 'Billing',
    profiel_billing_sub: 'Abonnement beheren',
    profiel_privacybeleid: 'Privacybeleid',
    profiel_privacybeleid_sub: 'Hoe we met je gegevens omgaan',
    profiel_uitloggen: 'Uitloggen',

    // Mijn profiel-pagina
    profiel_titel: 'Mijn profiel',
    profiel_kaart_titel: 'Mijn profiel',
    profiel_voornaam: 'Voornaam',
    profiel_achternaam: 'Achternaam',
    profiel_email: 'E-mailadres',
    profiel_opslaan: 'Opslaan',
    profiel_opgeslagen: '✓ Opgeslagen!',
    profiel_voorkeuren: 'Voorkeuren',
    profiel_thema: 'Thema',
    profiel_thema_licht: 'Licht',
    profiel_thema_donker: 'Donker',
    profiel_taal: 'Voorkeurtaal',
    profiel_taal_nl: 'Nederlands',
    profiel_taal_en: 'English',
    profiel_taal_fr: 'Français',
  },
  en: {
    nav_overzicht: 'Overview',
    nav_beleggingen: 'Investments',
    nav_analyse: 'Analysis',
    nav_dividend: 'Dividend',
    nav_belastingen: 'Taxes',
    nav_instellingen: 'Settings',
    nav_portefeuille: 'Portfolio',
    nav_markten: 'Markets',
    platform_label: 'Platform',

    profiel_mijn_profiel: 'My profile',
    profiel_mijn_profiel_sub: 'Account & settings',
    profiel_billing: 'Billing',
    profiel_billing_sub: 'Manage subscription',
    profiel_privacybeleid: 'Privacy policy',
    profiel_privacybeleid_sub: 'How we handle your data',
    profiel_uitloggen: 'Log out',

    profiel_titel: 'My profile',
    profiel_kaart_titel: 'My profile',
    profiel_voornaam: 'First name',
    profiel_achternaam: 'Last name',
    profiel_email: 'Email address',
    profiel_opslaan: 'Save',
    profiel_opgeslagen: '✓ Saved!',
    profiel_voorkeuren: 'Preferences',
    profiel_thema: 'Theme',
    profiel_thema_licht: 'Light',
    profiel_thema_donker: 'Dark',
    profiel_taal: 'Preferred language',
    profiel_taal_nl: 'Nederlands',
    profiel_taal_en: 'English',
    profiel_taal_fr: 'Français',
  },
  fr: {
    nav_overzicht: 'Aperçu',
    nav_beleggingen: 'Investissements',
    nav_analyse: 'Analyse',
    nav_dividend: 'Dividende',
    nav_belastingen: 'Impôts',
    nav_instellingen: 'Paramètres',
    nav_portefeuille: 'Portefeuille',
    nav_markten: 'Marchés',
    platform_label: 'Plateforme',

    profiel_mijn_profiel: 'Mon profil',
    profiel_mijn_profiel_sub: 'Compte et paramètres',
    profiel_billing: 'Facturation',
    profiel_billing_sub: "Gérer l'abonnement",
    profiel_privacybeleid: 'Politique de confidentialité',
    profiel_privacybeleid_sub: 'Comment nous traitons vos données',
    profiel_uitloggen: 'Se déconnecter',

    profiel_titel: 'Mon profil',
    profiel_kaart_titel: 'Mon profil',
    profiel_voornaam: 'Prénom',
    profiel_achternaam: 'Nom de famille',
    profiel_email: 'Adresse e-mail',
    profiel_opslaan: 'Enregistrer',
    profiel_opgeslagen: '✓ Enregistré !',
    profiel_voorkeuren: 'Préférences',
    profiel_thema: 'Thème',
    profiel_thema_licht: 'Clair',
    profiel_thema_donker: 'Sombre',
    profiel_taal: 'Langue préférée',
    profiel_taal_nl: 'Nederlands',
    profiel_taal_en: 'English',
    profiel_taal_fr: 'Français',
  },
};

// Geeft de vertaling voor `sleutel` terug in `taal`, met NL als terugval
// (zowel voor een onbekende taal als voor een sleutel die nog niet vertaald is).
export function vertaal(taal, sleutel) {
  return VERTALINGEN[taal]?.[sleutel] || VERTALINGEN.nl[sleutel] || sleutel;
}

// Herleidt de browser-/besturingssysteemtaal (navigator.language, bv. "fr-BE",
// "en-US") naar één van onze drie ondersteunde taalcodes. Onbekende/overige
// talen vallen terug op Nederlands.
export function detecteerBrowserTaal() {
  try {
    const taal = (navigator.language || navigator.userLanguage || 'nl').toLowerCase();
    if (taal.startsWith('fr')) return 'fr';
    if (taal.startsWith('en')) return 'en';
    return 'nl';
  } catch (e) {
    return 'nl';
  }
}
