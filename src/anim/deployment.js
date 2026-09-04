import * as THREE from 'three';
import { D, SEQ, PHASES } from '../config.js';

const RAD = Math.PI / 180;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (t, [a, b]) => clamp01((t - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
/** Depassement leger : ressort de verrouillage des bras. */
const overshoot = (x, k = 1.7) => {
  const s = smooth(x);
  return s + Math.sin(Math.PI * s) * (1 - s) * 0.12 * k;
};

const EJECT_RISE = 0.10;
const TUBE_DROP = 0.11;

/**
 * Pilote la cinematique complete a partir d'un unique parametre t ∈ [0,1].
 * L'etat est entierement deterministe (aucune integration), sauf la
 * rotation des rotors qui est integree dans le temps.
 */
export class Deployment {
  constructor(drone) {
    this.drone = drone;
    this.t = 0;
    this.playing = false;
    this.loop = false;
    this.spin = true;
    this.duration = 9;      // secondes pour la sequence complete
    this._spinAngle = 0;
    this._bob = 0;
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
    const M = drone.root, tube = drone.tube;

    // --- 1. ejection ---
    const e = smooth(span(t, SEQ.eject));
    M.position.y = e * EJECT_RISE;
    tube.position.y = drone._rest.get(tube).y - e * TUBE_DROP;
    tube.rotation.z = e * 0.10;
    tube.rotation.x = -e * 0.05;

    // --- 2. deploiement des bras (sequence croisee 1-3 / 2-4) ---
    const [a0, a1] = SEQ.arms;
    const [b0, b1] = SEQ.blades;
    const stag = 0.035;
    let rpmFrac = 0;

    for (let i = 0; i < drone.arms.length; i++) {
      const arm = drone.arms[i];
      const order = i % 2 === 0 ? 0 : 1;                 // paires opposees
      const ta = overshoot(span(t, [a0 + order * stag, a1 + order * stag]));
      arm.hinge.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, -D.armDihedral * RAD, ta);

      // --- 3. depliage des pales ---
      const tb = smooth(span(t, [b0 + order * stag, b1 + order * stag]));
      // repliees, les pales pointent vers l'axe d'articulation (elles se
      // rangent le long du bras) ; deployees, elles sont dans le plan rotor.
      for (let j = 0; j < arm.blades.length; j++) {
        const base = j === 0 ? Math.PI / 2 : -Math.PI / 2;
        arm.blades[j].rotation.y = base - (Math.PI / 2) * tb;
      }
    }

    // --- 4. montee en regime ---
    rpmFrac = smooth(span(t, SEQ.spin));
    if (this.spin && dt > 0) {
      this._spinAngle += (D.rpm / 60) * Math.PI * 2 * dt * 0.012 * rpmFrac; // ralenti x0.012 (lisibilite)
    }
    for (let i = 0; i < drone.arms.length; i++) {
      drone.arms[i].hub.rotation.y = this._spinAngle * (i % 2 ? -1 : 1);
    }

    // --- 5. tenue de vol : leger flottement ---
    if (dt > 0) this._bob += dt;
    const hover = rpmFrac * 0.5;
    M.position.y += Math.sin(this._bob * 1.7) * 0.0022 * hover;
    M.rotation.z = Math.sin(this._bob * 0.9) * 0.02 * hover;
    M.rotation.x = Math.cos(this._bob * 1.3) * 0.018 * hover;

    this.rpm = Math.round(rpmFrac * D.rpm);
  }

  get phaseName() {
    let name = PHASES[0][1];
    for (const [th, n] of PHASES) if (this.t >= th) name = n;
    return name;
  }
}
