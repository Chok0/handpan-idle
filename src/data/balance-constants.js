// Toutes les constantes d'équilibrage numérique du jeu, au même endroit.
// Valeurs explicitement données par le GDD, sauf mention "(défaut)" -> voir DECISIONS.md
// pour la justification des valeurs choisies en l'absence de spécification.

export const COST_GROWTH = 1.15; // coût(n) = base * 1.15^n, formule générale du jeu

export const TOOLS = {
  marteau: { id: 'marteau', label: 'Marteau', baseCost: 15, bonusPerUnit: 1 },
  marteau_pneumatique: {
    id: 'marteau_pneumatique',
    label: 'Marteau pneumatique',
    baseCost: 10000,
    bonusPerUnit: 10,
    unlock: 'niveau2', // "débloqué à partir du Bâtiment niveau 2"
  },
};

// intervalle en secondes entre deux pans produits par un employé de ce palier (1 pan / X s)
export const EMPLOYEE_TIERS = [
  { id: 'apprenti', label: 'Apprenti', interval: 10, directCost: 100, unlock: 'niveau1' },
  {
    id: 'ouvrier', label: 'Ouvrier', interval: 4, directCost: 2000,
    convertFrom: 'apprenti', conversionCost: 1200, unlock: 'niveau2',
  },
  {
    id: 'accordeur', label: 'Accordeur', interval: 1.5, directCost: 50000,
    convertFrom: 'ouvrier', conversionCost: 30000, unlock: 'niveau3',
  },
  {
    id: 'master_tuner', label: 'Master Tuner', interval: 0.4, directCost: 1_200_000,
    convertFrom: 'accordeur', conversionCost: 720_000, unlock: 'niveau3plus',
  },
];

// Niveau 1 : évolution séquentielle d'un slot unique (le joueur solo)
export const BUILDINGS_NIVEAU1 = [
  { id: 'placard', label: 'Placard clandestin', cost: 0, employeesMax: 3, globalMult: 1 },
  { id: 'cave', label: 'Cave', cost: 5000, employeesMax: 8, globalMult: 1.2 },
  { id: 'garage', label: 'Garage', cost: 50000, employeesMax: 15, globalMult: 1.5 },
];

// Niveau 2/3 : bâtiments achetables en plusieurs exemplaires, coût(n) = base * 1.15^n
export const BUILDINGS_NIVEAU2 = [
  { id: 'atelier', label: 'Atelier', baseCost: 200_000, employeesMaxPer: 5, multPer: 1.1 },
  { id: 'showroom', label: 'Showroom', baseCost: 500_000, employeesMaxPer: 5, multPer: 1.15 },
];

export const BUILDINGS_NIVEAU3 = [
  { id: 'usine', label: 'Usine', baseCost: 10_000_000, employeesMaxPer: 10, multPer: 1.2 },
  { id: 'entrepot', label: 'Entrepôt', baseCost: 20_000_000, employeesMaxPer: 15, multPer: 1.1 },
  { id: 'boutique', label: 'Boutique', baseCost: 40_000_000, employeesMaxPer: 10, multPer: 1.25 },
];

// Seuil (défaut, voir DECISIONS.md) : niveau 3 débloqué quand au moins 1 Atelier ET 1 Showroom possédés.
export const NIVEAU3_UNLOCK_REQUIRES = { atelier: 1, showroom: 1 };
// "Master Tuner : palier supérieur du niveau 3" (défaut) : total de bâtiments niveau 3 >= ce seuil.
export const NIVEAU3_PALIER_SUPERIEUR_COUNT = 10;

export const MULTIPLIERS = {
  hydro_formeuse: {
    id: 'hydro_formeuse', label: 'Hydro formeuse', baseCost: 1_000_000, mult: 1.5, unlock: 'niveau2',
  },
  presse_hydraulique: {
    id: 'presse_hydraulique', label: 'Presse hydraulique', baseCost: 50_000_000, mult: 1.75, unlock: 'niveau3',
  },
};

export const METRONOME_BPM = 90; // (défaut)

// bonus = multiplicateur appliqué au clic si la frappe tombe dans la fenêtre de tolérance.
//
// ATTENTION aux tolérances : ce qui compte n'est pas la fenêtre en ms mais la part du temps
// qu'elle couvre (2 × tolérance / écart entre deux graduations). Les valeurs d'origine
// (150/100/60 ms) couvraient 45 %, 60 % puis 72 % de la grille : plus le palier était cher,
// plus il était FACILE de décrocher le bonus en cliquant au hasard — l'inverse de l'intention.
// Ces valeurs redonnent une couverture décroissante (45 % / 39 % / 36 %).
export const PERCUSSION_TIERS = [
  { tier: 0, label: '(base)', subdivision: null, bonus: 1, cost: 0, toleranceMs: 0 },
  { tier: 1, label: 'Percussions — Noires', subdivision: 1, bonus: 1.2, cost: 2000, toleranceMs: 150 },
  { tier: 2, label: 'Percussions — Croches', subdivision: 2, bonus: 1.5, cost: 15000, toleranceMs: 65 },
  { tier: 3, label: 'Percussions — Double-croches', subdivision: 4, bonus: 2, cost: 100_000, toleranceMs: 30 },
];

// bonusPct : bonus additif (les bonus de plusieurs améliorateurs s'additionnent avant d'être appliqués)
export const PASSIVE_CLICK_UPGRADES = [
  { id: 'didgeridoo_drone', label: 'Didgeridoo drone', cost: 5000, bonusPct: 0.10 },
  { id: 'backing_track', label: 'Backing track', cost: 25000, bonusPct: 0.20 },
];

// Amélioration de fin de partie : +5% de production globale permanente par achat, sans reset.
export const ACCORDAGE_ULTIME = {
  baseCost: 5_000_000_000,
  growth: 3, // coût exponentiellement croissant, plus raide que 1.15 (sink de fin de partie)
  bonusPct: 0.05,
  unlockRequires: { employeeTier: 'master_tuner', count: 1 },
};
