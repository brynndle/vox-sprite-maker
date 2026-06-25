let _currentHandle = null;

export function showLauncher() {
  document.getElementById('launcher-root').style.display = '';
  document.getElementById('editor-root').style.display = 'none';
  _currentHandle = null;
}

export async function showEditor(handle = null, decoded = null) {
  _currentHandle = handle;
  document.getElementById('launcher-root').style.display = 'none';
  document.getElementById('editor-root').style.display = '';
}

export function getCurrentHandle() { return _currentHandle; }
export function setCurrentHandle(h) { _currentHandle = h; }
