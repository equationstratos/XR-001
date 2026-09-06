import { D, MECH } from '../config.js';

/* ------------------------------------------------------------------ *
 * Cinematique de la tringlerie bielle-manivelle.
 *
 * Un seul poussoir axial commande les quatre bras. La contrainte de
 * bielle |C - B| = L est resolue en FORME FERMEE, ce qui garantit que la
 * tringlerie dessinee est exactement coherente a chaque image : la
 * bielle a toujours sa longueur nominale, quel que soit l'angle du bras
 * ou la position du curseur de phase.
 *
 * Repere du bras : u = radial, v = axial, origine sur l'axe d'articulation.
 * L'angle θ est celui de `hinge.rotation.x` : 0 = deploye, +90° = replie.
 * ------------------------------------------------------------------ */

const RAD = Math.PI / 180;

const A = MECH.crank;                     // longueur de manivelle
const PHI = MECH.crankPhi * RAD;          // calage de la manivelle
const L = MECH.link;                      // entraxe de bielle
const BU = MECH.rodPin - D.hingeR;        // maneton d'etoile, en radial

/**
 * Angle de repos du bras replie. Le ressort le pousse en permanence, le bras
 * vient donc porter sur la face interne du carenage. La piece qui touche n'est
 * PAS le tube du bras mais le TRAIN ROTOR en bout : une fois le bras replie,
 * la hauteur du moteur et du moyeu devient RADIALE et pese bien plus que le
 * rayon du fuseau. On resout donc, en prenant la racine voisine de 90° :
 *
 *     stackH·sin θ + L_bras·cos θ = r_carenage - r_axe
 *
 * Utiliser le rayon du fuseau donnait 3,3° d'ouverture au repos, et a cet
 * angle le rotor sortait de 7 mm hors du calibre.
 */
const REST_R = MECH.shroudRi - D.hingeR;
const REST_A = Math.hypot(MECH.stackH, D.armLen);
export const TH_REST = Math.PI
  - Math.asin(Math.min(1, REST_R / REST_A))
  - Math.atan2(D.armLen, MECH.stackH);
export const TH_DEP = -D.armDihedral * RAD;

/** Maneton de manivelle, porte par le pied de bras. */
export function crankPoint(theta) {
  const psi = theta + PHI;
  return { u: A * Math.cos(psi), v: -A * Math.sin(psi) };
}

/**
 * Position axiale du poussoir imposee par l'angle du bras.
 * Branche basse : le poussoir descend vers la queue quand les bras s'ouvrent,
 * le ressort de compression le pousse donc depuis son siege haut.
 */
export function sliderOffset(theta) {
  const { u, v } = crankPoint(theta);
  const d = L * L - (u - BU) * (u - BU);
  return v - Math.sqrt(Math.max(0, d));
}

export const S_REST = sliderOffset(TH_REST);
export const S_DEP = sliderOffset(TH_DEP);
export const STROKE = S_REST - S_DEP;

/**
 * Pose d'une bielle. Les deux manetons sont dans le plan x = 0 du repere
 * de bras : une seule rotation autour de X suffit, pas de quaternion.
 * Renvoie l'origine (extremite cote poussoir) et l'angle a appliquer.
 */
export function linkPose(theta) {
  const s = sliderOffset(theta);
  const { u, v } = crankPoint(theta);
  const dy = v - s;
  const dz = D.hingeR + u - MECH.rodPin;
  return { y: s, z: MECH.rodPin, angle: Math.atan2(-dy, dz) };
}

/**
 * Angle de transmission entre la bielle et la manivelle : c'est lui qui
 * mesure le rendement du mecanisme. Le couple rendu au bras vaut
 * F·a·sin(mu) ; un angle proche de 0 serait un point mort.
 */
export function transmission(theta) {
  const s = sliderOffset(theta);
  const { u, v } = crankPoint(theta);
  const lk = [BU - u, s - v];
  const cr = [u, v];
  const n = Math.hypot(lk[0], lk[1]) * Math.hypot(cr[0], cr[1]);
  if (n === 0) return 0;
  const a = Math.acos(Math.max(-1, Math.min(1, (lk[0] * cr[0] + lk[1] * cr[1]) / n)));
  return Math.min(a, Math.PI - a) / RAD;
}
