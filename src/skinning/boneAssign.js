import * as THREE from 'three';

export const JOINT_SK = {
  head:      'head',
  torso:     'torso',
  lShoulder: 'lArm',
  lElbow:    'lElbow',
  rShoulder: 'rArm',
  rElbow:    'rElbow',
  lHip:      'lLeg',
  lKnee:     'lKnee',
  rHip:      'rLeg',
  rKnee:     'rKnee',
};

// Clavicle pairs (torso↔lShoulder↔head) are intentionally excluded — they
// produce unintuitive bone assignments for blocks near the collar/neck.
export const BONE_PAIR_IDS = [
  ['torso',     'head'],
  ['torso',     'lShoulder'],
  ['torso',     'rShoulder'],
  ['torso',     'lHip'],
  ['torso',     'rHip'],
  ['lShoulder', 'lElbow'],
  ['rShoulder', 'rElbow'],
  ['lHip',      'lKnee'],
  ['rHip',      'rKnee'],
];

const _A       = new THREE.Vector3();
const _B       = new THREE.Vector3();
const _AB      = new THREE.Vector3();
const _AP      = new THREE.Vector3();
const _closest = new THREE.Vector3();

/**
 * Returns the SK key of the bone endpoint closest to blockWorldPos.
 * Runs point-to-segment distance for each structural bone pair; on the
 * winning segment the closer of the two endpoints wins.
 */
export function assignBone(blockWorldPos, SK) {
  let bestDist = Infinity;
  let bestKey  = 'torso';

  for (const [aId, bId] of BONE_PAIR_IDS) {
    const ag = SK[JOINT_SK[aId]];
    const bg = SK[JOINT_SK[bId]];
    if (!ag || !bg) continue;

    ag.getWorldPosition(_A);
    bg.getWorldPosition(_B);

    _AB.subVectors(_B, _A);
    _AP.subVectors(blockWorldPos, _A);
    const lenSq = _AB.lengthSq();
    const t     = lenSq > 0 ? Math.max(0, Math.min(1, _AP.dot(_AB) / lenSq)) : 0;
    _closest.copy(_A).addScaledVector(_AB, t);

    const dist = blockWorldPos.distanceTo(_closest);
    if (dist < bestDist) {
      bestDist = dist;
      const dA = blockWorldPos.distanceTo(_A);
      const dB = blockWorldPos.distanceTo(_B);
      bestKey  = JOINT_SK[dA <= dB ? aId : bId];
    }
  }

  return bestKey;
}
