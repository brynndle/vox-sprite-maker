import { decode, DEFAULTS } from '../persistence/vsmCodec.js';
import { applySnapshot } from '../persistence/vsmFormat.js';
import { encode } from '../persistence/vsmCodec.js';

let _currentHandle = null;

export function showLauncher() {
  document.getElementById('launcher-root').style.display = '';
  document.getElementById('editor-root').style.display = 'none';
  _currentHandle = null;
}

export async function showEditor(handle = null, decoded = null) {
  _currentHandle = handle;
  if (decoded) {
    applySnapshot(decoded);
  } else if (handle) {
    try {
      const file = await handle.getFile();
      applySnapshot(decode(await file.text()));
    } catch {
      applySnapshot(decode(encode(DEFAULTS)));
    }
  } else {
    applySnapshot(decode(encode(DEFAULTS)));
  }
  document.getElementById('launcher-root').style.display = 'none';
  document.getElementById('editor-root').style.display = '';
}

export function getCurrentHandle() { return _currentHandle; }
export function setCurrentHandle(h) { _currentHandle = h; }
