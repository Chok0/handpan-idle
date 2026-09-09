// Amorçage commun aux specs e2e. Deux détails cassent silencieusement chaque test si on
// les oublie, d'où ce point de passage unique :
//   1. la mise en contexte du premier lancement couvre tout l'écran tant qu'on ne la ferme
//      pas — c'est exactement ce que fait un joueur, mais Playwright, lui, attend ;
//   2. la monnaie s'affiche avec une icône SVG et non plus un caractère ♫ : les
//      assertions doivent porter sur le NOMBRE, pas sur le texte complet du compteur.
import { expect } from '@playwright/test';

/** Charge le jeu sur une sauvegarde vierge, mise en contexte fermée. */
export async function startGame(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await dismissModals(page);
}

/**
 * Ferme la mise en contexte puis les jalons narratifs.
 *
 * Les jalons ne s'ouvrent pas au moment de l'achat mais à la boucle de jeu suivante (10 Hz) :
 * regarder l'écran tout de suite ne montre rien, et la modale s'interpose ensuite au milieu
 * du test. On laisse donc passer quelques tours, et on n'abandonne qu'après deux tours vides
 * d'affilée.
 */
export async function dismissModals(page) {
  if (await page.locator('#intro-modal').isVisible()) {
    await page.locator('#intro-close').click();
  }
  let quiet = 0;
  for (let i = 0; i < 20 && quiet < 2; i++) {
    await page.waitForTimeout(180);
    if (await page.locator('#story-modal').isVisible()) {
      await page.locator('#story-close').click();
      quiet = 0;
    } else {
      quiet += 1;
    }
  }
}

/** Valeur numérique du compteur de handpans, icône exclue. */
export async function panCount(page) {
  const raw = await page.locator('#handpans-count').textContent();
  return parseFloat(raw.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
}

/** Le compteur affiche bien `expected` (comparaison sur le nombre seul). */
export async function expectPanCount(page, expected) {
  await expect.poll(() => panCount(page)).toBe(expected);
}
