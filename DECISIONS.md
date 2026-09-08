# DECISIONS.md — choix faits en l'absence de retour humain

Conformément à la règle générale du GDD (§11) : *"si une valeur numérique n'est pas
spécifiée, choisir une valeur raisonnable cohérente avec les tableaux donnés plutôt que
de s'arrêter — noter le choix dans DECISIONS.md."* Ce document liste ces choix, organisés
par section du GDD (`GDD_HandpanClicker.md`), pour qu'ils soient trouvés et ajustés
facilement lors du playtest (Phase 8).

Toutes les valeurs ci-dessous vivent dans `src/data/*.js` (constantes nommées, jamais en
dur dans le moteur ou l'UI) — les changer ne demande de toucher qu'un seul fichier par
sujet.

---

## §5.2 — Employés

- **Coût de conversion** : le GDD donne une valeur "de base" par palier dans son tableau,
  sans préciser si elle croît avec le nombre déjà converti. Choix : elle suit la même
  formule que le reste du jeu, `coût(n) = coût_conversion_base × 1.15^n`, où `n` est le
  nombre déjà possédé **du palier cible** — cohérent avec le texte "coût direct de chaque
  échelon suit aussi coût(n)=...", lu comme s'appliquant à tout achat de ce palier, direct
  ou par conversion.

## §5.3 — Bâtiments / déblocages de palier

- **Déblocage du niveau 3** : le GDD dit "débloquent l'achat d'Accordeurs/Master Tuners et
  le multiplicateur Presse hydraulique" pour le niveau 3, sans préciser le déclencheur
  exact. Choix : niveau 3 débloqué quand **au moins 1 Atelier ET 1 Showroom** sont
  possédés (`NIVEAU3_UNLOCK_REQUIRES` dans `balance-constants.js`) — les "deux vrais
  espaces" du niveau 2 acquis.
- **Master Tuner : "Bâtiment niveau 3 (palier supérieur)"** — deuxième seuil à l'intérieur
  du niveau 3, non chiffré par le GDD. Choix : total de bâtiments niveau 3 (Usine +
  Entrepôt + Boutique) **≥ 10** (`NIVEAU3_PALIER_SUPERIEUR_COUNT`).

## §5.4 — Multiplicateurs de production

- Hydro formeuse et Presse hydraulique sont "rachetables à coût croissant" sans formule
  donnée. Choix : même formule générale `coût(n) = base × 1.15^n`, cohérente avec le reste
  du jeu plutôt qu'une courbe ad hoc.

## §6.1 — Handpans maîtres

- Le GDD demande un "espace combinatoire volontairement large" mais ne fournit aucune
  donnée concrète. **11 handpans maîtres** ont été composés à la main
  (`src/data/master-pans.js`), inspirés des vraies gammes fabriquées par Mistral Pans
  (Kurd, Amara, Sabye, Celtic Minor, Hijaz, Annaziska, Pygmy — cf. `js/data/scales-data.js`
  du site) mais **stylisés pour le jeu** : plusieurs handpans "maîtres" ont plus de notes
  que leurs équivalents réellement fabriqués (ex. "D Kurd Deluxe 12 notes", "Accordage
  Céleste 13 notes"). C'est une abstraction volontaire de gameplay, pas une prétention de
  faisabilité luthier — à garder en tête si le catalogue réel sert un jour de contrainte de
  cohérence.
- `note_value_base` et `cost` progressent en restant cohérents avec le reste de l'économie
  (bâtiments jusqu'à 40M, Accordage Ultime à partir de 5Md).
- **`product_url`** n'est renseignée que sur une poignée de handpans (kurd9, amara9,
  hijaz9, kurd12deluxe), et pointe vers `https://mistralpans.fr/boutique` (page générique)
  faute de connaître les vraies URLs de fiches produit par gamme — point ouvert explicite
  du GDD (§13 "Liste exacte des product_url par handpan maître"). À raffiner avec de vraies
  URLs de fiches individuelles quand le catalogue en ligne sera audité.

## §6.2 — Améliorateurs de clic passifs

- Question ouverte du GDD (§13) : garder Didgeridoo drone / Backing track comme deux
  paliers uniques, ou les décliner en variantes ? **Choix : paliers uniques pour la V1**
  (plus simple, cohérent avec "peut être conçu... — laissé ouvert"). Le code
  (`PASSIVE_CLICK_UPGRADES` dans `balance-constants.js`) est une liste, donc ajouter des
  variantes plus tard est une extension additive, pas une réécriture.
- **Les bonus se cumulent additivement** (`1 + Σ bonusPct`), pas multiplicativement entre
  eux — lecture la plus naturelle de "+10%" et "+20%" listés côte à côte. Les améliorations
  génériques (§7), elles, se cumulent **multiplicativement** entre elles (voir plus bas) :
  deux mécaniques différentes, deux comportements différents, documentés séparément.

## §6.3 — Percussions

- **Tempo du métronome** : 90 BPM (`METRONOME_BPM`), non spécifié par le GDD — un tempo
  médian raisonnable pour un motif de frappe.
- **Fenêtres de tolérance** par palier (150ms / 100ms / 60ms) et **coûts** de déblocage
  (2 000 / 15 000 / 100 000 ♫) : valeurs par défaut, candidates de choix pour l'ajustement
  en playtest (Phase 8).

## §6.4 — Patterns

- Le GDD décrit le format d'un pattern mais ne donne aucun exemple concret. **6 patterns**
  ont été composés à la main (`src/data/patterns.js`), de difficulté croissante (1 à 6),
  tous jouables dès le handpan de départ à 9 notes (le plus exigeant utilise l'index 8, la
  9ᵉ note).
- **`coutDeblocage`** (coût pour débloquer un pattern) : champ ajouté aux données — le GDD
  dit "Achat : ... avec des ♫" mais ne donne pas de barème. Choix : `≈ 4 × gain_de_base`
  (heuristique "s'amortit en ~4 parties réussies").
- **Fenêtre de tolérance interne au pattern** : 250ms par défaut (`PATTERN_HIT_TOLERANCE_MS`
  dans `patterns-runtime.js`), indépendante des fenêtres de tolérance des Percussions
  (qui jugent l'alignement sur le métronome global, pas sur le tempo propre au pattern).
- **Seuil de déclenchement du combo rythme** : le GDD donne la formule du gain final mais
  pas la condition exacte d'activation de `bonus_rythme_actif`. Choix : le bonus de palier
  de percussion s'applique **si au moins 80% des frappes du pattern sont tombées "sur le
  temps"** du métronome global (`RHYTHM_COMBO_THRESHOLD`), sinon `bonus_rythme_actif = 1`.
  Comportement tout-ou-rien assumé, cohérent avec une formule multiplicative à un seul
  facteur `bonus_rythme_actif`.
- **Pendant un pattern actif, les clics n'alimentent pas directement le compteur** : le
  gain est crédité en une fois à la fin du pattern (mini-jeu à mode dédié, cf. "mini-jeu
  type Simon/rythme" du GDD). C'est un choix d'implémentation, pas une règle du GDD.
- **`GameEngine.cancelPattern()`** : capacité d'abandon ajoutée pour la sécurité UX (éviter
  de bloquer un joueur qui a démarré un pattern par erreur) — absente du GDD, ajout mineur.

## §7 — Améliorations génériques & Accordage Ultime

- **~36 améliorations génériques**, générées par `src/data/generic-upgrades.js`
  (`generateGenericUpgrades()`) à partir de 4 catégories de seuils (production à vie,
  effectif, collection de handpans maîtres, endurance/clics) — dans la fourchette 30-40
  demandée par le GDD, et **littéralement générées par un template**, pas écrites une par
  une, comme demandé.
- **Cumul multiplicatif** entre améliorations génériques (`×2, ×2...` lu comme un produit),
  à la différence des améliorateurs de clic passifs du §6.2 (additifs) — deux mécaniques
  distinctes du GDD, traitées différemment à dessein.
- **Coûts des paliers génériques** : ordres de grandeur choisis pour rester cohérents avec
  l'économie du jeu à chaque seuil (voir commentaires dans `generic-upgrades.js`) ; premiers
  candidats à l'ajustement par simulation accélérée (Phase 8 du GDD).
- **Accordage Ultime** : coût de base 5 milliards ♫, croissance ×3 par achat (plus raide que
  le taux général ×1.15, pour rester un sink de toute fin de partie), +5% de production
  globale permanente par achat. **Déblocage** : possession d'au moins 1 Master Tuner — lu
  comme "amélioration de fin de partie", donc gagné après avoir atteint le sommet de la
  branche Atelier.
- **"Production globale" de l'Accordage Ultime s'applique aussi au clic**, pas seulement à
  la production idle — lecture large de "production globale permanente", cohérente avec le
  pilier de design (§1) qui veut que les deux branches restent connectées jusqu'au bout.

## §8 — Audio

- Synthèse des notes : sinusoïde fondamentale + 3 harmoniques légèrement désaccordées
  (façon métal frappé) + enveloppe ADSR courte (attaque ~6ms, chute exponentielle
  ~1.4s) — le GDD demande "oscillateur sine + harmoniques + enveloppe ADSR courte" sans
  chiffrer ; valeurs choisies pour un rendu plausible, ajustables dans
  `src/audio/synth.js`.
- **Backing track et métronome** utilisent un scheduler `setInterval` plutôt qu'un
  ordonnancement à l'échantillon près (`AudioContext.currentTime` look-ahead). C'est une
  simplification connue (dérive possible sur de longues sessions) — voir aussi
  `MIGRATION.md` si une meilleure précision devient nécessaire.

## §9/§10.1 — UI, rendu SVG

- Look & feel copié de `js/features/handpan-player.js` et `css/style.css` du site
  (algorithme de placement des notes en cercle, coque en gradient radial, ripple de
  frappe) — cf. `MIGRATION.md` pour le chemin de convergence si le jeu rejoint le site.
- **Respiration idle** et **nombres flottants** utilisent explicitement `Math.sin` comme
  demandé par le GDD (§10.1) ; le ripple de frappe reste en keyframes CSS (le GDD ne
  l'exige pas explicitement en `Math.sin`, seulement "procédural / pas d'asset importé" —
  un `@keyframes` écrit à la main satisfait cette contrainte).
- **Bug corrigé pendant le build, à retenir** : une règle CSS `.offline-modal { display:
  flex }` écrasait le `display: none` par défaut du navigateur pour l'attribut `[hidden]`
  (l'auteur gagne sur l'agent utilisateur à spécificité égale) — la modale restait
  cliquable même "cachée". Corrigé par une règle globale `[hidden] { display: none
  !important; }` en tête de `game.css`. Détecté par
  `tests/e2e/phase9-marketing.spec.js` — exactement le genre de bug qu'une suite e2e doit
  attraper.

## §10 — Architecture technique

- **Fichiers de données en `.js` (ES modules), pas en `.json`** comme suggéré par le GDD.
  Motif : une page ouverte directement en `file://` ne peut de toute façon pas faire de
  `fetch()` sur des JSON locaux (CORS), et les modules ES eux-mêmes sont bloqués en
  `file://` dans les navigateurs — la page a donc **toujours** besoin d'être servie en
  http(s) (serveur de dev local, ou déploiement GitHub Pages/Netlify), que les données
  soient en `.js` ou en `.json`. Des modules `.js` qui `export const X = [...]` évitent un
  aller-retour réseau supplémentaire et restent "des fichiers de données séparés, chargés
  au démarrage" au sens du GDD. Voir aussi `README.md` (section "Lancer en local").
- **Note importante pour la suite** : "standalone" (§14 du prompt utilisateur) veut donc
  dire "site statique déployable tel quel" (ce que fait GitHub Pages), pas "double-cliquer
  sur index.html" — cohérent avec la demande explicite d'un déploiement via GitHub Action.

## Bug réel trouvé par la simulation accélérée (Phase 8) — corrigé

`tests/simulation/run-simulation.mjs` (bot glouton qui joue le jeu en accéléré) a mis en
évidence qu'un joueur assidu qui cumule plusieurs centaines d'exemplaires de chaque bâtiment
niveau 2/3 et multiplicateur (Atelier, Showroom, Usine, Entrepôt, Boutique, Hydro formeuse,
Presse hydraulique) fait dépasser à `globalProductionMultiplier` la limite d'un nombre
flottant double (~1.8×10³⁰⁸) : ce sont **7 multiplicateurs `mult^n` indépendants** qui se
multiplient entre eux (chacun explicitement spécifié par le GDD §5.3/§5.4, formule non
remise en cause), et leurs exposants s'additionnent en espace logarithmique — au bout de
~400-450 exemplaires de chacun (atteint en seulement ~76 minutes de jeu simulé par un bot
qui réinvestit optimalement à chaque tick, donc bien plus tard en jeu réel, mais
inévitablement un jour pour un joueur assidu), le produit devient `Infinity`. Conséquence
sans le correctif : `state.handpans` devient `Infinity`, la sauvegarde JSON (`§10`) est
corrompue, et l'UI afficherait "Infinity ♫".

**Correctif** (`clampFinite`/`SAFE_MAX` dans `src/engine/economy.js`, appliqué dans
`globalProductionMultiplier`, `productionPerSecond`, `computeClickGain` et à chaque
incrément de `state.handpans`/`totalHandpansMade` dans `game.js`) : plafond de sécurité
**numérique** à 10³⁰⁰ — pas un plafond de jeu. Aucun coût ni jalon du contenu actuel ne s'en
approche ; il n'écrête jamais une partie normale, seulement l'overflow flottant d'un joueur
qui aurait dépassé tout le contenu prévu. C'est le traitement standard de ce problème bien
connu du genre idle game (voir aussi les bibliothèques "grand nombre" type `break_eternity.js`
utilisées par des jeux comme Cookie Clicker) — une vraie ré-écriture en représentation
logarithmique/exponentielle serait la solution "propre" à long terme si le contenu du jeu est
un jour étendu pour viser des nombres réellement astronomiques par design ; hors scope ici.

Verrouillé par un test de régression dédié (`tests/unit/production.test.js`, describe
"Garde-fou anti-overflow") et par le fait que `tests/simulation/run-simulation.mjs` échoue
(exit code 1) si `problemCount > 0` — le système de readiness (§ ci-dessous) l'exécute
automatiquement.

## Notes de testing (pas des bugs produit)

- **Clics `{ force: true }` sur `.note-group` dans les tests e2e** : la respiration idle
  (§10.1) anime `transform: scale(...)` sur chaque note en continu. Playwright refuse de
  cliquer un élément dont la position/apparence "bouge" (vérification de stabilité), ce qui
  n'a aucun sens pour un vrai clic souris — un humain clique très bien sur une note qui
  respire à 3%. D'où `{ force: true }` dans les specs qui cliquent une note.
- **`tests/e2e/phase2-save.spec.js` ouvre un second onglet (`context.newPage()`) plutôt que
  de `reload()` la page** : `main.js` sauvegarde sur `beforeunload` (comportement correct en
  usage réel — capturer l'instant réel où l'utilisateur quitte). Un `page.reload()` sur une
  page où le jeu tourne déjà déclenche ce `beforeunload` et ré-écrase l'horodatage de test
  injecté manuellement dans `localStorage` avant même la navigation. Un nouvel onglet lit le
  `localStorage` déjà écrit sans repasser par ce chemin.

## Divers

- **Référence de fréquence** : A4 = 440 Hz, tempérament égal — standard, non discuté par le
  GDD mais nécessaire pour `noteToFrequency`.
- **Format des nombres** : suffixes K/M/B/T/Qa/Qi/Sx/Sp/Oc/No/Dc façon idle game classique
  (`formatNumber` dans `economy.js`), bascule en notation scientifique au-delà.
- **Plafond de production hors-ligne** : 12h (`OFFLINE_CAP_SECONDS`), pour éviter un
  nombre absurde en cas de dérive d'horloge système et donner un motif de revenir
  régulièrement — le GDD ne fixe pas de plafond.
