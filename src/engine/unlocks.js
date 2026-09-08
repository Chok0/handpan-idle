// Dérive tous les déblocages à partir de l'état — source unique de vérité pour "peut-on
// acheter / voir X ?", utilisée à la fois par le moteur (game.js) et l'UI (aucune des deux
// ne doit dupliquer cette logique).
import {
  NIVEAU3_UNLOCK_REQUIRES,
  NIVEAU3_PALIER_SUPERIEUR_COUNT,
  ACCORDAGE_ULTIME,
} from '../data/balance-constants.js';

/** Étape du bâtiment niveau 1 : 0=Placard, 1=Cave, 2=Garage. Niveau 2 débloqué au Garage. */
export function isNiveau2Unlocked(state) {
  return state.buildings.niveau1Stage >= 2;
}

/**
 * Niveau 3 débloqué quand les deux "vrais espaces" niveau 2 sont acquis
 * (défaut documenté dans DECISIONS.md — le GDD ne fixe pas de seuil exact).
 */
export function isNiveau3Unlocked(state) {
  return (
    state.buildings.atelier >= NIVEAU3_UNLOCK_REQUIRES.atelier &&
    state.buildings.showroom >= NIVEAU3_UNLOCK_REQUIRES.showroom
  );
}

export function totalNiveau3Buildings(state) {
  return state.buildings.usine + state.buildings.entrepot + state.buildings.boutique;
}

/** "Master Tuner : Bâtiment niveau 3 (palier supérieur)" — défaut : total bâtiments niveau 3 >= seuil. */
export function isNiveau3PalierSuperieurUnlocked(state) {
  return totalNiveau3Buildings(state) >= NIVEAU3_PALIER_SUPERIEUR_COUNT;
}

export function isEmployeeTierUnlocked(state, tierUnlock) {
  switch (tierUnlock) {
    case 'niveau1':
      return true;
    case 'niveau2':
      return isNiveau2Unlocked(state);
    case 'niveau3':
      return isNiveau3Unlocked(state);
    case 'niveau3plus':
      return isNiveau3PalierSuperieurUnlocked(state);
    default:
      return false;
  }
}

export function isMultiplierUnlocked(state, unlock) {
  if (unlock === 'niveau2') return isNiveau2Unlocked(state);
  if (unlock === 'niveau3') return isNiveau3Unlocked(state);
  return true;
}

export function isAccordageUltimeUnlocked(state) {
  const { employeeTier, count } = ACCORDAGE_ULTIME.unlockRequires;
  return (state.employees[employeeTier] || 0) >= count;
}
