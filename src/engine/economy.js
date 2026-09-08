// Formules de coût + formatage des grands nombres. Pur, sans état, testé unitairement.
import { COST_GROWTH } from '../data/balance-constants.js';

/**
 * coût(n) = base * growth^n, où n = nombre déjà possédé de cet objet précis.
 * Arrondi au ♫ supérieur pour ne jamais permettre un achat "gratuit" par troncature.
 */
export function cost(base, n, growth = COST_GROWTH) {
  return Math.ceil(base * Math.pow(growth, n));
}

/**
 * Plafond de sécurité numérique (pas un plafond de jeu). Le GDD spécifie ~7 multiplicateurs
 * de production indépendants qui se cumulent (bâtiments niveau 2/3 + Hydro formeuse + Presse
 * hydraulique, chacun en `mult^n`) — leurs exposants s'additionnent en espace log, et une
 * simulation accélérée (tests/simulation/run-simulation.mjs) a montré qu'un joueur assidu
 * dépasse la limite d'un `double` (~1.8e308) en quelques centaines d'exemplaires de chaque,
 * ce qui transforme la production en `Infinity` et corrompt la sauvegarde. `SAFE_MAX` reste
 * astronomiquement au-delà de tout contenu du jeu (aucun coût ni jalon ne s'en approche) :
 * il n'écrête jamais une partie normale, seulement l'overflow flottant.
 */
export const SAFE_MAX = 1e300;

export function clampFinite(value, max = SAFE_MAX) {
  if (!Number.isFinite(value)) return max;
  return Math.min(value, max);
}

const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
];

/**
 * Formate un nombre pour l'affichage façon idle game : 1234 -> "1.23K", 2.5e9 -> "2.50B".
 * Au-delà de la liste de suffixes, bascule en notation scientifique plutôt que planter.
 */
export function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs < 1000) {
    return sign + (Number.isInteger(abs) ? String(abs) : abs.toFixed(2));
  }

  const tier = Math.floor(Math.log10(abs) / 3);
  if (tier < SUFFIXES.length) {
    const scaled = abs / Math.pow(1000, tier);
    return `${sign}${scaled.toFixed(2)}${SUFFIXES[tier]}`;
  }

  return sign + abs.toExponential(2);
}

/** Récupère la valeur d'une métrique de progression nommée (utilisé par les seuils génériques). */
export function getMetricValue(state, metric) {
  switch (metric) {
    case 'totalHandpansMade':
      return state.totalHandpansMade;
    case 'totalClicks':
      return state.totalClicks;
    case 'totalEmployees':
      return Object.values(state.employees).reduce((a, b) => a + b, 0);
    case 'masterPansOwnedCount':
      return state.masterPansUnlocked.length;
    default:
      throw new Error(`Métrique inconnue : "${metric}"`);
  }
}
