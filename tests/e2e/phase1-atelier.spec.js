import { test, expect } from '@playwright/test';
import { startGame, dismissModals, panCount } from './helpers.js';

test.describe('Phase 1 — Branche Atelier, employés & bâtiment niveau 1 (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('Done si : achat d\'Apprentis jusqu\'au plafond du bâtiment niveau 1, puis évolution en 3 étapes', async ({ page }) => {
    await page.evaluate(() => { window.PanIdle.engine.state.handpans = 1_000_000; });
    await page.locator('.tab-btn[data-tab="atelier"]').click();

    const buyApprenti = page.locator('[data-action="buy-employee-direct"][data-id="apprenti"]');
    // Placard clandestin (défaut) : Employés max = 3
    for (let i = 0; i < 3; i++) {
      await buyApprenti.click();
      // Le 1er recrutement déclenche un jalon narratif : sa modale recouvre l'écran tant
      // qu'on ne l'a pas fermée, exactement comme pour un joueur.
      await dismissModals(page);
    }
    await expect(buyApprenti).toBeDisabled();
    await expect(page.locator('.shop-card', { hasText: 'Apprenti' })).toContainText('Possédés : 3');

    await page.locator('[data-action="buy-building1-next"]').click(); // -> Cave
    await dismissModals(page);
    await expect(page.locator('.shop-card__title', { hasText: 'Cave' })).toBeVisible();

    await page.locator('[data-action="buy-building1-next"]').click(); // -> Garage
    await dismissModals(page);
    // Le Garage est le dernier palier du niveau 1 : la section « Espace de travail » n'a
    // plus rien à proposer et disparaît (filtrage des menus). On vérifie donc l'état, pas
    // la présence d'une carte.
    expect(await page.evaluate(() => window.PanIdle.engine.state.buildings.niveau1Stage)).toBe(2);
    await expect(page.locator('[data-action="buy-building1-next"]')).toHaveCount(0);

    // Garage débloque le niveau 2 : Ouvrier et Marteau pneumatique doivent apparaître.
    await expect(page.locator('.shop-card', { hasText: 'Ouvrier' })).toBeVisible();
  });
});
