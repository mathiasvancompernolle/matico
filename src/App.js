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
  const { activeNav, setActiveNav, gebruiker, blokkeerNavigatie, setBlokkeerNavigatie } = useApp();
  const [toevoegenOpen, setToevoegenOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!gebruiker.voornaam) {
    return <NaamInstellen />;
  }

  // Centrale navigatie: altijd direct naar de gekozen pagina, ook tijdens een
  // belegging toevoegen/importeren, een verkoop verwerken of een simulatie.
  // Enkel als er een actie loopt (blokkeerNavigatie) wordt eerst om bevestiging gevraagd.
  const navigeerNaar = (doel) => {
    if (blokkeerNavigatie) {
      const door = window.confirm('Je hebt een actie in uitvoering (bv. een belegging toevoegen, een verkoop verwerken of een simulatie). Weet je zeker dat je wilt verlaten? Niet-opgeslagen wijzigingen gaan verloren.');
      if (!door) return;
    }
    setBlokkeerNavigatie(false);
    setToevoegenOpen(false);
    setImportOpen(false);
    setActiveNav(doel);
  };

  const renderPage = () => {
    if (importOpen) return <ImportBeleggingen onClose={() => { setImportOpen(false); setBlokkeerNavigatie(false); }} />;
    if (toevoegenOpen) return <BeleggingToevoegen onClose={() => { setToevoegenOpen(false); setBlokkeerNavigatie(false); }} />;
    const openToevoegen = () => { setToevoegenOpen(true); setBlokkeerNavigatie(true); };
    const openImporteren = () => { setImportOpen(true); setBlokkeerNavigatie(true); };
    switch (activeNav) {
      case 'overzicht': return <Overzicht onToevoegen={openToevoegen} onImporteren={openImporteren} />;
      case 'beleggingen': return <Beleggingen onToevoegen={openToevoegen} />;
      case 'analyse': return <Analyse />;
      case 'dividend': return <Dividend />;
      case 'belastingen': return <Belastingen />;
      case 'instellingen': return <Instellingen />;
      default: return <Overzicht onToevoegen={openToevoegen} onImporteren={openImporteren} />;
    }
  };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onHome={() => navigeerNaar('overzicht')}
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
