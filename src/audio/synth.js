// Synthèse audio 100% Web Audio API — aucun fichier importé (§8, cohérent avec les fréquences
// dynamiques des handpans maîtres qui n'existent que dans les données, pas dans une bibliothèque
// d'échantillons). AudioContext créé au premier appel (politique autoplay des navigateurs).
import { METRONOME_BPM } from '../data/balance-constants.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.notesGain = null;
    this.ambientGain = null;
    this.percussionGain = null;
    this.droneNodes = null;
    this.backingTimer = null;
    this.backingStep = 0;
    this.metronomeTimer = null;
    this.metronomeBeat = 0;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return; // dégradation propre : navigateur sans Web Audio
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.notesGain = this.ctx.createGain();
    this.notesGain.connect(this.masterGain);
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.connect(this.masterGain);
    this.percussionGain = this.ctx.createGain();
    this.percussionGain.connect(this.masterGain);
  }

  /** À appeler après un premier geste utilisateur si le contexte est suspendu (Safari/iOS). */
  resume() {
    this.ctx?.resume?.();
  }

  applyVolumes(settings) {
    if (!this.ctx) return;
    this.masterGain.gain.value = settings.muted ? 0 : settings.volumeMaster;
    this.notesGain.gain.value = settings.volumeNotes;
    this.ambientGain.gain.value = settings.volumeAmbient;
    this.percussionGain.gain.value = settings.volumePercussion;
  }

  // ---------------------------------------------------------------------------------------
  // Notes du handpan — oscillateur sine + harmoniques légèrement inharmoniques (façon métal
  // frappé) + enveloppe ADSR courte (attaque quasi instantanée, chute exponentielle).
  // ---------------------------------------------------------------------------------------
  playNote(frequency, { duration = 1.4, velocity = 1 } = {}) {
    this.ensureContext();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    const envelope = ctx.createGain();
    envelope.connect(this.notesGain);
    envelope.gain.setValueAtTime(0, t0);
    envelope.gain.linearRampToValueAtTime(velocity, t0 + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    // Partiels inspirés du timbre d'un handpan : fondamentale + harmoniques légèrement
    // désaccordées, amplitude décroissante.
    const partials = [
      { mult: 1, level: 1 },
      { mult: 2.01, level: 0.26 },
      { mult: 3.03, level: 0.11 },
      { mult: 4.18, level: 0.05 },
    ];

    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency * p.mult;
      const partialGain = ctx.createGain();
      partialGain.gain.value = p.level;
      osc.connect(partialGain);
      partialGain.connect(envelope);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Didgeridoo drone (§6.2/§8) — oscillateur grave soutenu + léger vibrato (LFO sur la fréquence)
  // ---------------------------------------------------------------------------------------
  startDrone() {
    if (this.droneNodes || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55; // A1 : grave et soutenu

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(this.ambientGain);

    osc.start();
    lfo.start();
    this.droneNodes = { osc, lfo, gain };
  }

  stopDrone() {
    if (!this.droneNodes || !this.ctx) return;
    const { osc, lfo, gain } = this.droneNodes;
    const t0 = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t0);
    gain.gain.setValueAtTime(gain.gain.value, t0);
    gain.gain.linearRampToValueAtTime(0, t0 + 0.4);
    osc.stop(t0 + 0.45);
    lfo.stop(t0 + 0.45);
    this.droneNodes = null;
  }

  // ---------------------------------------------------------------------------------------
  // Backing track (§6.2/§8) — motif rythmique simple généré (pas de fichier importé).
  // Scheduler simplifié (setInterval) : suffisant pour un fond d'ambiance, pas conçu pour
  // une précision à l'échantillon près (voir DECISIONS.md).
  // ---------------------------------------------------------------------------------------
  startBackingTrack() {
    if (this.backingTimer || !this.ctx) return;
    const stepMs = 60000 / METRONOME_BPM / 2; // croches
    this.backingStep = 0;
    this.backingTimer = setInterval(() => {
      const isDownbeat = this.backingStep % 4 === 0;
      this._blip(isDownbeat ? 110 : 220, isDownbeat ? 0.22 : 0.1);
      this.backingStep += 1;
    }, stepMs);
  }

  stopBackingTrack() {
    if (this.backingTimer) {
      clearInterval(this.backingTimer);
      this.backingTimer = null;
    }
  }

  _blip(freq, level) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    osc.connect(gain);
    gain.connect(this.ambientGain);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  }

  // ---------------------------------------------------------------------------------------
  // Métronome (§6.3/§8) — tic discret, désactivable indépendamment.
  // ---------------------------------------------------------------------------------------
  playMetronomeTick(strong = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = strong ? 1500 : 1000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
    osc.connect(gain);
    gain.connect(this.percussionGain);
    osc.start(t0);
    osc.stop(t0 + 0.04);
  }

  startMetronome(bpm = METRONOME_BPM) {
    if (this.metronomeTimer || !this.ctx) return;
    this.metronomeBeat = 0;
    this.metronomeTimer = setInterval(() => {
      this.playMetronomeTick(this.metronomeBeat % 4 === 0);
      this.metronomeBeat += 1;
    }, 60000 / bpm);
  }

  stopMetronome() {
    if (this.metronomeTimer) {
      clearInterval(this.metronomeTimer);
      this.metronomeTimer = null;
    }
  }

  /** Démarre/arrête drone, backing track et métronome selon l'état courant. */
  syncWithState(state) {
    if (!this.ctx) return;
    this.applyVolumes(state.settings);

    if (state.passiveClickUpgrades.didgeridoo_drone) this.startDrone();
    else this.stopDrone();

    if (state.passiveClickUpgrades.backing_track) this.startBackingTrack();
    else this.stopBackingTrack();

    if (state.percussionTier > 0 && state.settings.metronomeAudible) this.startMetronome();
    else this.stopMetronome();
  }
}
