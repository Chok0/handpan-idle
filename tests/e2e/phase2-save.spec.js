import { test, expect } from '@playwright/test';
import { startGame, dismissModals, panCount } from './helpers.js';

test.describe('Phase 2 — Sauvegarde (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('Done si : fermer/rouvrir l\'onglet conserve la progression et crédite le temps écoulé', async ({ page, context }) => {
    const save = await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 500;
      e.state.employees.apprenti = 1; // 0.1 handpan/s
      e.save();
      const raw = JSON.parse(localStorage.getItem('panidle_save_v1'));
      raw.lastSaveTimestamp = Date.now() - 100_000; // absence simulée de 100 s
      raw.story = { introSeen: true, beatsSeen: ['premier_employe'] }; // pas de jalon au retour
      return JSON.stringify(raw);
    });

    // Le premier onglet doit être FERMÉ avant d'ouvrir le second : tant qu'il vit, sa boucle
    // de jeu continue de sauvegarder (autosave, jalon narratif...) et ré-horodate la
    // sauvegarde à « maintenant », ce qui annulerait l'absence qu'on veut simuler.
    await page.close();

    // La sauvegarde est réinjectée AVANT le chargement des scripts du jeu (addInitScript),
    // pour que loadOrInit() la voie telle qu'on l'a écrite.
    const page2 = await context.newPage();
    await page2.addInitScript((raw) => {
      localStorage.setItem('panidle_save_v1', raw);
    }, save);
    await page2.goto('/');

    // La progression (500 handpans, 1 Apprenti) est conservée...
    const employeeCount = await page2.evaluate(() => window.PanIdle.engine.state.employees.apprenti);
    expect(employeeCount).toBe(1);

    // ...et le temps écoulé hors-ligne a été crédité (~0.1/s × 100 s = 10 handpans).
    const modalText = page2.locator('#offline-modal-text');
    await expect(modalText).toBeVisible();
    await expect(modalText).toContainText('handpan');

    const handpansAfter = await page2.evaluate(() => window.PanIdle.engine.state.handpans);
    expect(handpansAfter).toBeGreaterThan(500);
  });
});
