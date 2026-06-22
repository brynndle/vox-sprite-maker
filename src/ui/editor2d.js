import * as THREE from 'three';
import { state } from '../state.js';
import { bodyV, clothV, root, SK } from '../character/skeleton.js';
import { BG, mat, U } from '../character/voxels.js';
import { OUT_W, OUT_H, ORTHO_CAM_Y } from '../constants.js';
import { renderPixelArt, outSize } from '../renderer/pixelOutput.js';
import { pushUndo } from './undo.js';
import { savedParts, savePart, resetPart } from '../character/parts.js';
import { assignBone } from '../skinning/boneAssign.js';

const GW = OUT_W;   // grid columns — one per world-unit of horizontal frustum
const GH = OUT_H;   // grid rows    — one per world-unit of vertical frustum

// paint2D[gy][gx] = hex color string or null
const paint2D = Array.from({ length: GH }, () => new Array(GW).fill(null));

const vc2d    = document.getElementById('vc2d');
const c2d     = document.getElementById('c2d');
const ctx     = c2d.getContext('2d');

let erasing   = false;
let drawing   = false;
let hoverCell = null;
let refCanvas = null;   // cached reference render, rebuilt on enter

// ── Grid helpers ──────────────────────────────────────────────────────────────
function layout() {
  const cs = Math.floor(Math.min(c2d.clientWidth / GW, c2d.clientHeight / GH));
  const ox = Math.floor((c2d.clientWidth  - GW * cs) / 2);
  const oy = Math.floor((c2d.clientHeight - GH * cs) / 2);
  return { ox, oy, cs };
}

function canvasToCell(cx, cy) {
  const { ox, oy, cs } = layout();
  const gx = Math.floor((cx - ox) / cs);
  const gy = Math.floor((cy - oy) / cs);
  if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) return null;
  return { gx, gy };
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function render() {
  const W = c2d.clientWidth, H = c2d.clientHeight;
  if (!W || !H) return;
  c2d.width = W; c2d.height = H;

  const { ox, oy, cs } = layout();
  const gw = GW * cs, gh = GH * cs;

  ctx.fillStyle = '#11111b';
  ctx.fillRect(0, 0, W, H);

  // Dim reference of current character
  if (refCanvas) {
    ctx.globalAlpha = 0.22;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(refCanvas, ox, oy, gw, gh);
    ctx.globalAlpha = 1;
  }

  // Painted cells
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const col = paint2D[gy][gx];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + gx * cs, oy + gy * cs, cs, cs);
    }
  }

  // Hover cell
  if (hoverCell) {
    const { gx, gy } = hoverCell;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = erasing ? '#f38ba8' : state.col;
    ctx.fillRect(ox + gx * cs, oy + gy * cs, cs, cs);
    ctx.globalAlpha = 1;
  }

  // Grid lines
  ctx.strokeStyle = '#313244';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let gx = 0; gx <= GW; gx++) {
    ctx.moveTo(ox + gx * cs, oy);
    ctx.lineTo(ox + gx * cs, oy + gh);
  }
  for (let gy = 0; gy <= GH; gy++) {
    ctx.moveTo(ox, oy + gy * cs);
    ctx.lineTo(ox + gw, oy + gy * cs);
  }
  ctx.stroke();
}

// ── Paint interaction ─────────────────────────────────────────────────────────
function applyAtEvent(e) {
  const r = c2d.getBoundingClientRect();
  const cell = canvasToCell(e.clientX - r.left, e.clientY - r.top);
  if (!cell) return;
  const { gx, gy } = cell;
  paint2D[gy][gx] = (erasing || e.buttons === 2) ? null : state.col;
  render();
}

c2d.addEventListener('mousedown', e => {
  e.preventDefault(); drawing = true; applyAtEvent(e);
});
c2d.addEventListener('mousemove', e => {
  const r = c2d.getBoundingClientRect();
  const cell = canvasToCell(e.clientX - r.left, e.clientY - r.top);
  if (cell?.gx !== hoverCell?.gx || cell?.gy !== hoverCell?.gy) {
    hoverCell = cell; render();
  }
  if (drawing) applyAtEvent(e);
});
window.addEventListener('mouseup', () => { drawing = false; });
c2d.addEventListener('mouseleave', () => { hoverCell = null; render(); });
c2d.addEventListener('contextmenu', e => e.preventDefault());

// ── Toolbar buttons ───────────────────────────────────────────────────────────
document.getElementById('c2d-erase-btn').addEventListener('click', () => {
  erasing = !erasing;
  document.getElementById('c2d-erase-btn').classList.toggle('on', erasing);
  c2d.style.cursor = erasing ? 'cell' : 'crosshair';
  render();
});

document.getElementById('c2d-clear-btn').addEventListener('click', () => {
  if (!confirm('Clear the 2D canvas?')) return;
  for (let gy = 0; gy < GH; gy++) paint2D[gy].fill(null);
  render();
});

const depthSlider = document.getElementById('c2d-depth');
const depthLabel  = document.getElementById('c2d-depth-val');
depthSlider.addEventListener('input', () => { depthLabel.textContent = depthSlider.value; });

// ── Extrude to 3D ─────────────────────────────────────────────────────────────
document.getElementById('c2d-extrude-btn').addEventListener('click', () => {
  const depth = parseInt(depthSlider.value);

  const oldBody   = bodyV.map(m => ({ mesh: m, parent: m.parent }));
  const oldCloth  = clothV.map(m => ({ mesh: m, parent: m.parent }));
  const oldCustom = savedParts.custom ? [...savedParts.custom] : [];

  oldBody.forEach( ({ mesh, parent }) => parent && parent.remove(mesh));
  oldCloth.forEach(({ mesh, parent }) => parent && parent.remove(mesh));
  bodyV.length = 0; clothV.length = 0;

  const created       = [];
  const customEntries = [];

  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const col = paint2D[gy][gx];
      if (!col) continue;
      const wx = (gx - GW / 2 + 0.5) * U;
      const wy = ORTHO_CAM_Y + (GH / 2 - gy - 0.5) * U;

      for (let i = 0; i < depth; i++) {
        const wz       = (Math.floor(depth / 2) - i) * U;
        const worldPos = new THREE.Vector3(wx, wy, wz);

        const skKey  = assignBone(worldPos, SK);
        const group  = SK[skKey] || root;
        const localPos = group.worldToLocal(worldPos.clone());

        const m = new THREE.Mesh(BG, mat(col));
        m.position.copy(localPos);
        m.userData.part = 'custom';
        m.userData.isSkin = false;
        m.userData.skAncestor = skKey;
        group.add(m);
        bodyV.push(m);
        created.push({ mesh: m, parent: group });

        customEntries.push({
          x: +localPos.x.toFixed(4),
          y: +localPos.y.toFixed(4),
          z: +localPos.z.toFixed(4),
          color: col,
          skAncestor: skKey,
        });
      }
    }
  }

  savedParts.custom = customEntries;
  savePart('custom', customEntries);
  if (savedParts._skeletonOnly) resetPart('_skeletonOnly');

  pushUndo({
    undo() {
      created.forEach(({ mesh, parent }) => {
        parent.remove(mesh);
        const i = bodyV.indexOf(mesh); if (i !== -1) bodyV.splice(i, 1);
      });
      oldBody.forEach( ({ mesh, parent }) => { parent.add(mesh); bodyV.push(mesh); });
      oldCloth.forEach(({ mesh, parent }) => { parent.add(mesh); clothV.push(mesh); });
      savedParts.custom = oldCustom;
      savePart('custom', oldCustom);
    },
    redo() {
      oldBody.forEach( ({ mesh, parent }) => {
        parent.remove(mesh);
        const i = bodyV.indexOf(mesh); if (i !== -1) bodyV.splice(i, 1);
      });
      oldCloth.forEach(({ mesh, parent }) => {
        parent.remove(mesh);
        const i = clothV.indexOf(mesh); if (i !== -1) clothV.splice(i, 1);
      });
      created.forEach(({ mesh, parent }) => { parent.add(mesh); bodyV.push(mesh); });
      savedParts.custom = customEntries;
      savePart('custom', customEntries);
    },
  });

  exit2D();
});

// ── Enter / exit ──────────────────────────────────────────────────────────────
export function enter2D() {
  // Build reference image (front-view pixel art of current character)
  refCanvas = document.createElement('canvas');
  refCanvas.width  = outSize.w;
  refCanvas.height = outSize.h;
  renderPixelArt(0.01, 0, refCanvas.getContext('2d'));

  vc2d.style.display = 'flex';
  erasing = false;
  document.getElementById('c2d-erase-btn').classList.remove('on');
  c2d.style.cursor = 'crosshair';

  // Give the browser one frame to lay out the overlay before sizing the canvas
  requestAnimationFrame(render);
}

export function exit2D() {
  vc2d.style.display = 'none';
  document.getElementById('mode2d-btn').classList.remove('on');
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === 'paint'));
  state.mode = 'paint';
  document.getElementById('pp').style.display    = '';
  document.getElementById('sp').style.display    = 'none';
  document.getElementById('cp').style.display    = 'none';
  document.getElementById('posep').style.display = 'none';
}

document.getElementById('c2d-exit-btn').addEventListener('click', exit2D);

window.addEventListener('resize', () => {
  if (vc2d.style.display !== 'none') render();
});
