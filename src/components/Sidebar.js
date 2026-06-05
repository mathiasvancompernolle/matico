import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, BarChart2, TrendingUp, DollarSign,
  Receipt, Settings, MoreHorizontal
} from 'lucide-react';

const navItems = [
  { id: 'overzicht', label: 'Overzicht', icon: LayoutDashboard },
  { id: 'beleggingen', label: 'Beleggingen', icon: BarChart2 },
  { id: 'analyse', label: 'Analyse', icon: TrendingUp },
  { id: 'dividend', label: 'Dividend', icon: DollarSign },
  { id: 'belastingen', label: 'Belastingen', icon: Receipt },
  { id: 'instellingen', label: 'Instellingen', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle, onHome }) {
  const { activeNav, setActiveNav, gebruiker, portfolioWaarde, dagWinstPct } = useApp();

  const formatBedrag = (n) => '€' + n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <aside className="sidebar">
      {/* Logo / Home */}
      <div className="sidebar-logo" onClick={onHome}>
        <div className="sidebar-logo-icon">M</div>
        <span className="sidebar-logo-text">Matico</span>
      </div>

      {/* Portfolio samenvatting */}
      <div className="sidebar-portfolio">
        <div className="sidebar-portfolio-selector">
          <span>Je portfolio</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⌄</span>
        </div>
        <div className="sidebar-portfolio-stats">
          <div className="sidebar-stat">
            <div className="sidebar-stat-label">Waarde</div>
            <div className="sidebar-stat-value">{formatBedrag(portfolioWaarde)}</div>
          </div>
          <div className="sidebar-stat">
            <div className="sidebar-stat-label">YTD</div>
            <div className="sidebar-stat-value" style={{ color: dagWinstPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {dagWinstPct >= 0 ? '+' : ''}{dagWinstPct.toFixed(2)}%
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
            onClick={() => setActiveNav(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </div>
        ))}
      </nav>

      {/* Bottom user */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {gebruiker.voornaam?.[0]?.toUpperCase()}{gebruiker.achternaam?.[0]?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{gebruiker.voornaam} {gebruiker.achternaam}</div>
            <div className="sidebar-user-email">Mijn portfolio</div>
          </div>
          <MoreHorizontal size={16} color="var(--text-muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}
