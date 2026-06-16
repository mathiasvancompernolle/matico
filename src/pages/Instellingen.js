import React, { useState, useEffect, useCallback } from 'react';
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
    console.log('Testmail gestart naar:', emailInstellingen.email);
    if (!emailInstellingen.email || !emailInstellingen.email.includes('@')) {
      setEmailFout('Vul eerst een geldig e-mailadres in.');
      return;
    }
    setEmailFout('');
    console.log('Payload:', bouwEmailPayload(true));
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
          {[['portfolio', 'Portfolio'], ['email', 'E-mailupdates'], ['data', 'Data-kwaliteit']].map(([id, label]) => (
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
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: 1, pointerEvents: 'all'
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
        {actieveTab === 'data' && <DataKwaliteitTab beleggingen={beleggingen} />}

      </div>
    </div>
  );
}

const SECTOREN = [
  'Technologie', 'Financiële dienstverlening', 'Cyclische consumptiegoederen',
  'Defensieve consumptiegoederen', 'Gezondheidszorg', 'Communicatiediensten',
  'Industrie', 'Energie', 'Basismaterialen', 'Nutsbedrijven', 'Vastgoed', 'Overige',
];

// Engels → Nederlands (API geeft Engelse labels terug)
// Dekt zowel FMP/EODHD sector-namen als Finnhub finnhubIndustry-namen
const SECTOR_NL = {
  // Technologie
  'Technology': 'Technologie', 'Information Technology': 'Technologie',
  'Semiconductors': 'Technologie', 'Semiconductor': 'Technologie',
  'Software': 'Technologie', 'Software—Application': 'Technologie', 'Software—Infrastructure': 'Technologie',
  'Hardware': 'Technologie', 'Computer Hardware': 'Technologie',
  'Electronic Technology': 'Technologie', 'Electronics': 'Technologie',
  'Internet Content & Information': 'Technologie',
  // Financiën
  'Financial Services': 'Financiële dienstverlening', 'Financial': 'Financiële dienstverlening', 'Financials': 'Financiële dienstverlening',
  'Banks': 'Financiële dienstverlening', 'Banks—Diversified': 'Financiële dienstverlening',
  'Insurance': 'Financiële dienstverlening', 'Asset Management': 'Financiële dienstverlening',
  'Capital Markets': 'Financiële dienstverlening', 'Credit Services': 'Financiële dienstverlening',
  'Finance': 'Financiële dienstverlening',
  // Cyclisch
  'Consumer Cyclical': 'Cyclische consumptiegoederen', 'Consumer Discretionary': 'Cyclische consumptiegoederen',
  'Retail': 'Cyclische consumptiegoederen', 'Automobiles': 'Cyclische consumptiegoederen',
  'Auto Manufacturers': 'Cyclische consumptiegoederen', 'Footwear & Accessories': 'Cyclische consumptiegoederen',
  'Apparel Manufacturing': 'Cyclische consumptiegoederen', 'Apparel Retail': 'Cyclische consumptiegoederen',
  'Specialty Retail': 'Cyclische consumptiegoederen', 'E-Commerce': 'Cyclische consumptiegoederen',
  'Leisure': 'Cyclische consumptiegoederen', 'Hotels & Entertainment Services': 'Cyclische consumptiegoederen',
  'Textiles, Apparel & Luxury Goods': 'Cyclische consumptiegoederen',
  'Textile Manufacturing': 'Cyclische consumptiegoederen',
  // Defensief
  'Consumer Defensive': 'Defensieve consumptiegoederen', 'Consumer Staples': 'Defensieve consumptiegoederen',
  'Food': 'Defensieve consumptiegoederen', 'Beverages': 'Defensieve consumptiegoederen',
  'Household & Personal Products': 'Defensieve consumptiegoederen', 'Tobacco': 'Defensieve consumptiegoederen',
  // Gezondheidszorg
  'Healthcare': 'Gezondheidszorg', 'Health Care': 'Gezondheidszorg',
  'Biotechnology': 'Gezondheidszorg', 'Pharmaceuticals': 'Gezondheidszorg',
  'Medical Devices': 'Gezondheidszorg', 'Drug Manufacturers': 'Gezondheidszorg',
  'Drug Manufacturers—General': 'Gezondheidszorg',
  // Communicatie
  'Communication Services': 'Communicatiediensten', 'Telecommunication Services': 'Communicatiediensten',
  'Telecommunications': 'Communicatiediensten', 'Media': 'Communicatiediensten',
  'Entertainment': 'Communicatiediensten', 'Broadcasting': 'Communicatiediensten',
  'Internet Services': 'Communicatiediensten',
  // Industrie
  'Industrials': 'Industrie', 'Industrial': 'Industrie',
  'Aerospace & Defense': 'Industrie', 'Transportation': 'Industrie',
  'Construction': 'Industrie', 'Machinery': 'Industrie',
  // Energie
  'Energy': 'Energie', 'Oil & Gas': 'Energie', 'Oil, Gas & Consumable Fuels': 'Energie',
  // Materialen
  'Basic Materials': 'Basismaterialen', 'Materials': 'Basismaterialen',
  'Chemicals': 'Basismaterialen', 'Metals & Mining': 'Basismaterialen',
  // Nutsbedrijven
  'Utilities': 'Nutsbedrijven',
  // Vastgoed
  'Real Estate': 'Vastgoed', 'REITs': 'Vastgoed',
};
const vertaalSector = (s) => s ? (SECTOR_NL[s] || s) : null;

function DataKwaliteitTab({ beleggingen }) {
  const [statussen, setStatussen] = useState({});
  const [bezig, setBezig] = useState(false);
  const [bewerkItem, setBewerkItem] = useState(null); // { symbol, sector, beta }
  const [opgeslagenSym, setOpgeslagenSym] = useState(null);

  const aandelen = beleggingen.filter(b => {
    const sym = (b.symbol || '').toUpperCase().split('.')[0];
    const KNOWN_ETFS = new Set(['CNDX','CSPX','CSX5','EEM','EMIM','EQQQ','GWL','IEMA','IMEU','IUSA','IVV','IWDA','LCWD','PRAW','QQQ','SMEA','SPY','SWRD','SXR8','VWCE','VWRL','WEBG','XDWD','XWLD']);
    return b.type !== 'etf' && !KNOWN_ETFS.has(sym) && b.type !== 'crypto';
  });

  const controleerAlles = useCallback(async () => {
    setBezig(true);
    const nieuw = {};
    for (const b of aandelen) {
      const sym = (b.symbol || '').toUpperCase().split('.')[0];
      // Check localStorage cache eerst
      const cachedSector = (() => { try { const c = localStorage.getItem(`matico_sector_${sym}`); return c ? JSON.parse(c).sector : null; } catch { return null; } })();
      const cachedBeta = (() => { try { const c = localStorage.getItem(`matico_beta_${sym}`); return c ? JSON.parse(c).beta : null; } catch { return null; } })();
      const manueel = (() => { try { const c = localStorage.getItem(`matico_manueel_${sym}`); return c ? JSON.parse(c) : null; } catch { return null; } })();

      if (manueel?.sector || cachedSector || manueel?.beta || cachedBeta) {
        nieuw[sym] = {
          sector: manueel?.sector || vertaalSector(cachedSector) || null,
          beta: manueel?.beta || cachedBeta || null,
          manueel: !!manueel,
        };
        continue;
      }
      // Live check via profile endpoint (sector) + metrics endpoint (bèta)
      try {
        const [profileRes, metricsRes] = await Promise.all([
          fetch(`/api/data?endpoint=profile&symbol=${b.symbol}`),
          fetch(`/api/data?endpoint=metrics&symbol=${b.symbol}`),
        ]);
        const profileData = await profileRes.json();
        const metricsData = await metricsRes.json();
        const sector = vertaalSector(profileData?.sector || profileData?.finnhubIndustry) || null;
        const beta = metricsData?.metric?.beta || profileData?.beta || null;
        nieuw[sym] = { sector, beta, manueel: false };
      } catch {
        nieuw[sym] = { sector: null, beta: null, manueel: false };
      }
    }
    setStatussen(nieuw);
    setBezig(false);
  }, [aandelen.map(b => b.symbol).join(',')]);

  useEffect(() => { controleerAlles(); }, []);

  const slaManueelOp = () => {
    if (!bewerkItem) return;
    const sym = bewerkItem.symbol;
    const data = { sector: bewerkItem.sector || null, beta: bewerkItem.beta ? parseFloat(bewerkItem.beta) : null };
    localStorage.setItem(`matico_manueel_${sym}`, JSON.stringify(data));
    // Ook opslaan in de normale caches zodat Analyse ze oppikt
    if (data.sector) localStorage.setItem(`matico_sector_${sym}`, JSON.stringify({ sector: data.sector, timestamp: Date.now() }));
    if (data.beta) localStorage.setItem(`matico_beta_${sym}`, JSON.stringify({ beta: data.beta, timestamp: Date.now() }));
    setStatussen(prev => ({ ...prev, [sym]: { ...data, manueel: true } }));
    setOpgeslagenSym(sym);
    setTimeout(() => setOpgeslagenSym(null), 2000);
    setBewerkItem(null);
  };

  const verwijderManueel = (sym) => {
    localStorage.removeItem(`matico_manueel_${sym}`);
    localStorage.removeItem(`matico_sector_${sym}`);
    localStorage.removeItem(`matico_beta_${sym}`);
    setStatussen(prev => ({ ...prev, [sym]: { sector: null, beta: null, manueel: false } }));
  };

  if (aandelen.length === 0) {
    return (
      <div className="card" style={{ maxWidth: 600, textAlign: 'center', padding: '40px 32px' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Geen aandelen gevonden</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Voeg eerst aandelen toe aan je portfolio.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Data-kwaliteit</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Controleer voor welke aandelen sector en bèta beschikbaar zijn. Ontbrekende data kan je zelf invullen.
            </p>
          </div>
          <button onClick={controleerAlles} disabled={bezig} style={{
            padding: '8px 16px', background: bezig ? 'var(--bg-subtle)' : ACCENT,
            color: bezig ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: 8,
            cursor: bezig ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13,
            fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0
          }}>
            {bezig ? '⟳ Bezig...' : '↻ Vernieuwen'}
          </button>
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {[['#16a34a', '✓ Beschikbaar'], ['#f59e0b', '✎ Manueel ingevuld'], ['#dc2626', '✗ Ontbreekt']].map(([kleur, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: kleur }} />
              {label}
            </div>
          ))}
        </div>

        {/* Tabel */}
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 80px', gap: 0, background: 'var(--bg-subtle)', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            {['Aandeel', 'Sector', 'Bèta', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 3 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>

          {aandelen.map((b, idx) => {
            const sym = (b.symbol || '').toUpperCase().split('.')[0];
            const status = statussen[sym];
            const heeftSector = !!(status?.sector);
            const heeftBeta = !!(status?.beta);
            const isManueel = status?.manueel;
            const isOpgeslagen = opgeslagenSym === sym;

            const sectorKleur = heeftSector ? (isManueel ? '#f59e0b' : '#16a34a') : '#dc2626';
            const betaKleur = heeftBeta ? (isManueel ? '#f59e0b' : '#16a34a') : '#dc2626';

            return (
              <div key={sym} style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 100px 80px',
                padding: '14px 16px', borderBottom: idx < aandelen.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center', background: isOpgeslagen ? 'rgba(99,102,241,0.04)' : 'transparent',
                transition: 'background 0.3s'
              }}>
                {/* Naam */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{b.naam || sym}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{b.symbol}</div>
                </div>
                {/* Sector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: sectorKleur, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: heeftSector ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: heeftSector ? 'normal' : 'italic' }}>
                    {bezig ? '...' : (status?.sector || 'Ontbreekt')}
                  </span>
                </div>
                {/* Bèta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: betaKleur, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: heeftBeta ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: heeftBeta ? 'normal' : 'italic' }}>
                    {bezig ? '...' : (status?.beta ? parseFloat(status.beta).toFixed(2) : 'Ontbreekt')}
                  </span>
                </div>
                {/* Actie */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  {isOpgeslagen ? (
                    <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Opgeslagen</span>
                  ) : (
                    <>
                      <button onClick={() => setBewerkItem({ symbol: sym, sector: status?.sector || '', beta: status?.beta ? String(status.beta) : '' })} style={{
                        padding: '5px 10px', background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                        borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                        color: 'var(--text-primary)', fontWeight: 500
                      }}>✎ Bewerken</button>
                      {isManueel && (
                        <button onClick={() => verwijderManueel(sym)} style={{
                          padding: '5px 8px', background: 'transparent', border: '1px solid #fca5a5',
                          borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#dc2626'
                        }}>✕</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bewerkmodal */}
      {bewerkItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => e.target === e.currentTarget && setBewerkItem(null)}>
          <div style={{ background: 'var(--bg-white)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Data invullen</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{bewerkItem.symbol}</div>
              </div>
              <button onClick={() => setBewerkItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Sector</label>
              <div style={{ position: 'relative' }}>
                <select value={bewerkItem.sector} onChange={e => setBewerkItem(p => ({ ...p, sector: e.target.value }))} style={{
                  ...inputStyle, appearance: 'none', paddingRight: 36, cursor: 'pointer'
                }}>
                  <option value="">Kies een sector...</option>
                  {SECTOREN.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 11 }}>▼</div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Bèta
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>— maatstaf voor volatiliteit (bv. 1.20)</span>
              </label>
              <input
                type="number" step="0.01" min="0" max="5"
                value={bewerkItem.beta}
                onChange={e => setBewerkItem(p => ({ ...p, beta: e.target.value }))}
                placeholder="bv. 1.20"
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                {'< 1 = defensief · 1 = markt · > 1 = volatiel · > 1.5 = zeer volatiel'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setBewerkItem(null)} style={{
                flex: 1, padding: '11px', background: 'var(--bg-subtle)', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600
              }}>Annuleren</button>
              <button onClick={slaManueelOp} disabled={!bewerkItem.sector && !bewerkItem.beta} style={{
                flex: 2, padding: '11px', background: (!bewerkItem.sector && !bewerkItem.beta) ? 'var(--bg-subtle)' : ACCENT,
                color: (!bewerkItem.sector && !bewerkItem.beta) ? 'var(--text-muted)' : 'white',
                border: 'none', borderRadius: 8, cursor: (!bewerkItem.sector && !bewerkItem.beta) ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 600
              }}>Opslaan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
