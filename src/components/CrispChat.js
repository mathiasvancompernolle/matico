import { useEffect } from 'react';

// ⚠️ TODO: vervang dit door je eigen Crisp Website ID (te vinden in je Crisp
// dashboard onder Settings → Setup instructions). Dit ID zelf is niet geheim
// (het staat sowieso zichtbaar in de client-side broncode), dus gewoon
// hardcoden hier is voldoende — geen environment variable nodig.
const CRISP_WEBSITE_ID = 'e15b16c7-9fc8-43b9-ab3f-e52b1224e23d';

// Zelfde breakpoint als de rest van de app (TopNav/AppInner/Overzicht).
const MOBIEL_BREEDTE = 768;

let scriptGeladen = false;

function isMobielScherm() {
  return typeof window !== 'undefined' && window.innerWidth < MOBIEL_BREEDTE;
}

function laadCrispScript() {
  if (scriptGeladen || typeof window === 'undefined') return;
  // De chatknop is op mobiel onbereikbaar (zit achter de vaste onderbalk),
  // dus laad het script daar gewoon niet: geen nutteloze cookies, en geen
  // cookiebanner nodig voor gebruikers die toch nooit bij de widget kunnen.
  if (isMobielScherm()) return;
  scriptGeladen = true;
  window.$crisp = [];
  window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;
  const script = document.createElement('script');
  script.src = 'https://client.crisp.chat/l.js';
  script.async = 1;
  document.head.appendChild(script);
}

function verwijderCrisp() {
  // Crisp biedt geen officiële "unload"-API; we verbergen enkel de widget
  // als de gebruiker cookies weigert of nog niet gekozen heeft.
  if (window.$crisp && window.$crisp.push) {
    try { window.$crisp.push(['do', 'chat:hide']); } catch (e) {}
  }
}

// Render dit component ergens hoog in de boom (bv. in App.js), met de
// cookie-toestemming als prop. Laadt de Crisp-widget pas na expliciete
// toestemming ('geaccepteerd') — nooit stilzwijgend vooraf, en nooit op
// mobiel (zie isMobielScherm hierboven).
export default function CrispChat({ toestemming }) {
  useEffect(() => {
    if (toestemming === 'geaccepteerd' && !isMobielScherm()) {
      laadCrispScript();
      if (window.$crisp && window.$crisp.push) {
        try { window.$crisp.push(['do', 'chat:show']); } catch (e) {}
      }
    } else {
      verwijderCrisp();
    }
  }, [toestemming]);

  return null; // De widget rendert zichzelf via het externe script
}
