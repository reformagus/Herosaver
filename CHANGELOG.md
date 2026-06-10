# Changelog

All notable changes to this project are documented in this file.

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
