import * as THREE from 'three';

/**
 * Reperes 2D projetes a la main (plus leger qu'un CSS2DRenderer :
 * pas de scene parallele, 6 elements DOM, aucun reflow).
 */
export class Labels {
  constructor(container, camera, rootObject, items) {
    this.camera = camera;
    this.root = rootObject;
    this.enabled = true;
    this._v = new THREE.Vector3();
    this.items = items.map((it) => {
      const el = document.createElement('div');
      el.className = 'lbl';
      el.textContent = it.text;
      container.appendChild(el);
      return { ...it, el };
    });
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.items.forEach((i) => i.el.classList.remove('show'));
  }

  update(w, h) {
    if (!this.enabled) return;
    this.root.updateWorldMatrix(true, true);
    for (const it of this.items) {
      const v = this._v.copy(it.pos).applyMatrix4((it.obj || this.root).matrixWorld).project(this.camera);
      const visible = v.z < 1;
      it.el.classList.toggle('show', visible);
      if (visible) {
        it.el.style.transform =
          `translate(-50%,-50%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      }
    }
  }

  dispose() { this.items.forEach((i) => i.el.remove()); }
}
