// Écran Atelier (§9.2) — outils, employés, bâtiments, multiplicateurs. Fonction pure :
// produit une chaîne HTML à partir de `engine`, aucune mutation ici (les actions passent
// par les data-action déléguées dans main.js).
import {
  TOOLS, EMPLOYEE_TIERS, BUILDINGS_NIVEAU1, BUILDINGS_NIVEAU2, BUILDINGS_NIVEAU3, MULTIPLIERS,
} from '../../data/balance-constants.js';
import { formatNumber } from '../../engine/economy.js';
import { employeesMax, employeeTotalCount, productionPerSecond, bonusMarteaux } from '../../engine/production.js';
import { isNiveau2Unlocked, isNiveau3Unlocked, isEmployeeTierUnlocked, isMultiplierUnlocked } from '../../engine/unlocks.js';
import * as purchases from '../../engine/purchases.js';
import { panAmount, buyBtn, card } from '../ui-kit.js';

function renderTools(state) {
  const employees = employeeTotalCount(state);
  const cards = Object.values(TOOLS)
    .filter((t) => !t.unlock || isMultiplierUnlocked(state, t.unlock))
    .map((t) => {
      const price = purchases.marteauCost(state, t.id);
      const count = state.tools[t.id];
      const apport = t.bonusPerUnit * employees;
      return card({
        id: `tool-${t.id}`,
        icon: 'icon-hammer',
        title: t.label,
        subtitle: employees === 0
          ? '⚠ Sans effectif, un marteau ne rapporte rien — embauchez d\'abord.'
          : `+${panAmount(apport)} par frappe`,
        count: `Possédés : ${count}`,
        info: `Chaque marteau ajoute ${t.bonusPerUnit} handpan(s) par frappe et par employé. `
          + `Avec ${employees} employé(s) : +${formatNumber(apport)} par frappe et par marteau.`,
        variant: count > 0 ? 'owned' : '',
        actions: buyBtn({ action: 'buy-tool', id: t.id, price, label: 'Acheter', affordable: state.handpans >= price }),
      });
    })
    .join('');
  return `<section class="shop-section"><h2>Outils</h2><div class="shop-grid">${cards}</div></section>`;
}

function renderEmployees(state) {
  const max = employeesMax(state);
  const total = employeeTotalCount(state);
  const atCap = total >= max;

  const cards = EMPLOYEE_TIERS.filter((tier) => isEmployeeTierUnlocked(state, tier.unlock))
    .map((tier) => {
      const count = state.employees[tier.id];
      const directPrice = purchases.employeeDirectCost(state, tier.id);
      let convertHtml = '';
      if (tier.convertFrom) {
        const convPrice = purchases.employeeConversionCost(state, tier.id);
        const source = EMPLOYEE_TIERS.find((t) => t.id === tier.convertFrom);
        convertHtml = buyBtn({
          action: 'convert-employee', id: tier.id, price: convPrice,
          label: `Promouvoir un ${source.label}`,
          affordable: state.handpans >= convPrice,
          extraDisabled: state.employees[tier.convertFrom] < 1, secondary: true,
        });
      }
      return card({
        id: `emp-${tier.id}`,
        icon: 'icon-worker',
        title: tier.label,
        subtitle: `+${formatNumber(1 / tier.interval)} par seconde`,
        count: `Possédés : ${count}`,
        info: `Produit 1 handpan toutes les ${tier.interval} s, soit ${(1 / tier.interval).toFixed(3)}/s. `
          + `Le prix monte de 15 % à chaque recrutement du même échelon.`
          + (tier.convertFrom ? ` Promouvoir consomme un ${EMPLOYEE_TIERS.find((t) => t.id === tier.convertFrom).label} et coûte moins cher qu'un recrutement direct.` : ''),
        variant: count > 0 ? 'owned' : '',
        actions: `<div class="card-actions">
          ${buyBtn({ action: 'buy-employee-direct', id: tier.id, price: directPrice, label: 'Recruter', affordable: state.handpans >= directPrice, extraDisabled: atCap })}
          ${convertHtml}
        </div>`,
      });
    }).join('');

  const capWarning = atCap
    ? `<p class="section-hint">Atelier plein — agrandissez vos locaux pour recruter davantage.</p>` : '';
  return `<section class="shop-section">
    <h2>Employés <span class="shop-card__count">(${total} / ${max})</span></h2>
    ${capWarning}
    <div class="shop-grid">${cards}</div>
  </section>`;
}

function renderBuildingsN1(state) {
  const stage = state.buildings.niveau1Stage;
  const current = BUILDINGS_NIVEAU1[stage];
  const next = BUILDINGS_NIVEAU1[stage + 1];
  if (!next) return ''; // niveau 1 terminé : la section n'a plus rien à proposer

  return `<section class="shop-section">
    <h2>Espace de travail</h2>
    <div class="shop-grid">${card({
      id: 'building1',
      icon: 'icon-building',
      title: `${current.label} → ${next.label}`,
      subtitle: `${next.employeesMax} employés max · production ×${next.globalMult}`,
      info: `Votre atelier actuel (${current.label}) plafonne à ${current.employeesMax} employés. `
        + `Passer au ${next.label} le porte à ${next.employeesMax} et multiplie toute la production par ${next.globalMult}.`,
      actions: buyBtn({ action: 'buy-building1-next', price: next.cost, label: 'Emménager', affordable: state.handpans >= next.cost }),
    })}</div>
  </section>`;
}

function renderBuildingsTier(state, defs, title) {
  const cards = defs.map((b) => {
    const count = state.buildings[b.id];
    const price = purchases.buildingCost(state, b.id);
    return card({
      id: `bat-${b.id}`,
      icon: 'icon-building',
      title: b.label,
      subtitle: `+${b.employeesMaxPer} employés max · production ×${b.multPer}`,
      count: `Possédés : ${count}`,
      info: `Chaque ${b.label} relève le plafond d'employés de ${b.employeesMaxPer} et multiplie `
        + `la production globale par ${b.multPer}. Ces multiplicateurs se cumulent entre eux.`,
      variant: count > 0 ? 'owned' : '',
      actions: buyBtn({ action: 'buy-building', id: b.id, price, label: 'Construire', affordable: state.handpans >= price }),
    });
  }).join('');
  return `<section class="shop-section"><h2>${title}</h2><div class="shop-grid">${cards}</div></section>`;
}

function renderMultipliers(state) {
  const cards = Object.values(MULTIPLIERS)
    .filter((m) => isMultiplierUnlocked(state, m.unlock))
    .map((m) => {
      const price = purchases.multiplierCost(state, m.id);
      const count = state.multipliers[m.id];
      return card({
        id: `mult-${m.id}`,
        icon: 'icon-spark',
        title: m.label,
        subtitle: `Production globale ×${m.mult}`,
        count: count > 0 ? `Acheté ${count} fois` : '',
        info: `Multiplie toute la production par ${m.mult}, cumulable : ${count} exemplaire(s) `
          + `donnent ×${formatNumber(Math.pow(m.mult, count))}. Le prix monte de 15 % à chaque achat.`,
        variant: count > 0 ? 'owned' : '',
        actions: buyBtn({ action: 'buy-multiplier', id: m.id, price, label: 'Installer', affordable: state.handpans >= price }),
      });
    }).join('');
  if (!cards) return '';
  return `<section class="shop-section"><h2>Machines</h2><div class="shop-grid">${cards}</div></section>`;
}

export function renderAtelierScreen(engine) {
  const state = engine.state;
  const parts = [renderTools(state), renderEmployees(state), renderBuildingsN1(state)];
  if (isNiveau2Unlocked(state)) parts.push(renderBuildingsTier(state, BUILDINGS_NIVEAU2, 'Locaux'));
  if (isNiveau3Unlocked(state)) parts.push(renderBuildingsTier(state, BUILDINGS_NIVEAU3, 'Grands locaux'));
  parts.push(renderMultipliers(state));
  parts.push(`<p class="stage-stats">Production : <strong>${panAmount(productionPerSecond(state))}<span class="rate-unit">/s</span></strong>
    · Bonus marteaux : <strong>+${panAmount(bonusMarteaux(state))}<span class="rate-unit">/frappe</span></strong></p>`);
  return parts.join('\n');
}
