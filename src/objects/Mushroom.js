import * as THREE from 'three';

/**
 * A tiny, low-poly mushroom about the size of the player's shoe.
 * All geometry is procedural so it can be easily recoloured for live demos.
 */
export function createMushroom({ capColor = 0xd96b65, scale = 1 } = {}) {
  const group = new THREE.Group();
  group.name = 'Mushroom';
  group.userData.pickupType = 'mushroom';
  // A mushroom is shorter than a flower: grip near the cap, preview larger.
  group.userData.carry = {
    gripHeight: 0.12,
    povScale: 2.2,
    povPosition: [0.55, -0.49, -1.55],
  };
  group.userData.actionId = 'verticalShake'; // Shared S action; can be overridden per item.

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.068, 0.20, 7),
    new THREE.MeshStandardMaterial({ color: 0xf8ecd6, roughness: 1, flatShading: true }),
  );
  stem.position.y = 0.10;
  stem.castShadow = true;
  group.add(stem);

  // Half of a round sphere makes a distinct mushroom cap.
  const radius = 0.20;
  const capHeight = radius * 0.78;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }),
  );
  cap.position.y = 0.20;
  cap.scale.y = 0.78;
  cap.castShadow = true;
  group.add(cap);

  const spotMaterial = new THREE.MeshStandardMaterial({ color: 0xfff8eb, roughness: 1 });
  const up = new THREE.Vector3(0, 1, 0);
  const spots = [
    [0.40, 0.75, 0.030],
    [0.70, 2.40, 0.025],
    [0.88, 4.55, 0.026],
    [0.56, 5.55, 0.020],
  ];

  for (const [theta, phi, spotRadius] of spots) {
    const normal = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi) / radius,
      Math.cos(theta) / capHeight,
      Math.sin(theta) * Math.sin(phi) / radius,
    ).normalize();

    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(spotRadius, 8, 6),
      spotMaterial,
    );
    spot.position.set(
      radius * Math.sin(theta) * Math.cos(phi),
      0.20 + capHeight * Math.cos(theta),
      radius * Math.sin(theta) * Math.sin(phi),
    );
    spot.position.addScaledVector(normal, 0.004);
    spot.quaternion.setFromUnitVectors(up, normal);
    spot.scale.y = 0.36;
    group.add(spot);
  }

  group.scale.setScalar(scale);
  return group;
}
