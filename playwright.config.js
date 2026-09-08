import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Sert la racine du repo en statique pour les tests e2e (index.html + modules ES).
// Pas de build : la page est directement le produit livré.
//
// Certains environnements de développement (sandbox) fournissent un Chromium pré-installé
// à un chemin fixe, avec une version qui peut ne pas correspondre à celle attendue par
// @playwright/test (pas de téléchargement réseau possible pour la faire correspondre).
// En CI (GitHub Actions) et en local standard, ce chemin n'existe pas : `npx playwright
// install` gère alors tout normalement, et il ne faut surtout PAS forcer executablePath
// (ce serait un chemin invalide sur ces machines). D'où la détection conditionnelle.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/readiness/report/e2e-results.json' }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/dev-server.mjs 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
  ],
});
