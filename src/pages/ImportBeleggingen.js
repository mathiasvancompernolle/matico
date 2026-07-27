import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Upload, Download, ArrowLeft, Info, Check, AlertTriangle, X } from 'lucide-react';
import * as XLSX from 'xlsx';

// Saxo gebruikt zijn eigen beurscode na een dubbele punt in de "Symb."-kolom
// (bv. "NKE:xnys", "PRX:xams") — dit zet dat om naar de Yahoo-achtige suffix
// die de rest van de app gebruikt (bv. "PRX.AS"). null = geen suffix (VS).
const SAXO_BEURS_SUFFIX = {
  xnys: null, xnas: null, xase: null,
  xams: 'AS', xbru: 'BR', xpar: 'PA',
  xetr: 'DE', xfra: 'DE', xget: 'DE', xdus: 'DE', xber: 'DE', xstu: 'DE', xham: 'DE', xmun: 'DE',
  xlon: 'L', xswx: 'SW', xvtx: 'SW',
  xmil: 'MI', xmad: 'MC',
  xtse: 'TO', xhkg: 'HK', xtks: 'T',
  xosl: 'OL', xsto: 'ST', xcse: 'CO', xhel: 'HE', xwbo: 'VI',
};

const SAXO_TYPE_MAP = {
  'aandeel': 'aandeel', 'etf': 'etf', 'tracker': 'etf', 'fonds': 'etf', 'beleggingsfonds': 'etf',
  'cryptovaluta': 'crypto', 'crypto': 'crypto',
};

// Saxo noteert de aankoopdatum onder "Open tijd", in het formaat
// "03-jun-2026 20:20:04" (Nederlandse maandafkorting + tijdstip erbij).
const SAXO_MAANDEN = { jan:'01', feb:'02', mrt:'03', apr:'04', mei:'05', jun:'06', jul:'07', aug:'08', sep:'09', okt:'10', nov:'11', dec:'12' };
function parseSaxoOpenTijd(s) {
  const m = /^(\d{1,2})-([a-z]{3})-(\d{4})/i.exec((s || '').trim());
  if (!m) return '';
  const maand = SAXO_MAANDEN[m[2].toLowerCase()];
  if (!maand) return '';
  return `${m[3]}-${maand}-${m[1].padStart(2, '0')}`;
}

// Herkent een bekend broker-exportformaat op basis van de kolomkoppen, zodat
// we automatisch de juiste, broker-specifieke omzetting kunnen toepassen
// i.p.v. de gebruiker manueel elke kolom te laten koppelen.
function detecteerBroker(hdrs) {
  const set = new Set(hdrs);
  if (set.has('AK-krs') && set.has('Symb.') && set.has('Soort belegging')) return 'saxo';
  if (set.has('Product') && set.has('Symbool/ISIN') && set.has('Slotkoers')) return 'degiro';
  if (set.has('ISIN') && set.has('Datum') && set.has('Transactiekosten en/of kosten van derden EUR')) return 'degiro-transacties';
  if (set.has('Quote Price') && set.has('Received / Paid Currency') && set.has('Type')) return 'bitvavo';
  return null;
}

// DEGIRO Transacties (in tegenstelling tot de Portefeuille-momentopname):
// een échte transactiegeschiedenis, met per transactie de werkelijke
// aankoopprijs, -datum én transactiekosten. Net als bij Bitvavo groeperen
// we aan-/verkopen per ISIN (Aantal > 0 = aankoop, < 0 = verkoop) tot een
// netto-hoeveelheid, met een gewogen-gemiddelde kostprijs.
function parseDegiroDatum(s) {
  // "02-06-2026" (dd-mm-jjjj) → "2026-06-02"
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec((s || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

async function transformeerDegiroTransacties(rijen, onVoortgang) {
  const perIsin = {};
  for (const r of rijen) {
    const isin = (r['ISIN'] || '').trim();
    if (!isin) continue;
    const aantal = parseFloat(String(r['Aantal'] || '0').replace(',', '.')) || 0;
    const koers = parseFloat(String(r['Koers '] ?? r['Koers'] ?? '0').replace(',', '.')) || 0;
    const kosten = Math.abs(parseFloat(String(r['Transactiekosten en/of kosten van derden EUR'] || '0').replace(',', '.')) || 0);
    const datum = parseDegiroDatum(r['Datum']);
    const naam = (r['Product'] || isin).trim();

    if (!perIsin[isin]) perIsin[isin] = { gekocht: 0, gekochtKost: 0, verkocht: 0, kosten: 0, naam, eersteDatum: datum };
    if (aantal > 0) {
      perIsin[isin].gekocht += aantal;
      perIsin[isin].gekochtKost += aantal * koers;
      perIsin[isin].kosten += kosten;
      if (datum && (!perIsin[isin].eersteDatum || datum < perIsin[isin].eersteDatum)) perIsin[isin].eersteDatum = datum;
    } else if (aantal < 0) {
      perIsin[isin].verkocht += Math.abs(aantal);
    }
    perIsin[isin].naam = naam; // meest recente (volledige) productnaam gebruiken
  }

  const isins = Object.keys(perIsin);
  const resultaat = [];
  for (let i = 0; i < isins.length; i++) {
    const isin = isins[i];
    const d = perIsin[isin];
    const netAantal = d.gekocht - d.verkocht;
    if (netAantal <= 0.00000001 || d.gekocht === 0) { onVoortgang && onVoortgang(i + 1, isins.length); continue; }

    let symbol = isin;
    try {
      const res = await fetch(`/api/data?endpoint=isin-naar-ticker&isin=${encodeURIComponent(isin)}`);
      const dd = await res.json();
      if (dd?.symbol) symbol = dd.symbol;
    } catch (e) { /* val terug op ISIN */ }

    const naamGroot = d.naam.toUpperCase();
    const type = naamGroot.includes('ETF') || naamGroot.includes('TRACKER') ? 'etf' : 'aandeel';

    resultaat.push({
      naam: d.naam,
      symbol,
      broker: 'DEGIRO',
      type,
      kostprijs: d.gekochtKost / d.gekocht,
      transactiekosten: Math.round(d.kosten * 100) / 100,
      aantal: netAantal,
      munt: 'EUR',
      datum: d.eersteDatum,
    });
    onVoortgang && onVoortgang(i + 1, isins.length);
  }
  return resultaat;
}

// Bitvavo: dit is een volledige TRANSACTIEgeschiedenis (geen momentopname),
// met dus een échte aankoopprijs én -datum per aankoop. We groeperen alle
// aan-/verkopen per munt, tellen aan- en verkochte hoeveelheid tegen elkaar
// op (netto-aantal = wat je nu nog in bezit hebt), en berekenen de
// gewogen-gemiddelde aankoopprijs over alle aankopen van die munt.
function transformeerBitvavo(rijen) {
  const perMunt = {};
  for (const r of rijen) {
    const type = (r['Type'] || '').toLowerCase();
    if (type !== 'buy' && type !== 'sell') continue; // deposit/withdrawal/rebate/staking enz. overslaan
    const munt = (r['Currency'] || '').trim();
    if (!munt) continue;
    const aantal = parseFloat(String(r['Amount'] || '0').replace(',', '.')) || 0;
    const prijs = parseFloat(String(r['Quote Price'] || '0').replace(',', '.')) || 0;
    const quoteMunt = (r['Quote Currency'] || 'EUR').trim();
    const datum = r['Date'] || '';

    if (!perMunt[munt]) perMunt[munt] = { gekocht: 0, gekochtKost: 0, verkocht: 0, kosten: 0, quoteMunt, eersteDatum: datum };
    if (type === 'buy') {
      perMunt[munt].gekocht += aantal;
      perMunt[munt].gekochtKost += aantal * prijs;
      perMunt[munt].kosten += parseFloat(String(r['Fee amount'] || '0').replace(',', '.')) || 0;
      if (datum && (!perMunt[munt].eersteDatum || datum < perMunt[munt].eersteDatum)) perMunt[munt].eersteDatum = datum;
    } else {
      perMunt[munt].verkocht += aantal;
    }
  }

  const resultaat = [];
  for (const [munt, d] of Object.entries(perMunt)) {
    const netAantal = d.gekocht - d.verkocht;
    if (netAantal <= 0.00000001 || d.gekocht === 0) continue; // volledig verkocht of nooit gekocht
    resultaat.push({
      naam: munt,
      symbol: `${munt}-${d.quoteMunt}`,
      broker: 'Bitvavo',
      type: 'crypto',
      kostprijs: d.gekochtKost / d.gekocht, // gewogen gemiddelde over alle aankopen
      transactiekosten: Math.round(d.kosten * 100) / 100,
      aantal: netAantal,
      munt: d.quoteMunt,
      datum: d.eersteDatum,
    });
  }
  return resultaat;
}

// Saxo: momentopname van je posities. Bevat een echte aankoopkoers
// ("AK-krs") én de aankoopdatum (verstopt onder "Open tijd"). Tussenkoppen
// zoals "Aandelen (3)"
// worden overgeslagen (geen "Aantal"/"Symb." aanwezig op die rijen).
function transformeerSaxo(rijen) {
  const resultaat = [];
  for (const r of rijen) {
    const symb = (r['Symb.'] || '').trim();
    const aantal = parseFloat(String(r['Aantal'] || '').replace(',', '.'));
    if (!symb || !aantal) continue; // tussenkop/subtotaal-rij, geen echte positie

    const [ticker, beursCode] = symb.split(':');
    const suffix = beursCode ? SAXO_BEURS_SUFFIX[beursCode.toLowerCase()] : undefined;
    const symbol = suffix ? `${ticker}.${suffix}` : ticker;

    const soort = (r['Soort belegging'] || '').toLowerCase();
    const type = SAXO_TYPE_MAP[soort] || 'aandeel';

    resultaat.push({
      naam: (r['Instrument'] || symbol).trim(),
      symbol,
      broker: 'Saxo',
      type,
      kostprijs: parseFloat(String(r['AK-krs'] || '0').replace(',', '.')) || 0,
      aantal,
      munt: r['Valuta'] || 'EUR',
      datum: parseSaxoOpenTijd(r['Open tijd']),
      transactiekosten: (() => {
        // "AK-krs+kost" is dezelfde aankoopprijs, maar dan inclusief kosten
        // per stuk — het verschil x aantal geeft de totale transactiekost.
        const alInkl = parseFloat(String(r['AK-krs+kost'] || '0').replace(',', '.')) || 0;
        const zuiver = parseFloat(String(r['AK-krs'] || '0').replace(',', '.')) || 0;
        const verschil = (alInkl - zuiver) * aantal;
        return verschil > 0 ? Math.round(verschil * 100) / 100 : 0;
      })(),
    });
  }
  return resultaat;
}

// DEGIRO: momentopname van je portefeuille, enkel ISIN (geen ticker) en
// enkel de huidige koers ("Slotkoers"), geen echte aankoopprijs. We lossen
// de ISIN op naar een ticker via OpenFIGI, en markeren de kostprijs als
// een schatting die de gebruiker zelf moet natrekken.
async function transformeerDegiro(rijen, onVoortgang) {
  const posities = rijen.filter(r => (r['Symbool/ISIN'] || '').trim());
  const resultaat = [];
  for (let i = 0; i < posities.length; i++) {
    const r = posities[i];
    const isin = r['Symbool/ISIN'].trim();
    let symbol = isin;
    let naam = (r['Product'] || isin).trim();
    try {
      const res = await fetch(`/api/data?endpoint=isin-naar-ticker&isin=${encodeURIComponent(isin)}`);
      const d = await res.json();
      if (d?.symbol) {
        symbol = d.symbol;
        if (d.naam) naam = d.naam;
      }
    } catch (e) { /* val terug op ISIN als ticker */ }

    resultaat.push({
      naam,
      symbol,
      broker: 'DEGIRO',
      type: 'aandeel',
      kostprijs: parseFloat(String(r['Slotkoers'] || '0').replace(',', '.')) || 0,
      kostprijsOnzeker: true,
      transactiekosten: 0, // DEGIRO's portefeuille-export bevat geen kosteninformatie
      aantal: parseFloat(String(r['Aantal'] || '0').replace(',', '.')) || 0,
      munt: r['Lokale waarde'] || 'EUR', // let op: DEGIRO's eigen kolomkop hier is misleidend, de waarde zelf klopt wel
      datum: '',
    });
    onVoortgang && onVoortgang(i + 1, posities.length);
  }
  return resultaat;
}

// Een ISIN volgt altijd dit vaste patroon: 2 letters (landcode) + 9
// letters/cijfers + 1 controlecijfer. Zo herkennen we, ongeacht welke broker
// het bestand aanleverde, of een kolom eigenlijk een ISIN bevat i.p.v. een
// ticker — en lossen we die dan automatisch op, niet enkel bij DEGIRO.
const ISIN_PATRONEN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

async function losIsinOp(waarde) {
  const schoon = (waarde || '').trim().toUpperCase();
  if (!ISIN_PATRONEN.test(schoon)) return null;
  try {
    const res = await fetch(`/api/data?endpoint=isin-naar-ticker&isin=${encodeURIComponent(schoon)}`);
    const d = await res.json();
    return d?.symbol || null;
  } catch (e) {
    return null;
  }
}

export default function ImportBeleggingen({ onClose }) {
  const { setBeleggingen } = useApp();
  const [stap, setStap] = useState('upload');
  const [bestand, setBestand] = useState(null);
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ naam: '', symbol: '', datum: '', kostprijs: '', aantal: '', munt: '' });
  const [fout, setFout] = useState('');
  const [succes, setSucces] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [brokerNaam, setBrokerNaam] = useState(null);
  const [brokerRijen, setBrokerRijen] = useState([]);
  const [voortgang, setVoortgang] = useState(null);
  const fileRef = useRef(null);

  const downloadTemplate = () => {
    const csv = 'ticker,naam,aankoopdatum,aankoopprijs,aantal,munt\nNKE,Nike Inc,2024-01-15,43.50,2,USD\nVWCE.DE,Vanguard FTSE All-World,2024-02-01,164.56,1,EUR';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'matico-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Ontleedt één CSV-regel met correcte inachtneming van aanhalingstekens:
  // een komma/puntkomma BINNEN aanhalingstekens (bv. "163,78") wordt niet als
  // scheidingsteken behandeld. Zonder dit breekt elk bedrag met een komma als
  // decimaalteken (zoals bij DEGIRO) de volledige rij.
  const parseCSVRegel = (regel, sep) => {
    const velden = [];
    let huidig = '';
    let inAanhaling = false;
    for (let i = 0; i < regel.length; i++) {
      const c = regel[i];
      if (c === '"') {
        if (inAanhaling && regel[i + 1] === '"') { huidig += '"'; i++; }
        else inAanhaling = !inAanhaling;
      } else if (c === sep && !inAanhaling) {
        velden.push(huidig);
        huidig = '';
      } else {
        huidig += c;
      }
    }
    velden.push(huidig);
    return velden.map(v => v.trim());
  };

  const parseCSV = (tekst) => {
    const regels = tekst.trim().split('\n');
    const sep = regels[0].includes(';') ? ';' : ',';
    const hdrs = parseCSVRegel(regels[0], sep);
    const rijen = regels.slice(1).filter(r => r.trim()).map(r => {
      const waarden = parseCSVRegel(r, sep);
      const obj = {};
      hdrs.forEach((h, i) => { obj[h] = waarden[i] || ''; });
      return obj;
    });
    return { hdrs, rijen };
  };

  const parseXLSX = (buffer) => {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (data.length < 2) return { hdrs: [], rijen: [] };
    const hdrs = data[0].map(h => String(h).trim());
    const rijen = data.slice(1).filter(r => r.some(c => c !== '')).map(r => {
      const obj = {};
      hdrs.forEach((h, i) => {
        let val = r[i];
        // Excel datum-waarden omzetten naar string
        if (val instanceof Date) {
          val = val.toISOString().slice(0, 10);
        }
        obj[h] = val !== undefined && val !== null ? String(val).trim() : '';
      });
      return obj;
    });
    return { hdrs, rijen };
  };

  const detecteerMapping = (hdrs) => {
    const autoMapping = { naam: '', symbol: '', datum: '', kostprijs: '', aantal: '', munt: '' };
    hdrs.forEach(h => {
      const hl = h.toLowerCase();
      if (hl.includes('naam') || hl.includes('name') || hl.includes('product')) autoMapping.naam = h;
      if (hl.includes('ticker') || hl.includes('symbol') || hl.includes('isin')) autoMapping.symbol = h;
      if (hl.includes('datum') || hl.includes('date')) autoMapping.datum = h;
      if (hl.includes('prijs') || hl.includes('price') || hl.includes('koop') || hl.includes('koers')) autoMapping.kostprijs = h;
      if (hl.includes('aantal') || hl.includes('quantity') || hl.includes('shares') || hl.includes('stuks')) autoMapping.aantal = h;
      if (hl.includes('munt') || hl.includes('currency') || hl.includes('valuta')) autoMapping.munt = h;
    });
    return autoMapping;
  };

  const verwerkBestand = async (file) => {
    setBestand(file);
    setFout('');
    const naam = file.name.toLowerCase();

    let hdrs, rijen;
    if (naam.endsWith('.csv')) {
      const tekst = await file.text();
      ({ hdrs, rijen } = parseCSV(tekst));
    } else if (naam.endsWith('.xlsx') || naam.endsWith('.xls')) {
      try {
        const buffer = await file.arrayBuffer();
        ({ hdrs, rijen } = parseXLSX(buffer));
        if (hdrs.length === 0) {
          setFout('Het bestand lijkt leeg of heeft geen herkenbare structuur.');
          return;
        }
      } catch (e) {
        setFout('Fout bij het lezen van het Excel-bestand. Probeer het op te slaan als .xlsx en opnieuw te uploaden.');
        return;
      }
    } else {
      setFout('Ongeldig bestandstype. Upload een CSV, XLSX of XLS bestand.');
      return;
    }

    const broker = detecteerBroker(hdrs);
    if (broker === 'saxo') {
      const rijenOm = transformeerSaxo(rijen);
      setBrokerNaam('Saxo');
      setBrokerRijen(rijenOm);
      setStap('broker-preview');
      return;
    }
    if (broker === 'degiro') {
      setBrokerNaam('DEGIRO (portefeuille)');
      setStap('broker-laden');
      setVoortgang({ huidig: 0, totaal: 0 });
      const rijenOm = await transformeerDegiro(rijen, (huidig, totaal) => setVoortgang({ huidig, totaal }));
      setBrokerRijen(rijenOm);
      setStap('broker-preview');
      return;
    }
    if (broker === 'degiro-transacties') {
      setBrokerNaam('DEGIRO');
      setStap('broker-laden');
      setVoortgang({ huidig: 0, totaal: 0 });
      const rijenOm = await transformeerDegiroTransacties(rijen, (huidig, totaal) => setVoortgang({ huidig, totaal }));
      setBrokerRijen(rijenOm);
      setStap('broker-preview');
      return;
    }
    if (broker === 'bitvavo') {
      const rijenOm = transformeerBitvavo(rijen);
      setBrokerNaam('Bitvavo');
      setBrokerRijen(rijenOm);
      setStap('broker-preview');
      return;
    }

    // Geen bekende broker herkend — terugvallen op de generieke,
    // manuele kolom-koppel-flow.
    setHeaders(hdrs);
    setPreview(rijen);
    setMapping(detecteerMapping(hdrs));
    setStap('mapping');
  };

  const bewerkBrokerRij = (idx, veld, waarde) => {
    setBrokerRijen(prev => prev.map((r, i) => i === idx ? { ...r, [veld]: waarde } : r));
  };

  const importeerBroker = () => {
    const nieuweBeleggingen = brokerRijen
      .filter(b => b.symbol && b.kostprijs > 0 && b.aantal > 0)
      .map((b, i) => ({ id: Date.now() + i, ...b }));
    if (nieuweBeleggingen.length === 0) {
      setFout('Geen geldige beleggingen gevonden.');
      return;
    }
    setBeleggingen(prev => [...prev, ...nieuweBeleggingen]);
    setSucces(true);
    setTimeout(() => onClose(), 1500);
  };

  const importeer = async () => {
    if (!mapping.symbol || !mapping.kostprijs || !mapping.aantal) {
      setFout('Selecteer minimaal: Symbool, Kostprijs en Aantal');
      return;
    }
    setFout('');
    setStap('importeren');

    const ruw = preview.map((r, i) => ({
      id: Date.now() + i,
      naam: mapping.naam ? r[mapping.naam] : r[mapping.symbol] || 'Onbekend',
      symbol: (r[mapping.symbol] || '').trim(),
      type: 'aandeel',
      datum: mapping.datum ? r[mapping.datum] : '',
      kostprijs: parseFloat(String(r[mapping.kostprijs] || '0').replace(',', '.')) || 0,
      aantal: parseFloat(String(r[mapping.aantal] || '0').replace(',', '.')) || 0,
      munt: mapping.munt ? (r[mapping.munt] || 'EUR') : 'EUR',
    })).filter(b => b.symbol && b.kostprijs > 0 && b.aantal > 0);

    // Herkent, ongeacht welke broker het bestand aanleverde, of het
    // "symbool" eigenlijk een ISIN is, en lost dat automatisch op.
    setVoortgang({ huidig: 0, totaal: ruw.length });
    const nieuweBeleggingen = [];
    for (let i = 0; i < ruw.length; i++) {
      const b = ruw[i];
      const opgelosteTicker = await losIsinOp(b.symbol);
      nieuweBeleggingen.push(opgelosteTicker ? { ...b, symbol: opgelosteTicker } : b);
      setVoortgang({ huidig: i + 1, totaal: ruw.length });
    }

    if (nieuweBeleggingen.length === 0) {
      setStap('mapping');
      setFout('Geen geldige beleggingen gevonden. Controleer de kolom-mapping.');
      return;
    }
    setBeleggingen(prev => [...prev, ...nieuweBeleggingen]);
    setSucces(true);
    setTimeout(() => onClose(), 1500);
  };

  if (succes) {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div className="page-header" style={{ marginBottom: 32 }}>
          <h1>Beleggingen</h1>
        </div>
        <div style={{ padding: '0 32px', textAlign: 'center', marginTop: 80 }}>
          <div style={{ width: 64, height: 64, background: 'var(--green-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={32} color="var(--green)" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Import geslaagd!</h2>
          <p style={{ color: 'var(--text-muted)' }}>Je beleggingen zijn toegevoegd aan je portfolio.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {(stap === 'mapping' || stap === 'broker-preview') && (
            <button className="btn btn-ghost" onClick={() => setStap('upload')} style={{ padding: '8px' }}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h1>Beleggingen</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={downloadTemplate}>
            <Download size={15} /> Download template
          </button>
          <button className="btn btn-primary" onClick={onClose}>← Terug</button>
        </div>
      </div>

      <div style={{ padding: '0 32px' }}>
        <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Info size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Importeren in bulk</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Upload een export van je broker (bijv. van Bolero, Degiro, Keytrade of Saxo), een eigen spreadsheet,
              of gebruik onze kant-en-klare template. We analyseren het bestand automatisch en proberen zoveel
              mogelijk gegevens al in te vullen. Enkel je actieve beleggingen worden toegevoegd, verkochte posities
              worden niet meegenomen. Voor een goede analyse is het belangrijk dat volgende velden minstens aanwezig
              zijn in je bestand: <strong>ticker, naam, aankoopprijs, aankoopdatum, aantal</strong>.
            </p>
          </div>
        </div>

        {stap === 'upload' && (
          <div className="card">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Actieve beleggingen importeren</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Upload een CSV, XLSX of XLS bestand</p>

            <div
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: '60px 40px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'var(--accent-bg)' : 'transparent',
                transition: 'all 0.15s'
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) verwerkBestand(f); }}
            >
              <div style={{ width: 56, height: 56, border: '1px solid var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'white' }}>
                <Upload size={24} color="var(--accent)" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Drag & drop</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Of klik om te bladeren (CSV, XLSX, XLS)</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) verwerkBestand(e.target.files[0]); }} />

            {fout && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: 13, padding: '10px 14px', background: 'var(--red-bg)', borderRadius: 8 }}>{fout}</div>}
          </div>
        )}

        {stap === 'mapping' && (
          <div className="card">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Kolommen koppelen</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Bestand: <strong>{bestand?.name}</strong> — <strong>{preview.length}</strong> rijen gedetecteerd
            </p>

            <div style={{ overflowX: 'auto', marginBottom: 24, border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {headers.map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 3).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      {headers.map(h => (
                        <td key={h} style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>{r[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Wijs kolommen toe</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                { key: 'naam', label: 'Naam / Product', verplicht: false },
                { key: 'symbol', label: 'Symbool / Ticker', verplicht: true },
                { key: 'datum', label: 'Aankoopdatum', verplicht: false },
                { key: 'kostprijs', label: 'Aankoopprijs per stuk', verplicht: true },
                { key: 'aantal', label: 'Aantal', verplicht: true },
                { key: 'munt', label: 'Munt / Valuta', verplicht: false },
              ].map(({ key, label, verplicht }) => (
                <div key={key}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    {label} {verplicht && <span style={{ color: 'var(--red)' }}>*</span>}
                  </label>
                  <select className="form-input" value={mapping[key]} onChange={e => setMapping(prev => ({ ...prev, [key]: e.target.value }))}>
                    <option value="">— Niet gebruiken —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {fout && <div style={{ marginBottom: 16, color: 'var(--red)', fontSize: 13, padding: '10px 14px', background: 'var(--red-bg)', borderRadius: 8 }}>{fout}</div>}

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14 }} onClick={importeer}>
              <Upload size={16} /> Importeer {preview.length} beleggingen
            </button>
          </div>
        )}

        {stap === 'importeren' && (
          <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Bezig met importeren...</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {voortgang ? `${voortgang.huidig} van ${voortgang.totaal} beleggingen verwerkt` : 'Even geduld'}
            </div>
          </div>
        )}

        {stap === 'broker-laden' && (
          <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Bezig met herkennen van je {brokerNaam}-posities...</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {voortgang ? `${voortgang.huidig} van ${voortgang.totaal} posities verwerkt` : 'Even geduld'}
            </div>
          </div>
        )}

        {stap === 'broker-preview' && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Check size={18} color="var(--green)" />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{brokerNaam} herkend</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              <strong>{brokerRijen.length}</strong> posities gevonden en automatisch omgezet. Controleer even of alles klopt voor je importeert.
            </p>

            {brokerNaam === 'DEGIRO (portefeuille)' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, marginBottom: 20 }}>
                <AlertTriangle size={16} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
                  DEGIRO's portefeuille-export bevat geen echte aankoopprijs, enkel de huidige koers. De kostprijs hieronder is dus voorlopig gelijk aan de huidige koers (0% winst/verlies) — pas dit zelf aan per positie voor een correcte berekening.
                  <br /><br />
                  <strong>Tip:</strong> DEGIRO biedt ook een aparte "Transacties"-export aan met je échte aankoopprijzen, -data en transactiekosten — upload die in plaats van deze portefeuille-export voor een nauwkeuriger resultaat.
                </div>
              </div>
            )}

            {brokerNaam === 'DEGIRO' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent-light)', borderRadius: 10, marginBottom: 20 }}>
                <Info size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: 'var(--accent)', lineHeight: 1.5 }}>
                  Berekend uit je volledige transactiegeschiedenis: aan- en verkopen per positie zijn tegen elkaar weggestreept tot je huidige, netto-hoeveelheid, de kostprijs is het gewogen gemiddelde over al je aankopen, en de transactiekosten zijn meegenomen.
                </div>
              </div>
            )}

            {brokerNaam === 'Bitvavo' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent-light)', borderRadius: 10, marginBottom: 20 }}>
                <Info size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: 'var(--accent)', lineHeight: 1.5 }}>
                  Berekend uit je volledige transactiegeschiedenis: aan- en verkopen per munt zijn tegen elkaar weggestreept tot je huidige, netto-hoeveelheid, en de kostprijs is het gewogen gemiddelde over al je aankopen van die munt.
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto', marginBottom: 20, border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Naam', 'Symbool', 'Type', 'Aankoopprijs', 'Transactiekosten', 'Aantal', 'Munt', 'Aankoopdatum', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {brokerRijen.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '6px 12px' }}>{r.naam}</td>
                      <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>{r.symbol}</td>
                      <td style={{ padding: '6px 12px' }}>{r.type}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <input type="number" step="0.01" value={r.kostprijs}
                          onChange={e => bewerkBrokerRij(i, 'kostprijs', parseFloat(e.target.value) || 0)}
                          style={{
                            width: 90, padding: '5px 8px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
                            border: r.kostprijsOnzeker ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                            background: r.kostprijsOnzeker ? '#fffbeb' : 'white',
                          }} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <input type="number" step="0.01" value={r.transactiekosten || 0}
                          onChange={e => bewerkBrokerRij(i, 'transactiekosten', parseFloat(e.target.value) || 0)}
                          style={{ width: 80, padding: '5px 8px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', border: '1px solid var(--border)' }} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <input type="number" step="1" value={r.aantal}
                          onChange={e => bewerkBrokerRij(i, 'aantal', parseFloat(e.target.value) || 0)}
                          style={{ width: 70, padding: '5px 8px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', border: '1px solid var(--border)' }} />
                      </td>
                      <td style={{ padding: '6px 12px' }}>{r.munt}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <input type="date" value={r.datum || ''}
                          onChange={e => bewerkBrokerRij(i, 'datum', e.target.value)}
                          style={{
                            padding: '5px 8px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
                            border: r.datum ? '1px solid var(--border)' : '1.5px solid #f59e0b',
                            background: r.datum ? 'white' : '#fffbeb',
                          }} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <button
                          onClick={() => setBrokerRijen(prev => prev.filter((_, idx) => idx !== i))}
                          title="Deze belegging niet importeren"
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--red)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center',
                          }}
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {fout && <div style={{ marginBottom: 16, color: 'var(--red)', fontSize: 13, padding: '10px 14px', background: 'var(--red-bg)', borderRadius: 8 }}>{fout}</div>}

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14 }} onClick={importeerBroker}>
              <Upload size={16} /> Importeer {brokerRijen.length} beleggingen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
