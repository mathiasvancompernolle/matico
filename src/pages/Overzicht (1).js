import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { SlidersHorizontal, GitCompare, Plus, ChevronDown, X, Check, Upload, Edit3 } from 'lucide-react';
import BeleggingDetail from '../components/BeleggingDetail';

const TIJDPERKEN = ['1D', '1W', '1M', '1J', 'YTD', 'Laatste', 'Totaal'];
const VERGELIJK_OPTIES = [
  { id: 'geen', label: 'Geen vergelijking' },
  { id: 'msci', label: 'MSCI World', symbol: 'ACWI', kleur: '#22c55e' },
  { id: 'sp500', label: 'S&P 500', symbol: 'SPY', kleur: '#f59e0b' },
  { id: 'bel20', label: 'BEL 20', symbol: 'BEL20.BR', kleur: '#8b5cf6' },
  { id: 'bitcoin', label: 'Bitcoin', symbol: 'BINANCE:BTCUSDT', kleur: '#f97316' },
];

export default function Overzicht({ onToevoegen }) {
  const { gebruiker, beleggingen, setBeleggingen, koersen, refreshAlleKoersen, portfolioWaarde, dagWinst, dagWinstPct, getMuntFactor } = useApp();
  const [tijdperk, setTijdperk] = useState('1D');
  const [weergave, setWeergave] = useState('waarde');
  const [grafiekData, setGrafiekData] = useState([]);
  const [grafiekLoading, setGrafiekLoading] = useState(false);
  const [vergelijkOpen, setVergelijkOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [vergelijk1, setVergelijk1] = useState('msci');
  const [vergelijk2, setVergelijk2] = useState('geen');
  const [filterType, setFilterType] = useState('alle');
  const [filterSymbolen, setFilterSymbolen] = useState([]);
  const [detailBelegging, setDetailBelegging] = useState(null);
  const [toevoegenMenuOpen, setToevoegenMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const menuRef = useRef(null);

  const begroeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Goede morgen';
    if (h < 18) return 'Goede middag';
    return 'Goede avond';
  };

  // Sluit menu bij klik buiten
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setToevoegenMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Laad portfolio grafiek data
  useEffect(() => {
    const laadGrafiek = async () => {
      if (beleggingen.length === 0) { setGrafiekData([]); return; }
      setGrafiekLoading(true);

      if (tijdperk === '1D') {
        // 1D: gebruik gisteren en nu koers van elk aandeel
        let gisterenWaarde = 0;
        let nuWaarde = 0;
        beleggingen.forEach(b => {
          const koers = koersen[b.symbol];
          const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
          if (koers && koers.c > 0) {
            nuWaarde += koers.c * b.aantal * factor;
            gisterenWaarde += (koers.pc || koers.c) * b.aantal * factor;
          } else {
            nuWaarde += b.kostprijs * b.aantal * factor;
            gisterenWaarde += b.kostprijs * b.aantal * factor;
          }
        });
        setGrafiekData([
          { label: 'Gisteren', waarde: Math.round(gisterenWaarde * 100) / 100 },
          { label: 'Nu', waarde: Math.round(nuWaarde * 100) / 100 }
        ]);
        setGrafiekLoading(false);
        return;
      }

      // Voor andere tijdperken: haal historische data op per aandeel
      const symbolen = [...new Set(beleggingen.map(b => b.symbol))];
      const historischeData = {};

      for (const symbol of symbolen) {
        try {
          const res = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(symbol)}&tijdperk=${tijdperk}`);
          const data = await res.json();
          if (data.punten && data.punten.length > 0) {
            historischeData[symbol] = data.punten;
          }
        } catch (e) { console.error('Historische data fout:', e); }
      }

      // Combineer per datum
      if (Object.keys(historischeData).length === 0) {
        setGrafiekLoading(false);
        return;
      }

      // Gebruik de labels van het eerste aandeel als basis
      const eersteSymbol = Object.keys(historischeData)[0];
      const labels = historischeData[eersteSymbol].map(p => p.label);

      const gecombineerd = labels.map((label, i) => {
        let totaalWaarde = 0;
        beleggingen.forEach(b => {
          const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
          const symbolData = historischeData[b.symbol];
          if (symbolData && symbolData[i]) {
            totaalWaarde += symbolData[i].prijs * b.aantal * factor;
          } else {
            // Gebruik huidige koers als fallback
            const koers = koersen[b.symbol];
            totaalWaarde += (koers ? koers.c : b.kostprijs) * b.aantal * factor;
          }
        });
        return { label, waarde: Math.round(totaalWaarde * 100) / 100 };
      });

      setGrafiekData(gecombineerd);
      setGrafiekLoading(false);
    };

    laadGrafiek();
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

  const winstData = grafiekData.map((d, i) => ({
    ...d,
    waarde: i === 0 ? 0 : ((d.waarde - grafiekData[0].waarde) / (grafiekData[0].waarde || 1)) * 100
  }));

  const displayData = weergave === 'waarde' ? grafiekData : winstData;
  const grafiekKleur = grafiekData.length > 1 && grafiekData[grafiekData.length-1]?.waarde >= grafiekData[0]?.waarde ? '#6366f1' : '#ef4444';

  const yDomain = displayData.length > 0 ? [
    Math.min(...displayData.map(d => d.waarde)) * 0.995,
    Math.max(...displayData.map(d => d.waarde)) * 1.005
  ] : ['auto', 'auto'];

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>{begroeting()}, {gebruiker.voornaam}</h1>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button className="btn btn-primary" onClick={() => setToevoegenMenuOpen(!toevoegenMenuOpen)}>
            <Plus size={16} />
            Beleggingen toevoegen
            <ChevronDown size={14} />
          </button>
          {toevoegenMenuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'white', border: '1px solid var(--border)', borderRadius: 10,
              boxShadow: 'var(--shadow-md)', zIndex: 20, minWidth: 180, overflow: 'hidden'
            }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', fontSize: 14 }}
                onClick={() => { setToevoegenMenuOpen(false); onToevoegen(); }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Edit3 size={15} color="var(--text-muted)" /> Manueel
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', fontSize: 14, borderTop: '1px solid var(--border-light)' }}
                onClick={() => { setToevoegenMenuOpen(false); setImportOpen(true); }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Upload size={15} color="var(--text-muted)" /> Importeer
              </div>
            </div>
          )}
        </div>
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
              <button key={w} onClick={() => setWeergave(w)} style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: weergave === w ? 'var(--text-primary)' : 'transparent',
                color: weergave === w ? 'white' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize'
              }}>
                {w.charAt(0).toUpperCase() + w.slice(1)}
              </button>
            ))}
          </div>

          {/* Grafiek */}
          {beleggingen.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <p>Voeg beleggingen toe om je portfolio te zien</p>
            </div>
          ) : grafiekLoading ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 13 }}>Grafiek laden...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={displayData} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={grafiekKleur} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={grafiekKleur} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => weergave === 'waarde' ? '€' + v.toLocaleString('nl-BE') : v.toFixed(1) + '%'}
                  domain={yDomain}
                />
                <Tooltip
                  formatter={(v) => [weergave === 'waarde' ? '€' + v.toLocaleString('nl-BE', { minimumFractionDigits: 2 }) : v.toFixed(2) + '%', 'Portfolio']}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                />
                <Area type="monotone" dataKey="waarde" stroke={grafiekKleur} strokeWidth={2} fill="url(#portfolioGrad)" dot={false} activeDot={{ r: 4, fill: grafiekKleur }} />
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
              const factor = getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);
              const huidigeWaarde = huidigePrijs * b.aantal * factor;
              const kostprijs = b.kostprijs * b.aantal * factor;
              const winstTotaal = huidigeWaarde - kostprijs;
              const winstTotaalPct = kostprijs > 0 ? (winstTotaal / kostprijs) * 100 : 0;
              const dagV = koers ? (koers.c - koers.pc) * b.aantal * factor : 0;
              const dagVPct = koers && koers.pc > 0 ? ((koers.c - koers.pc) / koers.pc) * 100 : 0;
              const portfolioTotaal = beleggingen.reduce((s, bb) => {
                const k = koersen[bb.symbol];
                const p = k ? k.c : bb.kostprijs;
                const f = getMuntFactor ? getMuntFactor(bb.munt || 'EUR') : ((bb.munt || 'EUR') === 'USD' ? 0.865 : 1);
                return s + p * bb.aantal * f;
              }, 0);
              const gewicht = portfolioTotaal > 0 ? (huidigeWaarde / portfolioTotaal) * 100 : 0;
              const muntSym = (b.munt || 'EUR') === 'USD' ? '$' : '€';

              return (
                <div key={b.id} className="tabel-rij belegging-grid" onClick={() => setDetailBelegging(b)}>
                  <div className="belegging-naam">
                    <div className="belegging-avatar">{b.symbol.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div className="belegging-naam-text">{b.naam}</div>
                      <div className="belegging-symbol">{b.symbol} · {b.aantal} st.</div>
                    </div>
                  </div>
                  <div className="koers-display">{muntSym}{huidigePrijs.toFixed(2)}</div>
                  <div className="koers-display">€{huidigeWaarde.toFixed(2)}</div>
                  <div>
                    <span className={dagVPct >= 0 ? 'pct-pos' : 'pct-neg'}>{dagV >= 0 ? '+' : ''}€{Math.abs(dagV).toFixed(2)}</span>
                    {' '}
                    <span className={`badge ${dagVPct >= 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11, padding: '2px 6px' }}>
                      {dagVPct >= 0 ? '+' : ''}{dagVPct.toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className={winstTotaal >= 0 ? 'pct-pos' : 'pct-neg'}>{winstTotaal >= 0 ? '+' : ''}€{Math.abs(winstTotaal).toFixed(2)}</span>
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
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent)' }}
                  onClick={() => { setFilterType('alle'); setFilterSymbolen([]); }}>
                  Wis alle filters
                </button>
              </div>
              <div className="filter-section">
                <h3>Type belegging</h3>
                {['alle', 'aandeel', 'etf', 'crypto'].map(t => (
                  <label key={t} className="filter-option">
                    <input type="radio" checked={filterType === t} onChange={() => setFilterType(t)} />
                    {t === 'alle' ? 'Alle types' : t.charAt(0).toUpperCase() + t.slice(1) + (t === 'etf' ? 's' : 'en')}
                  </label>
                ))}
              </div>
              <div className="filter-section">
                <h3>Beleggingen</h3>
                {beleggingen.map(b => (
                  <label key={b.symbol} className="filter-option">
                    <input type="checkbox"
                      checked={filterSymbolen.length === 0 || filterSymbolen.includes(b.symbol)}
                      onChange={e => {
                        if (e.target.checked) setFilterSymbolen(prev => prev.filter(s => s !== b.symbol));
                        else setFilterSymbolen(prev => [...(prev.length === 0 ? beleggingen.map(bb => bb.symbol) : prev)].filter(s => s !== b.symbol));
                      }} />
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
        <VergelijkModal
          onClose={() => setVergelijkOpen(false)}
          vergelijk1={vergelijk1} setVergelijk1={setVergelijk1}
          vergelijk2={vergelijk2} setVergelijk2={setVergelijk2}
          portfolioData={winstData}
          tijdperk={tijdperk} setTijdperk={setTijdperk}
        />
      )}

      {/* Import modal */}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImport={(nieuweB) => {
            setBeleggingen(prev => [...prev, ...nieuweB]);
            setImportOpen(false);
          }}
        />
      )}

      {/* Detail modal */}
      {detailBelegging && (
        <BeleggingDetail belegging={detailBelegging} onClose={() => setDetailBelegging(null)} />
      )}
    </div>
  );
}

function VergelijkModal({ onClose, vergelijk1, setVergelijk1, vergelijk2, setVergelijk2, portfolioData, tijdperk, setTijdperk }) {
  const data = portfolioData.map((d, i) => {
    const noise1 = (Math.random() - 0.51) * 0.3 * i;
    const noise2 = (Math.random() - 0.49) * 0.25 * i;
    return {
      ...d,
      benchmark1: vergelijk1 !== 'geen' ? noise1 : undefined,
      benchmark2: vergelijk2 !== 'geen' ? noise2 : undefined,
    };
  });

  const opt1 = VERGELIJK_OPTIES.find(o => o.id === vergelijk1);
  const opt2 = VERGELIJK_OPTIES.find(o => o.id === vergelijk2);

  return (
    <div className="vergelijk-modal" onClick={onClose}>
      <div className="vergelijk-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Prestatievergelijking</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Vergelijk de prestatie van je portfolio met benchmarks</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 24 }}>
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
                  <button key={t} className={`time-tab ${tijdperk === t ? 'active' : ''}`} onClick={() => setTijdperk(t)} style={{ fontSize: 12 }}>{t}</button>
                ))}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1) + '%'} />
              <Tooltip formatter={v => v.toFixed(2) + '%'} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
              <Line type="monotone" dataKey="waarde" stroke="#6366f1" strokeWidth={2} dot={false} name="Portfolio" />
              {vergelijk1 !== 'geen' && <Line type="monotone" dataKey="benchmark1" stroke={opt1?.kleur} strokeWidth={2} dot={false} name={opt1?.label} />}
              {vergelijk2 !== 'geen' && <Line type="monotone" dataKey="benchmark2" stroke={opt2?.kleur} strokeWidth={2} dot={false} strokeDasharray="5 5" name={opt2?.label} />}
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function VergelijkSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const geselecteerd = VERGELIJK_OPTIES.find(o => o.id === value);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
        cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit'
      }}>
        {geselecteerd?.kleur && <span style={{ width: 10, height: 10, borderRadius: '50%', background: geselecteerd.kleur, display: 'inline-block' }} />}
        {geselecteerd?.label}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: 180 }}>
          {VERGELIJK_OPTIES.map(o => (
            <div key={o.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 13,
              background: o.id === value ? 'var(--accent-bg)' : 'transparent'
            }} onClick={() => { onChange(o.id); setOpen(false); }}>
              {o.id === value && <Check size={14} color="var(--accent)" />}
              {o.kleur && <span style={{ width: 10, height: 10, borderRadius: '50%', background: o.kleur, display: 'inline-block', marginLeft: o.id === value ? 0 : 18 }} />}
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportModal({ onClose, onImport }) {
  const [stap, setStap] = useState('upload'); // upload, preview, mapping
  const [bestand, setBestand] = useState(null);
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ naam: '', symbol: '', datum: '', kostprijs: '', aantal: '', munt: '' });
  const [fout, setFout] = useState('');
  const fileRef = useRef(null);

  const parseCSV = (tekst) => {
    const regels = tekst.trim().split('\n');
    const sep = regels[0].includes(';') ? ';' : ',';
    const hdrs = regels[0].split(sep).map(h => h.trim().replace(/"/g, ''));
    const rijen = regels.slice(1).map(r => {
      const waarden = r.split(sep).map(w => w.trim().replace(/"/g, ''));
      const obj = {};
      hdrs.forEach((h, i) => { obj[h] = waarden[i] || ''; });
      return obj;
    });
    return { hdrs, rijen };
  };

  const verwerkBestand = async (file) => {
    setBestand(file);
    setFout('');
    const naam = file.name.toLowerCase();
    if (naam.endsWith('.csv')) {
      const tekst = await file.text();
      const { hdrs, rijen } = parseCSV(tekst);
      setHeaders(hdrs);
      setPreview(rijen.slice(0, 5));
      // Auto-detecteer kolommen
      const autoMapping = { naam: '', symbol: '', datum: '', kostprijs: '', aantal: '', munt: '' };
      hdrs.forEach(h => {
        const hl = h.toLowerCase();
        if (hl.includes('naam') || hl.includes('name') || hl.includes('product')) autoMapping.naam = h;
        if (hl.includes('symbol') || hl.includes('ticker') || hl.includes('isin')) autoMapping.symbol = h;
        if (hl.includes('datum') || hl.includes('date') || hl.includes('tijd')) autoMapping.datum = h;
        if (hl.includes('prijs') || hl.includes('price') || hl.includes('koers') || hl.includes('kost')) autoMapping.kostprijs = h;
        if (hl.includes('aantal') || hl.includes('quantity') || hl.includes('stuks') || hl.includes('shares')) autoMapping.aantal = h;
        if (hl.includes('munt') || hl.includes('currency') || hl.includes('valuta')) autoMapping.munt = h;
      });
      setMapping(autoMapping);
      setStap('mapping');
    } else {
      setFout('Momenteel alleen CSV bestanden ondersteund. XLSX ondersteuning komt binnenkort.');
    }
  };

  const importeer = () => {
    if (!mapping.symbol || !mapping.kostprijs || !mapping.aantal) {
      setFout('Selecteer minimaal: Symbool, Kostprijs en Aantal');
      return;
    }
    const nieuweBeleggingen = preview.map((r, i) => ({
      id: Date.now() + i,
      naam: mapping.naam ? r[mapping.naam] : r[mapping.symbol] || 'Onbekend',
      symbol: r[mapping.symbol] || '',
      type: 'aandeel',
      datum: mapping.datum ? r[mapping.datum] : '',
      kostprijs: parseFloat(r[mapping.kostprijs]?.replace(',', '.')) || 0,
      aantal: parseFloat(r[mapping.aantal]?.replace(',', '.')) || 0,
      munt: mapping.munt ? r[mapping.munt] : 'EUR',
    })).filter(b => b.symbol && b.kostprijs > 0 && b.aantal > 0);

    if (nieuweBeleggingen.length === 0) {
      setFout('Geen geldige beleggingen gevonden in het bestand.');
      return;
    }
    onImport(nieuweBeleggingen);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importeer beleggingen</h2>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {stap === 'upload' && (
          <div style={{ padding: 24 }}>
            <div
              style={{
                border: '2px dashed var(--border)', borderRadius: 12, padding: 40,
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s'
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; const f = e.dataTransfer.files[0]; if (f) verwerkBestand(f); }}
            >
              <Upload size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Sleep je bestand hierheen</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>of klik om te bladeren</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>CSV, XLSX of XLS van je broker</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) verwerkBestand(e.target.files[0]); }} />
            {fout && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 13 }}>{fout}</div>}

            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>💡 Tips voor importeren</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                • Export je transacties als CSV vanuit je broker (Bolero, Degiro, Saxo, ...)<br/>
                • Zorg dat het bestand kolommen heeft voor: symbool, aantal, prijs en datum<br/>
                • De app detecteert automatisch de kolommen
              </div>
            </div>
          </div>
        )}

        {stap === 'mapping' && (
          <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Kolommen koppelen</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Bestand: <strong>{bestand?.name}</strong> — {preview.length} rijen gedetecteerd
            </div>

            {/* Preview tabel */}
            <div style={{ overflowX: 'auto', marginBottom: 20, border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {headers.map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 3).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      {headers.map(h => (
                        <td key={h} style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>{r[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mapping velden */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { key: 'naam', label: 'Naam', verplicht: false },
                { key: 'symbol', label: 'Symbool / Ticker', verplicht: true },
                { key: 'datum', label: 'Aankoopdatum', verplicht: false },
                { key: 'kostprijs', label: 'Kostprijs per stuk', verplicht: true },
                { key: 'aantal', label: 'Aantal', verplicht: true },
                { key: 'munt', label: 'Munt', verplicht: false },
              ].map(({ key, label, verplicht }) => (
                <div key={key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    {label} {verplicht && <span style={{ color: 'var(--red)' }}>*</span>}
                  </label>
                  <select
                    className="form-input"
                    value={mapping[key]}
                    onChange={e => setMapping(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ fontSize: 13 }}
                  >
                    <option value="">— Niet gebruiken —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {fout && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 13 }}>{fout}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStap('upload')}>Terug</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={importeer}>
                Importeer {preview.length} beleggingen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
