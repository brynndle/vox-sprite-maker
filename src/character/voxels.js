import * as THREE from 'three';
import { state } from '../state.js';

export const MODEL_SCALE = 2;
export const U = 1;
export const GRAY = '#8a8fa8';
export const BG = new THREE.BoxGeometry(U * 0.88, U * 0.88, U * 0.88);

export function mat(c) {
  return new THREE.MeshLambertMaterial({ color: new THREE.Color(c) });
}

export function voxBlock(cols, rows, depth, color, opts = {}) {
  const g = new THREE.Group(), ms = [];
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) for (let z = 0; z < depth; z++) {
    if (opts.roundCorners) {
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
  const sc = MODEL_SCALE, S = state.S;
  return {
    HW: Math.max(3, Math.round(5 * sc * S.hW)),
    HH: Math.max(3, Math.round(5 * sc * S.hH)),
    HD: Math.max(2, Math.round(4 * sc)),
    TW: Math.max(3, Math.round(4 * sc * S.tW)),
    TH: Math.max(2, Math.round(3 * sc * S.tH)),
    TD: Math.max(2, Math.round(3 * sc)),
    AW: Math.max(1, Math.round(1.5 * sc * S.aW)),
    UAH: Math.max(2, Math.round(2.5 * sc * S.aL)),
    LAH: Math.max(2, Math.round(2 * sc * S.aL)),
    LW: Math.max(1, Math.round(2 * sc * S.lW)),
    ULH: Math.max(3, Math.round(5 * sc * S.lL)),
    LLH: Math.max(3, Math.round(5 * sc * S.lL)),
    FW: Math.max(2, Math.round(3 * sc * S.fS)),
    FD: Math.max(2, Math.round(3.5 * sc * S.fS)),
    FH: Math.max(1, Math.round(sc * 0.8)),
    sc,
  };
}
