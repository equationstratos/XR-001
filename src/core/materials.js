import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Bibliotheque de materiaux PBR — 100 % procedurale (aucun asset a
 * telecharger). Les textures sont generees une fois sur canvas 2D en
 * 128 px puis repetees : cout memoire negligeable, rendu credible.
 * ------------------------------------------------------------------ */

const cache = new Map();
function canvasTex(key, size, draw, repeat = 1) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Tissage carbone 2x2 twill. */
function carbonMap() {
  return canvasTex('carbon', 128, (g, s) => {
    const n = 8, cell = s / n;
    g.fillStyle = '#14171a';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const up = ((x + y) % 4) < 2;
        const grd = g.createLinearGradient(x * cell, y * cell, x * cell + cell, y * cell + cell);
        grd.addColorStop(0, up ? '#31383e' : '#0e1113');
        grd.addColorStop(0.5, up ? '#454d54' : '#181c20');
        grd.addColorStop(1, up ? '#22282d' : '#090b0d');
        g.fillStyle = grd;
        g.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }, 14);
}

/** Bruit fin pour les metaux brosses / polymeres. */
function grainMap(key, base, amp) {
  return canvasTex(key, 128, (g, s) => {
    const img = g.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const v = base + (Math.random() - 0.5) * amp;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, 3);
}

export function createMaterials(clippingPlanes) {
  const base = { clippingPlanes, clipShadows: true };
  const M = {
    carbon: new THREE.MeshPhysicalMaterial({
      ...base, color: 0x7c838a, map: carbonMap(), roughness: 0.52, metalness: 0.18,
      clearcoat: 0.55, clearcoatRoughness: 0.28, side: THREE.DoubleSide,
    }),
    alu: new THREE.MeshStandardMaterial({
      ...base, color: 0x8d959c, roughness: 0.42, metalness: 1,
      roughnessMap: grainMap('grain-a', 150, 40),
    }),
    aluDark: new THREE.MeshStandardMaterial({
      ...base, color: 0x3c444b, roughness: 0.5, metalness: 0.9,
    }),
    olive: new THREE.MeshStandardMaterial({
      ...base, color: 0x555f3c, roughness: 0.72, metalness: 0.08,
      roughnessMap: grainMap('grain-o', 180, 55),
    }),
    polymer: new THREE.MeshStandardMaterial({
      ...base, color: 0x1b1f23, roughness: 0.62, metalness: 0.05,
      roughnessMap: grainMap('grain-p', 170, 60),
    }),
    brass: new THREE.MeshStandardMaterial({
      ...base, color: 0xb98b3c, roughness: 0.28, metalness: 1,
    }),
    copper: new THREE.MeshStandardMaterial({ ...base, color: 0xa8632c, roughness: 0.35, metalness: 1 }),
    pcb: new THREE.MeshStandardMaterial({ ...base, color: 0x123b2b, roughness: 0.55, metalness: 0.1 }),
    cellA: new THREE.MeshStandardMaterial({ ...base, color: 0xb4141c, roughness: 0.45, metalness: 0.25 }),
    cellB: new THREE.MeshStandardMaterial({ ...base, color: 0xd9b323, roughness: 0.45, metalness: 0.25 }),
    rubber: new THREE.MeshStandardMaterial({ ...base, color: 0x101315, roughness: 0.92, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({
      ...base, color: 0x0d1a22, roughness: 0.06, metalness: 0.2,
      transmission: 0.55, thickness: 0.004, ior: 1.5,
    }),
    led: new THREE.MeshStandardMaterial({
      ...base, color: 0x000000, emissive: 0x7fd1a8, emissiveIntensity: 3, roughness: 0.4,
    }),
    blade: new THREE.MeshStandardMaterial({
      ...base, color: 0x181c20, roughness: 0.44, metalness: 0.12, side: THREE.DoubleSide,
    }),
  };
  M.all = Object.values(M).filter((m) => m.isMaterial);
  return M;
}

export function disposeMaterials(M) {
  M.all.forEach((m) => m.dispose());
  cache.forEach((t) => t.dispose());
  cache.clear();
}
