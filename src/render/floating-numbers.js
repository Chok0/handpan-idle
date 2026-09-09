// Nombres flottants "+X ♫" — §10.1 : "trajectoire arquée procédurale" (Math.sin, pas de sprite).
export function spawnFloatingNumber(layer, x, y, text) {
  const el = document.createElement('div');
  el.className = 'floating-number';
  // `text` contient du balisage produit par nous (montant + icône handpan), jamais
  // de saisie utilisateur : innerHTML est sûr ici et nécessaire pour rendre l'icône.
  el.innerHTML = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  layer.appendChild(el);
  // Centré sur la note et remonté au-dessus d'elle : posé sur ses coordonnées brutes, le
  // gain se superposait au nom de la note ("Bb+1" au lieu de "Bb3" surmonté de "+1").
  // Des marges, pas un transform : la boucle d'animation écrase `transform` à chaque frame.
  el.style.marginLeft = `${-el.offsetWidth / 2}px`;
  el.style.marginTop = `${-el.offsetHeight - 26}px`;

  const start = performance.now();
  const duration = 900;
  const rise = 70;
  const arcWidth = (Math.random() - 0.5) * 50;

  function frame(t) {
    const progress = Math.min(1, (t - start) / duration);
    const dx = arcWidth * Math.sin(progress * (Math.PI / 2)); // dérive latérale arquée
    const dy = -rise * progress;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.opacity = String(1 - progress);
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      el.remove();
    }
  }
  requestAnimationFrame(frame);
}
