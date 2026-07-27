import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import SidebarToggleKnop from '../components/SidebarToggleKnop';

const ACCENT = '#1e3a8a';
const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)',
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none',
  color: 'var(--text-primary)', background: 'var(--bg-white)', boxSizing: 'border-box'
};
const selectStyle = {
  ...inputStyle, appearance: 'none', cursor: 'pointer',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36,
};

export default function MijnProfiel({ sidebarCollapsed, onToggleSidebar }) {
  const { gebruiker, setGebruiker, darkMode, setDarkMode, t } = useApp();
  const [voornaam, setVoornaam] = useState(gebruiker.voornaam);
  const [achternaam, setAchternaam] = useState(gebruiker.achternaam);
  const [taal, setTaal] = useState(gebruiker.taal || 'nl');
  const [opgeslagen, setOpgeslagen] = useState(false);

  const slaOp = () => {
    // Samenvoegen i.p.v. vervangen, zodat het e-mailadres (en andere
    // accountgegevens) niet verloren gaan bij het opslaan van je profiel.
    setGebruiker(g => ({ ...g, voornaam, achternaam, taal }));
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2000);
  };

  return (
    <div style={{ padding: '0 0 60px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SidebarToggleKnop onToggleSidebar={onToggleSidebar} sidebarCollapsed={sidebarCollapsed} />
          <h1>{t('profiel_titel')}</h1>
        </div>
      </div>

      <div style={{ padding: '0 32px', maxWidth: 500 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>{t('profiel_kaart_titel')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('profiel_voornaam')}</label>
              <input style={inputStyle} value={voornaam} onChange={e => setVoornaam(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('profiel_achternaam')}</label>
              <input style={inputStyle} value={achternaam} onChange={e => setAchternaam(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('profiel_email')}</label>
            <input style={{ ...inputStyle, color: 'var(--text-muted)', background: 'var(--bg)' }} value={gebruiker.email || ''} disabled readOnly />
          </div>
          <button onClick={slaOp} style={{
            padding: '10px 20px', background: ACCENT, color: 'white', border: 'none',
            borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600
          }}>
            {opgeslagen ? t('profiel_opgeslagen') : t('profiel_opslaan')}
          </button>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>{t('profiel_voorkeuren')}</h3>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('profiel_thema')}</label>
            <select
              style={selectStyle}
              value={darkMode ? 'dark' : 'light'}
              onChange={e => setDarkMode(e.target.value === 'dark')}
            >
              <option value="light">{t('profiel_thema_licht')}</option>
              <option value="dark">{t('profiel_thema_donker')}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('profiel_taal')}</label>
            <select
              style={selectStyle}
              value={taal}
              onChange={e => {
                const nieuweTaal = e.target.value;
                setTaal(nieuweTaal);
                setGebruiker(g => ({ ...g, taal: nieuweTaal }));
              }}
            >
              <option value="nl">{t('profiel_taal_nl')}</option>
              <option value="en">{t('profiel_taal_en')}</option>
              <option value="fr">{t('profiel_taal_fr')}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
