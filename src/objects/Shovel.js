import * as THREE from 'three';

/**
 * A lightweight, pickable beach spade. +Y is up and its blade touches sand.
 * Carrying it reuses the right-hand grip and first-person view of other items.
 */
export function createShovel() {
  const shovel = new THREE.Group();
  shovel.name = 'Shovel';
  shovel.userData.pickupType = 'shovel';
  shovel.userData.actionId = 'digSand';
  shovel.userData.carry = {
    gripHeight: 0.73,
    povScale: 1.03,
    povPosition: [0.59, -0.73, -1.68],
  };

  const metal = new THREE.MeshStandardMaterial({ color: 0x849ca4, metalness: 0.43, roughness: 0.56, side: THREE.DoubleSide });
  const rimMetal = new THREE.MeshStandardMaterial({ color: 0xaebec1, metalness: 0.38, roughness: 0.6 });
  const wooden = new THREE.MeshStandardMaterial({ color: 0xbc8661, roughness: 0.9 });
  const grip = new THREE.MeshStandardMaterial({ color: 0xdc806b, roughness: 0.85 });

  // Rounded blade, broad at the top and tapered near the bottom.
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.20, 0.34);
  bladeShape.lineTo(0.20, 0.34);
  bladeShape.quadraticCurveTo(0.19, 0.13, 0.09, 0.07);
  bladeShape.quadraticCurveTo(0, -0.025, -0.09, 0.07);
  bladeShape.quadraticCurveTo(-0.19, 0.13, -0.20, 0.34);
  const bladeGeometry = new THREE.ShapeGeometry(bladeShape, 8);
  const blade = new THREE.Mesh(bladeGeometry, metal);
  blade.name = 'ShovelBlade';
  blade.position.set(0, 0.05, 0.012);
  blade.castShadow = true;
  shovel.add(blade);

  // Reinforced upper edge and subtle central crease.
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.045, 0.052), rimMetal);
  lip.position.set(0, 0.385, 0.018);
  lip.castShadow = true;
  shovel.add(lip);
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.007, 0.28, 6), rimMetal);
  ridge.position.set(0, 0.23, 0.036);
  ridge.castShadow = true;
  shovel.add(ridge);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.61, 9), wooden);
  handle.position.set(0, 0.72, 0);
  handle.castShadow = true;
  shovel.add(handle);

  // D-shaped handle, visible at small scale in both camera modes.
  const handleGroup = new THREE.Group();
  handleGroup.name = 'ShovelHandle';
  handleGroup.position.y = 1.035;
  const left = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.21, 7), grip);
  left.position.set(-0.12, 0.09, 0);
  left.rotation.z = -0.40;
  const right = left.clone();
  right.position.x = 0.12;
  right.rotation.z = 0.40;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.30, 8), grip);
  top.position.set(0, 0.18, 0);
  top.rotation.z = Math.PI / 2;
  handleGroup.add(left, right, top);
  handleGroup.traverse((part) => { if (part.isMesh) part.castShadow = true; });
  shovel.add(handleGroup);

  return shovel;
}
