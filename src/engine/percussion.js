// Métronome — §6.3. Grille rythmique alignée sur l'horloge absolue (pas de "temps de session"
// à retenir : `nowMs` suffit, ce qui simplifie complètement les tests et la reprise après
// une pause hors-ligne).
import { METRONOME_BPM, PERCUSSION_TIERS } from '../data/balance-constants.js';

export function beatIntervalMs() {
  return 60000 / METRONOME_BPM;
}

export function currentPercussionDef(state) {
  return PERCUSSION_TIERS[state.percussionTier];
}

/** @returns {{onBeat: boolean, bonus: number, distanceMs: number}} */
export function isOnBeat(state, nowMs) {
  const def = currentPercussionDef(state);
  if (!def.subdivision) return { onBeat: false, bonus: 1, distanceMs: Infinity };
  const stepMs = beatIntervalMs() / def.subdivision;
  const phase = ((nowMs % stepMs) + stepMs) % stepMs; // toujours positif même si nowMs < 0 (tests)
  const distance = Math.min(phase, stepMs - phase);
  const onBeat = distance <= def.toleranceMs;
  return { onBeat, bonus: onBeat ? def.bonus : 1, distanceMs: distance };
}
