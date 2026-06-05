import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { SlidersHorizontal, GitCompare, Plus, ChevronDown, X, Check } from 'lucide-react';
import BeleggingDetail from '../components/BeleggingDetail';

const TIJDPERKEN = ['1D', '1W', '1M', '1J', 'YTD', 'Laatste', 'Totaal'];
const VERGELIJK_OPTIES = [
  { id: 'geen', label: 'Geen vergelijking' },
  { id: 'msci', label: 'MSCI World', symbol: 'ACWI', kleur: '#22c55e' },
  { id: 'sp500', label: 'S&P 500', symbol: 'SPY', kleur: '#f59e0b' },
  { id: 'bel20', label: 'BEL 20', symbol: 'BEL20.BR', kleur: '#8b5cf6' },
  { id: 'bitcoin', label: 'Bitcoin', symbol: 'BINANCE:BTCUSDT', kleur: '#f97316' },
];

function berekendagData(beleggingen, koersen, tijdperk) {
  const nu = Date.now();
  const punten = tijdperk === '1D' ? 8 : tijdperk === '1W' ? 7 : tijdperk === '1M' ? 30 : tijdperk === '1J' ? 12 : 10;
  const data = [];
  for (let i = punten; i >= 0; i--) {
    const datum = new Date(nu - i * (tijdperk === '1D' ? 3600000 : tijdperk === '1W' ? 86400000 : tijdperk === '1M' ? 86400000 : tijdperk === '1J' ? 2592000000 : 86400000 * 3));
    const label = tijdperk === '1D'
      ? datum.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
      : datum.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });

    let waarde = 0;
    beleggingen.forEach(b => {
      const koers = koersen[b.symbol];
      const prijs = koers ? koers.c * (1 + (Math.random() - 0.502) * 0.002 * (punten - i)) : b.kostprijs;
      const factor = getMuntFactor ? getMuntFactor(b.munt || "EUR") : ((b.munt || "EUR") === "USD" ? 0.865 : 1);
      waarde += prijs * b.aantal * factor;
    });
    data.push({ label, waarde: Math.round(waarde * 100) / 100 });
  }
  return data;
}

export default function Overzicht({ onToevoegen }) {
  const { gebruiker, beleggingen, koersen, refreshAlleKoersen, portfolioWaarde, dagWinst, dagWinstPct, getMuntFactor } = useApp();
  const [tijdperk, setTijdperk] = useState('1D');
  const [weergave, setWeergave] = useState('waarde');
  const [grafiekData, setGrafiekData] = useState([]);
  const [vergelijkOpen, setVergelijkOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [vergelijk1, setVergelijk1] = useState('msci');
  const [vergelijk2, setVergelijk2] = useState('geen');
  const [filterType, setFilterType] = useState('alle');
  const [filterSymbolen, setFilterSymbolen] = useState([]);
  const [detailBelegging, setDetailBelegging] = useState(null);
  const [vergelijkDropdown, setVergelijkDropdown] = useState(null);

  const begroeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Goede morgen';
    if (h < 18) return 'Goede middag';
    return 'Goede avond';
  };

  useEffect(() => {
    const data = berekendagData(beleggingen, koersen, tijdperk);
    setGrafiekData(data);
  }, [beleggingen, koersen, tijdperk]);

  useEffect(() => {
    refreshAlleKoersen();
    const interval = setInterval(refreshAlleKoersen, 60000);
    return () => clearInterval(interval);
  }, []);

  const gefilterdeBeleggingen = beleggingen.filter(b => {
    if (filterType !== 'alle' && b.type !== filterType) return false;
    if (filterSymbolen.length > 0 && !filterSymbolen.includes(b.symbol)) return false;
    return true;
  });

  const formatBedrag = (n, munt = 'EUR') => {
    const sym = munt === 'USD' ? '$' : '€';
    return sym + Math.abs(n).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const winstData = grafiekData.map((d, i) => ({
    ...d,
    waarde: i === 0 ? 0 : ((d.waarde - grafiekData[0].waarde) / (grafiekData[0].waarde || 1)) * 100
  }));

  const displayData = weergave === 'waarde' ? grafiekData : winstData;

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>{begroeting()}, {gebruiker.voornaam}</h1>
        <button className="btn btn-primary" onClick={onToevoegen}>
          <Plus size={16} />
          Beleggingen toevoegen
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Tijdperk tabs */}
      <div style={{ padding: '0 32px', marginBottom: 24 }}>
        <div className="time-tabs" style={{ display: 'inline-flex' }}>
          {TIJDPERKEN.map(t => (
            <button key={t} className={`time-tab ${tijdperk === t ? 'active' : ''}`} onClick={() => setTijdperk(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio kaart */}
      <div style={{ padding: '0 32px' }}>
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Portfolio</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Prestatie vandaag</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <div className="portfolio-waarde">
                  €{portfolioWaarde.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className={`badge ${dagWinstPct >= 0 ? 'badge-green' : 'badge-red'}`}>
                  {dagWinstPct >= 0 ? '▲' : '▼'} {Math.abs(dagWinstPct).toFixed(2)}% ({dagWinst >= 0 ? '+' : ''}€{Math.abs(dagWinst).toFixed(2)})
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => setVergelijkOpen(true)}>
                <GitCompare size={15} /> Vergelijk
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => setFilterOpen(true)}>
                <SlidersHorizontal size={15} /> Filter
              </button>
            </div>
          </div>

          {/* Grafiek toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 12 }}>
            {['waarde', 'winst/verlies'].map(w => (
              <button
                key={w}
                onClick={() => setWeergave(w)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: weergave === w ? 'var(--text-primary)' : 'transparent',
                  color: weergave === w ? 'white' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textTransform: 'capitalize'
                }}
              >
                {w.charAt(0).toUpperCase() + w.slice(1)}
              </button>
            ))}
          </div>

          {/* Grafiek */}
          {beleggingen.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <p>Voeg beleggingen toe om je portfolio te zien</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={displayData} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => weergave === 'waarde' ? '€' + v.toLocaleString('nl-BE') : v.toFixed(1) + '%'}
                />
                <Tooltip
                  formatter={(v) => [weergave === 'waarde' ? '€' + v.toLocaleString('nl-BE', { minimumFractionDigits: 2 }) : v.toFixed(2) + '%', 'Portfolio']}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                />
                <Area type="monotone" dataKey="waarde" stroke="#6366f1" strokeWidth={2} fill="url(#portfolioGrad)" dot={false} activeDot={{ r: 4, fill: '#6366f1' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Beleggingen tabel */}
        {beleggingen.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Beleggingen</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Automatisch opgevolgd door Matico</div>
              </div>
            </div>

            {/* Tabel header */}
            <div className="tabel-header belegging-grid" style={{ marginTop: 16 }}>
              <span>Naam ↑↓</span>
              <span>Koers ↑↓</span>
              <span>Huidige waarde ↑↓</span>
              <span>Winst/verlies vandaag ↑↓</span>
              <span>Winst/verlies totaal ↑↓</span>
              <span>Gewicht ↑↓</span>
            </div>

            {gefilterdeBeleggingen.map(b => {
              const koers = koersen[b.symbol];
              const huidigePrijs = koers ? koers.c : b.kostprijs;
              const factor = getMuntFactor ? getMuntFactor(b.munt || "EUR") : ((b.munt || "EUR") === "USD" ? 0.865 : 1);
              const huidigeWaarde = huidigePrijs * b.aantal * factor;
              const kostprijs = b.kostprijs * b.aantal * factor;
              const winstTotaal = huidigeWaarde - kostprijs;
              const winstTotaalPct = kostprijs > 0 ? (winstTotaal / kostprijs) * 100 : 0;
              const dagV = koers ? (koers.c - koers.pc) * b.aantal * factor : 0;
              const dagVPct = koers && koers.pc > 0 ? ((koers.c - koers.pc) / koers.pc) * 100 : 0;
              const portfolioTotaal = beleggingen.reduce((s, bb) => {
                const k = koersen[bb.symbol];
                const p = k ? k.c : bb.kostprijs;
                const f = (bb.munt || 'EUR') === 'USD' ? 0.92 : 1;
                return s + p * bb.aantal * f;
              }, 0);
              const gewicht = portfolioTotaal > 0 ? (huidigeWaarde / portfolioTotaal) * 100 : 0;

              return (
                <div key={b.id} className="tabel-rij belegging-grid" onClick={() => setDetailBelegging(b)}>
                  <div className="belegging-naam">
                    <div className="belegging-avatar">
                      {b.symbol.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="belegging-naam-text">{b.naam}</div>
                      <div className="belegging-symbol">{b.symbol} · {b.aantal} st.</div>
                    </div>
                  </div>
                  <div className="koers-display">
                    {(b.munt || 'EUR') === 'USD' ? '$' : '€'}{huidigePrijs.toFixed(2)}
                  </div>
                  <div className="koers-display">
                    €{huidigeWaarde.toFixed(2)}
                  </div>
                  <div>
                    <span className={dagVPct >= 0 ? 'pct-pos' : 'pct-neg'}>
                      {dagV >= 0 ? '+' : ''}€{dagV.toFixed(2)}
                    </span>
                    {' '}
                    <span className={`badge ${dagVPct >= 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11, padding: '2px 6px' }}>
                      {dagVPct >= 0 ? '+' : ''}{dagVPct.toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className={winstTotaal >= 0 ? 'pct-pos' : 'pct-neg'}>
                      {winstTotaal >= 0 ? '+' : ''}€{winstTotaal.toFixed(2)}
                    </span>
                    {' '}
                    <span className={`badge ${winstTotaalPct >= 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11, padding: '2px 6px' }}>
                      {winstTotaalPct >= 0 ? '+' : ''}{winstTotaalPct.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ fontWeight: 600 }}>{gewicht.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 49 }} onClick={() => setFilterOpen(false)} />
          <div className="filter-panel">
            <div className="modal-header">
              <h2>Filter</h2>
              <button className="modal-close" onClick={() => setFilterOpen(false)}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div className="filter-section">
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent)' }} onClick={() => { setFilterType('alle'); setFilterSymbolen([]); }}>
                  Wis alle filters
                </button>
              </div>
              <div className="filter-section">
                <h3>Type belegging</h3>
                {['alle', 'aandeel', 'etf', 'crypto'].map(t => (
                  <label key={t} className="filter-option">
                    <input type="radio" checked={filterType === t} onChange={() => setFilterType(t)} />
                    {t.charAt(0).toUpperCase() + t.slice(1) === 'Alle' ? 'Alle types' : t.charAt(0).toUpperCase() + t.slice(1) + (t === 'etf' ? 's' : 'en')}
                  </label>
                ))}
              </div>
              <div className="filter-section">
                <h3>Beleggingen</h3>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setFilterSymbolen([])}>Selecteer alles</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 16, cursor: 'pointer' }} onClick={() => setFilterSymbolen([])}>Wis selectie</span>
                </div>
                {beleggingen.map(b => (
                  <label key={b.symbol} className="filter-option">
                    <input
                      type="checkbox"
                      checked={filterSymbolen.length === 0 || filterSymbolen.includes(b.symbol)}
                      onChange={e => {
                        if (e.target.checked) {
                          setFilterSymbolen(prev => prev.filter(s => s !== b.symbol));
                        } else {
                          setFilterSymbolen(prev => [...(prev.length === 0 ? beleggingen.map(bb => bb.symbol) : prev), b.symbol].filter(s => s !== b.symbol));
                        }
                      }}
                    />
                    {b.symbol}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setFilterOpen(false)}>Annuleren</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setFilterOpen(false)}>Toepassen</button>
            </div>
          </div>
        </>
      )}

      {/* Vergelijk modal */}
      {vergelijkOpen && (
        <div className="vergelijk-modal" onClick={() => setVergelijkOpen(false)}>
          <div className="vergelijk-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Prestatievergelijking</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  Vergelijk de prestatie van je portfolio met benchmarks
                </p>
              </div>
              <button className="modal-close" onClick={() => setVergelijkOpen(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: 24 }}>
              {/* Vergelijk selectors */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--accent-bg)', borderRadius: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Je portfolio</span>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>vs</span>
                <VergelijkSelector value={vergelijk1} onChange={setVergelijk1} />
                <span style={{ color: 'var(--text-muted)' }}>vs</span>
                <VergelijkSelector value={vergelijk2} onChange={setVergelijk2} />
                <div style={{ marginLeft: 'auto' }}>
                  <div className="time-tabs" style={{ display: 'inline-flex' }}>
                    {['1W', '1M', '1J', 'YTD', 'Laatste', 'Totaal'].map(t => (
                      <button key={t} className={`time-tab ${tijdperk === t ? 'active' : ''}`} onClick={() => setTijdperk(t)} style={{ fontSize: 12 }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Vergelijk grafiek */}
              <VergelijkGrafiek
                portfolioData={winstData}
                vergelijk1={VERGELIJK_OPTIES.find(o => o.id === vergelijk1)}
                vergelijk2={VERGELIJK_OPTIES.find(o => o.id === vergelijk2)}
                tijdperk={tijdperk}
              />
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailBelegging && (
        <BeleggingDetail belegging={detailBelegging} onClose={() => setDetailBelegging(null)} />
      )}
    </div>
  );
}

function VergelijkSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const geselecteerd = VERGELIJK_OPTIES.find(o => o.id === value);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit'
        }}
      >
        {geselecteerd?.kleur && (
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: geselecteerd.kleur, display: 'inline-block' }} />
        )}
        {geselecteerd?.label}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: 'white', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: 180
        }}>
          {VERGELIJK_OPTIES.map(o => (
            <div
              key={o.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                background: o.id === value ? 'var(--accent-bg)' : 'transparent'
              }}
              onClick={() => { onChange(o.id); setOpen(false); }}
            >
              {o.id === value && <Check size={14} color="var(--accent)" />}
              {o.kleur && <span style={{ width: 10, height: 10, borderRadius: '50%', background: o.kleur, display: 'inline-block', marginLeft: o.id === value ? 0 : 18 }} />}
              {!o.kleur && !o.id !== value && <span style={{ width: 28 }} />}
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VergelijkGrafiek({ portfolioData, vergelijk1, vergelijk2, tijdperk }) {
  // Simuleer benchmark data
  const data = portfolioData.map((d, i) => {
    const noise1 = (Math.random() - 0.51) * 0.3 * i;
    const noise2 = (Math.random() - 0.49) * 0.25 * i;
    return {
      ...d,
      benchmark1: vergelijk1?.id !== 'geen' ? noise1 : undefined,
      benchmark2: vergelijk2?.id !== 'geen' ? noise2 : undefined,
    };
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Je portfolio</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`badge ${(data[data.length-1]?.waarde || 0) >= 0 ? 'badge-green' : 'badge-red'}`}>
              {(data[data.length-1]?.waarde || 0) >= 0 ? '▲' : '▼'} {Math.abs(data[data.length-1]?.waarde || 0).toFixed(2)}%
            </span>
          </div>
        </div>
        {vergelijk1?.id !== 'geen' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{vergelijk1?.label}</div>
            <div className="badge badge-red">▼ {Math.abs((data[data.length-1]?.benchmark1 || 0)).toFixed(2)}%</div>
          </div>
        )}
        {vergelijk2?.id !== 'geen' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{vergelijk2?.label}</div>
            <div className="badge badge-green">▲ {Math.abs((data[data.length-1]?.benchmark2 || 0)).toFixed(2)}%</div>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1) + '%'} />
          <Tooltip formatter={v => v.toFixed(2) + '%'} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
          <Line type="monotone" dataKey="waarde" stroke="#6366f1" strokeWidth={2} dot={false} name="Portfolio" />
          {vergelijk1?.id !== 'geen' && (
            <Line type="monotone" dataKey="benchmark1" stroke={vergelijk1?.kleur} strokeWidth={2} dot={false} name={vergelijk1?.label} />
          )}
          {vergelijk2?.id !== 'geen' && (
            <Line type="monotone" dataKey="benchmark2" stroke={vergelijk2?.kleur} strokeWidth={2} dot={false} strokeDasharray="5 5" name={vergelijk2?.label} />
          )}
          <Legend />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
