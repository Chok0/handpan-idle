#!/usr/bin/env node
// Récupère les polices de la charte (sous-ensemble latin) depuis Google Fonts et les écrit
// dans ressources/fonts/. À relancer uniquement pour changer de famille ou de version —
// les .woff2 sont commités, le jeu ne dépend d'aucun CDN à l'exécution.
//
//   node scripts/fetch-fonts.mjs
//
// Ce sont des fontes VARIABLES : un fichier par famille couvre toute la plage de graisses.
// css/fonts.css est écrit à la main d'après ce que ce script télécharge (font-weight min max).
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const API = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600'
  + '&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap';
// Sans user-agent moderne, l'API renvoie du .ttf au lieu du .woff2 (10x plus lourd).
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const css = await (await fetch(API, { headers: { 'User-Agent': UA } })).text();
// Le latin-1 couvre tout le français, œ (U+0153) compris : les autres sous-ensembles
// (cyrillique, vietnamien, latin-ext) seraient du poids mort.
const latin = [...css.matchAll(/\/\*\s*latin\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)].map((m) => m[1]);

await mkdir(new URL('../ressources/fonts/', import.meta.url), { recursive: true });
const done = new Set();
for (const block of latin) {
  const url = block.match(/url\(([^)]+)\)/)[1];
  if (done.has(url)) continue;
  done.add(url);
  const family = block.match(/font-family:\s*'([^']+)'/)[1];
  const name = `${family.toLowerCase().replace(/ /g, '-')}-latin-${createHash('sha1').update(url).digest('hex').slice(0, 6)}.woff2`;
  const bytes = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  await writeFile(new URL(`../ressources/fonts/${name}`, import.meta.url), bytes);
  console.log(`${name} — ${Math.round(bytes.length / 1024)} Ko (${family})`);
}
console.log('\nMettre à jour les url() de css/fonts.css si les noms de fichiers ont changé.');
