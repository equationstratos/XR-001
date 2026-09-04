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

/**
 * MECANISME DE DEPLOIEMENT — cotes de la chaine reelle.
 *
 * Chaine par bras (4 exemplaires identiques) :
 *   chape 7075 a deux joues  ->  axe Ø1,5 acier inox retenu par circlips
 *   ressort de torsion Ø0,6 monte en porte-a-faux sur l'axe (25 mN·m)
 *   butee usinee dans la chape + pastille elastomere (encaisse 41 mJ)
 *   doigt de verrouillage Ø2,2 pousse par un ressort de compression :
 *   le talon du bras l'efface en fin de course puis il ressort derriere lui,
 *   interdisant le repliage (deverrouillage a l'outil).
 *
 * Dimensionnement du ressort de torsion (verifiable) :
 *   inertie d'un bras autour de l'axe  I = m_mot·L² + m_bras·L²/3 ≈ 5,4e-5 kg·m²
 *   objectif d'ouverture 90° en 80 ms  ->  α = 2θ/t² ≈ 490 rad/s²
 *   couple necessaire                  C = I·α ≈ 26 mN·m
 *   fil a ressort Ø0,6 : C_max = π·d³·σ/32 ≈ 25 mN·m a σ = 1200 MPa  -> OK
 *   energie a encaisser en butee       E = ½·I·ω² ≈ 41 mJ  -> pastille elastomere
 *   effort du bras sur le fut du tube  F = C/L ≈ 0,32 N par bras -> negligeable
 *
 * Pales : charnieres a vis epaulee Ø1,5 deportees de hubR de part et d'autre
 * du moyeu. Deploiement centrifuge, aucun ressort :
 *   a 3 000 tr/min deja  F = m·ω²·r ≈ 0,9 N pour une pale de 0,35 g
 *   a 20 000 tr/min      F ≈ 38 N  -> plaquage rigide contre la butee du moyeu.
 */
export const MECH = {
  shroudRi: 16 * MM,      // face interne du carenage : butee du bras replie
  cheekR: 5.0 * MM,       // joue de chape
  cheekT: 1.4 * MM,
  cheekGap: 5.2 * MM,     // entraxe interieur = largeur du pied de bras
  pinR: 0.75 * MM,        // axe Ø1,5
  pinLen: 15 * MM,        // deborde pour porter le ressort + circlips
  coilX: 5.6 * MM,        // position du ressort sur l'axe
  coilR: 2.6 * MM,        // rayon moyen d'enroulement
  wire: 0.6 * MM,         // fil du ressort de torsion
  coilTurns: 6,
  coilLen: 4.5 * MM,
  legLen: 7.5 * MM,       // branches radiales du ressort
  latchR: 1.1 * MM,       // doigt de verrouillage Ø2,2
  latchLen: 6.5 * MM,
  latchTravel: 1.9 * MM,  // course d'effacement
  latchY: -6.2 * MM,      // implantation du doigt dans la chape
  latchZ: 2.4 * MM,
  heelR: 4.4 * MM,        // talon usine dans le pied de bras
  bumperR: 1.6 * MM,      // pastille elastomere de butee
  screwR: 0.75 * MM,      // vis epaulee de charniere de pale
};

export const MECH_SPECS = [
  ['Ressort de torsion', 'Ø 0,6 · 6 sp. · 25 mN·m'],
  ['Ouverture d\'un bras', '90° en ≈ 80 ms'],
  ['Énergie en butée', '41 mJ · pastille élastomère'],
  ['Verrouillage', 'doigt Ø 2,2 à ressort, irréversible'],
  ['Effort sur le fût', '0,32 N par bras'],
  ['Charnière de pale', 'vis épaulée Ø 1,5 · sans ressort'],
  ['Déploiement pales', 'centrifuge · 38 N à 20 000 tr/min'],
];

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

/**
 * Sequence. Seuls le lancement et la montee en regime sont pilotes par le
 * temps : le deploiement des bras et des pales est asservi au DEGAGEMENT DE
 * BOUCHE (voir LAUNCH), car un bras ne peut pas s'ouvrir tant qu'il est
 * dans le tube.
 */
export const SEQ = {
  eject: [0.00, 0.62],
  spin:  [0.58, 0.90],
};

/**
 * Lancement. Le degagement `clear` est exprime en LONGUEURS DE BRAS :
 *   clear = (y_axe_articulation - y_bouche) / longueur_de_bras
 * clear < 1  -> une partie du bras est encore dans le tube : il ne peut
 *               s'ouvrir que de asin((r_tube - r_axe) / L) ~ 5,5 deg.
 * clear >= 1 -> le bras est integralement sorti, le ressort le deploie.
 * D'ou une ouverture "claquante" a la sortie de bouche, et non progressive.
 */
export const LAUNCH = {
  rise: 0.07,        // montee du projectile (m)
  drop: 0.17,        // recul apparent du lanceur (m) ; seul le mouvement relatif compte
  decel: 1.25,       // exposant du profil de vitesse (1 = vitesse constante)
  armFree: 1.00,     // degagement a partir duquel le bras est libre
  armSpan: 0.72,     // degagement consomme par l'ouverture d'un bras
  armStagger: 0.07,  // decalage entre les deux paires opposees
  bladeStart: 1.80,  // degagement de debut de depliage des pales
  bladeSpan: 0.65,
  spinAxial: 3.2,    // tours de roulis pendant la sortie de tube (stabilisation)
};

export const PHASES = [
  [0.00, 'Configuration stockée — tube 40 mm'],
  [0.02, 'Tir — le projectile quitte le tube'],
  [0.26, 'Sortie de bouche — libération des bras'],
  [0.31, 'Déploiement des bras (4 × 90°)'],
  [0.44, 'Dépliage des pales'],
  [0.60, 'Montée en régime rotors'],
  [0.92, 'Configuration de vol'],
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
