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
import './App.css';

function AppInner() {
  const { activeNav, setActiveNav, gebruiker } = useApp();
  const [toevoegenOpen, setToevoegenOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [overzichtResetKey, setOverzichtResetKey] = useState(0);

  if (!gebruiker.voornaam) {
    return <NaamInstellen />;
  }

  const scrollNaarBoven = () => {
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Centrale navigatie: altijd direct naar de gekozen pagina, ook tijdens een
  // belegging toevoegen/importeren, een verkoop verwerken of een simulatie.
  const navigeerNaar = (doel) => {
    setToevoegenOpen(false);
    setImportOpen(false);
    setActiveNav(doel);
    scrollNaarBoven();
  };

  // Matico-logo: altijd naar Overzicht. Sta je daar al, reset dan ook de
  // grafiek naar boven + terug naar het standaard 1D-tijdslot.
  const naarHome = () => {
    if (activeNav === 'overzicht' && !toevoegenOpen && !importOpen) {
      setOverzichtResetKey(k => k + 1);
      scrollNaarBoven();
    } else {
      navigeerNaar('overzicht');
    }
  };

  const renderPage = () => {
    if (importOpen) return <ImportBeleggingen onClose={() => setImportOpen(false)} />;
    if (toevoegenOpen) return <BeleggingToevoegen onClose={() => setToevoegenOpen(false)} />;
    const openToevoegen = () => setToevoegenOpen(true);
    const openImporteren = () => setImportOpen(true);
    switch (activeNav) {
      case 'overzicht': return <Overzicht key={overzichtResetKey} onToevoegen={openToevoegen} onImporteren={openImporteren} />;
      case 'beleggingen': return <Beleggingen onToevoegen={openToevoegen} />;
      case 'analyse': return <Analyse />;
      case 'dividend': return <Dividend />;
      case 'belastingen': return <Belastingen />;
      case 'instellingen': return <Instellingen />;
      default: return <Overzicht key={overzichtResetKey} onToevoegen={openToevoegen} onImporteren={openImporteren} />;
    }
  };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onHome={naarHome}
        onNavigate={navigeerNaar}
      />
      <main className="app-main">
        {renderPage()}
      </main>
    </div>
  );
}

function NaamInstellen() {
  const { setGebruiker } = useApp();
  const [voornaam, setVoornaam] = useState('');
  const [achternaam, setAchternaam] = useState('');

  const opslaan = () => {
    if (voornaam.trim()) {
      setGebruiker({ voornaam: voornaam.trim(), achternaam: achternaam.trim() });
    }
  };

  return (
    <div className="naam-instellen">
      <div className="naam-card">
        <div className="naam-logo">M</div>
        <h1>Welkom bij Matico</h1>
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
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
