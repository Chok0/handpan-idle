// Toutes les actions d'achat/déblocage. Chaque fonction prend `state` et le mute directement
// si l'achat réussit (pas d'état immuable — c'est un idle game avec une boucle de tick,
// la mutation directe est le choix le plus simple et le plus rapide à raisonner).
// Retour uniforme : { success: boolean, reason?: string }.
import {
  TOOLS,
  EMPLOYEE_TIERS,
  BUILDINGS_NIVEAU1,
  BUILDINGS_NIVEAU2,
  BUILDINGS_NIVEAU3,
  MULTIPLIERS,
  PASSIVE_CLICK_UPGRADES,
  PERCUSSION_TIERS,
  ACCORDAGE_ULTIME,
} from '../data/balance-constants.js';
import { MASTER_PANS, getMasterPan } from '../data/master-pans.js';
import { PATTERNS, getPattern, MAX_PATTERNS_EQUIPPED } from '../data/patterns.js';
import { GENERIC_UPGRADES } from '../data/generic-upgrades.js';
import { cost, getMetricValue } from './economy.js';
import { employeesMax } from './production.js';
import {
  isEmployeeTierUnlocked,
  isMultiplierUnlocked,
  isAccordageUltimeUnlocked,
} from './unlocks.js';

function fail(reason) {
  return { success: false, reason };
}
const OK = { success: true };

function trySpend(state, price) {
  if (state.handpans < price) return false;
  state.handpans -= price;
  return true;
}

// ---------------------------------------------------------------------------
// Outils (Marteaux) — §5.1
// ---------------------------------------------------------------------------
export function marteauCost(state, toolId) {
  const def = TOOLS[toolId];
  return cost(def.baseCost, state.tools[toolId]);
}

export function buyTool(state, toolId) {
  const def = TOOLS[toolId];
  if (!def) return fail('outil_inconnu');
  if (def.unlock && !isMultiplierUnlocked(state, def.unlock)) return fail('verrouille');
  const price = marteauCost(state, toolId);
  if (!trySpend(state, price)) return fail('trop_cher');
  state.tools[toolId] += 1;
  return OK;
}

// ---------------------------------------------------------------------------
// Employés — §5.2
// ---------------------------------------------------------------------------
function getTierDef(tierId) {
  return EMPLOYEE_TIERS.find((t) => t.id === tierId);
}

export function employeeDirectCost(state, tierId) {
  const def = getTierDef(tierId);
  return cost(def.directCost, state.employees[tierId]);
}

export function employeeConversionCost(state, tierId) {
  const def = getTierDef(tierId);
  return cost(def.conversionCost, state.employees[tierId]);
}

export function buyEmployeeDirect(state, tierId) {
  const def = getTierDef(tierId);
  if (!def) return fail('palier_inconnu');
  if (!isEmployeeTierUnlocked(state, def.unlock)) return fail('verrouille');
  const totalEmployees = Object.values(state.employees).reduce((a, b) => a + b, 0);
  if (totalEmployees >= employeesMax(state)) return fail('plafond_employes');
  const price = employeeDirectCost(state, tierId);
  if (!trySpend(state, price)) return fail('trop_cher');
  state.employees[tierId] += 1;
  return OK;
}

/** Convertit un employé du palier inférieur (consommé) en un employé de ce palier. */
export function convertEmployee(state, tierId) {
  const def = getTierDef(tierId);
  if (!def || !def.convertFrom) return fail('palier_non_convertible');
  if (!isEmployeeTierUnlocked(state, def.unlock)) return fail('verrouille');
  if (state.employees[def.convertFrom] < 1) return fail('pas_de_source');
  const price = employeeConversionCost(state, tierId);
  if (!trySpend(state, price)) return fail('trop_cher');
  state.employees[def.convertFrom] -= 1;
  state.employees[tierId] += 1;
  return OK;
}

// ---------------------------------------------------------------------------
// Bâtiments — §5.3
// ---------------------------------------------------------------------------
export function buildingNiveau1NextCost(state) {
  const nextStage = state.buildings.niveau1Stage + 1;
  if (nextStage >= BUILDINGS_NIVEAU1.length) return null;
  return BUILDINGS_NIVEAU1[nextStage].cost;
}

export function buyBuildingNiveau1Next(state) {
  const price = buildingNiveau1NextCost(state);
  if (price === null) return fail('deja_max');
  if (!trySpend(state, price)) return fail('trop_cher');
  state.buildings.niveau1Stage += 1;
  return OK;
}

function findBuildingDef(id) {
  return BUILDINGS_NIVEAU2.find((b) => b.id === id) || BUILDINGS_NIVEAU3.find((b) => b.id === id);
}

export function buildingCost(state, id) {
  const def = findBuildingDef(id);
  return cost(def.baseCost, state.buildings[id]);
}

export function buyBuilding(state, id) {
  const def = findBuildingDef(id);
  if (!def) return fail('batiment_inconnu');
  const isNiveau3 = BUILDINGS_NIVEAU3.some((b) => b.id === id);
  if (isNiveau3 && !isMultiplierUnlocked(state, 'niveau3')) return fail('verrouille');
  if (!isNiveau3 && !isMultiplierUnlocked(state, 'niveau2')) return fail('verrouille');
  const price = buildingCost(state, id);
  if (!trySpend(state, price)) return fail('trop_cher');
  state.buildings[id] += 1;
  return OK;
}

// ---------------------------------------------------------------------------
// Multiplicateurs de production — §5.4
// ---------------------------------------------------------------------------
export function multiplierCost(state, id) {
  const def = MULTIPLIERS[id];
  return cost(def.baseCost, state.multipliers[id]);
}

export function buyMultiplier(state, id) {
  const def = MULTIPLIERS[id];
  if (!def) return fail('multiplicateur_inconnu');
  if (!isMultiplierUnlocked(state, def.unlock)) return fail('verrouille');
  const price = multiplierCost(state, id);
  if (!trySpend(state, price)) return fail('trop_cher');
  state.multipliers[id] += 1;
  return OK;
}

// ---------------------------------------------------------------------------
// Handpans maîtres — §6.1
// ---------------------------------------------------------------------------
export function unlockMasterPan(state, id) {
  if (state.masterPansUnlocked.includes(id)) return fail('deja_possede');
  const pan = MASTER_PANS.find((p) => p.id === id);
  if (!pan) return fail('handpan_inconnu');
  if (!trySpend(state, pan.cost)) return fail('trop_cher');
  state.masterPansUnlocked.push(id);
  return OK;
}

export function setActiveMasterPan(state, id) {
  if (!state.masterPansUnlocked.includes(id)) return fail('non_possede');
  state.activeMasterPan = id;
  return OK;
}

// ---------------------------------------------------------------------------
// Améliorateurs de clic passifs — §6.2
// ---------------------------------------------------------------------------
export function buyPassiveClickUpgrade(state, id) {
  if (state.passiveClickUpgrades[id]) return fail('deja_possede');
  const def = PASSIVE_CLICK_UPGRADES.find((u) => u.id === id);
  if (!def) return fail('amelioration_inconnue');
  if (!trySpend(state, def.cost)) return fail('trop_cher');
  state.passiveClickUpgrades[id] = true;
  return OK;
}

// ---------------------------------------------------------------------------
// Percussions — §6.3
// ---------------------------------------------------------------------------
export function nextPercussionTierCost(state) {
  const next = PERCUSSION_TIERS[state.percussionTier + 1];
  return next ? next.cost : null;
}

export function buyNextPercussionTier(state) {
  const price = nextPercussionTierCost(state);
  if (price === null) return fail('deja_max');
  if (!trySpend(state, price)) return fail('trop_cher');
  state.percussionTier += 1;
  return OK;
}

// ---------------------------------------------------------------------------
// Patterns — §6.4
// ---------------------------------------------------------------------------
export function unlockPattern(state, id) {
  if (state.patternsUnlocked.includes(id)) return fail('deja_possede');
  const pattern = getPattern(id);
  const activePan = getMasterPan(state.activeMasterPan);
  const hasEnoughNotes = pattern.notesRequisesIndex.every((i) => i < activePan.notes.length);
  if (!hasEnoughNotes) return fail('notes_manquantes');
  if (!trySpend(state, pattern.coutDeblocage)) return fail('trop_cher');
  state.patternsUnlocked.push(id);
  return OK;
}

/**
 * Équipe un pattern débloqué : le rend jouable depuis l'écran principal sans détour par la
 * Collection. Plafonné à MAX_PATTERNS_EQUIPPED — au-delà, il faut en déséquiper un d'abord
 * (pas de remplacement automatique implicite, pour ne jamais désarmer un choix sans le dire).
 */
export function equipPattern(state, id) {
  if (!state.patternsUnlocked.includes(id)) return fail('non_debloque');
  if (state.patternsEquipped.includes(id)) return fail('deja_equipe');
  if (state.patternsEquipped.length >= MAX_PATTERNS_EQUIPPED) return fail('emplacements_pleins');
  state.patternsEquipped.push(id);
  return OK;
}

export function unequipPattern(state, id) {
  const index = state.patternsEquipped.indexOf(id);
  if (index === -1) return fail('pas_equipe');
  state.patternsEquipped.splice(index, 1);
  return OK;
}

// ---------------------------------------------------------------------------
// Améliorations génériques + Accordage Ultime — §7
// ---------------------------------------------------------------------------
export function buyGenericUpgrade(state, id) {
  if (state.genericUpgradesBought.includes(id)) return fail('deja_possede');
  const upgrade = GENERIC_UPGRADES.find((u) => u.id === id);
  if (!upgrade) return fail('amelioration_inconnue');
  const value = getMetricValue(state, upgrade.seuil.metric);
  if (value < upgrade.seuil.value) return fail('seuil_non_atteint');
  if (!trySpend(state, upgrade.cost)) return fail('trop_cher');
  state.genericUpgradesBought.push(id);
  return OK;
}

export function accordageUltimeCost(state) {
  return cost(ACCORDAGE_ULTIME.baseCost, state.accordageUltimeCount, ACCORDAGE_ULTIME.growth);
}

export function buyAccordageUltime(state) {
  if (!isAccordageUltimeUnlocked(state)) return fail('verrouille');
  const price = accordageUltimeCost(state);
  if (!trySpend(state, price)) return fail('trop_cher');
  state.accordageUltimeCount += 1;
  return OK;
}
