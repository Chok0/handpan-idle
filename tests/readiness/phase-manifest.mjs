// Table de correspondance entre les phases du plan de construction (GDD §11) et les tests
// automatisés qui vérifient leur critère "Done si". C'est la seule source de vérité que lit
// `run-readiness.mjs` — l'étendre à chaque nouvelle phase/mécanique plutôt que de coder le
// mapping en dur dans le script d'agrégation.
//
// Phase 8 ("Polish") n'a pas de critère "Done si" vérifiable par assertion — c'est du
// jugement humain (animations, feedback, thème visuel) + équilibrage. Elle est donc suivie
// à part (voir `manualPhases` ci-dessous) : le score de readiness ne peut pas être bloqué par
// une phase qui n'est structurellement pas automatisable, mais son statut reste rapporté.

export const AUTOMATED_PHASES = [
  {
    id: 0,
    title: 'Squelette',
    doneSi: 'Cliquer une note du handpan augmente le compteur.',
    unitFiles: [],
    e2eFiles: ['phase0-core-loop.spec.js'],
  },
  {
    id: 1,
    title: 'Branche Atelier, employés & bâtiment niveau 1',
    doneSi: "On peut acheter des Apprentis jusqu'au plafond du bâtiment niveau 1, et faire évoluer le bâtiment niveau 1 en 3 étapes.",
    unitFiles: ['purchases-atelier.test.js', 'production.test.js'],
    e2eFiles: ['phase1-atelier.spec.js'],
  },
  {
    id: 2,
    title: 'Sauvegarde',
    doneSi: "Fermer/rouvrir l'onglet conserve la progression et crédite le temps écoulé.",
    unitFiles: ['save-offline.test.js'],
    e2eFiles: ['phase2-save.spec.js'],
  },
  {
    id: 3,
    title: 'Bâtiments niveau 2/3, employés supérieurs, conversion',
    doneSi: "On peut convertir un Apprenti en Ouvrier (coût réduit vs achat direct), et débloquer Usine/Entrepôt/Boutique après le Garage.",
    unitFiles: ['purchases-atelier.test.js'],
    e2eFiles: ['phase3-buildings.spec.js'],
  },
  {
    id: 4,
    title: 'Marteaux (synergie clic/idle)',
    doneSi: 'Augmenter le nombre d\'employés augmente visiblement le gain par clic via les Marteaux possédés.',
    unitFiles: ['production.test.js'],
    e2eFiles: ['phase4-marteaux.spec.js'],
  },
  {
    id: 5,
    title: 'Handpans maîtres',
    doneSi: 'Débloquer un nouveau handpan maître change note_value_base et les sons des zones.',
    unitFiles: ['master-pans-passive.test.js'],
    e2eFiles: ['phase5-masterpans.spec.js'],
  },
  {
    id: 6,
    title: 'Clic passif, percussions, patterns',
    doneSi: 'Un pattern joué en rythme rapporte davantage qu\'un pattern joué hors-rythme (bonus multiplicatif visible).',
    unitFiles: ['percussions-patterns.test.js'],
    e2eFiles: ['phase6-patterns.spec.js'],
  },
  {
    id: 7,
    title: 'Améliorations génériques & Accordage Ultime',
    doneSi: 'Accordage Ultime est achetable plusieurs fois à coût croissant, chaque achat augmentant mesurablement la production.',
    unitFiles: ['generic-upgrades-ultimate.test.js'],
    e2eFiles: ['phase7-generic-ultimate.spec.js'],
  },
  {
    id: 9,
    title: 'Intégration marketing',
    doneSi: "Débloquer un handpan maître référencé affiche un lien cliquable vers la vraie fiche produit, sans apparaître ailleurs de façon intrusive.",
    unitFiles: ['marketing.test.js'],
    e2eFiles: ['phase9-marketing.spec.js'],
  },
];

export const MANUAL_PHASES = [
  {
    id: 8,
    title: 'Polish',
    doneSi: 'Animations, nombres flottants, feedback sonore, thème visuel ; équilibrage via simulation accélérée.',
    note: 'Pas de critère automatisable par assertion (jugement humain sur le ressenti). '
      + 'L\'équilibrage est cependant instrumenté : voir la section "Simulation" du rapport '
      + '(tests/simulation/run-simulation.mjs), qui vérifie l\'absence d\'anomalie numérique '
      + '(NaN/Infinity) sur une session accélérée et rapporte les jalons de progression.',
  },
];
