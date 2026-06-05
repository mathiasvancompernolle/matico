import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Loader, TrendingUp, TrendingDown } from 'lucide-react';

export function Analyse() {
  const { beleggingen, koersen } = useApp();
  const [analyses, setAnalyses] = useState({});
  const [loading, setLoading] = useState({});

  const laadAnalyse = async (b) => {
    setLoading(prev => ({ ...prev, [b.symbol]: true }));
    const koers = koersen[b.symbol];
    const huidigePrijs = koers ? koers.c : b.kostprijs;
    const dagVPct = koers && koers.pc > 0 ? ((koers.c - koers.pc) / koers.pc) * 100 : 0;
    try {
      const res = await fetch('/api/data?endpoint=ai-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: b.symbol, name: b.naam, price: huidigePrijs, change: dagVPct.toFixed(2) })
      });
      const data = await res.json();
      setAnalyses(prev => ({ ...prev, [b.symbol]: data.analyse }));
    } catch { setAnalyses(prev => ({ ...prev, [b.symbol]: 'Analyse niet beschikbaar.' })); }
    setLoading(prev => ({ ...prev, [b.symbol]: false }));
  };

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>Analyse</h1>
      </div>
      <div style={{ padding: '0 32px' }}>
        {beleggingen.length === 0 ? (
          <div className="empty-state card"><TrendingUp size={40} /><h3>Nog geen beleggingen</h3><p>Voeg beleggingen toe om analyses te bekijken</p></div>
        ) : (
          beleggingen.map(b => {
            const koers = koersen[b.symbol];
            const dagVPct = koers && koers.pc > 0 ? ((koers.c - koers.pc) / koers.pc) * 100 : 0;
            return (
              <div key={b.symbol} className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="belegging-avatar">{b.symbol.slice(0, 2)}</div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{b.naam}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.symbol}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={`badge ${dagVPct >= 0 ? 'badge-green' : 'badge-red'}`}>
                      {dagVPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {dagVPct >= 0 ? '+' : ''}{dagVPct.toFixed(2)}%
                    </span>
                    {!analyses[b.symbol] && (
                      <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => laadAnalyse(b)}>
                        {loading[b.symbol] ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'AI Analyse'}
                      </button>
                    )}
                  </div>
                </div>
                {analyses[b.symbol] && (
                  <div className="analyse-ai-box">
                    <h4>🤖 Matico AI Analyse</h4>
                    <p>{analyses[b.symbol]}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function Dividend() {
  const { beleggingen } = useApp();
  const totaalDividend = 0;

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>Dividend</h1>
      </div>
      <div style={{ padding: '0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Verwacht dit jaar', value: '€0,00' },
            { label: 'Ontvangen dit jaar', value: '€0,00' },
            { label: 'Totaal ontvangen', value: '€0,00' },
          ].map(({ label, value }) => (
            <div key={label} className="card">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Dividend per belegging</h3>
          {beleggingen.length === 0 ? (
            <div className="empty-state"><p>Voeg beleggingen toe die dividend uitkeren</p></div>
          ) : (
            beleggingen.map(b => (
              <div key={b.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="belegging-avatar">{b.symbol.slice(0, 2)}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.naam}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.symbol}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Geen dividenddata beschikbaar</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function Belastingen() {
  const { beleggingen, koersen } = useApp();

  const totaalMeerwaarde = beleggingen.reduce((sum, b) => {
    const koers = koersen[b.symbol];
    const huidigePrijs = koers ? koers.c : b.kostprijs;
    const factor = (b.munt || 'EUR') === 'USD' ? 0.92 : 1;
    const winst = (huidigePrijs - b.kostprijs) * b.aantal * factor;
    return sum + winst;
  }, 0);

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>Belastingen</h1>
      </div>
      <div style={{ padding: '0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Totale meerwaarde</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: totaalMeerwaarde >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totaalMeerwaarde >= 0 ? '+' : ''}€{Math.abs(totaalMeerwaarde).toFixed(2)}
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Meerwaardebelasting (10%)</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              €{Math.max(0, totaalMeerwaarde * 0.10).toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Indicatief — raadpleeg een belastingadviseur</div>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Overzicht per belegging</h3>
          {beleggingen.map(b => {
            const koers = koersen[b.symbol];
            const huidigePrijs = koers ? koers.c : b.kostprijs;
            const factor = (b.munt || 'EUR') === 'USD' ? 0.92 : 1;
            const winst = (huidigePrijs - b.kostprijs) * b.aantal * factor;
            return (
              <div key={b.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="belegging-avatar">{b.symbol.slice(0, 2)}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.naam}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.symbol}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: winst >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {winst >= 0 ? '+' : ''}€{winst.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Meerwaarde</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Instellingen() {
  const { gebruiker, setGebruiker } = useApp();
  const [voornaam, setVoornaam] = useState(gebruiker.voornaam);
  const [achternaam, setAchternaam] = useState(gebruiker.achternaam);
  const [opgeslagen, setOpgeslagen] = useState(false);

  const opslaan = () => {
    setGebruiker({ voornaam, achternaam });
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2000);
  };

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>Instellingen</h1>
      </div>
      <div style={{ padding: '0 32px' }}>
        <div className="card" style={{ maxWidth: 500 }}>
          <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>Persoonlijke gegevens</h3>
          <div className="form-group">
            <label className="form-label">Voornaam</label>
            <input type="text" className="form-input" value={voornaam} onChange={e => setVoornaam(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Achternaam</label>
            <input type="text" className="form-input" value={achternaam} onChange={e => setAchternaam(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={opslaan} style={{ marginTop: 8 }}>
            {opgeslagen ? '✓ Opgeslagen!' : 'Opslaan'}
          </button>
        </div>

        <div className="card" style={{ maxWidth: 500, marginTop: 16 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Over Matico</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Matico is je persoonlijke portfolio tracker. Real-time koersen via Finnhub.io,
            AI-analyses via Claude (Anthropic). Alle data wordt lokaal in je browser opgeslagen.
          </p>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Versie 1.0.0 · © 2026 Matico
          </div>
        </div>
      </div>
    </div>
  );
}
