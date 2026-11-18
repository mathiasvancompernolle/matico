// Algemene voorwaarden en disclaimer van Kapitas.
// Opgesteld als eerlijke, duidelijke basis op maat van hoe Kapitas werkt
// (gratis dienst, geen beleggingsadvies, koersen van derden). Geen juridisch
// advies: laat dit nakijken door een jurist, zeker vóór je ooit betalende
// functies invoert.
import React from 'react';

const CONTACT = 'mathiasvancompernolle1@gmail.com';
const LAATST_BIJGEWERKT = '18 november 2026';

function Pagina({ titel, onTerug, children }) {
  return (
    <div style={{ padding: '32px clamp(16px, 5vw, 40px)', maxWidth: 820 }}>
      {onTerug && (
        <div onClick={onTerug} style={{ cursor: 'pointer', color: 'var(--accent, #1e3a8a)', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          ← Terug naar website
        </div>
      )}
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{titel}</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
        Laatst bijgewerkt: {LAATST_BIJGEWERKT}
      </p>
      {children}
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

const lijst = { margin: '8px 0 8px 20px', lineHeight: 1.8 };

export function Voorwaarden({ onTerug }) {
  return (
    <Pagina titel="Algemene voorwaarden" onTerug={onTerug}>
      <Sectie titel="1. Wie zijn wij">
        <p>
          Kapitas (kapitas.be) is een online beleggingsdashboard voor Belgische beleggers,
          uitgebaat door Mathias Van Compernolle ("Kapitas", "wij", "ons").
          Je bereikt ons via {CONTACT}.
        </p>
      </Sectie>

      <Sectie titel="2. Toepassing">
        <p>
          Deze voorwaarden gelden voor elk gebruik van Kapitas. Door een account aan te maken
          of Kapitas te gebruiken, ga je ermee akkoord. Ben je het er niet mee eens, gebruik
          Kapitas dan niet.
        </p>
      </Sectie>

      <Sectie titel="3. De dienst">
        <p>
          Met Kapitas kan je je beleggingen opvolgen, marktgegevens bekijken en een indicatieve
          inschatting maken van Belgische belastingen op beleggingen.
        </p>
        <p>
          Kapitas is momenteel volledig gratis. We kunnen functies toevoegen, wijzigen of
          stopzetten. Voeren we ooit betalende functies in, dan melden we dat vooraf en
          rekenen we nooit iets aan zonder dat je daar zelf uitdrukkelijk voor kiest.
        </p>
        <p>
          We doen ons best om Kapitas goed en zonder onderbreking te laten werken, maar we
          kunnen niet garanderen dat de dienst altijd beschikbaar of foutloos is.
        </p>
      </Sectie>

      <Sectie titel="4. Je account">
        <ul style={lijst}>
          <li>Je moet minstens 18 jaar zijn om een account aan te maken.</li>
          <li>Je geeft juiste gegevens op en houdt je inloggegevens geheim.</li>
          <li>Je bent verantwoordelijk voor wat er via je account gebeurt.</li>
          <li>Je kan je account op elk moment laten verwijderen door ons te contacteren.</li>
        </ul>
      </Sectie>

      <Sectie titel="5. Geen beleggings- of fiscaal advies">
        <p>
          Kapitas is geen bank, broker, beleggingsonderneming of financieel adviseur en heeft
          geen vergunning van de FSMA. Alle informatie in Kapitas (koersen, analyses,
          AI-analyses, belastingberekeningen, gidsen, ...) is louter informatief en is geen
          persoonlijk beleggings-, fiscaal of juridisch advies. Je neemt je beleggings-
          beslissingen zelf en op eigen verantwoordelijkheid. Zie ook onze disclaimer.
        </p>
      </Sectie>

      <Sectie titel="6. Gegevens van derden">
        <p>
          Koersen, nieuws en andere marktgegevens komen van externe bronnen. Ze kunnen
          vertraagd, onvolledig of fout zijn. Wij controleren die gegevens niet en geven
          geen garantie over hun juistheid.
        </p>
      </Sectie>

      <Sectie titel="7. Aanvaardbaar gebruik">
        <p>Je gebruikt Kapitas niet om:</p>
        <ul style={lijst}>
          <li>de dienst te overbelasten, te verstoren of te proberen binnen te dringen;</li>
          <li>automatisch grote hoeveelheden gegevens op te halen (scraping);</li>
          <li>de gegevens of analyses uit Kapitas commercieel door te verkopen;</li>
          <li>iets te doen dat in strijd is met de wet.</li>
        </ul>
        <p>Bij misbruik kunnen we je toegang schorsen of je account verwijderen.</p>
      </Sectie>

      <Sectie titel="8. Aansprakelijkheid">
        <p>
          Voor zover de wet dat toelaat, zijn we niet aansprakelijk voor schade die
          voortvloeit uit het gebruik van Kapitas, uit beleggingsbeslissingen die je neemt,
          uit fouten of vertragingen in gegevens, of uit het tijdelijk niet beschikbaar zijn
          van de dienst. Dit beperkt nooit onze aansprakelijkheid voor opzet of zware fout,
          of je rechten als consument die de wet je dwingend toekent.
        </p>
      </Sectie>

      <Sectie titel="9. Intellectuele eigendom">
        <p>
          De naam Kapitas, het ontwerp, de teksten en de software van Kapitas zijn van ons
          (of van onze licentiegevers). Je mag ze niet kopiëren of hergebruiken zonder onze
          toestemming. De gegevens die je zelf invoert, blijven van jou.
        </p>
      </Sectie>

      <Sectie titel="10. Privacy">
        <p>
          Hoe we met je persoonsgegevens omgaan, lees je in ons privacybeleid op
          kapitas.be/privacybeleid.
        </p>
      </Sectie>

      <Sectie titel="11. Wijzigingen">
        <p>
          We kunnen deze voorwaarden aanpassen. Belangrijke wijzigingen melden we via de app
          of per e-mail. Gebruik je Kapitas daarna verder, dan gelden de nieuwe voorwaarden.
        </p>
      </Sectie>

      <Sectie titel="12. Toepasselijk recht">
        <p>
          Op deze voorwaarden is het Belgisch recht van toepassing. Geschillen worden
          voorgelegd aan de bevoegde Belgische rechtbanken, onverminderd de dwingende
          regels die jou als consument beschermen. Heb je een klacht, contacteer ons dan
          eerst via {CONTACT}, zodat we samen naar een oplossing kunnen zoeken.
        </p>
      </Sectie>
    </Pagina>
  );
}

export function Disclaimer({ onTerug }) {
  return (
    <Pagina titel="Disclaimer" onTerug={onTerug}>
      <Sectie titel="Geen advies">
        <p>
          Kapitas biedt geen beleggingsadvies, fiscaal advies of juridisch advies. Kapitas
          is geen vergunde beleggingsonderneming of financieel adviseur. Niets op kapitas.be
          of in de app is een aanbeveling om een bepaald aandeel, ETF, fonds, crypto of
          ander product te kopen, te verkopen of te houden. Twijfel je, raadpleeg dan een
          erkend financieel of fiscaal adviseur.
        </p>
      </Sectie>

      <Sectie titel="Beleggen houdt risico's in">
        <p>
          De waarde van beleggingen kan dalen en stijgen. Je kan (een deel van) je inleg
          verliezen. Rendementen uit het verleden bieden geen garantie voor de toekomst.
          Voorbeelden en simulaties in Kapitas zijn illustraties, geen voorspellingen.
        </p>
      </Sectie>

      <Sectie titel="Koersen en marktgegevens">
        <p>
          Koersen en andere gegevens komen van externe bronnen. Ze kunnen tot 15 minuten
          (of langer) vertraagd zijn, en kunnen onvolledig of fout zijn. Controleer koersen
          altijd bij je broker voor je een order plaatst.
        </p>
      </Sectie>

      <Sectie titel="Belastingberekeningen">
        <p>
          De belastingberekeningen (meerwaardebelasting, beurstaks, roerende voorheffing,
          Reynders-taks, ...) zijn indicatief en gebaseerd op onze interpretatie van de
          Belgische regels op het moment van schrijven. Wetgeving kan wijzigen en je
          persoonlijke situatie kan afwijken. Ze vervangen je belastingaangifte of het
          advies van een fiscalist niet.
        </p>
      </Sectie>

      <Sectie titel="AI-analyses">
        <p>
          AI-analyses worden automatisch gegenereerd door een taalmodel. Ze kunnen fouten,
          verouderde informatie of onjuiste conclusies bevatten. Gebruik ze hoogstens als
          vertrekpunt voor je eigen onderzoek.
        </p>
      </Sectie>

      <Sectie titel="Externe links">
        <p>
          Kapitas kan verwijzen naar websites van derden, zoals brokers of Wikifin. Wij zijn
          niet verantwoordelijk voor de inhoud of werking van die websites. Een vermelding
          is geen aanbeveling.
        </p>
      </Sectie>

      <Sectie titel="Contact">
        <p>
          Zie je een fout in Kapitas? Laat het ons weten via {CONTACT}.
        </p>
      </Sectie>
    </Pagina>
  );
}
