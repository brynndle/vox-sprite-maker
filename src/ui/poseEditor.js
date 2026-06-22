import * as THREE from 'three';
import { SK, root } from '../character/skeleton.js';
import { scene, cam } from '../renderer/scene.js';
import { pushUndo } from './undo.js';

// ── Skeleton definition ───────────────────────────────────────────────────────
const JOINT_DEFS = [
  { id: 'head',      label: 'Head',       getG: () => SK.head    },
  { id: 'torso',     label: 'Torso',      getG: () => SK.torso   },
  { id: 'lShoulder', label: 'L Shoulder', getG: () => SK.lArm    },
  { id: 'lElbow',    label: 'L Elbow',    getG: () => SK.lElbow  },
  { id: 'rShoulder', label: 'R Shoulder', getG: () => SK.rArm    },
  { id: 'rElbow',    label: 'R Elbow',    getG: () => SK.rElbow  },
  { id: 'lHip',      label: 'L Hip',      getG: () => SK.lLeg    },
  { id: 'lKnee',     label: 'L Knee',     getG: () => SK.lKnee   },
  { id: 'rHip',      label: 'R Hip',      getG: () => SK.rLeg    },
  { id: 'rKnee',     label: 'R Knee',     getG: () => SK.rKnee   },
];

const BONE_PAIRS = [
  ['torso',     'head'],
  ['torso',     'lShoulder'],
  ['torso',     'rShoulder'],
  ['torso',     'lHip'],
  ['torso',     'rHip'],
  ['lShoulder', 'lElbow'],
  ['rShoulder', 'rElbow'],
  ['lHip',      'lKnee'],
  ['rHip',      'rKnee'],
  ['lShoulder', 'head'],   // ← new clavicle lines
  ['rShoulder', 'head'],   // ← new
];

// ── Scene objects ─────────────────────────────────────────────────────────────
const _sphGeo = new THREE.SphereGeometry(0.38, 8, 6);

// Each joint gets its own material instance so we can tint the selected one
const jointMeshes = {};   // id → Mesh
JOINT_DEFS.forEach(({ id }) => {
  const m = new THREE.Mesh(
    _sphGeo,
    new THREE.MeshBasicMaterial({ color: 0x89b4fa, depthTest: false, transparent: true, opacity: 0.9 })
  );
  m.renderOrder = 999;
  m.visible = false;
  m.userData.jointId = id;
  scene.add(m);
  jointMeshes[id] = m;
});

const _bonePos  = new Float32Array(BONE_PAIRS.length * 6);
const _bonePosA = new THREE.BufferAttribute(_bonePos, 3);
const _boneGeo  = new THREE.BufferGeometry();
_boneGeo.setAttribute('position', _bonePosA);
const boneLines = new THREE.LineSegments(
  _boneGeo,
  new THREE.LineBasicMaterial({ color: 0x89b4fa, depthTest: false, transparent: true, opacity: 0.45 })
);
boneLines.renderOrder = 998;
boneLines.visible = false;
boneLines.frustumCulled = false;
scene.add(boneLines);

const _defaultPos = {};  // id → THREE.Vector3
const _defaultRot = {};  // id → THREE.Euler

export function captureDefaults() {
  JOINT_DEFS.forEach(({ id, getG }) => {
    const g = getG();
    if (!g) return;
    _defaultPos[id] = g.position.clone();
    _defaultRot[id] = g.rotation.clone();
  });
}

// ── Module state ──────────────────────────────────────────────────────────────
let _skelVis    = false;  // bone lines visible (user toggle, persists across modes)
let _poseActive = false;  // joint handles active
let _dragId     = null;
let _dragX = 0, _dragY = 0;
let _savedRots  = null;
let _selectedId = null;

const _wp = new THREE.Vector3();
const _cr = new THREE.Vector3();
const _cu = new THREE.Vector3();

// ── Sync overlay to current skeleton pose ─────────────────────────────────────
export function updateSkeleton() {
  if (!_skelVis && !_poseActive) return;
  if (!SK.head) return;

  JOINT_DEFS.forEach(({ id, getG }) => {
    const g = getG();
    if (!g) return;
    if (jointMeshes[id].visible) {
      g.getWorldPosition(_wp);
      jointMeshes[id].position.copy(_wp);
    }
  });

  if (!boneLines.visible) return;
  BONE_PAIRS.forEach(([aId, bId], i) => {
    const ag = JOINT_DEFS.find(d => d.id === aId)?.getG();
    const bg = JOINT_DEFS.find(d => d.id === bId)?.getG();
    if (!ag || !bg) return;
    ag.getWorldPosition(_wp);
    _bonePos[i * 6    ] = _wp.x; _bonePos[i * 6 + 1] = _wp.y; _bonePos[i * 6 + 2] = _wp.z;
    bg.getWorldPosition(_wp);
    _bonePos[i * 6 + 3] = _wp.x; _bonePos[i * 6 + 4] = _wp.y; _bonePos[i * 6 + 5] = _wp.z;
  });
  _bonePosA.needsUpdate = true;
}

// ── Visibility ─────────────────────────────────────────────────────────────────
export function setSkeletonVisible(v) {
  _skelVis = v;
  boneLines.visible = v || _poseActive;
  // joint spheres only in pose mode
}

export function isSkeletonVisible() { return _skelVis; }

// ── Enter / exit pose mode ────────────────────────────────────────────────────
export function enterPoseMode() {
  _poseActive = true;
  _skelVis = true;
  boneLines.visible = true;
  JOINT_DEFS.forEach(({ id }) => { jointMeshes[id].visible = true; });
  updateSkeleton();
}

export function exitPoseMode() {
  _poseActive = false;
  _dragId = null;
  // Restore user's preferred skeleton visibility
  boneLines.visible = _skelVis;
  JOINT_DEFS.forEach(({ id }) => {
    jointMeshes[id].visible = false;
    jointMeshes[id].material.color.set(0x89b4fa);
    jointMeshes[id].material.opacity = 0.9;
  });
}

// ── Pointer events ────────────────────────────────────────────────────────────
export function posePointerDown(e, raycaster) {
  if (!_poseActive) return false;
  const hits = raycaster.intersectObjects(
    JOINT_DEFS.map(d => jointMeshes[d.id]).filter(m => m.visible)
  );
  if (!hits.length) return false;

  _dragId = hits[0].object.userData.jointId;
  _selectedId = _dragId;
  _dragX  = e.clientX;
  _dragY  = e.clientY;

  // Highlight selected joint
  JOINT_DEFS.forEach(({ id }) => { jointMeshes[id].material.color.set(0x89b4fa); jointMeshes[id].material.opacity = 0.9; });
  jointMeshes[_dragId].material.color.set(0xcba6f7);
  jointMeshes[_dragId].material.opacity = 1.0;

  // Snapshot rotations for undo
  _savedRots = {};
  JOINT_DEFS.forEach(({ id, getG }) => { const g = getG(); if (g) _savedRots[id] = g.rotation.clone(); });

  return true;
}

export function posePointerMove(e) {
  if (!_dragId) return;
  const dx = e.clientX - _dragX;
  const dy = e.clientY - _dragY;
  _dragX = e.clientX;
  _dragY = e.clientY;
  if (!dx && !dy) return;

  const def   = JOINT_DEFS.find(d => d.id === _dragId);
  const group = def?.getG();
  if (!group || !group.parent) return;

  // Compute rotation axis from screen-space drag direction using camera orientation
  _cr.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
  _cu.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
  const axis  = new THREE.Vector3().addScaledVector(_cu, dx).addScaledVector(_cr, -dy).normalize();
  const angle = Math.sqrt(dx * dx + dy * dy) * 0.012;

  // Convert world-space rotation into parent's local space before applying
  const worldQ  = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const parentQ = new THREE.Quaternion();
  group.parent.getWorldQuaternion(parentQ);
  group.quaternion.premultiply(worldQ.premultiply(parentQ.invert()));
  group.rotation.setFromQuaternion(group.quaternion);  // ← add this line
  updateSkeleton();
}

export function posePointerUp() {
  if (!_dragId || !_savedRots) return;

  const snap    = _savedRots;
  const newRots = {};
  JOINT_DEFS.forEach(({ id, getG }) => { const g = getG(); if (g) newRots[id] = g.rotation.clone(); });

  pushUndo({
    undo() { JOINT_DEFS.forEach(({ id, getG }) => { const g = getG(); if (g && snap[id]) g.rotation.copy(snap[id]); }); },
    redo() { JOINT_DEFS.forEach(({ id, getG }) => { const g = getG(); if (g && newRots[id]) g.rotation.copy(newRots[id]); }); }
  });

  JOINT_DEFS.forEach(({ id }) => { jointMeshes[id].material.color.set(0x89b4fa); jointMeshes[id].material.opacity = 0.9; });
  _dragId = null;
  _savedRots = null;
}

export function getSelectedJoint() { return _selectedId; }

export function clearJointSelection() {
  _selectedId = null;
  JOINT_DEFS.forEach(({ id }) => {
    jointMeshes[id].material.color.set(0x89b4fa);
    jointMeshes[id].material.opacity = 0.9;
  });
}

export function getJointState(id) {
  const def = JOINT_DEFS.find(d => d.id === id);
  const g = def?.getG();
  if (!g) return null;
  const dp = _defaultPos[id];
  return {
    dx: dp ? +(g.position.x - dp.x).toFixed(3) : 0,
    dy: dp ? +(g.position.y - dp.y).toFixed(3) : 0,
    dz: dp ? +(g.position.z - dp.z).toFixed(3) : 0,
    rx: +THREE.MathUtils.radToDeg(g.rotation.x).toFixed(1),
    ry: +THREE.MathUtils.radToDeg(g.rotation.y).toFixed(1),
    rz: +THREE.MathUtils.radToDeg(g.rotation.z).toFixed(1),
    label: def.label,
  };
}

export function setJointPosition(id, dx, dy, dz) {
  const def = JOINT_DEFS.find(d => d.id === id);
  const g = def?.getG();
  if (!g) return;
  const dp = _defaultPos[id];
  if (dp) {
    g.position.x = dp.x + dx;
    g.position.y = dp.y + dy;
    g.position.z = dp.z + dz;
  }
  updateSkeleton();
}

export function setJointRotation(id, rx, ry, rz) {
  const def = JOINT_DEFS.find(d => d.id === id);
  const g = def?.getG();
  if (!g) return;
  g.rotation.set(
    THREE.MathUtils.degToRad(rx),
    THREE.MathUtils.degToRad(ry),
    THREE.MathUtils.degToRad(rz)
  );
  updateSkeleton();
}

export function resetJoint(id) {
  const def = JOINT_DEFS.find(d => d.id === id);
  const g = def?.getG();
  if (!g) return;

  const snapPos = g.position.clone();
  const snapRot = g.rotation.clone();

  if (_defaultPos[id]) g.position.copy(_defaultPos[id]);
  if (_defaultRot[id]) g.rotation.copy(_defaultRot[id]);
  updateSkeleton();

  const newPos = g.position.clone();
  const newRot = g.rotation.clone();

  pushUndo({
    undo() { g.position.copy(snapPos); g.rotation.copy(snapRot); updateSkeleton(); },
    redo() { g.position.copy(newPos); g.rotation.copy(newRot); updateSkeleton(); }
  });
}

export function isPoseDragging() { return !!_dragId; }

// ── Reset pose ────────────────────────────────────────────────────────────────
export function resetSkeletonPose() {
  const snapPos = {}, snapRot = {};
  JOINT_DEFS.forEach(({ id, getG }) => {
    const g = getG();
    if (g) { snapPos[id] = g.position.clone(); snapRot[id] = g.rotation.clone(); }
  });
  const snapRootY = root.position.y, snapRootRX = root.rotation.x;

  JOINT_DEFS.forEach(({ id, getG }) => {
    const g = getG();
    if (!g) return;
    if (_defaultPos[id]) g.position.copy(_defaultPos[id]);
    if (_defaultRot[id]) g.rotation.copy(_defaultRot[id]);
  });
  root.position.y = 0; root.rotation.x = 0;
  updateSkeleton();

  const newPos = {}, newRot = {};
  JOINT_DEFS.forEach(({ id, getG }) => {
    const g = getG();
    if (g) { newPos[id] = g.position.clone(); newRot[id] = g.rotation.clone(); }
  });

  pushUndo({
    undo() {
      JOINT_DEFS.forEach(({ id, getG }) => {
        const g = getG(); if (!g) return;
        if (snapPos[id]) g.position.copy(snapPos[id]);
        if (snapRot[id]) g.rotation.copy(snapRot[id]);
      });
      root.position.y = snapRootY; root.rotation.x = snapRootRX;
    },
    redo() {
      JOINT_DEFS.forEach(({ id, getG }) => {
        const g = getG(); if (!g) return;
        if (newPos[id]) g.position.copy(newPos[id]);
        if (newRot[id]) g.rotation.copy(newRot[id]);
      });
      root.position.y = 0; root.rotation.x = 0;
    }
  });
}
