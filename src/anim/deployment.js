import * as THREE from 'three';
import { D, SEQ, LAUNCH, MECH, PHASES } from '../config.js';
import {
  TH_REST, TH_DEP, sliderOffset, springLength, linkPose, transmission, S_REST,
} from '../model/linkage.js';

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
// Angle de repos du bras replie (il porte sur la face interne du carenage) et
// angle en vol : tous deux definis dans le module de tringlerie, qui en derive
// aussi les positions extremes du poussoir.
const FOLDED = TH_REST;

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
    this.cycle = false;
    this.cycleDuration = 5;   // secondes par aller simple
    this._cycleT = 0;
    this.apply(0, 0);
  }

  play(from = null) {
    if (from !== null) this.t = from;
    if (this.t >= 0.999) this.t = 0;
    this.playing = true;
  }
  pause() { this.playing = false; }
  toggle() { this.playing ? this.pause() : this.play(); }

  /**
   * Cycle mecanisme : ouvre et referme les bras en boucle, projectile deja
   * sorti du tube, pour observer le train de commande a loisir. Le degagement
   * de bouche est court-circuite — c'est un banc d'essai, pas un tir.
   */
  setCycle(on) {
    this.cycle = on;
    if (on) { this.playing = false; this._cycleT = 0; }
    else this.apply(this.t, 0);
  }

  /** @returns {boolean} true si l'etat a change (declenche un rendu). */
  update(dt) {
    if (this.cycle) {
      this._cycleT += dt / this.cycleDuration;
      const u = this._cycleT % 2;
      this.applyCycle(smooth(u < 1 ? u : 2 - u), dt);
      return true;
    }
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

  /**
   * Pose l'ensemble du train de commande a partir d'un seul parametre
   * d'ouverture. Partage par la sequence de tir et par le cycle mecanisme :
   * il n'existe qu'une seule description du mecanisme dans le code.
   * @returns {number} l'angle de bras correspondant (radians)
   */
  poseMechanism(armT) {
    const { drone } = this;
    const angle = THREE.MathUtils.lerp(FOLDED, TH_DEP, armT);
    const p = linkPose(angle);

    for (const arm of drone.arms) {
      arm.hinge.rotation.x = angle;
      arm.ta = armT;
      // Bielle : origine sur le maneton d'etoile, orientation donnee par la
      // resolution en forme fermee. Son entraxe est donc exactement nominal a
      // chaque image, jamais approche.
      arm.link.position.set(0, p.y, p.z);
      arm.link.rotation.x = p.angle;
    }

    const s = sliderOffset(angle);
    drone.slider.position.y = D.hingeY + s;
    drone.spring.scale.y = springLength(angle);

    // le cran tombe derriere le coulisseau en haut de course : celui-ci ne
    // peut plus redescendre, donc aucun bras ne peut se replier.
    const push = smooth(clamp01((armT - 0.80) / 0.14)) * (1 - smooth(clamp01((armT - 0.95) / 0.05)));
    drone.detentFinger.position.x = MECH.rodR + 2.4 * 0.001 + push * MECH.detentTravel;

    this.stroke = s - S_REST;
    this.locked = armT >= 0.99;
    this.armAngle = Math.round(90 - THREE.MathUtils.radToDeg(angle));
    this.transmission = Math.round(transmission(angle));
    return angle;
  }

  /** Banc d'essai : projectile deja sorti, on ne joue que le mecanisme. */
  applyCycle(armT, dt) {
    const { drone } = this;
    drone.root.position.y = LAUNCH.rise;
    drone.root.rotation.set(0, 0, 0);
    drone.tube.visible = false;
    this.poseMechanism(armT);
    for (const arm of drone.arms) {
      for (const b of arm.blades) b.rotation.y = Math.PI / 2;   // pales repliees
    }
    this.clear = 99;
    this.rpm = 0;
    if (dt > 0) this._bob += dt;
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
    // Les quatre bras sont attaques par le MEME poussoir : il n'y a donc plus
    // qu'un seul angle, et aucun decalage entre paires n'est possible. C'est
    // la propriete recherchee en adoptant la tringlerie.
    const armT = overshoot(clamp01((clear - L.armFree) / L.armSpan));
    const angle = this.poseMechanism(armT);
    const tb = smooth(clamp01((clear - L.bladeStart) / L.bladeSpan));

    // --- 4. depliage des pales ---
    // ouverture en ciseaux : charnieres deportees de part et d'autre du
    // moyeu, les deux pales tournent en sens opposes.
    for (const arm of drone.arms) {
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
  }

  get phaseName() {
    let name = PHASES[0][1];
    for (const [th, n] of PHASES) if (this.t >= th) name = n;
    return name;
  }
}
