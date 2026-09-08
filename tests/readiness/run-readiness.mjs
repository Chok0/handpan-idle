#!/usr/bin/env node
// Système de readiness — répond à la question "à quel point le jeu est-il prêt pour
// livraison ?" en agrégeant TROIS sources automatisées :
//   1. Vitest (formules du moteur, testées unitairement)
//   2. Playwright (les "Done si" de chaque phase du GDD §11, exécutés dans un vrai navigateur)
//   3. La simulation accélérée (tests/simulation/run-simulation.mjs) — anomalies numériques
//      (NaN/Infinity) + jalons de progression, utile à l'équilibrage (Phase 8)
//
// Sortie : tests/readiness/report/readiness.json (machine) + readiness.md (humain), et un
// résumé sur stdout. Code de sortie 0 si "PRÊT", 1 sinon — utilisable comme porte de CI.
//
// Usage : npm run readiness   (ou node tests/readiness/run-readiness.mjs)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTOMATED_PHASES, MANUAL_PHASES } from './phase-manifest.mjs';
import { runSimulation } from '../simulation/run-simulation.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REPORT_DIR = path.join(ROOT, 'tests/readiness/report');
const VITEST_JSON = path.join(REPORT_DIR, 'unit-results.json');
const PLAYWRIGHT_JSON = path.join(REPORT_DIR, 'e2e-results.json'); // déjà configuré dans playwright.config.js

mkdirSync(REPORT_DIR, { recursive: true });

function run(cmd, args) {
  console.log(`\n→ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  return result.status ?? 1;
}

function readJsonSafe(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------------------
// 1. Vitest
// -----------------------------------------------------------------------------------------
run('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${VITEST_JSON}`]);
const vitestReport = readJsonSafe(VITEST_JSON);

const unitFileStats = new Map(); // basename -> { total, passed, failed }
for (const tr of vitestReport?.testResults ?? []) {
  const base = path.basename(tr.name);
  const stats = { total: 0, passed: 0, failed: 0 };
  for (const a of tr.assertionResults) {
    stats.total += 1;
    if (a.status === 'passed') stats.passed += 1;
    else if (a.status === 'failed') stats.failed += 1;
  }
  unitFileStats.set(base, stats);
}

// -----------------------------------------------------------------------------------------
// 2. Playwright
// -----------------------------------------------------------------------------------------
run('npx', ['playwright', 'test', '--project=chromium']);
const pwReport = readJsonSafe(PLAYWRIGHT_JSON);

function flattenSpecs(suites = []) {
  const out = [];
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      out.push({ file: path.basename(spec.file), title: spec.title, ok: spec.ok });
    }
    if (suite.suites) out.push(...flattenSpecs(suite.suites));
  }
  return out;
}

const e2eSpecs = flattenSpecs(pwReport?.suites ?? []);
const e2eFileStats = new Map(); // basename -> { total, passed, failed, titles: [...] }
for (const spec of e2eSpecs) {
  const stats = e2eFileStats.get(spec.file) ?? { total: 0, passed: 0, failed: 0, failedTitles: [] };
  stats.total += 1;
  if (spec.ok) stats.passed += 1;
  else {
    stats.failed += 1;
    stats.failedTitles.push(spec.title);
  }
  e2eFileStats.set(spec.file, stats);
}

// -----------------------------------------------------------------------------------------
// 3. Simulation accélérée (Phase 8 — anomalies numériques + jalons de progression)
// -----------------------------------------------------------------------------------------
const SIM_HORIZON_SECONDS = 6 * 3600;
console.log(`\n→ simulation accélérée (${SIM_HORIZON_SECONDS}s simulées)`);
const simResult = runSimulation(SIM_HORIZON_SECONDS);
const simSane = simResult.problemCount === 0;

// -----------------------------------------------------------------------------------------
// Agrégation par phase
// -----------------------------------------------------------------------------------------
function phaseUnitOk(phase) {
  if (phase.unitFiles.length === 0) return { ok: true, detail: '(aucun test unitaire dédié requis)' };
  const missing = phase.unitFiles.filter((f) => !unitFileStats.has(f));
  if (missing.length > 0) return { ok: false, detail: `fichier(s) manquant(s) : ${missing.join(', ')}` };
  const failing = phase.unitFiles.filter((f) => unitFileStats.get(f).failed > 0);
  return { ok: failing.length === 0, detail: failing.length ? `échecs dans : ${failing.join(', ')}` : 'OK' };
}

function phaseE2eOk(phase) {
  if (phase.e2eFiles.length === 0) return { ok: true, detail: '(aucun test e2e dédié requis)' };
  const missing = phase.e2eFiles.filter((f) => !e2eFileStats.has(f));
  if (missing.length > 0) return { ok: false, detail: `spec(s) manquant(s) : ${missing.join(', ')}` };
  const failing = phase.e2eFiles.filter((f) => e2eFileStats.get(f).failed > 0);
  return { ok: failing.length === 0, detail: failing.length ? `échecs dans : ${failing.join(', ')}` : 'OK' };
}

const phaseResults = AUTOMATED_PHASES.map((phase) => {
  const unit = phaseUnitOk(phase);
  const e2e = phaseE2eOk(phase);
  return { ...phase, unit, e2e, ready: unit.ok && e2e.ok };
});

const readyCount = phaseResults.filter((p) => p.ready).length;
const totalPhases = phaseResults.length;
const scorePct = Math.round((readyCount / totalPhases) * 100);

const totalUnit = vitestReport
  ? { total: vitestReport.numTotalTests, passed: vitestReport.numPassedTests, failed: vitestReport.numFailedTests }
  : { total: 0, passed: 0, failed: 0 };
const totalE2e = {
  total: e2eSpecs.length,
  passed: e2eSpecs.filter((s) => s.ok).length,
  failed: e2eSpecs.filter((s) => !s.ok).length,
};

const blockers = [];
for (const p of phaseResults) {
  if (!p.ready) blockers.push(`Phase ${p.id} (${p.title}) : ${!p.unit.ok ? p.unit.detail : ''} ${!p.e2e.ok ? p.e2e.detail : ''}`.trim());
}
if (!simSane) blockers.push(`Simulation : ${simResult.problemCount} anomalie(s) numérique(s) détectée(s) (voir problemsSample)`);

const verdict = scorePct === 100 && totalUnit.failed === 0 && totalE2e.failed === 0 && simSane ? 'PRÊT' : 'PAS PRÊT';

// -----------------------------------------------------------------------------------------
// Rapports
// -----------------------------------------------------------------------------------------
const readinessData = {
  generatedAt: new Date().toISOString(),
  verdict,
  scorePct,
  readyPhases: readyCount,
  totalPhases,
  unit: totalUnit,
  e2e: totalE2e,
  simulation: {
    horizonSeconds: SIM_HORIZON_SECONDS,
    sane: simSane,
    problemCount: simResult.problemCount,
    problemsSample: simResult.problemsSample,
    milestones: simResult.milestones,
  },
  phases: phaseResults.map((p) => ({
    id: p.id,
    title: p.title,
    doneSi: p.doneSi,
    ready: p.ready,
    unit: p.unit,
    e2e: p.e2e,
  })),
  manualPhases: MANUAL_PHASES,
  blockers,
};

writeFileSync(path.join(REPORT_DIR, 'readiness.json'), JSON.stringify(readinessData, null, 2));

const md = [];
md.push('# Rapport de readiness — PanIdle', '');
md.push(`**Généré le :** ${readinessData.generatedAt}`);
md.push(`**Verdict : ${verdict === 'PRÊT' ? '✅ PRÊT' : '❌ PAS PRÊT'}** — ${scorePct}% des phases automatisables au vert (${readyCount}/${totalPhases})`);
md.push('');
md.push(`- Tests unitaires : ${totalUnit.passed}/${totalUnit.total} ✅ (${totalUnit.failed} échec(s))`);
md.push(`- Tests e2e : ${totalE2e.passed}/${totalE2e.total} ✅ (${totalE2e.failed} échec(s))`);
md.push(`- Simulation accélérée (${SIM_HORIZON_SECONDS}s simulées) : ${simSane ? '✅ aucune anomalie numérique' : `❌ ${simResult.problemCount} anomalie(s)`}`);
md.push('');
md.push('## Détail par phase (GDD §11)', '');
md.push('| Phase | Titre | Statut | Unitaire | E2E |', '|---|---|---|---|---|');
for (const p of phaseResults) {
  md.push(`| ${p.id} | ${p.title} | ${p.ready ? '✅' : '❌'} | ${p.unit.ok ? '✅' : '❌ ' + p.unit.detail} | ${p.e2e.ok ? '✅' : '❌ ' + p.e2e.detail} |`);
}
for (const p of MANUAL_PHASES) {
  md.push(`| ${p.id} | ${p.title} | 🟡 manuel | — | — |`);
}
md.push('');
if (blockers.length > 0) {
  md.push('## Bloquants', '');
  for (const b of blockers) md.push(`- ${b}`);
  md.push('');
}
md.push('## Jalons de la simulation accélérée', '');
md.push('_Bot glouton optimal (réinvestit tout, 1 clic/s) — borne basse théorique, pas un temps de jeu réel typique._', '');
for (const [key, val] of Object.entries(simResult.milestones)) {
  md.push(`- **${key}** : atteint à t=${val.second}s simulées`);
}
md.push('');

writeFileSync(path.join(REPORT_DIR, 'readiness.md'), md.join('\n'));

console.log('\n' + '='.repeat(70));
console.log(`READINESS : ${verdict}  (${scorePct}% — ${readyCount}/${totalPhases} phases)`);
console.log(`  Unitaires : ${totalUnit.passed}/${totalUnit.total}   E2E : ${totalE2e.passed}/${totalE2e.total}   Simulation : ${simSane ? 'saine' : 'ANOMALIE'}`);
if (blockers.length > 0) {
  console.log('  Bloquants :');
  for (const b of blockers) console.log(`   - ${b}`);
}
console.log(`\nRapports écrits dans ${path.relative(ROOT, REPORT_DIR)}/readiness.{json,md}`);
console.log('='.repeat(70));

process.exitCode = verdict === 'PRÊT' ? 0 : 1;
