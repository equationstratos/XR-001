import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Y } from '../config.js';

/* ------------------------------------------------------------------ *
 * Generateurs de geometrie parametrique.
 * Chaque sous-ensemble statique est FUSIONNE en une seule BufferGeometry
 * -> un seul draw call par materiau.
 * ------------------------------------------------------------------ */

const RAD = Math.PI / 180;
const mm = 0.001;

function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new THREE.Matrix4()
    .makeRotationFromEuler(new THREE.Euler(rx, ry, rz))
    .setPosition(x, y, z);
  geo.applyMatrix4(m);
  return geo;
}

const cyl = (r1, r2, h, seg = 24, open = false) =>
  new THREE.CylinderGeometry(r1, r2, h, seg, 1, open);

/** Cage generique : 2 couronnes + n lisses longitudinales. */
function cage({ r, len, yc, rails, railW, railT, ringT, seg = 32 }) {
  const g = [];
  for (const s of [1, -1]) g.push(place(cyl(r, r, ringT, seg), { y: yc + s * (len / 2 - ringT / 2) }));
  const rr = r - railT / 2;
  for (let i = 0; i < rails; i++) {
    const a = (i / rails) * Math.PI * 2;
    const box = new THREE.BoxGeometry(railW, len - 2 * mm, railT);
    place(box, { x: Math.sin(a) * rr, y: yc, z: Math.cos(a) * rr, ry: a });
    g.push(box);
  }
  return g;
}

/* ------- epine centrale + cloisons (zone de repliage des bras) ------- */
export function buildChassis(D) {
  const g = cage({
    r: D.bodyR, len: D.bodyLen, yc: 0, rails: D.railCount,
    railW: D.railW, railT: D.railT, ringT: D.ringT, seg: 20,
  });
  // cloisons haute et basse : elles ferment le calibre
  g.push(place(cyl(D.bulkheadR, D.bulkheadR * 0.94, 5 * mm, 32), { y: Y.cageTop - 2.5 * mm }));
  g.push(place(cyl(D.bulkheadR * 0.94, D.bulkheadR, 5 * mm, 32), { y: Y.cageBot + 2.5 * mm }));
  // gaine de cablage le long de l'epine
  g.push(place(cyl(1.6 * mm, 1.6 * mm, D.bodyLen - 8 * mm, 8), { x: D.bodyR * 0.55, z: -D.bodyR * 0.55 }));
  return mergeGeometries(g, false);
}

/**
 * Carenage de la zone de repliage : 4 panneaux en secteur d'anneau,
 * separes par 4 fentes de 40 deg par lesquelles les bras sortent.
 * Rayon interieur 16 mm > encombrement des bras replies (15,5 mm),
 * rayon exterieur 17,4 mm < rayon interieur du tube (17,8 mm).
 */
export function buildShroud(D) {
  const ri = 16 * mm, ro = 17.4 * mm;
  const top = Y.cageTop - 3 * mm, bot = Y.cageBot + 3 * mm;
  const len = top - bot, yc = (top + bot) / 2;
  const panel = 50 * RAD, seg = 10;
  const g = [];
  for (let i = 0; i < 4; i++) {
    const t0 = (D.armSweep + 45 + i * 90) * RAD - panel / 2;
    g.push(place(new THREE.CylinderGeometry(ro, ro, len, seg, 1, true, t0, panel), { y: yc }));
    g.push(place(new THREE.CylinderGeometry(ri, ri, len, seg, 1, true, t0, panel), { y: yc }));
    for (const sgn of [1, -1]) {
      const rg = new THREE.RingGeometry(ri, ro, seg, 1, t0, panel);
      place(rg, { y: yc + sgn * len / 2, rx: -sgn * Math.PI / 2 });
      g.push(rg);
    }
    // joues laterales
    for (const e of [t0, t0 + panel]) {
      const w = new THREE.PlaneGeometry(ro - ri, len);
      w.rotateY(Math.PI / 2);
      place(w, { x: Math.sin(e) * (ri + ro) / 2, z: Math.cos(e) * (ri + ro) / 2, y: yc, ry: e });
      g.push(w);
    }
  }
  return mergeGeometries(g, false);
}

/* ------------------- soute energie / avionique ------------------- */
export function buildBay(D) {
  const yc = Y.cageBot - D.bayLen / 2;
  const g = cage({
    r: D.bayR, len: D.bayLen, yc, rails: 4,
    railW: D.bayRailW, railT: D.bayRailT, ringT: D.ringT,
  });
  return { geo: mergeGeometries(g, false), yc };
}

/** Chapes d'articulation des bras (alu). */
export function buildHinges(D) {
  const g = [];
  for (let i = 0; i < D.armCount; i++) {
    const a = (D.armSweep + i * (360 / D.armCount)) * RAD;
    const x = Math.sin(a) * D.hingeR, z = Math.cos(a) * D.hingeR;
    g.push(place(new THREE.BoxGeometry(D.armR * 2.5, D.armR * 2.3, D.armR * 2.0), { x, y: D.hingeY, z, ry: a }));
    g.push(place(new THREE.BoxGeometry(D.armR * 1.4, D.armR * 1.4, D.hingeR), { x: x * 0.5, y: D.hingeY, z: z * 0.5, ry: a }));
    const pin = place(cyl(0.9 * mm, 0.9 * mm, D.armR * 3.2, 8), { rz: Math.PI / 2 });
    g.push(place(pin, { x, y: D.hingeY, z, ry: a }));
  }
  return mergeGeometries(g, false);
}

/* ------------------------ tete optronique ------------------------ */
export function buildHead(D) {
  const y0 = Y.cageTop;
  const g = [];
  g.push(place(cyl(D.headR, D.headR, D.headLen, 32), { y: y0 + D.headLen / 2 }));
  g.push(place(cyl(D.headR * 0.9, D.headR * 0.74, 4 * mm, 32), { y: y0 + D.headLen + 2 * mm }));
  g.push(place(cyl(D.headR * 1.02, D.headR * 1.02, 2.5 * mm, 32), { y: y0 + D.headLen * 0.74 }));
  const body = mergeGeometries(g, false);

  const lens = place(new THREE.SphereGeometry(D.lensR, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), {
    y: y0 + D.headLen * 0.45, z: D.headR - 1.2 * mm, rx: Math.PI / 2,
  });
  const bezel = place(cyl(D.lensR * 1.28, D.lensR * 1.28, 2 * mm, 20), {
    y: y0 + D.headLen * 0.45, z: D.headR - 1.6 * mm, rx: Math.PI / 2,
  });
  const ant = place(cyl(1.1 * mm, 1.1 * mm, 16 * mm, 8), { y: y0 + D.headLen + 10 * mm, x: D.headR * 0.5 });
  const led = place(new THREE.SphereGeometry(1.4 * mm, 10, 8), { y: y0 + D.headLen * 0.25, z: -D.headR + 0.4 * mm });
  return { body, lens, bezel: mergeGeometries([bezel, ant], false), led };
}

/* --------------- module de charge utile (ogive tangente) --------------- */
export function buildNose(D) {
  const y0 = Y.bayBot;
  const R = D.noseR;
  const L = D.noseLen * D.ogiveRatio;
  const cylLen = D.noseLen - L;
  const rho = (R * R + L * L) / (2 * R);

  const pts = [new THREE.Vector2(0.0001, y0)];
  pts.push(new THREE.Vector2(R, y0 - 0.8 * mm));
  pts.push(new THREE.Vector2(R, y0 - cylLen * 0.30));
  pts.push(new THREE.Vector2(R * 0.955, y0 - cylLen * 0.42));   // gorge de ceinture
  pts.push(new THREE.Vector2(R * 0.955, y0 - cylLen * 0.72));
  pts.push(new THREE.Vector2(R, y0 - cylLen * 0.84));
  pts.push(new THREE.Vector2(R, y0 - cylLen));
  const K = 18;
  for (let k = 1; k <= K; k++) {
    const x = L - (k / K) * L * 0.985;
    const r = Math.sqrt(rho * rho - (L - x) * (L - x)) + R - rho;
    pts.push(new THREE.Vector2(Math.max(r, 0.0002), y0 - cylLen - (L - x)));
  }
  pts.push(new THREE.Vector2(0.0001, Y.noseTip));
  return { shell: new THREE.LatheGeometry(pts, 40) };
}

/* ------------------------ bras repliable ------------------------ */
/** Bras oriente selon +Z local, articule en (0,0,0). */
export function buildArm(D) {
  const g = [];
  g.push(place(cyl(D.armR, D.armR * 0.88, D.armLen, 16), { z: D.armLen / 2, rx: Math.PI / 2 }));
  g.push(place(new THREE.BoxGeometry(D.armR * 2.0, D.armR * 1.9, D.armR * 2.4), { z: D.armR * 0.5 }));
  // platine moteur
  g.push(place(new THREE.BoxGeometry(D.motorR * 1.9, 1.4 * mm, D.motorR * 1.9), {
    y: D.motorOff - D.motorH / 2 - 0.7 * mm, z: D.armLen - D.armR,
  }));
  return mergeGeometries(g, false);
}

/** Moteur brushless outrunner, arbre selon +Y local. */
export function buildMotor(D) {
  const bell = mergeGeometries([
    cyl(D.motorR, D.motorR, D.motorH, 20),
    place(cyl(D.motorR * 0.5, D.motorR * 0.5, 3 * mm, 12), { y: D.motorH / 2 + 1.5 * mm }),
  ], false);
  const stator = place(cyl(D.motorR * 0.84, D.motorR * 0.84, D.motorH * 0.4, 20), { y: -D.motorH * 0.12 });
  return { bell, stator };
}

/**
 * Pale parametrique : 14 stations, section elliptique cambree, vrillage
 * lineaire et loi de corde en sinus (~500 triangles, normales lissees).
 */
export function buildBlade(D) {
  const NS = 14, NP = 10;
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    const chord = D.bladeChord * (0.52 + 0.62 * Math.sin(Math.PI * Math.min(1, 0.18 + t * 0.9)));
    const thick = D.bladeThick * (1.15 - 0.55 * t);
    const tw = (D.bladePitch * (1 - t) + 4) * RAD;
    const x = D.hubR + t * D.bladeLen;
    for (let j = 0; j < NP; j++) {
      const a = (j / NP) * Math.PI * 2;
      const z = Math.cos(a) * chord * 0.5;
      const y = Math.sin(a) * thick * 0.5 + Math.cos(a) * chord * 0.09;
      pos.push(x, Math.sin(tw) * z + Math.cos(tw) * y, Math.cos(tw) * z - Math.sin(tw) * y);
      uv.push(t, j / NP);
    }
  }
  for (let i = 0; i < NS; i++) {
    for (let j = 0; j < NP; j++) {
      const a = i * NP + j, b = i * NP + ((j + 1) % NP);
      idx.push(a, a + NP, b, b, a + NP, b + NP);
    }
  }
  for (const [base, flip] of [[0, false], [NS * NP, true]]) {
    const ci = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < NP; j++) {
      cx += pos[(base + j) * 3]; cy += pos[(base + j) * 3 + 1]; cz += pos[(base + j) * 3 + 2];
    }
    pos.push(cx / NP, cy / NP, cz / NP); uv.push(0.5, 0.5);
    for (let j = 0; j < NP; j++) {
      const a = base + j, b = base + ((j + 1) % NP);
      idx.push(...(flip ? [a, b, ci] : [a, ci, b]));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function buildHub(D) {
  return mergeGeometries([
    cyl(D.hubR, D.hubR * 1.2, 3.5 * mm, 14),
    place(cyl(D.hubR * 0.4, D.hubR * 0.4, 5 * mm, 10), { y: 1.5 * mm }),
  ], false);
}

/* ---------------------------- internes ---------------------------- */
export function buildInternals(D) {
  const yc = Y.cageBot - D.bayLen / 2;
  const cells = [], caps = [];
  for (const s of [1, -1]) {
    const z = s * (D.cellR + 0.8 * mm);
    cells.push(place(cyl(D.cellR, D.cellR, D.cellLen, 18), { z, x: 2 * mm, y: yc }));
    caps.push(place(cyl(D.cellR * 0.5, D.cellR * 0.5, 1.6 * mm, 12), { z, x: 2 * mm, y: yc + D.cellLen / 2 }));
  }
  const pcb = place(new THREE.BoxGeometry(D.pcbT, D.pcbH, D.pcbW), { x: -D.bayR * 0.58, y: yc });
  const comps = [];
  for (let i = 0; i < 6; i++) {
    const c = new THREE.BoxGeometry(1.8 * mm, 5 * mm, 4 * mm);
    place(c, {
      x: -D.bayR * 0.58 + 2 * mm,
      y: yc - D.pcbH / 2 + 6 * mm + i * 5.5 * mm,
      z: (i % 2 ? 1 : -1) * 4 * mm,
    });
    comps.push(c);
  }
  return { cellA: cells[0], cellB: cells[1], caps: mergeGeometries(caps, false), pcb: mergeGeometries([pcb, ...comps], false), yc };
}

/* ------------------------ tube lanceur 40 mm ------------------------ */
export function buildTube(D) {
  const ri = D.caliber / 2 - D.tubeWall, ro = D.caliber / 2;
  const g = [cyl(ro, ro, D.tubeLen, 40, true), cyl(ri, ri, D.tubeLen, 40, true)];
  for (const s of [1, -1]) {
    const ring = new THREE.RingGeometry(ri, ro, 40);
    place(ring, { y: (s * D.tubeLen) / 2, rx: -s * Math.PI / 2 });
    g.push(ring);
  }
  for (let i = 0; i < 3; i++) {
    g.push(place(cyl(ro * 1.06, ro * 1.06, 4 * mm, 40), { y: (i - 1) * D.tubeLen * 0.3 }));
  }
  return mergeGeometries(g, false);
}
