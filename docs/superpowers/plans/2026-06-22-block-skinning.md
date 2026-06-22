# Block Skinning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bone-aware block painting to vox-sprite-maker — users paint voxels onto a skeleton in sculpt "add" mode and the 2D editor; each placed block auto-parents to the nearest bone segment and moves with it during pose and animation.

**Architecture:** A new `src/skinning/` module provides two services: `boneAssign.js` (world-pos → SK key, pure function) and `gridCursor.js` (3D grid wireframe, ghost block, Z layer management). Block placement hooks into the existing sculpt "add" mouse handlers in `controls.js`. The 2D extrude gains Z-centering and bone assignment. All custom blocks persist in `savedParts.custom` via the existing localStorage mechanism and are restored by `rebuild()`.

**Tech Stack:** Three.js 0.167, vanilla ES modules, Vite 5, vitest (new dev dependency)

## Global Constraints

- No new mode tab — integrates into sculpt "add" tool only; delete/round tools unchanged
- SK keys (valid `skAncestor` values): `head`, `torso`, `lArm`, `lElbow`, `rArm`, `rElbow`, `lLeg`, `lKnee`, `rLeg`, `rKnee`
- Block data model: `{x, y, z, color, skAncestor}` — x/y/z in SK group local space, color is hex string
- `savedParts.custom` is a flat array; `savedParts._skeletonOnly` is boolean
- `U = 1`: all positions are integer world units (1 unit = 1 voxel = 1 output pixel)
- Z depth D is read from `document.getElementById('c2d-depth').value` (shared with 2D editor)
- Custom block meshes: `userData.part = 'custom'`, `userData.isSkin = false`, `userData.skAncestor = skKey`
- vitest environment: `'node'`
- 9 structural bone pairs used for assignment (excludes the two clavicle visual-only pairs)

---

### Task 1: vitest + Bone Assignment Module

**Files:**
- Create: `src/skinning/boneAssign.js`
- Create: `tests/boneAssign.test.js`
- Create: `vitest.config.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `assignBone(blockWorldPos: THREE.Vector3, SK: Record<string, THREE.Group>) → string`
- Produces: `BONE_PAIR_IDS: [string, string][]` (exported for tests)
- Produces: `JOINT_SK: Record<string, string>` (joint-id → SK key; exported for tests)

- [ ] **Step 1: Write the failing test**

```js
// tests/boneAssign.test.js
import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { assignBone, JOINT_SK } from '../src/skinning/boneAssign.js';

function mockGroup(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

// Approximate skeleton layout — world units, z=0 plane
const SK = {
  head:    mockGroup(0,  22, 0),
  torso:   mockGroup(0,  14, 0),
  lArm:    mockGroup(5,  20, 0),
  lElbow:  mockGroup(5,  16, 0),
  rArm:    mockGroup(-5, 20, 0),
  rElbow:  mockGroup(-5, 16, 0),
  lLeg:    mockGroup(2,  12, 0),
  lKnee:   mockGroup(2,   6, 0),
  rLeg:    mockGroup(-2, 12, 0),
  rKnee:   mockGroup(-2,  6, 0),
};

describe('assignBone', () => {
  test('block at head position → head', () => {
    expect(assignBone(new THREE.Vector3(0, 22, 0), SK)).toBe('head');
  });
  test('block at torso position → torso', () => {
    expect(assignBone(new THREE.Vector3(0, 14, 0), SK)).toBe('torso');
  });
  test('block at left shoulder → lArm', () => {
    expect(assignBone(new THREE.Vector3(5, 20, 0), SK)).toBe('lArm');
  });
  test('block at left elbow → lElbow', () => {
    expect(assignBone(new THREE.Vector3(5, 16, 0), SK)).toBe('lElbow');
  });
  test('block at right elbow → rElbow', () => {
    expect(assignBone(new THREE.Vector3(-5, 16, 0), SK)).toBe('rElbow');
  });
  test('block at left knee → lKnee', () => {
    expect(assignBone(new THREE.Vector3(2, 6, 0), SK)).toBe('lKnee');
  });
  test('always returns a valid SK key', () => {
    const valid = ['head','torso','lArm','lElbow','rArm','rElbow','lLeg','lKnee','rLeg','rKnee'];
    expect(valid).toContain(assignBone(new THREE.Vector3(0, 10, 0), SK));
  });
});

describe('JOINT_SK', () => {
  test('lShoulder → lArm',  () => expect(JOINT_SK.lShoulder).toBe('lArm'));
  test('lHip → lLeg',       () => expect(JOINT_SK.lHip).toBe('lLeg'));
  test('rShoulder → rArm',  () => expect(JOINT_SK.rShoulder).toBe('rArm'));
  test('rHip → rLeg',       () => expect(JOINT_SK.rHip).toBe('rLeg'));
});
```

- [ ] **Step 2: Run test — verify it fails with "Cannot find module"**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && npx vitest run tests/boneAssign.test.js 2>&1 | head -20
```

Expected: error about missing module or vitest not installed.

- [ ] **Step 3: Install vitest and create config**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && npm install -D vitest
```

Create `vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node' },
});
```

In `package.json`, add `"test": "vitest"` to `scripts`:
```json
{
  "name": "vox-sprite-maker",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "latest"
  },
  "dependencies": {
    "three": "^0.167.0"
  }
}
```

- [ ] **Step 4: Create `src/skinning/boneAssign.js`**

```js
import * as THREE from 'three';

export const JOINT_SK = {
  head:      'head',
  torso:     'torso',
  lShoulder: 'lArm',
  lElbow:    'lElbow',
  rShoulder: 'rArm',
  rElbow:    'rElbow',
  lHip:      'lLeg',
  lKnee:     'lKnee',
  rHip:      'rLeg',
  rKnee:     'rKnee',
};

// Clavicle pairs (torso↔lShoulder↔head) are intentionally excluded — they
// produce unintuitive bone assignments for blocks near the collar/neck.
export const BONE_PAIR_IDS = [
  ['torso',     'head'],
  ['torso',     'lShoulder'],
  ['torso',     'rShoulder'],
  ['torso',     'lHip'],
  ['torso',     'rHip'],
  ['lShoulder', 'lElbow'],
  ['rShoulder', 'rElbow'],
  ['lHip',      'lKnee'],
  ['rHip',      'rKnee'],
];

const _A       = new THREE.Vector3();
const _B       = new THREE.Vector3();
const _AB      = new THREE.Vector3();
const _AP      = new THREE.Vector3();
const _closest = new THREE.Vector3();

/**
 * Returns the SK key of the bone endpoint closest to blockWorldPos.
 * Runs point-to-segment distance for each structural bone pair; on the
 * winning segment the closer of the two endpoints wins.
 */
export function assignBone(blockWorldPos, SK) {
  let bestDist = Infinity;
  let bestKey  = 'torso';

  for (const [aId, bId] of BONE_PAIR_IDS) {
    const ag = SK[JOINT_SK[aId]];
    const bg = SK[JOINT_SK[bId]];
    if (!ag || !bg) continue;

    ag.getWorldPosition(_A);
    bg.getWorldPosition(_B);

    _AB.subVectors(_B, _A);
    _AP.subVectors(blockWorldPos, _A);
    const lenSq = _AB.lengthSq();
    const t     = lenSq > 0 ? Math.max(0, Math.min(1, _AP.dot(_AB) / lenSq)) : 0;
    _closest.copy(_A).addScaledVector(_AB, t);

    const dist = blockWorldPos.distanceTo(_closest);
    if (dist < bestDist) {
      bestDist = dist;
      const dA = blockWorldPos.distanceTo(_A);
      const dB = blockWorldPos.distanceTo(_B);
      bestKey  = JOINT_SK[dA <= dB ? aId : bId];
    }
  }

  return bestKey;
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && npx vitest run tests/boneAssign.test.js
```

Expected: `Tests  11 passed`

- [ ] **Step 6: Commit**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && git add src/skinning/boneAssign.js tests/boneAssign.test.js vitest.config.js package.json package-lock.json && git commit -m "feat: add bone assignment module + vitest"
```

---

### Task 2: 3D Grid Cursor Module

**Files:**
- Create: `src/skinning/gridCursor.js`
- Modify: `index.html` (add `#z-hud` element)

**Interfaces:**
- Consumes: `scene` from `../renderer/scene.js`, `state` from `../state.js`
- Produces:
  - `showGrid(dims: ReturnType<getDims>): void` — rebuild geometry from dims + depth slider, show all, reset Z
  - `hideGrid(): void` — hide volume lines, layer grid, ghost, Z HUD
  - `updateGhost(ray: THREE.Raycaster, bodyV: THREE.Mesh[]): void` — cast to active Z plane, snap XY, show ghost unless occupied
  - `hideGhost(): void`
  - `getSnappedPos(): {x: number, y: number, z: number}` — last snapped cursor cell
  - `resetZ(): void` — activeZ = 0, update layer position and HUD
  - `onScroll(e: WheelEvent, D: number): void` — clamp and advance activeZ by ±1

- [ ] **Step 1: Add `#z-hud` to `index.html`**

Find `<div id="vc">` (the 3D viewport container) in `index.html`. It currently reads:
```html
<div id="vc"><canvas id="c3"></canvas><span class="hint">...
```

Change it to add `position:relative` and insert the HUD span:
```html
<div id="vc" style="position:relative"><canvas id="c3"></canvas><span class="hint">Paint: drag · Orbit: shift/right drag · Sculpt delete: ⌘+click</span>
      <span id="z-hud" style="display:none;position:absolute;bottom:28px;left:8px;font-family:system-ui,sans-serif;font-size:11px;color:#cba6f7;pointer-events:none;background:rgba(17,17,27,0.65);padding:2px 6px;border-radius:3px"></span>
```

- [ ] **Step 2: Create `src/skinning/gridCursor.js`**

```js
import * as THREE from 'three';
import { scene } from '../renderer/scene.js';
import { state } from '../state.js';

let _activeZ  = 0;
let _snappedX = 0, _snappedY = 0;
let _dims     = null;

// ── Materials (shared, never rebuilt) ─────────────────────────────────────────
const _volMat   = new THREE.LineBasicMaterial({ color: 0x45475a, transparent: true, opacity: 0.3, depthTest: false });
const _layMat   = new THREE.LineBasicMaterial({ color: 0xcba6f7, transparent: true, opacity: 0.25, depthTest: false });
const _ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false });

// ── Ghost block (singleton) ───────────────────────────────────────────────────
const _ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), _ghostMat);
_ghost.renderOrder = 10;
_ghost.visible    = false;
_ghost.raycast    = () => {};
scene.add(_ghost);

// ── Grid geometry (rebuilt on showGrid) ───────────────────────────────────────
let _volLines = null;
let _layLines = null;

function _zRange(D) {
  const zMax = Math.floor(D / 2);
  return { zMin: zMax - (D - 1), zMax };
}

function _computeBounds(dims) {
  const D = parseInt(document.getElementById('c2d-depth').value, 10) || 4;
  const { TW, AW, LLH, ULH, TH, HH } = dims;
  const { zMin, zMax } = _zRange(D);
  return {
    xMin: -Math.ceil(TW / 2 + AW + 1),
    xMax:  Math.ceil(TW / 2 + AW + 1),
    yMin: 0,
    yMax: Math.ceil(LLH + ULH + TH + HH + 1),
    zMin, zMax, D,
  };
}

function _buildVolGeo(xMin, xMax, yMin, yMax, zMin, zMax) {
  const pts = [];
  const ae = (ax, ay, az, bx, by, bz) => pts.push(ax, ay, az, bx, by, bz);
  // Bottom face
  ae(xMin, yMin, zMin, xMax, yMin, zMin); ae(xMax, yMin, zMin, xMax, yMax, zMin);
  ae(xMax, yMax, zMin, xMin, yMax, zMin); ae(xMin, yMax, zMin, xMin, yMin, zMin);
  // Top face
  ae(xMin, yMin, zMax, xMax, yMin, zMax); ae(xMax, yMin, zMax, xMax, yMax, zMax);
  ae(xMax, yMax, zMax, xMin, yMax, zMax); ae(xMin, yMax, zMax, xMin, yMin, zMax);
  // Vertical edges
  ae(xMin, yMin, zMin, xMin, yMin, zMax); ae(xMax, yMin, zMin, xMax, yMin, zMax);
  ae(xMax, yMax, zMin, xMax, yMax, zMax); ae(xMin, yMax, zMin, xMin, yMax, zMax);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

function _buildLayGeo(xMin, xMax, yMin, yMax) {
  const pts = [];
  // Horizontal lines (varying x, constant y) at z=0 in local space
  for (let y = yMin; y <= yMax; y++) pts.push(xMin, y, 0, xMax, y, 0);
  // Vertical lines (varying y, constant x)
  for (let x = xMin; x <= xMax; x++) pts.push(x, yMin, 0, x, yMax, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

function _updateHUD() {
  const el = document.getElementById('z-hud');
  if (el) el.textContent = `Z: ${_activeZ >= 0 ? '+' : ''}${_activeZ}`;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function showGrid(dims) {
  _dims = dims;
  const { xMin, xMax, yMin, yMax, zMin, zMax } = _computeBounds(dims);

  if (_volLines) { scene.remove(_volLines); _volLines.geometry.dispose(); }
  if (_layLines) { scene.remove(_layLines); _layLines.geometry.dispose(); }

  _volLines = new THREE.LineSegments(_buildVolGeo(xMin, xMax, yMin, yMax, zMin, zMax), _volMat);
  _volLines.renderOrder = 5;
  _volLines.frustumCulled = false;
  scene.add(_volLines);

  _layLines = new THREE.LineSegments(_buildLayGeo(xMin, xMax, yMin, yMax), _layMat);
  _layLines.renderOrder = 6;
  _layLines.frustumCulled = false;
  scene.add(_layLines);

  resetZ();
  const el = document.getElementById('z-hud');
  if (el) el.style.display = '';
}

export function hideGrid() {
  if (_volLines) _volLines.visible = false;
  if (_layLines) _layLines.visible = false;
  _ghost.visible = false;
  const el = document.getElementById('z-hud');
  if (el) el.style.display = 'none';
}

export function hideGhost() {
  _ghost.visible = false;
}

const _hitPt = new THREE.Vector3();
const _wPos  = new THREE.Vector3();

export function updateGhost(ray, bodyV) {
  if (!_dims) { _ghost.visible = false; return; }
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -_activeZ);
  if (!ray.ray.intersectPlane(plane, _hitPt)) { _ghost.visible = false; return; }

  _snappedX = Math.round(_hitPt.x);
  _snappedY = Math.round(_hitPt.y);

  const occupied = bodyV.some(m => {
    m.getWorldPosition(_wPos);
    return Math.round(_wPos.x) === _snappedX &&
           Math.round(_wPos.y) === _snappedY &&
           Math.round(_wPos.z) === _activeZ;
  });

  if (occupied) { _ghost.visible = false; return; }

  _ghostMat.color.set(new THREE.Color(state.col));
  _ghost.position.set(_snappedX, _snappedY, _activeZ);
  _ghost.visible = true;
}

export function getSnappedPos() {
  return { x: _snappedX, y: _snappedY, z: _activeZ };
}

export function resetZ() {
  _activeZ = 0;
  if (_layLines) _layLines.position.z = 0;
  _updateHUD();
}

export function onScroll(e, D) {
  const { zMin, zMax } = _zRange(D);
  _activeZ = Math.max(zMin, Math.min(zMax, _activeZ + (e.deltaY > 0 ? -1 : 1)));
  if (_layLines) _layLines.position.z = _activeZ;
  _updateHUD();
}
```

- [ ] **Step 3: Confirm no parse errors**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && npm run build 2>&1 | tail -10
```

Expected: build succeeds (or only pre-existing warnings). The module is not yet imported anywhere, so no runtime effect.

- [ ] **Step 4: Commit**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && git add src/skinning/gridCursor.js index.html && git commit -m "feat: add 3D grid cursor module and Z HUD element"
```

---

### Task 3: Skeleton-Only Mode + Custom Block Loading in `rebuild()`

**Files:**
- Modify: `src/character/skeleton.js`
- Modify: `index.html` (add `#new-char-btn`)
- Modify: `src/ui/controls.js` (button handler)

**Interfaces:**
- Consumes: `savedParts._skeletonOnly: boolean | undefined` — checked in rebuild() to skip default block generation
- Consumes: `savedParts.custom: Array<{x,y,z,color,skAncestor}> | undefined` — loaded in rebuild()
- Consumes: `setSkeletonVisible`, `captureDefaults` (already imported in controls.js from `./poseEditor.js`)
- Consumes: `resetPart`, `savePart` (already imported in controls.js from `../character/parts.js`)

- [ ] **Step 1: Add `_skeletonOnly` guards to `rebuild()` in `skeleton.js`**

In `rebuild()`, each body section has the pattern `if (savedParts.X) { ... } else { /* default blocks */ }`. Change every `} else {` that generates default body blocks to `} else if (!savedParts._skeletonOnly) {`.

There are 4 such locations:

**Head** (around line 48 in skeleton.js):
```js
  } else if (!savedParts._skeletonOnly) {
    const headB = voxBlock(HW, HH, HD, state.skin, { roundCorners: true });
```

**Torso** (around line 74):
```js
  } else if (!savedParts._skeletonOnly) {
    const torsoB = voxBlock(TW, TH, TD, GRAY);
```

**makeArm** (around line 101, inside the `else` for arm generation):
```js
    } else if (!savedParts._skeletonOnly) {
      const ua = voxBlock(AW, UAH, AW, GRAY, { roundCorners: true });
```

**makeLeg** (around line 134, inside the `else` for leg generation):
```js
    } else if (!savedParts._skeletonOnly) {
      const ul = voxBlock(LW, ULH, LW, GRAY);
```

- [ ] **Step 2: Add custom block loading to `rebuild()` in `skeleton.js`**

After `makeLeg('l'); makeLeg('r');` (line 149) and before `applySkin();`, add:

```js
  // Custom blocks from block skinning — parented to the stored SK group
  if (savedParts.custom && savedParts.custom.length) {
    savedParts.custom.forEach(e => {
      const group = SK[e.skAncestor];
      if (!group) return;
      const m = new THREE.Mesh(BG, mat(e.color));
      m.position.set(e.x, e.y, e.z);
      m.userData.part = 'custom';
      m.userData.isSkin = false;
      m.userData.skAncestor = e.skAncestor;
      bodyV.push(m);
      group.add(m);
    });
  }
```

- [ ] **Step 3: Add `#new-char-btn` to `index.html`**

In `index.html`, find the closing div of `#sp` (sculpt panel). After the help-text `<div>` inside `#sp`, before `</div>` that closes `#sp`, add:

```html
        <div style="height:1px;background:#313244;margin:8px 0"></div>
        <button class="btn tbtn" id="new-char-btn">☐ New character</button>
```

The full end of `#sp` should look like:
```html
        <div style="font-size:10px;color:#6c7086;line-height:1.9;padding:2px 0">
          <b style="color:#cdd6f4">Drag</b> — sculpt<br>
          <b style="color:#cdd6f4">⌘+click</b> — quick delete<br>
          <b style="color:#cdd6f4">Shift+drag</b> — orbit
        </div>
        <div style="height:1px;background:#313244;margin:8px 0"></div>
        <button class="btn tbtn" id="new-char-btn">☐ New character</button>
      </div>
```

- [ ] **Step 4: Wire `#new-char-btn` in `controls.js`**

After `updatePartUI();` (near end of the body part editor section, around line 480), add:

```js
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
```

- [ ] **Step 5: Start dev server and verify skeleton-only mode**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && npm run dev
```

1. Open http://localhost:5173
2. Switch to Sculpt mode — "New character" button appears at bottom
3. Click "New character" → confirm → all body voxels disappear; skeleton bone lines remain visible
4. Refresh — skeleton-only state persists (no voxels on reload)
5. Check browser console for errors — expect none

Expected: only bone lines visible, no body voxels.

- [ ] **Step 6: Commit**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && git add src/character/skeleton.js index.html src/ui/controls.js && git commit -m "feat: skeleton-only mode and custom block loading in rebuild()"
```

---

### Task 4: 3D Block Placement

**Files:**
- Modify: `src/ui/controls.js`

**Interfaces:**
- Consumes: `showGrid`, `hideGrid`, `updateGhost`, `hideGhost`, `getSnappedPos`, `resetZ`, `onScroll as gridOnScroll` from `../skinning/gridCursor.js`
- Consumes: `assignBone` from `../skinning/boneAssign.js`
- Consumes: `SK`, `bodyV` (already imported from `../character/skeleton.js`)
- Consumes: `BG`, `mat` (already imported from `../character/voxels.js`)
- Consumes: `savedParts`, `savePart`, `resetPart` (already imported from `../character/parts.js`)
- Consumes: `pushUndo` (already imported from `./undo.js`)
- Consumes: `getDims` (already imported from `../character/voxels.js`)

- [ ] **Step 1: Add imports to `controls.js`**

After the existing import block in `controls.js` (after the last `import` line), add:

```js
import { showGrid, hideGrid, updateGhost, hideGhost, getSnappedPos, resetZ, onScroll as gridOnScroll } from '../skinning/gridCursor.js';
import { assignBone } from '../skinning/boneAssign.js';
```

- [ ] **Step 2: Add `placeCustomBlock` and `removeCustomBlock` helpers**

After the ghost cursor section at the very end of `controls.js` (after `c3.addEventListener('mouseleave', hideGhost)`), add:

```js
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
```

- [ ] **Step 3: Modify mode switch to show/hide grid**

Find the mode button listener in `controls.js` (around line 87):
```js
b.classList.add('on'); state.mode = b.dataset.mode; hideGhost();
```

Change to:
```js
b.classList.add('on'); state.mode = b.dataset.mode; hideGhost();
if (state.mode === 'sculpt' && state.sculptTool === 'add') { resetZ(); showGrid(getDims()); }
else hideGrid();
```

- [ ] **Step 4: Modify stool switch to show/hide grid**

Find the sculpt tool button listener (around line 64). After `state.sculptTool = b.dataset.stool;`, add:
```js
if (state.mode === 'sculpt') {
  if (b.dataset.stool === 'add') { resetZ(); showGrid(getDims()); }
  else hideGrid();
}
```

- [ ] **Step 5: Add wheel event listener for Z layer**

After `c3.addEventListener('mouseleave', hideGhost);` (near the end of the ghost cursor section), add:

```js
c3.addEventListener('wheel', e => {
  if (state.mode !== 'sculpt' || state.sculptTool !== 'add') return;
  e.preventDefault();
  const D = parseInt(document.getElementById('c2d-depth').value, 10) || 4;
  gridOnScroll(e, D);
}, { passive: false });
```

- [ ] **Step 6: Modify `updateGhostCursor` to delegate to grid cursor in sculpt add mode**

Find `function updateGhostCursor(e)` in `controls.js` (around line 707). At the very start of the function body, before any existing code, add:

```js
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
  // ... rest of existing function unchanged ...
```

- [ ] **Step 7: Modify `mousedown` to route sculpt add through grid cursor**

Find `c3.addEventListener('mousedown', e => {` in `controls.js`. After `lmx = e.clientX; lmy = e.clientY;`, before the existing `if (e.button === 2 || e.shiftKey)` check, insert:

```js
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
```

- [ ] **Step 8: Refresh grid when body shape sliders change**

In the `document.querySelectorAll('[data-s]').forEach` handler (around line 238), after `rebuild(); resetPose(SK, root); captureDefaults();`, add:
```js
if (state.mode === 'sculpt' && state.sculptTool === 'add') showGrid(getDims());
```

- [ ] **Step 9: Hide grid when entering 2D mode**

In the `mode2d-btn` click handler, change:
```js
  if (active) {
    document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('on'));
    enter2D();
```
to:
```js
  if (active) {
    document.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('on'));
    hideGrid();
    enter2D();
```

- [ ] **Step 10: Start dev server and verify 3D block placement end-to-end**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && npm run dev
```

Test sequence:
1. Open http://localhost:5173
2. Click "New character" (skeleton-only, confirm)
3. Switch to Sculpt → Add tool
4. Expected: dim bounding box + bright XY layer grid appear; Z HUD shows `Z: +0`
5. Move mouse over 3D view → semi-transparent ghost block snaps to grid cells
6. Scroll up → `Z: +1`, layer grid moves back; scroll down → `Z: -1`
7. Left-click → solid block placed; ghost disappears from that cell
8. Switch to Pose mode, drag a joint → placed blocks move with bones ✓
9. Switch back to Sculpt Add, right-click on a placed block → block removed ✓
10. Cmd+Z → block restored ✓
11. Refresh page → custom blocks persist ✓
12. Switch to Sculpt → Delete tool → grid disappears ✓

- [ ] **Step 11: Commit**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && git add src/ui/controls.js && git commit -m "feat: wire sculpt add mode to 3D grid cursor for block placement"
```

---

### Task 5: 2D Extrude with Z-Centering + Bone Assignment

**Files:**
- Create: `tests/extrude.test.js`
- Modify: `src/ui/editor2d.js`

**Interfaces:**
- Consumes: `assignBone` from `../skinning/boneAssign.js` (new import)
- Consumes: `SK` from `../character/skeleton.js` (added to existing import)
- Consumes: `savedParts, savePart, resetPart` from `../character/parts.js` (new import)
- Produces: modified extrude that creates blocks in SK groups with `z = Math.floor(D/2) - i` formula

- [ ] **Step 1: Write failing test for the Z-centering formula**

```js
// tests/extrude.test.js
import { describe, test, expect } from 'vitest';

function zLayers(depth) {
  return Array.from({ length: depth }, (_, i) => Math.floor(depth / 2) - i);
}

describe('zLayers — z-centering formula', () => {
  test('depth 1 → [0]',               () => expect(zLayers(1)).toEqual([0]));
  test('depth 2 → [1, 0]',            () => expect(zLayers(2)).toEqual([1, 0]));
  test('depth 3 → [1, 0, -1]',        () => expect(zLayers(3)).toEqual([1, 0, -1]));
  test('depth 4 → [2, 1, 0, -1]',     () => expect(zLayers(4)).toEqual([2, 1, 0, -1]));
  test('depth 5 → [2, 1, 0, -1, -2]', () => expect(zLayers(5)).toEqual([2, 1, 0, -1, -2]));
  test('z=0 (skeleton plane) always included', () => {
    for (let d = 1; d <= 8; d++) expect(zLayers(d)).toContain(0);
  });
});
```

- [ ] **Step 2: Run — verify pass (pure math, no module needed)**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && npx vitest run tests/extrude.test.js
```

Expected: `Tests  6 passed`

- [ ] **Step 3: Update imports in `editor2d.js`**

Change:
```js
import { bodyV, clothV, root } from '../character/skeleton.js';
```
to:
```js
import { bodyV, clothV, root, SK } from '../character/skeleton.js';
```

Add after the existing import block:
```js
import { savedParts, savePart, resetPart } from '../character/parts.js';
import { assignBone } from '../skinning/boneAssign.js';
```

- [ ] **Step 4: Replace the extrude handler in `editor2d.js`**

Replace the entire `document.getElementById('c2d-extrude-btn').addEventListener('click', () => { ... });` block (lines 138–183 in the original) with:

```js
document.getElementById('c2d-extrude-btn').addEventListener('click', () => {
  const depth = parseInt(depthSlider.value);

  const oldBody   = bodyV.map(m => ({ mesh: m, parent: m.parent }));
  const oldCloth  = clothV.map(m => ({ mesh: m, parent: m.parent }));
  const oldCustom = savedParts.custom ? [...savedParts.custom] : [];

  oldBody.forEach( ({ mesh, parent }) => parent && parent.remove(mesh));
  oldCloth.forEach(({ mesh, parent }) => parent && parent.remove(mesh));
  bodyV.length = 0; clothV.length = 0;

  const created       = [];
  const customEntries = [];

  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const col = paint2D[gy][gx];
      if (!col) continue;
      const wx = (gx - GW / 2 + 0.5) * U;
      const wy = ORTHO_CAM_Y + (GH / 2 - gy - 0.5) * U;

      for (let i = 0; i < depth; i++) {
        const wz       = (Math.floor(depth / 2) - i) * U;
        const worldPos = new THREE.Vector3(wx, wy, wz);

        const skKey  = assignBone(worldPos, SK);
        const group  = SK[skKey] || root;
        const localPos = group.worldToLocal(worldPos.clone());

        const m = new THREE.Mesh(BG, mat(col));
        m.position.copy(localPos);
        m.userData.part = 'custom';
        m.userData.isSkin = false;
        m.userData.skAncestor = skKey;
        group.add(m);
        bodyV.push(m);
        created.push({ mesh: m, parent: group });

        customEntries.push({
          x: +localPos.x.toFixed(4),
          y: +localPos.y.toFixed(4),
          z: +localPos.z.toFixed(4),
          color: col,
          skAncestor: skKey,
        });
      }
    }
  }

  savedParts.custom = customEntries;
  savePart('custom', customEntries);
  if (savedParts._skeletonOnly) resetPart('_skeletonOnly');

  pushUndo({
    undo() {
      created.forEach(({ mesh, parent }) => {
        parent.remove(mesh);
        const i = bodyV.indexOf(mesh); if (i !== -1) bodyV.splice(i, 1);
      });
      oldBody.forEach( ({ mesh, parent }) => { parent.add(mesh); bodyV.push(mesh); });
      oldCloth.forEach(({ mesh, parent }) => { parent.add(mesh); clothV.push(mesh); });
      savedParts.custom = oldCustom;
      savePart('custom', oldCustom);
    },
    redo() {
      oldBody.forEach( ({ mesh, parent }) => {
        parent.remove(mesh);
        const i = bodyV.indexOf(mesh); if (i !== -1) bodyV.splice(i, 1);
      });
      oldCloth.forEach(({ mesh, parent }) => {
        parent.remove(mesh);
        const i = clothV.indexOf(mesh); if (i !== -1) clothV.splice(i, 1);
      });
      created.forEach(({ mesh, parent }) => { parent.add(mesh); bodyV.push(mesh); });
      savedParts.custom = customEntries;
      savePart('custom', customEntries);
    },
  });

  exit2D();
});
```

- [ ] **Step 5: Run all tests**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && npx vitest run
```

Expected: `Tests  17 passed` (11 boneAssign + 6 extrude)

- [ ] **Step 6: Start dev server and test 2D extrude end-to-end**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && npm run dev
```

Test sequence:
1. Click "New character" (skeleton-only)
2. Click "✏ 2D Sketch"
3. Paint a simple silhouette (e.g. torso + head outline)
4. Set depth slider to 3
5. Click "Extrude to 3D"
6. Expected: blocks appear at z=+1, z=0, z=-1 (centered on skeleton plane)
7. Switch to Pose mode, rotate torso joint → torso blocks follow ✓; head blocks follow head ✓
8. Undo → blocks disappear, blank canvas restored ✓
9. Refresh page → extruded blocks persist ✓
10. Try depth 4 → z=+2, +1, 0, -1 (off-center toward back by one, matches spec table) ✓

- [ ] **Step 7: Commit**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker" && git add src/ui/editor2d.js tests/extrude.test.js && git commit -m "feat: bone-aware 2D extrude with z-centering formula"
```

---

## Self-Review

**1. Spec coverage:**

| Spec requirement | Task |
|---|---|
| XY grid at active Z layer, full volume wireframe | Task 2 |
| Scroll wheel moves Z layer; Z indicator HUD | Task 2, Task 4 Step 5 |
| Layer resets to z=0 on re-entering sculpt mode | Task 4 Steps 3–4 |
| Ghost block (current color), hidden on occupied cell | Task 2 |
| No surface raycast in sculpt add — always Z plane | Task 4 Steps 6–7 |
| Left-click: place block, bone assign, parent to SK, push undo | Task 4 Step 2 |
| Right-click: remove block at snapped cell, push undo | Task 4 Step 2 |
| Bone assignment: point-to-segment, nearest endpoint wins | Task 1 |
| 2D extrude z-centering formula `floor(D/2) - i` | Task 5 |
| 2D extrude bone assignment on every placed block | Task 5 |
| `savedParts.custom = [{x,y,z,color,skAncestor}]` flat array | Tasks 4, 5 |
| `rebuild()` restores custom blocks from `savedParts.custom` | Task 3 |
| `_skeletonOnly` flag — "New character" button | Task 3 |
| First placed block clears `_skeletonOnly` | Task 4 Step 2, Task 5 Step 4 |
| Face/hair/clothing/pose/animation — untouched | All tasks (nothing touches those) |
| Undo/redo for all placement/removal operations | Tasks 4, 5 |
| Persistence via existing localStorage `vox_parts` key | Tasks 4, 5 |

**2. Placeholder scan:** None.

**3. Type consistency:**
- `assignBone(blockWorldPos: THREE.Vector3, SK)` — same call signature in boneAssign.js, boneAssign.test.js, controls.js, editor2d.js
- `savedParts.custom: Array<{x,y,z,color,skAncestor}>` — same shape in skeleton.js (read), controls.js (write), editor2d.js (write)
- `getSnappedPos()` returns `{x, y, z}` — destructured the same way in controls.js mousedown handler
- `JOINT_SK.lShoulder → 'lArm'` — consistent between boneAssign.js definition and test assertions
- `showGrid(getDims())` — `getDims()` already imported in controls.js; `showGrid` signature accepts that return type
