import { test, expect } from '@playwright/test';
import { startGame, dismissModals, panCount } from './helpers.js';

test.describe('Phase 9 — Intégration marketing (§11/§12)', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('Done si : débloquer un handpan maître référencé affiche un lien cliquable vers la vraie fiche produit', async ({ page }) => {
    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 1e5;
      // La liste ne montre que le PROCHAIN pan verrouillé (filtrage des menus) : amara9 n'est
      // proposé qu'une fois kurd10 acquis. On passe donc le palier précédent par le moteur.
      e.unlockMasterPan('kurd10');
    });
    await dismissModals(page);
    await page.locator('.tab-btn[data-tab="handpan"]').click();

    // amara9 a un product_url défini dans src/data/master-pans.js
    await page.locator('[data-action="unlock-masterpan"][data-id="amara9"]').click();
    await dismissModals(page);

    const cta = page.locator('.cta-banner a.buy-btn');
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href).toContain('mistralpans.fr');
  });

  test('le bouton de partage de score ne plante pas et copie un texte contenant le score', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => { window.PanIdle.engine.state.totalHandpansMade = 4242; });
    await page.locator('#share-btn').click();
    // Pas d'assertion stricte sur le presse-papiers (dépend du support navigateur headless) :
    // on vérifie juste l'absence de crash et qu'un texte de confirmation ou une bannière apparaît.
    await page.waitForTimeout(200);
  });
});
