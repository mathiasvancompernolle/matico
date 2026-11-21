// Publieke rekenhulpen (zonder account): meerwaardebelasting en beurstaks,
// in het Nederlands en het Frans. Elke rekenhulp heeft een eigen adres zodat
// zoekmachines ze apart kunnen tonen (zie scripts/prerender.mjs).
import React, { useState } from 'react';
import { TOB_TARIEVEN, berekenTob } from '../utils/tob';
import { PER_LAND } from '../utils/dividendbelasting';

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
  '/dividendbelasting-berekenen': { soort: 'dividend', taal: 'nl' },
  '/fr/calcul-precompte-dividendes': { soort: 'dividend', taal: 'fr' },
};
const PAD = {
  nl: { meerwaarde: '/meerwaardebelasting-berekenen', tob: '/beurstaks-berekenen', dividend: '/dividendbelasting-berekenen' },
  fr: { meerwaarde: '/fr/calcul-taxe-plus-values', tob: '/fr/calcul-taxe-boursiere', dividend: '/fr/calcul-precompte-dividendes' },
};

// Dividendvrijstelling (dividenden uit aandelen, niet uit fondsen/ETF's):
// €833 per persoon voor inkomstenjaar 2026 → max. €249,90 terug via de aangifte
const DIV_VRIJSTELLING = 833;

// Keuzes voor "waar komt het dividend vandaan": aandelen per land + ETF's
const DIV_HERKOMST = ['BE', 'NL', 'FR', 'DE', 'US', 'GB', 'CH', 'ES', 'IT', 'IE', 'LU', 'DK', 'SE', 'NO', 'FI', 'AT', 'PT', 'CA', 'JP', 'ETF_EU', 'ETF_US'];
const LAND_FR = { BE: 'Belgique', NL: 'Pays-Bas', FR: 'France', DE: 'Allemagne', US: 'États-Unis', GB: 'Royaume-Uni', CH: 'Suisse', ES: 'Espagne', IT: 'Italie', IE: 'Irlande', LU: 'Luxembourg', DK: 'Danemark', SE: 'Suède', NO: 'Norvège', FI: 'Finlande', AT: 'Autriche', PT: 'Portugal', CA: 'Canada', JP: 'Japon' };
const herkomstInfo = (code) => {
  if (code === 'ETF_EU') return { tarief: 0, etf: true };
  if (code === 'ETF_US') return { tarief: 0.15, etf: true };
  return { tarief: PER_LAND[code]?.tarief || 0, etf: false };
};

export const berekenDividend = (rijen, personen) => {
  const per = rijen.map(r => {
    const bruto = leesGetal(r.bruto);
    if (!Number.isFinite(bruto) || bruto <= 0) return null;
    const { tarief, etf } = herkomstInfo(r.herkomst);
    const buitenland = bruto * tarief;
    const basis = bruto - buitenland;          // waarop de Belgische 30% geheven wordt
    const rv = basis * 0.30;
    return { bruto, buitenland, basis, rv, netto: basis - rv, etf };
  });
  const som = (k, f = () => true) => per.reduce((s, x) => s + (x && f(x) ? x[k] : 0), 0);
  const bruto = som('bruto'), buitenland = som('buitenland'), rv = som('rv'), netto = som('netto');
  const vrijBasis = som('basis', x => !x.etf);
  const maxVrij = DIV_VRIJSTELLING * (personen === 2 ? 2 : 1);
  const terug = Math.min(vrijBasis, maxVrij) * 0.30;
  const nettoNa = netto + terug;
  return { per, bruto, buitenland, rv, netto, terug, nettoNa, vrijBasis, maxVrij, druk: bruto > 0 ? 1 - nettoNa / bruto : 0, ingevuld: per.some(Boolean), enkelEtf: per.some(Boolean) && vrijBasis === 0 };
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
    navMeerwaarde: 'Meerwaardebelasting', navTob: 'Beurstaks', navDividend: 'Dividendbelasting', gids: 'Gids voor beginners',
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
    dividend: {
      titel: 'Dividendbelasting berekenen',
      intro: 'Bereken hoeveel belasting je betaalt op je dividenden: de buitenlandse bronheffing én de Belgische roerende voorheffing van 30%. En hoeveel je via de vrijstelling van €833 terugkrijgt in je belastingaangifte.',
      kop: 'Je dividenden in 2026', rij: 'Dividend', naam: 'Van welk aandeel of welke ETF? (optioneel)', naamPh: 'bv. ASML, Microsoft, VHYL',
      herkomst: 'Waar komt het vandaan?', bruto: 'Bruto dividend', brutoHulp: 'Het bedrag vóór alle belastingen, zoals op je dividendafrekening.',
      etfEu: 'ETF of fonds uit Ierland of Luxemburg', etfUs: 'Amerikaanse ETF', aandeel: (land) => `Aandeel uit ${land}`,
      groepAandelen: 'Aandelen', groepEtf: "ETF's en fondsen",
      personen: 'Op naam van', persoon1: '1 persoon', persoon2: '2 personen (bv. koppel)',
      personenHulp: 'De vrijstelling geldt per persoon. Staan je beleggingen op twee namen, dan heeft elk recht op de vrijstelling.',
      voegToe: '+ Nog een dividend', verwijder: 'Verwijderen', voorbeeld: 'Voorbeeld invullen',
      rijNetto: (n, b) => `Netto ontvangen: ${n} (${b} belasting)`, rijLeeg: 'Vul het bruto bedrag in',
      res: {
        kop: 'Je resultaat', bruto: 'Bruto dividend', buitenland: 'Buitenlandse bronheffing', rv: 'Belgische roerende voorheffing (30%)',
        netto: 'Netto ontvangen', terug: 'Terug via je aangifte', nettoNa: 'Netto na terugbetaling', druk: (p) => `Totale belasting: ${p} van je bruto dividend`,
        aangifte: (rv) => `Vul in je belastingaangifte in vak VII, code 1437 (partner: 2437), ${rv} in: de roerende voorheffing op je dividenden uit aandelen, tot het maximum.`,
        enkelEtf: 'Dividenden van ETF\'s en fondsen komen niet in aanmerking voor de vrijstelling: alleen dividenden van aandelen.',
        leeg: 'Vul hierboven minstens één dividend in.',
      },
      uitleg: [
        ['Hoe worden dividenden belast in België?', [
          'Op elk dividend houdt je bank of broker 30% roerende voorheffing in. Komt het dividend uit het buitenland, dan heeft het land van het bedrijf eerst al een deel ingehouden: de buitenlandse bronheffing. De Belgische 30% wordt berekend op wat daarna overblijft.',
          'Een voorbeeld: op een Amerikaans dividend van €100 houden de VS eerst 15% in (€15). Op de resterende €85 betaal je in België 30% (€25,50). Je houdt dus €59,50 over: een totale belasting van 40,5%.',
        ]],
        ['De vrijstelling van €833: geld dat je terugkrijgt', [
          'De eerste €833 aan dividenden uit aandelen per persoon is vrijgesteld (inkomstenjaar 2026). Omdat je bank toch 30% inhoudt, vraag je dat terug via je belastingaangifte: maximaal €249,90 per persoon.',
          'Je vult in vak VII onder code 1437 het bedrag van de ingehouden roerende voorheffing in (dus niet het bruto dividend). Veel beleggers vergeten dit en laten zo elk jaar geld liggen.',
        ]],
        ['Geldt de vrijstelling ook voor ETF\'s?', [
          'Nee. Uitkeringen van ETF\'s en beleggingsfondsen komen niet in aanmerking, ook niet als het om een distribuerende ETF gaat. Alleen dividenden van individuele aandelen tellen mee.',
        ]],
        ['Kan je de buitenlandse bronheffing terugkrijgen?', [
          'Niet via je Belgische aangifte: als particulier kan je de buitenlandse bronheffing niet verrekenen met je Belgische belasting. Bij sommige landen (zoals Zwitserland, Duitsland of Frankrijk) kan je wel een deel terugvragen bij de buitenlandse fiscus, met een verdragsprocedure. Dat is vaak omslachtig en loont vooral bij grotere bedragen.',
          'Voor Amerikaanse aandelen zorgt het W-8BEN-formulier bij je broker ervoor dat er 15% wordt ingehouden in plaats van 30%.',
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
    navMeerwaarde: 'Taxe sur les plus-values', navTob: 'Taxe boursière', navDividend: 'Précompte dividendes', gids: null,
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
    dividend: {
      titel: 'Calculer le précompte mobilier sur vos dividendes',
      intro: 'Calculez combien d\'impôt vous payez sur vos dividendes : la retenue à la source étrangère et le précompte mobilier belge de 30 %. Et combien vous récupérez grâce à l\'exonération de 833 € dans votre déclaration d\'impôt.',
      kop: 'Vos dividendes en 2026', rij: 'Dividende', naam: 'De quelle action ou quel ETF ? (facultatif)', naamPh: 'p. ex. ASML, Microsoft, VHYL',
      herkomst: 'D\'où vient-il ?', bruto: 'Dividende brut', brutoHulp: 'Le montant avant tout impôt, comme sur votre avis de dividende.',
      etfEu: 'ETF ou fonds irlandais ou luxembourgeois', etfUs: 'ETF américain', aandeel: (land) => `Action – ${land}`,
      groepAandelen: 'Actions', groepEtf: 'ETF et fonds',
      personen: 'Au nom de', persoon1: '1 personne', persoon2: '2 personnes (p. ex. couple)',
      personenHulp: 'L\'exonération s\'applique par personne. Si vos placements sont à deux noms, chacun y a droit.',
      voegToe: '+ Ajouter un dividende', verwijder: 'Supprimer', voorbeeld: 'Remplir un exemple',
      rijNetto: (n, b) => `Net reçu : ${n} (${b} d'impôt)`, rijLeeg: 'Saisissez le montant brut',
      res: {
        kop: 'Votre résultat', bruto: 'Dividende brut', buitenland: 'Retenue à la source étrangère', rv: 'Précompte mobilier belge (30 %)',
        netto: 'Net reçu', terug: 'Récupéré via votre déclaration', nettoNa: 'Net après remboursement', druk: (p) => `Impôt total : ${p} de votre dividende brut`,
        aangifte: (rv) => `Dans votre déclaration d'impôt, cadre VII, code 1437 (partenaire : 2437), indiquez ${rv} : le précompte mobilier retenu sur vos dividendes d'actions, jusqu'au maximum.`,
        enkelEtf: 'Les dividendes d\'ETF et de fonds ne donnent pas droit à l\'exonération : seuls les dividendes d\'actions comptent.',
        leeg: 'Remplissez au moins un dividende ci-dessus.',
      },
      uitleg: [
        ['Comment les dividendes sont-ils imposés en Belgique ?', [
          'Sur chaque dividende, votre banque ou courtier retient 30 % de précompte mobilier. Si le dividende vient de l\'étranger, le pays de l\'entreprise a d\'abord retenu une partie : la retenue à la source étrangère. Les 30 % belges sont calculés sur ce qui reste.',
          'Un exemple : sur un dividende américain de 100 €, les États-Unis retiennent d\'abord 15 % (15 €). Sur les 85 € restants, vous payez 30 % en Belgique (25,50 €). Il vous reste 59,50 € : un impôt total de 40,5 %.',
        ]],
        ['L\'exonération de 833 € : de l\'argent à récupérer', [
          'Les premiers 833 € de dividendes d\'actions par personne sont exonérés (revenus 2026). Comme votre banque retient quand même 30 %, vous les récupérez via votre déclaration d\'impôt : au maximum 249,90 € par personne.',
          'Dans le cadre VII, code 1437, vous indiquez le montant du précompte mobilier retenu (et non le dividende brut). Beaucoup d\'investisseurs l\'oublient et laissent ainsi de l\'argent chaque année.',
        ]],
        ['L\'exonération vaut-elle pour les ETF ?', [
          'Non. Les distributions d\'ETF et de fonds d\'investissement n\'y donnent pas droit, même pour un ETF de distribution. Seuls les dividendes d\'actions individuelles comptent.',
        ]],
        ['Peut-on récupérer la retenue à la source étrangère ?', [
          'Pas via votre déclaration belge : en tant que particulier, vous ne pouvez pas imputer la retenue étrangère sur votre impôt belge. Pour certains pays (comme la Suisse, l\'Allemagne ou la France), vous pouvez récupérer une partie auprès du fisc étranger via une procédure conventionnelle. C\'est souvent laborieux et surtout intéressant pour de gros montants.',
          'Pour les actions américaines, le formulaire W-8BEN chez votre courtier limite la retenue à 15 % au lieu de 30 %.',
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
  .rh-grid-2 { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 14px; }
  .rh select.rh-veld { appearance: auto; padding-right: 8px; }
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
    .rh-grid-3, .rh-grid-2 { grid-template-columns: 1fr; }
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
          <a href={PAD[taal].dividend} aria-current={soort === 'dividend' ? 'page' : undefined}>{t.navDividend}</a>
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
          <a href={PAD[taal].dividend} style={{ color: GRIJS }}>{t.navDividend}</a>
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

let divNummer = 1;
const legeDiv = (herkomst = 'US') => ({ id: divNummer++, naam: '', herkomst, bruto: '' });

function Dividend({ taal }) {
  const t = T[taal].dividend;
  const eur = (x) => new Intl.NumberFormat(T[taal].locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
  const pct = (x) => new Intl.NumberFormat(T[taal].locale, { style: 'percent', maximumFractionDigits: 1 }).format(x);
  const [rijen, setRijen] = useState(() => [legeDiv()]);
  const [personen, setPersonen] = useState(1);
  const r = berekenDividend(rijen, personen);
  const zet = (id, veld, waarde) => setRijen(rs => rs.map(x => x.id === id ? { ...x, [veld]: waarde } : x));
  const landNaam = (code) => taal === 'fr' ? LAND_FR[code] : PER_LAND[code]?.land;
  const voorbeeld = () => setRijen([
    { id: divNummer++, naam: 'Microsoft', herkomst: 'US', bruto: '180' },
    { id: divNummer++, naam: 'KBC', herkomst: 'BE', bruto: '420' },
    { id: divNummer++, naam: 'ASML', herkomst: 'NL', bruto: '150' },
    { id: divNummer++, naam: 'VHYL', herkomst: 'ETF_EU', bruto: '300' },
  ]);

  return (
    <>
      <Hero t={{ ...t, eyebrow: T[taal].eyebrow }} />
      <section className="rh-sectie">
        <div className="rh-hoofd">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>{t.kop}</h2>
              <button type="button" className="rh-knop rh-knop-licht" onClick={voorbeeld}>{t.voorbeeld}</button>
            </div>
            {rijen.map((rij, i) => {
              const res = r.per[i];
              return (
                <div key={rij.id} style={kaart}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
                    <strong style={{ fontSize: 16 }}>{t.rij} {i + 1}</strong>
                    {rijen.length > 1 && <button type="button" onClick={() => setRijen(rs => rs.filter(x => x.id !== rij.id))} style={{ background: 'none', border: 'none', color: ROOD, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>{t.verwijder}</button>}
                  </div>
                  <label className="rh-label" htmlFor={`dn-${rij.id}`}>{t.naam}</label>
                  <input id={`dn-${rij.id}`} className="rh-veld" value={rij.naam} placeholder={t.naamPh} onChange={e => zet(rij.id, 'naam', e.target.value)} />
                  <div className="rh-grid-2" style={{ marginTop: 14 }}>
                    <div>
                      <label className="rh-label" htmlFor={`dh-${rij.id}`}>{t.herkomst}</label>
                      <select id={`dh-${rij.id}`} className="rh-veld" value={rij.herkomst} onChange={e => zet(rij.id, 'herkomst', e.target.value)}>
                        <optgroup label={t.groepAandelen}>
                          {DIV_HERKOMST.filter(c => !c.startsWith('ETF')).map(c => <option key={c} value={c}>{t.aandeel(landNaam(c))} · {pct(PER_LAND[c].tarief)}</option>)}
                        </optgroup>
                        <optgroup label={t.groepEtf}>
                          <option value="ETF_EU">{t.etfEu} · 0%</option>
                          <option value="ETF_US">{t.etfUs} · 15%</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="rh-label" htmlFor={`db-${rij.id}`}>{t.bruto}</label>
                      <input id={`db-${rij.id}`} className="rh-veld" inputMode="decimal" placeholder="€" value={rij.bruto} onChange={e => zet(rij.id, 'bruto', e.target.value)} />
                    </div>
                  </div>
                  <div className="rh-hulp">{t.brutoHulp}</div>
                  <div style={{ marginTop: 12, fontSize: 15, fontWeight: 700, color: res ? INKT : '#6b6e75' }}>
                    {res ? t.rijNetto(eur(res.netto), eur(res.buitenland + res.rv)) : t.rijLeeg}
                  </div>
                </div>
              );
            })}
            <button type="button" className="rh-knop rh-knop-licht" style={{ alignSelf: 'flex-start' }} onClick={() => setRijen(rs => [...rs, legeDiv(rs[rs.length - 1]?.herkomst)])}>{t.voegToe}</button>
            <div style={kaart}>
              <div className="rh-label">{t.personen}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[[1, t.persoon1], [2, t.persoon2]].map(([n, l]) => (
                  <button key={n} type="button" aria-pressed={personen === n} onClick={() => setPersonen(n)} style={{ flex: 1, minHeight: 42, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: personen === n ? INKT : '#fff', color: personen === n ? '#fff' : INKT, border: `1px solid ${personen === n ? INKT : '#CFCAC0'}` }}>{l}</button>
                ))}
              </div>
              <div className="rh-hulp">{t.personenHulp}</div>
            </div>
          </div>

          {r.ingevuld && <a href="#resultaat" className="rh-gsm-balk"><span>{t.res.terug}: {eur(r.terug)}</span><span aria-hidden="true">↓</span></a>}
          <div id="resultaat" className="rh-sticky" style={{ ...kaart, padding: 28 }} aria-live="polite">
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>{t.res.kop}</h2>
            {!r.ingevuld ? <p style={{ color: GRIJS, margin: 0 }}>{t.res.leeg}</p> : (
              <>
                <Regel label={t.res.bruto} waarde={eur(r.bruto)} />
                <Regel label={t.res.buitenland} waarde={'− ' + eur(r.buitenland)} kleur={r.buitenland > 0 ? ROOD : undefined} />
                <Regel label={t.res.rv} waarde={'− ' + eur(r.rv)} kleur={ROOD} />
                <Regel label={t.res.netto} waarde={eur(r.netto)} vet />
                <Regel label={t.res.terug} waarde={'+ ' + eur(r.terug)} kleur={GROEN} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 18 }}>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{t.res.nettoNa}</span>
                  <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{eur(r.nettoNa)}</span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: GRIJS }}>{t.res.druk(pct(r.druk))}</p>
                {r.terug > 0 ? (
                  <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 14, lineHeight: 1.55, color: '#14532d' }}>{t.res.aangifte(eur(r.terug))}</div>
                  </div>
                ) : r.enkelEtf ? (
                  <p style={{ margin: '14px 0 0', fontSize: 14, color: GRIJS }}>{t.res.enkelEtf}</p>
                ) : null}
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
      {soort === 'tob' ? <Tob taal={taal} /> : soort === 'dividend' ? <Dividend taal={taal} /> : <Meerwaarde taal={taal} />}
    </Kader>
  );
}
