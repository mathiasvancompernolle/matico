// src/components/TopNav.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Search, Star, Bell, User, X, LogOut, Settings, CreditCard, ChevronRight, Heart } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useApp } from '../context/AppContext';

export default function TopNav({ actievePagina, onNavigate }) {
  const { gebruiker } = useApp();
  const [zoekOpen, setZoekOpen] = useState(false);
  const [zoekQuery, setZoekQuery] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [zoekLaden, setZoekLaden] = useState(false);
  const [profielOpen, setProfielOpen] = useState(false);
  const [favorietenOpen, setFavorietenOpen] = useState(false);
  const [meldingen] = useState([]);
  const zoekRef = useRef(null);
  const profielRef = useRef(null);
  const favorietenRef = useRef(null);

  // Sluit dropdowns bij klik buiten
  useEffect(() => {
    const handler = (e) => {
      if (zoekRef.current && !zoekRef.current.contains(e.target)) {
        setZoekOpen(false);
        setZoekQuery('');
        setZoekResultaten([]);
      }
      if (profielRef.current && !profielRef.current.contains(e.target)) setProfielOpen(false);
      if (favorietenRef.current && !favorietenRef.current.contains(e.target)) setFavorietenOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Zoekfunctie
  useEffect(() => {
    if (!zoekQuery || zoekQuery.length < 2) { setZoekResultaten([]); return; }
    const timer = setTimeout(async () => {
      setZoekLaden(true);
      try {
        const r = await fetch(`/api/data?endpoint=search&q=${encodeURIComponent(zoekQuery)}`);
        const d = await r.json();
        setZoekResultaten(d?.resultaten || []);
      } catch { setZoekResultaten([]); }
      setZoekLaden(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [zoekQuery]);

  const initialen = `${gebruiker?.voornaam?.[0] || ''}${gebruiker?.achternaam?.[0] || ''}`.toUpperCase() || 'M';

  return (
    <header style={{
      height: 56, background: 'var(--bg-white)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 20px',
      position: 'sticky', top: 0, zIndex: 100, gap: 8,
    }}>
      {/* Logo */}
      <div
        onClick={() => onNavigate('overzicht')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginRight: 24, flexShrink: 0 }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: '#6366f1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 800, fontSize: 14,
        }}>M</div>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#6366f1', letterSpacing: '-0.3px' }}>Matico</span>
      </div>

      {/* Navigatie tabs */}
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {[
          { id: 'overzicht', label: 'Portefeuille', sub: ['overzicht','beleggingen','analyse','dividend','belastingen'] },
          { id: 'markten', label: 'Markten', sub: ['markten'] },
        ].map(tab => {
          const actief = tab.sub.includes(actievePagina);
          return (
            <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{
              padding: '6px 14px', border: 'none', background: 'transparent',
              fontFamily: 'inherit', fontSize: 14, fontWeight: actief ? 700 : 500,
              color: actief ? '#6366f1' : 'var(--text-secondary)',
              borderBottom: actief ? '2px solid #6366f1' : '2px solid transparent',
              cursor: 'pointer', borderRadius: '4px 4px 0 0', marginBottom: -1,
            }}>{tab.label}</button>
          );
        })}
      </div>

      {/* Rechter iconen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

        {/* Zoekbalk */}
        <div ref={zoekRef} style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: zoekOpen ? 'var(--bg-white)' : 'var(--bg)',
            border: `1px solid ${zoekOpen ? '#6366f1' : 'var(--border)'}`,
            borderRadius: 8, padding: '5px 10px', transition: 'all 0.2s',
            width: zoekOpen ? 220 : 36,
          }}>
            <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0, cursor: 'pointer' }}
              onClick={() => { setZoekOpen(true); setTimeout(() => document.getElementById('topnav-zoek')?.focus(), 50); }} />
            {zoekOpen && (
              <input
                id="topnav-zoek"
                value={zoekQuery}
                onChange={e => setZoekQuery(e.target.value)}
                placeholder="Zoeken naam/ISIN..."
                style={{
                  border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 13, color: 'var(--text-primary)', width: '100%',
                  fontFamily: 'inherit',
                }}
              />
            )}
            {zoekOpen && zoekQuery && (
              <X size={13} color="var(--text-muted)" style={{ cursor: 'pointer', flexShrink: 0 }}
                onClick={() => { setZoekQuery(''); setZoekResultaten([]); }} />
            )}
          </div>

          {/* Zoekresultaten dropdown */}
          {zoekOpen && (zoekQuery.length >= 2) && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--bg-white)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              width: 320, maxHeight: 360, overflowY: 'auto', zIndex: 200,
            }}>
              {zoekLaden ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Zoeken...</div>
              ) : zoekResultaten.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen resultaten gevonden</div>
              ) : zoekResultaten.map((r, i) => (
                <div key={i} onClick={() => { setZoekOpen(false); setZoekQuery(''); setZoekResultaten([]); }}
                  style={{
                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', borderBottom: i < zoekResultaten.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, background: r.type === 'etf' ? '#eef2ff' : '#fef3c7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: r.type === 'etf' ? '#6366f1' : '#d97706', flexShrink: 0,
                  }}>{r.type === 'etf' ? 'ETF' : 'EQ'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.naam}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.symbol} · {r.beurs || r.exchange || ''}</div>
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Favorieten */}
        <div ref={favorietenRef} style={{ position: 'relative' }}>
          <button onClick={() => setFavorietenOpen(v => !v)} style={{
            width: 34, height: 34, border: 'none', borderRadius: 8,
            background: favorietenOpen ? '#eef2ff' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Star size={17} color={favorietenOpen ? '#6366f1' : 'var(--text-muted)'} />
          </button>
          {favorietenOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--bg-white)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              width: 280, zIndex: 200,
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                Favorieten
              </div>
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Heart size={28} color="var(--text-muted)" style={{ marginBottom: 8, opacity: 0.4 }} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nog geen favorieten</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Voeg aandelen of ETFs toe via de zoekbalk</div>
              </div>
            </div>
          )}
        </div>

        {/* Meldingen */}
        <div style={{ position: 'relative' }}>
          <button style={{
            width: 34, height: 34, border: 'none', borderRadius: 8,
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            <Bell size={17} color="var(--text-muted)" />
            {meldingen.length > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4, width: 8, height: 8,
                borderRadius: '50%', background: '#6366f1', border: '2px solid var(--bg-white)',
              }} />
            )}
          </button>
        </div>

        {/* Profiel */}
        <div ref={profielRef} style={{ position: 'relative', marginLeft: 4 }}>
          <button onClick={() => setProfielOpen(v => !v)} style={{
            width: 32, height: 32, borderRadius: '50%', background: '#6366f1',
            border: 'none', cursor: 'pointer', color: 'white',
            fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
          }}>{initialen}</button>

          {profielOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 8,
              background: 'var(--bg-white)', border: '1px solid var(--border)',
              borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              width: 240, zIndex: 200, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{initialen}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{gebruiker?.voornaam} {gebruiker?.achternaam}</div>
                  <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Pro plan</div>
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: '6px 0' }}>
                {[
                  { icon: <User size={15} />, label: 'Mijn profiel', sub: 'Account & instellingen', onClick: () => { onNavigate('instellingen'); setProfielOpen(false); } },
                  { icon: <CreditCard size={15} />, label: 'Billing', sub: 'Abonnement beheren', onClick: () => { onNavigate('instellingen'); setProfielOpen(false); } },
                  { icon: <Settings size={15} />, label: 'Instellingen', sub: 'Weergave & voorkeuren', onClick: () => { onNavigate('instellingen'); setProfielOpen(false); } },
                ].map(({ icon, label, sub, onClick }) => (
                  <div key={label} onClick={onClick} style={{
                    padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider + logout */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                <div onClick={async () => { setProfielOpen(false); await supabase.auth.signOut(); window.location.reload(); }}
                  style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', color: '#dc2626' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={15} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Uitloggen</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
