import { getAllHandles, removeHandle, saveHandle } from '../persistence/fileStore.js';
import { decode } from '../persistence/vsmCodec.js';
import { showEditor } from './screenManager.js';

const BUILTINS = [
  { id: 'base_human',   label: 'Human'   },
  { id: 'base_compact', label: 'Compact' },
  { id: 'base_tall',    label: 'Tall'    },
];

export async function init() {
  await render();
  document.getElementById('launcher-root').addEventListener('click', _onCardClick);
}

export async function render() {
  let handles = [];
  try { handles = await getAllHandles(); } catch {}

  // Drop stale handles (file moved/deleted)
  const valid = [];
  for (const h of handles) {
    try { await h.handle.getFile(); valid.push(h); }
    catch { removeHandle(h.name).catch(() => {}); }
  }

  document.getElementById('launcher-root').innerHTML = `
    <div class="ln-topbar">
      <div class="ln-title">Voxel Sprite Maker</div>
      <button class="ln-btn" id="ln-open-btn">Open File</button>
      <button class="ln-btn ln-btn-primary" id="ln-new-btn">+ New Sprite</button>
    </div>
    <div class="ln-gallery">
      <div class="ln-section-label">My Sprites</div>
      <div class="ln-grid">
        <div class="ln-empty-card" data-action="new">
          <div class="ln-plus">+</div>
          <div>New Sprite</div>
        </div>
        ${valid.map(_userCard).join('')}
      </div>
      <div class="ln-section-label">Built-in Library</div>
      <div class="ln-grid">
        ${BUILTINS.map(_builtinCard).join('')}
      </div>
    </div>
  `;

  document.getElementById('ln-new-btn').addEventListener('click', () => showEditor());
  document.getElementById('ln-open-btn').addEventListener('click', _openFile);
}

function _userCard(h) {
  const date = new Date(h.savedAt).toLocaleDateString();
  return `<div class="ln-card" data-handle="${_esc(h.name)}">
    <div class="ln-thumb">${_silhouette()}</div>
    <div class="ln-meta">
      <div class="ln-name">${_esc(h.name)}</div>
      <div class="ln-date">${date}</div>
    </div>
  </div>`;
}

function _builtinCard(b) {
  return `<div class="ln-card" data-builtin="${b.id}">
    <div class="ln-thumb">
      <div class="ln-built-badge">built-in</div>
      ${_silhouette()}
    </div>
    <div class="ln-meta">
      <div class="ln-name">${b.label}</div>
      <div class="ln-date">Built-in</div>
    </div>
  </div>`;
}

function _silhouette() {
  return `<div class="ln-vox-fig">
    <div class="ln-vox-head"></div>
    <div class="ln-vox-arms">
      <div class="ln-vox-arm"></div>
      <div class="ln-vox-body"></div>
      <div class="ln-vox-arm"></div>
    </div>
    <div class="ln-vox-legs">
      <div class="ln-vox-leg"></div>
      <div class="ln-vox-leg"></div>
    </div>
  </div>`;
}

async function _onCardClick(e) {
  const card = e.target.closest('[data-action],[data-handle],[data-builtin]');
  if (!card) return;

  if (card.dataset.action === 'new') { showEditor(); return; }

  if (card.dataset.builtin) {
    try {
      const res = await fetch(`/defaults/${card.dataset.builtin}.vsm`);
      if (!res.ok) throw new Error('not found');
      showEditor(null, decode(await res.text()));
    } catch { showEditor(); }
    return;
  }

  if (card.dataset.handle) {
    const name = card.dataset.handle;
    try {
      const all = await getAllHandles();
      const entry = all.find(h => h.name === name);
      if (entry) showEditor(entry.handle);
    } catch {}
  }
}

async function _openFile() {
  let handle;
  try {
    [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Voxel Sprite', accept: { 'application/json': ['.vsm'] } }],
    });
  } catch { return; } // user cancelled
  await saveHandle(handle).catch(() => {});
  showEditor(handle);
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
