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
 * MECANISME DE DEPLOIEMENT — bielle-manivelle synchronise.
 *
 * Transposition du mecanisme d'empennage retardateur type "Snakeye" : au lieu
 * de quatre ressorts de torsion independants, UN poussoir axial unique attaque
 * les quatre bras par quatre biellettes. Ce que cela change :
 *
 *   - synchronisation MECANIQUE : les quatre bras sont lies au meme poussoir,
 *     ils ne peuvent pas s'ouvrir en desordre. Un bras qui coince bloque le
 *     poussoir, donc tous les autres : le defaut se voit au sol au lieu de
 *     produire une configuration dissymetrique en vol ;
 *   - un seul ressort au lieu de quatre, loge dans l'epine (volume deja vide) ;
 *   - un seul verrou (cran sur le poussoir) au lieu de quatre doigts.
 *
 * Geometrie, dans le plan du bras (u = radial, v = axial, origine sur l'axe
 * d'articulation) :
 *
 *     maneton d'etoile      B = (rodPin - hingeR, s)     s = position poussoir
 *     maneton de manivelle  C = a·(cos ψ, -sin ψ)        ψ = θ + φ
 *     contrainte de bielle  |C - B| = L
 *
 * Parametres issus d'un balayage sous contraintes d'implantation (le maneton
 * doit rester entre la tige centrale et les lisses, la course doit etre
 * monotone, l'angle de transmission eleve sur toute la course) :
 *
 *     course du poussoir             7,06 mm
 *     angle de transmission          53° a 87° — aucun point mort
 *     rayon balaye par le maneton    3,8 a 6,5 mm — passe entre les lisses
 *
 * Dimensionnement (4 bras, I = 5,4e-5 kg·m² chacun, ouverture 90° en 80 ms) :
 *     energie a fournir     4 × ½·I·ω²        ≈ 165 mJ
 *     couple requis par bras  I·α             ≈ 26 mN·m
 *     couple rendu            F·a·sin μ       -> F ≈ 7 N par bielle
 *     ressort Ø fil 0,9 · Ø moyen 6 · 7 spires actives, libre 15 mm
 *       raideur  k = G·d⁴/(8·D³·n)            ≈ 4,3 N/mm
 *       effort bras replie (fleche 8,57)      ≈ 37 N
 *       precharge bras deploye (fleche 1,52)  ≈ 6,5 N — plaque sur la butee
 *       energie restituee ½k(8,57² - 1,52²)   ≈ 152 mJ
 *       longueur solide 7 × 0,9 = 6,3 mm < 6,4 mm comprime -> ne talonne pas
 *     energie encaissee par butee de bras     ≈ 41 mJ -> pastille elastomere
 *
 * Pales : charnieres a vis epaulee Ø1,5 deportees de hubR de part et d'autre
 * du moyeu. Deploiement centrifuge, aucun ressort :
 *   a 3 000 tr/min deja  F = m·ω²·r ≈ 0,9 N pour une pale de 0,35 g
 *   a 20 000 tr/min      F ≈ 38 N  -> plaquage rigide contre la butee du moyeu.
 */
export const MECH = {
  shroudRi: 16 * MM,      // face interne du carenage : butee du bras replie

  // --- moyeu cruciforme et articulation ---
  cheekR: 5.0 * MM,       // joue de chape
  cheekT: 1.4 * MM,
  cheekGap: 5.2 * MM,     // entraxe interieur = largeur du pied de bras
  pinR: 0.75 * MM,        // axe Ø1,5
  pinLen: 11 * MM,
  collarR: 9.6 * MM,      // rayon hors-tout du moyeu cruciforme
  collarH: 8 * MM,
  boreR: 2.6 * MM,        // alesage central de passage de la tige
  heelR: 4.4 * MM,        // moyeu tourillonnant du pied de bras
  bumperR: 1.6 * MM,      // pastille elastomere de butee

  // --- tringlerie ---
  crank: 4.7 * MM,        // manivelle portee par le pied de bras
  crankPhi: 157.5,        // calage de la manivelle sur l'axe du bras (deg)
  rodPin: 3.0 * MM,       // rayon des manetons sur l'etoile du poussoir
  link: 7.5 * MM,         // entraxe de bielle
  linkT: 0.9 * MM,        // epaisseur d'un flasque de bielle jumelee
  linkGap: 2.6 * MM,      // entraxe interieur des deux flasques
  linkW: 2.4 * MM,        // largeur des flasques

  // --- poussoir ---
  rodR: 1.7 * MM,         // tige de commande Ø3,4
  spiderT: 2.0 * MM,      // epaisseur de l'etoile d'entrainement
  seatY: 48 * MM,         // siege fixe du ressort, sous la cloison haute
  springR: 3.0 * MM,      // rayon moyen du ressort de compression
  springWire: 0.9 * MM,
  springTurns: 7,
  detentR: 0.9 * MM,      // cran de verrouillage du poussoir
  detentTravel: 1.5 * MM,
  detentY: -12 * MM,      // implantation du cran sous le plan d'axe

  // --- pales ---
  screwR: 0.75 * MM,      // vis epaulee de charniere de pale
};

export const MECH_SPECS = [
  ['Architecture', 'bielle-manivelle, 1 poussoir'],
  ['Course du poussoir', '7,06 mm'],
  ['Angle de transmission', '53° à 87° — sans point mort'],
  ['Ressort de commande', 'Ø fil 0,9 · Ø 6 · 7 sp. · 4,3 N/mm'],
  ['Effort replié → déployé', '37 N → 6,5 N de précharge'],
  ['Énergie restituée', '152 mJ · ouverture en ≈ 80 ms'],
  ['Couple rendu par bras', '≈ 26 mN·m'],
  ['Synchronisation', 'mécanique — 4 bras liés'],
  ['Verrouillage', 'cran sur poussoir, irréversible'],
  ['Charnière de pale', 'vis épaulée Ø 1,5 · centrifuge'],
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
  armFree: 1.00,     // degagement a partir duquel les bras sont libres
  armSpan: 0.72,     // degagement consomme par l'ouverture
  // (pas de decalage entre bras : la tringlerie les rend solidaires)
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
