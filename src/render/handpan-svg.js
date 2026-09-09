// Rendu SVG du handpan — porte l'algorithme de placement du CONFIGURATEUR de Mistral Pans
// (`_getTonalPosition` dans js/features/handpan-player.js), pas celui du sélecteur de gamme.
//
// Les deux modes du player du site utilisent des conventions OPPOSÉES :
//   - mode configurateur : `y = center - sin(angle)` -> graves en bas, aiguës en haut ✅
//   - mode sélecteur     : `y = center + sin(angle)` -> inversé ❌
// La première est la bonne : sur un vrai handpan, on lit les graves près de soi (en bas)
// et les aiguës au fond (en haut). Le jeu avait hérité de la seconde.
import { spawnFloatingNumber } from './floating-numbers.js';

let instanceCounter = 0;

// Proportions reprises telles quelles du configurateur : elles garantissent que les notes
// tiennent DANS la coque (0.31 + 0.065 < 0.42), ce que ne faisait pas l'ancien réglage
// (0.42 + 0.09 > 0.46 : 8 notes sur 9 débordaient).
export const GEOMETRY = {
  shellRadius: 0.42,
  tonalRadius: 0.31,
  dingSize: 0.09,
  noteSize: 0.065,
  fontSize: 0.032,
};

/**
 * Position d'une note tonale sur l'anneau — disposition alternée gauche/droite du
 * configurateur. Angles trigonométriques (0=droite, 90=haut-écran via `center - sin`).
 * Index 0 = note la plus grave -> bas de l'écran ; dernier index = plus aiguë -> haut.
 */
export function getTonalPosition(index, total, radius, center) {
  let angleDeg;
  const lastIndex = total - 1;
  const isEvenTotal = total % 2 === 0;

  if (total === 1) {
    angleDeg = 270;
  } else if (total === 2) {
    angleDeg = index === 0 ? 250 : 290;
  } else if (index === lastIndex) {
    angleDeg = 90; // la plus aiguë, tout en haut
  } else if (isEvenTotal && index === 0) {
    angleDeg = 270; // la plus grave, tout en bas
  } else {
    let adjustedIndex, middleCount, isRight, sideIndex, notesPerSide;

    if (isEvenTotal) {
      adjustedIndex = index - 1;
      middleCount = total - 2;
      isRight = adjustedIndex % 2 === 1;
      sideIndex = Math.floor(adjustedIndex / 2);
      notesPerSide = Math.ceil(middleCount / 2);
      const step = notesPerSide > 1 ? 90 / (notesPerSide - 1) : 0;
      if (isRight) {
        angleDeg = 315 + sideIndex * step;
        if (angleDeg >= 360) angleDeg -= 360;
      } else {
        angleDeg = 225 - sideIndex * step;
      }
    } else {
      isRight = index % 2 === 0;
      sideIndex = Math.floor(index / 2);
      notesPerSide = Math.ceil((total - 1) / 2);
      const range = 120;
      const step = notesPerSide > 1 ? range / (notesPerSide - 1) : 0;
      if (isRight) {
        angleDeg = 290 + sideIndex * step;
        if (angleDeg >= 360) angleDeg -= 360;
      } else {
        angleDeg = 250 - sideIndex * step;
      }
    }
  }

  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: center + Math.cos(angleRad) * radius,
    y: center - Math.sin(angleRad) * radius, // Y SVG inversé : d'où le moins
  };
}

/** Ding au centre exact, tonales sur l'anneau. `notes[0]` est le Ding. */
export function computeNotePositions(noteCount, center, tonalRadius) {
  const positions = [{ x: center, y: center }];
  const tonalCount = noteCount - 1;
  for (let i = 0; i < tonalCount; i++) {
    positions.push(getTonalPosition(i, tonalCount, tonalRadius, center));
  }
  return positions;
}

export class HandpanView {
  constructor(container, { onNoteHit } = {}) {
    this.container = container;
    this.onNoteHit = onNoteHit;
    this.size = 340;
    this.notes = [];
    this.instanceId = ++instanceCounter;
    this._startTime = performance.now();
    this._raf = null;
    this._boundPointerDown = this._handlePointerDown.bind(this);
  }

  setNotes(notes) {
    this.notes = notes;
    this.render();
  }

  render() {
    const size = this.size;
    const center = size / 2;
    const shellRadius = size * GEOMETRY.shellRadius;
    const tonalRadius = size * GEOMETRY.tonalRadius;
    const noteRadius = size * GEOMETRY.noteSize;
    const dingRadius = size * GEOMETRY.dingSize;
    const positions = computeNotePositions(this.notes.length, center, tonalRadius);
    const gradId = `panidle-shell-${this.instanceId}`;
    const shadowId = `panidle-shadow-${this.instanceId}`;

    this.container.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="handpan-svg">
        <defs>
          <radialGradient id="${gradId}" cx="30%" cy="30%">
            <stop offset="0%" stop-color="var(--color-note-ding, #E8E8E8)"/>
            <stop offset="70%" stop-color="#B8B8B8"/>
            <stop offset="100%" stop-color="#7A7A7A"/>
          </radialGradient>
          <filter id="${shadowId}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25"/>
          </filter>
        </defs>
        <circle cx="${center}" cy="${center}" r="${shellRadius}" fill="url(#${gradId})"/>
        <circle cx="${center}" cy="${center}" r="${shellRadius - 2}" fill="none" stroke="#909090" stroke-width="1.5"/>
        <g class="wave-container"></g>
        ${positions
          .map(
            (pos, i) => `
          <g class="note-group" data-index="${i}" data-x="${pos.x}" data-y="${pos.y}" tabindex="0" role="button" aria-label="Note ${this.notes[i]}">
            <circle cx="${pos.x}" cy="${pos.y}" r="${i === 0 ? dingRadius : noteRadius}"
              class="note-circle" filter="url(#${shadowId})"/>
            <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central"
              class="note-label" font-size="${size * GEOMETRY.fontSize}px">${this.notes[i]}</text>
          </g>`
          )
          .join('')}
      </svg>
      <div class="floating-layer"></div>
    `;

    this.bindEvents();
    this._startBreathing();
  }

  bindEvents() {
    const svg = this.container.querySelector('svg');
    svg.addEventListener('pointerdown', this._boundPointerDown);
    svg.addEventListener('keydown', this._boundKeyDown ||= this._handleKeyDown.bind(this));
  }

  destroy() {
    const svg = this.container.querySelector('svg');
    svg?.removeEventListener('pointerdown', this._boundPointerDown);
    if (this._boundKeyDown) svg?.removeEventListener('keydown', this._boundKeyDown);
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  /** Accessibilité clavier : Entrée/Espace sur une note focusée déclenche la frappe. */
  _handleKeyDown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const group = e.target.closest('.note-group');
    if (!group) return;
    e.preventDefault();
    const index = Number(group.dataset.index);
    this.triggerHitFeedback(index);
    this.onNoteHit?.(index, group);
  }

  _handlePointerDown(e) {
    const group = e.target.closest('.note-group');
    if (!group) return;
    const index = Number(group.dataset.index);
    this.triggerHitFeedback(index);
    this.onNoteHit?.(index, group);
  }

  /** Feedback visuel obligatoire (§4) : pulsation + onde. Le nombre flottant est ajouté par
   * l'appelant (main.js) car il connaît le gain réel à afficher. */
  triggerHitFeedback(index, { strong = false } = {}) {
    const group = this.container.querySelector(`.note-group[data-index="${index}"]`);
    if (!group) return;
    group.classList.add('active');
    if (strong) group.classList.add('active-strong');
    setTimeout(() => group.classList.remove('active', 'active-strong'), 400);
    this._spawnRipple(group, index === 0);
  }

  /**
   * Surligne la note que le joueur doit frapper (pattern en cours). `null` efface.
   * Distinct du flash de frappe : celui-ci reste tant que la note est attendue.
   */
  setExpectedNote(index) {
    this.container.querySelectorAll('.note-group.expected').forEach((g) => g.classList.remove('expected'));
    if (index === null || index === undefined) return;
    this.container.querySelector(`.note-group[data-index="${index}"]`)?.classList.add('expected');
  }

  spawnGain(index, text) {
    const group = this.container.querySelector(`.note-group[data-index="${index}"]`);
    const layer = this.container.querySelector('.floating-layer');
    if (!group || !layer) return;
    const x = Number(group.dataset.x);
    const y = Number(group.dataset.y);
    spawnFloatingNumber(layer, x, y, text);
  }

  _spawnRipple(group, isCenter) {
    const svg = this.container.querySelector('svg');
    const waveContainer = svg.querySelector('.wave-container');
    if (!waveContainer) return;
    const x = Number(group.dataset.x);
    const y = Number(group.dataset.y);
    const baseRadius = this.size * (isCenter ? GEOMETRY.dingSize : GEOMETRY.noteSize);

    const wave = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    wave.setAttribute('cx', x);
    wave.setAttribute('cy', y);
    wave.setAttribute('r', baseRadius);
    wave.setAttribute('class', 'wave-ring');
    wave.style.transformOrigin = `${x}px ${y}px`;
    wave.style.animation = 'panidle-wave-expand 0.6s ease-out forwards';
    waveContainer.appendChild(wave);
    setTimeout(() => wave.remove(), 650);
  }

  /** Respiration idle (§10.1) : scale = 1 + 0.03*sin(t*freq + phase), phase décalée par note. */
  _startBreathing() {
    const loop = (t) => {
      const elapsed = (t - this._startTime) / 1000;
      const groups = this.container.querySelectorAll('.note-group');
      groups.forEach((g, i) => {
        const phase = i * 0.7;
        const scale = 1 + 0.03 * Math.sin(elapsed * 1.4 + phase);
        g.style.transform = `scale(${scale})`;
      });
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
}
