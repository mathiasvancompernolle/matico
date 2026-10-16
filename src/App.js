import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Overzicht from './pages/Overzicht';
import Beleggingen from './pages/Beleggingen';
import { Analyse } from './pages/Analyse';
import Dividend from './pages/Dividend';
import Belastingen from './pages/Belastingen';
import Instellingen from './pages/Instellingen';
import BeleggingToevoegen from './pages/BeleggingToevoegen';
import ImportBeleggingen from './pages/ImportBeleggingen';
import Markten from './pages/Markten';
import EffectDetail from './pages/EffectDetail';
import CookieConsent from './components/CookieConsent';
import CrispChat from './components/CrispChat';
import Privacybeleid from './pages/Privacybeleid';
import Gids from './pages/Gids';
import MijnProfiel from './pages/MijnProfiel';
import './App.css';
import Landing from './pages/Landing';
import AuthPage from './pages/AuthPage';
import { supabase } from './supabaseClient';
import kapitasLogo from './assets/kapitas-logo.png';
import { LayoutDashboard, TrendingUp, Search, Star, User, X, ChevronRight, PiggyBank, Briefcase, Check } from 'lucide-react';

function TopNav({ actieveSectie, onSectieWissel, navigeerNaar, gebruiker, onSelectEffect }) {
  const {
    t, favorieten, toggleFavoriet, meldingen, ongelezenMeldingen, markeerMeldingGelezen, markeerAlleMeldingenGelezen,
    portfolios, actiefPortfolio, actiefPortfolioId, wisselPortfolio,
  } = useApp();
  const [zoekOpen, setZoekOpen] = React.useState(false);
  const [zoekQuery, setZoekQuery] = React.useState('');
  const [zoekResultaten, setZoekResultaten] = React.useState([]);
  const [zoekLaden, setZoekLaden] = React.useState(false);
  const [profielOpen, setProfielOpen] = React.useState(false);
  const [favorietenOpen, setFavorietenOpen] = React.useState(false);
  const [meldingenOpen, setMeldingenOpen] = React.useState(false);
  const [portfolioOpen, setPortfolioOpen] = React.useState(false);
  const zoekRef = React.useRef(null);
  const profielRef = React.useRef(null);
  const favorietenRef = React.useRef(null);
  const meldingenRef = React.useRef(null);
  const portfolioRef = React.useRef(null);

  // ── Mobiel: zoekbalk wordt een icoon i.p.v. altijd een 220px-breed veld,
  // en de portfolio-wisselaar (op mobiel onbereikbaar via de zijbalk, die
  // daar de bottom-navigatiebalk wordt) krijgt hier een plekje. ──────────
  const [breedte, setBreedte] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  React.useEffect(() => {
    const onResize = () => setBreedte(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isMobiel = breedte < 768;

  React.useEffect(() => {
    const handler = (e) => {
      if (zoekRef.current && !zoekRef.current.contains(e.target)) { setZoekOpen(false); setZoekQuery(''); setZoekResultaten([]); }
      if (profielRef.current && !profielRef.current.contains(e.target)) setProfielOpen(false);
      if (favorietenRef.current && !favorietenRef.current.contains(e.target)) setFavorietenOpen(false);
      if (meldingenRef.current && !meldingenRef.current.contains(e.target)) setMeldingenOpen(false);
      if (portfolioRef.current && !portfolioRef.current.contains(e.target)) setPortfolioOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  React.useEffect(() => {
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
    <nav className="top-nav" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
      {/* Logo als grote home-knop */}
      <div onClick={() => { onSectieWissel('portefeuille'); navigeerNaar('overzicht'); }}
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginRight: isMobiel ? 8 : 16, flexShrink: 0, height: '100%', borderRadius: 8, transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <img src={kapitasLogo} alt="Kapitas" style={{ height: '80%', width: 'auto', display: 'block' }} />
      </div>

      {/* Tabs — enkel op desktop: op mobiel zit deze wissel nu in de vaste
          onderbalk (Portefeuille/Markten/...), die altijd bereikbaar is i.p.v.
          verstopt achter een her-indeuken of te-smal-om-te-swipen tabbalkje. */}
      {!isMobiel && (
        <div style={{ flex: 1 }}>
          <div className="top-nav-inner">
            <button className={`top-nav-tab ${actieveSectie === 'portefeuille' ? 'actief' : ''}`} onClick={() => onSectieWissel('portefeuille')}>{t('nav_portefeuille')}</button>
            <button className={`top-nav-tab ${actieveSectie === 'markten' ? 'actief' : ''}`} onClick={() => onSectieWissel('markten')}>{t('nav_markten')}</button>
          </div>
        </div>
      )}
      {isMobiel && <div style={{ flex: 1 }} />}

      {/* Rechter iconen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

        {/* Zoekbalk — enkel op desktop: op mobiel is "Zoeken" een eigen,
            volwaardige pagina via de onderbalk i.p.v. een icoon-overlay hier. */}
        {!isMobiel && (
        <div ref={zoekRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-white)', border: `1px solid ${zoekOpen ? '#1e3a8a' : 'var(--border)'}`, borderRadius: 8, padding: '5px 10px', width: 220 }}>
                <svg width="15" height="15" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input id="topnav-zoek" value={zoekQuery} onChange={e => { setZoekQuery(e.target.value); setZoekOpen(true); }} onFocus={() => setZoekOpen(true)} placeholder="Zoeken naam/ISIN..." style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', width: '100%', fontFamily: 'inherit' }} />
              </div>
              {zoekOpen && zoekQuery.length >= 2 && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 300, maxHeight: 340, overflowY: 'auto', zIndex: 300 }}>
                  {zoekLaden ? <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Zoeken...</div>
                  : zoekResultaten.length === 0 ? <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen resultaten</div>
                  : zoekResultaten.map((r, i) => (
                    <div key={i} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: i < zoekResultaten.length-1 ? '1px solid var(--border-light)' : 'none' }}
                      onClick={() => {
                        onSelectEffect && onSelectEffect(r);
                        setZoekOpen(false); setZoekQuery(''); setZoekResultaten([]);
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: r.type === 'etf' ? '#eef1f8' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: r.type === 'etf' ? '#1e3a8a' : '#d97706', flexShrink: 0 }}>{r.type === 'etf' ? 'ETF' : 'EQ'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.naam}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.symbol}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </div>
        )}

        {/* Favorieten — enkel op desktop: op mobiel een eigen pagina via de onderbalk */}
        {!isMobiel && (
        <div ref={favorietenRef} style={{ position: 'relative' }}>
          <button onClick={() => setFavorietenOpen(v => !v)} style={{ width: 32, height: 32, border: 'none', borderRadius: 8, background: favorietenOpen ? '#eef1f8' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" fill="none" stroke={favorietenOpen ? '#1e3a8a' : 'var(--text-muted)'} strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          {favorietenOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 280, maxHeight: 340, overflowY: 'auto', zIndex: 300 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Favorieten</div>
              {favorieten.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nog geen favorieten toegevoegd</div>
              ) : (
                favorieten.map(f => (
                  <div key={f.symbol}
                    onClick={() => { onSelectEffect && onSelectEffect(f); setFavorietenOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.naam}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.symbol}{f.beurs ? ` · ${f.beurs}` : ''}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavoriet(f); }}
                      title="Verwijderen uit favorieten"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', flexShrink: 0, display: 'flex' }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        )}

        {/* Meldingen */}
        <div ref={meldingenRef} style={{ position: 'relative' }}>
          <button onClick={() => setMeldingenOpen(v => !v)} style={{ width: 32, height: 32, border: 'none', borderRadius: 8, background: meldingenOpen ? '#eef1f8' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <svg width="16" height="16" fill="none" stroke={meldingenOpen ? '#1e3a8a' : 'var(--text-muted)'} strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {ongelezenMeldingen > 0 && (
              <span style={{ position: 'absolute', top: 2, right: 3, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8, background: '#dc2626', color: 'white', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {ongelezenMeldingen > 9 ? '9+' : ongelezenMeldingen}
              </span>
            )}
          </button>
          {meldingenOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 300, maxHeight: 360, overflowY: 'auto', zIndex: 300 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Meldingen</div>
                {ongelezenMeldingen > 0 && (
                  <button onClick={markeerAlleMeldingenGelezen} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1e3a8a', fontSize: 11, fontWeight: 600 }}>
                    Alles gelezen
                  </button>
                )}
              </div>
              {meldingen.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Nog geen meldingen. Je krijgt hier bericht wanneer een aandeel uit je portefeuille binnenkort cijfers publiceert, en opnieuw zodra ze effectief bekend zijn.
                </div>
              ) : (
                meldingen.map(m => {
                  const isAankomend = m.type === 'aankomend';
                  return (
                  <div key={m.id}
                    onClick={() => {
                      markeerMeldingGelezen(m.id);
                      setMeldingenOpen(false);
                      onSelectEffect && onSelectEffect({ symbol: m.symbol, naam: m.naam });
                    }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', background: m.gelezen ? 'transparent' : (isAankomend ? '#fff7ed' : '#eef1f8') }}
                    onMouseEnter={e => e.currentTarget.style.background = m.gelezen ? 'var(--bg)' : (isAankomend ? '#ffedd5' : '#e2e8f7')}
                    onMouseLeave={e => e.currentTarget.style.background = m.gelezen ? 'transparent' : (isAankomend ? '#fff7ed' : '#eef1f8')}
                  >
                    {!m.gelezen && <div style={{ width: 7, height: 7, borderRadius: '50%', background: isAankomend ? '#d97706' : '#1e3a8a', marginTop: 5, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.naam}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {isAankomend
                          ? <>Publiceert binnenkort cijfers · verwacht {new Date(m.datum).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })} — hou dit in de gaten</>
                          : <>Nieuwe cijfers gepubliceerd · {new Date(m.datum).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}</>
                        }
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Profiel — enkel op desktop: op mobiel een eigen pagina via de onderbalk */}
        {!isMobiel && (
        <div ref={profielRef} style={{ position: 'relative', marginLeft: 4 }}>
          <button onClick={() => setProfielOpen(v => !v)} style={{ width: 30, height: 30, borderRadius: '50%', background: '#1e3a8a', border: 'none', cursor: 'pointer', color: 'white', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>{initialen}</button>
          {profielOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 230, zIndex: 300, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e3a8a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{initialen}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{gebruiker?.voornaam} {gebruiker?.achternaam}</div>
                  <div style={{ fontSize: 11, color: '#1e3a8a', fontWeight: 600 }}>Pro plan</div>
                </div>
              </div>
              <div style={{ padding: '6px 0' }}>
                {[
                  { label: t('profiel_mijn_profiel'), sub: t('profiel_mijn_profiel_sub'), route: 'mijn-profiel' },
                  { label: t('profiel_billing'), sub: t('profiel_billing_sub'), route: 'instellingen' },
                  { label: 'Gids voor beginners', sub: 'Nog eens de basis doornemen', route: 'gids' },
                  { label: t('profiel_privacybeleid'), sub: t('profiel_privacybeleid_sub'), route: 'privacybeleid' },
                ].map(({ label, sub, route }) => (
                  <div key={label} onClick={() => { navigeerNaar(route); setProfielOpen(false); }}
                    style={{ padding: '9px 16px', cursor: 'pointer', fontSize: 13 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                <div onClick={async () => { setProfielOpen(false); await supabase.auth.signOut(); window.location.reload(); }}
                  style={{ padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  {t('profiel_uitloggen')}
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </nav>
  );
}

// ── Mobiel: "Zoeken" als volwaardige pagina (i.p.v. een icoon-overlay in de
// TopNav, die op een smal scherm geen ruimte heeft) ─────────────────────────
function MobielZoekenPagina({ onSelectEffect }) {
  const [query, setQuery] = React.useState('');
  const [resultaten, setResultaten] = React.useState([]);
  const [laden, setLaden] = React.useState(false);

  React.useEffect(() => {
    if (!query || query.length < 2) { setResultaten([]); return; }
    const timer = setTimeout(async () => {
      setLaden(true);
      try {
        const r = await fetch(`/api/data?endpoint=search&q=${encodeURIComponent(query)}`);
        const d = await r.json();
        setResultaten(d?.resultaten || []);
      } catch { setResultaten([]); }
      setLaden(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
        <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Zoeken naam/ISIN..." style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: 'var(--text-primary)', width: '100%', fontFamily: 'inherit' }} />
      </div>
      {query.length < 2 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Typ minstens 2 tekens om te zoeken</div>
      ) : laden ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Zoeken...</div>
      ) : resultaten.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen resultaten</div>
      ) : (
        resultaten.map((r, i) => (
          <div key={i} onMouseDown={e => e.preventDefault()} onClick={() => onSelectEffect && onSelectEffect(r)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', borderBottom: i < resultaten.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.naam}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.symbol}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Mobiel: "Favorieten" als volwaardige pagina ─────────────────────────────
function MobielFavorietenPagina({ onSelectEffect }) {
  const { favorieten, toggleFavoriet } = useApp();
  return (
    <div style={{ padding: 16 }}>
      {favorieten.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nog geen favorieten toegevoegd</div>
      ) : (
        favorieten.map(f => (
          <div key={f.symbol} onClick={() => onSelectEffect && onSelectEffect(f)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 4px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{f.naam}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.symbol}{f.beurs ? ` · ${f.beurs}` : ''}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); toggleFavoriet(f); }} title="Verwijderen uit favorieten"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ── Mobiel: "Profiel" als volwaardige pagina — bundelt wat op desktop
// verspreid zit over de profiel-dropdown + portfolio-wisselaar + Belastingen
// (dat normaal via de sidebar-navigatie loopt, die op mobiel niet rendert). ──
function MobielProfielPagina({ gebruiker, onNavigeer }) {
  const { t, portfolios, actiefPortfolioId, wisselPortfolio } = useApp();
  const initialen = `${gebruiker?.voornaam?.[0] || ''}${gebruiker?.achternaam?.[0] || ''}`.toUpperCase() || 'M';

  const menuItems = [
    { label: t('profiel_mijn_profiel'), sub: t('profiel_mijn_profiel_sub'), route: 'mijn-profiel' },
    { label: 'Belastingen', sub: null, route: 'belastingen' },
    { label: t('profiel_billing'), sub: t('profiel_billing_sub'), route: 'instellingen' },
    { label: 'Gids voor beginners', sub: 'Nog eens de basis doornemen', route: 'gids' },
    { label: t('profiel_privacybeleid'), sub: t('profiel_privacybeleid_sub'), route: 'privacybeleid' },
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px 20px' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1e3a8a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{initialen}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{gebruiker?.voornaam} {gebruiker?.achternaam}</div>
          <div style={{ fontSize: 12, color: '#1e3a8a', fontWeight: 600 }}>Pro plan</div>
        </div>
      </div>

      {portfolios.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px 8px' }}>Portfolio</div>
          <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {portfolios.map(p => (
              <div key={p.id} onClick={() => wisselPortfolio(p.id)}
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', background: p.id === actiefPortfolioId ? 'var(--accent-bg)' : 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 14, fontWeight: p.id === actiefPortfolioId ? 700 : 500 }}>{p.naam}</span>
                {p.id === actiefPortfolioId && <Check size={16} color="#1e3a8a" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        {menuItems.map(({ label, sub, route }, i) => (
          <div key={label} onClick={() => onNavigeer(route)}
            style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: i < menuItems.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
              {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        ))}
      </div>

      <div onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
        style={{ padding: '13px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        {t('profiel_uitloggen')}
      </div>
    </div>
  );
}

function AppInner() {
  const { activeNav, setActiveNav, gebruiker } = useApp();
  const [toevoegenOpen, setToevoegenOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [overzichtResetKey, setOverzichtResetKey] = useState(0);
  const [actieveSectie, setActieveSectie] = useState('portefeuille');
  const [effectDetail, setEffectDetail] = useState(null); // geselecteerd zoekresultaat, toont EffectDetail pagina
  const [cookieToestemming, setCookieToestemming] = useState(null);

  // Mobiele onderbalk: welke van de 5 hoofd-items is actief, en of we op een
  // van de 3 nieuwe volwaardige mobiele pagina's zitten (Zoeken/Favorieten/
  // Profiel) i.p.v. de normale desktop-gelijkende weergave.
  const [breedte, setBreedte] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const isMobiel = breedte < 768;
  const [mobielWeergave, setMobielWeergave] = useState('normaal'); // 'normaal' | 'zoeken' | 'favorieten' | 'profiel'

  React.useEffect(() => {
    const onResize = () => setBreedte(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!gebruiker.voornaam) {
    return <NaamInstellen />;
  }

  const scrollNaarBoven = () => {
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'auto' });
  };

  const navigeerNaar = (doel) => {
    setToevoegenOpen(false);
    setImportOpen(false);
    setEffectDetail(null);
    setMobielWeergave('normaal');
    setActiveNav(doel);
    scrollNaarBoven();
  };

  const naarHome = () => {
    if (mobielWeergave !== 'normaal') { setMobielWeergave('normaal'); return; }
    if (actieveSectie === 'markten') {
      setActieveSectie('portefeuille');
      return;
    }
    if (activeNav === 'overzicht' && !toevoegenOpen && !importOpen) {
      setOverzichtResetKey(k => k + 1);
      scrollNaarBoven();
    } else {
      navigeerNaar('overzicht');
    }
  };

  const handleSectieWissel = (sectie) => {
    setActieveSectie(sectie);
    setEffectDetail(null);
    setMobielWeergave('normaal');
    scrollNaarBoven();
    if (sectie === 'portefeuille') {
      setToevoegenOpen(false);
      setImportOpen(false);
    }
  };

  // Mobiele onderbalk-items wisselen onafhankelijk van de desktop-secties/activeNav.
  const kiesMobielWeergave = (weergave) => {
    setEffectDetail(null);
    setToevoegenOpen(false);
    setImportOpen(false);
    if (weergave === 'portefeuille') {
      setMobielWeergave('normaal');
      setActieveSectie('portefeuille');
    } else if (weergave === 'markten') {
      setMobielWeergave('normaal');
      setActieveSectie('markten');
    } else {
      setMobielWeergave(weergave); // 'zoeken' | 'favorieten' | 'profiel'
    }
    scrollNaarBoven();
  };

  const mobielActieveTab = mobielWeergave !== 'normaal'
    ? mobielWeergave
    : (actieveSectie === 'markten' ? 'markten' : 'portefeuille');

  const renderPage = () => {
    // effectDetail (een gekozen zoekresultaat/favoriet) moet vóór de mobiele
    // weergave-checks komen: anders blijft bv. de zoekpagina zelf getoond
    // worden nadat je op een resultaat tikt, omdat mobielWeergave nog
    // steeds 'zoeken' is — het leek dan alsof je er niet op kon drukken.
    if (effectDetail) return <EffectDetail effect={effectDetail} onTerug={() => setEffectDetail(null)} />;
    if (isMobiel && mobielWeergave === 'zoeken') return <MobielZoekenPagina onSelectEffect={setEffectDetail} />;
    if (isMobiel && mobielWeergave === 'favorieten') return <MobielFavorietenPagina onSelectEffect={setEffectDetail} />;
    if (isMobiel && mobielWeergave === 'profiel') return <MobielProfielPagina gebruiker={gebruiker} onNavigeer={navigeerNaar} />;
    if (actieveSectie === 'markten') return <Markten onSelectEffect={setEffectDetail} />;
    if (importOpen) return <ImportBeleggingen onClose={() => setImportOpen(false)} />;
    if (toevoegenOpen) return <BeleggingToevoegen onClose={() => setToevoegenOpen(false)} />;
    const openToevoegen = () => setToevoegenOpen(true);
    const openImporteren = () => setImportOpen(true);
    switch (activeNav) {
      case 'overzicht': return <Overzicht key={overzichtResetKey} onToevoegen={openToevoegen} onImporteren={openImporteren} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(v => !v)} />;
      case 'beleggingen': return <Beleggingen onToevoegen={openToevoegen} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(v => !v)} />;
      case 'analyse': return <Analyse sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(v => !v)} />;
      case 'dividend': return <Dividend sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(v => !v)} />;
      case 'belastingen': return <Belastingen sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(v => !v)} />;
      case 'instellingen': return <Instellingen sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(v => !v)} />;
      case 'privacybeleid': return <Privacybeleid />;
      case 'gids': return <Gids />;
      case 'mijn-profiel': return <MijnProfiel sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(v => !v)} />;
      default: return <Overzicht key={overzichtResetKey} onToevoegen={openToevoegen} onImporteren={openImporteren} />;
    }
  };

  const toonSidebar = actieveSectie === 'portefeuille' && !effectDetail && !isMobiel;

  // De subtabs-rij (Overzicht/Beleggingen/Analyse/Dividend) vervangt op mobiel
  // de sidebar binnen de Portefeuille-sectie, zodat die navigatie altijd
  // bereikbaar blijft zonder de desktop-sidebar te hoeven aanpassen.
  const toonMobielSubtabs = isMobiel && mobielWeergave === 'normaal' && actieveSectie === 'portefeuille' && !effectDetail && !toevoegenOpen && !importOpen;
  const subtabItems = [
    { key: 'overzicht', label: 'Overzicht' },
    { key: 'beleggingen', label: 'Beleggingen' },
    { key: 'analyse', label: 'Analyse' },
    { key: 'dividend', label: 'Dividend' },
  ];

  const bottomBarItems = [
    { key: 'portefeuille', label: 'Portefeuille', icon: Briefcase },
    { key: 'markten', label: 'Markten', icon: TrendingUp },
    { key: 'zoeken', label: 'Zoeken', icon: Search },
    { key: 'favorieten', label: 'Favorieten', icon: Star },
    { key: 'profiel', label: 'Profiel', icon: User },
  ];

  return (
    <div className="app-wrapper">
      <TopNav actieveSectie={actieveSectie} onSectieWissel={handleSectieWissel} navigeerNaar={navigeerNaar} gebruiker={gebruiker} onSelectEffect={setEffectDetail} />
      <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${toonSidebar ? '' : 'zonder-sidebar'}`}>
        {toonSidebar && (
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            onHome={naarHome}
            onNavigate={navigeerNaar}
          />
        )}
        <main className="app-main">
          {toonMobielSubtabs && (
            <div className="mobiel-subtabs">
              {subtabItems.map(({ key, label }) => (
                <button key={key} className={`mobiel-subtab ${activeNav === key ? 'actief' : ''}`} onClick={() => navigeerNaar(key)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {renderPage()}
        </main>
      </div>
      {isMobiel && (
        <nav className="mobiel-bottom-bar">
          {bottomBarItems.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`mobiel-bottom-bar-item ${mobielActieveTab === key ? 'actief' : ''}`} onClick={() => kiesMobielWeergave(key)}>
              <Icon size={20} strokeWidth={2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
      <CookieConsent onWijziging={setCookieToestemming} />
      <CrispChat toestemming={cookieToestemming} />
    </div>
  );
}

function NaamInstellen() {
  const { setGebruiker } = useApp();
  const [voornaam, setVoornaam] = useState('');
  const [achternaam, setAchternaam] = useState('');

  const opslaan = () => {
    if (voornaam.trim()) {
      setGebruiker(g => ({ ...g, voornaam: voornaam.trim(), achternaam: achternaam.trim() }));
    }
  };

  return (
    <div className="naam-instellen">
      <div className="naam-card">
        <img src={kapitasLogo} alt="Kapitas" className="naam-logo" style={{ height: 32, width: 'auto' }} />
        <h1>Welkom bij Kapitas</h1>
        <p>Hoe mogen we je noemen?</p>
        <input type="text" placeholder="Voornaam" value={voornaam}
          onChange={e => setVoornaam(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && opslaan()} autoFocus />
        <input type="text" placeholder="Achternaam (optioneel)" value={achternaam}
          onChange={e => setAchternaam(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && opslaan()} />
        <button onClick={opslaan} disabled={!voornaam.trim()}>Aan de slag →</button>
      </div>
    </div>
  );
}

export default function App() {
  const [toonLanding, setToonLanding] = React.useState(true);
  const [toonPubliekPrivacybeleid, setToonPubliekPrivacybeleid] = React.useState(() => {
    const pad = window.location.pathname.toLowerCase().replace(/\/$/, '');
    return pad === '/privacybeleid';
  });
  const [toonPubliekGids, setToonPubliekGids] = React.useState(() => {
    const pad = window.location.pathname.toLowerCase().replace(/\/$/, '');
    return pad === '/gids';
  });
  const [authStartModus, setAuthStartModus] = React.useState('login');
  const [gebruiker, setGebruiker] = React.useState(null);
  const [authLaden, setAuthLaden] = React.useState(true);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setGebruiker(session.user);
        setToonLanding(false);
      }
      setAuthLaden(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setGebruiker(session.user);
        setToonLanding(false);
      } else {
        setGebruiker(null);
        setToonLanding(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLaden) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ color: '#1e3a8a', fontSize: 16, fontWeight: 600 }}>Kapitas laden...</div>
      </div>
    );
  }

  if (toonLanding && !gebruiker) {
    if (toonPubliekPrivacybeleid) {
      return <Privacybeleid onTerug={() => { window.history.pushState(null, '', '/'); setToonPubliekPrivacybeleid(false); }} />;
    }
    if (toonPubliekGids) {
      return <Gids onTerug={() => { window.history.pushState(null, '', '/'); setToonPubliekGids(false); }} onNaarApp={(modus) => { window.history.pushState(null, '', '/'); setToonPubliekGids(false); setToonLanding(false); setAuthStartModus(modus || 'registreren'); }} />;
    }
    return <Landing onNaarApp={(modus) => { setToonLanding(false); setAuthStartModus(modus || 'login'); }} onPrivacybeleid={() => setToonPubliekPrivacybeleid(true)} onGids={() => setToonPubliekGids(true)} />;
  }

  if (!gebruiker) {
    if (toonPubliekPrivacybeleid) {
      return <Privacybeleid onTerug={() => { window.history.pushState(null, '', '/'); setToonPubliekPrivacybeleid(false); }} />;
    }
    if (toonPubliekGids) {
      return <Gids onTerug={() => { window.history.pushState(null, '', '/'); setToonPubliekGids(false); }} onNaarApp={(modus) => { window.history.pushState(null, '', '/'); setToonPubliekGids(false); setAuthStartModus(modus || 'registreren'); }} />;
    }
    return <AuthPage onIngelogd={(user) => setGebruiker(user)} onPrivacybeleid={() => setToonPubliekPrivacybeleid(true)} startModus={authStartModus} onTerugNaarLanding={() => setToonLanding(true)} />;
  }

  return (
    <AppProvider supabaseGebruiker={gebruiker}>
      <AppInner />
    </AppProvider>
  );
}
