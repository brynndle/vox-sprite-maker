# Launcher + Character Library — Design Spec

## Goal

Replace the current single-page editor with a launcher home screen. Users land on a gallery of their saved sprites, can create new ones, and can open built-in defaults as starting points. The editor is reached from the launcher and saves files directly to disk.

---

## User Flow

```
App opens
  └─▶ Launcher (gallery)
        ├─▶ "+ New Sprite" → blank editor in 2D mode
        ├─▶ Click saved sprite → editor (file already bound)
        ├─▶ Click built-in sprite → editor (copy, not yet saved)
        └─▶ "Open File" button → system file picker → editor

Editor
  ├─▶ "Save" → overwrite bound file (first save: pick location via File System Access API)
  └─▶ "Home" → back to launcher (unsaved changes prompt TBD — out of scope for this phase)
```

## Screens

### Launcher

- **Top bar**: app title (left) · "Open File" button · "+ New Sprite" button
- **No topbar background or border** — blends with the `#111` page background
- **"My Sprites" section**: grid of sprite cards for user-created files, plus a dashed "+ New Sprite" empty card
- **"Built-in Library" section**: grid of read-only starter sprites (base_human, base_compact, base_tall)
- Sprite cards show: thumbnail silhouette, filename, last-saved date
- If no user sprites exist: only the empty card shows in My Sprites

### Editor (unchanged from current)

- Gains a **"Home" button** in the top bar to return to the launcher
- Gains a **"Save" button** that overwrites the bound file (or opens a save picker if unbound)
- The existing editor UI is otherwise untouched in this phase

---

## Architecture

### Screen manager

A thin `src/ui/screenManager.js` module controls which screen is visible:

- `showLauncher()` — hides `#editor-root`, shows `#launcher-root`
- `showEditor(handle?)` — hides `#launcher-root`, shows `#editor-root`, optionally binds a file handle

The launcher and editor are both present in `index.html` as sibling divs. CSS `display:none` toggles between them.

### Launcher module

`src/ui/launcher.js` owns the launcher screen:

- `init()` — attaches event listeners, calls `render()`
- `render()` — reads handles from IndexedDB, generates card HTML, injects into `#launcher-root`
- Handles for user files are stored in IndexedDB under key `sprite-handles` as an ordered array of `FileSystemFileHandle`

### File persistence

**File System Access API** for all disk I/O:

- `showSaveFilePicker({ suggestedName: 'sprite.vsm', types: [{ accept: { 'application/json': ['.vsm'] } }] })` on first save
- `handle.createWritable()` → `writable.write(json)` → `writable.close()` on subsequent saves
- `showOpenFilePicker()` for "Open File" button
- Handles persisted in **IndexedDB** (`db: vox-sprite-maker`, store: `file-handles`) so the launcher can re-read them after a page refresh

**Save format (.vsm = JSON):**

```json
{
  "version": 1,
  "bodyParams": { "height": 0, "width": 0, ... },
  "equipped": { "coat": "longcoat", ... },
  "customBlocks": [ { "position": [x,y,z], "color": "#rrggbb", "skKey": "torso" }, ... ],
  "savedParts": { "head": { ... }, ... }
}
```

The exact shape mirrors the current in-memory state exported from `src/character/`.

### CSS

All styles — launcher and editor — live in a single **`style.css`** at the project root, linked from `index.html`. No inline styles in HTML, no `<style>` blocks. Variables at the top of `style.css` control the color palette and spacing so they're easy to tweak:

```css
:root {
  --bg:        #111;
  --bg-card:   #1a1a1a;
  --border:    #222;
  --text:      #e0e0e0;
  --text-dim:  #444;
  --accent:    #e0e0e0;
}
```

---

## Built-in Library

Three starter sprites ship as static JSON files in `public/defaults/`:

- `base_human.vsm`
- `base_compact.vsm`
- `base_tall.vsm`

The launcher fetches them at render time with `fetch('/defaults/base_human.vsm')`. Clicking one loads the character into the editor without binding a file handle — the user must save to create their own copy.

---

## Out of Scope (this phase)

- Duplicate sprite feature (backlog)
- Unsaved-changes prompt on "Home"
- Editor UI reorganization (separate sub-project)
- Sprite rename or delete from launcher
- Thumbnail generation (cards show a CSS silhouette placeholder)

---

## Non-Goals

- No server-side storage — everything is local disk + IndexedDB
- No authentication
- No cloud sync
