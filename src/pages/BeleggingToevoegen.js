import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, Building2, Bitcoin, PiggyBank, ArrowLeft, Search, Loader } from 'lucide-react';

const TYPES = [
  { id: 'aandeel', label: 'Aandeel', beschrijving: 'Zoek en voeg beursgenoteerde aandelen toe', icon: TrendingUp },
  { id: 'etf', label: 'ETF', beschrijving: 'Zoek en voeg een ETF/Tracker toe', icon: Building2 },
  { id: 'crypto', label: 'Crypto', beschrijving: 'Zoek en voeg crypto toe', icon: Bitcoin },
  { id: 'manueel', label: 'Zelf op te volgen belegging', beschrijving: 'Handig voor cashrekeningen, pensioensparen, periodieke beleggingen en andere beleggingsplannen', icon: PiggyBank },
];

export default function BeleggingToevoegen({ onClose }) {
  const { setBeleggingen, fetchKoers } = useApp();
  const [stap, setStap] = useState('type');
  const [type, setType] = useState(null);
  const [zoekterm, setZoekterm] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [zoekLoading, setZoekLoading] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState(null);
  const [form, setForm] = useState({ datum: '', kostprijs: '', aantal: '', munt: 'EUR', transactiekosten: '' });

  useEffect(() => {
    if (zoekterm.length < 2) { setZoekResultaten([]); return; }
    const timer = setTimeout(async () => {
      setZoekLoading(true);
      try {
        const res = await fetch(`/api/data?endpoint=search&q=${encodeURIComponent(zoekterm)}`);
        const data = await res.json();
        setZoekResultaten((data.result || []).slice(0, 8));
      } catch {
        setZoekResultaten([]);
      }
      setZoekLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [zoekterm]);

  const kiesType = (t) => {
    setType(t);
    setStap('zoek');
  };

  const kiesAandeel = async (r) => {
    setGeselecteerd(r);
    setStap('invoer');
    // Haal koers en logo tegelijk op
    const [koers] = await Promise.all([
      fetchKoers(r.symbol),
      // Haal logo op via profile endpoint
      fetch(`/api/data?endpoint=profile&symbol=${encodeURIComponent(r.symbol)}`)
        .then(res => res.json())
        .then(data => {
          const logo = data.logo || data.image || '';
          if (logo) setGeselecteerd(prev => ({ ...prev, logo }));
        })
        .catch(() => {})
    ]);
    if (koers?.c) {
      setForm(f => ({ ...f, kostprijs: koers.c.toFixed(2) }));
    }
  };

  const opslaan = () => {
    if (!geselecteerd || !form.datum || !form.kostprijs || !form.aantal) return;
    const kostprijsPerStuk = parseFloat(form.kostprijs);
    const aantalStuks = parseFloat(form.aantal);
    const transactiekosten = parseFloat(form.transactiekosten) || 0;
    // Kostprijs per stuk inclusief transactiekosten (verdeeld over alle stuks)
    const kostprijsInclKosten = kostprijsPerStuk + (transactiekosten / aantalStuks);

    const nieuw = {
      id: Date.now(),
      symbol: geselecteerd.symbol,
      naam: geselecteerd.description,
      logo: geselecteerd.logo || '',
      type,
      datum: form.datum,
      kostprijs: kostprijsInclKosten,
      kostprijsExclKosten: kostprijsPerStuk,
      transactiekosten,
      aantal: aantalStuks,
      munt: form.munt,
    };
    setBeleggingen(prev => [...prev, nieuw]);
    onClose();
  };

  // Berekening voor preview
  const kostprijsPerStuk = parseFloat(form.kostprijs) || 0;
  const aantalStuks = parseFloat(form.aantal) || 0;
  const transactiekosten = parseFloat(form.transactiekosten) || 0;
  const totaalKostprijs = kostprijsPerStuk * aantalStuks + transactiekosten;

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stap !== 'type' && (
            <button className="btn btn-ghost" onClick={() => stap === 'invoer' ? setStap('zoek') : setStap('type')}>
              <ArrowLeft size={16} />
            </button>
          )}
          <h1>Beleggingen</h1>
        </div>
        <button className="btn btn-primary" onClick={onClose}>← Terug</button>
      </div>

      {/* Stap: type kiezen */}
      {stap === 'type' && (
        <div style={{ padding: '0 32px' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Wat wil je toevoegen?</h2>
          </div>
          <div className="toevoegen-grid">
            {TYPES.map(({ id, label, beschrijving, icon: Icon }) => (
              <div key={id} className="type-card" onClick={() => kiesType(id)}>
                <div className="type-icon"><Icon size={22} /></div>
                <div>
                  <h3>{label}</h3>
                  <p>{beschrijving}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stap: zoeken */}
      {stap === 'zoek' && (
        <div style={{ padding: '0 32px' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {type === 'aandeel' ? 'Aandeel zoeken' : type === 'etf' ? 'ETF zoeken' : 'Crypto zoeken'}
            </h2>
          </div>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="zoek-input" placeholder="Zoek op naam of symbool..."
              value={zoekterm} onChange={e => setZoekterm(e.target.value)} autoFocus />
            {zoekLoading && <Loader size={16} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {zoekResultaten.length === 0 && zoekterm.length >= 2 && !zoekLoading && (
              <div className="empty-state" style={{ padding: 30 }}><p>Geen resultaten gevonden voor "{zoekterm}"</p></div>
            )}
            {zoekResultaten.length === 0 && zoekterm.length < 2 && (
              <div className="empty-state" style={{ padding: 30 }}><p>Typ minimaal 2 tekens om te zoeken</p></div>
            )}
            {zoekResultaten.map(r => (
              <div key={r.symbol} className="zoek-resultaat" onClick={() => kiesAandeel(r)}>
                <div className="zoek-resultaat-naam">{r.description}</div>
                <div className="zoek-resultaat-symbol">{r.symbol} · {r.type} · {r.displaySymbol}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stap: gegevens invoeren */}
      {stap === 'invoer' && geselecteerd && (
        <div style={{ padding: '0 32px' }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Beleggingen
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Automatisch opgevolgd door Matico
            </div>
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>

              {/* Rij 1: Naam, datum, kostprijs */}
              <div className="toevoegen-row-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, padding: '8px 0', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Naam</span>
                <span>Aankoopdatum</span>
                <span>Koers per stuk</span>
              </div>
              <div className="toevoegen-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{geselecteerd.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{geselecteerd.symbol}</div>
                </div>
                <input type="date" className="form-input" value={form.datum}
                  onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" className="form-input" placeholder="0.00" value={form.kostprijs}
                    onChange={e => setForm(f => ({ ...f, kostprijs: e.target.value }))} step="0.01" min="0" />
                  <select className="form-input" style={{ width: 80 }} value={form.munt}
                    onChange={e => setForm(f => ({ ...f, munt: e.target.value }))}>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              {/* Rij 2: Aantal */}
              <div className="toevoegen-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>Aantal aandelen/eenheden</div>
                <div />
                <input type="number" className="form-input" placeholder="1" value={form.aantal}
                  onChange={e => setForm(f => ({ ...f, aantal: e.target.value }))} min="0" step="0.001" />
              </div>

              {/* Rij 3: Transactiekosten */}
              <div className="toevoegen-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>Transactiekosten</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Totale kosten voor deze aankoop</div>
                </div>
                <div />
                <input type="number" className="form-input" placeholder="0.00" value={form.transactiekosten}
                  onChange={e => setForm(f => ({ ...f, transactiekosten: e.target.value }))} step="0.01" min="0" />
              </div>

              {/* Preview totale kostprijs */}
              {(kostprijsPerStuk > 0 && aantalStuks > 0) && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Totale kostprijs
                    {transactiekosten > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> (incl. €{transactiekosten.toFixed(2)} kosten)</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    €{totaalKostprijs.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStap('zoek')}>Annuleren</button>
            <button className="btn btn-primary" onClick={opslaan}
              disabled={!form.datum || !form.kostprijs || !form.aantal}
              style={{ opacity: (!form.datum || !form.kostprijs || !form.aantal) ? 0.5 : 1 }}>
              Opslaan
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
