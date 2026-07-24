import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import SidebarToggleKnop from '../components/SidebarToggleKnop';

const ACCENT = '#6366f1';
const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)',
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none',
  color: 'var(--text-primary)', background: 'var(--bg-white)', boxSizing: 'border-box'
};

export default function MijnProfiel({ sidebarCollapsed, onToggleSidebar }) {
  const { gebruiker, setGebruiker } = useApp();
  const [voornaam, setVoornaam] = useState(gebruiker.voornaam);
  const [achternaam, setAchternaam] = useState(gebruiker.achternaam);
  const [opgeslagen, setOpgeslagen] = useState(false);

  const slaOp = () => {
    setGebruiker({ voornaam, achternaam });
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2000);
  };

  return (
    <div style={{ padding: '0 0 60px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SidebarToggleKnop onToggleSidebar={onToggleSidebar} sidebarCollapsed={sidebarCollapsed} />
          <h1>Mijn profiel</h1>
        </div>
      </div>

      <div style={{ padding: '0 32px', maxWidth: 500 }}>
        <div className="card">
          <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>Persoonlijke gegevens</h3>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Voornaam</label>
            <input style={inputStyle} value={voornaam} onChange={e => setVoornaam(e.target.value)} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Achternaam</label>
            <input style={inputStyle} value={achternaam} onChange={e => setAchternaam(e.target.value)} />
          </div>
          <button onClick={slaOp} style={{
            padding: '10px 20px', background: ACCENT, color: 'white', border: 'none',
            borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600
          }}>
            {opgeslagen ? '✓ Opgeslagen!' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}
