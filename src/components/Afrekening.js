import React, { useState } from 'react';
import { TOB_TARIEVEN, tobInfo } from '../utils/tob';

// Kleine, rustige onderdelen voor de samenvatting van een aan- of verkoop.
// Bedoeling: een gewone gebruiker hoeft niets te doen (de beurstaks wordt
// automatisch berekend); wie het precies wil, kan via "aanpassen" of
// "bedrag van je afrekening" verder gaan.

const f2 = (v) => (v || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const linkStijl = { background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' };

// Regel "Beurstaks (TOB) · 0,35%   − €0,24   aanpassen"
export function TobRegel({ teken = '−', tobId, setTobId, tobEur, tobHandmatig, setTobHandmatig, inputStyle }) {
  const [open, setOpen] = useState(false);
  const info = tobInfo(tobId);
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span>
          Beurstaks (TOB) <span style={{ color: 'var(--text-muted)' }}>· {info.kort}</span>{' '}
          <button type="button" onClick={() => setOpen(o => !o)} style={linkStijl}>{open ? 'klaar' : 'aanpassen'}</button>
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{teken} €{f2(tobEur)}</span>
      </div>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 8 }}>
          <select value={tobId} onChange={e => { setTobId(e.target.value); setTobHandmatig(null); }} style={inputStyle}>
            {TOB_TARIEVEN.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          <input type="number" min="0" step="0.01" value={tobHandmatig != null ? tobHandmatig : (tobEur || 0).toFixed(2)}
            onChange={e => setTobHandmatig(e.target.value)} style={inputStyle} aria-label="Beurstaks in euro" />
        </div>
      )}
    </div>
  );
}

// "Ander bedrag op je afrekening?" → veld voor het exacte bedrag
export function AfrekeningBedrag({ label, value, onChange, berekend, inputStyle }) {
  const [open, setOpen] = useState(!!value);
  const bedrag = parseFloat(value) > 0 ? parseFloat(value) : null;
  if (!open) {
    return (
      <div style={{ marginTop: 8 }}>
        <button type="button" onClick={() => setOpen(true)} style={linkStijl}>Ander bedrag op je afrekening?</button>
      </div>
    );
  }
  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</label>
      <input type="number" min="0" step="any" value={value} placeholder={f2(berekend)}
        onChange={e => onChange(e.target.value)} style={{ ...(inputStyle || {}), background: 'var(--bg-white)' }} />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45 }}>
        {bedrag
          ? <>Kapitas gebruikt dit bedrag. Verschil met de berekening: <strong style={{ color: 'var(--text-secondary)' }}>{bedrag - berekend >= 0 ? '+' : '−'}€{f2(Math.abs(bedrag - berekend))}</strong> — meestal de wisselkoers of afronding van je broker.</>
          : 'Vul het bedrag van je afrekening in: dan klopt alles tot op de cent.'}
      </div>
    </div>
  );
}
