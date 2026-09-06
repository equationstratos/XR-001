import * as THREE from 'three';
import { D, Y, MECH, EXPLODE } from '../config.js';
import {
  buildChassis, buildBay, buildShroud, buildCollar, buildLink, buildShaft, buildRunner,
  buildTorsionSpring, buildDetent, buildHead, buildNose, buildArm, buildMotor,
  buildBlade, buildHub, buildInternals, buildTube,
} from './parts.js';

const RAD = Math.PI / 180;

/**
 * Assemblage du modele + exposition du "rig" cinematique.
 * Toutes les geometries sont creees une seule fois et partagees entre
 * les 4 bras / 8 pales (meme BufferGeometry + meme materiau).
 */
export class Drone {
  constructor(materials) {
    this.M = materials;
    this.geometries = [];
    this.root = new THREE.Group();          // le drone (sans le tube)
    this.arms = [];
    this.labels = [];

    this._buildBody();
    this._buildArms();
    this._buildLauncher();

    this.group = new THREE.Group();          // drone + lanceur
    this.group.add(this.root, this.tube);
    this._captureRestPositions();
  }

  _mesh(geo, mat, parent = this.root, shadow = true) {
    this.geometries.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    parent.add(m);
    return m;
  }

  _buildBody() {
    const M = this.M;
    const ch = buildChassis(D);
    this.chassis = this._mesh(ch.spine, M.carbon);
    this.chassis.name = 'chassis';
    this.bulkheads = this._mesh(ch.bulkheads, M.carbon);
    this.bulkheads.name = 'bulkheads';
    this.shroud = this._mesh(buildShroud(D), M.carbon);
    this.shroud.name = 'shroud';
    const col = buildCollar(D);
    this.collarRing = this._mesh(col.ring, M.alu);
    this.collarRing.name = 'collar-ring';
    this.collar = this._mesh(col.clevis, M.alu);
    this.collar.name = 'collar';

    // --- tete optronique ---
    this.head = new THREE.Group();
    this.root.add(this.head);
    const h = buildHead(D);
    this._mesh(h.body, M.polymer, this.head);
    this._mesh(h.bezel, M.aluDark, this.head);
    this._mesh(h.lens, M.glass, this.head, false);
    this._mesh(h.led, M.led, this.head, false);

    // --- soute energie / avionique ---
    this.bay = new THREE.Group();
    this.root.add(this.bay);
    const b = buildBay(D);
    this._mesh(b.geo, M.carbon, this.bay);

    this.internals = new THREE.Group();
    this.bay.add(this.internals);
    const g = buildInternals(D);
    this.cellA = this._mesh(g.cellA, M.cellA, this.internals, false);
    this.cellB = this._mesh(g.cellB, M.cellB, this.internals, false);
    this._mesh(g.caps, M.copper, this.internals, false);
    this.pcb = this._mesh(g.pcb, M.pcb, this.internals, false);

    // --- module de charge utile (enveloppe generique, inerte) ---
    this.nose = new THREE.Group();
    this.root.add(this.nose);
    this._mesh(buildNose(D).shell, M.brass, this.nose);

    this.labels.push(
      { text: 'Tête optronique', obj: this.head, pos: new THREE.Vector3(0, Y.cageTop + D.headLen * 1.15, D.headR * 0.4) },
      { text: 'Logement des bras', obj: this.root, pos: new THREE.Vector3(0, 0.006, 0.019) },
      { text: 'Énergie 2S', obj: this.internals, pos: new THREE.Vector3(0, g.yc + 0.016, D.cellR * 2.4) },
      { text: 'Avionique / ESC', obj: this.pcb, pos: new THREE.Vector3(-D.bayR, g.yc - 0.016, 0) },
      { text: 'Module charge utile', obj: this.nose, pos: new THREE.Vector3(0, Y.bayBot - 0.014, D.noseR) },
    );
  }

  _buildArms() {
    const M = this.M;
    const armGeo = buildArm(D);
    const { bell, stator } = buildMotor(D);
    const hubGeo = buildHub(D);
    const bladeGeo = buildBlade(D);
    const linkGeo = buildLink();
    const coilGeo = buildTorsionSpring();
    this.geometries.push(armGeo, bell, stator, hubGeo, bladeGeo, linkGeo, coilGeo);

    for (let i = 0; i < D.armCount; i++) {
      const az = (D.armSweep + i * (360 / D.armCount)) * RAD;

      const yaw = new THREE.Group();
      yaw.position.y = D.hingeY;
      yaw.rotation.y = az;
      this.root.add(yaw);

      const hinge = new THREE.Group();
      hinge.position.z = D.hingeR;
      yaw.add(hinge);

      this._mesh(armGeo, M.carbon, hinge);

      // --- tringlerie -------------------------------------------------
      // La bielle relie le maneton de l'etoile (sur le poussoir) au maneton
      // de manivelle (sur le pied de bras). Les deux sont dans le plan x = 0
      // du repere de bras : une seule rotation autour de X suffit a la poser.
      const link = new THREE.Group();
      yaw.add(link);
      this._mesh(linkGeo, M.alu, link, false);

      // MOTEUR : ressort de torsion sur l'axe d'articulation, donc en haut du
      // drone. Sa spire tourne de la moitie de l'angle du bras.
      const coil = new THREE.Group();
      coil.position.z = D.hingeR;
      yaw.add(coil);
      this._mesh(coilGeo, M.spring, coil, false);

      // pastille elastomere de butee
      const bump = this._mesh(
        new THREE.CylinderGeometry(MECH.bumperR, MECH.bumperR, 1 * 0.001, 12),
        M.rubber, yaw, false,
      );
      bump.position.set(0, MECH.cheekR * 0.62 + 1.6 * 0.001, D.hingeR + 1.6 * 0.001);

      // --- propulsion ------------------------------------------------
      const motor = new THREE.Group();
      motor.position.set(0, D.motorOff, D.armLen);
      hinge.add(motor);
      this._mesh(bell, M.alu, motor);
      this._mesh(stator, M.copper, motor, false);

      const hub = new THREE.Group();
      hub.position.y = D.motorH / 2 + 1.2 * 0.001;
      motor.add(hub);
      this._mesh(hubGeo, M.aluDark, hub, false);

      // pales sur charnieres deportees de +/- hubR : elles s'ouvrent en ciseaux
      const blades = [];
      for (let b = 0; b < D.bladeCount; b++) {
        const pivot = new THREE.Group();
        pivot.position.set((b === 0 ? 1 : -1) * D.hubR, 2.2 * 0.001, 0);
        hub.add(pivot);
        this._mesh(bladeGeo, M.blade, pivot, false);
        blades.push(pivot);
      }
      this.arms.push({
        yaw, hinge, motor, hub, blades, link, coil, az,
        restZ: hinge.position.z,
        ta: 0,
      });
    }

    // --- synchroniseur, commun aux quatre bras -------------------------
    // Montage parapluie : le mat est FIXE, le coulisseau glisse dessus. Il ne
    // motorise pas — ce sont les ressorts de torsion des axes qui le font — il
    // rend les bras solidaires et porte le verrou.
    this.shaft = this._mesh(buildShaft(D), M.aluDark, this.root, false);
    this.shaft.name = 'shaft';

    this.slider = new THREE.Group();
    this.root.add(this.slider);
    this._mesh(buildRunner(D), M.alu, this.slider, false);

    // verrou : cran a ressort qui tombe derriere le coulisseau en haut de course
    const det = buildDetent();
    this.geometries.push(det.finger, det.spring, det.guide);
    this.detent = new THREE.Group();
    this.detent.position.set(0, MECH.detentY, 0);
    this.root.add(this.detent);
    this._mesh(det.guide, M.aluDark, this.detent, false);
    this.detentFinger = new THREE.Group();
    this.detentFinger.position.x = MECH.rodR + 2.4 * 0.001;
    this.detent.add(this.detentFinger);
    this._mesh(det.finger, M.alu, this.detentFinger, false);
    const ds = this._mesh(det.spring, M.spring, this.detentFinger, false);
    ds.position.x = 4.2 * 0.001;
    this.labels.push({
      text: 'Bras repliable + rotor',
      obj: this.arms[0].motor,
      pos: new THREE.Vector3(0, 0.022, 0),
    });

    // reperes du mecanisme (vue d'inspection)
    const a0 = this.arms[0];
    this.mechLabels = [
      { text: 'Moyeu cruciforme + axe Ø1,5', obj: a0.yaw, pos: new THREE.Vector3(-0.013, -0.001, D.hingeR - 0.003) },
      { text: 'Butée + pastille élastomère', obj: a0.yaw, pos: new THREE.Vector3(0, 0.012, D.hingeR + 0.002) },
      { text: 'Attache de bielle · 30 mm de l\'axe', obj: a0.hinge, pos: new THREE.Vector3(0, 0.006, MECH.crank) },
      { text: 'Bielle · entraxe 38 mm', obj: a0.link, pos: new THREE.Vector3(0, -0.005, MECH.link / 2) },
      { text: 'Ressort de torsion · 26 mN·m', obj: a0.yaw, pos: new THREE.Vector3(MECH.coilX + 0.004, 0.006, D.hingeR) },
      { text: 'Coulisseau + étoile', obj: this.slider, pos: new THREE.Vector3(0, 0.002, -0.008) },
      { text: 'Mât fixe', obj: this.root, pos: new THREE.Vector3(0.006, 0.010, 0) },
      { text: 'Verrou de coulisseau', obj: this.detent, pos: new THREE.Vector3(0.011, 0, 0) },
      { text: 'Charnière de pale · vis épaulée Ø1,5', obj: a0.hub, pos: new THREE.Vector3(0, 0.008, -0.004) },
    ];
  }

  _buildLauncher() {
    this.tube = new THREE.Group();
    const mesh = this._mesh(buildTube(D), this.M.olive, this.tube);
    mesh.name = 'tube';
    // le drone est centre dans le tube en configuration stockee
    this.tube.position.y = (Y.headTop + Y.noseTip) / 2;
  }

  _captureRestPositions() {
    this._rest = new Map();
    const reg = (o) => this._rest.set(o, o.position.clone());
    [this.head, this.nose, this.bay, this.internals, this.cellA, this.cellB, this.pcb, this.tube].forEach(reg);
    this.arms.forEach((a) => reg(a.hinge));
  }

  /** Vue eclatee : k ∈ [0,1]. */
  setExplode(k) {
    const off = (obj, [x, y, z, amp]) => {
      const r = this._rest.get(obj);
      obj.position.set(r.x + x * amp * k, r.y + y * amp * k, r.z + z * amp * k);
    };
    off(this.head, EXPLODE.head);
    off(this.bay, EXPLODE.bay);
    off(this.nose, EXPLODE.nose);
    off(this.cellA, EXPLODE.cells);
    off(this.cellB, [0, 0, -1, EXPLODE.cells[3]]);
    off(this.pcb, EXPLODE.pcb);
    if (this.tube.visible) off(this.tube, EXPLODE.tube);
    for (const a of this.arms) a.hinge.position.z = a.restZ + EXPLODE.arms[3] * k;
  }

  setWireframe(on) { this.M.all.forEach((m) => (m.wireframe = on)); }
  setInternals(on) { this.internals.visible = on; }
  setLauncher(on) { this.tube.visible = on; }

  dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.geometries.length = 0;
  }
}
