import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../src/engine/game.js';
import * as purchases from '../../src/engine/purchases.js';
import * as marketing from '../../src/render/marketing.js';

describe('Marketing — §12 "Wanna get the real thing?"', () => {
  it("propose un CTA seulement si le handpan débloqué a un product_url", () => {
    const engine = new GameEngine();
    engine.state.handpans = 1e7;
    purchases.unlockMasterPan(engine.state, 'kurd10'); // pas de productUrl dans les données
    expect(marketing.onMasterPanUnlocked(engine, 'kurd10')).toBeNull();

    purchases.unlockMasterPan(engine.state, 'amara9'); // productUrl défini
    const cta = marketing.onMasterPanUnlocked(engine, 'amara9');
    expect(cta).not.toBeNull();
    expect(cta.linkUrl).toContain('mistralpans.fr');
  });

  it('ne propose le même CTA masterpan qu\'une seule fois (anti-spam, §12.2)', () => {
    const engine = new GameEngine();
    engine.state.handpans = 1e7;
    purchases.unlockMasterPan(engine.state, 'amara9');
    expect(marketing.onMasterPanUnlocked(engine, 'amara9')).not.toBeNull();
    expect(marketing.onMasterPanUnlocked(engine, 'amara9')).toBeNull();
  });

  it('CTA de fin de pattern : utilise le product_url du handpan actif, sinon un lien générique', () => {
    const engine = new GameEngine(); // reste sur kurd9, qui a un productUrl générique
    const cta = marketing.onPatternFinished(engine, 'ding_ding');
    expect(cta).not.toBeNull();
    expect(cta.linkUrl).toContain('mistralpans.fr');
  });

  it("rappel de retour hors-ligne : silencieux sous le seuil, présent au-dessus", () => {
    expect(marketing.onOfflineReturn(1, String)).toBeNull();
    const cta = marketing.onOfflineReturn(500, (n) => `${n}`);
    expect(cta).not.toBeNull();
    expect(cta.text).toContain('500');
  });

  it('le texte de partage mentionne le total fabriqué et le handpan actif', () => {
    const engine = new GameEngine();
    engine.state.totalHandpansMade = 999;
    const text = marketing.buildShareText(engine.state);
    expect(text).toContain('999');
    expect(text).toContain('Kurd');
  });
});
