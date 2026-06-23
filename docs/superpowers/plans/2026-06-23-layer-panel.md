# Layer Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4th column with a two-tab layer panel (Bone view and Layers view) that shows all character parts organized by bone group or category, with eye toggles for visibility and drag-and-drop bone reassignment for custom blocks.

**Architecture:** Panel-over-existing-data (Option A from spec). `layerPanel.js` reads live from `bodyV`, `clothV`, `savedParts`, `SK`, `equipped`, `WDEFS`. It dispatches custom DOM events for mutations; `controls.js` handles them and calls `refresh()` after each. No data model changes.

**Tech Stack:** Three.js 0.167, vanilla JS ES modules, Vite 5, vitest. Run dev server: `$HOME/.nvm/versions/node/v22.21.0/bin/npm run dev`. Run tests: `$HOME/.nvm/versions/node/v22.21.0/bin/npm test`.

## Global Constraints

- No framework — vanilla JS ES modules only
- `npx`/`npm`/`node` are NOT on PATH — always prefix with `$HOME/.nvm/versions/node/v22.21.0/bin/`
- All editor overlay objects (not character voxels) must use `mesh.layers.set(1)` so they don't appear in pixel export
- Follow existing code style: terse, no comments unless non-obvious
- `rebuildCloth`, `rebuild`, `reassignBone` all live in existing files — do not move them

---

### Task 1: Tag cloth voxels with their piece key

Clothing voxels in `clothV` currently have no identifier linking them back to which piece they belong to (shirt, coat, etc.). The layer panel needs this to group cloth rows correctly.

**Files:**
- Modify: `src/character/clothing.js`

**Interfaces:**
- Produces: `mesh.userData.clothPiece` (string, e.g. `'shirt'`) on every mesh added to `clothV`

- [ ] **Step 1: Update `cBlock` helper to accept and stamp a piece key**

In `src/character/clothing.js`, change the `cBlock` function (defined inside `rebuildCloth`):

```js
// Before:
function cBlock(cols, rows, depth, color, opts = {}) {
  const b = voxBlock(cols, rows, depth, color, opts);
  b.g.userData.isClothGroup = true;
  b.ms.forEach(m => { m.userData.isCloth = true; clothV.push(m); });
  return b;
}

// After:
function cBlock(cols, rows, depth, color, opts = {}, pieceKey = '') {
  const b = voxBlock(cols, rows, depth, color, opts);
  b.g.userData.isClothGroup = true;
  b.ms.forEach(m => { m.userData.isCloth = true; m.userData.clothPiece = pieceKey; clothV.push(m); });
  return b;
}
```

- [ ] **Step 2: Pass the piece key (`k`) at every `cBlock` call site**

Inside `Object.entries(equipped).forEach(([slot, k]) => { ... })`, every `cBlock(...)` call must pass `k` as the final argument. Apply this diff (add `, k` before the closing `)` of each `cBlock` call):

```js
// slot === 'top'
const tb = cBlock(TW + C * 2, TH + ext, TD + C * 2, d.color, {}, k);
const us = cBlock(AW + C, UAH, AW + C, d.color, { roundCorners: true }, k);
const ls = cBlock(AW + C, LAH, AW + C, d.color, { roundCorners: true }, k);  // coat only

// slot === 'legs'
const ul = cBlock(LW + C, ULH, LW + C, d.color, {}, k);
const ll = cBlock(LW + C, LLH, LW + C, d.color, {}, k);  // not shorts

// slot === 'feet'
const sh = cBlock(FW + 1, FH + 1, FD + 1, d.color, { roundCorners: true }, k);

// slot === 'head'
const brim = cBlock(HW + 2, Math.max(1, Math.round(sc * 0.5)), HD + 2, d.color, {}, k);
const top  = cBlock(HW, Math.max(1, Math.round(sc * 1.5)), HD, d.color, { roundCorners: true }, k);
```

- [ ] **Step 3: Verify in the browser**

Open `http://localhost:5173`. Open DevTools console and run:

```js
// Equip a shirt first using the wardrobe panel, then:
import('/src/character/clothing.js').then(m => {
  // Check in the main module context via window debug (or just check visually)
  console.log('cloth piece sample check done');
});
```

Instead — equip a shirt, open the Sources tab, add a breakpoint in `rebuildCloth` after `clothV.push(m)`, confirm `m.userData.clothPiece === 'shirt'`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/brynnc/Documents/Game Projects/Game Tools/vox-sprite-maker"
git add src/character/clothing.js
git commit -m "feat: stamp clothPiece key on cloth voxel userData"
```

---

### Task 2: HTML restructure — move col 4 controls, install layer panel shell

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: `#lp-bone-view`, `#lp-layer-view`, `#lp-tab-bone`, `#lp-tab-layers` DOM elements for use by layerPanel.js
- Produces: Direction buttons card moved into col 3

- [ ] **Step 1: Add CSS for the layer panel**

Inside the `<style>` block in `index.html`, append before the closing `</style>`:

```css
.lp-group { margin-bottom: 2px; }
.lp-header { display:flex;align-items:center;gap:4px;padding:3px 2px;cursor:pointer;border-radius:3px;user-select:none; }
.lp-header:hover { background:#1e1e2e; }
.lp-header.drag-over { background:#1e3a5f !important; border-radius:3px; }
.lp-toggle { font-size:9px;width:10px;flex-shrink:0;color:#6c7086; }
.lp-eye { cursor:pointer;font-size:11px;width:14px;flex-shrink:0;opacity:0.75;line-height:1; }
.lp-eye.lp-hidden { opacity:0.22; }
.lp-label { font-size:10px;flex:1; }
.lp-row { display:flex;align-items:center;gap:4px;padding:2px 2px 2px 18px;border-radius:2px; }
.lp-row:hover { background:#1e1e2e; }
.lp-row.lp-dragging { opacity:0.35; }
.lp-cloth-row.lp-equipped { color:#a6e3a1; }
.lp-cloth-row.lp-unequipped { opacity:0.45; }
```

- [ ] **Step 2: Replace the 4th column contents with the layer panel shell**

Find the `<!-- RIGHT PANEL -->` comment (line ~237) and replace the entire `<div class="col right-col"...>` block with:

```html
  <!-- LAYER PANEL -->
  <div class="col right-col" style="overflow-y:auto">
    <div class="card">
      <div style="display:flex;gap:3px;margin-bottom:6px">
        <button class="btn seg-btn on" id="lp-tab-bone" style="flex:1;padding:3px 2px;font-size:10px">Bone</button>
        <button class="btn seg-btn" id="lp-tab-layers" style="flex:1;padding:3px 2px;font-size:10px">Layers</button>
      </div>
      <div id="lp-bone-view"></div>
      <div id="lp-layer-view" style="display:none"></div>
    </div>
    <div class="card">
      <button class="btn" id="new-cloth-btn" style="width:100%;padding:4px">+ New clothing</button>
    </div>
    <div class="card" id="cloth-editor-card" style="display:none">
      <div class="lbl">New Clothing</div>
      <div class="cprow"><label>Name</label><input id="cloth-name" style="flex:1;background:#1e1e2e;border:0.5px solid #45475a;color:#cdd6f4;border-radius:3px;padding:2px 5px;font-size:10px"></div>
      <div class="cprow"><label>Slot</label>
        <select id="cloth-slot" style="flex:1;background:#1e1e2e;border:0.5px solid #45475a;color:#cdd6f4;border-radius:3px;padding:2px;font-size:10px">
          <option value="top">Top</option><option value="legs">Legs</option><option value="feet">Feet</option><option value="head">Head</option>
        </select>
      </div>
      <div class="cprow"><label>Style</label><select id="cloth-style" style="flex:1;background:#1e1e2e;border:0.5px solid #45475a;color:#cdd6f4;border-radius:3px;padding:2px;font-size:10px"></select></div>
      <div class="cprow"><label>Color</label><input type="color" id="cloth-color" value="#888888"></div>
      <div style="display:flex;gap:4px;margin-top:5px">
        <button class="btn" id="cloth-save-btn" style="flex:1;padding:3px">Save</button>
        <button class="btn" id="cloth-cancel-btn" style="flex:1;padding:3px">Cancel</button>
        <button class="btn" id="cloth-delete-btn" style="padding:3px 6px;color:#f38ba8;border-color:#f38ba8;display:none">✕</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 3: Move Direction + Face/Hair cards into col 3**

Col 3 currently ends after the Animation card (closing `</div>` around line 235). Add these two cards **after** the Animation card's closing `</div>`, before the col 3 closing `</div>`:

```html
    <div class="card">
      <div class="lbl">Direction</div>
      <div class="dir-grid">
        <button class="btn dbtn" data-a="2.36">↖BL</button>
        <button class="btn dbtn" data-a="3.14">↑Back</button>
        <button class="btn dbtn" data-a="-2.36">↗BR</button>
        <button class="btn dbtn" data-a="1.57">←L</button>
        <button class="btn dbtn on" data-a="0.01">●Fwd</button>
        <button class="btn dbtn" data-a="-1.57">→R</button>
        <button class="btn dbtn" data-a="0.79">↙FL</button>
        <button class="btn dbtn" data-a="0.0">↓Fwd</button>
        <button class="btn dbtn" data-a="-0.79">↘FR</button>
      </div>
    </div>
    <div class="card">
      <div class="lbl">Face</div>
      <div class="lbl" style="margin-top:3px">Eyes</div><div class="preset-row" id="eye-presets"></div>
      <div class="lbl">Brows</div><div class="preset-row" id="brow-presets"></div>
      <div class="lbl">Mouth</div><div class="preset-row" id="mouth-presets"></div>
      <div class="lbl">Nose</div><div class="preset-row" id="nose-presets"></div>
      <div class="lbl" style="margin-top:3px">Hair</div><div class="preset-row" id="hair-presets"></div>
    </div>
```

- [ ] **Step 4: Verify layout in browser**

Open `http://localhost:5173`. Confirm:
- Col 4 shows two tab buttons (Bone / Layers) and empty panels below
- Col 3 now has Direction grid and Face/Hair preset rows
- No JS errors in console

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: install layer panel shell in col 4, relocate direction/face/hair to col 3"
```

---

### Task 3: Pure data extraction functions + tests

Create `src/ui/layerPanel.js` with the data-mapping logic. These functions are pure (no DOM, no Three.js imports) and can be unit tested with duck-typed objects.

**Files:**
- Create: `src/ui/layerPanel.js`
- Create: `tests/layerPanel.test.js`

**Interfaces:**
- Produces: `export function getMeshSkKey(mesh, SK, root)` → `string | null`
- Produces: `export function buildBoneGroupData(bodyV, clothV, SK, root)` → `Map<skKey, {label, rows[]}>`
- Produces: `export function buildLayerGroupData(bodyV, clothV, WDEFS, customWardrobe, equipped)` → `{bodyRows, clothingRows, customRows}`

- [ ] **Step 1: Create `src/ui/layerPanel.js` with constants and pure functions**

```js
import * as THREE from 'three';
import { SK, root, bodyV, clothV } from '../character/skeleton.js';
import { savedParts } from '../character/parts.js';
import { WDEFS, equipped } from '../character/clothing.js';
import { customWardrobe } from '../character/wardrobe.js';

export const SK_ORDER = ['head','torso','lArm','lElbow','rArm','rElbow','lLeg','lKnee','rLeg','rKnee'];

export const SK_LABELS = {
  head: 'Head', torso: 'Torso',
  lArm: 'L Shoulder', lElbow: 'L Elbow',
  rArm: 'R Shoulder', rElbow: 'R Elbow',
  lLeg: 'L Hip',      lKnee:  'L Knee',
  rLeg: 'R Hip',      rKnee:  'R Knee',
};

const PART_LABELS = {
  head: 'Head', torso: 'Torso', pelvis: 'Pelvis',
  lUpperArm: 'L Upper Arm', lLowerArm: 'L Lower Arm', lHand: 'L Hand',
  rUpperArm: 'R Upper Arm', rLowerArm: 'R Lower Arm', rHand: 'R Hand',
  lUpperLeg: 'L Upper Leg', lLowerLeg: 'L Lower Leg', lFoot: 'L Foot',
  rUpperLeg: 'R Upper Leg', rLowerLeg: 'R Lower Leg', rFoot: 'R Foot',
};

const PART_TO_SK = {
  head: 'head', pelvis: 'torso', torso: 'torso',
  lUpperArm: 'lArm',  lLowerArm: 'lElbow', lHand: 'lElbow',
  rUpperArm: 'rArm',  rLowerArm: 'rElbow', rHand: 'rElbow',
  lUpperLeg: 'lLeg',  lLowerLeg: 'lKnee',  lFoot: 'lKnee',
  rUpperLeg: 'rLeg',  rLowerLeg: 'rKnee',  rFoot: 'rKnee',
};

// Walk parent chain to find which SK group key a mesh belongs to.
// Custom blocks carry skAncestor directly. Shirt-torso cloth is parented to
// root (not SK.torso), so root maps to 'torso' as a special case.
export function getMeshSkKey(mesh, SK, root) {
  if (mesh.userData.skAncestor) return mesh.userData.skAncestor;
  let obj = mesh.parent;
  while (obj) {
    if (obj === root) return 'torso';
    const entry = Object.entries(SK).find(([, g]) => g === obj);
    if (entry) return entry[0];
    obj = obj.parent;
  }
  return null;
}

// Returns Map<skKey, {label, rows}> where each row is
// {id, label, type:'body'|'cloth'|'custom', meshes:[], draggable:bool}
export function buildBoneGroupData(bodyV, clothV, SK, root) {
  const groups = new Map(SK_ORDER.map(k => [k, { label: SK_LABELS[k], rows: [] }]));

  // Body voxels — aggregate by part name
  const byPart = new Map();
  bodyV.filter(m => m.userData.part !== 'custom').forEach(m => {
    const p = m.userData.part;
    if (!byPart.has(p)) byPart.set(p, []);
    byPart.get(p).push(m);
  });
  byPart.forEach((meshes, part) => {
    const sk = PART_TO_SK[part];
    if (sk && groups.has(sk)) {
      groups.get(sk).rows.push({ id: `body-${part}`, label: PART_LABELS[part] || part, type: 'body', meshes, draggable: false });
    }
  });

  // Cloth voxels — aggregate by piece+skKey
  const byCloth = new Map();
  clothV.forEach(m => {
    const piece = m.userData.clothPiece || '?';
    const sk = getMeshSkKey(m, SK, root);
    if (!sk) return;
    const key = `${piece}::${sk}`;
    if (!byCloth.has(key)) byCloth.set(key, { piece, sk, meshes: [] });
    byCloth.get(key).meshes.push(m);
  });
  byCloth.forEach(({ piece, sk, meshes }) => {
    if (!groups.has(sk)) return;
    const label = `${piece[0].toUpperCase()}${piece.slice(1)} · ${SK_LABELS[sk] || sk}`;
    groups.get(sk).rows.push({ id: `cloth-${piece}-${sk}`, label, type: 'cloth', meshes, draggable: false });
  });

  // Custom blocks — one row each
  let ci = 0;
  bodyV.filter(m => m.userData.part === 'custom').forEach(m => {
    const sk = m.userData.skAncestor;
    if (!groups.has(sk)) return;
    groups.get(sk).rows.push({ id: `custom-${ci}`, label: `Custom #${ci + 1}`, type: 'custom', meshes: [m], draggable: true });
    ci++;
  });

  return groups;
}

// Returns {bodyRows, clothingRows, customRows} for the Layers tab.
export function buildLayerGroupData(bodyV, clothV, WDEFS, customWardrobe, equipped) {
  // Body rows — one per unique part
  const byPart = new Map();
  bodyV.filter(m => m.userData.part !== 'custom').forEach(m => {
    const p = m.userData.part;
    if (!byPart.has(p)) byPart.set(p, []);
    byPart.get(p).push(m);
  });
  const bodyRows = [...byPart.entries()].map(([part, meshes]) => ({
    id: `body-${part}`, label: PART_LABELS[part] || part, type: 'body', meshes,
  }));

  // Cloth voxels keyed by piece
  const clothByPiece = new Map();
  clothV.forEach(m => {
    const p = m.userData.clothPiece || '?';
    if (!clothByPiece.has(p)) clothByPiece.set(p, []);
    clothByPiece.get(p).push(m);
  });

  // All available clothing pieces (equipped + unequipped)
  const allPieces = { ...WDEFS, ...customWardrobe };
  const clothingRows = Object.entries(allPieces).map(([key, def]) => ({
    id: `cloth-${key}`, label: def.label, type: 'cloth',
    clothKey: key, slot: def.slot,
    isEquipped: equipped[def.slot] === key,
    meshes: clothByPiece.get(key) || [],
  }));

  // Custom rows
  let ci = 0;
  const customRows = bodyV
    .filter(m => m.userData.part === 'custom')
    .map(m => ({ id: `custom-${ci}`, label: `Custom #${++ci}`, type: 'custom', meshes: [m] }));

  return { bodyRows, clothingRows, customRows };
}
```

- [ ] **Step 2: Write tests**

Create `tests/layerPanel.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getMeshSkKey, buildBoneGroupData, buildLayerGroupData } from '../src/ui/layerPanel.js';

const mkGroup = () => ({ _type: 'Group' });
const mkParentChain = (...chain) => {
  // chain[0] is the mesh's direct parent, chain[n-1] is the root
  for (let i = 0; i < chain.length - 1; i++) chain[i].parent = chain[i + 1];
  chain[chain.length - 1].parent = null;
  return chain;
};

describe('getMeshSkKey', () => {
  it('returns skAncestor directly for custom blocks', () => {
    const mesh = { userData: { part: 'custom', skAncestor: 'lArm' }, parent: null };
    expect(getMeshSkKey(mesh, {}, null)).toBe('lArm');
  });

  it('walks parent chain to find SK group', () => {
    const skGroup = mkGroup();
    const voxGroup = mkGroup();
    mkParentChain(voxGroup, skGroup);
    const mesh = { userData: { part: 'torso' }, parent: voxGroup };
    const SK = { torso: skGroup };
    expect(getMeshSkKey(mesh, SK, null)).toBe('torso');
  });

  it('returns "torso" for meshes whose parent chain reaches root', () => {
    const root = mkGroup();
    const clothGroup = mkGroup();
    mkParentChain(clothGroup, root);
    const mesh = { userData: { isCloth: true }, parent: clothGroup };
    expect(getMeshSkKey(mesh, {}, root)).toBe('torso');
  });

  it('returns null when no SK group found and root is null', () => {
    const mesh = { userData: { part: 'unknown' }, parent: null };
    expect(getMeshSkKey(mesh, {}, null)).toBeNull();
  });
});

describe('buildBoneGroupData', () => {
  const SK = Object.fromEntries(['head','torso','lArm','lElbow','rArm','rElbow','lLeg','lKnee','rLeg','rKnee'].map(k => [k, mkGroup()]));
  const ROOT = mkGroup();

  it('creates all 10 bone groups', () => {
    const groups = buildBoneGroupData([], [], SK, ROOT);
    expect(groups.size).toBe(10);
  });

  it('places body voxel under correct bone group (torso part → torso group)', () => {
    const vg = mkGroup(); mkParentChain(vg, SK.torso);
    const m = { userData: { part: 'torso' }, parent: vg };
    const groups = buildBoneGroupData([m], [], SK, ROOT);
    expect(groups.get('torso').rows).toHaveLength(1);
    expect(groups.get('torso').rows[0].type).toBe('body');
    expect(groups.get('torso').rows[0].draggable).toBe(false);
  });

  it('aggregates multiple voxels with the same part into one row', () => {
    const vg = mkGroup(); mkParentChain(vg, SK.head);
    const m1 = { userData: { part: 'head' }, parent: vg };
    const m2 = { userData: { part: 'head' }, parent: vg };
    const groups = buildBoneGroupData([m1, m2], [], SK, ROOT);
    expect(groups.get('head').rows).toHaveLength(1);
    expect(groups.get('head').rows[0].meshes).toHaveLength(2);
  });

  it('places custom block under its skAncestor, marks draggable', () => {
    const m = { userData: { part: 'custom', skAncestor: 'lArm' }, parent: null };
    const groups = buildBoneGroupData([m], [], SK, ROOT);
    expect(groups.get('lArm').rows).toHaveLength(1);
    expect(groups.get('lArm').rows[0].draggable).toBe(true);
    expect(groups.get('lArm').rows[0].label).toBe('Custom #1');
  });

  it('places shirt-torso cloth under torso (root parent → torso)', () => {
    const cg = mkGroup(); mkParentChain(cg, ROOT);
    const m = { userData: { isCloth: true, clothPiece: 'shirt' }, parent: cg };
    const groups = buildBoneGroupData([], [m], SK, ROOT);
    expect(groups.get('torso').rows).toHaveLength(1);
    expect(groups.get('torso').rows[0].type).toBe('cloth');
  });
});

describe('buildLayerGroupData', () => {
  const WDEFS_MOCK = {
    shirt: { label: 'Shirt', slot: 'top', style: 'shirt' },
    pants: { label: 'Pants', slot: 'legs', style: 'pants' },
  };

  it('returns empty sections when no meshes or clothing', () => {
    const { bodyRows, clothingRows, customRows } = buildLayerGroupData([], [], WDEFS_MOCK, {}, {});
    expect(bodyRows).toHaveLength(0);
    expect(clothingRows).toHaveLength(2); // all pieces listed, even unequipped
    expect(customRows).toHaveLength(0);
  });

  it('marks equipped clothing correctly', () => {
    const { clothingRows } = buildLayerGroupData([], [], WDEFS_MOCK, {}, { top: 'shirt' });
    const shirt = clothingRows.find(r => r.clothKey === 'shirt');
    const pants = clothingRows.find(r => r.clothKey === 'pants');
    expect(shirt.isEquipped).toBe(true);
    expect(pants.isEquipped).toBe(false);
  });

  it('provides meshes for equipped clothing rows', () => {
    const m = { userData: { isCloth: true, clothPiece: 'shirt' } };
    const { clothingRows } = buildLayerGroupData([], [m], WDEFS_MOCK, {}, { top: 'shirt' });
    const shirt = clothingRows.find(r => r.clothKey === 'shirt');
    expect(shirt.meshes).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests — expect failures (functions not yet wired to imports)**

```bash
$HOME/.nvm/versions/node/v22.21.0/bin/npm test -- tests/layerPanel.test.js
```

Expected: tests fail because the module imports Three.js and character modules (which require a browser environment). That's expected — the pure functions work but vitest can't resolve the Three.js imports at the top of the file.

- [ ] **Step 4: Separate pure functions so they can be tested without browser imports**

Move only the pure functions and constants into a separate file that has no imports:

Create `src/ui/layerPanelData.js`:

```js
export const SK_ORDER = ['head','torso','lArm','lElbow','rArm','rElbow','lLeg','lKnee','rLeg','rKnee'];

export const SK_LABELS = {
  head: 'Head', torso: 'Torso',
  lArm: 'L Shoulder', lElbow: 'L Elbow',
  rArm: 'R Shoulder', rElbow: 'R Elbow',
  lLeg: 'L Hip',      lKnee:  'L Knee',
  rLeg: 'R Hip',      rKnee:  'R Knee',
};

const PART_LABELS = {
  head: 'Head', torso: 'Torso', pelvis: 'Pelvis',
  lUpperArm: 'L Upper Arm', lLowerArm: 'L Lower Arm', lHand: 'L Hand',
  rUpperArm: 'R Upper Arm', rLowerArm: 'R Lower Arm', rHand: 'R Hand',
  lUpperLeg: 'L Upper Leg', lLowerLeg: 'L Lower Leg', lFoot: 'L Foot',
  rUpperLeg: 'R Upper Leg', rLowerLeg: 'R Lower Leg', rFoot: 'R Foot',
};

const PART_TO_SK = {
  head: 'head', pelvis: 'torso', torso: 'torso',
  lUpperArm: 'lArm',  lLowerArm: 'lElbow', lHand: 'lElbow',
  rUpperArm: 'rArm',  rLowerArm: 'rElbow', rHand: 'rElbow',
  lUpperLeg: 'lLeg',  lLowerLeg: 'lKnee',  lFoot: 'lKnee',
  rUpperLeg: 'rLeg',  rLowerLeg: 'rKnee',  rFoot: 'rKnee',
};

export function getMeshSkKey(mesh, SK, root) {
  if (mesh.userData.skAncestor) return mesh.userData.skAncestor;
  let obj = mesh.parent;
  while (obj) {
    if (obj === root) return 'torso';
    const entry = Object.entries(SK).find(([, g]) => g === obj);
    if (entry) return entry[0];
    obj = obj.parent;
  }
  return null;
}

export function buildBoneGroupData(bodyV, clothV, SK, root) {
  const groups = new Map(SK_ORDER.map(k => [k, { label: SK_LABELS[k], rows: [] }]));

  const byPart = new Map();
  bodyV.filter(m => m.userData.part !== 'custom').forEach(m => {
    const p = m.userData.part;
    if (!byPart.has(p)) byPart.set(p, []);
    byPart.get(p).push(m);
  });
  byPart.forEach((meshes, part) => {
    const sk = PART_TO_SK[part];
    if (sk && groups.has(sk)) {
      groups.get(sk).rows.push({ id: `body-${part}`, label: PART_LABELS[part] || part, type: 'body', meshes, draggable: false });
    }
  });

  const byCloth = new Map();
  clothV.forEach(m => {
    const piece = m.userData.clothPiece || '?';
    const sk = getMeshSkKey(m, SK, root);
    if (!sk) return;
    const key = `${piece}::${sk}`;
    if (!byCloth.has(key)) byCloth.set(key, { piece, sk, meshes: [] });
    byCloth.get(key).meshes.push(m);
  });
  byCloth.forEach(({ piece, sk, meshes }) => {
    if (!groups.has(sk)) return;
    const label = `${piece[0].toUpperCase()}${piece.slice(1)} · ${SK_LABELS[sk] || sk}`;
    groups.get(sk).rows.push({ id: `cloth-${piece}-${sk}`, label, type: 'cloth', meshes, draggable: false });
  });

  let ci = 0;
  bodyV.filter(m => m.userData.part === 'custom').forEach(m => {
    const sk = m.userData.skAncestor;
    if (!groups.has(sk)) return;
    groups.get(sk).rows.push({ id: `custom-${ci}`, label: `Custom #${ci + 1}`, type: 'custom', meshes: [m], draggable: true });
    ci++;
  });

  return groups;
}

export function buildLayerGroupData(bodyV, clothV, WDEFS, customWardrobe, equipped) {
  const byPart = new Map();
  bodyV.filter(m => m.userData.part !== 'custom').forEach(m => {
    const p = m.userData.part;
    if (!byPart.has(p)) byPart.set(p, []);
    byPart.get(p).push(m);
  });
  const bodyRows = [...byPart.entries()].map(([part, meshes]) => ({
    id: `body-${part}`, label: PART_LABELS[part] || part, type: 'body', meshes,
  }));

  const clothByPiece = new Map();
  clothV.forEach(m => {
    const p = m.userData.clothPiece || '?';
    if (!clothByPiece.has(p)) clothByPiece.set(p, []);
    clothByPiece.get(p).push(m);
  });

  const allPieces = { ...WDEFS, ...customWardrobe };
  const clothingRows = Object.entries(allPieces).map(([key, def]) => ({
    id: `cloth-${key}`, label: def.label, type: 'cloth',
    clothKey: key, slot: def.slot,
    isEquipped: equipped[def.slot] === key,
    meshes: clothByPiece.get(key) || [],
  }));

  let ci = 0;
  const customRows = bodyV
    .filter(m => m.userData.part === 'custom')
    .map(m => ({ id: `custom-${ci}`, label: `Custom #${++ci}`, type: 'custom', meshes: [m] }));

  return { bodyRows, clothingRows, customRows };
}
```

Update the test file to import from `layerPanelData.js` instead:

```js
// tests/layerPanel.test.js — change import line to:
import { getMeshSkKey, buildBoneGroupData, buildLayerGroupData } from '../src/ui/layerPanelData.js';
```

Now `src/ui/layerPanel.js` will import from `layerPanelData.js` and add the Three.js/DOM logic on top.

- [ ] **Step 5: Run tests — expect pass**

```bash
$HOME/.nvm/versions/node/v22.21.0/bin/npm test -- tests/layerPanel.test.js
```

Expected output:
```
✓ getMeshSkKey > returns skAncestor directly for custom blocks
✓ getMeshSkKey > walks parent chain to find SK group
✓ getMeshSkKey > returns "torso" for meshes whose parent chain reaches root
✓ getMeshSkKey > returns null when no SK group found and root is null
✓ buildBoneGroupData > creates all 10 bone groups
✓ buildBoneGroupData > places body voxel under correct bone group (torso part → torso group)
✓ buildBoneGroupData > aggregates multiple voxels with the same part into one row
✓ buildBoneGroupData > places custom block under its skAncestor, marks draggable
✓ buildBoneGroupData > places shirt-torso cloth under torso (root parent → torso)
✓ buildLayerGroupData > returns empty sections when no meshes or clothing
✓ buildLayerGroupData > marks equipped clothing correctly
✓ buildLayerGroupData > provides meshes for equipped clothing rows
Test Files: 1 passed (1)
Tests: 12 passed (12)
```

- [ ] **Step 6: Run all tests to confirm no regressions**

```bash
$HOME/.nvm/versions/node/v22.21.0/bin/npm test
```

Expected: all 32 tests pass (20 original + 12 new).

- [ ] **Step 7: Commit**

```bash
git add src/ui/layerPanelData.js src/ui/layerPanel.js tests/layerPanel.test.js
git commit -m "feat: add layer panel data extraction functions with 12 tests"
```

---

### Task 4: Panel DOM render + tab switching

Build the DOM rendering in `layerPanel.js` and wire `init()` / `refresh()` into the app. Read-only at this stage — no eye toggles or drag yet.

**Files:**
- Modify: `src/ui/layerPanel.js` (replace with full implementation shell)
- Modify: `src/ui/controls.js`

**Interfaces:**
- Consumes: `buildBoneGroupData`, `buildLayerGroupData` from `layerPanelData.js`
- Produces: `export function init()` — mounts the panel
- Produces: `export function refresh()` — rebuilds DOM from current state

- [ ] **Step 1: Write `src/ui/layerPanel.js`**

```js
import { SK, root, bodyV, clothV } from '../character/skeleton.js';
import { WDEFS, equipped } from '../character/clothing.js';
import { customWardrobe } from '../character/wardrobe.js';
import { SK_ORDER, SK_LABELS, buildBoneGroupData, buildLayerGroupData } from './layerPanelData.js';

const _boneView  = document.getElementById('lp-bone-view');
const _layerView = document.getElementById('lp-layer-view');
const _tabBone   = document.getElementById('lp-tab-bone');
const _tabLayers = document.getElementById('lp-tab-layers');

_tabBone.addEventListener('click',   () => { _tabBone.classList.add('on');   _tabLayers.classList.remove('on'); _boneView.style.display = '';     _layerView.style.display = 'none'; });
_tabLayers.addEventListener('click', () => { _tabLayers.classList.add('on'); _tabBone.classList.remove('on');   _layerView.style.display = '';    _boneView.style.display = 'none'; });

// ── Collapse state ────────────────────────────────────────────────────────────
const _collapsed = new Set();  // set of group ids that are collapsed

function _toggle(id) {
  if (_collapsed.has(id)) _collapsed.delete(id);
  else _collapsed.add(id);
}

// ── DOM builders ──────────────────────────────────────────────────────────────
function _makeEye(id, meshes) {
  const span = document.createElement('span');
  span.className = 'lp-eye';
  span.textContent = '👁';
  span.dataset.eyeId = id;
  return span;
}

function _makeRow(row) {
  const div = document.createElement('div');
  div.className = 'lp-row' + (row.type === 'cloth' ? ' lp-cloth-row' : '');
  if (row.draggable) div.draggable = true;
  div.dataset.rowId = row.id;
  div.appendChild(_makeEye(row.id, row.meshes));
  const lbl = document.createElement('span');
  lbl.className = 'lp-label';
  lbl.textContent = row.label;
  div.appendChild(lbl);
  return div;
}

function _makeGroupSection(id, label, rows) {
  const section = document.createElement('div');
  section.className = 'lp-group';
  section.dataset.groupId = id;

  const header = document.createElement('div');
  header.className = 'lp-header';
  header.dataset.groupId = id;
  const toggle = document.createElement('span');
  toggle.className = 'lp-toggle';
  toggle.textContent = _collapsed.has(id) ? '▶' : '▼';
  const eye = _makeEye('group-' + id, rows.flatMap(r => r.meshes));
  eye.dataset.groupEye = id;
  const lbl = document.createElement('span');
  lbl.className = 'lp-label';
  lbl.style.fontWeight = '600';
  lbl.textContent = label;
  header.appendChild(toggle);
  header.appendChild(eye);
  header.appendChild(lbl);
  section.appendChild(header);

  const children = document.createElement('div');
  children.className = 'lp-group-children';
  children.style.display = _collapsed.has(id) ? 'none' : '';
  rows.forEach(row => children.appendChild(_makeRow(row)));
  section.appendChild(children);

  header.addEventListener('click', e => {
    if (e.target.classList.contains('lp-eye')) return; // eye handled separately
    _toggle(id);
    toggle.textContent = _collapsed.has(id) ? '▶' : '▼';
    children.style.display = _collapsed.has(id) ? 'none' : '';
  });

  return section;
}

// ── Render ────────────────────────────────────────────────────────────────────
function _renderBoneView() {
  _boneView.innerHTML = '';
  const groups = buildBoneGroupData(bodyV, clothV, SK, root);
  groups.forEach((group, skKey) => {
    if (group.rows.length === 0 && !_collapsed.has(skKey)) _collapsed.add(skKey); // auto-collapse empty groups once
    _boneView.appendChild(_makeGroupSection(skKey, group.label, group.rows));
  });
}

function _renderLayerView() {
  _layerView.innerHTML = '';
  const { bodyRows, clothingRows, customRows } = buildLayerGroupData(bodyV, clothV, WDEFS, customWardrobe, equipped);

  if (bodyRows.length)    _layerView.appendChild(_makeGroupSection('cat-body',    'Body',     bodyRows));
  if (clothingRows.length) _layerView.appendChild(_makeGroupSection('cat-cloth',  'Clothing', clothingRows));
  if (customRows.length)  _layerView.appendChild(_makeGroupSection('cat-custom',  'Custom',   customRows));
}

// ── Public API ────────────────────────────────────────────────────────────────
export function refresh() {
  _renderBoneView();
  _renderLayerView();
}

export function init() {
  refresh();
}
```

- [ ] **Step 2: Wire `init` and `refresh` into `controls.js`**

At the top of `src/ui/controls.js`, add the import:

```js
import { init as lpInit, refresh as lpRefresh } from './layerPanel.js';
```

At the very bottom of `controls.js`, add:

```js
lpInit();
```

Also call `lpRefresh()` after every `rebuild()` call. Find the body-shape slider handler and the new-char button handler — both call `rebuild()`. Update them:

```js
// Body shape sliders (around line 250 in controls.js):
document.querySelectorAll('[data-s]').forEach(el => {
  el.addEventListener('input', () => {
    state.S[el.dataset.s] = parseFloat(el.value);
    rebuild(); resetPose(SK, root); captureDefaults();
    if (state.mode === 'sculpt' && state.sculptTool === 'add') showGrid(getDims());
    lpRefresh();
  });
});

// new-char-btn handler:
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
  lpRefresh();
});
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173`. Confirm:
- Bone tab shows 10 groups; groups with content are expanded, empty ones collapsed
- Layers tab shows Body / Clothing / Custom sections
- Tab buttons switch between views
- No console errors

- [ ] **Step 4: Commit**

```bash
git add src/ui/layerPanel.js src/ui/layerPanelData.js src/ui/controls.js
git commit -m "feat: render layer panel bone and layer views, wire init/refresh"
```

---

### Task 5: Eye toggles

Clicking the eye icon hides/shows meshes. Header eye cascades to all children.

**Files:**
- Modify: `src/ui/layerPanel.js`

**Interfaces:**
- Consumes: `row.meshes` — array of Three.js Mesh objects with `.visible` property

- [ ] **Step 1: Add visibility state tracking and toggle logic to `layerPanel.js`**

Add a `Map` to track which row IDs are hidden, and a `_setVisible` helper. Add this block after the `_collapsed` declaration:

```js
const _hidden = new Set();  // set of row ids that are hidden

function _setRowVisible(rowId, visible, meshes) {
  if (visible) _hidden.delete(rowId);
  else _hidden.add(rowId);
  meshes.forEach(m => { m.visible = visible; });
}
```

- [ ] **Step 2: Wire eye click handlers in `_makeEye`**

Replace the `_makeEye` function with:

```js
function _makeEye(id, meshes) {
  const span = document.createElement('span');
  span.className = 'lp-eye' + (_hidden.has(id) ? ' lp-hidden' : '');
  span.textContent = '👁';
  span.dataset.eyeId = id;
  span.addEventListener('click', e => {
    e.stopPropagation();
    const nowVisible = _hidden.has(id);
    _setRowVisible(id, nowVisible, meshes);
    span.classList.toggle('lp-hidden', !nowVisible);
  });
  return span;
}
```

- [ ] **Step 3: Cascade group eye to children**

Replace the `_makeGroupSection` function's eye creation to cascade to all child rows. Find the line `const eye = _makeEye('group-' + id, rows.flatMap(r => r.meshes));` and replace with:

```js
const groupEyeId = 'group-' + id;
const allMeshes = rows.flatMap(r => r.meshes);
const eye = document.createElement('span');
eye.className = 'lp-eye' + (_hidden.has(groupEyeId) ? ' lp-hidden' : '');
eye.textContent = '👁';
eye.addEventListener('click', e => {
  e.stopPropagation();
  const nowVisible = _hidden.has(groupEyeId);
  _setRowVisible(groupEyeId, nowVisible, allMeshes);
  eye.classList.toggle('lp-hidden', !nowVisible);
  // cascade: update child eye icons in the DOM
  children.querySelectorAll('.lp-eye').forEach(childEye => {
    const childId = childEye.dataset.eyeId;
    if (childId) {
      if (nowVisible) _hidden.delete(childId);
      else _hidden.add(childId);
      childEye.classList.toggle('lp-hidden', !nowVisible);
    }
  });
  // apply visibility to all child meshes individually
  rows.forEach(row => {
    if (nowVisible) _hidden.delete(row.id);
    else _hidden.add(row.id);
    row.meshes.forEach(m => { m.visible = nowVisible; });
  });
});
```

Note: `children` is the `lp-group-children` div, declared just after this block. Move the `const children = ...` declaration before the eye creation.

- [ ] **Step 4: Verify in browser**

Open `http://localhost:5173`. In Bone View:
- Click a child eye — that row's meshes disappear from the 3D viewport
- Click the group header eye — all children disappear; all child eyes dim
- Click header eye again — all children reappear; eyes un-dim
- Eye state persists when switching tabs and back

- [ ] **Step 5: Commit**

```bash
git add src/ui/layerPanel.js
git commit -m "feat: add eye visibility toggles with group cascade in layer panel"
```

---

### Task 6: Clothing equip/unequip in Layer View

Clicking a clothing row in the Layers tab equips or unequips the piece.

**Files:**
- Modify: `src/ui/layerPanel.js`
- Modify: `src/ui/controls.js`

**Interfaces:**
- Produces: `document` custom event `layer-cloth-equip` with `{detail: {clothKey}}`
- Consumes: `controls.js` handles the event, calls `rebuildCloth`, calls `lpRefresh()`

- [ ] **Step 1: Add click handler on clothing rows in `_makeRow`**

In the `_makeRow` function, after creating `div`, add:

```js
if (row.type === 'cloth') {
  div.classList.add(row.isEquipped ? 'lp-equipped' : 'lp-unequipped');
  div.style.cursor = 'pointer';
  div.addEventListener('click', e => {
    if (e.target.classList.contains('lp-eye')) return;
    document.dispatchEvent(new CustomEvent('layer-cloth-equip', { detail: { clothKey: row.clothKey } }));
  });
}
```

- [ ] **Step 2: Handle the event in `controls.js`**

Remove the old `buildWardrobeGrid` function call and the `wgrid` element references. Add this event listener near the bottom of `controls.js` (before `lpInit()`):

```js
document.addEventListener('layer-cloth-equip', e => {
  const { clothKey } = e.detail;
  const def = WDEFS[clothKey] || customWardrobe[clothKey];
  if (!def) return;
  if (equipped[def.slot] === clothKey) delete equipped[def.slot];
  else equipped[def.slot] = clothKey;
  rebuildCloth(SK, root, clothV, getDims);
  lpRefresh();
});
```

Also remove (or comment out) the old wardrobe grid building call: find `buildWardrobeGrid();` near the end of `controls.js` and delete it.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173`. Switch to Layers tab:
- Unequipped rows appear dimmed
- Click "Shirt" → shirt appears on the character, row highlights green
- Click "Shirt" again → shirt disappears, row dims again
- Eye toggle on a clothing row hides/shows the equipped piece
- No console errors

- [ ] **Step 4: Commit**

```bash
git add src/ui/layerPanel.js src/ui/controls.js
git commit -m "feat: clothing equip/unequip from layer panel via custom event"
```

---

### Task 7: Drag-and-drop bone reassignment in Bone View

Dragging a custom block row to a different bone group header reassigns it.

**Files:**
- Modify: `src/ui/layerPanel.js`
- Modify: `src/ui/controls.js`

**Interfaces:**
- Produces: `document` custom event `layer-bone-reassign` with `{detail: {mesh, newSkKey}}`
- Consumes: `controls.js` handles the event, calls `reassignBone(mesh, newSkKey)`, calls `lpRefresh()`

- [ ] **Step 1: Add dragstart on draggable rows in `_makeRow`**

In `_makeRow`, after `if (row.draggable) div.draggable = true;`, add:

```js
if (row.draggable) {
  div.addEventListener('dragstart', e => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.id);
    div.classList.add('lp-dragging');
    // Store mesh ref on the event target for the drop handler
    _dragMesh = row.meshes[0];
    _dragRowEl = div;
  });
  div.addEventListener('dragend', () => {
    div.classList.remove('lp-dragging');
    _dragMesh = null;
    _dragRowEl = null;
  });
}
```

Add these module-level variables near the top of `layerPanel.js` (after `_hidden`):

```js
let _dragMesh = null;
let _dragRowEl = null;
```

- [ ] **Step 2: Add dragover and drop handlers on bone group headers**

In `_makeGroupSection`, after creating `header`, add:

```js
header.addEventListener('dragover', e => {
  if (!_dragMesh) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  header.classList.add('drag-over');
});
header.addEventListener('dragleave', () => {
  header.classList.remove('drag-over');
});
header.addEventListener('drop', e => {
  e.preventDefault();
  header.classList.remove('drag-over');
  if (!_dragMesh) return;
  document.dispatchEvent(new CustomEvent('layer-bone-reassign', { detail: { mesh: _dragMesh, newSkKey: id } }));
});
```

- [ ] **Step 3: Handle `layer-bone-reassign` event in `controls.js`**

Add this listener near the `layer-cloth-equip` handler:

```js
document.addEventListener('layer-bone-reassign', e => {
  const { mesh, newSkKey } = e.detail;
  reassignBone(mesh, newSkKey);
  lpRefresh();
});
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:5173`. Enter Sculpt mode, place 2–3 custom blocks on the character. Switch to Bone view in the layer panel:
- Custom block rows show a grab cursor
- Drag a custom block row onto a different bone group header — header highlights blue on hover
- Drop it — the block jumps to the new bone in the 3D viewport, row moves to the new group in the tree
- Undo (Cmd+Z) — block returns to original bone, panel updates

- [ ] **Step 5: Run all tests**

```bash
$HOME/.nvm/versions/node/v22.21.0/bin/npm test
```

Expected: all 32 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/layerPanel.js src/ui/controls.js
git commit -m "feat: drag-and-drop bone reassignment in layer panel bone view"
```

---

### Task 8: Wire refresh to all remaining mutation points

`refresh()` must be called after every operation that changes `bodyV`, `clothV`, or `savedParts`: undo/redo, sculpt add/remove, bone reassign button, reset-part, rebuild triggered from other paths.

**Files:**
- Modify: `src/ui/controls.js`

- [ ] **Step 1: Add `lpRefresh()` to undo/redo keyboard shortcuts**

Find the existing keyboard handler and update it:

```js
window.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); lpRefresh(); }
  if (mod && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) { e.preventDefault(); doRedo(); lpRefresh(); }
});
```

- [ ] **Step 2: Add `lpRefresh()` to undo/redo buttons**

```js
document.getElementById('undo-btn').addEventListener('click', () => { doUndo(); lpRefresh(); });
document.getElementById('redo-btn').addEventListener('click', () => { doRedo(); lpRefresh(); });
```

- [ ] **Step 3: Add `lpRefresh()` after block placement and removal**

In `placeCustomBlock`, at the end of the function body (after `pushUndo(...)`):

```js
lpRefresh();
```

In `removeCustomBlock`, at the end of the function body (after `pushUndo(...)`):

```js
lpRefresh();
```

- [ ] **Step 4: Add `lpRefresh()` after save-part and reset-part**

Find the save-part button handler:

```js
document.getElementById('save-part-btn').addEventListener('click', () => {
  // ... existing code ...
  savePart(selectedEditPart, data);
  updatePartUI();
  lpRefresh(); // add this
});
```

Find the reset-part button handler:

```js
document.getElementById('reset-part-btn').addEventListener('click', () => {
  // ... existing code ...
  rebuild(); resetPose(SK, root); captureDefaults();
  updatePartUI();
  lpRefresh(); // add this
});
```

- [ ] **Step 5: Final verification in browser**

Open `http://localhost:5173`. Run through the full workflow:
1. Start with default character — Bone view shows all body parts grouped correctly
2. Equip a coat — Layers view clothing updates; Bone view gains coat rows on arm groups
3. Place custom blocks — appear in Bone view under correct bone
4. Drag a custom block to a new bone — moves in both 3D view and panel
5. Undo/redo — panel stays in sync
6. Toggle eye on a bone group — character part disappears from 3D view
7. Switch between Bone and Layers tabs — eye state persists

- [ ] **Step 6: Run all tests**

```bash
$HOME/.nvm/versions/node/v22.21.0/bin/npm test
```

Expected: all 32 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui/controls.js
git commit -m "feat: wire lpRefresh to all mutation points — undo, sculpt, part save/reset"
```
