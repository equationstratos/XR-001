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
    this._anchor = drone.arms[0].yaw;   // point de l'axe au niveau des articulations

    // Les joues de chape enveloppent la tringlerie : depuis toute direction
    // utile elles la masquent. On les passe en fantome le temps de l'examen
    // plutot que de les effacer — leur presence reste lisible.
    this._ghost = drone.M.alu.clone();
    this._ghost.transparent = true;
    this._ghost.opacity = 0.2;
    this._ghost.depthWrite = false;
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
    const hidden = [this.drone.shroud, this.drone.bulkheads, this.drone.chassis, this.drone.collarRing,
      this.drone.head, this.drone.bay, this.drone.nose, this.drone.internals, this.drone.tube,
      ...this.drone.arms.slice(1).map((a) => a.yaw)];

    if (on) {
      this._saved = {
        pos: viewer.camera.position.clone(),
        target: c.target.clone(),
        min: c.minDistance,
        vis: hidden.map((o) => o.visible),
      };
      hidden.forEach((o) => (o.visible = false));
      this._solid = this.drone.collar.material;
      this.drone.collar.material = this._ghost;
      c.minDistance = 0.014;
      this._anchor.getWorldPosition(this._prev);
      // La cible est le point de l'AXE au niveau des articulations : la
      // tringlerie est centrale (poussoir, ressort, bielles a r < 7 mm) alors
      // que l'articulation est a r = 8,5 mm. Viser l'axe cadre les deux.
      this._prev.y -= 0.004;
      const az = this.drone.arms[0].az;
      const out = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
      const tan = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
      // Direction dominee par l'axe d'articulation : le bras tourne alors dans
      // le plan de l'image, la bielle et le poussoir aussi.
      const dir = new THREE.Vector3()
        .addScaledVector(tan, 0.86).addScaledVector(out, 0.26)
        .add(new THREE.Vector3(0, 0.26, 0)).normalize();
      const d = 0.026 / Math.sin(THREE.MathUtils.degToRad(viewer.camera.fov / 2));
      viewer.camera.position.copy(this._prev).addScaledVector(dir, d);
      c.target.copy(this._prev);
    } else {
      hidden.forEach((o, i) => (o.visible = this._saved.vis[i]));
      this.drone.collar.material = this._solid;
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
