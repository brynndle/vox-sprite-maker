import { describe, it, expect } from 'vitest';
import { getMeshSkKey, buildBoneGroupData, buildLayerGroupData } from '../src/ui/layerPanelData.js';

const mkGroup = () => ({ _type: 'Group' });
const mkParentChain = (...chain) => {
  // chain[0] is the mesh's direct parent, chain[n-1] is the root
  for (let i = 0; i < chain.length - 1; i++) chain[i].parent = chain[i + 1];
  chain[chain.length - 1].parent = null;
  return chain;
};

describe('getMeshSkKey', () => {
  it('returns skAncestor directly for custom blocks', () => {
    const mesh = { userData: { part: 'custom', skAncestor: 'lArm' }, parent: null };
    expect(getMeshSkKey(mesh, {}, null)).toBe('lArm');
  });

  it('walks parent chain to find SK group', () => {
    const skGroup = mkGroup();
    const voxGroup = mkGroup();
    mkParentChain(voxGroup, skGroup);
    const mesh = { userData: { part: 'torso' }, parent: voxGroup };
    const SK = { torso: skGroup };
    expect(getMeshSkKey(mesh, SK, null)).toBe('torso');
  });

  it('returns "torso" for meshes whose parent chain reaches root', () => {
    const root = mkGroup();
    const clothGroup = mkGroup();
    mkParentChain(clothGroup, root);
    const mesh = { userData: { isCloth: true }, parent: clothGroup };
    expect(getMeshSkKey(mesh, {}, root)).toBe('torso');
  });

  it('returns null when no SK group found and root is null', () => {
    const mesh = { userData: { part: 'unknown' }, parent: null };
    expect(getMeshSkKey(mesh, {}, null)).toBeNull();
  });
});

describe('buildBoneGroupData', () => {
  const SK = Object.fromEntries(['head','torso','lArm','lElbow','rArm','rElbow','lLeg','lKnee','rLeg','rKnee'].map(k => [k, mkGroup()]));
  const ROOT = mkGroup();

  it('creates all 10 bone groups', () => {
    const groups = buildBoneGroupData([], [], SK, ROOT);
    expect(groups.size).toBe(10);
  });

  it('places body voxel under correct bone group (torso part → torso group)', () => {
    const vg = mkGroup(); mkParentChain(vg, SK.torso);
    const m = { userData: { part: 'torso' }, parent: vg };
    const groups = buildBoneGroupData([m], [], SK, ROOT);
    expect(groups.get('torso').rows).toHaveLength(1);
    expect(groups.get('torso').rows[0].type).toBe('body');
    expect(groups.get('torso').rows[0].draggable).toBe(false);
  });

  it('aggregates multiple voxels with the same part into one row', () => {
    const vg = mkGroup(); mkParentChain(vg, SK.head);
    const m1 = { userData: { part: 'head' }, parent: vg };
    const m2 = { userData: { part: 'head' }, parent: vg };
    const groups = buildBoneGroupData([m1, m2], [], SK, ROOT);
    expect(groups.get('head').rows).toHaveLength(1);
    expect(groups.get('head').rows[0].meshes).toHaveLength(2);
  });

  it('places custom block under its skAncestor, marks draggable', () => {
    const m = { userData: { part: 'custom', skAncestor: 'lArm' }, parent: null };
    const groups = buildBoneGroupData([m], [], SK, ROOT);
    expect(groups.get('lArm').rows).toHaveLength(1);
    expect(groups.get('lArm').rows[0].draggable).toBe(true);
    expect(groups.get('lArm').rows[0].label).toBe('Custom #1');
  });

  it('places shirt-torso cloth under torso (root parent → torso)', () => {
    const cg = mkGroup(); mkParentChain(cg, ROOT);
    const m = { userData: { isCloth: true, clothPiece: 'shirt' }, parent: cg };
    const groups = buildBoneGroupData([], [m], SK, ROOT);
    expect(groups.get('torso').rows).toHaveLength(1);
    expect(groups.get('torso').rows[0].type).toBe('cloth');
  });
});

describe('buildLayerGroupData', () => {
  const WDEFS_MOCK = {
    shirt: { label: 'Shirt', slot: 'top', style: 'shirt' },
    pants: { label: 'Pants', slot: 'legs', style: 'pants' },
  };

  it('returns empty sections when no meshes or clothing', () => {
    const { bodyRows, clothingRows, customRows } = buildLayerGroupData([], [], WDEFS_MOCK, {}, {});
    expect(bodyRows).toHaveLength(0);
    expect(clothingRows).toHaveLength(2); // all pieces listed, even unequipped
    expect(customRows).toHaveLength(0);
  });

  it('marks equipped clothing correctly', () => {
    const { clothingRows } = buildLayerGroupData([], [], WDEFS_MOCK, {}, { top: 'shirt' });
    const shirt = clothingRows.find(r => r.clothKey === 'shirt');
    const pants = clothingRows.find(r => r.clothKey === 'pants');
    expect(shirt.isEquipped).toBe(true);
    expect(pants.isEquipped).toBe(false);
  });

  it('provides meshes for equipped clothing rows', () => {
    const m = { userData: { isCloth: true, clothPiece: 'shirt' } };
    const { clothingRows } = buildLayerGroupData([], [m], WDEFS_MOCK, {}, { top: 'shirt' });
    const shirt = clothingRows.find(r => r.clothKey === 'shirt');
    expect(shirt.meshes).toHaveLength(1);
  });
});
