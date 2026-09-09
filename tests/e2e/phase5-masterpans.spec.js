import { test, expect } from '@playwright/test';
import { startGame, dismissModals, panCount } from './helpers.js';

test.describe('Phase 5 — Handpans maîtres (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('Done si : débloquer un nouveau handpan maître change note_value_base et les notes affichées', async ({ page }) => {
    await page.evaluate(() => { window.PanIdle.engine.state.handpans = 1e7; });
    await page.locator('.tab-btn[data-tab="handpan"]').click();
    await page.locator('[data-action="unlock-masterpan"][data-id="kurd10"]').click();
    await dismissModals(page); // acquérir un 2e pan déclenche un jalon narratif
    await page.locator('[data-action="select-masterpan"][data-id="kurd10"]').click();

    await page.locator('.tab-btn[data-tab="principal"]').click();
    await expect(page.locator('#active-pan-label')).toHaveText('D Kurd (10 notes)');
    await expect(page.locator('.note-group')).toHaveCount(10);

    const activePanId = await page.evaluate(() => window.PanIdle.engine.state.activeMasterPan);
    expect(activePanId).toBe('kurd10');
  });
});
