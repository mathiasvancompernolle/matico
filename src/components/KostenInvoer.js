import React, { useState } from 'react';

// Invoerveld voor transactiekosten, met uitleg en optioneel opsplitsen in
// commissie, beurskosten en wisselkoerskosten (die worden opgeteld).
// Veel gebruikers wisten niet welke van de kosten op hun afrekening ze
// moesten invullen: het antwoord is "alles samen" (behalve de TOB bij
// verkoop, die een eigen veld heeft).
//
// props:
//   value, onChange(string)  — totaalbedrag (als tekst, zoals een input)
//   verkoop                  — true: TOB staat apart; false (aankoop): TOB hoort erbij
//   inputStyle / inputClassName — opmaak van de velden
//   naast                    — optioneel element naast het totaalveld (bv. muntkeuze)
export default function KostenInvoer({ value, onChange, verkoop = false, inputStyle, inputClassName, naast, placeholder = '0,00' }) {
  const [open, setOpen] = useState(false);
  const [delen, setDelen] = useState({ commissie: '', beurs: '', wissel: '' });

  const zetDeel = (sleutel, waarde) => {
    const nieuw = { ...delen, [sleutel]: waarde };
    setDelen(nieuw);
    const som = ['commissie', 'beurs', 'wissel'].reduce((s, k) => s + (parseFloat(nieuw[k]) || 0), 0);
    onChange(som > 0 ? String(Math.round(som * 100) / 100) : '');
  };

  const uitleg = verkoop
    ? 'Tel alles op wat je broker aanrekent: commissie, beurskosten en wisselkoerskosten. De beurstaks (TOB) heeft een eigen veld.'
    : 'Tel alles op wat je broker aanrekent: commissie, beurskosten, wisselkoerskosten én de beurstaks (TOB) bij aankoop.';

  const klein = { fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45 };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="number" min="0" step="0.01" value={value} placeholder={placeholder}
          className={inputClassName} readOnly={open}
          onChange={e => onChange(e.target.value)}
          style={{ ...(inputStyle || {}), flex: 1, minWidth: 0, ...(open ? { background: 'var(--bg)' } : {}) }} />
        {naast}
      </div>
      <p style={klein}>
        {uitleg}{' '}
        <button type="button" onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
          {open ? 'Opsplitsen sluiten' : 'Opsplitsen'}
        </button>
      </p>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginTop: 8 }}>
          {[['commissie', 'Commissie'], ['beurs', 'Beurskosten'], ['wissel', 'Wisselkoerskosten']].map(([k, label]) => (
            <label key={k} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {label}
              <input type="number" min="0" step="0.01" value={delen[k]} placeholder="0,00" className={inputClassName}
                onChange={e => zetDeel(k, e.target.value)} style={{ ...(inputStyle || {}), marginTop: 4, width: '100%' }} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
