import { test, expect } from '@playwright/test';

test.describe('Phase 2 — Sauvegarde (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Done si : fermer/rouvrir l\'onglet conserve la progression et crédite le temps écoulé', async ({ page, context }) => {
    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 500;
      e.state.employees.apprenti = 1; // 0.1 ♫/s
      e.save();
      const raw = JSON.parse(localStorage.getItem('panidle_save_v1'));
      raw.lastSaveTimestamp = Date.now() - 100_000; // absence simulée de 100 s
      localStorage.setItem('panidle_save_v1', JSON.stringify(raw));
    });

    // On ouvre un NOUVEL onglet plutôt que de recharger `page` : un reload() déclencherait le
    // `beforeunload` du jeu déjà chargé, qui ré-écrase lastSaveTimestamp à "maintenant" avant
    // même que la navigation n'ait lieu (comportement correct en usage réel — c'est le moment
    // où l'utilisateur quitte réellement — mais qui invaliderait notre horodatage simulé ici).
    const page2 = await context.newPage();
    await page2.goto('/');

    // La progression (500 ♫, 1 Apprenti) est conservée...
    const employeeCount = await page2.evaluate(() => window.PanIdle.engine.state.employees.apprenti);
    expect(employeeCount).toBe(1);

    // ...et le temps écoulé hors-ligne a été crédité (~0.1 ♫/s × 100s = 10 ♫).
    const modalText = page2.locator('#offline-modal-text');
    await expect(modalText).toBeVisible();
    await expect(modalText).toContainText('♫');

    const handpansAfter = await page2.evaluate(() => window.PanIdle.engine.state.handpans);
    expect(handpansAfter).toBeGreaterThan(500);
  });
});
