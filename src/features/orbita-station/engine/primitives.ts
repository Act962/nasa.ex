import * as THREE from "three";

type MeshMaterial = THREE.Material | THREE.Material[];

export function addBox(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  material: MeshMaterial,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addCylinder(
  parent: THREE.Object3D,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: MeshMaterial,
  x: number,
  y: number,
  z: number,
  segments = 16,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addTube(
  parent: THREE.Object3D,
  length: number,
  radius: number,
  material: MeshMaterial,
  x: number,
  y: number,
  z: number,
  isAlongX: boolean,
): THREE.Mesh {
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material);
  tube.rotation.z = isAlongX ? Math.PI / 2 : 0;
  tube.rotation.x = isAlongX ? 0 : Math.PI / 2;
  tube.position.set(x, y, z);
  tube.castShadow = true;
  parent.add(tube);
  return tube;
}

/**
 * Libera geometrias e materiais próprios de um grupo. Ficam com o dono: materiais compartilhados e a geometria
 * de modelos clonados do cache (`userData.sharesGeometry`). Material com `userData.ownsMap` leva a textura junto.
 */
export function disposeObject(root: THREE.Object3D, sharedMaterials: ReadonlySet<THREE.Material>) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!object.userData.sharesGeometry) object.geometry.dispose();
    const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (sharedMaterials.has(material) || material.userData.shared) return;
      if (material.userData.ownsMap && material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
      material.dispose();
    });
  });
  root.removeFromParent();
}
