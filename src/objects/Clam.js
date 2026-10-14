import * as THREE from 'three';

/** A tiny, closed bivalve clam resting on the sand. */
export function createClam({ shellColor = 0xeccba7, scale = 1 } = {}) {
  const clam = new THREE.Group();
  clam.name = 'Clam';
  clam.userData.pickupType = 'clam';
  clam.userData.actionId = 'verticalShake';
  clam.userData.carry = {
    gripHeight: 0.12,
    povScale: 2.1,
    povPosition: [0.54, -0.50, -1.50],
  };

  const upperMaterial = new THREE.MeshStandardMaterial({
    color: shellColor, roughness: 0.94, flatShading: true,
  });
  const lowerMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2ab9c, roughness: 0.95, flatShading: true,
  });
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: 0xb78576, roughness: 0.96,
  });
  // Slightly offset half-shells and a visible dark seam read as a bivalve
  // even when the camera is far away. The model remains upright when held.
  const lower = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 8), lowerMaterial);
  lower.position.y = 0.105;
  lower.scale.set(1.1, 0.35, 0.79);
  lower.castShadow = true;
  clam.add(lower);

  const seam = new THREE.Mesh(new THREE.SphereGeometry(0.269, 16, 8), seamMaterial);
  seam.position.y = 0.15;
  seam.scale.set(1.1, 0.13, 0.79);
  clam.add(seam);

  const upper = new THREE.Mesh(new THREE.SphereGeometry(0.255, 14, 8), upperMaterial);
  upper.position.y = 0.19;
  upper.scale.set(1.12, 0.46, 0.82);
  upper.castShadow = true;
  clam.add(upper);

  // Delicate raised ridges evoke a scalloped beach shell without textures.
  const ridgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf6e1c0, roughness: 1,
  });
  for (let i = -2; i <= 2; i++) {
    const ridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.18, 3, 6), ridgeMaterial);
    ridge.position.set(i * 0.09, 0.30 - Math.abs(i) * 0.013, 0.04);
    ridge.rotation.x = Math.PI / 2;
    ridge.rotation.z = i * 0.15;
    ridge.castShadow = true;
    clam.add(ridge);
  }

  clam.scale.setScalar(scale);
  return clam;
}
