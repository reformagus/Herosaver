import { MeshBasicMaterial, Group, Mesh, Matrix4, Vector3 } from 'three'
import { SubdivisionModifier } from 'three/examples/jsm/modifiers/SubdivisionModifier.js'

export const { character } = window.CK

export const getName = () => character.data.meta.character_name === '' | !character.data.meta.character_name ? 'Hero' : character.data.meta.character_name

// TODO: see this for better smoothing?: https://discourse.threejs.org/t/how-soften-hard-edges/6919
export const subdivide = (geometry, subdivisions) => new SubdivisionModifier(subdivisions).modify(geometry)

const mirror = (geometry) => {
  const tempXYZ = [0, 0, 0]
  if (geometry.index) geometry.copy(geometry.toNonIndexed())

  for (let i = 0; i < geometry.attributes.position.array.length / 9; i++) {
    tempXYZ[0] = geometry.attributes.position.array[i * 9]
    tempXYZ[1] = geometry.attributes.position.array[i * 9 + 1]
    tempXYZ[2] = geometry.attributes.position.array[i * 9 + 2]

    geometry.attributes.position.array[i * 9] = geometry.attributes.position.array[i * 9 + 6]
    geometry.attributes.position.array[i * 9 + 1] = geometry.attributes.position.array[i * 9 + 7]
    geometry.attributes.position.array[i * 9 + 2] = geometry.attributes.position.array[i * 9 + 8]

    geometry.attributes.position.array[i * 9 + 6] = tempXYZ[0]
    geometry.attributes.position.array[i * 9 + 7] = tempXYZ[1]
    geometry.attributes.position.array[i * 9 + 8] = tempXYZ[2]
  }
  return geometry
}

// Bakes a skinned vertex into world space using HeroForge's exact vertex shader formula
// (reverse-engineered from the GLSL source via gl.getShaderSource):
//
//   1. Apply morph deltas (stored as plain geometry attributes morphTarget0..N).
//   2. skinVertex = bindMatrix * vec4(morphed, 1.0)
//   3. For each influence in skin0, skin1, skin2 (each vec4 = [boneIdx0,val0,boneIdx1,val1]):
//        weight = abs(mod(val + 1.0, 2.0) - 1.0)   ← sawtooth decode, gives [0..1]
//        skinned += getBoneMatrix(boneIdx) * skinVertex * weight
//        skinSum += weight
//   4. skinned /= skinSum
//   5. result = bindMatrixInverse * skinned
//
// getBoneMatrix(i) == boneWorld[i] * boneInverse[i], read from skeleton.boneTexture.
// Only skin0/skin1/skin2 are read by the shader (6 influences); skin3 is ignored.
const bakeSkinnedVertex = (() => {
  const tempMatrix = new Matrix4()
  const tempVec = new Vector3()

  // Decode HeroForge's sawtooth-encoded blend weight: abs(mod(v + 1.0, 2.0) - 1.0)
  const decodeWeight = (v) => {
    let m = (v + 1.0) % 2.0
    if (m < 0) m += 2.0 // ensure non-negative (matches GLSL mod behaviour)
    return Math.abs(m - 1.0)
  }

  return (mesh, index) => {
    const geometry = mesh.geometry
    const posAttr = geometry.getAttribute('position')

    // Step 1: base position + morph targets.
    // HeroForge stores morph deltas as plain attributes (morphTarget0, morphTarget1...).
    const morphed = new Vector3(
      posAttr.getX(index),
      posAttr.getY(index),
      posAttr.getZ(index)
    )

    const influences = mesh.morphTargetInfluences || []
    for (let mt = 0; mt < influences.length; mt++) {
      const influence = influences[mt]
      if (!influence) continue
      let morphAttr = null
      if (geometry.morphAttributes && geometry.morphAttributes.position) {
        morphAttr = geometry.morphAttributes.position[mt]
      }
      if (!morphAttr) morphAttr = geometry.getAttribute('morphTarget' + mt)
      if (!morphAttr) continue
      morphed.x += morphAttr.getX(index) * influence
      morphed.y += morphAttr.getY(index) * influence
      morphed.z += morphAttr.getZ(index) * influence
    }

    // Step 2: apply bindMatrix (typically identity, but correct to include).
    morphed.applyMatrix4(mesh.bindMatrix)

    // Steps 3–4: weighted sum over skin0, skin1, skin2 (shader ignores skin3).
    const activeSkinNames = (geometry.skinNames || ['skin0']).slice(0, 3)
    const skinned = new Vector3()
    let skinSum = 0

    for (const sname of activeSkinNames) {
      const attr = geometry.getAttribute(sname)
      if (!attr) continue

      const pairsPerAttr = attr.itemSize / 2
      const base = index * attr.itemSize
      for (let p = 0; p < pairsPerAttr; p++) {
        const boneIndex = Math.round(attr.array[base + p * 2])
        const weight = decodeWeight(attr.array[base + p * 2 + 1])
        if (!weight) continue

        const bone = mesh.skeleton.bones[boneIndex]
        const inverse = mesh.skeleton.boneInverses[boneIndex]
        if (!bone || !inverse) continue

        // boneMatrix = boneWorld * boneInverse (mirrors what the shader reads from boneTexture)
        tempMatrix.multiplyMatrices(bone.matrixWorld, inverse)
        tempVec.copy(morphed).applyMatrix4(tempMatrix).multiplyScalar(weight)
        skinned.add(tempVec)
        skinSum += weight
      }
    }

    // Step 5: normalize and apply bindMatrixInverse.
    if (skinSum > 0) skinned.divideScalar(skinSum)
    return skinned.applyMatrix4(mesh.bindMatrixInverse)
  }
})()

export const process = (object3d, smooth, mirroredPose) => {
  const material = new MeshBasicMaterial()
  const group = new Group()

  // Transformation applied after world space: rotate 90° on X and scale ×10
  // to match the coordinate system expected by STL/OBJ tools.
  const mrot = new Matrix4().makeRotationX(90 * Math.PI / 180)
  const msca = new Matrix4().makeScale(10, 10, 10)
  const mTransform = new Matrix4().multiplyMatrices(msca, mrot)

  // Make sure every node's world matrix is current before we read matrixWorld below.
  object3d.updateMatrixWorld(true)

  // traverse (not traverseVisible): HeroForge keeps some exported meshes flagged
  // invisible, so traverseVisible would silently drop parts of the model.
  object3d.traverse(mesh => {
    // Older Three.js (used by HeroForge) may not set isMesh/isSkinnedMesh flags —
    // fall back to checking the constructor name and skeleton presence.
    const isMesh = mesh.isMesh || (mesh.geometry && mesh.geometry.isBufferGeometry)
    if (!isMesh) return

    const geometry = mesh.geometry
    // Old Three.js versions may not set isBufferGeometry — check for position attribute instead
    if (!geometry || !(geometry.isBufferGeometry || (geometry.attributes && geometry.attributes.position))) {
      console.warn('Geometry type unsupported', mesh.name, geometry)
      return
    }

    const isSkinned = mesh.isSkinnedMesh ||
      (mesh.skeleton && mesh.skeleton.bones && mesh.skeleton.bones.length > 0)

    const newGeometry = geometry.clone()
    const vertices = newGeometry.getAttribute('position')

    for (let i = 0; i < vertices.count; i++) {
      let vertex

      if (isSkinned) {
        // Manually bake bone transforms (compatible with older Three.js without boneTransform()),
        // then apply the mesh's own world matrix to place the baked vertex in scene space.
        vertex = bakeSkinnedVertex(mesh, i).applyMatrix4(mesh.matrixWorld)
      } else {
        // Static mesh: just apply its world transform
        vertex = new Vector3(vertices.getX(i), vertices.getY(i), vertices.getZ(i))
          .applyMatrix4(mesh.matrixWorld)
      }

      vertex.applyMatrix4(mTransform)
      vertices.setXYZ(i, vertex.x, vertex.y, vertex.z)
    }

    vertices.needsUpdate = true

    let finalGeometry = newGeometry

    if (mirroredPose === true) {
      finalGeometry = mirror(finalGeometry)
    }

    if (smooth && mesh.name !== 'baseRim' && mesh.name !== 'base') {
      finalGeometry = subdivide(finalGeometry, smooth)
    }

    group.add(new Mesh(finalGeometry, material))
  })

  return group
}
