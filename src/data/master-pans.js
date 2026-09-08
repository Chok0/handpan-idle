// Handpans maîtres — §6.1 du GDD.
// Espace combinatoire modèle × tonalité × gamme × nb de notes, inspiré des vraies gammes
// fabriquées par Mistral Pans (voir js/data/scales-data.js du site) mais gardé autonome
// (pas de dépendance à un système de nomenclature externe, cf. GDD §6.1) et stylisé pour
// le jeu : certains handpans "maîtres" ont plus de notes que leurs équivalents réels
// (abstraction volontaire, voir DECISIONS.md).
//
// note_value_base progresse en gros ×1.6 à ×1.8 par palier pour rester cohérent avec la
// courbe de coûts du jeu (bâtiments jusqu'à 40M, Accordage Ultime à partir de 5Md).

export const MASTER_PANS = [
  {
    id: 'kurd9',
    label: 'D Kurd (9 notes)',
    gamme: 'Kurd',
    tonalite: 'D3',
    notes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
    noteValueBase: 1,
    cost: 0, // handpan de départ
    productUrl: 'https://mistralpans.fr/boutique',
  },
  {
    id: 'kurd10',
    label: 'D Kurd (10 notes)',
    gamme: 'Kurd',
    tonalite: 'D3',
    notes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4'],
    noteValueBase: 2,
    cost: 2500,
    productUrl: null,
  },
  {
    id: 'amara9',
    label: 'D Amara (9 notes)',
    gamme: 'Amara',
    tonalite: 'D3',
    notes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'],
    noteValueBase: 4,
    cost: 8000,
    productUrl: 'https://mistralpans.fr/boutique',
  },
  {
    id: 'amara11',
    label: 'D Amara (11 notes)',
    gamme: 'Amara',
    tonalite: 'D3',
    notes: ['D3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5', 'D5', 'E5'],
    noteValueBase: 7,
    cost: 25000,
    productUrl: null,
  },
  {
    id: 'sabye9',
    label: 'C Sabye (9 notes)',
    gamme: 'Sabye',
    tonalite: 'C3',
    notes: ['C3', 'G3', 'Ab3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4'],
    noteValueBase: 12,
    cost: 75000,
    productUrl: null,
  },
  {
    id: 'celticminor10',
    label: 'E Celtic Minor (10 notes)',
    gamme: 'Celtic Minor',
    tonalite: 'E3',
    notes: ['E3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5'],
    noteValueBase: 20,
    cost: 200000,
    productUrl: null,
  },
  {
    id: 'hijaz9',
    label: 'D Hijaz (9 notes)',
    gamme: 'Hijaz',
    tonalite: 'D3',
    notes: ['D3', 'A3', 'Bb3', 'C#4', 'D4', 'E4', 'F4', 'G4', 'A4'],
    noteValueBase: 32,
    cost: 600000,
    productUrl: 'https://mistralpans.fr/boutique',
  },
  {
    id: 'annaziska11',
    label: 'F Annaziska (11 notes)',
    gamme: 'Annaziska',
    tonalite: 'F3',
    notes: ['F3', 'Ab3', 'Bb3', 'C4', 'Db4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
    noteValueBase: 50,
    cost: 1_800_000,
    productUrl: null,
  },
  {
    id: 'pygmy9',
    label: 'A Pygmy (9 notes)',
    gamme: 'Pygmy',
    tonalite: 'A2',
    notes: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4'],
    noteValueBase: 80,
    cost: 5_000_000,
    productUrl: null,
  },
  {
    id: 'kurd12deluxe',
    label: 'D Kurd Deluxe (12 notes) — Signature Mistral Pans',
    gamme: 'Kurd',
    tonalite: 'D3',
    notes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5'],
    noteValueBase: 130,
    cost: 20_000_000,
    productUrl: 'https://mistralpans.fr/boutique',
  },
  {
    id: 'celestial13',
    label: 'Accordage Céleste (13 notes)',
    gamme: 'Céleste',
    tonalite: 'D3',
    notes: ['D3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5'],
    noteValueBase: 220,
    cost: 100_000_000,
    productUrl: null,
  },
];

export function getMasterPan(id) {
  const pan = MASTER_PANS.find((p) => p.id === id);
  if (!pan) throw new Error(`Handpan maître inconnu : "${id}"`);
  return pan;
}

export const STARTER_MASTER_PAN_ID = 'kurd9';
