import { defaultSeed } from './defaultSeed.js';

const KEY = 'vox_parts';

function load() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return JSON.parse(stored) || {};
    if (defaultSeed) return structuredClone(defaultSeed);
    return {};
  }
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
