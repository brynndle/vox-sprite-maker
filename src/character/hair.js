import * as THREE from 'three';
import { BG, mat, getDims } from './voxels.js';
import { state } from '../state.js';

export let hairV = [];

export const HAIR_PRESETS = { none: 1, flat: 1, spiky: 1, mohawk: 1, long: 1, curly: 1, bun: 1 };

export function buildHair(preset, W, H, D, color, parent) {
  const g = new THREE.Group(); g.userData.isHairGroup = true;
  const add = (x, y, z) => {
    const m = new THREE.Mesh(BG, mat(color));
    m.position.set(x, y, z);
    m.userData.vtype = 'hair';
    hairV.push(m); g.add(m);
  };
  if (preset === 'flat') {
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) add((x - W / 2 + 0.5), H, (z - D / 2 + 0.5));
  } else if (preset === 'spiky') {
    const heights = [0, 3, 2, 3, 2, 3, 0];
    for (let x = 0; x < W; x++) {
      const h = heights[Math.min(x, heights.length - 1)] || 1;
      for (let y = 0; y < h; y++) for (let z = 1; z < D - 1; z++) add((x - W / 2 + 0.5), (H + y), (z - D / 2 + 0.5));
    }
  } else if (preset === 'mohawk') {
    const mw = Math.max(1, Math.round(W * 0.25)), mh = Math.round(H * 0.7);
    for (let y = 0; y < mh; y++) for (let z = 1; z < D - 1; z++) for (let mx = 0; mx < mw; mx++) add((mx - mw / 2 + 0.5), (H + y), (z - D / 2 + 0.5));
  } else if (preset === 'long') {
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) add((x - W / 2 + 0.5), H, (z - D / 2 + 0.5));
    const sH = Math.round(H * 0.8);
    for (let y = 0; y < sH; y++) {
      for (let z = 0; z < D; z++) { add((-W / 2 - 0.5), (H - 1 - y), (z - D / 2 + 0.5)); add((W / 2 - 0.5), (H - 1 - y), (z - D / 2 + 0.5)); }
      for (let x = 0; x < W; x++) add((x - W / 2 + 0.5), (H - 1 - y), (-D / 2 - 0.5));
    }
  } else if (preset === 'curly') {
    const r = W * 0.6;
    for (let x = 0; x < W + 2; x++) for (let y = 0; y < Math.round(H * 0.6); y++) for (let z = 0; z < D + 2; z++) {
      const dx = x - W / 2, dy = y, dz = z - D / 2;
      if (dx * dx * 0.6 + dy * dy * 0.8 + dz * dz * 0.6 > r * r * 0.7) continue;
      if (y === 0 && Math.abs(dx) < W / 2 - 1 && Math.abs(dz) < D / 2 - 1) continue;
      add(dx, (H + y), dz);
    }
  } else if (preset === 'bun') {
    const bW = Math.max(2, Math.round(W * 0.4)), bH = Math.round(H * 0.4);
    for (let x = 0; x < bW; x++) for (let y = 0; y < bH; y++) for (let z = 0; z < bW; z++) {
      if ((x === 0 || x === bW - 1) && (z === 0 || z === bW - 1)) continue;
      add((x - bW / 2 + 0.5), (H + y), (z - bW / 2 + 0.5));
    }
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
      if ((x === 0 || x === W - 1) && (z === 0 || z === D - 1)) continue;
      add((x - W / 2 + 0.5), H, (z - D / 2 + 0.5));
    }
  }
  parent.add(g); return g;
}

export function rebuildHair(SK) {
  if (!SK.head) return;
  SK.head.children.filter(c => c.userData.isHairGroup).forEach(c => {
    hairV = hairV.filter(m => !c.children.includes(m));
    SK.head.remove(c);
  });
  hairV = [];
  const { HW, HH, HD } = getDims();
  buildHair(state.activeHair, HW, HH, HD, state.hairCol, SK.head);
}
