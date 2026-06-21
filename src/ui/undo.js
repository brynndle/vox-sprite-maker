export const UNDO_STACK = [];
export const REDO_STACK = [];
const MAX_UNDO = 50;

export function pushUndo(action) {
  UNDO_STACK.push(action);
  if (UNDO_STACK.length > MAX_UNDO) UNDO_STACK.shift();
  REDO_STACK.length = 0;
  syncUndoUI();
}

export function syncUndoUI() {
  document.getElementById('undo-btn').disabled = !UNDO_STACK.length;
  document.getElementById('redo-btn').disabled = !REDO_STACK.length;
  const n = UNDO_STACK.length;
  document.getElementById('undo-count').textContent = n ? `${n} action${n > 1 ? 's' : ''} in history` : '';
}

export function doUndo() {
  if (!UNDO_STACK.length) return;
  const a = UNDO_STACK.pop(); a.undo(); REDO_STACK.push(a); syncUndoUI();
}

export function doRedo() {
  if (!REDO_STACK.length) return;
  const a = REDO_STACK.pop(); a.redo(); UNDO_STACK.push(a); syncUndoUI();
}
