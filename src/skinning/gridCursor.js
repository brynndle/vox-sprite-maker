import * as THREE from 'three';
import { scene } from '../renderer/scene.js';
import { state } from '../state.js';

let _activeZ  = 0;
let _snappedX = 0, _snappedY = 0;
let _dims     = null;

// ── Materials (shared, never rebuilt) ─────────────────────────────────────────
const _volMat   = new THREE.LineBasicMaterial({ color: 0x45475a, transparent: true, opacity: 0.3, depthTest: false });
const _layMat   = new THREE.LineBasicMaterial({ color: 0xcba6f7, transparent: true, opacity: 0.25, depthTest: false });
const _ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false });

// ── Ghost block (singleton) ───────────────────────────────────────────────────
const _ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), _ghostMat);
_ghost.renderOrder = 10;
_ghost.visible    = false;
_ghost.raycast    = () => {};
scene.add(_ghost);

// ── Grid geometry (rebuilt on showGrid) ───────────────────────────────────────
let _volLines = null;
let _layLines = null;

function _zRange(D) {
  const zMax = Math.floor(D / 2);
  return { zMin: zMax - (D - 1), zMax };
}

function _computeBounds(dims) {
  const D = parseInt(document.getElementById('c2d-depth').value, 10) || 4;
  const { TW, AW, LLH, ULH, TH, HH } = dims;
  const { zMin, zMax } = _zRange(D);
  return {
    xMin: -Math.ceil(TW / 2 + AW + 1),
    xMax:  Math.ceil(TW / 2 + AW + 1),
    yMin: 0,
    yMax: Math.ceil(LLH + ULH + TH + HH + 1),
    zMin, zMax, D,
  };
}

function _buildVolGeo(xMin, xMax, yMin, yMax, zMin, zMax) {
  const pts = [];
  const ae = (ax, ay, az, bx, by, bz) => pts.push(ax, ay, az, bx, by, bz);
  // Bottom face
  ae(xMin, yMin, zMin, xMax, yMin, zMin); ae(xMax, yMin, zMin, xMax, yMax, zMin);
  ae(xMax, yMax, zMin, xMin, yMax, zMin); ae(xMin, yMax, zMin, xMin, yMin, zMin);
  // Top face
  ae(xMin, yMin, zMax, xMax, yMin, zMax); ae(xMax, yMin, zMax, xMax, yMax, zMax);
  ae(xMax, yMax, zMax, xMin, yMax, zMax); ae(xMin, yMax, zMax, xMin, yMin, zMax);
  // Vertical edges
  ae(xMin, yMin, zMin, xMin, yMin, zMax); ae(xMax, yMin, zMin, xMax, yMin, zMax);
  ae(xMax, yMax, zMin, xMax, yMax, zMax); ae(xMin, yMax, zMin, xMin, yMax, zMax);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

function _buildLayGeo(xMin, xMax, yMin, yMax) {
  const pts = [];
  // Horizontal lines (varying x, constant y) at z=0 in local space
  for (let y = yMin; y <= yMax; y++) pts.push(xMin, y, 0, xMax, y, 0);
  // Vertical lines (varying y, constant x)
  for (let x = xMin; x <= xMax; x++) pts.push(x, yMin, 0, x, yMax, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

function _updateHUD() {
  const el = document.getElementById('z-hud');
  if (el) el.textContent = `Z: ${_activeZ >= 0 ? '+' : ''}${_activeZ}`;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function showGrid(dims) {
  _dims = dims;
  const { xMin, xMax, yMin, yMax, zMin, zMax } = _computeBounds(dims);

  if (_volLines) { scene.remove(_volLines); _volLines.geometry.dispose(); }
  if (_layLines) { scene.remove(_layLines); _layLines.geometry.dispose(); }

  _volLines = new THREE.LineSegments(_buildVolGeo(xMin, xMax, yMin, yMax, zMin, zMax), _volMat);
  _volLines.renderOrder = 5;
  _volLines.frustumCulled = false;
  scene.add(_volLines);

  _layLines = new THREE.LineSegments(_buildLayGeo(xMin, xMax, yMin, yMax), _layMat);
  _layLines.renderOrder = 6;
  _layLines.frustumCulled = false;
  scene.add(_layLines);

  resetZ();
  const el = document.getElementById('z-hud');
  if (el) el.style.display = '';
}

export function hideGrid() {
  if (_volLines) _volLines.visible = false;
  if (_layLines) _layLines.visible = false;
  _ghost.visible = false;
  const el = document.getElementById('z-hud');
  if (el) el.style.display = 'none';
}

export function hideGhost() {
  _ghost.visible = false;
}

const _hitPt = new THREE.Vector3();
const _wPos  = new THREE.Vector3();

export function updateGhost(ray, bodyV) {
  if (!_dims) { _ghost.visible = false; return; }
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -_activeZ);
  if (!ray.ray.intersectPlane(plane, _hitPt)) { _ghost.visible = false; return; }

  _snappedX = Math.round(_hitPt.x);
  _snappedY = Math.round(_hitPt.y);

  const occupied = bodyV.some(m => {
    m.getWorldPosition(_wPos);
    return Math.round(_wPos.x) === _snappedX &&
           Math.round(_wPos.y) === _snappedY &&
           Math.round(_wPos.z) === _activeZ;
  });

  if (occupied) { _ghost.visible = false; return; }

  _ghostMat.color.set(new THREE.Color(state.col));
  _ghost.position.set(_snappedX, _snappedY, _activeZ);
  _ghost.visible = true;
}

export function getSnappedPos() {
  return { x: _snappedX, y: _snappedY, z: _activeZ };
}

export function resetZ() {
  _activeZ = 0;
  if (_layLines) _layLines.position.z = 0;
  _updateHUD();
}

export function onScroll(e, D) {
  const { zMin, zMax } = _zRange(D);
  _activeZ = Math.max(zMin, Math.min(zMax, _activeZ + (e.deltaY > 0 ? -1 : 1)));
  if (_layLines) _layLines.position.z = _activeZ;
  _updateHUD();
}
