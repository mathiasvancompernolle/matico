import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
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
  const fmtPct = (v) => v !== undefined ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%' : '—';

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
  const kleur = v >= 0 ? 'var(--green)' : 'var(--red)';
  return <span style={{ color: kleur, fontWeight: 600 }}>{(v >= 0 ? '+' : '') + v.toFixed(2) + '%'}</span>;
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
                  </div>
                </td>
                <td className="rechts">{fmtKoers(e.prijs, e.valuta)}</td>
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
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: e.marktOpen ? '#10b981' : '#ef4444',
                    marginRight: 5, verticalAlign: 'middle'
                  }} />
                  {e.beurs || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!laden && etfs.length === 0 && (
          <p style={{ padding: '24px', color: 'var(--text-muted)', textAlign: 'center' }}>Geen ETFs gevonden.</p>
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
        <AandelenPagina actieveRegio={actieveRegio} />
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
