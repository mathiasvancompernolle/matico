import React, { useState, useEffect, useCallback } from 'react';

const REGIO_TABS = [
  { id: 'lokaal',         label: 'Lokaal' },
  { id: 'europa',         label: 'Europa' },
  { id: 'noord-amerika',  label: 'Noord-Amerika' },
  { id: 'azie-pacific',   label: 'Azië-Pacific' },
];

const CATEGORIEEN = [
  { id: 'aandelen',          label: "Aandelen",          afk: 'EQ',  kleur: '#f59e0b' },
  { id: 'etfs',              label: "ETF's",             afk: 'ETF', kleur: '#10b981' },
  { id: 'beleggingsfondsen', label: "Beleggingsfondsen", afk: 'MF',  kleur: '#8b5cf6' },
  { id: 'obligaties',        label: "Obligaties",        afk: 'BO',  kleur: '#3b82f6' },
];

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
  const prijsStr = index.prijs
    ? index.prijs.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
  const changeStr = index.change !== undefined
    ? (positief ? '+' : '') + index.change.toFixed(2) + '%'
    : '—';
  return (
    <div className="markt-index-kaart">
      <div className="markt-kaart-icon"><span>EQ</span></div>
      <div className="markt-kaart-naam">{index.naam}</div>
      <div className="markt-kaart-sparkline">
        <Sparkline data={index.sparkline} positief={positief} />
      </div>
      <div className="markt-kaart-prijs">{prijsStr}</div>
      <div className={`markt-kaart-change ${positief ? 'positief' : 'negatief'}`}>
        {changeStr} <span className="markt-kaart-periode">1D</span>
      </div>
    </div>
  );
}

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

export default function Markten() {
  const [actieveRegio, setActieveRegio] = useState('lokaal');
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

  useEffect(() => { laadIndices(actieveRegio); }, [actieveRegio, laadIndices]);
  useEffect(() => { laadNieuws(); }, [laadNieuws]);

  const skeletons = Array(5).fill(null);

  return (
    <div className="markten-pagina">
      {/* Regio tabs */}
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

      {/* Indices grid */}
      <div className="markten-indices-grid">
        {ladenIndices
          ? skeletons.map((_, i) => <IndexKaart key={i} index={{}} laden={true} />)
          : indices.map(idx => <IndexKaart key={idx.symbol} index={idx} laden={false} />)
        }
      </div>

      <div className="markten-divider" />

      {/* Categorie filterbalk */}
      <div className="markten-categorie-balk">
        {CATEGORIEEN.map(cat => (
          <button key={cat.id} className="markten-cat-knop" title="Binnenkort beschikbaar">
            <span className="markten-cat-badge" style={{ background: cat.kleur }}>{cat.afk}</span>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="markten-divider" />

      {/* Nieuws */}
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
