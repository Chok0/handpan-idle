import { describe, it, expect } from 'vitest';
import { cost, formatNumber, getMetricValue } from '../../src/engine/economy.js';
import { createDefaultState } from '../../src/engine/state.js';

describe('cost() — §5.2 coût(n) = base × 1.15^n', () => {
  it('coût(0) = base', () => {
    expect(cost(15, 0)).toBe(15);
  });

  it('coût(1) = base × 1.15, arrondi au ♫ supérieur', () => {
    expect(cost(100, 1)).toBe(Math.ceil(115));
  });

  it('croît strictement avec n', () => {
    const c0 = cost(100, 0);
    const c1 = cost(100, 1);
    const c10 = cost(100, 10);
    expect(c1).toBeGreaterThan(c0);
    expect(c10).toBeGreaterThan(c1);
  });

  it('accepte un taux de croissance personnalisé (Accordage Ultime)', () => {
    expect(cost(10, 2, 3)).toBe(90);
  });
});

describe('formatNumber', () => {
  it('nombres < 1000 affichés tels quels', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });

  it('applique les suffixes K/M/B', () => {
    expect(formatNumber(1500)).toBe('1.50K');
    expect(formatNumber(2_500_000)).toBe('2.50M');
    expect(formatNumber(3_000_000_000)).toBe('3.00B');
  });

  it('gère les négatifs', () => {
    expect(formatNumber(-1500)).toBe('-1.50K');
  });

  it('bascule en notation scientifique au-delà de la liste de suffixes', () => {
    const huge = 1e40;
    expect(formatNumber(huge)).toMatch(/e\+/);
  });
});

describe('getMetricValue', () => {
  it('lit chaque métrique utilisée par les seuils génériques', () => {
    const state = createDefaultState();
    state.totalHandpansMade = 42;
    state.totalClicks = 7;
    state.employees = { apprenti: 2, ouvrier: 1, accordeur: 0, master_tuner: 0 };
    state.masterPansUnlocked = ['kurd9', 'kurd10'];

    expect(getMetricValue(state, 'totalHandpansMade')).toBe(42);
    expect(getMetricValue(state, 'totalClicks')).toBe(7);
    expect(getMetricValue(state, 'totalEmployees')).toBe(3);
    expect(getMetricValue(state, 'masterPansOwnedCount')).toBe(2);
  });

  it('lève sur une métrique inconnue', () => {
    expect(() => getMetricValue(createDefaultState(), 'inconnue')).toThrow();
  });
});
