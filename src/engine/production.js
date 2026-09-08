// Calcul de la production (idle) et du gain par frappe (clic) — cœur du pilier de design
// (§1 du GDD) : chaque formule ici doit garder les deux branches (Atelier/Handpan) rentables
// et articulées entre elles (la synergie Marteaux ci-dessous).
import {
  TOOLS,
  EMPLOYEE_TIERS,
  BUILDINGS_NIVEAU1,
  PASSIVE_CLICK_UPGRADES,
  ACCORDAGE_ULTIME,
} from '../data/balance-constants.js';
import { getMasterPan } from '../data/master-pans.js';
import { GENERIC_UPGRADES } from '../data/generic-upgrades.js';
import { getMetricValue, clampFinite } from './economy.js';

export function employeeTotalCount(state) {
  return Object.values(state.employees).reduce((a, b) => a + b, 0);
}

/**
 * §5.1 — bonus_marteaux = (nb_marteaux×1 + nb_marteaux_pneumatiques×10) × nb_employés_total
 * C'est LA mécanique de synergie clic ↔ idle : plus l'atelier grossit, plus chaque Marteau
 * pèse lourd sur le clic manuel.
 */
export function bonusMarteaux(state) {
  const totalEmployees = employeeTotalCount(state);
  const bonusPerEmployee =
    state.tools.marteau * TOOLS.marteau.bonusPerUnit +
    state.tools.marteau_pneumatique * TOOLS.marteau_pneumatique.bonusPerUnit;
  return bonusPerEmployee * totalEmployees;
}

/** §6.2 — bonus additifs (Didgeridoo drone +10%, Backing track +20% -> 1 + somme des %). */
export function passiveClickMultiplier(state) {
  let bonus = 0;
  for (const upgrade of PASSIVE_CLICK_UPGRADES) {
    if (state.passiveClickUpgrades[upgrade.id]) bonus += upgrade.bonusPct;
  }
  return 1 + bonus;
}

/**
 * §7 — les améliorations génériques "multiplient note_value globalement (×2, ×2...)" :
 * lecture comme un produit de multiplicateurs (stacking multiplicatif, pas additif).
 */
export function genericUpgradeMultiplierProduct(state) {
  let product = 1;
  for (const id of state.genericUpgradesBought) {
    const upgrade = GENERIC_UPGRADES.find((u) => u.id === id);
    if (upgrade) product *= upgrade.effet.value;
  }
  return product;
}

/** Accordage Ultime (§7) : +5% de production globale permanente par achat — s'applique
 * aussi bien à la production idle qu'au clic ("production globale", pas seulement idle). */
export function accordageUltimeMultiplier(state) {
  return 1 + state.accordageUltimeCount * ACCORDAGE_ULTIME.bonusPct;
}

/** note_value effectif du handpan actif = base × améliorations génériques (§7). */
export function effectiveNoteValue(state) {
  const pan = getMasterPan(state.activeMasterPan);
  return pan.noteValueBase * genericUpgradeMultiplierProduct(state);
}

/**
 * §4 — gain_frappe = (note_value + bonus_marteaux) × multiplicateurs_de_clic_passifs
 *                    × bonus_rythme_si_temps_correct × bonus_pattern_si_en_cours
 * `rhythmBonus` et `patternBonus` valent 1 si non actifs (fournis par l'appelant, qui gère
 * le timing/l'état de pattern — hors périmètre pur de cette fonction).
 */
export function computeClickGain(state, { rhythmBonus = 1, patternBonus = 1 } = {}) {
  const base = effectiveNoteValue(state) + bonusMarteaux(state);
  const gain =
    base *
    passiveClickMultiplier(state) *
    rhythmBonus *
    patternBonus *
    accordageUltimeMultiplier(state);
  return clampFinite(gain); // garde-fou anti-overflow, voir globalProductionMultiplier
}

/** Plafond d'employés dérivé des bâtiments possédés (§5.3). */
export function employeesMax(state) {
  const n1 = BUILDINGS_NIVEAU1[state.buildings.niveau1Stage];
  let max = n1.employeesMax;
  max += state.buildings.atelier * 5 + state.buildings.showroom * 5;
  max += state.buildings.usine * 10 + state.buildings.entrepot * 15 + state.buildings.boutique * 10;
  return max;
}

/** Multiplicateur de production globale cumulé : bâtiments (niveaux 1/2/3) + multiplicateurs
 * dédiés (Hydro formeuse, Presse hydraulique) + Accordage Ultime. */
export function globalProductionMultiplier(state) {
  let mult = 1;
  if (state.buildings.niveau1Stage >= 1) mult *= BUILDINGS_NIVEAU1[1].globalMult; // Cave
  if (state.buildings.niveau1Stage >= 2) mult *= BUILDINGS_NIVEAU1[2].globalMult; // Garage
  mult *= Math.pow(1.1, state.buildings.atelier);
  mult *= Math.pow(1.15, state.buildings.showroom);
  mult *= Math.pow(1.2, state.buildings.usine);
  mult *= Math.pow(1.1, state.buildings.entrepot);
  mult *= Math.pow(1.25, state.buildings.boutique);
  mult *= Math.pow(1.5, state.multipliers.hydro_formeuse);
  mult *= Math.pow(1.75, state.multipliers.presse_hydraulique);
  mult *= accordageUltimeMultiplier(state);
  // Garde-fou anti-overflow (pas un plafond de jeu) : voir clampFinite/SAFE_MAX dans economy.js.
  return clampFinite(mult);
}

/** Production idle brute (♫/s) avant application des multiplicateurs globaux. */
export function rawEmployeeProduction(state) {
  return EMPLOYEE_TIERS.reduce(
    (sum, tier) => sum + (state.employees[tier.id] || 0) * (1 / tier.interval),
    0
  );
}

/** Production idle totale (♫/s), toutes synergies incluses. */
export function productionPerSecond(state) {
  return clampFinite(rawEmployeeProduction(state) * globalProductionMultiplier(state));
}

export { getMetricValue };
