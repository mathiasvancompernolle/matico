import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPrijs(v, dec = 2) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return v.toLocaleString('nl-BE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtPct(v) {
  if (v === undefined || v === null || isNaN(v)) return '—';
  if (v === 0 || Object.is(v, 0)) return '0,00%';
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
}

function fmtVolume(v) {
  if (!v) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'mld.';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'mln.';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'k';
  return v.toLocaleString('nl-BE');
}

function landCodeVanBeurs(beurs) {
  const b = (beurs || '').toLowerCase();
  if (b.includes('paris')) return 'fr';
  if (b.includes('amsterdam')) return 'nl';
  if (b.includes('london')) return 'gb';
  if (b.includes('xetra') || b.includes('frankfurt') || b.includes('germany')) return 'de';
  if (b.includes('milan')) return 'it';
  if (b.includes('madrid')) return 'es';
  if (b.includes('swiss') || b.includes('zurich')) return 'ch';
  if (b.includes('tokyo')) return 'jp';
  if (b.includes('hong kong')) return 'hk';
  if (b.includes('nasdaq') || b.includes('nyse') || b.includes('new york')) return 'us';
  return 'be';
}

function GrafiekTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{p.label}</div>
      <div style={{ fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{fmtPrijs(p.v)}</div>
    </div>
  );
}

const PERIODES = [
  { id: '1d', label: 'Intraday', tijdperk: '1D' },
  { id: '1w', label: '1W', tijdperk: '1W' },
  { id: '1m', label: '1M', tijdperk: '1M' },
  { id: '3m', label: '3M', tijdperk: '3M' },
  { id: '6m', label: '6M', tijdperk: '6M' },
  { id: '1j', label: '1J', tijdperk: '1J' },
  { id: 'ytd', label: 'YTD', tijdperk: 'YTD' },
  { id: 'max', label: 'Max', tijdperk: 'Max' },
];

// ── Type-badge (logo indien beschikbaar, anders gekleurde badge) ─────────────
function EffectIcoon({ type, logo, symbol }) {
  const kleuren = {
    etf: { bg: '#eef2ff', kleur: '#6366f1', label: 'ETF' },
    crypto: { bg: '#fff7ed', kleur: '#f59e0b', label: (symbol || '').split('-')[0].slice(0, 4) },
    aandeel: { bg: '#fef3c7', kleur: '#d97706', label: 'EQ' },
  };
  const stijl = kleuren[type] || kleuren.aandeel;
  if (logo) {
    return (
      <img src={logo} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border)', background: 'white' }}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
    );
  }
  return (
    <div style={{ width: 40, height: 40, borderRadius: 8, background: stijl.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: stijl.kleur, flexShrink: 0, border: '1px solid var(--border)' }}>
      {stijl.label}
    </div>
  );
}

// ── Detailpagina voor een individueel effect (aandeel/ETF/crypto) ────────────
export default function EffectDetail({ effect, onTerug }) {
  const [periode, setPeriode] = useState('1d');
  const [grafiekData, setGrafiekData] = useState([]);
  const [grafiekLaden, setGrafiekLaden] = useState(true);
  const [quote, setQuote] = useState(null);
  const [quoteLaden, setQuoteLaden] = useState(true);
  const [profiel, setProfiel] = useState(null);

  const symbol = effect?.symbol;

  // Koersdata (bied/laat, 52w, marktkap, ...)
  useEffect(() => {
    if (!symbol) return;
    setQuoteLaden(true);
    fetch(`/api/data?endpoint=quote-detail&symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(d => { setQuote(d); setQuoteLaden(false); })
      .catch(() => setQuoteLaden(false));
  }, [symbol]);

  // Profiel (logo, ISIN, sector, land)
  useEffect(() => {
    if (!symbol) return;
    fetch(`/api/data?endpoint=profile&symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(d => setProfiel(d))
      .catch(() => setProfiel(null));
  }, [symbol]);

  // Grafiek
  useEffect(() => {
    if (!symbol) return;
    setGrafiekLaden(true);
    const p = PERIODES.find(p => p.id === periode);
    fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(symbol)}&tijdperk=${p.tijdperk}`)
      .then(r => r.json())
      .then(d => {
        const punten = d?.punten || [];
        setGrafiekData(punten.map(pt => ({
          t: new Date(pt.datum).getTime(),
          v: pt.prijs,
          label: pt.label,
        })).filter(pt => pt.v != null));
        setGrafiekLaden(false);
      })
      .catch(() => { setGrafiekData([]); setGrafiekLaden(false); });
  }, [symbol, periode]);

  if (!effect) return null;

  const huidigeKoers = quote?.c ?? 0;
  const vorigeSlot = quote?.pc ?? huidigeKoers;
  const verschil = huidigeKoers - vorigeSlot;
  const pctVerschil = vorigeSlot ? (verschil / vorigeSlot) * 100 : 0;
  const positief = verschil >= 0;
  const grafiekKleur = positief ? 'var(--green)' : 'var(--red)';

  const beursNaam = quote?.beurs || effect.beurs || '';
  const landCode = landCodeVanBeurs(beursNaam);
  const valuta = quote?.valuta || effect.valuta || 'EUR';
  const naam = profiel?.name || effect.naam;
  const type = profiel?.type || effect.type;

  return (
    <div className="markten-pagina">
      <div className="aandelen-topbalk">
        <button className="aandelen-terug-knop" onClick={onTerug}>← Terug</button>
      </div>

      <div style={{ padding: '0 32px 48px' }}>
        {/* ── Naam + koers + meta ── */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <EffectIcoon type={type} logo={profiel?.logo} symbol={symbol} />
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{naam}</h1>
              {profiel?.sector && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{profiel.sector}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {quoteLaden ? (
              <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-muted)' }}>—</span>
            ) : (
              <>
                <span style={{ fontSize: 30, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: positief ? 'var(--green)' : 'var(--red)' }}>
                  {fmtPrijs(huidigeKoers)}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: positief ? 'var(--green)' : 'var(--red)' }}>
                  {positief ? '+' : ''}{verschil.toFixed(2)} / {fmtPct(pctVerschil)}
                </span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src={`https://flagcdn.com/20x15/${landCode}.png`} srcSet={`https://flagcdn.com/40x30/${landCode}.png 2x`}
                width="20" height="15" alt={landCode.toUpperCase()}
                style={{ borderRadius: 2, boxShadow: '0 0 1px rgba(0,0,0,0.2)', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{beursNaam || '—'}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: quote?.marktOpen ? 'var(--green)' : 'var(--text-muted)', display: 'inline-block' }} />
                <span style={{ color: quote?.marktOpen ? 'var(--green)' : 'var(--text-muted)', fontWeight: 500 }}>{quote?.marktOpen ? 'Open' : 'Gesloten'}</span>
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Symb. <strong style={{ color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{symbol}</strong>
            </div>
            {profiel?.isin && (
              <div style={{ color: 'var(--text-muted)' }}>
                ISIN <strong style={{ color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{profiel.isin}</strong>
              </div>
            )}
            <div style={{ color: 'var(--text-muted)' }}>
              Valuta <strong style={{ color: 'var(--text-primary)' }}>{valuta}</strong>
            </div>
            <div style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>
              15 minuten vertraging
            </div>
          </div>
        </div>

        {/* ── Grafiek + Prijsdata naast elkaar ── */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Grafiek */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: 24, flex: '2 1 500px', minWidth: 320 }}>
            <div style={{ display: 'flex', gap: 2, marginBottom: 16, flexWrap: 'wrap' }}>
              {PERIODES.map(p => (
                <button key={p.id} onClick={() => setPeriode(p.id)} style={{
                  padding: '6px 12px', border: 'none', borderRadius: 6,
                  background: periode === p.id ? 'var(--accent)' : 'transparent',
                  color: periode === p.id ? 'white' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: periode === p.id ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>{p.label}</button>
              ))}
            </div>

            <div style={{ height: 300 }}>
              {grafiekLaden ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Laden...</div>
              ) : grafiekData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Geen data beschikbaar</div>
              ) : (() => {
                const vals = grafiekData.map(d => d.v).filter(Boolean);
                const bodem = Math.min(...vals);
                const top = Math.max(...vals);
                const bereik = top - bodem;
                let yDomain, yTicks;
                if (bereik === 0) {
                  yDomain = [0, top * 1.2];
                  yTicks = undefined;
                } else {
                  const doelTicks = 5;
                  const ruwStap = bereik / doelTicks;
                  const magnitude = Math.pow(10, Math.floor(Math.log10(ruwStap)));
                  const gen = ruwStap / magnitude;
                  const niceStap = gen < 1.5 ? magnitude : gen < 3.5 ? 2 * magnitude : gen < 7.5 ? 5 * magnitude : 10 * magnitude;
                  const axisMin = Math.floor(bodem / niceStap) * niceStap;
                  const axisMax = Math.ceil(top / niceStap) * niceStap;
                  yDomain = [axisMin, axisMax];
                  yTicks = [];
                  for (let t = axisMin; t <= axisMax + niceStap * 0.01; t += niceStap) yTicks.push(Math.round(t * 100) / 100);
                }
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={grafiekData} margin={{ top: 5, right: 8, bottom: 5, left: 8 }}>
                      <defs>
                        <linearGradient id="effectGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={grafiekKleur} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={grafiekKleur} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                        interval={Math.floor(grafiekData.length / 6)} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                        tickFormatter={v => v.toLocaleString('nl-BE')} domain={yDomain} ticks={yTicks} width={55} />
                      <Tooltip content={<GrafiekTooltip />} />
                      <Area type="monotone" dataKey="v" stroke={grafiekKleur} strokeWidth={2} fill="url(#effectGrad)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>

          {/* Prijsdata paneel */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: 24, flex: '1 1 260px', minWidth: 260 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              Prijsdata
            </div>
            {quoteLaden ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Laden...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 12, fontSize: 13 }}>
                <PrijsRij label="Laatst" waarde={fmtPrijs(huidigeKoers)} />
                <PrijsRij label="Vorig slot" waarde={fmtPrijs(vorigeSlot)} />
                <PrijsRij label="Bied" waarde={quote?.bid ? fmtPrijs(quote.bid) : '—'} />
                <PrijsRij label="Laat" waarde={quote?.ask ? fmtPrijs(quote.ask) : '—'} />
                <PrijsRij label="Open" waarde={fmtPrijs(quote?.o)} />
                <PrijsRij label="Slot" waarde={fmtPrijs(vorigeSlot)} />
                <PrijsRij label="Hoog" waarde={fmtPrijs(quote?.h)} />
                <PrijsRij label="Laag" waarde={fmtPrijs(quote?.l)} />
                <PrijsRij label="12M Hoog" waarde={fmtPrijs(quote?.hoog52)} />
                <PrijsRij label="12M Laag" waarde={fmtPrijs(quote?.laag52)} />
                <PrijsRij label="+/-" waarde={`${positief ? '+' : ''}${verschil.toFixed(2)} (${fmtPct(pctVerschil)})`} kleur={positief ? 'var(--green)' : 'var(--red)'} />
                <PrijsRij label="Volume" waarde={fmtVolume(quote?.v)} />
                {quote?.marktKap ? <PrijsRij label="Marktkap." waarde={fmtVolume(quote.marktKap)} /> : null}
              </div>
            )}
          </div>
        </div>

        {/* Bedrijfsprofiel */}
        {profiel?.description && (
          <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Bedrijfsprofiel</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{profiel.description}</p>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 14, fontSize: 13 }}>
              {profiel.sector && <div><span style={{ color: 'var(--text-muted)' }}>Sector: </span><strong>{profiel.sector}</strong></div>}
              {profiel.industry && <div><span style={{ color: 'var(--text-muted)' }}>Industrie: </span><strong>{profiel.industry}</strong></div>}
              {profiel.country && <div><span style={{ color: 'var(--text-muted)' }}>Land: </span><strong>{profiel.country}</strong></div>}
              {profiel.employeeTotal && <div><span style={{ color: 'var(--text-muted)' }}>Werknemers: </span><strong>{Number(profiel.employeeTotal).toLocaleString('nl-BE')}</strong></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrijsRij({ label, waarde, kleur }) {
  return (
    <>
      <div style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: kleur || 'var(--text-primary)' }}>{waarde}</div>
    </>
  );
}
