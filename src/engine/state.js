// Forme de l'état par défaut + migrations de sauvegarde (§10 : "localStorage, JSON versionné").
import { STARTER_MASTER_PAN_ID } from '../data/master-pans.js';

export const STATE_VERSION = 1;

export function createDefaultState() {
  return {
    version: STATE_VERSION,

    handpans: 0, // ♫ en stock, dépensable
    totalHandpansMade: 0, // compteur "à vie", ne décroît jamais — sert de seuil aux améliorations génériques
    totalClicks: 0,
    lastSaveTimestamp: Date.now(),

    tools: { marteau: 0, marteau_pneumatique: 0 },
    employees: { apprenti: 0, ouvrier: 0, accordeur: 0, master_tuner: 0 },
    buildings: {
      niveau1Stage: 0, // 0=Placard clandestin, 1=Cave, 2=Garage
      atelier: 0,
      showroom: 0,
      usine: 0,
      entrepot: 0,
      boutique: 0,
    },
    multipliers: { hydro_formeuse: 0, presse_hydraulique: 0 },

    masterPansUnlocked: [STARTER_MASTER_PAN_ID],
    activeMasterPan: STARTER_MASTER_PAN_ID,
    passiveClickUpgrades: { didgeridoo_drone: false, backing_track: false },
    percussionTier: 0,
    patternsUnlocked: [],
    patternStats: {}, // id -> { timesPlayed, bestPrecision }

    genericUpgradesBought: [],
    accordageUltimeCount: 0,

    settings: {
      volumeMaster: 1,
      volumeNotes: 1,
      volumeAmbient: 1,
      volumePercussion: 1,
      muted: false,
      metronomeAudible: true, // tic de métronome désactivable indépendamment (§8)
    },

    marketing: { ctaSeen: [] }, // ids de CTA déjà montrés (§12.2, éviter le spam)
  };
}

/**
 * Fusionne une sauvegarde chargée avec le state par défaut (tolère les sauvegardes d'une
 * version antérieure du jeu qui n'ont pas encore tous les champs) et fixe la version courante.
 * Point d'extension pour de futures migrations "si version X alors transformer Y".
 */
export function migrateState(raw) {
  if (!raw || typeof raw !== 'object') return createDefaultState();

  const base = createDefaultState();
  const merged = {
    ...base,
    ...raw,
    tools: { ...base.tools, ...raw.tools },
    employees: { ...base.employees, ...raw.employees },
    buildings: { ...base.buildings, ...raw.buildings },
    multipliers: { ...base.multipliers, ...raw.multipliers },
    passiveClickUpgrades: { ...base.passiveClickUpgrades, ...raw.passiveClickUpgrades },
    settings: { ...base.settings, ...raw.settings },
    marketing: { ...base.marketing, ...raw.marketing },
    version: STATE_VERSION,
  };
  return merged;
}
