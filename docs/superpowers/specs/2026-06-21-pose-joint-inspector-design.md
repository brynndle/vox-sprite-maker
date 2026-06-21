# Pose Mode — Joint Inspector Design

**Date:** 2026-06-21
**Project:** vox-sprite-maker

---

## Overview

Extend Pose mode so that clicking a joint handle in the 3D viewport opens a per-joint inspector in the left panel. The inspector exposes full 6-DOF control: position (X/Y/Z translation) and rotation (X/Y/Z). This enables shoulder shrugs, arm swings on all axes, and precise fine-tuning beyond what free-form 3D dragging allows. Two additional bone lines (shoulder→head) are added to the skeleton overlay to complete the clavicle visual.

---

## UI — Joint Inspector Panel (`#posep`)

### Default state (no joint selected)
Unchanged from current: drag-to-rotate tip text, Reset pose button, Show skeleton checkbox.

### Selected state (joint clicked)
The panel body is replaced with:

**Header row**
- Joint label (e.g. "L Shoulder")
- ✕ button to deselect (returns to default state)

**Position group**
- Label: "Position"
- Three sliders: X, Y, Z
- Range: −6.0 to +6.0 world units, step 0.1
- Current value displayed inline next to each slider
- Translates `group.position` directly; all children follow

**Rotation group**
- Label: "Rotation"
- Three sliders: X, Y, Z in degrees
- Range: −180° to +180°, step 1°
- Current value displayed inline
- Maps to `group.rotation.x/y/z` (converted to/from radians)

**Reset joint button**
- Restores that joint's position and rotation to captured defaults
- Undoable (pushes to undo stack)

**Persistent controls** (always visible below inspector)
- Reset pose button (resets all joints)
- Show skeleton checkbox

### Deselection
- Click blank space in the 3D viewport (no joint hit) → `posePointerDown` returns `false`; the mousedown handler in `controls.js` explicitly calls `clearJointSelection()` in this case → returns to default state
- Clicking a different joint handle → switches inspector to that joint
- Clicking ✕ button → deselects

---

## 3D Interaction

### Drag (rotation only)
Existing camera-space drag behavior is preserved. Dragging a joint handle rotates that joint. After each drag step, `group.rotation.setFromQuaternion(group.quaternion)` is called to keep the Euler angles in sync. The rotation sliders in the panel update live.

### Position (sliders only)
Translation is slider-only. No 3D drag for position. This avoids ambiguity between rotate and translate on the same handle.

---

## Skeleton Changes

### New bone pairs
Add to `BONE_PAIRS` in `poseEditor.js`:
```
['lShoulder', 'head']
['rShoulder', 'head']
```
These draw clavicle-like lines from each shoulder joint to the head joint origin (both sit at the same Y height at the shoulder level).

---

## Data / State Changes

### `captureDefaults()` — new export from `poseEditor.js`
Snapshots `group.position.clone()` for every joint in `JOINT_DEFS` into a module-level `_defaultPos` map. Called from `main.js` once after `rebuild()` and again any time rebuild is re-triggered (body shape sliders change).

### `resetSkeletonPose()` — extended
In addition to calling `_resetPose(SK, root)` for rotations, also restores all `group.position` values from `_defaultPos`. Pushes a single combined undo record for both position and rotation state.

### `resetJoint(id)` — new
Restores a single joint's position and rotation to captured defaults. Pushes an undo record.

### Euler sync fix
In `posePointerMove`, after mutating `group.quaternion`, add:
```js
group.rotation.setFromQuaternion(group.quaternion);
```
This ensures slider display reads accurate values at all times.

---

## Files Changed

| File | Change |
|------|--------|
| `src/ui/poseEditor.js` | Add `captureDefaults`, `resetJoint`, `setSelectedJoint`, `getSelectedJoint`; extend `resetSkeletonPose`; add Euler sync; add two bone pairs; expose slider-sync callback |
| `src/ui/controls.js` | Wire joint selection to panel display; build/update 6 sliders on select; handle deselect on blank-canvas click in pose mode |
| `index.html` | Add `#posep` joint inspector markup (header, pos/rot slider groups, reset-joint button) |
| `src/main.js` | Call `captureDefaults()` after `rebuild()`; wire body-shape sliders to re-call `captureDefaults()` |

---

## Constraints / Non-goals

- Translation is slider-only (no 3D drag-to-translate).
- No joint-specific rotation-axis locking — all three axes are always available.
- No keyframe or animation curve editing in this spec; pose is a static snapshot.
- No IK (inverse kinematics) — all control is forward kinematics only.
