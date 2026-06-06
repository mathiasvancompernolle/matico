import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, ChevronDown, Calendar, MoreVertical, Search, ArrowLeft, X, Trash2 } from 'lucide-react';
import BeleggingDetail from '../components/BeleggingDetail';

// ── kleine hulpfuncties ──────────────────────────────────────────
function Avatar({ symbol, logo }) {
  if (logo) {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: 10, overflow: 'hidden',
        border: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-white)'
      }}>
        <img src={logo} alt={symbol} style={{ width: 28, height: 28, objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
        <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center',
          background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>
          {symbol.slice(0, 2).toUpperCase()}
        </div>
      </div>
    );
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, background: 'var(--accent-bg)',
      color: 'var(--accent)', fontWeight: 700, fontSize: 13, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

function KebabMenu({ onDetail, onVerkopen, onVerwijder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px',
          borderRadius: 6, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', background: 'var(--bg-white)',
          border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)',
          zIndex: 100, minWidth: 160, overflow: 'hidden'
        }}>
          <button onClick={e => { e.stopPropagation(); setOpen(false); onDetail(); }}
            style={menuItemStyle}>Detail bekijken</button>
          <button onClick={e => { e.stopPropagation(); setOpen(false); onVerkopen(); }}
            style={menuItemStyle}>Verkoop registreren</button>
          <div style={{ height: 1, background: 'var(--border-light)' }} />
          <button onClick={e => { e.stopPropagation(); setOpen(false); onVerwijder(); }}
            style={{ ...menuItemStyle, color: 'var(--red)' }}>Verwijderen</button>
        </div>
      )}
    </div>
  );
}

const menuItemStyle = {
  display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
  border: 'none', padding: '10px 16px', fontSize: 13, cursor: 'pointer',
  fontFamily: 'inherit', color: 'var(--text-primary)',
  transition: 'background 0.1s'
};

// ── Verkoop Registreren Modal ────────────────────────────────────
function VerkoopModal({ beleggingen, koersen, onClose, onBevestig }) {
  const [stap, setStap] = useState('kiezen'); // 'kiezen' | 'invullen'
  const [zoek, setZoek] = useState('');
  const [gekozen, setGekozen] = useState(null);
  const [form, setForm] = useState({ datum: new Date().toLocaleDateString('nl-BE'), aantal: '', koers: '', munt: 'EUR' });

  // Pre-fill koers als beschikbaar
  useEffect(() => {
    if (gekozen) {
      const k = koersen[gekozen.symbol];
      const koers = k ? k.c.toFixed(2) : gekozen.kostprijs.toFixed(2);
      const munt = gekozen.munt || 'EUR';
      setForm({
        datum: new Date().toLocaleDateString('nl-BE'),
        aantal: gekozen.aantal.toString(),
        koers,
        munt
      });
      setStap('invullen');
    }
  }, [gekozen]);

  const gefilterd = beleggingen.filter(b =>
    b.naam.toLowerCase().includes(zoek.toLowerCase()) ||
    b.symbol.toLowerCase().includes(zoek.toLowerCase())
  );

  const bevestig = () => {
    if (!form.datum || !form.aantal || !form.koers) return;
    onBevestig(gekozen, {
      datum: form.datum,
      aantal: parseFloat(form.aantal),
      koers: parseFloat(form.koers),
      munt: form.munt
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-white)', borderRadius: 16, padding: '32px',
        width: 520, maxWidth: '90vw', boxShadow: 'var(--shadow-lg)', position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        {/* Sluitknop */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'transparent',
          border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4
        }}><X size={20} /></button>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Verkoop registreren</h2>

        {stap === 'kiezen' ? (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              Kies een actieve belegging om te verkopen.
            </p>
            {/* Zoekbalk */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                autoFocus
                value={zoek}
                onChange={e => setZoek(e.target.value)}
                placeholder="Zoek op naam of symbool..."
                style={{
                  width: '100%', padding: '10px 14px 10px 40px',
                  border: '1.5px solid var(--border)', borderRadius: 10,
                  fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  color: 'var(--text-primary)', background: 'var(--bg)'
                }}
              />
            </div>
            {/* Lijst */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              {gefilterd.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Geen beleggingen gevonden
                </div>
              ) : gefilterd.map((b, i) => (
                <div key={b.id}
                  onClick={() => setGekozen(b)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    cursor: 'pointer', borderBottom: i < gefilterd.length - 1 ? '1px solid var(--border-light)' : 'none',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Avatar symbol={b.symbol} logo={b.logo} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{b.naam}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {b.symbol} · {b.aantal} stuk{b.aantal !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: 'rotate(-90deg)' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{
                padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 8,
                background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500
              }}>Annuleren</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Vul de verkoopgegevens in van <strong>{gekozen.naam} ({gekozen.symbol})</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Verkoopdatum */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Verkoopdatum</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={form.datum}
                    onChange={e => setForm(f => ({ ...f, datum: e.target.value }))}
                    style={inputStyle}
                  />
                  <Calendar size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
              </div>
              {/* Aantal */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Aantal</label>
                <input
                  type="number"
                  value={form.aantal}
                  onChange={e => setForm(f => ({ ...f, aantal: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              {/* Verkoopkoers */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Verkoopkoers per stuk</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    value={form.koers}
                    onChange={e => setForm(f => ({ ...f, koers: e.target.value }))}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <select value={form.munt} onChange={e => setForm(f => ({ ...f, munt: e.target.value }))}
                    style={{ ...inputStyle, width: 80 }}>
                    <option>EUR</option><option>USD</option><option>GBP</option>
                  </select>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Ingevuld op basis van de laatst bekende koers op {new Date().toLocaleDateString('nl-BE')}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setStap('kiezen')} style={{
                padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 8,
                background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500
              }}>Terug</button>
              <button onClick={bevestig} style={{
                padding: '10px 24px', background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 600
              }}>Markeren als verkocht</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)',
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none',
  color: 'var(--text-primary)', background: 'var(--bg-white)'
};

// ── Hoofd component ──────────────────────────────────────────────
export default function Beleggingen({ onToevoegen }) {
  const { beleggingen, setBeleggingen, koersen, verkochteBeleggingen, setVerkochteBeleggingen } = useApp();
  const [tab, setTab] = useState('actief');
  const [detailBelegging, setDetailBelegging] = useState(null);
  const [verkoopModal, setVerkoopModal] = useState(false);
  const [verkoopVoorBelegging, setVerkoopVoorBelegging] = useState(null);

  const verwijder = (id) => {
    if (window.confirm('Wil je deze belegging verwijderen?')) {
      setBeleggingen(prev => prev.filter(b => b.id !== id));
    }
  };

  const openVerkoopModal = (belegging = null) => {
    setVerkoopVoorBelegging(belegging);
    setVerkoopModal(true);
  };

  const registreerVerkoop = (belegging, verkoopdata) => {
    const verkochte = {
      ...belegging,
      verkoopdatum: verkoopdata.datum,
      aantalVerkocht: verkoopdata.aantal,
      verkoopkoers: verkoopdata.koers,
      verkoopMunt: verkoopdata.munt,
      winstverlies: (verkoopdata.koers - belegging.kostprijs) * verkoopdata.aantal
    };
    setVerkochteBeleggingen(prev => [...(prev || []), verkochte]);
    // Verwijder (deels) uit actieve beleggingen
    setBeleggingen(prev => {
      const updated = prev.map(b => {
        if (b.id !== belegging.id) return b;
        const resterend = b.aantal - verkoopdata.aantal;
        if (resterend <= 0) return null;
        return { ...b, aantal: resterend };
      }).filter(Boolean);
      return updated;
    });
  };

  const muntSymbool = (munt) => munt === 'USD' ? '$' : munt === 'GBP' ? '£' : '€';

  const ColHeader = ({ children }) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'default', userSelect: 'none' }}>
      {children}
    </span>
  );

  return (
    <div style={{ padding: '0 0 60px' }}>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>Beleggingen</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={onToevoegen}>
            <Plus size={16} /> Beleggingen toevoegen
          </button>
        </div>
      </div>

      <div style={{ padding: '0 32px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {['actief', 'verkocht'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 20px', border: 'none', background: 'transparent',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', textTransform: 'capitalize', marginBottom: -1
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── ACTIEF TAB ── */}
        {tab === 'actief' && (
          <>
            {beleggingen.length === 0 ? (
              <div className="empty-state">
                <Plus size={40} />
                <h3>Nog geen beleggingen</h3>
                <p>Voeg je eerste belegging toe om te beginnen</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onToevoegen}>
                  Belegging toevoegen
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Beleggingen</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Automatisch opgevolgd door Matico</div>
                </div>

                {/* Kolomhoofden */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2.5fr 1.2fr 1.4fr 0.8fr 40px',
                  padding: '8px 24px',
                  borderBottom: '1px solid var(--border-light)',
                  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                  alignItems: 'center'
                }}>
                  <ColHeader>Naam ↕</ColHeader>
                  <ColHeader>Aankoopdatum ↕</ColHeader>
                  <ColHeader>Kostprijs per stuk ↕</ColHeader>
                  <ColHeader>Aantal ↕</ColHeader>
                  <span />
                </div>

                {/* Rijen */}
                {beleggingen.map((b) => {
                  const ms = muntSymbool(b.munt || 'EUR');
                  return (
                    <div key={b.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '2.5fr 1.2fr 1.4fr 0.8fr 40px',
                      padding: '14px 24px',
                      borderBottom: '1px solid var(--border-light)',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.1s'
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setDetailBelegging(b)}
                    >
                      {/* Naam */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar symbol={b.symbol} logo={b.logo} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{b.naam}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.symbol}</div>
                        </div>
                      </div>

                      {/* Datum */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '5px 10px', border: '1px solid var(--border)',
                          borderRadius: 7, fontSize: 13, fontFamily: 'DM Mono, monospace',
                          background: 'var(--bg-white)', color: 'var(--text-primary)'
                        }}>
                          {b.datum || '—'}
                        </span>
                        <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>

                      {/* Kostprijs */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          flex: 1, padding: '5px 10px', border: '1px solid var(--border)',
                          borderRadius: 7, fontSize: 13, fontFamily: 'DM Mono, monospace',
                          background: 'var(--bg-white)', color: 'var(--text-primary)',
                          minWidth: 80
                        }}>
                          {b.kostprijs.toFixed(2)}
                        </span>
                        <span style={{
                          padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 7,
                          fontSize: 12, background: 'var(--bg)', color: 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', gap: 4, cursor: 'default'
                        }}>
                          {b.munt || 'EUR'} <ChevronDown size={12} />
                        </span>
                      </div>

                      {/* Aantal */}
                      <div>
                        <span style={{
                          padding: '5px 10px', border: '1px solid var(--border)',
                          borderRadius: 7, fontSize: 13, fontFamily: 'DM Mono, monospace',
                          background: 'var(--bg-white)', color: 'var(--text-primary)',
                          display: 'inline-block'
                        }}>
                          {b.aantal}
                        </span>
                      </div>

                      {/* Kebab menu */}
                      <div onClick={e => e.stopPropagation()}>
                        <KebabMenu
                          onDetail={() => setDetailBelegging(b)}
                          onVerkopen={() => openVerkoopModal(b)}
                          onVerwijder={() => verwijder(b.id)}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Opslaan knop (rechtsonder, zoals Plutu) */}
                <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => openVerkoopModal()}
                    style={{
                      padding: '9px 20px', background: 'var(--accent)', color: 'white',
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 600
                    }}
                  >
                    Verkoop registreren
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── VERKOCHT TAB ── */}
        {tab === 'verkocht' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                onClick={() => openVerkoopModal()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', background: 'var(--accent)', color: 'white',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600
                }}
              >
                <Plus size={15} /> Verkoop registreren
              </button>
            </div>

            {(!verkochteBeleggingen || verkochteBeleggingen.length === 0) ? (
              <div className="empty-state">
                <Trash2 size={40} />
                <h3>Geen verkochte beleggingen</h3>
                <p>Zodra je een belegging verkoopt, verschijnt die hier</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Verkochte beleggingen</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Afgeronde posities</div>
                </div>

                {/* Kolomhoofden */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2.5fr 1.2fr 1.2fr 1.2fr 1fr 40px',
                  padding: '8px 24px',
                  borderBottom: '1px solid var(--border-light)',
                  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                  alignItems: 'center'
                }}>
                  <span>Naam ↕</span>
                  <span>Verkoopdatum ↕</span>
                  <span>Aankoopkoers ↕</span>
                  <span>Verkoopkoers ↕</span>
                  <span>Winst/Verlies ↕</span>
                  <span />
                </div>

                {verkochteBeleggingen.map((b) => {
                  const wv = b.winstverlies || 0;
                  const isPos = wv >= 0;
                  const ms = muntSymbool(b.verkoopMunt || b.munt || 'EUR');
                  return (
                    <div key={b.id + b.verkoopdatum} style={{
                      display: 'grid',
                      gridTemplateColumns: '2.5fr 1.2fr 1.2fr 1.2fr 1fr 40px',
                      padding: '14px 24px',
                      borderBottom: '1px solid var(--border-light)',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar symbol={b.symbol} logo={b.logo} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{b.naam}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.symbol}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontFamily: 'DM Mono, monospace' }}>{b.verkoopdatum}</div>
                      <div style={{ fontSize: 13, fontFamily: 'DM Mono, monospace' }}>
                        {muntSymbool(b.munt || 'EUR')}{b.kostprijs.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 13, fontFamily: 'DM Mono, monospace' }}>
                        {ms}{b.verkoopkoers?.toFixed(2) || '—'}
                      </div>
                      <div style={{
                        fontSize: 13, fontFamily: 'DM Mono, monospace', fontWeight: 600,
                        color: isPos ? 'var(--green)' : 'var(--red)'
                      }}>
                        {isPos ? '+' : ''}{ms}{wv.toFixed(2)}
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm('Verkoop verwijderen?')) {
                            setVerkochteBeleggingen(prev => prev.filter((_, i) => prev[i] !== b));
                          }
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: '4px 6px', borderRadius: 6 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {verkoopModal && (
        <VerkoopModal
          beleggingen={verkoopVoorBelegging ? [verkoopVoorBelegging] : beleggingen}
          koersen={koersen}
          onClose={() => { setVerkoopModal(false); setVerkoopVoorBelegging(null); }}
          onBevestig={registreerVerkoop}
        />
      )}
      {detailBelegging && (
        <BeleggingDetail belegging={detailBelegging} onClose={() => setDetailBelegging(null)} />
      )}
    </div>
  );
}
