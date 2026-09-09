// GameEngine — point d'entrée unique du moteur. L'UI ne doit jamais muter `state` directement :
// tout passe par ces méthodes, qui restent minces au-dessus des modules purs (economy,
// production, purchases, patterns-runtime) pour que ces derniers restent testables sans DOM.
import { createDefaultState, migrateState } from './state.js';
import { saveState, loadRawState, computeOfflineProgress, clearSave } from './save.js';
import { computeClickGain, productionPerSecond, employeesMax } from './production.js';
import { clampFinite } from './economy.js';
import { isOnBeat } from './percussion.js';
import {
  startPatternRun,
  recordPatternHit,
  finishPatternRun,
  beginPlayerPhase,
  expectedNoteIndex,
} from './patterns-runtime.js';
import { getPattern, PATTERNS } from '../data/patterns.js';
import { findPendingBeat } from '../data/story.js';
import * as purchases from './purchases.js';

const AUTOSAVE_INTERVAL_S = 15;

export class GameEngine {
  constructor({ now = Date.now() } = {}) {
    this.state = createDefaultState();
    this.activePatternRun = null;
    this._autosaveAccumulator = 0;
    this._lastOfflineProgress = null;
    this._bootTime = now;
  }

  // -- Cycle de vie / sauvegarde (§10, Phase 2) --------------------------------------------

  loadOrInit(now = Date.now()) {
    const raw = loadRawState();
    this.state = migrateState(raw);
    if (raw) {
      this._lastOfflineProgress = computeOfflineProgress(this.state, now);
      this.state.handpans = clampFinite(this.state.handpans + this._lastOfflineProgress.earned);
      this.state.totalHandpansMade = clampFinite(this.state.totalHandpansMade + this._lastOfflineProgress.earned);
    }
    this.state.lastSaveTimestamp = now;
    return this._lastOfflineProgress;
  }

  consumeOfflineProgressReport() {
    const report = this._lastOfflineProgress;
    this._lastOfflineProgress = null;
    return report;
  }

  save() {
    return saveState(this.state);
  }

  hardReset() {
    clearSave();
    this.state = createDefaultState();
    this.activePatternRun = null;
  }

  // -- Boucle de jeu (§10 : simulation 10Hz, affichage 60Hz — dtSeconds vient de l'appelant) --

  tick(dtSeconds) {
    if (dtSeconds <= 0) return;
    const gained = productionPerSecond(this.state) * dtSeconds;
    this.state.handpans = clampFinite(this.state.handpans + gained);
    this.state.totalHandpansMade = clampFinite(this.state.totalHandpansMade + gained);

    this._autosaveAccumulator += dtSeconds;
    if (this._autosaveAccumulator >= AUTOSAVE_INTERVAL_S) {
      this._autosaveAccumulator = 0;
      this.save();
    }
    return gained;
  }

  // -- Frappe manuelle (§4) -----------------------------------------------------------------

  /**
   * @param {number} noteIndex - index de la note frappée sur le handpan actif
   * @param {number} nowMs
   * @returns {{mode: 'click'|'pattern', gain?: number, onBeat?: boolean, patternFinished?: boolean}}
   */
  click(noteIndex, nowMs = Date.now()) {
    // Pendant la démonstration, le joueur écoute : ses frappes ne comptent pas et ne
    // couvrent pas la séquence qu'on est en train de lui montrer.
    if (this.activePatternRun?.phase === 'demo') {
      return { mode: 'demo' };
    }

    if (this.activePatternRun) {
      const result = recordPatternHit(this.activePatternRun, noteIndex, nowMs, this.state);
      if (result.finished) {
        const finalResult = finishPatternRun(this.activePatternRun, this.state);
        this._applyPatternReward(this.activePatternRun.patternId, finalResult, nowMs);
        this.activePatternRun = null;
        return { mode: 'pattern', patternFinished: true, ...finalResult };
      }
      return { mode: 'pattern', patternFinished: false, ...result };
    }

    const { onBeat, bonus } = isOnBeat(this.state, nowMs);
    const gain = computeClickGain(this.state, { rhythmBonus: bonus });
    this.state.handpans = clampFinite(this.state.handpans + gain);
    this.state.totalHandpansMade = clampFinite(this.state.totalHandpansMade + gain);
    this.state.totalClicks += 1;
    return { mode: 'click', gain, onBeat };
  }

  // -- Patterns (§6.4) ----------------------------------------------------------------------

  canStartPattern(id, nowMs = Date.now()) {
    if (!this.state.patternsUnlocked.includes(id)) return { ok: false, reason: 'non_debloque' };
    if (this.activePatternRun) return { ok: false, reason: 'pattern_deja_en_cours' };
    const pattern = getPattern(id);
    const stats = this.state.patternStats[id];
    if (stats?.lastPlayedAt && nowMs - stats.lastPlayedAt < pattern.cooldownS * 1000) {
      return { ok: false, reason: 'cooldown' };
    }
    return { ok: true };
  }

  startPattern(id, nowMs = Date.now()) {
    const check = this.canStartPattern(id, nowMs);
    if (!check.ok) return check;
    this.activePatternRun = startPatternRun(id);
    return { ok: true };
  }

  /** Appelé par l'UI quand la démonstration est terminée : la main passe au joueur. */
  beginPatternPlayerPhase() {
    if (this.activePatternRun) beginPlayerPhase(this.activePatternRun);
  }

  /** Index de la note que le joueur doit frapper (surlignage), ou null. */
  getExpectedPatternNote() {
    if (!this.activePatternRun || this.activePatternRun.phase === 'demo') return null;
    return expectedNoteIndex(this.activePatternRun);
  }

  /** Abandonne le pattern en cours sans récompense (sécurité UX, hors périmètre du GDD). */
  cancelPattern() {
    this.activePatternRun = null;
  }

  _applyPatternReward(patternId, finalResult, nowMs) {
    this.state.handpans = clampFinite(this.state.handpans + finalResult.gain);
    this.state.totalHandpansMade = clampFinite(this.state.totalHandpansMade + finalResult.gain);
    const stats = this.state.patternStats[patternId] || { timesPlayed: 0, bestPrecision: 0 };
    stats.timesPlayed += 1;
    stats.bestPrecision = Math.max(stats.bestPrecision, finalResult.precisionMoyenne);
    stats.lastPlayedAt = nowMs;
    this.state.patternStats[patternId] = stats;
  }

  listPatternDefs() {
    return PATTERNS;
  }

  // -- Achats : délégation directe aux fonctions pures de purchases.js -----------------------

  buyTool(id) { return purchases.buyTool(this.state, id); }
  buyEmployeeDirect(tierId) { return purchases.buyEmployeeDirect(this.state, tierId); }
  convertEmployee(tierId) { return purchases.convertEmployee(this.state, tierId); }
  buyBuildingNiveau1Next() { return purchases.buyBuildingNiveau1Next(this.state); }
  buyBuilding(id) { return purchases.buyBuilding(this.state, id); }
  buyMultiplier(id) { return purchases.buyMultiplier(this.state, id); }
  unlockMasterPan(id) { return purchases.unlockMasterPan(this.state, id); }
  setActiveMasterPan(id) { return purchases.setActiveMasterPan(this.state, id); }
  buyPassiveClickUpgrade(id) { return purchases.buyPassiveClickUpgrade(this.state, id); }
  buyNextPercussionTier() { return purchases.buyNextPercussionTier(this.state); }
  unlockPattern(id) { return purchases.unlockPattern(this.state, id); }
  buyGenericUpgrade(id) { return purchases.buyGenericUpgrade(this.state, id); }
  buyAccordageUltime() { return purchases.buyAccordageUltime(this.state); }

  // -- Mise en contexte / jalons narratifs ------------------------------------------------------

  needsIntro() {
    return !this.state.story.introSeen;
  }

  markIntroSeen() {
    this.state.story.introSeen = true;
  }

  /** Prochain jalon narratif à montrer (condition remplie, pas encore vu), ou null. */
  getPendingStoryBeat() {
    return findPendingBeat(this.state, this.state.story.beatsSeen);
  }

  markStoryBeatSeen(id) {
    if (!this.state.story.beatsSeen.includes(id)) this.state.story.beatsSeen.push(id);
  }

  // -- Marketing (§12) ------------------------------------------------------------------------

  hasCtaBeenSeen(id) {
    return this.state.marketing.ctaSeen.includes(id);
  }

  markCtaSeen(id) {
    if (!this.hasCtaBeenSeen(id)) this.state.marketing.ctaSeen.push(id);
  }

  // -- Lecture pour l'UI ------------------------------------------------------------------------

  getProductionPerSecond() { return productionPerSecond(this.state); }
  getEmployeesMax() { return employeesMax(this.state); }
}
