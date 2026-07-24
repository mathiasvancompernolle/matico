import React, { useState, useEffect } from 'react';

const OPSLAG_SLEUTEL = 'matico_cookie_toestemming'; // 'geaccepteerd' | 'geweigerd'

export function haalCookieToestemming() {
  try { return localStorage.getItem(OPSLAG_SLEUTEL); } catch (e) { return null; }
}

// Simpele, GDPR-conforme cookiebanner: niet-essentiële cookies (zoals de
// chatwidget) worden pas geladen NA expliciete toestemming. "Weigeren" is
// een even prominente keuze als "Accepteren" (vereist onder GDPR — geen
// pre-aangevinkte of verborgen weigerknop).
export default function CookieConsent({ onWijziging }) {
  const [zichtbaar, setZichtbaar] = useState(false);

  useEffect(() => {
    const huidige = haalCookieToestemming();
    if (!huidige) setZichtbaar(true);
    else onWijziging && onWijziging(huidige);
  }, [onWijziging]);

  const kies = (keuze) => {
    try { localStorage.setItem(OPSLAG_SLEUTEL, keuze); } catch (e) {}
    setZichtbaar(false);
    onWijziging && onWijziging(keuze);
  };

  if (!zichtbaar) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'var(--bg-white, #fff)', borderTop: '1px solid var(--border, #e5e7eb)',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ flex: '1 1 320px', fontSize: 13, color: 'var(--text-secondary, #475569)', lineHeight: 1.5 }}>
        We gebruiken enkel noodzakelijke cookies om Matico te laten werken. Met jouw toestemming activeren we
        ook een chatwidget (Crisp) zodat je ons rechtstreeks vragen of feedback kan sturen. Zie ons privacybeleid
        voor meer info.
      </div>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button onClick={() => kies('geweigerd')} style={{
          padding: '10px 18px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)',
          background: 'transparent', color: 'var(--text-primary, #111827)', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Weigeren
        </button>
        <button onClick={() => kies('geaccepteerd')} style={{
          padding: '10px 18px', borderRadius: 8, border: 'none',
          background: 'var(--accent, #1e3a8a)', color: 'white', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Accepteren
        </button>
      </div>
    </div>
  );
}
