// Écran Atelier (§9.2) — outils, employés, bâtiments, multiplicateurs. Fonction pure :
// produit une chaîne HTML à partir de `engine`, aucune mutation ici (les actions passent
// par les data-action déléguées dans main.js).
import { TOOLS, EMPLOYEE_TIERS, BUILDINGS_NIVEAU1, BUILDINGS_NIVEAU2, BUILDINGS_NIVEAU3, MULTIPLIERS } from '../../data/balance-constants.js';
import { formatNumber } from '../../engine/economy.js';
import { employeesMax, employeeTotalCount, productionPerSecond } from '../../engine/production.js';
import { isNiveau2Unlocked, isNiveau3Unlocked, isEmployeeTierUnlocked, isMultiplierUnlocked } from '../../engine/unlocks.js';
import * as purchases from '../../engine/purchases.js';

function buyBtn({ action, id = '', price, label, affordable, extraDisabled = false, secondary = false }) {
  const disabled = !affordable || extraDisabled;
  const cls = secondary ? 'buy-btn buy-btn--secondary' : 'buy-btn';
  return `<button class="${cls}" data-action="${action}" data-id="${id}" ${disabled ? 'disabled' : ''}>${label} — ${formatNumber(price)} ♫</button>`;
}

function renderTools(state) {
  const cards = Object.values(TOOLS)
    .filter((t) => !t.unlock || isMultiplierUnlocked(state, t.unlock))
    .map((t) => {
      const price = purchases.marteauCost(state, t.id);
      const count = state.tools[t.id];
      return `
        <div class="shop-card ${count > 0 ? 'owned' : ''}">
          <div class="shop-card__title">${t.label}</div>
          <div class="shop-card__desc">+${t.bonusPerUnit} ♫/frappe × nb employés, par exemplaire</div>
          <div class="shop-card__count">Possédés : ${count}</div>
          ${buyBtn({ action: 'buy-tool', id: t.id, price, label: 'Acheter', affordable: state.handpans >= price })}
        </div>`;
    })
    .join('');
  return `<section class="shop-section"><h2>Outils</h2><div class="shop-grid">${cards}</div></section>`;
}

function renderEmployees(state) {
  const max = employeesMax(state);
  const total = employeeTotalCount(state);
  const cards = EMPLOYEE_TIERS.map((tier) => {
    const unlocked = isEmployeeTierUnlocked(state, tier.unlock);
    if (!unlocked) return '';
    const count = state.employees[tier.id];
    const directPrice = purchases.employeeDirectCost(state, tier.id);
    const atCap = total >= max;
    let convertHtml = '';
    if (tier.convertFrom) {
      const convPrice = purchases.employeeConversionCost(state, tier.id);
      const hasSource = state.employees[tier.convertFrom] >= 1;
      convertHtml = buyBtn({
        action: 'convert-employee', id: tier.id, price: convPrice, label: `Convertir depuis ${tier.convertFrom}`,
        affordable: state.handpans >= convPrice, extraDisabled: !hasSource, secondary: true,
      });
    }
    return `
      <div class="shop-card ${count > 0 ? 'owned' : ''}">
        <div class="shop-card__title">${tier.label}</div>
        <div class="shop-card__desc">1 pan / ${tier.interval}s (${(1 / tier.interval).toFixed(3)} ♫/s)</div>
        <div class="shop-card__count">Possédés : ${count}</div>
        <div class="card-actions">
          ${buyBtn({ action: 'buy-employee-direct', id: tier.id, price: directPrice, label: 'Acheter', affordable: state.handpans >= directPrice, extraDisabled: atCap })}
          ${convertHtml}
        </div>
      </div>`;
  }).join('');
  return `<section class="shop-section">
    <h2>Employés <span class="shop-card__count">(${total} / ${max})</span></h2>
    <div class="shop-grid">${cards}</div>
  </section>`;
}

function renderBuildingsN1(state) {
  const stage = state.buildings.niveau1Stage;
  const current = BUILDINGS_NIVEAU1[stage];
  const next = BUILDINGS_NIVEAU1[stage + 1];
  const nextHtml = next
    ? buyBtn({ action: 'buy-building1-next', price: next.cost, label: `Passer à ${next.label}`, affordable: state.handpans >= next.cost })
    : '<em>Niveau maximal atteint</em>';
  return `<section class="shop-section">
    <h2>Espace de travail</h2>
    <div class="shop-card owned">
      <div class="shop-card__title">${current.label}</div>
      <div class="shop-card__desc">Employés max : ${current.employeesMax} · Production ×${current.globalMult}</div>
      ${nextHtml}
    </div>
  </section>`;
}

function renderBuildingsTier(state, defs, title) {
  const cards = defs.map((b) => {
    const count = state.buildings[b.id];
    const price = purchases.buildingCost(state, b.id);
    return `
      <div class="shop-card ${count > 0 ? 'owned' : ''}">
        <div class="shop-card__title">${b.label}</div>
        <div class="shop-card__desc">+${b.employeesMaxPer} employés max, ×${b.multPer} production, par exemplaire</div>
        <div class="shop-card__count">Possédés : ${count}</div>
        ${buyBtn({ action: 'buy-building', id: b.id, price, label: 'Acheter', affordable: state.handpans >= price })}
      </div>`;
  }).join('');
  return `<section class="shop-section"><h2>${title}</h2><div class="shop-grid">${cards}</div></section>`;
}

function renderMultipliers(state) {
  const cards = Object.values(MULTIPLIERS)
    .filter((m) => isMultiplierUnlocked(state, m.unlock))
    .map((m) => {
      const price = purchases.multiplierCost(state, m.id);
      const count = state.multipliers[m.id];
      return `
        <div class="shop-card ${count > 0 ? 'owned' : ''}">
          <div class="shop-card__title">${m.label}</div>
          <div class="shop-card__desc">×${m.mult} production globale, rachetable</div>
          <div class="shop-card__count">Acheté ${count} fois</div>
          ${buyBtn({ action: 'buy-multiplier', id: m.id, price, label: 'Acheter', affordable: state.handpans >= price })}
        </div>`;
    })
    .join('');
  if (!cards) return '';
  return `<section class="shop-section"><h2>Multiplicateurs de production</h2><div class="shop-grid">${cards}</div></section>`;
}

export function renderAtelierScreen(engine) {
  const state = engine.state;
  const parts = [renderTools(state), renderEmployees(state), renderBuildingsN1(state)];
  if (isNiveau2Unlocked(state)) parts.push(renderBuildingsTier(state, BUILDINGS_NIVEAU2, 'Espaces (niveau 2)'));
  if (isNiveau3Unlocked(state)) parts.push(renderBuildingsTier(state, BUILDINGS_NIVEAU3, 'Espaces (niveau 3)'));
  parts.push(renderMultipliers(state));
  parts.push(`<p class="stage-stats">Production actuelle : <strong>${formatNumber(productionPerSecond(state))} ♫/s</strong></p>`);
  return parts.join('\n');
}
