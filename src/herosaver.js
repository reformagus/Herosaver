/* global Blob */

import { MeshBasicMaterial, Group, Mesh, Matrix4, Vector3, Vector4 } from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { SubdivisionModifier } from 'three/examples/jsm/modifiers/SubdivisionModifier.js'
import { saveAs } from 'file-saver'

const { character } = window.CK

const getName = () => character.data.meta.character_name === '' | !character.data.meta.character_name ? 'Hero' : character.data.meta.character_name

// export full scene as JSON (for debugging)
// you can use this to load it later: https://threejs.org/docs/#api/en/loaders/ObjectLoader
window.saveJson = () => saveAs(new Blob([JSON.stringify(window.CK.data.getJson())], { type: 'text/plain;charset=utf-8' }), `${getName()}.json`)

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
  saveAs(new Blob([exporter.parse(group)], { type: 'application/sla;charset=utf-8' }), `${getName()}.obj`)
}

// TODO: does this need cleanup? it came from old code
class FinalizeMesh {
  parse (mesh) {
    if (!mesh.isMesh) {
      console.warn('Mesh type unsupported', mesh)
      return
    }

    var vertex = new Vector3()
    var i; var l = []
    var nbVertex = 0
    var geometry = mesh.geometry

    var mrot = new Matrix4().makeRotationX(90 * Math.PI / 180)

    var msca = new Matrix4().makeScale(10, 10, 10)
    if (geometry.isBufferGeometry) {
      var newGeometry = geometry.clone(geometry)
      var vertices = geometry.getAttribute('position')

      // vertices
      if (vertices !== undefined) {
        for (i = 0, l = vertices.count; i < l; i++, nbVertex++) {
          vertex.x = vertices.getX(i)
          vertex.y = vertices.getY(i)
          vertex.z = vertices.getZ(i)

          if (geometry.skinIndexNames === undefined ||
                      geometry.skinIndexNames === 0) {
            vertex.applyMatrix4(mesh.matrixWorld).applyMatrix4(mrot).applyMatrix4(msca)
            newGeometry.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z)
          } else {
            var finalVector = new Vector4()
            if (geometry.morphTargetInfluences !== undefined) {
              var morphVector = new Vector4(vertex.x, vertex.y, vertex.z)
              var tempMorph = new Vector4()

              for (var mt = 0; mt < geometry.morphAttributes.position.length; mt++) {
                if (geometry.morphTargetInfluences[mt] === 0) continue
                if (geometry.morphTargetDictionary.hide === mt) continue

                var morph = new Vector4(
                  geometry.morphAttributes.position[mt].getX(i),
                  geometry.morphAttributes.position[mt].getY(i),
                  geometry.morphAttributes.position[mt].getZ(i))

                tempMorph.addScaledVector(morph.sub(morphVector), geometry.morphTargetInfluences[mt])
              }
              morphVector.add(tempMorph)
            }

            for (var si = 0; si < geometry.skinIndexNames.length; si++) {
              var skinIndices = geometry.getAttribute([geometry.skinIndexNames[si]])
              var weights = geometry.getAttribute([geometry.skinWeightNames[si]])

              var skinIndex = []
              skinIndex[0] = skinIndices.getX(i)
              skinIndex[1] = skinIndices.getY(i)
              skinIndex[2] = skinIndices.getZ(i)
              skinIndex[3] = skinIndices.getW(i)

              var skinWeight = []
              skinWeight[0] = weights.getX(i)
              skinWeight[1] = weights.getY(i)
              skinWeight[2] = weights.getZ(i)
              skinWeight[3] = weights.getW(i)

              var inverses = []
              inverses[0] = mesh.skeleton.boneInverses[skinIndex[0]]
              inverses[1] = mesh.skeleton.boneInverses[skinIndex[1]]
              inverses[2] = mesh.skeleton.boneInverses[skinIndex[2]]
              inverses[3] = mesh.skeleton.boneInverses[skinIndex[3]]

              var skinMatrices = []
              skinMatrices[0] = mesh.skeleton.bones[skinIndex[0]].matrixWorld
              skinMatrices[1] = mesh.skeleton.bones[skinIndex[1]].matrixWorld
              skinMatrices[2] = mesh.skeleton.bones[skinIndex[2]].matrixWorld
              skinMatrices[3] = mesh.skeleton.bones[skinIndex[3]].matrixWorld

              for (var k = 0; k < 4; k++) {
                const tempVector = geometry.morphTargetInfluences !== undefined
                  ? new Vector4(morphVector.x, morphVector.y, morphVector.z)
                  : new Vector4(vertex.x, vertex.y, vertex.z)

                tempVector.multiplyScalar(skinWeight[k])
                // the inverse takes the vector into local bone space
                // which is then transformed to the appropriate world space
                tempVector.applyMatrix4(inverses[k])
                  .applyMatrix4(skinMatrices[k])
                  .applyMatrix4(mrot).applyMatrix4(msca)
                finalVector.add(tempVector)
              }
            }
            newGeometry.attributes.position.setXYZ(i, finalVector.x, finalVector.y, finalVector.z)
          }
        }
      }
    } else {
      console.warn('Geometry type unsupported', geometry)
    }

    return newGeometry
  }
}

// TODO: does this need cleanup? it came from old code
const subdivide = (geometry, subdivisions) => new SubdivisionModifier(subdivisions).modify(geometry)

// TODO: does this need cleanup? it came from old code
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

// TODO: does this need cleanup? it came from old code
const process = (object3d, smooth, mirroredPose) => {
  var material = new MeshBasicMaterial()
  var group = new Group()

  object3d.traverseVisible(function (object) {
    if (object.isMesh) {
      var exporter = new FinalizeMesh()
      var geometry = exporter.parse(object)

      if (mirroredPose === true) {
        geometry = mirror(geometry)
      }

      if (smooth &&
                object.name !== 'baseRim' &&
                object.name !== 'base') {
        geometry = subdivide(geometry, smooth)
      }

      var mesh = new Mesh(geometry, material)

      group.add(mesh)
    }
  })
  return group
}
