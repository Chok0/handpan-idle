import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultState, migrateState, STATE_VERSION } from '../../src/engine/state.js';
import { saveState, loadRawState, clearSave, computeOfflineProgress, SAVE_KEY } from '../../src/engine/save.js';

// jsdom fournit localStorage dans l'environnement de test si configuré ; ce fichier est prévu
// pour tourner avec `environment: 'node'` (vitest.config.js) où localStorage est absent —
// on vérifie donc explicitement la dégradation propre, PUIS on simule un localStorage minimal
// pour tester le chemin nominal.
describe('save/load — dégradation sans localStorage (Node)', () => {
  it('saveState ne lève pas et renvoie false si localStorage est indisponible', () => {
    expect(() => saveState(createDefaultState())).not.toThrow();
  });

  it('loadRawState renvoie null si localStorage est indisponible', () => {
    expect(loadRawState()).toBeNull();
  });
});

describe('save/load — avec un localStorage simulé', () => {
  beforeEach(() => {
    const store = new Map();
    global.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });

  it('sauvegarde puis relit un état identique', () => {
    const state = createDefaultState();
    state.handpans = 12345.6;
    saveState(state);
    const raw = loadRawState();
    expect(raw.handpans).toBeCloseTo(12345.6, 5);
    expect(raw.version).toBe(STATE_VERSION);
  });

  it('clearSave supprime la sauvegarde', () => {
    saveState(createDefaultState());
    clearSave();
    expect(loadRawState()).toBeNull();
  });
});

describe('migrateState', () => {
  it('renvoie un état par défaut si rien à charger', () => {
    const state = migrateState(null);
    expect(state.handpans).toBe(0);
    expect(state.version).toBe(STATE_VERSION);
  });

  it('complète les champs manquants d\'une sauvegarde partielle (tolérance de version)', () => {
    const partial = { handpans: 500, employees: { apprenti: 2 } };
    const state = migrateState(partial);
    expect(state.handpans).toBe(500);
    expect(state.employees.apprenti).toBe(2);
    expect(state.employees.ouvrier).toBe(0); // complété depuis le défaut
    expect(state.buildings).toBeDefined();
  });
});

describe('computeOfflineProgress — Phase 2 du §11', () => {
  it('0 si jamais sauvegardé', () => {
    const state = createDefaultState();
    state.lastSaveTimestamp = null;
    expect(computeOfflineProgress(state).earned).toBe(0);
  });

  it('crédite production_par_seconde × secondes écoulées', () => {
    const state = createDefaultState();
    state.employees.apprenti = 1; // 0.1 ♫/s
    const now = Date.now();
    state.lastSaveTimestamp = now - 100_000; // 100 s plus tôt
    const { earned, elapsedSeconds } = computeOfflineProgress(state, now);
    expect(elapsedSeconds).toBeCloseTo(100, 0);
    expect(earned).toBeCloseTo(10, 5); // 0.1 * 100
  });

  it('plafonne à 12h pour éviter les abus/dérives d\'horloge', () => {
    const state = createDefaultState();
    state.employees.master_tuner = 10; // grosse prod pour rendre le plafond visible
    const now = Date.now();
    state.lastSaveTimestamp = now - 1000 * 3600 * 24 * 30; // 30 jours dans le passé
    const { cappedSeconds } = computeOfflineProgress(state, now);
    expect(cappedSeconds).toBe(12 * 3600);
  });
});
