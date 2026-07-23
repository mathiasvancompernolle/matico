// src/pages/BeleggingToevoegen.js
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { X, Search, Plus, Trash2, ChevronDown, Calendar } from 'lucide-react';

const BEKENDE_LOGOS = {
  'PRX.AS': 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/PRX.png',
};

const ETF_UITGEVERS = [
  { match: ['ishares','blackrock','ish '], label: 'iSH', kleur: '#00b140' },
  { match: ['vanguard','vang ftse','vang '], label: 'VG', kleur: '#c8102e' },
  { match: ['amundi','lyxor','lyx '], label: 'AM', kleur: '#0066cc' },
  { match: ['xtrackers','dws'], label: 'XT', kleur: '#003c88' },
  { match: ['invesco'], label: 'IV', kleur: '#00205b' },
  { match: ['spdr','state street'], label: 'SPD', kleur: '#00a651' },
  { match: ['wisdomtree'], label: 'WT', kleur: '#f7941d' },
  { match: ['vaneck'], label: 'VE', kleur: '#003087' },
  { match: ['ubs'], label: 'UBS', kleur: '#e3000f' },
];
const TICKER_ETF = { 'VWCE':'VG','VFEM':'VG','VUSA':'VG','IWDA':'iSH','CSPX':'iSH','EIMI':'iSH','SWRD':'iSH','XDWD':'XT' };
const TICKER_KLEUREN = { 'VG':'#c8102e','iSH':'#00b140','AM':'#0066cc','XT':'#003c88','IV':'#00205b','SPD':'#00a651','WT':'#f7941d','VE':'#003087','UBS':'#e3000f' };
const CRYPTO_KLEUREN = { 'BTC':'#f7931a','ETH':'#627eea','SOL':'#9945ff','XRP':'#00aae4','ADA':'#0033ad','DOT':'#e6007a','DOGE':'#c2a633','AVAX':'#e84142' };

function MiniAvatar({ r }) {
  const [fout, setFout] = useState(false);
  if (r.logo && !fout) return <img src={r.logo} alt={r.symbol} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border)', background: 'white', padding: 2 }} onError={() => setFout(true)} />;
  const naam = (r.naam || r.symbol || '').toLowerCase();
  const sym = (r.symbol || '').replace(/-EUR$|-USD$|-GBP$/,'').toUpperCase();
  const ticker = sym.split('.')[0];
  if (r.type === 'crypto' || sym.match(/-EUR$|-USD$/)) {
    return <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: CRYPTO_KLEUREN[sym] || '#f7931a', color: 'white', fontWeight: 800, fontSize: 9 }}>{sym.slice(0,3)}</div>;
  }
  const tickerLabel = TICKER_ETF[ticker];
  if (tickerLabel) return <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: TICKER_KLEUREN[tickerLabel] || '#6366f1', color: 'white', fontWeight: 800, fontSize: 9 }}>{tickerLabel}</div>;
  if (r.type === 'etf') {
    const u = ETF_UITGEVERS.find(u => u.match.some(m => naam.includes(m)));
    if (u) return <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: u.kleur, color: 'white', fontWeight: 800, fontSize: 9 }}>{u.label}</div>;
    return <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#6366f1', color: 'white', fontWeight: 800, fontSize: 9 }}>ETF</div>;
  }
  return <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>{sym.slice(0,2)}</div>;
}

export default function BeleggingToevoegen({ onClose }) {
  const { setBeleggingen, fetchKoers } = useApp();

  const [stap, setStap] = useState('zoek'); // zoek | invoer
  const [type, setType] = useState('aandeel');
  const [zoekQuery, setZoekQuery] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [zoekLaden, setZoekLaden] = useState(false);

  // Geselecteerde beleggingen (meerdere mogelijk)
  const [selectie, setSelectie] = useState([]); // [{...resultaat, aangevinkt: true}]

  // Formulier per geselecteerde belegging
  const [forms, setForms] = useState({}); // { symbol: { datum, kostprijs, aantal, munt, transactiekosten } }

  useEffect(() => {
    if (!zoekQuery || zoekQuery.length < 2) { setZoekResultaten([]); return; }
    const t = setTimeout(async () => {
      setZoekLaden(true);
      try {
        const r = await fetch(`/api/data?endpoint=search&q=${encodeURIComponent(zoekQuery)}`);
        const d = await r.json();
        setZoekResultaten(d?.resultaten || []);
      } catch { setZoekResultaten([]); }
      setZoekLaden(false);
    }, 300);
    return () => clearTimeout(t);
  }, [zoekQuery]);

  const toggleSelectie = async (r) => {
    const al = selectie.find(s => s.symbol === r.symbol);
    if (al) {
      setSelectie(prev => prev.filter(s => s.symbol !== r.symbol));
      setForms(prev => { const n = {...prev}; delete n[r.symbol]; return n; });
    } else {
      setSelectie(prev => [...prev, r]);
      // Haal koers op
      const koers = await fetchKoers(r.symbol);
      setForms(prev => ({
        ...prev,
        [r.symbol]: {
          datum: new Date().toISOString().split('T')[0],
          kostprijs: koers?.c ? koers.c.toFixed(2) : '',
          aantal: '',
          munt: r.valuta || 'EUR',
          transactiekosten: '',
        }
      }));
      // Haal logo op
      try {
        const res = await fetch(`/api/data?endpoint=profile&symbol=${encodeURIComponent(r.symbol)}`);
        const d = await res.json();
        const logo = d.logo || d.image || BEKENDE_LOGOS[r.symbol] || '';
        if (logo) setSelectie(prev => prev.map(s => s.symbol === r.symbol ? {...s, logo} : s));
      } catch {}
    }
  };

  const updateForm = (symbol, veld, waarde) => {
    setForms(prev => ({ ...prev, [symbol]: { ...prev[symbol], [veld]: waarde } }));
  };

  const gaaNaarInvoer = () => {
    if (selectie.length === 0) return;
    setStap('invoer');
  };

  const opslaan = () => {
    const geldig = selectie.filter(r => {
      const f = forms[r.symbol];
      return f && f.datum && f.kostprijs && f.aantal;
    });
    if (geldig.length === 0) return;

    const nieuw = geldig.map(r => {
      const f = forms[r.symbol];
      const kostprijsPerStuk = parseFloat(f.kostprijs);
      const aantalStuks = parseFloat(f.aantal);
      const transactiekosten = parseFloat(f.transactiekosten) || 0;
      const kostprijsInclKosten = kostprijsPerStuk + (transactiekosten / aantalStuks);
      return {
        id: Date.now() + Math.random(),
        symbol: r.symbol,
        naam: r.naam || r.symbol,
        logo: r.logo || '',
        type: r.type || 'aandeel',
        datum: f.datum,
        kostprijs: kostprijsInclKosten,
        kostprijsExclKosten: kostprijsPerStuk,
        transactiekosten,
        aantal: aantalStuks,
        munt: f.munt,
      };
    });

    setBeleggingen(prev => [...prev, ...nieuw]);
    onClose();
  };

  const muntSymbool = (m) => m === 'USD' ? '$' : m === 'GBP' ? '£' : '€';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 680, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {stap === 'zoek' ? 'Belegging toevoegen' : `${selectie.length} belegging${selectie.length !== 1 ? 'en' : ''} invullen`}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>

        {/* Stap 1: Zoeken */}
        {stap === 'zoek' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  value={zoekQuery}
                  onChange={e => setZoekQuery(e.target.value)}
                  placeholder="Zoek aandeel, ETF of crypto..."
                  autoFocus
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, width: '100%', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Zoekresultaten */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {zoekLaden && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Zoeken...</div>}
              {!zoekLaden && zoekQuery.length >= 2 && zoekResultaten.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen resultaten</div>
              )}
              {zoekResultaten.map((r, i) => {
                const aangevinkt = selectie.some(s => s.symbol === r.symbol);
                return (
                  <div key={i} onClick={() => toggleSelectie(r)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px',
                    cursor: 'pointer', background: aangevinkt ? 'var(--accent-bg)' : 'transparent',
                    borderLeft: aangevinkt ? '3px solid var(--accent)' : '3px solid transparent',
                  }}
                    onMouseEnter={e => { if (!aangevinkt) e.currentTarget.style.background = 'var(--bg)'; }}
                    onMouseLeave={e => { if (!aangevinkt) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 20, height: 20, borderRadius: 5, border: `2px solid ${aangevinkt ? 'var(--accent)' : 'var(--border)'}`,
                      background: aangevinkt ? 'var(--accent)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {aangevinkt && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
                    <MiniAvatar r={r} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.naam}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {r.symbol}
                        {r.beurs && ` · ${r.beurs}`}
                        {r.type && <span style={{ marginLeft: 6, background: r.type === 'etf' ? '#eef2ff' : r.type === 'crypto' ? '#f0fdf4' : '#fef3c7', color: r.type === 'etf' ? '#6366f1' : r.type === 'crypto' ? '#16a34a' : '#d97706', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{r.type.toUpperCase()}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Geselecteerde beleggingen tonen ook als geen zoekopdracht */}
              {zoekQuery.length < 2 && selectie.length > 0 && (
                <div style={{ padding: '8px 24px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Geselecteerd</div>
                  {selectie.map(r => (
                    <div key={r.symbol} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                      <MiniAvatar r={r} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.naam}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.symbol}</div>
                      </div>
                      <button onClick={() => toggleSelectie(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <X size={14} color="var(--text-muted)" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {selectie.length === 0 ? 'Selecteer beleggingen om toe te voegen' : `${selectie.length} geselecteerd`}
              </span>
              <button
                onClick={gaaNaarInvoer}
                disabled={selectie.length === 0}
                className="btn btn-primary"
                style={{ opacity: selectie.length === 0 ? 0.5 : 1 }}
              >
                Volgende →
              </button>
            </div>
          </div>
        )}

        {/* Stap 2: Gegevens invullen */}
        {stap === 'invoer' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Tabelheader */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.3fr 0.8fr 32px',
              padding: '10px 24px', background: 'var(--bg)',
              borderBottom: '1px solid var(--border)', flexShrink: 0,
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
              gap: 12,
            }}>
              <span>Naam</span>
              <span>Aankoopdatum</span>
              <span>Kostprijs per stuk</span>
              <span>Aantal</span>
              <span />
            </div>

            {/* Rijen */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {selectie.map(r => {
                const f = forms[r.symbol] || {};
                const isGeldig = f.datum && f.kostprijs && f.aantal;
                return (
                  <div key={r.symbol} style={{
                    display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.3fr 0.8fr 32px',
                    padding: '14px 24px', borderBottom: '1px solid var(--border-light)',
                    alignItems: 'center', gap: 12,
                    background: !isGeldig ? 'var(--bg)' : 'transparent',
                  }}>
                    {/* Naam */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MiniAvatar r={r} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.naam}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.symbol}</div>
                      </div>
                    </div>

                    {/* Aankoopdatum */}
                    <input
                      type="date"
                      value={f.datum || ''}
                      onChange={e => updateForm(r.symbol, 'datum', e.target.value)}
                      style={{
                        border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px',
                        fontSize: 13, fontFamily: 'inherit', width: '100%', background: 'var(--bg-white)',
                        color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                      }}
                    />

                    {/* Kostprijs */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="number"
                        value={f.kostprijs || ''}
                        onChange={e => updateForm(r.symbol, 'kostprijs', e.target.value)}
                        placeholder="0,00"
                        step="0.01"
                        style={{
                          flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px',
                          fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-white)',
                          color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                      <select
                        value={f.munt || 'EUR'}
                        onChange={e => updateForm(r.symbol, 'munt', e.target.value)}
                        style={{
                          border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px',
                          fontSize: 12, fontFamily: 'inherit', background: 'var(--bg-white)',
                          color: 'var(--text-muted)', outline: 'none', cursor: 'pointer',
                        }}
                      >
                        <option>EUR</option><option>USD</option><option>GBP</option>
                      </select>
                    </div>

                    {/* Aantal */}
                    <input
                      type="number"
                      value={f.aantal || ''}
                      onChange={e => updateForm(r.symbol, 'aantal', e.target.value)}
                      placeholder="0"
                      step="0.0001"
                      style={{
                        border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px',
                        fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-white)',
                        color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box',
                      }}
                    />

                    {/* Verwijder */}
                    <button onClick={() => toggleSelectie(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={15} color="var(--text-muted)" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Optionele transactiekosten info */}
            <div style={{ padding: '10px 24px', background: 'var(--bg)', borderTop: '1px solid var(--border-light)', fontSize: 12, color: 'var(--text-muted)' }}>
              💡 Transactiekosten niet gekend? Geen probleem — laat ze weg. Je kan ze later altijd aanpassen bij Beleggingen.
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => setStap('zoek')} className="btn btn-ghost">← Terug</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {selectie.filter(r => { const f = forms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; }).length}/{selectie.length} volledig ingevuld
                </span>
                <button
                  onClick={opslaan}
                  className="btn btn-primary"
                  disabled={!selectie.some(r => { const f = forms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; })}
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
