import { test, expect } from '@playwright/test';

test.describe('Phase 3 — Bâtiments niveau 2/3, employés supérieurs, conversion (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Done si : convertir un Apprenti en Ouvrier coûte moins cher que l\'achat direct', async ({ page }) => {
    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 1e9;
      e.buyBuildingNiveau1Next(); // Cave
      e.buyBuildingNiveau1Next(); // Garage -> débloque niveau 2
      e.buyEmployeeDirect('apprenti');
    });

    await page.locator('.tab-btn[data-tab="atelier"]').click();
    await page.locator('[data-action="convert-employee"][data-id="ouvrier"]').click();

    const employees = await page.evaluate(() => window.PanIdle.engine.state.employees);
    expect(employees.apprenti).toBe(0);
    expect(employees.ouvrier).toBe(1);
  });

  test('Done si : Usine/Entrepôt/Boutique se débloquent après le Garage + Atelier + Showroom', async ({ page }) => {
    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 1e9;
      e.buyBuildingNiveau1Next();
      e.buyBuildingNiveau1Next();
    });
    await page.locator('.tab-btn[data-tab="atelier"]').click();
    await expect(page.locator('.shop-card__title', { hasText: 'Usine' })).toHaveCount(0);

    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.buyBuilding('atelier');
      e.buyBuilding('showroom');
    });
    await page.locator('.tab-btn[data-tab="handpan"]').click();
    await page.locator('.tab-btn[data-tab="atelier"]').click();
    await expect(page.locator('.shop-card__title', { hasText: 'Usine' })).toBeVisible();
    await expect(page.locator('.shop-card__title', { hasText: 'Entrepôt' })).toBeVisible();
    await expect(page.locator('.shop-card__title', { hasText: 'Boutique' })).toBeVisible();
  });
});
