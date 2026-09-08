// Bootstrap du jeu — assemble moteur, audio, rendu SVG et les 3 écrans (§9).
import { GameEngine } from './engine/game.js';
import { AudioEngine } from './audio/synth.js';
import { HandpanView } from './render/handpan-svg.js';
import { renderAtelierScreen } from './render/screens/atelier.js';
import { renderHandpanScreen } from './render/screens/handpan.js';
import * as marketing from './render/marketing.js';
import { formatNumber } from './engine/economy.js';
import { getMasterPan } from './data/master-pans.js';
import { getPattern, PATTERNS } from './data/patterns.js';
import { isOnBeat } from './engine/percussion.js';
import { noteToFrequency } from './data/note-frequency.js';
import * as purchasesEngine from './engine/purchases.js';

const engine = new GameEngine();
const audio = new AudioEngine();
const offlineReport = engine.loadOrInit();

// ---------------------------------------------------------------------------------------
// Handpan SVG (Écran Principal) — monté une seule fois, reconstruit seulement si le
// handpan actif change (préserve les animations/écouteurs le reste du temps).
// ---------------------------------------------------------------------------------------
const handpanMount = document.getElementById('handpan-mount');
const handpanView = new HandpanView(handpanMount, { onNoteHit: handleNoteHit });
let mountedPanId = null;

function ensureHandpanMounted() {
  if (mountedPanId === engine.state.activeMasterPan) return;
  mountedPanId = engine.state.activeMasterPan;
  const pan = getMasterPan(mountedPanId);
  handpanView.setNotes(pan.notes);
  document.getElementById('active-pan-label').textContent = pan.label;
}

function handleNoteHit(index) {
  audio.resume();
  const pan = getMasterPan(engine.state.activeMasterPan);
  const noteName = pan.notes[index];
  const runningPatternId = engine.activePatternRun?.patternId ?? null;

  const result = engine.click(index, Date.now());
  if (result.mode === 'click') {
    audio.playNote(noteFrequency(noteName));
    handpanView.spawnGain(index, `+${formatNumber(result.gain)} ♫`);
  } else {
    audio.playNote(noteFrequency(noteName), { velocity: 0.8 });
    updatePatternStatus();
    if (result.patternFinished) {
      handpanView.spawnGain(index, `+${formatNumber(result.gain)} ♫ (pattern)`);
      onPatternFinished(runningPatternId);
    }
  }
  engine.save();
}

const noteFrequencyCache = new Map();
function noteFrequency(noteName) {
  if (!noteFrequencyCache.has(noteName)) {
    noteFrequencyCache.set(noteName, noteToFrequency(noteName));
  }
  return noteFrequencyCache.get(noteName);
}

// ---------------------------------------------------------------------------------------
// Navigation par onglets (§9)
// ---------------------------------------------------------------------------------------
const screens = {
  principal: document.getElementById('screen-principal'),
  atelier: document.getElementById('screen-atelier'),
  handpan: document.getElementById('screen-handpan'),
};
let activeTab = 'principal';

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  Object.entries(screens).forEach(([key, el]) => el.classList.toggle('active', key === tab));
  renderActiveScreen();
}

function renderActiveScreen() {
  if (activeTab === 'atelier') screens.atelier.innerHTML = renderAtelierScreen(engine);
  if (activeTab === 'handpan') screens.handpan.innerHTML = renderHandpanScreen(engine);
}

// ---------------------------------------------------------------------------------------
// Délégation des actions d'achat (data-action / data-id) — communes aux écrans Atelier/Handpan
// ---------------------------------------------------------------------------------------
const ACTIONS = {
  'buy-tool': (id) => engine.buyTool(id),
  'buy-employee-direct': (id) => engine.buyEmployeeDirect(id),
  'convert-employee': (id) => engine.convertEmployee(id),
  'buy-building1-next': () => engine.buyBuildingNiveau1Next(),
  'buy-building': (id) => engine.buyBuilding(id),
  'buy-multiplier': (id) => engine.buyMultiplier(id),
  'unlock-masterpan': (id) => {
    const r = engine.unlockMasterPan(id);
    if (r.success) {
      const cta = marketing.onMasterPanUnlocked(engine, id);
      if (cta) showCta(cta);
    }
    return r;
  },
  'select-masterpan': (id) => {
    const r = engine.setActiveMasterPan(id);
    if (r.success) ensureHandpanMounted();
    return r;
  },
  'buy-passive': (id) => engine.buyPassiveClickUpgrade(id),
  'buy-percussion-tier': () => engine.buyNextPercussionTier(),
  'unlock-pattern': (id) => engine.unlockPattern(id),
  'play-pattern': (id) => {
    const r = engine.startPattern(id, Date.now());
    if (r.ok) {
      switchTab('principal');
      updatePatternStatus();
    }
    return { success: r.ok };
  },
  'buy-generic': (id) => engine.buyGenericUpgrade(id),
  'buy-ultimate': () => engine.buyAccordageUltime(),
};

function bindDelegatedActions(container) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const handler = ACTIONS[btn.dataset.action];
    if (!handler) return;
    const result = handler(btn.dataset.id);
    if (result?.success) {
      engine.save();
      renderActiveScreen();
      updateTopbar();
    }
  });
}
bindDelegatedActions(screens.atelier);
bindDelegatedActions(screens.handpan);

// ---------------------------------------------------------------------------------------
// Statut de pattern en cours (zone d'affichage §9)
// ---------------------------------------------------------------------------------------
const patternStatusEl = document.getElementById('pattern-status');
const patternStatusName = document.getElementById('pattern-status-name');
const patternStatusDots = document.getElementById('pattern-status-dots');
document.getElementById('pattern-cancel-btn').addEventListener('click', () => {
  engine.cancelPattern();
  updatePatternStatus();
});

function updatePatternStatus() {
  const run = engine.activePatternRun;
  if (!run) {
    patternStatusEl.hidden = true;
    return;
  }
  const pattern = getPattern(run.patternId);
  patternStatusEl.hidden = false;
  patternStatusName.textContent = pattern.nom;
  patternStatusDots.innerHTML = pattern.sequence
    .map((_, i) => {
      let cls = 'step';
      if (i < run.hitPrecisions.length) cls += run.hitPrecisions[i] > 0.3 ? ' hit' : ' miss';
      return `<span class="${cls}"></span>`;
    })
    .join('');
}

function onPatternFinished(patternId) {
  const cta = marketing.onPatternFinished(engine, patternId);
  if (cta) showCta(cta);
  updatePatternStatus();
  if (activeTab === 'handpan') renderActiveScreen();
}

// ---------------------------------------------------------------------------------------
// Bannières marketing (§12)
// ---------------------------------------------------------------------------------------
const ctaSlot = document.getElementById('cta-slot');
function showCta(cta) {
  const banner = document.createElement('div');
  banner.className = 'cta-banner';
  banner.innerHTML = `
    <p>${cta.text}</p>
    ${cta.linkUrl ? `<a class="buy-btn" href="${cta.linkUrl}" target="_blank" rel="noopener">${cta.linkLabel}</a>` : '<button class="buy-btn buy-btn--secondary" data-dismiss>OK</button>'}
  `;
  const dismiss = banner.querySelector('[data-dismiss]');
  dismiss?.addEventListener('click', () => banner.remove());
  setTimeout(() => banner.remove(), 12000);
  ctaSlot.prepend(banner);
}

// ---------------------------------------------------------------------------------------
// Modale de retour hors-ligne (Phase 2 du §11)
// ---------------------------------------------------------------------------------------
if (offlineReport && offlineReport.earned > 1) {
  const modal = document.getElementById('offline-modal');
  document.getElementById('offline-modal-text').textContent =
    `Pendant votre absence (${Math.round(offlineReport.cappedSeconds / 60)} min), l'atelier a fabriqué ${formatNumber(offlineReport.earned)} ♫.`;
  modal.hidden = false;
  document.getElementById('offline-modal-close').addEventListener('click', () => {
    modal.hidden = true;
  });
}

// ---------------------------------------------------------------------------------------
// Son / mute
// ---------------------------------------------------------------------------------------
const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  engine.state.settings.muted = !engine.state.settings.muted;
  muteBtn.textContent = engine.state.settings.muted ? '🔇' : '🔊';
  audio.applyVolumes(engine.state.settings);
  engine.save();
});

document.body.addEventListener(
  'pointerdown',
  () => {
    audio.ensureContext();
    audio.resume();
    audio.applyVolumes(engine.state.settings);
  },
  { once: true }
);

// ---------------------------------------------------------------------------------------
// Partage de score (§12.3)
// ---------------------------------------------------------------------------------------
document.getElementById('share-btn').addEventListener('click', async () => {
  const text = marketing.buildShareText(engine.state);
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      /* annulé par l'utilisateur, retente le presse-papier */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showCta({ id: null, text: 'Score copié dans le presse-papier !', linkUrl: null, linkLabel: null });
  } catch {
    window.prompt('Copiez votre score :', text);
  }
});

// ---------------------------------------------------------------------------------------
// Métronome visuel discret (§6.3/§9)
// ---------------------------------------------------------------------------------------
const metronomeDot = document.getElementById('metronome-dot');
function updateMetronomeVisual(nowMs) {
  if (engine.state.percussionTier === 0) {
    metronomeDot.classList.remove('beat');
    return;
  }
  const { onBeat } = isOnBeat(engine.state, nowMs);
  metronomeDot.classList.toggle('beat', onBeat);
}

// ---------------------------------------------------------------------------------------
// Boucle de jeu — simulation 10Hz, affichage 60Hz (§10)
// ---------------------------------------------------------------------------------------
const SIM_INTERVAL_MS = 100;
let lastSimTime = performance.now();
let lastShopRefresh = 0;

function updateTopbar() {
  document.getElementById('handpans-count').textContent = `${formatNumber(engine.state.handpans)} ♫`;
  document.getElementById('handpans-rate').textContent = `${formatNumber(engine.getProductionPerSecond())} ♫/s`;
  document.getElementById('total-made').textContent = formatNumber(engine.state.totalHandpansMade);
}

function loop(now) {
  if (now - lastSimTime >= SIM_INTERVAL_MS) {
    const dt = (now - lastSimTime) / 1000;
    engine.tick(dt);
    audio.syncWithState(engine.state);
    lastSimTime = now;
  }

  updateTopbar();
  updateMetronomeVisual(now);

  // Les écrans boutique n'ont pas besoin de 60Hz : 2Hz suffit pour refléter les coûts/plafonds.
  if (now - lastShopRefresh > 500 && activeTab !== 'principal') {
    renderActiveScreen();
    lastShopRefresh = now;
  }

  requestAnimationFrame(loop);
}

ensureHandpanMounted();
updateTopbar();
requestAnimationFrame(loop);

// Sauvegarde à la fermeture/perte de focus (en plus de l'autosave périodique du moteur).
window.addEventListener('beforeunload', () => engine.save());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') engine.save();
});

// Exposé pour le débogage manuel et les tests e2e (cf. tests/e2e).
window.PanIdle = { engine, audio, purchasesEngine, PATTERNS };
