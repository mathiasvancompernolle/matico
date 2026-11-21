// Eenmalige melding over het maandrapport per e-mail. Wie zich aanmeldde
// vóór die mail bestond, wist er niets van: zo kan iedereen kiezen voor de
// eerste mail vertrekt. De keuze staat in het account (user_metadata), zodat
// de server ze kent en de melding op geen enkel toestel opnieuw verschijnt.
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const TEKST = {
  nl: { kop: 'Nieuw: je maandrapport per e-mail', tekst: 'Op de 1e van elke maand sturen we je een kort overzicht: de waarde van je portefeuille, hoe ze de voorbije maand deed en je grootste stijgers en dalers.', ja: 'Ja, graag', nee: 'Liever niet', later: 'Je kan dit altijd aanpassen in Instellingen.' },
  fr: { kop: 'Nouveau : votre rapport mensuel par e-mail', tekst: 'Le 1er de chaque mois, nous vous envoyons un bref aperçu : la valeur de votre portefeuille, son évolution du mois écoulé et vos plus fortes hausses et baisses.', ja: 'Oui, volontiers', nee: 'Non merci', later: 'Vous pouvez toujours le modifier dans les Paramètres.' },
  en: { kop: 'New: your monthly report by e-mail', tekst: 'On the 1st of every month we send you a short overview: the value of your portfolio, how it did last month and your top risers and fallers.', ja: 'Yes, please', nee: 'No thanks', later: 'You can always change this in Settings.' },
};

export default function MaandrapportMelding({ taal = 'nl' }) {
  const [zichtbaar, setZichtbaar] = useState(false);
  const [bezig, setBezig] = useState(false);
  const t = TEKST[taal] || TEKST.nl;

  useEffect(() => {
    let actief = true;
    const timer = setTimeout(() => {
      supabase.auth.getUser().then(({ data }) => {
        if (actief && data?.user && !data.user.user_metadata?.maandrapportGezien) setZichtbaar(true);
      });
    }, 1500);
    return () => { actief = false; clearTimeout(timer); };
  }, []);

  const kies = async (aan) => {
    setBezig(true);
    await supabase.auth.updateUser({ data: { maandrapport: aan, maandrapportGezien: new Date().toISOString() } });
    setZichtbaar(false);
  };

  if (!zichtbaar) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="maandrapport-kop"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-white, #fff)', color: 'var(--text-primary, #0f172a)', borderRadius: 16, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden="true">📬</div>
        <h2 id="maandrapport-kop" style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 700 }}>{t.kop}</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary, #475569)' }}>{t.tekst}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" disabled={bezig} onClick={() => kies(true)}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: 'none', background: '#1e3a8a', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t.ja}</button>
          <button type="button" disabled={bezig} onClick={() => kies(false)}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border, #e2e8f0)', background: 'transparent', color: 'var(--text-primary, #0f172a)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t.nee}</button>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text-muted, #94a3b8)', textAlign: 'center' }}>{t.later}</p>
      </div>
    </div>
  );
}
