# Block Skinning — Design Spec

**Date:** 2026-06-22  
**Project:** vox-sprite-maker  
**Status:** Approved — ready for implementation planning

---

## Overview

Users start with a bare skeleton and paint voxel blocks onto it. Each placed block is automatically bound ("skinned") to the nearest bone — it becomes a child of that bone's SK group, so it moves with the bone during pose and animation. Both the 3D viewport and the 2D editor support placement. No new mode tab is added; the feature is integrated into the existing sculpt "add" tool.

---

## 1. The Grid

The world already uses integer voxel positions (U=1: 1 world unit = 1 voxel = 1 output pixel). The voxel canvas is defined as:

- **XY bounds**: the character's full bounding box (same as the current rebuild() character volume)
- **Z bounds**: depth D voxels, centered on z=0 where all SK groups sit
- **D**: driven by the existing depth slider in the 2D editor; the 3D grid and 2D editor always share this value

A faint wireframe grid renders the full voxel volume in the 3D view — dim line-boxes outlining each column of cells. The grid is always visible when sculpt "add" mode is active.

---

## 2. Active Z Layer

The grid has an **active Z layer** — a single Z-plane the cursor lives on.

- **Scroll wheel** moves the active layer forward/back through the depth range
- A small **Z indicator** (e.g. `Z: +1`) is shown in the 3D view HUD
- The active layer highlights faintly in the grid so the user can see which slice they're editing
- The layer resets to z=0 when re-entering sculpt mode

---

## 3. Cursor and Placement (3D View)

In sculpt **add** mode, the existing raycast-against-surfaces logic is replaced by grid snapping:

1. Cast the mouse ray into the scene
2. Intersect it with the invisible plane at the active Z layer
3. Round the XY hit to the nearest integer → cursor snaps there
4. Render a **ghost block** (current `state.col`, semi-transparent) at that grid cell
5. Ghost block does not appear on cells that already contain a block

**Left-click**: place a real block at the snapped cell → run bone assignment → add as child of the winning SK group → push to undo stack.

**Right-click**: remove the block at the snapped cell (same as sculpt erase but grid-snapped) → push to undo stack.

No block surfaces are required for placement. The grid is always the target.

---

## 4. Bone Assignment

Runs once per placed block (at placement time, not per-frame). No manual override in this version.

**Algorithm:**

1. Get the block's **world position** (from its SK group + local position)
2. For each segment in `BONE_PAIRS` (the existing list used by the skeleton overlay):
   - Get the two joint world positions A and B
   - Compute the nearest point on segment AB to the block center
   - Measure the Euclidean distance
3. Find the segment with the **minimum distance**
4. On the winning segment, determine which endpoint (A or B) is closer to the block
5. The block is parented to the **SK group of that endpoint**

The block is added as a `THREE.Mesh` child of the winning SK group. Position is stored in the group's local space. Since SK groups transform during animations, the block automatically moves with the bone — no per-frame work needed.

---

## 5. 2D Extrude — Skeleton Sandwiching

The existing 2D editor extrude becomes bone-aware and centers the depth on z=0.

**New layer formula** for depth D:

```
for i in 0..D-1:
  z = floor(D/2) - i
```

| D | Z layers |
|---|----------|
| 1 | 0 |
| 2 | +1, 0 |
| 3 | +1, 0, -1 |
| 4 | +2, +1, 0, -1 |
| 5 | +2, +1, 0, -1, -2 |

No gap at z=0. The skeleton sits inside the solid voxel volume. For odd D the skeleton is exactly centered; for even D it is one layer off-center toward the back.

After extrusion, **bone assignment runs on every placed block** using the same algorithm as 3D placement. Blocks land in the correct SK groups, not in `root`.

---

## 6. Block Data Model

All user-placed blocks (both 3D cursor and 2D extrude) are stored in a new flat array:

```js
savedParts.custom = [
  { x, y, z, color, skAncestor },
  ...
]
```

- `x, y, z`: position in the SK group's **local space**
- `color`: hex string
- `skAncestor`: SK key — any of `head`, `torso`, `lArm`, `lElbow`, `rArm`, `rElbow`, `lLeg`, `lKnee`, `rLeg`, `rKnee`

`rebuild()` reads `savedParts.custom` and adds each block to `SK[entry.skAncestor]`. This is separate from the existing `savedParts.head/torso/arm/leg` entries (face, hair, clothing remain untouched).

Persistence uses the existing `localStorage` `vox_parts` key via `parts.js` — no new storage mechanism needed.

---

## 7. Skeleton-Only Start

A **"New character"** button (added to the existing side panel alongside the skin/reset controls) triggers this flow:

1. Calls `resetPart()` for all existing parts
2. Sets `savedParts._skeletonOnly = true`
3. Calls `rebuild()`

`rebuild()` checks `savedParts._skeletonOnly` before generating any default body blocks. If the flag is set, it skips default block generation entirely and shows only the skeleton bone lines.

Placing the first block (via 3D cursor or 2D extrude) clears the `_skeletonOnly` flag automatically. From that point on, `savedParts.custom` drives what's shown.

---

## 8. What Doesn't Change

- Face decals (eyes, brows, mouth, nose) — untouched, still parented to `SK.head`
- Hair — untouched, still parented to `SK.head`  
- Clothing / wardrobe — untouched, still in `clothV`
- Skin color application — untouched (`applySkin()` walks `bodyV`)
- Pose mode — untouched; joint inspector, sliders, drag all work on SK groups regardless of how blocks got there
- Animation poses (`animPose`) — untouched; they rotate SK groups, blocks follow automatically
- Undo/redo system — placed/removed blocks push to the existing undo stack

---

## Out of Scope (Follow-ups)

- **File save/load**: character files saved to disk, browsable from within the app
- **Manual bone override**: per-block bone reassignment UI
- **Brush size**: cursor placing a NxN block footprint instead of 1×1
