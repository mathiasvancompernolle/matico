import React, { useState } from 'react';
import { Search, Loader, TrendingUp, TrendingDown, Minus, ArrowRight, ArrowLeft } from 'lucide-react';

// ── Scoringslogica — apart voor aandelen/ETF's en crypto ────────────────────
// Elke stap geeft een score op 10, met een korte, mensleesbare toelichting.
// Dit is een gestructureerde, heuristische kijk op de cijfers — geen
// professioneel beleggingsadvies.

// ── Sectorgevoelige drempelwaarden ──────────────────────────────────────────
// Gebaseerd op opgezochte, actuele gemiddeldes (medio 2026) uit meerdere
// financiële-databronnen (Siblis Research, FullRatio, Eqvista, Wisesheets,
// CSIMarket, e.a.). Vaste vuistregels per sector — geen live sectorgemiddelde
// (dat zou te veel extra API-aanroepen vergen) maar wel duidelijk beter dan
// één en dezelfde drempel voor alle sectoren door elkaar.
const SECTOR_DREMPELS = {
  technologie: { naam: 'Technologie / Communicatie', pe: [20, 40], schuld: [0.3, 0.7], dividendVerwacht: false, dividendDrempels: [2, 4] },
  financieel:  { naam: 'Financieel / Banken', pe: [10, 18], schuld: null, dividendVerwacht: true, dividendDrempels: [2, 4] },
  nutsbedrijf: { naam: 'Nutsbedrijf', pe: [14, 22], schuld: [1.0, 2.5], dividendVerwacht: true, dividendDrempels: [3, 5] },
  vastgoed:    { naam: 'Vastgoed (REIT)', pe: [15, 30], schuld: [1.0, 2.5], dividendVerwacht: true, dividendDrempels: [4, 7] },
  energie:     { naam: 'Energie / Materialen', pe: [10, 18], schuld: [0.4, 1.0], dividendVerwacht: true, dividendDrempels: [3, 6] },
  default:     { naam: 'Consument / Industrie / Gezondheidszorg', pe: [15, 25], schuld: [0.5, 1.5], dividendVerwacht: false, dividendDrempels: [2, 3.5] },
};

// ── Handmatige invoer: eerst een 5-staps screening, dan pas de volledige
// analyse ────────────────────────────────────────────────────────────────
// Vervangt de jaarrekening-upload (PDF + AI-extractie). De gebruiker zoekt
// de cijfers zelf op (bv. via de jaarrekening, of sites zoals
// stockanalysis.com/macrotrends.net) en geeft ze hier één voor één in.
// Elke screening-stap kan de analyse meteen stopzetten met een duidelijke
// melding — pas als alle 5 slagen, gaat het door naar de bestaande,
// uitgebreide Lange-termijn/Korte-termijn-scoring.
const GATE_TITELS = {
  A: '1. Omzetgroei (minstens 10% per jaar)',
  B: '2. K/W-ratio (Price/Earnings, onder 25)',
  C: '3. PEG-ratio (Price/Earnings to Growth, onder 2)',
  D: '4. Rendement op eigen vermogen — laatste 5 boekjaren (gemiddeld minstens 5%)',
  E: '5. Quick ratio (boven 1,5)',
};

const SCREENING_VELDEN = [
  { gate: 'A', key: 'omzetHuidig', label: 'Omzet — meest recente boekjaar', hint: 'Totale omzet ("revenue" / "net sales") van het laatste volledige boekjaar.' },
  { gate: 'A', key: 'omzetVorig', label: 'Omzet — boekjaar ervoor', hint: 'Zelfde cijfer van het jaar dáárvoor — nodig om de omzetgroei te berekenen.' },
  { gate: 'B', key: 'nettoWinst', label: 'Netto winst — meest recente boekjaar', hint: '"Net income" van het laatste boekjaar. Vul een negatief getal in bij verlies.' },
  { gate: 'B', key: 'aantalAandelenUitstaand', label: 'Aantal uitstaande aandelen', hint: '"Diluted weighted average shares outstanding" — bovenaan de winst-en-verliesrekening.' },
  { gate: 'C', key: 'nettoWinstVorig', label: 'Netto winst — boekjaar ervoor', hint: '"Net income" van het jaar vóór het meest recente boekjaar — nodig om de winstgroei (voor de PEG-ratio) te berekenen.' },
  { gate: 'D', key: 'eigenVermogen', label: 'Eigen vermogen — jaar 1 (meest recente boekjaar)', hint: '"Total stockholders\' equity" op de balans van het laatste boekjaar.' },
  { gate: 'D', key: 'eigenVermogenVorig', label: 'Eigen vermogen — jaar 2', hint: '"Total stockholders\' equity" van het jaar daarvóór.' },
  { gate: 'D', key: 'nettoWinstJaar3', label: 'Netto winst — jaar 3', hint: '"Net income" van 2 boekjaren geleden.' },
  { gate: 'D', key: 'eigenVermogenJaar3', label: 'Eigen vermogen — jaar 3', hint: '"Total stockholders\' equity" van 2 boekjaren geleden.' },
  { gate: 'D', key: 'nettoWinstJaar4', label: 'Netto winst — jaar 4', hint: '"Net income" van 3 boekjaren geleden.' },
  { gate: 'D', key: 'eigenVermogenJaar4', label: 'Eigen vermogen — jaar 4', hint: '"Total stockholders\' equity" van 3 boekjaren geleden.' },
  { gate: 'D', key: 'nettoWinstJaar5', label: 'Netto winst — jaar 5 (oudste boekjaar)', hint: '"Net income" van 4 boekjaren geleden.' },
  { gate: 'D', key: 'eigenVermogenJaar5', label: 'Eigen vermogen — jaar 5 (oudste boekjaar)', hint: '"Total stockholders\' equity" van 4 boekjaren geleden.' },
  { gate: 'E', key: 'kortlopendeActiva', label: 'Kortlopende activa', hint: '"Total current assets" op de balans, meest recente boekjaar.' },
  { gate: 'E', key: 'voorraden', label: 'Voorraden', hint: '"Inventories" op de balans, meest recente boekjaar.' },
  { gate: 'E', key: 'kortlopendeSchulden', label: 'Kortlopende schulden', hint: '"Total current liabilities" op de balans, meest recente boekjaar.' },
];

// Cijfers die pas ná een geslaagde screening nog nodig zijn voor de
// bestaande, uitgebreide scoring (alles daarvoor is dan al gevraagd).
const VERVOLG_VELDEN = [
  { key: 'totaleSchulden', label: 'Totale schulden', hint: '"Total liabilities" op de balans, meest recente boekjaar.' },
  { key: 'dividendenBetaald', label: 'Totaal uitgekeerd dividend', hint: 'Totaal bedrag aan dividenden uitgekeerd dit boekjaar. Vul 0 in als er geen dividend is.' },
];

function evalGateA(c) {
  if (c.omzetHuidig == null || !c.omzetVorig) return { geslaagd: false, waarde: null, tekst: 'Onvoldoende gegevens om de omzetgroei te berekenen.' };
  const groei = ((c.omzetHuidig - c.omzetVorig) / c.omzetVorig) * 100;
  const geslaagd = groei >= 10;
  return { geslaagd, waarde: groei, tekst: geslaagd
    ? `Omzet groeide ${groei.toFixed(1)}% t.o.v. vorig jaar — voldoet aan de drempel van minstens 10% per jaar.`
    : `Omzet groeide slechts ${groei.toFixed(1)}% t.o.v. vorig jaar — dat is minder dan de vereiste 10% per jaar. Dit is op dit moment geen goed effect om in te beleggen.` };
}

function evalGateB(c, huidigeKoers) {
  const eps = c.aantalAandelenUitstaand ? c.nettoWinst / c.aantalAandelenUitstaand : null;
  const pe = (eps != null && eps > 0 && huidigeKoers) ? huidigeKoers / eps : null;
  if (pe == null) return { geslaagd: false, waarde: null, tekst: 'Kon de K/W-ratio niet berekenen (negatieve of ontbrekende winst per aandeel). Dit is op dit moment geen goed effect om in te beleggen.' };
  const geslaagd = pe < 25;
  return { geslaagd, waarde: pe, tekst: geslaagd
    ? `K/W-ratio van ${pe.toFixed(1)} — onder de drempel van 25.`
    : `K/W-ratio van ${pe.toFixed(1)} — dat is 25 of hoger. Dit aandeel is mogelijks overgewaardeerd en het is op dit moment niet slim om hierin te beleggen.` };
}

function evalGateC(c, peWaarde) {
  const epsHuidig = c.aantalAandelenUitstaand ? c.nettoWinst / c.aantalAandelenUitstaand : null;
  const epsVorig = c.aantalAandelenUitstaand ? c.nettoWinstVorig / c.aantalAandelenUitstaand : null;
  const groeiPct = (epsVorig != null && epsVorig > 0 && epsHuidig != null) ? ((epsHuidig - epsVorig) / epsVorig) * 100 : null;
  const peg = (groeiPct != null && groeiPct > 0 && peWaarde != null) ? peWaarde / groeiPct : null;
  if (peg == null) return { geslaagd: false, waarde: null, tekst: 'Kon de PEG-ratio niet berekenen (de winst per aandeel groeide niet t.o.v. vorig jaar). Dit is op dit moment geen goed effect om in te beleggen.' };
  const geslaagd = peg < 2;
  return { geslaagd, waarde: peg, tekst: geslaagd
    ? `PEG-ratio van ${peg.toFixed(2)} — onder de drempel van 2, de waardering houdt gelijke tred met de winstgroei.`
    : `PEG-ratio van ${peg.toFixed(2)} — dat is 2 of hoger. Je betaalt een stevige premie voor de groei, dus dit is op dit moment niet interessant om in te beleggen.` };
}

function evalGateD(c) {
  const jaren = [
    { netto: c.nettoWinst, eigen: c.eigenVermogen },
    { netto: c.nettoWinstVorig, eigen: c.eigenVermogenVorig },
    { netto: c.nettoWinstJaar3, eigen: c.eigenVermogenJaar3 },
    { netto: c.nettoWinstJaar4, eigen: c.eigenVermogenJaar4 },
    { netto: c.nettoWinstJaar5, eigen: c.eigenVermogenJaar5 },
  ];
  const roes = jaren.map(j => (j.netto != null && j.eigen) ? (j.netto / j.eigen) * 100 : null).filter(v => v != null);
  if (roes.length === 0) return { geslaagd: false, waarde: null, tekst: 'Kon het rendement op eigen vermogen niet berekenen.' };
  const gemiddeld = roes.reduce((s, v) => s + v, 0) / roes.length;
  const geslaagd = gemiddeld >= 5;
  return { geslaagd, waarde: gemiddeld, tekst: geslaagd
    ? `Gemiddeld rendement op eigen vermogen van ${gemiddeld.toFixed(1)}% over de laatste ${roes.length} boekjaren — goede winstmarges.`
    : `Gemiddeld rendement op eigen vermogen van slechts ${gemiddeld.toFixed(1)}% over de laatste ${roes.length} boekjaren — dat is onder de drempel van 5%. De winstmarges zijn niet zo goed, en het is op dit moment niet slim om hierin te beleggen.` };
}

function evalGateE(c) {
  const quick = c.kortlopendeSchulden ? (c.kortlopendeActiva - c.voorraden) / c.kortlopendeSchulden : null;
  if (quick == null) return { geslaagd: false, waarde: null, tekst: 'Kon de quick ratio niet berekenen.' };
  const geslaagd = quick > 1.5;
  return { geslaagd, waarde: quick, tekst: geslaagd
    ? `Quick ratio van ${quick.toFixed(2)} — boven 1,5, het bedrijf kan zijn kortlopende rekeningen goed betalen.`
    : `Quick ratio van ${quick.toFixed(2)} — 1,5 of lager. Het bedrijf kan zijn kortlopende rekeningen mogelijks niet goed betalen, dus het is op dit moment niet slim om hierin te beleggen.` };
}

// Evalueert een gate op basis van de tot dusver ingegeven cijfers + context
// (huidige koers, en het resultaat van voorgaande gates waar nodig — de PEG
// heeft bv. de K/W-ratio uit gate B nodig).
function evalueerGate(gateId, cijfers, ctx) {
  if (gateId === 'A') return evalGateA(cijfers);
  if (gateId === 'B') return evalGateB(cijfers, ctx.huidigeKoers);
  if (gateId === 'C') return evalGateC(cijfers, ctx.gateResultaten.B?.waarde);
  if (gateId === 'D') return evalGateD(cijfers);
  if (gateId === 'E') return evalGateE(cijfers);
  return { geslaagd: false, waarde: null, tekst: 'Onbekende screeningstap.' };
}

// Zet de ruwe, handmatig ingevoerde cijfers om naar dezelfde afgeleide
// ratio's die de rest van de scoringslogica verwacht (identiek aan de
// berekening die vroeger na de PDF-extractie gebeurde).
function berekenRatiosUitRuweCijfers(c, sector, huidigeKoers) {
  const eps = (c.nettoWinst != null && c.aantalAandelenUitstaand) ? c.nettoWinst / c.aantalAandelenUitstaand : null;
  const dividendPerAandeel = (c.dividendenBetaald != null && c.aantalAandelenUitstaand) ? c.dividendenBetaald / c.aantalAandelenUitstaand : null;
  return {
    sector: sector || null,
    peRatio: (eps != null && eps > 0 && huidigeKoers) ? huidigeKoers / eps : null,
    profitMargin: (c.nettoWinst != null && c.omzetHuidig) ? c.nettoWinst / c.omzetHuidig : null,
    returnOnEquity: (c.nettoWinst != null && c.eigenVermogen) ? c.nettoWinst / c.eigenVermogen : null,
    debtToEquity: (c.totaleSchulden != null && c.eigenVermogen) ? c.totaleSchulden / c.eigenVermogen : null,
    revenueGrowthYoY: (c.omzetHuidig != null && c.omzetVorig) ? (c.omzetHuidig - c.omzetVorig) / c.omzetVorig : null,
    dividendYield: (dividendPerAandeel != null && huidigeKoers) ? dividendPerAandeel / huidigeKoers : null,
    payoutRatio: (c.dividendenBetaald != null && c.nettoWinst) ? c.dividendenBetaald / c.nettoWinst : null,
  };
}

function bepaalSectorCategorie(sector) {
  const s = (sector || '').toLowerCase();
  if (s.includes('technology') || s.includes('communication')) return 'technologie';
  if (s.includes('financial') || s.includes('bank')) return 'financieel';
  if (s.includes('utilit')) return 'nutsbedrijf';
  if (s.includes('real estate') || s.includes('reit')) return 'vastgoed';
  if (s.includes('energy') || s.includes('material')) return 'energie';
  return 'default';
}

// ── Lange termijn: waardering, fundamentele gezondheid, dividend ──────────
function scoreAandeelLangeTermijn(f) {
  const categorie = bepaalSectorCategorie(f.sector);
  const drempels = SECTOR_DREMPELS[categorie];
  const stappen = [];

  // 1. Waardering (K/W-ratio), sectorgevoelig
  const pe = f.peRatio;
  let peScore = 5, peTekst = `Geen K/W-ratio beschikbaar voor dit effect.`;
  if (pe != null && pe > 0) {
    const [laagDrempel, hoogDrempel] = drempels.pe;
    if (pe < laagDrempel) { peScore = 9; peTekst = `K/W van ${pe.toFixed(1)} is laag voor de sector "${drempels.naam}" (typisch ${laagDrempel}-${hoogDrempel}) — relatief goedkoop.`; }
    else if (pe < hoogDrempel) { peScore = 6; peTekst = `K/W van ${pe.toFixed(1)} zit in het normale bereik voor "${drempels.naam}" (typisch ${laagDrempel}-${hoogDrempel}).`; }
    else { peScore = 3; peTekst = `K/W van ${pe.toFixed(1)} is hoog voor de sector "${drempels.naam}" (typisch ${laagDrempel}-${hoogDrempel}) — duur, of de markt verwacht veel groei.`; }
  }
  stappen.push({ titel: 'Waardering', sub: `Koers/Winst-verhouding (sector: ${drempels.naam})`, score: peScore, toelichting: peTekst });

  // 2. Groei
  const groei = f.revenueGrowthYoY;
  let groeiScore = 5, groeiTekst = 'Geen recente omzetgroei-cijfers beschikbaar.';
  if (groei != null) {
    const pct = groei * 100;
    if (pct > 15) { groeiScore = 9; groeiTekst = `Omzet groeide ${pct.toFixed(1)}% t.o.v. vorig jaar — sterke groei.`; }
    else if (pct > 5) { groeiScore = 6; groeiTekst = `Omzet groeide ${pct.toFixed(1)}% — degelijke, gematigde groei.`; }
    else if (pct >= 0) { groeiScore = 4; groeiTekst = `Omzet groeide slechts ${pct.toFixed(1)}% — trage groei.`; }
    else { groeiScore = 2; groeiTekst = `Omzet daalde met ${Math.abs(pct).toFixed(1)}% — krimpend bedrijf.`; }
  }
  stappen.push({ titel: 'Groei', sub: 'Omzetgroei (jaar-op-jaar)', score: groeiScore, toelichting: groeiTekst });

  // 3. Winstgevendheid
  const marge = f.profitMargin, roe = f.returnOnEquity;
  let winstScore = 5, winstTekst = 'Geen winstgevendheids-cijfers beschikbaar.';
  if (marge != null || roe != null) {
    const margePct = marge != null ? marge * 100 : null;
    const roePct = roe != null ? roe * 100 : null;
    const delen = [margePct != null ? `winstmarge ${margePct.toFixed(1)}%` : null, roePct != null ? `rendement op eigen vermogen ${roePct.toFixed(1)}%` : null].filter(Boolean);
    const gemiddeld = [margePct, roePct].filter(v => v != null).reduce((s, v) => s + v, 0) / [margePct, roePct].filter(v => v != null).length;
    if (gemiddeld > 15) { winstScore = 9; winstTekst = `Sterk winstgevend (${delen.join(', ')}).`; }
    else if (gemiddeld > 5) { winstScore = 6; winstTekst = `Gemiddeld winstgevend (${delen.join(', ')}).`; }
    else if (gemiddeld >= 0) { winstScore = 4; winstTekst = `Zwak winstgevend (${delen.join(', ')}).`; }
    else { winstScore = 1; winstTekst = `Verlieslatend (${delen.join(', ')}).`; }
  }
  stappen.push({ titel: 'Winstgevendheid', sub: 'Winstmarge & rendement op eigen vermogen', score: winstScore, toelichting: winstTekst });

  // 4. Financiële gezondheid (schuldgraad) — sectorgevoelig, overgeslagen bij
  // banken/financiële instellingen: hun "schuld" bestaat grotendeels uit
  // klantendeposito's en is fundamenteel niet vergelijkbaar met een gewoon
  // bedrijf. Bij hen zeggen kapitaalratio's (die we hier niet ophalen) meer.
  if (drempels.schuld) {
    const dte = f.debtToEquity;
    const [laagDrempel, hoogDrempel] = drempels.schuld;
    let schuldScore = 5, schuldTekst = 'Geen schuldgraad-cijfers beschikbaar.';
    if (dte != null) {
      if (dte < laagDrempel) { schuldScore = 9; schuldTekst = `Schuldgraad van ${dte.toFixed(2)} is laag voor "${drempels.naam}" (typisch ${laagDrempel}-${hoogDrempel}) — financieel gezond.`; }
      else if (dte < hoogDrempel) { schuldScore = 6; schuldTekst = `Schuldgraad van ${dte.toFixed(2)} is normaal voor deze sector (typisch ${laagDrempel}-${hoogDrempel}).`; }
      else { schuldScore = 3; schuldTekst = `Schuldgraad van ${dte.toFixed(2)} is hoog, zelfs voor "${drempels.naam}" (typisch ${laagDrempel}-${hoogDrempel}) — meer financieel risico.`; }
    }
    stappen.push({ titel: 'Financiële gezondheid', sub: `Schuldgraad (sector: ${drempels.naam})`, score: schuldScore, toelichting: schuldTekst });
  } else {
    stappen.push({ titel: 'Financiële gezondheid', sub: 'Schuldgraad', score: null, toelichting: `Overgeslagen voor de sector "${drempels.naam}": schulden bij banken/financiële instellingen bestaan grotendeels uit klantendeposito's en zijn niet vergelijkbaar met een gewoon bedrijf. Kapitaalratio's zouden hier een beter, maar hier niet opgehaald, criterium zijn.` });
  }

  // 5. Dividend — sectorgevoelig (bij tech is geen dividend normaal, bij
  // nutsbedrijven/REIT's wordt een stevig dividend net verwacht)
  const div = f.dividendYield, payout = f.payoutRatio;
  const [divLaag, divHoog] = drempels.dividendDrempels;
  let divScore = 5, divTekst;
  if (div == null || div === 0) {
    divTekst = drempels.dividendVerwacht
      ? `Geen dividend, terwijl dat in de sector "${drempels.naam}" net gebruikelijk is (typisch ${divLaag}-${divHoog}%) — opvallend, de moeite waard om na te gaan waarom.`
      : `Geen (of geen gekend) dividend — niet ongewoon voor "${drempels.naam}", vaak het geval bij groeibedrijven.`;
    divScore = drempels.dividendVerwacht ? 4 : 5;
  } else {
    const divPct = div * 100;
    const payoutPct = payout != null ? payout * 100 : null;
    const payoutDrempel = (categorie === 'nutsbedrijf' || categorie === 'vastgoed') ? 85 : 70; // REIT's/nutsbedrijven keren wettelijk/gebruikelijk meer uit
    if (divPct >= divLaag && (payoutPct == null || payoutPct < payoutDrempel)) { divScore = 9; divTekst = `Dividendrendement van ${divPct.toFixed(2)}% past bij (of overtreft) wat gebruikelijk is voor "${drempels.naam}" (typisch ${divLaag}-${divHoog}%), met een houdbare uitkeringsratio.`; }
    else if (payoutPct != null && payoutPct > 95) { divScore = 3; divTekst = `Dividendrendement van ${divPct.toFixed(2)}%, maar een erg hoge uitkeringsratio (${payoutPct.toFixed(0)}%) — risico op verlaging.`; }
    else { divScore = 6; divTekst = `Dividendrendement van ${divPct.toFixed(2)}% (sectortypisch: ${divLaag}-${divHoog}%).`; }
  }
  stappen.push({ titel: 'Dividend', sub: `Dividendrendement & uitkeringsratio (sector: ${drempels.naam})`, score: divScore, toelichting: divTekst });

  return stappen.filter(s => s.score !== null || s.toelichting); // "overgeslagen" stap blijft zichtbaar met uitleg, telt niet mee in het totaal
}

// ── Korte termijn: momentum ─────────────────────────────────────────────────
function scoreAandeelKorteTermijn(f, koers) {
  const stappen = [];

  // 1. Positie t.o.v. 52-weken bereik
  const hoog = f.weekHigh52, laag = f.weekLow52, huidig = koers;
  let momScore = 5, momTekst = 'Geen 52-weken-bereik beschikbaar.';
  if (hoog != null && laag != null && huidig != null && hoog > laag) {
    const positie = ((huidig - laag) / (hoog - laag)) * 100;
    if (positie > 80) { momScore = 7; momTekst = `Koers staat op ${positie.toFixed(0)}% van het 52-weken-bereik — dicht bij de jaarpiek, sterk momentum maar mogelijk duurder.`; }
    else if (positie > 40) { momScore = 6; momTekst = `Koers staat op ${positie.toFixed(0)}% van het 52-weken-bereik — neutrale positie.`; }
    else { momScore = 5; momTekst = `Koers staat op ${positie.toFixed(0)}% van het 52-weken-bereik — dicht bij het jaardal. Kan een koopkans zijn, of wijzen op een neerwaartse trend.`; }
  }
  stappen.push({ titel: 'Jaarbereik', sub: 'Koers t.o.v. 52-weken hoog/laag', score: momScore, toelichting: momTekst });

  // 2. Koers t.o.v. 50-daags en 200-daags voortschrijdend gemiddelde
  const ma50 = f.gemiddelde50d, ma200 = f.gemiddelde200d;
  let trendScore = 5, trendTekst = 'Geen voortschrijdende-gemiddeldes beschikbaar.';
  if (ma50 != null && ma200 != null && huidig != null) {
    const bovenBeide = huidig > ma50 && huidig > ma200;
    const onderBeide = huidig < ma50 && huidig < ma200;
    if (bovenBeide) { trendScore = 8; trendTekst = `Koers staat boven zowel het 50-daags als het 200-daags gemiddelde — opwaartse trend.`; }
    else if (onderBeide) { trendScore = 3; trendTekst = `Koers staat onder zowel het 50-daags als het 200-daags gemiddelde — neerwaartse trend.`; }
    else { trendScore = 5; trendTekst = `Koers zit tussen het 50-daags en 200-daags gemiddelde in — gemengd signaal, geen duidelijke trend.`; }
  }
  stappen.push({ titel: 'Trend', sub: 'Koers t.o.v. 50- en 200-daags gemiddelde', score: trendScore, toelichting: trendTekst });

  return stappen;
}

function scoreCrypto(c) {
  const stappen = [];

  // 1. Marktkapitalisatie & rang
  const rank = c.marketCapRank;
  let rankScore = 3, rankTekst = 'Marktkapitalisatie-rangschikking niet beschikbaar.';
  if (rank != null) {
    if (rank <= 10) { rankScore = 9; rankTekst = `Rang #${rank} — een van de meest gevestigde cryptomunten.`; }
    else if (rank <= 50) { rankScore = 7; rankTekst = `Rang #${rank} — gevestigde, bekende munt.`; }
    else if (rank <= 200) { rankScore = 5; rankTekst = `Rang #${rank} — kleinere, meer speculatieve munt.`; }
    else { rankScore = 3; rankTekst = `Rang #${rank} — erg kleine, risicovolle munt.`; }
  }
  stappen.push({ titel: 'Marktkapitalisatie', sub: 'Rangschikking t.o.v. andere cryptomunten', score: rankScore, toelichting: rankTekst });

  // 2. Prijsmomentum t.o.v. all-time high
  const ath = c.athChangePercentage;
  let athScore = 5, athTekst = 'Geen gegevens over de vorige piekkoers (ATH) beschikbaar.';
  if (ath != null) {
    const afstand = Math.abs(ath);
    if (afstand < 20) { athScore = 6; athTekst = `Slechts ${afstand.toFixed(0)}% onder de vorige piekkoers — dicht bij een all-time high, sterk momentum maar mogelijk duur.`; }
    else if (afstand < 50) { athScore = 7; athTekst = `${afstand.toFixed(0)}% onder de vorige piekkoers — gezonde correctie.`; }
    else if (afstand < 80) { athScore = 6; athTekst = `${afstand.toFixed(0)}% onder de vorige piekkoers — stevige daling.`; }
    else { athScore = 4; athTekst = `${afstand.toFixed(0)}% onder de vorige piekkoers — kan wijzen op blijvend verlies van vertrouwen, of net een kans.`; }
  }
  stappen.push({ titel: 'Prijsmomentum', sub: 'Afstand t.o.v. vorige piekkoers (ATH)', score: athScore, toelichting: athTekst });

  // 3. Volume/liquiditeit
  const volRatio = (c.totalVolume != null && c.marketCap) ? (c.totalVolume / c.marketCap) * 100 : null;
  let volScore = 5, volTekst = 'Geen volume-/liquiditeitsgegevens beschikbaar.';
  if (volRatio != null) {
    if (volRatio > 10) { volScore = 9; volTekst = `Dagvolume is ${volRatio.toFixed(1)}% van de marktkapitalisatie — zeer liquide.`; }
    else if (volRatio > 3) { volScore = 7; volTekst = `Dagvolume is ${volRatio.toFixed(1)}% van de marktkapitalisatie — degelijk verhandelbaar.`; }
    else if (volRatio > 1) { volScore = 5; volTekst = `Dagvolume is ${volRatio.toFixed(1)}% van de marktkapitalisatie — matige liquiditeit.`; }
    else { volScore = 3; volTekst = `Dagvolume is slechts ${volRatio.toFixed(1)}% van de marktkapitalisatie — weinig verhandeld, kan lastig zijn om snel te (ver)kopen.`; }
  }
  stappen.push({ titel: 'Liquiditeit', sub: 'Dagvolume t.o.v. marktkapitalisatie', score: volScore, toelichting: volTekst });

  // 4. Recente trend
  const trend7d = c.priceChange7d, trend30d = c.priceChange30d;
  let trendScore = 5, trendTekst = 'Geen recente prijstrend beschikbaar.';
  if (trend7d != null || trend30d != null) {
    const gemiddeld = [trend7d, trend30d].filter(v => v != null).reduce((s, v) => s + v, 0) / [trend7d, trend30d].filter(v => v != null).length;
    const delen = [trend7d != null ? `7d: ${trend7d >= 0 ? '+' : ''}${trend7d.toFixed(1)}%` : null, trend30d != null ? `30d: ${trend30d >= 0 ? '+' : ''}${trend30d.toFixed(1)}%` : null].filter(Boolean);
    if (gemiddeld > 10) { trendScore = 8; trendTekst = `Positieve recente trend (${delen.join(', ')}).`; }
    else if (gemiddeld > 0) { trendScore = 6; trendTekst = `Licht positieve trend (${delen.join(', ')}).`; }
    else if (gemiddeld > -10) { trendScore = 4; trendTekst = `Licht negatieve trend (${delen.join(', ')}).`; }
    else { trendScore = 2; trendTekst = `Duidelijk negatieve trend (${delen.join(', ')}).`; }
  }
  stappen.push({ titel: 'Recente trend', sub: 'Prijsverandering over 7 en 30 dagen', score: trendScore, toelichting: trendTekst });

  // 5. Supply-dynamiek
  const circ = c.circulatingSupply, max = c.maxSupply;
  let supplyScore = 5, supplyTekst = 'Geen maximale voorraad ingesteld (geen limiet) — neutraal, wel iets om in het oog te houden.';
  if (max != null && circ != null && max > 0) {
    const ratio = (circ / max) * 100;
    if (ratio > 90) { supplyScore = 8; supplyTekst = `${ratio.toFixed(0)}% van de maximale voorraad is al in omloop — weinig toekomstige verwatering.`; }
    else if (ratio > 50) { supplyScore = 6; supplyTekst = `${ratio.toFixed(0)}% van de maximale voorraad is in omloop.`; }
    else { supplyScore = 4; supplyTekst = `Slechts ${ratio.toFixed(0)}% van de maximale voorraad is in omloop — nog veel toekomstige munten kunnen bijkomen.`; }
  }
  stappen.push({ titel: 'Supply-dynamiek', sub: 'Huidige voorraad t.o.v. maximale voorraad', score: supplyScore, toelichting: supplyTekst });

  // 6. Volatiliteit
  const dag = c.priceChange24h;
  let volaScore = 5, volaTekst = 'Geen recente volatiliteit beschikbaar.';
  if (dag != null) {
    const afw = Math.abs(dag);
    if (afw < 3) { volaScore = 7; volaTekst = `Koers bewoog vandaag ${afw.toFixed(1)}% — relatief rustig.`; }
    else if (afw < 8) { volaScore = 5; volaTekst = `Koers bewoog vandaag ${afw.toFixed(1)}% — gemiddelde volatiliteit.`; }
    else { volaScore = 3; volaTekst = `Koers bewoog vandaag ${afw.toFixed(1)}% — hoge volatiliteit, meer risico op korte termijn.`; }
  }
  stappen.push({ titel: 'Volatiliteit', sub: 'Prijsschommeling over de laatste 24 uur', score: volaScore, toelichting: volaTekst });

  return stappen;
}

function verdict(totaalPct) {
  if (totaalPct >= 70) return { label: 'Koop', kleur: '#059669', achtergrond: '#ecfdf5' };
  if (totaalPct >= 45) return { label: 'Hou', kleur: '#d97706', achtergrond: '#fffbeb' };
  return { label: 'Verkoop', kleur: '#dc2626', achtergrond: '#fef2f2' };
}

function ScoreBadge({ score }) {
  const kleur = score >= 7 ? '#059669' : score >= 5 ? '#d97706' : '#dc2626';
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 10, background: kleur, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 16, flexShrink: 0,
    }}>
      {score}
    </div>
  );
}

function StapKaart({ index, stap }) {
  const overgeslagen = stap.score === null;
  return (
    <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 18, opacity: overgeslagen ? 0.7 : 1 }}>
      {overgeslagen ? (
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-subtle)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
          n.v.t.
        </div>
      ) : (
        <ScoreBadge score={stap.score} />
      )}
      <div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{index + 1}. {stap.titel}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{stap.sub}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{stap.toelichting}</div>
      </div>
    </div>
  );
}

export default function Analyseren() {
  const [zoekQuery, setZoekQuery] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [zoekLoading, setZoekLoading] = useState(false);
  const [gekozen, setGekozen] = useState(null);
  const [stappenLange, setStappenLange] = useState(null);
  const [stappenKorte, setStappenKorte] = useState(null);
  const [isCrypto, setIsCrypto] = useState(false);
  const [laden, setLaden] = useState(false);
  const [voortgang, setVoortgang] = useState('');
  const [fout, setFout] = useState('');

  // Handmatige invoer: fase-machine (aandeel → sector → screening (5 gates,
  // elk kan stoppen) → succes-scherm → vervolgcijfers → volledige score)
  const [handmatigModus, setHandmatigModus] = useState(false);
  const [handmatigFase, setHandmatigFase] = useState('aandeel'); // aandeel | sector | screening | gefaald | succes | vervolg
  const [handmatigSymbool, setHandmatigSymbool] = useState(null);
  const [handmatigZoekQuery, setHandmatigZoekQuery] = useState('');
  const [handmatigZoekResultaten, setHandmatigZoekResultaten] = useState([]);
  const [handmatigSector, setHandmatigSector] = useState('default');
  const [handmatigCijfers, setHandmatigCijfers] = useState({});
  const [handmatigInvoer, setHandmatigInvoer] = useState('');
  const [handmatigVeldIndex, setHandmatigVeldIndex] = useState(0);
  const [handmatigKoers, setHandmatigKoers] = useState(null);
  const [handmatigTechData, setHandmatigTechData] = useState(null);
  const [gateResultaten, setGateResultaten] = useState({});
  const [gefaaldeGate, setGefaaldeGate] = useState(null); // { id, tekst }

  const zoek = async (q) => {
    setZoekQuery(q);
    if (q.length < 2) { setZoekResultaten([]); return; }
    setZoekLoading(true);
    try {
      const res = await fetch(`/api/data?endpoint=search&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setZoekResultaten(data?.resultaten || []);
    } catch (e) { setZoekResultaten([]); }
    setZoekLoading(false);
  };

  const kies = async (r) => {
    setGekozen(r);
    setZoekResultaten([]);
    setZoekQuery('');
    setStappenLange(null);
    setStappenKorte(null);
    setFout('');
    setLaden(true);
    try {
      if (r.type === 'crypto') {
        setIsCrypto(true);
        const res = await fetch(`/api/data?endpoint=analyse-crypto&symbol=${encodeURIComponent(r.symbol)}`);
        const data = await res.json();
        if (Object.keys(data).length === 0) { setFout('Geen cijfers gevonden voor deze munt.'); setLaden(false); return; }
        setStappenKorte(scoreCrypto(data));
      } else {
        setIsCrypto(false);
        const [fRes, qRes] = await Promise.all([
          fetch(`/api/data?endpoint=analyse-aandeel&symbol=${encodeURIComponent(r.symbol)}`),
          fetch(`/api/data?endpoint=quote&symbol=${encodeURIComponent(r.symbol)}`),
        ]);
        const fData = await fRes.json();
        const qData = await qRes.json();
        setStappenLange(scoreAandeelLangeTermijn(fData));
        setStappenKorte(scoreAandeelKorteTermijn(fData, qData?.c));
      }
    } catch (e) {
      setFout('Er ging iets mis bij het ophalen van de cijfers.');
    }
    setLaden(false);
  };

  const zoekHandmatig = async (q) => {
    setHandmatigZoekQuery(q);
    if (q.length < 2) { setHandmatigZoekResultaten([]); return; }
    try {
      const res = await fetch(`/api/data?endpoint=search&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setHandmatigZoekResultaten((data?.resultaten || []).filter(r => r.type !== 'crypto'));
    } catch (e) { setHandmatigZoekResultaten([]); }
  };

  const kiesHandmatigAandeel = (r) => {
    setHandmatigSymbool(r);
    setHandmatigZoekResultaten([]);
    setHandmatigZoekQuery('');
    setHandmatigFase('sector');
  };

  // Sector kiezen start meteen de screening: koers + technische cijfers
  // worden hier één keer opgehaald (nodig voor de K/W-ratio in gate B), en
  // alle screening-state wordt gereset voor het geval er al eerder een
  // andere analyse werd gestart.
  const kiesHandmatigSectorEnStart = async (sector) => {
    setHandmatigSector(sector);
    setHandmatigCijfers({});
    setHandmatigInvoer('');
    setHandmatigVeldIndex(0);
    setGateResultaten({});
    setGefaaldeGate(null);
    setFout('');
    setLaden(true);
    setVoortgang('Huidige koers en technische cijfers ophalen...');
    try {
      const [qRes, techRes] = await Promise.all([
        fetch(`/api/data?endpoint=quote&symbol=${encodeURIComponent(handmatigSymbool.symbol)}`),
        fetch(`/api/data?endpoint=analyse-aandeel&symbol=${encodeURIComponent(handmatigSymbool.symbol)}`),
      ]);
      const qData = await qRes.json();
      const techData = await techRes.json();
      if (!qData?.c) { setFout('Kon de huidige koers niet ophalen — nodig voor de K/W-ratio.'); setLaden(false); return; }
      setHandmatigKoers(qData.c);
      setHandmatigTechData(techData);
      setHandmatigFase('screening');
    } catch (e) {
      setFout(`Kon de koers/technische cijfers niet ophalen: ${e.message}`);
    }
    setVoortgang('');
    setLaden(false);
  };

  const huidigScreeningVeld = SCREENING_VELDEN[handmatigVeldIndex];
  const huidigVervolgVeld = VERVOLG_VELDEN[handmatigVeldIndex];

  const volgendeScreeningVeld = () => {
    if (handmatigInvoer.trim() === '') return;
    const waarde = parseFloat(handmatigInvoer.replace(',', '.'));
    if (Number.isNaN(waarde)) { setFout('Vul een geldig getal in.'); return; }
    setFout('');
    const nieuweCijfers = { ...handmatigCijfers, [huidigScreeningVeld.key]: waarde };
    setHandmatigCijfers(nieuweCijfers);
    setHandmatigInvoer('');

    const volgendVeld = SCREENING_VELDEN[handmatigVeldIndex + 1];
    const isLaatsteVanGate = !volgendVeld || volgendVeld.gate !== huidigScreeningVeld.gate;

    if (!isLaatsteVanGate) {
      setHandmatigVeldIndex(handmatigVeldIndex + 1);
      return;
    }

    // Laatste cijfer van deze gate ingevuld — evalueer meteen
    const resultaat = evalueerGate(huidigScreeningVeld.gate, nieuweCijfers, { huidigeKoers: handmatigKoers, gateResultaten });
    const nieuweGateResultaten = { ...gateResultaten, [huidigScreeningVeld.gate]: resultaat };
    setGateResultaten(nieuweGateResultaten);

    if (!resultaat.geslaagd) {
      setGefaaldeGate({ id: huidigScreeningVeld.gate, tekst: resultaat.tekst });
      setHandmatigFase('gefaald');
    } else if (!volgendVeld) {
      // Dat was gate E, de laatste — alle 5 geslaagd
      setHandmatigFase('succes');
    } else {
      setHandmatigVeldIndex(handmatigVeldIndex + 1);
    }
  };

  const vorigeScreeningVeld = () => {
    setFout('');
    if (handmatigVeldIndex > 0) {
      const vorigVeld = SCREENING_VELDEN[handmatigVeldIndex - 1];
      setHandmatigInvoer(handmatigCijfers[vorigVeld.key] != null ? String(handmatigCijfers[vorigVeld.key]) : '');
      setHandmatigVeldIndex(handmatigVeldIndex - 1);
    } else {
      setHandmatigFase('sector');
    }
  };

  const startVervolgVragen = () => {
    setHandmatigVeldIndex(0);
    setHandmatigInvoer('');
    setFout('');
    setHandmatigFase('vervolg');
  };

  const volgendeVervolgVeld = () => {
    if (handmatigInvoer.trim() === '') return;
    const waarde = parseFloat(handmatigInvoer.replace(',', '.'));
    if (Number.isNaN(waarde)) { setFout('Vul een geldig getal in.'); return; }
    setFout('');
    const nieuweCijfers = { ...handmatigCijfers, [huidigVervolgVeld.key]: waarde };
    setHandmatigCijfers(nieuweCijfers);
    setHandmatigInvoer('');
    if (handmatigVeldIndex < VERVOLG_VELDEN.length - 1) {
      setHandmatigVeldIndex(handmatigVeldIndex + 1);
    } else {
      berekenHandmatig(nieuweCijfers);
    }
  };

  const vorigeVervolgVeld = () => {
    setFout('');
    if (handmatigVeldIndex > 0) {
      const vorigVeld = VERVOLG_VELDEN[handmatigVeldIndex - 1];
      setHandmatigInvoer(handmatigCijfers[vorigVeld.key] != null ? String(handmatigCijfers[vorigVeld.key]) : '');
      setHandmatigVeldIndex(handmatigVeldIndex - 1);
    } else {
      setHandmatigFase('succes');
    }
  };

  const berekenHandmatig = (cijfers) => {
    setStappenLange(null);
    setStappenKorte(null);
    setGekozen(handmatigSymbool);
    setIsCrypto(false);
    const ratios = berekenRatiosUitRuweCijfers(cijfers, handmatigSector, handmatigKoers);
    const gecombineerd = {
      ...ratios,
      weekHigh52: handmatigTechData?.weekHigh52,
      weekLow52: handmatigTechData?.weekLow52,
      gemiddelde50d: handmatigTechData?.gemiddelde50d,
      gemiddelde200d: handmatigTechData?.gemiddelde200d,
    };
    setStappenLange(scoreAandeelLangeTermijn(gecombineerd));
    setStappenKorte(scoreAandeelKorteTermijn(gecombineerd, handmatigKoers));
    setHandmatigFase('klaar');
  };

  const herbeginHandmatig = () => {
    setHandmatigSymbool(null);
    setHandmatigSector('default');
    setHandmatigCijfers({});
    setHandmatigInvoer('');
    setHandmatigVeldIndex(0);
    setHandmatigKoers(null);
    setHandmatigTechData(null);
    setGateResultaten({});
    setGefaaldeGate(null);
    setHandmatigFase('aandeel');
    setStappenLange(null);
    setStappenKorte(null);
    setFout('');
  };

  const berekenTotaal = (stappen) => {
    if (!stappen) return null;
    const geldig = stappen.filter(s => s.score !== null);
    if (geldig.length === 0) return null;
    const totaal = geldig.reduce((s, st) => s + st.score, 0);
    const pct = (totaal / (geldig.length * 10)) * 100;
    return { totaal, max: geldig.length * 10, pct, oordeel: verdict(pct) };
  };

  const langeTotaal = berekenTotaal(stappenLange);
  const korteTotaal = berekenTotaal(stappenKorte);
  const klaarOmTeTonen = isCrypto ? stappenKorte : (stappenLange && stappenKorte);

  return (
    <div className="markten-pagina" style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Analyseren</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Doorloop een stappenplan met kerncijfers van een aandeel, ETF of crypto, en krijg een score per stap plus een totaaloordeel.
        </p>
      </div>

      {/* Zoekbalk */}
      {/* Omschakelknop tussen normale zoekopdracht en jaarrekening-upload */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => { setHandmatigModus(v => !v); herbeginHandmatig(); }}
          style={{
            background: handmatigModus ? 'var(--accent-bg)' : 'transparent',
            color: handmatigModus ? 'var(--accent)' : 'var(--text-muted)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {handmatigModus ? '✓ ' : ''}Cijfers zelf ingeven (enkel Amerikaanse aandelen)
        </button>
      </div>

      {handmatigModus ? (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Geef zelf de kerncijfers van een Amerikaans beursgenoteerd bedrijf in (bv. uit de jaarrekening of via stockanalysis.com/macrotrends.net) — gratis databronnen bieden dit voor Amerikaanse fundamentele cijfers namelijk niet aan. Eerst doorloop je een screening van 5 stappen (omzetgroei, K/W-ratio, PEG-ratio, rendement op eigen vermogen, quick ratio) — zakt het aandeel op één daarvan door, dan stopt de analyse meteen met een duidelijke melding. Slaagt het op alle 5, dan ga je door naar de volledige Lange-termijn/Korte-termijn-analyse. De huidige koers en het 52-weken-bereik halen we automatisch op.
          </div>

          {/* Fase: effect kiezen */}
          {handmatigFase === 'aandeel' && (
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Om welk aandeel gaat het?</label>
              <input
                value={handmatigZoekQuery}
                onChange={e => zoekHandmatig(e.target.value)}
                placeholder="Zoek het Amerikaanse aandeel..."
                autoFocus
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              {handmatigZoekResultaten.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', maxHeight: 240, overflowY: 'auto', zIndex: 20 }}>
                  {handmatigZoekResultaten.map((r, i) => (
                    <div key={i} onClick={() => kiesHandmatigAandeel(r)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < handmatigZoekResultaten.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.naam}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.symbol} · {r.beurs}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fase: sector kiezen */}
          {handmatigFase === 'sector' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                <span>{handmatigSymbool.naam} · {handmatigSymbool.symbol}</span>
                <button onClick={() => setHandmatigFase('aandeel')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>Wijzigen</button>
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>In welke sector zit dit bedrijf?</label>
              <select value={handmatigSector} onChange={e => setHandmatigSector(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg-white)', marginBottom: 16 }}>
                <option value="technologie">Technologie / Communicatie</option>
                <option value="financieel">Financieel / Banken</option>
                <option value="nutsbedrijf">Nutsbedrijf</option>
                <option value="vastgoed">Vastgoed (REIT)</option>
                <option value="energie">Energie / Materialen</option>
                <option value="default">Consument / Industrie / Gezondheidszorg</option>
              </select>
              <button
                onClick={() => kiesHandmatigSectorEnStart(handmatigSector)}
                disabled={laden}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: laden ? 0.5 : 1 }}
              >
                {laden && <Loader size={15} className="spin" />}
                Start screening <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Fase: screening — 5 gates, elk met eigen cijfers en een meteen-evaluatie */}
          {handmatigFase === 'screening' && huidigScreeningVeld && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                {GATE_TITELS[huidigScreeningVeld.gate]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                Cijfer {handmatigVeldIndex + 1} van {SCREENING_VELDEN.length}
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{huidigScreeningVeld.label}</label>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>{huidigScreeningVeld.hint}</div>
              <input
                type="text"
                inputMode="decimal"
                value={handmatigInvoer}
                onChange={e => setHandmatigInvoer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') volgendeScreeningVeld(); }}
                placeholder="Bv. 12500000000"
                autoFocus
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={vorigeScreeningVeld}
                  style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ArrowLeft size={15} /> Vorige
                </button>
                <button
                  onClick={volgendeScreeningVeld}
                  disabled={handmatigInvoer.trim() === ''}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: handmatigInvoer.trim() === '' ? 0.5 : 1,
                  }}
                >
                  Volgende <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Fase: gefaald — een screening-gate is niet geslaagd, analyse stopt hier */}
          {handmatigFase === 'gefaald' && gefaaldeGate && (
            <div>
              <div style={{ padding: '16px 18px', background: 'var(--red-bg)', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>
                  {GATE_TITELS[gefaaldeGate.id]} — niet geslaagd
                </div>
                <div style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.5 }}>{gefaaldeGate.tekst}</div>
              </div>
              <button
                onClick={herbeginHandmatig}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Nieuw aandeel analyseren
              </button>
            </div>
          )}

          {/* Fase: succes — alle 5 gates geslaagd, keuze om verder te gaan naar de volledige analyse */}
          {handmatigFase === 'succes' && (
            <div>
              <div style={{ padding: '16px 18px', background: 'var(--green-bg, #ecfdf5)', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginBottom: 10 }}>
                  Zeer goed! Dit bedrijf scoort goed op alle 5 aspecten van de screening.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['A', 'B', 'C', 'D', 'E'].map(id => (
                    <div key={id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <strong>{GATE_TITELS[id].replace(/^\d\.\s*/, '')}:</strong> {gateResultaten[id]?.tekst}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={startVervolgVragen}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                Ga verder naar de volledige analyse <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Fase: vervolg — de laatste, nog niet gevraagde cijfers voor de volledige score */}
          {handmatigFase === 'vervolg' && huidigVervolgVeld && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                Nog {VERVOLG_VELDEN.length - handmatigVeldIndex} cijfer{VERVOLG_VELDEN.length - handmatigVeldIndex !== 1 ? 's' : ''} voor de volledige analyse
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{huidigVervolgVeld.label}</label>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>{huidigVervolgVeld.hint}</div>
              <input
                type="text"
                inputMode="decimal"
                value={handmatigInvoer}
                onChange={e => setHandmatigInvoer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') volgendeVervolgVeld(); }}
                placeholder="Bv. 12500000000"
                autoFocus
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={vorigeVervolgVeld}
                  style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ArrowLeft size={15} /> Vorige
                </button>
                <button
                  onClick={volgendeVervolgVeld}
                  disabled={handmatigInvoer.trim() === ''}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: handmatigInvoer.trim() === '' ? 0.5 : 1,
                  }}
                >
                  {handmatigVeldIndex < VERVOLG_VELDEN.length - 1 ? <>Volgende <ArrowRight size={15} /></> : 'Berekenen'}
                </button>
              </div>
            </div>
          )}

          {handmatigFase === 'klaar' && (
            <button
              onClick={herbeginHandmatig}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Nieuw aandeel analyseren
            </button>
          )}
        </div>
      ) : (
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={zoekQuery}
            onChange={e => zoek(e.target.value)}
            placeholder="Zoek een aandeel, ETF of crypto..."
            style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          {zoekLoading && <Loader size={16} className="spin" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />}
        </div>
        {zoekResultaten.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', maxHeight: 320, overflowY: 'auto', zIndex: 20 }}>
            {zoekResultaten.map((r, i) => (
              <div key={i} onClick={() => kies(r)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < zoekResultaten.length - 1 ? '1px solid var(--border-light)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.naam}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.symbol} · {r.beurs}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>{r.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {laden && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <Loader size={20} className="spin" style={{ marginBottom: 8 }} />
          <div>{voortgang || `Cijfers ophalen voor ${gekozen?.naam}...`}</div>
        </div>
      )}

      {fout && (
        <div style={{ padding: '12px 16px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 13 }}>{fout}</div>
      )}

      {klaarOmTeTonen && !laden && (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{gekozen.naam} · {gekozen.symbol}</div>

          {isCrypto ? (
            <>
              {/* Crypto: één gecombineerde score */}
              <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 24 }}>
                <div style={{
                  display: 'inline-block', padding: '8px 24px', borderRadius: 999, fontSize: 22, fontWeight: 700,
                  color: korteTotaal.oordeel.kleur, background: korteTotaal.oordeel.achtergrond, marginBottom: 8,
                }}>
                  {korteTotaal.oordeel.label}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  Totaalscore: <strong style={{ color: 'var(--text-primary)' }}>{korteTotaal.totaal}/{korteTotaal.max}</strong> ({korteTotaal.pct.toFixed(0)}%)
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stappenKorte.map((s, i) => (
                  <StapKaart key={i} index={i} stap={s} />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Aandeel/ETF: lange termijn + korte termijn apart, want die kunnen
                  elkaar tegenspreken (bv. sterk bedrijf maar tijdelijk overbought) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className="card" style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Lange termijn</div>
                  <div style={{
                    display: 'inline-block', padding: '6px 18px', borderRadius: 999, fontSize: 18, fontWeight: 700,
                    color: langeTotaal.oordeel.kleur, background: langeTotaal.oordeel.achtergrond, marginBottom: 8,
                  }}>
                    {langeTotaal.oordeel.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{langeTotaal.totaal}/{langeTotaal.max} ({langeTotaal.pct.toFixed(0)}%)</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Korte termijn</div>
                  <div style={{
                    display: 'inline-block', padding: '6px 18px', borderRadius: 999, fontSize: 18, fontWeight: 700,
                    color: korteTotaal.oordeel.kleur, background: korteTotaal.oordeel.achtergrond, marginBottom: 8,
                  }}>
                    {korteTotaal.oordeel.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{korteTotaal.totaal}/{korteTotaal.max} ({korteTotaal.pct.toFixed(0)}%)</div>
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Lange termijn — waardering, gezondheid, dividend</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {stappenLange.map((s, i) => <StapKaart key={i} index={i} stap={s} />)}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Korte termijn — momentum</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stappenKorte.map((s, i) => <StapKaart key={i} index={i} stap={s} />)}
              </div>
            </>
          )}

          <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-subtle)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Dit is een gestructureerde, heuristische kijk op enkele kerncijfers — geen professioneel beleggingsadvies. Neem ook zaken mee die hier niet in cijfers te vatten zijn (bedrijfsnieuws, sectorvooruitzichten, je eigen risicotolerantie) vóór je een beslissing neemt.
          </div>
        </>
      )}

      {!klaarOmTeTonen && !laden && !fout && !handmatigModus && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <TrendingUp size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>Zoek een aandeel, ETF of crypto hierboven om te beginnen.</div>
        </div>
      )}
    </div>
  );
}
