import { scene, cam, syncCam } from '../renderer/scene.js';
import { outC, renderPixelArt, renderOutputs } from '../renderer/pixelOutput.js';
import { state } from '../state.js';

const D8 = [2.36, 3.14, -2.36, 1.57, 0.01, -1.57, 0.79, -0.79];

export function exportFrame() {
  renderOutputs();
  const a = document.createElement('a');
  a.download = `sprite_${state.outRes}px.png`; a.href = outC.toDataURL(); a.click();
}

export function exportSpritesheet() {
  const r = state.outRes;
  const sh = document.createElement('canvas');
  sh.width = r * 8; sh.height = r;
  const ctx = sh.getContext('2d'), sv = state.camT;
  D8.forEach((ang, i) => {
    state.camT = ang; syncCam();
    const tmp = document.createElement('canvas'); tmp.width = r; tmp.height = r;
    renderPixelArt(tmp.getContext('2d'), r);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, i * r, 0, r, r);
  });
  state.camT = sv; syncCam();
  const a = document.createElement('a');
  a.download = `spritesheet_8dir_${r}px.png`; a.href = sh.toDataURL(); a.click();
}
