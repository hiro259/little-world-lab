import * as THREE from 'three';

/** Small flower built from basic geometry, so it can be picked up and planted. */
export function createFlower({ petalColor = 0xf6a6c8, scale = 1 } = {}) {
  const flower = new THREE.Group();
  flower.name = 'Flower';
  flower.userData.pickupType = 'flower';
  // The avatar grips the middle of the stalk; POV has its own scale and framing.
  flower.userData.carry = {
    gripHeight: 0.24,
    povScale: 1.12,
    povPosition: [0.54, -0.69, -1.45],
  };
  flower.userData.actionId = 'verticalShake'; // Shared S action; can be overridden per item.

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x5a9f67, roughness: 1 });
  const petalMaterial = new THREE.MeshStandardMaterial({ color: petalColor, roughness: 0.88, flatShading: true });
  const centerMaterial = new THREE.MeshStandardMaterial({ color: 0xf6d26d, roughness: 1 });

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.63, 7), stemMaterial);
  stem.position.y = 0.315;
  stem.castShadow = true;
  flower.add(stem);

  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), stemMaterial);
    leaf.position.set(side * 0.12, 0.23, 0);
    leaf.scale.set(1, 0.35, 0.45);
    leaf.rotation.z = side * 0.48;
    leaf.castShadow = true;
    flower.add(leaf);
  }

  const head = new THREE.Group();
  head.position.y = 0.72;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), petalMaterial);
    petal.position.set(Math.sin(angle) * 0.17, Math.cos(angle) * 0.17, 0);
    petal.scale.set(0.80, 1.15, 0.55);
    petal.rotation.z = -angle;
    petal.castShadow = true;
    head.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), centerMaterial);
  center.position.z = 0.09;
  center.castShadow = true;
  head.add(center);
  flower.add(head);

  flower.scale.setScalar(scale);
  return flower;
}
