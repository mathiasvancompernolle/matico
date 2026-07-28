import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, Building2, Bitcoin, PiggyBank, ArrowLeft, Search, Loader, X } from 'lucide-react';

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
  // Multi-selectie
  const [selectie, setSelectie] = useState([]); // [{...resultaat}]
  const [multiForms, setMultiForms] = useState({}); // { symbol: { datum, kostprijs, aantal, munt, transactiekosten } }
  const [wisselkoersOpDatum, setWisselkoersOpDatum] = useState(1);
  const [wisselkoersLoading, setWisselkoersLoading] = useState(false);

  // Historische wisselkoers naar EUR ophalen wanneer munt of datum verandert
  useEffect(() => {
    if (form.munt === 'EUR') {
      setWisselkoersOpDatum(1);
      return;
    }
    if (!form.datum) return;
    let actief = true;
    setWisselkoersLoading(true);
    fetch(`/api/data?endpoint=forex-history&datum=${form.datum}&van=${form.munt}`)
      .then(res => res.json())
      .then(data => { if (actief && data?.rate) setWisselkoersOpDatum(data.rate); })
      .catch(() => {})
      .finally(() => { if (actief) setWisselkoersLoading(false); });
    return () => { actief = false; };
  }, [form.munt, form.datum]);

  useEffect(() => {
    if (zoekterm.length < 2) { setZoekResultaten([]); return; }
    const timer = setTimeout(async () => {
      setZoekLoading(true);
      try {
        const res = await fetch(`/api/data?endpoint=search&q=${encodeURIComponent(zoekterm)}`);
        const data = await res.json();
        // Nieuwe API geeft { resultaten: [...] }, fallback op oude Finnhub { result: [...] }
        const resultaten = data.resultaten || (data.result || []).map(r => ({
          naam: r.naam || r.description,
          symbol: r.symbol,
          beurs: r.type,
          type: r.type === 'ETF' ? 'etf' : 'aandeel',
        }));
        setZoekResultaten(resultaten.filter(r => {
          if (type === 'aandeel') return r.type === 'aandeel' || !r.type;
          if (type === 'etf') return r.type === 'etf';
          if (type === 'crypto') return r.type === 'crypto';
          return true;
        }).slice(0, 10));
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
      const munt = (() => {
      if (geselecteerd?.symbol?.includes('-USD')) return 'USD';
      if (geselecteerd?.symbol?.includes('-GBP')) return 'GBP';
      if (geselecteerd?.valuta === 'USD' || koers?.currency === 'USD') return 'USD';
      if (geselecteerd?.valuta === 'GBP' || koers?.currency === 'GBP') return 'GBP';
      const us = ['NMS','NYQ','NGM','ASE','PCX','BATS'];
      if (us.some(e => (geselecteerd?.beurs || '').toUpperCase().includes(e))) return 'USD';
      return 'EUR';
    })();
    setForm(f => ({ ...f, kostprijs: koers.c.toFixed(2), munt }));
    }
  };

  const toggleSelectie = async (r) => {
    const al = selectie.find(s => s.symbol === r.symbol);
    if (al) {
      setSelectie(prev => prev.filter(s => s.symbol !== r.symbol));
      setMultiForms(prev => { const n = {...prev}; delete n[r.symbol]; return n; });
    } else {
      setSelectie(prev => [...prev, r]);
      // Pre-fill koers
      const koers = await fetchKoers(r.symbol);
      setMultiForms(prev => ({
        ...prev,
        [r.symbol]: {
          datum: new Date().toISOString().split('T')[0],
          kostprijs: koers?.c ? koers.c.toFixed(2) : '',
          aantal: '',
          munt: (() => {
            // Crypto
            if (r.symbol?.includes('-USD')) return 'USD';
            if (r.symbol?.includes('-GBP')) return 'GBP';
            if (r.symbol?.includes('-EUR')) return 'EUR';
            // Via valuta uit zoekresultaat
            if (r.valuta === 'USD') return 'USD';
            if (r.valuta === 'GBP') return 'GBP';
            // US beurzen via exchange code
            const us = ['NMS','NYQ','NGM','ASE','PCX','BATS','NAS','NYSE'];
            if (us.some(e => (r.beurs || r.exchange || '').toUpperCase().includes(e))) return 'USD';
            // UK beurzen
            if ((r.beurs || '').toUpperCase().includes('LSE') || r.symbol?.endsWith('.L')) return 'GBP';
            // Koers valuta als beschikbaar
            if (koers?.currency === 'USD') return 'USD';
            if (koers?.currency === 'GBP') return 'GBP';
            return 'EUR';
          })(),
          transactiekosten: '',
        }
      }));
      // Logo ophalen
      try {
        const res = await fetch(`/api/data?endpoint=profile&symbol=${encodeURIComponent(r.symbol)}`);
        const d = await res.json();
        const logo = d.logo || d.image || '';
        if (logo) setSelectie(prev => prev.map(s => s.symbol === r.symbol ? {...s, logo} : s));
      } catch {}
    }
  };

  const updateMultiForm = (symbol, veld, waarde) => {
    setMultiForms(prev => ({ ...prev, [symbol]: { ...prev[symbol], [veld]: waarde } }));
  };

  const opslaanMulti = () => {
    const nieuw = selectie.map(r => {
      const f = multiForms[r.symbol] || {};
      if (!f.datum || !f.kostprijs || !f.aantal) return null;
      const kostprijsPerStuk = parseFloat(f.kostprijs);
      const aantalStuks = parseFloat(f.aantal);
      const transactiekosten = parseFloat(f.transactiekosten) || 0;
      return {
        id: Date.now() + Math.random(),
        symbol: r.symbol,
        naam: r.naam || r.symbol,
        logo: r.logo || '',
        type: r.type || type || 'aandeel',
        datum: f.datum,
        kostprijs: kostprijsPerStuk,
        transactiekosten,
        aantal: aantalStuks,
        munt: f.munt,
      };
    }).filter(Boolean);
    if (nieuw.length === 0) return;
    setBeleggingen(prev => [...prev, ...nieuw]);
    onClose();
  };

  const opslaan = () => {
    if (!geselecteerd || !form.datum || !form.kostprijs || !form.aantal) return;
    const kostprijsPerStuk = parseFloat(form.kostprijs);
    const aantalStuks = parseFloat(form.aantal);
    const transactiekosten = parseFloat(form.transactiekosten) || 0;

    const nieuw = {
      id: Date.now(),
      symbol: geselecteerd.symbol,
      naam: geselecteerd.naam || geselecteerd.description || geselecteerd.symbol,
      logo: geselecteerd.logo || '',
      type,
      datum: form.datum,
      kostprijs: kostprijsPerStuk,
      transactiekosten,
      aantal: aantalStuks,
      munt: form.munt,
    };
    setBeleggingen(prev => [...prev, nieuw]);
    onClose();
  };

  // Berekening voor preview
  const muntSymbool = (munt) => munt === 'USD' ? '$' : munt === 'GBP' ? '£' : '€';
  const kostprijsPerStuk = parseFloat(form.kostprijs) || 0;
  const aantalStuks = parseFloat(form.aantal) || 0;
  const transactiekosten = parseFloat(form.transactiekosten) || 0;
  const totaalKostprijs = kostprijsPerStuk * aantalStuks + transactiekosten;
  const totaalKostprijsEUR = totaalKostprijs * wisselkoersOpDatum;

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stap !== 'type' && (
            <button className="btn btn-ghost" onClick={() => stap === 'invoer' ? setStap('zoek') : stap === 'multi-invoer' ? setStap('zoek') : setStap('type')}>
              <ArrowLeft size={16} />
            </button>
          )}
          <h1>Beleggingen</h1>
        </div>

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
            {zoekResultaten.map(r => {
              const aangevinkt = selectie.some(s => s.symbol === r.symbol);
              return (
                <div key={r.symbol} className="zoek-resultaat"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: aangevinkt ? 'var(--accent-bg)' : 'transparent', borderLeft: aangevinkt ? '3px solid var(--accent)' : '3px solid transparent' }}
                  onClick={() => toggleSelectie(r)}>
                  {/* Checkbox */}
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${aangevinkt ? 'var(--accent)' : 'var(--border)'}`, background: aangevinkt ? 'var(--accent)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {aangevinkt && <span style={{ color: 'white', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="zoek-resultaat-naam">{r.naam || r.description}</div>
                    <div className="zoek-resultaat-symbol">{r.symbol} · {r.type || ''} · {r.beurs || r.displaySymbol || ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Toevoegen knop */}
          {selectie.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {selectie.length} belegging{selectie.length !== 1 ? 'en' : ''} geselecteerd
              </span>
              <button className="btn btn-primary" onClick={() => setStap('multi-invoer')}>
                Gegevens invullen ({selectie.length}) →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stap: multi-invoer tabel */}
      {stap === 'multi-invoer' && (
        <div style={{ padding: '0 24px' }}>
          {/* Tabelheader */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.8fr 0.7fr 1.1fr 32px', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            <span>Naam</span>
            <span>Aankoopprijs</span>
            <span>
              Transactiekosten
              <div style={{ fontWeight: 400, fontSize: 10, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 'normal' }}>optioneel, later aan te passen</div>
            </span>
            <span>Aantal</span>
            <span>Munt</span>
            <span>Aankoopdatum</span>
            <span></span>
          </div>
          {/* Rijen */}
          {selectie.map(r => {
            const f = multiForms[r.symbol] || {};
            return (
              <div key={r.symbol} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.8fr 0.7fr 1.1fr 32px', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border-light)', alignItems: 'center' }}>
                {/* Naam */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                    {r.symbol.slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.naam || r.symbol}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.symbol}</div>
                  </div>
                </div>
                {/* Aankoopprijs */}
                <input type="number" value={f.kostprijs || ''} onChange={e => updateMultiForm(r.symbol, 'kostprijs', e.target.value)}
                  placeholder="0,00" step="0.01"
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', width: '100%', background: 'var(--bg-white)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                {/* Transactiekosten */}
                <input type="number" value={f.transactiekosten || ''} onChange={e => updateMultiForm(r.symbol, 'transactiekosten', e.target.value)}
                  placeholder="0,00 (optioneel)" step="0.01"
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', width: '100%', background: 'var(--bg-white)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                {/* Aantal */}
                <input type="number" value={f.aantal || ''} onChange={e => updateMultiForm(r.symbol, 'aantal', e.target.value)}
                  placeholder="0" step="0.0001"
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-white)', color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                {/* Munt */}
                <select value={f.munt || 'EUR'} onChange={e => updateMultiForm(r.symbol, 'munt', e.target.value)}
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg-white)', color: 'var(--text-muted)', outline: 'none', cursor: 'pointer', width: '100%' }}>
                  <option>EUR</option><option>USD</option><option>GBP</option>
                </select>
                {/* Datum */}
                <input type="date" value={f.datum || ''} onChange={e => updateMultiForm(r.symbol, 'datum', e.target.value)}
                  style={{
                    border: f.datum ? '1px solid var(--border)' : '1.5px solid #f59e0b', borderRadius: 8, padding: '7px 8px',
                    fontSize: 13, fontFamily: 'inherit', width: '100%', background: f.datum ? 'var(--bg-white)' : '#fffbeb',
                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                  }} />
                {/* Verwijderen */}
                <button
                  onClick={() => toggleSelectie(r)}
                  title="Deze belegging niet toevoegen"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
          {/* Footer knoppen */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>

            <button className="btn btn-primary" onClick={opslaanMulti}
              disabled={!selectie.some(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; })}
              style={{ opacity: !selectie.some(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; }) ? 0.5 : 1 }}>
              Opslaan ({selectie.filter(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; }).length}/{selectie.length})
            </button>
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
              Automatisch opgevolgd door Kapitas
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
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{geselecteerd.naam || geselecteerd.description || geselecteerd.symbol}</div>
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
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Niet gekend? Laat leeg — later aanpasbaar</div>
                </div>
                <div />
                <input type="number" className="form-input" placeholder="€0 (optioneel)" value={form.transactiekosten}
                  onChange={e => setForm(f => ({ ...f, transactiekosten: e.target.value }))} step="0.01" min="0" />
              </div>

              {/* Preview totale kostprijs */}
              {(kostprijsPerStuk > 0 && aantalStuks > 0) && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Totale kostprijs
                      {transactiekosten > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> (incl. {muntSymbool(form.munt)}{transactiekosten.toFixed(2)} kosten)</span>}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {muntSymbool(form.munt)}{totaalKostprijs.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  {form.munt !== 'EUR' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {wisselkoersLoading
                          ? 'Wisselkoers ophalen...'
                          : `≈ wisselkoers op ${form.datum}: 1 ${form.munt} = €${wisselkoersOpDatum.toFixed(4)}`}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        ≈ €{totaalKostprijsEUR.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            {stap === 'multi-invoer' ? (
              <>
                <button className="btn btn-ghost" onClick={() => setStap('zoek')}>← Terug</button>
                <button className="btn btn-primary" onClick={opslaanMulti}
                  disabled={!selectie.some(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; })}
                  style={{ opacity: !selectie.some(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; }) ? 0.5 : 1 }}>
                  Opslaan ({selectie.filter(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; }).length}/{selectie.length})
                </button>
              </>
            ) : (
              <>

                <button className="btn btn-primary" onClick={opslaan}
                  disabled={!form.datum || !form.kostprijs || !form.aantal}
                  style={{ opacity: (!form.datum || !form.kostprijs || !form.aantal) ? 0.5 : 1 }}>
                  Opslaan
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
