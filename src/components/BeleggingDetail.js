import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Loader, ExternalLink, Copy, Check } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const TIJDPERKEN = ['1D', '1W', '1M', '1J', 'YTD', '3J', '5J', 'Max'];

export default function BeleggingDetail({ belegging, onClose }) {
  const { koersen, getMuntFactor, portfolioWaarde } = useApp();
  const [tijdperk, setTijdperk] = useState('1D');
  const [grafiekData, setGrafiekData] = useState([]);
  const [grafiekLoading, setGrafiekLoading] = useState(false);
  const [profiel, setProfiel] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [nieuws, setNieuws] = useState([]);
  const [analyse, setAnalyse] = useState(null);
  const [analyseLoading, setAnalyseLoading] = useState(false);
  const [aktieveTab, setAktieveTab] = useState('sector');
  const [beschrijvingUitgeklapt, setBeschrijvingUitgeklapt] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);
  const [etfData, setEtfData] = useState(null);
  const [etfDataLaden, setEtfDataLaden] = useState(false);

  const koers = koersen[belegging.symbol];
  const huidigePrijs = koers ? koers.c : belegging.kostprijs;
  const factor = getMuntFactor ? getMuntFactor(belegging.munt || 'EUR') : ((belegging.munt || 'EUR') === 'USD' ? 0.865 : 1);
  const huidigeWaarde = huidigePrijs * belegging.aantal * factor;
  const kostprijsTotaal = (belegging.kostprijs * belegging.aantal + (belegging.transactiekosten || 0)) * factor;
  const winstTotaal = huidigeWaarde - kostprijsTotaal;
  const winstTotaalPct = kostprijsTotaal > 0 ? (winstTotaal / kostprijsTotaal) * 100 : 0;
  const dagVRaw = koers ? (koers.c - koers.pc) : 0;
  const dagVPctRaw = koers && koers.pc > 0 ? ((koers.c - koers.pc) / koers.pc) * 100 : 0;
  const gewicht = portfolioWaarde > 0 ? (huidigeWaarde / portfolioWaarde) * 100 : 0;
  const muntSym = (belegging.munt || 'EUR') === 'USD' ? '$' : '€';

  // Check of beurs open is voor dit aandeel
  const isBeursOpenNu = () => {
    if (belegging.type === 'crypto') return true; // crypto handelt 24/7
    const nu = new Date();
    const dag = nu.getDay();
    if (dag === 0 || dag === 6) return false; // weekend
    const tijdUTC = nu.getUTCHours() * 60 + nu.getUTCMinutes();
    const munt = belegging.munt || 'EUR';
    if (munt === 'EUR') return tijdUTC >= 7 * 60;       // Xetra open vanaf 09:00 CET
    return tijdUTC >= 13 * 60 + 30;                      // NYSE open vanaf 15:30 CET
  };
  const dagToonbaar = isBeursOpenNu(); // toon % doordeweeks van opening tot middernacht

  const dagV = dagToonbaar ? dagVRaw : 0;
  const dagVPct = dagToonbaar ? dagVPctRaw : 0;
  const dagVEur = dagV * belegging.aantal * factor;

  // Echte historische grafiek data
  useEffect(() => {
    const laadGrafiek = async () => {
      setGrafiekLoading(true);
      try {
        const res = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(belegging.symbol)}&tijdperk=${tijdperk}`);
        const data = await res.json();
        if (data.punten && data.punten.length > 0) {
          setGrafiekData(data.punten);
          setGrafiekLoading(false);
          return;
        }
      } catch (e) { console.error('Grafiek fout:', e); }
      setGrafiekData([{ label: 'Nu', prijs: huidigePrijs }]);
      setGrafiekLoading(false);
    };
    laadGrafiek();
  }, [tijdperk, belegging.symbol, huidigePrijs]);

  // ETF-verdeling (sector/regio) en top-10 holdings — per geselecteerd effect
  // opnieuw opgehaald, zodat dit niet blijft hangen op het vorige effect.
  useEffect(() => {
    if (belegging.type !== 'etf') { setEtfData(null); return; }
    let genegeerd = false;
    setEtfDataLaden(true);
    setEtfData(null);
    const basis = belegging.symbol.toUpperCase().split('.')[0];
    fetch(`/api/data?endpoint=etf-holdings&symbol=${encodeURIComponent(basis)}`)
      .then(r => r.json())
      .then(d => { if (!genegeerd) { setEtfData(d); setEtfDataLaden(false); } })
      .catch(() => { if (!genegeerd) setEtfDataLaden(false); });
    return () => { genegeerd = true; };
  }, [belegging.symbol, belegging.type]);

  // Profiel, metrics & nieuws
  useEffect(() => {
    const laad = async () => {
      try {
        const [profielRes, metricsRes, nieuwsRes] = await Promise.all([
          fetch(`/api/data?endpoint=profile&symbol=${belegging.symbol}`),
          fetch(`/api/data?endpoint=metrics&symbol=${belegging.symbol}`),
          fetch(`/api/data?endpoint=news&symbol=${belegging.symbol}&naam=${encodeURIComponent(belegging.naam || '')}`)
        ]);
        const p = await profielRes.json();
        const m = await metricsRes.json();
        const n = await nieuwsRes.json();
        if (p.name) setProfiel(p);
        if (m.metric) setMetrics(m.metric);
        if (Array.isArray(n)) setNieuws(n.slice(0, 5));
      } catch (e) { console.error('Detail data fout:', e); }
    };
    laad();
  }, [belegging.symbol]);

  const laadAnalyse = async () => {
    setAnalyseLoading(true);
    try {
      const res = await fetch('/api/data?endpoint=ai-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: belegging.symbol, name: belegging.naam, price: huidigePrijs, change: dagVPct.toFixed(2) })
      });
      const data = await res.json();
      setAnalyse(data.analyse);
    } catch (e) { setAnalyse('Analyse momenteel niet beschikbaar.'); }
    setAnalyseLoading(false);
  };

  const kopieerISIN = (isin) => {
    navigator.clipboard.writeText(isin);
    setGekopieerd(true);
    setTimeout(() => setGekopieerd(false), 2000);
  };

  // Check of beurs open is voor dit aandeel
  const isBeursOpenDetail = () => {
    if (belegging.type === 'crypto') return true; // crypto handelt 24/7
    const nu = new Date();
    const dag = nu.getDay();
    if (dag === 0 || dag === 6) return false;
    const tijdUTC = nu.getUTCHours() * 60 + nu.getUTCMinutes();
    const munt = belegging.munt || 'EUR';
    if (munt === 'EUR') return tijdUTC >= 7 * 60;
    return tijdUTC >= 13 * 60 + 30;
  };
  const beursGesloten = tijdperk === '1D' && !isBeursOpenNu();
  const grafiekKleur = beursGesloten ? '#94a3b8' : (grafiekData.length > 1 && grafiekData[grafiekData.length-1].prijs >= grafiekData[0].prijs ? '#22c55e' : '#ef4444');

  // ── Slimme X-as: meet werkelijk datumbereik ──
  const { detailXTicks, detailXFormatter } = (() => {
    const maandKort = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    const data = grafiekData;
    if (data.length < 2) return { detailXTicks: undefined, detailXFormatter: v => v };

    const eersteD = data.find(d => d.datum)?.datum ? new Date(data.find(d => d.datum).datum) : null;
    const laatsteD = [...data].reverse().find(d => d.datum)?.datum ? new Date([...data].reverse().find(d => d.datum).datum) : null;
    if (!eersteD || !laatsteD) return { detailXTicks: undefined, detailXFormatter: v => v };

    const dagen = (laatsteD - eersteD) / (1000 * 60 * 60 * 24);

    let groepeerFn, formatFn;

    if (dagen <= 2) {
      const gezienUren = new Set();
      const ticks = data.filter(d => {
        const uur = (d.label || '').split(':')[0];
        if (!uur || gezienUren.has(uur)) return false;
        gezienUren.add(uur);
        return true;
      }).map(d => d.label);
      return { detailXTicks: ticks, detailXFormatter: v => v };
    } else if (dagen <= 14) {
      groepeerFn = d => new Date(d.datum).toDateString();
      formatFn = d => { const dt = new Date(d.datum); return `${dt.getDate()} ${maandKort[dt.getMonth()]}`; };
    } else if (dagen <= 60) {
      groepeerFn = d => { const dt = new Date(d.datum); return `${dt.getFullYear()}-${Math.ceil(dt.getDate()/7)}-${dt.getMonth()}`; };
      formatFn = d => { const dt = new Date(d.datum); return `${dt.getDate()} ${maandKort[dt.getMonth()]}`; };
    } else if (dagen <= 400) {
      groepeerFn = d => { const dt = new Date(d.datum); return `${dt.getFullYear()}-${dt.getMonth()}`; };
      formatFn = d => {
        const dt = new Date(d.datum);
        if (dt.getMonth() === 0) return `jan '${String(dt.getFullYear()).slice(2)}`;
        return maandKort[dt.getMonth()];
      };
    } else if (dagen <= 900) {
      groepeerFn = d => { const dt = new Date(d.datum); return `${dt.getFullYear()}-Q${Math.floor(dt.getMonth()/3)}`; };
      formatFn = d => {
        const dt = new Date(d.datum);
        const kwartaalMaand = Math.floor(dt.getMonth()/3) * 3;
        return kwartaalMaand === 0 ? `${dt.getFullYear()}` : maandKort[kwartaalMaand];
      };
    } else {
      groepeerFn = d => new Date(d.datum).getFullYear();
      formatFn = d => String(new Date(d.datum).getFullYear());
    }

    const gezien = new Set();
    const ticks = data.filter(d => {
      if (!d.datum) return false;
      const sleutel = groepeerFn(d);
      if (gezien.has(sleutel)) return false;
      gezien.add(sleutel); return true;
    }).map(d => d.label);

    const formatter = (label) => {
      const punt = data.find(d => d.label === label);
      if (!punt?.datum) return label;
      return formatFn(punt);
    };

    return { detailXTicks: ticks, detailXFormatter: formatter };
  })();

  // ETF-verdeling: sector of regio, afhankelijk van de actieve tab — live
  // opgehaald voor het geselecteerde effect (zie useEffect hierboven).
  const ETF_KLEUREN = ['#1e3a8a', '#d97706', '#059669', '#dc2626', '#3b82f6', '#7c3aed', '#ea580c', '#0891b2', '#65a30d', '#db2777', '#0d9488', '#ca8a04'];
  const etfSectorData = (() => {
    if (aktieveTab !== 'sector' && aktieveTab !== 'regio') return [];
    const bron = aktieveTab === 'regio' ? etfData?.landen : etfData?.sectoren;
    if (!bron || bron.length === 0) return [];
    return bron
      .slice().sort((a, b) => b.pct - a.pct)
      .map((s, i) => ({ naam: s.label, pct: s.pct, kleur: ETF_KLEUREN[i % ETF_KLEUREN.length] }));
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {belegging.logo ? (
              <img src={belegging.logo} alt={belegging.symbol}
                style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain', border: '1px solid var(--border)', background: 'white', padding: 3, flexShrink: 0 }}
                onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
            ) : null}
            <div className="belegging-avatar" style={{ width: 40, height: 40, fontSize: 14, display: belegging.logo ? 'none' : 'flex' }}>
              {belegging.symbol.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{belegging.naam}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{belegging.symbol}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Koers + dagverandering */}
        <div className="detail-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="detail-koers">{muntSym}{huidigePrijs.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            {!dagToonbaar && (
              <span style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
                Beurs gesloten
              </span>
            )}
          </div>
          {dagToonbaar ? (
            <div style={{ fontSize: 14, color: dagVPctRaw >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4, fontWeight: 500 }}>
              {dagVPctRaw >= 0 ? '+' : ''}{dagVPctRaw.toFixed(2)}% ({dagVRaw >= 0 ? '+' : ''}{muntSym}{Math.abs(dagVRaw).toFixed(2)})
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
              — Beurs gesloten
            </div>
          )}
        </div>

        {/* Tijdperk tabs */}
        <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border-light)' }}>
          <div className="time-tabs" style={{ display: 'flex' }}>
            {TIJDPERKEN.map(t => (
              <button key={t} className={`time-tab ${tijdperk === t ? 'active' : ''}`}
                onClick={() => setTijdperk(t)}
                style={{ flex: 1, padding: '5px 2px', fontSize: 12 }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Grafiek */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-light)' }}>
          {grafiekLoading ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {beursGesloten && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  background: 'rgba(255,255,255,0.9)', borderRadius: 8,
                  padding: '5px 12px', fontSize: 11, color: 'var(--text-muted)',
                  fontWeight: 600, zIndex: 5, border: '1px solid var(--border)',
                  whiteSpace: 'nowrap', pointerEvents: 'none'
                }}>🔒 Beurs gesloten</div>
              )}
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={grafiekData}>
                <defs>
                  <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={grafiekKleur} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={grafiekKleur} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} ticks={detailXTicks} tickFormatter={detailXFormatter} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => muntSym + v.toFixed(0)} domain={['auto', 'auto']} width={55} />
                <Tooltip
                  formatter={v => [muntSym + v.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'Koers']}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
                />
                {tijdperk === '1D' && koers?.pc != null && belegging.type !== 'crypto' && (
                  <ReferenceLine
                    y={koers.pc}
                    ifOverflow="extendDomain"
                    stroke="var(--text-muted)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: `Slot vorige dag: ${muntSym}${koers.pc.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, position: 'insideTopLeft', fontSize: 10, fill: 'var(--text-muted)' }}
                  />
                )}
                <Area type="monotone" dataKey="prijs" stroke={grafiekKleur} strokeWidth={2} fill="url(#detailGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          )}

          {/* Open/hoog/laag/volume + extra metrics */}
          {koers && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
              {[
                { l: 'Open', v: muntSym + (koers.o || 0).toFixed(2) },
                { l: 'Laagste', v: muntSym + (koers.l || 0).toFixed(2) },
                { l: 'Hoogste', v: muntSym + (koers.h || 0).toFixed(2) },
                { l: 'Volume', v: (koers.v || 0) > 1000000 ? ((koers.v || 0) / 1000000).toFixed(1) + ' mln.' : (koers.v || 0).toLocaleString() },
                metrics?.['peNormalizedAnnual'] ? { l: 'Koers-winstverhouding', v: metrics['peNormalizedAnnual'].toFixed(1) } : null,
                profiel?.marketCapitalization ? { l: 'Beurswaarde', v: '$' + (profiel.marketCapitalization).toFixed(1) + ' mld.' } : null,
              ].filter(Boolean).map(({ l, v }) => (
                <div key={l}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{l}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Je belegging */}
        <div className="detail-section">
          <h3>Je belegging</h3>
          <div className="detail-grid">
            <div>
              <div className="detail-item-label">Aantal</div>
              <div className="detail-item-value">{belegging.aantal}</div>
            </div>
            <div>
              <div className="detail-item-label">Gem. prijs</div>
              <div className="detail-item-value">€{(belegging.kostprijs * factor).toFixed(2)}</div>
            </div>
            <div>
              <div className="detail-item-label">Totale waarde</div>
              <div className="detail-item-value">€{huidigeWaarde.toFixed(2)}</div>
            </div>
            <div>
              <div className="detail-item-label">Gewicht</div>
              <div className="detail-item-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {gewicht.toFixed(1)}%
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <circle cx="9" cy="9" r="8" fill="none" stroke="var(--border)" strokeWidth="2"/>
                  <circle cx="9" cy="9" r="8" fill="none" stroke="var(--accent)" strokeWidth="2"
                    strokeDasharray={`${gewicht / 100 * 50.3} 50.3`} strokeLinecap="round"
                    transform="rotate(-90 9 9)"/>
                </svg>
              </div>
            </div>
            <div>
              <div className="detail-item-label">Winst vandaag</div>
              <div className="detail-item-value" style={{ color: dagToonbaar ? (dagVEur >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)' }}>
                {dagToonbaar ? `${dagVEur >= 0 ? '+' : ''}€${Math.abs(dagVEur).toFixed(2)}` : '—'}
              </div>
            </div>
            <div>
              <div className="detail-item-label">Totale winst</div>
              <div className="detail-item-value" style={{ color: winstTotaal >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {winstTotaal >= 0 ? '+' : ''}€{Math.abs(winstTotaal).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Bedrijfsinfo */}
        {profiel && (
          <div className="detail-section">
            <h3>Bedrijfsinfo</h3>
            <div className="detail-grid">
              {profiel.finnhubIndustry && (
                <div>
                  <div className="detail-item-label">Sector</div>
                  <div className="detail-item-value" style={{ fontSize: 13 }}>{profiel.finnhubIndustry}</div>
                </div>
              )}
              {profiel.finnhubIndustry && (
                <div>
                  <div className="detail-item-label">Industrie</div>
                  <div className="detail-item-value" style={{ fontSize: 13 }}>{profiel.finnhubIndustry}</div>
                </div>
              )}
              {profiel.employeeTotal && (
                <div>
                  <div className="detail-item-label">Werknemers</div>
                  <div className="detail-item-value" style={{ fontSize: 13 }}>{parseInt(profiel.employeeTotal).toLocaleString()}</div>
                </div>
              )}
              {profiel.ipo && (
                <div>
                  <div className="detail-item-label">Beursgang</div>
                  <div className="detail-item-value" style={{ fontSize: 13 }}>
                    {new Date(profiel.ipo).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              )}
              {profiel.cusip && (
                <div>
                  <div className="detail-item-label">CEO</div>
                  <div className="detail-item-value" style={{ fontSize: 13 }}>{profiel.name}</div>
                </div>
              )}
              {profiel.isin && (
                <div>
                  <div className="detail-item-label">ISIN</div>
                  <div className="detail-item-value" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {profiel.isin}
                    <button onClick={() => kopieerISIN(profiel.isin)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                      {gekopieerd ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Beschrijving */}
            {profiel.description && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Over</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {beschrijvingUitgeklapt ? profiel.description : profiel.description.slice(0, 180) + (profiel.description.length > 180 ? '...' : '')}
                </div>
                {profiel.description.length > 180 && (
                  <button onClick={() => setBeschrijvingUitgeklapt(!beschrijvingUitgeklapt)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, cursor: 'pointer', padding: '4px 0', fontWeight: 600 }}>
                    {beschrijvingUitgeklapt ? 'Minder' : 'Lees meer'}
                  </button>
                )}
              </div>
            )}

            {profiel.weburl && (
              <a href={profiel.weburl} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>
                <ExternalLink size={13} /> Website bezoeken
              </a>
            )}
          </div>
        )}

        {/* ETF Verdeling */}
        {belegging.type === 'etf' && (
          <div className="detail-section">
            <h3>ETF Verdeling</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {['Sector', 'Regio', 'Effect type'].map(t => (
                <button key={t} onClick={() => setAktieveTab(t.toLowerCase())}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)',
                    background: aktieveTab === t.toLowerCase() ? 'var(--text-primary)' : 'transparent',
                    color: aktieveTab === t.toLowerCase() ? 'white' : 'var(--text-secondary)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500
                  }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {etfDataLaden ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Laden...</div>
              ) : etfSectorData.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
                  {aktieveTab === 'effect type' ? 'Geen data beschikbaar voor dit type.' : 'Geen data beschikbaar voor dit effect.'}
                </div>
              ) : (
                <>
              <svg width="110" height="110" viewBox="0 0 120 120">
                {etfSectorData.reduce((acc, item) => {
                  const total = etfSectorData.reduce((s, d) => s + d.pct, 0);
                  const angle = (item.pct / total) * 360;
                  const endAngle = acc.angle + angle;
                  const r = 50, cx = 60, cy = 60, inner = 28;
                  const toRad = a => (a - 90) * Math.PI / 180;
                  const x1 = cx + r * Math.cos(toRad(acc.angle)), y1 = cy + r * Math.sin(toRad(acc.angle));
                  const x2 = cx + r * Math.cos(toRad(endAngle)), y2 = cy + r * Math.sin(toRad(endAngle));
                  const xi1 = cx + inner * Math.cos(toRad(acc.angle)), yi1 = cy + inner * Math.sin(toRad(acc.angle));
                  const xi2 = cx + inner * Math.cos(toRad(endAngle)), yi2 = cy + inner * Math.sin(toRad(endAngle));
                  const large = angle > 180 ? 1 : 0;
                  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`;
                  acc.elements.push(<path key={item.naam} d={d} fill={item.kleur} stroke="white" strokeWidth="1.5" />);
                  acc.angle = endAngle;
                  return acc;
                }, { angle: 0, elements: [] }).elements}
              </svg>
              <div style={{ flex: 1 }}>
                {etfSectorData.slice(0, 7).map(s => (
                  <div key={s.naam} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <div style={{ width: 28, height: 4, borderRadius: 2, background: s.kleur, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, flex: 1 }}>{s.naam}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{s.pct.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Top 10 onderliggende (ETF) */}
        {belegging.type === 'etf' && (
          <div className="detail-section">
            <h3>Top 10 onderliggende beleggingen</h3>
            {etfDataLaden ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>Laden...</div>
            ) : !etfData?.holdings || etfData.holdings.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>Geen holdings-data beschikbaar voor dit effect.</div>
            ) : etfData.holdings.slice(0, 10).map(({ asset, name, weightPercentage }) => (
              <div key={asset} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={`https://assets.parqet.com/logos/symbol/${asset.split('.')[0]}?format=png`} alt={asset}
                    style={{ width: 26, height: 26, objectFit: 'contain' }}
                    onError={e => { e.target.style.display='none'; e.target.parentNode.style.background='var(--accent-bg)'; e.target.parentNode.innerHTML=`<span style="color:var(--accent);font-weight:700;font-size:11px">${asset.slice(0,2).toUpperCase()}</span>`; }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{name || asset}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{asset}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{(weightPercentage || 0).toFixed(2)}%</div>
              </div>
            ))}
          </div>
        )}

        {/* Nieuws */}
        {nieuws.length > 0 && (
          <div className="detail-section">
            <h3>Laatste nieuws</h3>
            {nieuws.map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noreferrer"
                style={{ display: 'block', padding: '12px 0', borderBottom: '1px solid var(--border-light)', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{n.headline}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {n.source} · {new Date(n.datetime * 1000).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </a>
            ))}
          </div>
        )}

        {/* AI Analyse */}
        <div className="detail-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3>AI Analyse</h3>
            {!analyse && !analyseLoading && (
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={laadAnalyse}>
                Genereer analyse
              </button>
            )}
          </div>
          {analyseLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Analyse wordt gegenereerd...</span>
            </div>
          )}
          {analyse && (
            <div className="analyse-ai-box">
              <h4>🤖 Matico AI Analyse</h4>
              <p>{analyse}</p>
            </div>
          )}
        </div>

        <div style={{ height: 32 }} />
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
