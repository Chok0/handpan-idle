import { describe, it, expect } from 'vitest';
import { createDefaultState } from '../../src/engine/state.js';
import * as purchases from '../../src/engine/purchases.js';

function withHandpans(n) {
  const state = createDefaultState();
  state.handpans = n;
  return state;
}

describe('Outils (Marteaux) — §5.1', () => {
  it("refuse l'achat si trop cher", () => {
    const state = withHandpans(0);
    expect(purchases.buyTool(state, 'marteau')).toEqual({ success: false, reason: 'trop_cher' });
  });

  it('achète et incrémente, coût croissant ensuite', () => {
    const state = withHandpans(1000);
    expect(purchases.buyTool(state, 'marteau').success).toBe(true);
    expect(state.tools.marteau).toBe(1);
    const price2 = purchases.marteauCost(state, 'marteau');
    expect(price2).toBeGreaterThan(15);
  });

  it('le Marteau pneumatique est verrouillé avant le niveau 2 (Garage)', () => {
    const state = withHandpans(1e6);
    expect(purchases.buyTool(state, 'marteau_pneumatique')).toEqual({ success: false, reason: 'verrouille' });
    state.buildings.niveau1Stage = 2; // Garage
    expect(purchases.buyTool(state, 'marteau_pneumatique').success).toBe(true);
  });
});

describe('Employés — §5.2 achat direct', () => {
  it('respecte le plafond Employés max', () => {
    const state = withHandpans(1e9);
    for (let i = 0; i < 3; i++) {
      expect(purchases.buyEmployeeDirect(state, 'apprenti').success).toBe(true);
    }
    // Placard clandestin (défaut) : max = 3
    expect(purchases.buyEmployeeDirect(state, 'apprenti')).toEqual({ success: false, reason: 'plafond_employes' });
  });

  it('Ouvrier verrouillé avant le niveau 2', () => {
    const state = withHandpans(1e9);
    expect(purchases.buyEmployeeDirect(state, 'ouvrier')).toEqual({ success: false, reason: 'verrouille' });
  });
});

describe('Employés — conversion (§5.2)', () => {
  it('consomme un employé du palier inférieur et ajoute au palier cible', () => {
    const state = withHandpans(1e9);
    state.buildings.niveau1Stage = 2; // débloque niveau2 (Ouvrier)
    purchases.buyEmployeeDirect(state, 'apprenti');
    expect(purchases.convertEmployee(state, 'ouvrier')).toEqual({ success: true });
    expect(state.employees.apprenti).toBe(0);
    expect(state.employees.ouvrier).toBe(1);
  });

  it('refuse sans employé source', () => {
    const state = withHandpans(1e9);
    state.buildings.niveau1Stage = 2;
    expect(purchases.convertEmployee(state, 'ouvrier')).toEqual({ success: false, reason: 'pas_de_source' });
  });

  it('la conversion coûte moins cher que l\'achat direct au même palier (§5.2, table)', () => {
    const state = withHandpans(1e9);
    state.buildings.niveau1Stage = 2;
    const directPrice = purchases.employeeDirectCost(state, 'ouvrier');
    const conversionPrice = purchases.employeeConversionCost(state, 'ouvrier');
    expect(conversionPrice).toBeLessThan(directPrice);
  });
});

describe('Bâtiments niveau 1 — évolution séquentielle (§5.3)', () => {
  it('Placard -> Cave -> Garage, puis plus rien à acheter', () => {
    const state = withHandpans(1e6);
    expect(purchases.buyBuildingNiveau1Next(state)).toEqual({ success: true });
    expect(state.buildings.niveau1Stage).toBe(1);
    expect(purchases.buyBuildingNiveau1Next(state)).toEqual({ success: true });
    expect(state.buildings.niveau1Stage).toBe(2);
    expect(purchases.buyBuildingNiveau1Next(state)).toEqual({ success: false, reason: 'deja_max' });
  });
});

describe('Bâtiments niveau 2/3 — achat multiple (§5.3)', () => {
  it('Atelier verrouillé avant le Garage', () => {
    const state = withHandpans(1e9);
    expect(purchases.buyBuilding(state, 'atelier')).toEqual({ success: false, reason: 'verrouille' });
  });

  it('Usine verrouillée avant le niveau 3 (Atelier + Showroom possédés)', () => {
    const state = withHandpans(1e9);
    state.buildings.niveau1Stage = 2;
    state.buildings.atelier = 1; // manque Showroom
    expect(purchases.buyBuilding(state, 'usine')).toEqual({ success: false, reason: 'verrouille' });
    state.buildings.showroom = 1;
    expect(purchases.buyBuilding(state, 'usine').success).toBe(true);
  });

  it('coût(n) croît par type de bâtiment indépendamment des autres', () => {
    const state = withHandpans(1e9);
    state.buildings.niveau1Stage = 2;
    const before = purchases.buildingCost(state, 'atelier');
    purchases.buyBuilding(state, 'atelier');
    const after = purchases.buildingCost(state, 'atelier');
    const showroomPrice = purchases.buildingCost(state, 'showroom');
    expect(after).toBeGreaterThan(before);
    expect(showroomPrice).toBe(500_000); // inchangé par l'achat d'un Atelier
  });
});

describe('Multiplicateurs — §5.4', () => {
  it('rachetables, coût croissant, verrouillés par palier de bâtiment', () => {
    const state = withHandpans(1e9);
    expect(purchases.buyMultiplier(state, 'hydro_formeuse')).toEqual({ success: false, reason: 'verrouille' });
    state.buildings.niveau1Stage = 2;
    expect(purchases.buyMultiplier(state, 'hydro_formeuse').success).toBe(true);
    expect(state.multipliers.hydro_formeuse).toBe(1);
  });
});
