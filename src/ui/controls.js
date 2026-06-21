import * as THREE from 'three';
import { state, PAL } from '../state.js';
import { cam, syncCam } from '../renderer/scene.js';
import { setOutSize } from '../renderer/pixelOutput.js';
import { SK, root, bodyV, clothV, partMap, rebuild, applySkin } from '../character/skeleton.js';
import { getDims, mat, GRAY, BG, U } from '../character/voxels.js';
import { rebuildCloth, WDEFS, equipped } from '../character/clothing.js';
import { rebuildFace, EYE_PRESETS, BROW_PRESETS, MOUTH_PRESETS, NOSE_PRESETS } from '../character/face.js';
import { rebuildHair, HAIR_PRESETS } from '../character/hair.js';
import { resetPose, animPose } from '../animation/poses.js';
import { pushUndo, doUndo, doRedo } from './undo.js';
import { exportFrame, exportStaticSheet, exportWalkSheet } from '../export/spritesheet.js';
import { savedParts, savePart, resetPart } from '../character/parts.js';
import { customWardrobe, saveCloth, deleteCloth } from '../character/wardrobe.js';

// ── Undo buttons ──────────────────────────────────────────────────────────────
document.getElementById('undo-btn').addEventListener('click', doUndo);
document.getElementById('redo-btn').addEventListener('click', doRedo);
window.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
  if (mod && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) { e.preventDefault(); doRedo(); }
});

// ── Sculpt tool buttons ───────────────────────────────────────────────────────
document.querySelectorAll('[data-stool]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-stool]').forEach(x => x.classList.remove('act'));
  b.classList.add('act'); state.sculptTool = b.dataset.stool;
  const isRound = b.dataset.stool === 'round';
  document.getElementById('sculpt-size-row').style.display = isRound ? 'none' : '';
  document.getElementById('sculpt-round-rows').style.display = isRound ? '' : 'none';
}));

// ── Sculpt tool sliders ───────────────────────────────────────────────────────
document.getElementById('sculpt-size').addEventListener('input', e => {
  state.sculptSize = parseInt(e.target.value);
  document.getElementById('sculpt-size-val').textContent = e.target.value;
});
document.getElementById('round-radius').addEventListener('input', e => {
  state.roundRadius = parseFloat(e.target.value);
  document.getElementById('round-radius-val').textContent = e.target.value;
});
document.getElementById('round-strength').addEventListener('input', e => {
  state.roundStrength = parseFloat(e.target.value);
  document.getElementById('round-strength-val').textContent = parseFloat(e.target.value).toFixed(2);
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
  b.classList.add('on');
  const w = parseInt(b.dataset.outres);
  setOutSize(w, w * 2);
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
const STYLES_BY_SLOT = {
  top:  ['shirt', 'coat'],
  legs: ['pants', 'shorts'],
  feet: ['shoes'],
  head: ['hat'],
};

const wg = document.getElementById('wgrid');

function buildWardrobeGrid() {
  wg.innerHTML = '';
  function addPiece(key, def, isCustom) {
    const b = document.createElement('button');
    b.className = 'btn wbtn'; b.dataset.piece = key;
    if (isCustom) b.style.cssText = 'border-color:#89b4fa';
    if (equipped[def.slot] === key) b.classList.add('eq');

    const nameSpan = document.createElement('span');
    nameSpan.textContent = def.label;
    b.appendChild(nameSpan);

    if (isCustom) {
      const editSpan = document.createElement('span');
      editSpan.textContent = '✏';
      editSpan.style.cssText = 'font-size:9px;color:#89b4fa;cursor:pointer;line-height:1.2';
      editSpan.addEventListener('click', e => { e.stopPropagation(); openClothEditor(key, def); });
      b.appendChild(editSpan);
    }

    b.addEventListener('click', () => {
      if (equipped[def.slot] === key) { delete equipped[def.slot]; b.classList.remove('eq'); }
      else {
        const prev = equipped[def.slot];
        if (prev) document.querySelector(`[data-piece="${prev}"]`)?.classList.remove('eq');
        equipped[def.slot] = key; b.classList.add('eq');
      }
      rebuildCloth(SK, root, clothV, getDims);
    });
    wg.appendChild(b);
  }
  Object.entries(WDEFS).forEach(([k, d]) => addPiece(k, d, false));
  Object.entries(customWardrobe).forEach(([k, d]) => addPiece(k, d, true));
}

// ── Clothing editor ────────────────────────────────────────────────────────────
let _editingClothId = null;

function updateStyleOptions(slot, current) {
  const sel = document.getElementById('cloth-style');
  sel.innerHTML = '';
  (STYLES_BY_SLOT[slot] || []).forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s[0].toUpperCase() + s.slice(1);
    sel.appendChild(o);
  });
  if (current) sel.value = current;
}

function openClothEditor(id, def) {
  _editingClothId = id || null;
  document.getElementById('cloth-name').value = def?.label || '';
  const slot = def?.slot || 'top';
  document.getElementById('cloth-slot').value = slot;
  updateStyleOptions(slot, def?.style);
  document.getElementById('cloth-color').value = def?.color || '#888888';
  document.getElementById('cloth-delete-btn').style.display = id ? '' : 'none';
  document.getElementById('cloth-editor-card').style.display = '';
}

function closeClothEditor() {
  _editingClothId = null;
  document.getElementById('cloth-editor-card').style.display = 'none';
}

document.getElementById('new-cloth-btn').addEventListener('click', () => openClothEditor(null, null));
document.getElementById('cloth-cancel-btn').addEventListener('click', closeClothEditor);

document.getElementById('cloth-slot').addEventListener('change', e => {
  updateStyleOptions(e.target.value, null);
});

document.getElementById('cloth-save-btn').addEventListener('click', () => {
  const label = document.getElementById('cloth-name').value.trim();
  if (!label) { alert('Please enter a name.'); return; }
  const slot  = document.getElementById('cloth-slot').value;
  const style = document.getElementById('cloth-style').value;
  const color = document.getElementById('cloth-color').value;
  const id = _editingClothId || ('c' + Date.now());
  saveCloth(id, { label, slot, style, color });
  closeClothEditor();
  buildWardrobeGrid();
});

document.getElementById('cloth-delete-btn').addEventListener('click', () => {
  if (!_editingClothId) return;
  const def = customWardrobe[_editingClothId];
  if (!confirm(`Delete "${def?.label}"?`)) return;
  if (def && equipped[def.slot] === _editingClothId) {
    delete equipped[def.slot];
    rebuildCloth(SK, root, clothV, getDims);
  }
  deleteCloth(_editingClothId);
  closeClothEditor();
  buildWardrobeGrid();
});

buildWardrobeGrid();

// ── Export buttons ────────────────────────────────────────────────────────────
document.getElementById('expF').addEventListener('click', exportFrame);
document.getElementById('expS').addEventListener('click', exportStaticSheet);
document.getElementById('expW').addEventListener('click', exportWalkSheet);

// ── Body part editor ──────────────────────────────────────────────────────────
// Maps each mesh.userData.part → which SK ancestor group to use as local space.
const PART_ANCESTOR = {
  head: 'head', pelvis: 'torso', torso: 'torso',
  lUpperArm: 'lArm', lLowerArm: 'lElbow', lHand: 'lElbow',
  lUpperLeg: 'lLeg', lLowerLeg: 'lKnee', lFoot: 'lKnee',
};
const PART_FILTERS = {
  head:  p => p === 'head',
  torso: p => p === 'torso' || p === 'pelvis',
  arm:   p => p === 'lUpperArm' || p === 'lLowerArm' || p === 'lHand',
  leg:   p => p === 'lUpperLeg' || p === 'lLowerLeg' || p === 'lFoot',
};

const _wp2 = new THREE.Vector3();

function capturePartData(groupName) {
  const filter = PART_FILTERS[groupName];
  if (!filter) return null;
  const data = [];
  bodyV.forEach(m => {
    if (!filter(m.userData.part)) return;
    const ancKey = PART_ANCESTOR[m.userData.part];
    if (!ancKey || !SK[ancKey]) return;
    m.getWorldPosition(_wp2);
    const lp = SK[ancKey].worldToLocal(_wp2.clone());
    data.push({
      x: +lp.x.toFixed(4), y: +lp.y.toFixed(4), z: +lp.z.toFixed(4),
      color: '#' + m.material.color.getHexString(),
      part: m.userData.part,
      isSkin: m.userData.isSkin || false,
      skAncestor: ancKey,
    });
  });
  return data;
}

let selectedEditPart = null;

function updatePartUI() {
  document.querySelectorAll('[data-editpart]').forEach(b => {
    const pname = b.dataset.editpart;
    b.classList.toggle('on', pname === selectedEditPart);
    const hasSaved = !!savedParts[pname];
    b.title = hasSaved ? 'Custom saved' : 'Default shape';
    b.style.borderColor = hasSaved ? '#a6e3a1' : '';
    b.style.color = hasSaved ? '#a6e3a1' : '';
  });
  const hasSelection = !!selectedEditPart;
  document.getElementById('save-part-btn').disabled = !hasSelection;
  document.getElementById('reset-part-btn').disabled = !hasSelection || !savedParts[selectedEditPart];
  if (selectedEditPart) {
    const label = { head: 'Head', torso: 'Torso', arm: 'Arms', leg: 'Legs' }[selectedEditPart];
    const status = savedParts[selectedEditPart] ? 'custom' : 'default';
    document.getElementById('part-info').textContent = `${label} — ${status} shape selected`;
  } else {
    document.getElementById('part-info').textContent = 'Select a part to edit or save';
  }
}

document.querySelectorAll('[data-editpart]').forEach(b => {
  b.addEventListener('click', () => {
    selectedEditPart = selectedEditPart === b.dataset.editpart ? null : b.dataset.editpart;
    updatePartUI();
  });
});

document.getElementById('save-part-btn').addEventListener('click', () => {
  if (!selectedEditPart) return;
  const data = capturePartData(selectedEditPart);
  if (!data || !data.length) { alert('No voxels found for this part — sculpt something first!'); return; }
  savePart(selectedEditPart, data);
  updatePartUI();
});

document.getElementById('reset-part-btn').addEventListener('click', () => {
  if (!selectedEditPart) return;
  if (!confirm(`Reset ${selectedEditPart} to default procedural shape?`)) return;
  resetPart(selectedEditPart);
  rebuild();
  updatePartUI();
});

updatePartUI();

// ── Raycasting / painting / sculpting ─────────────────────────────────────────
const ray = new THREE.Raycaster();
const m2 = new THREE.Vector2();
const c3 = document.getElementById('c3');
let isPainting = false, isOrbiting = false, lmx = 0, lmy = 0, strokeUndoMap = null;
let roundStroke = null; // accumulates removals per round drag stroke

// Reusable vectors to avoid per-call allocation in hot path
const _wp = new THREE.Vector3();
const _ctr = new THREE.Vector3();

// Spherical chamfer: carves away corner/edge voxels within radius R of hit.point.
// Corner voxels (3 exposed faces) are removed up to R; edge voxels (2) up to R*0.7;
// surface voxels (1) up to R*0.35; interior voxels never removed.
function doRound(hit) {
  const R = state.roundRadius;
  const center = hit.point;

  // Build world-space position map keyed on 2× coords to handle 0.5-unit offsets
  const posMap = new Map();
  [...bodyV, ...clothV].forEach(m => {
    m.getWorldPosition(_wp);
    posMap.set(`${Math.round(_wp.x * 2)},${Math.round(_wp.y * 2)},${Math.round(_wp.z * 2)}`, m);
  });

  const D6 = [[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]];
  const toRemove = [];

  bodyV.forEach(m => {
    m.getWorldPosition(_wp);
    const d = _wp.distanceTo(center);
    if (d >= R) return;

    const kx = Math.round(_wp.x * 2), ky = Math.round(_wp.y * 2), kz = Math.round(_wp.z * 2);
    let empty = 0;
    for (const [dx, dy, dz] of D6) {
      if (!posMap.has(`${kx+dx},${ky+dy},${kz+dz}`)) empty++;
    }

    // Threshold: how deep the sphere carves depends on voxel convexity
    const thresh = empty >= 3 ? R : empty >= 2 ? R * state.roundStrength : empty >= 1 ? R * state.roundStrength * 0.5 : 0;
    if (d < thresh) toRemove.push({ mesh: m, parent: m.parent });
  });

  if (!toRemove.length) return;

  toRemove.forEach(({ mesh, parent }) => {
    parent.remove(mesh);
    const i = bodyV.indexOf(mesh);
    if (i !== -1) bodyV.splice(i, 1);
  });

  // Accumulate into the stroke batch if dragging; otherwise push immediately
  if (roundStroke !== null) {
    roundStroke.push(...toRemove);
  } else {
    const removed = toRemove;
    pushUndo({
      undo() { removed.forEach(({ mesh, parent }) => { parent.add(mesh); bodyV.push(mesh); }); },
      redo() { removed.forEach(({ mesh, parent }) => { parent.remove(mesh); const i = bodyV.indexOf(mesh); if (i !== -1) bodyV.splice(i, 1); }); }
    });
  }
}

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
    if (isCmd || state.sculptTool === 'delete') {
      const half = Math.floor(state.sculptSize / 2);
      mesh.getWorldPosition(_ctr);
      const toRemove = [];
      bodyV.forEach(v => {
        v.getWorldPosition(_wp);
        if (Math.abs(_wp.x - _ctr.x) <= half * U + U * 0.1 &&
            Math.abs(_wp.y - _ctr.y) <= half * U + U * 0.1 &&
            Math.abs(_wp.z - _ctr.z) <= half * U + U * 0.1) {
          toRemove.push({ mesh: v, parent: v.parent });
        }
      });
      if (!toRemove.length) return;
      toRemove.forEach(({ mesh: m, parent: p }) => {
        if (!p) return;
        p.remove(m); const i = bodyV.indexOf(m); if (i !== -1) bodyV.splice(i, 1);
      });
      pushUndo({
        undo() { toRemove.forEach(({ mesh: m, parent: p }) => { p.add(m); bodyV.push(m); }); },
        redo() { toRemove.forEach(({ mesh: m, parent: p }) => { p.remove(m); const i = bodyV.indexOf(m); if (i !== -1) bodyV.splice(i, 1); }); }
      });
    } else if (state.sculptTool === 'round') {
      doRound(hit);
    } else {
      const n = hit.face.normal.clone().transformDirection(mesh.matrixWorld).round();
      const center = mesh.position.clone().addScaledVector(n, U);
      const half = Math.floor(state.sculptSize / 2);
      const added = [];
      for (let di = -half; di <= half; di++) {
        for (let dj = -half; dj <= half; dj++) {
          for (let dk = -half; dk <= half; dk++) {
            const pos = center.clone().add(new THREE.Vector3(di, dj, dk).multiplyScalar(U));
            if (bodyV.some(v => v.parent === mesh.parent && v.position.distanceTo(pos) < U * 0.1)) continue;
            const nm = new THREE.Mesh(BG, mat(GRAY));
            nm.position.copy(pos);
            nm.userData.part = mesh.userData.part; nm.userData.bc = GRAY;
            mesh.parent.add(nm); bodyV.push(nm);
            added.push({ mesh: nm, parent: mesh.parent });
          }
        }
      }
      if (added.length) pushUndo({
        undo() { added.forEach(({ mesh: m, parent: p }) => { p.remove(m); const i = bodyV.indexOf(m); if (i !== -1) bodyV.splice(i, 1); }); },
        redo() { added.forEach(({ mesh: m, parent: p }) => { p.add(m); bodyV.push(m); }); }
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
  else if (state.mode === 'sculpt' && state.sculptTool === 'round') { roundStroke = []; doAct(e); }
  else doAct(e);
});
c3.addEventListener('mousemove', e => {
  const dx = e.clientX - lmx, dy = e.clientY - lmy;
  lmx = e.clientX; lmy = e.clientY;
  if (isOrbiting) { state.camT -= dx * 0.007; state.camP = Math.max(-0.4, Math.min(1.2, state.camP + dy * 0.006)); syncCam(); }
  else if (isPainting && (state.mode === 'paint' || state.mode === 'cloth')) doAct(e);
  else if (isPainting && state.mode === 'sculpt' && state.sculptTool === 'round') doAct(e);
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
  if (roundStroke && roundStroke.length > 0) {
    const removed = roundStroke;
    pushUndo({
      undo() { removed.forEach(({ mesh, parent }) => { parent.add(mesh); bodyV.push(mesh); }); },
      redo() { removed.forEach(({ mesh, parent }) => { parent.remove(mesh); const i = bodyV.indexOf(mesh); if (i !== -1) bodyV.splice(i, 1); }); }
    });
  }
  roundStroke = null;
  isPainting = false; isOrbiting = false;
});
