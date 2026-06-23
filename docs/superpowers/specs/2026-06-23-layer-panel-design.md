# Layer Panel Design
**Date:** 2026-06-23  
**Status:** Approved

## Goal

Add a two-tab Layer Panel to the 4th column that gives a structural view of the entire character — all body parts, clothing, and custom blocks organized by bone and by category. Primary value: toggle visibility of any layer during editing, and reassign custom blocks to different bones by drag-and-drop.

## Panel Placement

The 4th column (currently Direction buttons + Face/Hair presets + Wardrobe grid) becomes the Layer Panel.

Displaced controls move to column 3:
- Direction buttons → new card at top of column 3
- Face/hair presets → new collapsible card in column 3
- Wardrobe grid → removed; replaced by Clothing section in Layer View tab

## Two Tabs: Bone | Layers

### Bone View Tab

A tree of the 10 skeleton groups in anatomical order:

```
Head
Torso
L Shoulder
L Elbow
R Shoulder
R Elbow
L Hip
L Knee
R Hip
R Knee
```

Each group is a collapsible section header. Under each header: every mesh parented to that bone group — body voxels, clothing chunks, and custom blocks alike — appears as a named child row.

**Row naming:**
- Body part voxels: part name (e.g. "Head", "Torso")
- Clothing chunks: `<piece name> · <bone slot>` (e.g. "Vest · torso", "Vest · left arm")
- Custom blocks: "Custom #N" where N is the index in `savedParts.custom`

**Eye toggle behavior:**
- Clicking the eye on a group header sets `visible` on every mesh in that group (cascade)
- Clicking the eye on a child row sets `visible` on that mesh only
- Eye state is independent per row; group header eye reflects whether all children are visible

**Bone reassignment:**
- Child rows are draggable
- Dropping a row onto a different group header calls the existing `reassignBone` logic (same as the 🦴 Bone tool)
- Visual feedback: dragging row gets `opacity: 0.5`; valid drop targets highlight on hover
- Undo/redo supported (inherits from existing `reassignBone` undo records)

**Default collapse state:**
- Groups with no children: collapsed
- Groups with at least one child: expanded

### Layer View Tab

Three fixed categories, each a collapsible section:

```
Body
  Hair
  Face
  (body part voxels by part name)

Clothing
  <equipped piece name>  (one row per equipped slot)

Custom
  Custom #1
  Custom #2
  ...
```

Each row: eye icon + name. No color swatches — color remains per-voxel, edited with the paint tool.

**Eye toggle:** same cascade behavior as Bone View.

**Clothing rows:** all available pieces appear (equipped and unequipped). Clicking a row equips/unequips it — same slot logic as the old wardrobe grid. Equipped rows are highlighted (green border, matching current `.wbtn.eq` style). Unequipped rows appear dimmed but remain clickable.

## Implementation Approach

**Option A — Panel over existing data.** No changes to the underlying data model (`savedParts`, `equipped`, `SK`, `bodyV`, `clothV`). The panel reads these live and maps them to DOM rows.

### New file: `src/ui/layerPanel.js`

Responsibilities:
- Build and mount the panel DOM into the 4th column
- Maintain a flat list of `{mesh, groupKey, label, visible}` records derived from `bodyV`, `clothV`, `savedParts.custom`
- `refresh()` — called after any rebuild/equip/unequip to re-derive the list and re-render rows
- Eye toggle: directly sets `mesh.visible` (or `mesh.parent.visible` for group-level toggles when all meshes share a group)
- Drag-and-drop: HTML5 drag API; `dragstart` stores source row index, `drop` on a group header calls `reassignBone`

### Existing files touched

| File | Change |
|---|---|
| `index.html` | Replace 4th column content with layer panel scaffold; move direction/face/hair cards to column 3 |
| `src/ui/controls.js` | Call `layerPanel.refresh()` after rebuild, equip/unequip, and bone reassign |
| `src/character/skeleton.js` | No change |
| `src/ui/poseEditor.js` | No change |
| `src/skinning/gridCursor.js` | No change |

### `refresh()` mapping logic

```
bodyV  → group by mesh.userData.part → map to bone group via PART_ANCESTOR
clothV → group by mesh.userData.part → map to slot label from WDEFS
savedParts.custom → group by entry.skAncestor → label "Custom #N"
```

The 🦴 Bone sculpt tool remains in place during this work. It can be removed in a follow-up once the panel is stable.

## Out of Scope

- Per-layer color property (dropped — color stays per-voxel)
- Reordering layers within a category
- Renaming individual custom blocks
- Visibility state persisted across page reload
