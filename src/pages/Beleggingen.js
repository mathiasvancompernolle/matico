import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2 } from 'lucide-react';
import BeleggingDetail from '../components/BeleggingDetail';

export default function Beleggingen({ onToevoegen }) {
  const { beleggingen, setBeleggingen, koersen } = useApp();
  const [aktieveTab, setAktieveTab] = useState('actief');
  const [detailBelegging, setDetailBelegging] = useState(null);

  const verwijder = (id) => {
    if (window.confirm('Wil je deze belegging verwijderen?')) {
      setBeleggingen(prev => prev.filter(b => b.id !== id));
    }
  };

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>Beleggingen</h1>
        <button className="btn btn-primary" onClick={onToevoegen}>
          <Plus size={16} /> Beleggingen toevoegen
        </button>
      </div>

      <div style={{ padding: '0 32px' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {['actief', 'verkocht'].map(t => (
            <button
              key={t}
              onClick={() => setAktieveTab(t)}
              style={{
                padding: '10px 20px', border: 'none', background: 'transparent',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                color: aktieveTab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: aktieveTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', textTransform: 'capitalize'
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {beleggingen.length === 0 ? (
          <div className="empty-state">
            <Plus size={40} />
            <h3>Nog geen beleggingen</h3>
            <p>Voeg je eerste belegging toe om te beginnen</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onToevoegen}>
              Belegging toevoegen
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
              Automatisch opgevolgd door Matico
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', padding: '8px 20px', borderBottom: '1px solid var(--border-light)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              <span>Naam</span>
              <span>Aankoopdatum</span>
              <span>Kostprijs/stuk</span>
              <span>Aantal</span>
              <span></span>
            </div>
            {beleggingen.map(b => {
              const koers = koersen[b.symbol];
              const muntSym = (b.munt || 'EUR') === 'USD' ? '$' : '€';
              return (
                <div
                  key={b.id}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                  onClick={() => setDetailBelegging(b)}
                >
                  <div className="belegging-naam">
                    <div className="belegging-avatar">{b.symbol.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div className="belegging-naam-text">{b.naam}</div>
                      <div className="belegging-symbol">{b.symbol}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13 }}>{b.datum || '—'}</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 13 }}>{muntSym}{b.kostprijs.toFixed(2)}</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 13 }}>{b.aantal}</div>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '4px 8px', color: 'var(--red)' }}
                    onClick={e => { e.stopPropagation(); verwijder(b.id); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailBelegging && <BeleggingDetail belegging={detailBelegging} onClose={() => setDetailBelegging(null)} />}
    </div>
  );
}
