import { SK, root, bodyV, clothV } from '../character/skeleton.js';
import { WDEFS, equipped } from '../character/clothing.js';
import { customWardrobe } from '../character/wardrobe.js';
import { SK_ORDER, SK_LABELS, buildBoneGroupData, buildLayerGroupData } from './layerPanelData.js';

const _boneView  = document.getElementById('lp-bone-view');
const _layerView = document.getElementById('lp-layer-view');
const _tabBone   = document.getElementById('lp-tab-bone');
const _tabLayers = document.getElementById('lp-tab-layers');

_tabBone.addEventListener('click',   () => { _tabBone.classList.add('on');   _tabLayers.classList.remove('on'); _boneView.style.display = '';     _layerView.style.display = 'none'; });
_tabLayers.addEventListener('click', () => { _tabLayers.classList.add('on'); _tabBone.classList.remove('on');   _layerView.style.display = '';    _boneView.style.display = 'none'; });

// ── Collapse state ────────────────────────────────────────────────────────────
const _collapsed = new Set();  // set of group ids that are collapsed

function _toggle(id) {
  if (_collapsed.has(id)) _collapsed.delete(id);
  else _collapsed.add(id);
}

// ── Visibility state ──────────────────────────────────────────────────────────
const _hidden = new Set();  // set of row ids that are hidden

function _setRowVisible(rowId, visible, meshes) {
  if (visible) _hidden.delete(rowId);
  else _hidden.add(rowId);
  meshes.forEach(m => { m.visible = visible; });
}

// ── DOM builders ──────────────────────────────────────────────────────────────
function _makeEye(id, meshes) {
  const span = document.createElement('span');
  span.className = 'lp-eye' + (_hidden.has(id) ? ' lp-hidden' : '');
  span.textContent = '👁';
  span.dataset.eyeId = id;
  span.addEventListener('click', e => {
    e.stopPropagation();
    const nowVisible = _hidden.has(id);
    _setRowVisible(id, nowVisible, meshes);
    span.classList.toggle('lp-hidden', !nowVisible);
  });
  return span;
}

function _makeRow(row) {
  const div = document.createElement('div');
  div.className = 'lp-row' + (row.type === 'cloth' ? ' lp-cloth-row' : '');
  if (row.draggable) div.draggable = true;
  div.dataset.rowId = row.id;
  div.appendChild(_makeEye(row.id, row.meshes));
  const lbl = document.createElement('span');
  lbl.className = 'lp-label';
  lbl.textContent = row.label;
  div.appendChild(lbl);
  return div;
}

function _makeGroupSection(id, label, rows) {
  const section = document.createElement('div');
  section.className = 'lp-group';
  section.dataset.groupId = id;

  const header = document.createElement('div');
  header.className = 'lp-header';
  header.dataset.groupId = id;
  const toggle = document.createElement('span');
  toggle.className = 'lp-toggle';
  toggle.textContent = _collapsed.has(id) ? '▶' : '▼';

  // Create children div first, before eye (eye handler needs it)
  const children = document.createElement('div');
  children.className = 'lp-group-children';
  children.style.display = _collapsed.has(id) ? 'none' : '';
  rows.forEach(row => children.appendChild(_makeRow(row)));

  // Group eye with cascade handler
  const groupEyeId = 'group-' + id;
  const allMeshes = rows.flatMap(r => r.meshes);
  const eye = document.createElement('span');
  eye.className = 'lp-eye' + (_hidden.has(groupEyeId) ? ' lp-hidden' : '');
  eye.textContent = '👁';
  eye.addEventListener('click', e => {
    e.stopPropagation();
    const nowVisible = _hidden.has(groupEyeId);
    _setRowVisible(groupEyeId, nowVisible, allMeshes);
    eye.classList.toggle('lp-hidden', !nowVisible);
    // cascade: update child eye icons in the DOM
    children.querySelectorAll('.lp-eye').forEach(childEye => {
      const childId = childEye.dataset.eyeId;
      if (childId) {
        if (nowVisible) _hidden.delete(childId);
        else _hidden.add(childId);
        childEye.classList.toggle('lp-hidden', !nowVisible);
      }
    });
    // apply visibility to all child meshes individually
    rows.forEach(row => {
      if (nowVisible) _hidden.delete(row.id);
      else _hidden.add(row.id);
      row.meshes.forEach(m => { m.visible = nowVisible; });
    });
  });

  const lbl = document.createElement('span');
  lbl.className = 'lp-label';
  lbl.style.fontWeight = '600';
  lbl.textContent = label;
  header.appendChild(toggle);
  header.appendChild(eye);
  header.appendChild(lbl);
  section.appendChild(header);
  section.appendChild(children);

  header.addEventListener('click', e => {
    if (e.target.classList.contains('lp-eye')) return; // eye handled separately
    _toggle(id);
    toggle.textContent = _collapsed.has(id) ? '▶' : '▼';
    children.style.display = _collapsed.has(id) ? 'none' : '';
  });

  return section;
}

// ── Render ────────────────────────────────────────────────────────────────────
function _renderBoneView() {
  _boneView.innerHTML = '';
  const groups = buildBoneGroupData(bodyV, clothV, SK, root);
  groups.forEach((group, skKey) => {
    if (group.rows.length === 0 && !_collapsed.has(skKey)) _collapsed.add(skKey); // auto-collapse empty groups once
    _boneView.appendChild(_makeGroupSection(skKey, group.label, group.rows));
  });
}

function _renderLayerView() {
  _layerView.innerHTML = '';
  const { bodyRows, clothingRows, customRows } = buildLayerGroupData(bodyV, clothV, WDEFS, customWardrobe, equipped);

  if (bodyRows.length)    _layerView.appendChild(_makeGroupSection('cat-body',    'Body',     bodyRows));
  if (clothingRows.length) _layerView.appendChild(_makeGroupSection('cat-cloth',  'Clothing', clothingRows));
  if (customRows.length)  _layerView.appendChild(_makeGroupSection('cat-custom',  'Custom',   customRows));
}

// ── Public API ────────────────────────────────────────────────────────────────
export function refresh() {
  _renderBoneView();
  _renderLayerView();
}

export function init() {
  refresh();
}
