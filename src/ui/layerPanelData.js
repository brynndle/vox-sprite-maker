export const SK_ORDER = ['head','torso','lArm','lElbow','rArm','rElbow','lLeg','lKnee','rLeg','rKnee'];

export const SK_LABELS = {
  head: 'Head', torso: 'Torso',
  lArm: 'L Shoulder', lElbow: 'L Elbow',
  rArm: 'R Shoulder', rElbow: 'R Elbow',
  lLeg: 'L Hip',      lKnee:  'L Knee',
  rLeg: 'R Hip',      rKnee:  'R Knee',
};

const PART_LABELS = {
  head: 'Head', torso: 'Torso', pelvis: 'Pelvis',
  lUpperArm: 'L Upper Arm', lLowerArm: 'L Lower Arm', lHand: 'L Hand',
  rUpperArm: 'R Upper Arm', rLowerArm: 'R Lower Arm', rHand: 'R Hand',
  lUpperLeg: 'L Upper Leg', lLowerLeg: 'L Lower Leg', lFoot: 'L Foot',
  rUpperLeg: 'R Upper Leg', rLowerLeg: 'R Lower Leg', rFoot: 'R Foot',
};

const PART_TO_SK = {
  head: 'head', pelvis: 'torso', torso: 'torso',
  lUpperArm: 'lArm',  lLowerArm: 'lElbow', lHand: 'lElbow',
  rUpperArm: 'rArm',  rLowerArm: 'rElbow', rHand: 'rElbow',
  lUpperLeg: 'lLeg',  lLowerLeg: 'lKnee',  lFoot: 'lKnee',
  rUpperLeg: 'rLeg',  rLowerLeg: 'rKnee',  rFoot: 'rKnee',
};

export function getMeshSkKey(mesh, SK, root) {
  if (mesh.userData.skAncestor) return mesh.userData.skAncestor;
  let obj = mesh.parent;
  while (obj) {
    if (obj === root) return 'torso';
    const entry = Object.entries(SK).find(([, g]) => g === obj);
    if (entry) return entry[0];
    obj = obj.parent;
  }
  return null;
}

export function buildBoneGroupData(bodyV, clothV, SK, root) {
  const groups = new Map(SK_ORDER.map(k => [k, { label: SK_LABELS[k], rows: [] }]));

  const byPart = new Map();
  bodyV.filter(m => m.userData.part !== 'custom').forEach(m => {
    const p = m.userData.part;
    if (!byPart.has(p)) byPart.set(p, []);
    byPart.get(p).push(m);
  });
  byPart.forEach((meshes, part) => {
    const sk = PART_TO_SK[part];
    if (sk && groups.has(sk)) {
      groups.get(sk).rows.push({ id: `body-${part}`, label: PART_LABELS[part] || part, type: 'body', meshes, draggable: false });
    }
  });

  const byCloth = new Map();
  clothV.forEach(m => {
    const piece = m.userData.clothPiece || '?';
    const sk = getMeshSkKey(m, SK, root);
    if (!sk) return;
    const key = `${piece}::${sk}`;
    if (!byCloth.has(key)) byCloth.set(key, { piece, sk, meshes: [] });
    byCloth.get(key).meshes.push(m);
  });
  byCloth.forEach(({ piece, sk, meshes }) => {
    if (!groups.has(sk)) return;
    const label = `${piece[0].toUpperCase()}${piece.slice(1)} · ${SK_LABELS[sk] || sk}`;
    groups.get(sk).rows.push({ id: `cloth-${piece}-${sk}`, label, type: 'cloth', meshes, draggable: false });
  });

  let ci = 0;
  bodyV.filter(m => m.userData.part === 'custom').forEach(m => {
    const sk = m.userData.skAncestor;
    if (!groups.has(sk)) return;
    groups.get(sk).rows.push({ id: `custom-${ci}`, label: `Custom #${ci + 1}`, type: 'custom', meshes: [m], draggable: true });
    ci++;
  });

  return groups;
}

export function buildLayerGroupData(bodyV, clothV, WDEFS, customWardrobe, equipped) {
  const byPart = new Map();
  bodyV.filter(m => m.userData.part !== 'custom').forEach(m => {
    const p = m.userData.part;
    if (!byPart.has(p)) byPart.set(p, []);
    byPart.get(p).push(m);
  });
  const bodyRows = [...byPart.entries()].map(([part, meshes]) => ({
    id: `body-${part}`, label: PART_LABELS[part] || part, type: 'body', meshes,
  }));

  const clothByPiece = new Map();
  clothV.forEach(m => {
    const p = m.userData.clothPiece || '?';
    if (!clothByPiece.has(p)) clothByPiece.set(p, []);
    clothByPiece.get(p).push(m);
  });

  const allPieces = { ...WDEFS, ...customWardrobe };
  const clothingRows = Object.entries(allPieces).map(([key, def]) => ({
    id: `cloth-${key}`, label: def.label, type: 'cloth',
    clothKey: key, slot: def.slot,
    isEquipped: equipped[def.slot] === key,
    meshes: clothByPiece.get(key) || [],
  }));

  let ci = 0;
  const customRows = bodyV
    .filter(m => m.userData.part === 'custom')
    .map(m => ({ id: `custom-${ci}`, label: `Custom #${++ci}`, type: 'custom', meshes: [m] }));

  return { bodyRows, clothingRows, customRows };
}
