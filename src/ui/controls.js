import * as THREE from 'three';
import { state, PAL } from '../state.js';
import { cam, syncCam, scene } from '../renderer/scene.js';
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
import { enter2D, exit2D } from './editor2d.js';
import { showGrid, hideGrid, updateGhost, getSnappedPos, resetZ, onScroll as gridOnScroll } from '../skinning/gridCursor.js';
import { assignBone } from '../skinning/boneAssign.js';
import {
  enterPoseMode, exitPoseMode,
  posePointerDown, posePointerMove, posePointerUp, isPoseDragging,
  resetSkeletonPose, setSkeletonVisible, isSkeletonVisible,
  captureDefaults,
  getSelectedJoint, clearJointSelection,
  getJointState, setJointPosition, setJointRotation, resetJoint,
} from './poseEditor.js';

// ── Joint inspector panel helpers ─────────────────────────────────────────────
const _jiInspector = document.getElementById('joint-inspector');
const _jiNoSel     = document.getElementById('pose-no-selection');
const _jiName      = document.getElementById('joint-inspector-name');

function syncJointSliders() {
  const id = getSelectedJoint(); if (!id) return;
  const s = getJointState(id); if (!s) return;
  document.getElementById('jp-x').value  = s.dx;  document.getElementById('jp-xv').textContent = s.dx.toFixed(1);
  document.getElementById('jp-y').value  = s.dy;  document.getElementById('jp-yv').textContent = s.dy.toFixed(1);
  document.getElementById('jp-z').value  = s.dz;  document.getElementById('jp-zv').textContent = s.dz.toFixed(1);
  document.getElementById('jr-x').value  = s.rx;  document.getElementById('jr-xv').textContent = s.rx.toFixed(0) + '°';
  document.getElementById('jr-y').value  = s.ry;  document.getElementById('jr-yv').textContent = s.ry.toFixed(0) + '°';
  document.getElementById('jr-z').value  = s.rz;  document.getElementById('jr-zv').textContent = s.rz.toFixed(0) + '°';
}

function showJointInspector(id) {
  const s = getJointState(id); if (!s) return;
  _jiName.textContent = s.label;
  _jiInspector.style.display = '';
  _jiNoSel.style.display = 'none';
  syncJointSliders();
}

function hideJointInspector() {
  _jiInspector.style.display = 'none';
  _jiNoSel.style.display = '';
}

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
  if (state.mode === 'sculpt') {
    if (b.dataset.stool === 'add') { resetZ(); showGrid(getDims()); }
    else hideGrid();
  }
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
  if (state.mode === 'pose') { exitPoseMode(); clearJointSelection(); hideJointInspector(); }
  document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); state.mode = b.dataset.mode; hideGhost();
  if (state.mode === 'sculpt' && state.sculptTool === 'add') { resetZ(); showGrid(getDims()); }
  else hideGrid();
  if (state.mode === 'pose') enterPoseMode();
  document.getElementById('pp').style.display    = state.mode === 'paint'  ? '' : 'none';
  document.getElementById('sp').style.display    = state.mode === 'sculpt' ? '' : 'none';
  document.getElementById('cp').style.display    = state.mode === 'cloth'  ? '' : 'none';
  document.getElementById('posep').style.display = state.mode === 'pose'   ? '' : 'none';
}));

// ── 2D sketch mode button ─────────────────────────────────────────────────────
document.getElementById('mode2d-btn').addEventListener('click', function () {
  const active = this.classList.toggle('on');
  if (active) {
    document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('on'));
    hideGrid();
    enter2D();
  } else {
    exit2D();
  }
});

// ── Pose panel controls ───────────────────────────────────────────────────────
document.getElementById('reset-pose-btn').addEventListener('click', () => {
  resetSkeletonPose();
  if (getSelectedJoint()) syncJointSliders();
});
document.getElementById('show-skel-chk').addEventListener('change', e => {
  setSkeletonVisible(e.target.checked);
});
document.getElementById('ji-deselect').addEventListener('click', () => {
  clearJointSelection(); hideJointInspector();
});
document.getElementById('reset-joint-btn').addEventListener('click', () => {
  const id = getSelectedJoint(); if (!id) return;
  resetJoint(id); syncJointSliders();
});

// Slider undo: snapshot joint state on grab, push one record on release
let _sliderSnap = null;

function _onSliderPointerDown() {
  const id = getSelectedJoint(); if (!id) return;
  const s = getJointState(id); if (!s) return;
  _sliderSnap = { id, s: { ...s } };
}

// Position sliders
['x','y','z'].forEach(axis => {
  const el = document.getElementById(`jp-${axis}`);
  el.addEventListener('pointerdown', _onSliderPointerDown);
  el.addEventListener('input', e => {
    const id = getSelectedJoint(); if (!id) return;
    const s = getJointState(id); if (!s) return;
    const v = parseFloat(e.target.value);
    document.getElementById(`jp-${axis}v`).textContent = v.toFixed(1);
    setJointPosition(id,
      axis === 'x' ? v : s.dx,
      axis === 'y' ? v : s.dy,
      axis === 'z' ? v : s.dz
    );
  });
  el.addEventListener('change', () => {
    const id = getSelectedJoint(); if (!id || !_sliderSnap || _sliderSnap.id !== id) return;
    const snap = _sliderSnap.s;
    const cur  = getJointState(id); if (!cur) return;
    pushUndo({
      undo() { setJointPosition(id, snap.dx, snap.dy, snap.dz); setJointRotation(id, snap.rx, snap.ry, snap.rz); syncJointSliders(); },
      redo() { setJointPosition(id, cur.dx,  cur.dy,  cur.dz);  setJointRotation(id, cur.rx,  cur.ry,  cur.rz);  syncJointSliders(); },
    });
    _sliderSnap = null;
  });
});

// Rotation sliders
['x','y','z'].forEach(axis => {
  const el = document.getElementById(`jr-${axis}`);
  el.addEventListener('pointerdown', _onSliderPointerDown);
  el.addEventListener('input', e => {
    const id = getSelectedJoint(); if (!id) return;
    const s = getJointState(id); if (!s) return;
    const v = parseFloat(e.target.value);
    document.getElementById(`jr-${axis}v`).textContent = v.toFixed(0) + '°';
    setJointRotation(id,
      axis === 'x' ? v : s.rx,
      axis === 'y' ? v : s.ry,
      axis === 'z' ? v : s.rz
    );
  });
  el.addEventListener('change', () => {
    const id = getSelectedJoint(); if (!id || !_sliderSnap || _sliderSnap.id !== id) return;
    const snap = _sliderSnap.s;
    const cur  = getJointState(id); if (!cur) return;
    pushUndo({
      undo() { setJointPosition(id, snap.dx, snap.dy, snap.dz); setJointRotation(id, snap.rx, snap.ry, snap.rz); syncJointSliders(); },
      redo() { setJointPosition(id, cur.dx,  cur.dy,  cur.dz);  setJointRotation(id, cur.rx,  cur.ry,  cur.rz);  syncJointSliders(); },
    });
    _sliderSnap = null;
  });
});

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
  el.addEventListener('input', () => {
    state.S[el.dataset.s] = parseFloat(el.value);
    rebuild(); resetPose(SK, root); captureDefaults();
    if (state.mode === 'sculpt' && state.sculptTool === 'add') showGrid(getDims());
  });
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
  rebuild(); resetPose(SK, root); captureDefaults();
  updatePartUI();
});

updatePartUI();

document.getElementById('new-char-btn').addEventListener('click', () => {
  if (!confirm('Start with a bare skeleton? This clears all current voxels.')) return;
  ['head', 'torso', 'arm', 'leg', 'custom'].forEach(k => resetPart(k));
  resetPart('_skeletonOnly');
  savePart('_skeletonOnly', true);
  rebuild();
  resetPose(SK, root);
  captureDefaults();
  setSkeletonVisible(true);
  document.getElementById('show-skel-chk').checked = true;
});

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
  if (state.mode === 'sculpt' && state.sculptTool === 'add') {
    if (e.shiftKey) { isOrbiting = true; return; }
    if (e.button === 2) {
      const { x, y, z } = getSnappedPos();
      removeCustomBlock(x, y, z);
      return;
    }
    if (e.button === 0) {
      const { x, y, z } = getSnappedPos();
      placeCustomBlock(new THREE.Vector3(x, y, z));
      return;
    }
    return;
  }
  if (e.button === 2 || e.shiftKey) { isOrbiting = true; return; }
  if (state.mode === 'pose') {
    if (state.playing) return;
    const r = c3.getBoundingClientRect();
    m2.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    m2.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(m2, cam);
    const jointHit = posePointerDown(e, ray);
    if (jointHit) {
      showJointInspector(getSelectedJoint());
    } else {
      clearJointSelection();
      hideJointInspector();
    }
    return; // never paint/sculpt in pose mode
  }
  isPainting = true;
  if (state.mode === 'paint' || state.mode === 'cloth') { strokeUndoMap = new Map(); doAct(e); }
  else if (state.mode === 'sculpt' && state.sculptTool === 'round') { roundStroke = []; doAct(e); }
  else doAct(e);
});
c3.addEventListener('mousemove', e => {
  const dx = e.clientX - lmx, dy = e.clientY - lmy;
  lmx = e.clientX; lmy = e.clientY;
  if (isOrbiting) { state.camT -= dx * 0.007; state.camP = Math.max(-0.4, Math.min(1.2, state.camP + dy * 0.006)); syncCam(); }
  else if (isPoseDragging()) { posePointerMove(e); syncJointSliders(); }
  else if (isPainting && (state.mode === 'paint' || state.mode === 'cloth')) doAct(e);
  else if (isPainting && state.mode === 'sculpt' && state.sculptTool === 'round') doAct(e);
});
window.addEventListener('mouseup', () => {
  posePointerUp();
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

// ── Ghost cursor (sculpt mode hover preview) ─────────────────────────────────
const _gBoxGeo  = new THREE.BoxGeometry(1, 1, 1);
const _gEdgeGeo = new THREE.EdgesGeometry(_gBoxGeo);
const _gSphGeo  = new THREE.EdgesGeometry(new THREE.SphereGeometry(1, 10, 7));

const _gFillAdd = new THREE.MeshBasicMaterial({ color: 0x89b4fa, transparent: true, opacity: 0.18, depthWrite: false });
const _gFillDel = new THREE.MeshBasicMaterial({ color: 0xf38ba8, transparent: true, opacity: 0.18, depthWrite: false });
const _gLineAdd = new THREE.LineBasicMaterial({ color: 0x89b4fa, depthTest: false });
const _gLineDel = new THREE.LineBasicMaterial({ color: 0xf38ba8, depthTest: false });
const _gLineSph = new THREE.LineBasicMaterial({ color: 0xcba6f7, depthTest: false, transparent: true, opacity: 0.75 });

const ghostFill   = new THREE.Mesh(_gBoxGeo, _gFillAdd);
const ghostEdge   = new THREE.LineSegments(_gEdgeGeo, _gLineAdd);
const ghostSphere = new THREE.LineSegments(_gSphGeo, _gLineSph);
[ghostFill, ghostEdge, ghostSphere].forEach(o => { o.visible = false; o.raycast = () => {}; scene.add(o); });

function hideGhost() {
  ghostFill.visible = ghostEdge.visible = ghostSphere.visible = false;
}

const _gWP = new THREE.Vector3();
function updateGhostCursor(e) {
  if (state.mode === 'sculpt' && state.sculptTool === 'add') {
    const r = c3.getBoundingClientRect();
    m2.x = ((e.clientX - r.left) / r.width)  * 2 - 1;
    m2.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
    ray.setFromCamera(m2, cam);
    updateGhost(ray, bodyV);
    ghostFill.visible = ghostEdge.visible = ghostSphere.visible = false;
    return;
  }
  if (state.mode !== 'sculpt' || isOrbiting) { hideGhost(); return; }
  const hit = getHit(e);
  if (!hit) { hideGhost(); return; }

  const mesh = hit.object;
  const isCmd = e.metaKey || e.ctrlKey;
  const isDel = isCmd || state.sculptTool === 'delete';
  const isRound = !isCmd && state.sculptTool === 'round';

  if (isRound) {
    ghostFill.visible = ghostEdge.visible = false;
    ghostSphere.scale.setScalar(state.roundRadius);
    ghostSphere.position.copy(hit.point);
    ghostSphere.visible = true;
    return;
  }

  ghostSphere.visible = false;
  const half = Math.floor(state.sculptSize / 2);
  const size = (2 * half + 1) * U;

  mesh.getWorldPosition(_gWP);
  let px = _gWP.x, py = _gWP.y, pz = _gWP.z;
  if (!isDel) {
    const n = hit.face.normal.clone().transformDirection(mesh.matrixWorld).round();
    px += n.x * U; py += n.y * U; pz += n.z * U;
  }

  ghostFill.material  = isDel ? _gFillDel : _gFillAdd;
  ghostEdge.material  = isDel ? _gLineDel : _gLineAdd;
  ghostFill.scale.set(size, size, size);
  ghostEdge.scale.set(size, size, size);
  ghostFill.position.set(px, py, pz);
  ghostEdge.position.set(px, py, pz);
  ghostFill.visible = ghostEdge.visible = true;
}

c3.addEventListener('mousemove', updateGhostCursor);
c3.addEventListener('mouseleave', hideGhost);
c3.addEventListener('wheel', e => {
  if (state.mode !== 'sculpt' || state.sculptTool !== 'add') return;
  e.preventDefault();
  const D = parseInt(document.getElementById('c2d-depth').value, 10) || 4;
  gridOnScroll(e, D);
}, { passive: false });

// ── Custom block placement (block skinning) ───────────────────────────────────
const _bwp = new THREE.Vector3();

function placeCustomBlock(worldPos) {
  const skKey = assignBone(worldPos, SK);
  const group = SK[skKey];
  if (!group) return;

  const localPos = group.worldToLocal(worldPos.clone());
  const m = new THREE.Mesh(BG, mat(state.col));
  m.position.copy(localPos);
  m.userData.part = 'custom';
  m.userData.isSkin = false;
  m.userData.skAncestor = skKey;
  group.add(m);
  bodyV.push(m);

  const entry = {
    x: +localPos.x.toFixed(4), y: +localPos.y.toFixed(4), z: +localPos.z.toFixed(4),
    color: state.col, skAncestor: skKey,
  };
  if (!savedParts.custom) savedParts.custom = [];
  savedParts.custom.push(entry);
  if (savedParts._skeletonOnly) resetPart('_skeletonOnly');
  savePart('custom', savedParts.custom);

  pushUndo({
    undo() {
      group.remove(m);
      const i = bodyV.indexOf(m); if (i !== -1) bodyV.splice(i, 1);
      savedParts.custom = (savedParts.custom || []).filter(e => e !== entry);
      savePart('custom', savedParts.custom);
    },
    redo() {
      group.add(m); bodyV.push(m);
      if (!savedParts.custom) savedParts.custom = [];
      savedParts.custom.push(entry);
      savePart('custom', savedParts.custom);
    },
  });
}

function removeCustomBlock(sx, sy, sz) {
  let target = null;
  for (const m of bodyV) {
    m.getWorldPosition(_bwp);
    if (Math.round(_bwp.x) === sx && Math.round(_bwp.y) === sy && Math.round(_bwp.z) === sz) {
      target = m; break;
    }
  }
  if (!target) return;

  const parent = target.parent;
  parent.remove(target);
  const bi = bodyV.indexOf(target); if (bi !== -1) bodyV.splice(bi, 1);

  let removed = null, cidx = -1;
  if (savedParts.custom) {
    const lp = target.position;
    cidx = savedParts.custom.findIndex(e =>
      e.skAncestor === target.userData.skAncestor &&
      Math.abs(e.x - lp.x) < 0.01 &&
      Math.abs(e.y - lp.y) < 0.01 &&
      Math.abs(e.z - lp.z) < 0.01
    );
    if (cidx !== -1) { removed = savedParts.custom[cidx]; savedParts.custom.splice(cidx, 1); }
  }
  savePart('custom', savedParts.custom || []);

  pushUndo({
    undo() {
      parent.add(target); bodyV.push(target);
      if (removed && savedParts.custom) savedParts.custom.splice(cidx, 0, removed);
      savePart('custom', savedParts.custom || []);
    },
    redo() {
      parent.remove(target);
      const i = bodyV.indexOf(target); if (i !== -1) bodyV.splice(i, 1);
      if (cidx !== -1 && savedParts.custom) savedParts.custom.splice(cidx, 1);
      savePart('custom', savedParts.custom || []);
    },
  });
}
