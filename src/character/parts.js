const KEY = 'vox_parts';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}

export const savedParts = load();

export function savePart(name, data) {
  savedParts[name] = data;
  try { localStorage.setItem(KEY, JSON.stringify(savedParts)); } catch {}
}

export function resetPart(name) {
  delete savedParts[name];
  try { localStorage.setItem(KEY, JSON.stringify(savedParts)); } catch {}
}
