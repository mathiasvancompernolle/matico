// Wordt door scripts/prerender.mjs gebundeld en in Node uitgevoerd: zet de
// publieke pagina's om naar gewone HTML voor zoekmachines en snelle eerste weergave.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Landing from '../src/pages/Landing';
import Gids from '../src/pages/Gids';
import Privacybeleid from '../src/pages/Privacybeleid';
import { Voorwaarden, Disclaimer } from '../src/pages/Juridisch';

const niets = () => {};

export const paginas = {
  '/': () => <Landing onNaarApp={niets} onPrivacybeleid={niets} onGids={niets} onVoorwaarden={niets} onDisclaimer={niets} />,
  '/gids': () => <Gids onTerug={niets} onNaarApp={niets} />,
  '/privacybeleid': () => <Privacybeleid onTerug={niets} />,
  '/voorwaarden': () => <Voorwaarden onTerug={niets} />,
  '/disclaimer': () => <Disclaimer onTerug={niets} />,
};

export const render = (pad) => renderToStaticMarkup(paginas[pad]());
