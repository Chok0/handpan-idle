// Mini-jeu des patterns — §6.4.
//
// Refonte après constat de terrain : l'ancienne version était injouable.
//   1. La séquence n'était JAMAIS montrée — un "Simon" qui ne joue pas la séquence demande
//      de deviner des index secrets à un tempo secret.
//   2. Le chrono démarrait au clic sur « Jouer », dans un AUTRE onglet : le temps de basculer
//      sur le handpan, la 1re note était déjà ratée (300 ms de latence humaine contre 250 ms
//      de tolérance = 0 % de précision garanti).
//   3. Le tempo des patterns et celui du métronome étaient incommensurables : bien jouer le
//      pattern garantissait d'être hors du temps, donc le combo du §6.4 ne se déclenchait jamais.
//
// Trois phases explicites :
//   'demo'    — le jeu joue la séquence, le joueur écoute et regarde (piloté par l'UI)
//   'attente' — « à vous » : la note attendue est surlignée, AUCUN chrono ne tourne
//   'jeu'     — démarre à la 1re frappe du joueur, qui sert d'ancre temporelle
//
// `run` reste transitoire (jamais persisté) : un pattern interrompu se rejoue proprement.
import { getPattern, patternStepTimesMs, patternToleranceMs } from '../data/patterns.js';
import { PERCUSSION_TIERS } from '../data/balance-constants.js';
import { isOnBeat } from './percussion.js';

/** Part des frappes "sur le temps" nécessaire pour déclencher le combo rythme (défaut). */
export const RHYTHM_COMBO_THRESHOLD = 0.6;

export function startPatternRun(patternId) {
  const pattern = getPattern(patternId);
  return {
    patternId,
    phase: 'demo',
    startMs: null, // posé à la 1re frappe, pas au lancement
    stepIndex: 0,
    stepTimes: patternStepTimesMs(pattern),
    toleranceMs: patternToleranceMs(pattern),
    hitPrecisions: [],
    onBeatFlags: [],
    finished: false,
  };
}

/** Fin de la démonstration : on passe la main au joueur (toujours sans chrono). */
export function beginPlayerPhase(run) {
  if (run.phase === 'demo') run.phase = 'attente';
  return run;
}

/** Index de la note que le joueur doit frapper maintenant (pour le surlignage). */
export function expectedNoteIndex(run) {
  if (run.finished) return null;
  const pattern = getPattern(run.patternId);
  return pattern.sequence[run.stepIndex]?.noteIndex ?? null;
}

/**
 * Enregistre une frappe. Mute `run` en place.
 * La 1re frappe ancre l'horloge : elle ne peut donc pas être "en retard".
 * @returns {{precision:number, noteCorrect:boolean, finished:boolean, anchored:boolean}}
 */
export function recordPatternHit(run, noteIndex, nowMs, state) {
  const pattern = getPattern(run.patternId);
  const step = pattern.sequence[run.stepIndex];
  const noteCorrect = noteIndex === step.noteIndex;

  let anchored = false;
  let precision;

  if (run.phase === 'attente') {
    // Ancrage : le joueur décide quand commencer. Seule la note compte ici.
    run.startMs = nowMs;
    run.phase = 'jeu';
    anchored = true;
    precision = noteCorrect ? 1 : 0;
  } else {
    const expectedMs = run.startMs + run.stepTimes[run.stepIndex];
    const deltaMs = Math.abs(nowMs - expectedMs);
    precision = noteCorrect ? Math.max(0, 1 - deltaMs / run.toleranceMs) : 0;
  }

  const { onBeat } = isOnBeat(state, nowMs);
  run.hitPrecisions.push(precision);
  run.onBeatFlags.push(onBeat);
  run.stepIndex += 1;
  if (run.stepIndex >= pattern.sequence.length) run.finished = true;

  return { precision, noteCorrect, finished: run.finished, anchored };
}

/**
 * §6.4 — gain_pattern_final = gain_de_base × précision_pattern × bonus_rythme_actif.
 * Le bonus rythme ne s'applique que si les Percussions sont débloquées ET que le joueur a
 * globalement joué sur le temps. Maintenant que les patterns sont calés sur la grille du
 * métronome, bien jouer le pattern suffit à décrocher le combo — c'est l'intention du GDD.
 */
export function finishPatternRun(run, state) {
  const pattern = getPattern(run.patternId);
  const precisionMoyenne =
    run.hitPrecisions.reduce((a, b) => a + b, 0) / run.hitPrecisions.length;
  const onBeatRatio = run.onBeatFlags.filter(Boolean).length / run.onBeatFlags.length;
  const percussionActive = state.percussionTier > 0;
  const bonusRythmeActif =
    percussionActive && onBeatRatio >= RHYTHM_COMBO_THRESHOLD
      ? PERCUSSION_TIERS[state.percussionTier].bonus
      : 1;

  const gain = pattern.gainDeBase * precisionMoyenne * bonusRythmeActif;
  return { gain, precisionMoyenne, bonusRythmeActif, onBeatRatio };
}
