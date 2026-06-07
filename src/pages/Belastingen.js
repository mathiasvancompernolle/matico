import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Info, Download, ChevronDown } from 'lucide-react';

const fmt = (v) => Math.abs(v).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ACCENT = '#6366f1';
const VRIJSTELLING_JAAR = 10000; // €10.000 per persoon per jaar
const TARIEF = 0.10; // 10%
const REFERENTIEDATUM = '31 dec 2025';

// Referentiekoersen op 31/12/2025 (slotkoers)
// In productie zou dit via API opgehaald worden
const REF_KOERSEN_2025 = {
  NVDA: 134.25,   // $134.25 op 31/12/2025 (USD)
  MSFT: 420.80,   // $420.80 op 31/12/2025 (USD)
  NKE:  73.76,    // $73.76 op 31/12/2025 (USD) — maar aangekocht in 2026, niet relevant
  AAPL: 254.49,
  AMZN: 224.19,
  META: 589.34,
  GOOGL: 196.61,
  TSLA: 403.84,
  JPM: 249.70,
  SOFI: 13.45,
  // ETFs
  'VWCE': 137.82,
};

export default function Belastingen() {
  const { beleggingen, koersen, verkochteBeleggingen, getMuntFactor } = useApp();
  const [jaar, setJaar] = useState(new Date().getFullYear());
  const [jaarDropdown, setJaarDropdown] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [simulatieOpen, setSimulatieOpen] = useState(false);
  const [simAantal, setSimAantal] = useState('');
  const [simBelegging, setSimBelegging] = useState(null);
  const printRef = useRef();

  const factor = (b) => getMuntFactor ? getMuntFactor(b.munt || 'EUR') : ((b.munt || 'EUR') === 'USD' ? 0.865 : 1);

  const parseNLDatum = (str) => {
    if (!str) return null;
    const d = str.split('/');
    return d.length === 3 ? new Date(`${d[2]}-${d[1]}-${d[0]}`) : new Date(str);
  };

  // ── Bereken gerealiseerde meerwaarden voor het gekozen jaar ──
  const { verkopen, totaalMeerwaarde, totaalMinwaarde, netto, belastbaar, belasting, restVrijstelling, gebruikteVrijstelling } = useMemo(() => {
    const verkopenDitJaar = (verkochteBeleggingen || []).filter(b => {
      const verkoopD = parseNLDatum(b.verkoopdatum);
      return verkoopD && verkoopD.getFullYear() === jaar;
    });

    const verkoopLijst = verkopenDitJaar.map(b => {
      const f = factor(b);
      const verkoopBedrag = (b.verkoopkoers || 0) * b.aantalVerkocht * f;
      const verkoopDatum = parseNLDatum(b.verkoopdatum);
      const aankoopDatum = b.datum ? new Date(b.datum) : null;

      // Referentiedatum check: aangekocht vóór 2026?
      const aangekochtvoor2026 = aankoopDatum && aankoopDatum.getFullYear() < 2026;
      const basis = b.symbol.toUpperCase().split('.')[0];

      let aankoopBedrag;
      let aankoopLabel;
      let gebruiktRef = false;

      if (aangekochtvoor2026 && jaar >= 2026) {
        // Gebruik referentiekoers 31/12/2025 als basis
        const refKoers = REF_KOERSEN_2025[basis];
        if (refKoers) {
          const refBedrag = refKoers * b.aantalVerkocht * f;
          const origBedrag = b.kostprijs * b.aantalVerkocht * f;
          // Gebruik hoogste van referentie of originele aankoopprijs (beschermt belegger)
          if (origBedrag > refBedrag) {
            aankoopBedrag = origBedrag;
            aankoopLabel = `€${fmt(origBedrag)} - aankoopprijs`;
            gebruiktRef = false;
          } else {
            aankoopBedrag = refBedrag;
            aankoopLabel = `€${fmt(refBedrag)} - ${REFERENTIEDATUM} *`;
            gebruiktRef = true;
          }
        } else {
          // Geen referentiekoers beschikbaar — gebruik aankoopprijs
          aankoopBedrag = b.kostprijs * b.aantalVerkocht * f;
          aankoopLabel = `€${fmt(aankoopBedrag)} - aankoopprijs`;
        }
      } else {
        aankoopBedrag = b.kostprijs * b.aantalVerkocht * f;
        aankoopLabel = `€${fmt(aankoopBedrag)} - ${aankoopDatum ? aankoopDatum.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'aankoopprijs'}`;
      }

      const meerwaarde = verkoopBedrag - aankoopBedrag;

      return {
        ...b,
        aankoopBedrag, aankoopLabel, verkoopBedrag, meerwaarde,
        aantalVerkocht: b.aantalVerkocht,
        verkoopLabel: `€${fmt(verkoopBedrag)} - ${verkoopDatum ? verkoopDatum.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}`,
        gebruiktRef,
      };
    });

    const totaalMw = verkoopLijst.filter(v => v.meerwaarde > 0).reduce((s, v) => s + v.meerwaarde, 0);
    const totaalMw_neg = verkoopLijst.filter(v => v.meerwaarde < 0).reduce((s, v) => s + v.meerwaarde, 0);
    const netto = totaalMw + totaalMw_neg; // saldo na verrekening minwaarden
    const vrijstelling = Math.min(Math.max(netto, 0), VRIJSTELLING_JAAR);
    const belastbaar = Math.max(netto - vrijstelling, 0);
    const belasting = belastbaar * TARIEF;

    return {
      verkopen: verkoopLijst,
      totaalMeerwaarde: totaalMw,
      totaalMinwaarde: totaalMw_neg,
      netto,
      belastbaar,
      belasting,
      gebruikteVrijstelling: vrijstelling,
      restVrijstelling: VRIJSTELLING_JAAR - vrijstelling,
    };
  }, [verkochteBeleggingen, jaar, koersen]);

  // ── Simulatie: wat als je nu verkoopt? ──
  const { simResultaat } = useMemo(() => {
    if (!simBelegging || !simAantal || isNaN(parseFloat(simAantal))) return { simResultaat: null };
    const b = simBelegging;
    const aantal = parseFloat(simAantal);
    const f = factor(b);
    const k = koersen[b.symbol];
    const huidigePrijs = k ? k.c : b.kostprijs;
    const verkoopBedrag = huidigePrijs * aantal * f;

    const basis = b.symbol.toUpperCase().split('.')[0];
    const aankoopDatum = b.datum ? new Date(b.datum) : null;
    const aangekochtvoor2026 = aankoopDatum && aankoopDatum.getFullYear() < 2026;
    let aankoopBedrag;

    if (aangekochtvoor2026) {
      const refKoers = REF_KOERSEN_2025[basis];
      const refBedrag = refKoers ? refKoers * aantal * f : b.kostprijs * aantal * f;
      const origBedrag = b.kostprijs * aantal * f;
      aankoopBedrag = Math.max(refBedrag, origBedrag);
    } else {
      aankoopBedrag = b.kostprijs * aantal * f;
    }

    const meerwaarde = verkoopBedrag - aankoopBedrag;
    const reeds = netto; // al gerealiseerd dit jaar
    const totaalNetto = reeds + meerwaarde;
    const gebruikteVrij = Math.min(Math.max(reeds, 0), VRIJSTELLING_JAAR);
    const restVrij = VRIJSTELLING_JAAR - gebruikteVrij;
    const extraVrij = Math.min(Math.max(meerwaarde, 0), restVrij);
    const extraBelastbaar = Math.max(meerwaarde - extraVrij, 0);
    const extraBelasting = extraBelastbaar * TARIEF;

    return {
      simResultaat: {
        meerwaarde, verkoopBedrag, aankoopBedrag,
        huidigePrijs, extraBelasting, extraBelastbaar, restVrij, extraVrij
      }
    };
  }, [simBelegging, simAantal, koersen, netto]);

  const beschikbareJaren = useMemo(() => {
    const huidig = new Date().getFullYear();
    const vroegste = (verkochteBeleggingen || []).reduce((min, b) => {
      const d = parseNLDatum(b.verkoopdatum);
      return d && d.getFullYear() < min ? d.getFullYear() : min;
    }, huidig);
    const jaren = [];
    for (let j = huidig; j >= Math.max(vroegste, 2026); j--) jaren.push(j);
    return jaren.length > 0 ? jaren : [huidig];
  }, [verkochteBeleggingen]);

  const heeftRef = verkopen.some(v => v.gebruiktRef);

  return (
    <div style={{ padding: '0 0 60px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1>Belastingen</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setSimulatieOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            background: ACCENT, color: 'white', border: 'none', borderRadius: 8,
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600
          }}>
            🧮 Maak een simulatie
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 32px', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{ display: 'flex' }}>
          <div style={{
            padding: '12px 0', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
            borderBottom: '2px solid var(--accent)', marginBottom: -1, marginRight: 24
          }}>Meerwaardebelasting</div>
        </div>
      </div>

      <div style={{ padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Rij 1: te betalen + vrijstelling ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              Te betalen meerwaardebelasting in {jaar}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
              €{fmt(belasting)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              10% op €{fmt(belastbaar)} belastbare meerwaarde
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              Resterende vrijstelling
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
              €{restVrijstelling.toLocaleString('nl-BE', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Totale vrijstelling {jaar}: €{VRIJSTELLING_JAAR.toLocaleString('nl-BE')}
            </div>
          </div>
        </div>

        {/* ── Verkochte beleggingen ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }} ref={printRef}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Verkochte beleggingen</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Gerealiseerde meerwaarden in belastingjaar {jaar}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Jaar dropdown */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setJaarDropdown(o => !o)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit'
                }}>
                  {jaar} <ChevronDown size={13} />
                </button>
                {jaarDropdown && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'white',
                    border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)',
                    zIndex: 20, overflow: 'hidden', minWidth: 90
                  }}>
                    {beschikbareJaren.map(j => (
                      <div key={j} onClick={() => { setJaar(j); setJaarDropdown(false); }}
                        style={{
                          padding: '9px 16px', cursor: 'pointer', fontSize: 13,
                          fontWeight: j === jaar ? 700 : 400,
                          background: j === jaar ? 'var(--accent-bg)' : 'transparent',
                          color: j === jaar ? 'var(--accent)' : 'var(--text-primary)'
                        }}
                        onMouseEnter={e => { if (j !== jaar) e.currentTarget.style.background = 'var(--bg)'; }}
                        onMouseLeave={e => { if (j !== jaar) e.currentTarget.style.background = 'transparent'; }}
                      >{j}</div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => window.print()} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                border: '1px solid var(--border)', borderRadius: 8, background: 'white',
                cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit'
              }}>
                <Download size={14} /> Download PDF
              </button>
            </div>
          </div>

          {/* Referentiedatum banner */}
          {heeftRef && (
            <div style={{
              margin: '16px 24px', padding: '12px 16px',
              background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10,
              fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start'
            }}>
              <Info size={15} style={{ color: '#f97316', flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong style={{ color: '#c2410c' }}>* Referentiedatum {REFERENTIEDATUM}</strong>
                <div style={{ color: '#9a3412', marginTop: 2 }}>
                  Voor beleggingen aangekocht vóór 2026 wordt de meerwaarde berekend vanaf de slotkoers op {REFERENTIEDATUM}, niet vanaf de originele aankoopprijs.
                </div>
              </div>
            </div>
          )}

          {verkopen.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Geen verkochte beleggingen in {jaar}
            </div>
          ) : (
            <>
              {/* Kolomhoofden */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1.5fr 1fr 0.8fr',
                padding: '8px 24px', borderBottom: '1px solid var(--border-light)',
                fontSize: 12, fontWeight: 600, color: 'var(--text-muted)'
              }}>
                <span>Belegging</span>
                <span style={{ textAlign: 'right' }}>Aankoop</span>
                <span style={{ textAlign: 'right' }}>Verkoop</span>
                <span style={{ textAlign: 'right' }}>Meerwaarde</span>
                <span style={{ textAlign: 'right' }}>Belasting</span>
              </div>

              {/* Rijen */}
              {verkopen.map((b, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1.5fr 1fr 0.8fr',
                  padding: '14px 24px', borderBottom: '1px solid var(--border-light)', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {b.logo ? (
                      <img src={b.logo} alt={b.symbol} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border)' }} />
                    ) : (
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: 'var(--accent-bg)',
                        color: 'var(--accent)', fontWeight: 700, fontSize: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {b.symbol.split('.')[0].slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{b.naam}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {b.symbol} · {b.aantalVerkocht} stuk{b.aantalVerkocht !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13 }}>
                    <span style={{
                      textDecoration: b.gebruiktRef ? 'underline dotted #f97316' : 'none',
                      color: b.gebruiktRef ? '#c2410c' : 'var(--text-primary)'
                    }}>
                      {b.aankoopLabel}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13 }}>{b.verkoopLabel}</div>
                  <div style={{
                    textAlign: 'right', fontSize: 13, fontWeight: 700,
                    color: b.meerwaarde >= 0 ? 'var(--green)' : 'var(--red)'
                  }}>
                    {b.meerwaarde >= 0 ? '+' : ''}€{fmt(b.meerwaarde)}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                    {b.meerwaarde > 0 ? `€${fmt(b.meerwaarde * TARIEF)}` : '—'}
                  </div>
                </div>
              ))}

              {/* Totaalrijen */}
              <div style={{ padding: '0 24px' }}>
                {[
                  { label: 'Totale meerwaarde', waarde: netto, kleur: netto >= 0 ? 'var(--green)' : 'var(--red)', bold: false },
                  { label: 'Vrijstelling', waarde: -gebruikteVrijstelling, kleur: 'var(--text-secondary)', bold: false },
                  { label: 'Belastbare meerwaarde', waarde: belastbaar, kleur: 'var(--text-primary)', bold: true },
                  { label: 'Te betalen meerwaardebelasting (10%)', waarde: belasting, kleur: 'var(--text-primary)', bold: true },
                ].map(({ label, waarde, kleur, bold }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderTop: '1px solid var(--border-light)'
                  }}>
                    <span style={{ fontSize: 14, fontWeight: bold ? 700 : 400, color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: kleur }}>
                      {label === 'Vrijstelling' ? `-€${fmt(gebruikteVrijstelling)}` : `€${fmt(waarde)}`}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Disclaimer */}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '0 40px', lineHeight: 1.6 }}>
          De wetgeving rond de meerwaardebelasting is nog in behandeling en kan mogelijk wijzigen.
          De berekeningen op deze pagina zijn gebaseerd op het huidige wetsontwerp en zijn indicatief
          bedoeld en vormen geen fiscaal advies.
        </div>
      </div>

      {/* ── Simulatie modal ── */}
      {simulatieOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => { setSimulatieOpen(false); setSimBelegging(null); setSimAantal(''); }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32, width: 520,
            maxWidth: '90vw', boxShadow: 'var(--shadow-lg)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>🧮 Verkoopsimulatie</h2>
              <button onClick={() => { setSimulatieOpen(false); setSimBelegging(null); setSimAantal(''); }} style={{
                background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)'
              }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Bereken hoeveel belasting je zou betalen als je vandaag een belegging verkoopt.
            </p>

            {/* Kies belegging */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Belegging</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {beleggingen.map(b => {
                  const k = koersen[b.symbol];
                  const prijs = k ? k.c : b.kostprijs;
                  const f = factor(b);
                  return (
                    <div key={b.symbol} onClick={() => setSimBelegging(b)}
                      style={{
                        padding: '10px 14px', border: `1.5px solid ${simBelegging?.symbol === b.symbol ? ACCENT : 'var(--border)'}`,
                        borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                        background: simBelegging?.symbol === b.symbol ? 'var(--accent-bg)' : 'white',
                        transition: 'all 0.1s'
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{b.naam}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {b.munt === 'USD' ? '$' : '€'}{prijs.toFixed(2)} · {b.aantal} st.
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Aantal */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Aantal te verkopen {simBelegging ? `(max ${simBelegging.aantal})` : ''}
              </label>
              <input
                type="number"
                value={simAantal}
                onChange={e => setSimAantal(e.target.value)}
                min="0.001"
                max={simBelegging?.aantal || 999}
                step="1"
                placeholder="bijv. 1"
                style={{
                  width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)',
                  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none'
                }}
              />
            </div>

            {/* Resultaat */}
            {simResultaat && (
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Simulatieresultaat</div>
                {[
                  { label: 'Verkoopbedrag', waarde: `€${fmt(simResultaat.verkoopBedrag)}` },
                  { label: 'Aankoopbasis', waarde: `€${fmt(simResultaat.aankoopBedrag)}` },
                  { label: 'Meerwaarde', waarde: `${simResultaat.meerwaarde >= 0 ? '+' : ''}€${fmt(simResultaat.meerwaarde)}`, kleur: simResultaat.meerwaarde >= 0 ? 'var(--green)' : 'var(--red)' },
                  { label: 'Toe te passen vrijstelling', waarde: `€${fmt(simResultaat.extraVrij)}` },
                  { label: 'Belastbaar', waarde: `€${fmt(simResultaat.extraBelastbaar)}` },
                  { label: 'Te betalen belasting (10%)', waarde: `€${fmt(simResultaat.extraBelasting)}`, bold: true },
                ].map(({ label, waarde, kleur, bold }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: 13,
                    padding: '5px 0', borderBottom: '1px solid var(--border-light)'
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontWeight: bold ? 700 : 600, color: kleur || 'var(--text-primary)' }}>{waarde}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', fontSize: 13,
                  padding: '8px 0', marginTop: 4, borderTop: '2px solid var(--border)'
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Nieuwe resterende vrijstelling</span>
                  <span style={{ fontWeight: 700, color: Math.max(simResultaat.restVrij - Math.max(simResultaat.meerwaarde, 0), 0) > 0 ? 'var(--green)' : 'var(--red)' }}>
                    €{fmt(Math.max(simResultaat.restVrij - Math.max(simResultaat.meerwaarde, 0), 0))}
                  </span>
                </div>
                {simResultaat.restVrij > 0 && simResultaat.extraBelasting === 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                    ✓ Volledig binnen vrijstelling — geen belasting verschuldigd
                  </div>
                )}
              </div>
            )}

            <button onClick={() => { setSimulatieOpen(false); setSimBelegging(null); setSimAantal(''); }} style={{
              width: '100%', padding: '11px', background: ACCENT, color: 'white',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 600
            }}>Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
