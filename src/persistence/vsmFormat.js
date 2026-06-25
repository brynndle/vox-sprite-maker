import { state } from '../state.js';
import { savedParts } from '../character/parts.js';
import { customWardrobe } from '../character/wardrobe.js';
import { equipped } from '../character/clothing.js';
import { rebuild, SK, root } from '../character/skeleton.js';
import { resetPose } from '../animation/poses.js';
import { captureDefaults } from '../ui/poseEditor.js';
import { refresh as lpRefresh } from '../ui/layerPanel.js';
import { encode, DEFAULTS } from './vsmCodec.js';

export function snapshot() {
  return encode({
    version: 1,
    colors: {
      skin:    state.skin,
      hairCol: state.hairCol,
      featCol: state.featCol,
      col:     state.col,
    },
    bodyShape: { ...state.S },
    face: {
      eyes:  state.activeEyes,
      brows: state.activeBrows,
      mouth: state.activeMouth,
      nose:  state.activeNose,
      hair:  state.activeHair,
    },
    equipped:       { ...equipped },
    savedParts:     structuredClone(savedParts),
    customWardrobe: structuredClone(customWardrobe),
  });
}

export function applySnapshot(decoded) {
  const { colors, bodyShape, face } = decoded;

  state.skin    = colors.skin;
  state.hairCol = colors.hairCol;
  state.featCol = colors.featCol;
  state.col     = colors.col;

  Object.assign(state.S, bodyShape);

  state.activeEyes  = face.eyes;
  state.activeBrows = face.brows;
  state.activeMouth = face.mouth;
  state.activeNose  = face.nose;
  state.activeHair  = face.hair;

  Object.keys(savedParts).forEach(k => delete savedParts[k]);
  Object.assign(savedParts, decoded.savedParts);

  Object.keys(customWardrobe).forEach(k => delete customWardrobe[k]);
  Object.assign(customWardrobe, decoded.customWardrobe);

  Object.keys(equipped).forEach(k => delete equipped[k]);
  Object.assign(equipped, decoded.equipped);

  rebuild();
  resetPose(SK, root);
  captureDefaults();
  lpRefresh();
}
