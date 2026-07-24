import { useEffect } from 'react';

// ⚠️ TODO: vervang dit door je eigen Crisp Website ID (te vinden in je Crisp
// dashboard onder Settings → Setup instructions). Dit ID zelf is niet geheim
// (het staat sowieso zichtbaar in de client-side broncode), dus gewoon
// hardcoden hier is voldoende — geen environment variable nodig.
const CRISP_WEBSITE_ID = 'e15b16c7-9fc8-43b9-ab3f-e52b1224e23d';

let scriptGeladen = false;

function laadCrispScript() {
  if (scriptGeladen || typeof window === 'undefined') return;
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
// toestemming ('geaccepteerd') — nooit stilzwijgend vooraf.
export default function CrispChat({ toestemming }) {
  useEffect(() => {
    if (toestemming === 'geaccepteerd') {
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
