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
import Analyseren from './pages/Analyseren';
import EffectDetail from './pages/EffectDetail';
import CookieConsent from './components/CookieConsent';
import CrispChat from './components/CrispChat';
import Privacybeleid from './pages/Privacybeleid';
import MijnProfiel from './pages/MijnProfiel';
import './App.css';
import Landing from './pages/Landing';
import AuthPage from './pages/AuthPage';
import { supabase } from './supabaseClient';
import kapitasLogo from './assets/kapitas-logo.png';

function TopNav({ actieveSectie, onSectieWissel, navigeerNaar, gebruiker, onSelectEffect }) {
  const { t, favorieten, toggleFavoriet } = useApp();
  const [zoekOpen, setZoekOpen] = React.useState(false);
  const [zoekQuery, setZoekQuery] = React.useState('');
  const [zoekResultaten, setZoekResultaten] = React.useState([]);
  const [zoekLaden, setZoekLaden] = React.useState(false);
  const [profielOpen, setProfielOpen] = React.useState(false);
  const [favorietenOpen, setFavorietenOpen] = React.useState(false);
  const zoekRef = React.useRef(null);
  const profielRef = React.useRef(null);
  const favorietenRef = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => {
      if (zoekRef.current && !zoekRef.current.contains(e.target)) { setZoekOpen(false); setZoekQuery(''); setZoekResultaten([]); }
      if (profielRef.current && !profielRef.current.contains(e.target)) setProfielOpen(false);
      if (favorietenRef.current && !favorietenRef.current.contains(e.target)) setFavorietenOpen(false);
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
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginRight: 16, flexShrink: 0, height: '100%', borderRadius: 8, transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <img src={kapitasLogo} alt="Kapitas" style={{ height: '80%', width: 'auto', display: 'block' }} />
      </div>

      {/* Tabs */}
      <div className="top-nav-inner" style={{ flex: 1 }}>
        <button className={`top-nav-tab ${actieveSectie === 'portefeuille' ? 'actief' : ''}`} onClick={() => onSectieWissel('portefeuille')}>{t('nav_portefeuille')}</button>
        <button className={`top-nav-tab ${actieveSectie === 'markten' ? 'actief' : ''}`} onClick={() => onSectieWissel('markten')}>{t('nav_markten')}</button>
        {gebruiker?.email?.trim().toLowerCase() === 'mathiasvancompernolle@gmail.com' && (
          <button className={`top-nav-tab ${actieveSectie === 'analyseren' ? 'actief' : ''}`} onClick={() => onSectieWissel('analyseren')}>Analyseren</button>
        )}
      </div>

      {/* Rechter iconen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

        {/* Zoekbalk */}
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

        {/* Favorieten */}
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

        {/* Meldingen */}
        <button style={{ width: 32, height: 32, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>

        {/* Profiel */}
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
      </div>
    </nav>
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
    setActiveNav(doel);
    scrollNaarBoven();
  };

  const naarHome = () => {
    if (actieveSectie === 'markten' || actieveSectie === 'analyseren') {
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
    scrollNaarBoven();
    if (sectie === 'portefeuille') {
      setToevoegenOpen(false);
      setImportOpen(false);
    }
  };

  const renderPage = () => {
    if (effectDetail) return <EffectDetail effect={effectDetail} onTerug={() => setEffectDetail(null)} />;
    if (actieveSectie === 'markten') return <Markten onSelectEffect={setEffectDetail} />;
    if (actieveSectie === 'analyseren') return <Analyseren />;
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
      case 'mijn-profiel': return <MijnProfiel sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(v => !v)} />;
      default: return <Overzicht key={overzichtResetKey} onToevoegen={openToevoegen} onImporteren={openImporteren} />;
    }
  };

  const toonSidebar = actieveSectie === 'portefeuille' && !effectDetail;

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
          {renderPage()}
        </main>
      </div>
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
    return <Landing onNaarApp={(modus) => { setToonLanding(false); setAuthStartModus(modus || 'login'); }} onPrivacybeleid={() => setToonPubliekPrivacybeleid(true)} />;
  }

  if (!gebruiker) {
    if (toonPubliekPrivacybeleid) {
      return <Privacybeleid onTerug={() => { window.history.pushState(null, '', '/'); setToonPubliekPrivacybeleid(false); }} />;
    }
    return <AuthPage onIngelogd={(user) => setGebruiker(user)} onPrivacybeleid={() => setToonPubliekPrivacybeleid(true)} startModus={authStartModus} onTerugNaarLanding={() => setToonLanding(true)} />;
  }

  return (
    <AppProvider supabaseGebruiker={gebruiker}>
      <AppInner />
    </AppProvider>
  );
}
