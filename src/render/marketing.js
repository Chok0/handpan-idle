// Stratégie marketing "Wanna get the real thing?" — §12. Chaque fonction retourne au plus
// un descripteur de bannière CTA à afficher, ou `null` si rien à montrer. Ne décide jamais
// D'AFFICHER (main.js choisit le moment, en évitant frappe active/pattern en cours, §12.2).
import { getMasterPan } from '../data/master-pans.js';

const GENERIC_BOUTIQUE_URL = 'https://mistralpans.fr/boutique';

export function onMasterPanUnlocked(engine, masterPanId) {
  const pan = getMasterPan(masterPanId);
  if (!pan.productUrl) return null;
  const ctaId = `masterpan:${masterPanId}`;
  if (engine.hasCtaBeenSeen(ctaId)) return null;
  engine.markCtaSeen(ctaId);
  return {
    id: ctaId,
    text: `Vous jouez maintenant sur un ${pan.label} — voir le vrai modèle en boutique →`,
    linkUrl: pan.productUrl,
    linkLabel: 'Voir en boutique',
  };
}

export function onPatternFinished(engine, patternId) {
  const pan = getMasterPan(engine.state.activeMasterPan);
  const url = pan.productUrl || GENERIC_BOUTIQUE_URL;
  const ctaId = `pattern:${patternId}`;
  if (engine.hasCtaBeenSeen(ctaId)) return null;
  engine.markCtaSeen(ctaId);
  return {
    id: ctaId,
    text: 'Envie de jouer ça pour de vrai ?',
    linkUrl: url,
    linkLabel: 'Découvrir →',
  };
}

/** "Au retour de session" (§12.2) : pas de dédoublonnage via ctaSeen, on veut le rappel
 * à chaque retour significatif — mais seulement si un minimum a été gagné, pour ne pas
 * spammer sur un aller-retour de quelques secondes entre onglets. */
export function onOfflineReturn(earned, formatNumber) {
  if (earned < 10) return null;
  return {
    id: null,
    text: `Pendant votre absence, l'atelier a fabriqué ${formatNumber(earned)} handpans.`,
    linkUrl: null,
    linkLabel: null,
  };
}

export function buildShareText(state) {
  const pan = getMasterPan(state.activeMasterPan);
  return `J'ai fabriqué ${Math.floor(state.totalHandpansMade).toLocaleString('fr-FR')} handpans dans PanIdle, actuellement sur un ${pan.label} !`;
}
