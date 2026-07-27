// src/pages/AuthPage.jsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import kapitasLogo from '../assets/kapitas-logo.png';

export default function AuthPage({ onIngelogd, onPrivacybeleid, startModus }) {
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState(null);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [isRegistreren, setIsRegistreren] = useState(startModus === 'registreren');
  const [bevestigd, setBevestigd] = useState(false);

  const metGoogle = async () => {
    setLaden(true);
    setFout(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) { setFout(error.message); setLaden(false); }
  };

  const metEmail = async (e) => {
    e.preventDefault();
    setLaden(true);
    setFout(null);
    if (isRegistreren) {
      const { data, error } = await supabase.auth.signUp({ email, password: wachtwoord });
      if (error) { setFout(error.message); setLaden(false); }
      else if (data?.user?.identities?.length === 0) {
        // Supabase geeft bij een reeds bestaand (bevestigd) e-mailadres bewust
        // geen foutmelding terug (ter voorkoming van account-enumeratie) —
        // maar stuurt in dat geval ook geen nieuwe bevestigingsmail. We
        // herkennen dit via de lege 'identities'-lijst en tonen zelf een
        // duidelijke melding in plaats van blind "bevestig je e-mail" te tonen.
        setFout('Dit e-mailadres heeft al een account. Probeer in te loggen in plaats van te registreren.');
        setLaden(false);
      }
      else { setBevestigd(true); setLaden(false); }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
      if (error) { setFout(error.message); setLaden(false); }
      else { onIngelogd(data.user); }
    }
  };

  if (bevestigd) {
    return (
      <div style={s.wrapper}>
        <div style={s.kaart}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
          <h2 style={s.titel}>Bevestig je e-mail</h2>
          <p style={s.sub}>We hebben een bevestigingslink gestuurd naar <strong>{email}</strong>. Klik op de link in je inbox om je account te activeren.</p>
          <button onClick={() => setBevestigd(false)} style={s.btnGhost}>Terug naar inloggen</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrapper}>
      <div style={s.kaart}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src={kapitasLogo} alt="Kapitas" style={{ height: 32, width: 'auto', margin: '0 auto 12px', display: 'block' }} />
        </div>

        {/* Tabbladen: Inloggen / Registreren */}
        <div style={s.tabRij}>
          <button
            type="button"
            onClick={() => { setIsRegistreren(false); setFout(null); }}
            style={isRegistreren ? s.tabInactief : s.tabActief}
          >
            Inloggen
          </button>
          <button
            type="button"
            onClick={() => { setIsRegistreren(true); setFout(null); }}
            style={isRegistreren ? s.tabActief : s.tabInactief}
          >
            Registreren
          </button>
        </div>
        <p style={{ ...s.sub, marginBottom: 20 }}>{isRegistreren ? 'Maak een gratis account aan' : 'Welkom terug'}</p>

        {/* Foutmelding */}
        {fout && (
          <div style={s.fout}>{fout}</div>
        )}

        {!emailMode ? (
          <>
            {/* Google knop */}
            <button onClick={metGoogle} disabled={laden} style={s.btnGoogle}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
              </svg>
              {laden ? 'Laden...' : 'Doorgaan met Google'}
            </button>

            {/* Divider */}
            <div style={s.divider}>
              <div style={s.dividerLijn} />
              <span style={s.dividerTekst}>of</span>
              <div style={s.dividerLijn} />
            </div>

            {/* Email knop */}
            <button onClick={() => setEmailMode(true)} style={s.btnOutline}>
              📧 Doorgaan met e-mail
            </button>
          </>
        ) : (
          /* Email formulier */
          <form onSubmit={metEmail}>
            <div style={s.veld}>
              <label style={s.label}>E-mailadres</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={s.input} placeholder="jouw@email.com" required
              />
            </div>
            <div style={s.veld}>
              <label style={s.label}>Wachtwoord</label>
              <input
                type="password" value={wachtwoord} onChange={e => setWachtwoord(e.target.value)}
                style={s.input} placeholder="••••••••" required minLength={6}
              />
            </div>
            <button type="submit" disabled={laden} style={s.btnPrimary}>
              {laden ? 'Laden...' : isRegistreren ? 'Account aanmaken' : 'Inloggen'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" onClick={() => setIsRegistreren(v => !v)} style={s.btnLink}>
                {isRegistreren ? 'Al een account? Inloggen' : 'Nog geen account? Registreren'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button type="button" onClick={() => setEmailMode(false)} style={s.btnLink}>
                ← Terug
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p style={s.disclaimer}>
          Door in te loggen ga je akkoord met ons{' '}
          <span onClick={onPrivacybeleid} style={{ color: '#1e3a8a', cursor: 'pointer', fontWeight: 600 }}>privacybeleid</span>.
        </p>
      </div>
    </div>
  );
}

const s = {
  wrapper: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #eef1f8 0%, #f8fafc 100%)',
    padding: 24, fontFamily: "'DM Sans', sans-serif",
  },
  kaart: {
    background: 'white', borderRadius: 16, padding: '40px 36px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.1)', width: '100%', maxWidth: 420,
  },
  logo: {
    fontSize: 28, fontWeight: 800, color: '#1e3a8a', letterSpacing: '-0.5px',
  },
  titel: {
    fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8, textAlign: 'center',
  },
  sub: {
    fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 0, lineHeight: 1.6,
  },
  tabRij: {
    display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 16,
  },
  tabActief: {
    flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: 'white', color: '#1e3a8a', fontWeight: 700, fontSize: 14,
    fontFamily: "'DM Sans', sans-serif", boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  tabInactief: {
    flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: 'transparent', color: '#64748b', fontWeight: 600, fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
  },
  fout: {
    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
    padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
  },
  btnGoogle: {
    width: '100%', padding: '12px 16px', borderRadius: 10,
    border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    fontSize: 15, fontWeight: 600, color: '#0f172a',
    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s',
  },
  btnOutline: {
    width: '100%', padding: '12px 16px', borderRadius: 10,
    border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer',
    fontSize: 15, fontWeight: 600, color: '#0f172a',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnPrimary: {
    width: '100%', padding: '13px 16px', borderRadius: 10,
    border: 'none', background: '#1e3a8a', color: 'white', cursor: 'pointer',
    fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
    marginTop: 8,
  },
  btnGhost: {
    background: 'none', border: 'none', color: '#1e3a8a', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
    marginTop: 12,
  },
  btnLink: {
    background: 'none', border: 'none', color: '#1e3a8a', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0',
  },
  dividerLijn: { flex: 1, height: 1, background: '#e2e8f0' },
  dividerTekst: { fontSize: 13, color: '#94a3b8', fontWeight: 500 },
  veld: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: {
    width: '100%', padding: '11px 14px', borderRadius: 8,
    border: '1.5px solid #e2e8f0', fontSize: 14, color: '#0f172a',
    fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
  },
  disclaimer: {
    fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 20, lineHeight: 1.6,
  },
};
