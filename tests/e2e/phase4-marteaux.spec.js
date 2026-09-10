import { test, expect } from '@playwright/test';
import { startGame, dismissModals, panCount } from './helpers.js';

test.describe('Phase 4 — Marteaux, synergie clic/idle (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('Done si : augmenter le nombre d\'employés augmente visiblement le gain par clic via les Marteaux possédés', async ({ page }) => {
    // Un Marteau acheté à 0 employé est refusé (§5.1 : bonus_marteaux = ... × nb_employés,
    // donc STRICTEMENT nul sans effectif — voir purchases.buyTool) : on embauche d'abord.
    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 1e6;
      e.buyEmployeeDirect('apprenti');
      e.buyTool('marteau');
    });
    expect(await page.evaluate(() => window.PanIdle.engine.state.tools.marteau)).toBe(1);
    // Le 1er employé déclenche un jalon narratif : sa modale, en `position: fixed` par-dessus
    // tout l'écran, intercepte le VRAI clic souris qui suit (même `{ force: true }`, qui ne
    // bypasse que les vérifications Playwright — pas le point d'impact réel du clic).
    await dismissModals(page);

    const before1 = await page.evaluate(() => window.PanIdle.engine.state.handpans);
    // { force: true } : la respiration idle (§10.1) anime en continu le transform de la note,
    // ce qui fait échouer la vérification de "stabilité" de Playwright (sans impact pour un
    // vrai clic souris) — voir DECISIONS.md.
    await page.locator('.note-group[data-index="0"]').click({ force: true });
    const gainWithFewEmployees = (await page.evaluate(() => window.PanIdle.engine.state.handpans)) - before1;

    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      for (let i = 0; i < 3; i++) e.buyEmployeeDirect('apprenti');
    });

    const before2 = await page.evaluate(() => window.PanIdle.engine.state.handpans);
    // { force: true } : la respiration idle (§10.1) anime en continu le transform de la note,
    // ce qui fait échouer la vérification de "stabilité" de Playwright (sans impact pour un
    // vrai clic souris) — voir DECISIONS.md.
    await page.locator('.note-group[data-index="0"]').click({ force: true });
    const gainWithMoreEmployees = (await page.evaluate(() => window.PanIdle.engine.state.handpans)) - before2;

    expect(gainWithMoreEmployees).toBeGreaterThan(gainWithFewEmployees);
  });
});
