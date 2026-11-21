// Gedeelde kopbalk, voettekst en stijl voor de publieke pagina's (Gids,
// artikels, rekenhulpen), in dezelfde stijl als de startpagina (Landing.jsx).
import React, { useState } from 'react';
import { GIDS_ARTIKELS } from '../data/gidsArtikels';

export const KLEUR = {
  accent: '#1e3a8a', accentDonker: '#14275e', inkt: '#0f172a', grijs: '#64748b', rand: '#e2e8f0',
  zacht: '#f8fafc', blauwZacht: '#eef1f8',
};

const REKENHULPEN = {
  nl: [['📈', 'Meerwaardebelasting', '/meerwaardebelasting-berekenen'], ['🧾', 'Beurstaks (TOB)', '/beurstaks-berekenen'], ['💶', 'Dividendbelasting', '/dividendbelasting-berekenen']],
  fr: [['📈', 'Taxe sur les plus-values', '/fr/calcul-taxe-plus-values'], ['🧾', 'Taxe boursière (TOB)', '/fr/calcul-taxe-boursiere'], ['💶', 'Précompte sur dividendes', '/fr/calcul-precompte-dividendes']],
};
const LABELS = {
  nl: { features: 'Features', rekenhulpen: 'Rekenhulpen', gids: 'Leren beleggen', inloggen: 'Inloggen', start: 'Start gratis', menu: 'Menu' },
  fr: { features: 'Fonctionnalités', rekenhulpen: 'Calculateurs', gids: 'Guide (NL)', inloggen: 'Se connecter', start: 'Commencer', menu: 'Menu' },
};

// Gedeelde CSS: knoppen, labels en kaartjes zoals op de startpagina
export const PUBLIEK_CSS = `
  .p-pagina { font-family: 'DM Sans', sans-serif; color: ${KLEUR.inkt}; background: #fff; line-height: 1.6; }
  .p-pagina *, .p-pagina *::before, .p-pagina *::after { box-sizing: border-box; }
  .p-btn { display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 22px;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all .2s;white-space:nowrap; }
  .p-btn-primary { background:${KLEUR.accent};color:#fff !important; }
  .p-btn-primary:hover { background:${KLEUR.accentDonker};transform:translateY(-2px);box-shadow:0 8px 20px rgba(30,58,138,.35); }
  .p-btn-outline { background:#fff;color:${KLEUR.accent} !important;border:2px solid ${KLEUR.accent}; }
  .p-btn-outline:hover { background:${KLEUR.accent};color:#fff !important; }
  .p-btn-wit { background:#fff;color:${KLEUR.accent} !important; }
  .p-btn-wit:hover { background:${KLEUR.zacht};transform:translateY(-1px); }
  .p-label { display:inline-block;background:${KLEUR.blauwZacht};color:${KLEUR.accent};padding:4px 14px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase; }
  .p-kaart { background:#fff;border:1px solid ${KLEUR.rand};border-radius:12px;transition:box-shadow .2s,transform .2s,border-color .2s; }
  a.p-kaart { text-decoration:none;color:${KLEUR.inkt};display:block; }
  a.p-kaart:hover { box-shadow:0 20px 60px rgba(30,58,138,.12);transform:translateY(-4px);border-color:#c7d2fe; }
  .p-icoon { width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0; }
  .p-hero { background:linear-gradient(180deg,${KLEUR.blauwZacht} 0%,${KLEUR.zacht} 60%,#fff 100%); }

  .p-nav { position:sticky;top:0;z-index:100;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid ${KLEUR.rand};padding:env(safe-area-inset-top,0px) 24px 0;height:calc(64px + env(safe-area-inset-top,0px));display:flex;align-items:center;justify-content:space-between;gap:16px; }
  .p-nav-merk { font-size:22px;font-weight:800;letter-spacing:-.5px;color:${KLEUR.accent};text-decoration:none; }
  .p-nav-links { display:flex;gap:32px;list-style:none;align-items:center;margin:0;padding:0; }
  .p-nav-link { position:relative;text-decoration:none;color:${KLEUR.grijs};font-size:14px;font-weight:500;background:none;border:none;padding:0;cursor:pointer;font-family:inherit;transition:color .2s; }
  .p-nav-link:hover, .p-nav-link[aria-current] { color:${KLEUR.accent}; }
  .p-nav-link::after { content:'';position:absolute;left:0;right:0;bottom:-4px;height:2px;background:${KLEUR.accent};border-radius:2px;transform:scaleX(0);transform-origin:left;transition:transform .25s; }
  .p-nav-link:hover::after, .p-nav-link[aria-current]::after { transform:scaleX(1); }
  .p-dropdown { position:relative; }
  .p-dropdown-menu { position:absolute;top:100%;left:50%;transform:translateX(-50%);padding-top:14px;opacity:0;visibility:hidden;transition:opacity .15s,visibility .15s; }
  .p-dropdown:hover .p-dropdown-menu, .p-dropdown:focus-within .p-dropdown-menu { opacity:1;visibility:visible; }
  .p-dropdown-binnen { background:#fff;border:1px solid ${KLEUR.rand};border-radius:12px;box-shadow:0 20px 50px rgba(15,23,42,.12);padding:8px;min-width:250px; }
  .p-dropdown-item { display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;text-decoration:none;color:${KLEUR.inkt};font-size:14px;font-weight:600; }
  .p-dropdown-item:hover { background:${KLEUR.zacht}; }
  .p-mobiel { display:none; }
  .p-voet a { color:rgba(255,255,255,.55);text-decoration:none; }
  .p-voet a:hover { color:#fff; }
  @media (max-width: 860px) {
    .p-nav-links, .p-verberg-gsm { display:none !important; }
    .p-mobiel { display:inline-flex; }
    .p-nav { padding-left:16px;padding-right:16px; }
  }
  @media (max-width: 480px) {
    .p-nav .p-btn { font-size:13px;padding:9px 13px; }
  }
`;

export function PubliekeKop({ actief, taal = 'nl', taalLink, onNaarApp }) {
  const [open, setOpen] = useState(false);
  const t = LABELS[taal] || LABELS.nl;
  const app = (modus) => (e) => { e.preventDefault(); setOpen(false); onNaarApp && onNaarApp(modus); };
  return (
    <>
      <nav className="p-nav" aria-label="Hoofdmenu">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" className="p-nav-merk">Kapitas</a>
          <button type="button" className="p-mobiel" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={t.menu}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, fontSize: 22, color: KLEUR.accent, alignItems: 'center' }}>{open ? '✕' : '☰'}</button>
        </div>
        <ul className="p-nav-links">
          <li><a href="/#features" className="p-nav-link">{t.features}</a></li>
          <li className="p-dropdown">
            <a href={REKENHULPEN[taal][0][2]} className="p-nav-link" aria-current={actief === 'rekenhulp' ? 'page' : undefined}>{t.rekenhulpen} ▾</a>
            <div className="p-dropdown-menu"><div className="p-dropdown-binnen">
              {REKENHULPEN[taal].map(([icoon, naam, pad]) => (
                <a key={pad} href={pad} className="p-dropdown-item"><span className="p-icoon" style={{ width: 34, height: 34, fontSize: 17, borderRadius: 9, background: KLEUR.blauwZacht }}>{icoon}</span>{naam}</a>
              ))}
            </div></div>
          </li>
          <li><a href="/gids" className="p-nav-link" aria-current={actief === 'gids' ? 'page' : undefined}>{t.gids}</a></li>
        </ul>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {taalLink && <a href={taalLink.pad} hrefLang={taalLink.hreflang} title={taalLink.titel} className="p-nav-link" style={{ fontWeight: 700 }}>{taalLink.label}</a>}
          <a href="/" onClick={app('login')} className="p-nav-link p-verberg-gsm">{t.inloggen}</a>
          <a href="/" onClick={app('registreren')} className="p-btn p-btn-primary" style={{ fontSize: 14, padding: '9px 18px' }}>{t.start} →</a>
        </div>
      </nav>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 'calc(64px + env(safe-area-inset-top, 0px)) 0 0 0', zIndex: 98, background: 'rgba(15,23,42,.4)' }} />
          <div style={{ position: 'fixed', top: 'calc(64px + env(safe-area-inset-top, 0px))', left: 0, right: 0, zIndex: 99, background: '#fff', borderBottom: `1px solid ${KLEUR.rand}`, padding: '8px 20px 16px', boxShadow: '0 12px 32px rgba(0,0,0,.1)' }}>
            <a href="/#features" style={mobielLink}>{t.features}</a>
            <div style={{ fontSize: 12, fontWeight: 700, color: KLEUR.grijs, textTransform: 'uppercase', letterSpacing: '.5px', padding: '14px 4px 4px' }}>{t.rekenhulpen}</div>
            {REKENHULPEN[taal].map(([icoon, naam, pad]) => <a key={pad} href={pad} style={mobielLink}>{icoon}&nbsp; {naam}</a>)}
            <a href="/gids" style={mobielLink}>{t.gids}</a>
            <a href="/" onClick={app('login')} style={{ ...mobielLink, borderBottom: 'none' }}>{t.inloggen}</a>
          </div>
        </>
      )}
    </>
  );
}
const mobielLink = { display: 'block', textDecoration: 'none', color: KLEUR.inkt, fontSize: 15, fontWeight: 500, padding: '12px 4px', borderBottom: '1px solid #f1f5f9' };

export function PubliekeVoet({ taal = 'nl' }) {
  const fr = taal === 'fr';
  const kolommen = [
    [fr ? 'Calculateurs' : 'Rekenhulpen', REKENHULPEN[taal].map(([, naam, pad]) => [naam, pad])],
    ['Gids', [['Gids voor beginners', '/gids'], ...GIDS_ARTIKELS.map(a => [a.korteTitel || a.titel, `/gids/${a.slug}`])]],
    ['Info', [['Privacybeleid', '/privacybeleid'], ['Algemene voorwaarden', '/voorwaarden'], ['Disclaimer', '/disclaimer'], ['Contact', 'mailto:hello@kapitas.be']]],
  ];
  return (
    <footer className="p-voet" style={{ background: KLEUR.inkt, color: 'rgba(255,255,255,.5)', padding: '48px 24px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 36, marginBottom: 36 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 10 }}>Kapitas</div>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>{fr ? 'Le tableau de bord pour les investisseurs belges : portefeuille, ETF et impôts au même endroit.' : 'Het beleggingsdashboard voor Belgische beleggers. Portfolio, ETF\'s en belastingen op één plek.'}</div>
        </div>
        {kolommen.map(([titel, links]) => (
          <div key={titel}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{titel}</div>
            {links.map(([naam, pad]) => <div key={pad} style={{ fontSize: 13, marginBottom: 8 }}><a href={pad}>{naam}</a></div>)}
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 1100, margin: '0 auto', borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 22, fontSize: 12, lineHeight: 1.6 }}>
        © 2026 Kapitas. {fr ? 'Kapitas ne fournit pas de conseil en investissement ni de conseil fiscal.' : 'Kapitas biedt geen beleggings- of fiscaal advies.'}
      </div>
    </footer>
  );
}
