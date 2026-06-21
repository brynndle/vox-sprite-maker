import * as THREE from 'three';
import { state } from '../state.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11111b);
scene.add(new THREE.AmbientLight(0x99aabb, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(5, 10, 6);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x2244ff, 0.12);
rim.position.set(-4, 3, -4);
scene.add(rim);

const vc = document.getElementById('vc');
const c3 = document.getElementById('c3');

export function getVW() { return vc.clientWidth || window.innerWidth - 175 * 2 - 7 * 4; }
export function getVH() { return vc.clientHeight || window.innerHeight - 80; }

export const cam = new THREE.PerspectiveCamera(36, getVW() / getVH(), 0.1, 600);
export const renderer = new THREE.WebGLRenderer({ canvas: c3, antialias: true, preserveDrawingBuffer: true });

export function resizeRenderer() {
  const w = getVW(), h = getVH();
  c3.width = w; c3.height = h;
  renderer.setSize(w, h);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
}
resizeRenderer();
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
window.addEventListener('resize', resizeRenderer);

export const TGT = new THREE.Vector3(0, 12, 0);
export let DIST = 38;
export function setDIST(d) { DIST = d; }

export function syncCam() {
  cam.position.set(
    TGT.x + DIST * Math.sin(state.camT) * Math.cos(state.camP),
    TGT.y + DIST * Math.sin(state.camP),
    TGT.z + DIST * Math.cos(state.camT) * Math.cos(state.camP)
  );
  cam.lookAt(TGT);
}
syncCam();
