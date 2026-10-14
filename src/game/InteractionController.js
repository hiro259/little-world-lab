import * as THREE from 'three';
import { performHeldAction, getHeldActionLabel } from './HeldActions.js';

const PICKUP_DISTANCE = 1.65;
const TOSS_DURATION = 0.38;
const SWING_DURATION = 0.62;
const LABELS = { mushroom: 'キノコ', flower: '花', clam: 'アサリ', crab: 'カニ' };
// The right-hand grip is relative to the shoulder pivot. With the arm
// stretched forward, local -Y points forward and local -Z points downward.
// Each item's carry.gripHeight keeps a different length of stem below the hand.
// On a +Z-facing avatar, local -X is the character's right hand.
const HAND_GRIP_LOCAL = new THREE.Vector3(-0.12, -0.45, 0);
const DEFAULT_HELD_CAMERA_POSITION = new THREE.Vector3(0.54, -0.62, -1.45);
const DEFAULT_CARRY = { gripHeight: 0.16, povScale: 1.5 };
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
    // Optional heading of an item relative to the avatar at the moment of
    // pickup. Living beach creatures shouldn't suddenly turn to face the
    // same direction as the player when attached to the carrying arm.
    this.heldRelativeOrientation = null;
    this.swingRemaining = 0;
    this.tosses = [];

    // A second display-only copy keeps the item visible in POV, where the
    // avatar mesh is hidden to prevent seeing the inside of its head.
    this.cameraItem = new THREE.Group();
    this.cameraItem.name = 'HeldItemPOV';
    this.cameraItem.position.copy(DEFAULT_HELD_CAMERA_POSITION);
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
    const carry = object.userData.carry ?? DEFAULT_CARRY;
    // Capture orientation BEFORE reparenting. Without this, the crab snaps
    // to the avatar's heading when it enters the outstretched right hand.
    this.heldRelativeOrientation = carry.preserveHeading
      ? this.player.avatar.getWorldQuaternion(new THREE.Quaternion()).invert()
        .multiply(object.getWorldQuaternion(new THREE.Quaternion()))
      : null;
    this.held = object;
    object.userData.isHeld = true;
    this.world.content.remove(object);
    this.player.rightArm.add(object);
    // Align each item's grip with the modeled hand.
    const gripHeight = (carry.gripHeight ?? DEFAULT_CARRY.gripHeight) * object.scale.y;
    object.position.copy(HAND_GRIP_LOCAL);
    object.position.z = -gripHeight;
    // The arm pitches forward -90°. Counter-rotate so the item stays
    // upright. Creatures also retain their captured heading relative to
    // the avatar, rather than abruptly rotating when being caught.
    object.rotation.set(-CARRY_ARM_ANGLE, 0, 0);
    if (this.heldRelativeOrientation) {
      object.quaternion.copy(this.player.rightArm.quaternion).invert()
        .multiply(this.heldRelativeOrientation);
    }
    this.cameraItem.clear();
    const preview = object.clone(true);
    // Preserve the item's +Y up and +Z front in camera coordinates.
    // Camera looks along -Z, so the flower's front (+Z) faces the viewer
    // without an extra 180° flip.
    preview.position.set(0, 0, 0);
    preview.rotation.set(0, 0, 0);
    if (this.heldRelativeOrientation) {
      // POV camera looks down local -Z; the avatar faces +Z. This 180°
      // basis conversion makes the POV crab face the same WORLD direction
      // as the third-person crab, instead of visually reversing it.
      preview.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
        .multiply(this.heldRelativeOrientation);
    }
    preview.scale.multiplyScalar(carry.povScale ?? DEFAULT_CARRY.povScale);
    this.cameraItem.position.fromArray(carry.povPosition ?? DEFAULT_HELD_CAMERA_POSITION.toArray());
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
    // Preserve heading when returning the creature from hand to ground.
    // On release the animal will keep its current direction as the player
    // may have turned while carrying it.
    const landingOrientation = this.heldRelativeOrientation
      ? this.player.avatar.getWorldQuaternion(new THREE.Quaternion())
        .multiply(this.heldRelativeOrientation)
      : null;
    this.heldRelativeOrientation = null;
    this.held = null;
    object.userData.isHeld = false;
    this.swingRemaining = 0;
    this.player.rightArm.rotation.z = 0;
    this.player.rightArm.rotation.x = 0;
    this.cameraItem.rotation.x = 0;
    this.cameraItem.position.copy(DEFAULT_HELD_CAMERA_POSITION);
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
    if (landingOrientation) object.quaternion.copy(landingOrientation);
    object.userData.isTossing = true;
    this.tosses.push({ object, start, end, elapsed: 0, landingOrientation });
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
      const carry = this.held.userData.carry ?? DEFAULT_CARRY;
      const gripHeight = (carry.gripHeight ?? DEFAULT_CARRY.gripHeight) * this.held.scale.y;
      this.held.position.copy(HAND_GRIP_LOCAL);
      this.held.position.z = -gripHeight;
      // Keep the stems vertical as the outstretched arm bobs up and down.
      this.held.rotation.x = -this.player.rightArm.rotation.x;
      if (this.heldRelativeOrientation) {
        // Cancel out the arm's X pitch before applying the captured
        // heading. This keeps the crab level during S-key shakes.
        this.held.quaternion.copy(this.player.rightArm.quaternion).invert()
          .multiply(this.heldRelativeOrientation);
      }

      // POV uses the same up/down rhythm; never roll the item sideways.
      this.cameraItem.position.fromArray(carry.povPosition ?? DEFAULT_HELD_CAMERA_POSITION.toArray());
      this.cameraItem.position.y += shake * 0.15;
      this.cameraItem.rotation.x = shake * 0.13;
      this.cameraItem.rotation.z = 0;
      // Animated pickups may synchronize moving parts of their first-person
      // display copy. The crab uses this for legs/claws, while S stays the
      // same shared vertical shake as flowers and mushrooms.
      this.held.userData.syncHeldPreview?.(this.cameraItem.children[0]);
    } else {
      // Walking arm swing is controlled by Player when nothing is held.
      this.cameraItem.position.copy(DEFAULT_HELD_CAMERA_POSITION);
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
        if (toss.landingOrientation) toss.object.quaternion.copy(toss.landingOrientation);
        toss.object.userData.isTossing = false;
        this.tosses.splice(i, 1);
      }
    }
  }

  getHint() {
    if (this.held) {
      const isBeachItem = ['crab', 'clam'].includes(this.held.userData.pickupType);
      const verb = isBeachItem ? '離す' : '植える';
      return `${LABELS[this.held.userData.pickupType] ?? 'アイテム'}を持っています　A：${verb}　S：${getHeldActionLabel(this.held)}`;
    }
    const nearest = this.findNearest();
    if (nearest) {
      if (nearest.userData.pickupType === 'crab') return 'A：捕まえる';
      if (nearest.userData.pickupType === 'clam') return 'A：拾う';
      return 'A：引っこ抜く';
    }
    // Stay out of the way when there is nothing close enough to pick up.
    return '';
  }
}
