import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Info, X } from 'lucide-react';

const ACCENT = '#6366f1';
const fmt2 = (v) => v.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Dividend database (bruto, per aandeel, jaarlijks) ──────────────
// Bron: meest recente uitkering × frequentie
const DIVIDEND_DB = {
  // Aandelen
  // Bijgewerkt juni 2026 op basis van actuele uitkeringen
  NVDA: { jaarlijks: 1.00, frequentie: 4, ex_maanden: [3, 6, 9, 12] },      // $0.25/kwartaal (verhoogd in 2026)
  MSFT: { jaarlijks: 3.32, frequentie: 4, ex_maanden: [2, 5, 8, 11] },      // $0.83/kwartaal
  AAPL: { jaarlijks: 1.00, frequentie: 4, ex_maanden: [2, 5, 8, 11] },      // $0.25/kwartaal
  AMZN: { jaarlijks: 0, frequentie: 0, ex_maanden: [] },
  GOOGL: { jaarlijks: 0.80, frequentie: 4, ex_maanden: [3, 6, 9, 12] },     // $0.20/kwartaal
  META: { jaarlijks: 2.00, frequentie: 4, ex_maanden: [3, 6, 9, 12] },      // $0.50/kwartaal
  TSLA: { jaarlijks: 0, frequentie: 0, ex_maanden: [] },
  JPM: { jaarlijks: 4.60, frequentie: 4, ex_maanden: [1, 4, 7, 10] },       // $1.15/kwartaal
  V: { jaarlijks: 2.08, frequentie: 4, ex_maanden: [2, 5, 8, 11] },         // $0.52/kwartaal
  MA: { jaarlijks: 2.64, frequentie: 4, ex_maanden: [1, 4, 7, 10] },        // $0.66/kwartaal
  JNJ: { jaarlijks: 4.96, frequentie: 4, ex_maanden: [2, 5, 8, 11] },       // $1.24/kwartaal
  NKE: { jaarlijks: 1.64, frequentie: 4, ex_maanden: [3, 6, 9, 12] },       // $0.41/kwartaal (bijgewerkt jun 2026)
  SOFI: { jaarlijks: 0, frequentie: 0, ex_maanden: [] },
  AVGO: { jaarlijks: 21.00, frequentie: 4, ex_maanden: [2, 5, 8, 11] },     // $5.25/kwartaal
  // ETFs — accumulerend (geen dividend)
  VWCE: { jaarlijks: 0, frequentie: 0, ex_maanden: [], accumulating: true },
  VWRL: { jaarlijks: 1.20, frequentie: 4, ex_maanden: [3, 6, 9, 12] },
  IWDA: { jaarlijks: 0, frequentie: 0, ex_maanden: [], accumulating: true },
  SWRD: { jaarlijks: 0, frequentie: 0, ex_maanden: [], accumulating: true },
  EMIM: { jaarlijks: 0, frequentie: 0, ex_maanden: [], accumulating: true },
  CSPX: { jaarlijks: 0, frequentie: 0, ex_maanden: [], accumulating: true },
  SXR8: { jaarlijks: 0, frequentie: 0, ex_maanden: [], accumulating: true },
  EQQQ: { jaarlijks: 0, frequentie: 0, ex_maanden: [], accumulating: true },
  XDWD: { jaarlijks: 0, frequentie: 0, ex_maanden: [], accumulating: true },
  LCWD: { jaarlijks: 0, frequentie: 0, ex_maanden: [], accumulating: true },
  WEBG: { jaarlijks: 0, frequentie: 0, ex_maanden: [], accumulating: true },
};

const getDividendData = (symbol) => {
  const basis = symbol.toUpperCase().split('.')[0];
  return DIVIDEND_DB[basis] || null;
};

// Roerende voorheffing België = 30%
const BELASTING = 0.30;

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export default function Dividend() {
  const { beleggingen, koersen, getMuntFactor, verkochteBeleggingen } = useApp();
  const [jaar, setJaar] = useState(new Date().getFullYear());
  const [modus, setModus] = useState('bruto'); // 'bruto' | 'netto'
  const [jaarDropdown, setJaarDropdown] = useState(false);
  const [rendementInfo, setRendementInfo] = useState(false);
  const [dividendInfo, setDividendInfo] = useState(false);
  const [liveDividend, setLiveDividend] = useState({}); // { NVDA: { jaarlijks, ontvangen } }

  const factor = (b) => getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);

  // Haal live dividenddata op via Finnhub
  useEffect(() => {
    const symbolen = beleggingen.map(b => b.symbol);
    symbolen.forEach(async (sym) => {
      const basis = sym.toUpperCase().split('.')[0];
      const cacheKey = `matico_div_${basis}_${jaar}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
            setLiveDividend(prev => ({ ...prev, [basis]: data }));
            return;
          }
        }
      } catch (e) {}

      try {
        const van = `${jaar}-01-01`;
        const tot = `${jaar}-12-31`;
        const res = await fetch(`/api/data?endpoint=dividend&symbol=${sym}&van=${van}&tot=${tot}`);
        const data = await res.json();
        if (data && data.length > 0) {
          localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
          setLiveDividend(prev => ({ ...prev, [basis]: data }));
        }
      } catch (e) {}
    });
  }, [beleggingen.map(b => b.symbol).join(','), jaar]);

  // ── Bereken dividenddata per belegging ──
  // Gebruikt live Finnhub data als beschikbaar, anders hardcoded database
  const { perBelegging, ontvangen, verwacht, dividendRendement, rendementOpAankoop, maandData, zonderData } = useMemo(() => {
    const huidigMaand = new Date().getMonth() + 1;
    const huidigJaar = new Date().getFullYear();
    const isHuidigJaar = jaar === huidigJaar;

    const perBel = [];
    let totaalOntvangen = 0;
    let totaalVerwacht = 0;
    const maandTotalen = Array(12).fill(0);
    const zonderDataLijst = [];

    const alleBel = [
      ...beleggingen,
      ...(jaar < huidigJaar ? (verkochteBeleggingen || []).map(b => ({ ...b, aantal: b.aantalVerkocht })) : [])
    ];

    alleBel.forEach(b => {
      const basis = b.symbol.toUpperCase().split('.')[0];
      const f = factor(b);
      const k = koersen[b.symbol];
      const huidigePrijs = k ? k.c : b.kostprijs;

      // ── Probeer live Finnhub data ──
      const liveData = liveDividend[basis];
      if (liveData && Array.isArray(liveData) && liveData.length > 0) {
        // Filter op het gevraagde jaar
        const uitkeringenDitJaar = liveData.filter(d => {
          const datum = new Date(d.date || d.paymentDate || d.exDate || '');
          return datum.getFullYear() === jaar;
        });

        if (uitkeringenDitJaar.length > 0) {
          // Som van alle uitkeringen dit jaar
          const totaalUitgekeerdUSD = uitkeringenDitJaar.reduce((s, d) =>
            s + parseFloat(d.amount || d.adjDividend || d.dividend || 0), 0
          );

          // Schat jaarlijks dividend op basis van recentste uitkering × frequentie
          const recentsteUitkering = parseFloat(uitkeringenDitJaar[0]?.amount || uitkeringenDitJaar[0]?.adjDividend || 0);
          const frequentie = uitkeringenDitJaar.length <= 1 ? 4 : uitkeringenDitJaar.length; // aanname kwartaal als maar 1 datapunt
          const jaarlijksUSD = recentsteUitkering * frequentie;
          const jaarlijksBruto = jaarlijksUSD * b.aantal * f;
          const jaarlijksNetto = jaarlijksBruto * (1 - BELASTING);

          // Ontvangen = alle uitkeringen die al betaald zijn dit jaar
          const ontvangenUSD = uitkeringenDitJaar
            .filter(d => {
              const betaalDatum = new Date(d.paymentDate || d.date || '');
              return !isHuidigJaar || betaalDatum <= new Date();
            })
            .reduce((s, d) => s + parseFloat(d.amount || d.adjDividend || 0), 0);

          const ontvangenBruto = ontvangenUSD * b.aantal * f;
          const ontvangenNetto = ontvangenBruto * (1 - BELASTING);

          // Maanddata
          uitkeringenDitJaar.forEach(d => {
            const betaalDatum = new Date(d.paymentDate || d.date || '');
            const maandIdx = betaalDatum.getMonth();
            if (!isHuidigJaar || betaalDatum <= new Date()) {
              const bedrag = parseFloat(d.amount || d.adjDividend || 0) * b.aantal * f;
              maandTotalen[maandIdx] += modus === 'netto' ? bedrag * (1 - BELASTING) : bedrag;
            }
          });

          const rendement = huidigePrijs > 0 ? (jaarlijksUSD / huidigePrijs) * 100 : 0;
          const rendementAankoop = b.kostprijs > 0 ? (jaarlijksUSD / b.kostprijs) * 100 : 0;

          totaalOntvangen += modus === 'netto' ? ontvangenNetto : ontvangenBruto;
          totaalVerwacht += modus === 'netto' ? jaarlijksNetto : jaarlijksBruto;

          perBel.push({
            id: b.id || b.symbol, naam: b.naam, symbol: b.symbol, logo: b.logo,
            aantal: b.aantal, liveData: true,
            verkocht: !beleggingen.find(bb => bb.symbol === b.symbol),
            rendement, rendementAankoop,
            verwachtJaarlijks: modus === 'netto' ? jaarlijksNetto : jaarlijksBruto,
            ontvangen: modus === 'netto' ? ontvangenNetto : ontvangenBruto,
          });
          return; // Live data verwerkt, skip hardcoded
        }
      }

      // ── Fallback: hardcoded database ──
      const db = getDividendData(b.symbol);
      if (!db || db.jaarlijks === 0) {
        if (!db?.accumulating) zonderDataLijst.push(b.naam || b.symbol);
        return;
      }

      const jaarlijksBruto = db.jaarlijks * b.aantal * f;
      const jaarlijksNetto = jaarlijksBruto * (1 - BELASTING);
      let ontvangenBruto = 0;
      const uitkeringPerKeer = (db.jaarlijks / (db.frequentie || 1)) * b.aantal * f;

      db.ex_maanden.forEach(m => {
        const isOntvangen = !isHuidigJaar || m <= huidigMaand;
        if (isOntvangen) {
          ontvangenBruto += uitkeringPerKeer;
          const maandIdx = Math.min(m, 12) - 1;
          if (maandIdx >= 0) maandTotalen[maandIdx] += modus === 'netto'
            ? uitkeringPerKeer * (1 - BELASTING) : uitkeringPerKeer;
        }
      });

      const ontvangenNetto = ontvangenBruto * (1 - BELASTING);
      const rendement = huidigePrijs > 0 ? (db.jaarlijks / huidigePrijs) * 100 : 0;
      const rendementAankoop = b.kostprijs > 0 ? (db.jaarlijks / b.kostprijs) * 100 : 0;

      totaalOntvangen += modus === 'netto' ? ontvangenNetto : ontvangenBruto;
      totaalVerwacht += modus === 'netto' ? jaarlijksNetto : jaarlijksBruto;

      perBel.push({
        id: b.id || b.symbol, naam: b.naam, symbol: b.symbol, logo: b.logo,
        aantal: b.aantal, liveData: false,
        verkocht: !beleggingen.find(bb => bb.symbol === b.symbol),
        rendement, rendementAankoop,
        verwachtJaarlijks: modus === 'netto' ? jaarlijksNetto : jaarlijksBruto,
        ontvangen: modus === 'netto' ? ontvangenNetto : ontvangenBruto,
        frequentie: db.frequentie,
      });
    });

    // Totaal rendement
    const totaalWaarde = beleggingen.reduce((s, b) => {
      const k = koersen[b.symbol]; return s + (k ? k.c : b.kostprijs) * b.aantal * factor(b);
    }, 0) || 1;
    const totaalKostprijs = beleggingen.reduce((s, b) => s + b.kostprijs * b.aantal * factor(b), 0) || 1;
    const jaarlijksBrutoTotaal = perBel.reduce((s, p) => s + p.verwachtJaarlijks, 0);

    return {
      perBelegging: perBel.sort((a, b) => b.ontvangen - a.ontvangen),
      ontvangen: totaalOntvangen,
      verwacht: totaalVerwacht,
      dividendRendement: (jaarlijksBrutoTotaal / totaalWaarde) * 100,
      rendementOpAankoop: (jaarlijksBrutoTotaal / totaalKostprijs) * 100,
      maandData: MAANDEN.map((label, i) => ({ label, waarde: maandTotalen[i] })),
      zonderData: [...new Set(zonderDataLijst)],
    };
  }, [beleggingen, koersen, jaar, modus, verkochteBeleggingen]);

  const beschikbareJaren = useMemo(() => {
    const huidig = new Date().getFullYear();
    const vroegste = beleggingen.reduce((min, b) => {
      if (!b.datum) return min;
      const j = new Date(b.datum).getFullYear();
      return j < min ? j : min;
    }, huidig);
    const jaren = [];
    for (let j = huidig; j >= vroegste; j--) jaren.push(j);
    return jaren;
  }, [beleggingen]);

  if (beleggingen.length === 0) {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div className="page-header" style={{ marginBottom: 24 }}><h1>Dividend</h1></div>
        <div style={{ padding: '0 32px' }}>
          <div className="empty-state card"><h3>Nog geen beleggingen</h3><p>Voeg beleggingen toe om dividenddata te zien</p></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 60px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>Dividend</h1>
        {/* Jaar dropdown */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setJaarDropdown(o => !o)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
            border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)',
            cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit'
          }}>
            {jaar} <span style={{ fontSize: 10 }}>▼</span>
          </button>
          {jaarDropdown && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'white',
              border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)',
              zIndex: 20, overflow: 'hidden', minWidth: 100
            }}>
              {beschikbareJaren.map(j => (
                <div key={j} onClick={() => { setJaar(j); setJaarDropdown(false); }}
                  style={{
                    padding: '9px 16px', cursor: 'pointer', fontSize: 13,
                    fontWeight: j === jaar ? 700 : 400,
                    background: j === jaar ? 'var(--accent-bg)' : 'transparent',
                    color: j === jaar ? 'var(--accent)' : 'var(--text-primary)'
                  }}
                  onMouseEnter={e => { if (j !== jaar) e.currentTarget.style.background = 'var(--bg)'; }}
                  onMouseLeave={e => { if (j !== jaar) e.currentTarget.style.background = 'transparent'; }}
                >{j}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Rij 1: Rendement + Dividend ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Rendement card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Rendement</div>
              <button onClick={() => setRendementInfo(true)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2
              }}><Info size={17} /></button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Dividendrendement</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{dividendRendement.toFixed(2).replace('.', ',')}%</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Rendement op aankoopwaarde</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{rendementOpAankoop.toFixed(2).replace('.', ',')}%</div>
            </div>
          </div>

          {/* Dividend card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Dividend</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {['Bruto', 'Netto'].map(m => (
                    <button key={m} onClick={() => setModus(m.toLowerCase())} style={{
                      padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                      background: modus === m.toLowerCase() ? 'var(--text-primary)' : 'transparent',
                      color: modus === m.toLowerCase() ? 'white' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
                    }}>{m}</button>
                  ))}
                </div>
                <button onClick={() => setDividendInfo(true)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2
                }}><Info size={17} /></button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Ontvangen ({jaar})</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>€{fmt2(ontvangen)}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Totaal verwacht dit jaar</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>€{fmt2(verwacht)}</div>
            </div>
          </div>
        </div>

        {/* ── Dividend per maand ── */}
        <div className="card">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Dividend per maand</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Voor {jaar}</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maandData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v === 0 ? '0' : `€${v.toFixed(1)}`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length || !payload[0].value) return null;
                    return (
                      <div style={{
                        background: 'white', border: '1px solid var(--border)', borderRadius: 8,
                        padding: '8px 12px', fontSize: 13, boxShadow: 'var(--shadow-md)'
                      }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label} {jaar}</div>
                        <div style={{ fontWeight: 700, color: ACCENT }}>€{fmt2(payload[0].value)}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="waarde" radius={[4, 4, 0, 0]}>
                  {maandData.map((d, i) => (
                    <Cell key={i} fill={d.waarde > 0 ? ACCENT : 'var(--border-light)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Per belegging ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Per belegging</div>
          </div>
          {/* Kolomhoofden */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.4fr 1.6fr 0.8fr',
            padding: '8px 24px', borderBottom: '1px solid var(--border-light)',
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)'
          }}>
            <span>Naam</span>
            <span style={{ textAlign: 'right' }}>Rendement</span>
            <span style={{ textAlign: 'right' }}>Rendement op aankoopwaarde</span>
            <span style={{ textAlign: 'right' }}>Verwacht jaarlijks dividend</span>
            <span style={{ textAlign: 'right' }}>Ontvangen</span>
          </div>
          {perBelegging.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Geen dividenddata beschikbaar voor {jaar}
            </div>
          ) : perBelegging.map(b => (
            <div key={b.id} style={{
              display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.4fr 1.6fr 0.8fr',
              padding: '14px 24px', borderBottom: '1px solid var(--border-light)', alignItems: 'center',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {b.logo ? (
                  <img src={b.logo} alt={b.symbol} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border)' }} />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: 'var(--accent-bg)',
                    color: 'var(--accent)', fontWeight: 700, fontSize: 11, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {b.symbol.split('.')[0].slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{b.naam}</span>
                    {b.verkocht && (
                      <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--border-light)', borderRadius: 4, color: 'var(--text-muted)', fontWeight: 600 }}>Verkocht</span>
                    )}
                    {b.liveData && (
                      <span title="Live data via Finnhub" style={{ fontSize: 9, padding: '1px 5px', background: '#dcfce7', borderRadius: 4, color: '#16a34a', fontWeight: 700 }}>LIVE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.symbol}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                {b.rendement > 0 ? `${b.rendement.toFixed(2).replace('.', ',')}%` : '—'}
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                {b.rendementAankoop > 0 ? `${b.rendementAankoop.toFixed(2).replace('.', ',')}%` : '—'}
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                €{fmt2(b.verwachtJaarlijks)}
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: b.ontvangen > 0 ? 'var(--green)' : 'var(--text-primary)' }}>
                €{fmt2(b.ontvangen)}
              </div>
            </div>
          ))}
          {/* Beleggingen zonder data */}
          {zonderData.length > 0 && (
            <div style={{ padding: '12px 24px', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)' }}>
              Beleggingen zonder dividendgegevens: {zonderData.join(' en ')}
            </div>
          )}
        </div>
      </div>

      {/* ── Info modals ── */}
      {rendementInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setRendementInfo(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, width: 460, maxWidth: '90vw', boxShadow: 'var(--shadow-lg)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Dividendrendement</h2>
              <button onClick={() => setRendementInfo(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 12 }}>
              <strong>Dividendrendement</strong> = jaarlijks dividend ÷ huidige marktwaarde × 100. Dit toont hoeveel je ontvangt in verhouding tot wat je belegging vandaag waard is.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              <strong>Rendement op aankoopwaarde</strong> = jaarlijks dividend ÷ je aankoopprijs × 100. Dit toont het rendement op basis van wat je ooit betaald hebt — ook wel "yield on cost" genoemd.
            </p>
          </div>
        </div>
      )}
      {dividendInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setDividendInfo(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, width: 460, maxWidth: '90vw', boxShadow: 'var(--shadow-lg)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Bruto vs Netto dividend</h2>
              <button onClick={() => setDividendInfo(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 12 }}>
              <strong>Bruto</strong> is het dividend vóór belastingen — het bedrag dat het bedrijf uitkeert.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 12 }}>
              <strong>Netto</strong> is wat je effectief ontvangt na de Belgische roerende voorheffing van <strong>30%</strong>. Op €1,00 bruto ontvang je €0,70 netto.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              Accumulerende ETFs (zoals VWCE, IWDA) keren geen dividend uit maar herbeleggen het automatisch — die zie je niet terug in dit overzicht.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
