# Task 8 Report: Save + Home Buttons in Editor

## Status: DONE

## Commit: 4753b28

## What was done

### Step 1 — index.html
Inserted `#editor-topbar` div immediately inside `#editor-root` and before `#app`, containing:
- `#editor-topbar-title` with text "Voxel Sprite Maker"
- `#home-btn` with label "← Home"
- `#save-btn` with label "💾 Save"

### Step 2 — src/ui/controls.js
Added four imports at the top (after existing imports):
- `snapshot` from `../persistence/vsmFormat.js`
- `getCurrentHandle`, `setCurrentHandle`, `showLauncher` from `./screenManager.js`
- `saveHandle` from `../persistence/fileStore.js`
- `render as launcherRender` from `./launcher.js`

Added at the bottom (before `lpInit()`):
- Home button click handler: calls `showLauncher()` + `launcherRender()`
- `doSave()` async function using File System Access API (`showSaveFilePicker` on first save, then overwrites on subsequent saves)
- Save button click handler wired to `doSave`
- Separate `window.addEventListener('keydown', ...)` for Cmd/Ctrl+S (kept independent from the existing Cmd+Z/Y handler per spec)

## Tests
44 passed (44) — all 4 test files passed, no regressions.

## Notes
- The Cmd+S keydown handler is a separate `window.addEventListener` call, not merged into the existing undo/redo keydown block, per spec.
- `doSave` silently returns on user cancel (catch block is empty, as specified).
- `saveHandle` failure is silently swallowed with `.catch(() => {})` — this is non-fatal; the handle is still set in memory for the session.

---

# Task 8 Code Review Fixes

## Status: DONE

## Commit: (see below)

## What was done

### Fix 1 (Critical): applySnapshot HTML input sync — `src/persistence/vsmFormat.js`
Added HTML input sync block at the end of `applySnapshot`, after `lpRefresh()`. Syncs `#skinc`, `#hairc`, `#featc` color pickers and all `[data-s]` sliders to `state` values loaded from file. Guards with `if (skinc)` etc. for safety if called before DOM is ready.

### Fix 2 (Important): `#editor-root` layout CSS — `style.css`
Added `#editor-root{display:flex;flex-direction:column;height:100vh}` rule before the `#app` rule. Changed `#app` from `height:100vh` to `flex:1;min-height:0` so the editor grid fills remaining height below the topbar without overflowing.

### Fix 3 (Important): Dead `DEFAULTS` import — `src/persistence/vsmFormat.js`
Removed unused `DEFAULTS` from the `import { encode, DEFAULTS } from './vsmCodec.js'` import; now reads `import { encode } from './vsmCodec.js'`.

## Tests
44 passed (44) — all 4 test files passed, no regressions.
