import React, { useState } from 'react';
import { Search, Loader, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ── Scoringslogica — apart voor aandelen/ETF's en crypto ────────────────────
// Elke stap geeft een score op 10, met een korte, mensleesbare toelichting.
// Dit is een gestructureerde, heuristische kijk op de cijfers — geen
// professioneel beleggingsadvies.

function scoreAandeel(f, koers) {
  const stappen = [];

  // 1. Waardering (K/W-ratio)
  const pe = f.peRatio;
  let peScore = 5, peTekst = 'Geen K/W-ratio beschikbaar voor dit effect.';
  if (pe != null && pe > 0) {
    if (pe < 15) { peScore = 9; peTekst = `K/W van ${pe.toFixed(1)} is laag — het aandeel is relatief goedkoop t.o.v. de winst.`; }
    else if (pe < 25) { peScore = 6; peTekst = `K/W van ${pe.toFixed(1)} zit in een normaal bereik.`; }
    else { peScore = 3; peTekst = `K/W van ${pe.toFixed(1)} is hoog — de markt verwacht veel toekomstige groei, of het aandeel is duur.`; }
  }
  stappen.push({ titel: 'Waardering', sub: 'Koers/Winst-verhouding', score: peScore, toelichting: peTekst });

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

  // 4. Financiële gezondheid
  const dte = f.debtToEquity;
  let schuldScore = 5, schuldTekst = 'Geen schuldgraad-cijfers beschikbaar.';
  if (dte != null) {
    if (dte < 0.5) { schuldScore = 9; schuldTekst = `Schuldgraad van ${dte.toFixed(2)} is laag — financieel gezond, weinig schulden.`; }
    else if (dte < 1.5) { schuldScore = 6; schuldTekst = `Schuldgraad van ${dte.toFixed(2)} is aanvaardbaar.`; }
    else { schuldScore = 3; schuldTekst = `Schuldgraad van ${dte.toFixed(2)} is hoog — meer financieel risico.`; }
  }
  stappen.push({ titel: 'Financiële gezondheid', sub: 'Schuldgraad (schulden t.o.v. eigen vermogen)', score: schuldScore, toelichting: schuldTekst });

  // 5. Dividend
  const div = f.dividendYield, payout = f.payoutRatio;
  let divScore = 5, divTekst = 'Dit aandeel keert geen (of geen gekend) dividend uit — niet per se negatief, vaak het geval bij groeibedrijven.';
  if (div != null && div > 0) {
    const divPct = div * 100;
    const payoutPct = payout != null ? payout * 100 : null;
    if (divPct > 3 && (payoutPct == null || payoutPct < 70)) { divScore = 9; divTekst = `Dividendrendement van ${divPct.toFixed(2)}%, met een houdbare uitkeringsratio.`; }
    else if (payoutPct != null && payoutPct > 90) { divScore = 4; divTekst = `Dividendrendement van ${divPct.toFixed(2)}%, maar een erg hoge uitkeringsratio (${payoutPct.toFixed(0)}%) — risico op verlaging.`; }
    else { divScore = 6; divTekst = `Dividendrendement van ${divPct.toFixed(2)}%.`; }
  }
  stappen.push({ titel: 'Dividend', sub: 'Dividendrendement & uitkeringsratio', score: divScore, toelichting: divTekst });

  // 6. Momentum (koers t.o.v. 52-weken bereik)
  const hoog = f.weekHigh52, laag = f.weekLow52, huidig = koers;
  let momScore = 5, momTekst = 'Geen 52-weken-bereik beschikbaar.';
  if (hoog != null && laag != null && huidig != null && hoog > laag) {
    const positie = ((huidig - laag) / (hoog - laag)) * 100;
    if (positie > 80) { momScore = 7; momTekst = `Koers staat op ${positie.toFixed(0)}% van het 52-weken-bereik — dicht bij de jaarpiek, sterk momentum maar mogelijk duurder.`; }
    else if (positie > 40) { momScore = 6; momTekst = `Koers staat op ${positie.toFixed(0)}% van het 52-weken-bereik — neutrale positie.`; }
    else { momScore = 5; momTekst = `Koers staat op ${positie.toFixed(0)}% van het 52-weken-bereik — dicht bij het jaardal. Kan een koopkans zijn, of wijzen op een neerwaartse trend.`; }
  }
  stappen.push({ titel: 'Momentum', sub: 'Koers t.o.v. 52-weken hoog/laag', score: momScore, toelichting: momTekst });

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

export default function Analyseren() {
  const [zoekQuery, setZoekQuery] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [zoekLoading, setZoekLoading] = useState(false);
  const [gekozen, setGekozen] = useState(null);
  const [stappen, setStappen] = useState(null);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState('');

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
    setStappen(null);
    setFout('');
    setLaden(true);
    try {
      if (r.type === 'crypto') {
        const res = await fetch(`/api/data?endpoint=analyse-crypto&symbol=${encodeURIComponent(r.symbol)}`);
        const data = await res.json();
        if (Object.keys(data).length === 0) { setFout('Geen cijfers gevonden voor deze munt.'); setLaden(false); return; }
        setStappen(scoreCrypto(data));
      } else {
        const [fRes, qRes] = await Promise.all([
          fetch(`/api/data?endpoint=analyse-aandeel&symbol=${encodeURIComponent(r.symbol)}`),
          fetch(`/api/data?endpoint=quote&symbol=${encodeURIComponent(r.symbol)}`),
        ]);
        const fData = await fRes.json();
        const qData = await qRes.json();
        setStappen(scoreAandeel(fData, qData?.c));
      }
    } catch (e) {
      setFout('Er ging iets mis bij het ophalen van de cijfers.');
    }
    setLaden(false);
  };

  const totaal = stappen ? stappen.reduce((s, st) => s + st.score, 0) : 0;
  const totaalPct = stappen ? (totaal / (stappen.length * 10)) * 100 : 0;
  const eindoordeel = stappen ? verdict(totaalPct) : null;

  return (
    <div className="markten-pagina" style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Analyseren</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Doorloop een stappenplan met kerncijfers van een aandeel, ETF of crypto, en krijg een score per stap plus een totaaloordeel.
        </p>
      </div>

      {/* Zoekbalk */}
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

      {laden && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <Loader size={20} className="spin" style={{ marginBottom: 8 }} />
          <div>Cijfers ophalen voor {gekozen?.naam}...</div>
        </div>
      )}

      {fout && (
        <div style={{ padding: '12px 16px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 13 }}>{fout}</div>
      )}

      {stappen && !laden && (
        <>
          {/* Totaaloordeel */}
          <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{gekozen.naam} · {gekozen.symbol}</div>
            <div style={{
              display: 'inline-block', padding: '8px 24px', borderRadius: 999, fontSize: 22, fontWeight: 700,
              color: eindoordeel.kleur, background: eindoordeel.achtergrond, marginBottom: 8,
            }}>
              {eindoordeel.label}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Totaalscore: <strong style={{ color: 'var(--text-primary)' }}>{totaal}/{stappen.length * 10}</strong> ({totaalPct.toFixed(0)}%)
            </div>
          </div>

          {/* Stappen */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stappen.map((s, i) => (
              <div key={i} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 18 }}>
                <ScoreBadge score={s.score} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{i + 1}. {s.titel}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{s.sub}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.toelichting}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-subtle)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Dit is een gestructureerde, heuristische kijk op enkele kerncijfers — geen professioneel beleggingsadvies. Neem ook zaken mee die hier niet in cijfers te vatten zijn (bedrijfsnieuws, sectorvooruitzichten, je eigen risicotolerantie) vóór je een beslissing neemt.
          </div>
        </>
      )}

      {!stappen && !laden && !fout && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <TrendingUp size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>Zoek een aandeel, ETF of crypto hierboven om te beginnen.</div>
        </div>
      )}
    </div>
  );
}
