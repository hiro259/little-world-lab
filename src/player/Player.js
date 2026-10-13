import * as THREE from 'three';

const BODY_COLOR = 0x8e96cf;
const BODY_SHADOW = 0x7783be;
const SKIN_COLOR = 0xffdfb2;
const DARK_COLOR = 0x33424a;

function sphere(parent, material, radius, x, y, z, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export class Player {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Player';
    this.avatar = new THREE.Group();
    this.group.add(this.avatar);

    this.velocity = new THREE.Vector3();
    this.targetVelocity = new THREE.Vector3();
    // Keep the starting heading in sync with the avatar's rendered +Z facing.
    this.facing = 0;
    this.walkPhase = 0;

    const skin = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.94 });
    const jacket = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.9 });
    const jacketDark = new THREE.MeshStandardMaterial({ color: BODY_SHADOW, roughness: 0.93 });
    const eyes = new THREE.MeshStandardMaterial({ color: DARK_COLOR, roughness: 0.6 });
    const blush = new THREE.MeshStandardMaterial({ color: 0xf6a6a5, roughness: 1 });
    const boots = new THREE.MeshStandardMaterial({ color: 0x657f8a, roughness: 0.95 });

    // The avatar faces +Z in its local coordinates.
    sphere(this.avatar, jacket, 0.53, 0, 0.71, 0, [0.8, 1, 0.67]);
    sphere(this.avatar, jacketDark, 0.32, 0, 0.39, -0.06, [1, 0.38, 0.85]);
    sphere(this.avatar, skin, 0.54, 0, 1.50, 0.05, [1, 0.95, 0.94]);
    sphere(this.avatar, jacket, 0.29, 0, 1.87, -0.16, [1, 0.3, 0.95]);

    // Tiny face: two eyes, rose cheeks and a small smile.
    sphere(this.avatar, eyes, 0.045, -0.174, 1.53, 0.533, [1, 1.15, 0.60]);
    sphere(this.avatar, eyes, 0.045, 0.174, 1.53, 0.533, [1, 1.15, 0.60]);
    sphere(this.avatar, blush, 0.075, -0.28, 1.40, 0.47, [1.35, 0.5, 0.3]);
    sphere(this.avatar, blush, 0.075, 0.28, 1.40, 0.47, [1.35, 0.5, 0.3]);
    sphere(this.avatar, eyes, 0.026, 0, 1.40, 0.555, [1.2, 0.52, 0.45]);

    // Swing the limbs rather than using an animation library.
    this.leftArm = new THREE.Group();
    this.rightArm = new THREE.Group();
    this.leftArm.position.set(-0.39, 0.91, 0);
    this.rightArm.position.set(0.39, 0.91, 0);
    this.avatar.add(this.leftArm, this.rightArm);
    sphere(this.leftArm, jacket, 0.16, -0.055, -0.18, 0, [0.85, 1.35, 0.9]);
    sphere(this.rightArm, jacket, 0.16, 0.055, -0.18, 0, [0.85, 1.35, 0.9]);
    sphere(this.leftArm, skin, 0.12, -0.075, -0.36, 0);
    sphere(this.rightArm, skin, 0.12, 0.075, -0.36, 0);

    this.leftLeg = new THREE.Group();
    this.rightLeg = new THREE.Group();
    this.leftLeg.position.set(-0.18, 0.42, 0);
    this.rightLeg.position.set(0.18, 0.42, 0);
    this.avatar.add(this.leftLeg, this.rightLeg);
    sphere(this.leftLeg, boots, 0.19, 0, -0.23, 0.04, [0.88, 1.3, 1.22]);
    sphere(this.rightLeg, boots, 0.19, 0, -0.23, 0.04, [0.88, 1.3, 1.22]);

    // A faint ground shadow keeps the character grounded even on mobile.
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.65, 24),
      new THREE.MeshBasicMaterial({ color: 0x47765c, transparent: true, opacity: 0.12, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.018;
    this.group.add(shadow);
  }

  setFacing(angle) {
    this.facing = angle;
    this.avatar.rotation.y = angle;
  }

  update(dt, axes, cameraForward, cameraRight, worldLimit, lockFacing = false) {
    this.targetVelocity.copy(cameraForward).multiplyScalar(axes.y);
    this.targetVelocity.addScaledVector(cameraRight, axes.x);
    if (this.targetVelocity.lengthSq() > 0.01) this.targetVelocity.normalize();
    this.targetVelocity.multiplyScalar(5.5);

    // Exponential easing stays consistent at varying frame rates.
    const blend = 1 - Math.exp(-12 * dt);
    this.velocity.lerp(this.targetVelocity, blend);

    this.group.position.addScaledVector(this.velocity, dt);
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -worldLimit, worldLimit);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -worldLimit, worldLimit);

    const speed = this.velocity.length();
    // In POV the avatar follows the look direction, not walking velocity:
    // strafing/backing up must not silently turn the character.
    if (!lockFacing && speed > 0.12) {
      const desiredFacing = Math.atan2(this.velocity.x, this.velocity.z);
      const turn = Math.atan2(Math.sin(desiredFacing - this.facing), Math.cos(desiredFacing - this.facing));
      this.setFacing(this.facing + turn * (1 - Math.exp(-14 * dt)));
    }

    this.walkPhase += speed * dt * 2.5;
    const stride = Math.sin(this.walkPhase) * Math.min(speed / 5, 1);
    this.leftArm.rotation.x = stride * 0.55;
    this.rightArm.rotation.x = -stride * 0.55;
    this.leftLeg.rotation.x = -stride * 0.50;
    this.rightLeg.rotation.x = stride * 0.50;
    this.avatar.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.042 * Math.min(speed / 4, 1);
  }
}
