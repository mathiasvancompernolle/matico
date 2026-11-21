// Meldt alle pagina's uit de sitemap (of de opgegeven adressen) aan bij
// IndexNow, zodat Bing, Yandex, Seznam, ... ze meteen opnieuw bezoeken.
// Gebruik NA een livegang:  node scripts/indexnow.mjs [https://www.kapitas.be/pad ...]
// De sleutel is publiek (hij staat als bestand op de site); dat is hoe IndexNow werkt.
const SLEUTEL = 'e0e70398f48837887a3048767bb9f0af';
const HOST = 'www.kapitas.be';

let urls = process.argv.slice(2);
if (urls.length === 0) {
  const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: SLEUTEL, keyLocation: `https://${HOST}/${SLEUTEL}.txt`, urlList: urls }),
});
console.log(`IndexNow: ${res.status} ${res.statusText} — ${urls.length} adressen`);
if (res.status >= 300) console.log(await res.text());
