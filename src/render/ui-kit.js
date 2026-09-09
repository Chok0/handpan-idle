// Briques d'UI partagées par les écrans Atelier et Handpan : monnaie, cartes, filtrage.
// Centralisé ici pour que les deux écrans restent cohérents et qu'une correction ne se
// fasse qu'à un endroit.
import { formatNumber } from '../engine/economy.js';

/**
 * Montant en handpans, avec l'icône de l'instrument.
 *
 * L'unité du jeu EST un handpan (§3 du GDD) — l'ancien symbole ♫ suggérait une note de
 * musique, et tombait en plus sur une police de secours (glyphe désaligné, émoji couleur
 * dans la barre du haut). L'icône SVG est définie une fois dans index.html.
 */
export function panAmount(value) {
  return `${formatNumber(value)}&nbsp;<svg class="pan-icon" aria-hidden="true"><use href="#icon-pan"/></svg>`;
}

/** Idem, en texte seul (attributs, aria-label, contextes sans HTML). */
export function panAmountText(value) {
  return `${formatNumber(value)} handpans`;
}

export function buyBtn({ action, id = '', price, label, affordable, extraDisabled = false, secondary = false }) {
  const disabled = !affordable || extraDisabled;
  const cls = secondary ? 'buy-btn buy-btn--secondary' : 'buy-btn';
  const reason = extraDisabled ? '' : !affordable ? ' title="Pas assez de handpans"' : '';
  return `<button class="${cls}" data-action="${action}" data-id="${id}"${reason} ${disabled ? 'disabled' : ''}>
    <span class="buy-btn__label">${label}</span>
    <span class="buy-btn__price">${panAmount(price)}</span>
  </button>`;
}

/**
 * Carte d'achat. `info` (formule, détail de calcul) n'est PAS affiché : il est replié
 * derrière un bouton (i) — les formules étalées sur chaque carte noyaient l'information
 * utile (prix, effet) sous du texte technique.
 */
export function card({ id, title, subtitle = '', count = '', info = '', actions = '', variant = '', icon = '' }) {
  const infoBtn = info
    ? `<button class="info-btn" data-info-toggle="${id}" aria-label="Détail du calcul" aria-expanded="false">i</button>`
    : '';
  const infoPanel = info ? `<p class="card-info" data-info-panel="${id}" hidden>${info}</p>` : '';
  // Ligne, pas vignette : depuis le filtrage des listes il ne reste souvent qu'une carte
  // par section, et une grille de vignettes laissait alors les deux tiers de l'écran vides.
  // Colonne de gauche = ce qu'on achète, colonne de droite = l'action.
  const medallion = icon
    ? `<span class="shop-card__icon" aria-hidden="true"><svg><use href="#${icon}"/></svg></span>`
    : '';
  return `
    <div class="shop-card ${variant}${icon ? ' has-icon' : ''}">
      ${medallion}
      <div class="shop-card__main">
        <div class="shop-card__head">
          <span class="shop-card__title">${title}</span>
          ${infoBtn}
        </div>
        ${subtitle ? `<div class="shop-card__desc">${subtitle}</div>` : ''}
        ${count ? `<div class="shop-card__count">${count}</div>` : ''}
      </div>
      <div class="shop-card__aside">${actions}</div>
      ${infoPanel}
    </div>`;
}

/**
 * Ne garder que ce qui est pertinent maintenant : les éléments réellement achetables,
 * plus le PROCHAIN verrouillé (grisé, pour montrer où l'on va). Ce qui a été acquis et
 * ne peut plus être racheté est purgé.
 *
 * Sans ça, les ~60 cartes du jeu s'affichaient toutes dès la première seconde : des menus
 * interminables à dérouler pour trouver l'unique ligne sur laquelle on peut agir.
 *
 * @param {Array} items - dans l'ordre de progression (seuils croissants)
 * @param {(item) => boolean} isOwned - acquis, plus achetable -> purgé
 * @param {(item) => boolean} isAvailable - conditions remplies (hors prix) -> affiché
 * @returns {{ entries: Array<{item, locked: boolean}>, ownedCount: number, totalCount: number }}
 */
export function filterPurchasable(items, { isOwned, isAvailable }) {
  const entries = [];
  let ownedCount = 0;
  let nextLocked = null;

  for (const item of items) {
    if (isOwned(item)) {
      ownedCount += 1;
      continue;
    }
    if (isAvailable(item)) entries.push({ item, locked: false });
    else if (!nextLocked) nextLocked = item;
  }
  if (nextLocked) entries.push({ item: nextLocked, locked: true });

  return { entries, ownedCount, totalCount: items.length };
}

/** Bandeau « X / Y acquis » : garde une trace des acquis sans les afficher en cartes. */
export function acquiredNote(ownedCount, totalCount) {
  if (ownedCount === 0) return '';
  return `<p class="acquired-note">${ownedCount} / ${totalCount} déjà acquis</p>`;
}
