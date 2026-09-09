// Patterns (mélodies) — §6.4 du GDD.
// Une séquence de zones à reproduire (motif moteur/rythmique), pas un jeu de reconnaissance
// de hauteur : `noteIndex` référence l'index de la note sur le handpan actif (les indices
// utilisés existent sur tous les pans du jeu, starter 9 notes compris).
//
// IMPORTANT — les positions sont exprimées en `beat` (temps musicaux, fractions autorisées :
// 0.5 = croche, 0.25 = double-croche), PAS en millisecondes absolues. Elles sont converties
// à l'exécution depuis METRONOME_BPM par `patternStepTimesMs()`.
//
// Pourquoi : avec des temps absolus arbitraires (350 ms) et un métronome à 667 ms, jouer le
// pattern juste garantissait d'être HORS du temps — le "combo pattern + rythme" du §6.4 ne
// pouvait quasiment jamais se déclencher. En calant les patterns sur la même grille que le
// métronome, bien jouer le pattern ET être sur le temps deviennent la même chose.
import { METRONOME_BPM } from './balance-constants.js';

/** Durée d'un temps (noire) en ms — grille de référence commune à tout le jeu. */
export function beatIntervalMs() {
  return 60000 / METRONOME_BPM;
}

/** Temps cibles d'un pattern, en ms depuis son début. */
export function patternStepTimesMs(pattern) {
  const beat = beatIntervalMs();
  return pattern.sequence.map((step) => step.beat * beat);
}

/**
 * Fenêtre de tolérance d'un pattern : proportionnelle à son propre écartement, pour qu'un
 * motif rapide reste jouable sans rendre un motif lent trivial. Plafonnée à 300 ms.
 */
export function patternToleranceMs(pattern) {
  const times = patternStepTimesMs(pattern);
  const spacings = times.slice(1).map((t, i) => t - times[i]);
  const minSpacing = spacings.length ? Math.min(...spacings) : 600;
  return Math.min(300, minSpacing * 0.6);
}

export const PATTERNS = [
  {
    id: 'ding_ding',
    nom: 'Premier appel',
    notesRequisesIndex: [0],
    sequence: [
      { noteIndex: 0, beat: 0 },
      { noteIndex: 0, beat: 1 },
      { noteIndex: 0, beat: 2 },
    ],
    difficulte: 1,
    gainDeBase: 25,
    coutDeblocage: 100,
    cooldownS: 5,
  },
  {
    id: 'trois_notes',
    nom: 'Berceuse à trois notes',
    notesRequisesIndex: [0, 1, 2],
    sequence: [
      { noteIndex: 0, beat: 0 },
      { noteIndex: 1, beat: 1 },
      { noteIndex: 2, beat: 2 },
      { noteIndex: 1, beat: 3 },
      { noteIndex: 0, beat: 4 },
    ],
    difficulte: 2,
    gainDeBase: 80,
    coutDeblocage: 320,
    cooldownS: 8,
  },
  {
    id: 'zigzag',
    nom: 'Zigzag',
    notesRequisesIndex: [0, 1, 2, 3, 4],
    sequence: [
      { noteIndex: 0, beat: 0 },
      { noteIndex: 2, beat: 0.5 },
      { noteIndex: 4, beat: 1 },
      { noteIndex: 1, beat: 1.5 },
      { noteIndex: 3, beat: 2 },
      { noteIndex: 0, beat: 3 },
    ],
    difficulte: 3,
    gainDeBase: 300,
    coutDeblocage: 1200,
    cooldownS: 10,
  },
  {
    id: 'cascade',
    nom: 'Cascade',
    notesRequisesIndex: [0, 1, 2, 3, 4, 5, 6],
    sequence: [
      { noteIndex: 0, beat: 0 },
      { noteIndex: 1, beat: 0.5 },
      { noteIndex: 2, beat: 1 },
      { noteIndex: 3, beat: 1.5 },
      { noteIndex: 4, beat: 2 },
      { noteIndex: 5, beat: 2.5 },
      { noteIndex: 6, beat: 3 },
      { noteIndex: 0, beat: 4 },
    ],
    difficulte: 4,
    gainDeBase: 1200,
    coutDeblocage: 4800,
    cooldownS: 12,
  },
  {
    id: 'ronde_complete',
    nom: 'Ronde complète',
    notesRequisesIndex: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    sequence: [
      { noteIndex: 0, beat: 0 },
      { noteIndex: 1, beat: 0.5 },
      { noteIndex: 2, beat: 1 },
      { noteIndex: 3, beat: 1.5 },
      { noteIndex: 4, beat: 2 },
      { noteIndex: 5, beat: 2.5 },
      { noteIndex: 6, beat: 3 },
      { noteIndex: 7, beat: 3.5 },
      { noteIndex: 8, beat: 4 },
      { noteIndex: 0, beat: 5 },
    ],
    difficulte: 5,
    gainDeBase: 6000,
    coutDeblocage: 24000,
    cooldownS: 15,
  },
  {
    id: 'virtuose',
    nom: 'Virtuose',
    notesRequisesIndex: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    sequence: [
      { noteIndex: 0, beat: 0 }, { noteIndex: 3, beat: 0.25 }, { noteIndex: 1, beat: 0.5 },
      { noteIndex: 5, beat: 0.75 }, { noteIndex: 2, beat: 1 }, { noteIndex: 7, beat: 1.25 },
      { noteIndex: 4, beat: 1.5 }, { noteIndex: 8, beat: 1.75 }, { noteIndex: 6, beat: 2 },
      { noteIndex: 0, beat: 3 },
    ],
    difficulte: 6,
    gainDeBase: 40000,
    coutDeblocage: 160000,
    cooldownS: 20,
  },
];

export function getPattern(id) {
  const p = PATTERNS.find((x) => x.id === id);
  if (!p) throw new Error(`Pattern inconnu : "${id}"`);
  return p;
}
