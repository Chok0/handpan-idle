// Mise en contexte et jalons narratifs.
//
// Le jeu s'ouvrait sur un disque gris posé dans le vide, sans une ligne pour dire où l'on
// est ni quoi faire. Ces textes posent la scène (on est un facteur de handpans qui démarre)
// et accompagnent la progression : chaque jalon se déclenche une seule fois, quand sa
// condition devient vraie, et ponctue une étape que le joueur vient réellement de franchir.
//
// Ton : atelier artisanal, sobre, jamais bavard. Deux ou trois phrases maximum.

export const INTRO = {
  title: 'Votre premier atelier',
  text:
    "Un placard, une tôle d'acier et un marteau. C'est tout ce qu'il faut pour commencer — "
    + "le reste, c'est de l'oreille et des heures. Frappez une note : chaque handpan que vous "
    + 'faites chanter en appelle un autre.',
  cta: 'Frapper la première note',
};

/**
 * Jalons. `when(state)` est évalué à chaque tick ; le premier non vu dont la condition est
 * vraie s'affiche. L'ordre du tableau départage les égalités.
 */
export const STORY_BEATS = [
  {
    id: 'premier_employe',
    title: 'Vous n\'êtes plus seul',
    text:
      "Un apprenti pousse la porte du placard. Il ne sait pas encore accorder, mais il sait "
      + 'marteler — et pendant qu\'il martèle, vous pouvez faire autre chose. L\'atelier '
      + 'produit désormais même quand vous ne frappez pas.',
    when: (s) => s.employees.apprenti >= 1,
  },
  {
    id: 'cave',
    title: 'De l\'air, enfin',
    text:
      'La cave est humide, mais on y tient à huit et le son y porte mieux. Les voisins, eux, '
      + 'apprécient modérément.',
    when: (s) => s.buildings.niveau1Stage >= 1,
  },
  {
    id: 'premier_marteau',
    title: 'La main et l\'outil',
    text:
      'Un bon marteau ne fabrique rien tout seul : il démultiplie ceux qui s\'en servent. '
      + 'Plus votre équipe grandit, plus chacune de vos frappes pèse lourd.',
    when: (s) => s.tools.marteau >= 1 && s.employees.apprenti >= 1,
  },
  {
    id: 'garage',
    title: 'Un vrai établi',
    text:
      "Le garage a une porte qui ferme et une prise de courant. C'est le moment de recruter "
      + 'des ouvriers, et de regarder du côté des machines.',
    when: (s) => s.buildings.niveau1Stage >= 2,
  },
  {
    id: 'second_pan',
    title: 'Une deuxième voix',
    text:
      "Deux instruments, deux gammes, deux humeurs. On ne fabrique pas de la même façon selon "
      + 'ce qu\'on veut entendre — et chaque nouvelle gamme fait monter la valeur de votre frappe.',
    when: (s) => s.masterPansUnlocked.length >= 2,
  },
  {
    id: 'percussions',
    title: 'Le temps se met à compter',
    text:
      'Un métronome discret marque désormais la pulsation. Frappez dessus plutôt qu\'à côté : '
      + 'le geste juste vaut plus que le geste rapide.',
    when: (s) => s.percussionTier >= 1,
  },
  {
    id: 'premier_pattern',
    title: 'Vous jouez, vous ne tapez plus',
    text:
      'Un motif appris est un motif qui rapporte. Écoutez-le d\'abord, reproduisez-le ensuite — '
      + 'et si vous tombez sur le temps, les deux bonus se multiplient.',
    when: (s) => s.patternsUnlocked.length >= 1,
  },
  {
    id: 'niveau3',
    title: 'Ce n\'est plus un atelier',
    text:
      "Usine, entrepôt, boutique. Vous ne fabriquez plus des handpans : vous fabriquez de quoi "
      + 'en fabriquer. Les accordeurs peuvent enfin être formés.',
    when: (s) => s.buildings.usine + s.buildings.entrepot + s.buildings.boutique >= 1,
  },
  {
    id: 'master_tuner',
    title: 'Un maître accordeur',
    text:
      "Il entend les harmoniques que personne d'autre ne perçoit et corrige d'un geste ce que "
      + "les autres cherchent une heure. À ce niveau-là, l'accordage devient un art — et le "
      + 'vôtre peut encore être poussé plus loin.',
    when: (s) => s.employees.master_tuner >= 1,
  },
];

/** Premier jalon non encore vu dont la condition est remplie, ou null. */
export function findPendingBeat(state, seenIds) {
  return STORY_BEATS.find((beat) => !seenIds.includes(beat.id) && beat.when(state)) ?? null;
}
