import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Y, MECH } from '../config.js';

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

/** Ressort helicoidal, axe selon X (fil rond de diametre `wire`). */
function helix(R, wire, turns, length, radial = 5) {
  const N = Math.round(turns * 12);
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = u * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(-length / 2 + u * length, Math.cos(a) * R, Math.sin(a) * R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, wire / 2, radial, false);
}

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
  // gaine de cablage le long de l'epine
  g.push(place(cyl(1.6 * mm, 1.6 * mm, D.bodyLen - 8 * mm, 8), { x: D.bodyR * 0.55, z: -D.bodyR * 0.55 }));
  // cloisons haute et basse : elles ferment le calibre (mesh separe, on les
  // efface en vue mecanisme car elles coiffent les articulations)
  const bulkheads = mergeGeometries([
    place(cyl(D.bulkheadR, D.bulkheadR * 0.94, 5 * mm, 32), { y: Y.cageTop - 2.5 * mm }),
    place(cyl(D.bulkheadR * 0.94, D.bulkheadR, 5 * mm, 32), { y: Y.cageBot + 2.5 * mm }),
  ], false);
  return { spine: mergeGeometries(g, false), bulkheads };
}

/**
 * Carenage de la zone de repliage : 4 panneaux en secteur d'anneau,
 * separes par 4 fentes de 40 deg par lesquelles les bras sortent.
 * Rayon interieur 18 mm > encombrement du train rotor replie (17,0 mm),
 * rayon exterieur 19,4 mm < alesage du tube (20 mm).
 */
export function buildShroud(D) {
  const ri = MECH.shroudRi, ro = 19.4 * mm;
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

/**
 * Moyeu cruciforme (piece fixe), transpose de la bague a quatre chapes du
 * mecanisme d'empennage retardateur : une couronne alesee pour le passage de
 * la tige de commande, quatre chapes a deux joues, quatre butees d'ouverture.
 * Geometrie ecrite dans le repere du bras (axe d'articulation = X, bras vers
 * +Z) puis portee a l'azimut de chaque bras.
 */
export function buildCollar(D) {
  const K = MECH;
  const out = [];

  // Couronne : quatre pans qui ceinturent l'epine et portent les chapes. Elle
  // ne ferme PAS le centre — la tige de commande et son ressort traversent le
  // moyeu de part en part. Mesh separe : la vue mecanisme l'efface pour
  // laisser voir la tringlerie, les chapes restant en place.
  const ring = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * 90) * RAD;
    ring.push(place(new THREE.BoxGeometry(K.collarR * 0.8, K.collarH, 2.2 * mm), {
      z: (D.bodyR + 0.6 * mm) * Math.cos(a), x: (D.bodyR + 0.6 * mm) * Math.sin(a), ry: a,
    }));
  }
  const ringGeo = mergeGeometries(
    ring.map((g) => g.applyMatrix4(new THREE.Matrix4().makeTranslation(0, D.hingeY, 0))), false);

  for (let i = 0; i < D.armCount; i++) {
    const a = (D.armSweep + i * (360 / D.armCount)) * RAD;
    const g = [];
    // deux joues de chape + leur bras de liaison a la couronne
    for (const sgn of [1, -1]) {
      const x = sgn * (K.cheekGap / 2 + K.cheekT / 2);
      g.push(place(cyl(K.cheekR, K.cheekR, K.cheekT, 20), { x, rz: Math.PI / 2 }));
      g.push(place(new THREE.BoxGeometry(K.cheekT, K.cheekR * 1.5, D.hingeR * 0.95), {
        x, y: -K.cheekR * 0.35, z: -D.hingeR * 0.48,
      }));
    }
    // axe Ø1,5 traversant, retenu par circlips
    g.push(place(cyl(K.pinR, K.pinR, K.pinLen, 10), { rz: Math.PI / 2 }));
    for (const sgn of [1, -1]) {
      g.push(place(cyl(K.pinR * 1.8, K.pinR * 1.8, 0.5 * mm, 10), {
        x: sgn * (K.cheekGap / 2 + K.cheekT + 0.5 * mm), rz: Math.PI / 2,
      }));
    }
    // butee d'ouverture usinee dans la chape (recoit la pastille elastomere)
    g.push(place(new THREE.BoxGeometry(K.cheekGap, 2.2 * mm, 3.4 * mm), { y: K.cheekR * 0.62, z: 1.6 * mm }));

    const m = new THREE.Matrix4().makeRotationY(a)
      .multiply(new THREE.Matrix4().makeTranslation(0, D.hingeY, D.hingeR));
    out.push(...g.map((x) => x.applyMatrix4(m)));
  }
  return { ring: ringGeo, clevis: mergeGeometries(out, false) };
}

/**
 * Bielle jumelee : deux flasques paralleles reunis par deux tourillons,
 * exactement la piece repetee quatre fois dans le kit d'origine. Construite
 * le long de +Z, origine sur le maneton cote poussoir.
 */
export function buildLink() {
  const K = MECH;
  const g = [];
  for (const sgn of [1, -1]) {
    const x = sgn * (K.linkGap / 2 + K.linkT / 2);
    g.push(place(new THREE.BoxGeometry(K.linkT, K.linkW, K.link), { x, z: K.link / 2 }));
    for (const z of [0, K.link]) {
      g.push(place(cyl(K.linkW * 0.62, K.linkW * 0.62, K.linkT, 14), { x, z, rz: Math.PI / 2 }));
    }
  }
  // tourillons traversants
  for (const z of [0, K.link]) {
    g.push(place(cyl(K.pinR * 0.9, K.pinR * 0.9, K.linkGap + 2 * K.linkT + 0.8 * mm, 10), { z, rz: Math.PI / 2 }));
  }
  return mergeGeometries(g, false);
}

/**
 * Mat central FIXE, comme le manche d'un parapluie : il est encastre dans le
 * moyeu en haut, prend appui sur la cloison basse en bas, guide le coulisseau
 * et porte le siege du ressort. C'est le coulisseau qui glisse dessus, pas
 * l'inverse.
 */
export function buildShaft(D) {
  const K = MECH;
  const yTop = K.anchorY, yBot = K.shaftBot;
  const len = yTop - yBot;
  return mergeGeometries([
    place(cyl(K.rodR, K.rodR, len, 14), { y: (yTop + yBot) / 2 }),
    // embase sur la cloison basse
    place(cyl(K.rodR * 2.2, K.rodR * 2.2, 2 * mm, 14), { y: yBot }),
  ], false);
}

/**
 * Coulisseau : la bague qui coulisse sur le mat, son etoile a quatre manetons
 * et sa gorge de verrouillage. Origine sur le plan de l'etoile ; l'objet est
 * translate de la course courante.
 */
export function buildRunner(D) {
  const K = MECH;
  const g = [];
  const sleeve = 8 * mm;
  g.push(place(cyl(K.rodR + 1.0 * mm, K.rodR + 1.0 * mm, sleeve, 16), {}));
  // collerette de guidage basse
  g.push(place(cyl(K.rodR + 1.8 * mm, K.rodR + 1.8 * mm, 1.4 * mm, 18), { y: -sleeve / 2 }));
  // gorge de verrouillage en haut de la bague
  g.push(place(cyl(K.rodR + 1.6 * mm, K.rodR + 1.6 * mm, 1 * mm, 16), { y: sleeve / 2 - 0.5 * mm }));
  // etoile : quatre bras portant les manetons de bielle
  for (let i = 0; i < D.armCount; i++) {
    const a = (D.armSweep + i * (360 / D.armCount)) * RAD;
    g.push(place(new THREE.BoxGeometry(K.linkW * 1.4, K.spiderT, K.rodPin + 2.2 * mm), {
      x: Math.sin(a) * (K.rodPin / 2), z: Math.cos(a) * (K.rodPin / 2), ry: a,
    }));
    g.push(place(cyl(K.pinR * 0.95, K.pinR * 0.95, K.linkGap + 2 * K.linkT + 1.0 * mm, 10), {
      x: Math.sin(a) * K.rodPin, z: Math.cos(a) * K.rodPin, ry: a, rz: Math.PI / 2,
    }));
  }
  return mergeGeometries(g, false);
}

/**
 * Ressort de traction unique : helice d'axe Y de longueur unitaire, mise a
 * l'echelle a sa longueur courante par la scene. Un ressort de traction qui
 * s'etire, c'est exactement un pas qui augmente a diametre constant — la mise
 * a l'echelle axiale en rend donc fidelement le comportement.
 */
export function buildDriveSpring() {
  const K = MECH;
  return place(helix(K.springR, K.springWire, K.springTurns, 1, 4), { rz: Math.PI / 2 });
}

/** Boucles d'accrochage du ressort : ancrage haut et attache au coulisseau. */
export function buildSpringHooks(D) {
  const K = MECH;
  const eye = (y) => mergeGeometries([
    place(new THREE.TorusGeometry(1.6 * mm, K.springWire / 2, 6, 14), { y, rx: Math.PI / 2 }),
    place(cyl(K.springWire / 2, K.springWire / 2, 2.6 * mm, 6), { y: y + (y > 0 ? -1.3 : 1.3) * mm }),
  ], false);
  // platine d'ancrage sous le sommet de la tete
  const anchor = mergeGeometries([
    place(cyl(6 * mm, 6 * mm, 1.6 * mm, 18), { y: K.anchorY + 1.4 * mm }),
    eye(K.anchorY - 0.6 * mm),
  ], false);
  return anchor;
}

/** Cran de verrouillage du poussoir : doigt + ressort, sur le bati. */
export function buildDetent() {
  const K = MECH;
  const finger = mergeGeometries([
    place(cyl(K.detentR, K.detentR, 5 * mm, 12), { rz: Math.PI / 2 }),
    place(cyl(K.detentR, K.detentR * 0.4, 1.2 * mm, 12), { x: -3.1 * mm, rz: Math.PI / 2 }),
    place(cyl(K.detentR * 1.5, K.detentR * 1.5, 1 * mm, 12), { x: 2.2 * mm, rz: Math.PI / 2 }),
  ], false);
  const spring = helix(K.detentR * 1.2, 0.3 * mm, 5, 3 * mm, 5);
  const guide = mergeGeometries([
    place(new THREE.BoxGeometry(1 * mm, 3.6 * mm, 3.6 * mm), { x: 5.6 * mm }),
    place(new THREE.BoxGeometry(6 * mm, 0.9 * mm, 3.6 * mm), { x: 3.4 * mm, y: 1.8 * mm }),
    place(new THREE.BoxGeometry(6 * mm, 0.9 * mm, 3.6 * mm), { x: 3.4 * mm, y: -1.8 * mm }),
  ], false);
  return { finger, spring, guide };
}

/* ------------------------ tete optronique ------------------------ */
export function buildHead(D) {
  const y0 = Y.cageTop;
  const g = [];
  g.push(place(cyl(D.headR, D.headR, D.headLen, 32), { y: y0 + D.headLen / 2 }));
  g.push(place(cyl(D.headR * 0.9, D.headR * 0.74, 4 * mm, 32), { y: y0 + D.headLen + 2 * mm }));
  g.push(place(cyl(D.headR * 1.02, D.headR * 1.02, 2.5 * mm, 32), { y: y0 + D.headLen * 0.74 }));
  const body = mergeGeometries(g, false);

  // Optique ENCASTREE : la calotte etait auparavant posee sur la peau et
  // depassait de 5 mm du calibre. Elle est desormais en retrait de 0,8 mm.
  const lens = place(new THREE.SphereGeometry(D.lensR, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), {
    y: y0 + D.headLen * 0.45, z: D.headR - D.lensR - 0.8 * mm, rx: Math.PI / 2,
  });
  const bezel = place(cyl(D.lensR * 1.22, D.lensR * 1.22, 1.6 * mm, 20), {
    y: y0 + D.headLen * 0.45, z: D.headR - 3.0 * mm, rx: Math.PI / 2,
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
  // pied de bras : moyeu tourillonnant entre les joues de la chape
  g.push(place(cyl(MECH.heelR, MECH.heelR, MECH.cheekGap - 0.3 * mm, 20), { rz: Math.PI / 2 }));
  // face de butee (vient porter sur la pastille elastomere de la chape)
  g.push(place(new THREE.BoxGeometry(MECH.cheekGap - 0.3 * mm, 2 * mm, 3 * mm), {
    y: MECH.heelR * 0.72, z: 1.5 * mm,
  }));

  // FERRURE D'ATTACHE de la bielle, a 30 mm de l'axe SUR le bras (montage
  // parapluie : la bielle attaque loin sur le fuseau, pas une manivelle de
  // pied). C'est ce bras de levier qui fixe toute la loi d'ouverture.
  const phi = MECH.crankPhi * RAD;
  const cu = MECH.crank * Math.cos(phi);      // composante radiale (+Z local)
  const cv = -MECH.crank * Math.sin(phi);     // composante axiale  (+Y local)
  // collier serre sur le fuseau, traverse par le tourillon
  g.push(place(new THREE.BoxGeometry(MECH.linkGap + 2 * MECH.linkT + 1.6 * mm, D.armR * 2.4, 4.2 * mm), {
    y: cv, z: cu,
  }));
  // tourillon : il est exactement au point d'attache calcule par la
  // tringlerie, sinon la bielle ne se raccorderait pas.
  g.push(place(cyl(MECH.pinR * 0.95, MECH.pinR * 0.95, MECH.linkGap + 2 * MECH.linkT + 2.2 * mm, 10), {
    y: cv, z: cu, rz: Math.PI / 2,
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
    const x = t * D.bladeLen;   // racine au droit de l'axe de pliage
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
  // ferrure de pied : oeil de charniere traverse par la vis epaulee
  const eye = mergeGeometries([
    cyl(2.3 * mm, 2.3 * mm, D.bladeThick * 2.2, 14),
    place(new THREE.BoxGeometry(3.4 * mm, D.bladeThick * 2.2, 3.6 * mm), { x: 1.7 * mm }),
  ], false);
  return mergeGeometries([geo, eye], false);
}

/**
 * Moyeu de rotor a pales repliables : platine porte-charnieres, deux vis
 * epaulees Ø1,5 deportees de hubR, et deux butees contre lesquelles la force
 * centrifuge plaque les pales une fois deployees.
 */
export function buildHub(D) {
  const K = MECH;
  // Platine surbaissee : chaque millimetre au-dessus de l'axe du bras devient
  // de l'encombrement radial une fois le bras replie.
  const g = [
    cyl(D.hubR * 0.75, D.hubR * 0.75, 3 * mm, 14),
    place(new THREE.BoxGeometry(2 * D.hubR + 4.6 * mm, 1.4 * mm, 5.2 * mm), { y: 1.0 * mm }),
    place(cyl(D.hubR * 0.4, D.hubR * 0.4, 3 * mm, 10), { y: 1.2 * mm }),
  ];
  for (const s2 of [1, -1]) {
    // vis epaulee de charniere
    g.push(place(cyl(K.screwR, K.screwR, 3.8 * mm, 10), { x: s2 * D.hubR, y: 1.0 * mm }));
    g.push(place(cyl(K.screwR * 2, K.screwR * 2, 0.9 * mm, 10), { x: s2 * D.hubR, y: 2.7 * mm }));
    // butee de pale (cote deploye)
    g.push(place(new THREE.BoxGeometry(2.2 * mm, 2.6 * mm, 1.6 * mm), {
      x: s2 * (D.hubR + 2.4 * mm), y: 1.0 * mm, z: s2 * 2.4 * mm,
    }));
  }
  return mergeGeometries(g, false);
}

/* ---------------------------- internes ---------------------------- */
/**
 * Soute : accus et pile d'electronique.
 *
 * Accus : deux elements Li-ion 13 x 42 en 2S, sous gaine thermoretractable,
 * relies par des languettes de nickel soudees par points, avec un circuit de
 * protection colle en travers des cosses.
 *
 * Avionique : pile de trois cartes au format 20 x 20 (entraxe 16), montees
 * sur entretoises et amorties par des passe-fils silicone :
 *   - controleur de vol, gyro + barometre, connecteur de nappe camera
 *   - ESC 4-en-1, quatre etages de MOSFET et son condensateur de bus
 *   - emetteur video + radio, avec sa sortie antenne
 */
export function buildInternals(D) {
  const yc = Y.cageBot - D.bayLen / 2;
  const cells = [], caps = [], tabs = [], boards = [], comps = [];

  // --- accus 2S ---
  for (const s of [1, -1]) {
    const z = s * (D.cellR + 0.8 * mm);
    cells.push(place(cyl(D.cellR, D.cellR, D.cellLen, 20), { z, x: 2 * mm, y: yc }));
    // borne positive + gaine
    caps.push(place(cyl(D.cellR * 0.5, D.cellR * 0.5, 1.6 * mm, 12), { z, x: 2 * mm, y: yc + D.cellLen / 2 }));
    for (const e of [1, -1]) {
      caps.push(place(cyl(D.cellR + 0.25 * mm, D.cellR + 0.25 * mm, 2 * mm, 20), {
        z, x: 2 * mm, y: yc + e * (D.cellLen / 2 - 2.5 * mm),
      }));
    }
  }
  // languettes de nickel soudees par points
  tabs.push(place(new THREE.BoxGeometry(4 * mm, 0.25 * mm, 2 * D.cellR + 3 * mm), {
    x: 2 * mm, y: yc + D.cellLen / 2 + 1.2 * mm,
  }));
  for (const s of [1, -1]) {
    tabs.push(place(new THREE.BoxGeometry(4 * mm, 0.25 * mm, 5 * mm), {
      x: 2 * mm, z: s * (D.cellR + 0.8 * mm), y: yc - D.cellLen / 2 - 1.0 * mm,
    }));
  }
  // circuit de protection colle en travers des cosses
  boards.push(place(new THREE.BoxGeometry(9 * mm, 0.9 * mm, 16 * mm), {
    x: 2 * mm, y: yc + D.cellLen / 2 + 3.4 * mm,
  }));

  // --- pile avionique : trois cartes 20 x 20 ---
  const bY = [yc - D.cellLen / 2 - 7 * mm, yc - D.cellLen / 2 - 13 * mm, yc - D.cellLen / 2 - 19 * mm];
  bY.forEach((y, k) => {
    boards.push(place(new THREE.BoxGeometry(20 * mm, k === 1 ? 1.6 * mm : 1.2 * mm, 20 * mm), { y }));
    // entretoises aux quatre coins (entraxe 16)
    if (k < 2) {
      for (const sx of [1, -1]) for (const sz of [1, -1]) {
        comps.push(place(cyl(1.5 * mm, 1.5 * mm, 4.8 * mm, 10), { x: sx * 8 * mm, z: sz * 8 * mm, y: y - 3 * mm }));
      }
    }
  });
  // composants : MOSFET de l'ESC, condensateur de bus, gyro, connecteurs
  for (let i = 0; i < 4; i++) {
    const a = (i * 90 + 45) * RAD;
    comps.push(place(new THREE.BoxGeometry(5 * mm, 1.4 * mm, 4 * mm), {
      x: Math.sin(a) * 6 * mm, z: Math.cos(a) * 6 * mm, y: bY[1] + 1.5 * mm, ry: a,
    }));
  }
  comps.push(place(cyl(4 * mm, 4 * mm, 7 * mm, 14), { x: -6 * mm, z: 6 * mm, y: bY[1] - 5 * mm })); // condensateur
  comps.push(place(new THREE.BoxGeometry(3 * mm, 1 * mm, 3 * mm), { y: bY[0] + 1.1 * mm }));        // gyro
  comps.push(place(new THREE.BoxGeometry(8 * mm, 2.4 * mm, 2.6 * mm), { z: 7 * mm, y: bY[0] + 1.8 * mm })); // connecteur nappe
  comps.push(place(new THREE.BoxGeometry(6 * mm, 2.2 * mm, 3 * mm), { x: 6 * mm, y: bY[2] - 1.6 * mm }));   // sortie antenne

  return {
    cellA: cells[0], cellB: cells[1],
    caps: mergeGeometries(caps, false),
    tabs: mergeGeometries(tabs, false),
    pcb: mergeGeometries(boards, false),
    comps: mergeGeometries(comps, false),
    yc,
  };
}

/**
 * Module camera de la tete : capteur sur sa carte, barillet d'objectif et
 * nappe vers le controleur de vol.
 */
export function buildCamera(D) {
  const y = Y.cageTop + D.headLen * 0.45;
  const g = [
    place(new THREE.BoxGeometry(14 * mm, 14 * mm, 1.2 * mm), { y, z: D.headR - 13 * mm }),
    place(cyl(5.6 * mm, 5.6 * mm, 7 * mm, 16), { y, z: D.headR - 9 * mm, rx: Math.PI / 2 }),
    place(cyl(4.2 * mm, 4.2 * mm, 2 * mm, 16), { y, z: D.headR - 5 * mm, rx: Math.PI / 2 }),
  ];
  // nappe vers l'avionique
  g.push(place(new THREE.BoxGeometry(8 * mm, 12 * mm, 0.4 * mm), { y: y - 9 * mm, z: D.headR - 13.6 * mm }));
  return mergeGeometries(g, false);
}

/* ------------------------ tube lanceur 40 mm ------------------------ */
export function buildTube(D) {
  const ri = D.caliber / 2, ro = D.caliber / 2 + D.tubeWall;
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

/* ================================================================== *
 * VISSERIE ET INSERTS
 *
 * Les pieces de structure sont imprimees (PA12 / PETG-CF). On n'y taraude
 * pas : chaque percage recoit un INSERT LAITON A CHAUD, et la vis vient s'y
 * visser. C'est la seule liaison demontable fiable sur une piece imprimee.
 *
 * Nomenclature retenue :
 *   M2 x 6 tete cylindrique six pans creux  -> assemblages de structure
 *   inserts laiton M2, OD 3,2, long. 4      -> dans la piece imprimee
 *   M1,4 x 4                                -> fixation moteur (entraxe 6,6)
 * ================================================================== */

/** Vis a tete cylindrique, axe +Y, origine sous la tete. */
function screw(d, len, headD, headH) {
  return mergeGeometries([
    place(cyl(d / 2, d / 2, len, 10), { y: -len / 2 }),
    place(cyl(headD / 2, headD / 2, headH, 12), { y: headH / 2 }),
    place(cyl(d * 0.32, d * 0.32, headH * 0.7, 6), { y: headH * 0.72 }),   // empreinte
  ], false);
}

/** Insert laiton a chaud : fut moletee, deux gorges de retenue. */
function insert(od, len) {
  const g = [place(cyl(od / 2, od / 2, len, 12), { y: -len / 2 })];
  for (const k of [0.3, 0.7]) {
    g.push(place(cyl(od / 2 + 0.18 * mm, od / 2 + 0.18 * mm, 0.5 * mm, 12), { y: -len * k }));
  }
  return mergeGeometries(g, false);
}

/**
 * Toute la visserie du drone, en deux geometries fusionnees (acier / laiton).
 * Chaque vis est doublee de son insert dans la piece receveuse.
 */
export function buildFasteners(D) {
  const M2 = { d: 2 * mm, len: 6 * mm, hd: 3.8 * mm, hh: 2 * mm, od: 3.2 * mm, il: 4 * mm };
  const sc = [], ins = [];

  // rangee de vis sur un cercle de percage
  const ring = (n, r, y, dir, a0 = 0) => {
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      const flip = dir < 0 ? Math.PI : 0;
      sc.push(place(screw(M2.d, M2.len, M2.hd, M2.hh), { x, y, z, rx: flip }));
      ins.push(place(insert(M2.od, M2.il), { x, y: y - dir * (M2.len - M2.il + 0.5 * mm), z, rx: flip }));
    }
  };

  ring(3, 14 * mm, Y.cageTop + 2.2 * mm, 1, 0.5);          // tete -> cloison haute
  ring(3, 14 * mm, Y.cageBot - 2.2 * mm, -1, 0.5);         // soute -> cloison basse
  ring(3, 15 * mm, Y.bayBot - 2.0 * mm, -1, 0.9);          // ogive -> soute
  // Carenage : vis dans une patte rentrante, et sur l'axe des PANNEAUX (0/90/
  // 180/270) et non des bras (45/135/...). A r = 16,5 la tete reste sous la
  // peau, et il subsiste 5,9° de garde angulaire avec le train rotor replie.
  ring(4, 16.5 * mm, Y.cageTop - 3.6 * mm, 1, 0);
  ring(4, 16.5 * mm, Y.cageBot + 3.6 * mm, -1, 0);

  // moyeu -> epine : quatre vis RADIALES au travers des pans de la couronne
  for (let i = 0; i < 4; i++) {
    const a = (i * 90) * RAD;
    const r = D.bodyR + 2.4 * mm;
    const m = new THREE.Matrix4().makeRotationY(a)
      .multiply(new THREE.Matrix4().makeTranslation(0, D.hingeY, r))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    sc.push(place(screw(M2.d, 5 * mm, M2.hd, M2.hh), {}).applyMatrix4(m));
    ins.push(place(insert(M2.od, 3.5 * mm), { y: -1.6 * mm }).applyMatrix4(m));
  }
  return { screws: mergeGeometries(sc, false), inserts: mergeGeometries(ins, false) };
}

/** Vis moteur M1,4 x 4, entraxe 6,6 — dans le repere du bras. */
export function buildMotorScrews(D) {
  const g = [];
  for (const s of [1, -1]) {
    g.push(place(screw(1.4 * mm, 4 * mm, 2.6 * mm, 1.4 * mm), {
      x: s * 3.3 * mm, y: D.motorOff - D.motorH / 2 - 1.4 * mm, z: D.armLen - D.armR, rx: Math.PI,
    }));
  }
  return mergeGeometries(g, false);
}
