import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Info } from 'lucide-react';

const ACCENT = '#6366f1';
const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)',
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none',
  color: 'var(--text-primary)', background: 'var(--bg-white)', boxSizing: 'border-box'
};

function Toggle({ aan, onChange }) {
  return (
    <div onClick={() => onChange(!aan)} style={{
      width: 44, height: 24, borderRadius: 12, background: aan ? ACCENT : 'var(--border)',
      cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0
    }}>
      <div style={{
        position: 'absolute', top: 3, left: aan ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
      }} />
    </div>
  );
}

function SelectInput({ value, onChange, children, style }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        ...inputStyle, appearance: 'none', paddingRight: 36, cursor: 'pointer'
      }}>
        {children}
      </select>
      <div style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 11
      }}>▼</div>
    </div>
  );
}

// Genereer tijdstippen van 22:00 tot 06:00 (beurzen gesloten)
const TIJDSTIPPEN = [
  '22:00', '22:30', '23:00', '23:30',
  '00:00', '00:30', '01:00', '01:30',
  '02:00', '02:30', '03:00', '03:30',
  '04:00', '04:30', '05:00', '05:30', '06:00'
];

export default function Instellingen() {
  const { gebruiker, setGebruiker, beleggingen, koersen } = useApp();
  const [actieveTab, setActieveTab] = useState('portfolio');

  // Portfolio tab
  const [voornaam, setVoornaam] = useState(gebruiker.voornaam);
  const [achternaam, setAchternaam] = useState(gebruiker.achternaam);
  const [portfolioOpgeslagen, setPortfolioOpgeslagen] = useState(false);

  // E-mailupdates tab
  const [emailInstellingen, setEmailInstellingen] = useState(() => {
    try {
      const saved = localStorage.getItem('matico_email_instellingen');
      return saved ? JSON.parse(saved) : {
        actief: false,
        email: '',
        frequentie: 'dagelijks',
        tijdstip: '06:00',
        weekend: false,
        perPositie: false,
      };
    } catch { return { actief: false, email: '', frequentie: 'dagelijks', tijdstip: '06:00', weekend: false, perPositie: false }; }
  });
  const [emailOpgeslagen, setEmailOpgeslagen] = useState(false);
  const [testVerstuurd, setTestVerstuurd] = useState(false);
  const [emailFout, setEmailFout] = useState('');

  const slaPortfolioOp = () => {
    setGebruiker({ voornaam, achternaam });
    setPortfolioOpgeslagen(true);
    setTimeout(() => setPortfolioOpgeslagen(false), 2000);
  };

  const updateEmail = (key, val) => setEmailInstellingen(prev => ({ ...prev, [key]: val }));

  const slaEmailOp = () => {
    if (emailInstellingen.actief && !emailInstellingen.email.includes('@')) {
      setEmailFout('Vul een geldig e-mailadres in.');
      return;
    }
    setEmailFout('');
    localStorage.setItem('matico_email_instellingen', JSON.stringify(emailInstellingen));
    setEmailOpgeslagen(true);
    setTimeout(() => setEmailOpgeslagen(false), 2000);
  };

  const bouwEmailPayload = (testmail = false) => {
    const f = (b) => (b.munt || 'EUR') === 'USD' ? 0.865 : 1;
    return {
      naar: emailInstellingen.email,
      gebruiker,
      testmail,
      datum: new Date().toISOString(),
      totaalWaarde,
      dagWinst: dagWinstTotaal,
      dagPct,
      beleggingen: beleggingen.map(b => {
        const k = koersen[b.symbol];
        const factor = f(b);
        const waarde = (k ? k.c : b.kostprijs) * b.aantal * factor;
        const dagV = k ? (k.c - k.pc) * b.aantal * factor : 0;
        const dagVPct = k && k.pc > 0 ? ((k.c - k.pc) / k.pc) * 100 : 0;
        return { symbol: b.symbol, naam: b.naam, logo: b.logo || '', waarde, dagWinst: dagV, dagPct: dagVPct };
      }),
    };
  };

  const stuurTestmail = async () => {
    if (!emailInstellingen.email.includes('@')) {
      setEmailFout('Vul eerst een geldig e-mailadres in.');
      return;
    }
    setEmailFout('');
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bouwEmailPayload(true)),
      });
      const data = await res.json();
      if (data.success) {
        setTestVerstuurd(true);
        setTimeout(() => setTestVerstuurd(false), 4000);
      } else {
        // Geef duidelijke foutmelding
        if (data.error?.includes('not verified') || data.error?.includes('domain')) {
          setEmailFout('Fout: je e-mailadres moet hetzelfde zijn als je Resend-account e-mail. Met onboarding@resend.dev kan Resend alleen naar je eigen account-adres sturen.');
        } else if (data.error?.includes('API key') || data.error?.includes('key')) {
          setEmailFout('Fout: RESEND_API_KEY niet gevonden. Voeg deze toe in Vercel → Settings → Environment Variables en herstart de deployment.');
        } else {
          setEmailFout(`Fout: ${data.error || 'Onbekende fout'}`);
        }
      }
    } catch (e) {
      setEmailFout('Verbindingsfout — controleer of de app correct gedeployd is en RESEND_API_KEY aanwezig is in Vercel.');
    }
  };

  // Automatisch versturen op het ingestelde tijdstip
  useEffect(() => {
    if (!emailInstellingen.actief || !emailInstellingen.email.includes('@')) return;

    const checkTijdstip = () => {
      const nu = new Date();
      const dag = nu.getDay(); // 0=zo, 6=za
      const isWeekend = dag === 0 || dag === 6;
      if (isWeekend && !emailInstellingen.weekend) return;

      const [uur, min] = emailInstellingen.tijdstip.split(':').map(Number);
      const nuUur = nu.getHours();
      const nuMin = nu.getMinutes();

      // Stuur als het tijdstip net gepasseerd is (binnen 1 minuut)
      if (nuUur === uur && nuMin === min) {
        // Check of we vandaag al verstuurd hebben
        const cacheKey = `matico_email_verstuurd_${nu.toDateString()}`;
        if (!localStorage.getItem(cacheKey)) {
          localStorage.setItem(cacheKey, '1');
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bouwEmailPayload(false)),
          }).catch(console.error);
        }
      }
    };

    const interval = setInterval(checkTijdstip, 60000); // elke minuut checken
    return () => clearInterval(interval);
  }, [emailInstellingen, beleggingen, koersen]);

  // Voorbeeld e-mail preview data
  const nu = new Date();
  const dagNamen = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const maandNamen = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const datumLabel = `${dagNamen[nu.getDay()]} ${nu.getDate()} ${maandNamen[nu.getMonth()]}`;

  const totaalWaarde = beleggingen.reduce((s, b) => {
    const k = koersen[b.symbol];
    const f = (b.munt || 'EUR') === 'USD' ? 0.865 : 1;
    return s + (k ? k.c : b.kostprijs) * b.aantal * f;
  }, 0);

  const dagWinstTotaal = beleggingen.reduce((s, b) => {
    const k = koersen[b.symbol];
    if (!k) return s;
    const f = (b.munt || 'EUR') === 'USD' ? 0.865 : 1;
    return s + (k.c - k.pc) * b.aantal * f;
  }, 0);

  const dagPct = totaalWaarde > 0 ? (dagWinstTotaal / (totaalWaarde - dagWinstTotaal)) * 100 : 0;

  return (
    <div style={{ padding: '0 0 60px' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1>Instellingen</h1>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 32px', borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {[['portfolio', 'Portfolio'], ['email', 'E-mailupdates']].map(([id, label]) => (
            <button key={id} onClick={() => setActieveTab(id)} style={{
              padding: '12px 20px', border: 'none', background: 'transparent',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
              color: actieveTab === id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: actieveTab === id ? `2px solid ${ACCENT}` : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 32px' }}>

        {/* ── Portfolio tab ── */}
        {actieveTab === 'portfolio' && (
          <div style={{ maxWidth: 500 }}>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>Persoonlijke gegevens</h3>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Voornaam</label>
                <input style={inputStyle} value={voornaam} onChange={e => setVoornaam(e.target.value)} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Achternaam</label>
                <input style={inputStyle} value={achternaam} onChange={e => setAchternaam(e.target.value)} />
              </div>
              <button onClick={slaPortfolioOp} style={{
                padding: '10px 20px', background: ACCENT, color: 'white', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600
              }}>
                {portfolioOpgeslagen ? '✓ Opgeslagen!' : 'Opslaan'}
              </button>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Over Matico</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Matico is je persoonlijke portfolio tracker. Real-time koersen via Finnhub.io, AI-analyses via Claude (Anthropic). Alle data wordt lokaal in je browser opgeslagen.
              </p>
              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Versie 1.0.0 · © 2026 Matico
              </div>
            </div>
          </div>
        )}

        {/* ── E-mailupdates tab ── */}
        {actieveTab === 'email' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'flex-start' }}>

            {/* Instellingen */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>E-mail</h3>

              {/* Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Ontvang e-mail updates</span>
                <Toggle aan={emailInstellingen.actief} onChange={v => updateEmail('actief', v)} />
              </div>

              <div style={{ opacity: emailInstellingen.actief ? 1 : 0.5, pointerEvents: emailInstellingen.actief ? 'all' : 'none', transition: 'opacity 0.2s' }}>

                {/* E-mailadres */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>E-mailadres</label>
                  <input
                    type="email" placeholder="jouw@email.com"
                    value={emailInstellingen.email}
                    onChange={e => updateEmail('email', e.target.value)}
                    style={inputStyle}
                  />
                </div>

                {/* Frequentie */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Frequentie</label>
                  <SelectInput value={emailInstellingen.frequentie} onChange={v => updateEmail('frequentie', v)}>
                    <option value="dagelijks">Dagelijks</option>
                    <option value="wekelijks">Wekelijks (elke maandag)</option>
                  </SelectInput>
                </div>

                {/* Tijdstip */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Tijdstip
                    <span title="Enkel tijdstippen tussen 22:00 en 06:00 — wanneer de belangrijkste beurzen gesloten zijn."
                      style={{ cursor: 'help', color: 'var(--text-muted)' }}>
                      <Info size={13} />
                    </span>
                  </label>
                  <SelectInput value={emailInstellingen.tijdstip} onChange={v => updateEmail('tijdstip', v)}>
                    {TIJDSTIPPEN.map(t => <option key={t} value={t}>{t}</option>)}
                  </SelectInput>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    Tijdstippen tussen 22:00 en 06:00 — beurzen zijn dan gesloten.
                  </div>
                </div>

                {/* Weekend toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Ook in het weekend versturen</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Beurzen zijn gesloten op zaterdag en zondag, dus updates tonen dan geen koersbeweging.</div>
                  </div>
                  <Toggle aan={emailInstellingen.weekend} onChange={v => updateEmail('weekend', v)} />
                </div>

                {/* Per positie toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Toon elke positie afzonderlijk</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Splits meerdere aankopen van dezelfde belegging op in aparte regels.</div>
                  </div>
                  <Toggle aan={emailInstellingen.perPositie} onChange={v => updateEmail('perPositie', v)} />
                </div>
              </div>

              {emailFout && (
                <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>
                  {emailFout}
                </div>
              )}

              <button onClick={slaEmailOp} style={{
                width: '100%', padding: '11px', background: ACCENT, color: 'white', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, marginBottom: 10
              }}>
                {emailOpgeslagen ? '✓ Opgeslagen!' : 'Opslaan'}
              </button>

              <button onClick={stuurTestmail} style={{
                width: '100%', padding: '10px', background: 'transparent', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}>
                {testVerstuurd ? '✓ Testmail verstuurd!' : '✈ Testmail versturen'}
              </button>
            </div>

            {/* Preview e-mail */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)' }}>
                Voorbeeld: Je {emailInstellingen.frequentie === 'dagelijks' ? 'dagelijkse' : 'wekelijkse'} portfolio update
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>Van:</span> Matico &nbsp;·&nbsp;
                <span style={{ fontWeight: 600 }}>Aan:</span> {emailInstellingen.email || 'jouw@email.com'}
              </div>

              {/* Email card preview */}
              <div style={{
                border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
                background: 'white', boxShadow: 'var(--shadow-md)'
              }}>
                {/* Header */}
                <div style={{ background: '#f8f9ff', padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📊</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Je portfolio</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{datumLabel}</span>
                </div>

                <div style={{ padding: '16px 20px' }}>
                  {/* Totale waarde */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Totale waarde</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 24, fontWeight: 700 }}>€{totaalWaarde.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span style={{
                        fontSize: 12, padding: '2px 8px', borderRadius: 6, fontWeight: 600,
                        background: dagWinstTotaal >= 0 ? '#dcfce7' : '#fef2f2',
                        color: dagWinstTotaal >= 0 ? '#16a34a' : '#dc2626'
                      }}>
                        {dagWinstTotaal >= 0 ? '+' : ''}€{Math.abs(dagWinstTotaal).toFixed(2)} {dagPct >= 0 ? '+' : ''}{dagPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Beleggingen lijst */}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>Je beleggingen</div>
                  {beleggingen.slice(0, 4).map(b => {
                    const k = koersen[b.symbol];
                    const f = (b.munt || 'EUR') === 'USD' ? 0.865 : 1;
                    const waarde = (k ? k.c : b.kostprijs) * b.aantal * f;
                    const dagV = k ? (k.c - k.pc) * b.aantal * f : 0;
                    const dagVPct = k && k.pc > 0 ? ((k.c - k.pc) / k.pc) * 100 : 0;
                    return (
                      <div key={b.symbol} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 0', borderBottom: '1px solid var(--border-light)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {b.logo
                            ? <img src={b.logo} alt={b.symbol} style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'contain', border: '1px solid var(--border)', background: 'white' }} />
                            : <div style={{ width: 24, height: 24, borderRadius: 6, background: '#e0e7ff', color: ACCENT, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{b.symbol.slice(0,2)}</div>
                          }
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{b.symbol.split('.')[0]}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.naam?.split(' ').slice(0, 3).join(' ')}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>€{waarde.toFixed(2)}</div>
                          <div style={{ fontSize: 11, color: dagVPct >= 0 ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                            {dagVPct >= 0 ? '+' : ''}{dagVPct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                    Bekijk je volledige portfolio op <span style={{ color: ACCENT, fontWeight: 600 }}>matico-self.vercel.app</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                Updates worden verstuurd om {emailInstellingen.tijdstip} · {emailInstellingen.frequentie === 'dagelijks' ? 'elke dag' : 'elke maandag'}
                {!emailInstellingen.weekend && emailInstellingen.frequentie === 'dagelijks' ? ' (ma–vr)' : ''}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
