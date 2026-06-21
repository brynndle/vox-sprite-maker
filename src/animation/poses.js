import { VOXEL_SIZE } from '../constants.js';
import { state } from '../state.js';

export function resetPose(SK, root) {
  if (!SK.lArm) return;
  SK.lArm.rotation.set(0, 0, 0.12); SK.rArm.rotation.set(0, 0, -0.12);
  SK.lLeg.rotation.set(0, 0, 0); SK.rLeg.rotation.set(0, 0, 0);
  if (SK.lElbow) SK.lElbow.rotation.set(0, 0, 0);
  if (SK.rElbow) SK.rElbow.rotation.set(0, 0, 0);
  if (SK.lKnee) SK.lKnee.rotation.set(0, 0, 0);
  if (SK.rKnee) SK.rKnee.rotation.set(0, 0, 0);
  root.position.y = 0; root.rotation.x = 0;
}

export function animPose(t, SK, root) {
  if (!SK.lArm) return;
  resetPose(SK, root);
  const s = Math.sin(t * Math.PI * 2);
  if (state.anim === 'idle') {
    SK.lArm.rotation.z = 0.12 + s * 0.02;
    SK.rArm.rotation.z = -0.12 - s * 0.02;
  } else if (state.anim === 'walk') {
    const sw = s * 0.55;
    SK.lArm.rotation.x = -sw * 0.6; SK.rArm.rotation.x = sw * 0.6;
    SK.lArm.rotation.z = 0.1; SK.rArm.rotation.z = -0.1;
    SK.lLeg.rotation.x = sw * 0.7; SK.rLeg.rotation.x = -sw * 0.7;
    SK.lKnee.rotation.x = sw < 0 ? -sw * 0.5 : 0;
    SK.rKnee.rotation.x = sw > 0 ? sw * 0.5 : 0;
    root.position.y = (Math.abs(s) * 0.15 - 0.05) * VOXEL_SIZE;
  } else if (state.anim === 'run') {
    const sw = s * 0.9;
    SK.lArm.rotation.x = -sw * 1.1; SK.rArm.rotation.x = sw * 1.1;
    SK.lArm.rotation.z = 0.25; SK.rArm.rotation.z = -0.25;
    SK.lElbow.rotation.x = sw > 0 ? -sw * 1.2 : -sw * 0.2;
    SK.rElbow.rotation.x = sw < 0 ? sw * 1.2 : sw * 0.2;
    SK.lLeg.rotation.x = sw * 1.1; SK.rLeg.rotation.x = -sw * 1.1;
    SK.lKnee.rotation.x = sw < 0 ? -sw * 1.3 : 0;
    SK.rKnee.rotation.x = sw > 0 ? sw * 1.3 : 0;
    root.position.y = (Math.abs(s) * 0.35 - 0.1) * VOXEL_SIZE;
    root.rotation.x = -0.07;
  } else if (state.anim === 'sit') {
    SK.lLeg.rotation.x = -1.5; SK.rLeg.rotation.x = -1.5;
    SK.lKnee.rotation.x = 1.45; SK.rKnee.rotation.x = 1.45;
    SK.lArm.rotation.x = 0.3; SK.rArm.rotation.x = 0.3;
    SK.lArm.rotation.z = 0.5; SK.rArm.rotation.z = -0.5;
    SK.lElbow.rotation.x = 0.4; SK.rElbow.rotation.x = 0.4;
    root.position.y = -VOXEL_SIZE * 4;
  }
}
