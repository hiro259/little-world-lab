import * as THREE from 'three';

// A playful, slow side-stepping beach crab. Model and animation are procedural.
export function createCrab({ shellColor = 0xe99575, scale = 1, phase = 0 } = {}) {
  const crab = new THREE.Group();
  crab.name = 'Crab';
  crab.userData.pickupType = 'crab';
  crab.userData.actionId = 'verticalShake';
  crab.userData.carry = {
    gripHeight: 0.13,
    // Keep the crab's original heading when catching it, including in POV.
    // Other objects may keep their existing hand-aligned carrying pose.
    preserveHeading: true,
    povScale: 1.35,
    povPosition: [0.57, -0.56, -1.54],
  };

  const shell = new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.91, flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: 0xf9d4a2, roughness: 0.95, flatShading: true });
  const tip = new THREE.MeshStandardMaterial({ color: 0xffc8a6, roughness: 0.94, flatShading: true });
  const eyes = new THREE.MeshStandardMaterial({ color: 0x303f41, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.31, 1), shell);
  body.name = 'CrabShell';
  body.position.y = 0.27;
  body.scale.set(1.12, 0.52, 0.78);
  body.castShadow = true;
  crab.add(body);

  const underside = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), belly);
  underside.position.y = 0.16;
  underside.scale.set(1.08, 0.30, 0.75);
  crab.add(underside);

  const joints = [];
  for (const side of [-1, 1]) {
    const sideName = side === -1 ? 'R' : 'L';

    // Three paired articulated-looking legs. Keep the mesh inside its own
    // joint so it can keep swinging even when the crab is held or tossed.
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Group();
      leg.name = `CrabLeg${sideName}${i}`;
      leg.position.set(side * 0.23, 0.23, -0.18 + i * 0.17);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.068, 0.29, 6), shell);
      top.position.set(side * 0.12, -0.055, 0);
      top.rotation.z = side * 0.82;
      top.castShadow = true;
      leg.add(top);
      const foot = new THREE.Mesh(new THREE.ConeGeometry(0.066, 0.23, 5), tip);
      foot.position.set(side * 0.24, -0.20, 0);
      foot.rotation.z = -side * 0.32;
      foot.castShadow = true;
      leg.add(foot);
      crab.add(leg);
      joints.push({ joint: leg, offset: i * 1.1 + (side < 0 ? 0 : Math.PI), isClaw: false });
    }

    const claw = new THREE.Group();
    claw.name = `CrabClaw${sideName}`;
    claw.position.set(side * 0.30, 0.29, 0.21);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.069, 0.055, 0.28, 7), shell);
    arm.position.set(side * 0.12, -0.01, 0.06);
    arm.rotation.z = side * 0.93;
    arm.castShadow = true;
    claw.add(arm);
    const pinch = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), shell);
    pinch.position.set(side * 0.24, 0.02, 0.16);
    pinch.scale.set(0.91, 0.9, 0.7);
    pinch.castShadow = true;
    claw.add(pinch);
    for (const sign of [-1, 1]) {
      const pincer = new THREE.Mesh(new THREE.ConeGeometry(0.047, 0.17, 6), tip);
      pincer.position.set(side * 0.29, 0.04, 0.16 + sign * 0.09);
      pincer.rotation.x = sign * 0.42;
      claw.add(pincer);
    }
    crab.add(claw);
    joints.push({ joint: claw, offset: side < 0 ? 0 : Math.PI, isClaw: true });

    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.15, 6), shell);
    stalk.position.set(side * 0.13, 0.47, 0.17);
    crab.add(stalk);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), eyes);
    eye.position.set(side * 0.13, 0.56, 0.20);
    crab.add(eye);
  }

  crab.scale.setScalar(scale);
  let elapsed = phase;
  const boundary = { xMin: -20, xMax: 20, zMin: 2.15, zMax: 11.2 };

  function update(dt) {
    elapsed += dt;

    // Leg movement is independent of translation, including when in the
    // player's hand. An update entry stays registered with World after pickup.
    for (const { joint, offset, isClaw } of joints) {
      const beat = Math.sin(elapsed * (isClaw ? 4.2 : 7.2) + offset);
      joint.rotation.z = beat * (isClaw ? 0.21 : 0.28);
      joint.rotation.x = Math.cos(elapsed * 7.2 + offset) * (isClaw ? 0.06 : 0.12);
    }

    // No ground locomotion while held or in the release arc. After release,
    // continue wandering from the new position, without snapping home.
    const onSand = crab.parent?.name === 'AddedObjects';
    if (!onSand || crab.userData.isHeld || crab.userData.isTossing) return;
    const step = Math.min(dt, 0.10);
    crab.position.x = THREE.MathUtils.clamp(
      crab.position.x + Math.cos(elapsed * 0.43 + phase) * step * 0.27,
      boundary.xMin, boundary.xMax,
    );
    crab.position.z = THREE.MathUtils.clamp(
      crab.position.z + Math.sin(elapsed * 0.30 + phase) * step * 0.055,
      boundary.zMin, boundary.zMax,
    );
  }

  // InteractionController uses this extension point to keep the separate POV
  // copy's legs and claws animated, without affecting the reusable S action.
  crab.userData.syncHeldPreview = (preview) => {
    for (const { joint } of joints) {
      const other = preview.getObjectByName(joint.name);
      if (other) other.rotation.copy(joint.rotation);
    }
  };

  return { mesh: crab, update };
}
