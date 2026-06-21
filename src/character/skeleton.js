import * as THREE from 'three';
import { scene, TGT, setDIST, syncCam } from '../renderer/scene.js';
import { state } from '../state.js';
import { getDims, voxBlock, GRAY, mat, U, MODEL_SCALE } from './voxels.js';
import { rebuildCloth, equipped } from './clothing.js';
import { buildFaceDecal, EYE_PRESETS, BROW_PRESETS, MOUTH_PRESETS, NOSE_PRESETS } from './face.js';
import { buildHair, hairV } from './hair.js';
import { faceV } from './face.js';
import { UNDO_STACK, REDO_STACK, syncUndoUI } from '../ui/undo.js';

export const SK = {};
export const root = new THREE.Group();
scene.add(root);
export let bodyV = [];
export let clothV = [];
export let partMap = {};

export function applySkin() {
  bodyV.forEach(m => { if (m.userData.isSkin) m.material = mat(state.skin); });
}

export function rebuild() {
  while (root.children.length) root.remove(root.children[0]);
  bodyV = []; clothV = []; partMap = {};
  faceV.length = 0; hairV.length = 0;
  Object.keys(SK).forEach(k => delete SK[k]);
  UNDO_STACK.length = 0; REDO_STACK.length = 0; syncUndoUI();

  const { HW, HH, HD, TW, TH, TD, AW, UAH, LAH, LW, ULH, LLH, FW, FD, FH, sc } = getDims();
  const hipY = LLH + ULH, torsoY = hipY, shoulderY = torsoY + TH, headY = shoulderY;
  const totalH = (headY + HH) * U;
  TGT.set(0, totalH * 0.48, 0);
  setDIST(totalH * 1.75);

  // HEAD
  const headGroup = new THREE.Group();
  headGroup.position.set(0, headY, 0);
  root.add(headGroup); SK.head = headGroup;
  const headB = voxBlock(HW, HH, HD, state.skin, { roundCorners: true });
  headB.ms.forEach(m => {
    m.userData.part = 'head'; m.userData.isSkin = true;
    bodyV.push(m); partMap.head = partMap.head || []; partMap.head.push(m);
  });
  headGroup.add(headB.g);
  buildFaceDecal('eyes',  (EYE_PRESETS[state.activeEyes]    || EYE_PRESETS.none)(HW, HH),   state.featCol, HW, HH, HD, headGroup);
  buildFaceDecal('brows', (BROW_PRESETS[state.activeBrows]   || BROW_PRESETS.none)(HW, HH),  state.featCol, HW, HH, HD, headGroup);
  buildFaceDecal('mouth', (MOUTH_PRESETS[state.activeMouth]  || MOUTH_PRESETS.none)(HW, HH), state.featCol, HW, HH, HD, headGroup);
  buildFaceDecal('nose',  (NOSE_PRESETS[state.activeNose]    || NOSE_PRESETS.none)(HW, HH),  state.featCol, HW, HH, HD, headGroup);
  buildHair(state.activeHair, HW, HH, HD, state.hairCol, headGroup);

  // TORSO
  const torsoB = voxBlock(TW, TH, TD, GRAY);
  torsoB.ms.forEach(m => { m.userData.part = 'torso'; bodyV.push(m); partMap.torso = partMap.torso || []; partMap.torso.push(m); });
  torsoB.g.position.set(0, torsoY, 0); root.add(torsoB.g); SK.torso = torsoB.g;

  // PELVIS
  const pelvisB = voxBlock(TW, Math.max(1, Math.round(sc)), TD, GRAY);
  pelvisB.ms.forEach(m => { m.userData.part = 'pelvis'; bodyV.push(m); });
  pelvisB.g.position.set(0, hipY - Math.max(1, Math.round(sc)), 0); root.add(pelvisB.g);

  // ARMS
  function makeArm(side) {
    const sign = side === 'l' ? 1 : -1;
    const ap = new THREE.Group();
    ap.position.set(sign * (TW / 2 + AW / 2 + 0.3) * U, shoulderY * U, 0);
    root.add(ap); SK[side + 'Arm'] = ap;
    const ua = voxBlock(AW, UAH, AW, GRAY, { roundCorners: true });
    ua.g.position.set(0, -UAH * U, 0);
    ua.ms.forEach(m => { m.userData.part = side + 'UpperArm'; bodyV.push(m); });
    ap.add(ua.g);
    const ep = new THREE.Group(); ep.position.set(0, -UAH * U, 0); ap.add(ep); SK[side + 'Elbow'] = ep;
    const la = voxBlock(AW, LAH, AW, GRAY, { roundCorners: true });
    la.g.position.set(0, -LAH * U, 0);
    la.ms.forEach(m => { m.userData.part = side + 'LowerArm'; bodyV.push(m); });
    ep.add(la.g);
    const hb = voxBlock(Math.max(1, AW), Math.max(1, sc), Math.max(1, AW), state.skin, { roundCorners: true });
    hb.g.position.set(0, -(LAH + Math.max(1, sc)) * U, 0);
    hb.ms.forEach(m => { m.userData.part = side + 'Hand'; m.userData.isSkin = true; bodyV.push(m); });
    ep.add(hb.g);
  }
  makeArm('l'); makeArm('r');

  // LEGS
  function makeLeg(side) {
    const sign = side === 'l' ? 1 : -1;
    const lp = new THREE.Group();
    lp.position.set(sign * Math.round(LW * 0.6) * U, hipY * U, 0);
    root.add(lp); SK[side + 'Leg'] = lp;
    const ul = voxBlock(LW, ULH, LW, GRAY);
    ul.g.position.set(0, -ULH * U, 0);
    ul.ms.forEach(m => { m.userData.part = side + 'UpperLeg'; bodyV.push(m); });
    lp.add(ul.g);
    const kp = new THREE.Group(); kp.position.set(0, -ULH * U, 0); lp.add(kp); SK[side + 'Knee'] = kp;
    const ll = voxBlock(LW, LLH, LW, GRAY);
    ll.g.position.set(0, -LLH * U, 0);
    ll.ms.forEach(m => { m.userData.part = side + 'LowerLeg'; bodyV.push(m); });
    kp.add(ll.g);
    const fb = voxBlock(FW, FH, FD, GRAY, { roundCorners: true });
    fb.g.position.set(0, -(LLH + FH) * U, (FD / 2 - LW / 2) * U);
    fb.ms.forEach(m => { m.userData.part = side + 'Foot'; bodyV.push(m); });
    kp.add(fb.g);
  }
  makeLeg('l'); makeLeg('r');

  applySkin();
  rebuildCloth(SK, root, clothV, getDims);
  syncCam();
}
