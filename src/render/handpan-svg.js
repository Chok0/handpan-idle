// Rendu SVG du handpan — inspiré de js/features/handpan-player.js (Mistral Pans) pour
// l'algorithme de placement des notes en cercle et l'esthétique (coque en gradient radial),
// mais réécrit sans dépendance à MistralScales/l'audio FLAC (le jeu synthétise ses sons, §8).
import { spawnFloatingNumber } from './floating-numbers.js';

let instanceCounter = 0;

/**
 * Place les notes : le Ding (index 0) au centre-haut, les suivantes en cercle en
 * alternant droite/gauche (zigzag descendant) — même algorithme que le player du site.
 */
export function computeNotePositions(noteCount, center, outerRadius, innerRadius) {
  const positions = [{ x: center, y: center - innerRadius * 0.5 }];
  const remaining = noteCount - 1;
  if (remaining <= 0) return positions;

  const startAngle = -Math.PI / 2 + Math.PI / remaining;
  for (let i = 0; i < remaining; i++) {
    const index = i % 2 === 0 ? Math.floor(i / 2) : remaining - 1 - Math.floor(i / 2);
    const angle = startAngle + (index * 2 * Math.PI) / remaining;
    positions.push({
      x: center + Math.cos(angle) * outerRadius,
      y: center + Math.sin(angle) * outerRadius,
    });
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
    const outerRadius = size * 0.42;
    const innerRadius = size * 0.15;
    const noteRadius = size * 0.09;
    const positions = computeNotePositions(this.notes.length, center, outerRadius, innerRadius);
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
        <circle cx="${center}" cy="${center}" r="${size * 0.46}" fill="url(#${gradId})"/>
        <circle cx="${center}" cy="${center}" r="${size * 0.44}" fill="none" stroke="#909090" stroke-width="1.5"/>
        <g class="wave-container"></g>
        ${positions
          .map(
            (pos, i) => `
          <g class="note-group" data-index="${i}" data-x="${pos.x}" data-y="${pos.y}" tabindex="0" role="button" aria-label="Note ${this.notes[i]}">
            <circle cx="${pos.x}" cy="${pos.y}" r="${i === 0 ? noteRadius * 1.3 : noteRadius}"
              class="note-circle" filter="url(#${shadowId})"/>
            <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central"
              class="note-label" font-size="${size * 0.035}px">${this.notes[i]}</text>
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
    const baseRadius = this.size * 0.09 * (isCenter ? 1.3 : 1);

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
