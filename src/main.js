import { Viewer } from './core/viewer.js';
import { createMaterials } from './core/materials.js';
import { Drone } from './model/drone.js';
import { Deployment } from './anim/deployment.js';
import { Labels } from './ui/labels.js';
import { initPanel } from './ui/panel.js';

const viewer = new Viewer(document.getElementById('scene'));
const materials = createMaterials(viewer.clippingPlanes);
const drone = new Drone(materials);
viewer.scene.add(drone.group);

const deploy = new Deployment(drone);
const labels = new Labels(document.getElementById('labels'), viewer.camera, drone.root, drone.labels);
const panel = initPanel({ viewer, drone, deploy, labels });

viewer.updaters.push((dt) => {
  if (deploy.update(dt)) viewer.dirty = true;
  viewer.animating = deploy.playing;
  labels.update(viewer.canvas.clientWidth, viewer.canvas.clientHeight);
  panel.tick(dt);
});

viewer.start();
requestAnimationFrame(() => document.getElementById('loading').classList.add('done'));

// Rechargement a chaud propre en developpement.
if (import.meta.hot) {
  import.meta.hot.dispose(() => { drone.dispose(); labels.dispose(); viewer.dispose(); });
}
