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
  // Le calibre est l'ALESAGE : un projectile de 40 mm remplit un fut de 40 mm,
  // la paroi du tube est a l'exterieur. Rayon utile = 20 mm.
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
  motorH: 8 * MM,
  motorOff: 0,            // moteur strictement dans l'axe du bras : replie,
                          // tout decalage vertical devient de l'encombrement radial
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
 * Montage PARAPLUIE, aux proportions du kit d'origine (bielle / pale = 0,50) :
 * la bielle n'attaque pas une petite manivelle au pied du bras, elle relie le
 * coulisseau central a un point situe LOIN sur le bras (30 mm sur 78, soit
 * 0,38 de sa longueur), exactement comme une baleine de parapluie. Le
 * coulisseau MONTE vers le plan d'articulation pour ouvrir.
 *
 * Geometrie, dans le plan du bras (u = radial, v = axial, origine sur l'axe
 * d'articulation) :
 *
 *     maneton d'etoile      B = (rodPin - hingeR, s)     s = position poussoir
 *     point d'attache       C = a·(cos ψ, -sin ψ)        ψ = θ + φ  (φ = 0)
 *     contrainte de bielle  |C - B| = L
 *
 * Parametres issus d'un balayage sous contraintes d'implantation (course
 * monotone, pas de point mort, tout reste dans l'epine une fois replie) :
 *
 *     course du coulisseau           55,6 mm  (y = -23,3 -> +32,3)
 *     angle de transmission          14° a 89°
 *     bielle / longueur de bras      0,49  (kit : 0,50)
 *
 * L'angle de transmission s'effondre aux deux extremites : c'est la signature
 * du parapluie, dur a amorcer et dur a finir, maximal a mi-course. Le ressort
 * de compression a exactement la caracteristique complementaire — il pousse
 * fort quand il est comprime, c'est-a-dire au repliage, la ou le bras de
 * levier est le plus faible.
 *
 * OU EST LE MOTEUR. Le coulisseau ne motorise plus : il SYNCHRONISE et il
 * verrouille. La force vient de quatre ressorts de torsion montes sur les axes
 * d'articulation eux-memes, donc en haut du drone, juste sous la tete.
 * Raison geometrique : le point d'attache etant porte par le bras, sa cote
 * axiale cv = -a·sin θ croit forcement quand le bras s'ouvre, et les deux
 * branches de la solution font monter le coulisseau. Un ressort qui pousserait
 * par le haut refermerait donc les bras — aucune configuration ne l'evite.
 * Deplacer la fonction motrice sur les axes est la seule facon de mettre le
 * ressort en haut, et elle a deux avantages propres :
 *   - la masse du ressort remonte au voisinage du plan rotor ;
 *   - la tringlerie ne transmet plus que l'ecart entre bras, pas la puissance,
 *     donc bielles et manetons travaillent beaucoup moins.
 *
 * Dimensionnement (4 bras, I = 5,4e-5 kg·m² chacun, ouverture 90° en 80 ms) :
 *     acceleration          α = 2θ/t²         ≈ 490 rad/s²
 *     couple par bras       C = I·α           ≈ 26 mN·m
 *     energie totale        4 × ½·I·ω²        ≈ 165 mJ  (41 mJ par bras)
 *     ressort de torsion Ø fil 0,7 · Ø moyen 5 · 6 spires, sur l'axe
 *       contrainte  σ = Kb·32·C/(π·d³)        ≈ 862 MPa
 *       resistance du fil a ressort Ø0,7      ≈ 2330 MPa
 *       taux de charge au stockage            ≈ 37 %  -> pas de relaxation
 *     energie encaissee par butee de bras     ≈ 41 mJ -> pastille elastomere
 *
 * Le taux de charge est le vrai critere de tenue au stockage prolonge : en
 * restant sous ~40 % de la resistance du fil, un ressort peut demeurer arme
 * indefiniment sans perdre de couple. C'est ce qui repond a la crainte du
 * ressort qui se detend, bien plus que sa position dans le drone.
 *
 * Pales : charnieres a vis epaulee Ø1,5 deportees de hubR de part et d'autre
 * du moyeu. Deploiement centrifuge, aucun ressort :
 *   a 3 000 tr/min deja  F = m·ω²·r ≈ 0,9 N pour une pale de 0,35 g
 *   a 20 000 tr/min      F ≈ 38 N  -> plaquage rigide contre la butee du moyeu.
 */
export const MECH = {
  shroudRi: 18 * MM,      // face interne du carenage : butee du bras replie
  // Encombrement radial du train rotor replie. Il vaut exactement l'anneau
  // disponible (shroudRi - hingeR), ce qui amene l'angle de repos a 90° : le
  // bras se range strictement a plat contre le fuselage, comme il se doit pour
  // un projectile de tube. Toute valeur inferieure laisserait le bras s'ouvrir
  // dans le tube et sortirait le rotor du calibre.
  stackH: 9.5 * MM,

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

  // --- tringlerie (proportions du kit : bielle / pale = 0,50) ---
  crank: 30 * MM,         // point d'attache de la bielle SUR le bras
  crankPhi: 0,            // ... dans l'axe du fuseau : montage parapluie
  rodPin: 3.0 * MM,       // rayon des manetons sur l'etoile du poussoir
  link: 38 * MM,          // entraxe de bielle — 0,49 x la longueur de bras
  linkT: 1.0 * MM,        // epaisseur d'un flasque de bielle jumelee
  linkGap: 2.8 * MM,      // entraxe interieur des deux flasques
  linkW: 2.8 * MM,        // largeur des flasques

  // --- coulisseau (synchroniseur, plus moteur) ---
  rodR: 1.7 * MM,         // mat fixe Ø3,4
  spiderT: 2.2 * MM,      // epaisseur de l'etoile
  shaftBot: -44 * MM,     // pied du mat sur la cloison basse
  detentR: 0.9 * MM,      // cran de verrouillage du coulisseau
  detentTravel: 1.5 * MM,
  detentY: 30 * MM,       // le cran bloque le coulisseau en haut de course

  // --- ressorts de torsion, sur les axes d'articulation (en haut) ---
  coilR: 2.5 * MM,        // rayon moyen d'enroulement (Ø moyen 5)
  wire: 0.7 * MM,         // fil du ressort de torsion
  coilTurns: 6,
  coilLen: 5.2 * MM,
  coilX: 5.6 * MM,        // position du ressort sur l'axe, en porte-a-faux
  legLen: 8 * MM,         // branches radiales

  // --- pales ---
  screwR: 0.75 * MM,      // vis epaulee de charniere de pale
};

export const MECH_SPECS = [
  ['Architecture', 'parapluie — 1 coulisseau, 4 bielles'],
  ['Bielle / longueur de bras', '0,49 (kit d\'origine : 0,50)'],
  ['Point d\'attache sur le bras', '30 mm de l\'axe'],
  ['Course du coulisseau', '55,6 mm'],
  ['Angle de transmission', '14° à 89° — max à mi-course'],
  ['Moteur', '4 ressorts de torsion sur les axes'],
  ['Ressort', 'Ø fil 0,7 · Ø 5 · 6 sp. · 26 mN·m'],
  ['Charge au stockage', '37 % de la résistance du fil'],
  ['Énergie fournie', '165 mJ · ouverture en ≈ 80 ms'],
  ['Rôle du coulisseau', 'synchroniser et verrouiller'],
  ['Verrouillage', 'cran sur coulisseau, irréversible'],
  ['Charnière de pale', 'vis épaulée Ø 1,5 · centrifuge'],
];

/** Vue eclatee : direction (x,y,z) + amplitude par sous-ensemble. */
/**
 * Nomenclature. Elle distingue ce qui s'imprime de ce qui s'achete : sur une
 * piece imprimee on ne taraude pas, chaque percage recoit un insert laiton a
 * chaud. Epaisseur de paroi minimale retenue : 1,4 mm, soit 4 cordons a 0,4.
 */
export const BOM = [
  ['Imprimé PA12 / PETG-CF', 'épine + 4 panneaux de carénage, 2 cloisons, soute, tête, module avant, guide de verrou'],
  ['Usiné alu 7075', 'moyeu cruciforme à 4 chapes, coulisseau, 4 bielles'],
  ['Tube carbone Ø 6 × 1', '4 bras, coupés à 78 mm'],
  ['Carbone stratifié', '8 pales bipales repliables'],
  ['Vis M2 × 6 CHC', '21 — structure'],
  ['Inserts laiton M2', '21 — OD 3,2 × 4, posés à chaud'],
  ['Vis M1,4 × 4', '8 — fixation moteurs, entraxe 6,6'],
  ['Axes inox Ø 1,5', '4 articulations + 8 circlips'],
  ['Vis épaulées Ø 1,5', '8 — charnières de pales'],
  ['Ressorts de torsion', '4 — Ø fil 0,7 · Ø 5 · 6 spires'],
  ['Ressort de verrou', '1 — compression Ø fil 0,3'],
  ['Élastomère', '4 pastilles de butée Ø 3,2'],
  ['Moteurs', '4 — brushless Ø 11 × 8'],
  ['Avionique', 'contrôleur 20 × 20, ESC 4-en-1, émetteur vidéo'],
  ['Optronique', 'module caméra 14 × 14 + objectif'],
  ['Énergie', '2 × Li-ion 13 × 42 en 2S, languettes nickel, BMS'],
];

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
