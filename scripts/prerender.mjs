// Na `react-scripts build`: maakt voor elke publieke pagina een eigen HTML-bestand
// met de echte inhoud, een eigen titel/beschrijving en een canonieke URL.
// Zoekmachines (en AI-zoekmachines die geen JavaScript uitvoeren) zien zo de
// volledige tekst; de app neemt de pagina daarna gewoon over.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const hier = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(hier, '..');
const build = path.join(root, 'build');
const SITE = 'https://www.kapitas.be';

const META = {
  '/': {
    titel: 'Kapitas – Gratis portfolio tracker voor Belgische beleggers',
    beschrijving: "Volg al je aandelen, ETF's en crypto van elke broker in één gratis overzicht. Met automatische berekening van beurstaks (TOB), dividendbelasting en meerwaardebelasting.",
  },
  '/gids': {
    titel: 'Beginnen met beleggen in België: gids voor beginners – Kapitas',
    beschrijving: 'Leer beleggen zonder jargon: aandelen, ETF\'s en obligaties uitgelegd, wat beleggen in België kost aan taksen, hoe je een broker kiest en je eerste aankoop in vijf stappen.',
  },
  '/privacybeleid': {
    titel: 'Privacybeleid – Kapitas',
    beschrijving: 'Hoe Kapitas met je gegevens omgaat: welke gegevens we bewaren, waarom, en welke rechten je hebt.',
  },
  '/voorwaarden': {
    titel: 'Algemene voorwaarden – Kapitas',
    beschrijving: 'De algemene voorwaarden voor het gebruik van Kapitas, de portfolio tracker voor Belgische beleggers.',
  },
  '/disclaimer': {
    titel: 'Disclaimer – Kapitas',
    beschrijving: 'Kapitas geeft geen beleggingsadvies. Lees hier hoe je de informatie en berekeningen in Kapitas moet interpreteren.',
  },
  '/meerwaardebelasting-berekenen': {
    titel: 'Meerwaardebelasting berekenen 2026 – gratis rekenhulp – Kapitas',
    beschrijving: 'Bereken gratis hoeveel meerwaardebelasting (10%) je betaalt op aandelen, ETF\'s en crypto. Met de vrijstelling van €10.000, verliezen en de waarde op 31/12/2025.',
    taal: 'nl-BE', alternatief: { 'fr-BE': '/fr/calcul-taxe-plus-values' },
  },
  '/beurstaks-berekenen': {
    titel: 'Beurstaks (TOB) berekenen – gratis rekenhulp – Kapitas',
    beschrijving: 'Bereken gratis hoeveel beurstaks je betaalt op aandelen, ETF\'s en obligaties: 0,12%, 0,35% of 1,32%, met de maximumbedragen per transactie.',
    taal: 'nl-BE', alternatief: { 'fr-BE': '/fr/calcul-taxe-boursiere' },
  },
  '/fr/calcul-taxe-plus-values': {
    titel: 'Calculer la taxe sur les plus-values 2026 (Belgique) – Kapitas',
    beschrijving: 'Calculez gratuitement la taxe de 10 % sur les plus-values de vos actions, ETF et cryptos. Avec l\'exonération de 10 000 €, les pertes et la valeur au 31/12/2025.',
    taal: 'fr-BE', alternatief: { 'nl-BE': '/meerwaardebelasting-berekenen' },
  },
  '/dividendbelasting-berekenen': {
    titel: 'Dividendbelasting berekenen: roerende voorheffing en vrijstelling – Kapitas',
    beschrijving: 'Bereken gratis hoeveel belasting je betaalt op dividenden: buitenlandse bronheffing en 30% roerende voorheffing. En hoeveel je terugkrijgt via de vrijstelling van €833.',
    taal: 'nl-BE', alternatief: { 'fr-BE': '/fr/calcul-precompte-dividendes' },
  },
  '/fr/calcul-precompte-dividendes': {
    titel: 'Calculer le précompte mobilier sur dividendes (Belgique) – Kapitas',
    beschrijving: 'Calculez gratuitement l\'impôt sur vos dividendes : retenue à la source étrangère et précompte mobilier de 30 %. Et combien vous récupérez grâce à l\'exonération de 833 €.',
    taal: 'fr-BE', alternatief: { 'nl-BE': '/dividendbelasting-berekenen' },
  },
  '/fr/calcul-taxe-boursiere': {
    titel: 'Calculer la taxe boursière (TOB) en Belgique – Kapitas',
    beschrijving: 'Calculez gratuitement la taxe sur les opérations de bourse pour vos actions, ETF et obligations : 0,12 %, 0,35 % ou 1,32 %, avec les maximums par transaction.',
    taal: 'fr-BE', alternatief: { 'nl-BE': '/beurstaks-berekenen' },
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE}/#organisatie`, name: 'Kapitas', url: `${SITE}/`, logo: `${SITE}/favicon-512.png`, email: 'hello@kapitas.be' },
    { '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'Kapitas', url: `${SITE}/`, inLanguage: 'nl-BE', publisher: { '@id': `${SITE}/#organisatie` } },
    {
      '@type': 'WebApplication', name: 'Kapitas', url: `${SITE}/`, applicationCategory: 'FinanceApplication', operatingSystem: 'Web, iOS, Android',
      inLanguage: ['nl-BE', 'fr-BE', 'en'], description: META['/'].beschrijving,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    },
  ],
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// 1. Pagina's bundelen voor Node (afbeeldingen inline, CSS-imports genegeerd)
const uit = path.join(root, 'node_modules', '.cache', 'kapitas-prerender.cjs');
await esbuild.build({
  entryPoints: [path.join(hier, 'prerender-entry.jsx')],
  bundle: true, platform: 'node', format: 'cjs', outfile: uit, jsx: 'automatic', logLevel: 'warning',
  loader: { '.js': 'jsx', '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.css': 'empty' },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const { render, extraMeta } = createRequire(import.meta.url)(uit);
Object.assign(META, extraMeta || {});

// 2. HTML per pagina schrijven
const sjabloon = fs.readFileSync(path.join(build, 'index.html'), 'utf8');
const vervang = (html, re, nieuw) => {
  if (!re.test(html)) throw new Error('Niet gevonden in index.html: ' + re);
  return html.replace(re, nieuw);
};

for (const [pad, { titel, beschrijving, taal, alternatief, jsonld }] of Object.entries(META)) {
  const url = SITE + (pad === '/' ? '/' : pad);
  let html = sjabloon;
  if (taal) {
    html = vervang(html, /<html lang="[^"]*"/, `<html lang="${taal}"`);
    if (taal.startsWith('fr')) html = html.replace(/<meta property="og:locale" content="[^"]*"\s*\/?>/, '<meta property="og:locale" content="fr_BE"/>');
  }
  if (alternatief) {
    const links = { [taal]: pad, ...alternatief };
    html = html.replace('</head>', Object.entries(links).map(([hl, p]) => `<link rel="alternate" hreflang="${hl}" href="${SITE}${p}"/>`).join('') + '</head>');
  }
  html = vervang(html, /<title>[^<]*<\/title>/, `<title>${esc(titel)}</title>`);
  html = vervang(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(beschrijving)}"/>`);
  html = vervang(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(titel)}"/>`);
  html = vervang(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(beschrijving)}"/>`);
  html = vervang(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${esc(titel)}"/>`);
  html = vervang(html, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${esc(beschrijving)}"/>`);
  html = vervang(html, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}"/>`);
  html = vervang(html, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}"/>`);
  if (pad === '/') html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(JSON_LD)}</script></head>`);
  if (jsonld) html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(jsonld)}</script></head>`);
  html = html.replace(/<meta property="og:type" content="[^"]*"\s*\/?>/,`<meta property="og:type" content="${jsonld ? 'article' : 'website'}"/>`);
  // De inhoud staat er nu echt: de <noscript>-melding (met een tweede <h1>) is overbodig.
  // Zonder JavaScript blijven de inschuif-animaties weg, dus de tekst meteen tonen.
  html = vervang(html, /<noscript>[\s\S]*?<\/noscript>/, '');
  html = html.replace('</head>', '<noscript><style>.l-animate{opacity:1!important;transform:none!important}</style></noscript></head>');
  html = vervang(html, /<div id="root"><\/div>/, `<div id="root"><div data-prerender="">${render(pad)}</div></div>`);
  const bestand = pad === '/' ? 'index.html' : pad.slice(1) + '.html';
  fs.mkdirSync(path.dirname(path.join(build, bestand)), { recursive: true });
  fs.writeFileSync(path.join(build, bestand), html);
  // Bestaat er ook een map met dezelfde naam (bv. /gids en /gids/<artikel>),
  // dan ook als index.html in die map, zodat het adres zeker werkt
  if (pad !== '/' && Object.keys(META).some(p => p.startsWith(pad + '/'))) {
    fs.mkdirSync(path.join(build, pad.slice(1)), { recursive: true });
    fs.writeFileSync(path.join(build, pad.slice(1), 'index.html'), html);
  }
  console.log(`prerender: ${pad} → build/${bestand} (${Math.round(html.length / 1024)} KB)`);
}

// 3. Echte 404-pagina (Vercel geeft die met status 404 terug)
let nietGevonden = sjabloon;
nietGevonden = vervang(nietGevonden, /<title>[^<]*<\/title>/, '<title>Pagina niet gevonden – Kapitas</title><meta name="robots" content="noindex"/>');
nietGevonden = vervang(nietGevonden, /<div id="root"><\/div>/,
  `<div id="root" style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',system-ui,sans-serif;background:#f8fafc;padding:24px;box-sizing:border-box">
    <div style="text-align:center;max-width:420px">
      <div style="font-size:22px;font-weight:800;color:#1e3a8a;margin-bottom:24px">Kapitas</div>
      <h1 style="font-size:28px;margin:0 0 12px;color:#0f172a">Deze pagina bestaat niet</h1>
      <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 28px">Misschien is de link verouderd of zit er een typfout in het adres.</p>
      <a href="/" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px">Naar Kapitas</a>
    </div>
  </div>`);
// Geen app-scripts op de 404-pagina
nietGevonden = nietGevonden.replace(/<script defer="defer" src="\/static\/js\/[^"]+"><\/script>/g, '');
fs.writeFileSync(path.join(build, '404.html'), nietGevonden);
console.log('prerender: 404 → build/404.html');
