import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, ChevronDown, Calendar, MoreVertical, Search, ArrowLeft, X, Trash2, Download } from 'lucide-react';
import BeleggingDetail from '../components/BeleggingDetail';

// ── kleine hulpfuncties ──────────────────────────────────────────
// ETF uitgever mapping → afkorting + kleur
const ETF_UITGEVERS = [
  { match: ['ishares','blackrock'], label: 'iSH', kleur: '#00b140', tekst: 'white' },
  { match: ['vanguard'], label: 'VG', kleur: '#c8102e', tekst: 'white' },
  { match: ['amundi'], label: 'AM', kleur: '#0066cc', tekst: 'white' },
  { match: ['xtrackers','dws'], label: 'XT', kleur: '#003c88', tekst: 'white' },
  { match: ['invesco'], label: 'IV', kleur: '#00205b', tekst: 'white' },
  { match: ['spdr','state street'], label: 'SPD', kleur: '#00a651', tekst: 'white' },
  { match: ['wisdomtree'], label: 'WT', kleur: '#f7941d', tekst: 'white' },
  { match: ['vaneck'], label: 'VE', kleur: '#003087', tekst: 'white' },
  { match: ['lyxor'], label: 'LY', kleur: '#e4003a', tekst: 'white' },
  { match: ['ubs'], label: 'UBS', kleur: '#e3000f', tekst: 'white' },
  { match: ['pimco'], label: 'PM', kleur: '#00205b', tekst: 'white' },
  { match: ['franklin','templeton'], label: 'FT', kleur: '#2e5eaa', tekst: 'white' },
  { match: ['fidelity'], label: 'FID', kleur: '#008a00', tekst: 'white' },
  { match: ['hsbc'], label: 'HSB', kleur: '#db0011', tekst: 'white' },
  { match: ['jpmorgan','jpm'], label: 'JPM', kleur: '#003087', tekst: 'white' },
  { match: ['goldman','gs'], label: 'GS', kleur: '#6699ff', tekst: 'white' },
];

// Crypto kleur mapping
const CRYPTO_KLEUREN = {
  'BTC': { kleur: '#f7931a', tekst: 'white' },
  'ETH': { kleur: '#627eea', tekst: 'white' },
  'SOL': { kleur: '#9945ff', tekst: 'white' },
  'XRP': { kleur: '#00aae4', tekst: 'white' },
  'ADA': { kleur: '#0033ad', tekst: 'white' },
  'DOT': { kleur: '#e6007a', tekst: 'white' },
  'DOGE': { kleur: '#c2a633', tekst: 'white' },
  'AVAX': { kleur: '#e84142', tekst: 'white' },
  'LINK': { kleur: '#2a5ada', tekst: 'white' },
  'MATIC': { kleur: '#8247e5', tekst: 'white' },
  'SHIB': { kleur: '#f00500', tekst: 'white' },
  'TON': { kleur: '#0088cc', tekst: 'white' },
};

function Avatar({ symbol, logo, naam, type }) {
  const [imgFout, setImgFout] = React.useState(false);
  const initials = symbol.split('.')[0].slice(0, 2).toUpperCase();

  if (logo && !imgFout) {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: 10, overflow: 'hidden',
        border: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'white'
      }}>
        <img
          src={logo} alt={symbol}
          style={{ width: 30, height: 30, objectFit: 'contain' }}
          onError={() => setImgFout(true)}
        />
      </div>
    );
  }

  // ETF badge op basis van uitgevende instelling
  const naamCheck = (naam || symbol || '').toLowerCase();
  const isEtf = type === 'etf' || (!type && ETF_UITGEVERS.some(u => u.match.some(m => naamCheck.includes(m))));
  
  if (isEtf) {
    const uitgever = ETF_UITGEVERS.find(u => u.match.some(m => naamCheck.includes(m)));
    if (uitgever) {
      return (
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: uitgever.kleur, color: uitgever.tekst,
          fontWeight: 800, fontSize: 10, letterSpacing: '-0.3px',
        }}>
          {uitgever.label}
        </div>
      );
    }
  }

  // Crypto badge met eigen kleur
  const basis = symbol.replace(/-EUR$|-USD$|-GBP$|-USDT$/,'').toUpperCase();
  const isCrypto = type === 'crypto' || (!type && CRYPTO_KLEUREN[basis]);
  
  if (isCrypto) {
    const cryptoKleur = CRYPTO_KLEUREN[basis] || { kleur: '#f7931a', tekst: 'white' };
    return (
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: cryptoKleur.kleur, color: cryptoKleur.tekst,
        fontWeight: 800, fontSize: 12,
      }}>
        {basis.slice(0, 3)}
      </div>
    );
  }

  // Standaard fallback
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, background: 'var(--accent-bg)',
      color: 'var(--accent)', fontWeight: 700, fontSize: 13, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {initials}
    </div>
  );
}

function KebabMenu({ onDetail, onVerkopen, onVerwijder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px',
          borderRadius: 6, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', background: 'var(--bg-white)',
          border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)',
          zIndex: 100, minWidth: 160, overflow: 'hidden'
        }}>
          <button onClick={e => { e.stopPropagation(); setOpen(false); onDetail(); }}
            style={menuItemStyle}>Detail bekijken</button>
          <button onClick={e => { e.stopPropagation(); setOpen(false); onVerkopen(); }}
            style={menuItemStyle}>Verkoop registreren</button>
          <div style={{ height: 1, background: 'var(--border-light)' }} />
          <button onClick={e => { e.stopPropagation(); setOpen(false); onVerwijder(); }}
            style={{ ...menuItemStyle, color: 'var(--red)' }}>Verwijderen</button>
        </div>
      )}
    </div>
  );
}

const menuItemStyle = {
  display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
  border: 'none', padding: '10px 16px', fontSize: 13, cursor: 'pointer',
  fontFamily: 'inherit', color: 'var(--text-primary)',
  transition: 'background 0.1s'
};

// ── Verkoop Registreren Modal ────────────────────────────────────
function VerkoopModal({ beleggingen, koersen, onClose, onBevestig }) {
  const [stap, setStap] = useState('kiezen'); // 'kiezen' | 'invullen'
  const [zoek, setZoek] = useState('');
  const [gekozen, setGekozen] = useState(null);
  const [form, setForm] = useState({ datum: new Date().toISOString().slice(0, 10), aantal: '', koers: '', munt: 'EUR' });

  // Pre-fill koers als beschikbaar
  useEffect(() => {
    if (gekozen) {
      const k = koersen[gekozen.symbol];
      const koers = k ? k.c.toFixed(2) : gekozen.kostprijs.toFixed(2);
      const munt = gekozen.munt || 'EUR';
      setForm({
        datum: new Date().toISOString().slice(0, 10),
        aantal: gekozen.aantal.toString(),
        koers,
        munt
      });
      setStap('invullen');
    }
  }, [gekozen]);

  const gefilterd = beleggingen.filter(b =>
    b.naam.toLowerCase().includes(zoek.toLowerCase()) ||
    b.symbol.toLowerCase().includes(zoek.toLowerCase())
  );

  const bevestig = () => {
    if (!form.datum || !form.aantal || !form.koers) return;
    onBevestig(gekozen, {
      datum: form.datum,
      aantal: parseFloat(form.aantal),
      koers: parseFloat(form.koers),
      munt: form.munt
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-white)', borderRadius: 16, padding: '32px',
        width: 520, maxWidth: '90vw', boxShadow: 'var(--shadow-lg)', position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        {/* Sluitknop */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'transparent',
          border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4
        }}><X size={20} /></button>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Verkoop registreren</h2>

        {stap === 'kiezen' ? (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              Kies een actieve belegging om te verkopen.
            </p>
            {/* Zoekbalk */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                autoFocus
                value={zoek}
                onChange={e => setZoek(e.target.value)}
                placeholder="Zoek op naam of symbool..."
                style={{
                  width: '100%', padding: '10px 14px 10px 40px',
                  border: '1.5px solid var(--border)', borderRadius: 10,
                  fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  color: 'var(--text-primary)', background: 'var(--bg)'
                }}
              />
            </div>
            {/* Lijst */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              {gefilterd.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Geen beleggingen gevonden
                </div>
              ) : gefilterd.map((b, i) => (
                <div key={b.id}
                  onClick={() => setGekozen(b)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    cursor: 'pointer', borderBottom: i < gefilterd.length - 1 ? '1px solid var(--border-light)' : 'none',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Avatar symbol={b.symbol} logo={b.logo} naam={b.naam} type={b.type} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{b.naam}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {b.symbol} · {b.aantal} stuk{b.aantal !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: 'rotate(-90deg)' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{
                padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 8,
                background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500
              }}>Annuleren</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Vul de verkoopgegevens in van <strong>{gekozen.naam} ({gekozen.symbol})</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Verkoopdatum */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Verkoopdatum</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={form.datum}
                    onChange={e => setForm(f => ({ ...f, datum: e.target.value }))}
                    style={inputStyle}
                  />
                  <Calendar size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
              </div>
              {/* Aantal */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Aantal</label>
                <input
                  type="number"
                  value={form.aantal}
                  onChange={e => setForm(f => ({ ...f, aantal: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              {/* Verkoopkoers */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Verkoopkoers per stuk</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    value={form.koers}
                    onChange={e => setForm(f => ({ ...f, koers: e.target.value }))}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <select value={form.munt} onChange={e => setForm(f => ({ ...f, munt: e.target.value }))}
                    style={{ ...inputStyle, width: 80 }}>
                    <option>EUR</option><option>USD</option><option>GBP</option>
                  </select>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Ingevuld op basis van de laatst bekende koers op {new Date().toLocaleDateString('nl-BE')}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setStap('kiezen')} style={{
                padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 8,
                background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500
              }}>Terug</button>
              <button onClick={bevestig} style={{
                padding: '10px 24px', background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 600
              }}>Markeren als verkocht</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)',
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none',
  color: 'var(--text-primary)', background: 'var(--bg-white)'
};

// ── Hoofd component ──────────────────────────────────────────────
export default function Beleggingen({ onToevoegen }) {
  const { beleggingen, setBeleggingen, koersen, verkochteBeleggingen, setVerkochteBeleggingen, getMuntFactor } = useApp();

  // Haal logo's en type op voor beleggingen zonder logo OF zonder type
  React.useEffect(() => {
    const zonderInfo = [
      ...beleggingen.filter(b => !b.logo || !b.type),
      ...(verkochteBeleggingen || []).filter(b => !b.logo || !b.type)
    ];
    // Dedupliceer op symbol
    const gezien = new Set();
    const uniek = zonderInfo.filter(b => { if (gezien.has(b.symbol)) return false; gezien.add(b.symbol); return true; });
    uniek.forEach(async (b) => {
      try {
        const res = await fetch(`/api/data?endpoint=profile&symbol=${encodeURIComponent(b.symbol)}`);
        const data = await res.json();
        const logo = data.logo || data.image || '';
        const type = data.type || '';
        setBeleggingen(prev => prev.map(pb => pb.symbol === b.symbol ? {
          ...pb,
          ...(logo && !pb.logo ? { logo } : {}),
          ...(type && !pb.type ? { type } : {})
        } : pb));
        setVerkochteBeleggingen(prev => (prev || []).map(pb => pb.symbol === b.symbol ? {
          ...pb,
          ...(logo && !pb.logo ? { logo } : {}),
          ...(type && !pb.type ? { type } : {})
        } : pb));
      } catch (e) {}
    });
  }, [beleggingen.map(b => b.symbol + (b.type||'')).join(',')]);
  const [tab, setTab] = useState('actief');
  const [detailBelegging, setDetailBelegging] = useState(null);
  const [verkoopModal, setVerkoopModal] = useState(false);
  const [verkoopVoorBelegging, setVerkoopVoorBelegging] = useState(null);
  const [sortCol, setSortCol] = useState('datum');
  const [sortDir, setSortDir] = useState('asc');

  const wisselSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };
  const sortPijl = (col) => sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕';

  const parseDatum = (s) => { if (!s) return 0; const d = s.split('/'); return d.length === 3 ? new Date(`${d[2]}-${d[1]}-${d[0]}`).getTime() : new Date(s).getTime(); };

  const gesorteerd = (lijst) => [...lijst].sort((a, b) => {
    let va, vb;
    switch (sortCol) {
      case 'naam': va = a.naam?.toLowerCase(); vb = b.naam?.toLowerCase(); break;
      case 'datum': va = parseDatum(a.datum); vb = parseDatum(b.datum); break;
      case 'kostprijs': va = a.kostprijs; vb = b.kostprijs; break;
      case 'aantal': va = a.aantal; vb = b.aantal; break;
      default: va = parseDatum(a.datum); vb = parseDatum(b.datum);
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const verwijder = (id) => {
    if (window.confirm('Wil je deze belegging verwijderen?')) {
      setBeleggingen(prev => prev.filter(b => b.id !== id));
    }
  };

  const openVerkoopModal = (belegging = null) => {
    setVerkoopVoorBelegging(belegging);
    setVerkoopModal(true);
  };

  const registreerVerkoop = (belegging, verkoopdata) => {
    const verkochte = {
      ...belegging,
      verkoopdatum: verkoopdata.datum,
      aantalVerkocht: verkoopdata.aantal,
      verkoopkoers: verkoopdata.koers,
      verkoopMunt: verkoopdata.munt,
      winstverlies: (verkoopdata.koers - belegging.kostprijs) * verkoopdata.aantal
    };
    setVerkochteBeleggingen(prev => [...(prev || []), verkochte]);
    // Verwijder (deels) uit actieve beleggingen
    setBeleggingen(prev => {
      const updated = prev.map(b => {
        if (b.id !== belegging.id) return b;
        const resterend = b.aantal - verkoopdata.aantal;
        if (resterend <= 0) return null;
        return { ...b, aantal: resterend };
      }).filter(Boolean);
      return updated;
    });
  };

  const exporteerNaarExcel = () => {
    const nu = new Date();
    const datumStr = `${nu.getDate().toString().padStart(2,'0')}-${(nu.getMonth()+1).toString().padStart(2,'0')}-${nu.getFullYear()}`;
    const tijdStr = `${nu.getHours().toString().padStart(2,'0')}_${nu.getMinutes().toString().padStart(2,'0')}_${nu.getSeconds().toString().padStart(2,'0')}`;

    // Dynamisch xlsx importeren
    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Actieve posities ──
      const positieData = [
        ['Instrument','Valuta','Aantal','Aankoopkoers','Huidige koers','Aankoopwaarde (€)','Huidige waarde (€)','Winst/Verlies (€)','Winst/Verlies (%)','ISIN','Type','Aankoopdatum'],
        ...beleggingen.map(b => {
          const k = koersen[b.symbol];
          const factor = getMuntFactor(b.munt || 'EUR');
          const koersNu = k ? k.c : b.kostprijs;
          const aankoopWaarde = b.kostprijs * b.aantal * factor;
          const huidigeWaarde = koersNu * b.aantal * factor;
          const winstVerlies = huidigeWaarde - aankoopWaarde;
          const winstPct = aankoopWaarde > 0 ? (winstVerlies / aankoopWaarde) * 100 : 0;
          return [
            b.naam || b.symbol,
            b.munt || 'EUR',
            b.aantal,
            b.kostprijs,
            koersNu,
            parseFloat(aankoopWaarde.toFixed(2)),
            parseFloat(huidigeWaarde.toFixed(2)),
            parseFloat(winstVerlies.toFixed(2)),
            parseFloat(winstPct.toFixed(2)),
            '',
            b.type === 'etf' ? 'ETF' : b.type === 'crypto' ? 'Crypto' : 'Aandeel',
            b.datum || '',
          ];
        })
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(positieData);
      ws1['!cols'] = [30,8,8,12,12,16,16,16,14,14,10,12].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws1, 'Posities');

      // ── Sheet 2: Transactiegeschiedenis ──
      const transactieData = [
        ['Datum','Type','Instrument','Symbool','Valuta','Aantal','Koers','Transactiekosten','Totaal (€)'],
        // Aankopen (actieve beleggingen)
        ...beleggingen.map(b => {
          const factor = getMuntFactor(b.munt || 'EUR');
          return [
            b.datum || '',
            'Aankoop',
            b.naam || b.symbol,
            b.symbol,
            b.munt || 'EUR',
            b.aantal,
            b.kostprijs,
            b.transactiekosten || 0,
            parseFloat((b.kostprijs * b.aantal * factor + (b.transactiekosten || 0)).toFixed(2)),
          ];
        }),
        // Aankopen + verkopen (verkochte beleggingen)
        ...(verkochteBeleggingen || []).flatMap(b => {
          const factor = getMuntFactor(b.munt || 'EUR');
          const rijen = [];
          if (b.datum) rijen.push([
            b.datum, 'Aankoop', b.naam || b.symbol, b.symbol, b.munt || 'EUR',
            b.aantalVerkocht || b.aantal, b.kostprijs, b.transactiekosten || 0,
            parseFloat((b.kostprijs * (b.aantalVerkocht || b.aantal) * factor).toFixed(2)),
          ]);
          if (b.verkoopdatum) rijen.push([
            b.verkoopdatum, 'Verkoop', b.naam || b.symbol, b.symbol, b.munt || 'EUR',
            b.aantalVerkocht || b.aantal, b.verkoopkoers, 0,
            parseFloat((b.verkoopkoers * (b.aantalVerkocht || b.aantal) * factor).toFixed(2)),
          ]);
          return rijen;
        }),
      ].sort((a, b) => a[0] < b[0] ? -1 : 1); // Sorteren op datum

      const ws2 = XLSX.utils.aoa_to_sheet(transactieData);
      ws2['!cols'] = [12,10,28,10,8,8,10,14,12].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws2, 'Transacties');

      // Bestandsnaam zoals Saxo: Posities_17-jun-2026_1_03_05
      const maandNamen = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
      const saxoDatum = `${nu.getDate()}-${maandNamen[nu.getMonth()]}-${nu.getFullYear()}`;
      const bestandsnaam = `Posities_${saxoDatum}_${tijdStr.replace(/_/g,'_')}.xlsx`;
      XLSX.writeFile(wb, bestandsnaam);
    });
  };

  const muntSymbool = (munt) => munt === 'USD' ? '$' : munt === 'GBP' ? '£' : '€';

  const ColHeader = ({ children }) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'default', userSelect: 'none' }}>
      {children}
    </span>
  );

  return (
    <div style={{ padding: '0 0 60px' }}>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>Beleggingen</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={exporteerNaarExcel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={15} /> Exporteren
          </button>
          <button className="btn btn-primary" onClick={onToevoegen}>
            <Plus size={16} /> Beleggingen toevoegen
          </button>
        </div>
      </div>

      <div style={{ padding: '0 32px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {['actief', 'verkocht', 'geschiedenis'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 20px', border: 'none', background: 'transparent',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', textTransform: 'capitalize', marginBottom: -1
            }}>
              {t === 'actief' ? 'Actief' : t === 'verkocht' ? 'Verkocht' : 'Geschiedenis'}
            </button>
          ))}
        </div>

        {/* ── ACTIEF TAB ── */}
        {tab === 'actief' && (
          <>
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
                <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Beleggingen</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Automatisch opgevolgd door Matico</div>
                </div>

                {/* Kolomhoofden */}
                <div className="belegging-table-header" style={{
                  display: 'grid',
                  gridTemplateColumns: '2.5fr 1.2fr 1.4fr 0.8fr 40px',
                  padding: '8px 24px',
                  borderBottom: '1px solid var(--border-light)',
                  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                  alignItems: 'center'
                }}>
                  {[['naam','Naam'],['datum','Aankoopdatum'],['kostprijs','Kostprijs per stuk'],['aantal','Aantal']].map(([col,label]) => (
                    <span key={col} onClick={() => wisselSort(col)} style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {label} <span style={{ color: sortCol === col ? 'var(--accent)' : 'var(--text-muted)' }}>{sortPijl(col)}</span>
                    </span>
                  ))}
                  <span />
                </div>

                {/* Rijen */}
                {gesorteerd(beleggingen).map((b) => {
                  const ms = muntSymbool(b.munt || 'EUR');
                  return (
                    <div key={b.id} className="belegging-row-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: '2.5fr 1.2fr 1.4fr 0.8fr 40px',
                      padding: '14px 24px',
                      borderBottom: '1px solid var(--border-light)',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.1s'
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setDetailBelegging(b)}
                    >
                      {/* Naam */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar symbol={b.symbol} logo={b.logo} naam={b.naam} type={b.type} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{b.naam}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.symbol}</div>
                        </div>
                      </div>

                      {/* Datum */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '5px 10px', border: '1px solid var(--border)',
                          borderRadius: 7, fontSize: 13, fontFamily: 'DM Mono, monospace',
                          background: 'var(--bg-white)', color: 'var(--text-primary)'
                        }}>
                          {b.datum || '—'}
                        </span>
                        <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>

                      {/* Kostprijs */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          flex: 1, padding: '5px 10px', border: '1px solid var(--border)',
                          borderRadius: 7, fontSize: 13, fontFamily: 'DM Mono, monospace',
                          background: 'var(--bg-white)', color: 'var(--text-primary)',
                          minWidth: 80
                        }}>
                          {b.kostprijs.toFixed(2)}
                        </span>
                        <span style={{
                          padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 7,
                          fontSize: 12, background: 'var(--bg)', color: 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', gap: 4, cursor: 'default'
                        }}>
                          {b.munt || 'EUR'} <ChevronDown size={12} />
                        </span>
                      </div>

                      {/* Aantal */}
                      <div>
                        <span style={{
                          padding: '5px 10px', border: '1px solid var(--border)',
                          borderRadius: 7, fontSize: 13, fontFamily: 'DM Mono, monospace',
                          background: 'var(--bg-white)', color: 'var(--text-primary)',
                          display: 'inline-block'
                        }}>
                          {b.aantal}
                        </span>
                      </div>

                      {/* Kebab menu */}
                      <div onClick={e => e.stopPropagation()}>
                        <KebabMenu
                          onDetail={() => setDetailBelegging(b)}
                          onVerkopen={() => openVerkoopModal(b)}
                          onVerwijder={() => verwijder(b.id)}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Opslaan knop (rechtsonder, zoals Plutu) */}
                <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => openVerkoopModal()}
                    style={{
                      padding: '9px 20px', background: 'var(--accent)', color: 'white',
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 600
                    }}
                  >
                    Verkoop registreren
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── VERKOCHT TAB ── */}
        {tab === 'verkocht' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                onClick={() => openVerkoopModal()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', background: 'var(--accent)', color: 'white',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600
                }}
              >
                <Plus size={15} /> Verkoop registreren
              </button>
            </div>

            {(!verkochteBeleggingen || verkochteBeleggingen.length === 0) ? (
              <div className="empty-state">
                <Trash2 size={40} />
                <h3>Geen verkochte beleggingen</h3>
                <p>Zodra je een belegging verkoopt, verschijnt die hier</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Verkochte beleggingen</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Afgeronde posities</div>
                </div>

                {/* Kolomhoofden */}
                <div className="belegging-table-header" style={{
                  display: 'grid',
                  gridTemplateColumns: '2.5fr 1.2fr 1.2fr 1.2fr 1fr 40px',
                  padding: '8px 24px',
                  borderBottom: '1px solid var(--border-light)',
                  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                  alignItems: 'center'
                }}>
                  {[['naam','Naam'],['datum','Verkoopdatum'],['kostprijs','Aankoopkoers'],['verkoopkoers','Verkoopkoers'],['winst','Winst/Verlies']].map(([col,label]) => (
                    <span key={col} onClick={() => wisselSort(col)} style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {label} <span style={{ color: sortCol === col ? 'var(--accent)' : 'var(--text-muted)' }}>{sortPijl(col)}</span>
                    </span>
                  ))}
                  <span />
                </div>

                {[...verkochteBeleggingen].sort((a, b) => {
                  let va, vb;
                  switch (sortCol) {
                    case 'naam': va = a.naam?.toLowerCase(); vb = b.naam?.toLowerCase(); break;
                    case 'kostprijs': va = a.kostprijs; vb = b.kostprijs; break;
                    case 'verkoopkoers': va = a.verkoopkoers || 0; vb = b.verkoopkoers || 0; break;
                    case 'winst': va = a.winstverlies || 0; vb = b.winstverlies || 0; break;
                    default: va = parseDatum(a.verkoopdatum || a.datum); vb = parseDatum(b.verkoopdatum || b.datum);
                  }
                  if (va < vb) return sortDir === 'asc' ? -1 : 1;
                  if (va > vb) return sortDir === 'asc' ? 1 : -1;
                  return 0;
                }).map((b) => {
                  const wv = b.winstverlies || 0;
                  const isPos = wv >= 0;
                  const ms = muntSymbool(b.verkoopMunt || b.munt || 'EUR');
                  return (
                    <div key={b.id + b.verkoopdatum} className="belegging-row-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: '2.5fr 1.2fr 1.2fr 1.2fr 1fr 40px',
                      padding: '14px 24px',
                      borderBottom: '1px solid var(--border-light)',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar symbol={b.symbol} logo={b.logo} naam={b.naam} type={b.type} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{b.naam}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.symbol}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontFamily: 'DM Mono, monospace' }}>{b.verkoopdatum}</div>
                      <div style={{ fontSize: 13, fontFamily: 'DM Mono, monospace' }}>
                        {muntSymbool(b.munt || 'EUR')}{b.kostprijs.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 13, fontFamily: 'DM Mono, monospace' }}>
                        {ms}{b.verkoopkoers?.toFixed(2) || '—'}
                      </div>
                      <div style={{
                        fontSize: 13, fontFamily: 'DM Mono, monospace', fontWeight: 600,
                        color: isPos ? 'var(--green)' : 'var(--red)'
                      }}>
                        {isPos ? '+' : ''}{ms}{wv.toFixed(2)}
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm('Verkoop verwijderen?')) {
                            setVerkochteBeleggingen(prev => prev.filter((_, i) => prev[i] !== b));
                          }
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: '4px 6px', borderRadius: 6 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── GESCHIEDENIS TAB ── */}
        {tab === 'geschiedenis' && (() => {
          const maandNamen = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
          const formatDatum = (s) => {
            if (!s) return '—';
            const d = new Date(s);
            return isNaN(d) ? s : `${d.getDate()} ${maandNamen[d.getMonth()]} ${d.getFullYear()}`;
          };

          const transacties = [
            ...beleggingen.map(b => ({
              datum: b.datum || '', type: 'aankoop',
              naam: b.naam || b.symbol, symbol: b.symbol, logo: b.logo,
              munt: b.munt || 'EUR', aantal: b.aantal,
              koers: b.kostprijs, kosten: b.transactiekosten || 0,
              id: `buy_${b.id}`,
            })),
            ...(verkochteBeleggingen || []).flatMap(b => {
              const items = [];
              if (b.datum) items.push({ datum: b.datum, type: 'aankoop', naam: b.naam || b.symbol, symbol: b.symbol, logo: b.logo, munt: b.munt || 'EUR', aantal: b.aantalVerkocht || b.aantal, koers: b.kostprijs, kosten: b.transactiekosten || 0, id: `buy_v_${b.id}` });
              if (b.verkoopdatum) items.push({ datum: b.verkoopdatum, type: 'verkoop', naam: b.naam || b.symbol, symbol: b.symbol, logo: b.logo, munt: b.munt || 'EUR', aantal: b.aantalVerkocht || b.aantal, koers: b.verkoopkoers, kosten: 0, winstverlies: b.winstverlies, id: `sell_${b.id}` });
              return items;
            }),
          ].sort((a, b) => (b.datum || '') > (a.datum || '') ? 1 : -1);

          if (transacties.length === 0) return (
            <div className="empty-state"><h3>Geen transacties</h3><p>Voeg je eerste belegging toe om te beginnen</p></div>
          );

          return (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Transactiegeschiedenis</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{transacties.length} transacties</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 100px 1fr 1fr 1fr 1fr', padding: '10px 24px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-light)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>Instrument</span><span>Type</span><span>Datum</span>
                <span style={{ textAlign: 'right' }}>Aantal</span>
                <span style={{ textAlign: 'right' }}>Koers</span>
                <span style={{ textAlign: 'right' }}>Totaal</span>
              </div>
              {transacties.map((t, idx) => {
                const factor = getMuntFactor ? getMuntFactor(t.munt) : (t.munt === 'USD' ? 0.865 : 1);
                const totaal = (t.koers || 0) * t.aantal * factor + (t.kosten || 0);
                const ms = t.munt === 'USD' ? '$' : t.munt === 'GBP' ? '£' : '€';
                const isAankoop = t.type === 'aankoop';
                return (
                  <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 100px 1fr 1fr 1fr 1fr', padding: '14px 24px', borderBottom: idx < transacties.length - 1 ? '1px solid var(--border-light)' : 'none', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar symbol={t.symbol} logo={t.logo} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t.naam}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{t.symbol}</div>
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: isAankoop ? 'var(--green-bg)' : 'var(--red-bg)', color: isAankoop ? 'var(--green)' : 'var(--red)' }}>
                        {isAankoop ? '↑ Aankoop' : '↓ Verkoop'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatDatum(t.datum)}</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', textAlign: 'right' }}>{t.aantal}</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', textAlign: 'right' }}>{ms}{(t.koers || 0).toFixed(2)}</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', textAlign: 'right', fontWeight: 600, color: isAankoop ? 'var(--text-primary)' : 'var(--green)' }}>
                      {isAankoop ? '-' : '+'}€{Math.abs(totaal).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Modals */}
      {verkoopModal && (
        <VerkoopModal
          beleggingen={verkoopVoorBelegging ? [verkoopVoorBelegging] : beleggingen}
          koersen={koersen}
          onClose={() => { setVerkoopModal(false); setVerkoopVoorBelegging(null); }}
          onBevestig={registreerVerkoop}
        />
      )}
      {detailBelegging && (
        <BeleggingDetail belegging={detailBelegging} onClose={() => setDetailBelegging(null)} />
      )}
    </div>
  );
}
