# Changelog

All notable changes to this project are documented in this file.

## [1.3.1]

### Fixed
- "Save OBJ" produced an empty (0 KB) file. three's `OBJExporter` detects
  meshes with `instanceof Mesh`, which fails when more than one copy of three
  is in scope, so nothing was written. Replaced it with a small self-contained
  OBJ writer (`src/obj-exporter.js`) that detects meshes via the `isMesh` flag,
  matching the robust approach `STLExporter` already uses. Output verified to
  match three's `OBJExporter` for indexed and non-indexed geometry.
- The panel buttons and menu commands now cache-bust the bundle fetch, so they
  always run the latest published bundle instead of a stale cached one.

## [1.3.0]

### Changed
- "Save STL" (both the on-page button and the Tampermonkey menu command) now
  performs the cube-removing export. The separate "Save Clean STL" action was
  removed and folded into "Save STL", since exporting without the wrapping cube
  is the expected default. The raw export is still available as `window.saveStl`.
- Cube detection rewritten: the HeroForge wrapping cube is now found by the huge
  bounding-box volume gap between it and the real body shells, instead of the
  "cube score" heuristic. After the export rotation and skin baking the cube is
  skewed, so its cube score fell below the old threshold and it was missed while
  a real body shell was removed by mistake. The volume-gap approach removes only
  the oversized enclosing shell and keeps the figure intact.

### Added
- The userscript now removes any foreign on-page button labelled exactly
  "Save STL" that it did not create, leaving only the Herosaver panel button.
- `window.heroMeshes()` debug helper that lists every mesh in the character
  (name, type, visibility, vertex count, bounding-box size). Cube removal also
  logs each detected shell to the console for inspection.

## [1.2.0]

### Added
- `saveCleanStl` export that saves the STL with the surrounding cube/shell
  automatically removed, done locally in the bundle (no external page needed).
  The cube-detection algorithm (connected shells + cube scoring) was ported into
  `src/cube-remover.js`.
- On-page floating button panel (Save STL, Save Clean STL, Save OBJ, Save JSON)
  in addition to the existing userscript-manager menu commands.

### Changed
- Userscript now restricts itself to HeroForge (`@match *://*.heroforge.com/*`)
  instead of running on every site.
- Ported the hand-edited `dist` changes back into the source so `src` and `dist`
  stay in sync: `process` now calls `updateMatrixWorld`, traverses all meshes
  (not only visible ones), and applies the mesh world matrix to skinned vertices.

### Removed
- `stl-cube-remover.html` (the standalone "Hero Cleaner" page) and the
  "Send to Hero Cleaner" integration. Cube removal now happens directly in the
  export via `saveCleanStl`, so the external page is no longer required.
