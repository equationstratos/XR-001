import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* ------------------------------------------------------------------ *
 * Socle de rendu : scene, camera, eclairage, IBL, controles.
 * Optimisations cles :
 *  - rendu a la demande (on ne redessine que si la scene est "sale"
 *    ou si une animation tourne) -> 0 % GPU au repos ;
 *  - devicePixelRatio plafonne a 2 ;
 *  - environnement PBR pre-calcule une seule fois (PMREM) ;
 *  - une seule lumiere projetant des ombres, shadow map serree.
 * ------------------------------------------------------------------ */

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.dirty = true;
    this.animating = false;
    this._frames = 0;
    this._fpsT = 0;
    this.fps = 0;
    this.updaters = [];

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
      preserveDrawingBuffer: true, alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;

    this.clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1)];

    this.scene = new THREE.Scene();
    this.scene.background = gradientBackground();

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 12);
    this.home = { pos: new THREE.Vector3(0.34, 0.17, 0.42), target: new THREE.Vector3(0, 0.06, 0) };

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 0.11;
    this.controls.maxDistance = 2.2;
    this.controls.maxPolarAngle = Math.PI * 0.94;
    this.controls.autoRotateSpeed = 0.9;
    this.controls.addEventListener('change', () => (this.dirty = true));

    this._setupEnvironment();
    this._setupLights();
    this.resetView(true);

    this._onResize = () => this.resize();
    addEventListener('resize', this._onResize);
    this.resize();
  }

  _setupEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = env.texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
  }

  _setupLights() {
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(0.45, 0.8, 0.35);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.002;
    const c = key.shadow.camera;
    c.near = 0.05; c.far = 2.2;
    c.left = c.bottom = -0.28; c.right = c.top = 0.28;
    this.scene.add(key, key.target);

    const rim = new THREE.DirectionalLight(0x9fc7ff, 1.1);
    rim.position.set(-0.6, 0.25, -0.5);
    this.scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      new THREE.ShadowMaterial({ opacity: 0.42 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.16;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.groundY = ground.position.y;
  }

  resetView(instant = false) {
    this.camera.position.copy(this.home.pos);
    this.controls.target.copy(this.home.target);
    this.controls.update();
    if (!instant) this.dirty = true;
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.dirty = true;
  }

  /** Boucle : rAF permanent mais rendu conditionnel. */
  start() {
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      for (const fn of this.updaters) fn(dt);
      const moved = this.controls.update();
      if (moved || this.dirty || this.animating || this.controls.autoRotate) {
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
        this._frames++;
      }
      this._fpsT += dt;
      if (this._fpsT >= 0.5) {
        this.fps = Math.round(this._frames / this._fpsT);
        this._frames = 0; this._fpsT = 0;
      }
    };
    tick();
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    removeEventListener('resize', this._onResize);
    this.controls.dispose();
    this.renderer.dispose();
  }
}

function gradientBackground() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#1b232b');
  grd.addColorStop(0.55, '#10151a');
  grd.addColorStop(1, '#080a0c');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
