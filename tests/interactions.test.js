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
    const itemY = object.position.y;
    const cameraY = interaction.cameraItem.position.y;

    assert.equal(interaction.action(), true);
    interaction.update(0.07, true);
    assert.notEqual(object.position.y, itemY, `${type} moves up/down in third person`);
    assert.notEqual(interaction.cameraItem.position.y, cameraY, `${type} moves up/down in POV`);
    assert.equal(player.rightArm.rotation.z, 0, `${type} arm should never rotate laterally`);
    assert.equal(interaction.cameraItem.rotation.z, 0, `${type} POV item should never roll sideways`);
    assert.ok(object.position.x >= 0.25, 'held item stays on the right-hand side');
    assert.ok(player.rightArm.rotation.x >= 0 && player.rightArm.rotation.x <= 0.45,
      'small forward/backward pitch is limited to avoid the head');

    interaction.update(1, true);
    assert.equal(interaction.swingRemaining, 0, 'shared action completes');
    assert.equal(object.position.y, itemY, 'item returns to neutral carrying height');
    assert.equal(interaction.cameraItem.position.y, cameraY, 'POV item returns to neutral height');
    assert.equal(player.rightArm.rotation.z, 0);
  }
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
