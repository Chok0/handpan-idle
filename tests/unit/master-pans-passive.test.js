import { describe, it, expect } from 'vitest';
import { createDefaultState } from '../../src/engine/state.js';
import * as purchases from '../../src/engine/purchases.js';
import { effectiveNoteValue } from '../../src/engine/production.js';
import { MASTER_PANS, STARTER_MASTER_PAN_ID } from '../../src/data/master-pans.js';
import { noteToFrequency } from '../../src/data/note-frequency.js';

describe('Handpans maîtres — §6.1', () => {
  it('le handpan de départ est déjà possédé et actif', () => {
    const state = createDefaultState();
    expect(state.masterPansUnlocked).toContain(STARTER_MASTER_PAN_ID);
    expect(state.activeMasterPan).toBe(STARTER_MASTER_PAN_ID);
  });

  it('toutes les notes de tous les handpans maîtres ont une fréquence calculable', () => {
    for (const pan of MASTER_PANS) {
      for (const note of pan.notes) {
        expect(() => noteToFrequency(note)).not.toThrow();
        expect(noteToFrequency(note)).toBeGreaterThan(0);
      }
    }
  });

  it("débloquer un nouveau handpan change note_value_base", () => {
    const state = createDefaultState();
    state.handpans = 1e7;
    const kurd10 = MASTER_PANS.find((p) => p.id === 'kurd10');
    expect(purchases.unlockMasterPan(state, 'kurd10')).toEqual({ success: true });
    expect(purchases.setActiveMasterPan(state, 'kurd10')).toEqual({ success: true });
    expect(effectiveNoteValue(state)).toBe(kurd10.noteValueBase);
  });

  it('refuse de sélectionner un handpan non possédé', () => {
    const state = createDefaultState();
    expect(purchases.setActiveMasterPan(state, 'celestial13')).toEqual({ success: false, reason: 'non_possede' });
  });

  it('les coûts progressent globalement avec le nombre de notes / la puissance', () => {
    for (let i = 1; i < MASTER_PANS.length; i++) {
      expect(MASTER_PANS[i].cost).toBeGreaterThanOrEqual(MASTER_PANS[i - 1].cost);
      expect(MASTER_PANS[i].noteValueBase).toBeGreaterThan(MASTER_PANS[i - 1].noteValueBase);
    }
  });
});

describe('Améliorateurs de clic passifs — §6.2', () => {
  it('achat unique, applique le bonus déclaré', () => {
    const state = createDefaultState();
    state.handpans = 100000;
    expect(purchases.buyPassiveClickUpgrade(state, 'didgeridoo_drone')).toEqual({ success: true });
    expect(purchases.buyPassiveClickUpgrade(state, 'didgeridoo_drone')).toEqual({ success: false, reason: 'deja_possede' });
  });
});
