// Écran Handpan (§9.3) — handpans maîtres, améliorateurs de clic passifs, percussions,
// carnet de patterns, améliorations transverses (§7) + Accordage Ultime. Fonction pure.
import { MASTER_PANS, getMasterPan } from '../../data/master-pans.js';
import { PASSIVE_CLICK_UPGRADES, PERCUSSION_TIERS, ACCORDAGE_ULTIME } from '../../data/balance-constants.js';
import { PATTERNS } from '../../data/patterns.js';
import { GENERIC_UPGRADES } from '../../data/generic-upgrades.js';
import { formatNumber, getMetricValue } from '../../engine/economy.js';
import { isAccordageUltimeUnlocked } from '../../engine/unlocks.js';
import * as purchases from '../../engine/purchases.js';
import { panAmount, buyBtn, card, filterPurchasable, acquiredNote } from '../ui-kit.js';

const METRIC_LABELS = {
  totalHandpansMade: 'handpans fabriqués',
  totalClicks: 'frappes',
  totalEmployees: 'employés',
  masterPansOwnedCount: 'handpans maîtres',
};

function renderMasterPans(state) {
  const owned = MASTER_PANS.filter((p) => state.masterPansUnlocked.includes(p.id));
  const locked = MASTER_PANS.filter((p) => !state.masterPansUnlocked.includes(p.id));
  // Les possédés restent visibles (on choisit lequel jouer) ; côté verrouillés, seul le
  // prochain palier est montré — pas les onze d'un coup.
  const nextLocked = locked.slice(0, 1);

  const cards = [...owned, ...nextLocked].map((pan) => {
    const isOwned = state.masterPansUnlocked.includes(pan.id);
    const active = state.activeMasterPan === pan.id;
    let actions;
    if (!isOwned) {
      actions = buyBtn({ action: 'unlock-masterpan', id: pan.id, price: pan.cost, label: 'Acquérir', affordable: state.handpans >= pan.cost });
    } else if (active) {
      actions = '<span class="badge-active">En main</span>';
    } else {
      actions = `<button class="buy-btn buy-btn--secondary" data-action="select-masterpan" data-id="${pan.id}">Prendre en main</button>`;
    }
    const productLink = isOwned && pan.productUrl
      ? `<a href="${pan.productUrl}" target="_blank" rel="noopener" class="card-link">Voir cet instrument en boutique →</a>` : '';
    return card({
      id: `pan-${pan.id}`,
      icon: 'icon-pan',
      title: pan.label,
      subtitle: `${pan.notes.length} notes · ${panAmount(pan.noteValueBase)} par frappe`,
      info: `Gamme ${pan.gamme}, tonalité ${pan.tonalite}. Chaque frappe rapporte `
        + `${formatNumber(pan.noteValueBase)} handpan${pan.noteValueBase >= 2 ? 's' : ''} de base, `
        + `avant marteaux et améliorations.`,
      variant: active ? 'owned' : '',
      actions: actions + productLink,
    });
  }).join('');

  return `<section class="shop-section">
    <h2>Handpans maîtres</h2>
    ${acquiredNote(owned.length, MASTER_PANS.length)}
    <div class="shop-grid">${cards}</div>
  </section>`;
}

function renderPassiveClickUpgrades(state) {
  const { entries, ownedCount, totalCount } = filterPurchasable(PASSIVE_CLICK_UPGRADES, {
    isOwned: (u) => state.passiveClickUpgrades[u.id],
    isAvailable: () => true,
  });
  if (!entries.length) return '';

  const cards = entries.map(({ item: u }) => card({
    id: `passive-${u.id}`,
    icon: 'icon-wave',
    title: u.label,
    subtitle: `+${Math.round(u.bonusPct * 100)} % sur chaque frappe`,
    info: `Ambiance sonore continue qui majore la valeur de chaque frappe de `
      + `${Math.round(u.bonusPct * 100)} %. Les bonus des différents améliorateurs s'additionnent.`,
    actions: buyBtn({ action: 'buy-passive', id: u.id, price: u.cost, label: 'Acheter', affordable: state.handpans >= u.cost }),
  })).join('');

  return `<section class="shop-section">
    <h2>Ambiance</h2>
    ${acquiredNote(ownedCount, totalCount)}
    <div class="shop-grid">${cards}</div>
  </section>`;
}

function renderPercussions(state) {
  const next = PERCUSSION_TIERS[state.percussionTier + 1];
  const current = PERCUSSION_TIERS[state.percussionTier];
  if (!next) return '';

  return `<section class="shop-section">
    <h2>Percussions</h2>
    <div class="shop-grid">${card({
      id: 'perc',
      icon: 'icon-drum',
      title: next.label,
      subtitle: `Frappe sur le temps : ×${next.bonus}`,
      count: state.percussionTier > 0 ? `Palier actuel : ${current.label} (×${current.bonus})` : '',
      info: `Un métronome discret marque le tempo. Frapper dans la fenêtre de ±${next.toleranceMs} ms `
        + `autour d'une graduation multiplie le gain par ${next.bonus}. Plus le palier est élevé, `
        + `plus la grille est fine et la fenêtre étroite.`,
      actions: buyBtn({ action: 'buy-percussion-tier', price: next.cost, label: 'Débloquer', affordable: state.handpans >= next.cost }),
    })}</div>
  </section>`;
}

function renderPatterns(state, now) {
  const activePan = getMasterPan(state.activeMasterPan);
  const playable = (p) => p.notesRequisesIndex.every((i) => i < activePan.notes.length);

  const unlocked = PATTERNS.filter((p) => state.patternsUnlocked.includes(p.id));
  const nextLocked = PATTERNS.filter((p) => !state.patternsUnlocked.includes(p.id) && playable(p)).slice(0, 1);

  const cards = [...unlocked, ...nextLocked].map((p) => {
    const isUnlocked = state.patternsUnlocked.includes(p.id);
    const stats = state.patternStats[p.id];
    let actions;
    if (!isUnlocked) {
      actions = buyBtn({ action: 'unlock-pattern', id: p.id, price: p.coutDeblocage, label: 'Apprendre', affordable: state.handpans >= p.coutDeblocage });
    } else {
      const remaining = stats?.lastPlayedAt ? stats.lastPlayedAt + p.cooldownS * 1000 - now : 0;
      const onCooldown = remaining > 0;
      actions = `<button class="buy-btn" data-action="play-pattern" data-id="${p.id}" ${onCooldown ? 'disabled' : ''}>
        ${onCooldown ? `Repos (${Math.ceil(remaining / 1000)} s)` : 'Jouer'}
      </button>`;
    }
    return card({
      id: `pat-${p.id}`,
      icon: 'icon-score',
      title: p.nom,
      subtitle: `${p.sequence.length} notes · jusqu'à ${panAmount(p.gainDeBase)}`,
      count: stats ? `Meilleure exécution : ${Math.round(stats.bestPrecision * 100)} %` : '',
      info: `Le motif vous est d'abord joué, puis c'est à vous de le reproduire — le chronomètre `
        + `ne part qu'à votre première frappe. Le gain vaut ${formatNumber(p.gainDeBase)} handpans `
        + `multipliés par votre précision, et encore par le bonus de percussion si vous jouez sur le temps.`,
      variant: isUnlocked ? 'owned' : '',
      actions,
    });
  }).join('');

  return `<section class="shop-section">
    <h2>Carnet de partitions</h2>
    ${acquiredNote(unlocked.length, PATTERNS.length)}
    <div class="shop-grid">${cards}</div>
  </section>`;
}

function renderGenericUpgrades(state) {
  // Les améliorations forment 4 ÉCHELLES de progression (production à vie, effectif,
  // collection, endurance). Sur une échelle, seule la marche suivante a du sens : on
  // affiche donc la prochaine non acquise de chaque catégorie, plus un aperçu grisé de
  // celle d'après. Afficher les 36 d'un coup — ou même les 13 déjà finançables —
  // transformait la section en menu interminable où trouver la ligne utile était le jeu.
  const byCategory = new Map();
  for (const u of GENERIC_UPGRADES) {
    if (!byCategory.has(u.categorie)) byCategory.set(u.categorie, []);
    byCategory.get(u.categorie).push(u);
  }

  const cards = [];
  let ownedCount = 0;

  for (const upgrades of byCategory.values()) {
    const remaining = upgrades.filter((u) => !state.genericUpgradesBought.includes(u.id));
    ownedCount += upgrades.length - remaining.length;
    const [next, preview] = remaining;
    if (next) cards.push(genericCard(state, next, false));
    if (preview) cards.push(genericCard(state, preview, true));
  }

  if (!cards.length) return '';
  return `<section class="shop-section">
    <h2>Améliorations</h2>
    ${acquiredNote(ownedCount, GENERIC_UPGRADES.length)}
    <div class="shop-grid">${cards.join('')}</div>
  </section>`;
}

function genericCard(state, upgrade, isPreview) {
  const value = getMetricValue(state, upgrade.seuil.metric);
  const thresholdMet = value >= upgrade.seuil.value;
  const metricLabel = METRIC_LABELS[upgrade.seuil.metric] ?? upgrade.seuil.metric;
  const locked = isPreview || !thresholdMet;

  return card({
    id: `gen-${upgrade.id}`,
    icon: 'icon-spark',
    title: upgrade.label,
    subtitle: `Chaque frappe ×${upgrade.effet.value}`,
    // Un aperçu dont le seuil est déjà atteint n'attend pas un palier mais l'achat de
    // l'amélioration précédente : l'annoncer par un seuil déjà franchi serait trompeur.
    count: thresholdMet
      ? (isPreview ? 'Disponible après l\'amélioration précédente' : '')
      : `Se débloque à ${formatNumber(upgrade.seuil.value)} ${metricLabel} · ${formatNumber(value)} atteint${value >= 2 ? 's' : ''}`,
    info: `Multiplie durablement la valeur de chaque frappe par ${upgrade.effet.value}. `
      + `Se cumule avec toutes les autres améliorations de cette section.`,
    variant: locked ? 'locked' : '',
    actions: locked
      ? buyBtn({ action: 'buy-generic', id: upgrade.id, price: upgrade.cost, label: 'Verrouillé', affordable: false, extraDisabled: true })
      : buyBtn({ action: 'buy-generic', id: upgrade.id, price: upgrade.cost, label: 'Acheter', affordable: state.handpans >= upgrade.cost }),
  });
}

function renderAccordageUltime(state) {
  if (!isAccordageUltimeUnlocked(state)) return '';
  const price = purchases.accordageUltimeCost(state);
  return `<section class="shop-section">
    <h2>Accordage Ultime</h2>
    <div class="shop-grid">${card({
      id: 'ultime',
      icon: 'icon-tuning',
      title: 'Accordage Ultime',
      subtitle: `+${Math.round(ACCORDAGE_ULTIME.bonusPct * 100)} % de production, définitivement`,
      count: state.accordageUltimeCount > 0 ? `Réalisé ${state.accordageUltimeCount} fois` : '',
      info: `Chaque accordage ajoute ${Math.round(ACCORDAGE_ULTIME.bonusPct * 100)} % de production `
        + `globale permanente. Aucune remise à zéro : votre progression est conservée. `
        + `Le prix est multiplié par ${ACCORDAGE_ULTIME.growth} à chaque fois.`,
      variant: 'owned',
      actions: buyBtn({ action: 'buy-ultimate', price, label: 'Accorder', affordable: state.handpans >= price }),
    })}</div>
  </section>`;
}

export function renderHandpanScreen(engine, now = Date.now()) {
  const state = engine.state;
  return [
    renderMasterPans(state),
    renderPatterns(state, now),
    renderPercussions(state),
    renderPassiveClickUpgrades(state),
    renderGenericUpgrades(state),
    renderAccordageUltime(state),
  ].join('\n');
}
