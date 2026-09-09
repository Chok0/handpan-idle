# MIGRATION.md — passage de `handpan-idle` (standalone) vers `Mistral_Pans_Website`

Ce document est écrit **avant** la migration, pour qu'elle soit rapide le jour venu. Il
liste ce qui **se supprime**, ce qui **se déplace tel quel**, et ce qui **se réécrit**.
Rien ici n'est urgent tant que le jeu vit dans son propre repo — c'est une carte, pas une
tâche à exécuter maintenant.

## Pourquoi cette séparation aujourd'hui

`handpan-idle` est actuellement un site statique autonome (HTML/CSS/JS + modules ES, sans
build), déployé par sa propre GitHub Action vers GitHub Pages. `Mistral_Pans_Website` est
un site Astro SSR déployé sur Netlify, avec un pan "legacy" de JS/CSS servi par symlinks
(voir son `CLAUDE.md`). Les deux mondes ont des conventions différentes ; ce document fait
le pont.

---

## 1. Ce qui se supprime purement et simplement

| Fichier / dossier | Pourquoi |
|---|---|
| `index.html` | Remplacé par une page Astro (`astro/src/pages/panidle.astro`) qui réutilise `BaseLayout` (Header/Footer/ContactModal déjà fournis). |
| `css/theme.css` | Copie des tokens `--color-*`/`--font-*` de `css/style.css` du site — **doublon à risque de désynchronisation**. Une fois dans le site, la page charge directement le vrai `css/style.css` (déjà chargé globalement par `BaseLayout`) et hérite des tokens sans copie. |
| `css/fonts.css` + `ressources/fonts/*.woff2` | Le jeu auto-héberge Fraunces / Inter / JetBrains Mono parce qu'il est servi seul. Sur le site, ces polices sont déjà celles de la charte : soit `style.css` les déclare déjà (rien à reprendre), soit **ce sont ces fichiers-là qu'il faut y installer** — le site déclare aujourd'hui `--font-display: 'Fraunces'` sans jamais charger la fonte, et retombe donc sur Georgia. Dans ce cas : déplacer les `.woff2` dans `ressources/fonts/` du site et le bloc `@font-face` dans `css/style.css`. |
| `scripts/fetch-fonts.mjs` | Utilitaire ponctuel de récupération des `.woff2` ; inutile une fois les fichiers en place (à garder seulement si l'on veut pouvoir changer de famille). |
| `scripts/dev-server.mjs` | Remplacé par `astro dev` (ou `netlify dev`). |
| `.github/workflows/deploy.yml` | Le déploiement GitHub Pages n'a plus de raison d'être : Netlify build/déploie tout le site, y compris cette page. |
| `playwright.config.js` (`webServer` pointant sur `scripts/dev-server.mjs`) | À réécrire pour pointer sur le serveur de dev Astro (`cd astro && npm run dev`, port 4321) si les tests e2e sont conservés (§4 plus bas). |

## 2. Ce qui se déplace, en respectant les conventions de `Mistral_Pans_Website`

Le `CLAUDE.md` du site range le JS legacy par préoccupation
(`js/core/`, `js/admin/`, `js/services/`, `js/data/`, `js/features/`, `js/pages/`). Le jeu
est un module autonome et cohérent : il devient un **sous-dossier unique dans
`js/features/`**, pas éclaté dans les dossiers existants.

| Depuis (`handpan-idle/`) | Vers (`Mistral_Pans_Website/`) |
|---|---|
| `src/data/*.js` | `js/features/panidle/data/*.js` |
| `src/engine/*.js` | `js/features/panidle/engine/*.js` |
| `src/audio/*.js` | `js/features/panidle/audio/*.js` |
| `src/render/*.js` | `js/features/panidle/render/*.js` |
| `src/main.js` | `js/features/panidle/main.js` |
| `css/game.css` | `css/panidle.css` (convention du site : un fichier CSS par page/feature à la racine de `css/`, ex. `css/boutique.css`) |
| `tests/unit/*.test.js` | `tests/panidle/*.test.js` (racine du repo, à côté des autres `tests/*.test.js`) |
| `tests/e2e/*.spec.js` | `tests/e2e/panidle/*.spec.js` (nouveau : premier usage de Playwright dans ce repo, voir §4) |
| `tests/e2e/helpers.js` | `tests/e2e/panidle/helpers.js` (amorçage commun : ferme la mise en contexte et les jalons narratifs) |
| `DECISIONS.md` | `docs/panidle-decisions.md` (convention `docs/` du site pour la doc de travail) |

Ces modules restent des **modules ES standards** (`import`/`export`) — rien à réécrire en
IIFE/`window.ModuleName` : le site charge déjà des `<script type="module">` ailleurs
(`astro/public/annonce-island.js`), et l'isolation en module évite justement de polluer
l'espace de noms global partagé par tout le JS legacy.

## 3. La page elle-même

Remplacer `index.html` par `astro/src/pages/panidle.astro` :

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---
<BaseLayout title="PanIdle — le clicker handpan" description="…" currentPage="panidle">
  <Fragment slot="head">
    <link rel="stylesheet" href="/css/panidle.css">
  </Fragment>

  {/* le contenu de <body> de index.html : topbar, tabs, 3 écrans, modale offline */}

  <Fragment slot="scripts">
    <script src="/js/features/panidle/main.js?v=1.0.0" type="module" is:inline></script>
  </Fragment>
</BaseLayout>
```

- **Lien de nav** à ajouter dans `astro/src/components/Header.astro`.
- **Cache-busting `?v=`** : `js/features/panidle/main.js` étant chargé en `is:inline` comme
  le reste du JS legacy, il suit la règle du site — bumper le `?v=` à chaque modification
  (voir `CLAUDE.md` du site, section "Cache-busting des assets legacy"). Les modules qu'il
  importe (`./engine/game.js` etc.) sont résolus par le navigateur via des chemins relatifs
  **sans** query de version : soit on accepte qu'ils héritent du cache navigateur normal
  (impact mineur, ce sont des fichiers de logique pure peu modifiés une fois stabilisés),
  soit on leur ajoute aussi un `?v=` et on adapte les `import` en conséquence — à trancher
  au moment de la migration selon la fréquence de modification observée.
- **CSP** : le site n'autorise aucun `'unsafe-inline'` dans `script-src` (sauf override
  `commander` pour PayPlug). Le jeu n'a **aucun script inline exécutable** — tout est déjà
  dans des fichiers externes same-origin. Aucun changement de CSP nécessaire.
  Les polices étant auto-hébergées, il n'y a rien non plus à ajouter en `style-src`/`font-src`.

## 4. Tests

- **Vitest** : `vitest.config.js` du site tourne en `environment: 'jsdom'` (pour charger les
  modules IIFE legacy dans `tests/setup.js`). Les tests du jeu sont des modules ES purs,
  sans DOM — **jsdom ne les gêne pas**, ils tournent tels quels. Il suffit d'ajouter
  `tests/panidle/**/*.test.js` à l'`include` du config existant : **pas besoin d'un second
  config Vitest**.
- **Playwright** est une dépendance **nouvelle** pour ce repo (le site n'a que Vitest
  aujourd'hui). Deux options à trancher à ce moment-là :
  1. L'ajouter comme nouvelle dépendance de dev du site (`@playwright/test`), avec un
     `playwright.config.js` à la racine dont le `webServer` lance `cd astro && npm run dev`
     et dont `baseURL` cible `/panidle` au lieu de `/`.
  2. Garder les tests e2e du jeu dans un sous-projet isolé si le site ne veut pas de
     dépendance Playwright globale.
  Dans les deux cas, les specs elles-mêmes n'ont presque rien à changer : remplacer
  `page.goto('/')` par `page.goto('/panidle')` et adapter les sélecteurs qui supposaient une
  page 100% autonome (ex. `.topbar` qui coexistera avec le header du site).
- Le **système de readiness** (`tests/readiness/`, voir son propre README) est indépendant
  du repo qui l'héberge — il lit des rapports JSON Vitest/Playwright, donc il migre sans
  changement autre que les chemins de sortie.

## 5. Sauvegarde / données

- Le jeu reste **100% client (localStorage)**, sans table Supabase ni Netlify Function —
  le GDD exclut explicitement la sauvegarde cloud et les comptes utilisateur (§14). Rien à
  migrer côté serveur.
- **Clé localStorage** : `panidle_save_v1`, déjà choisie pour ne **jamais** commencer par
  `mistral_cache` ou `mistral_cv` (préfixes du cache `MistralSync` du site, `js/core/main.js`
  + `js/services/supabase-sync.js`) — pas de collision ni de purge accidentelle par un futur
  bump de schéma de cache (`mistral_cache4_` → `5_`). À revérifier si le préfixe change un
  jour d'un côté ou de l'autre.
- Si une évolution future veut un classement en ligne ou une sauvegarde multi-appareil
  (hors scope V1, §14 du GDD), ce sera le premier vrai point de couplage avec Supabase —
  et donc le moment de revisiter ce document.

## 6. Divers

- Le générateur d'assets du jeu (SVG procédural, synthèse Web Audio) ne dépend d'aucune
  bibliothèque vendor : rien à ajouter à `js/vendor/versions.json`.
- `js/features/handpan-player.js` (le vrai player du site, avec échantillons FLAC) et le
  moteur de rendu du jeu (`js/features/panidle/render/handpan-svg.js`, synthèse Web Audio)
  restent deux modules **séparés** après la migration — ils partagent une inspiration
  visuelle (placement des notes, esthétique de la coque) mais pas de code : les fusionner
  n'est pas nécessaire et compliquerait le player du site (qui doit rester fidèle aux vraies
  gammes/samples audio).
