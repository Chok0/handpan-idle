// Améliorations génériques — §7 du GDD.
// "~30-40 améliorations génériques, générées à partir d'un template {catégorie, seuil, effet}
// plutôt qu'écrites une par une." Ce fichier EST le générateur : GENERIC_UPGRADES est calculé
// une fois au chargement du module à partir de 4 catégories de seuils.
//
// Chaque amélioration multiplie note_value globalement (effet multiplicatif, cumulé avec les
// autres améliorations génériques ET avec les handpans maîtres — cf. src/engine/production.js).
// Les coûts sont des ordres de grandeur raisonnables par rapport à l'économie du jeu ; ils sont
// candidats de premier choix pour l'ajustement par simulation accélérée (Phase 8 du GDD §11).

function buildTier({ categorie, metric, seuil, effetMult, cost, label }) {
  return {
    id: `${categorie}_${seuil}`,
    categorie,
    label,
    seuil: { metric, value: seuil },
    effet: { type: 'note_value_mult', value: effetMult },
    cost: Math.round(cost),
  };
}

function generateCategory({ categorie, metric, thresholds, effetMult, baseCost, growth, labelFn }) {
  return thresholds.map((seuil, i) =>
    buildTier({
      categorie,
      metric,
      seuil,
      effetMult,
      cost: baseCost * Math.pow(growth, i),
      label: labelFn(seuil),
    })
  );
}

const CATEGORIES = [
  {
    categorie: 'production_vie',
    metric: 'totalHandpansMade',
    thresholds: [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10],
    effetMult: 1.15,
    baseCost: 200,
    growth: 10, // suit directement l'échelle des seuils (x10 à chaque palier)
    labelFn: (s) => `Production à vie : ${s.toLocaleString('fr-FR')} fabriqués`,
  },
  {
    categorie: 'employes',
    metric: 'totalEmployees',
    thresholds: [5, 10, 15, 20, 25, 30, 35, 40, 50, 65],
    effetMult: 1.1,
    baseCost: 200,
    growth: 3,
    labelFn: (s) => `Effectif : ${s} employés`,
  },
  {
    categorie: 'master_pans',
    metric: 'masterPansOwnedCount',
    thresholds: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    effetMult: 1.2,
    baseCost: 3000,
    growth: 2,
    labelFn: (s) => `Collection : ${s} handpans maîtres`,
  },
  {
    categorie: 'clics',
    metric: 'totalClicks',
    thresholds: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
    effetMult: 1.05,
    baseCost: 50,
    growth: 2.5,
    labelFn: (s) => `Endurance : ${s.toLocaleString('fr-FR')} frappes`,
  },
];

export function generateGenericUpgrades() {
  return CATEGORIES.flatMap((cat) => generateCategory(cat));
}

export const GENERIC_UPGRADES = generateGenericUpgrades();
