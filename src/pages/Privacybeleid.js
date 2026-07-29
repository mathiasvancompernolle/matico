// v2-cookievoorkeuren-knop
import React from 'react';
import { heropenCookieBanner } from '../components/CookieConsent';

// Privacybeleid-pagina. Inhoud is opgesteld op basis van hoe Kapitas
// technisch in elkaar zit (Supabase-login, localStorage voor portefeuille-
// data, gratis marktdata-API's zonder persoonsgegevens, Crisp voor chat).
// Dit is een goede, eerlijke basis — geen juridisch advies. Laat dit
// controleren door een jurist/gegevensbeschermingsspecialist voor je
// dit als officieel, publiek privacybeleid gebruikt, zeker bij commerciële
// lancering.
export default function Privacybeleid({ onTerug }) {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 820 }}>
      {onTerug && (
        <div onClick={onTerug} style={{ cursor: 'pointer', color: 'var(--accent, #1e3a8a)', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          ← Terug naar website
        </div>
      )}
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Privacybeleid</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
        Laatst bijgewerkt: [DATUM INVULLEN]
      </p>

      <Sectie titel="1. Wie zijn wij">
        <p>
          Kapitas ("wij", "ons") is een beleggingsdashboard voor de Belgische markt.
          Dit privacybeleid legt uit welke gegevens we verzamelen wanneer je Kapitas
          gebruikt, waarom, en welke rechten je hebt.
        </p>
        <p>
          Verantwoordelijke voor de verwerking: [JOUW NAAM / BEDRIJFSNAAM INVULLEN]<br />
          Contact: mathiasvancompernolle1@gmail.com
        </p>
      </Sectie>

      <Sectie titel="2. Welke gegevens we verzamelen">
        <SubTitel>Accountgegevens</SubTitel>
        <p>
          Bij het aanmelden via Google (Google OAuth, verwerkt via Supabase) ontvangen
          we je naam, e-mailadres en profielfoto zoals gekoppeld aan je Google-account.
          We gebruiken dit enkel om je account aan te maken en je aan te melden.
        </p>
        <SubTitel>Portefeuillegegevens</SubTitel>
        <p>
          De beleggingen die je toevoegt (naam, aantal, aankoopprijs, aankoopdatum, ...)
          worden lokaal opgeslagen in de browser van jouw toestel (localStorage), niet
          in een centrale database. Dit betekent dat wij als beheerders van Kapitas deze
          gegevens niet kunnen inzien, en dat ze verloren gaan als je je browsergegevens
          wist of van toestel wisselt.
        </p>
        <SubTitel>Gebruiksgegevens</SubTitel>
        <p>
          We houden geen aparte analytics/trackingtools bij buiten wat hieronder bij
          "Cookies" vermeld staat.
        </p>
      </Sectie>

      <Sectie titel="3. Externe partijen waarmee we gegevens delen">
        <p>Kapitas maakt gebruik van volgende externe dienstverleners (verwerkers):</p>
        <Tabel
          rijen={[
            ['Supabase', 'Authenticatie (Google-login)', 'EU/VS'],
            ['Google', 'Inloggen via je Google-account', 'VS'],
            ['Crisp', 'Klantenondersteuning via chat', 'EU (Frankrijk/Nederland)'],
            ['Vercel', 'Hosting van de website', 'EU/VS'],
            ['Yahoo Finance, Finnhub, EODHD, Financial Modeling Prep, NewsAPI, CoinGecko, OpenRouter', 'Live koersen, marktdata, nieuws en AI-analyse — deze partijen ontvangen enkel de tickersymbolen waarnaar je zoekt, geen persoonsgegevens', 'Diverse'],
          ]}
        />
        <p>
          Met verwerkers die persoonsgegevens verwerken (Crisp, Supabase) hebben we,
          waar vereist, een verwerkersovereenkomst (Data Processing Agreement) afgesloten.
        </p>
      </Sectie>

      <Sectie titel="4. Cookies">
        <p>
          Kapitas gebruikt volgende cookies:
        </p>
        <ul style={{ margin: '8px 0 8px 20px', lineHeight: 1.8 }}>
          <li><strong>Functionele/noodzakelijke cookies</strong> — voor het bijhouden van je ingelogde sessie (via Supabase). Deze zijn nodig om de app te laten werken en vragen geen toestemming.</li>
          <li><strong>Chat-cookie (Crisp)</strong> — enkel geplaatst nadat je hier expliciet toestemming voor geeft via de cookiebanner. Zonder toestemming wordt de chatwidget niet geladen.</li>
        </ul>
        <p>
          Je kan je toestemming op elk moment aanpassen:
        </p>
        <button onClick={heropenCookieBanner} style={{
          padding: '10px 18px', background: 'var(--accent, #1e3a8a)', color: 'white',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 13, fontWeight: 600, marginTop: 4,
        }}>
          Cookievoorkeuren wijzigen
        </button>
      </Sectie>

      <Sectie titel="5. Bewaartermijn">
        <p>
          Accountgegevens bewaren we zolang je een account bij ons hebt. Portefeuillegegevens
          staan enkel lokaal op jouw toestel en worden door ons niet apart bewaard. Verwijder
          je je account, dan verwijderen we ook de bijhorende accountgegevens uit ons systeem.
        </p>
      </Sectie>

      <Sectie titel="6. Jouw rechten">
        <p>Onder de Algemene Verordening Gegevensbescherming (AVG/GDPR) heb je het recht om:</p>
        <ul style={{ margin: '8px 0 8px 20px', lineHeight: 1.8 }}>
          <li>je gegevens in te zien;</li>
          <li>onjuiste gegevens te laten corrigeren;</li>
          <li>je gegevens te laten verwijderen;</li>
          <li>de verwerking van je gegevens te beperken of hiertegen bezwaar te maken;</li>
          <li>je gegevens in een overdraagbaar formaat te ontvangen (dataportabiliteit).</li>
        </ul>
        <p>
          Om een van deze rechten uit te oefenen, contacteer je ons via mathiasvancompernolle1@gmail.com.
          Je hebt ook het recht om een klacht in te dienen bij de Belgische
          Gegevensbeschermingsautoriteit (GBA) via <em>gegevensbeschermingsautoriteit.be</em>.
        </p>
      </Sectie>

      <Sectie titel="7. Beveiliging">
        <p>
          We nemen redelijke technische en organisatorische maatregelen om je gegevens te
          beschermen tegen ongeoorloofde toegang, verlies of misbruik. Geen enkel systeem is
          echter 100% waterdicht.
        </p>
      </Sectie>

      <Sectie titel="8. Wijzigingen aan dit beleid">
        <p>
          We kunnen dit privacybeleid van tijd tot tijd aanpassen. Belangrijke wijzigingen
          communiceren we via de app of per e-mail.
        </p>
      </Sectie>

      <Sectie titel="9. Contact">
        <p>
          Vragen over dit privacybeleid of over hoe we met je gegevens omgaan?
          Contacteer ons via mathiasvancompernolle1@gmail.com, of gebruik de chat rechtsonder.
        </p>
      </Sectie>
    </div>
  );
}

function Sectie({ titel, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{titel}</h2>
      <div style={{ fontSize: 14, color: 'var(--text-secondary, #374151)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}

function SubTitel({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 4 }}>{children}</div>;
}

function Tabel({ rijen }) {
  return (
    <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, overflow: 'hidden', margin: '10px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 0.6fr', background: 'var(--bg, #f9fafb)', fontWeight: 700, fontSize: 12, padding: '8px 12px' }}>
        <div>Partij</div><div>Doel</div><div>Locatie</div>
      </div>
      {rijen.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 0.6fr', padding: '8px 12px', fontSize: 12, borderTop: '1px solid var(--border, #e5e7eb)' }}>
          <div>{r[0]}</div><div>{r[1]}</div><div>{r[2]}</div>
        </div>
      ))}
    </div>
  );
}
