import * as THREE from 'three';
import { state } from '../state.js';
import { VOXEL_SIZE, VOXEL_GAP, BASE_DIMS } from '../constants.js';

// U=1: each voxel occupies 1 world unit = 1 output pixel (ortho cam maps 1wu→1px).
// VOXEL_SIZE controls geometry diameter so voxels slightly overfill their pixel cell
// (VOXEL_SIZE * VOXEL_GAP ≈ 1.006px), eliminating sub-pixel gaps in the output.
export const U = 1;
export const GRAY = '#8a8fa8';
export const BG = new THREE.BoxGeometry(VOXEL_SIZE * VOXEL_GAP, VOXEL_SIZE * VOXEL_GAP, VOXEL_SIZE * VOXEL_GAP);

export function mat(c) {
  return new THREE.MeshLambertMaterial({ color: new THREE.Color(c) });
}

export function voxBlock(cols, rows, depth, color, opts = {}) {
  const g = new THREE.Group(), ms = [];
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) for (let z = 0; z < depth; z++) {
    if (opts.roundCorners && cols > 2 && depth > 2) {
      const ex = (x === 0 || x === cols - 1), ez = (z === 0 || z === depth - 1);
      if (ex && ez) continue;
    }
    const m = new THREE.Mesh(BG, mat(color));
    m.position.set((x - cols / 2 + 0.5) * U, y * U, (z - depth / 2 + 0.5) * U);
    m.userData.bc = color;
    g.add(m); ms.push(m);
  }
  return { g, ms };
}

export function getDims() {
  const S = state.S;
  return {
    HW:  Math.max(4, Math.round(BASE_DIMS.headW  * S.hW)),
    HH:  Math.max(4, Math.round(BASE_DIMS.headH  * S.hH)),
    HD:  BASE_DIMS.headD,
    TW:  Math.max(3, Math.round(BASE_DIMS.torsoW * S.tW)),
    TH:  Math.max(2, Math.round(BASE_DIMS.torsoH * S.tH)),
    TD:  BASE_DIMS.torsoD,
    AW:  Math.max(1, Math.round(BASE_DIMS.uArmW  * S.aW)),
    UAH: Math.max(2, Math.round(BASE_DIMS.uArmH  * S.aL)),
    LAH: Math.max(2, Math.round(BASE_DIMS.lArmH  * S.aL)),
    HND: BASE_DIMS.handH,
    LW:  Math.max(1, Math.round(BASE_DIMS.uLegW  * S.lW)),
    ULH: Math.max(3, Math.round(BASE_DIMS.uLegH  * S.lL)),
    LLH: Math.max(3, Math.round(BASE_DIMS.lLegH  * S.lL)),
    FW:  Math.max(2, Math.round(BASE_DIMS.footW  * S.fS)),
    FD:  Math.max(2, Math.round(BASE_DIMS.footD  * S.fS)),
    FH:  BASE_DIMS.footH,
    sc:  1, // legacy compat — clothing.js hat/coat sizing
  };
}
