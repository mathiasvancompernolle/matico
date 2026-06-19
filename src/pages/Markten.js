import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Constanten ────────────────────────────────────────────────────────────────
const REGIO_TABS = [
  { id: 'lokaal',        label: 'Lokaal' },
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
  'noord-amerika': [{ id: 'sp500', label: 'S&P 500' }, { id: 'nasdaq', label: 'Nasdaq 100' }],
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
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
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
function IndexKaart({ index, laden }) {
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
    <div className="markt-index-kaart">
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

// ── Aandelen subpagina ────────────────────────────────────────────────────────
function AandelenPagina({ actieveRegio }) {
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
                {PERIODES.map(p => (
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
            laden={laden}
            periode={periode}
          />
          <RankingTabel
            titel="Minst presterend"
            rijen={data?.dalers || []}
            laden={laden}
            periode={periode}
          />
        </div>
      </div>

      {/* Stijgers & dalers breed */}
      <div className="aandelen-tabellen-grid">
        <AandelenTabel
          titel="Grootste stijgers"
          rijen={data?.stijgers || []}
          laden={laden}
          kolom="%1D koers"
          waardeKey="change"
        />
        <AandelenTabel
          titel="Grootste dalers"
          rijen={data?.dalers || []}
          laden={laden}
          kolom="%1D koers"
          waardeKey="change"
        />
      </div>
    </div>
  );
}

function RankingTabel({ titel, rijen, laden, periode }) {
  const periodeLabels = { '1d':'1D','1w':'1W','1m':'1M','3m':'3M','6m':'6M','1j':'1J','3j':'3J','5j':'5J','ytd':'YTD','max':'Max' };
  const pLabel = periodeLabels[periode] || '1D';
  return (
    <div className="ranking-tabel-kaart">
      <div className="ranking-tabel-header">
        <span className="ranking-tabel-titel">{titel}</span>
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

function AandelenTabel({ titel, rijen, laden, kolom, waardeKey }) {
  return (
    <div className="aandelen-tabel-kaart">
      <div className="aandelen-tabel-header">
        <span className="aandelen-tabel-titel">{titel}</span>
      </div>
      <table className="aandelen-tabel">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Laatste verh.</th>
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
          )) : rijen.map((r, i) => (
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
        <AandelenPagina actieveRegio={actieveRegio} />
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
          : indices.map(idx => <IndexKaart key={idx.symbol} index={idx} laden={false} />)
        }
      </div>

      <div className="markten-divider" />

      {/* Categorie filterbalk */}
      <div className="markten-categorie-balk">
        {CATEGORIEEN.map(cat => (
          <button
            key={cat.id}
            className={`markten-cat-knop ${actieveCat === cat.id ? 'actief' : ''}`}
            onClick={() => cat.id === 'aandelen' ? setActieveCat('aandelen') : null}
            title={cat.id !== 'aandelen' ? 'Binnenkort beschikbaar' : ''}
            style={{ opacity: cat.id !== 'aandelen' ? 0.6 : 1, cursor: cat.id !== 'aandelen' ? 'default' : 'pointer' }}
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
    </div>
  );
}
