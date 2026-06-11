// Minimal OBJ writer working on a triangle list (as produced by parseSTL in
// cube-remover.js). The character is exported to a binary STL first, the
// wrapping cube is stripped from those triangles, and the kept triangles are
// written out here - so the OBJ strips the exact same cube the STL does.
//
// Triangles are a flat soup (3 unique vertices each), matching how STL exports,
// rather than relying on three's OBJExporter (whose `instanceof Mesh` check
// breaks when more than one copy of three is in scope, giving empty exports).
export const exportOBJFromTriangles = (triangles) => {
  let output = 'o herosaver\n'

  for (const { vertices } of triangles) {
    for (const [x, y, z] of vertices) {
      output += 'v ' + x + ' ' + y + ' ' + z + '\n'
    }
  }

  for (let i = 0; i < triangles.length; i++) {
    const a = i * 3 + 1
    output += 'f ' + a + ' ' + (a + 1) + ' ' + (a + 2) + '\n'
  }

  return output
}
