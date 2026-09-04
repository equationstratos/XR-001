/**
 * Parametrage unique du modele. Toutes les cotes sont en METRES (1 u = 1 m).
 *
 * Architecture retenue (contrainte : tout doit tenir dans un tube de
 * calibre 40 mm, soit un rayon interieur de 17,8 mm) :
 *
 *   y = +72   ┌──────────┐  tete optronique (Ø 36)
 *   y = +48   ├──────────┤  cloison haute / axes d'articulation (y = +44)
 *             │  epine   │  zone de repliage : ame centrale Ø 10 seulement,
 *             │  + bras  │  l'anneau r = 5,5 → 15,5 mm est reserve aux
 *   y = -48   ├──────────┤  4 bras replies et a leurs moteurs
 *             │  soute   │  energie 2S + avionique (Ø 36)
 *   y = -96   ├──────────┤
 *             │  ogive   │  module de charge utile generique (inerte)
 *   y = -133  └──────────┘
 *
 * Longueur stockee = 205 mm = longueur du tube. Modifier ces valeurs
 * suffit a regenerer entierement la geometrie.
 */

export const MM = 0.001;

export const D = {
  // --- enveloppe de lancement : calibre 40 mm ---
  caliber: 40 * MM,
  tubeLen: 205 * MM,
  tubeWall: 2.2 * MM,

  // --- epine centrale (zone de repliage des bras) ---
  bodyR: 5.0 * MM,
  bodyLen: 96 * MM,
  railW: 4 * MM,
  railT: 1.4 * MM,
  railCount: 4,
  ringT: 3 * MM,
  bulkheadR: 18 * MM,

  // --- soute energie / avionique ---
  bayR: 18 * MM,
  bayLen: 48 * MM,
  bayRailW: 9 * MM,
  bayRailT: 1.6 * MM,

  // --- tete optronique ---
  headR: 18 * MM,
  headLen: 24 * MM,
  lensR: 6.2 * MM,

  // --- module de charge utile generique ---
  noseLen: 37 * MM,
  noseR: 19.4 * MM,
  ogiveRatio: 0.74,

  // --- bras repliables ---
  armCount: 4,
  armLen: 78 * MM,
  armR: 3.0 * MM,
  hingeR: 8.5 * MM,       // rayon d'implantation de l'axe
  hingeY: 44 * MM,        // hauteur de l'axe
  armDihedral: 4,         // degres au-dessus de l'horizontale en vol
  armSweep: 45,           // azimut du premier bras (configuration en X)

  // --- propulsion ---
  motorR: 5.5 * MM,
  motorH: 9 * MM,
  motorOff: 0.5 * MM,     // decalage du moteur au-dessus de l'axe du bras
  hubR: 3.4 * MM,
  bladeCount: 2,
  bladeLen: 41 * MM,
  bladeChord: 9.5 * MM,
  bladeThick: 1.15 * MM,
  bladePitch: 22,         // degres de vrillage racine -> saumon
  rpm: 24000,

  // --- internes ---
  cellR: 6.4 * MM,
  cellLen: 42 * MM,
  pcbW: 20 * MM,
  pcbH: 34 * MM,
  pcbT: 1.3 * MM,
};

/** Anchors axiaux derives (repere drone, origine = centre de l'epine). */
export const Y = {
  cageTop: D.bodyLen / 2,                 // +48
  cageBot: -D.bodyLen / 2,                // -48
  headTop: D.bodyLen / 2 + D.headLen,     // +72
  bayBot: -D.bodyLen / 2 - D.bayLen,      // -96
  noseTip: -D.bodyLen / 2 - D.bayLen - D.noseLen, // -133
};

/** Vue eclatee : direction (x,y,z) + amplitude par sous-ensemble. */
export const EXPLODE = {
  head:   [0, 1, 0, 0.075],
  bay:    [0, -1, 0, 0.07],
  nose:   [0, -1, 0, 0.10],
  cells:  [0, 0, 1, 0.06],
  pcb:    [-1, 0, 0, 0.06],
  arms:   [0, 0, 0, 0.045],
  tube:   [1, -0.35, 0, 0.26],
};

/** Sequence : bornes temporelles normalisees (0 -> 1) de chaque phase. */
export const SEQ = {
  eject:  [0.00, 0.26],
  arms:   [0.24, 0.58],
  blades: [0.46, 0.76],
  spin:   [0.62, 1.00],
};

export const PHASES = [
  [0.00, 'Configuration stockée (tube 40 mm)'],
  [0.05, 'Éjection — sortie de tube'],
  [0.28, 'Stabilisation — déverrouillage des bras'],
  [0.50, 'Déploiement des bras (4 × 90°)'],
  [0.70, 'Dépliage des pales'],
  [0.86, 'Montée en régime rotors'],
  [0.99, 'Configuration de vol'],
];

const mm = (v) => `${Math.round(v / MM)} mm`;

export const SPECS = [
  ['Calibre', 'Ø 40 mm'],
  ['Longueur stockée', mm(Y.headTop - Y.noseTip)],
  ['Envergure déployée', mm(2 * (D.hingeR + D.armLen + D.bladeLen + D.hubR))],
  ['Rotors', '4 × bipale repliable'],
  ['Ø rotor', mm(2 * (D.bladeLen + D.hubR))],
  ['Régime max', `${D.rpm.toLocaleString('fr-FR')} tr/min`],
  ['Structure', 'Carbone / alu 7075'],
  ['Énergie', '2 × élément Li-ion'],
  ['Charge utile', 'Module avant modulaire'],
];
