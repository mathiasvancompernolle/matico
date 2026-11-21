// Eén artikel uit de Gids (/gids/<slug>), in de stijl van de startpagina.
// Inhoud: src/data/gidsArtikels.js
import React from 'react';
import { GIDS_ARTIKELS } from '../data/gidsArtikels';
import { PubliekeKop, PubliekeVoet, PUBLIEK_CSS, KLEUR } from '../components/Publiek';

const TEKST = '#334155';

const CSS = `
  .ga-wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
  .ga-raster { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 56px; align-items: start; }
  .ga-inhoud-zij { position: sticky; top: 88px; }
  .ga-inhoud-zij a { display: block; font-size: 14px; color: ${KLEUR.grijs}; text-decoration: none; padding: 6px 0 6px 14px; border-left: 2px solid ${KLEUR.rand}; line-height: 1.4; }
  .ga-inhoud-zij a:hover { color: ${KLEUR.accent}; border-left-color: ${KLEUR.accent}; }
  .ga-inhoud-gsm { display: none; }
  .ga-tekst { max-width: 720px; }
  .ga-tekst h2 { font-size: 26px; font-weight: 800; letter-spacing: -.5px; line-height: 1.25; margin: 0 0 14px; scroll-margin-top: 88px; }
  .ga-tekst p { margin: 0 0 14px; font-size: 17px; line-height: 1.75; color: ${TEKST}; }
  .ga-tekst ul.ga-lijst { list-style: none; margin: 0 0 14px; padding: 0; }
  .ga-tekst ul.ga-lijst li { position: relative; padding-left: 28px; font-size: 17px; line-height: 1.7; color: ${TEKST}; margin-bottom: 10px; }
  .ga-tekst ul.ga-lijst li::before { content: ''; position: absolute; left: 4px; top: 11px; width: 8px; height: 8px; border-radius: 50%; background: ${KLEUR.accent}; }
  .ga-kader { border-radius: 12px; padding: 16px 18px; display: flex; gap: 12px; align-items: flex-start; font-size: 16px; line-height: 1.6; margin: 4px 0 14px; }
  .ga-kader strong { display: block; margin-bottom: 2px; }
  .ga-tabel { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 15px; background: #fff; border: 1px solid ${KLEUR.rand}; border-radius: 12px; overflow: hidden; margin: 0 0 16px; }
  .ga-tabel th, .ga-tabel td { text-align: left; vertical-align: top; padding: 13px 16px; border-bottom: 1px solid ${KLEUR.rand}; line-height: 1.5; }
  .ga-tabel tr:last-child td { border-bottom: none; }
  .ga-tabel th { background: ${KLEUR.zacht}; font-size: 12px; letter-spacing: .5px; text-transform: uppercase; color: ${KLEUR.grijs}; font-weight: 700; }
  .ga-tabel td { color: ${TEKST}; }
  .ga-tabel td:first-child { font-weight: 700; color: ${KLEUR.inkt}; }
  .ga-vb-rij { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px dashed ${KLEUR.rand}; font-size: 15px; color: ${TEKST}; }
  .ga-vb-rij span:last-child { font-weight: 700; color: ${KLEUR.inkt}; white-space: nowrap; font-variant-numeric: tabular-nums; }
  @media (max-width: 900px) {
    .ga-raster { grid-template-columns: 1fr; gap: 0; }
    .ga-inhoud-zij { display: none; }
    .ga-inhoud-gsm { display: block; }
    .ga-wrap { padding: 0 16px; }
    .ga-tekst h2 { font-size: 23px; }
    .ga-tekst p, .ga-tekst ul.ga-lijst li { font-size: 16.5px; }
    .ga-tabel thead { display: none; }
    .ga-tabel, .ga-tabel tbody, .ga-tabel tr { display: block; }
    .ga-tabel tr { padding: 12px 16px; border-bottom: 1px solid ${KLEUR.rand}; }
    .ga-tabel tr:last-child { border-bottom: none; }
    .ga-tabel td { display: block; border: none; padding: 3px 0; }
    .ga-tabel td:first-child { font-size: 16px; margin-bottom: 4px; }
    .ga-tabel td[data-label]::before { content: attr(data-label) ': '; font-weight: 700; color: ${KLEUR.inkt}; }
    .ga-cta-knoppen { flex-direction: column; align-items: stretch; }
    .ga-hoofd { padding-top: 20px !important; }
  }
`;

const ankerVan = (tekst) => tekst.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const datumNl = (iso) => new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));

function Voorbeeld({ vb }) {
  const kleur = (soort) => soort === 'min' ? '#b91c1c' : soort === 'plus' ? '#15803d' : undefined;
  return (
    <div className="p-kaart" style={{ overflow: 'hidden', margin: '6px 0 18px' }}>
      <div style={{ background: KLEUR.zacht, borderBottom: `1px solid ${KLEUR.rand}`, padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 15, fontWeight: 700 }}>
        <span aria-hidden="true">🧮</span>{vb.titel}
      </div>
      <div style={{ padding: '6px 18px 14px' }}>
        {vb.regels.map(([oms, bedrag, soort], i) => (
          <div key={i} className="ga-vb-rij"><span>{oms}</span><span style={{ color: kleur(soort) }}>{bedrag}</span></div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 12, marginTop: 2, borderTop: `2px solid ${KLEUR.inkt}`, fontSize: 16, fontWeight: 800 }}>
          <span>{vb.totaal[0]}</span><span style={{ color: KLEUR.accent, whiteSpace: 'nowrap' }}>{vb.totaal[1]}</span>
        </div>
        {vb.noot && <div style={{ fontSize: 13, color: KLEUR.grijs, marginTop: 10, lineHeight: 1.5 }}>{vb.noot}</div>}
      </div>
    </div>
  );
}

const Kader = ({ soort, children }) => {
  const s = soort === 'letop'
    ? { bg: '#fffbeb', rand: '#fde68a', icoon: '⚠️', titel: 'Let op' }
    : { bg: '#eff6ff', rand: '#bfdbfe', icoon: '💡', titel: 'Goed om te weten' };
  return (
    <div className="ga-kader" style={{ background: s.bg, border: `1px solid ${s.rand}`, color: KLEUR.inkt }}>
      <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1.3 }}>{s.icoon}</span>
      <div><strong>{s.titel}</strong>{children}</div>
    </div>
  );
};

export default function GidsArtikel({ artikel, onNaarApp }) {
  const klikApp = (modus) => (e) => { e.preventDefault(); onNaarApp && onNaarApp(modus); };
  const anderen = GIDS_ARTIKELS.filter(a => a.slug !== artikel.slug);
  const koppen = artikel.secties.map(s => ({ kop: s.kop, anker: ankerVan(s.kop) }));

  return (
    <div className="p-pagina">
      <style>{PUBLIEK_CSS + CSS}</style>
      <PubliekeKop actief="gids" onNaarApp={onNaarApp} />

      {/* ── KOP ── */}
      <header className="p-hero" style={{ padding: '44px 0 40px' }}>
        <div className="ga-wrap">
          <nav aria-label="Kruimelpad" style={{ fontSize: 14, color: KLEUR.grijs, marginBottom: 20 }}>
            <a href="/gids" style={{ color: KLEUR.grijs }}>Gids</a> <span aria-hidden="true" style={{ margin: '0 4px' }}>›</span> <span>{artikel.korteTitel}</span>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span className="p-icoon" style={{ background: artikel.kleur, width: 44, height: 44, fontSize: 22 }} aria-hidden="true">{artikel.icoon}</span>
            <span className="p-label">{artikel.categorie}</span>
          </div>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)', fontWeight: 800, letterSpacing: '-1.2px', lineHeight: 1.12, margin: 0, maxWidth: 820 }}>{artikel.titel}</h1>
          <p style={{ fontSize: 18, lineHeight: 1.65, color: KLEUR.grijs, margin: '16px 0 20px', maxWidth: 720 }}>{artikel.intro}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={chip}>⏱ {artikel.leestijd} min lezen</span>
            <span style={chip}>✓ Nagekeken op <time dateTime={artikel.nagekeken} style={{ marginLeft: 4 }}>{datumNl(artikel.nagekeken)}</time></span>
          </div>
        </div>
      </header>

      {/* ── INHOUD ── */}
      <main className="ga-wrap ga-hoofd" style={{ paddingTop: 40, paddingBottom: 56 }}>
        <div className="ga-raster">
          <aside className="ga-inhoud-zij" aria-label="Op deze pagina">
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: KLEUR.grijs, marginBottom: 10 }}>Op deze pagina</div>
            {koppen.map(k => <a key={k.anker} href={`#${k.anker}`}>{k.kop}</a>)}
          </aside>

          <article className="ga-tekst">
            {artikel.kort && (
              <div className="p-kaart" style={{ padding: '20px 22px', marginBottom: 28, borderLeft: `4px solid ${KLEUR.accent}`, background: '#fff' }}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>In het kort</div>
                {artikel.kort.map((k, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 16, lineHeight: 1.6, color: TEKST, marginTop: i ? 8 : 0 }}>
                    <span aria-hidden="true" style={{ color: '#16a34a', fontWeight: 800, marginTop: 1 }}>✓</span><span>{k}</span>
                  </div>
                ))}
              </div>
            )}

            <details className="ga-inhoud-gsm p-kaart" style={{ padding: '12px 16px', marginBottom: 28 }}>
              <summary style={{ fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Op deze pagina</summary>
              <div style={{ marginTop: 8 }}>{koppen.map(k => <a key={k.anker} href={`#${k.anker}`} style={{ display: 'block', padding: '6px 0', fontSize: 15, color: KLEUR.accent, textDecoration: 'none' }}>{k.kop}</a>)}</div>
            </details>

            {artikel.secties.map((s, i) => (
              <section key={i} style={{ marginBottom: 36 }}>
                <h2 id={koppen[i].anker}>{s.kop}</h2>
                {s.tabel && (
                  <table className="ga-tabel">
                    <thead><tr>{s.tabel.kop.map((k, j) => <th key={j} scope="col">{k}</th>)}</tr></thead>
                    <tbody>{s.tabel.rijen.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} data-label={k > 0 ? s.tabel.kop[k] : undefined}>{c}</td>)}</tr>)}</tbody>
                  </table>
                )}
                {(s.tekst || []).map((t, j) => <p key={j}>{t}</p>)}
                {s.lijst && <ul className="ga-lijst">{s.lijst.map((l, j) => <li key={j}>{l}</li>)}</ul>}
                {s.voorbeeld && <Voorbeeld vb={s.voorbeeld} />}
                {s.tip && <Kader soort="tip">{s.tip}</Kader>}
                {s.letOp && <Kader soort="letop">{s.letOp}</Kader>}
                {s.link && <p><a href={s.link.pad} style={{ color: KLEUR.accent, fontWeight: 700 }}>{s.link.tekst} →</a></p>}
              </section>
            ))}

            {artikel.rekenhulp && (
              <div className="p-kaart" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', margin: '8px 0 36px', background: KLEUR.zacht }}>
                <span className="p-icoon" style={{ background: KLEUR.blauwZacht }} aria-hidden="true">🧮</span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>Reken het zelf uit</div>
                  <div style={{ fontSize: 14, color: KLEUR.grijs }}>Gratis rekenhulp, zonder account.</div>
                </div>
                <a href={artikel.rekenhulp.pad} className="p-btn p-btn-primary">{artikel.rekenhulp.tekst} →</a>
              </div>
            )}

            <section style={{ paddingTop: 20, borderTop: `1px solid ${KLEUR.rand}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: KLEUR.grijs, marginBottom: 8 }}>Bronnen</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8, color: KLEUR.grijs }}>
                {artikel.bronnen.map(b => <li key={b.url}><a href={b.url} target="_blank" rel="noopener noreferrer" style={{ color: KLEUR.grijs }}>{b.titel}</a></li>)}
              </ul>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#94a3b8', marginTop: 16 }}>
                Dit artikel is algemene informatie en geen persoonlijk financieel of fiscaal advies. Regels kunnen wijzigen: controleer je situatie bij de FOD Financiën of een fiscalist.
              </p>
            </section>
          </article>
        </div>
      </main>

      {/* ── CTA ── */}
      <section style={{ background: `linear-gradient(135deg, ${KLEUR.accent} 0%, ${KLEUR.accentDonker} 100%)`, padding: '72px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: '#fff', letterSpacing: '-1px', margin: '0 0 14px' }}>Al je beleggingen en taksen op één plek</h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,.8)', maxWidth: 560, margin: '0 auto 28px', lineHeight: 1.6 }}>Kapitas volgt je aandelen, ETF's en crypto van elke broker en rekent de beurstaks, je dividendbelasting en je meerwaardebelasting voor je uit.</p>
        <div className="ga-cta-knoppen" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 420, margin: '0 auto' }}>
          <a href="/" onClick={klikApp('registreren')} className="p-btn p-btn-wit" style={{ fontSize: 16, padding: '14px 28px' }}>Start gratis →</a>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 16 }}>Volledig gratis · Geen betaalgegevens nodig</p>
      </section>

      {/* ── MEER UIT DE GIDS ── */}
      <section style={{ background: KLEUR.zacht, padding: '64px 0' }}>
        <div className="ga-wrap">
          <div className="p-label" style={{ marginBottom: 12 }}>Gids</div>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 800, letterSpacing: '-.8px', margin: '0 0 28px' }}>Meer uit de gids</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {anderen.map(a => (
              <a key={a.slug} href={`/gids/${a.slug}`} className="p-kaart" style={{ padding: 24 }}>
                <span className="p-icoon" style={{ background: a.kleur, marginBottom: 14 }} aria-hidden="true">{a.icoon}</span>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: KLEUR.grijs, marginBottom: 6 }}>{a.categorie} · {a.leestijd} min</div>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>{a.korteTitel}</div>
                <div style={{ fontSize: 14, color: KLEUR.grijs, lineHeight: 1.6 }}>{a.beschrijving}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <PubliekeVoet />
    </div>
  );
}

const chip = { display: 'inline-flex', alignItems: 'center', background: '#fff', border: `1px solid ${KLEUR.rand}`, borderRadius: 100, padding: '5px 12px', fontSize: 13, color: KLEUR.grijs, fontWeight: 500 };
