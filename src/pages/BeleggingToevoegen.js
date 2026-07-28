import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, Building2, Bitcoin, PiggyBank, ArrowLeft, Search, Loader, X } from 'lucide-react';

const TYPES = [
  { id: 'aandeel', label: 'Aandeel', beschrijving: 'Zoek en voeg beursgenoteerde aandelen toe', icon: TrendingUp },
  { id: 'etf', label: 'ETF', beschrijving: 'Zoek en voeg een ETF/Tracker toe', icon: Building2 },
  { id: 'crypto', label: 'Crypto', beschrijving: 'Zoek en voeg crypto toe', icon: Bitcoin },
  { id: 'manueel', label: 'Zelf op te volgen belegging', beschrijving: 'Handig voor cashrekeningen, pensioensparen, periodieke beleggingen en andere beleggingsplannen', icon: PiggyBank },
];

export default function BeleggingToevoegen({ onClose }) {
  const { setBeleggingen, setVerkochteBeleggingen, fetchKoers } = useApp();
  const [stap, setStap] = useState('type');
  const [type, setType] = useState(null);
  const [zoekterm, setZoekterm] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [zoekLoading, setZoekLoading] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState(null);
  const [form, setForm] = useState({ datum: '', kostprijs: '', aantal: '', munt: 'EUR', transactiekosten: '' });
  // Multi-selectie
  const [selectie, setSelectie] = useState([]); // [{...resultaat}]
  const [multiForms, setMultiForms] = useState({}); // { symbol: { datum, kostprijs, aantal, munt, transactiekosten } }
  const [wisselkoersOpDatum, setWisselkoersOpDatum] = useState(1);
  const [wisselkoersLoading, setWisselkoersLoading] = useState(false);
  // Beperkte info: enkel aan-/verkoopbedrag + datum gekend, de app schat de rest
  const [beperkteInfoModus, setBeperkteInfoModus] = useState(false);
  const [beperkteForm, setBeperkteForm] = useState({ aankoopbedrag: '', aankoopdatum: '', verkocht: false, verkoopbedrag: '', verkoopdatum: '' });
  const [beperkteOpslaanLoading, setBeperkteOpslaanLoading] = useState(false);
  const [beperkteFout, setBeperkteFout] = useState('');

  // Historische wisselkoers naar EUR ophalen wanneer munt of datum verandert
  useEffect(() => {
    if (form.munt === 'EUR') {
      setWisselkoersOpDatum(1);
      return;
    }
    if (!form.datum) return;
    let actief = true;
    setWisselkoersLoading(true);
    fetch(`/api/data?endpoint=forex-history&datum=${form.datum}&van=${form.munt}`)
      .then(res => res.json())
      .then(data => { if (actief && data?.rate) setWisselkoersOpDatum(data.rate); })
      .catch(() => {})
      .finally(() => { if (actief) setWisselkoersLoading(false); });
    return () => { actief = false; };
  }, [form.munt, form.datum]);

  useEffect(() => {
    if (zoekterm.length < 2) { setZoekResultaten([]); return; }
    const timer = setTimeout(async () => {
      setZoekLoading(true);
      try {
        const res = await fetch(`/api/data?endpoint=search&q=${encodeURIComponent(zoekterm)}`);
        const data = await res.json();
        // Nieuwe API geeft { resultaten: [...] }, fallback op oude Finnhub { result: [...] }
        const resultaten = data.resultaten || (data.result || []).map(r => ({
          naam: r.naam || r.description,
          symbol: r.symbol,
          beurs: r.type,
          type: r.type === 'ETF' ? 'etf' : 'aandeel',
        }));
        setZoekResultaten(resultaten.filter(r => {
          if (type === 'aandeel') return r.type === 'aandeel' || !r.type;
          if (type === 'etf') return r.type === 'etf';
          if (type === 'crypto') return r.type === 'crypto';
          return true;
        }).slice(0, 10));
      } catch {
        setZoekResultaten([]);
      }
      setZoekLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [zoekterm]);

  const kiesType = (t) => {
    setType(t);
    setStap('zoek');
  };

  const kiesAandeel = async (r) => {
    setGeselecteerd(r);
    setStap('invoer');
    // Haal koers en logo tegelijk op
    const [koers] = await Promise.all([
      fetchKoers(r.symbol),
      // Haal logo op via profile endpoint
      fetch(`/api/data?endpoint=profile&symbol=${encodeURIComponent(r.symbol)}`)
        .then(res => res.json())
        .then(data => {
          const logo = data.logo || data.image || '';
          if (logo) setGeselecteerd(prev => ({ ...prev, logo }));
        })
        .catch(() => {})
    ]);
    if (koers?.c) {
      const munt = (() => {
      if (geselecteerd?.symbol?.includes('-USD')) return 'USD';
      if (geselecteerd?.symbol?.includes('-GBP')) return 'GBP';
      if (geselecteerd?.valuta === 'USD' || koers?.currency === 'USD') return 'USD';
      if (geselecteerd?.valuta === 'GBP' || koers?.currency === 'GBP') return 'GBP';
      const us = ['NMS','NYQ','NGM','ASE','PCX','BATS'];
      if (us.some(e => (geselecteerd?.beurs || '').toUpperCase().includes(e))) return 'USD';
      return 'EUR';
    })();
    setForm(f => ({ ...f, kostprijs: koers.c.toFixed(2), munt }));
    }
  };

  const toggleSelectie = async (r) => {
    const al = selectie.find(s => s.symbol === r.symbol);
    if (al) {
      setSelectie(prev => prev.filter(s => s.symbol !== r.symbol));
      setMultiForms(prev => { const n = {...prev}; delete n[r.symbol]; return n; });
    } else {
      setSelectie(prev => [...prev, r]);
      // Pre-fill koers
      const koers = await fetchKoers(r.symbol);
      setMultiForms(prev => ({
        ...prev,
        [r.symbol]: {
          datum: new Date().toISOString().split('T')[0],
          kostprijs: koers?.c ? koers.c.toFixed(2) : '',
          aantal: '',
          munt: (() => {
            // Crypto
            if (r.symbol?.includes('-USD')) return 'USD';
            if (r.symbol?.includes('-GBP')) return 'GBP';
            if (r.symbol?.includes('-EUR')) return 'EUR';
            // Via valuta uit zoekresultaat
            if (r.valuta === 'USD') return 'USD';
            if (r.valuta === 'GBP') return 'GBP';
            // US beurzen via exchange code
            const us = ['NMS','NYQ','NGM','ASE','PCX','BATS','NAS','NYSE'];
            if (us.some(e => (r.beurs || r.exchange || '').toUpperCase().includes(e))) return 'USD';
            // UK beurzen
            if ((r.beurs || '').toUpperCase().includes('LSE') || r.symbol?.endsWith('.L')) return 'GBP';
            // Koers valuta als beschikbaar
            if (koers?.currency === 'USD') return 'USD';
            if (koers?.currency === 'GBP') return 'GBP';
            return 'EUR';
          })(),
          transactiekosten: '',
        }
      }));
      // Logo ophalen
      try {
        const res = await fetch(`/api/data?endpoint=profile&symbol=${encodeURIComponent(r.symbol)}`);
        const d = await res.json();
        const logo = d.logo || d.image || '';
        if (logo) setSelectie(prev => prev.map(s => s.symbol === r.symbol ? {...s, logo} : s));
      } catch {}
    }
  };

  const updateMultiForm = (symbol, veld, waarde) => {
    setMultiForms(prev => ({ ...prev, [symbol]: { ...prev[symbol], [veld]: waarde } }));
  };

  const opslaanMulti = () => {
    const nieuw = selectie.map(r => {
      const f = multiForms[r.symbol] || {};
      if (!f.datum || !f.kostprijs || !f.aantal) return null;
      const kostprijsPerStuk = parseFloat(f.kostprijs);
      const aantalStuks = parseFloat(f.aantal);
      const transactiekosten = parseFloat(f.transactiekosten) || 0;
      return {
        id: Date.now() + Math.random(),
        symbol: r.symbol,
        naam: r.naam || r.symbol,
        logo: r.logo || '',
        type: r.type || type || 'aandeel',
        datum: f.datum,
        kostprijs: kostprijsPerStuk,
        transactiekosten,
        aantal: aantalStuks,
        munt: f.munt,
      };
    }).filter(Boolean);
    if (nieuw.length === 0) return;
    setBeleggingen(prev => [...prev, ...nieuw]);
    onClose();
  };

  const opslaanMultiBeperkt = async () => {
    setBeperkteFout('');
    setBeperkteOpslaanLoading(true);
    const nieuweActief = [];
    const nieuweVerkocht = [];

    for (const r of selectie) {
      const f = multiForms[r.symbol] || {};
      if (!f.aankoopbedrag || !f.datum) continue;
      const ingevoerdBedrag = parseFloat(f.aankoopbedrag);
      const ingevoerdeMunt = f.munt || 'EUR';
      const historischeKoers = await haalHistorischeKoers(r.symbol, f.datum);
      if (!historischeKoers || historischeKoers <= 0) {
        setBeperkteFout(`Geen historische koers gevonden voor ${r.naam || r.symbol} op ${f.datum}. Die positie werd overgeslagen.`);
        continue;
      }
      // Het effect zelf noteert mogelijk in een andere munt dan waarin je
      // het bedrag invulde (bv. je betaalde in euro via je bank, maar het
      // aandeel noteert in dollar) — reken daarom eerst om naar de munt
      // waarin de historische koers hierboven staat, vóór we delen.
      const nativeMunt = bepaalNativeMunt(r);
      const bedragInNativeMunt = await zetBedragOmNaarNativeMunt(ingevoerdBedrag, ingevoerdeMunt, nativeMunt, f.datum);

      // Ga uit van een realistisch gemiddeld kostenpercentage (i.p.v. 0%
      // kosten) om het aantal stuks te schatten, en scheid nadien koers en
      // kosten netjes: kostprijs = de échte historische koers, het verschil
      // met je ingevulde bedrag komt in transactiekosten terecht.
      const effectType = r.type || type || 'aandeel';
      const kostenPct = GEMIDDELD_KOSTENPERCENTAGE[effectType] ?? 0.01;
      const geschatAantal = Math.max(1, Math.round(bedragInNativeMunt / (historischeKoers * (1 + kostenPct))));
      const geschatteTransactiekosten = Math.max(0, bedragInNativeMunt - (geschatAantal * historischeKoers));
      const basis = {
        id: Date.now() + Math.random(),
        symbol: r.symbol,
        naam: r.naam || r.symbol,
        logo: r.logo || '',
        type: effectType,
        datum: f.datum,
        kostprijs: historischeKoers,
        transactiekosten: Math.round(geschatteTransactiekosten * 100) / 100,
        aantal: geschatAantal,
        munt: nativeMunt,
        geschat: true,
      };

      if (f.verkocht && f.verkoopbedrag && f.verkoopdatum) {
        const verkoopbedragIngevoerd = parseFloat(f.verkoopbedrag);
        const verkoopbedragInNativeMunt = await zetBedragOmNaarNativeMunt(verkoopbedragIngevoerd, ingevoerdeMunt, nativeMunt, f.verkoopdatum);
        nieuweVerkocht.push({
          ...basis,
          verkoopdatum: f.verkoopdatum,
          aantalVerkocht: geschatAantal,
          verkoopkoers: verkoopbedragInNativeMunt / geschatAantal,
          verkoopMunt: nativeMunt,
          winstverlies: verkoopbedragInNativeMunt - bedragInNativeMunt,
        });
      } else {
        nieuweActief.push(basis);
      }
    }

    if (nieuweActief.length > 0) setBeleggingen(prev => [...prev, ...nieuweActief]);
    if (nieuweVerkocht.length > 0) setVerkochteBeleggingen(prev => [...(prev || []), ...nieuweVerkocht]);

    setBeperkteOpslaanLoading(false);
    if (nieuweActief.length > 0 || nieuweVerkocht.length > 0) onClose();
  };

  const opslaan = () => {
    if (!geselecteerd || !form.datum || !form.kostprijs || !form.aantal) return;
    const kostprijsPerStuk = parseFloat(form.kostprijs);
    const aantalStuks = parseFloat(form.aantal);
    const transactiekosten = parseFloat(form.transactiekosten) || 0;

    const nieuw = {
      id: Date.now(),
      symbol: geselecteerd.symbol,
      naam: geselecteerd.naam || geselecteerd.description || geselecteerd.symbol,
      logo: geselecteerd.logo || '',
      type,
      datum: form.datum,
      kostprijs: kostprijsPerStuk,
      transactiekosten,
      aantal: aantalStuks,
      munt: form.munt,
    };
    setBeleggingen(prev => [...prev, nieuw]);
    onClose();
  };

  // Zoekt de laatst-bekende koers op (of net vóór) een bepaalde datum op —
  // voor het geval de exacte datum geen handelsdag was (weekend/feestdag).
  // Gemiddeld kostenpercentage bij Belgische brokers (beurstaks + brokerkost
  // samen), gebruikt om bij "Beperkte info" een realistischer aantal stuks
  // te schatten dan wanneer we van 0% kosten zouden uitgaan. Aandelen: 0,35%
  // beurstaks + een typische brokerkost, samen goed voor pakweg 1%. ETF's:
  // meestal lagere beurstaks (0,12% bij de populaire, niet-Belgisch
  // geregistreerde trackers) en vaak goedkopere/gratis ETF-tarieven, samen
  // pakweg 0,5%. Dit is een gemiddelde benadering, geen exacte berekening
  // voor één specifieke broker.
  const GEMIDDELD_KOSTENPERCENTAGE = { aandeel: 0.01, etf: 0.005 };

  const haalHistorischeKoers = async (symbol, datumStr) => {
    const doelDatum = new Date(datumStr);
    const van = Math.floor(doelDatum.getTime() / 1000) - 5 * 24 * 60 * 60;
    const tot = Math.floor(doelDatum.getTime() / 1000) + 24 * 60 * 60;
    try {
      const res = await fetch(`/api/data?endpoint=candle&symbol=${encodeURIComponent(symbol)}&van=${van}&tot=${tot}&resolutie=D`);
      const data = await res.json();
      if (data?.s === 'ok' && data?.c?.length > 0) return data.c[data.c.length - 1];
    } catch (e) {}
    return null;
  };

  // Bepaalt in welke munt een effect zelf noteert (bv. USD voor een
  // Amerikaans aandeel) — dezelfde herkenning als bij toggleSelectie, zodat
  // we de historische koers (die in die munt staat) correct kunnen
  // vergelijken met het ingevulde bedrag.
  const bepaalNativeMunt = (r, koers) => {
    if (r.symbol?.includes('-USD')) return 'USD';
    if (r.symbol?.includes('-GBP')) return 'GBP';
    if (r.symbol?.includes('-EUR')) return 'EUR';
    if (r.valuta === 'USD') return 'USD';
    if (r.valuta === 'GBP') return 'GBP';
    const us = ['NMS','NYQ','NGM','ASE','PCX','BATS','NAS','NYSE'];
    if (us.some(e => (r.beurs || r.exchange || '').toUpperCase().includes(e))) return 'USD';
    if ((r.beurs || '').toUpperCase().includes('LSE') || r.symbol?.endsWith('.L')) return 'GBP';
    if (koers?.currency === 'USD') return 'USD';
    if (koers?.currency === 'GBP') return 'GBP';
    return 'EUR';
  };

  // 1 eenheid van `munt` = ? EUR, op een specifieke historische datum.
  const haalHistorischeWisselkoers = async (munt, datumStr) => {
    if (munt === 'EUR') return 1;
    try {
      const res = await fetch(`/api/data?endpoint=forex-history&datum=${datumStr}&van=${munt}`);
      const data = await res.json();
      return data?.rate || 1;
    } catch (e) { return 1; }
  };

  // Zet een bedrag van de munt waarin het ingevoerd werd om naar de munt
  // waarin het effect zelf noteert — nodig omdat je bv. in euro betaalde
  // (via je bank) voor een aandeel dat in dollar noteert, en de historische
  // koers dus ook in dollar staat.
  const zetBedragOmNaarNativeMunt = async (bedrag, ingevoerdeMunt, nativeMunt, datumStr) => {
    if (ingevoerdeMunt === nativeMunt) return bedrag;
    const koersIngevoerdNaarEur = await haalHistorischeWisselkoers(ingevoerdeMunt, datumStr); // 1 ingevoerdeMunt = X EUR
    const bedragInEur = bedrag * koersIngevoerdNaarEur;
    const koersNativeNaarEur = await haalHistorischeWisselkoers(nativeMunt, datumStr); // 1 nativeMunt = Y EUR
    return bedragInEur / koersNativeNaarEur;
  };

  // Beperkte info: enkel aan-/verkoopbedrag + datum gekend. De app schat het
  // aantal stuks (bedrag ÷ historische koers, afgerond naar een heel getal —
  // gangbaar bij een traditionele bank) en rekent de kostprijs per stuk
  // terug (bedrag ÷ geschat aantal), wat automatisch ook transactiekosten
  // mee opslorpt zonder die apart te moeten kennen.
  const opslaanBeperkt = async () => {
    if (!geselecteerd || !beperkteForm.aankoopbedrag || !beperkteForm.aankoopdatum) return;
    setBeperkteFout('');
    setBeperkteOpslaanLoading(true);

    const aankoopbedrag = parseFloat(beperkteForm.aankoopbedrag);
    const historischeKoers = await haalHistorischeKoers(geselecteerd.symbol, beperkteForm.aankoopdatum);
    if (!historischeKoers || historischeKoers <= 0) {
      setBeperkteFout('Geen historische koers gevonden voor deze datum. Probeer de gewone invoer met een geschat aantal.');
      setBeperkteOpslaanLoading(false);
      return;
    }

    // Aangenomen dat het bedrag in EUR werd ingevoerd (bv. je bankafschrift) —
    // reken om naar de munt waarin het effect zelf noteert, want de
    // historische koers hierboven staat in díe munt.
    const nativeMunt = bepaalNativeMunt(geselecteerd);
    const bedragInNativeMunt = await zetBedragOmNaarNativeMunt(aankoopbedrag, 'EUR', nativeMunt, beperkteForm.aankoopdatum);

    const kostenPct = GEMIDDELD_KOSTENPERCENTAGE[type] ?? 0.01;
    const geschatAantal = Math.max(1, Math.round(bedragInNativeMunt / (historischeKoers * (1 + kostenPct))));
    const geschatteTransactiekosten = Math.max(0, bedragInNativeMunt - (geschatAantal * historischeKoers));

    const basis = {
      id: Date.now(),
      symbol: geselecteerd.symbol,
      naam: geselecteerd.naam || geselecteerd.description || geselecteerd.symbol,
      logo: geselecteerd.logo || '',
      type,
      datum: beperkteForm.aankoopdatum,
      kostprijs: historischeKoers,
      transactiekosten: Math.round(geschatteTransactiekosten * 100) / 100,
      aantal: geschatAantal,
      munt: nativeMunt,
      geschat: true,
    };

    if (beperkteForm.verkocht && beperkteForm.verkoopbedrag && beperkteForm.verkoopdatum) {
      // Verkoopzijde is exact (geen schatting nodig): het aantal ligt al vast
      // via de aankoopzijde, dus verkoopkoers = verkoopbedrag ÷ dat aantal.
      const verkoopbedrag = parseFloat(beperkteForm.verkoopbedrag);
      const verkoopbedragInNativeMunt = await zetBedragOmNaarNativeMunt(verkoopbedrag, 'EUR', nativeMunt, beperkteForm.verkoopdatum);
      const verkoopkoersPerStuk = verkoopbedragInNativeMunt / geschatAantal;
      const verkocht = {
        ...basis,
        verkoopdatum: beperkteForm.verkoopdatum,
        aantalVerkocht: geschatAantal,
        verkoopkoers: verkoopkoersPerStuk,
        verkoopMunt: nativeMunt,
        winstverlies: verkoopbedragInNativeMunt - bedragInNativeMunt,
      };
      setVerkochteBeleggingen(prev => [...(prev || []), verkocht]);
    } else {
      setBeleggingen(prev => [...prev, basis]);
    }

    setBeperkteOpslaanLoading(false);
    onClose();
  };

  // Berekening voor preview
  const muntSymbool = (munt) => munt === 'USD' ? '$' : munt === 'GBP' ? '£' : '€';
  const kostprijsPerStuk = parseFloat(form.kostprijs) || 0;
  const aantalStuks = parseFloat(form.aantal) || 0;
  const transactiekosten = parseFloat(form.transactiekosten) || 0;
  const totaalKostprijs = kostprijsPerStuk * aantalStuks + transactiekosten;
  const totaalKostprijsEUR = totaalKostprijs * wisselkoersOpDatum;

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stap !== 'type' && (
            <button className="btn btn-ghost" onClick={() => stap === 'invoer' ? setStap('zoek') : stap === 'multi-invoer' ? setStap('zoek') : setStap('type')}>
              <ArrowLeft size={16} />
            </button>
          )}
          <h1>Beleggingen</h1>
        </div>

      </div>

      {/* Stap: type kiezen */}
      {stap === 'type' && (
        <div style={{ padding: '0 32px' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Wat wil je toevoegen?</h2>
          </div>
          <div className="toevoegen-grid">
            {TYPES.map(({ id, label, beschrijving, icon: Icon }) => (
              <div key={id} className="type-card" onClick={() => kiesType(id)}>
                <div className="type-icon"><Icon size={22} /></div>
                <div>
                  <h3>{label}</h3>
                  <p>{beschrijving}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stap: zoeken */}
      {stap === 'zoek' && (
        <div style={{ padding: '0 32px' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {type === 'aandeel' ? 'Aandeel zoeken' : type === 'etf' ? 'ETF zoeken' : 'Crypto zoeken'}
            </h2>
          </div>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="zoek-input" placeholder="Zoek op naam of symbool..."
              value={zoekterm} onChange={e => setZoekterm(e.target.value)} autoFocus />
            {zoekLoading && <Loader size={16} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {zoekResultaten.length === 0 && zoekterm.length >= 2 && !zoekLoading && (
              <div className="empty-state" style={{ padding: 30 }}><p>Geen resultaten gevonden voor "{zoekterm}"</p></div>
            )}
            {zoekResultaten.length === 0 && zoekterm.length < 2 && (
              <div className="empty-state" style={{ padding: 30 }}><p>Typ minimaal 2 tekens om te zoeken</p></div>
            )}
            {zoekResultaten.map(r => {
              const aangevinkt = selectie.some(s => s.symbol === r.symbol);
              return (
                <div key={r.symbol} className="zoek-resultaat"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: aangevinkt ? 'var(--accent-bg)' : 'transparent', borderLeft: aangevinkt ? '3px solid var(--accent)' : '3px solid transparent' }}
                  onClick={() => toggleSelectie(r)}>
                  {/* Checkbox */}
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${aangevinkt ? 'var(--accent)' : 'var(--border)'}`, background: aangevinkt ? 'var(--accent)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {aangevinkt && <span style={{ color: 'white', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="zoek-resultaat-naam">{r.naam || r.description}</div>
                    <div className="zoek-resultaat-symbol">{r.symbol} · {r.type || ''} · {r.beurs || r.displaySymbol || ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Toevoegen knop */}
          {selectie.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {selectie.length} belegging{selectie.length !== 1 ? 'en' : ''} geselecteerd
              </span>
              <button className="btn btn-primary" onClick={() => setStap('multi-invoer')}>
                Gegevens invullen ({selectie.length}) →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stap: multi-invoer tabel */}
      {stap === 'multi-invoer' && (
        <div style={{ padding: '0 24px' }}>
          {(type === 'aandeel' || type === 'etf') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                onClick={() => setBeperkteInfoModus(v => !v)}
                style={{
                  background: beperkteInfoModus ? 'var(--accent-bg)' : 'transparent',
                  color: beperkteInfoModus ? 'var(--accent)' : 'var(--text-muted)',
                  border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {beperkteInfoModus ? '✓ ' : ''}Beperkte info (enkel aan-/verkoopbedrag gekend)
              </button>
            </div>
          )}
          {beperkteInfoModus && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Handig als je enkel weet hoeveel je betaalde (bv. bij een oudere aankoop via een traditionele bank). We zoeken de historische koers op die datum op en <strong>schatten</strong> het aantal stuks (afgerond naar een geheel getal) en de kostprijs per stuk daaruit. Betaalde je in een andere munt dan waarin het effect zelf noteert (bv. euro voor een Amerikaans aandeel)? Kies gewoon de munt waarin je betaalde bij "Munt" — we rekenen dat automatisch om.
            </div>
          )}
          {/* Tabelheader */}
          {!beperkteInfoModus ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.8fr 0.7fr 1.1fr 32px', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            <span>Naam</span>
            <span>Aankoopprijs</span>
            <span>
              Transactiekosten
              <div style={{ fontWeight: 400, fontSize: 10, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 'normal' }}>optioneel, later aan te passen</div>
            </span>
            <span>Aantal</span>
            <span>Munt</span>
            <span>Aankoopdatum</span>
            <span></span>
          </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.7fr 1.1fr 32px', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            <span>Naam</span>
            <span>Aankoopbedrag (totaal)</span>
            <span>Munt</span>
            <span>Aankoopdatum</span>
            <span></span>
          </div>
          )}
          {/* Rijen */}
          {selectie.map(r => {
            const f = multiForms[r.symbol] || {};
            if (beperkteInfoModus) {
              return (
                <div key={r.symbol}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.7fr 1.1fr 32px', gap: 10, padding: '12px 0', borderBottom: f.verkocht ? 'none' : '1px solid var(--border-light)', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                        {r.symbol.slice(0,2).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.naam || r.symbol}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.symbol}</div>
                      </div>
                    </div>
                    <input type="number" value={f.aankoopbedrag || ''} onChange={e => updateMultiForm(r.symbol, 'aankoopbedrag', e.target.value)}
                      placeholder="€ 0,00" step="0.01"
                      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', width: '100%', background: 'var(--bg-white)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                    <select value={f.munt || 'EUR'} onChange={e => updateMultiForm(r.symbol, 'munt', e.target.value)}
                      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg-white)', color: 'var(--text-muted)', outline: 'none', cursor: 'pointer', width: '100%' }}>
                      <option>EUR</option><option>USD</option><option>GBP</option>
                    </select>
                    <input type="date" value={f.datum || ''} onChange={e => updateMultiForm(r.symbol, 'datum', e.target.value)}
                      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', fontSize: 13, fontFamily: 'inherit', width: '100%', background: 'var(--bg-white)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                    <button
                      onClick={() => toggleSelectie(r)}
                      title="Deze belegging niet toevoegen"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ padding: '0 0 12px', borderBottom: '1px solid var(--border-light)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={!!f.verkocht}
                        onChange={e => updateMultiForm(r.symbol, 'verkocht', e.target.checked)} />
                      Ondertussen verkocht
                    </label>
                    {f.verkocht && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                        <input type="number" value={f.verkoopbedrag || ''} onChange={e => updateMultiForm(r.symbol, 'verkoopbedrag', e.target.value)}
                          placeholder="Verkoopbedrag (totaal)" step="0.01"
                          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-white)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                        <input type="date" value={f.verkoopdatum || ''} onChange={e => updateMultiForm(r.symbol, 'verkoopdatum', e.target.value)}
                          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-white)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div key={r.symbol} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.8fr 0.7fr 1.1fr 32px', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border-light)', alignItems: 'center' }}>
                {/* Naam */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                    {r.symbol.slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.naam || r.symbol}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.symbol}</div>
                  </div>
                </div>
                {/* Aankoopprijs */}
                <input type="number" value={f.kostprijs || ''} onChange={e => updateMultiForm(r.symbol, 'kostprijs', e.target.value)}
                  placeholder="0,00" step="0.01"
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', width: '100%', background: 'var(--bg-white)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                {/* Transactiekosten */}
                <input type="number" value={f.transactiekosten || ''} onChange={e => updateMultiForm(r.symbol, 'transactiekosten', e.target.value)}
                  placeholder="0,00 (optioneel)" step="0.01"
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', width: '100%', background: 'var(--bg-white)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                {/* Aantal */}
                <input type="number" value={f.aantal || ''} onChange={e => updateMultiForm(r.symbol, 'aantal', e.target.value)}
                  placeholder="0" step="0.0001"
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-white)', color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                {/* Munt */}
                <select value={f.munt || 'EUR'} onChange={e => updateMultiForm(r.symbol, 'munt', e.target.value)}
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', fontSize: 12, fontFamily: 'inherit', background: 'var(--bg-white)', color: 'var(--text-muted)', outline: 'none', cursor: 'pointer', width: '100%' }}>
                  <option>EUR</option><option>USD</option><option>GBP</option>
                </select>
                {/* Datum */}
                <input type="date" value={f.datum || ''} onChange={e => updateMultiForm(r.symbol, 'datum', e.target.value)}
                  style={{
                    border: f.datum ? '1px solid var(--border)' : '1.5px solid #f59e0b', borderRadius: 8, padding: '7px 8px',
                    fontSize: 13, fontFamily: 'inherit', width: '100%', background: f.datum ? 'var(--bg-white)' : '#fffbeb',
                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                  }} />
                {/* Verwijderen */}
                <button
                  onClick={() => toggleSelectie(r)}
                  title="Deze belegging niet toevoegen"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
          {/* Footer knoppen */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>

            {beperkteFout && (
              <div style={{ width: '100%', marginBottom: 8, padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 13 }}>
                {beperkteFout}
              </div>
            )}
            {!beperkteInfoModus ? (
              <button className="btn btn-primary" onClick={opslaanMulti}
                disabled={!selectie.some(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; })}
                style={{ opacity: !selectie.some(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; }) ? 0.5 : 1 }}>
                Opslaan ({selectie.filter(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; }).length}/{selectie.length})
              </button>
            ) : (
              <button className="btn btn-primary" onClick={opslaanMultiBeperkt}
                disabled={beperkteOpslaanLoading || !selectie.some(r => { const f = multiForms[r.symbol]; return f?.datum && f?.aankoopbedrag && (!f?.verkocht || (f?.verkoopbedrag && f?.verkoopdatum)); })}
                style={{ opacity: !selectie.some(r => { const f = multiForms[r.symbol]; return f?.datum && f?.aankoopbedrag && (!f?.verkocht || (f?.verkoopbedrag && f?.verkoopdatum)); }) ? 0.5 : 1 }}>
                {beperkteOpslaanLoading ? 'Historische koersen opzoeken...' : `Opslaan (${selectie.filter(r => { const f = multiForms[r.symbol]; return f?.datum && f?.aankoopbedrag && (!f?.verkocht || (f?.verkoopbedrag && f?.verkoopdatum)); }).length}/${selectie.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stap: gegevens invoeren */}
      {stap === 'invoer' && geselecteerd && (
        <div style={{ padding: '0 32px' }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Beleggingen
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Automatisch opgevolgd door Kapitas
            </div>

            {(type === 'aandeel' || type === 'etf') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button
                  onClick={() => setBeperkteInfoModus(v => !v)}
                  style={{
                    background: beperkteInfoModus ? 'var(--accent-bg)' : 'transparent',
                    color: beperkteInfoModus ? 'var(--accent)' : 'var(--text-muted)',
                    border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {beperkteInfoModus ? '✓ ' : ''}Beperkte info (enkel aan-/verkoopbedrag gekend)
                </button>
              </div>
            )}
            {beperkteInfoModus && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                Handig als je enkel weet hoeveel je betaalde (bv. bij een oudere aankoop via een traditionele bank). We zoeken de historische koers op die datum op en <strong>schatten</strong> het aantal stuks (afgerond naar een geheel getal) en de kostprijs per stuk daaruit.
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
              {!beperkteInfoModus ? (
                <>
              {/* Rij 1: Naam, datum, kostprijs */}
              <div className="toevoegen-row-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, padding: '8px 0', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Naam</span>
                <span>Aankoopdatum</span>
                <span>Koers per stuk</span>
              </div>
              <div className="toevoegen-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{geselecteerd.naam || geselecteerd.description || geselecteerd.symbol}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{geselecteerd.symbol}</div>
                </div>
                <input type="date" className="form-input" value={form.datum}
                  onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" className="form-input" placeholder="0.00" value={form.kostprijs}
                    onChange={e => setForm(f => ({ ...f, kostprijs: e.target.value }))} step="0.01" min="0" />
                  <select className="form-input" style={{ width: 80 }} value={form.munt}
                    onChange={e => setForm(f => ({ ...f, munt: e.target.value }))}>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              {/* Rij 2: Aantal */}
              <div className="toevoegen-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>Aantal aandelen/eenheden</div>
                <div />
                <input type="number" className="form-input" placeholder="1" value={form.aantal}
                  onChange={e => setForm(f => ({ ...f, aantal: e.target.value }))} min="0" step="0.001" />
              </div>

              {/* Rij 3: Transactiekosten */}
              <div className="toevoegen-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>Transactiekosten</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Niet gekend? Laat leeg — later aanpasbaar</div>
                </div>
                <div />
                <input type="number" className="form-input" placeholder="€0 (optioneel)" value={form.transactiekosten}
                  onChange={e => setForm(f => ({ ...f, transactiekosten: e.target.value }))} step="0.01" min="0" />
              </div>

              {/* Preview totale kostprijs */}
              {(kostprijsPerStuk > 0 && aantalStuks > 0) && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Totale kostprijs
                      {transactiekosten > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> (incl. {muntSymbool(form.munt)}{transactiekosten.toFixed(2)} kosten)</span>}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {muntSymbool(form.munt)}{totaalKostprijs.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  {form.munt !== 'EUR' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {wisselkoersLoading
                          ? 'Wisselkoers ophalen...'
                          : `≈ wisselkoers op ${form.datum}: 1 ${form.munt} = €${wisselkoersOpDatum.toFixed(4)}`}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        ≈ €{totaalKostprijsEUR.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>
              )}
                </>
              ) : (
                <>
                  {/* Naam + aankoopbedrag + aankoopdatum */}
                  <div className="toevoegen-row-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, padding: '8px 0', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>Naam</span>
                    <span>Aankoopbedrag (totaal)</span>
                    <span>Aankoopdatum</span>
                  </div>
                  <div className="toevoegen-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{geselecteerd.naam || geselecteerd.description || geselecteerd.symbol}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{geselecteerd.symbol}</div>
                    </div>
                    <input type="number" className="form-input" placeholder="€ 0,00" value={beperkteForm.aankoopbedrag}
                      onChange={e => setBeperkteForm(f => ({ ...f, aankoopbedrag: e.target.value }))} step="0.01" min="0" />
                    <input type="date" className="form-input" value={beperkteForm.aankoopdatum}
                      onChange={e => setBeperkteForm(f => ({ ...f, aankoopdatum: e.target.value }))} />
                  </div>

                  {/* Checkbox: ondertussen verkocht */}
                  <div style={{ padding: '14px 0', borderTop: '1px solid var(--border-light)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                      <input type="checkbox" checked={beperkteForm.verkocht}
                        onChange={e => setBeperkteForm(f => ({ ...f, verkocht: e.target.checked }))} />
                      Deze positie is ondertussen verkocht
                    </label>
                  </div>

                  {beperkteForm.verkocht && (
                    <div className="toevoegen-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>Verkoop</div>
                      <input type="number" className="form-input" placeholder="Verkoopbedrag (totaal)" value={beperkteForm.verkoopbedrag}
                        onChange={e => setBeperkteForm(f => ({ ...f, verkoopbedrag: e.target.value }))} step="0.01" min="0" />
                      <input type="date" className="form-input" value={beperkteForm.verkoopdatum}
                        onChange={e => setBeperkteForm(f => ({ ...f, verkoopdatum: e.target.value }))} />
                    </div>
                  )}

                  {beperkteFout && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 13 }}>
                      {beperkteFout}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            {stap === 'multi-invoer' ? (
              <>
                <button className="btn btn-ghost" onClick={() => setStap('zoek')}>← Terug</button>
                <button className="btn btn-primary" onClick={opslaanMulti}
                  disabled={!selectie.some(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; })}
                  style={{ opacity: !selectie.some(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; }) ? 0.5 : 1 }}>
                  Opslaan ({selectie.filter(r => { const f = multiForms[r.symbol]; return f?.datum && f?.kostprijs && f?.aantal; }).length}/{selectie.length})
                </button>
              </>
            ) : (
              <>

                {beperkteInfoModus ? (
                  <button className="btn btn-primary" onClick={opslaanBeperkt}
                    disabled={!beperkteForm.aankoopbedrag || !beperkteForm.aankoopdatum || beperkteOpslaanLoading || (beperkteForm.verkocht && (!beperkteForm.verkoopbedrag || !beperkteForm.verkoopdatum))}
                    style={{ opacity: (!beperkteForm.aankoopbedrag || !beperkteForm.aankoopdatum || (beperkteForm.verkocht && (!beperkteForm.verkoopbedrag || !beperkteForm.verkoopdatum))) ? 0.5 : 1 }}>
                    {beperkteOpslaanLoading ? 'Koers opzoeken...' : 'Opslaan'}
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={opslaan}
                    disabled={!form.datum || !form.kostprijs || !form.aantal}
                    style={{ opacity: (!form.datum || !form.kostprijs || !form.aantal) ? 0.5 : 1 }}>
                    Opslaan
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
