import * as THREE from 'three';
import { BG, mat, getDims } from './voxels.js';
import { state } from '../state.js';

export let faceV = [];

export const EYE_PRESETS = {
  none: () => [],
  dot: (W, H) => [[Math.round(W * 0.28), Math.round(H * 0.55)], [Math.round(W * 0.72), Math.round(H * 0.55)]],
  wide: (W, H) => { const y = Math.round(H * 0.55), lx = Math.round(W * 0.25), rx = Math.round(W * 0.68); return [[lx, y], [lx + 1, y], [rx, y], [rx + 1, y], [lx, y + 1], [lx + 1, y + 1], [rx, y + 1], [rx + 1, y + 1]]; },
  angry: (W, H) => { const y = Math.round(H * 0.55); return [[Math.round(W * 0.28), y], [Math.round(W * 0.72), y], [Math.round(W * 0.25), y + 1], [Math.round(W * 0.75), y + 1]]; },
  happy: (W, H) => { const y = Math.round(H * 0.55); return [[Math.round(W * 0.28), y], [Math.round(W * 0.72), y], [Math.round(W * 0.25), y - 1], [Math.round(W * 0.72) - 1, y - 1], [Math.round(W * 0.31), y - 1], [Math.round(W * 0.75), y - 1]]; },
  wink: (W, H) => { const y = Math.round(H * 0.55); return [[Math.round(W * 0.28), y], [Math.round(W * 0.72), y], [Math.round(W * 0.69), y - 1], [Math.round(W * 0.75), y - 1]]; },
  tired: (W, H) => { const y = Math.round(H * 0.55); return [[Math.round(W * 0.28), y], [Math.round(W * 0.72), y], [Math.round(W * 0.24), y + 1], [Math.round(W * 0.32), y + 1], [Math.round(W * 0.68), y + 1], [Math.round(W * 0.76), y + 1]]; },
  sunglasses: (W, H) => { const y = Math.round(H * 0.55), pts = []; for (let x = Math.round(W * 0.18); x <= Math.round(W * 0.42); x++) pts.push([x, y], [x, y + 1]); for (let x = Math.round(W * 0.58); x <= Math.round(W * 0.82); x++) pts.push([x, y], [x, y + 1]); pts.push([Math.round(W * 0.44), y], [Math.round(W * 0.56), y]); return pts; },
};

export const BROW_PRESETS = {
  none: () => [],
  neutral: (W, H) => [[Math.round(W * 0.23), Math.round(H * 0.68)], [Math.round(W * 0.28), Math.round(H * 0.68)], [Math.round(W * 0.65), Math.round(H * 0.68)], [Math.round(W * 0.72), Math.round(H * 0.68)]],
  raised: (W, H) => [[Math.round(W * 0.23), Math.round(H * 0.72)], [Math.round(W * 0.28), Math.round(H * 0.72)], [Math.round(W * 0.65), Math.round(H * 0.72)], [Math.round(W * 0.72), Math.round(H * 0.72)]],
  furrowed: (W, H) => { const y = Math.round(H * 0.67); return [[Math.round(W * 0.23), y + 1], [Math.round(W * 0.28), y], [Math.round(W * 0.65), y], [Math.round(W * 0.72), y + 1]]; },
  oneup: (W, H) => { const y = Math.round(H * 0.68); return [[Math.round(W * 0.23), y], [Math.round(W * 0.28), y], [Math.round(W * 0.65), y + 2], [Math.round(W * 0.72), y + 2]]; },
};

export const MOUTH_PRESETS = {
  none: () => [],
  neutral: (W, H) => { const y = Math.round(H * 0.28); return [[Math.round(W * 0.35), y], [Math.round(W * 0.5), y], [Math.round(W * 0.65), y]]; },
  smile: (W, H) => { const y = Math.round(H * 0.28); return [[Math.round(W * 0.3), y], [Math.round(W * 0.38), y - 1], [Math.round(W * 0.5), y - 1], [Math.round(W * 0.62), y - 1], [Math.round(W * 0.7), y]]; },
  bigsmile: (W, H) => { const y = Math.round(H * 0.3), pts = []; for (let x = Math.round(W * 0.25); x <= Math.round(W * 0.75); x++) pts.push([x, y]); for (let x = Math.round(W * 0.3); x <= Math.round(W * 0.7); x++) pts.push([x, y - 1]); pts.push([Math.round(W * 0.28), y + 1], [Math.round(W * 0.72), y + 1]); return pts; },
  frown: (W, H) => { const y = Math.round(H * 0.28); return [[Math.round(W * 0.3), y - 1], [Math.round(W * 0.38), y], [Math.round(W * 0.5), y], [Math.round(W * 0.62), y], [Math.round(W * 0.7), y - 1]]; },
  open: (W, H) => { const y = Math.round(H * 0.3), pts = []; for (let x = Math.round(W * 0.3); x <= Math.round(W * 0.7); x++) pts.push([x, y]); for (let x = Math.round(W * 0.32); x <= Math.round(W * 0.68); x++) pts.push([x, y - 1], [x, y - 2]); return pts; },
  smirk: (W, H) => { const y = Math.round(H * 0.28); return [[Math.round(W * 0.35), y], [Math.round(W * 0.5), y], [Math.round(W * 0.6), y], [Math.round(W * 0.65), y + 1]]; },
};

export const NOSE_PRESETS = {
  none: () => [],
  dot: (W, H) => [[Math.round(W * 0.5), Math.round(H * 0.42)]],
  small: (W, H) => [[Math.round(W * 0.45), Math.round(H * 0.4)], [Math.round(W * 0.55), Math.round(H * 0.4)]],
};

export function buildFaceDecal(name, voxels, color, HW, HH, HD, parent) {
  const g = new THREE.Group(); g.userData.isFaceGroup = true;
  // Push 1 unit past the head surface so face voxels are clear of head geometry (prevents z-fighting)
  const frontZ = HD / 2 + 1.0;
  voxels.forEach(([fx, fy]) => {
    const m = new THREE.Mesh(BG, mat(color));
    m.position.set((fx - HW / 2 + 0.5), fy, frontZ);
    m.scale.set(1.6, 1.6, 0.7); // wider/taller so each feature projects to >1 output pixel
    m.userData.part = name; m.userData.vtype = 'face';
    faceV.push(m); g.add(m);
  });
  parent.add(g); return g;
}

export function rebuildFace(SK) {
  if (!SK.head) return;
  const { HW, HH, HD } = getDims();
  SK.head.children.filter(c => c.userData.isFaceGroup).forEach(c => {
    faceV = faceV.filter(m => !c.children.includes(m));
    SK.head.remove(c);
  });
  faceV = [];
  buildFaceDecal('eyes',  (EYE_PRESETS[state.activeEyes]   || EYE_PRESETS.none)(HW, HH),   state.featCol, HW, HH, HD, SK.head);
  buildFaceDecal('brows', (BROW_PRESETS[state.activeBrows]  || BROW_PRESETS.none)(HW, HH),  state.featCol, HW, HH, HD, SK.head);
  buildFaceDecal('mouth', (MOUTH_PRESETS[state.activeMouth] || MOUTH_PRESETS.none)(HW, HH), state.featCol, HW, HH, HD, SK.head);
  buildFaceDecal('nose',  (NOSE_PRESETS[state.activeNose]   || NOSE_PRESETS.none)(HW, HH),  state.featCol, HW, HH, HD, SK.head);
}
