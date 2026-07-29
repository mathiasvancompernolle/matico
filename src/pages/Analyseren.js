import React, { useState } from 'react';
import { Search, Loader, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  const [fout, setFout] = useState('');

  // Jaarrekening-upload (enkel voor Amerikaanse aandelen)
  const [uploadModus, setUploadModus] = useState(false);
  const [uploadSector, setUploadSector] = useState('default');
  const [uploadBestand, setUploadBestand] = useState(null);
  const [uploadSymbool, setUploadSymbool] = useState(null);
  const [uploadZoekQuery, setUploadZoekQuery] = useState('');
  const [uploadZoekResultaten, setUploadZoekResultaten] = useState([]);

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

  const zoekUpload = async (q) => {
    setUploadZoekQuery(q);
    if (q.length < 2) { setUploadZoekResultaten([]); return; }
    try {
      const res = await fetch(`/api/data?endpoint=search&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setUploadZoekResultaten((data?.resultaten || []).filter(r => r.type !== 'crypto'));
    } catch (e) { setUploadZoekResultaten([]); }
  };

  const bestandNaarBase64 = (bestand) => new Promise((resolve, reject) => {
    const lezer = new FileReader();
    lezer.onload = () => resolve(lezer.result.split(',')[1]);
    lezer.onerror = reject;
    lezer.readAsDataURL(bestand);
  });

  const analyseerJaarrekening = async () => {
    if (!uploadBestand || !uploadSymbool) return;
    setStappenLange(null);
    setStappenKorte(null);
    setFout('');
    setLaden(true);
    setGekozen(uploadSymbool);
    setIsCrypto(false);
    try {
      const [pdfBase64, qRes, techRes] = await Promise.all([
        bestandNaarBase64(uploadBestand),
        fetch(`/api/data?endpoint=quote&symbol=${encodeURIComponent(uploadSymbool.symbol)}`),
        fetch(`/api/data?endpoint=analyse-aandeel&symbol=${encodeURIComponent(uploadSymbool.symbol)}`),
      ]);
      const qData = await qRes.json();
      const techData = await techRes.json(); // enkel voor 52w-bereik en 50/200-daags gemiddelde
      const huidigeKoers = qData?.c;
      if (!huidigeKoers) { setFout('Kon de huidige koers niet ophalen — nodig om de K/W-ratio en dividendrendement te berekenen.'); setLaden(false); return; }

      const jrRes = await fetch('/api/data?endpoint=analyse-jaarrekening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, sector: uploadSector, huidigeKoers }),
      });
      let jrData;
      try {
        jrData = await jrRes.json();
      } catch (parseFout) {
        const ruweTekst = await jrRes.text().catch(() => '');
        setFout(`Server gaf geen geldig antwoord terug (status ${jrRes.status}). Mogelijk is het bestand te groot. Details: ${ruweTekst.slice(0, 200)}`);
        setLaden(false);
        return;
      }
      if (jrData.fout) { setFout(jrData.fout); setLaden(false); return; }

      // Combineer: fundamentele cijfers uit de jaarrekening + 52w-bereik/
      // voortschrijdende gemiddeldes uit de bestaande koers-data (die staan
      // niet in een jaarrekening, enkel historische boekjaar-cijfers).
      const gecombineerd = {
        ...jrData,
        weekHigh52: techData.weekHigh52,
        weekLow52: techData.weekLow52,
        gemiddelde50d: techData.gemiddelde50d,
        gemiddelde200d: techData.gemiddelde200d,
      };
      setStappenLange(scoreAandeelLangeTermijn(gecombineerd));
      setStappenKorte(scoreAandeelKorteTermijn(gecombineerd, huidigeKoers));
    } catch (e) {
      setFout(`Er ging iets mis bij het verwerken van de jaarrekening: ${e.message}`);
    }
    setLaden(false);
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
          onClick={() => setUploadModus(v => !v)}
          style={{
            background: uploadModus ? 'var(--accent-bg)' : 'transparent',
            color: uploadModus ? 'var(--accent)' : 'var(--text-muted)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {uploadModus ? '✓ ' : ''}Jaarrekening uploaden (enkel Amerikaanse aandelen)
        </button>
      </div>

      {uploadModus ? (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Upload het volledige jaarverslag (10-K, als PDF) van een Amerikaans beursgenoteerd bedrijf. We laten een AI-model de cijfers eruit halen en berekenen zelf de nodige ratio's — gratis databronnen bieden dit voor Amerikaanse fundamentele cijfers namelijk niet aan.
          </div>

          {/* Effect kiezen (voor live koers + 52w-bereik) */}
          <div style={{ marginBottom: 14, position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Om welk effect gaat het?</label>
            {uploadSymbool ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <span>{uploadSymbool.naam} · {uploadSymbool.symbol}</span>
                <button onClick={() => setUploadSymbool(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>Wijzigen</button>
              </div>
            ) : (
              <>
                <input
                  value={uploadZoekQuery}
                  onChange={e => zoekUpload(e.target.value)}
                  placeholder="Zoek het Amerikaanse aandeel..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                {uploadZoekResultaten.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', maxHeight: 240, overflowY: 'auto', zIndex: 20 }}>
                    {uploadZoekResultaten.map((r, i) => (
                      <div key={i} onClick={() => { setUploadSymbool(r); setUploadZoekResultaten([]); setUploadZoekQuery(''); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < uploadZoekResultaten.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.naam}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.symbol} · {r.beurs}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sector kiezen */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Sector</label>
            <select value={uploadSector} onChange={e => setUploadSector(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg-white)' }}>
              <option value="technologie">Technologie / Communicatie</option>
              <option value="financieel">Financieel / Banken</option>
              <option value="nutsbedrijf">Nutsbedrijf</option>
              <option value="vastgoed">Vastgoed (REIT)</option>
              <option value="energie">Energie / Materialen</option>
              <option value="default">Consument / Industrie / Gezondheidszorg</option>
            </select>
          </div>

          {/* Bestand kiezen */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Jaarrekening (PDF)</label>
            <input type="file" accept="application/pdf" onChange={e => setUploadBestand(e.target.files?.[0] || null)}
              style={{ width: '100%', fontSize: 13 }} />
          </div>

          <button
            onClick={analyseerJaarrekening}
            disabled={!uploadBestand || !uploadSymbool || laden}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              opacity: (!uploadBestand || !uploadSymbool || laden) ? 0.5 : 1,
            }}
          >
            Analyseer jaarrekening
          </button>
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
          <div>Cijfers ophalen voor {gekozen?.naam}...</div>
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

      {!klaarOmTeTonen && !laden && !fout && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <TrendingUp size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>Zoek een aandeel, ETF of crypto hierboven om te beginnen.</div>
        </div>
      )}
    </div>
  );
}
