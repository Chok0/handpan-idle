import { describe, it, expect } from 'vitest';
import { createDefaultState } from '../../src/engine/state.js';
import { SAFE_MAX } from '../../src/engine/economy.js';
import {
  bonusMarteaux,
  computeClickGain,
  employeesMax,
  productionPerSecond,
  passiveClickMultiplier,
  globalProductionMultiplier,
} from '../../src/engine/production.js';

describe('bonusMarteaux — §5.1 synergie clic ↔ idle', () => {
  it('vaut 0 sans marteau ni employé', () => {
    const state = createDefaultState();
    expect(bonusMarteaux(state)).toBe(0);
  });

  it('= (marteaux×1 + pneumatiques×10) × nb_employés_total', () => {
    const state = createDefaultState();
    state.tools.marteau = 2;
    state.tools.marteau_pneumatique = 1;
    state.employees = { apprenti: 3, ouvrier: 2, accordeur: 0, master_tuner: 0 };
    // (2*1 + 1*10) * 5 = 60
    expect(bonusMarteaux(state)).toBe(60);
  });

  it('grossit avec le nombre d\'employés à nombre de marteaux fixe (le cœur de la synergie)', () => {
    const state = createDefaultState();
    state.tools.marteau = 5;
    state.employees.apprenti = 1;
    const before = bonusMarteaux(state);
    state.employees.apprenti = 10;
    const after = bonusMarteaux(state);
    expect(after).toBeGreaterThan(before);
  });
});

describe('gain_frappe — §4', () => {
  it('= note_value du handpan de départ (1) sans aucune amélioration', () => {
    const state = createDefaultState();
    expect(computeClickGain(state)).toBe(1);
  });

  it('additionne bonus_marteaux avant les multiplicateurs', () => {
    const state = createDefaultState();
    state.tools.marteau = 1;
    state.employees.apprenti = 4;
    // note_value(1) + bonus_marteaux(1*4=4) = 5
    expect(computeClickGain(state)).toBe(5);
  });

  it('applique les multiplicateurs de clic passifs (§6.2, additifs entre eux)', () => {
    const state = createDefaultState();
    state.passiveClickUpgrades.didgeridoo_drone = true; // +10%
    state.passiveClickUpgrades.backing_track = true; // +20%
    expect(passiveClickMultiplier(state)).toBeCloseTo(1.3, 10);
    expect(computeClickGain(state)).toBeCloseTo(1.3, 10);
  });

  it('applique le bonus rythme uniquement si transmis "actif"', () => {
    const state = createDefaultState();
    expect(computeClickGain(state, { rhythmBonus: 1.5 })).toBeCloseTo(1.5, 10);
  });

  it('applique le bonus pattern multiplicativement avec les autres facteurs', () => {
    const state = createDefaultState();
    const gain = computeClickGain(state, { rhythmBonus: 2, patternBonus: 3 });
    expect(gain).toBeCloseTo(1 * 2 * 3, 10);
  });
});

describe('employeesMax — §5.3', () => {
  it('Placard clandestin (défaut) = 3', () => {
    expect(employeesMax(createDefaultState())).toBe(3);
  });

  it('Cave = 8, Garage = 15', () => {
    const state = createDefaultState();
    state.buildings.niveau1Stage = 1;
    expect(employeesMax(state)).toBe(8);
    state.buildings.niveau1Stage = 2;
    expect(employeesMax(state)).toBe(15);
  });

  it('Atelier/Showroom ajoutent +5 chacun par exemplaire', () => {
    const state = createDefaultState();
    state.buildings.niveau1Stage = 2;
    state.buildings.atelier = 2;
    state.buildings.showroom = 1;
    expect(employeesMax(state)).toBe(15 + 2 * 5 + 1 * 5);
  });
});

describe('globalProductionMultiplier — §5.3/§5.4', () => {
  it('= 1 au tout début', () => {
    expect(globalProductionMultiplier(createDefaultState())).toBe(1);
  });

  it('Cave ×1.2 puis Garage ×1.5 (cumulatifs)', () => {
    const state = createDefaultState();
    state.buildings.niveau1Stage = 2;
    expect(globalProductionMultiplier(state)).toBeCloseTo(1.2 * 1.5, 10);
  });

  it('Hydro formeuse et Presse hydraulique se cumulent en puissance du nombre possédé', () => {
    const state = createDefaultState();
    state.multipliers.hydro_formeuse = 2;
    expect(globalProductionMultiplier(state)).toBeCloseTo(Math.pow(1.5, 2), 10);
  });

  it("Accordage Ultime ajoute +5% permanent par achat, sur la production ET le clic", () => {
    const state = createDefaultState();
    state.accordageUltimeCount = 3;
    expect(globalProductionMultiplier(state)).toBeCloseTo(1 + 3 * 0.05, 10);
    expect(computeClickGain(state)).toBeCloseTo(1 * (1 + 0.15), 10);
  });
});

describe('Garde-fou anti-overflow (régression)', () => {
  // Une simulation accélérée (tests/simulation/run-simulation.mjs) a montré qu'un joueur
  // assidu qui cumule ~400+ exemplaires de chaque bâtiment/multiplicateur niveau 2/3 fait
  // dépasser à `globalProductionMultiplier` la limite d'un `double` (~1.8e308) : les 7
  // multiplicateurs `mult^n` indépendants s'additionnent en espace log et finissent par
  // produire `Infinity`, ce qui corromptrait la sauvegarde (§10, JSON versionné) et
  // afficherait "Infinity ♫" au joueur. Ce test verrouille le garde-fou (clampFinite).
  function extremeState() {
    const state = createDefaultState();
    state.buildings = { niveau1Stage: 2, atelier: 5000, showroom: 5000, usine: 5000, entrepot: 5000, boutique: 5000 };
    state.multipliers = { hydro_formeuse: 5000, presse_hydraulique: 5000 };
    state.employees = { apprenti: 100, ouvrier: 100, accordeur: 100, master_tuner: 100000 };
    state.tools = { marteau: 100000, marteau_pneumatique: 100000 };
    state.accordageUltimeCount = 100000;
    return state;
  }

  it('globalProductionMultiplier reste fini et plafonné à SAFE_MAX', () => {
    const mult = globalProductionMultiplier(extremeState());
    expect(Number.isFinite(mult)).toBe(true);
    expect(mult).toBeLessThanOrEqual(SAFE_MAX);
  });

  it('productionPerSecond reste fini même à cette échelle', () => {
    const value = productionPerSecond(extremeState());
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeLessThanOrEqual(SAFE_MAX);
  });

  it('computeClickGain reste fini même à cette échelle', () => {
    const value = computeClickGain(extremeState());
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeLessThanOrEqual(SAFE_MAX);
  });

  it("le moteur complet ne produit jamais Infinity/NaN sur state.handpans après un tick extrême", async () => {
    const { GameEngine } = await import('../../src/engine/game.js');
    const engine = new GameEngine();
    Object.assign(engine.state, extremeState());
    engine.tick(3600); // une heure de production d'un coup
    expect(Number.isFinite(engine.state.handpans)).toBe(true);
    expect(Number.isFinite(engine.state.totalHandpansMade)).toBe(true);
  });
});

describe('productionPerSecond — §5.2', () => {
  it('un Apprenti seul produit 0.1 ♫/s (1 pan / 10s)', () => {
    const state = createDefaultState();
    state.employees.apprenti = 1;
    expect(productionPerSecond(state)).toBeCloseTo(0.1, 10);
  });

  it('un Master Tuner seul produit 2.5 ♫/s (1 pan / 0.4s)', () => {
    const state = createDefaultState();
    state.employees.master_tuner = 1;
    expect(productionPerSecond(state)).toBeCloseTo(2.5, 10);
  });
});
