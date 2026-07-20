import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Constanten ────────────────────────────────────────────────────────────────
const REGIO_TABS = [
  { id: 'lokaal',        label: 'België' },
  { id: 'noord-amerika', label: 'Noord-Amerika' },
  { id: 'europa',        label: 'Europa' },
  { id: 'azie-pacific',  label: 'Azië-Pacific' },
];

const CATEGORIEEN = [
  { id: 'aandelen',          label: 'Aandelen',          afk: 'EQ',  kleur: '#f59e0b' },
  { id: 'etfs',              label: "ETF's",             afk: 'ETF', kleur: '#10b981' },
  { id: 'beleggingsfondsen', label: 'Beleggingsfondsen', afk: 'MF',  kleur: '#8b5cf6' },
  { id: 'obligaties',        label: 'Obligaties',        afk: 'BO',  kleur: '#3b82f6' },
];

// Subindices per regio voor aandelen
const SUBINDICES = {
  lokaal:        [{ id: 'bel20', label: 'BEL20 Index' }, { id: 'bel-midcap', label: 'BEL Midcap Index' }, { id: 'bel-smallcap', label: 'BEL Smallcap Index' }],
  europa:        [{ id: 'aex',   label: 'AEX Index' }],
  'noord-amerika': [{ id: 'nasdaq', label: 'Nasdaq 100' }],
  'azie-pacific':  [{ id: 'nikkei', label: 'Nikkei 225' }, { id: 'hangseng', label: 'Hang Seng' }],
};

const PERIODES = [
  { id: '1d',  label: 'Intraday' },
  { id: '1w',  label: '1W' },
  { id: '1m',  label: '1M' },
  { id: '3m',  label: '3M' },
  { id: '6m',  label: '6M' },
  { id: '1j',  label: '1J' },
  { id: '3j',  label: '3J' },
  { id: '5j',  label: '5J' },
  { id: 'ytd', label: 'YTD' },
  { id: 'max', label: 'Max' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPrijs(v, dec = 2) {
  if (!v && v !== 0) return '—';
  return v.toLocaleString('nl-BE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtPct(v) {
  if (v === undefined || v === null) return '—';
  if (v === 0 || Object.is(v, 0)) return '0,00%';
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
}

function fmtTijd(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDatum(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
}

// ── Kleine sparkline voor overzichtskaarten ───────────────────────────────────
function Sparkline({ data, positief }) {
  if (!data || data.length < 2) return <div style={{ height: 48 }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 120, h = 48;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(' ');
  const kleur = positief ? 'var(--green)' : 'var(--red)';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={kleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Index overzichtskaart ─────────────────────────────────────────────────────
function IndexKaart({ index, laden, onKlik }) {
  if (laden) {
    return (
      <div className="markt-index-kaart markt-kaart-laden">
        <div className="markt-kaart-skeleton-title" />
        <div className="markt-kaart-skeleton-chart" />
        <div className="markt-kaart-skeleton-price" />
      </div>
    );
  }
  const positief = index.change >= 0;
  return (
    <div className="markt-index-kaart" onClick={() => onKlik && onKlik(index)} style={{ cursor: 'pointer' }}>
      <div className="markt-kaart-icon"><span>EQ</span></div>
      <div className="markt-kaart-naam">{index.naam}</div>
      <div className="markt-kaart-sparkline">
        <Sparkline data={index.sparkline} positief={positief} />
      </div>
      <div className="markt-kaart-prijs">{fmtPrijs(index.prijs)}</div>
      <div className={`markt-kaart-change ${positief ? 'positief' : 'negatief'}`}>
        {fmtPct(index.change)} <span className="markt-kaart-periode">1D</span>
      </div>
    </div>
  );
}

// ── Nieuws kaart ──────────────────────────────────────────────────────────────
function NieuwsKaart({ artikel }) {
  return (
    <a href={artikel.url} target="_blank" rel="noopener noreferrer" className="markt-nieuws-kaart">
      {artikel.afbeelding && (
        <div className="markt-nieuws-img-wrap">
          <img src={artikel.afbeelding} alt="" className="markt-nieuws-img" onError={e => { e.target.style.display = 'none'; }} />
        </div>
      )}
      <div className="markt-nieuws-body">
        <div className="markt-nieuws-bron">{artikel.bron}</div>
        <div className="markt-nieuws-titel">{artikel.titel}</div>
      </div>
    </a>
  );
}

// ── Custom tooltip voor grafiek ───────────────────────────────────────────────
function GrafiekTooltip({ active, payload, periode }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const label = periode === '1d' ? fmtTijd(d.t) : fmtDatum(d.t);
  return (
    <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtPrijs(d.v)}</div>
    </div>
  );
}


// ── Index Detail Pagina ───────────────────────────────────────────────────────
function IndexDetailPagina({ index, onTerug }) {
  const [periode, setPeriode] = useState('1d');
  const [grafiekData, setGrafiekData] = useState([]);
  const [laden, setLaden] = useState(true);
  const [info, setInfo] = useState(null);
  const [aandelenTab, setAandelenTab] = useState('az');
  const [aandelenData, setAandelenData] = useState([]);
  const [aandelenLaden, setAandelenLaden] = useState(true);

  const subindexMap = {
    '^BFX': 'bel20', 'BELM.BR': 'bel-midcap', 'BELS.BR': 'bel-smallcap',
    '^AEX': 'aex', '^FCHI': 'cac40', '^GDAXI': 'dax',
    '^FTSE': 'ftse100', '^STOXX50E': 'stoxx50',
    '^GSPC': 'sp500', '^NDX': 'nasdaq100', '^DJI': 'dowjones',
  };
  const subindex = subindexMap[index.symbol];

  const PERIODES = ['bel-midcap','bel-smallcap'].includes(subindex) ? [
    { id: '1d', label: 'Intraday' },
    { id: '1w', label: '1 W' },
    { id: 'max', label: 'Max' },
  ] : [
    { id: '1d', label: 'Intraday' },
    { id: '1w', label: '1 W' },
    { id: '1m', label: '1M' },
    { id: '3m', label: '3M' },
    { id: '6m', label: '6M' },
    { id: '1j', label: '1J' },
    { id: '3j', label: '3J' },
    { id: '5j', label: '5J' },
    { id: 'ytd', label: 'YTD' },
    { id: 'max', label: 'Max' },
  ];

  // Laad grafiek via aandelen-regio (zelfde endpoint als AandelenPagina)
  useEffect(() => {
    const laad = async () => {
      setLaden(true);
      try {
        const maandKortG = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
        const periodeMap = { '1d':'1D','1w':'1W','1m':'1M','3m':'3M','6m':'6M','1j':'1J','3j':'3J','5j':'5J','ytd':'YTD','max':'Max' };

        if (subindex && ['1d','1w'].includes(periode)) {
          // Intraday en 1W: gebruik aandelen-regio (heeft 5m/1h data)
          const r = await fetch(`/api/data?endpoint=aandelen-regio&subindex=${subindex}&periode=${periode}`);
          const d = await r.json();
          const grafiek = d?.grafiek || [];
          setGrafiekData(grafiek.map(p => {
            const dt = new Date(p.t);
            const label = periode === '1d'
              ? dt.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
              : `${dt.getDate()} ${maandKortG[dt.getMonth()]}`;
            return { t: p.t, v: p.v, label };
          }).filter(p => p.v != null));
        } else {
          // Max en alle andere periodes: candle endpoint
          const tijdperk = periodeMap[periode] || '1D';
          const r = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(index.symbol)}&tijdperk=${tijdperk}`);
          const d = await r.json();
          const punten = d?.punten || [];
          if (punten.length > 1) {
            setGrafiekData(punten.map(p => ({
              t: new Date(p.datum).getTime(),
              v: p.prijs,
              label: p.label
            })).filter(p => p.v != null));
          } else {
            // Fallback: probeer via aandelen-regio als candle faalt
            try {
              const r2 = await fetch(`/api/data?endpoint=aandelen-regio&subindex=${subindex}&periode=${periode}`);
              const d2 = await r2.json();
              const grafiek2 = d2?.grafiek || [];
              setGrafiekData(grafiek2.map(p => ({
                t: p.t, v: p.v,
                label: (() => { const dt = new Date(p.t); return `${dt.getDate()} ${maandKortG[dt.getMonth()]}`; })()
              })).filter(p => p.v != null));
            } catch { setGrafiekData([]); }
          }
        }
      } catch { setGrafiekData([]); }
      finally { setLaden(false); }
    };
    laad();
  }, [index.symbol, periode]);

  // Laad aandelen voor deze index
  useEffect(() => {
    if (!subindex) { setAandelenLaden(false); return; }
    setAandelenLaden(true);
    fetch(`/api/data?endpoint=aandelen-regio&subindex=${subindex}&periode=1d`)
      .then(r => r.json())
      .then(d => {
        setAandelenData(d?.alleQuotes || []);
        setAandelenLaden(false);
      })
      .catch(() => setAandelenLaden(false));
  }, [index.symbol]);

  const positief = index.change >= 0;
  const grafiekKleur = positief ? '#3b82f6' : 'var(--red)';
  const min = grafiekData.length ? Math.min(...grafiekData.map(d => d.v)) : 0;
  const max = grafiekData.length ? Math.max(...grafiekData.map(d => d.v)) : 0;

  return (
    <div className="markten-pagina">
      {/* Topbalk */}
      <div className="aandelen-topbalk">
        <button className="aandelen-terug-knop" onClick={onTerug}>← Markten</button>
      </div>

      <div style={{ padding: '0 32px 48px' }}>
        {/* ── Bovenste blok: naam + koers + meta ── */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
          {/* Naam + icoon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8, background: 'var(--bg-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
              border: '1px solid var(--border)'
            }}>EQ</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{index.naam}</h1>
          </div>

          {/* Koers + wijziging + tijdstip */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: 30, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: positief ? 'var(--green)' : 'var(--red)' }}>
              {fmtPrijs(index.prijs)}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: positief ? 'var(--green)' : 'var(--red)' }}>
              {positief ? '+' : ''}{(index.verschil || 0).toFixed(2)} / {fmtPct(index.change)}
            </span>

          </div>



          {/* Meta: beurs + symbool + ISIN + valuta */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>{(() => {
                const b = (index.beurs || '').toLowerCase();
                if (b.includes('paris') || b.includes('euronext paris')) return '🇫🇷';
                if (b.includes('amsterdam')) return '🇳🇱';
                if (b.includes('london') || b.includes('lse')) return '🇬🇧';
                if (b.includes('xetra') || b.includes('frankfurt') || b.includes('germany')) return '🇩🇪';
                if (b.includes('milan') || b.includes('borsa italiana')) return '🇮🇹';
                if (b.includes('madrid') || b.includes('spain')) return '🇪🇸';
                if (b.includes('zurich') || b.includes('swiss') || b.includes('six')) return '🇨🇭';
                if (b.includes('tokyo') || b.includes('japan')) return '🇯🇵';
                if (b.includes('hong kong')) return '🇭🇰';
                if (b.includes('nasdaq') || b.includes('nyse') || b.includes('new york')) return '🇺🇸';
                return '🇧🇪'; // default Brussel
              })()}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{(() => {
                const b = (index.beurs || '').toLowerCase();
                if (b.includes('paris') || b === 'par') return 'Paris';
                if (b.includes('amsterdam') || b === 'ams') return 'Amsterdam';
                if (b.includes('london') || b === 'lse') return 'London';
                if (b.includes('xetra') || b === 'ger' || b === 'xetr') return 'Frankfurt';
                if (b.includes('milan') || b === 'mil') return 'Milan';
                if (b.includes('nasdaq')) return 'Nasdaq';
                if (b.includes('nyse') || b === 'nyse') return 'New York';
                if (b.includes('brussels') || b === 'bru') return 'Brussels';
                if (b.includes('swiss') || b === 'swx') return 'Zurich';
                return index.beurs || 'Brussels';
              })()}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                <span style={{ color: 'var(--green)', fontWeight: 500 }}>Open</span>
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Symb. <strong style={{ color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{index.symbol}</strong>
            </div>
            {index.isin && (
              <div style={{ color: 'var(--text-muted)' }}>
                ISIN <strong style={{ color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{index.isin}</strong>
              </div>
            )}
            <div style={{ color: 'var(--text-muted)' }}>
              Valuta <strong style={{ color: 'var(--text-primary)' }}>{index.valuta || 'EUR'}</strong>
            </div>
            <div style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>
              15 minuten vertraging
            </div>
          </div>
        </div>

        {/* Grafiek kaart */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>


          {/* Periode tabs */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 16, flexWrap: 'wrap' }}>
            {PERIODES.map(p => (
              <button key={p.id} onClick={() => setPeriode(p.id)} style={{
                padding: '6px 12px', border: 'none', borderRadius: 6,
                background: periode === p.id ? 'var(--accent)' : 'transparent',
                color: periode === p.id ? 'white' : 'var(--text-muted)',
                fontSize: 13, fontWeight: periode === p.id ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{p.label}</button>
            ))}
          </div>

          {/* Grafiek */}
          <div style={{ height: 300 }}>
            {laden ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Laden...
              </div>
            ) : grafiekData.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Geen data beschikbaar
              </div>
            ) : (() => {
              // Nette Y-as ticks (zelfde logica als Overzicht)
              const vals = grafiekData.map(d => d.v).filter(Boolean);
              const bodem = Math.min(...vals);
              const top = Math.max(...vals);
              const bereik = top - bodem;
              let yDomain, yTicks;
              if (bereik === 0) {
                yDomain = [0, top * 1.2];
                yTicks = undefined;
              } else {
                const doelTicks = 5;
                const ruwStap = bereik / doelTicks;
                const magnitude = Math.pow(10, Math.floor(Math.log10(ruwStap)));
                const gen = ruwStap / magnitude;
                const niceStap = gen < 1.5 ? magnitude : gen < 3.5 ? 2 * magnitude : gen < 7.5 ? 5 * magnitude : 10 * magnitude;
                const axisMin = Math.floor(bodem / niceStap) * niceStap;
                const axisMax = Math.ceil(top / niceStap) * niceStap;
                yDomain = [axisMin, axisMax];
                yTicks = [];
                for (let t = axisMin; t <= axisMax + niceStap * 0.01; t += niceStap) yTicks.push(Math.round(t));
              }
              const maandKort = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
              let xTicks, xTickFormatter;

              if (periode === '1d') {
                // Intraday: toon per uur
                const gezienUur = new Set();
                xTicks = grafiekData.filter(d => {
                  if (!d.t) return false;
                  const uur = new Date(d.t).getHours();
                  if (gezienUur.has(uur)) return false;
                  gezienUur.add(uur); return true;
                }).map(d => d.label);
                xTickFormatter = v => v;

              } else if (periode === '1w') {
                // 1W: elke handelsdag
                const gezienDag = new Set();
                xTicks = grafiekData.filter(d => {
                  if (!d.t) return false;
                  const dag = new Date(d.t).toDateString();
                  if (gezienDag.has(dag)) return false;
                  gezienDag.add(dag); return true;
                }).map(d => d.label);
                xTickFormatter = v => v;

              } else if (['1m','3m'].includes(periode)) {
                const ms = (periode === '1m' ? 7 : 14) * 86400000;
                const gezien = new Set();
                xTicks = grafiekData.filter(d => {
                  if (!d.t) return false;
                  const k = Math.floor(new Date(d.t).getTime() / ms);
                  if (gezien.has(k)) return false;
                  gezien.add(k); return true;
                }).map(d => d.label);
                xTickFormatter = label => {
                  const p = grafiekData.find(d => d.label === label);
                  if (!p?.t) return label;
                  const dt = new Date(p.t);
                  return `${dt.getDate()} ${maandKort[dt.getMonth()]}`;
                };

              } else if (['6m','1j','ytd'].includes(periode)) {
                const gezien = new Set();
                xTicks = grafiekData.filter(d => {
                  if (!d.t) return false;
                  const dt = new Date(d.t);
                  const k = `${dt.getFullYear()}-${dt.getMonth()}`;
                  if (gezien.has(k)) return false;
                  gezien.add(k); return true;
                }).map(d => d.label);
                xTickFormatter = label => {
                  const p = grafiekData.find(d => d.label === label);
                  if (!p?.t) return label;
                  const dt = new Date(p.t);
                  return dt.getMonth() === 0 ? `jan '${String(dt.getFullYear()).slice(2)}` : maandKort[dt.getMonth()];
                };

              } else {
                // Max: gewoon elk jaar tonen via tickFormatter
                xTicks = undefined;
                xTickFormatter = lbl => {
                  const m = String(lbl).match(/\d{4}/);
                  return m ? m[0] : '';
                };
              }

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={grafiekData} margin={{ top: 5, right: 8, bottom: 5, left: 8 }}>
                    <defs>
                      <linearGradient id="indexGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={grafiekKleur} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={grafiekKleur} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={xTickFormatter || (v => v)}
                      interval={Math.floor(grafiekData.length / 6)}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => v.toLocaleString('nl-BE')}
                      domain={yDomain} ticks={yTicks} width={55}
                    />
                    <Tooltip content={<GrafiekTooltip periode={periode} />} />
                    <Area
                      type="monotone" dataKey="v"
                      stroke={grafiekKleur} strokeWidth={2}
                      fill="url(#indexGrad)" dot={false} activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>

        {/* Aandelentabel */}
        {(aandelenLaden || aandelenData.length > 0) && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            {/* Tab navigatie */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
              {[
                { id: 'az', label: 'A-Z' },
                { id: 'stijgers', label: 'Stijgers' },
                { id: 'dalers', label: 'Dalers' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setAandelenTab(tab.id)} style={{
                  padding: '12px 16px', border: 'none', background: 'transparent',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  color: aandelenTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: aandelenTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer', marginBottom: -1,
                }}>{tab.label}</button>
              ))}
            </div>

            {/* Tabelhoofden */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
              padding: '8px 24px', background: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border-light)',
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <span>Instrument</span>
              <span style={{ textAlign: 'right' }}>Laatst verh.</span>
              <span style={{ textAlign: 'right' }}>Verschil</span>
              <span style={{ textAlign: 'right' }}>%1D koers</span>
              <span style={{ textAlign: 'right' }}>Open</span>
              <span style={{ textAlign: 'right' }}>Hoog</span>
              <span style={{ textAlign: 'right' }}>Laag</span>
              <span style={{ textAlign: 'right' }}>Volume</span>
              <span style={{ textAlign: 'right' }}>Markt</span>
            </div>

            {/* Rijen */}
            {aandelenLaden ? (
              Array(5).fill(null).map((_, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                  {Array(9).fill(null).map((_, j) => (
                    <div key={j} style={{ height: 14, background: 'var(--bg-subtle)', borderRadius: 4, margin: '0 4px' }} />
                  ))}
                </div>
              ))
            ) : (() => {
              const gesorteerd = [...aandelenData].sort((a, b) => {
                if (aandelenTab === 'az') return (a.naam || '').localeCompare(b.naam || '', 'nl');
                if (aandelenTab === 'stijgers') return (parseFloat(b.change) || 0) - (parseFloat(a.change) || 0);
                if (aandelenTab === 'dalers') return (parseFloat(a.change) || 0) - (parseFloat(b.change) || 0);
                if (aandelenTab === 'marktkap') {
                  // Gebruik marktKap als beschikbaar, anders prijs als proxy
                  const kapA = a.marktKap > 0 ? a.marktKap : (a.prijs || 0);
                  const kapB = b.marktKap > 0 ? b.marktKap : (b.prijs || 0);
                  return kapB - kapA;
                }
                return 0;
              });
              return gesorteerd.map((a, i) => {
                const pos = a.change >= 0;
                const fmtVol = v => v >= 1e9 ? (v/1e9).toFixed(2)+'mld.' : v >= 1e6 ? (v/1e6).toFixed(2)+'mln.' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : v.toString();
                return (
                  <div key={a.symbol} style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
                    padding: '11px 24px',
                    borderBottom: i < gesorteerd.length - 1 ? '1px solid var(--border-light)' : 'none',
                    alignItems: 'center', fontSize: 13,
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Naam */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: '#f59e0b', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4 }}>EQ</span>
                      <span style={{ fontWeight: 500 }}>{a.naam}</span>
                    </div>
                    {/* Laatste */}
                    <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>
                      {a.prijs != null ? (a.prijs < 0.1 ? a.prijs.toFixed(4) : a.prijs < 1 ? a.prijs.toFixed(3) : a.prijs.toFixed(2)) : '—'}
                    </div>
                    {/* Verschil */}
                    <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 500,
                      color: a.verschil == null || Math.abs(a.verschil) < 0.0005 ? 'var(--text-primary)' : pos ? 'var(--green)' : 'var(--red)' }}>
                      {a.verschil != null ? (() => {
                        const v = Math.abs(a.verschil);
                        if (v < 0.0005) return '0,00';
                        const dec = v < 0.001 ? 4 : v < 0.01 ? 4 : v < 0.1 ? 3 : 2;
                        return (a.verschil > 0 ? '+' : '') + a.verschil.toFixed(dec);
                      })() : '—'}
                    </div>
                    {/* % */}
                    <div style={{ textAlign: 'right', fontWeight: 600, color: a.change === 0 || Math.abs(a.change || 0) < 0.005 ? 'var(--text-primary)' : pos ? 'var(--green)' : 'var(--red)' }}>
                      {a.change != null ? (a.change === 0 || Math.abs(a.change) < 0.005 ? '0,00%' : (pos ? '+' : '') + a.change.toFixed(2) + '%') : '—'}
                    </div>
                    {/* Open */}
                    <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>{a.open?.toFixed(2) || '—'}</div>
                    {/* Hoog */}
                    <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>{a.hoog?.toFixed(2) || '—'}</div>
                    {/* Laag */}
                    <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>{a.laag?.toFixed(2) || '—'}</div>
                    {/* Volume */}
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{a.volume ? fmtVol(a.volume) : '—'}</div>
                    {/* Markt */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                        {a.beurs || 'BRU'}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}


      </div>
    </div>
  );
}

// ── Aandelen subpagina ────────────────────────────────────────────────────────
function AandelenPagina({ actieveRegio, onToonAlles }) {
  const subindices = SUBINDICES[actieveRegio] || SUBINDICES['lokaal'];
  const [actieveSub, setActieveSub] = useState(subindices[0].id);
  const [periode, setPeriode] = useState('1d');
  const [data, setData] = useState(null);
  const [laden, setLaden] = useState(true);

  // Reset subindex als regio wisselt
  useEffect(() => {
    const subs = SUBINDICES[actieveRegio] || SUBINDICES['lokaal'];
    setActieveSub(subs[0].id);
  }, [actieveRegio]);

  const laadData = useCallback(async (regio, sub, per) => {
    setLaden(true);
    try {
      const r = await fetch(`/api/data?endpoint=aandelen-regio&regio=${regio}&subindex=${sub}&periode=${per}`);
      const d = await r.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    laadData(actieveRegio, actieveSub, periode);
  }, [actieveRegio, actieveSub, periode, laadData]);

  const subLabel = subindices.find(s => s.id === actieveSub)?.label || '';
  const positief = data ? (data.huidigePrijs >= data.prevClose) : true;
  const grafiekKleur = positief ? '#3b82f6' : 'var(--red)';

  return (
    <div className="aandelen-pagina">
      {/* Sub-index tabs */}
      <div className="aandelen-sub-tabs">
        {subindices.map(sub => (
          <button
            key={sub.id}
            className={`aandelen-sub-tab ${actieveSub === sub.id ? 'actief' : ''}`}
            onClick={() => setActieveSub(sub.id)}
          >
            {sub.label}
          </button>
        ))}
      </div>

      <div className="aandelen-content">
        {/* Linker kolom: grafiek */}
        <div className="aandelen-grafiek-kolom">
          <div className="aandelen-grafiek-kaart">
            <div className="aandelen-grafiek-header">
              <span className="aandelen-grafiek-titel">Grafiek</span>
              <div className="aandelen-periode-knoppen">
                {((['bel-midcap','bel-smallcap'].includes(actieveSub))
                  ? PERIODES.filter(p => ['1d','1w','max'].includes(p.id))
                  : PERIODES
                ).map(p => (
                  <button
                    key={p.id}
                    className={`aandelen-periode-knop ${periode === p.id ? 'actief' : ''}`}
                    onClick={() => setPeriode(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {laden ? (
              <div className="aandelen-grafiek-skeleton" />
            ) : data && data.grafiek.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={data.grafiek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grafiekGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={grafiekKleur} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={grafiekKleur} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="t"
                    tickFormatter={t => periode === '1d' ? fmtTijd(t) : fmtDatum(t)}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={60}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => fmtPrijs(v, 0)}
                    width={70}
                  />
                  <Tooltip content={<GrafiekTooltip periode={periode} />} />
                  {data.prevClose > 0 && (
                    <ReferenceLine y={data.prevClose} stroke="var(--text-muted)" strokeDasharray="4 3" strokeWidth={1} />
                  )}
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={grafiekKleur}
                    strokeWidth={2}
                    fill="url(#grafiekGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: grafiekKleur }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Geen grafiekdata beschikbaar
              </div>
            )}
          </div>
        </div>

        {/* Rechter kolom: best/minst presterend */}
        <div className="aandelen-ranking-kolom">
          <RankingTabel
            titel="Best presterend"
            rijen={data?.stijgers || []}
            alleRijen={data?.alleQuotes || []}
            laden={laden}
            periode={periode}
            omgekeerd={false}
            onToonAlles={() => onToonAlles('Best presterend', data?.alleQuotes || [], periode, false)}
          />
          <RankingTabel
            titel="Minst presterend"
            rijen={data?.dalers || []}
            alleRijen={data?.alleQuotes || []}
            laden={laden}
            periode={periode}
            omgekeerd={true}
            onToonAlles={() => onToonAlles('Minst presterend', data?.alleQuotes || [], periode, true)}
          />
        </div>
      </div>


    </div>
  );
}

function RankingTabel({ titel, rijen, alleRijen, laden, periode, omgekeerd, onToonAlles }) {
  const periodeLabels = { '1d':'1D','1w':'1W','1m':'1M','3m':'3M','6m':'6M','1j':'1J','3j':'3J','5j':'5J','ytd':'YTD','max':'Max' };
  const pLabel = periodeLabels[periode] || '1D';

  return (
    <div className="ranking-tabel-kaart">
      <div className="ranking-tabel-header">
        <span className="ranking-tabel-titel">{titel}</span>
        {!laden && (alleRijen?.length > 5) && (
          <button
            onClick={onToonAlles}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontSize: 12, fontWeight: 600, padding: 0,
            }}
          >
            Toon alles
          </button>
        )}
      </div>
      <table className="ranking-tabel">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>{`%${pLabel}`} koers</th>
            <th>Laatste</th>
            <th>Valuta</th>
          </tr>
        </thead>
        <tbody>
          {laden ? Array(5).fill(null).map((_, i) => (
            <tr key={i}>
              <td><div className="tabel-skeleton" style={{ width: '80%' }} /></td>
              <td><div className="tabel-skeleton" style={{ width: 40 }} /></td>
              <td><div className="tabel-skeleton" style={{ width: 40 }} /></td>
              <td><div className="tabel-skeleton" style={{ width: 30 }} /></td>
            </tr>
          )) : rijen.map((r, i) => (
            <tr key={i}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="markt-cat-badge-sm" style={{ background: '#f59e0b' }}>EQ</span>
                  {r.naam}
                </div>
              </td>
              <td className={r.change >= 0 ? 'cel-groen' : 'cel-rood'}>{fmtPct(r.change)}</td>
              <td>{fmtPrijs(r.prijs)}</td>
              <td style={{ color: 'var(--text-muted)' }}>{r.valuta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AandelenTabel({ titel, rijen, alleRijen, laden, kolom, waardeKey, omgekeerd }) {
  const [toonAlles, setToonAlles] = useState(false);

  const getoondRijen = toonAlles
    ? [...(alleRijen || [])].sort((a, b) => omgekeerd
        ? (a[waardeKey] ?? 0) - (b[waardeKey] ?? 0)
        : (b[waardeKey] ?? 0) - (a[waardeKey] ?? 0)
      )
    : rijen;

  return (
    <div className="aandelen-tabel-kaart">
      <div className="aandelen-tabel-header">
        <span className="aandelen-tabel-titel">{titel}</span>
        {!laden && (alleRijen?.length > 5) && (
          <button
            onClick={() => setToonAlles(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontSize: 12, fontWeight: 600, padding: 0,
            }}
          >
            {toonAlles ? 'Toon minder' : 'Toon alles'}
          </button>
        )}
      </div>
      <table className="aandelen-tabel">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Laatste</th>
            <th>{kolom}</th>
          </tr>
        </thead>
        <tbody>
          {laden ? Array(5).fill(null).map((_, i) => (
            <tr key={i}>
              <td><div className="tabel-skeleton" style={{ width: '70%' }} /></td>
              <td><div className="tabel-skeleton" style={{ width: 50 }} /></td>
              <td><div className="tabel-skeleton" style={{ width: 50 }} /></td>
            </tr>
          )) : getoondRijen.map((r, i) => (
            <tr key={i}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="markt-cat-badge-sm" style={{ background: '#f59e0b' }}>EQ</span>
                  {r.naam}
                </div>
              </td>
              <td>{fmtPrijs(r.prijs)}</td>
              <td className={r[waardeKey] >= 0 ? 'cel-groen' : 'cel-rood'}>{fmtPct(r[waardeKey])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {toonAlles && !laden && (
        <div style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          {getoondRijen.length} aandelen
        </div>
      )}
    </div>
  );
}

// ── Volledige aandelen lijst pagina ──────────────────────────────────────────
function VolledigeLijstPagina({ titel, rijen, periode, omgekeerd, onTerug }) {
  const periodeLabels = { '1d':'1D','1w':'1W','1m':'1M','3m':'3M','6m':'6M','1j':'1J','3j':'3J','5j':'5J','ytd':'YTD','max':'Max' };
  const pLabel = periodeLabels[periode] || '1D';

  const gesorteerd = [...rijen].sort((a, b) => omgekeerd
    ? (a.change ?? 0) - (b.change ?? 0)
    : (b.change ?? 0) - (a.change ?? 0)
  );

  return (
    <div className="markten-pagina">
      <div className="aandelen-topbalk">
        <button className="aandelen-terug-knop" onClick={onTerug}>
          ← Aandelen
        </button>
        <h2 className="aandelen-titel">{titel}</h2>
      </div>

      <div style={{ padding: '0 0 24px' }}>
        <table className="ranking-tabel" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Instrument</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{`%${pLabel} koers`}</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Laatste</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Valuta</th>
            </tr>
          </thead>
          <tbody>
            {gesorteerd.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="markt-cat-badge-sm" style={{ background: '#f59e0b' }}>EQ</span>
                    <span style={{ fontWeight: 500 }}>{r.naam}</span>
                  </div>
                </td>
                <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: r.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmtPct(r.change)}
                </td>
                <td style={{ textAlign: 'right', padding: '12px 16px' }}>{fmtPrijs(r.prijs)}</td>
                <td style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{r.valuta}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
          {gesorteerd.length} aandelen
        </div>
      </div>
    </div>
  );
}



// ── Belgisch Marktoverzicht ───────────────────────────────────────────────────
const TABEL_UITLEG = {
  populariteit: 'Gerangschikt op gemiddeld handelsvolume van de afgelopen 3 maanden. Meest verhandelde Belgische aandelen bovenaan, ongeacht of ze stijgen of dalen.',
  stijgers1M:   'De 5 Belgische aandelen met de hoogste procentuele stijging over de afgelopen maand.',
  dalers1M:     'De 5 Belgische aandelen met de grootste procentuele daling over de afgelopen maand.',
  consensus:    'Aandelen met het hoogste verwachte rendement op basis van het gemiddelde analistendoelprijzen (koersdoel vs. huidige koers).',
  omzetgroei:   'Aandelen met de hoogste omzetgroei over het afgelopen jaar, gebaseerd op de meest recente financiële rapportage.',
};

function InfoIcoon({ type }) {
  const [zichtbaar, setZichtbaar] = useState(false);
  return (
    <div className="info-icoon-wrap">
      <button
        className="info-icoon-knop"
        onMouseEnter={() => setZichtbaar(true)}
        onMouseLeave={() => setZichtbaar(false)}
        onClick={() => setZichtbaar(v => !v)}
        title="Uitleg"
      >
        ℹ
      </button>
      {zichtbaar && (
        <div className="info-tooltip">{TABEL_UITLEG[type]}</div>
      )}
    </div>
  );
}

function MiniTabel({ titel, rijen, laden, kolom1Label, kolom1Key, uitlegType }) {
  return (
    <div className="belg-tabel-kaart">
      <div className="belg-tabel-header">
        <span>{titel}</span>
        <InfoIcoon type={uitlegType} />
      </div>
      <table className="belg-tabel">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Laatste</th>
            <th>{kolom1Label}</th>
          </tr>
        </thead>
        <tbody>
          {laden ? Array(5).fill(null).map((_, i) => (
            <tr key={i}>
              <td><div className="tabel-skeleton" style={{ width: '70%' }} /></td>
              <td><div className="tabel-skeleton" style={{ width: 50 }} /></td>
              <td><div className="tabel-skeleton" style={{ width: 50 }} /></td>
            </tr>
          )) : rijen.map((r, i) => (
            <tr key={i}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="markt-cat-badge-sm" style={{ background: '#f59e0b' }}>EQ</span>
                  <span style={{ fontSize: 12 }}>{r.naam}</span>
                </div>
              </td>
              <td style={{ fontSize: 12 }}>{r.prijs ? r.prijs.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
              <td className={r[kolom1Key] >= 0 ? 'cel-groen' : 'cel-rood'} style={{ fontSize: 12, fontWeight: 600 }}>
                {r[kolom1Key] !== undefined ? (r[kolom1Key] >= 0 ? '+' : '') + r[kolom1Key].toFixed(2) + '%' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BelgischOverzicht() {
  const [data, setData] = useState(null);
  const [laden, setLaden] = useState(true);
  const [cached, setCached] = useState(null);
  const [cachedLaden, setCachedLaden] = useState(true);

  useEffect(() => {
    fetch('/api/data?endpoint=belgisch-overzicht')
      .then(r => r.json())
      .then(d => { setData(d); setLaden(false); })
      .catch(() => setLaden(false));

    fetch('/api/cron-markten?lees=1')
      .then(r => r.json())
      .then(d => { setCached(d); setCachedLaden(false); })
      .catch(() => setCachedLaden(false));
  }, []);

  return (
    <div className="belg-overzicht">
      <div className="markten-divider" style={{ margin: '24px 0 20px' }} />
      <div className="belg-grid belg-grid-5">
        <MiniTabel
          titel="Populariteit"
          rijen={data?.populariteit || []}
          laden={laden}
          kolom1Label="%1D koers"
          kolom1Key="change1D"
          uitlegType="populariteit"
        />
        <MiniTabel
          titel="Grootste stijgers (1M)"
          rijen={data?.stijgers1M || []}
          laden={laden}
          kolom1Label="%1M koers"
          kolom1Key="change1M"
          uitlegType="stijgers1M"
        />
        <MiniTabel
          titel="Grootste dalers (1M)"
          rijen={data?.dalers1M || []}
          laden={laden}
          kolom1Label="%1M koers"
          kolom1Key="change1M"
          uitlegType="dalers1M"
        />
        <MiniTabel
          titel="Beste consensusprognose"
          rijen={cached?.consensusprognose || []}
          laden={cachedLaden}
          kolom1Label="Koersdoel-rend."
          kolom1Key="koersdoelRendement"
          uitlegType="consensus"
        />
        <MiniTabel
          titel="Beste omzetgroei (1J)"
          rijen={cached?.omzetgroei || []}
          laden={cachedLaden}
          kolom1Label="Omzetgroei 1J"
          kolom1Key="omzetgroei1J"
          uitlegType="omzetgroei"
        />
      </div>
    </div>
  );
}


// ── Markten overzicht tabellen ────────────────────────────────────────────────
function MarktenOverzichtTabellen() {
  const [data, setData] = useState(null);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    fetch('/api/data?endpoint=markten-overzicht')
      .then(r => r.json())
      .then(d => { setData(d); setLaden(false); })
      .catch(() => setLaden(false));
  }, []);

  const fmtPrijs = (v) => v ? v.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const fmtPct = (v) => {
    if (v === undefined || v === null) return '—';
    if (v === 0 || (Math.abs(v) < 0.005)) return '0,00%';
    return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  };

  const OverzichtTabel = ({ titel, rijen, kleurKey, uitleg }) => {
    const [tooltip, setTooltip] = useState(false);
    return (
      <div className="overzicht-tabel-kaart">
        <div className="overzicht-tabel-header">
          <span>{titel}</span>
          <div className="info-icoon-wrap">
            <button className="info-icoon-knop"
              onMouseEnter={() => setTooltip(true)}
              onMouseLeave={() => setTooltip(false)}
            >ℹ</button>
            {tooltip && <div className="info-tooltip">{uitleg}</div>}
          </div>
        </div>
        <table className="overzicht-tabel">
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Laatste</th>
              <th>%1D</th>
            </tr>
          </thead>
          <tbody>
            {laden ? Array(5).fill(null).map((_, i) => (
              <tr key={i}>
                <td><div className="tabel-skeleton" style={{ width: '60%' }} /></td>
                <td><div className="tabel-skeleton" style={{ width: 50 }} /></td>
                <td><div className="tabel-skeleton" style={{ width: 50 }} /></td>
              </tr>
            )) : (rijen || []).map((r, i) => (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="markt-cat-badge-sm" style={{ background: '#f59e0b' }}>EQ</span>
                    <span>{r.naam}</span>
                  </div>
                </td>
                <td>{fmtPrijs(r.prijs)}</td>
                <td className={r.change1D >= 0 ? 'cel-groen' : 'cel-rood'} style={{ fontWeight: 600 }}>
                  {fmtPct(r.change1D)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="markten-overzicht-grid">
      <OverzichtTabel
        titel="Stijgers BE"
        rijen={data?.stijgersBE}
        uitleg="De 5 Belgische aandelen met de hoogste procentuele stijging vandaag."
      />
      <OverzichtTabel
        titel="Dalers BE"
        rijen={data?.dalersBE}
        uitleg="De 5 Belgische aandelen met de grootste procentuele daling vandaag."
      />
      <OverzichtTabel
        titel="Meest populair BE"
        rijen={data?.populairBE}
        uitleg="De meest verhandelde Belgische aandelen op basis van gemiddeld dagvolume over de afgelopen 3 maanden."
      />
      <OverzichtTabel
        titel="Meest populair internationaal"
        rijen={data?.populairIntl}
        uitleg="De meest verhandelde internationale aandelen op basis van gemiddeld dagvolume over de afgelopen 3 maanden."
      />
    </div>
  );
}


// ── ETF Pagina ────────────────────────────────────────────────────────────────
const ETF_TABS = [
  { id: 'aandelen',   label: 'Aandelen ETFs' },
  { id: 'obligaties', label: 'Obligatie ETFs' },
  { id: 'gemengd',    label: 'Gemengde ETFs' },
  { id: 'valuta',     label: 'Valuta fondsen' },
];

function fmtPctEtf(v) {
  if (v === null || v === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  if (v === 0 || Math.abs(v) < 0.005) return <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>0,00%</span>;
  const kleur = v > 0 ? 'var(--green)' : 'var(--red)';
  return <span style={{ color: kleur, fontWeight: 600 }}>{(v > 0 ? '+' : '') + v.toFixed(2) + '%'}</span>;
}

// Openingstijden per beurs (lokale tijd van de beurs, UTC offset)
const BEURS_INFO = {
  'Euronext Amsterdam': { open: '09:00', sluit: '17:30', tz: 'Europe/Amsterdam' },
  'Euronext Paris':     { open: '09:00', sluit: '17:30', tz: 'Europe/Paris' },
  'Euronext Milan':     { open: '09:00', sluit: '17:30', tz: 'Europe/Rome' },
  'Xetra':              { open: '09:00', sluit: '17:30', tz: 'Europe/Berlin' },
  'London SE':          { open: '08:00', sluit: '16:30', tz: 'Europe/London' },
  'SIX Swiss':          { open: '09:00', sluit: '17:30', tz: 'Europe/Zurich' },
  'Nasdaq':             { open: '09:30', sluit: '16:00', tz: 'America/New_York' },
  'NYSE Arca':          { open: '09:30', sluit: '16:00', tz: 'America/New_York' },
  'NYSE':               { open: '09:30', sluit: '16:00', tz: 'America/New_York' },
  'BATS':               { open: '09:30', sluit: '16:00', tz: 'America/New_York' },
  'Toronto SE':         { open: '09:30', sluit: '16:00', tz: 'America/Toronto' },
};

function tijdTotOpening(beurs) {
  const info = BEURS_INFO[beurs];
  if (!info) return null;

  const nu = new Date();
  // Huidige tijd in beurszone
  const nuInBeurs = new Date(nu.toLocaleString('en-US', { timeZone: info.tz }));
  const dag = nuInBeurs.getDay(); // 0=zo, 6=za
  const uur = nuInBeurs.getHours();
  const min = nuInBeurs.getMinutes();
  const nuMinuten = uur * 60 + min;

  const [openH, openM] = info.open.split(':').map(Number);
  const [sluitH, sluitM] = info.sluit.split(':').map(Number);
  const openMinuten = openH * 60 + openM;
  const sluitMinuten = sluitH * 60 + sluitM;

  // Weekend
  const isWeekend = dag === 0 || dag === 6;
  // Open?
  const isOpen = !isWeekend && nuMinuten >= openMinuten && nuMinuten < sluitMinuten;

  if (isOpen) return null; // geen tooltip nodig bij open

  // Bereken minuten tot volgende opening
  let minutenTot = 0;
  if (!isWeekend && nuMinuten < openMinuten) {
    // Vandaag nog openen
    minutenTot = openMinuten - nuMinuten;
  } else {
    // Morgen of maandag
    let dagenTot = 1;
    if (dag === 5) dagenTot = 3; // vrijdag → maandag
    if (dag === 6) dagenTot = 2; // zaterdag → maandag
    const minutenRest = 24 * 60 - nuMinuten + openMinuten;
    minutenTot = minutenRest + (dagenTot - 1) * 24 * 60;
  }

  const uren = Math.floor(minutenTot / 60);
  const mins = minutenTot % 60;

  if (isWeekend || dag === 5 && nuMinuten >= sluitMinuten) {
    return `Weekend gesloten · opent ma ${info.open}`;
  }
  return `Opent in ${uren}u ${mins}m · om ${info.open}`;
}

function BeursBolletje({ marktOpen, beurs, marktState }) {
  const [tooltip, setTooltip] = React.useState(false);
  const tijdInfo = !marktOpen ? tijdTotOpening(beurs) : null;

  const stateLabel = marktState === 'PRE'  ? 'Pre-market' :
                     marktState === 'POST' ? 'Nabeurs' :
                     marktOpen             ? 'Open' : 'Gesloten';

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, position: 'relative', cursor: 'default' }}
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: marktOpen ? '#10b981' : marktState === 'PRE' || marktState === 'POST' ? '#f59e0b' : '#ef4444',
      }} />
      <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{beurs || '—'}</span>
      {tooltip && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, zIndex: 999,
          background: '#1e293b', color: '#f1f5f9', borderRadius: 8,
          padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: tijdInfo ? 4 : 0 }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: marktOpen ? '#10b981' : marktState === 'PRE' || marktState === 'POST' ? '#f59e0b' : '#ef4444',
            }} />
            <span style={{ fontWeight: 600 }}>{stateLabel}</span>
            {!marktOpen && (
              <span
                style={{ marginLeft: 8, color: '#94a3b8', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Toon meer
              </span>
            )}
          </div>
          {tijdInfo && (
            <div style={{ color: '#94a3b8', fontSize: 11 }}>
              Next: {tijdInfo}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EtfPagina({ onTerug }) {
  const [actieveTab, setActieveTab] = useState('aandelen');
  const [etfs, setEtfs] = useState([]);
  const [laden, setLaden] = useState(true);
  const [toonAlles, setToonAlles] = useState(false);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    setLaden(true);
    setEtfs([]);
    setToonAlles(false);
    setSortCol(null);
    setSortDir('desc');
    fetch(`/api/data?endpoint=etfs&categorie=${actieveTab}&toonAlles=false`)
      .then(r => r.json())
      .then(d => { setEtfs(Array.isArray(d) ? d : []); setLaden(false); })
      .catch(() => setLaden(false));
  }, [actieveTab]);

  const handleToonAlles = () => {
    setLaden(true);
    setToonAlles(true);
    fetch(`/api/data?endpoint=etfs&categorie=${actieveTab}&toonAlles=true`)
      .then(r => r.json())
      .then(d => { setEtfs(Array.isArray(d) ? d : []); setLaden(false); })
      .catch(() => setLaden(false));
  };

  const handleSort = (col) => {
    if (!toonAlles) return; // alleen sorteren bij toon alles
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const gesorteerdeEtfs = () => {
    if (!sortCol) return etfs;
    return [...etfs].sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (sortCol === 'naam') {
        va = va || '';
        vb = vb || '';
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      va = va ?? -Infinity;
      vb = vb ?? -Infinity;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  };

  const SortIcoon = ({ col }) => {
    if (sortCol !== col) return <span style={{ color: 'var(--border)', marginLeft: 3 }}>↕</span>;
    return <span style={{ marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const fmtKoers = (v, val) => {
    if (!v) return '—';
    return v.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="markten-pagina">
      <div className="aandelen-topbalk">
        <button className="aandelen-terug-knop" onClick={onTerug}>← Markten</button>
        <h2 className="aandelen-titel">ETFs</h2>
      </div>

      <div className="etf-tabs-balk">
        <div className="etf-tabs">
          {ETF_TABS.map(tab => (
            <button
              key={tab.id}
              className={`etf-tab ${actieveTab === tab.id ? 'actief' : ''}`}
              onClick={() => setActieveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="etf-tabel-wrap">
        {!toonAlles && !laden && (
          <div className="etf-toon-alles-balk">
            <button className="etf-toon-alles-knop" onClick={handleToonAlles}>
              Toon alles
            </button>
          </div>
        )}
        <table className="etf-tabel">
          <thead>
            <tr>
              <th onClick={() => handleSort('naam')} style={{ cursor: toonAlles ? 'pointer' : 'default' }}>
                Instrument{toonAlles && <SortIcoon col="naam" />}
              </th>
              <th className="rechts" onClick={() => handleSort('prijs')} style={{ cursor: toonAlles ? 'pointer' : 'default' }}>
                Koers{toonAlles && <SortIcoon col="prijs" />}
              </th>
              <th className="rechts" onClick={() => handleSort('pct1D')} style={{ cursor: toonAlles ? 'pointer' : 'default' }}>
                %1D koers{toonAlles && <SortIcoon col="pct1D" />}
              </th>
              <th className="rechts" onClick={() => handleSort('pct1M')} style={{ cursor: toonAlles ? 'pointer' : 'default' }}>
                % 1M{toonAlles && <SortIcoon col="pct1M" />}
              </th>
              <th className="rechts" onClick={() => handleSort('pct3M')} style={{ cursor: toonAlles ? 'pointer' : 'default' }}>
                % 3M{toonAlles && <SortIcoon col="pct3M" />}
              </th>
              <th className="rechts" onClick={() => handleSort('pct1J')} style={{ cursor: toonAlles ? 'pointer' : 'default' }}>
                % 1J{toonAlles && <SortIcoon col="pct1J" />}
              </th>
              <th className="rechts" onClick={() => handleSort('pct5J')} style={{ cursor: toonAlles ? 'pointer' : 'default' }}>
                % 5J{toonAlles && <SortIcoon col="pct5J" />}
              </th>
              <th className="rechts" onClick={() => handleSort('ter')} style={{ cursor: toonAlles ? 'pointer' : 'default' }}>
                Lopende k.{toonAlles && <SortIcoon col="ter" />}
              </th>
              <th className="rechts">Beurstaks</th>
              <th>Beurs</th>
            </tr>
          </thead>
          <tbody>
            {laden ? Array(10).fill(null).map((_, i) => (
              <tr key={i}>
                {Array(8).fill(null).map((_, j) => (
                  <td key={j}><div className="tabel-skeleton" style={{ width: j === 0 ? '80%' : 50 }} /></td>
                ))}
              </tr>
            )) : gesorteerdeEtfs().map((e, i) => (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="etf-badge">ETF</span>
                    <span className="etf-naam" title={e.naamVolledig || e.naam}>{e.naam}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>{e.symbol}</span>
                  </div>
                </td>
                <td className="rechts">
                  {fmtKoers(e.prijs, e.valuta)}
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>{e.valuta}</span>
                </td>
                <td className="rechts">{fmtPctEtf(e.pct1D)}</td>
                <td className="rechts">{fmtPctEtf(e.pct1M)}</td>
                <td className="rechts">{fmtPctEtf(e.pct3M)}</td>
                <td className="rechts">{fmtPctEtf(e.pct1J)}</td>
                <td className="rechts">{fmtPctEtf(e.pct5J)}</td>
                <td className="rechts" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {e.ter != null ? e.ter.toFixed(2) + '%' : '—'}
                </td>
                <td className="rechts" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {e.tob != null ? e.tob.toFixed(2) + '%' : '0,12%'}
                </td>
                <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                  <BeursBolletje marktOpen={e.marktOpen} beurs={e.beurs} marktState={e.marktState} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!laden && etfs.length === 0 && (
          <p style={{ padding: '24px', color: 'var(--text-muted)', textAlign: 'center' }}>Geen ETFs gevonden.</p>
        )}
        {toonAlles && !laden && etfs.length > 0 && (
          <div style={{
            textAlign: 'right',
            padding: '12px 16px',
            color: 'var(--text-muted)',
            fontSize: 12,
            borderTop: '1px solid var(--border)',
          }}>
            {etfs.length} ETFs in de lijst
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hoofd Markten component ───────────────────────────────────────────────────
export default function Markten() {
  const [actieveRegio, setActieveRegio] = useState('lokaal');
  const [actieveCat, setActieveCat] = useState(null);
  const [indices, setIndices] = useState([]);
  const [nieuws, setNieuws] = useState([]);
  const [ladenIndices, setLadenIndices] = useState(true);
  const [ladenNieuws, setLadenNieuws] = useState(true);
  const [volledigeLijstData, setVolledigeLijstData] = useState(null); // { titel, rijen, periode, omgekeerd }
  const [actieveIndex, setActieveIndex] = useState(null); // index detail pagina

  const laadIndices = useCallback(async (regio) => {
    setLadenIndices(true);
    try {
      const r = await fetch(`/api/data?endpoint=market-indices&regio=${regio}`);
      const d = await r.json();
      setIndices(Array.isArray(d) ? d : []);
    } catch {
      setIndices([]);
    } finally {
      setLadenIndices(false);
    }
  }, []);

  const laadNieuws = useCallback(async () => {
    setLadenNieuws(true);
    try {
      const r = await fetch('/api/data?endpoint=market-news');
      const d = await r.json();
      setNieuws(Array.isArray(d) ? d : []);
    } catch {
      setNieuws([]);
    } finally {
      setLadenNieuws(false);
    }
  }, []);

  useEffect(() => {
    if (!actieveCat) laadIndices(actieveRegio);
  }, [actieveRegio, actieveCat, laadIndices]);

  useEffect(() => {
    if (!actieveCat) laadNieuws();
  }, [actieveCat, laadNieuws]);

  // Als een categorie actief is, toon die subpagina
  // Volledige lijst pagina (aparte pagina, geen aandelen tabs/belgisch overzicht erbij)
  if (actieveIndex) {
    return (
      <IndexDetailPagina
        index={actieveIndex}
        onTerug={() => setActieveIndex(null)}
      />
    );
  }

  if (volledigeLijstData) {
    return (
      <VolledigeLijstPagina
        titel={volledigeLijstData.titel}
        rijen={volledigeLijstData.rijen}
        periode={volledigeLijstData.periode}
        omgekeerd={volledigeLijstData.omgekeerd}
        onTerug={() => setVolledigeLijstData(null)}
      />
    );
  }

  if (actieveCat === 'etfs') {
    return <EtfPagina onTerug={() => setActieveCat(null)} />;
  }

  if (actieveCat === 'aandelen') {
    return (
      <div className="markten-pagina">
        {/* Terug + regio tabs bovenaan */}
        <div className="aandelen-topbalk">
          <button className="aandelen-terug-knop" onClick={() => setActieveCat(null)}>
            ← Markten
          </button>
          <h2 className="aandelen-titel">Stocks</h2>
        </div>
        <div className="markten-regio-tabs" style={{ marginBottom: 0 }}>
          {REGIO_TABS.map(tab => (
            <button
              key={tab.id}
              className={`markten-regio-tab ${actieveRegio === tab.id ? 'actief' : ''}`}
              onClick={() => setActieveRegio(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <AandelenPagina
          actieveRegio={actieveRegio}
          onToonAlles={(titel, rijen, periode, omgekeerd) => setVolledigeLijstData({ titel, rijen, periode, omgekeerd })}
        />
        {actieveRegio === 'lokaal' && <BelgischOverzicht />}
      </div>
    );
  }

  // Standaard markten overzicht
  return (
    <div className="markten-pagina">
      <div className="markten-regio-tabs">
        {REGIO_TABS.map(tab => (
          <button
            key={tab.id}
            className={`markten-regio-tab ${actieveRegio === tab.id ? 'actief' : ''}`}
            onClick={() => setActieveRegio(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="markten-indices-grid">
        {ladenIndices
          ? Array(5).fill(null).map((_, i) => <IndexKaart key={i} index={{}} laden={true} />)
          : indices.map(idx => <IndexKaart key={idx.symbol} index={idx} laden={false} onKlik={setActieveIndex} />)
        }
      </div>

      <div className="markten-divider" />

      {/* Categorie filterbalk */}
      <div className="markten-categorie-balk">
        {CATEGORIEEN.map(cat => (
          <button
            key={cat.id}
            className={`markten-cat-knop ${actieveCat === cat.id ? 'actief' : ''}`}
            onClick={() => ['aandelen','etfs'].includes(cat.id) ? setActieveCat(cat.id) : null}
            title={!['aandelen','etfs'].includes(cat.id) ? 'Binnenkort beschikbaar' : ''}
            style={{ opacity: !['aandelen','etfs'].includes(cat.id) ? 0.6 : 1, cursor: !['aandelen','etfs'].includes(cat.id) ? 'default' : 'pointer' }}
          >
            <span className="markten-cat-badge" style={{ background: cat.kleur }}>{cat.afk}</span>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="markten-divider" />

      <div className="markten-nieuws-sectie">
        <div className="markten-nieuws-header">
          <span className="markten-nieuws-titel-tekst">Belangrijkste nieuws</span>
        </div>
        {ladenNieuws ? (
          <div className="markten-nieuws-grid">
            {Array(6).fill(null).map((_, i) => (
              <div key={i} className="markt-nieuws-kaart markt-nieuws-laden">
                <div className="markt-nieuws-skeleton-img" />
                <div className="markt-nieuws-body">
                  <div className="markt-nieuws-skeleton-bron" />
                  <div className="markt-nieuws-skeleton-titel" />
                </div>
              </div>
            ))}
          </div>
        ) : nieuws.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>Geen nieuws beschikbaar.</p>
        ) : (
          <div className="markten-nieuws-grid">
            {nieuws.map((a, i) => <NieuwsKaart key={i} artikel={a} />)}
          </div>
        )}
      </div>

      <div className="markten-divider" style={{ margin: '28px 0 20px' }} />
      <MarktenOverzichtTabellen />
    </div>
  );
}
