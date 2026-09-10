// Bootstrap du jeu — assemble moteur, audio, rendu SVG et les 3 écrans (§9).
import { GameEngine } from './engine/game.js';
import { AudioEngine } from './audio/synth.js';
import { HandpanView } from './render/handpan-svg.js';
import { renderAtelierScreen } from './render/screens/atelier.js';
import { renderHandpanScreen } from './render/screens/handpan.js';
import * as marketing from './render/marketing.js';
import { formatNumber } from './engine/economy.js';
import { panAmount, card } from './render/ui-kit.js';
import { getMasterPan } from './data/master-pans.js';
import { getPattern, PATTERNS, MAX_PATTERNS_EQUIPPED } from './data/patterns.js';
import { INTRO } from './data/story.js';
import { isOnBeat } from './engine/percussion.js';
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
  // Précharge les vrais échantillons du pan : la 1re frappe doit déjà sonner juste.
  audio.preloadPan(pan.notes);
}

function handleNoteHit(index) {
  audio.resume();
  const pan = getMasterPan(engine.state.activeMasterPan);
  const noteName = pan.notes[index];
  const runningPatternId = engine.activePatternRun?.patternId ?? null;

  const result = engine.click(index, Date.now());
  if (result.mode === 'demo') return; // démonstration en cours : on écoute, on ne joue pas
  if (result.mode === 'click') {
    audio.playNote(noteName);
    handpanView.spawnGain(index, `+${panAmount(result.gain)}`);
  } else {
    audio.playNote(noteName, { velocity: 0.8 });
    updatePatternStatus();
    if (result.patternFinished) {
      handpanView.spawnGain(index, `+${panAmount(result.gain)}`);
      onPatternFinished(runningPatternId);
    }
  }
  engine.save();
}

/** Durée lisible : « 6 h 12 min » plutôt que « 372 min ». */
function formatDuration(seconds) {
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return min ? `${h} h ${min} min` : `${h} h`;
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

// Panneaux d'info (bouton « i ») ouverts, conservés d'un rendu à l'autre.
const openInfoIds = new Set();
// Dernier HTML rendu par écran : on ne réécrit le DOM que s'il a réellement changé.
// Sans ça, le re-rendu périodique détruisait le focus clavier toutes les 500 ms et
// refermait les panneaux d'info sous les doigts du joueur.
const lastRenderedHtml = { atelier: null, handpan: null };

function renderActiveScreen() {
  const render = activeTab === 'atelier' ? renderAtelierScreen : activeTab === 'handpan' ? renderHandpanScreen : null;
  if (!render) return;
  const html = render(engine);
  if (lastRenderedHtml[activeTab] === html) return;
  lastRenderedHtml[activeTab] = html;
  screens[activeTab].innerHTML = html;
  restoreOpenInfoPanels(screens[activeTab]);
}

function restoreOpenInfoPanels(container) {
  for (const id of openInfoIds) {
    container.querySelector(`[data-info-panel="${id}"]`)?.removeAttribute('hidden');
    container.querySelector(`[data-info-toggle="${id}"]`)?.setAttribute('aria-expanded', 'true');
  }
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
  'play-pattern': (id) => ({ success: startPatternFlow(id) }),
  'toggle-equip-pattern': (id) => (
    engine.state.patternsEquipped.includes(id) ? engine.unequipPattern(id) : engine.equipPattern(id)
  ),
  'buy-generic': (id) => engine.buyGenericUpgrade(id),
  'buy-ultimate': () => engine.buyAccordageUltime(),
};

function bindDelegatedActions(container) {
  container.addEventListener('click', (e) => {
    // Bouton « i » : replie/déplie le détail de calcul de la carte.
    const infoBtn = e.target.closest('[data-info-toggle]');
    if (infoBtn) {
      const id = infoBtn.dataset.infoToggle;
      const panel = container.querySelector(`[data-info-panel="${id}"]`);
      const willOpen = panel?.hasAttribute('hidden');
      if (willOpen) {
        panel.removeAttribute('hidden');
        openInfoIds.add(id);
      } else {
        panel?.setAttribute('hidden', '');
        openInfoIds.delete(id);
      }
      infoBtn.setAttribute('aria-expanded', String(Boolean(willOpen)));
      return;
    }

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
// Bandeau des patterns équipés (écran principal) — demande post-lancement : pouvoir garder
// jusqu'à MAX_PATTERNS_EQUIPPED patterns « en poche » et les jouer sans passer par la
// Collection. Repliable (bouton + panneau) pour ne pas rogner la hauteur de l'instrument.
// ---------------------------------------------------------------------------------------
const equippedToggle = document.getElementById('equipped-toggle');
const equippedToggleLabel = document.getElementById('equipped-toggle-label');
const equippedPanel = document.getElementById('equipped-panel');
const equippedSlots = document.getElementById('equipped-slots');
let equippedPanelOpen = false;

function setEquippedPanelOpen(open) {
  equippedPanelOpen = open;
  equippedPanel.hidden = !open;
  equippedToggle.setAttribute('aria-expanded', String(open));
  if (open) renderEquippedPatterns();
}
equippedToggle.addEventListener('click', () => setEquippedPanelOpen(!equippedPanelOpen));

/** Rejoue le même contenu que renderPatterns() côté Collection, en plus compact. */
function renderEquippedPatterns() {
  equippedToggleLabel.textContent = `Patterns équipés (${engine.state.patternsEquipped.length}/${MAX_PATTERNS_EQUIPPED})`;
  if (!equippedPanelOpen) return; // rien d'autre à recalculer tant que le panneau est fermé

  const now = Date.now();
  const running = engine.activePatternRun;
  const slots = [];
  for (let i = 0; i < MAX_PATTERNS_EQUIPPED; i++) {
    const id = engine.state.patternsEquipped[i];
    if (!id) {
      slots.push(`<div class="equip-slot--empty">
        <span>Emplacement libre</span>
        <button class="buy-btn buy-btn--secondary" data-action="goto-collection">Équiper depuis la Collection</button>
      </div>`);
      continue;
    }
    const pattern = getPattern(id);
    const stats = engine.state.patternStats[id];
    const remaining = stats?.lastPlayedAt ? stats.lastPlayedAt + pattern.cooldownS * 1000 - now : 0;
    const onCooldown = remaining > 0;
    const disabled = onCooldown || Boolean(running);
    slots.push(card({
      id: `equip-${id}`,
      icon: 'icon-score',
      title: pattern.nom,
      subtitle: `${pattern.sequence.length} notes · jusqu'à ${panAmount(pattern.gainDeBase)}`,
      variant: 'owned',
      actions: `<div class="card-actions">
        <button class="buy-btn" data-action="play-equipped-pattern" data-id="${id}" ${disabled ? 'disabled' : ''}>
          ${onCooldown ? `Repos (${Math.ceil(remaining / 1000)} s)` : 'Jouer'}
        </button>
        <button class="buy-btn buy-btn--secondary" data-action="unequip-pattern" data-id="${id}">Déséquiper</button>
      </div>`,
    }));
  }
  equippedSlots.innerHTML = slots.join('');
}

equippedSlots.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'play-equipped-pattern') {
    startPatternFlow(id); // ferme le panneau (startPatternFlow), le statut de pattern prend le relais
  } else if (btn.dataset.action === 'unequip-pattern') {
    engine.unequipPattern(id);
    engine.save();
    renderEquippedPatterns();
  } else if (btn.dataset.action === 'goto-collection') {
    setEquippedPanelOpen(false);
    switchTab('handpan');
  }
});

// ---------------------------------------------------------------------------------------
// Statut de pattern en cours (zone d'affichage §9)
// ---------------------------------------------------------------------------------------
const patternStatusEl = document.getElementById('pattern-status');
const patternStatusName = document.getElementById('pattern-status-name');
const patternStatusDots = document.getElementById('pattern-status-dots');
const patternStatusPhase = document.getElementById('pattern-status-phase');
document.getElementById('pattern-cancel-btn').addEventListener('click', () => {
  clearDemoTimers();
  engine.cancelPattern();
  updatePatternStatus();
});

let demoTimers = [];
function clearDemoTimers() {
  demoTimers.forEach(clearTimeout);
  demoTimers = [];
}

/**
 * Lance un pattern : démonstration d'abord (le jeu joue la séquence), puis la main au joueur.
 * Le chrono ne démarre qu'à SA première frappe — plus de temps perdu au changement d'onglet.
 */
function startPatternFlow(id) {
  const r = engine.startPattern(id, Date.now());
  if (!r.ok) return false;
  switchTab('principal');
  setEquippedPanelOpen(false); // le statut de pattern prend sa place dans le même bandeau
  audio.resume();
  runPatternDemo();
  return true;
}

function runPatternDemo() {
  const run = engine.activePatternRun;
  if (!run) return;
  const pattern = getPattern(run.patternId);
  const pan = getMasterPan(engine.state.activeMasterPan);
  clearDemoTimers();

  // Petit temps d'installation : le joueur vient de changer d'onglet, il doit avoir le
  // temps de poser les yeux sur l'instrument avant que la démonstration commence.
  const LEAD_IN_MS = 800;

  run.stepTimes.forEach((t, i) => {
    const step = pattern.sequence[i];
    demoTimers.push(
      setTimeout(() => {
        handpanView.triggerHitFeedback(step.noteIndex, { strong: true });
        audio.playNote(pan.notes[step.noteIndex], { velocity: 0.9 });
      }, LEAD_IN_MS + t)
    );
  });

  const demoEnd = LEAD_IN_MS + run.stepTimes[run.stepTimes.length - 1] + 900;
  demoTimers.push(
    setTimeout(() => {
      engine.beginPatternPlayerPhase();
      updatePatternStatus();
    }, demoEnd)
  );

  updatePatternStatus();
}

const PHASE_LABELS = {
  demo: '<strong>Écoutez</strong> — le motif se joue tout seul',
  attente: '<strong>À vous</strong> — frappez la note surlignée pour démarrer',
  jeu: 'Continuez sur la note surlignée',
};

function updatePatternStatus() {
  const run = engine.activePatternRun;
  if (!run) {
    patternStatusEl.hidden = true;
    handpanView.setExpectedNote(null);
    clearDemoTimers();
    return;
  }
  const pattern = getPattern(run.patternId);
  patternStatusEl.hidden = false;
  patternStatusName.textContent = pattern.nom;
  patternStatusPhase.innerHTML = PHASE_LABELS[run.phase] ?? '';
  patternStatusDots.innerHTML = pattern.sequence
    .map((_, i) => {
      let cls = 'step';
      if (i < run.hitPrecisions.length) cls += run.hitPrecisions[i] > 0.3 ? ' hit' : ' miss';
      else if (i === run.stepIndex && run.phase !== 'demo') cls += ' next';
      return `<span class="${cls}"></span>`;
    })
    .join('');

  handpanView.setExpectedNote(engine.getExpectedPatternNote());
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
    `Pendant votre absence (${formatDuration(offlineReport.cappedSeconds)}), l'atelier a fabriqué ${formatNumber(offlineReport.earned)} handpans.`;
  modal.hidden = false;
  document.getElementById('offline-modal-close').addEventListener('click', () => {
    modal.hidden = true;
  });
}

// ---------------------------------------------------------------------------------------
// Son / mute
// ---------------------------------------------------------------------------------------
const muteBtn = document.getElementById('mute-btn');
const soundIcon = document.getElementById('sound-icon');
muteBtn.addEventListener('click', () => {
  const muted = !engine.state.settings.muted;
  engine.state.settings.muted = muted;
  soundIcon.setAttribute('href', muted ? '#icon-sound-off' : '#icon-sound-on');
  muteBtn.title = muted ? 'Rétablir le son' : 'Couper le son';
  muteBtn.setAttribute('aria-label', muteBtn.title);
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
// Mise en contexte (1er lancement) et jalons narratifs
// ---------------------------------------------------------------------------------------
const introModal = document.getElementById('intro-modal');
const storyModal = document.getElementById('story-modal');
let storyModalOpen = false;

if (engine.needsIntro()) {
  document.getElementById('intro-text').textContent = INTRO.text;
  document.getElementById('intro-close').textContent = INTRO.cta;
  introModal.hidden = false;
}
document.getElementById('intro-close').addEventListener('click', () => {
  introModal.hidden = true;
  engine.markIntroSeen();
  engine.save();
  audio.ensureContext();
  audio.resume();
});

document.getElementById('story-close').addEventListener('click', () => {
  storyModal.hidden = true;
  storyModalOpen = false;
});

/** Un seul jalon à la fois, et jamais par-dessus l'intro ou un pattern en cours. */
function checkStoryBeats() {
  if (storyModalOpen || !introModal.hidden || engine.activePatternRun) return;
  const beat = engine.getPendingStoryBeat();
  if (!beat) return;
  document.getElementById('story-title').textContent = beat.title;
  document.getElementById('story-text').textContent = beat.text;
  storyModal.hidden = false;
  storyModalOpen = true;
  engine.markStoryBeatSeen(beat.id);
  engine.save();
}

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
  document.getElementById('handpans-count').innerHTML = panAmount(engine.state.handpans);
  document.getElementById('handpans-rate').innerHTML = `${panAmount(engine.getProductionPerSecond())}<span class="rate-unit">/s</span>`;
  document.getElementById('total-made').textContent = formatNumber(engine.state.totalHandpansMade);
}

function loop(now) {
  if (now - lastSimTime >= SIM_INTERVAL_MS) {
    const dt = (now - lastSimTime) / 1000;
    engine.tick(dt);
    audio.syncWithState(engine.state);
    checkStoryBeats();
    lastSimTime = now;
  }

  updateTopbar();
  updateMetronomeVisual(now);

  // Les écrans boutique n'ont pas besoin de 60Hz : 2Hz suffit pour refléter les coûts/plafonds.
  // Le bandeau des patterns équipés (écran principal) suit le même rythme — coûte peu quand
  // il est fermé (renderEquippedPatterns() se limite alors au libellé du compte).
  if (now - lastShopRefresh > 500) {
    if (activeTab !== 'principal') renderActiveScreen();
    renderEquippedPatterns();
    lastShopRefresh = now;
  }

  requestAnimationFrame(loop);
}

ensureHandpanMounted();
updateTopbar();
renderEquippedPatterns();
requestAnimationFrame(loop);

// Sauvegarde à la fermeture/perte de focus (en plus de l'autosave périodique du moteur).
window.addEventListener('beforeunload', () => engine.save());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') engine.save();
});

// Exposé pour le débogage manuel et les tests e2e (cf. tests/e2e).
window.PanIdle = { engine, audio, purchasesEngine, PATTERNS };
