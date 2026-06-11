/* global Blob */

import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { saveAs } from 'file-saver'
import { character, getName, process } from './utils'
import { parseSTL, removeCubeTriangles, removeCubeFromSTL } from './cube-remover'
import { exportOBJFromTriangles } from './obj-exporter'

// Export the character to a binary STL ArrayBuffer (the common starting point
// for the STL/OBJ exports and the cube removal that both share).
const exportSTLBuffer = subdivisions => {
  const group = process(character, subdivisions, !!character.data.mirroredPose)
  const view = new STLExporter().parse(group, { binary: true })
  // STLExporter binary mode returns a DataView; normalize to a plain ArrayBuffer.
  return view.buffer
    ? view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
    : view
}

// export full scene as JSON (for debugging)
window.saveJson = () => saveAs(new Blob([JSON.stringify(window.CK.data.getJson())], { type: 'application/json;charset=utf-8' }), `${getName()}.json`)

// Debug: validate the corrected bakeSkinnedVertex formula against the live shader.
// Call debugSkin() in DevTools after loading herosaver.js to verify skinning output.
window.debugSkin = () => {
  let mesh = null
  character.traverseVisible(o => { if (o.isSkinnedMesh && o.name === 'bodyLower') mesh = o })
  if (!mesh) { character.traverseVisible(o => { if (o.isSkinnedMesh && !mesh) mesh = o }) }
  if (!mesh) { console.log('no skinned mesh found'); return }

  const geo = mesh.geometry
  const skel = mesh.skeleton

  // Sawtooth weight decoder (mirrors shader: abs(mod(v+1,2)-1))
  const decodeWeight = v => { let m = (v + 1) % 2; if (m < 0) m += 2; return Math.abs(m - 1) }

  // mat4 * vec3 (w=1), Three.js column-major
  const mulMV = (m, x, y, z) => [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14]
  ]
  const mulMM = (a, b) => {
    const r = new Array(16).fill(0)
    for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) r[c * 4 + row] += a[k * 4 + row] * b[c * 4 + k]
    return r
  }

  // Verify vertex 0
  const posAttr = geo.getAttribute('position')
  let vx = posAttr.getX(0); let vy = posAttr.getY(0); let vz = posAttr.getZ(0)

  // Apply morph targets (matches shader)
  const infl = mesh.morphTargetInfluences || []
  for (let mt = 0; mt < infl.length; mt++) {
    if (!infl[mt]) continue
    const a = geo.getAttribute('morphTarget' + mt)
    if (!a) continue
    vx += a.getX(0) * infl[mt]; vy += a.getY(0) * infl[mt]; vz += a.getZ(0) * infl[mt]
  }
  console.log('morphed vertex[0]:', [vx, vy, vz].map(v => v.toFixed(6)))

  // Apply bindMatrix
  const bm = mesh.bindMatrix.elements
  ;[vx, vy, vz] = mulMV(bm, vx, vy, vz)

  // Weighted skinning over skin0, skin1, skin2
  const bmi = mesh.bindMatrixInverse.elements
  let sx = 0; let sy = 0; let sz = 0; let skinSum = 0
  const active = (geo.skinNames || ['skin0']).slice(0, 3)
  active.forEach(sname => {
    const attr = geo.getAttribute(sname)
    if (!attr) return
    const pairs = attr.itemSize / 2
    const base = 0 * attr.itemSize
    for (let p = 0; p < pairs; p++) {
      const bi = Math.round(attr.array[base + p * 2])
      const w = decodeWeight(attr.array[base + p * 2 + 1])
      if (!w) continue
      const bone = skel.bones[bi]
      const inv = skel.boneInverses[bi]
      if (!bone || !inv) continue
      const mat = mulMM(bone.matrixWorld.elements, inv.elements)
      const [cx, cy, cz] = mulMV(mat, vx, vy, vz)
      console.log(`  bone[${bi}] "${bone.name}" w=${w.toFixed(4)} → [${cx.toFixed(4)}, ${cy.toFixed(4)}, ${cz.toFixed(4)}]`)
      sx += cx * w; sy += cy * w; sz += cz * w; skinSum += w
    }
  })
  if (skinSum > 0) { sx /= skinSum; sy /= skinSum; sz /= skinSum }
  const [rx, ry, rz] = mulMV(bmi, sx, sy, sz)
  console.log('skinSum:', skinSum.toFixed(6))
  console.log('final baked vertex[0] (world):', [rx, ry, rz].map(v => v.toFixed(4)))
  console.log('Expected: right toe area, roughly [-0.41..0.06..0.75] or post-transform')
}

// export character as STL file, cube included (binary to avoid JS string length
// limits on large models). Kept for callers that want the raw, uncleaned export.
window.saveStl = subdivisions => {
  saveAs(new Blob([exportSTLBuffer(subdivisions)], { type: 'application/octet-stream' }), `${getName()}.stl`)
}

// Debug: list every mesh in the character so the cube/shell can be identified
// by name. Run heroMeshes() in DevTools and look for an axis-aligned box whose
// size encloses the whole figure - that is the cube.
window.heroMeshes = () => {
  const rows = []
  character.updateMatrixWorld(true)
  character.traverse(mesh => {
    const geo = mesh.geometry
    if (!geo || !(geo.attributes && geo.attributes.position)) return
    const pos = geo.getAttribute('position')
    let minX = Infinity; let minY = Infinity; let minZ = Infinity
    let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const y = pos.getY(i); const z = pos.getZ(i)
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
    }
    rows.push({
      name: mesh.name || '(unnamed)',
      type: mesh.type,
      visible: mesh.visible,
      skinned: !!(mesh.isSkinnedMesh || (mesh.skeleton && mesh.skeleton.bones && mesh.skeleton.bones.length)),
      verts: pos.count,
      size: [maxX - minX, maxY - minY, maxZ - minZ].map(s => +s.toFixed(3)).join(' x ')
    })
  })
  console.table(rows)
  return rows
}

// export character as STL file with the surrounding cube/shell removed.
// Same pipeline as saveStl, then the cube is stripped from the exported buffer.
window.saveCleanStl = subdivisions => {
  const cleaned = removeCubeFromSTL(exportSTLBuffer(subdivisions))
  saveAs(new Blob([cleaned], { type: 'application/octet-stream' }), `${getName()}_clean.stl`)
}

// export character as OBJ file with the surrounding cube/shell removed.
// Routes through the STL triangles so it strips the exact same cube as the STL.
window.saveObj = subdivisions => {
  const triangles = removeCubeTriangles(parseSTL(exportSTLBuffer(subdivisions)))
  saveAs(new Blob([exportOBJFromTriangles(triangles)], { type: 'application/octet-stream;charset=utf-8' }), `${getName()}.obj`)
}
