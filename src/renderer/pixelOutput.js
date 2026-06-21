import * as THREE from 'three';
import { scene } from './scene.js';
import { state } from '../state.js';
import { root } from '../character/skeleton.js';
import { OUT_W, OUT_H, ORTHO_CAM_Y, DISPLAY_SCALE } from '../constants.js';

export const outC = document.getElementById('outc');
export const outX = outC.getContext('2d');

// Mutable current output dimensions — start at base 16×32
export const outSize = { w: OUT_W, h: OUT_H };

function applyCanvasSizes() {
  const { w, h } = outSize;
  outC.width = w; outC.height = h;
  const dscale = Math.floor(200 / w); // keep preview ≤200px wide regardless of output res
  outC.style.width  = (w * dscale) + 'px';
  outC.style.height = (h * dscale) + 'px';
  outC.style.imageRendering = 'pixelated';
}
applyCanvasSizes();

export const offR = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
offR.setPixelRatio(1);
offR.setSize(OUT_W, OUT_H);
offR.setClearColor(0x000000, 0);

// Switch output resolution — keeps same world-space scene, more/fewer pixels per voxel
export function setOutSize(w, h) {
  outSize.w = w; outSize.h = h;
  offR.setSize(w, h);
  applyCanvasSizes();
}

const exportCam = new THREE.OrthographicCamera(
  -OUT_W / 2, OUT_W / 2, OUT_H / 2, -OUT_H / 2, -500, 500
);

function setExportCamAngle(theta, phi = 0.15) {
  const dist = OUT_H * 1.2;
  exportCam.position.set(
    dist * Math.sin(theta) * Math.cos(phi),
    ORTHO_CAM_Y + dist * Math.sin(phi),
    dist * Math.cos(theta) * Math.cos(phi)
  );
  exportCam.lookAt(0, ORTHO_CAM_Y, 0);
  exportCam.updateProjectionMatrix();
}

function rgbDist(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
}

function buildPalette(pixels) {
  const cm = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i+3] < 128) continue;
    const key = (pixels[i] >> 3) << 10 | (pixels[i+1] >> 3) << 5 | (pixels[i+2] >> 3);
    if (!cm.has(key)) cm.set(key, [pixels[i], pixels[i+1], pixels[i+2]]);
  }
  return [...cm.values()].slice(0, 32);
}

function quantize(r, g, b, pal) {
  let best = null, bd = Infinity;
  for (const p of pal) { const d = rgbDist([r,g,b], p); if (d < bd) { bd = d; best = p; } }
  return best;
}

function applyShading(px, W, H) {
  const orig = new Uint8ClampedArray(px);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y*W+x)*4; if (orig[i+3] < 128) continue;
    const above = y > 0 ? orig[((y-1)*W+x)*4+3] > 128 : false;
    const left  = x > 0 ? orig[(y*W+(x-1))*4+3] > 128 : false;
    const below = y < H-1 ? orig[((y+1)*W+x)*4+3] > 128 : true;
    const right = x < W-1 ? orig[(y*W+(x+1))*4+3] > 128 : true;
    const litScore = (!above?1:0) + (!left?1:0);
    const shadowScore = (!below?1:0) + (!right?1:0);
    let tone = 'base';
    if (state.shadeMode === '2tone') { if (shadowScore > 0) tone = 'shadow'; }
    else if (state.shadeMode === '3tone') { if (litScore >= 2) tone = 'highlight'; else if (shadowScore > 0) tone = 'shadow'; }
    if (tone !== 'base') {
      const c = new THREE.Color(orig[i]/255, orig[i+1]/255, orig[i+2]/255);
      const hsl = {h:0,s:0,l:0}; c.getHSL(hsl);
      const nl = tone === 'highlight' ? Math.min(1, hsl.l*1.45) : Math.max(0, hsl.l*0.58);
      c.setHSL(hsl.h, hsl.s, nl);
      px[i] = Math.round(c.r*255); px[i+1] = Math.round(c.g*255); px[i+2] = Math.round(c.b*255);
    }
  }
}

function applyQuantize(px, W, H) {
  const pal = buildPalette(px);
  for (let i = 0; i < W * H * 4; i += 4) {
    if (px[i+3] < 128) { px[i]=px[i+1]=px[i+2]=px[i+3]=0; continue; }
    const q = quantize(px[i], px[i+1], px[i+2], pal);
    px[i]=q[0]; px[i+1]=q[1]; px[i+2]=q[2]; px[i+3]=255;
  }
}

function applyOutline(px, W, H) {
  const orig = new Uint8ClampedArray(px);
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  function getOC(rx, ry) {
    if (state.outlineCol === 'black') return [10,10,10,255];
    const i = (ry*W+rx)*4;
    const c = new THREE.Color(orig[i]/255, orig[i+1]/255, orig[i+2]/255);
    const hsl = {h:0,s:0,l:0}; c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, Math.max(0, hsl.l * (state.outlineCol === 'dark' ? 0.35 : 0.55)));
    return [Math.round(c.r*255), Math.round(c.g*255), Math.round(c.b*255), 255];
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y*W+x)*4; const isChar = orig[i+3] >= 128;
    if (state.outlineMode === 'silhouette') {
      if (!isChar) { let adj=false,rx=x,ry=y; for(const[dx,dy]of dirs){const nx=x+dx,ny=y+dy;if(nx<0||nx>=W||ny<0||ny>=H)continue;if(orig[(ny*W+nx)*4+3]>=128){adj=true;rx=nx;ry=ny;break;}}if(adj){const oc=getOC(rx,ry);px[i]=oc[0];px[i+1]=oc[1];px[i+2]=oc[2];px[i+3]=255;} }
    } else if (state.outlineMode === 'full') {
      if (!isChar) { let adj=false,rx=x,ry=y; for(const[dx,dy]of dirs){const nx=x+dx,ny=y+dy;if(nx<0||nx>=W||ny<0||ny>=H)continue;if(orig[(ny*W+nx)*4+3]>=128){adj=true;rx=nx;ry=ny;break;}}if(adj){const oc=getOC(rx,ry);px[i]=oc[0];px[i+1]=oc[1];px[i+2]=oc[2];px[i+3]=255;}}
      else { const r=orig[i],g=orig[i+1],b=orig[i+2];let edge=false;for(const[dx,dy]of dirs){const nx=x+dx,ny=y+dy;if(nx<0||nx>=W||ny<0||ny>=H)continue;const ni=(ny*W+nx)*4;if(orig[ni+3]<128)continue;if(Math.abs(r-orig[ni])+Math.abs(g-orig[ni+1])+Math.abs(b-orig[ni+2])>120){edge=true;break;}}if(edge){const oc=getOC(x,y);px[i]=Math.round(oc[0]*.7+r*.3);px[i+1]=Math.round(oc[1]*.7+g*.3);px[i+2]=Math.round(oc[2]*.7+b*.3);}}
    }
  }
}

// Render one frame to destCtx at (destX, destY) using the given camera angle.
// Snaps root bob to zero so pixel output is always from the base pose.
export function renderPixelArt(theta, phi, destCtx, destX = 0, destY = 0) {
  const W = outSize.w, H = outSize.h;
  setExportCamAngle(theta, phi);

  const savedY = root.position.y;
  const savedRX = root.rotation.x;
  root.position.y = 0;
  root.rotation.x = 0;

  offR.render(scene, exportCam);

  root.position.y = savedY;
  root.rotation.x = savedRX;

  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(offR.domElement, 0, 0);
  const id = tctx.getImageData(0, 0, W, H);

  applyShading(id.data, W, H);
  applyQuantize(id.data, W, H);
  applyOutline(id.data, W, H);

  tctx.putImageData(id, 0, 0);
  destCtx.drawImage(tmp, destX, destY, W, H);
}

export function renderOutputs() {
  renderPixelArt(state.camT, state.camP, outX);
}
