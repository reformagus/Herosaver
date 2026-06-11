import { Vector3 } from 'three'

// Minimal OBJ writer. Equivalent to three's OBJExporter for our meshes, but it
// detects meshes via the `isMesh` flag (like STLExporter) instead of
// `instanceof Mesh`. The instanceof check breaks when more than one copy of
// three ends up in scope, which produced empty (0 KB) OBJ exports.
export const exportOBJ = (object) => {
  let output = ''
  let indexVertex = 0
  const vertex = new Vector3()

  object.updateMatrixWorld(true)

  object.traverse(mesh => {
    if (!mesh.isMesh) return
    const geometry = mesh.geometry
    if (!geometry || typeof geometry.getAttribute !== 'function') return
    const positions = geometry.getAttribute('position')
    if (!positions) return

    output += 'o ' + (mesh.name || 'mesh') + '\n'

    // vertices (baked to world space, matching three's OBJExporter)
    for (let i = 0; i < positions.count; i++) {
      vertex.set(positions.getX(i), positions.getY(i), positions.getZ(i))
        .applyMatrix4(mesh.matrixWorld)
      output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n'
    }

    // faces (1-based, offset by the vertices already written for earlier meshes)
    const index = geometry.getIndex()
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = indexVertex + index.getX(i) + 1
        const b = indexVertex + index.getX(i + 1) + 1
        const c = indexVertex + index.getX(i + 2) + 1
        output += 'f ' + a + ' ' + b + ' ' + c + '\n'
      }
    } else {
      for (let i = 0; i < positions.count; i += 3) {
        output += 'f ' + (indexVertex + i + 1) + ' ' + (indexVertex + i + 2) + ' ' + (indexVertex + i + 3) + '\n'
      }
    }

    indexVertex += positions.count
  })

  return output
}
