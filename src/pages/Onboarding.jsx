// src/pages/Onboarding.jsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const LANDEN = [
  { code: 'BE', naam: 'België', vlag: '🇧🇪', taal: 'nl', valuta: 'EUR', valutaSymbool: '€' },
  { code: 'NL', naam: 'Nederland', vlag: '🇳🇱', taal: 'nl', valuta: 'EUR', valutaSymbool: '€' },
  { code: 'FR', naam: 'Frankrijk', vlag: '🇫🇷', taal: 'fr', valuta: 'EUR', valutaSymbool: '€' },
  { code: 'DE', naam: 'Duitsland', vlag: '🇩🇪', taal: 'de', valuta: 'EUR', valutaSymbool: '€' },
  { code: 'GB', naam: 'Verenigd Koninkrijk', vlag: '🇬🇧', taal: 'en', valuta: 'GBP', valutaSymbool: '£' },
  { code: 'LU', naam: 'Luxemburg', vlag: '🇱🇺', taal: 'fr', valuta: 'EUR', valutaSymbool: '€' },
  { code: 'US', naam: 'Verenigde Staten', vlag: '🇺🇸', taal: 'en', valuta: 'USD', valutaSymbool: '$' },
];

const BROKERS = [
  'Saxo Investor', 'Bolero', 'Degiro', 'Keytrade Bank',
  'Belfius Invest', 'ING Invest', 'BNP Paribas Fortis', 'Andere'
];

const BELASTING_INFO = {
  BE: {
    titel: 'Belgische belastingregels',
    regels: [
      { naam: 'Meerwaardebelasting', waarde: '10%', info: 'Op gerealiseerde meerwaarden boven €10.000/jaar' },
      { naam: 'Beurstaks UCITS ETF', waarde: '0,12%', info: 'Bij aankoop en verkoop' },
      { naam: 'Beurstaks niet-UCITS', waarde: '1,32%', info: 'US ETFs en andere niet-UCITS' },
      { naam: 'Reynders-taks', waarde: '30%', info: 'Op obligatie-ETFs met >10% rentecomponent' },
      { naam: 'Roerende voorheffing', waarde: '30%', info: 'Op ontvangen dividenden' },
    ]
  },
  NL: {
    titel: 'Nederlandse belastingregels',
    regels: [
      { naam: 'Box 3 vermogensrendement', waarde: '36%', info: 'Op fictief rendement boven €57.000 vrijstelling' },
      { naam: 'Dividendbelasting', waarde: '15%', info: 'Bronbelasting op dividenden (verrekenbaar)' },
      { naam: 'Geen meerwaardebelasting', waarde: '0%', info: 'Nederland belast geen gerealiseerde meerwaarden' },
    ]
  },
  FR: {
    titel: 'Franse belastingregels (PFU)',
    regels: [
      { naam: 'Flat Tax (PFU)', waarde: '30%', info: 'Prélèvement Forfaitaire Unique op alle beleggingsinkomsten' },
      { naam: 'Waarvan belasting', waarde: '12,8%', info: 'Inkomstenbelasting component' },
      { naam: 'Waarvan sociale bijdragen', waarde: '17,2%', info: 'Prélèvements sociaux' },
      { naam: 'PEA vrijstelling', waarde: '17,2%', info: 'Enkel sociale bijdragen na 5 jaar PEA' },
    ]
  },
  DE: {
    titel: 'Duitse belastingregels',
    regels: [
      { naam: 'Abgeltungsteuer', waarde: '25%', info: 'Bronbelasting op meerwaarden en dividenden' },
      { naam: 'Solidaritätszuschlag', waarde: '+5,5%', info: 'Solidariteitstoeslag op belasting' },
      { naam: 'Kirchensteuer', waarde: '+8-9%', info: 'Kerkbelasting (optioneel)' },
      { naam: 'Vrijstelling', waarde: '€1.000/jaar', info: 'Sparerpauschbetrag per persoon' },
    ]
  },
  GB: {
    titel: 'Britse belastingregels',
    regels: [
      { naam: 'Capital Gains Tax', waarde: '18-24%', info: 'Op gerealiseerde meerwaarden boven £3.000/jaar' },
      { naam: 'Dividend Tax', waarde: '8,75-39,35%', info: 'Afhankelijk van inkomenstarief' },
      { naam: 'ISA vrijstelling', waarde: '£20.000/jaar', info: 'Individual Savings Account - volledig belastingvrij' },
      { naam: 'Stamp Duty', waarde: '0,5%', info: 'Bij aankoop van Britse aandelen' },
    ]
  },
  LU: {
    titel: 'Luxemburgse belastingregels',
    regels: [
      { naam: 'Meerwaardebelasting', waarde: '0%', info: 'Geen belasting op meerwaarden voor particulieren' },
      { naam: 'Dividendbelasting', waarde: '15%', info: 'Bronbelasting op Luxemburgse dividenden' },
      { naam: 'Abonnementstaks', waarde: '0,01-0,05%', info: 'Jaarlijkse taks op fondsen gedomicilieerd in Luxemburg' },
    ]
  },
  US: {
    titel: 'Amerikaanse belastingregels',
    regels: [
      { naam: 'Long-term Capital Gains', waarde: '0-20%', info: 'Op activa langer dan 1 jaar aangehouden' },
      { naam: 'Short-term Capital Gains', waarde: '10-37%', info: 'Op activa korter dan 1 jaar aangehouden' },
      { naam: 'Dividendbelasting', waarde: '15-20%', info: 'Qualified dividends' },
      { naam: 'Standard deduction', waarde: '$14.600/jaar', info: 'Standaard aftrek voor single filers (2024)' },
    ]
  },
};

const TEKSTEN = {
  nl: {
    stap1Titel: (naam) => `Welkom ${naam}, leuk dat je er bent! 👋`,
    stap1Sub: 'Laten we beginnen met je profiel in te stellen',
    land: 'Land',
    volgende: 'Volgende',
    stap2Titel: 'Welke broker gebruik je?',
    stap2Sub: 'Je kan dit later altijd aanpassen',
    broker: 'Broker',
    andereOptie: 'Andere / Meerdere brokers',
    stap3Titel: 'Bijna klaar!',
    stap3Sub: 'Geef je eerste portfolio een naam',
    portfolioNaam: 'Naam van je portfolio',
    portfolioPlaceholder: 'Mijn portfolio',
    afronden: 'Aan de slag →',
    belastingTitel: 'Jouw belastingregels',
  },
  fr: {
    stap1Titel: (naam) => `Bienvenue ${naam}, ravi de vous voir! 👋`,
    stap1Sub: 'Commençons par configurer votre profil',
    land: 'Pays',
    volgende: 'Suivant',
    stap2Titel: 'Quel courtier utilisez-vous?',
    stap2Sub: 'Vous pouvez toujours modifier cela plus tard',
    broker: 'Courtier',
    andereOptie: 'Autre / Plusieurs courtiers',
    stap3Titel: 'Presque terminé!',
    stap3Sub: 'Donnez un nom à votre premier portefeuille',
    portfolioNaam: 'Nom du portefeuille',
    portfolioPlaceholder: 'Mon portefeuille',
    afronden: 'Commencer →',
    belastingTitel: 'Vos règles fiscales',
  },
  de: {
    stap1Titel: (naam) => `Willkommen ${naam}, schön dass du da bist! 👋`,
    stap1Sub: 'Lass uns mit der Einrichtung deines Profils beginnen',
    land: 'Land',
    volgende: 'Weiter',
    stap2Titel: 'Welchen Broker nutzt du?',
    stap2Sub: 'Du kannst dies später jederzeit ändern',
    broker: 'Broker',
    andereOptie: 'Andere / Mehrere Broker',
    stap3Titel: 'Fast fertig!',
    stap3Sub: 'Gib deinem ersten Portfolio einen Namen',
    portfolioNaam: 'Portfolio-Name',
    portfolioPlaceholder: 'Mein Portfolio',
    afronden: 'Loslegen →',
    belastingTitel: 'Deine Steuerregeln',
  },
  en: {
    stap1Titel: (naam) => `Welcome ${naam}, great to have you! 👋`,
    stap1Sub: "Let's start setting up your profile",
    land: 'Country',
    volgende: 'Next',
    stap2Titel: 'Which broker do you use?',
    stap2Sub: 'You can always change this later',
    broker: 'Broker',
    andereOptie: 'Other / Multiple brokers',
    stap3Titel: 'Almost done!',
    stap3Sub: 'Give your first portfolio a name',
    portfolioNaam: 'Portfolio name',
    portfolioPlaceholder: 'My portfolio',
    afronden: 'Get started →',
    belastingTitel: 'Your tax rules',
  },
};

export default function Onboarding({ gebruiker, onKlaar }) {
  const [stap, setStap] = useState(1);
  const [gekozenLand, setGekozenLand] = useState('BE');
  const [gekozenBroker, setGekozenBroker] = useState('');
  const [portfolioNaam, setPortfolioNaam] = useState('');
  const [laden, setLaden] = useState(false);

  const land = LANDEN.find(l => l.code === gekozenLand);
  const taal = land?.taal || 'nl';
  const t = TEKSTEN[taal];
  const belasting = BELASTING_INFO[gekozenLand];
  const voornaam = gebruiker?.user_metadata?.full_name?.split(' ')[0] || 
                   gebruiker?.user_metadata?.name?.split(' ')[0] || 
                   'daar';

  const afronden = async () => {
    setLaden(true);
    const instellingen = {
      land: gekozenLand,
      taal: land?.taal,
      valuta: land?.valuta,
      valutaSymbool: land?.valutaSymbool,
      broker: gekozenBroker,
      portfolioNaam: portfolioNaam || t.portfolioPlaceholder,
      onboardingKlaar: true,
    };
    localStorage.setItem('matico_instellingen', JSON.stringify(instellingen));
    localStorage.setItem('matico_taal', land?.taal || 'nl');
    onKlaar(instellingen);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Linker paneel */}
      <div style={{
        width: 320, background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
        padding: '48px 36px', display: 'flex', flexDirection: 'column',
        color: 'white', flexShrink: 0,
      }}>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 32, letterSpacing: '-0.5px' }}>Matico</div>

        {/* Proefperiode badge */}
        <div style={{
          background: 'rgba(255,255,255,0.15)', borderRadius: 12,
          padding: '16px 20px', marginBottom: 32,
        }}>
          {stap < 3 ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                Je proefperiode van 14 dagen is geactiveerd 🎉
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                Geen betaalgegevens nodig
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                {taal === 'nl' ? 'Een duidelijk overzicht rechtstreeks naar je inbox' :
                 taal === 'fr' ? 'Un aperçu clair directement dans votre boîte mail' :
                 taal === 'de' ? 'Eine klare Übersicht direkt in deinen Posteingang' :
                 'A clear overview directly to your inbox'} 📬
              </div>
            </>
          )}
        </div>

        {/* Stappen indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 'auto' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: i <= stap ? 'white' : 'rgba(255,255,255,0.25)',
                color: i <= stap ? '#6366f1' : 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {i < stap ? '✓' : i}
              </div>
              <div style={{
                fontSize: 13, fontWeight: i === stap ? 700 : 400,
                color: i === stap ? 'white' : 'rgba(255,255,255,0.6)',
              }}>
                {i === 1 ? (taal === 'nl' ? 'Jouw land' : taal === 'fr' ? 'Votre pays' : taal === 'de' ? 'Dein Land' : 'Your country') :
                 i === 2 ? (taal === 'nl' ? 'Beleggingen importeren' : taal === 'fr' ? 'Importer' : taal === 'de' ? 'Importieren' : 'Import') :
                 (taal === 'nl' ? 'Updates' : taal === 'fr' ? 'Mises à jour' : taal === 'de' ? 'Updates' : 'Updates')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rechter inhoud */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 48, background: '#f8fafc',
      }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {taal === 'nl' ? `Stap ${stap} van 3` : taal === 'fr' ? `Étape ${stap} sur 3` : taal === 'de' ? `Schritt ${stap} von 3` : `Step ${stap} of 3`}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 8, letterSpacing: '-0.5px' }}>
            {stap === 1 ? t.stap1Titel(voornaam) : stap === 2 ? (taal === 'nl' ? 'Importeer je beleggingen' : taal === 'fr' ? 'Importez vos investissements' : taal === 'de' ? 'Importiere deine Anlagen' : 'Import your investments') :
                stap === 3 ? (taal === 'nl' ? 'Updates' : 'Updates') : t.stap3Titel}
          </h1>
          <p style={{ fontSize: 15, color: '#64748b', marginBottom: 36 }}>
            {stap === 1 ? t.stap1Sub : stap === 2 ? (taal === 'nl' ? 'Voeg je bestaande beleggingen toe aan je portfolio' : taal === 'fr' ? 'Ajoutez vos investissements existants à votre portefeuille' : taal === 'de' ? 'Füge deine bestehenden Anlagen zu deinem Portfolio hinzu' : 'Add your existing investments to your portfolio') : t.stap3Sub}
          </p>

          {/* STAP 1: Land kiezen */}
          {stap === 1 && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                {t.land}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
                {LANDEN.map(l => (
                  <div key={l.code} onClick={() => setGekozenLand(l.code)} style={{
                    padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                    border: gekozenLand === l.code ? '2px solid #6366f1' : '1.5px solid #e2e8f0',
                    background: gekozenLand === l.code ? '#eef2ff' : 'white',
                    display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: 22 }}>{l.vlag}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{l.naam}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{l.valuta}</div>
                    </div>
                    {gekozenLand === l.code && (
                      <span style={{ marginLeft: 'auto', color: '#6366f1', fontSize: 16 }}>✓</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Belastinginfo preview */}
              {belasting && (
                <div style={{
                  background: 'white', borderRadius: 12, padding: '16px 20px',
                  border: '1px solid #e2e8f0', marginBottom: 32,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t.belastingTitel}
                  </div>
                  {belasting.regels.map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: i < belasting.regels.length - 1 ? '1px solid #f1f5f9' : 'none',
                      fontSize: 13,
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.naam}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.info}</div>
                      </div>
                      <span style={{ fontWeight: 700, color: '#6366f1', flexShrink: 0, marginLeft: 16 }}>{r.waarde}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setStap(2)} style={btnStijl('#6366f1')}>
                {t.volgende} →
              </button>
            </div>
          )}

          {/* STAP 2: Beleggingen importeren */}
          {stap === 2 && (
            <div>
              {/* Drag & drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#eef2ff'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
                onClick={() => document.getElementById('bestand-input').click()}
                style={{
                  border: '2px dashed #e2e8f0', borderRadius: 14, padding: '48px 24px',
                  textAlign: 'center', cursor: 'pointer', background: 'white',
                  marginBottom: 16, transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 16 }}>⬆️</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
                  {taal === 'nl' ? 'Drag & drop een exportbestand van eender welke broker hier.' :
                   taal === 'fr' ? "Glissez-déposez un fichier d'export de n'importe quel courtier ici." :
                   taal === 'de' ? 'Ziehen Sie eine Exportdatei von einem beliebigen Broker hierher.' :
                   'Drag & drop an export file from any broker here.'}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                  {taal === 'nl' ? 'Of klik om te bladeren' :
                   taal === 'fr' ? 'Ou cliquez pour parcourir' :
                   taal === 'de' ? 'Oder klicken zum Durchsuchen' :
                   'Or click to browse'} (CSV, XLSX, XLS)
                </div>
                <input id="bestand-input" type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} />
              </div>

              {/* Ondersteunde brokers */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#64748b' }}>
                ✓ {taal === 'nl' ? 'Werkt met exports van: Saxo, Bolero, Degiro, Keytrade en meer' :
                    taal === 'fr' ? 'Fonctionne avec les exports de: Saxo, Bolero, Degiro, Keytrade et plus' :
                    taal === 'de' ? 'Funktioniert mit Exporten von: Saxo, Bolero, Degiro, Keytrade und mehr' :
                    'Works with exports from: Saxo, Bolero, Degiro, Keytrade and more'}
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <button onClick={() => setStap(1)} style={btnStijl('#e2e8f0', '#64748b')}>
                  ←
                </button>
                <button onClick={() => setStap(3)} style={{ ...btnStijl('#6366f1'), flex: 1 }}>
                  {taal === 'nl' ? 'Importeer en ga verder' :
                   taal === 'fr' ? 'Importer et continuer' :
                   taal === 'de' ? 'Importieren und weiter' :
                   'Import and continue'} →
                </button>
              </div>

              {/* Ik doe dit later */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => setStap(3)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textDecoration: 'underline' }}
                >
                  {taal === 'nl' ? 'Ik doe dit later' :
                   taal === 'fr' ? 'Je le ferai plus tard' :
                   taal === 'de' ? 'Ich mache das später' :
                   "I'll do this later"}
                </button>
              </div>
            </div>
          )}

          {/* STAP 3: Updates */}
          {stap === 3 && (
            <div>
              {/* Email toggle */}
              {[
                {
                  key: 'email',
                  titel: 'Email',
                  sub: taal === 'nl' ? 'Een dagelijks overzicht van je beleggingsportfolio in je inbox' :
                       taal === 'fr' ? 'Un aperçu quotidien de votre portefeuille dans votre boîte mail' :
                       taal === 'de' ? 'Eine tägliche Übersicht deines Portfolios in deinem Posteingang' :
                       'A daily overview of your investment portfolio in your inbox',
                  standaard: true,
                },
                {
                  key: 'whatsapp',
                  titel: 'WhatsApp',
                  sub: taal === 'nl' ? 'Een dagelijks overzicht van je beleggingsportfolio als WhatsApp-berichtje' :
                       taal === 'fr' ? 'Un aperçu quotidien de votre portefeuille en message WhatsApp' :
                       taal === 'de' ? 'Eine tägliche Übersicht deines Portfolios als WhatsApp-Nachricht' :
                       'A daily overview of your investment portfolio as a WhatsApp message',
                  standaard: false,
                },
              ].map(item => (
                <div key={item.key} style={{
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
                  padding: '18px 20px', marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{item.titel}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{item.sub}</div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0, marginLeft: 16 }}>
                    <input
                      type="checkbox"
                      defaultChecked={item.standaard}
                      style={{ opacity: 0, width: 0, height: 0 }}
                      onChange={e => {
                        const slider = e.target.nextSibling;
                        slider.style.background = e.target.checked ? '#6366f1' : '#e2e8f0';
                        slider.querySelector('span').style.transform = e.target.checked ? 'translateX(20px)' : 'translateX(0)';
                      }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', inset: 0,
                      background: item.standaard ? '#6366f1' : '#e2e8f0',
                      borderRadius: 24, transition: '0.2s',
                    }}>
                      <span style={{
                        position: 'absolute', height: 18, width: 18, left: 3, bottom: 3,
                        background: 'white', borderRadius: '50%', transition: '0.2s',
                        transform: item.standaard ? 'translateX(20px)' : 'translateX(0)',
                        display: 'block',
                      }} />
                    </span>
                  </label>
                </div>
              ))}

              <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                <button onClick={() => setStap(2)} style={btnStijl('#e2e8f0', '#64748b')}>
                  ←
                </button>
                <button onClick={afronden} disabled={laden} style={{ ...btnStijl('#6366f1'), flex: 1 }}>
                  {laden ? '...' : taal === 'nl' ? 'Naar je portfolio →' : taal === 'fr' ? 'Vers votre portefeuille →' : taal === 'de' ? 'Zu deinem Portfolio →' : 'To your portfolio →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function btnStijl(bg, kleur = 'white') {
  return {
    padding: '14px 24px', borderRadius: 10, border: 'none',
    background: bg, color: kleur, cursor: 'pointer',
    fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
    width: '100%', transition: 'all 0.2s',
  };
}
