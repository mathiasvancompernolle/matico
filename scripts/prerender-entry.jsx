// Wordt door scripts/prerender.mjs gebundeld en in Node uitgevoerd: zet de
// publieke pagina's om naar gewone HTML voor zoekmachines en snelle eerste weergave.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Landing from '../src/pages/Landing';
import Gids from '../src/pages/Gids';
import Privacybeleid from '../src/pages/Privacybeleid';
import { Voorwaarden, Disclaimer } from '../src/pages/Juridisch';
import Rekenhulp, { REKENHULP_PADEN } from '../src/pages/Rekenhulp';
import GidsArtikel from '../src/pages/GidsArtikel';
import { GIDS_ARTIKELS } from '../src/data/gidsArtikels';

const niets = () => {};

export const paginas = {
  '/': () => <Landing onNaarApp={niets} onPrivacybeleid={niets} onGids={niets} onVoorwaarden={niets} onDisclaimer={niets} />,
  '/gids': () => <Gids onTerug={niets} onNaarApp={niets} />,
  '/privacybeleid': () => <Privacybeleid onTerug={niets} />,
  '/voorwaarden': () => <Voorwaarden onTerug={niets} />,
  '/disclaimer': () => <Disclaimer onTerug={niets} />,
  ...Object.fromEntries(GIDS_ARTIKELS.map(a => [`/gids/${a.slug}`, () => <GidsArtikel artikel={a} onNaarApp={niets} />])),
  ...Object.fromEntries(Object.entries(REKENHULP_PADEN).map(([pad, { soort, taal }]) => [pad, () => <Rekenhulp soort={soort} taal={taal} onNaarApp={niets} />])),
};

export const render = (pad) => renderToStaticMarkup(paginas[pad]());

// Titels/beschrijvingen + gestructureerde gegevens (Article) voor de artikels
export const extraMeta = Object.fromEntries(GIDS_ARTIKELS.map(a => [`/gids/${a.slug}`, {
  titel: a.seoTitel, beschrijving: a.beschrijving,
  jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: a.titel, description: a.beschrijving, inLanguage: 'nl-BE',
    dateModified: a.nagekeken, author: { '@type': 'Organization', name: 'Kapitas', url: 'https://www.kapitas.be/' },
    publisher: { '@type': 'Organization', name: 'Kapitas', logo: { '@type': 'ImageObject', url: 'https://www.kapitas.be/favicon-512.png' } },
    mainEntityOfPage: `https://www.kapitas.be/gids/${a.slug}` },
}]));
