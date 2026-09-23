import React, { useState } from 'react';
import kapitasLogo from '../assets/kapitas-logo.png';

const ACCENT = '#1e3a8a';
const INKT = '#16181D';
const GRIJS = '#4A4D55';
const GRIJS_LICHT = '#5C5F66';
const RAND = '#E2DED4';
const CREME = '#F5F3EE';

const IconAandeel = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);
const IconEtf = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>
);
const IconSpreiding = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 3v9l6.5 6.5"></path><path d="M12 12H3"></path></svg>
);
const IconVink = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
);

const BASISBEGRIPPEN = [
  { icon: IconAandeel, titel: 'Aandeel', tekst: "Een klein stukje eigendom van één bedrijf. Doet het bedrijf het goed, dan stijgt je aandeel meestal mee, en soms krijg je een deel van de winst als dividend." },
  { icon: IconEtf, titel: 'ETF', tekst: 'Een mandje met honderden of duizenden aandelen tegelijk, dat je in één aankoop koopt. Goedkoop en ideaal om mee te starten.' },
  { icon: IconSpreiding, titel: 'Spreiding', tekst: 'Niet al je eieren in één mand. Wie over veel bedrijven, sectoren en landen spreidt, voelt de klap van één slecht bedrijf nauwelijks.' },
];

const KOSTEN = [
  { wat: 'Beurstaks (TOB)', hoeveel: "0,35% · ETF's 0,12–1,32%", wanneer: 'Bij elke aan- en verkoop. Hoeveel hangt af van het soort ETF en waar het geregistreerd is.' },
  { wat: 'Roerende voorheffing', hoeveel: '30%', wanneer: 'Op ontvangen dividenden. Een eerste schijf dividenden kan je via je belastingaangifte terugvragen.' },
  { wat: 'Meerwaardebelasting', hoeveel: '10%', wanneer: 'Op winst bij verkoop, sinds 2026. De eerste €10.000 meerwaarde per jaar is vrijgesteld.' },
  { wat: 'Reynders-taks', hoeveel: '30%', wanneer: 'Alleen bij verkoop van fondsen of ETF\'s die voor meer dan 10% in obligaties beleggen.' },
  { wat: 'Brokerkosten', hoeveel: 'Verschilt', wanneer: 'Per aankoop, soms ook een jaarlijks bewaarloon. Vergelijk dit vóór je een broker kiest.' },
];

const BROKER_PUNTEN = [
  { titel: 'Belgisch of buitenlands?', tekst: 'Een Belgische broker regelt de taksen voor jou. Bij een buitenlandse doe je de aangifte vaak zelf.' },
  { titel: 'Kosten per transactie', tekst: 'Leg je elke maand een klein bedrag in, dan wegen vaste kosten per aankoop zwaar door.' },
  { titel: "Aanbod ETF's", tekst: "Kan je er de brede, goedkope wereld-ETF's kopen die je zoekt?" },
  { titel: 'Beleggersbescherming', tekst: 'Staat de broker onder toezicht, en zijn je effecten beschermd als hij failliet gaat?' },
];

const STAPPEN = [
  { titel: 'Buffer eerst', tekst: 'Zet eerst enkele maanden aan uitgaven opzij op je spaarrekening.' },
  { titel: 'Kies je bedrag', tekst: 'Beleg enkel geld dat je minstens vijf à tien jaar kan missen.' },
  { titel: 'Open een broker', tekst: 'Gebruik de checklist hierboven en open online een rekening.' },
  { titel: 'Koop een brede ETF', tekst: 'Eén wereldwijd gespreide ETF is voor de meeste starters genoeg.' },
  { titel: 'Volhouden', tekst: 'Elke maand bijleggen en niet panikeren als de beurs even zakt.' },
];

const eur = (x) => '€' + Math.round(x).toLocaleString('nl-BE');

function RekenKnop({ actief, children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      height: 48, padding: '0 18px', borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      background: actief ? INKT : '#FFFFFF', color: actief ? '#FFFFFF' : INKT, border: `1px solid ${actief ? INKT : '#CFCAC0'}`,
    }}>{children}</button>
  );
}

export default function Gids({ onTerug, onNaarApp }) {
  const [bedrag, setBedrag] = useState(100);
  const [jaar, setJaar] = useState(20);

  const r = 0.07 / 12, n = jaar * 12;
  const eindwaarde = bedrag * (Math.pow(1 + r, n) - 1) / r;
  const ingelegd = bedrag * n;
  const groei = eindwaarde - ingelegd;
  const pctIngelegd = Math.max(4, Math.round((ingelegd / eindwaarde) * 100));

  return (
    <div style={{ background: CREME, color: INKT, fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: '100vh' }}>
      {/* NAV */}
      <header className="gids-header" style={{ height: 72, boxSizing: 'border-box', padding: '0 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${RAND}`, background: CREME, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: onTerug ? 'pointer' : 'default' }} onClick={onTerug}>
          <img src={kapitasLogo} alt="Kapitas" style={{ height: 28, width: 'auto' }} />
        </div>
        {onTerug ? (
          <span onClick={onTerug} style={{ fontSize: 14, fontWeight: 600, color: GRIJS, cursor: 'pointer' }}>← Terug naar Kapitas</span>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: GRIJS }}>Gids voor beginners</span>
        )}
      </header>

      {/* HERO */}
      <section className="gids-sectie" style={{ padding: '88px 80px 72px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT }}>Gids voor beginners · ± 10 minuten</div>
        <h1 className="gids-h1" style={{ margin: 0, fontSize: 76, lineHeight: 1.02, letterSpacing: '-0.035em', fontWeight: 700, maxWidth: 900 }}>Beginnen met beleggen, zonder het jargon.</h1>
        <p style={{ margin: 0, fontSize: 21, lineHeight: 1.5, color: GRIJS, maxWidth: 680 }}>Wat aandelen en ETF's zijn, wat het je in België echt kost, en hoe je in vijf stappen je eerste aankoop doet.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[['#basis', '1 · De basis'], ['#tijd', '2 · De kracht van tijd'], ['#kosten', '3 · Kosten & taksen'], ['#broker', '4 · Een broker kiezen'], ['#stappen', '5 · Stappenplan']].map(([href, label]) => (
            <a key={href} href={href} style={{ padding: '10px 16px', borderRadius: 999, border: '1px solid #CFCAC0', fontSize: 14, fontWeight: 500, color: INKT, textDecoration: 'none', background: '#FFFFFF' }}>{label}</a>
          ))}
        </div>
      </section>

      {/* 1. BASIS */}
      <section id="basis" className="gids-sectie" style={{ padding: '64px 80px', display: 'flex', flexDirection: 'column', gap: 36, borderTop: `1px solid ${RAND}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: ACCENT }}>01</span>
          <h2 className="gids-h2" style={{ margin: 0, fontSize: 40, letterSpacing: '-0.025em', fontWeight: 700 }}>De basis in drie begrippen</h2>
        </div>
        <div className="gids-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20 }}>
          {BASISBEGRIPPEN.map(({ icon: Icon, titel, tekst }) => (
            <div key={titel} style={{ background: '#FFFFFF', border: `1px solid ${RAND}`, borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Icon />
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{titel}</h3>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: GRIJS }}>{tekst}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. TIJD / REKENMACHINE */}
      <section id="tijd" className="gids-sectie" style={{ padding: '64px 80px', display: 'flex', flexDirection: 'column', gap: 36, borderTop: `1px solid ${RAND}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: ACCENT }}>02</span>
          <h2 className="gids-h2" style={{ margin: 0, fontSize: 40, letterSpacing: '-0.025em', fontWeight: 700 }}>Wat tijd met je geld doet</h2>
        </div>
        <div className="gids-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
          <div style={{ background: '#FFFFFF', border: `1px solid ${RAND}`, borderRadius: 16, padding: 36, display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Ik leg elke maand in</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[50, 100, 250, 500].map(b => <RekenKnop key={b} actief={b === bedrag} onClick={() => setBedrag(b)}>€{b}</RekenKnop>)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Gedurende</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[10, 20, 30].map(j => <RekenKnop key={j} actief={j === jaar} onClick={() => setJaar(j)}>{j} jaar</RekenKnop>)}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: GRIJS_LICHT }}>Voorbeeld bij een verondersteld gemiddeld rendement van 7% per jaar. Dat is geen garantie: sommige jaren daalt je belegging, andere jaren stijgt ze sterk.</p>
          </div>
          <div style={{ background: INKT, color: '#FFFFFF', borderRadius: 16, padding: 36, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B9BCC4' }}>Na {jaar} jaar heb je ongeveer</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 56, fontWeight: 500, letterSpacing: '-0.03em' }}>{eur(eindwaarde)}</div>
            <div style={{ height: 14, borderRadius: 7, background: '#7FD1A8', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${pctIngelegd}%`, height: '100%', background: CREME }} />
            </div>
            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#B9BCC4' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CREME }} />Zelf ingelegd</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22 }}>{eur(ingelegd)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#B9BCC4' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#7FD1A8' }} />Rendement op rendement</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, color: '#7FD1A8' }}>{eur(groei)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. KOSTEN */}
      <section id="kosten" className="gids-sectie" style={{ padding: '64px 80px', display: 'flex', flexDirection: 'column', gap: 36, borderTop: `1px solid ${RAND}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: ACCENT }}>03</span>
            <h2 className="gids-h2" style={{ margin: 0, fontSize: 40, letterSpacing: '-0.025em', fontWeight: 700 }}>Wat het je in België kost</h2>
          </div>
          <span style={{ fontSize: 14, color: GRIJS_LICHT }}>Laatst nagekeken: september 2026</span>
        </div>
        <div style={{ background: '#FFFFFF', border: `1px solid ${RAND}`, borderRadius: 16, overflow: 'hidden' }}>
          <div className="gids-kosten-rij" style={{ display: 'grid', gridTemplateColumns: '260px 220px minmax(0, 1fr)', gap: 24, padding: '18px 32px', background: '#EEEBE3', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: GRIJS }}>
            <div>Wat</div><div>Hoeveel</div><div>Wanneer</div>
          </div>
          {KOSTEN.map((k, i) => (
            <div key={k.wat} className="gids-kosten-rij" style={{ display: 'grid', gridTemplateColumns: '260px 220px minmax(0, 1fr)', gap: 24, padding: '24px 32px', borderTop: `1px solid ${RAND}`, fontSize: 16, alignItems: 'start' }}>
              <div style={{ fontWeight: 700 }}>{k.wat}</div>
              <div style={{ fontFamily: "'DM Mono', monospace" }}>{k.hoeveel}</div>
              <div style={{ color: GRIJS, lineHeight: 1.55 }}>{k.wanneer}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. BROKER */}
      <section id="broker" className="gids-sectie" style={{ padding: '64px 80px', display: 'flex', flexDirection: 'column', gap: 36, borderTop: `1px solid ${RAND}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: ACCENT }}>04</span>
          <h2 className="gids-h2" style={{ margin: 0, fontSize: 40, letterSpacing: '-0.025em', fontWeight: 700 }}>Waarop let je bij een broker?</h2>
        </div>
        <div className="gids-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
          {BROKER_PUNTEN.map(({ titel, tekst }) => (
            <div key={titel} style={{ background: '#FFFFFF', border: `1px solid ${RAND}`, borderRadius: 16, padding: '28px 32px', display: 'flex', gap: 18, alignItems: 'flex-start' }}>
              <IconVink />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{titel}</div>
                <div style={{ fontSize: 16, lineHeight: 1.55, color: GRIJS }}>{tekst}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. STAPPEN */}
      <section id="stappen" className="gids-sectie" style={{ padding: '64px 80px 80px', display: 'flex', flexDirection: 'column', gap: 36, borderTop: `1px solid ${RAND}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: ACCENT }}>05</span>
          <h2 className="gids-h2" style={{ margin: 0, fontSize: 40, letterSpacing: '-0.025em', fontWeight: 700 }}>Je eerste aankoop in vijf stappen</h2>
        </div>
        <div className="gids-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 16 }}>
          {STAPPEN.map(({ titel, tekst }, i) => (
            <div key={titel} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 20, borderTop: `3px solid ${INKT}` }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, color: ACCENT }}>{i + 1}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{titel}</div>
              <div style={{ fontSize: 15, lineHeight: 1.55, color: GRIJS }}>{tekst}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA + DISCLAIMER */}
      <section className="gids-sectie" style={{ background: ACCENT, color: '#FFFFFF', padding: 80, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <h2 className="gids-h2-cta" style={{ margin: 0, fontSize: 52, lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 700, maxWidth: 760 }}>
          {onNaarApp ? <>Eerste aankoop gedaan? Volg ze op in Kapitas.</> : <>Klaar voor je volgende aankoop?</>}
        </h2>
        <p style={{ margin: 0, fontSize: 19, lineHeight: 1.5, color: '#D6E7DF', maxWidth: 620 }}>Zie in één oogopslag je rendement, dividenden en wat je aan taksen betaalt, helemaal afgestemd op België.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {onNaarApp ? (
            <button onClick={() => onNaarApp('registreren')} style={{ height: 52, padding: '0 26px', display: 'flex', alignItems: 'center', borderRadius: 12, background: '#FFFFFF', color: INKT, fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Gratis account maken</button>
          ) : (
            <button onClick={onTerug} style={{ height: 52, padding: '0 26px', display: 'flex', alignItems: 'center', borderRadius: 12, background: '#FFFFFF', color: INKT, fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Naar je portefeuille</button>
          )}
          <a href="https://www.wikifin.be" target="_blank" rel="noopener noreferrer" style={{ height: 52, padding: '0 26px', display: 'flex', alignItems: 'center', borderRadius: 12, border: '1px solid #7FB8A0', color: '#FFFFFF', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>Meer lezen op Wikifin.be</a>
        </div>
        <p style={{ margin: '40px 0 0', paddingTop: 24, borderTop: '1px solid #3F7A65', fontSize: 13, lineHeight: 1.6, color: '#C5DDD2', maxWidth: 900 }}>
          Deze gids is algemene informatie en geen persoonlijk financieel advies. Beleggen houdt risico's in: je kan (een deel van) je inleg verliezen. Rendementen uit het verleden bieden geen garantie voor de toekomst.
        </p>
      </section>
    </div>
  );
}
