// Eén artikel uit de Gids (/gids/<slug>). Inhoud: src/data/gidsArtikels.js
import React from 'react';
import { GIDS_ARTIKELS } from '../data/gidsArtikels';

const ACCENT = '#1e3a8a';
const INKT = '#16181D';
const GRIJS = '#4A4D55';
const RAND = '#E2DED4';
const CREME = '#F5F3EE';

const CSS = `
  .ga * { box-sizing: border-box; }
  .ga a { color: ${ACCENT}; }
  .ga-header { height: 72px; padding: 0 80px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid ${RAND}; background: ${CREME}; position: sticky; top: 0; z-index: 50; }
  .ga-kolom { max-width: 760px; margin: 0 auto; padding: 0 24px; }
  .ga-h1 { margin: 0; font-size: 48px; line-height: 1.08; letter-spacing: -0.03em; font-weight: 700; }
  .ga-tekst p { margin: 0 0 14px; font-size: 18px; line-height: 1.7; color: ${GRIJS}; }
  .ga-tekst ul { margin: 0 0 14px; padding-left: 22px; }
  .ga-tekst li { font-size: 18px; line-height: 1.65; color: ${GRIJS}; margin-bottom: 8px; }
  .ga-tabel { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 15px; background: #fff; border: 1px solid ${RAND}; border-radius: 12px; overflow: hidden; }
  .ga-tabel th, .ga-tabel td { text-align: left; vertical-align: top; padding: 12px 14px; border-bottom: 1px solid ${RAND}; line-height: 1.5; }
  .ga-tabel th { background: #EEEBE3; font-size: 13px; letter-spacing: .03em; text-transform: uppercase; color: ${GRIJS}; }
  .ga-tabel td:first-child { font-weight: 700; color: ${INKT}; }
  .ga-tabel-wrap { overflow-x: auto; }
  .ga-knop { display: inline-flex; align-items: center; height: 44px; padding: 0 18px; border-radius: 10px; background: ${ACCENT}; color: #fff !important; font-weight: 700; font-size: 15px; text-decoration: none; white-space: nowrap; }
  @media (max-width: 760px) {
    .ga-header { padding: 0 16px; }
    .ga-kolom { padding: 0 16px; }
    .ga-h1 { font-size: 32px; }
    .ga-tekst p, .ga-tekst li { font-size: 17px; }
    .ga-verberg-gsm { display: none; }
    /* Tabel als kaartjes onder elkaar */
    .ga-tabel thead { display: none; }
    .ga-tabel tr { display: block; padding: 12px 14px; border-bottom: 1px solid ${RAND}; }
    .ga-tabel tr:last-child { border-bottom: none; }
    .ga-tabel td { display: block; border: none; padding: 3px 0; }
    .ga-tabel td:first-child { font-size: 16px; margin-bottom: 4px; }
    .ga-tabel td[data-label]::before { content: attr(data-label) ': '; font-weight: 700; color: ${INKT}; }
  }
`;

const datumNl = (iso) => new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));

export default function GidsArtikel({ artikel, onNaarApp }) {
  const klikApp = (e) => { e.preventDefault(); onNaarApp && onNaarApp('registreren'); };
  const anderen = GIDS_ARTIKELS.filter(a => a.slug !== artikel.slug);

  return (
    <div className="ga" style={{ background: CREME, color: INKT, fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: '100vh' }}>
      <style>{CSS}</style>
      <header className="ga-header">
        <a href="/" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: ACCENT, textDecoration: 'none' }}>Kapitas</a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/gids" className="ga-verberg-gsm" style={{ fontSize: 14, fontWeight: 600, color: GRIJS, textDecoration: 'none' }}>Gids voor beginners</a>
          <a href="/" onClick={klikApp} className="ga-knop">Start gratis</a>
        </div>
      </header>

      <article>
        <div className="ga-kolom" style={{ paddingTop: 48 }}>
          <nav aria-label="Kruimelpad" style={{ fontSize: 14, color: GRIJS, marginBottom: 18 }}>
            <a href="/gids" style={{ color: GRIJS }}>Gids</a> <span aria-hidden="true">/</span> <span>{artikel.titel.split(':')[0]}</span>
          </nav>
          <h1 className="ga-h1">{artikel.titel}</h1>
          <p style={{ fontSize: 20, lineHeight: 1.55, color: GRIJS, margin: '18px 0 14px' }}>{artikel.intro}</p>
          <div style={{ fontSize: 14, color: '#6b6e75', paddingBottom: 28, borderBottom: `1px solid ${RAND}`, marginBottom: 32 }}>
            {artikel.leestijd} min lezen · Laatst nagekeken op <time dateTime={artikel.nagekeken}>{datumNl(artikel.nagekeken)}</time>
          </div>

          <div className="ga-tekst">
            {artikel.secties.map((s, i) => (
              <section key={i} style={{ marginBottom: 34 }}>
                <h2 style={{ fontSize: 27, letterSpacing: '-0.015em', margin: '0 0 14px', lineHeight: 1.2 }}>{s.kop}</h2>
                {s.tabel && (
                  <div className="ga-tabel-wrap">
                    <table className="ga-tabel">
                      <thead><tr>{s.tabel.kop.map((k, j) => <th key={j} scope="col">{k}</th>)}</tr></thead>
                      <tbody>{s.tabel.rijen.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} data-label={k > 0 ? s.tabel.kop[k] : undefined}>{c}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                )}
                {(s.tekst || []).map((p, j) => <p key={j}>{p}</p>)}
                {s.lijst && <ul>{s.lijst.map((l, j) => <li key={j}>{l}</li>)}</ul>}
                {s.tip && (
                  <div style={{ background: '#fff', border: `1px solid ${RAND}`, borderLeft: `4px solid ${ACCENT}`, borderRadius: 10, padding: '14px 16px', fontSize: 16, lineHeight: 1.6, color: INKT }}>
                    <strong>Goed om te weten: </strong>{s.tip}
                  </div>
                )}
                {s.link && <p style={{ marginTop: 10 }}><a href={s.link.pad} style={{ fontWeight: 600 }}>{s.link.tekst} →</a></p>}
              </section>
            ))}
          </div>

          {artikel.rekenhulp && (
            <div style={{ background: '#fff', border: `1px solid ${RAND}`, borderRadius: 16, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', margin: '8px 0 40px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>Reken het zelf uit</div>
                <div style={{ fontSize: 15, color: GRIJS, marginTop: 4 }}>Gratis, zonder account.</div>
              </div>
              <a href={artikel.rekenhulp.pad} className="ga-knop">{artikel.rekenhulp.tekst}</a>
            </div>
          )}

          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>Bronnen</h2>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15, lineHeight: 1.7, color: GRIJS }}>
              {artikel.bronnen.map(b => <li key={b.url}><a href={b.url} target="_blank" rel="noopener noreferrer">{b.titel}</a></li>)}
            </ul>
          </section>
        </div>
      </article>

      <section style={{ background: ACCENT, color: '#fff', padding: '56px 0' }}>
        <div className="ga-kolom">
          <h2 style={{ margin: 0, fontSize: 32, lineHeight: 1.12, letterSpacing: '-0.02em' }}>Al je beleggingen en taksen op één plek</h2>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: '#dbe4ff', margin: '14px 0 22px' }}>Kapitas volgt je aandelen, ETF's en crypto van elke broker, en rekent de beurstaks, je dividendbelasting en je meerwaardebelasting voor je uit. Gratis.</p>
          <a href="/" onClick={klikApp} className="ga-knop" style={{ background: '#fff', color: `${INKT} !important` }}><span style={{ color: INKT }}>Gratis account maken</span></a>
        </div>
      </section>

      <section className="ga-kolom" style={{ padding: '40px 24px' }}>
        <h2 style={{ fontSize: 22, margin: '0 0 14px' }}>Meer uit de gids</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {anderen.map(a => (
            <a key={a.slug} href={`/gids/${a.slug}`} style={{ display: 'block', background: '#fff', border: `1px solid ${RAND}`, borderRadius: 12, padding: '14px 16px', textDecoration: 'none', color: INKT }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{a.titel}</div>
              <div style={{ fontSize: 14, color: GRIJS, marginTop: 4, lineHeight: 1.5 }}>{a.beschrijving}</div>
            </a>
          ))}
          <a href="/gids" style={{ fontWeight: 600, marginTop: 4 }}>← Terug naar de gids voor beginners</a>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#6b6e75', marginTop: 32 }}>
          Dit artikel is algemene informatie en geen persoonlijk financieel of fiscaal advies. Regels kunnen wijzigen: controleer je situatie bij de FOD Financiën of een fiscalist.
        </p>
      </section>
    </div>
  );
}
