// v2-auth-logout
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, BarChart2, TrendingUp, DollarSign,
  Receipt, Settings, MoreHorizontal, Plus, ChevronDown,
  Check, Trash2, Pencil, X, PiggyBank, Briefcase,
  User, CreditCard, LogOut
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const navItems = [
  { id: 'overzicht', label: 'Overzicht', icon: LayoutDashboard },
  { id: 'beleggingen', label: 'Beleggingen', icon: BarChart2 },
  { id: 'analyse', label: 'Analyse', icon: TrendingUp },
  { id: 'dividend', label: 'Dividend', icon: DollarSign },
  { id: 'belastingen', label: 'Belastingen', icon: Receipt },
  { id: 'instellingen', label: 'Instellingen', icon: Settings },
];

const ACCENT = '#6366f1';

export default function Sidebar({ collapsed, onToggle, onHome, onNavigate }) {
  const {
    activeNav, gebruiker, portfolioWaarde, ytdPct,
    portfolios, actiefPortfolio, actiefPortfolioId,
    wisselPortfolio, voegPortfolioToe, verwijderPortfolio, hernoemPortfolio
  } = useApp();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [toevoegenOpen, setToevoegenOpen] = useState(false);
  const [hernoemenId, setHernoemenId] = useState(null);
  const [hernoemenWaarde, setHernoemenWaarde] = useState('');
  const [nieuweNaam, setNieuweNaam] = useState('');
  const dropdownRef = useRef(null);

  const formatBedrag = (n) => '€' + n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Sluit dropdown bij klik buiten
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) { setDropdownOpen(false); setToevoegenOpen(false); }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) { setUserMenuOpen(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const portfolioIcon = (type) => type === 'pensioen'
    ? <PiggyBank size={14} color={ACCENT} />
    : <Briefcase size={14} color={ACCENT} />;

  const handleToevoegen = (type) => {
    const aantalStandaard = portfolios.filter(p => p.type === 'standaard').length;
    const voornaam = gebruiker.voornaam || '';
    let naam;
    if (type === 'pensioen') {
      naam = 'Pensioensparen';
    } else {
      naam = voornaam
        ? (aantalStandaard === 0 ? `${voornaam}'s portfolio` : `${voornaam}'s portfolio ${aantalStandaard + 1}`)
        : `Portfolio ${portfolios.length + 1}`;
    }
    voegPortfolioToe(naam, type);
    setToevoegenOpen(false);
    setDropdownOpen(false);
    setNieuweNaam('');
    onNavigate('overzicht');
  };

  const handleHernoemen = (id) => {
    if (hernoemenWaarde.trim()) hernoemPortfolio(id, hernoemenWaarde.trim());
    setHernoemenId(null);
    setHernoemenWaarde('');
  };

  const handleVerwijderen = (id, e) => {
    e.stopPropagation();
    if (portfolios.length <= 1) return;
    if (window.confirm('Weet je zeker dat je dit portfolio wil verwijderen? Alle beleggingen worden verwijderd.')) {
      verwijderPortfolio(id);
      setDropdownOpen(false);
    }
  };

  return (
    <aside className="sidebar">
      {/* Logo / Home */}
      <div className="sidebar-logo" onClick={onHome}>
        <div className="sidebar-logo-icon">M</div>
        <span className="sidebar-logo-text">Matico</span>
      </div>

      {/* Portfolio selector */}
      <div className="sidebar-portfolio" ref={dropdownRef}>
        <div
          className="sidebar-portfolio-selector"
          onClick={() => { setDropdownOpen(d => !d); setToevoegenOpen(false); }}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {portfolioIcon(actiefPortfolio?.type)}
            <span style={{ fontWeight: 600, fontSize: 13 }}>{actiefPortfolio?.naam || 'Je portfolio'}</span>
          </div>
          <ChevronDown size={14} color="var(--text-muted)" style={{ transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
        </div>

        {/* Dropdown */}
        {dropdownOpen && (
          <div style={{
            position: 'absolute', left: 12, right: 12, top: '100%', marginTop: 4, zIndex: 100,
            background: 'var(--bg-white)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            border: '1px solid var(--border)', overflow: 'hidden'
          }}>
            {/* Portfolio lijst */}
            {!toevoegenOpen && (
              <>
                <div style={{ padding: '8px 0' }}>
                  {portfolios.map(p => (
                    <div key={p.id}>
                      {hernoemenId === p.id ? (
                        <div style={{ padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={hernoemenWaarde}
                            onChange={e => setHernoemenWaarde(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleHernoemen(p.id); if (e.key === 'Escape') { setHernoemenId(null); setHernoemenWaarde(''); } }}
                            style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text-primary)' }}
                          />
                          <button onClick={() => handleHernoemen(p.id)} style={{ background: ACCENT, color: 'white', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 12 }}>✓</button>
                          <button onClick={() => { setHernoemenId(null); setHernoemenWaarde(''); }} style={{ background: 'var(--bg-subtle)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                        </div>
                      ) : (
                        <div
                          onClick={() => { wisselPortfolio(p.id); setDropdownOpen(false); onNavigate('overzicht'); }}
                          style={{
                            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                            background: p.id === actiefPortfolioId ? 'var(--accent-bg)' : 'transparent',
                          }}
                          onMouseEnter={e => { if (p.id !== actiefPortfolioId) e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                          onMouseLeave={e => { if (p.id !== actiefPortfolioId) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {portfolioIcon(p.type)}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: p.id === actiefPortfolioId ? 700 : 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.naam}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.type === 'pensioen' ? 'Pensioensparen' : 'Standaard'}</div>
                          </div>
                          {p.id === actiefPortfolioId && <Check size={14} color={ACCENT} />}
                          <div style={{ display: 'flex', gap: 4, marginLeft: 4 }} onClick={e => e.stopPropagation()}>
                            <button onClick={e => { e.stopPropagation(); setHernoemenId(p.id); setHernoemenWaarde(p.naam); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', borderRadius: 4 }}>
                              <Pencil size={12} />
                            </button>
                            {portfolios.length > 1 && (
                              <button onClick={e => handleVerwijderen(p.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#dc2626', borderRadius: 4 }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Toevoegen knop */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
                  <div
                    onClick={() => setToevoegenOpen(true)}
                    style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: ACCENT, fontSize: 13, fontWeight: 600 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Plus size={14} />
                    Portfolio toevoegen
                  </div>
                </div>
              </>
            )}

            {/* Portfolio type kiezen */}
            {toevoegenOpen && (
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <button onClick={() => setToevoegenOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                    <X size={14} />
                  </button>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Nieuw portfolio</span>
                </div>

                {/* Standaard portfolio */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</div>
                  {[
                    { type: 'standaard', label: 'Standaard portfolio', beschrijving: 'Aandelen, ETFs, crypto', icon: <Briefcase size={16} color={ACCENT} /> },
                    { type: 'pensioen', label: 'Pensioensparen', beschrijving: 'Fiscaal voordelig sparen', icon: <PiggyBank size={16} color={ACCENT} /> },
                  ].map(({ type, label, beschrijving, icon }) => (
                    <div key={type} onClick={() => handleToevoegen(type)} style={{
                      padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 6,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = 'var(--accent-bg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      {icon}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{beschrijving}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Portfolio stats */}
        <div className="sidebar-portfolio-stats">
          <div className="sidebar-stat">
            <div className="sidebar-stat-label">Waarde</div>
            <div className="sidebar-stat-value">{formatBedrag(portfolioWaarde)}</div>
          </div>
          <div className="sidebar-stat">
            <div className="sidebar-stat-label">YTD</div>
            <div className="sidebar-stat-value" style={{ color: ytdPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {ytdPct >= 0 ? '+' : ''}{ytdPct.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Nav label */}
      <div className="sidebar-section-label">Platform</div>

      {/* Nav items */}
      <nav className="sidebar-nav">
        {navItems.map(({ id, label, icon: Icon }) => (
          <div
            key={id}
            className={`nav-item ${activeNav === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </div>
        ))}
      </nav>

      {/* Bottom user */}
      <div className="sidebar-bottom" ref={userMenuRef} style={{ position: 'relative' }}>

        {/* User menu popup */}
        {userMenuOpen && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 8, right: 8, marginBottom: 8,
            background: 'var(--bg-white)', borderRadius: 12,
            boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', border: '1px solid var(--border)',
            overflow: 'hidden', zIndex: 200,
          }}>
            {/* Header met naam + email */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: ACCENT, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {gebruiker.voornaam?.[0]?.toUpperCase()}{gebruiker.achternaam?.[0]?.toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {gebruiker.voornaam} {gebruiker.achternaam}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pro plan</div>
              </div>
            </div>

            {/* Menu items */}
            <div style={{ padding: '6px 0' }}>
              {[
                { icon: <User size={14} />, label: 'Account', onClick: () => { onNavigate('instellingen'); setUserMenuOpen(false); } },
                { icon: <CreditCard size={14} />, label: 'Billing', onClick: () => { onNavigate('instellingen'); setUserMenuOpen(false); } },
              ].map(({ icon, label, onClick }) => (
                <div key={label} onClick={onClick} style={{
                  padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
                  {label}
                </div>
              ))}

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />

              {/* Log out */}
              <div onClick={async () => {
                setUserMenuOpen(false);
                await supabase.auth.signOut();
                window.location.reload();
              }} style={{
                padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#dc2626',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut size={14} />
                Log out
              </div>
            </div>
          </div>
        )}

        {/* User rij */}
        <div
          className="sidebar-user"
          onClick={() => setUserMenuOpen(v => !v)}
          style={{ cursor: 'pointer' }}
        >
          <div className="sidebar-avatar">
            {gebruiker.voornaam?.[0]?.toUpperCase()}{gebruiker.achternaam?.[0]?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{gebruiker.voornaam} {gebruiker.achternaam}</div>
            <div className="sidebar-user-email">{actiefPortfolio?.naam || 'Mijn portfolio'}</div>
          </div>
          <MoreHorizontal size={16} color="var(--text-muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}
