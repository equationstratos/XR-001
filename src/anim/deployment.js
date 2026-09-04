import * as THREE from 'three';
import { D, SEQ, LAUNCH, MECH, PHASES } from '../config.js';

const RAD = Math.PI / 180;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (t, [a, b]) => clamp01((t - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
/** Depassement leger : ressort d'ouverture + verrouillage en butee. */
const overshoot = (x) => {
  const s = smooth(x);
  return s + Math.sin(Math.PI * s) * (1 - s) * 0.2;
};

/**
 * Pilote la cinematique complete a partir d'un unique parametre t ∈ [0,1].
 *
 * Point cle : le deploiement n'est PAS une simple fenetre temporelle. Les bras
 * et les pales sont asservis au degagement de bouche `clear` (en longueurs de
 * bras), lui-meme calcule a partir des positions animees du projectile et du
 * lanceur. Tant que le bras est dans le tube, il reste plaque contre le fut ;
 * il ne s'ouvre qu'une fois integralement sorti. Consequence visible :
 * l'ouverture est claquante et se produit exactement a la sortie du tube,
 * quelle que soit la vitesse de lecture ou la position du curseur.
 *
 * L'etat est entierement deterministe (aucune integration), sauf la rotation
 * des rotors et le flottement de vol qui sont integres dans le temps.
 */
/**
 * Angle de repos du bras replie. Le ressort le pousse en permanence : il vient
 * donc porter sur la face interne du carenage, legerement ouvert.
 *   sin θ_repos = (r_carenage − r_axe − r_bras) / L = (16 − 8,5 − 3) / 78
 * soit 3,3° — c'est la seule ouverture possible tant que le bras est engage.
 */
const REST = Math.asin((MECH.shroudRi - D.hingeR - D.armR) / D.armLen);
const FOLDED = Math.PI / 2 - REST;

export class Deployment {
  constructor(drone) {
    this.drone = drone;
    this.t = 0;
    this.playing = false;
    this.loop = false;
    this.spin = true;
    this.duration = 11;      // secondes pour la sequence complete
    this._spinAngle = 0;
    this._bob = 0;
    this.clear = 0;
    this.apply(0, 0);
  }

  play(from = null) {
    if (from !== null) this.t = from;
    if (this.t >= 0.999) this.t = 0;
    this.playing = true;
  }
  pause() { this.playing = false; }
  toggle() { this.playing ? this.pause() : this.play(); }

  /** @returns {boolean} true si l'etat a change (declenche un rendu). */
  update(dt) {
    let changed = false;
    if (this.playing) {
      this.t += dt / this.duration;
      if (this.t >= 1) {
        this.t = 1;
        if (this.loop) this.t = 0;
        else this.playing = false;
      }
      changed = true;
    }
    const spinning = this.spin && this.t > SEQ.spin[0];
    if (spinning || changed) { this.apply(this.t, dt); changed = true; }
    return changed;
  }

  apply(t, dt = 0) {
    const { drone } = this;
    const body = drone.root, tube = drone.tube;
    const L = LAUNCH;

    // --- 1. tir : le projectile quitte le tube ------------------------
    // Profil de vitesse quasi constant (sur 20 cm, la deceleration
    // gravitaire est negligeable) avec une legere retombee en fin de course.
    const u = span(t, SEQ.eject);
    const travel = 1 - Math.pow(1 - u, L.decel);
    body.position.y = travel * L.rise;
    tube.position.y = drone._rest.get(tube).y - travel * L.drop;

    // --- 2. degagement de bouche, exprime en longueurs de bras ---------
    const muzzle = tube.position.y + D.tubeLen / 2;
    const clear = (body.position.y + D.hingeY - muzzle) / D.armLen;
    this.clear = clear;

    // le lanceur ne bascule qu'une fois le projectile hors d'atteinte
    const away = smooth(clamp01((clear - 1.2) / 1.3));
    tube.rotation.z = away * 0.13;
    tube.rotation.x = -away * 0.06;

    // roulis de stabilisation acquis dans le tube, amorti apres la sortie :
    // l'angle est monotone croissant et sature (il ne se "devisse" jamais).
    const roll = 1 - Math.pow(1 - clamp01(clear / 2.4), 2);
    body.rotation.y = roll * L.spinAxial * Math.PI * 2;

    // --- 3. ouverture des bras (asservie au degagement) ---------------
    let armT = 0;
    for (let i = 0; i < drone.arms.length; i++) {
      const arm = drone.arms[i];
      const order = i % 2;                                  // paires opposees
      const c = (clear - L.armFree - order * L.armStagger) / L.armSpan;
      const ta = overshoot(clamp01(c));
      if (i === 0) armT = ta;
      // butee mecanique tant que le bras est encore engage dans le tube
      const angle = THREE.MathUtils.lerp(FOLDED, -D.armDihedral * RAD, ta);
      arm.hinge.rotation.x = angle;

      // --- mecanisme ---
      // le ressort de torsion est encastre d'un cote sur la chape, de l'autre
      // sur le bras : sa spire tourne donc de la moitie de l'angle d'ouverture.
      arm.coil.rotation.x = angle / 2;

      // le talon efface le doigt de verrouillage en fin de course, puis le
      // laisse ressortir derriere lui : le repliage devient impossible.
      const push = smooth(clamp01((ta - 0.78) / 0.14)) * (1 - smooth(clamp01((ta - 0.94) / 0.055)));
      arm.plunger.position.y = arm.restPlungerY - push * MECH.latchTravel;
      arm.lspring.scale.y = 1 - 0.55 * push;
      arm.ta = ta;
      arm.locked = ta >= 0.99;

      // --- 4. depliage des pales ---
      const tb = smooth(clamp01((clear - L.bladeStart - order * 0.05) / L.bladeSpan));
      // ouverture en ciseaux : charnieres deportees de part et d'autre du
      // moyeu, les deux pales tournent en sens opposes.
      for (let j = 0; j < arm.blades.length; j++) {
        arm.blades[j].rotation.y = Math.PI / 2 + (j === 0 ? -1 : 1) * (Math.PI / 2) * tb;
      }
    }

    // --- 5. montee en regime ------------------------------------------
    const rpmFrac = smooth(span(t, SEQ.spin));
    if (this.spin && dt > 0) {
      // ralenti x0,012 : a 24 000 tr/min et 60 Hz une pale ferait 6,7 tours
      // par image et deviendrait illisible.
      this._spinAngle += (D.rpm / 60) * Math.PI * 2 * dt * 0.012 * rpmFrac;
    }
    for (let i = 0; i < drone.arms.length; i++) {
      drone.arms[i].hub.rotation.y = this._spinAngle * (i % 2 ? -1 : 1);
    }

    // --- 6. tenue de vol : leger flottement ---------------------------
    if (dt > 0) this._bob += dt;
    const hover = rpmFrac * 0.5;
    body.position.y += Math.sin(this._bob * 1.7) * 0.0022 * hover;
    body.rotation.z = Math.sin(this._bob * 0.9) * 0.02 * hover;
    body.rotation.x = Math.cos(this._bob * 1.3) * 0.018 * hover;

    this.rpm = Math.round(rpmFrac * D.rpm);
    this.armAngle = Math.round(90 - THREE.MathUtils.radToDeg(drone.arms[0].hinge.rotation.x));
    this.locked = drone.arms[0].locked;
  }

  get phaseName() {
    let name = PHASES[0][1];
    for (const [th, n] of PHASES) if (this.t >= th) name = n;
    return name;
  }
}
