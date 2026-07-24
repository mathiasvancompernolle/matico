import React from 'react';
import { PanelLeft } from 'lucide-react';

// Herbruikbare knop om de sidebar in/uit te klappen, te tonen naast de
// paginatitel (<h1>) op elke pagina onder "Portefeuille".
export default function SidebarToggleKnop({ onToggleSidebar, sidebarCollapsed }) {
  if (!onToggleSidebar) return null;
  return (
    <button
      onClick={onToggleSidebar}
      title={sidebarCollapsed ? 'Sidebar tonen' : 'Sidebar verbergen'}
      style={{
        width: 40, height: 40, borderRadius: 8, border: '1px solid var(--border)',
        background: 'transparent', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0,
        marginRight: 12,
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <PanelLeft size={20} />
    </button>
  );
}
