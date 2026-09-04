import * as THREE from 'three';

/**
 * Vue d'inspection du mecanisme : recadre la camera sur l'articulation du
 * bras n°1 et bascule le jeu de reperes. La cible suit la piece pendant tout
 * le tir (le projectile monte), sans empecher l'utilisateur d'orbiter : on
 * applique a la camera le meme deplacement qu'a la cible.
 */
export class MechView {
  constructor({ viewer, drone, labels, mechLabels }) {
    this.viewer = viewer;
    this.drone = drone;
    this.labels = labels;
    this.mechLabels = mechLabels;
    this.on = false;
    this._anchor = drone.arms[0].hinge;
    this._prev = new THREE.Vector3();
    this._cur = new THREE.Vector3();
    this._delta = new THREE.Vector3();
    mechLabels.setEnabled(false);
  }

  setEnabled(on, labelsWanted = true) {
    if (on === this.on) return;
    this.on = on;
    const { viewer } = this;
    const c = viewer.controls;

    // pieces qui masquent l'articulation : on les efface le temps de l'examen
    // On isole une seule articulation : tout ce qui la masque disparait,
    // y compris les trois autres bras dont les fuseaux traversent le champ.
    const hidden = [this.drone.shroud, this.drone.bulkheads, this.drone.head, this.drone.bay,
      this.drone.nose, this.drone.internals, this.drone.tube,
      ...this.drone.arms.slice(1).map((a) => a.yaw)];

    if (on) {
      this._saved = {
        pos: viewer.camera.position.clone(),
        target: c.target.clone(),
        min: c.minDistance,
        vis: hidden.map((o) => o.visible),
      };
      hidden.forEach((o) => (o.visible = false));
      c.minDistance = 0.014;
      this._anchor.getWorldPosition(this._prev);
      // point de vue trois-quarts, dans le plan du bras
      const az = this.drone.arms[0].az;
      const out = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
      const tan = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
      // Cadrage calcule : on vise l'articulation depuis une direction proche
      // de l'axe de rotation (le bras tourne alors dans le plan de l'image),
      // a la distance qui inscrit une sphere de 22 mm dans le champ.
      const dir = new THREE.Vector3()
        .addScaledVector(tan, 0.72).addScaledVector(out, 0.42)
        .add(new THREE.Vector3(0, 0.30, 0)).normalize();
      const d = 0.030 / Math.sin(THREE.MathUtils.degToRad(viewer.camera.fov / 2));
      viewer.camera.position.copy(this._prev).addScaledVector(dir, d);
      c.target.copy(this._prev);
    } else {
      hidden.forEach((o, i) => (o.visible = this._saved.vis[i]));
      c.minDistance = this._saved.min;
      viewer.camera.position.copy(this._saved.pos);
      c.target.copy(this._saved.target);
    }
    c.update();
    this.labels.setEnabled(!on && labelsWanted);
    this.mechLabels.setEnabled(on && labelsWanted);
    viewer.dirty = true;
  }

  /** Suit la piece image par image sans casser l'orbite en cours. */
  update() {
    if (!this.on) return;
    this._anchor.getWorldPosition(this._cur);
    this._delta.subVectors(this._cur, this._prev);
    if (this._delta.lengthSq() > 1e-12) {
      this.viewer.controls.target.add(this._delta);
      this.viewer.camera.position.add(this._delta);
      this._prev.copy(this._cur);
      this.viewer.dirty = true;
    }
  }
}
