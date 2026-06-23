import * as THREE from 'three';
import { SK, root, bodyV, clothV } from '../character/skeleton.js';
import { savedParts } from '../character/parts.js';
import { WDEFS, equipped } from '../character/clothing.js';
import { customWardrobe } from '../character/wardrobe.js';
import { getMeshSkKey, buildBoneGroupData, buildLayerGroupData, SK_ORDER, SK_LABELS } from './layerPanelData.js';

export { getMeshSkKey, buildBoneGroupData, buildLayerGroupData, SK_ORDER, SK_LABELS };
