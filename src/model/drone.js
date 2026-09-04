import * as THREE from 'three';
import { D, Y, MECH, EXPLODE } from '../config.js';
import {
  buildChassis, buildBay, buildShroud, buildClevis, buildTorsionSpring, buildLatch,
  buildHead, buildNose, buildArm, buildMotor, buildBlade, buildHub, buildInternals, buildTube,
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
    this.clevis = this._mesh(buildClevis(D), M.alu);
    this.clevis.name = 'clevis';

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
    const coilGeo = buildTorsionSpring();
    const latch = buildLatch();
    this.geometries.push(armGeo, bell, stator, hubGeo, bladeGeo, coilGeo, latch.plunger, latch.spring);

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

      // --- mecanisme d'articulation ---------------------------------
      // ressort de torsion : la spire tourne de la moitie de l'angle du bras
      const coil = new THREE.Group();
      coil.position.z = D.hingeR;
      yaw.add(coil);
      this._mesh(coilGeo, M.spring, coil, false);

      // doigt de verrouillage : efface par le talon puis ressort derriere lui
      const plunger = new THREE.Group();
      plunger.position.set(0, MECH.latchY - 2.65 * 0.001, D.hingeR + MECH.latchZ);
      yaw.add(plunger);
      this._mesh(latch.plunger, M.alu, plunger, false);

      // ressort de compression du verrou : comprime depuis le haut
      const lspring = new THREE.Group();
      lspring.position.set(0, -13.6 * 0.001, D.hingeR + MECH.latchZ);
      yaw.add(lspring);
      const sm = this._mesh(latch.spring, M.spring, lspring, false);
      sm.position.y = 1.7 * 0.001;

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
        yaw, hinge, motor, hub, blades, coil, plunger, lspring, az,
        restZ: hinge.position.z,
        restPlungerY: plunger.position.y,
        ta: 0, locked: false,
      });
    }
    this.labels.push({
      text: 'Bras repliable + rotor',
      obj: this.arms[0].motor,
      pos: new THREE.Vector3(0, 0.022, 0),
    });

    // reperes du mecanisme (vue d'inspection)
    const a0 = this.arms[0];
    this.mechLabels = [
      { text: 'Chape 7075 + axe Ø1,5', obj: a0.yaw, pos: new THREE.Vector3(-0.013, -0.002, D.hingeR - 0.004) },
      { text: 'Ressort de torsion Ø0,6 · 25 mN·m', obj: a0.yaw, pos: new THREE.Vector3(MECH.coilX + 0.002, 0.006, D.hingeR) },
      { text: 'Butée + pastille élastomère', obj: a0.yaw, pos: new THREE.Vector3(0, 0.012, D.hingeR + 0.002) },
      { text: 'Doigt de verrouillage Ø2,2', obj: a0.yaw, pos: new THREE.Vector3(0, -0.017, D.hingeR + 0.005) },
      { text: 'Talon du bras', obj: a0.hinge, pos: new THREE.Vector3(0, -0.009, 0.002) },
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
