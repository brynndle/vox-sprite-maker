const KEY = 'vox_wardrobe';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}

export const customWardrobe = load();

export function saveCloth(id, def) {
  customWardrobe[id] = def;
  try { localStorage.setItem(KEY, JSON.stringify(customWardrobe)); } catch {}
}

export function deleteCloth(id) {
  delete customWardrobe[id];
  try { localStorage.setItem(KEY, JSON.stringify(customWardrobe)); } catch {}
}
