import { test, expect } from '@playwright/test';

test.describe('Phase 4 — Marteaux, synergie clic/idle (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Done si : augmenter le nombre d\'employés augmente visiblement le gain par clic via les Marteaux possédés', async ({ page }) => {
    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 1e6;
      e.buyTool('marteau');
    });

    const before1 = await page.evaluate(() => window.PanIdle.engine.state.handpans);
    // { force: true } : la respiration idle (§10.1) anime en continu le transform de la note,
    // ce qui fait échouer la vérification de "stabilité" de Playwright (sans impact pour un
    // vrai clic souris) — voir DECISIONS.md.
    await page.locator('.note-group[data-index="0"]').click({ force: true });
    const gainWithoutEmployees = (await page.evaluate(() => window.PanIdle.engine.state.handpans)) - before1;

    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      for (let i = 0; i < 3; i++) e.buyEmployeeDirect('apprenti');
    });

    const before2 = await page.evaluate(() => window.PanIdle.engine.state.handpans);
    // { force: true } : la respiration idle (§10.1) anime en continu le transform de la note,
    // ce qui fait échouer la vérification de "stabilité" de Playwright (sans impact pour un
    // vrai clic souris) — voir DECISIONS.md.
    await page.locator('.note-group[data-index="0"]').click({ force: true });
    const gainWithEmployees = (await page.evaluate(() => window.PanIdle.engine.state.handpans)) - before2;

    expect(gainWithEmployees).toBeGreaterThan(gainWithoutEmployees);
  });
});
