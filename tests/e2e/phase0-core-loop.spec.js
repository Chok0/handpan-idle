import { test, expect } from '@playwright/test';

test.describe('Phase 0 — Squelette (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Done si : cliquer une note du handpan augmente le compteur "Handpans fabriqués"', async ({ page }) => {
    const counter = page.locator('#handpans-count');
    await expect(counter).toHaveText('0 ♫');
    // { force: true } : la respiration idle (§10.1, transform scale animé en continu) fait
    // échouer la vérification de "stabilité" de Playwright, qui n'a aucun sens pour un vrai
    // clic souris — voir DECISIONS.md.
    await page.locator('.note-group[data-index="0"]').click({ force: true });
    await expect(counter).not.toHaveText('0 ♫');
    await expect(page.locator('#total-made')).not.toHaveText('0');
  });

  test('le handpan de départ affiche 9 zones de notes cliquables distinctes (Kurd 9)', async ({ page }) => {
    await expect(page.locator('.note-group')).toHaveCount(9);
  });

  test('les 3 écrans sont accessibles par onglets (§9)', async ({ page }) => {
    await expect(page.locator('#screen-principal')).toBeVisible();
    await page.locator('.tab-btn[data-tab="atelier"]').click();
    await expect(page.locator('#screen-atelier')).toBeVisible();
    await expect(page.locator('#screen-principal')).toBeHidden();
    await page.locator('.tab-btn[data-tab="handpan"]').click();
    await expect(page.locator('#screen-handpan')).toBeVisible();
    // La barre ♫ reste visible sur tous les écrans.
    await expect(page.locator('.topbar')).toBeVisible();
  });
});
