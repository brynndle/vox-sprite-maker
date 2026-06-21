# Pose Mode — Joint Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 6-DOF per-joint inspector (position + rotation sliders) to Pose mode, with shoulder-to-head bone lines, default-capture machinery, and deselect-on-blank-click.

**Architecture:** `poseEditor.js` owns all skeleton state (joint selection, default snapshots, get/set API). `controls.js` owns the DOM panel (builds sliders, wires events, syncs after drag). `index.html` holds the static inspector markup. `main.js` calls `captureDefaults()` after every `rebuild()`.

**Tech Stack:** Vite 5, Three.js (ES modules), vanilla DOM, no test framework — verification is `vite build` passing + browser smoke test.

## Global Constraints

- No TypeScript — plain `.js` ES modules throughout.
- All Three.js imports via `import * as THREE from 'three'`.
- Position sliders operate as **offsets from default** (range −6 to +6, step 0.1) — not absolute world coordinates.
- Rotation sliders operate in **degrees** (range −180 to 180, step 1) converted to/from radians internally.
- Every destructive change must push an undo record via `pushUndo({ undo, redo })`.
- `vite build` must produce zero errors after each task commit.

---

### Task 1: Shoulder-to-head bones + captureDefaults + Euler sync + extended resetSkeletonPose

**Files:**
- Modify: `src/ui/poseEditor.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `captureDefaults()` export — must be called after every `rebuild()` + `resetPose()`.
- Produces: `resetSkeletonPose()` now also restores positions (existing callers unaffected — same signature).

- [ ] **Step 1: Add `label` field and two new bone pairs in `poseEditor.js`**

In `JOINT_DEFS`, add a `label` string to every entry (used later for the inspector header):

```js
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
```

Append to `BONE_PAIRS`:

```js
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
```

- [ ] **Step 2: Add default-position and default-rotation stores + `captureDefaults()`**

After the `boneLines` declaration, add:

```js
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
```

- [ ] **Step 3: Fix Euler sync in `posePointerMove`**

In `posePointerMove`, immediately after the quaternion premultiply line, add one line:

```js
  group.quaternion.premultiply(worldQ.premultiply(parentQ.invert()));
  group.rotation.setFromQuaternion(group.quaternion);  // ← add this line
  updateSkeleton();
```

- [ ] **Step 4: Extend `resetSkeletonPose` to also reset positions**

Replace the entire existing `resetSkeletonPose` export with:

```js
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
```

- [ ] **Step 5: Update `main.js` to call `resetPose` then `captureDefaults` after `rebuild()`**

```js
import { rebuild, SK, root } from './character/skeleton.js';
import { animPose, resetPose } from './animation/poses.js';
import { renderer, cam, scene } from './renderer/scene.js';
import { renderOutputs } from './renderer/pixelOutput.js';
import { state } from './state.js';
import './ui/controls.js';
import { updateSkeleton, captureDefaults } from './ui/poseEditor.js';

let frameCount = 0;
function loop() {
  requestAnimationFrame(loop);
  if (state.playing) { state.tick += 0.016; animPose(state.tick % 1, SK, root); }
  updateSkeleton();
  renderer.render(scene, cam);
  frameCount++;
  if (frameCount % 3 === 0) renderOutputs();
}

rebuild();
resetPose(SK, root);
captureDefaults();
loop();
```

- [ ] **Step 6: Verify build passes**

```bash
export PATH="$HOME/.nvm/versions/node/v22.21.0/bin:$PATH"
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker"
npx vite build 2>&1 | tail -8
```

Expected last line: `✓ built in ...ms`

- [ ] **Step 7: Commit**

```bash
git add src/ui/poseEditor.js src/main.js
git commit -m "feat(pose): shoulder-to-head bones, captureDefaults, Euler sync, position reset"
```

---

### Task 2: Joint state API — selection tracking, get/set/reset per joint

**Files:**
- Modify: `src/ui/poseEditor.js`

**Interfaces:**
- Produces:
  - `getSelectedJoint() → string | null` — current selected joint id
  - `clearJointSelection()` — deselects, resets highlight
  - `getJointState(id) → { dx, dy, dz, rx, ry, rz }` — position offsets (world units) + rotation (degrees)
  - `setJointPosition(id, dx, dy, dz)` — sets position offset from default, calls `updateSkeleton()`
  - `setJointRotation(id, rx, ry, rz)` — sets rotation in degrees, calls `updateSkeleton()`
  - `resetJoint(id)` — restores single joint to captured defaults, pushes undo

- [ ] **Step 1: Add `_selectedId` module variable and update `posePointerDown` to track it**

Add after the existing `let _savedRots = null;` line:

```js
let _selectedId = null;
```

In `posePointerDown`, after `_dragId = hits[0].object.userData.jointId;` add:

```js
  _selectedId = _dragId;
```

- [ ] **Step 2: Export `getSelectedJoint` and `clearJointSelection`**

Add after `posePointerUp`:

```js
export function getSelectedJoint() { return _selectedId; }

export function clearJointSelection() {
  _selectedId = null;
  JOINT_DEFS.forEach(({ id }) => {
    jointMeshes[id].material.color.set(0x89b4fa);
    jointMeshes[id].material.opacity = 0.9;
  });
}
```

- [ ] **Step 3: Export `getJointState`**

```js
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
```

- [ ] **Step 4: Export `setJointPosition` and `setJointRotation`**

```js
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
```

- [ ] **Step 5: Export `resetJoint`**

```js
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
```

- [ ] **Step 6: Verify build passes**

```bash
export PATH="$HOME/.nvm/versions/node/v22.21.0/bin:$PATH"
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...ms`

- [ ] **Step 7: Commit**

```bash
git add src/ui/poseEditor.js
git commit -m "feat(pose): joint selection state and 6-DOF get/set/reset API"
```

---

### Task 3: Joint inspector HTML markup in `index.html`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces DOM elements used by Task 4:
  - `#joint-inspector` — wrapper div (hidden by default)
  - `#joint-inspector-name` — joint label text
  - `#ji-deselect` — ✕ button
  - `#jp-x`, `#jp-y`, `#jp-z` — position range inputs
  - `#jp-xv`, `#jp-yv`, `#jp-zv` — position value display spans
  - `#jr-x`, `#jr-y`, `#jr-z` — rotation range inputs
  - `#jr-xv`, `#jr-yv`, `#jr-zv` — rotation value display spans
  - `#reset-joint-btn` — reset single joint button

- [ ] **Step 1: Replace the `#posep` body in `index.html`**

Find the existing `#posep` div:

```html
      <div id="posep" style="display:none">
        <div style="font-size:10px;color:#6c7086;line-height:1.7;margin-bottom:5px">Drag joint handles to rotate.<br>Shift+drag to orbit.</div>
        <button class="btn tbtn" id="reset-pose-btn">↺ Reset pose</button>
        <div style="display:flex;align-items:center;gap:5px;margin-top:6px">
          <input type="checkbox" id="show-skel-chk" style="accent-color:#89b4fa">
          <label for="show-skel-chk" style="font-size:10px;color:#cdd6f4;cursor:pointer">Show skeleton</label>
        </div>
      </div>
```

Replace it with:

```html
      <div id="posep" style="display:none">
        <div id="joint-inspector" style="display:none;margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span id="joint-inspector-name" style="font-size:10px;font-weight:600;color:#cdd6f4"></span>
            <button class="btn" id="ji-deselect" style="padding:1px 6px;font-size:10px">✕</button>
          </div>
          <div class="lbl" style="margin-bottom:3px">Position</div>
          <div class="srow"><label>X</label><input type="range" id="jp-x" min="-6" max="6" step="0.1" value="0"><span id="jp-xv" style="width:32px;text-align:right;font-size:10px;color:#89b4fa">0.0</span></div>
          <div class="srow"><label>Y</label><input type="range" id="jp-y" min="-6" max="6" step="0.1" value="0"><span id="jp-yv" style="width:32px;text-align:right;font-size:10px;color:#89b4fa">0.0</span></div>
          <div class="srow"><label>Z</label><input type="range" id="jp-z" min="-6" max="6" step="0.1" value="0"><span id="jp-zv" style="width:32px;text-align:right;font-size:10px;color:#89b4fa">0.0</span></div>
          <div class="lbl" style="margin-top:5px;margin-bottom:3px">Rotation</div>
          <div class="srow"><label>X</label><input type="range" id="jr-x" min="-180" max="180" step="1" value="0"><span id="jr-xv" style="width:32px;text-align:right;font-size:10px;color:#89b4fa">0°</span></div>
          <div class="srow"><label>Y</label><input type="range" id="jr-y" min="-180" max="180" step="1" value="0"><span id="jr-yv" style="width:32px;text-align:right;font-size:10px;color:#89b4fa">0°</span></div>
          <div class="srow"><label>Z</label><input type="range" id="jr-z" min="-180" max="180" step="1" value="0"><span id="jr-zv" style="width:32px;text-align:right;font-size:10px;color:#89b4fa">0°</span></div>
          <button class="btn tbtn" id="reset-joint-btn" style="margin-top:4px">↺ Reset joint</button>
          <div style="height:1px;background:#313244;margin:8px 0"></div>
        </div>
        <div id="pose-no-selection" style="font-size:10px;color:#6c7086;line-height:1.7;margin-bottom:5px">Drag joint handles to rotate.<br>Shift+drag to orbit.</div>
        <button class="btn tbtn" id="reset-pose-btn">↺ Reset pose</button>
        <div style="display:flex;align-items:center;gap:5px;margin-top:6px">
          <input type="checkbox" id="show-skel-chk" style="accent-color:#89b4fa">
          <label for="show-skel-chk" style="font-size:10px;color:#cdd6f4;cursor:pointer">Show skeleton</label>
        </div>
      </div>
```

- [ ] **Step 2: Verify build passes**

```bash
export PATH="$HOME/.nvm/versions/node/v22.21.0/bin:$PATH"
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...ms`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(pose): joint inspector HTML markup"
```

---

### Task 4: Wire `controls.js` — show/hide inspector, slider events, deselect, post-rebuild recapture

**Files:**
- Modify: `src/ui/controls.js`

**Interfaces:**
- Consumes from `poseEditor.js` (Task 1 + 2):
  - `captureDefaults()`
  - `getSelectedJoint() → string | null`
  - `clearJointSelection()`
  - `getJointState(id) → { dx, dy, dz, rx, ry, rz, label }`
  - `setJointPosition(id, dx, dy, dz)`
  - `setJointRotation(id, rx, ry, rz)`
  - `resetJoint(id)`

- [ ] **Step 1: Extend the poseEditor import line**

Find the existing import block:

```js
import {
  enterPoseMode, exitPoseMode,
  posePointerDown, posePointerMove, posePointerUp, isPoseDragging,
  resetSkeletonPose, setSkeletonVisible, isSkeletonVisible,
} from './poseEditor.js';
```

Replace with:

```js
import {
  enterPoseMode, exitPoseMode,
  posePointerDown, posePointerMove, posePointerUp, isPoseDragging,
  resetSkeletonPose, setSkeletonVisible, isSkeletonVisible,
  captureDefaults,
  getSelectedJoint, clearJointSelection,
  getJointState, setJointPosition, setJointRotation, resetJoint,
} from './poseEditor.js';
```

- [ ] **Step 2: Add `showJointInspector` / `hideJointInspector` / `syncJointSliders` helpers**

Add these three functions right after the poseEditor import block (before the undo buttons handler):

```js
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
```

- [ ] **Step 3: Wire the pose mousedown handler to show/hide inspector**

Find the existing pose mousedown block:

```js
  if (state.mode === 'pose') {
    const r = c3.getBoundingClientRect();
    m2.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    m2.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(m2, cam);
    posePointerDown(e, ray);
    return; // never paint/sculpt in pose mode
  }
```

Replace with:

```js
  if (state.mode === 'pose') {
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
    return;
  }
```

- [ ] **Step 4: Sync rotation sliders after drag**

Find the existing `isPoseDragging()` branch in the mousemove handler:

```js
  else if (isPoseDragging()) { posePointerMove(e); }
```

Replace with:

```js
  else if (isPoseDragging()) { posePointerMove(e); syncJointSliders(); }
```

- [ ] **Step 5: Wire the ✕ deselect button**

Find the existing pose panel controls block:

```js
// ── Pose panel controls ───────────────────────────────────────────────────────
document.getElementById('reset-pose-btn').addEventListener('click', resetSkeletonPose);
document.getElementById('show-skel-chk').addEventListener('change', e => {
  setSkeletonVisible(e.target.checked);
});
```

Replace with:

```js
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
```

- [ ] **Step 6: Wire position slider inputs**

Add after the reset-joint-btn handler:

```js
// Position sliders
['x','y','z'].forEach(axis => {
  document.getElementById(`jp-${axis}`).addEventListener('input', e => {
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
});

// Rotation sliders
['x','y','z'].forEach(axis => {
  document.getElementById(`jr-${axis}`).addEventListener('input', e => {
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
});
```

- [ ] **Step 7: Hide the inspector when leaving pose mode**

Find the mode button handler that calls `exitPoseMode()`:

```js
  if (state.mode === 'pose') exitPoseMode();
```

Replace with:

```js
  if (state.mode === 'pose') { exitPoseMode(); clearJointSelection(); hideJointInspector(); }
```

- [ ] **Step 8: Call `captureDefaults()` after every `rebuild()` in `controls.js`**

There are two `rebuild()` calls in `controls.js`:

**Body shape sliders** (line ~134):
```js
document.querySelectorAll('[data-s]').forEach(el => {
  el.addEventListener('input', () => { state.S[el.dataset.s] = parseFloat(el.value); rebuild(); });
});
```
Replace with:
```js
document.querySelectorAll('[data-s]').forEach(el => {
  el.addEventListener('input', () => {
    state.S[el.dataset.s] = parseFloat(el.value);
    rebuild(); resetPose(SK, root); captureDefaults();
  });
});
```

**Reset part button** (line ~368):
```js
  resetPart(selectedEditPart);
  rebuild();
  updatePartUI();
```
Replace with:
```js
  resetPart(selectedEditPart);
  rebuild(); resetPose(SK, root); captureDefaults();
  updatePartUI();
```

- [ ] **Step 9: Verify build passes**

```bash
export PATH="$HOME/.nvm/versions/node/v22.21.0/bin:$PATH"
npx vite build 2>&1 | tail -5
```

Expected: `✓ built in ...ms`

- [ ] **Step 10: Browser smoke test**

Open `http://localhost:5174` (start dev server if needed with `npm run dev`).

- Switch to **Pose** mode — skeleton overlay appears.
- Click a joint sphere (e.g. L Shoulder) — inspector panel shows "L Shoulder", all 6 sliders appear.
- Drag the Y Position slider — shoulder moves up/down; voxels follow.
- Drag the Y Rotation slider — arm swings forward/backward.
- Drag the joint handle in 3D — rotation sliders update live.
- Click ✕ — inspector hides, tip text returns.
- Click blank 3D canvas space — same deselect behavior.
- Click **↺ Reset joint** — joint snaps back; sliders return to 0.
- Click **↺ Reset pose** — all joints reset.
- Adjust a body shape slider — character rebuilds; re-enter Pose mode and verify Reset pose still works correctly.
- Press **Cmd+Z** — undo works for both drag and slider changes.

- [ ] **Step 11: Commit**

```bash
git add src/ui/controls.js
git commit -m "feat(pose): wire joint inspector — sliders, deselect, post-rebuild recapture"
```

---

## Self-Review Notes

- **Spec coverage:** All spec requirements covered — 6-DOF inspector ✓, shoulder-to-head bones ✓, captureDefaults ✓, Euler sync ✓, deselect-on-blank-click ✓, reset joint ✓, undo ✓, post-rebuild recapture ✓.
- **No placeholders:** All steps contain explicit code.
- **Type consistency:** `getJointState` returns `{ dx, dy, dz, rx, ry, rz, label }` — all consumers use exactly these field names.
- **One gap fixed:** `hideJointInspector()` must also be called when switching away from pose mode (Step 7) to prevent stale panel state on re-entry. Added.
