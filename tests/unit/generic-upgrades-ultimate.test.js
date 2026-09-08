import { describe, it, expect } from 'vitest';
import { createDefaultState } from '../../src/engine/state.js';
import * as purchases from '../../src/engine/purchases.js';
import { GENERIC_UPGRADES, generateGenericUpgrades } from '../../src/data/generic-upgrades.js';
import { genericUpgradeMultiplierProduct, effectiveNoteValue } from '../../src/engine/production.js';
import { isAccordageUltimeUnlocked } from '../../src/engine/unlocks.js';

describe('Améliorations génériques — §7 ("~30-40, générées à partir d\'un template")', () => {
  it('compte entre 30 et 40 améliorations', () => {
    expect(GENERIC_UPGRADES.length).toBeGreaterThanOrEqual(30);
    expect(GENERIC_UPGRADES.length).toBeLessThanOrEqual(40);
  });

  it('sont bien générées (le générateur reproduit exactement GENERIC_UPGRADES)', () => {
    expect(generateGenericUpgrades()).toEqual(GENERIC_UPGRADES);
  });

  it('chaque amélioration a un id unique et un seuil croissant dans sa catégorie', () => {
    const ids = new Set(GENERIC_UPGRADES.map((u) => u.id));
    expect(ids.size).toBe(GENERIC_UPGRADES.length);

    const byCategory = new Map();
    for (const u of GENERIC_UPGRADES) {
      if (!byCategory.has(u.categorie)) byCategory.set(u.categorie, []);
      byCategory.get(u.categorie).push(u.seuil.value);
    }
    for (const thresholds of byCategory.values()) {
      const sorted = [...thresholds].sort((a, b) => a - b);
      expect(thresholds).toEqual(sorted);
    }
  });

  it('refuse un achat avant que le seuil soit atteint', () => {
    const state = createDefaultState();
    state.handpans = 1e12;
    const upgrade = GENERIC_UPGRADES.find((u) => u.seuil.metric === 'totalHandpansMade');
    expect(purchases.buyGenericUpgrade(state, upgrade.id)).toEqual({ success: false, reason: 'seuil_non_atteint' });
  });

  it('une fois achetée, multiplie note_value globalement (§7, effet multiplicatif)', () => {
    const state = createDefaultState();
    state.handpans = 1e12;
    state.totalHandpansMade = 1e10; // dépasse tous les seuils "production à vie"
    const upgrade = GENERIC_UPGRADES.find((u) => u.seuil.metric === 'totalHandpansMade');
    const before = effectiveNoteValue(state);
    expect(purchases.buyGenericUpgrade(state, upgrade.id)).toEqual({ success: true });
    const after = effectiveNoteValue(state);
    expect(after).toBeCloseTo(before * upgrade.effet.value, 10);
  });

  it('plusieurs améliorations se cumulent multiplicativement (pas additivement)', () => {
    const state = createDefaultState();
    const a = { id: 'x', effet: { value: 2 } };
    const b = { id: 'y', effet: { value: 3 } };
    state.genericUpgradesBought = [];
    // On simule directement via genericUpgradeMultiplierProduct avec des ids réels pour rester fidèle aux données.
    const [first, second] = GENERIC_UPGRADES;
    state.genericUpgradesBought = [first.id, second.id];
    expect(genericUpgradeMultiplierProduct(state)).toBeCloseTo(first.effet.value * second.effet.value, 10);
  });
});

describe('Accordage Ultime — §7 (fin de partie, sans reset)', () => {
  it('verrouillé avant le premier Master Tuner', () => {
    const state = createDefaultState();
    expect(isAccordageUltimeUnlocked(state)).toBe(false);
  });

  it('débloqué et rachetable à coût exponentiellement croissant', () => {
    const state = createDefaultState();
    state.employees.master_tuner = 1;
    state.handpans = 1e15;
    expect(isAccordageUltimeUnlocked(state)).toBe(true);
    const price1 = purchases.accordageUltimeCost(state);
    expect(purchases.buyAccordageUltime(state)).toEqual({ success: true });
    const price2 = purchases.accordageUltimeCost(state);
    expect(price2).toBeGreaterThan(price1);
    expect(state.accordageUltimeCount).toBe(1);
  });

  it('ne remet jamais la progression à zéro (aucun champ de state réinitialisé par l\'achat)', () => {
    const state = createDefaultState();
    state.employees.master_tuner = 1;
    state.handpans = 1e15;
    state.totalHandpansMade = 12345;
    purchases.buyAccordageUltime(state);
    expect(state.totalHandpansMade).toBe(12345);
    expect(state.employees.master_tuner).toBe(1);
  });
});
