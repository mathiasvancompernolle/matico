import React from 'react';
import { useApp } from '../context/AppContext';
import SidebarToggleKnop from '../components/SidebarToggleKnop';

const ACCENT = '#6366f1';

export default function Weergave({ sidebarCollapsed, onToggleSidebar }) {
  const { darkMode, setDarkMode } = useApp();

  return (
    <div style={{ padding: '0 0 60px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SidebarToggleKnop onToggleSidebar={onToggleSidebar} sidebarCollapsed={sidebarCollapsed} />
          <h1>Weergave</h1>
        </div>
      </div>

      <div style={{ padding: '0 32px', maxWidth: 500 }}>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Weergave</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Donkere modus</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Schakel over naar een donker kleurenschema</div>
            </div>
            <div
              onClick={() => setDarkMode(d => !d)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: darkMode ? ACCENT : 'var(--border)',
                cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: darkMode ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
