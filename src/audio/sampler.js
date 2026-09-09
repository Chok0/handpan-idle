// Lecture des vrais échantillons de handpan enregistrés par Mistral Pans
// (ressources/audio/, copiés depuis le site — 25 notes, FLAC + repli MP3).
//
// Remplace la synthèse pour les notes jouées : aucune synthèse ne rend le timbre réel
// d'une tôle martelée à la main, et l'instrument est précisément ce que le jeu vend.
// La synthèse reste utilisée pour le drone, le backing track et le métronome, qui n'ont
// pas d'équivalent enregistré (voir synth.js).
//
// Convention de nommage du site : [Note][s][Octave] — 's' pour dièse, bémols convertis
// en enharmoniques (Bb3 -> As3, Ab3 -> Gs3, Db4 -> Cs4, Eb4 -> Ds4).

const FLAT_TO_SHARP = { Db: 'Cs', Eb: 'Ds', Fb: 'E', Gb: 'Fs', Ab: 'Gs', Bb: 'As', Cb: 'B' };

export function noteToFileName(noteName) {
  let fileName = noteName;
  for (const [flat, sharp] of Object.entries(FLAT_TO_SHARP)) {
    if (fileName.startsWith(flat)) {
      fileName = fileName.replace(flat, sharp);
      break;
    }
  }
  return fileName.replace('#', 's');
}

export class Sampler {
  constructor({ basePath = 'ressources/audio/' } = {}) {
    this.basePath = basePath;
    this.buffers = new Map(); // fileName -> AudioBuffer
    this.pending = new Map(); // fileName -> Promise (évite les fetch en double)
    this.failed = new Set(); // fileName -> on ne réessaie pas indéfiniment
    this.extension = this._detectExtension();
  }

  /** FLAC si le navigateur sait le lire (meilleure qualité), MP3 sinon (Safari ancien). */
  _detectExtension() {
    try {
      const probe = document.createElement('audio');
      return probe.canPlayType('audio/flac') !== '' ? '.flac' : '.mp3';
    } catch {
      return '.mp3';
    }
  }

  isReady(noteName) {
    return this.buffers.has(noteToFileName(noteName));
  }

  /** Charge et décode un échantillon. Idempotent, tolérant à l'échec (repli synthèse). */
  async load(ctx, noteName) {
    const fileName = noteToFileName(noteName);
    if (this.buffers.has(fileName)) return this.buffers.get(fileName);
    if (this.failed.has(fileName)) return null;
    if (this.pending.has(fileName)) return this.pending.get(fileName);

    const promise = (async () => {
      try {
        const response = await fetch(`${this.basePath}${fileName}${this.extension}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(fileName, audioBuffer);
        return audioBuffer;
      } catch (e) {
        // Échantillon indisponible : on le note pour basculer sur la synthèse sans
        // retenter à chaque frappe.
        this.failed.add(fileName);
        console.warn(`Sampler: échantillon indisponible pour ${noteName}`, e);
        return null;
      } finally {
        this.pending.delete(fileName);
      }
    })();

    this.pending.set(fileName, promise);
    return promise;
  }

  /** Précharge en parallèle les notes d'un handpan (appelé au changement de pan actif). */
  preload(ctx, noteNames) {
    return Promise.all(noteNames.map((n) => this.load(ctx, n)));
  }

  /**
   * Joue un échantillon déjà chargé. Retourne false si indisponible — l'appelant
   * bascule alors sur la synthèse plutôt que de ne rien jouer.
   */
  play(ctx, destination, noteName, { velocity = 1 } = {}) {
    const buffer = this.buffers.get(noteToFileName(noteName));
    if (!buffer) return false;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = velocity;
    source.connect(gain);
    gain.connect(destination);
    source.start(ctx.currentTime);
    return true;
  }
}
