// Patterns (mélodies) — §6.4 du GDD.
// Une séquence de zones à reproduire (motif moteur/rythmique), pas un jeu de reconnaissance
// de hauteur : `note_id` référence l'index de la note sur le handpan maître actif au moment
// de l'achat (les 2-3 premiers indices existent sur tous les pans du jeu, y compris le
// starter à 9 notes, donc les patterns restent jouables même sur les petits pans requis).
//
// `sequence[].t` = temps cible en ms depuis le début du pattern (tempo propre au pattern,
// indépendant du métronome des Percussions — mais un bonus rythme actif s'applique en plus,
// cf. §6.4 "combo pattern + rythme").

export const PATTERNS = [
  {
    id: 'ding_ding',
    nom: 'Premier appel',
    notesRequisesIndex: [0],
    sequence: [
      { noteIndex: 0, t: 0 },
      { noteIndex: 0, t: 500 },
      { noteIndex: 0, t: 1000 },
    ],
    difficulte: 1,
    gainDeBase: 25,
    coutDeblocage: 100,
    cooldownS: 5,
  },
  {
    id: 'trois_notes',
    nom: 'Berceuse à trois notes',
    notesRequisesIndex: [0, 1, 2],
    sequence: [
      { noteIndex: 0, t: 0 },
      { noteIndex: 1, t: 450 },
      { noteIndex: 2, t: 900 },
      { noteIndex: 1, t: 1350 },
      { noteIndex: 0, t: 1800 },
    ],
    difficulte: 2,
    gainDeBase: 80,
    coutDeblocage: 320,
    cooldownS: 8,
  },
  {
    id: 'zigzag',
    nom: 'Zigzag',
    notesRequisesIndex: [0, 1, 2, 3, 4],
    sequence: [
      { noteIndex: 0, t: 0 },
      { noteIndex: 2, t: 350 },
      { noteIndex: 4, t: 700 },
      { noteIndex: 1, t: 1050 },
      { noteIndex: 3, t: 1400 },
      { noteIndex: 0, t: 1750 },
    ],
    difficulte: 3,
    gainDeBase: 300,
    coutDeblocage: 1200,
    cooldownS: 10,
  },
  {
    id: 'cascade',
    nom: 'Cascade',
    notesRequisesIndex: [0, 1, 2, 3, 4, 5, 6],
    sequence: [
      { noteIndex: 0, t: 0 },
      { noteIndex: 1, t: 250 },
      { noteIndex: 2, t: 500 },
      { noteIndex: 3, t: 750 },
      { noteIndex: 4, t: 1000 },
      { noteIndex: 5, t: 1250 },
      { noteIndex: 6, t: 1500 },
      { noteIndex: 0, t: 1900 },
    ],
    difficulte: 4,
    gainDeBase: 1200,
    coutDeblocage: 4800,
    cooldownS: 12,
  },
  {
    id: 'ronde_complete',
    nom: 'Ronde complète',
    notesRequisesIndex: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    sequence: [
      { noteIndex: 0, t: 0 },
      { noteIndex: 1, t: 220 },
      { noteIndex: 2, t: 440 },
      { noteIndex: 3, t: 660 },
      { noteIndex: 4, t: 880 },
      { noteIndex: 5, t: 1100 },
      { noteIndex: 6, t: 1320 },
      { noteIndex: 7, t: 1540 },
      { noteIndex: 8, t: 1760 },
      { noteIndex: 0, t: 2100 },
    ],
    difficulte: 5,
    gainDeBase: 6000,
    coutDeblocage: 24000,
    cooldownS: 15,
  },
  {
    id: 'virtuose',
    nom: 'Virtuose',
    notesRequisesIndex: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    sequence: [
      { noteIndex: 0, t: 0 }, { noteIndex: 3, t: 180 }, { noteIndex: 1, t: 360 },
      { noteIndex: 5, t: 540 }, { noteIndex: 2, t: 720 }, { noteIndex: 7, t: 900 },
      { noteIndex: 4, t: 1080 }, { noteIndex: 8, t: 1260 }, { noteIndex: 6, t: 1440 },
      { noteIndex: 0, t: 1700 },
    ],
    difficulte: 6,
    gainDeBase: 40000,
    coutDeblocage: 160000,
    cooldownS: 20,
  },
];

export function getPattern(id) {
  const p = PATTERNS.find((x) => x.id === id);
  if (!p) throw new Error(`Pattern inconnu : "${id}"`);
  return p;
}
