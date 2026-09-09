import { test, expect } from '@playwright/test';
import { startGame, dismissModals, panCount } from './helpers.js';

test.describe('Phase 7 — Améliorations génériques & Accordage Ultime (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('Done si : Accordage Ultime est achetable plusieurs fois à coût croissant, chaque achat augmentant la production', async ({ page }) => {
    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 1e14;
      e.state.employees.master_tuner = 1; // débloque Accordage Ultime
    });
    await dismissModals(page); // le Master Tuner a son propre jalon narratif
    await page.locator('.tab-btn[data-tab="handpan"]').click();

    const prodBefore = await page.evaluate(() => window.PanIdle.engine.getProductionPerSecond());
    const priceBefore = await page.evaluate(() => {
      const s = window.PanIdle.engine.state;
      return s.handpans; // on lira le delta après achat
    });

    await page.locator('[data-action="buy-ultimate"]').click();
    await page.locator('[data-action="buy-ultimate"]').click();

    const count = await page.evaluate(() => window.PanIdle.engine.state.accordageUltimeCount);
    expect(count).toBe(2);

    const prodAfter = await page.evaluate(() => window.PanIdle.engine.getProductionPerSecond());
    expect(prodAfter).toBeGreaterThan(prodBefore);
  });

  test('une amélioration générique verrouillée devient achetable une fois le seuil atteint', async ({ page }) => {
    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 1e6;
      e.state.totalClicks = 100; // seuil du premier palier "Endurance"
    });
    await page.locator('.tab-btn[data-tab="handpan"]').click();
    const btn = page.locator('[data-action="buy-generic"][data-id="clics_100"]');
    await expect(btn).toBeEnabled();
    await btn.click();
    const bought = await page.evaluate(() => window.PanIdle.engine.state.genericUpgradesBought.includes('clics_100'));
    expect(bought).toBe(true);
  });
});
