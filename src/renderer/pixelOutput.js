import * as THREE from 'three';
import { scene, cam } from './scene.js';
import { state } from '../state.js';
import { root } from '../character/skeleton.js';

export const outC = document.getElementById('outc');
export const outX = outC.getContext('2d');
const out2 = document.getElementById('outc2x');
const out2X = out2.getContext('2d');

export const offR = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
offR.setPixelRatio(1);
offR.setClearColor(0x000000, 0);

export function setOutRes(r) {
  state.outRes = r;
  outC.width = r; outC.height = r;
  const d = Math.max(1, Math.floor(128 / r)) * r;
  outC.style.width = d + 'px'; outC.style.height = d + 'px';
  out2.width = r * 4; out2.height = r * 4;
  out2.style.width = (r * 4) + 'px'; out2.style.height = (r * 4) + 'px';
}
setOutRes(32);

function rgbDist(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
}

function buildPalette(pixels) {
  const max = state.outRes <= 16 ? 16 : state.outRes <= 32 ? 32 : 64;
  const cm = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i+3] < 128) continue;
    const key = (pixels[i] >> 3) << 10 | (pixels[i+1] >> 3) << 5 | (pixels[i+2] >> 3);
    if (!cm.has(key)) cm.set(key, [pixels[i], pixels[i+1], pixels[i+2]]);
  }
  return [...cm.values()].slice(0, max);
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

// Coverage-based downsampler: render at SCALE× then majority-vote each block.
// This avoids the bilinear blur you get from naively downscaling an anti-aliased 3D render.
export function renderPixelArt(destCtx, res) {
  const SCALE = res <= 32 ? 24 : 12;
  const inter = res * SCALE;

  // Snap root translation/tilt to zero before capturing so walk/run bob doesn't
  // shift boundary pixels between pixel-output frames (restores after render).
  const savedY = root.position.y;
  const savedRX = root.rotation.x;
  root.position.y = 0;
  root.rotation.x = 0;

  offR.setSize(inter, inter);
  const oc = new THREE.PerspectiveCamera(36, 1, 0.1, 600);
  oc.position.copy(cam.position); oc.quaternion.copy(cam.quaternion);
  offR.render(scene, oc);

  root.position.y = savedY;
  root.rotation.x = savedRX;

  // Copy WebGL pixels into a readable 2D canvas
  const tmp = document.createElement('canvas');
  tmp.width = inter; tmp.height = inter;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(offR.domElement, 0, 0);
  const hi = tctx.getImageData(0, 0, inter, inter).data;

  const outId = new ImageData(res, res);
  const px = outId.data;
  const S2 = SCALE * SCALE;
  const THRESHOLD = S2 * 0.20; // ≥20% coverage → foreground pixel

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const colorMap = new Map();
      let opaqueCount = 0;

      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const si = ((y * SCALE + dy) * inter + (x * SCALE + dx)) * 4;
          if (hi[si+3] < 128) continue;
          opaqueCount++;
          // 15-bit integer key (5 bits per channel) for fast bucketing
          const key = (hi[si] >> 3) << 10 | (hi[si+1] >> 3) << 5 | (hi[si+2] >> 3);
          const prev = colorMap.get(key);
          if (prev) { prev.n++; prev.r += hi[si]; prev.g += hi[si+1]; prev.b += hi[si+2]; }
          else colorMap.set(key, { n: 1, r: hi[si], g: hi[si+1], b: hi[si+2] });
        }
      }

      const i = (y * res + x) * 4;
      if (opaqueCount < THRESHOLD) { px[i+3] = 0; continue; }

      // Dominant color bucket → average its exact values for better color fidelity
      let best = null, bestN = 0;
      for (const v of colorMap.values()) { if (v.n > bestN) { bestN = v.n; best = v; } }
      px[i]   = Math.round(best.r / best.n);
      px[i+1] = Math.round(best.g / best.n);
      px[i+2] = Math.round(best.b / best.n);
      px[i+3] = 255;
    }
  }

  // Silhouette smoothing: fill isolated transparent holes (3+ opaque orthogonal neighbors).
  // Prevents single-pixel gaps caused by boundary pixels hovering near the coverage threshold
  // during sub-pixel vertical translation in walk/run animations.
  {
    const copy = new Uint8ClampedArray(px);
    const dirs4 = [[0,-1],[0,1],[-1,0],[1,0]];
    for (let y = 1; y < res-1; y++) for (let x = 1; x < res-1; x++) {
      const i = (y*res+x)*4;
      if (copy[i+3] >= 128) continue;
      let opaqueN = 0, sr = 0, sg = 0, sb = 0;
      for (const [dx,dy] of dirs4) {
        const ni = ((y+dy)*res+(x+dx))*4;
        if (copy[ni+3] >= 128) { opaqueN++; sr += copy[ni]; sg += copy[ni+1]; sb += copy[ni+2]; }
      }
      if (opaqueN >= 3) {
        px[i] = sr/opaqueN; px[i+1] = sg/opaqueN; px[i+2] = sb/opaqueN; px[i+3] = 255;
      }
    }
  }

  if (state.shadeMode !== 'flat') applyShading(px, res, res);
  const pal = buildPalette(px);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i+3] < 128) { px[i]=px[i+1]=px[i+2]=px[i+3]=0; continue; }
    const q = quantize(px[i], px[i+1], px[i+2], pal);
    px[i]=q[0]; px[i+1]=q[1]; px[i+2]=q[2]; px[i+3]=255;
  }
  if (state.outlineMode !== 'none') applyOutline(px, res, res);

  destCtx.clearRect(0, 0, res, res);
  destCtx.putImageData(outId, 0, 0);
}

export function renderOutputs() {
  renderPixelArt(outX, state.outRes);
  out2X.imageSmoothingEnabled = false;
  out2X.clearRect(0, 0, state.outRes * 4, state.outRes * 4);
  out2X.drawImage(outC, 0, 0, state.outRes * 4, state.outRes * 4);
}
