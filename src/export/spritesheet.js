import { renderPixelArt, outC, outX, outSize } from '../renderer/pixelOutput.js';
import { DIRS_8 } from '../constants.js';
import { state } from '../state.js';
import { animPose, resetPose } from '../animation/poses.js';
import { SK, root } from '../character/skeleton.js';

const EXPORT_PHI = 0.15; // fixed vertical angle for all sheet exports

function download(canvas, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

// Single frame — uses current editor angle
export function exportFrame() {
  const { w, h } = outSize;
  renderPixelArt(state.camT, state.camP, outX);
  download(outC, `sprite_${w}x${h}.png`);
}

// 8-direction static — 8 frames side by side at standard angle
export function exportStaticSheet() {
  const { w, h } = outSize;
  const c = document.createElement('canvas');
  c.width = w * 8; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const savedT = state.camT;
  DIRS_8.forEach((dir, i) => {
    state.camT = dir.theta;
    renderPixelArt(dir.theta, EXPORT_PHI, ctx, i * w, 0);
  });
  state.camT = savedT;
  download(c, `sprite_8dir_${w * 8}x${h}.png`);
}

// Walk animation — 8 dirs × 4 frames horizontal strip at standard angle
export function exportWalkSheet() {
  const { w, h } = outSize;
  const FRAMES = 4;
  const savedAnim = state.anim;
  const savedT = state.camT;
  state.anim = 'walk';

  const c = document.createElement('canvas');
  c.width = w * DIRS_8.length * FRAMES;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  DIRS_8.forEach((dir, di) => {
    for (let f = 0; f < FRAMES; f++) {
      animPose(f / FRAMES, SK, root);
      const x = (di * FRAMES + f) * w;
      renderPixelArt(dir.theta, EXPORT_PHI, ctx, x, 0);
    }
  });

  state.anim = savedAnim;
  state.camT = savedT;
  resetPose(SK, root);
  download(c, `sprite_walk_${w * DIRS_8.length * FRAMES}x${h}.png`);
}
