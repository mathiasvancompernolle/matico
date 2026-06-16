import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Upload, Download, ArrowLeft, Info, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  const fileRef = useRef(null);

  const downloadTemplate = () => {
    const csv = 'ticker,naam,aankoopdatum,aankoopprijs,aantal,munt\nNKE,Nike Inc,2024-01-15,43.50,2,USD\nVWCE.DE,Vanguard FTSE All-World,2024-02-01,164.56,1,EUR';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'matico-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (tekst) => {
    const regels = tekst.trim().split('\n');
    const sep = regels[0].includes(';') ? ';' : ',';
    const hdrs = regels[0].split(sep).map(h => h.trim().replace(/"/g, ''));
    const rijen = regels.slice(1).filter(r => r.trim()).map(r => {
      const waarden = r.split(sep).map(w => w.trim().replace(/"/g, ''));
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

    if (naam.endsWith('.csv')) {
      const tekst = await file.text();
      const { hdrs, rijen } = parseCSV(tekst);
      setHeaders(hdrs);
      setPreview(rijen);
      setMapping(detecteerMapping(hdrs));
      setStap('mapping');
    } else if (naam.endsWith('.xlsx') || naam.endsWith('.xls')) {
      try {
        const buffer = await file.arrayBuffer();
        const { hdrs, rijen } = parseXLSX(buffer);
        if (hdrs.length === 0) {
          setFout('Het bestand lijkt leeg of heeft geen herkenbare structuur.');
          return;
        }
        setHeaders(hdrs);
        setPreview(rijen);
        setMapping(detecteerMapping(hdrs));
        setStap('mapping');
      } catch (e) {
        setFout('Fout bij het lezen van het Excel-bestand. Probeer het op te slaan als .xlsx en opnieuw te uploaden.');
      }
    } else {
      setFout('Ongeldig bestandstype. Upload een CSV, XLSX of XLS bestand.');
    }
  };

  const importeer = () => {
    if (!mapping.symbol || !mapping.kostprijs || !mapping.aantal) {
      setFout('Selecteer minimaal: Symbool, Kostprijs en Aantal');
      return;
    }
    const nieuweBeleggingen = preview.map((r, i) => ({
      id: Date.now() + i,
      naam: mapping.naam ? r[mapping.naam] : r[mapping.symbol] || 'Onbekend',
      symbol: r[mapping.symbol] || '',
      type: 'aandeel',
      datum: mapping.datum ? r[mapping.datum] : '',
      kostprijs: parseFloat(String(r[mapping.kostprijs] || '0').replace(',', '.')) || 0,
      aantal: parseFloat(String(r[mapping.aantal] || '0').replace(',', '.')) || 0,
      munt: mapping.munt ? (r[mapping.munt] || 'EUR') : 'EUR',
    })).filter(b => b.symbol && b.kostprijs > 0 && b.aantal > 0);

    if (nieuweBeleggingen.length === 0) {
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
          {stap === 'mapping' && (
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
      </div>
    </div>
  );
}
