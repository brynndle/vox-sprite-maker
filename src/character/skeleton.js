import * as THREE from 'three';
import { scene, TGT, setDIST, syncCam } from '../renderer/scene.js';
import { state } from '../state.js';
import { getDims, voxBlock, GRAY, mat, BG, U } from './voxels.js';
import { rebuildCloth, equipped } from './clothing.js';
import { buildFaceDecal, EYE_PRESETS, BROW_PRESETS, MOUTH_PRESETS, NOSE_PRESETS } from './face.js';
import { buildHair, hairV } from './hair.js';
import { faceV } from './face.js';
import { UNDO_STACK, REDO_STACK, syncUndoUI } from '../ui/undo.js';
import { savedParts } from './parts.js';

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

  const { HW, HH, HD, TW, TH, TD, AW, UAH, LAH, HND, LW, ULH, LLH, FW, FD, FH, sc } = getDims();
  const hipY = LLH + ULH, torsoY = hipY, shoulderY = torsoY + TH, headY = shoulderY;
  const totalH = (headY + HH) * U;
  TGT.set(0, totalH * 0.44, 0);
  setDIST(totalH * 2.0);

  // HEAD
  const headGroup = new THREE.Group();
  headGroup.position.set(0, headY, 0);
  root.add(headGroup); SK.head = headGroup;
  if (savedParts.head) {
    savedParts.head.forEach(e => {
      const m = new THREE.Mesh(BG, mat(e.color));
      m.position.set(e.x, e.y, e.z);
      m.userData.part = e.part || 'head'; m.userData.isSkin = e.isSkin || false;
      bodyV.push(m); partMap.head = partMap.head || []; partMap.head.push(m);
      headGroup.add(m);
    });
  } else if (!savedParts._skeletonOnly) {
    const headB = voxBlock(HW, HH, HD, state.skin, { roundCorners: true });
    headB.ms.forEach(m => {
      m.userData.part = 'head'; m.userData.isSkin = true;
      bodyV.push(m); partMap.head = partMap.head || []; partMap.head.push(m);
    });
    headGroup.add(headB.g);
  }
  buildFaceDecal('eyes',  (EYE_PRESETS[state.activeEyes]    || EYE_PRESETS.none)(HW, HH),   state.featCol, HW, HH, HD, headGroup);
  buildFaceDecal('brows', (BROW_PRESETS[state.activeBrows]   || BROW_PRESETS.none)(HW, HH),  state.featCol, HW, HH, HD, headGroup);
  buildFaceDecal('mouth', (MOUTH_PRESETS[state.activeMouth]  || MOUTH_PRESETS.none)(HW, HH), state.featCol, HW, HH, HD, headGroup);
  buildFaceDecal('nose',  (NOSE_PRESETS[state.activeNose]    || NOSE_PRESETS.none)(HW, HH),  state.featCol, HW, HH, HD, headGroup);
  buildHair(state.activeHair, HW, HH, HD, state.hairCol, headGroup);

  // TORSO + PELVIS — unified group so both can be saved/restored together
  const tg = new THREE.Group();
  tg.position.set(0, torsoY, 0);
  root.add(tg); SK.torso = tg;
  if (savedParts.torso) {
    savedParts.torso.forEach(e => {
      const m = new THREE.Mesh(BG, mat(e.color));
      m.position.set(e.x, e.y, e.z);
      m.userData.part = e.part || 'torso'; m.userData.isSkin = e.isSkin || false;
      bodyV.push(m); partMap[m.userData.part] = partMap[m.userData.part] || []; partMap[m.userData.part].push(m);
      tg.add(m);
    });
  } else if (!savedParts._skeletonOnly) {
    const torsoB = voxBlock(TW, TH, TD, GRAY);
    torsoB.ms.forEach(m => { m.userData.part = 'torso'; bodyV.push(m); partMap.torso = partMap.torso || []; partMap.torso.push(m); });
    tg.add(torsoB.g);
    const pelvisH = Math.max(1, Math.round(sc));
    const pelvisB = voxBlock(TW, pelvisH, TD, GRAY);
    pelvisB.ms.forEach(m => { m.userData.part = 'pelvis'; bodyV.push(m); });
    pelvisB.g.position.set(0, -pelvisH, 0);
    tg.add(pelvisB.g);
  }

  // ARMS
  function makeArm(side) {
    const sign = side === 'l' ? 1 : -1;
    const ap = new THREE.Group();
    ap.position.set(sign * (TW / 2 + AW / 2 + 0.3) * U, shoulderY * U, 0);
    root.add(ap); SK[side + 'Arm'] = ap;
    const ep = new THREE.Group(); ep.position.set(0, -UAH * U, 0); ap.add(ep); SK[side + 'Elbow'] = ep;
    if (savedParts.arm) {
      savedParts.arm.forEach(e => {
        const targetKey = e.skAncestor.replace(/^l/, side);
        const targetGroup = SK[targetKey]; if (!targetGroup) return;
        const m = new THREE.Mesh(BG, mat(e.color));
        m.position.set(e.x, e.y, e.z);
        m.userData.part = e.part.replace(/^l/, side); m.userData.isSkin = e.isSkin || false;
        bodyV.push(m); targetGroup.add(m);
      });
    } else if (!savedParts._skeletonOnly) {
      const ua = voxBlock(AW, UAH, AW, GRAY, { roundCorners: true });
      ua.g.position.set(0, -UAH * U, 0);
      ua.ms.forEach(m => { m.userData.part = side + 'UpperArm'; bodyV.push(m); });
      ap.add(ua.g);
      const la = voxBlock(AW, LAH, AW, GRAY, { roundCorners: true });
      la.g.position.set(0, -LAH * U, 0);
      la.ms.forEach(m => { m.userData.part = side + 'LowerArm'; bodyV.push(m); });
      ep.add(la.g);
      const hb = voxBlock(Math.max(1, AW), HND, Math.max(1, AW), state.skin, { roundCorners: true });
      hb.g.position.set(0, -(LAH + HND) * U, 0);
      hb.ms.forEach(m => { m.userData.part = side + 'Hand'; m.userData.isSkin = true; bodyV.push(m); });
      ep.add(hb.g);
    }
  }
  makeArm('l'); makeArm('r');

  // LEGS
  function makeLeg(side) {
    const sign = side === 'l' ? 1 : -1;
    const lp = new THREE.Group();
    lp.position.set(sign * Math.round(LW * 0.6) * U, hipY * U, 0);
    root.add(lp); SK[side + 'Leg'] = lp;
    const kp = new THREE.Group(); kp.position.set(0, -ULH * U, 0); lp.add(kp); SK[side + 'Knee'] = kp;
    if (savedParts.leg) {
      savedParts.leg.forEach(e => {
        const targetKey = e.skAncestor.replace(/^l/, side);
        const targetGroup = SK[targetKey]; if (!targetGroup) return;
        const m = new THREE.Mesh(BG, mat(e.color));
        m.position.set(e.x, e.y, e.z);
        m.userData.part = e.part.replace(/^l/, side); m.userData.isSkin = e.isSkin || false;
        bodyV.push(m); targetGroup.add(m);
      });
    } else if (!savedParts._skeletonOnly) {
      const ul = voxBlock(LW, ULH, LW, GRAY);
      ul.g.position.set(0, -ULH * U, 0);
      ul.ms.forEach(m => { m.userData.part = side + 'UpperLeg'; bodyV.push(m); });
      lp.add(ul.g);
      const ll = voxBlock(LW, LLH, LW, GRAY);
      ll.g.position.set(0, -LLH * U, 0);
      ll.ms.forEach(m => { m.userData.part = side + 'LowerLeg'; bodyV.push(m); });
      kp.add(ll.g);
      const fb = voxBlock(FW, FH, FD, GRAY, { roundCorners: true });
      fb.g.position.set(0, -(LLH + FH) * U, (FD / 2 - LW / 2) * U);
      fb.ms.forEach(m => { m.userData.part = side + 'Foot'; bodyV.push(m); });
      kp.add(fb.g);
    }
  }
  makeLeg('l'); makeLeg('r');

  // Custom blocks from block skinning — parented to the stored SK group
  if (savedParts.custom && savedParts.custom.length) {
    savedParts.custom.forEach(e => {
      const group = SK[e.skAncestor];
      if (!group) return;
      const m = new THREE.Mesh(BG, mat(e.color));
      m.position.set(e.x, e.y, e.z);
      m.userData.part = 'custom';
      m.userData.isSkin = false;
      m.userData.skAncestor = e.skAncestor;
      bodyV.push(m);
      group.add(m);
    });
  }

  applySkin();
  rebuildCloth(SK, root, clothV, getDims);
  syncCam();
}
