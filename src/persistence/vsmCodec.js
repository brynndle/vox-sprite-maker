export const DEFAULTS = {
  version: 1,
  colors: { skin: '#e8c49a', hairCol: '#2c1810', featCol: '#1a1a1a', col: '#4a90d9' },
  bodyShape: { hW: 1, hH: 1, tW: 1, tH: 1, aW: 1, aL: 1, lW: 1, lL: 1, fS: 1 },
  face: { eyes: 'dot', brows: 'none', mouth: 'smile', nose: 'none', hair: 'none' },
  equipped: {},
  savedParts: {},
  customWardrobe: {},
};

export function encode(data) {
  return JSON.stringify(data);
}

export function decode(json) {
  let d;
  try { d = JSON.parse(json); } catch { throw new Error('Invalid .vsm: not valid JSON'); }
  if (!d.version) throw new Error('Invalid .vsm: missing version field');
  return {
    version: d.version,
    colors:        { ...DEFAULTS.colors,    ...(d.colors     || {}) },
    bodyShape:     { ...DEFAULTS.bodyShape, ...(d.bodyShape  || {}) },
    face:          { ...DEFAULTS.face,      ...(d.face       || {}) },
    equipped:      d.equipped      || {},
    savedParts:    d.savedParts    || {},
    customWardrobe:d.customWardrobe|| {},
  };
}
