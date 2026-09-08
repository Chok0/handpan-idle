#!/usr/bin/env node
// Simulation accélérée — Phase 8 du GDD ("Équilibrage via simulation accélérée : script qui
// simule N ticks"). Un bot glouton joue le jeu (clique à rythme constant, achète toujours
// l'action la moins chère qu'il peut se payer) pendant N secondes simulées, et rapporte :
//   - des jalons de progression (temps simulé pour atteindre chaque palier clé) → matière à
//     ajuster l'équilibrage des coûts/production ;
//   - des anomalies (NaN/Infinity/valeurs négatives) → détecte une régression numérique.
//
// Usage : node tests/simulation/run-simulation.mjs [secondes_simulées]
// Par défaut : 3h simulées (rapide, adapté à un run depuis le système de readiness/CI).
// Pour une vraie passe d'équilibrage : node tests/simulation/run-simulation.mjs 604800 (7 jours).
import { GameEngine } from '../../src/engine/game.js';
import * as purchases from '../../src/engine/purchases.js';
import {
  TOOLS,
  EMPLOYEE_TIERS,
  BUILDINGS_NIVEAU2,
  BUILDINGS_NIVEAU3,
  MULTIPLIERS,
  PASSIVE_CLICK_UPGRADES,
} from '../../src/data/balance-constants.js';
import { MASTER_PANS } from '../../src/data/master-pans.js';
import { PATTERNS } from '../../src/data/patterns.js';
import { GENERIC_UPGRADES } from '../../src/data/generic-upgrades.js';
import { isMultiplierUnlocked, isEmployeeTierUnlocked, isAccordageUltimeUnlocked } from '../../src/engine/unlocks.js';
import { getMetricValue } from '../../src/engine/economy.js';

const SIM_SECONDS = Number(process.argv[2]) || 3 * 3600;
const CLICKS_PER_SECOND = 1; // joueur "moyennement actif" simulé

function collectCandidates(engine) {
  const state = engine.state;
  const candidates = [];

  candidates.push({ label: 'tool:marteau', cost: purchases.marteauCost(state, 'marteau'), run: () => engine.buyTool('marteau') });
  if (isMultiplierUnlocked(state, TOOLS.marteau_pneumatique.unlock)) {
    candidates.push({ label: 'tool:marteau_pneumatique', cost: purchases.marteauCost(state, 'marteau_pneumatique'), run: () => engine.buyTool('marteau_pneumatique') });
  }

  for (const tier of EMPLOYEE_TIERS) {
    if (!isEmployeeTierUnlocked(state, tier.unlock)) continue;
    candidates.push({ label: `employee-direct:${tier.id}`, cost: purchases.employeeDirectCost(state, tier.id), run: () => engine.buyEmployeeDirect(tier.id) });
    if (tier.convertFrom && state.employees[tier.convertFrom] > 0) {
      candidates.push({ label: `convert:${tier.id}`, cost: purchases.employeeConversionCost(state, tier.id), run: () => engine.convertEmployee(tier.id) });
    }
  }

  const n1next = purchases.buildingNiveau1NextCost(state);
  if (n1next !== null) candidates.push({ label: 'building1-next', cost: n1next, run: () => engine.buyBuildingNiveau1Next() });

  for (const b of [...BUILDINGS_NIVEAU2, ...BUILDINGS_NIVEAU3]) {
    const isN3 = BUILDINGS_NIVEAU3.includes(b);
    if (isMultiplierUnlocked(state, isN3 ? 'niveau3' : 'niveau2')) {
      candidates.push({ label: `building:${b.id}`, cost: purchases.buildingCost(state, b.id), run: () => engine.buyBuilding(b.id) });
    }
  }

  for (const m of Object.values(MULTIPLIERS)) {
    if (isMultiplierUnlocked(state, m.unlock)) {
      candidates.push({ label: `multiplier:${m.id}`, cost: purchases.multiplierCost(state, m.id), run: () => engine.buyMultiplier(m.id) });
    }
  }

  for (const pan of MASTER_PANS) {
    if (!state.masterPansUnlocked.includes(pan.id)) {
      candidates.push({ label: `masterpan:${pan.id}`, cost: pan.cost, run: () => engine.unlockMasterPan(pan.id) });
    }
  }

  for (const u of PASSIVE_CLICK_UPGRADES) {
    if (!state.passiveClickUpgrades[u.id]) {
      candidates.push({ label: `passive:${u.id}`, cost: u.cost, run: () => engine.buyPassiveClickUpgrade(u.id) });
    }
  }

  const nextPerc = purchases.nextPercussionTierCost(state);
  if (nextPerc !== null) candidates.push({ label: 'percussion-next', cost: nextPerc, run: () => engine.buyNextPercussionTier() });

  for (const p of PATTERNS) {
    if (!state.patternsUnlocked.includes(p.id)) {
      candidates.push({ label: `pattern:${p.id}`, cost: p.coutDeblocage, run: () => engine.unlockPattern(p.id) });
    }
  }

  for (const u of GENERIC_UPGRADES) {
    if (!state.genericUpgradesBought.includes(u.id) && getMetricValue(state, u.seuil.metric) >= u.seuil.value) {
      candidates.push({ label: `generic:${u.id}`, cost: u.cost, run: () => engine.buyGenericUpgrade(u.id) });
    }
  }

  if (isAccordageUltimeUnlocked(state)) {
    candidates.push({ label: 'ultimate', cost: purchases.accordageUltimeCost(state), run: () => engine.buyAccordageUltime() });
  }

  return candidates.sort((a, b) => a.cost - b.cost);
}

function checkSanity(state, atSecond, problems) {
  if (!Number.isFinite(state.handpans) || state.handpans < 0) {
    problems.push(`handpans invalide (${state.handpans}) à t=${atSecond}s`);
  }
  if (!Number.isFinite(state.totalHandpansMade) || state.totalHandpansMade < 0) {
    problems.push(`totalHandpansMade invalide (${state.totalHandpansMade}) à t=${atSecond}s`);
  }
}

export function runSimulation(seconds) {
  const engine = new GameEngine();
  const milestones = {};
  const problems = [];
  let simMs = 0;

  const recordMilestoneIfNew = (key, condition) => {
    if (!milestones[key] && condition) milestones[key] = { second: Math.round(simMs / 1000) };
  };

  for (let s = 0; s < seconds; s++) {
    simMs += 1000;
    engine.tick(1);
    for (let c = 0; c < CLICKS_PER_SECOND; c++) engine.click(0, simMs);

    // Achats gloutons : à chaque passe, on parcourt TOUTES les actions triées par coût croissant
    // et on achète celles qu'on peut encore se payer au fil de la passe. Prendre uniquement "la
    // moins chère" et recommencer depuis le début (au lieu d'une passe complète) ferait dépenser
    // tout le budget sur le même petit objet répétable (ex. Marteau, ~15 ♫ x1.15^n) bien avant
    // d'atteindre des paliers plus chers mais structurants (Cave à 5000 ♫) — pas représentatif
    // d'un joueur réel, qui diversifie. Plusieurs passes (garde-fou 20) permettent de racheter
    // plusieurs fois un objet répétable dans le même tick si le budget le permet encore.
    for (let pass = 0; pass < 20; pass++) {
      const candidates = collectCandidates(engine);
      let boughtSomething = false;
      for (const candidate of candidates) {
        if (candidate.cost > engine.state.handpans) continue;
        const result = candidate.run();
        if (result?.success) boughtSomething = true;
      }
      if (!boughtSomething) break;
    }

    checkSanity(engine.state, s, problems);

    recordMilestoneIfNew('cave', engine.state.buildings.niveau1Stage >= 1);
    recordMilestoneIfNew('garage_niveau2', engine.state.buildings.niveau1Stage >= 2);
    recordMilestoneIfNew('niveau3', engine.state.buildings.atelier >= 1 && engine.state.buildings.showroom >= 1);
    recordMilestoneIfNew('premier_ouvrier', engine.state.employees.ouvrier >= 1);
    recordMilestoneIfNew('premier_accordeur', engine.state.employees.accordeur >= 1);
    recordMilestoneIfNew('premier_master_tuner', engine.state.employees.master_tuner >= 1);
    recordMilestoneIfNew('accordage_ultime_debloque', engine.state.accordageUltimeCount >= 1);
    recordMilestoneIfNew('tous_master_pans', engine.state.masterPansUnlocked.length === MASTER_PANS.length);
    recordMilestoneIfNew('toutes_ameliorations_generiques', engine.state.genericUpgradesBought.length === GENERIC_UPGRADES.length);
  }

  return {
    finalState: engine.state,
    milestones,
    problemCount: problems.length,
    problemsSample: problems.slice(0, 20),
  };
}

// N'exécute la simulation CLI que si le fichier est lancé directement (pas quand importé,
// ex. par le système de readiness).
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runSimulation(SIM_SECONDS);
  console.log(JSON.stringify(
    {
      simulatedSeconds: SIM_SECONDS,
      milestones: result.milestones,
      problemCount: result.problemCount,
      problemsSample: result.problemsSample,
      finalHandpans: result.finalState.handpans,
      finalTotalMade: result.finalState.totalHandpansMade,
    },
    null,
    2
  ));
  if (result.problemCount > 0) process.exitCode = 1;
}
