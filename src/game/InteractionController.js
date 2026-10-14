import * as THREE from 'three';
import { performHeldAction, getHeldActionLabel } from './HeldActions.js';

const PICKUP_DISTANCE = 1.65;
const TOSS_DURATION = 0.38;
const SWING_DURATION = 0.62;
const LABELS = { mushroom: 'キノコ', flower: '花' };
// Relative to the right shoulder: sit the item at the hand, a little forward
// and to the side of the head. The arm's local -Y points ahead when raised.
const HELD_ITEM_POSITION = new THREE.Vector3(0.08, -0.49, -0.07);
const HELD_CAMERA_POSITION = new THREE.Vector3(0.65, -0.66, -1.25);
// The arm is modeled hanging along -Y. A -90-degree X rotation points it
// straight forward along the character's local +Z direction.
const CARRY_ARM_ANGLE = -Math.PI / 2;

/**
 * Small, extensible pickup controller. New objects can opt in by setting
 * mesh.userData.pickupType, userData.actionId for shared S actions, or
 * userData.onAction(controller, item) to override with an individual behavior.
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
    this.cameraItem.position.copy(HELD_CAMERA_POSITION);
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
    // Keep the item at the outer side of the right hand, below the face.
    object.position.copy(HELD_ITEM_POSITION);
    // The outstretched arm is pitched -90 degrees. Counter-rotate the
    // object so its stem/cap still point UP, not back toward the face.
    object.rotation.set(-CARRY_ARM_ANGLE, 0, 0);
    this.cameraItem.clear();
    const preview = object.clone(true);
    // Camera forward is -Z whereas avatar forward is +Z. Turn the POV
    // copy around its vertical axis to show the player's actual view
    // of the carried item, without flipping its top and bottom.
    preview.position.set(0, 0, 0);
    preview.rotation.set(0, Math.PI, 0);
    preview.scale.multiplyScalar(1.9);
    this.cameraItem.add(preview);
    this.swingRemaining = 0;
    this.player.rightArm.rotation.x = CARRY_ARM_ANGLE;
    this.player.rightArm.rotation.z = 0;
    this.cameraItem.rotation.z = 0;
    return true;
  }

  plant() {
    if (!this.held) return false;
    const object = this.held;
    this.held = null;
    this.swingRemaining = 0;
    this.player.rightArm.rotation.z = 0;
    this.player.rightArm.rotation.x = 0;
    this.cameraItem.rotation.x = 0;
    this.cameraItem.position.copy(HELD_CAMERA_POSITION);
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

  startVerticalShake() {
    if (!this.held) return false;
    this.swingRemaining = SWING_DURATION;
    return true;
  }

  action() {
    // A shared action ID can be assigned to many object types; onAction
    // is reserved for a unique behavior on an individual object.
    return performHeldAction(this, this.held);
  }

  update(dt, isFirstPerson = false) {
    this.cameraItem.visible = !!this.held && isFirstPerson;
    if (this.held) {
      this.swingRemaining = Math.max(0, this.swingRemaining - dt);
      const progress = 1 - this.swingRemaining / SWING_DURATION;
      // Several short up/down beats with a gentle start/end envelope.
      const shake = this.swingRemaining > 0
        ? Math.sin(progress * Math.PI * 6) * Math.sin(progress * Math.PI)
        : 0;

      // Hold the entire right arm straight out in front, including when
      // walking. S adds only a gentle up/down wrist-level bob about that pose.
      // Never swing in Z or across the character's face.
      this.player.rightArm.rotation.x = CARRY_ARM_ANGLE + shake * 0.16;
      this.player.rightArm.rotation.z = 0;
      this.held.position.copy(HELD_ITEM_POSITION);
      // Preserve an upright object while the arm pitches vertically.
      // Without this, the arm's -90° rotation tips flowers and mushrooms.
      this.held.rotation.x = -this.player.rightArm.rotation.x;

      // POV uses the same up/down rhythm; never roll the item sideways.
      this.cameraItem.position.copy(HELD_CAMERA_POSITION);
      this.cameraItem.position.y += shake * 0.15;
      this.cameraItem.rotation.x = shake * 0.13;
      this.cameraItem.rotation.z = 0;
    } else {
      // Walking arm swing is controlled by Player when nothing is held.
      this.cameraItem.position.copy(HELD_CAMERA_POSITION);
      this.cameraItem.rotation.set(0, 0, 0);
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
    if (this.held) return `${LABELS[this.held.userData.pickupType] ?? 'アイテム'}を持っています　A：植える　S：${getHeldActionLabel(this.held)}`;
    const nearest = this.findNearest();
    if (nearest) return 'A：引っこ抜く';
    // Stay out of the way when there is nothing close enough to pick up.
    return '';
  }
}
