import { voxBlock } from './voxels.js';
import { customWardrobe } from './wardrobe.js';

export const WDEFS = {
  shirt:  { label: 'Shirt',  slot: 'top',  color: '#e63946', style: 'shirt' },
  pants:  { label: 'Pants',  slot: 'legs', color: '#2d3a4a', style: 'pants' },
  coat:   { label: 'Coat',   slot: 'top',  color: '#1a2a1a', style: 'coat' },
  shoes:  { label: 'Shoes',  slot: 'feet', color: '#222233', style: 'shoes' },
  hat:    { label: 'Hat',    slot: 'head', color: '#8b0000', style: 'hat' },
  shorts: { label: 'Shorts', slot: 'legs', color: '#1a4a8a', style: 'shorts' },
};

export const equipped = {};

export function rebuildCloth(SK, root, clothV, getDims) {
  clothV.length = 0;
  ['lArm', 'rArm', 'lElbow', 'rElbow', 'lLeg', 'rLeg', 'lKnee', 'rKnee', 'head'].forEach(k => {
    if (SK[k]) SK[k].children.filter(c => c.userData.isClothGroup).forEach(c => SK[k].remove(c));
  });
  root.children.filter(c => c.userData.isClothGroup).forEach(c => root.remove(c));
  if (!SK.lArm) return;

  const { TW, TH, TD, AW, UAH, LAH, LW, ULH, LLH, FW, FD, FH, HW, HH, HD, sc } = getDims();
  const hipY = LLH + ULH, torsoY = hipY;
  const C = 1;

  function cBlock(cols, rows, depth, color, opts = {}, pieceKey = '') {
    const b = voxBlock(cols, rows, depth, color, opts);
    b.g.userData.isClothGroup = true;
    b.ms.forEach(m => { m.userData.isCloth = true; m.userData.clothPiece = pieceKey; clothV.push(m); });
    return b;
  }

  Object.entries(equipped).forEach(([slot, k]) => {
    const d = WDEFS[k] || customWardrobe[k];
    if (!d) return;
    if (slot === 'top') {
      const ext = d.style === 'coat' ? Math.round(sc * 2) : 0;
      const tb = cBlock(TW + C * 2, TH + ext, TD + C * 2, d.color, {}, k);
      tb.g.position.set(-C * 0.5, (torsoY - ext), -C * 0.5);
      root.add(tb.g);
      ['l', 'r'].forEach(s => {
        const us = cBlock(AW + C, UAH, AW + C, d.color, { roundCorners: true }, k);
        us.g.position.set(0, -UAH, 0); SK[s + 'Arm'].add(us.g);
        if (d.style === 'coat') {
          const ls = cBlock(AW + C, LAH, AW + C, d.color, { roundCorners: true }, k);
          ls.g.position.set(0, -LAH, 0); SK[s + 'Elbow'].add(ls.g);
        }
      });
    }
    if (slot === 'legs') {
      const isS = d.style === 'shorts';
      ['l', 'r'].forEach(s => {
        const ul = cBlock(LW + C, ULH, LW + C, d.color, {}, k); ul.g.position.set(0, -ULH, 0); SK[s + 'Leg'].add(ul.g);
        if (!isS) { const ll = cBlock(LW + C, LLH, LW + C, d.color, {}, k); ll.g.position.set(0, -LLH, 0); SK[s + 'Knee'].add(ll.g); }
      });
    }
    if (slot === 'feet') {
      ['l', 'r'].forEach(s => {
        const sh = cBlock(FW + 1, FH + 1, FD + 1, d.color, { roundCorners: true }, k);
        sh.g.position.set(0, -(LLH + FH + 1), (FD / 2 - LW / 2)); SK[s + 'Knee'].add(sh.g);
      });
    }
    if (slot === 'head') {
      const brim = cBlock(HW + 2, Math.max(1, Math.round(sc * 0.5)), HD + 2, d.color, {}, k);
      brim.g.position.set(0, HH, 0); SK.head.add(brim.g);
      const top = cBlock(HW, Math.max(1, Math.round(sc * 1.5)), HD, d.color, { roundCorners: true }, k);
      top.g.position.set(0, (HH + Math.max(1, Math.round(sc * 0.5))), 0); SK.head.add(top.g);
    }
  });
}
