import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { assignBone, JOINT_SK, BONE_PAIR_IDS } from '../src/skinning/boneAssign.js';

function mockGroup(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

// Approximate skeleton layout — world units, z=0 plane
const SK = {
  head:    mockGroup(0,  22, 0),
  torso:   mockGroup(0,  14, 0),
  lArm:    mockGroup(5,  20, 0),
  lElbow:  mockGroup(5,  16, 0),
  rArm:    mockGroup(-5, 20, 0),
  rElbow:  mockGroup(-5, 16, 0),
  lLeg:    mockGroup(2,  12, 0),
  lKnee:   mockGroup(2,   6, 0),
  rLeg:    mockGroup(-2, 12, 0),
  rKnee:   mockGroup(-2,  6, 0),
};

describe('assignBone', () => {
  test('block at head position → head', () => {
    expect(assignBone(new THREE.Vector3(0, 22, 0), SK)).toBe('head');
  });
  test('block at torso position → torso', () => {
    expect(assignBone(new THREE.Vector3(0, 14, 0), SK)).toBe('torso');
  });
  test('block at left shoulder → lArm', () => {
    expect(assignBone(new THREE.Vector3(5, 20, 0), SK)).toBe('lArm');
  });
  test('block at left elbow → lElbow', () => {
    expect(assignBone(new THREE.Vector3(5, 16, 0), SK)).toBe('lElbow');
  });
  test('block at right elbow → rElbow', () => {
    expect(assignBone(new THREE.Vector3(-5, 16, 0), SK)).toBe('rElbow');
  });
  test('block at left knee → lKnee', () => {
    expect(assignBone(new THREE.Vector3(2, 6, 0), SK)).toBe('lKnee');
  });
  test('always returns a valid SK key', () => {
    const valid = ['head','torso','lArm','lElbow','rArm','rElbow','lLeg','lKnee','rLeg','rKnee'];
    expect(valid).toContain(assignBone(new THREE.Vector3(0, 10, 0), SK));
  });
});

describe('JOINT_SK', () => {
  test('lShoulder → lArm',  () => expect(JOINT_SK.lShoulder).toBe('lArm'));
  test('lHip → lLeg',       () => expect(JOINT_SK.lHip).toBe('lLeg'));
  test('rShoulder → rArm',  () => expect(JOINT_SK.rShoulder).toBe('rArm'));
  test('rHip → rLeg',       () => expect(JOINT_SK.rHip).toBe('rLeg'));
});

describe('BONE_PAIR_IDS', () => {
  test('has exactly 9 structural pairs', () => expect(BONE_PAIR_IDS).toHaveLength(9));
  test('excludes clavicle visual pair lShoulder↔head', () => {
    const hasIt = BONE_PAIR_IDS.some(([a, b]) =>
      (a === 'lShoulder' && b === 'head') || (a === 'head' && b === 'lShoulder')
    );
    expect(hasIt).toBe(false);
  });
  test('excludes clavicle visual pair rShoulder↔head', () => {
    const hasIt = BONE_PAIR_IDS.some(([a, b]) =>
      (a === 'rShoulder' && b === 'head') || (a === 'head' && b === 'rShoulder')
    );
    expect(hasIt).toBe(false);
  });
});
