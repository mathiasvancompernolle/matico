import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Loader } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TIJDPERKEN = ['1D', '1W', '1M', '1J', 'YTD', '3J', '5J', 'Max'];

export default function BeleggingDetail({ belegging, onClose }) {
  const { koersen } = useApp();
  const [tijdperk, setTijdperk] = useState('1D');
  const [grafiekData, setGrafiekData] = useState([]);
  const [profiel, setProfiel] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [nieuws, setNieuws] = useState([]);
  const [analyse, setAnalyse] = useState(null);
  const [analyseLoading, setAnalyseLoading] = useState(false);
  const [aktieveTab, setAktieveTab] = useState('sector');

  const koers = koersen[belegging.symbol];
  const huidigePrijs = koers ? koers.c : belegging.kostprijs;
  const factor = (belegging.munt || 'EUR') === 'USD' ? 0.92 : 1;
  const huidigeWaarde = huidigePrijs * belegging.aantal * factor;
  const winstTotaal = huidigeWaarde - belegging.kostprijs * belegging.aantal * factor;
  const winstTotaalPct = belegging.kostprijs > 0 ? (winstTotaal / (belegging.kostprijs * belegging.aantal * factor)) * 100 : 0;
  const dagV = koers ? (koers.c - koers.pc) : 0;
  const dagVPct = koers && koers.pc > 0 ? ((koers.c - koers.pc) / koers.pc) * 100 : 0;

  const muntSym = (belegging.munt || 'EUR') === 'USD' ? '$' : '€';

  // Laad grafiek data
  useEffect(() => {
    const punten = tijdperk === '1D' ? 8 : tijdperk === '1W' ? 7 : 30;
    const now = Date.now();
    const data = [];
    for (let i = punten; i >= 0; i--) {
      const t = new Date(now - i * (tijdperk === '1D' ? 3600000 : 86400000));
      const ruis = (Math.random() - 0.502) * huidigePrijs * 0.005 * i;
      data.push({
        label: tijdperk === '1D'
          ? t.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
          : t.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }),
        prijs: Math.max(0, huidigePrijs + ruis)
      });
    }
    setGrafiekData(data);
  }, [tijdperk, huidigePrijs]);

  // Laad profiel & nieuws
  useEffect(() => {
    const laad = async () => {
      try {
        const [profielRes, metricsRes, nieuwsRes] = await Promise.all([
          fetch(`/api/data?endpoint=profile&symbol=${belegging.symbol}`),
          fetch(`/api/data?endpoint=metrics&symbol=${belegging.symbol}`),
          fetch(`/api/data?endpoint=news&symbol=${belegging.symbol}`)
        ]);
        const p = await profielRes.json();
        const m = await metricsRes.json();
        const n = await nieuwsRes.json();
        if (p.name) setProfiel(p);
        if (m.metric) setMetrics(m.metric);
        if (Array.isArray(n)) setNieuws(n.slice(0, 5));
      } catch (e) {
        console.error('Detail data fout:', e);
      }
    };
    laad();
  }, [belegging.symbol]);

  const laadAnalyse = async () => {
    setAnalyseLoading(true);
    try {
      const res = await fetch('/api/data?endpoint=ai-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: belegging.symbol,
          name: belegging.naam,
          price: huidigePrijs,
          change: dagVPct.toFixed(2)
        })
      });
      const data = await res.json();
      setAnalyse(data.analyse);
    } catch (e) {
      setAnalyse('Analyse momenteel niet beschikbaar.');
    }
    setAnalyseLoading(false);
  };

  // Nep ETF verdeling data
  const etfSectorData = [
    { naam: 'Technologie', pct: 29.01, kleur: '#6366f1' },
    { naam: 'Financiële dienstverlening', pct: 16.10, kleur: '#8b5cf6' },
    { naam: 'Industrie', pct: 11.04, kleur: '#a78bfa' },
    { naam: 'Cyclische consumptiegoederen', pct: 9.43, kleur: '#22c55e' },
    { naam: 'Communicatiediensten', pct: 8.82, kleur: '#16a34a' },
    { naam: 'Gezondheidszorg', pct: 8.01, kleur: '#7c3aed' },
    { naam: 'Defensieve consumentengoederen', pct: 4.95, kleur: '#f97316' },
    { naam: 'Energie', pct: 4.21, kleur: '#eab308' },
    { naam: 'Basismaterialen', pct: 3.84, kleur: '#ef4444' },
    { naam: 'Nutsbedrijven', pct: 2.68, kleur: '#06b6d4' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="belegging-avatar" style={{ width: 40, height: 40, fontSize: 14 }}>
              {belegging.symbol.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{belegging.naam}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{belegging.symbol}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Koers */}
        <div className="detail-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="detail-koers">{muntSym}{huidigePrijs.toFixed(2)}</div>
            {koers?.t && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', background: '#fef9c3', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                Beurs gesloten
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: dagVPct >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
            {dagVPct >= 0 ? '+' : ''}{dagVPct.toFixed(2)}% ({dagV >= 0 ? '+' : ''}{muntSym}{dagV.toFixed(2)})
          </div>
        </div>

        {/* Tijdperk tabs */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-light)' }}>
          <div className="time-tabs" style={{ display: 'flex' }}>
            {TIJDPERKEN.map(t => (
              <button key={t} className={`time-tab ${tijdperk === t ? 'active' : ''}`} onClick={() => setTijdperk(t)} style={{ flex: 1, padding: '5px 4px', fontSize: 12 }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Grafiek */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-light)' }}>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={grafiekData}>
              <defs>
                <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => muntSym + v.toFixed(0)} domain={['auto', 'auto']} />
              <Tooltip formatter={v => [muntSym + v.toFixed(2), 'Koers']} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
              <Area type="monotone" dataKey="prijs" stroke="#6366f1" strokeWidth={2} fill="url(#detailGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>

          {/* Open/hoog/laag/volume */}
          {koers && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              {[
                { l: 'Open', v: muntSym + (koers.o || 0).toFixed(2) },
                { l: 'Laagste', v: muntSym + (koers.l || 0).toFixed(2) },
                { l: 'Volume', v: (koers.v || 0).toLocaleString() },
                { l: 'Hoogste', v: muntSym + (koers.h || 0).toFixed(2) },
              ].map(({ l, v }) => (
                <div key={l}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l}</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v}</div>
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
              <div className="detail-item-value">{muntSym}{belegging.kostprijs.toFixed(2)}</div>
            </div>
            <div>
              <div className="detail-item-label">Totale waarde</div>
              <div className="detail-item-value">€{huidigeWaarde.toFixed(2)}</div>
            </div>
            <div>
              <div className="detail-item-label">Gewicht</div>
              <div className="detail-item-value">{((huidigeWaarde / (huidigeWaarde || 1)) * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="detail-item-label">Winst vandaag</div>
              <div className="detail-item-value" style={{ color: dagV >= 0 ? 'var(--green)' : 'var(--red)' }}>
                €{(dagV * belegging.aantal * factor).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="detail-item-label">Totale winst</div>
              <div className="detail-item-value" style={{ color: winstTotaal >= 0 ? 'var(--green)' : 'var(--red)' }}>
                €{winstTotaal.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Profiel info */}
        {profiel && (
          <div className="detail-section">
            <h3>{belegging.type === 'etf' ? 'ETF info' : 'Bedrijfsinfo'}</h3>
            <div className="detail-grid">
              {[
                { l: 'Aanbieder', v: profiel.name },
                { l: 'Land', v: profiel.country },
                { l: 'Sector', v: profiel.finnhubIndustry },
                { l: 'Marktkap.', v: profiel.marketCapitalization ? '€' + (profiel.marketCapitalization / 1000).toFixed(1) + ' mld.' : '-' },
              ].map(({ l, v }) => v && (
                <div key={l}>
                  <div className="detail-item-label">{l}</div>
                  <div className="detail-item-value" style={{ fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETF Verdeling (voor ETFs) */}
        {belegging.type === 'etf' && (
          <div className="detail-section">
            <h3>ETF Verdeling</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {['sector', 'regio', 'effect type'].map(t => (
                <button
                  key={t}
                  onClick={() => setAktieveTab(t)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)',
                    background: aktieveTab === t ? 'var(--text-primary)' : 'transparent',
                    color: aktieveTab === t ? 'white' : 'var(--text-secondary)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                    textTransform: 'capitalize'
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {/* Donut chart */}
              <svg width="120" height="120" viewBox="0 0 120 120">
                {etfSectorData.reduce((acc, item, i) => {
                  const total = etfSectorData.reduce((s, d) => s + d.pct, 0);
                  const startAngle = acc.angle;
                  const angle = (item.pct / total) * 360;
                  const endAngle = startAngle + angle;
                  const r = 50, cx = 60, cy = 60, inner = 30;
                  const toRad = a => (a - 90) * Math.PI / 180;
                  const x1 = cx + r * Math.cos(toRad(startAngle));
                  const y1 = cy + r * Math.sin(toRad(startAngle));
                  const x2 = cx + r * Math.cos(toRad(endAngle));
                  const y2 = cy + r * Math.sin(toRad(endAngle));
                  const xi1 = cx + inner * Math.cos(toRad(startAngle));
                  const yi1 = cy + inner * Math.sin(toRad(startAngle));
                  const xi2 = cx + inner * Math.cos(toRad(endAngle));
                  const yi2 = cy + inner * Math.sin(toRad(endAngle));
                  const large = angle > 180 ? 1 : 0;
                  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`;
                  acc.elements.push(<path key={i} d={d} fill={item.kleur} stroke="white" strokeWidth="1" />);
                  acc.angle = endAngle;
                  return acc;
                }, { angle: 0, elements: [] }).elements}
              </svg>
              <div style={{ flex: 1 }}>
                {etfSectorData.slice(0, 6).map(s => (
                  <div key={s.naam} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.kleur, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 12, flex: 1 }}>{s.naam}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Top 10 onderliggende (voor ETFs) */}
        {belegging.type === 'etf' && (
          <div className="detail-section">
            <h3>Top 10 onderliggende beleggingen</h3>
            {[
              { naam: 'NVIDIA Corporation', sym: 'NVDA', pct: 4.66 },
              { naam: 'Apple Inc', sym: 'AAPL', pct: 3.90 },
              { naam: 'Microsoft Corporation', sym: 'MSFT', pct: 3.02 },
              { naam: 'Amazon.com Inc', sym: 'AMZN', pct: 2.54 },
              { naam: 'Alphabet Inc Class A', sym: 'GOOGL', pct: 2.23 },
              { naam: 'Broadcom Inc', sym: 'AVGO', pct: 1.92 },
              { naam: 'Alphabet Inc Class C', sym: 'GOOG', pct: 1.81 },
              { naam: 'Taiwan Semiconductor', sym: '2330', pct: 1.63 },
              { naam: 'Meta Platforms Inc.', sym: 'META', pct: 1.33 },
              { naam: 'Tesla Inc', sym: 'TSLA', pct: 1.07 },
            ].map(({ naam, sym, pct }) => (
              <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div className="belegging-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{sym.slice(0, 2)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{naam}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sym}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{pct}%</div>
              </div>
            ))}
          </div>
        )}

        {/* Metrics */}
        {metrics && (
          <div className="detail-section">
            <h3>Kerncijfers</h3>
            <div className="detail-grid">
              {[
                { l: 'P/E ratio', v: metrics['peNormalizedAnnual']?.toFixed(1) },
                { l: '52w hoog', v: metrics['52WeekHigh'] ? muntSym + metrics['52WeekHigh']?.toFixed(2) : null },
                { l: '52w laag', v: metrics['52WeekLow'] ? muntSym + metrics['52WeekLow']?.toFixed(2) : null },
                { l: 'Beta', v: metrics['beta']?.toFixed(2) },
              ].filter(i => i.v).map(({ l, v }) => (
                <div key={l}>
                  <div className="detail-item-label">{l}</div>
                  <div className="detail-item-value" style={{ fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nieuws */}
        {nieuws.length > 0 && (
          <div className="detail-section">
            <h3>Laatste nieuws</h3>
            {nieuws.map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid var(--border-light)', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{n.headline}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {n.source} · {new Date(n.datetime * 1000).toLocaleDateString('nl-BE')}
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
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
