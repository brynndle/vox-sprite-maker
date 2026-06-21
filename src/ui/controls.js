import * as THREE from 'three';
import { state, PAL } from '../state.js';
import { cam, syncCam } from '../renderer/scene.js';
import { setOutRes } from '../renderer/pixelOutput.js';
import { SK, root, bodyV, clothV, partMap, rebuild, applySkin } from '../character/skeleton.js';
import { getDims, mat, GRAY, BG, U } from '../character/voxels.js';
import { rebuildCloth, WDEFS, equipped } from '../character/clothing.js';
import { rebuildFace, EYE_PRESETS, BROW_PRESETS, MOUTH_PRESETS, NOSE_PRESETS } from '../character/face.js';
import { rebuildHair, HAIR_PRESETS } from '../character/hair.js';
import { resetPose, animPose } from '../animation/poses.js';
import { pushUndo, doUndo, doRedo } from './undo.js';
import { exportFrame, exportSpritesheet } from '../export/spritesheet.js';

// ── Undo buttons ──────────────────────────────────────────────────────────────
document.getElementById('undo-btn').addEventListener('click', doUndo);
document.getElementById('redo-btn').addEventListener('click', doRedo);
window.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
  if (mod && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) { e.preventDefault(); doRedo(); }
});

// ── Mode buttons ──────────────────────────────────────────────────────────────
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); state.mode = b.dataset.mode;
  document.getElementById('pp').style.display = state.mode === 'paint' ? '' : 'none';
  document.getElementById('sp').style.display = state.mode === 'sculpt' ? '' : 'none';
  document.getElementById('cp').style.display = state.mode === 'cloth' ? '' : 'none';
}));

// ── Tool buttons ──────────────────────────────────────────────────────────────
document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-tool]').forEach(x => x.classList.remove('act'));
  b.classList.add('act'); state.tool = b.dataset.tool;
}));

// ── Animation buttons ─────────────────────────────────────────────────────────
document.querySelectorAll('[data-anim]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-anim]').forEach(x => x.classList.remove('act'));
  b.classList.add('act'); state.anim = b.dataset.anim; state.tick = 0;
  if (!state.playing) { resetPose(SK, root); animPose(0, SK, root); }
}));

// ── Direction buttons ─────────────────────────────────────────────────────────
document.querySelectorAll('.dbtn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.dbtn').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); state.camT = parseFloat(b.dataset.a); syncCam();
}));

// ── Play button ───────────────────────────────────────────────────────────────
document.getElementById('playbtn').addEventListener('click', function () {
  state.playing = !state.playing;
  this.textContent = state.playing ? '⏹ Stop' : '▶ Play';
  this.classList.toggle('on', state.playing);
  if (!state.playing) { state.tick = 0; resetPose(SK, root); }
});

// ── Output resolution buttons ─────────────────────────────────────────────────
document.querySelectorAll('[data-outres]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-outres]').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); setOutRes(parseInt(b.dataset.outres));
}));

// ── Shading / outline / outline-color buttons ─────────────────────────────────
document.querySelectorAll('[data-shade]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-shade]').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); state.shadeMode = b.dataset.shade;
}));
document.querySelectorAll('[data-outline]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-outline]').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); state.outlineMode = b.dataset.outline;
}));
document.querySelectorAll('[data-ocol]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-ocol]').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); state.outlineCol = b.dataset.ocol;
}));

// ── Body shape sliders ────────────────────────────────────────────────────────
document.querySelectorAll('[data-s]').forEach(el => {
  el.addEventListener('input', () => { state.S[el.dataset.s] = parseFloat(el.value); rebuild(); });
});

// ── Color pickers ─────────────────────────────────────────────────────────────
document.getElementById('skinc').addEventListener('input', e => { state.skin = e.target.value; applySkin(); });
document.getElementById('hairc').addEventListener('input', e => { state.hairCol = e.target.value; rebuildHair(SK); });
document.getElementById('featc').addEventListener('input', e => { state.featCol = e.target.value; rebuildFace(SK); });

// ── Paint color swatches ──────────────────────────────────────────────────────
const swC = document.getElementById('swatches');
PAL.forEach(c => {
  const d = document.createElement('div'); d.className = 'sw'; d.style.background = c; d.dataset.c = c;
  d.addEventListener('click', () => { state.col = c; document.getElementById('cc').value = c; updateSw(); });
  swC.appendChild(d);
});
function updateSw() {
  document.querySelectorAll('.sw').forEach(s => s.classList.toggle('sel', s.dataset.c === state.col));
}
document.getElementById('cc').addEventListener('input', e => { state.col = e.target.value; updateSw(); });

// ── Face / hair preset UI ─────────────────────────────────────────────────────
function buildPresetUI(id, presets, getActive, onSel) {
  const cont = document.getElementById(id); cont.innerHTML = '';
  Object.keys(presets).forEach(key => {
    const b = document.createElement('button');
    b.className = 'btn pbtn' + (key === getActive() ? ' sel' : '');
    b.textContent = key;
    b.addEventListener('click', () => {
      cont.querySelectorAll('.pbtn').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel'); onSel(key);
    });
    cont.appendChild(b);
  });
}

buildPresetUI('eye-presets',   EYE_PRESETS,   () => state.activeEyes,   k => { state.activeEyes = k;   rebuildFace(SK); });
buildPresetUI('brow-presets',  BROW_PRESETS,  () => state.activeBrows,  k => { state.activeBrows = k;  rebuildFace(SK); });
buildPresetUI('mouth-presets', MOUTH_PRESETS, () => state.activeMouth,  k => { state.activeMouth = k;  rebuildFace(SK); });
buildPresetUI('nose-presets',  NOSE_PRESETS,  () => state.activeNose,   k => { state.activeNose = k;   rebuildFace(SK); });
buildPresetUI('hair-presets',  HAIR_PRESETS,  () => state.activeHair,   k => { state.activeHair = k;   rebuildHair(SK); });

// ── Wardrobe grid ─────────────────────────────────────────────────────────────
const wg = document.getElementById('wgrid');
Object.entries(WDEFS).forEach(([k, d]) => {
  const b = document.createElement('button');
  b.className = 'btn wbtn'; b.dataset.piece = k;
  b.innerHTML = `👕 ${d.label}`;
  b.addEventListener('click', () => {
    const slot = WDEFS[k].slot;
    if (equipped[slot] === k) { delete equipped[slot]; b.classList.remove('eq'); }
    else {
      const p = equipped[slot];
      if (p) document.querySelector(`[data-piece="${p}"]`)?.classList.remove('eq');
      equipped[slot] = k; b.classList.add('eq');
    }
    rebuildCloth(SK, root, clothV, getDims);
  });
  wg.appendChild(b);
});

// ── Export buttons ────────────────────────────────────────────────────────────
document.getElementById('expF').addEventListener('click', exportFrame);
document.getElementById('expS').addEventListener('click', exportSpritesheet);

// ── Raycasting / painting / sculpting ─────────────────────────────────────────
const ray = new THREE.Raycaster();
const m2 = new THREE.Vector2();
const c3 = document.getElementById('c3');
let isPainting = false, isOrbiting = false, lmx = 0, lmy = 0, strokeUndoMap = null;

function getHit(e) {
  const r = c3.getBoundingClientRect();
  m2.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  m2.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(m2, cam);
  return ray.intersectObjects([...bodyV, ...clothV])[0] || null;
}

function doAct(e) {
  const isCmd = e.metaKey || e.ctrlKey;
  const hit = getHit(e); if (!hit) return;
  const mesh = hit.object;

  if (state.mode === 'sculpt') {
    if (isCmd) {
      const parent = mesh.parent; if (!parent) return;
      const oldMat = mesh.material.clone();
      parent.remove(mesh); bodyV.splice(bodyV.indexOf(mesh), 1);
      pushUndo({
        undo() { mesh.material = oldMat; parent.add(mesh); bodyV.push(mesh); },
        redo() { parent.remove(mesh); bodyV.splice(bodyV.indexOf(mesh), 1); }
      });
    } else {
      const n = hit.face.normal.clone().transformDirection(mesh.matrixWorld).round();
      const nm = new THREE.Mesh(BG, mat(GRAY));
      nm.position.copy(mesh.position).addScaledVector(n, U);
      nm.userData.part = mesh.userData.part; nm.userData.bc = GRAY;
      mesh.parent.add(nm); bodyV.push(nm);
      pushUndo({
        undo() { if (nm.parent) nm.parent.remove(nm); bodyV.splice(bodyV.indexOf(nm), 1); },
        redo() { mesh.parent.add(nm); bodyV.push(nm); }
      });
    }
    return;
  }

  if (state.mode === 'paint' || state.mode === 'cloth') {
    if (state.tool === 'pick') {
      state.col = '#' + mesh.material.color.getHexString();
      document.getElementById('cc').value = state.col; updateSw(); return;
    }
    if (state.tool === 'fill') {
      const pn = mesh.userData.part;
      const affected = [...bodyV, ...clothV].filter(m => m.userData.part === pn);
      const prevColors = affected.map(m => m.material.color.getHexString());
      const newCol = state.col;
      affected.forEach(m => m.material = mat(newCol));
      pushUndo({
        undo() { affected.forEach((m, i) => m.material = mat('#' + prevColors[i])); },
        redo() { affected.forEach(m => m.material = mat(newCol)); }
      });
      return;
    }
    if (strokeUndoMap) {
      if (!strokeUndoMap.has(mesh)) strokeUndoMap.set(mesh, mesh.material.color.getHexString());
      mesh.material = mat(state.col);
    }
  }
}

c3.addEventListener('contextmenu', e => e.preventDefault());
c3.addEventListener('mousedown', e => {
  lmx = e.clientX; lmy = e.clientY;
  if (e.button === 2 || e.shiftKey) { isOrbiting = true; return; }
  isPainting = true;
  if (state.mode === 'paint' || state.mode === 'cloth') { strokeUndoMap = new Map(); doAct(e); }
  else doAct(e);
});
c3.addEventListener('mousemove', e => {
  const dx = e.clientX - lmx, dy = e.clientY - lmy;
  lmx = e.clientX; lmy = e.clientY;
  if (isOrbiting) { state.camT -= dx * 0.007; state.camP = Math.max(-0.4, Math.min(1.2, state.camP + dy * 0.006)); syncCam(); }
  else if (isPainting && (state.mode === 'paint' || state.mode === 'cloth')) doAct(e);
});
window.addEventListener('mouseup', () => {
  if (isPainting && strokeUndoMap && strokeUndoMap.size > 0) {
    const entries = [...strokeUndoMap.entries()], newCol = state.col;
    pushUndo({
      undo() { entries.forEach(([m, prev]) => m.material = mat('#' + prev)); },
      redo() { entries.forEach(([m]) => m.material = mat(newCol)); }
    });
    strokeUndoMap = null;
  }
  isPainting = false; isOrbiting = false;
});
