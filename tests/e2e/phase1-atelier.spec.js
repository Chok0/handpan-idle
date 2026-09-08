import { test, expect } from '@playwright/test';

test.describe('Phase 1 — Branche Atelier, employés & bâtiment niveau 1 (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Done si : achat d\'Apprentis jusqu\'au plafond du bâtiment niveau 1, puis évolution en 3 étapes', async ({ page }) => {
    await page.evaluate(() => { window.PanIdle.engine.state.handpans = 1_000_000; });
    await page.locator('.tab-btn[data-tab="atelier"]').click();

    const buyApprenti = page.locator('[data-action="buy-employee-direct"][data-id="apprenti"]');
    // Placard clandestin (défaut) : Employés max = 3
    for (let i = 0; i < 3; i++) {
      await buyApprenti.click();
    }
    await expect(buyApprenti).toBeDisabled();
    await expect(page.locator('.shop-card', { hasText: 'Apprenti' })).toContainText('Possédés : 3');

    await page.locator('[data-action="buy-building1-next"]').click(); // -> Cave
    await expect(page.locator('.shop-card__title', { hasText: 'Cave' })).toBeVisible();

    await page.locator('[data-action="buy-building1-next"]').click(); // -> Garage
    await expect(page.locator('.shop-card__title', { hasText: 'Garage' })).toBeVisible();

    // Garage débloque le niveau 2 : Ouvrier et Marteau pneumatique doivent apparaître.
    await expect(page.locator('.shop-card', { hasText: 'Ouvrier' })).toBeVisible();
  });
});
