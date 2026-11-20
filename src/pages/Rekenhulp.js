// Publieke rekenhulpen (zonder account): meerwaardebelasting en beurstaks,
// in het Nederlands en het Frans. Elke rekenhulp heeft een eigen adres zodat
// zoekmachines ze apart kunnen tonen (zie scripts/prerender.mjs).
import React, { useState } from 'react';
import { TOB_TARIEVEN, berekenTob } from '../utils/tob';

const ACCENT = '#1e3a8a';
const INKT = '#16181D';
const GRIJS = '#4A4D55';
const RAND = '#E2DED4';
const CREME = '#F5F3EE';
const GROEN = '#15803d';
const ROOD = '#b91c1c';

export const REKENHULP_PADEN = {
  '/meerwaardebelasting-berekenen': { soort: 'meerwaarde', taal: 'nl' },
  '/beurstaks-berekenen': { soort: 'tob', taal: 'nl' },
  '/fr/calcul-taxe-plus-values': { soort: 'meerwaarde', taal: 'fr' },
  '/fr/calcul-taxe-boursiere': { soort: 'tob', taal: 'fr' },
};
const PAD = {
  nl: { meerwaarde: '/meerwaardebelasting-berekenen', tob: '/beurstaks-berekenen' },
  fr: { meerwaarde: '/fr/calcul-taxe-plus-values', tob: '/fr/calcul-taxe-boursiere' },
};

const VRIJSTELLING = 10000;     // per persoon, inkomstenjaar 2026 (wordt geïndexeerd)
const MAX_OVERDRACHT = 5000;    // max. €1.000 per jaar, tot €15.000 in totaal
const TARIEF = 0.10;

// "1.234,56", "1234.56", "1 234" → getal (of NaN)
const leesGetal = (s) => {
  let t = String(s ?? '').replace(/[\s€]/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

// Meerwaarde van één verkoop. Gekocht vóór 2026: de waarde op 31/12/2025 geldt
// als aankoopwaarde (winst van vóór 2026 blijft vrij). Was de echte aankoopprijs
// hoger, dan mag die (bij verkoop t.e.m. 2030) gebruikt worden om de meerwaarde
// te verkleinen, maar niet om een minderwaarde te maken.
export const meerwaardeVan = ({ voor2026, aankoop, ref, verkoop }) => {
  const a = leesGetal(aankoop), r = leesGetal(ref), v = leesGetal(verkoop);
  if (!Number.isFinite(v)) return null;
  if (!voor2026) return Number.isFinite(a) ? v - a : null;
  if (!Number.isFinite(r)) return null;
  let res = v - r;
  if (res > 0 && Number.isFinite(a) && a > r) res = Math.max(0, v - a);
  return res;
};

export const berekenMeerwaarde = (rijen, overgedragen) => {
  const resultaten = rijen.map(meerwaardeVan);
  const winsten = resultaten.reduce((s, x) => s + (x > 0 ? x : 0), 0);
  const verliezen = resultaten.reduce((s, x) => s + (x < 0 ? -x : 0), 0);
  const netto = Math.max(0, winsten - verliezen);
  const extra = Math.min(MAX_OVERDRACHT, Math.max(0, leesGetal(overgedragen) || 0));
  const vrijstelling = VRIJSTELLING + extra;
  const gebruikt = Math.min(netto, vrijstelling);
  const belastbaar = Math.max(0, netto - vrijstelling);
  const belasting = belastbaar * TARIEF;
  const bron = winsten * TARIEF;
  return { resultaten, winsten, verliezen, netto, vrijstelling, gebruikt, belastbaar, belasting, bron, terug: Math.max(0, bron - belasting), ingevuld: resultaten.some(x => x !== null) };
};

// ─────────────────────────── Teksten ───────────────────────────
const T = {
  nl: {
    locale: 'nl-BE', start: 'Start gratis', inloggen: 'Inloggen', andereTaal: 'FR', andereTaalLabel: 'Version française',
    navMeerwaarde: 'Meerwaardebelasting', navTob: 'Beurstaks', gids: 'Gids voor beginners',
    eyebrow: 'Gratis rekenhulp · geen account nodig',
    disclaimer: 'Deze rekenhulp geeft een schatting op basis van de regels die gelden sinds 1 januari 2026 en is geen fiscaal advies. Controleer je situatie bij de FOD Financiën of een fiscalist. Bijzondere regels (speculatieve verrichtingen, aanmerkelijke belangen vanaf 20%, beroepsbeleggers) zijn niet meegerekend.',
    ctaTitel: 'Laat Kapitas dit automatisch berekenen',
    ctaTekst: 'Voeg je beleggingen van elke broker toe en Kapitas houdt je meerwaarden, je resterende vrijstelling, de beurstaks en je dividendbelasting het hele jaar voor je bij. Gratis.',
    ctaKnop: 'Gratis account maken',
    meerwaarde: {
      titel: 'Meerwaardebelasting berekenen (2026)',
      intro: 'Bereken hoeveel meerwaardebelasting je betaalt op je verkochte aandelen, ETF\'s, fondsen of crypto. Met de vrijstelling van €10.000, je verliezen en de regel voor aankopen van vóór 2026.',
      verkopen: 'Je verkopen in 2026',
      verkoop: 'Verkoop', naam: 'Wat verkocht je? (optioneel)', naamPh: 'bv. VWCE, Apple, Bitcoin',
      voor2026: 'Gekocht vóór 2026', na2026: 'Gekocht in 2026',
      aankoop: 'Aankoopprijs (totaal)', ref: 'Waarde op 31/12/2025', verkoopprijs: 'Verkoopprijs (totaal)',
      aankoopOpt: 'Aankoopprijs (totaal, optioneel)',
      refHulp: 'Aantal × slotkoers op 31 december 2025. Je bank of broker kan je die waarde geven.',
      voegToe: '+ Nog een verkoop', verwijder: 'Verwijderen', voorbeeld: 'Voorbeeld invullen',
      overgedragen: 'Overgedragen vrijstelling uit vorige jaren',
      overgedragenHulp: 'Pas vanaf 2027: max. €1.000 per jaar waarin je de vrijstelling niet volledig gebruikte, tot €5.000 extra. In 2026 is dit €0.',
      rijMeer: 'Meerwaarde', rijMin: 'Minderwaarde', rijNul: 'Geen belastbare meerwaarde', rijLeeg: 'Vul de bedragen in',
      res: {
        kop: 'Je resultaat', winsten: 'Meerwaarden', verliezen: 'Minderwaarden (aftrekbaar)', netto: 'Netto meerwaarde',
        vrij: 'Vrijstelling', belastbaar: 'Belastbaar', belasting: 'Te betalen (10%)',
        geen: 'Je blijft onder de vrijstelling: je betaalt geen meerwaardebelasting.',
        rest: (x) => `Je hebt nog ${x} vrijstelling over dit jaar.`,
        bronKop: 'Houdt je bank 10% in bij elke verkoop?',
        bronTekst: (x, y) => `Dan wordt er tot ${x} ingehouden, zonder rekening te houden met je vrijstelling of verliezen. Via je belastingaangifte krijg je ${y} terug.`,
        leeg: 'Vul hierboven minstens één verkoop in.',
      },
      uitleg: [
        ['Hoe werkt de meerwaardebelasting?', [
          'Sinds 1 januari 2026 betaal je in België 10% belasting op de winst die je maakt wanneer je financiële activa verkoopt: aandelen, ETF\'s, beleggingsfondsen, obligaties en crypto. Officieel heet dit de solidariteitsbijdrage.',
          'Alleen gerealiseerde winst telt. Zolang je niet verkoopt, betaal je niets, hoe sterk je beleggingen ook gestegen zijn.',
        ]],
        ['De vrijstelling van €10.000 per jaar', [
          'De eerste €10.000 netto meerwaarde per jaar is vrijgesteld, per persoon. Een koppel heeft dus elk een eigen vrijstelling.',
          'Gebruik je de vrijstelling in een jaar niet volledig, dan schuift tot €1.000 door naar de volgende jaren, tot een vrijstelling van maximaal €15.000. Het bedrag wordt jaarlijks geïndexeerd.',
        ]],
        ['Aandelen of ETF\'s gekocht vóór 2026', [
          'Winst die je opbouwde tot en met 31 december 2025 blijft vrij. Als aankoopwaarde geldt daarom de waarde op 31 december 2025.',
          'Lag je echte aankoopprijs hoger? Dan mag je bij een verkoop tot en met 2030 die hogere aankoopprijs gebruiken. Zo betaal je geen belasting op een "winst" die eigenlijk alleen het herstel van een eerder verlies is.',
        ]],
        ['Wat met verliezen?', [
          'Verkoop je in hetzelfde jaar iets met verlies (een minderwaarde), dan mag je dat aftrekken van je meerwaarden. Verliezen overdragen naar een later jaar kan niet.',
        ]],
        ['Houdt je bank de belasting in, of geef je ze zelf aan?', [
          'Belgische banken en brokers houden standaard 10% in bij elke verkoop met winst. Ze houden daarbij geen rekening met je vrijstelling of je verliezen: het teveel betaalde vraag je terug via je belastingaangifte.',
          'Je kan ook kiezen voor een opt-out: dan houdt je bank niets in en geef je je meerwaarden zelf aan. Bij een buitenlandse broker geef je ze altijd zelf aan in je aangifte.',
        ]],
      ],
    },
    tob: {
      titel: 'Beurstaks (TOB) berekenen',
      intro: 'Bereken hoeveel beurstaks je betaalt bij de aankoop of verkoop van aandelen, ETF\'s of obligaties. Met de juiste tarieven en maximumbedragen per transactie.',
      bedrag: 'Bedrag van de transactie', soort: 'Wat koop of verkoop je?',
      soorten: {
        '0.12': ['0,12%', 'ETF of fonds geregistreerd in de EER, obligaties', 'Bv. de meeste Ierse en Luxemburgse ETF\'s zoals VWCE of IWDA. Max. €1.300.'],
        '0.35': ['0,35%', 'Aandelen, ETF buiten de EER', 'Bv. Apple, KBC of een Amerikaanse ETF. Max. €1.600.'],
        '1.32': ['1,32%', 'Kapitaliserend fonds ingeschreven bij de FSMA', 'Fondsen en ETF\'s die officieel in België verkocht worden en hun winst herbeleggen. Max. €4.000.'],
      },
      aantal: 'Hoe vaak per jaar?', aantalHulp: 'Bv. 12 als je elke maand belegt',
      res: { per: 'Beurstaks per transactie', retour: 'Aankoop én later verkoop', jaar: (n) => `Per jaar (${n}× aankoop)`, max: 'Het maximum per transactie is bereikt.', leeg: 'Vul een bedrag in.' },
      uitleg: [
        ['Wat is de beurstaks?', [
          'De beurstaks of taks op de beursverrichtingen (TOB) betaal je in België bij elke aankoop én elke verkoop van effecten via een bank of broker. Ze wordt berekend op het bedrag van de transactie, met een maximum per transactie.',
          'Het tarief hangt af van wat je koopt: aandelen, obligaties, of een ETF of fonds. Bij ETF\'s speelt ook mee waar het fonds geregistreerd is en of het zijn winst uitkeert of herbelegt.',
        ]],
        ['Welk tarief geldt voor jouw ETF?', [
          'De meeste populaire ETF\'s zijn in Ierland of Luxemburg geregistreerd (in de EER) en vallen onder 0,12%. Dat geldt ook voor kapitaliserende ETF\'s, zolang ze niet bij de FSMA ingeschreven zijn.',
          'Kapitaliserende fondsen en ETF\'s die wél bij de FSMA ingeschreven zijn, betalen 1,32%. Amerikaanse ETF\'s en andere fondsen buiten de EER betalen 0,35%, net als gewone aandelen.',
        ]],
        ['Wie betaalt de beurstaks aan de fiscus?', [
          'Belgische banken en brokers houden de beurstaks automatisch in. Sommige buitenlandse brokers doen dat niet: dan moet je ze zelf aangeven en betalen, uiterlijk op de laatste werkdag van de tweede maand na de transactie.',
        ]],
      ],
    },
  },
  fr: {
    locale: 'fr-BE', start: 'Commencer', inloggen: 'Se connecter', andereTaal: 'NL', andereTaalLabel: 'Nederlandse versie',
    navMeerwaarde: 'Taxe sur les plus-values', navTob: 'Taxe boursière', gids: null,
    eyebrow: 'Calculateur gratuit · sans compte',
    disclaimer: 'Ce calculateur donne une estimation selon les règles en vigueur depuis le 1er janvier 2026 et ne constitue pas un conseil fiscal. Vérifiez votre situation auprès du SPF Finances ou d\'un fiscaliste. Les règles particulières (opérations spéculatives, participations importantes à partir de 20 %, investisseurs professionnels) ne sont pas prises en compte.',
    ctaTitel: 'Laissez Kapitas calculer tout cela automatiquement',
    ctaTekst: 'Ajoutez vos placements de chaque courtier : Kapitas suit toute l\'année vos plus-values, votre exonération restante, la taxe boursière et le précompte sur vos dividendes. Gratuitement.',
    ctaKnop: 'Créer un compte gratuit',
    meerwaarde: {
      titel: 'Calculer la taxe sur les plus-values (2026)',
      intro: 'Calculez combien de taxe sur les plus-values vous payez sur vos actions, ETF, fonds ou cryptos vendus. Avec l\'exonération de 10 000 €, vos pertes et la règle pour les achats antérieurs à 2026.',
      verkopen: 'Vos ventes en 2026',
      verkoop: 'Vente', naam: 'Qu\'avez-vous vendu ? (facultatif)', naamPh: 'p. ex. VWCE, Apple, Bitcoin',
      voor2026: 'Acheté avant 2026', na2026: 'Acheté en 2026',
      aankoop: 'Prix d\'achat (total)', ref: 'Valeur au 31/12/2025', verkoopprijs: 'Prix de vente (total)',
      aankoopOpt: 'Prix d\'achat (total, facultatif)',
      refHulp: 'Nombre × cours de clôture du 31 décembre 2025. Votre banque ou courtier peut vous donner cette valeur.',
      voegToe: '+ Ajouter une vente', verwijder: 'Supprimer', voorbeeld: 'Remplir un exemple',
      overgedragen: 'Exonération reportée des années précédentes',
      overgedragenHulp: 'À partir de 2027 : max. 1 000 € par année où l\'exonération n\'a pas été entièrement utilisée, jusqu\'à 5 000 € en plus. En 2026, c\'est 0 €.',
      rijMeer: 'Plus-value', rijMin: 'Moins-value', rijNul: 'Pas de plus-value imposable', rijLeeg: 'Remplissez les montants',
      res: {
        kop: 'Votre résultat', winsten: 'Plus-values', verliezen: 'Moins-values (déductibles)', netto: 'Plus-value nette',
        vrij: 'Exonération', belastbaar: 'Imposable', belasting: 'À payer (10 %)',
        geen: 'Vous restez sous l\'exonération : vous ne payez pas de taxe sur les plus-values.',
        rest: (x) => `Il vous reste ${x} d'exonération cette année.`,
        bronKop: 'Votre banque retient-elle 10 % à chaque vente ?',
        bronTekst: (x, y) => `Dans ce cas, jusqu'à ${x} est retenu, sans tenir compte de votre exonération ni de vos pertes. Via votre déclaration d'impôt, vous récupérez ${y}.`,
        leeg: 'Remplissez au moins une vente ci-dessus.',
      },
      uitleg: [
        ['Comment fonctionne la taxe sur les plus-values ?', [
          'Depuis le 1er janvier 2026, vous payez en Belgique 10 % sur le bénéfice réalisé lors de la vente d\'actifs financiers : actions, ETF, fonds d\'investissement, obligations et cryptos. Officiellement, il s\'agit de la contribution de solidarité.',
          'Seul le bénéfice réalisé compte. Tant que vous ne vendez pas, vous ne payez rien, même si vos placements ont fortement augmenté.',
        ]],
        ['L\'exonération de 10 000 € par an', [
          'Les premiers 10 000 € de plus-value nette par an sont exonérés, par personne. Un couple dispose donc chacun de sa propre exonération.',
          'Si vous n\'utilisez pas entièrement l\'exonération une année, jusqu\'à 1 000 € est reporté aux années suivantes, jusqu\'à une exonération maximale de 15 000 €. Le montant est indexé chaque année.',
        ]],
        ['Actions ou ETF achetés avant 2026', [
          'Le bénéfice constitué jusqu\'au 31 décembre 2025 reste exonéré. La valeur d\'acquisition est donc la valeur au 31 décembre 2025.',
          'Votre prix d\'achat réel était plus élevé ? Pour une vente jusqu\'en 2030 inclus, vous pouvez utiliser ce prix d\'achat plus élevé. Vous ne payez ainsi pas d\'impôt sur un « bénéfice » qui ne fait que compenser une perte antérieure.',
        ]],
        ['Et les pertes ?', [
          'Si vous vendez quelque chose à perte la même année (une moins-value), vous pouvez la déduire de vos plus-values. Il n\'est pas possible de reporter des pertes sur une année ultérieure.',
        ]],
        ['Retenue par la banque ou déclaration vous-même ?', [
          'Les banques et courtiers belges retiennent par défaut 10 % sur chaque vente en bénéfice, sans tenir compte de votre exonération ni de vos pertes : vous récupérez le trop-payé via votre déclaration d\'impôt.',
          'Vous pouvez aussi choisir l\'opt-out : votre banque ne retient rien et vous déclarez vous-même vos plus-values. Avec un courtier étranger, vous les déclarez toujours vous-même.',
        ]],
      ],
    },
    tob: {
      titel: 'Calculer la taxe boursière (TOB)',
      intro: 'Calculez combien de taxe boursière vous payez à l\'achat ou à la vente d\'actions, d\'ETF ou d\'obligations. Avec les bons taux et les montants maximums par transaction.',
      bedrag: 'Montant de la transaction', soort: 'Qu\'achetez-vous ou vendez-vous ?',
      soorten: {
        '0.12': ['0,12 %', 'ETF ou fonds enregistré dans l\'EEE, obligations', 'P. ex. la plupart des ETF irlandais et luxembourgeois comme VWCE ou IWDA. Max. 1 300 €.'],
        '0.35': ['0,35 %', 'Actions, ETF hors EEE', 'P. ex. Apple, KBC ou un ETF américain. Max. 1 600 €.'],
        '1.32': ['1,32 %', 'Fonds de capitalisation inscrit auprès de la FSMA', 'Fonds et ETF officiellement commercialisés en Belgique qui réinvestissent leurs bénéfices. Max. 4 000 €.'],
      },
      aantal: 'Combien de fois par an ?', aantalHulp: 'P. ex. 12 si vous investissez chaque mois',
      res: { per: 'Taxe boursière par transaction', retour: 'Achat puis vente', jaar: (n) => `Par an (${n} achats)`, max: 'Le maximum par transaction est atteint.', leeg: 'Saisissez un montant.' },
      uitleg: [
        ['Qu\'est-ce que la taxe boursière ?', [
          'La taxe sur les opérations de bourse (TOB) est due en Belgique à chaque achat et à chaque vente de titres via une banque ou un courtier. Elle est calculée sur le montant de la transaction, avec un maximum par transaction.',
          'Le taux dépend de ce que vous achetez : actions, obligations, ou un ETF ou fonds. Pour les ETF, le lieu d\'enregistrement du fonds compte aussi, ainsi que le fait qu\'il distribue ou capitalise ses bénéfices.',
        ]],
        ['Quel taux pour votre ETF ?', [
          'La plupart des ETF populaires sont enregistrés en Irlande ou au Luxembourg (dans l\'EEE) et relèvent du taux de 0,12 %. C\'est aussi le cas des ETF de capitalisation, tant qu\'ils ne sont pas inscrits auprès de la FSMA.',
          'Les fonds et ETF de capitalisation inscrits auprès de la FSMA paient 1,32 %. Les ETF américains et autres fonds hors EEE paient 0,35 %, comme les actions ordinaires.',
        ]],
        ['Qui verse la taxe au fisc ?', [
          'Les banques et courtiers belges retiennent automatiquement la taxe boursière. Certains courtiers étrangers ne le font pas : vous devez alors la déclarer et la payer vous-même, au plus tard le dernier jour ouvrable du deuxième mois suivant la transaction.',
        ]],
      ],
    },
  },
};

// ─────────────────────────── Opbouw ───────────────────────────
const CSS = `
  .rh * { box-sizing: border-box; }
  .rh input { font-family: inherit; }
  .rh-veld { width: 100%; height: 48px; border: 1px solid #CFCAC0; border-radius: 10px; padding: 0 14px; font-size: 16px; background: #fff; color: ${INKT}; }
  .rh-veld:focus { outline: 2px solid ${ACCENT}; outline-offset: -1px; border-color: ${ACCENT}; }
  .rh-label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
  .rh-hulp { font-size: 13px; color: #6b6e75; margin-top: 6px; line-height: 1.45; }
  .rh-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .rh-hoofd { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 24px; align-items: start; }
  .rh-sectie { padding: 0 80px; }
  .rh-nav-links { display: flex; gap: 24px; align-items: center; }
  .rh-nav-links a { color: ${GRIJS}; text-decoration: none; font-size: 14px; font-weight: 600; }
  .rh-nav-links a[aria-current] { color: ${ACCENT}; }
  .rh-knop { height: 44px; padding: 0 18px; border-radius: 10px; border: none; background: ${ACCENT}; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap; }
  .rh-knop-licht { background: #fff; color: ${INKT}; border: 1px solid #CFCAC0; font-weight: 600; }
  .rh-soort { display: flex; gap: 14px; align-items: flex-start; text-align: left; width: 100%; padding: 16px; border-radius: 12px; border: 1px solid #CFCAC0; background: #fff; cursor: pointer; font-family: inherit; color: ${INKT}; }
  .rh-soort[aria-pressed="true"] { border: 2px solid ${ACCENT}; padding: 15px; background: #f5f7fd; }
  .rh-sticky { position: sticky; top: 96px; scroll-margin-top: 88px; }
  .rh-gsm-balk { display: none; }
  @media (max-width: 900px) {
    .rh-hoofd { grid-template-columns: 1fr; }
    .rh-sticky { position: static; }
    .rh-sectie { padding: 0 16px; }
    .rh-nav-links { display: none; }
    .rh-h1 { font-size: 36px !important; }
    .rh-header { padding: 0 16px !important; }
    .rh { padding-bottom: 84px; }
    .rh-gsm-balk { display: flex; position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); z-index: 60; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-radius: 14px; background: ${INKT}; color: #fff; text-decoration: none; box-shadow: 0 12px 32px rgba(0,0,0,.25); font-weight: 700; }
  }
  @media (max-width: 560px) {
    .rh-grid-3 { grid-template-columns: 1fr; }
  }
`;

const kaart = { background: '#fff', border: `1px solid ${RAND}`, borderRadius: 16, padding: 24 };

function Kader({ soort, taal, onNaarApp, children }) {
  const t = T[taal];
  const ander = taal === 'nl' ? 'fr' : 'nl';
  const klikApp = (modus) => (e) => { e.preventDefault(); onNaarApp && onNaarApp(modus); };
  return (
    <div className="rh" lang={taal === 'fr' ? 'fr-BE' : 'nl-BE'} style={{ background: CREME, color: INKT, fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: '100vh' }}>
      <style>{CSS}</style>
      <header className="rh-header" style={{ height: 72, padding: '0 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: `1px solid ${RAND}`, background: CREME, position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="/" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: ACCENT, textDecoration: 'none' }}>Kapitas</a>
        <nav className="rh-nav-links">
          <a href={PAD[taal].meerwaarde} aria-current={soort === 'meerwaarde' ? 'page' : undefined}>{t.navMeerwaarde}</a>
          <a href={PAD[taal].tob} aria-current={soort === 'tob' ? 'page' : undefined}>{t.navTob}</a>
          {t.gids && <a href="/gids">{t.gids}</a>}
        </nav>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href={PAD[ander][soort]} hrefLang={ander === 'fr' ? 'fr-BE' : 'nl-BE'} title={t.andereTaalLabel} style={{ fontSize: 14, fontWeight: 700, color: GRIJS, textDecoration: 'none', padding: '8px 6px' }}>{t.andereTaal}</a>
          <a href="/" onClick={klikApp('registreren')} className="rh-knop" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>{t.start}</a>
        </div>
      </header>
      {children}
      <section className="rh-sectie" style={{ marginTop: 64, paddingTop: 56, paddingBottom: 56, background: ACCENT, color: '#fff' }}>
        <div style={{ maxWidth: 760 }}>
          <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{t.ctaTitel}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: '#dbe4ff', margin: '16px 0 24px' }}>{t.ctaTekst}</p>
          <a href="/" onClick={klikApp('registreren')} className="rh-knop" style={{ background: '#fff', color: INKT, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', height: 50 }}>{t.ctaKnop}</a>
        </div>
      </section>
      <footer className="rh-sectie" style={{ padding: '28px 80px 40px', fontSize: 13, lineHeight: 1.6, color: '#6b6e75' }}>
        <p style={{ margin: '0 0 12px', maxWidth: 900 }}>{t.disclaimer}</p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <a href={PAD[taal].meerwaarde} style={{ color: GRIJS }}>{t.navMeerwaarde}</a>
          <a href={PAD[taal].tob} style={{ color: GRIJS }}>{t.navTob}</a>
          <a href="/gids" style={{ color: GRIJS }}>{T.nl.gids}</a>
          <a href="/privacybeleid" style={{ color: GRIJS }}>Privacy</a>
          <a href="/disclaimer" style={{ color: GRIJS }}>Disclaimer</a>
        </div>
      </footer>
    </div>
  );
}

function Hero({ t }) {
  return (
    <section className="rh-sectie" style={{ paddingTop: 56, paddingBottom: 32 }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT, marginBottom: 16 }}>{t.eyebrow}</div>
      <h1 className="rh-h1" style={{ margin: 0, fontSize: 56, lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 700, maxWidth: 900 }}>{t.titel}</h1>
      <p style={{ margin: '18px 0 0', fontSize: 19, lineHeight: 1.5, color: GRIJS, maxWidth: 720 }}>{t.intro}</p>
    </section>
  );
}

function Uitleg({ blokken }) {
  return (
    <section className="rh-sectie" style={{ marginTop: 56 }}>
      <div style={{ maxWidth: 760 }}>
        {blokken.map(([kop, alineas]) => (
          <div key={kop} style={{ marginBottom: 36 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 26, letterSpacing: '-0.015em' }}>{kop}</h2>
            {alineas.map((a, i) => <p key={i} style={{ margin: '0 0 12px', fontSize: 17, lineHeight: 1.65, color: GRIJS }}>{a}</p>)}
          </div>
        ))}
      </div>
    </section>
  );
}

const Regel = ({ label, waarde, vet, kleur }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: `1px solid ${RAND}`, fontSize: vet ? 17 : 15, fontWeight: vet ? 700 : 500 }}>
    <span style={{ color: vet ? INKT : GRIJS }}>{label}</span>
    <span style={{ fontVariantNumeric: 'tabular-nums', color: kleur || INKT, whiteSpace: 'nowrap' }}>{waarde}</span>
  </div>
);

let volgnummer = 1;
const legeRij = () => ({ id: volgnummer++, naam: '', voor2026: true, aankoop: '', ref: '', verkoop: '' });

function Meerwaarde({ taal }) {
  const t = T[taal].meerwaarde;
  const eur = (x) => new Intl.NumberFormat(T[taal].locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(x);
  const [rijen, setRijen] = useState(() => [legeRij()]);
  const [overgedragen, setOvergedragen] = useState('');
  const r = berekenMeerwaarde(rijen, overgedragen);
  const zet = (id, veld, waarde) => setRijen(rs => rs.map(x => x.id === id ? { ...x, [veld]: waarde } : x));
  const voorbeeld = () => setRijen([
    { id: volgnummer++, naam: 'VWCE', voor2026: true, aankoop: '9000', ref: '12500', verkoop: '16000' },
    { id: volgnummer++, naam: 'Apple', voor2026: false, aankoop: '4000', ref: '', verkoop: '11500' },
    { id: volgnummer++, naam: 'Bitcoin', voor2026: false, aankoop: '3000', ref: '', verkoop: '2200' },
  ]);

  return (
    <>
      <Hero t={{ ...t, eyebrow: T[taal].eyebrow }} />
      <section className="rh-sectie">
        <div className="rh-hoofd">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>{t.verkopen}</h2>
              <button type="button" className="rh-knop rh-knop-licht" onClick={voorbeeld}>{t.voorbeeld}</button>
            </div>
            {rijen.map((rij, i) => {
              const res = r.resultaten[i];
              const resTekst = res === null ? t.rijLeeg : res > 0 ? `${t.rijMeer}: ${eur(res)}` : res < 0 ? `${t.rijMin}: ${eur(-res)}` : t.rijNul;
              const resKleur = res === null ? '#6b6e75' : res > 0 ? INKT : res < 0 ? ROOD : GROEN;
              return (
                <div key={rij.id} style={kaart}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
                    <strong style={{ fontSize: 16 }}>{t.verkoop} {i + 1}</strong>
                    {rijen.length > 1 && <button type="button" onClick={() => setRijen(rs => rs.filter(x => x.id !== rij.id))} style={{ background: 'none', border: 'none', color: ROOD, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>{t.verwijder}</button>}
                  </div>
                  <label className="rh-label" htmlFor={`naam-${rij.id}`}>{t.naam}</label>
                  <input id={`naam-${rij.id}`} className="rh-veld" value={rij.naam} placeholder={t.naamPh} onChange={e => zet(rij.id, 'naam', e.target.value)} />
                  <div role="group" style={{ display: 'flex', gap: 8, margin: '14px 0' }}>
                    {[[true, t.voor2026], [false, t.na2026]].map(([w, l]) => (
                      <button key={l} type="button" aria-pressed={rij.voor2026 === w} onClick={() => zet(rij.id, 'voor2026', w)} style={{ flex: 1, height: 42, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: rij.voor2026 === w ? INKT : '#fff', color: rij.voor2026 === w ? '#fff' : INKT, border: `1px solid ${rij.voor2026 === w ? INKT : '#CFCAC0'}` }}>{l}</button>
                    ))}
                  </div>
                  <div className="rh-grid-3">
                    <div>
                      <label className="rh-label" htmlFor={`a-${rij.id}`}>{rij.voor2026 ? t.aankoopOpt : t.aankoop}</label>
                      <input id={`a-${rij.id}`} className="rh-veld" inputMode="decimal" placeholder="€" value={rij.aankoop} onChange={e => zet(rij.id, 'aankoop', e.target.value)} />
                    </div>
                    {rij.voor2026 && (
                      <div>
                        <label className="rh-label" htmlFor={`r-${rij.id}`}>{t.ref}</label>
                        <input id={`r-${rij.id}`} className="rh-veld" inputMode="decimal" placeholder="€" value={rij.ref} onChange={e => zet(rij.id, 'ref', e.target.value)} />
                      </div>
                    )}
                    <div>
                      <label className="rh-label" htmlFor={`v-${rij.id}`}>{t.verkoopprijs}</label>
                      <input id={`v-${rij.id}`} className="rh-veld" inputMode="decimal" placeholder="€" value={rij.verkoop} onChange={e => zet(rij.id, 'verkoop', e.target.value)} />
                    </div>
                  </div>
                  {rij.voor2026 && <div className="rh-hulp">{t.refHulp}</div>}
                  <div style={{ marginTop: 14, fontSize: 15, fontWeight: 700, color: resKleur }}>{resTekst}</div>
                </div>
              );
            })}
            <button type="button" className="rh-knop rh-knop-licht" style={{ alignSelf: 'flex-start' }} onClick={() => setRijen(rs => [...rs, legeRij()])}>{t.voegToe}</button>
            <div style={kaart}>
              <label className="rh-label" htmlFor="overgedragen">{t.overgedragen}</label>
              <input id="overgedragen" className="rh-veld" inputMode="decimal" placeholder="€ 0" value={overgedragen} onChange={e => setOvergedragen(e.target.value)} style={{ maxWidth: 220 }} />
              <div className="rh-hulp">{t.overgedragenHulp}</div>
            </div>
          </div>

          {r.ingevuld && <a href="#resultaat" className="rh-gsm-balk"><span>{t.res.belasting}: {eur(r.belasting)}</span><span aria-hidden="true">↓</span></a>}
          <div id="resultaat" className="rh-sticky" style={{ ...kaart, padding: 28 }} aria-live="polite">
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>{t.res.kop}</h2>
            {!r.ingevuld ? <p style={{ color: GRIJS, margin: 0 }}>{t.res.leeg}</p> : (
              <>
                <Regel label={t.res.winsten} waarde={eur(r.winsten)} />
                <Regel label={t.res.verliezen} waarde={r.verliezen > 0 ? '− ' + eur(r.verliezen) : eur(0)} />
                <Regel label={t.res.netto} waarde={eur(r.netto)} vet />
                <Regel label={t.res.vrij} waarde={'− ' + eur(r.gebruikt)} kleur={GROEN} />
                <Regel label={t.res.belastbaar} waarde={eur(r.belastbaar)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 18 }}>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{t.res.belasting}</span>
                  <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: r.belasting > 0 ? INKT : GROEN }}>{eur(r.belasting)}</span>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 14, color: r.belasting > 0 ? GRIJS : GROEN, fontWeight: r.belasting > 0 ? 500 : 600 }}>
                  {r.belasting > 0 ? null : t.res.geen} {r.vrijstelling - r.gebruikt > 0 ? t.res.rest(eur(r.vrijstelling - r.gebruikt)) : null}
                </p>
                {r.bron > 0 && (
                  <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: '#f5f7fd', border: '1px solid #dbe4ff' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.res.bronKop}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.55, color: GRIJS }}>{t.res.bronTekst(eur(r.bron), eur(r.terug))}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
      <Uitleg blokken={t.uitleg} />
    </>
  );
}

function Tob({ taal }) {
  const t = T[taal].tob;
  const eur = (x) => new Intl.NumberFormat(T[taal].locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
  const [bedrag, setBedrag] = useState('');
  const [soort, setSoort] = useState('0.12');
  const [aantal, setAantal] = useState('');
  const b = leesGetal(bedrag);
  const n = Math.max(0, Math.round(leesGetal(aantal) || 0));
  const per = Number.isFinite(b) && b > 0 ? berekenTob(b, soort) : null;
  const info = TOB_TARIEVEN.find(x => x.id === soort);
  const maxBereikt = per !== null && b * info.tarief >= info.max;

  return (
    <>
      <Hero t={{ ...t, eyebrow: T[taal].eyebrow }} />
      <section className="rh-sectie">
        <div className="rh-hoofd">
          <div style={{ ...kaart, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label className="rh-label" htmlFor="bedrag">{t.bedrag}</label>
              <input id="bedrag" className="rh-veld" inputMode="decimal" placeholder="€ 1.000" value={bedrag} onChange={e => setBedrag(e.target.value)} style={{ maxWidth: 260 }} />
            </div>
            <div>
              <div className="rh-label">{t.soort}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['0.12', '0.35', '1.32'].map(id => {
                  const [pct, kop, uitleg] = t.soorten[id];
                  return (
                    <button key={id} type="button" className="rh-soort" aria-pressed={soort === id} onClick={() => setSoort(id)}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: ACCENT, minWidth: 70 }}>{pct}</span>
                      <span><span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{kop}</span><span style={{ display: 'block', fontSize: 13, color: GRIJS, marginTop: 3, lineHeight: 1.45 }}>{uitleg}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="rh-label" htmlFor="aantal">{t.aantal}</label>
              <input id="aantal" className="rh-veld" inputMode="numeric" placeholder="1" value={aantal} onChange={e => setAantal(e.target.value)} style={{ maxWidth: 120 }} />
              <div className="rh-hulp">{t.aantalHulp}</div>
            </div>
          </div>
          {per !== null && <a href="#resultaat" className="rh-gsm-balk"><span>{t.res.per}: {eur(per)}</span><span aria-hidden="true">↓</span></a>}
          <div id="resultaat" className="rh-sticky" style={{ ...kaart, padding: 28 }} aria-live="polite">
            {per === null ? <p style={{ color: GRIJS, margin: 0 }}>{t.res.leeg}</p> : (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: GRIJS }}>{t.res.per}</div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', margin: '4px 0 12px' }}>{eur(per)}</div>
                {maxBereikt && <p style={{ margin: '0 0 12px', fontSize: 14, color: GROEN, fontWeight: 600 }}>{t.res.max}</p>}
                <Regel label={t.res.retour} waarde={eur(per * 2)} />
                {n > 1 && <Regel label={t.res.jaar(n)} waarde={eur(per * n)} vet />}
              </>
            )}
          </div>
        </div>
      </section>
      <Uitleg blokken={t.uitleg} />
    </>
  );
}

export default function Rekenhulp({ soort, taal = 'nl', onNaarApp }) {
  return (
    <Kader soort={soort} taal={taal} onNaarApp={onNaarApp}>
      {soort === 'tob' ? <Tob taal={taal} /> : <Meerwaarde taal={taal} />}
    </Kader>
  );
}
