import { Viewer } from './core/viewer.js';
import { createMaterials } from './core/materials.js';
import { Drone } from './model/drone.js';
import { Deployment } from './anim/deployment.js';
import { Labels } from './ui/labels.js';
import { MechView } from './ui/mechview.js';
import { initPanel } from './ui/panel.js';

function boot() {
const viewer = new Viewer(document.getElementById('scene'));
const materials = createMaterials(viewer.clippingPlanes);
const drone = new Drone(materials);
viewer.scene.add(drone.group);

const deploy = new Deployment(drone);
const host = document.getElementById('labels');
const labels = new Labels(host, viewer.camera, drone.root, drone.labels);
const mechLabels = new Labels(host, viewer.camera, drone.root, drone.mechLabels);
const mech = new MechView({ viewer, drone, labels, mechLabels });
const panel = initPanel({ viewer, drone, deploy, labels, mech });

viewer.updaters.push((dt) => {
  if (deploy.update(dt)) viewer.dirty = true;
  viewer.animating = deploy.playing || deploy.cycle;
  mech.update();
  const w = viewer.canvas.clientWidth, h = viewer.canvas.clientHeight;
  labels.update(w, h);
  mechLabels.update(w, h);
  panel.tick(dt);
});

// Accroche de diagnostic : permet de mesurer les jeux reels sur la geometrie
// telle qu'elle est rendue (rayon d'encombrement, interferences), plutot que
// de refaire les calculs a cote du modele.
window.__xr = { viewer, drone, deploy, labels, mechLabels, mech };

viewer.start();
// Le garde-fou de index.html attend ce drapeau : tant qu'il est absent, il
// affiche un diagnostic plutot que de laisser tourner le rond de chargement.
window.__xrBooted = true;
requestAnimationFrame(() => document.getElementById('loading').classList.add('done'));

// Rechargement a chaud propre en developpement.
if (import.meta.hot) {
  import.meta.hot.dispose(() => { drone.dispose(); labels.dispose(); mechLabels.dispose(); viewer.dispose(); });
}
}

try {
  boot();
} catch (err) {
  console.error(err);
  if (window.__xrBootError) {
    window.__xrBootError('Erreur au démarrage', String((err && err.message) || err),
      'Détail complet dans la console du navigateur.');
  }
}
