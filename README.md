# PanIdle — le clicker handpan

Un jeu idle/incremental façon *Cookie Clicker* où l'unité cliquée — le handpan — **est**
la monnaie du jeu. Développé pour **Mistral Pans**, fabricant artisanal de handpans
(Île-de-France), comme produit d'appel marketing doux vers le vrai catalogue (§12 du GDD).

Le brief de conception complet est `GDD_HandpanClicker.md` (à la racine, si présent dans
votre checkout) — ce README documente le **projet tel que construit**, pas le brief.

---

## Démarrer en local

Aucun `<script type="module">` ni `fetch()` de données ne fonctionne en ouvrant
`index.html` directement (`file://`) — les navigateurs bloquent les deux par CORS. Il faut
un serveur http, même minimal :

```bash
npm install
npm run dev          # http://127.0.0.1:8080
```

`scripts/dev-server.mjs` est un serveur statique fait maison (aucune dépendance) — voir
`DECISIONS.md` pour pourquoi les données du jeu sont des modules `.js` et non `.json`.

## Tests

Trois familles de tests, plus un système qui les agrège :

```bash
npm test              # Vitest — toutes les formules du moteur (unitaire, ~90 tests)
npm run test:watch    # idem, en mode watch

npm run test:e2e      # Playwright — un spec par phase du GDD §11, "Done si" vérifié
                       # dans un vrai Chromium (lance et arrête son propre serveur de dev)
npm run test:e2e:ui   # idem, avec l'UI interactive de Playwright

npm run sim           # simulation accélérée (bot glouton) — équilibrage + détection
                       # d'anomalies numériques (voir tests/simulation/)
npm run sim -- 604800 # même chose sur 7 jours simulés au lieu de 3h par défaut

npm run readiness     # LE système de "prêt pour livraison ?" — lance les 3 ci-dessus,
                       # agrège, écrit tests/readiness/report/readiness.{json,md}
```

### Le système de readiness

`npm run readiness` répond à *"à quel point le jeu est-il prêt pour livraison ?"* de façon
reproductible plutôt qu'à l'intuition :

1. Fait tourner **Vitest** (le moteur, formule par formule) et **Playwright** (chaque
   critère **"Done si"** du plan de construction du GDD §11, exécuté dans un vrai
   navigateur, phase par phase — `tests/e2e/phaseN-*.spec.js`).
2. Fait tourner la **simulation accélérée** (`tests/simulation/run-simulation.mjs`) :
   un bot qui joue en accéléré et vérifie l'absence d'anomalie numérique (NaN/Infinity —
   voir l'incident réel documenté dans `DECISIONS.md`).
3. Croise tout ça avec `tests/readiness/phase-manifest.mjs` (la table "quelle phase du GDD
   est couverte par quels tests") pour calculer un **score en %** et un **verdict PRÊT /
   PAS PRÊT**, avec la liste des bloquants s'il y en a.
4. Écrit `tests/readiness/report/readiness.md` (lisible) et `.json` (exploitable par CI).

La Phase 8 du GDD ("Polish") n'a pas de critère automatisable (ressenti, esthétique) — elle
est suivie à part, jamais bloquante pour le score, mais reste rapportée comme "manuelle".

C'est ce script que la CI (`.github/workflows/ci.yml`) exécute sur chaque push/PR, et qui
conditionne le déploiement (voir plus bas) : **un déploiement ne part jamais si le jeu
n'est pas "PRÊT"**.

## Architecture

```
index.html               # page unique, aucun build
css/
  theme.css               # tokens repris de la charte Mistral Pans (couleurs, polices)
  game.css                # mise en page du jeu
src/
  data/                   # données pures (gammes, coûts, patterns...) — voir DECISIONS.md
  engine/                 # logique de jeu pure, testée unitairement (aucun DOM ici)
    game.js                 # GameEngine — point d'entrée unique consommé par l'UI
    economy.js, production.js, unlocks.js, purchases.js, ...
  audio/synth.js          # synthèse Web Audio (aucun fichier audio importé, §8 du GDD)
  render/                 # SVG procédural + les 3 écrans (Principal/Atelier/Handpan)
  main.js                 # bootstrap : assemble engine + audio + rendu + boucle de jeu
tests/
  unit/                   # Vitest — une chose testée = une formule/fonction pure
  e2e/                    # Playwright — un fichier par phase du GDD §11
  simulation/             # bot d'équilibrage accéléré (Phase 8 du GDD)
  readiness/              # agrégateur "prêt pour livraison ?" (voir plus haut)
.github/workflows/ci.yml  # tests + readiness (toute branche/PR) + déploiement Pages (main)
DECISIONS.md              # tous les choix faits en l'absence de valeur donnée par le GDD
MIGRATION.md              # comment/quoi migrer le jour où il rejoint Mistral_Pans_Website
```

Le moteur (`src/engine/`) est volontairement 100% pur (pas de DOM, pas d'audio) : c'est ce
qui le rend testable en quelques millisecondes par Vitest, et c'est aussi ce que réutilise
`tests/simulation/run-simulation.mjs` pour jouer le jeu en accéléré côté Node sans navigateur.

## Déploiement

Le jeu est un site statique déployé sur **GitHub Pages** via `.github/workflows/ci.yml`
(job `deploy`, déclenché sur push vers `main`, uniquement si le job `test` — le système de
readiness — est vert). Aucune étape de build : le dossier de déploiement est juste
`index.html` + `css/` + `src/`.

## Sauvegarde

100% côté client (`localStorage`, clé `panidle_save_v1`), JSON versionné, avec crédit de
production hors-ligne au chargement (plafonné à 12h). Aucun backend — conforme au GDD (§10,
§14 : pas de compte utilisateur ni de sauvegarde cloud en V1).

## Et après ?

- **Playtest / équilibrage** : `npm run sim -- 604800` (7 jours simulés) donne des jalons de
  progression à confronter au ressenti réel — tous les coûts/seuils vivent dans
  `src/data/*.js`, un seul fichier à toucher par sujet.
- **Migration vers le site Mistral Pans** : tout est documenté dans `MIGRATION.md` (ce qui
  se supprime, ce qui se déplace, ce qui reste identique).
- **Choix laissés ouverts par le GDD** (§13) et décisions prises en attendant : `DECISIONS.md`.
