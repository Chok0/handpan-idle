// Conversion nom de note (notation anglo-saxonne, ex. "D3", "C#4", "Bb3") -> fréquence réelle.
// Référence : A4 = 440 Hz (tempérament égal), cohérent avec l'accordage réel des handpans.

const SEMITONE_FROM_C = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

const A4_ABSOLUTE_SEMITONE = 4 * 12 + 9; // octave 4, A

/**
 * @param {string} note - ex. "D3", "C#4", "Bb3"
 * @returns {number} fréquence en Hz
 */
export function noteToFrequency(note) {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(note);
  if (!m) throw new Error(`Note invalide : "${note}"`);
  const [, letter, accidental, octaveStr] = m;
  const key = letter + (accidental || '');
  const semitoneFromC = SEMITONE_FROM_C[key];
  if (semitoneFromC === undefined) throw new Error(`Note invalide : "${note}"`);
  const octave = parseInt(octaveStr, 10);
  const absoluteSemitone = octave * 12 + semitoneFromC;
  const n = absoluteSemitone - A4_ABSOLUTE_SEMITONE;
  return 440 * Math.pow(2, n / 12);
}
