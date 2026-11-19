import React, { useEffect, useMemo, useState } from 'react';

// Logo van een effect, met meerdere bronnen na elkaar:
//  1. het bewaarde logo (behalve de onbetrouwbare favicon.im-links)
//  2. crypto: het logo van CoinGecko (via /api/data?endpoint=crypto-logo)
//  3. aandelen/ETF's: de logodatabank van FMP (op symbool, dan op basis)
//  4. ETF's: het logo van de uitgever (iShares, Vanguard, SPDR, ...)
// Lukt een bron niet (laadfout), dan gaat het naar de volgende; lukt geen
// enkele, dan toont de component zijn eigen badge met letters.

// Uitgever → logo. Waar mogelijk het logo van een bekende ETF van die
// uitgever in de FMP-databank (scherper dan een favicon); anders de favicon
// van de website.
const fmp = (s) => `https://financialmodelingprep.com/image-stock/${s}.png`;
const UITGEVER_DOMEIN = [
  [['ishares', 'blackrock'], 'ishares.com', fmp('IWDA.AS')],
  [['vanguard'], 'vanguard.com', fmp('VWCE.DE')],
  [['spdr', 'state street'], 'ssga.com', fmp('SPY')],
  [['amundi', 'lyxor'], 'amundi.com'],
  [['xtrackers', 'dws'], 'dws.com', fmp('XDWD.DE')],
  [['invesco'], 'invesco.com', fmp('EQQQ.L')],
  [['wisdomtree'], 'wisdomtree.eu', fmp('WTEM.DE')],
  [['vaneck'], 'vaneck.com'],
  [['ubs'], 'ubs.com'],
  [['hsbc'], 'hsbc.com'],
  [['jpmorgan', 'j.p. morgan'], 'jpmorgan.com'],
  [['fidelity'], 'fidelity.com'],
  [['franklin', 'templeton'], 'franklintempleton.com'],
  [['global x'], 'globalxetfs.com'],
  [['pimco'], 'pimco.com'],
  [['bnp'], 'bnpparibas-am.com'],
];
const favicon = (domein) => `https://www.google.com/s2/favicons?domain=${domein}&sz=128`;

// Oude favicon.im-links (vaak leeg) omzetten naar dezelfde favicon via Google
const herstelLogo = (logo) => {
  if (!logo) return null;
  const m = /favicon\.im\/([^/?#]+)/i.exec(logo);
  return m ? favicon(m[1]) : logo;
};

const cryptoCache = (sym) => { try { return localStorage.getItem(`kapitas_cryptologo_${sym}`); } catch { return null; } };

export function useEffectLogo(b) {
  const symbol = (b?.symbol || '').toUpperCase();
  const isCrypto = b?.type === 'crypto' || /-(USD|EUR|GBP|USDT)$/.test(symbol);
  const [cryptoLogo, setCryptoLogo] = useState(() => (isCrypto ? cryptoCache(symbol) : null));
  const [index, setIndex] = useState(0);

  // Crypto: logo één keer opzoeken en per symbool bewaren ('-' = geen gevonden)
  useEffect(() => {
    if (!isCrypto || cryptoLogo || !symbol) return;
    let actief = true;
    fetch(`/api/data?endpoint=crypto-logo&symbol=${encodeURIComponent(symbol)}&naam=${encodeURIComponent(b?.naam || '')}`)
      .then(r => r.json())
      .then(d => {
        const url = d?.logo || '-';
        try { localStorage.setItem(`kapitas_cryptologo_${symbol}`, url); } catch (e) {}
        if (actief) setCryptoLogo(url);
      })
      .catch(() => {});
    return () => { actief = false; };
  }, [symbol, isCrypto, cryptoLogo, b?.naam]);

  const kandidaten = useMemo(() => {
    const lijst = [];
    const bewaard = herstelLogo(b?.logo);
    if (isCrypto) {
      if (cryptoLogo && cryptoLogo !== '-') lijst.push(cryptoLogo);
      if (bewaard) lijst.push(bewaard);
      return lijst;
    }
    // Een oud uitgeverslogo (favicon.im, vaak enkel een letter) pas achteraan
    const zwakBewaard = /favicon\.im/i.test(b?.logo || '');
    if (bewaard && !zwakBewaard) lijst.push(bewaard);
    // Enkel op het volledige symbool (niet zonder beurscode: UCB.BR ≠ UCB in de VS)
    if (symbol && !symbol.startsWith('MAN-')) {
      lijst.push(`https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`);
    }
    if (b?.type === 'etf' || /etf|ucits/i.test(b?.naam || '')) {
      const naam = (b?.naam || '').toLowerCase();
      const hit = UITGEVER_DOMEIN.find(([woorden]) => woorden.some(w => naam.includes(w)));
      if (hit) { if (hit[2]) lijst.push(hit[2]); lijst.push(favicon(hit[1])); }
    }
    if (bewaard && zwakBewaard) lijst.push(bewaard);
    return [...new Set(lijst)];
  }, [b?.logo, b?.type, b?.naam, symbol, isCrypto, cryptoLogo]);

  useEffect(() => { setIndex(0); }, [kandidaten.join('|')]);

  const src = kandidaten[index] || null;
  return {
    src,
    onError: () => setIndex(i => i + 1),
    // Crypto-logo's zijn rond: dan een cirkel i.p.v. een afgerond vierkant
    rond: isCrypto && !!src && src === cryptoLogo,
  };
}

// Klein logo (bv. in lijsten) met letters als terugval
export function EffectLogoKlein({ b, grootte = 32 }) {
  const { src, onError, rond } = useEffectLogo(b);
  if (src) {
    return (
      <img src={src} alt={b?.symbol} onError={onError}
        style={logoStijl(grootte, rond ? '50%' : 8)} />
    );
  }
  return (
    <div style={{
      width: grootte, height: grootte, borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)',
      fontWeight: 700, fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {(b?.symbol || '').split('.')[0].replace(/-(USD|EUR|GBP)$/i, '').slice(0, 2).toUpperCase()}
    </div>
  );
}

// Stijl voor een logo: vult het afgeronde vakje volledig (geen witte
// opvulling of kader rond logo's met een eigen achtergrond). Een zeer lichte
// omlijning bovenop het beeld houdt lichte logo's zichtbaar op wit.
export const logoStijl = (grootte = 36, hoek = 10) => ({
  width: grootte, height: grootte, borderRadius: hoek, objectFit: 'cover', display: 'block',
  background: 'white', flexShrink: 0,
  outline: '1px solid rgba(15, 23, 42, 0.08)', outlineOffset: -1,
});
