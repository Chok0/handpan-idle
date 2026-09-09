import { test, expect } from '@playwright/test';
import { startGame, dismissModals, panCount } from './helpers.js';

test.describe('Phase 6 — Clic passif, percussions, patterns (§11)', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('Done si : un pattern joué en rythme rapporte davantage qu\'un pattern joué hors-rythme', async ({ page }) => {
    // Précision de timing difficile à garantir via de vrais clics simulés (latence event loop) :
    // on pilote donc le moteur réel (chargé par la page, pas un mock) avec des timestamps
    // contrôlés — la mécanique testée (bonus multiplicatif combo pattern+rythme) est celle du
    // GDD §6.4, déjà verrouillée finement par tests/unit/percussions-patterns.test.js.
    const { onRhythmGain, offRhythmGain } = await page.evaluate(async () => {
      const { GameEngine } = await import('/src/engine/game.js');
      const { getPattern, patternStepTimesMs, beatIntervalMs } = await import('/src/data/patterns.js');
      const beatMs = beatIntervalMs();

      function runOnce(aligned) {
        const engine = new GameEngine();
        engine.state.handpans = 1e6;
        engine.state.percussionTier = 1;
        engine.unlockPattern('trois_notes');
        engine.startPattern('trois_notes', 0);
        // La démonstration est pilotée par l'UI : ici on passe directement la main au joueur.
        engine.beginPatternPlayerPhase();

        const pattern = getPattern('trois_notes');
        const stepTimes = patternStepTimesMs(pattern);
        // La 1re frappe ANCRE l'horloge : on la pose sur une graduation du métronome quand on
        // veut jouer juste, à contretemps (une demi-noire plus loin) quand on veut jouer faux.
        const anchor = aligned ? 0 : beatMs / 2;
        let last;
        pattern.sequence.forEach((step, i) => {
          last = engine.click(step.noteIndex, anchor + stepTimes[i]);
        });
        return last.gain;
      }

      return { onRhythmGain: runOnce(true), offRhythmGain: runOnce(false) };
    });

    expect(onRhythmGain).toBeGreaterThan(offRhythmGain);
  });

  test('les Percussions et les améliorateurs de clic passifs sont achetables depuis l\'écran Handpan', async ({ page }) => {
    await page.evaluate(() => { window.PanIdle.engine.state.handpans = 1e6; });
    await page.locator('.tab-btn[data-tab="handpan"]').click();

    await page.locator('[data-action="buy-passive"][data-id="didgeridoo_drone"]').click();
    const droneActive = await page.evaluate(() => window.PanIdle.engine.state.passiveClickUpgrades.didgeridoo_drone);
    expect(droneActive).toBe(true);

    await page.locator('[data-action="buy-percussion-tier"]').click();
    const tier = await page.evaluate(() => window.PanIdle.engine.state.percussionTier);
    expect(tier).toBe(1);
  });
});
