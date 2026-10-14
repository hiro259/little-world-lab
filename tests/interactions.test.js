import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { Player } from '../src/player/Player.js';
import { InteractionController } from '../src/game/InteractionController.js';
import { createFlower } from '../src/objects/Flower.js';
import { registerHeldAction, performHeldAction } from '../src/game/HeldActions.js';

function setup(worldId = '01') {
  const scene = new THREE.Scene();
  const world = new World(scene, worldId);
  const player = new Player();
  const camera = new THREE.PerspectiveCamera();
  scene.add(player.group);
  const interaction = new InteractionController({ world, player, camera, scene });
  return { scene, world, player, camera, interaction };
}

test('flowers and mushrooms are pickable but instanced meadow grass cannot be uprooted', () => {
  const { scene, world, player, interaction } = setup();
  const mushrooms = world.content.children.filter((item) => item.userData.pickupType === 'mushroom');
  const flowers = world.content.children.filter((item) => item.userData.pickupType === 'flower');
  assert.equal(mushrooms.length, 3);
  assert.equal(flowers.length, 3);
  assert.ok(scene.children.some((item) => item.name === 'MeadowGrass'));
  assert.equal(interaction.interact(), false, 'nothing is in reach at the starting position');
  assert.equal(interaction.held, null);
  assert.equal(interaction.getHint(), '', 'there is no prompt when objects are too far away');

  const flower = flowers[0];
  player.group.position.set(flower.position.x, 0, flower.position.z);
  assert.equal(interaction.findNearest(), flower);
  assert.equal(interaction.getHint(), 'A：引っこ抜く', 'show a short prompt when close enough');
  assert.equal(interaction.interact(), true);
  assert.equal(interaction.held, flower);
  assert.equal(flower.parent, player.rightArm);
  assert.ok(!world.content.children.includes(flower));
});

test('A picks up a mushroom, S shakes it, A tosses it to replant elsewhere', () => {
  const { world, player, interaction } = setup();
  const mushroom = world.content.children.find((item) => item.name === 'Mushroom');
  const original = mushroom.position.clone();
  player.group.position.set(original.x, 0, original.z);
  assert.equal(interaction.interact(), true);
  assert.equal(interaction.held, mushroom);
  assert.equal(interaction.cameraItem.children.length, 1);
  assert.deepEqual(interaction.cameraItem.children[0].position.toArray(), [0, 0, 0],
    'the POV item should not inherit the hand-local offset');

  interaction.update(0.03, true);
  assert.equal(interaction.cameraItem.visible, true, 'held item appears in POV');
  assert.equal(interaction.action(), true);
  interaction.update(0.08, true);
  assert.notEqual(player.rightArm.rotation.x, 0, 'S pitches the carrying arm vertically');
  assert.equal(player.rightArm.rotation.z, 0, 'S must not swing sideways into the face');
  assert.equal(interaction.cameraItem.rotation.z, 0, 'POV must not roll the held object sideways');

  // Transport the mushroom to another location before planting.
  player.group.position.set(7, 0, 5);
  player.setFacing(0);
  assert.equal(interaction.plant(), true);
  assert.equal(interaction.held, null);
  assert.equal(interaction.cameraItem.children.length, 0);
  assert.equal(interaction.cameraItem.visible, false);
  assert.equal(player.rightArm.rotation.z, 0);
  assert.equal(player.rightArm.rotation.x, 0, 'release resets the carrying arm');
  assert.equal(mushroom.parent, world.content);
  assert.equal(mushroom.userData.isTossing, true);
  interaction.update(0.5);
  assert.equal(mushroom.userData.isTossing, false);
  assert.ok(mushroom.position.distanceTo(original) > 2, 'mushroom was replanted at another place');
  assert.equal(mushroom.position.y, -0.03);
  assert.ok(Math.hypot(mushroom.position.x - 7, mushroom.position.z - 5) <= 1.5);
  assert.equal(world.content.children.filter((item) => item.name === 'Mushroom').length, 3);
});

test('flower can be picked up and planted, and a per-object action can override shaking', () => {
  const { world, player, interaction } = setup();
  const flower = world.content.children.find((item) => item.name === 'Flower');
  player.group.position.set(flower.position.x, 0, flower.position.z);
  assert.equal(interaction.interact(), true);
  assert.match(interaction.getHint(), /花を持っています/);
  let actionCount = 0;
  flower.userData.onAction = () => { actionCount += 1; };
  assert.equal(interaction.action(), true);
  assert.equal(actionCount, 1, 'future per-object actions can be plugged in');
  assert.equal(interaction.swingRemaining, 0);

  player.group.position.set(9, 0, -8);
  player.setFacing(1.3);
  assert.equal(interaction.interact(), true, 'second A drops instead of picking something else');
  interaction.update(1);
  assert.ok(flower.position.distanceTo(new THREE.Vector3(9, -0.03, -8)) < 2);
  assert.equal(world.content.children.filter((item) => item.name === 'Flower').length, 3);

  const freshFlower = createFlower({ petalColor: 0xff6688 });
  assert.equal(freshFlower.userData.pickupType, 'flower');
  assert.equal(freshFlower.name, 'Flower');
});

test('WORLD 02 mushrooms can be planted on beach but not out into the sea', () => {
  const { world, player, interaction } = setup('02');
  assert.equal(world.content.children.filter((item) => item.name === 'Flower').length, 0);
  const mushroom = world.content.children.find((item) => item.name === 'Mushroom');
  player.group.position.copy(mushroom.position);
  assert.equal(interaction.interact(), true);
  player.group.position.set(0, 0, world.minWalkZ);
  player.setFacing(Math.PI); // straight toward the sea
  assert.equal(interaction.plant(), true);
  interaction.update(0.5);
  assert.ok(mushroom.position.z > 0, 'cannot place a mushroom in water');
  assert.ok(mushroom.position.z >= world.minWalkZ + 0.28);
});

test('only one object may be carried at a time and held item persists between camera modes', () => {
  const { world, player, interaction } = setup();
  const flower = world.content.children.find((item) => item.name === 'Flower');
  player.group.position.set(flower.position.x, 0, flower.position.z);
  assert.equal(interaction.interact(), true);
  assert.equal(interaction.held, flower);
  interaction.update(0.016, false);
  assert.equal(interaction.cameraItem.visible, false);
  interaction.update(0.016, true);
  assert.equal(interaction.cameraItem.visible, true);
  assert.equal(interaction.cameraItem.children.length, 1);
  assert.equal(world.content.children.filter((item) => item.name === 'Mushroom').length, 3);
});

test('S makes both flower and mushroom bob vertically instead of swinging across the face', () => {
  for (const type of ['Flower', 'Mushroom']) {
    const { world, player, interaction } = setup();
    const object = world.content.children.find((item) => item.name === type);
    assert.equal(object.userData.actionId, 'verticalShake', `${type} uses the shared vertical action`);
    player.group.position.copy(object.position);
    assert.equal(interaction.interact(), true);
    interaction.update(0, false);
    const itemY = object.getWorldPosition(new THREE.Vector3()).y;
    const localY = object.position.y;
    const cameraY = interaction.cameraItem.position.y;

    assert.equal(interaction.action(), true);
    interaction.update(0.07, true);
    assert.notEqual(object.getWorldPosition(new THREE.Vector3()).y, itemY, `${type} moves up/down in third person`);
    assert.equal(object.position.y, localY, 'the grip stays fixed in the extended hand');
    assert.notEqual(interaction.cameraItem.position.y, cameraY, `${type} moves up/down in POV`);
    assert.equal(player.rightArm.rotation.z, 0, `${type} arm should never rotate laterally`);
    assert.equal(interaction.cameraItem.rotation.z, 0, `${type} POV item should never roll sideways`);
    assert.ok(object.getWorldPosition(new THREE.Vector3()).x > player.group.position.x + 0.4,
      'item stays to the side of the face');
    assert.ok(Math.abs(player.rightArm.rotation.x + Math.PI / 2) <= 0.17,
      'the arm keeps pointing forward during vertical shakes');

    interaction.update(1, true);
    assert.equal(interaction.swingRemaining, 0, 'shared action completes');
    assert.ok(Math.abs(object.getWorldPosition(new THREE.Vector3()).y - itemY) < 1e-8,
      'item returns to neutral carrying height');
    assert.equal(interaction.cameraItem.position.y, cameraY, 'POV item returns to neutral height');
    assert.equal(player.rightArm.rotation.z, 0);
  }
});

test('POV preview stays upright, faces the camera, and uses a fitting size for each item', () => {
  const previews = [];
  for (const type of ['Flower', 'Mushroom']) {
    const { world, player, camera, interaction } = setup();
    const item = world.content.children.find((candidate) => candidate.name === type);
    player.group.position.copy(item.position);
    assert.equal(interaction.interact(), true);
    interaction.update(0.016, true);

    const preview = interaction.cameraItem.children[0];
    assert.equal(preview.name, type);
    assert.deepEqual(preview.position.toArray(), [0, 0, 0]);
    assert.equal(preview.rotation.y, 0, 'flower front must face the player, not be reversed');
    assert.equal(preview.rotation.x, 0, 'flower stem and mushroom cap must not be upside down');
    assert.ok(interaction.cameraItem.position.x > 0, 'preview stays on the right side');
    assert.ok(interaction.cameraItem.position.y < 0, 'preview stays below the eye line');
    assert.ok(interaction.cameraItem.position.z < -1, 'preview is far enough ahead to be visible');
    assert.ok(interaction.cameraItem.parent === camera);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(preview.quaternion);
    assert.ok(up.y > 0.999, 'POV object is upright');
    previews.push({ scale: preview.scale.y, position: interaction.cameraItem.position.toArray() });
  }
  assert.notDeepEqual(previews[0].position, previews[1].position,
    'flower and mushroom must have separately tuned first-person positions');
  assert.notEqual(previews[0].scale, previews[1].scale,
    'small mushrooms are displayed larger than tall flowers');
});

test('flowers and mushrooms have a hand-sized grip instead of sharing a floating root position', () => {
  const localHandGrip = new THREE.Vector3(0.12, -0.45, 0);
  const gripPoints = [];
  for (const type of ['Flower', 'Mushroom']) {
    const { world, player, interaction } = setup();
    const item = world.content.children.find((candidate) => candidate.name === type);
    player.group.position.copy(item.position);
    assert.equal(interaction.interact(), true);
    interaction.update(0.016, false);

    const grip = item.localToWorld(new THREE.Vector3(0, item.userData.carry.gripHeight, 0));
    const hand = player.rightArm.localToWorld(localHandGrip.clone());
    assert.ok(grip.distanceTo(hand) < 1e-8,
      `${type}: stem grip point should line up with the extended right hand`);

    const up = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(item.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(up.y > 0.999, `${type}: item is upright in third-person mode`);
    gripPoints.push(item.position.z);

    assert.equal(interaction.action(), true);
    interaction.update(0.08, false);
    const swingingUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(item.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(swingingUp.y > 0.999, `${type}: item stays upright while shaking`);
  }
  assert.notEqual(gripPoints[0], gripPoints[1],
    'grip height must be adjusted for flower vs mushroom proportions');
});

test('S actions support reusable registry IDs and an individual action override', () => {
  const { world, player, interaction } = setup();
  const flower = world.content.children.find((item) => item.name === 'Flower');
  player.group.position.copy(flower.position);
  assert.equal(interaction.interact(), true);

  registerHeldAction('testSparkleAction', (controller, item) => {
    assert.equal(controller, interaction);
    item.userData.sparkles = (item.userData.sparkles ?? 0) + 1;
  }, '光らせる');
  flower.userData.actionId = 'testSparkleAction';
  assert.match(interaction.getHint(), /S：光らせる/);
  assert.equal(interaction.action(), true);
  assert.equal(flower.userData.sparkles, 1, 'registered named action is invoked');
  assert.equal(interaction.swingRemaining, 0, 'custom action need not perform the shared shake');

  let uniqueCount = 0;
  flower.userData.actionLabel = '咲かせる';
  flower.userData.onAction = (controller, item) => {
    assert.equal(controller, interaction);
    assert.equal(item, flower);
    uniqueCount += 1;
  };
  assert.match(interaction.getHint(), /S：咲かせる/);
  assert.equal(interaction.action(), true);
  assert.equal(uniqueCount, 1, 'individual handler takes precedence over registered action');
  assert.equal(flower.userData.sparkles, 1);

  delete flower.userData.onAction;
  flower.userData.actionId = 'missingAction';
  assert.equal(interaction.action(), false, 'unknown action IDs fail safely');
  assert.equal(performHeldAction(interaction, null), false);
  assert.throws(() => registerHeldAction('', () => {}), TypeError);
  assert.throws(() => registerHeldAction('broken', null), TypeError);
});

test('A extends the right arm straight ahead and keeps the object in the hand while walking', () => {
  for (const type of ['Flower', 'Mushroom']) {
    const { world, player, interaction } = setup();
    const object = world.content.children.find((item) => item.name === type);
    player.group.position.copy(object.position);

    assert.equal(interaction.interact(), true);
    interaction.update(0.016, false);

    assert.ok(Math.abs(player.rightArm.rotation.x + Math.PI / 2) < 1e-10,
      `${type}: idle carrying arm must be exactly forward`);
    assert.equal(player.rightArm.rotation.z, 0);

    const armForward = new THREE.Vector3(0, -1, 0)
      .applyQuaternion(player.rightArm.getWorldQuaternion(new THREE.Quaternion()));
    const characterForward = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(player.avatar.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(armForward.dot(characterForward) > 0.999,
      'an outstretched arm points in the same horizontal direction as the character');

    const heldWorld = object.getWorldPosition(new THREE.Vector3());
    const playerWorld = player.group.getWorldPosition(new THREE.Vector3());
    const direction = heldWorld.clone().sub(playerWorld);
    const characterRight = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(player.avatar.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(direction.dot(characterForward) > 0.4, 'held item is ahead of the character');
    assert.ok(direction.dot(characterRight) > 0.4, 'held item stays beside the right hand');
    assert.ok(heldWorld.y < playerWorld.y + 1.0, 'base of the item is held at hand height');

    // Player applies walking arm swings before the interaction update.
    player.update(0.12, { x: 0, y: 1 }, new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0, 0), world.limit);
    interaction.update(0.12, false);
    assert.ok(Math.abs(player.rightArm.rotation.x + Math.PI / 2) < 1e-10,
      'carrying pose overrides regular walking arm animation');
    assert.equal(player.rightArm.rotation.z, 0);

    assert.equal(interaction.plant(), true);
    assert.equal(player.rightArm.rotation.x, 0, 'placing the object releases the forward arm pose');
  }
});
