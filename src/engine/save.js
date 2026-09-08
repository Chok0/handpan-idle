// Persistance localStorage + calcul de la production hors-ligne (§10, Phase 2 du §11).
import { productionPerSecond } from './production.js';

export const SAVE_KEY = 'panidle_save_v1';
// Plafond de crédit hors-ligne : évite un nombre absurde si l'horloge système dérive, et
// donne un vrai motif de revenir régulièrement plutôt que de laisser tourner indéfiniment.
export const OFFLINE_CAP_SECONDS = 12 * 3600;

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function saveState(state, { onError } = {}) {
  state.lastSaveTimestamp = Date.now();
  if (!hasLocalStorage()) return false;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    onError?.(e);
    return false;
  }
}

export function loadRawState({ onError } = {}) {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    onError?.(e);
    return null;
  }
}

export function clearSave() {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Calcule les ♫ à créditer pour le temps écoulé depuis la dernière sauvegarde.
 * Ne modifie pas l'état — c'est à l'appelant d'appliquer `earned` s'il le souhaite
 * (permet à l'UI d'afficher un récap avant de créditer, cf. §12.2 "rappel discret").
 */
export function computeOfflineProgress(state, now = Date.now()) {
  if (!state.lastSaveTimestamp) return { elapsedSeconds: 0, cappedSeconds: 0, earned: 0 };
  const elapsedSeconds = Math.max(0, (now - state.lastSaveTimestamp) / 1000);
  const cappedSeconds = Math.min(elapsedSeconds, OFFLINE_CAP_SECONDS);
  const earned = cappedSeconds * productionPerSecond(state);
  return { elapsedSeconds, cappedSeconds, earned };
}
