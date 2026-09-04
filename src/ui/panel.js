import { SPECS, MECH_SPECS } from '../config.js';

const $ = (s) => document.querySelector(s);

/** Cablage du panneau HTML -> modele / viewer. Aucune dependance UI externe. */
export function initPanel({ viewer, drone, deploy, labels, mech }) {
  const out = {
    phase: $('[data-out="phase"]'), explode: $('[data-out="explode"]'),
    clip: $('[data-out="clip"]'), name: $('[data-out="phaseName"]'),
    clear: $('[data-out="clear"]'),
    arm: $('[data-out="arm"]'), lock: $('[data-out="lock"]'),
  };
  const hud = {
    fps: $('[data-hud="fps"]'), calls: $('[data-hud="calls"]'), tris: $('[data-hud="tris"]'),
  };
  const phase = $('#phase'), play = $('#play');

  // --- fiche technique ---
  const fiche = (rows) => rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('#specs').innerHTML = fiche(SPECS);
  $('#mech-specs').innerHTML = fiche(MECH_SPECS);

  const dirty = () => (viewer.dirty = true);

  const syncPhase = () => {
    phase.value = deploy.t;
    out.phase.textContent = `${Math.round(deploy.t * 100)} %`;
    out.name.textContent = deploy.phaseName;
    out.clear.textContent = `${deploy.clear.toFixed(2).replace('.', ',')} L`;
    out.clear.style.color = deploy.clear >= 1 ? 'var(--acc)' : 'var(--acc2)';
    out.arm.textContent = `${deploy.armAngle}°`;
    out.lock.textContent = deploy.locked ? 'VERROUILLÉ' : 'ouvert';
    out.lock.style.color = deploy.locked ? 'var(--acc)' : 'var(--acc2)';
    play.textContent = deploy.playing ? '❚❚ Pause' : '▶ Lancer la séquence';
    play.classList.toggle('primary', !deploy.playing);
  };

  phase.addEventListener('input', () => {
    deploy.pause();
    deploy.t = parseFloat(phase.value);
    deploy.apply(deploy.t, 0);
    syncPhase(); dirty();
  });
  play.addEventListener('click', () => { deploy.toggle(); syncPhase(); dirty(); });
  $('#loop').addEventListener('change', (e) => (deploy.loop = e.target.checked));

  document.querySelectorAll('[data-preset]').forEach((b) => {
    b.addEventListener('click', () => {
      deploy.pause();
      deploy.t = parseFloat(b.dataset.preset);
      deploy.apply(deploy.t, 0);
      syncPhase(); dirty();
    });
  });

  $('#explode').addEventListener('input', (e) => {
    const k = parseFloat(e.target.value);
    drone.setExplode(k);
    out.explode.textContent = `${Math.round(k * 100)} %`;
    dirty();
  });

  $('#clip').addEventListener('input', (e) => {
    const s = parseFloat(e.target.value);
    viewer.clippingPlanes[0].constant = s * 0.055;
    out.clip.textContent = s >= 0.98 ? 'off' : `${Math.round(s * 55)} mm`;
    dirty();
  });

  let labelsWanted = true;
  const mechBtn = $('#mech');
  mechBtn.addEventListener('click', () => {
    mech.setEnabled(!mech.on, labelsWanted);
    mechBtn.classList.toggle('on', mech.on);
    mechBtn.textContent = mech.on ? 'Vue d\'ensemble' : 'Vue mécanisme';
  });

  const bind = (id, fn) => $(id).addEventListener('change', (e) => { fn(e.target.checked); dirty(); });
  bind('#opt-internals', (v) => drone.setInternals(v));
  bind('#opt-tube', (v) => { drone.setLauncher(v); drone.setExplode(parseFloat($('#explode').value)); });
  bind('#opt-labels', (v) => { labelsWanted = v; mech.setEnabled(mech.on, v); if (!mech.on) labels.setEnabled(v); });
  bind('#opt-wire', (v) => drone.setWireframe(v));
  bind('#opt-spin', (v) => (deploy.spin = v));
  bind('#opt-orbit', (v) => (viewer.controls.autoRotate = v));

  $('#reset').addEventListener('click', () => viewer.resetView());
  $('#shot').addEventListener('click', () => {
    viewer.renderer.render(viewer.scene, viewer.camera);
    const a = document.createElement('a');
    a.download = `xr-001-drone40-${Math.round(deploy.t * 100)}pct.png`;
    a.href = viewer.canvas.toDataURL('image/png');
    a.click();
  });

  $('#panel-toggle').addEventListener('click', () => $('#panel').classList.toggle('hidden'));

  addEventListener('keydown', (e) => {
    if (e.target.matches('input')) return;
    if (e.code === 'Space') { e.preventDefault(); deploy.toggle(); syncPhase(); dirty(); }
    if (e.code === 'KeyR') { mech.setEnabled(false, labelsWanted); mechBtn.classList.remove('on'); mechBtn.textContent = 'Vue mécanisme'; viewer.resetView(); }
    if (e.code === 'KeyM') mechBtn.click();
    if (e.code === 'KeyE') { $('#explode').value = $('#explode').value > 0 ? 0 : 1; $('#explode').dispatchEvent(new Event('input')); }
  });

  syncPhase();

  let acc = 0;
  return {
    tick(dt) {
      syncPhase();
      acc += dt;
      if (acc < 0.5) return;
      acc = 0;
      const info = viewer.renderer.info.render;
      hud.fps.textContent = `${viewer.fps} fps`;
      hud.calls.textContent = `${info.calls} draw`;
      hud.tris.textContent = `${(info.triangles / 1000).toFixed(1)}k tri`;
    },
  };
}
