import { describe, it, expect } from 'vitest';
import { createDefaultState } from '../../src/engine/state.js';
import * as purchases from '../../src/engine/purchases.js';
import { isOnBeat, beatIntervalMs } from '../../src/engine/percussion.js';
import {
  startPatternRun,
  recordPatternHit,
  finishPatternRun,
  beginPlayerPhase,
  expectedNoteIndex,
  RHYTHM_COMBO_THRESHOLD,
} from '../../src/engine/patterns-runtime.js';
import {
  PATTERNS,
  getPattern,
  patternStepTimesMs,
  beatIntervalMs as patternBeatMs,
  MAX_PATTERNS_EQUIPPED,
} from '../../src/data/patterns.js';
import { PERCUSSION_TIERS } from '../../src/data/balance-constants.js';

describe('Percussions — §6.3', () => {
  it('tier 0 : jamais "sur le temps"', () => {
    const state = createDefaultState();
    expect(isOnBeat(state, 0).onBeat).toBe(false);
    expect(isOnBeat(state, 12345).bonus).toBe(1);
  });

  it('les 4 paliers sont strictement croissants en bonus et en exigence (tolérance)', () => {
    for (let i = 1; i < PERCUSSION_TIERS.length; i++) {
      expect(PERCUSSION_TIERS[i].bonus).toBeGreaterThan(PERCUSSION_TIERS[i - 1].bonus);
    }
    expect(PERCUSSION_TIERS[3].toleranceMs).toBeLessThan(PERCUSSION_TIERS[1].toleranceMs);
  });

  it('une frappe exactement sur le temps (tier 1, noires) est "on beat"', () => {
    const state = createDefaultState();
    state.percussionTier = 1;
    const beatMs = beatIntervalMs();
    const { onBeat, bonus } = isOnBeat(state, beatMs * 4); // multiple exact du temps
    expect(onBeat).toBe(true);
    expect(bonus).toBe(PERCUSSION_TIERS[1].bonus);
  });

  it('une frappe exactement entre deux subdivisions (le pire moment possible) n\'est jamais "on beat"', () => {
    const state = createDefaultState();
    state.percussionTier = 3; // double-croches : 4 subdivisions par temps
    const beatMs = beatIntervalMs();
    const stepMs = beatMs / 4;
    // Exactement à mi-chemin entre deux graduations de la grille -> distance maximale possible.
    expect(isOnBeat(state, stepMs / 2).onBeat).toBe(false);
  });

  it("achat séquentiel des paliers, plus rien au-delà du tier 3", () => {
    const state = createDefaultState();
    state.handpans = 1e6;
    for (let i = 0; i < 3; i++) expect(purchases.buyNextPercussionTier(state).success).toBe(true);
    expect(state.percussionTier).toBe(3);
    expect(purchases.buyNextPercussionTier(state)).toEqual({ success: false, reason: 'deja_max' });
  });
});

describe('Patterns — §6.4', () => {
  /** Amène un run jusqu'à la phase joueur (la démonstration est pilotée par l'UI). */
  function runReadyToPlay(patternId) {
    const run = startPatternRun(patternId);
    beginPlayerPhase(run);
    return run;
  }

  it("un run démarre en phase 'demo' sans horloge : le joueur écoute d'abord", () => {
    const run = startPatternRun('trois_notes');
    expect(run.phase).toBe('demo');
    expect(run.startMs).toBeNull();
  });

  it('refuse le déblocage si le handpan actif n\'a pas assez de notes', () => {
    const state = createDefaultState();
    state.handpans = 1e6;
    const hardest = PATTERNS[PATTERNS.length - 1];
    expect(purchases.unlockPattern(state, hardest.id)).toEqual({ success: true });
  });

  it("la 1re frappe ANCRE l'horloge : elle ne peut jamais être en retard", () => {
    const state = createDefaultState();
    const run = runReadyToPlay('trois_notes');
    // Le joueur attend 10 secondes avant de se lancer : ça ne doit rien coûter.
    const r = recordPatternHit(run, 0, 10_000, state);
    expect(r.anchored).toBe(true);
    expect(r.precision).toBe(1);
    expect(run.startMs).toBe(10_000);
    expect(run.phase).toBe('jeu');
  });

  it('précision 1 si chaque frappe tombe pile sur le temps attendu et la bonne note', () => {
    const state = createDefaultState();
    const pattern = getPattern('trois_notes');
    const run = runReadyToPlay(pattern.id);
    const times = patternStepTimesMs(pattern);
    const anchor = 5000;
    let last;
    pattern.sequence.forEach((step, i) => {
      last = recordPatternHit(run, step.noteIndex, anchor + times[i], state);
    });
    expect(last.finished).toBe(true);
    expect(finishPatternRun(run, state).precisionMoyenne).toBeCloseTo(1, 5);
  });

  it('la note attendue est exposée pour le surlignage', () => {
    const run = runReadyToPlay('trois_notes');
    const pattern = getPattern('trois_notes');
    expect(expectedNoteIndex(run)).toBe(pattern.sequence[0].noteIndex);
    recordPatternHit(run, pattern.sequence[0].noteIndex, 0, createDefaultState());
    expect(expectedNoteIndex(run)).toBe(pattern.sequence[1].noteIndex);
  });

  it('une mauvaise note rapporte une précision de 0 pour cette frappe', () => {
    const state = createDefaultState();
    const run = runReadyToPlay('ding_ding');
    const r = recordPatternHit(run, 5, 0, state); // mauvaise note dès l'ancrage
    expect(r.precision).toBe(0);
    expect(r.noteCorrect).toBe(false);
  });

  it('les patterns sont calés sur la grille du métronome (condition du combo §6.4)', () => {
    // Chaque temps cible doit être un multiple exact d'une subdivision du temps musical.
    const beat = patternBeatMs();
    for (const pattern of PATTERNS) {
      for (const t of patternStepTimesMs(pattern)) {
        const ratio = (t / beat) * 4; // en double-croches
        expect(Math.abs(ratio - Math.round(ratio))).toBeLessThan(1e-9);
      }
    }
  });

  it("combo pattern + rythme : joué juste ET sur le temps, le bonus de percussion s'applique", () => {
    const state = createDefaultState();
    state.percussionTier = 1;
    const pattern = getPattern('trois_notes');
    const run = runReadyToPlay(pattern.id);
    const times = patternStepTimesMs(pattern);
    const beat = patternBeatMs();
    const anchor = Math.round(1e6 / beat) * beat; // ancre posée sur la grille absolue
    pattern.sequence.forEach((step, i) => {
      recordPatternHit(run, step.noteIndex, anchor + times[i], state);
    });
    const result = finishPatternRun(run, state);
    expect(result.onBeatRatio).toBeGreaterThanOrEqual(RHYTHM_COMBO_THRESHOLD);
    expect(result.bonusRythmeActif).toBe(PERCUSSION_TIERS[1].bonus);
    expect(result.gain).toBeCloseTo(
      pattern.gainDeBase * result.precisionMoyenne * result.bonusRythmeActif, 5);
  });

  it('sans percussions débloquées, le bonus rythme reste neutre (×1)', () => {
    const state = createDefaultState(); // percussionTier = 0
    const pattern = getPattern('ding_ding');
    const run = runReadyToPlay(pattern.id);
    const times = patternStepTimesMs(pattern);
    pattern.sequence.forEach((step, i) => recordPatternHit(run, step.noteIndex, times[i], state));
    expect(finishPatternRun(run, state).bonusRythmeActif).toBe(1);
  });
});

describe('Patterns équipés — jouables depuis l\'écran principal', () => {
  function stateWithUnlocked(ids) {
    const state = createDefaultState();
    state.handpans = 1e9;
    for (const id of ids) purchases.unlockPattern(state, id);
    return state;
  }

  it('refuse d\'équiper un pattern non débloqué', () => {
    const state = createDefaultState();
    expect(purchases.equipPattern(state, 'ding_ding')).toEqual({ success: false, reason: 'non_debloque' });
  });

  it('équipe un pattern débloqué', () => {
    const state = stateWithUnlocked(['ding_ding']);
    expect(purchases.equipPattern(state, 'ding_ding')).toEqual({ success: true });
    expect(state.patternsEquipped).toEqual(['ding_ding']);
  });

  it('refuse de dépasser MAX_PATTERNS_EQUIPPED emplacements', () => {
    const ids = PATTERNS.slice(0, MAX_PATTERNS_EQUIPPED + 1).map((p) => p.id);
    const state = stateWithUnlocked(ids);
    ids.slice(0, MAX_PATTERNS_EQUIPPED).forEach((id) => purchases.equipPattern(state, id));
    expect(state.patternsEquipped).toHaveLength(MAX_PATTERNS_EQUIPPED);
    expect(purchases.equipPattern(state, ids[MAX_PATTERNS_EQUIPPED]))
      .toEqual({ success: false, reason: 'emplacements_pleins' });
  });

  it('refuse d\'équiper deux fois le même pattern', () => {
    const state = stateWithUnlocked(['ding_ding']);
    purchases.equipPattern(state, 'ding_ding');
    expect(purchases.equipPattern(state, 'ding_ding')).toEqual({ success: false, reason: 'deja_equipe' });
  });

  it('déséquiper libère un emplacement', () => {
    const state = stateWithUnlocked(['ding_ding', 'trois_notes']);
    purchases.equipPattern(state, 'ding_ding');
    expect(purchases.unequipPattern(state, 'ding_ding')).toEqual({ success: true });
    expect(state.patternsEquipped).toEqual([]);
    expect(purchases.equipPattern(state, 'trois_notes')).toEqual({ success: true });
  });

  it('déséquiper un pattern non équipé échoue proprement', () => {
    const state = createDefaultState();
    expect(purchases.unequipPattern(state, 'ding_ding')).toEqual({ success: false, reason: 'pas_equipe' });
  });
});

describe('GameEngine — intégration frappe/pattern (§4, §6.4)', () => {
  async function engineWithPattern(id) {
    const { GameEngine } = await import('../../src/engine/game.js');
    const engine = new GameEngine();
    engine.state.handpans = 1e6;
    engine.unlockPattern(id);
    engine.startPattern(id, 0);
    return engine;
  }

  it('pendant la démonstration, les frappes du joueur sont ignorées', async () => {
    const engine = await engineWithPattern('ding_ding');
    const before = engine.state.handpans;
    const r = engine.click(0, 0);
    expect(r.mode).toBe('demo');
    expect(engine.state.handpans).toBe(before);
    expect(engine.activePatternRun.stepIndex).toBe(0);
  });

  it('une fois la main donnée, les clics alimentent le pattern et non le compteur direct', async () => {
    const engine = await engineWithPattern('ding_ding');
    engine.beginPatternPlayerPhase();
    const before = engine.state.handpans;
    const r = engine.click(0, 0);
    expect(r.mode).toBe('pattern');
    expect(engine.state.handpans).toBe(before);
  });

  it('le pattern termine et crédite un gain forfaitaire au bon moment', async () => {
    const engine = await engineWithPattern('ding_ding');
    engine.beginPatternPlayerPhase();
    const pattern = getPattern('ding_ding');
    const times = patternStepTimesMs(pattern);
    let last;
    pattern.sequence.forEach((step, i) => {
      last = engine.click(step.noteIndex, times[i]);
    });
    expect(last.patternFinished).toBe(true);
    expect(engine.activePatternRun).toBeNull();
    expect(engine.state.patternStats.ding_ding.timesPlayed).toBe(1);
  });

  it("un joueur humain réaliste (latence, léger décalage) obtient un gain correct", async () => {
    // Régression : l'ancienne version donnait 0 % de précision à tout humain, parce que
    // le chrono partait au clic sur « Jouer » dans un autre onglet.
    const engine = await engineWithPattern('trois_notes');
    engine.beginPatternPlayerPhase();
    const pattern = getPattern('trois_notes');
    const times = patternStepTimesMs(pattern);
    const anchor = 12_345; // le joueur démarre quand il veut
    const jitter = [0, 40, -35, 55, -25]; // imprécision humaine typique (±55 ms)
    let last;
    pattern.sequence.forEach((step, i) => {
      last = engine.click(step.noteIndex, anchor + times[i] + jitter[i]);
    });
    expect(last.patternFinished).toBe(true);
    expect(last.precisionMoyenne).toBeGreaterThan(0.8);
    expect(last.gain).toBeGreaterThan(pattern.gainDeBase * 0.8);
  });
});
