// Mini-jeu type Simon/rythme des patterns — §6.4.
// `run` est un objet transitoire (PAS persisté dans la sauvegarde : rejouer un pattern
// interrompu recommence proprement, cf. DECISIONS.md).
import { getPattern } from '../data/patterns.js';
import { PERCUSSION_TIERS } from '../data/balance-constants.js';
import { isOnBeat } from './percussion.js';

// Fenêtre de tolérance du timing interne au pattern (défaut, indépendante de celle des
// Percussions qui, elle, juge l'alignement sur le métronome global).
export const PATTERN_HIT_TOLERANCE_MS = 250;
// Part des frappes "sur le temps métronome" nécessaire pour déclencher le combo rythme (défaut).
export const RHYTHM_COMBO_THRESHOLD = 0.8;

export function startPatternRun(patternId, nowMs) {
  getPattern(patternId); // valide l'id (lève une erreur explicite si inconnu)
  return {
    patternId,
    startMs: nowMs,
    stepIndex: 0,
    hitPrecisions: [],
    onBeatFlags: [],
    finished: false,
  };
}

/** Mute `run` en place. @returns {{precision:number, noteCorrect:boolean, finished:boolean}} */
export function recordPatternHit(run, noteIndex, nowMs, state) {
  const pattern = getPattern(run.patternId);
  const step = pattern.sequence[run.stepIndex];
  const expectedMs = run.startMs + step.t;
  const deltaMs = Math.abs(nowMs - expectedMs);
  const noteCorrect = noteIndex === step.noteIndex;
  const precision = noteCorrect ? Math.max(0, 1 - deltaMs / PATTERN_HIT_TOLERANCE_MS) : 0;
  const { onBeat } = isOnBeat(state, nowMs);

  run.hitPrecisions.push(precision);
  run.onBeatFlags.push(onBeat);
  run.stepIndex += 1;
  if (run.stepIndex >= pattern.sequence.length) run.finished = true;

  return { precision, noteCorrect, finished: run.finished };
}

/**
 * §6.4 — gain_pattern_final = gain_de_base × précision_pattern × bonus_rythme_actif.
 * bonus_rythme_actif ne vaut le bonus de percussion que si le joueur a globalement joué
 * "sur le temps" (>= seuil de frappes on-beat) ET que les Percussions sont débloquées.
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
