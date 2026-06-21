export const OUT_W = 16;
export const OUT_H = 32;
export const CHAR_PX_HEIGHT = 28;
export const VOXEL_SIZE = OUT_H / CHAR_PX_HEIGHT; // ≈ 1.143 world units per voxel
export const VOXEL_GAP = 0.88;
export const DISPLAY_SCALE = 8;
export const ORTHO_CAM_Y = OUT_H * 0.39;

export const BASE_DIMS = {
  headW: 8,  headH: 8,  headD: 6,
  torsoW: 6, torsoH: 7, torsoD: 4,
  uArmW: 2,  uArmH: 4,  uArmD: 2,
  lArmW: 2,  lArmH: 3,  lArmD: 2,
  handW: 2,  handH: 2,  handD: 2,
  uLegW: 3,  uLegH: 6,  uLegD: 3,
  lLegW: 3,  lLegH: 6,  lLegD: 3,
  footW: 4,  footH: 2,  footD: 4,
};

export const DIRS_8 = [
  { name: 'south',     theta: 0.01   },
  { name: 'southwest', theta: 0.785  },
  { name: 'west',      theta: 1.571  },
  { name: 'northwest', theta: 2.356  },
  { name: 'north',     theta: 3.14   },
  { name: 'northeast', theta: -2.356 },
  { name: 'east',      theta: -1.571 },
  { name: 'southeast', theta: -0.785 },
];
