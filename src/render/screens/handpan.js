// Écran Handpan (§9.3) — handpans maîtres, améliorateurs de clic passifs, percussions,
// carnet de patterns, améliorations transverses (§7) + Accordage Ultime. Fonction pure.
import { MASTER_PANS, getMasterPan } from '../../data/master-pans.js';
import { PASSIVE_CLICK_UPGRADES, PERCUSSION_TIERS, ACCORDAGE_ULTIME } from '../../data/balance-constants.js';
import { PATTERNS } from '../../data/patterns.js';
import { GENERIC_UPGRADES } from '../../data/generic-upgrades.js';
import { formatNumber, getMetricValue } from '../../engine/economy.js';
import { isAccordageUltimeUnlocked } from '../../engine/unlocks.js';
import * as purchases from '../../engine/purchases.js';

function buyBtn({ action, id = '', price, label, affordable, extraDisabled = false, secondary = false }) {
  const disabled = !affordable || extraDisabled;
  const cls = secondary ? 'buy-btn buy-btn--secondary' : 'buy-btn';
  return `<button class="${cls}" data-action="${action}" data-id="${id}" ${disabled ? 'disabled' : ''}>${label} — ${formatNumber(price)} ♫</button>`;
}

function renderMasterPans(state) {
  const cards = MASTER_PANS.map((pan) => {
    const owned = state.masterPansUnlocked.includes(pan.id);
    const active = state.activeMasterPan === pan.id;
    let actionsHtml;
    if (!owned) {
      actionsHtml = buyBtn({ action: 'unlock-masterpan', id: pan.id, price: pan.cost, label: 'Débloquer', affordable: state.handpans >= pan.cost });
    } else if (active) {
      actionsHtml = `<span class="shop-card__count">Actif</span>`;
    } else {
      actionsHtml = `<button class="buy-btn buy-btn--secondary" data-action="select-masterpan" data-id="${pan.id}">Utiliser</button>`;
    }
    const productLink = owned && pan.productUrl
      ? `<a href="${pan.productUrl}" target="_blank" rel="noopener" class="shop-card__desc">Voir le vrai modèle en boutique →</a>`
      : '';
    return `
      <div class="shop-card ${active ? 'owned' : ''}">
        <div class="shop-card__title">${pan.label}</div>
        <div class="shop-card__desc">${pan.notes.length} notes · note_value ${formatNumber(pan.noteValueBase)}</div>
        ${productLink}
        ${actionsHtml}
      </div>`;
  }).join('');
  return `<section class="shop-section"><h2>Handpans maîtres</h2><div class="shop-grid">${cards}</div></section>`;
}

function renderPassiveClickUpgrades(state) {
  const cards = PASSIVE_CLICK_UPGRADES.map((u) => {
    const owned = state.passiveClickUpgrades[u.id];
    return `
      <div class="shop-card ${owned ? 'owned' : ''}">
        <div class="shop-card__title">${u.label}</div>
        <div class="shop-card__desc">+${Math.round(u.bonusPct * 100)}% note_value en continu</div>
        ${owned ? '<span class="shop-card__count">Actif</span>' : buyBtn({ action: 'buy-passive', id: u.id, price: u.cost, label: 'Acheter', affordable: state.handpans >= u.cost })}
      </div>`;
  }).join('');
  return `<section class="shop-section"><h2>Améliorateurs de clic passifs</h2><div class="shop-grid">${cards}</div></section>`;
}

function renderPercussions(state) {
  const current = PERCUSSION_TIERS[state.percussionTier];
  const next = PERCUSSION_TIERS[state.percussionTier + 1];
  const nextHtml = next
    ? buyBtn({ action: 'buy-percussion-tier', price: next.cost, label: `Débloquer : ${next.label}`, affordable: state.handpans >= next.cost })
    : '<em>Palier maximal atteint</em>';
  return `<section class="shop-section">
    <h2>Percussions</h2>
    <div class="shop-card owned">
      <div class="shop-card__title">${current.label}</div>
      <div class="shop-card__desc">Bonus au clic sur le temps : ×${current.bonus}</div>
      ${nextHtml}
    </div>
  </section>`;
}

function renderPatterns(state, now) {
  const activePan = getMasterPan(state.activeMasterPan);
  const cards = PATTERNS.map((p) => {
    const unlocked = state.patternsUnlocked.includes(p.id);
    const hasEnoughNotes = p.notesRequisesIndex.every((i) => i < activePan.notes.length);
    let actionHtml;
    if (!unlocked) {
      actionHtml = hasEnoughNotes
        ? buyBtn({ action: 'unlock-pattern', id: p.id, price: p.coutDeblocage, label: 'Débloquer', affordable: state.handpans >= p.coutDeblocage })
        : `<em class="shop-card__desc">Nécessite un handpan à ${Math.max(...p.notesRequisesIndex) + 1}+ notes</em>`;
    } else {
      const stats = state.patternStats[p.id];
      const remainingCooldownMs = stats?.lastPlayedAt ? stats.lastPlayedAt + p.cooldownS * 1000 - now : 0;
      const onCooldown = remainingCooldownMs > 0;
      actionHtml = `<button class="buy-btn" data-action="play-pattern" data-id="${p.id}" ${onCooldown ? 'disabled' : ''}>
        ${onCooldown ? `Repos (${Math.ceil(remainingCooldownMs / 1000)}s)` : 'Jouer'}
      </button>`;
    }
    const stats = state.patternStats[p.id];
    const bestPrecision = stats ? `${Math.round(stats.bestPrecision * 100)}%` : '—';
    return `
      <div class="shop-card ${unlocked ? 'owned' : ''}">
        <div class="shop-card__title">${p.nom}</div>
        <div class="shop-card__desc">Difficulté ${p.difficulte} · Gain de base ${formatNumber(p.gainDeBase)} ♫ · Meilleure précision : ${bestPrecision}</div>
        ${actionHtml}
      </div>`;
  }).join('');
  return `<section class="shop-section"><h2>Carnet de partitions</h2><div class="shop-grid">${cards}</div></section>`;
}

function renderGenericUpgrades(state) {
  const byCategory = new Map();
  for (const u of GENERIC_UPGRADES) {
    if (!byCategory.has(u.categorie)) byCategory.set(u.categorie, []);
    byCategory.get(u.categorie).push(u);
  }
  const blocks = [...byCategory.entries()].map(([categorie, upgrades]) => {
    const items = upgrades.map((u) => {
      const owned = state.genericUpgradesBought.includes(u.id);
      const value = getMetricValue(state, u.seuil.metric);
      const thresholdMet = value >= u.seuil.value;
      const action = owned
        ? '<span class="shop-card__count">Acquis</span>'
        : buyBtn({ action: 'buy-generic', id: u.id, price: u.cost, label: 'Acheter', affordable: state.handpans >= u.cost, extraDisabled: !thresholdMet });
      return `
        <div class="shop-card ${owned ? 'owned' : !thresholdMet ? 'locked' : ''}">
          <div class="shop-card__title">${u.label}</div>
          <div class="shop-card__desc">×${u.effet.value} note_value</div>
          ${action}
        </div>`;
    }).join('');
    const doneCount = upgrades.filter((u) => state.genericUpgradesBought.includes(u.id)).length;
    return `<details ${doneCount < upgrades.length ? 'open' : ''}>
      <summary>${categorie} (${doneCount}/${upgrades.length})</summary>
      <div class="shop-grid">${items}</div>
    </details>`;
  }).join('');
  return `<section class="shop-section"><h2>Améliorations transverses</h2>${blocks}</section>`;
}

function renderAccordageUltime(state) {
  const unlocked = isAccordageUltimeUnlocked(state);
  if (!unlocked) return '';
  const price = purchases.accordageUltimeCost(state);
  return `<section class="shop-section">
    <h2>Accordage Ultime</h2>
    <div class="shop-card owned">
      <div class="shop-card__title">Accordage Ultime — ${state.accordageUltimeCount} fois</div>
      <div class="shop-card__desc">+${Math.round(ACCORDAGE_ULTIME.bonusPct * 100)}% de production globale permanente par achat, sans reset</div>
      ${buyBtn({ action: 'buy-ultimate', price, label: 'Accorder', affordable: state.handpans >= price })}
    </div>
  </section>`;
}

export function renderHandpanScreen(engine, now = Date.now()) {
  const state = engine.state;
  return [
    renderMasterPans(state),
    renderPassiveClickUpgrades(state),
    renderPercussions(state),
    renderPatterns(state, now),
    renderGenericUpgrades(state),
    renderAccordageUltime(state),
  ].join('\n');
}
