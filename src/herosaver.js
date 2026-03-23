/* global Blob */

import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { Matrix4, Vector3 } from 'three'
import { saveAs } from 'file-saver'
import { character, getName, process } from './utils'

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
    m[0]*x + m[4]*y + m[8]*z  + m[12],
    m[1]*x + m[5]*y + m[9]*z  + m[13],
    m[2]*x + m[6]*y + m[10]*z + m[14]
  ]
  const mulMM = (a, b) => {
    const r = new Array(16).fill(0)
    for (let c=0; c<4; c++) for (let row=0; row<4; row++) for (let k=0; k<4; k++) r[c*4+row]+=a[k*4+row]*b[c*4+k]
    return r
  }

  // Verify vertex 0
  const posAttr = geo.getAttribute('position')
  let vx = posAttr.getX(0), vy = posAttr.getY(0), vz = posAttr.getZ(0)

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
  let sx=0, sy=0, sz=0, skinSum=0
  const active = (geo.skinNames || ['skin0']).slice(0, 3)
  active.forEach(sname => {
    const attr = geo.getAttribute(sname)
    if (!attr) return
    const pairs = attr.itemSize / 2
    const base = 0 * attr.itemSize
    for (let p = 0; p < pairs; p++) {
      const bi = Math.round(attr.array[base + p*2])
      const w  = decodeWeight(attr.array[base + p*2 + 1])
      if (!w) continue
      const bone = skel.bones[bi]
      const inv  = skel.boneInverses[bi]
      if (!bone || !inv) continue
      const mat = mulMM(bone.matrixWorld.elements, inv.elements)
      const [cx, cy, cz] = mulMV(mat, vx, vy, vz)
      console.log(`  bone[${bi}] "${bone.name}" w=${w.toFixed(4)} → [${cx.toFixed(4)}, ${cy.toFixed(4)}, ${cz.toFixed(4)}]`)
      sx += cx*w; sy += cy*w; sz += cz*w; skinSum += w
    }
  })
  if (skinSum > 0) { sx/=skinSum; sy/=skinSum; sz/=skinSum }
  const [rx, ry, rz] = mulMV(bmi, sx, sy, sz)
  console.log('skinSum:', skinSum.toFixed(6))
  console.log('final baked vertex[0] (world):', [rx, ry, rz].map(v => v.toFixed(4)))
  console.log('Expected: right toe area, roughly [-0.41..0.06..0.75] or post-transform')
}

// export character as STL file
window.saveStl = subdivisions => {
  const group = process(character, subdivisions, !!character.data.mirroredPose)
  const exporter = new STLExporter()
  saveAs(new Blob([exporter.parse(group)], { type: 'application/sla;charset=utf-8' }), `${getName()}.stl`)
}

// export character as OBJ file
window.saveObj = subdivisions => {
  const group = process(character, subdivisions, !!character.data.mirroredPose)
  const exporter = new OBJExporter()
  saveAs(new Blob([exporter.parse(group)], { type: 'application/octet-stream;charset=utf-8' }), `${getName()}.obj`)
}
