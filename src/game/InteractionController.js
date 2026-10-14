import * as THREE from 'three';

const PICKUP_DISTANCE = 1.65;
const TOSS_DURATION = 0.38;
const SWING_DURATION = 0.62;
const LABELS = { mushroom: 'キノコ', flower: '花' };

/**
 * Small, extensible pickup controller. New objects can opt in by setting
 * mesh.userData.pickupType and optionally userData.onAction(controller).
 * Grass is an InstancedMesh and intentionally never participates.
 */
export class InteractionController {
  constructor({ world, player, camera, scene }) {
    this.world = world;
    this.player = player;
    this.held = null;
    this.swingRemaining = 0;
    this.tosses = [];

    // A second display-only copy keeps the item visible in POV, where the
    // avatar mesh is hidden to prevent seeing the inside of its head.
    this.cameraItem = new THREE.Group();
    this.cameraItem.name = 'HeldItemPOV';
    this.cameraItem.position.set(0.62, -0.54, -1.25);
    this.cameraItem.visible = false;
    camera.add(this.cameraItem);
    scene.add(camera);
  }

  findNearest() {
    const origin = this.player.group.position;
    let closest = null;
    let distance = PICKUP_DISTANCE;
    for (const item of this.world.content.children) {
      if (!item.userData.pickupType || item.userData.isTossing) continue;
      const d = Math.hypot(item.position.x - origin.x, item.position.z - origin.z);
      if (d < distance) {
        closest = item;
        distance = d;
      }
    }
    return closest;
  }

  interact() {
    if (this.held) return this.plant();
    const object = this.findNearest();
    if (!object) return false;
    this.held = object;
    this.world.content.remove(object);
    this.player.rightArm.add(object);
    object.position.set(0.04, -0.47, 0.13);
    object.rotation.set(0, 0, 0);
    this.cameraItem.clear();
    const preview = object.clone(true);
    preview.scale.multiplyScalar(1.9);
    this.cameraItem.add(preview);
    this.swingRemaining = 0;
    return true;
  }

  plant() {
    if (!this.held) return false;
    const object = this.held;
    this.held = null;
    this.swingRemaining = 0;
    this.player.rightArm.rotation.z = 0;
    this.cameraItem.clear();
    this.cameraItem.visible = false;

    const origin = this.player.group.position;
    const facing = this.player.facing;
    const forwardX = Math.sin(facing);
    const forwardZ = Math.cos(facing);
    const x = THREE.MathUtils.clamp(origin.x + forwardX * 1.30, -this.world.limit + 0.3, this.world.limit - 0.3);
    const z = THREE.MathUtils.clamp(origin.z + forwardZ * 1.30, this.world.minWalkZ + 0.28, this.world.limit - 0.3);
    const start = new THREE.Vector3(origin.x + forwardX * 0.55, 0.85, origin.z + forwardZ * 0.55);
    const end = new THREE.Vector3(x, -0.03, z);

    this.player.rightArm.remove(object);
    this.world.content.add(object);
    object.position.copy(start);
    object.rotation.set(0, 0, 0);
    object.userData.isTossing = true;
    this.tosses.push({ object, start, end, elapsed: 0 });
    return true;
  }

  action() {
    if (!this.held) return false;
    // This per-object hook is where future items get unique actions.
    if (typeof this.held.userData.onAction === 'function') {
      this.held.userData.onAction(this);
    } else {
      this.swingRemaining = SWING_DURATION; // flower and mushroom: just shake
    }
    return true;
  }

  update(dt, isFirstPerson = false) {
    this.cameraItem.visible = !!this.held && isFirstPerson;
    if (this.held) {
      this.swingRemaining = Math.max(0, this.swingRemaining - dt);
      const t = SWING_DURATION - this.swingRemaining;
      const intensity = this.swingRemaining / SWING_DURATION;
      const angle = this.swingRemaining > 0 ? Math.sin(t * 28) * intensity * 0.75 : 0;
      this.player.rightArm.rotation.z = angle;
      this.cameraItem.rotation.z = angle;
    } else {
      this.player.rightArm.rotation.z = 0;
      this.cameraItem.rotation.z = 0;
    }

    for (let i = this.tosses.length - 1; i >= 0; i--) {
      const toss = this.tosses[i];
      toss.elapsed += dt;
      const t = Math.min(toss.elapsed / TOSS_DURATION, 1);
      toss.object.position.lerpVectors(toss.start, toss.end, t);
      toss.object.position.y += Math.sin(Math.PI * t) * 0.28;
      toss.object.rotation.z = Math.sin(Math.PI * t) * 0.28;
      if (t === 1) {
        toss.object.position.copy(toss.end);
        toss.object.rotation.set(0, 0, 0);
        toss.object.userData.isTossing = false;
        this.tosses.splice(i, 1);
      }
    }
  }

  getHint() {
    if (this.held) return `${LABELS[this.held.userData.pickupType] ?? 'アイテム'}を持っています　A：植える　S：振る`;
    const nearest = this.findNearest();
    if (nearest) return 'A：引っこ抜く';
    // Stay out of the way when there is nothing close enough to pick up.
    return '';
  }
}
