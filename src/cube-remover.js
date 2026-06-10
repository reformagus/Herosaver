// Cube/shell removal, reverse-engineered from stl-cube-remover.html (the standalone
// "Hero Cleaner" tool). It works directly on a binary STL buffer:
//
//   1. Parse the STL into raw triangles.
//   2. Group triangles into connected shells (components sharing quantized vertices).
//   3. Score each shell for how "cube-like" it is (axis-aligned normals + cubic aspect).
//   4. Auto-detect and drop the single most cube-like shell, matching the tool's
//      heuristic exactly (>=0.5% of faces and cubeScore > 0.65).
//   5. Re-emit the kept triangles as a binary STL.
//
// Keeping this identical to the HTML tool means "Save Clean STL" produces the same
// result the user would get by exporting then running the model through Hero Cleaner.

// ─── STL Parser ─────────────────────────────────────────────────────────────

function parseSTL (buffer) {
  const dv = new DataView(buffer)
  if (buffer.byteLength < 84) throw new Error('Buffer too small to be a valid STL.')

  const triCount = dv.getUint32(80, true)
  const expectedSize = 84 + triCount * 50

  if (triCount > 0 && buffer.byteLength === expectedSize) {
    return parseBinarySTL(dv, triCount)
  }
  const text = new TextDecoder('utf-8').decode(buffer)
  if (text.trimStart().toLowerCase().startsWith('solid')) {
    return parseASCIISTL(text)
  }
  if (triCount > 0) return parseBinarySTL(dv, triCount)
  throw new Error('Unrecognised STL format.')
}

function parseBinarySTL (dv, triCount) {
  const triangles = []
  let o = 84
  for (let i = 0; i < triCount; i++) {
    const nx = dv.getFloat32(o, true)
    const ny = dv.getFloat32(o + 4, true)
    const nz = dv.getFloat32(o + 8, true)
    o += 12
    const verts = []
    for (let j = 0; j < 3; j++) {
      verts.push([dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)])
      o += 12
    }
    o += 2
    triangles.push({ normal: [nx, ny, nz], vertices: verts })
  }
  return triangles
}

function parseASCIISTL (text) {
  const triangles = []
  const facetRe = /facet normal\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)([\s\S]*?)endfacet/g
  const vertRe = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g
  let fm
  while ((fm = facetRe.exec(text)) !== null) {
    const normal = [parseFloat(fm[1]), parseFloat(fm[2]), parseFloat(fm[3])]
    const block = fm[4]
    const verts = []
    let vm
    vertRe.lastIndex = 0
    while ((vm = vertRe.exec(block)) !== null) {
      verts.push([parseFloat(vm[1]), parseFloat(vm[2]), parseFloat(vm[3])])
    }
    if (verts.length === 3) triangles.push({ normal, vertices: verts })
  }
  return triangles
}

// ─── Connected Components ───────────────────────────────────────────────────

function quantize (v, f = 10000) {
  return `${Math.round(v[0] * f)},${Math.round(v[1] * f)},${Math.round(v[2] * f)}`
}

function findConnectedComponents (triangles) {
  const n = triangles.length
  const visited = new Uint8Array(n)

  // Build vertex -> triangles adjacency
  const vtMap = new Map()
  for (let i = 0; i < n; i++) {
    for (const v of triangles[i].vertices) {
      const k = quantize(v)
      if (!vtMap.has(k)) vtMap.set(k, [])
      vtMap.get(k).push(i)
    }
  }

  const components = []
  for (let start = 0; start < n; start++) {
    if (visited[start]) continue
    const comp = []
    const queue = [start]
    visited[start] = 1
    let qi = 0
    while (qi < queue.length) {
      const ti = queue[qi++]
      comp.push(ti)
      for (const v of triangles[ti].vertices) {
        for (const ni of (vtMap.get(quantize(v)) || [])) {
          if (!visited[ni]) { visited[ni] = 1; queue.push(ni) }
        }
      }
    }
    components.push(comp)
  }
  return components
}

// ─── Shell Analysis ─────────────────────────────────────────────────────────

function analyzeShell (indices, triangles) {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity
  let axisAligned = 0

  for (const i of indices) {
    const { normal: [nx, ny, nz], vertices } = triangles[i]
    const ax = Math.abs(nx); const ay = Math.abs(ny); const az = Math.abs(nz)
    if (ax > 0.85 || ay > 0.85 || az > 0.85) axisAligned++
    for (const [x, y, z] of vertices) {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
    }
  }

  const sx = maxX - minX; const sy = maxY - minY; const sz = maxZ - minZ
  const dims = [sx, sy, sz].sort((a, b) => a - b)
  // Aspect ratio score: 1.0 = perfect cube, lower = elongated
  const aspectScore = dims[0] > 0 ? dims[0] / dims[2] : 0
  const axisScore = axisAligned / indices.length
  // Weighted cube score
  const cubeScore = axisScore * 0.75 + aspectScore * 0.25

  return {
    count: indices.length,
    cubeScore,
    axisScore,
    aspectScore,
    bounds: [minX, minY, minZ, maxX, maxY, maxZ],
    volume: sx * sy * sz,
    size: [sx, sy, sz]
  }
}

// ─── STL Writer ─────────────────────────────────────────────────────────────

function writeBinarySTL (keptIndices, triangles) {
  const n = keptIndices.length
  const buf = new ArrayBuffer(84 + n * 50)
  const dv = new DataView(buf)
  new Uint8Array(buf).set(new TextEncoder().encode('Herosaver clean STL export'), 0)
  dv.setUint32(80, n, true)
  let o = 84
  for (const i of keptIndices) {
    const { normal: [nx, ny, nz], vertices } = triangles[i]
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true); o += 12
    for (const [x, y, z] of vertices) {
      dv.setFloat32(o, x, true); dv.setFloat32(o + 4, y, true); dv.setFloat32(o + 8, z, true); o += 12
    }
    o += 2
  }
  return buf
}

// ─── Public API ─────────────────────────────────────────────────────────────

// Takes a binary STL ArrayBuffer, removes the auto-detected cube shell, and
// returns a new binary STL ArrayBuffer with only the kept shells.
// If no convincing cube is found the original triangles are re-emitted unchanged.
export const removeCubeFromSTL = (buffer) => {
  const triangles = parseSTL(buffer)
  if (triangles.length === 0) return buffer

  let shells = findConnectedComponents(triangles)
  let shellInfo = shells.map(s => analyzeShell(s, triangles))

  // Sort shells by volume descending (largest first) - matches the tool's ordering.
  const order = shellInfo.map((_, i) => i).sort((a, b) => shellInfo[b].volume - shellInfo[a].volume)
  shells = order.map(i => shells[i])
  shellInfo = order.map(i => shellInfo[i])

  // Auto-detect cube: highest cubeScore among shells with at least 0.5% of faces.
  const totalFaces = triangles.length
  let bestCubeIdx = -1
  let bestCubeScore = 0
  shellInfo.forEach((info, i) => {
    if (info.count / totalFaces >= 0.005 && info.cubeScore > bestCubeScore) {
      bestCubeScore = info.cubeScore
      bestCubeIdx = i
    }
  })

  // Only remove if the shell is convincingly cube-like (>0.65).
  const keep = shellInfo.map(() => true)
  if (bestCubeIdx >= 0 && bestCubeScore > 0.65) {
    keep[bestCubeIdx] = false
  }

  const keptIndices = []
  shells.forEach((shell, i) => {
    if (keep[i]) keptIndices.push(...shell)
  })

  return writeBinarySTL(keptIndices, triangles)
}
