import { describe, it, expect } from 'vitest';
import { noteToFrequency } from '../../src/data/note-frequency.js';

describe('noteToFrequency', () => {
  it('A4 = 440 Hz (référence)', () => {
    expect(noteToFrequency('A4')).toBeCloseTo(440, 5);
  });

  it('C4 (do central) ≈ 261.63 Hz', () => {
    expect(noteToFrequency('C4')).toBeCloseTo(261.6256, 3);
  });

  it('A3 = 220 Hz (une octave sous A4)', () => {
    expect(noteToFrequency('A3')).toBeCloseTo(220, 5);
  });

  it('A5 = 880 Hz (une octave au-dessus)', () => {
    expect(noteToFrequency('A5')).toBeCloseTo(880, 5);
  });

  it('gère les dièses (C#4) et bémols (Db4) comme enharmoniques identiques', () => {
    expect(noteToFrequency('C#4')).toBeCloseTo(noteToFrequency('Db4'), 10);
  });

  it('Bb3 (bémol) ≈ 233.08 Hz', () => {
    expect(noteToFrequency('Bb3')).toBeCloseTo(233.082, 2);
  });

  it('rejette une note mal formée', () => {
    expect(() => noteToFrequency('H4')).toThrow();
    expect(() => noteToFrequency('C')).toThrow();
  });
});
