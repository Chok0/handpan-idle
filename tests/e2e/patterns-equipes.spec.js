import { test, expect } from '@playwright/test';
import { startGame, dismissModals } from './helpers.js';

// Équiper des patterns — extension post-lancement du §6.4 (demande utilisateur) : jusqu'à
// MAX_PATTERNS_EQUIPPED patterns débloqués restent jouables depuis un bandeau déroulant de
// l'écran principal, sans détour par la Collection.
test.describe('Patterns équipés (extension §6.4)', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('Done si : équiper un pattern depuis la Collection le rend jouable depuis le bandeau de l\'écran principal', async ({ page }) => {
    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 1e6;
      e.unlockPattern('ding_ding');
    });
    await dismissModals(page); // débloquer un pattern peut déclencher un jalon narratif

    await page.locator('.tab-btn[data-tab="handpan"]').click();
    await page.locator('[data-action="toggle-equip-pattern"][data-id="ding_ding"]').click();
    expect(await page.evaluate(() => window.PanIdle.engine.state.patternsEquipped)).toEqual(['ding_ding']);

    await page.locator('.tab-btn[data-tab="principal"]').click();
    await page.locator('#equipped-toggle').click();
    const playBtn = page.locator('[data-action="play-equipped-pattern"][data-id="ding_ding"]');
    await expect(playBtn).toBeVisible();

    await playBtn.click();
    // Le bandeau se replie, le statut de pattern (démonstration puis phase joueur) prend le relais.
    await expect(page.locator('#equipped-panel')).toBeHidden();
    await expect(page.locator('#pattern-status')).toBeVisible();
    expect(await page.evaluate(() => window.PanIdle.engine.activePatternRun?.patternId)).toBe('ding_ding');
  });

  test('refuse un 4e pattern équipé tant qu\'un emplacement n\'a pas été libéré', async ({ page }) => {
    await page.evaluate(() => {
      const e = window.PanIdle.engine;
      e.state.handpans = 1e6;
      for (const id of ['ding_ding', 'trois_notes', 'zigzag', 'cascade']) e.unlockPattern(id);
    });
    await dismissModals(page);
    await page.locator('.tab-btn[data-tab="handpan"]').click();

    for (const id of ['ding_ding', 'trois_notes', 'zigzag']) {
      await page.locator(`[data-action="toggle-equip-pattern"][data-id="${id}"]`).click();
      await dismissModals(page);
    }
    expect(await page.evaluate(() => window.PanIdle.engine.state.patternsEquipped)).toHaveLength(3);

    const fourthEquipBtn = page.locator('[data-action="toggle-equip-pattern"][data-id="cascade"]');
    await expect(fourthEquipBtn).toBeDisabled();

    // Déséquiper libère l'emplacement.
    await page.locator('[data-action="toggle-equip-pattern"][data-id="ding_ding"]').click();
    await expect(fourthEquipBtn).toBeEnabled();
  });
});
