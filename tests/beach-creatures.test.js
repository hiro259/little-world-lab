import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { Player } from '../src/player/Player.js';
import { InteractionController } from '../src/game/InteractionController.js';
import { OrbitCamera } from '../src/game/OrbitCamera.js';
import { createClam } from '../src/objects/Clam.js';
import { createCrab } from '../src/objects/Crab.js';

function beachSetup() {
  const scene = new THREE.Scene();
  const world = new World(scene, '02');
  const player = new Player();
  const camera = new THREE.PerspectiveCamera();
  scene.add(player.group);
  const interactions = new InteractionController({ world, player, camera, scene });
  return { world, scene, player, camera, interactions };
}

test('WORLD 02 has three individual clams and three independent, walking crabs instead of mushrooms', () => {
  const { world } = beachSetup();
  const counts = (name) => world.content.children.filter((item) => item.name === name).length;
  assert.equal(counts('Clam'), 3);
  assert.equal(counts('Crab'), 3);
  assert.equal(counts('Mushroom'), 0);
  assert.equal(counts('Flower'), 0);
  assert.equal(counts('Shovel'), 1);
  assert.equal(world.updatables.length, 3, 'each crab has its own animation');
  for (const item of world.content.children) {
    assert.ok(item.position.z >= world.minWalkZ + 0.28);
    assert.equal(item.userData.actionId, item.name === 'Shovel' ? 'digSand' : 'verticalShake');
    assert.ok(item.userData.carry.gripHeight > 0);
  }
  const meadow = new World(new THREE.Scene(), '01');
  assert.equal(meadow.content.children.filter((item) => item.name === 'Mushroom').length, 3);
  assert.equal(meadow.content.children.filter((item) => item.name === 'Flower').length, 3);
  assert.equal(meadow.content.children.filter((item) => item.name === 'Crab').length, 0);
  assert.equal(meadow.content.children.filter((item) => item.name === 'Clam').length, 0);
});

test('clams have a recognizable shell and are stationary on the beach', () => {
  const { world } = beachSetup();
  const clam = world.content.children.find((item) => item.name === 'Clam');
  const previous = clam.position.clone();
  const shell = new THREE.Box3().setFromObject(clam).getSize(new THREE.Vector3());
  assert.ok(shell.x > 0.35 && shell.x < 0.9);
  assert.ok(shell.y > 0.12 && shell.y < 0.6);
  assert.ok(clam.children.filter((child) => child.isMesh).length >= 5);
  world.update(5, {});
  assert.ok(clam.position.equals(previous), 'clams stay where they were placed');
  const fresh = createClam({ scale: 0.8 });
  assert.equal(fresh.name, 'Clam');
  assert.equal(fresh.scale.x, 0.8);
});

test('crabs slowly walk sideways on sand and cannot enter the sea or leave the square', () => {
  const { world } = beachSetup();
  const crabs = world.content.children.filter((item) => item.name === 'Crab');
  const initial = crabs.map((crab) => crab.position.clone());
  const firstLeg = crabs[0].getObjectByName('CrabLegR0');
  assert.ok(firstLeg);
  const legStart = firstLeg.rotation.z;

  for (let i = 0; i < 3200; i++) {
    world.update(0.05, {});
    for (const crab of crabs) {
      assert.ok(crab.position.x >= -world.limit && crab.position.x <= world.limit,
        'crabs stay inside the horizontal square');
      assert.ok(crab.position.z >= world.minWalkZ && crab.position.z <= world.limit,
        'crabs stay on dry sand, never in the ocean');
      assert.equal(crab.position.y, -0.03, 'crabs remain grounded');
    }
  }
  assert.ok(crabs.some((crab, i) => crab.position.distanceTo(initial[i]) > 0.15),
    'at least one crab moved visibly');
  assert.notEqual(firstLeg.rotation.z, legStart, 'legs keep moving as the crab walks');
  assert.ok(crabs.every((crab, i) => crab.position.distanceTo(initial[i]) < 3),
    'crabs wander locally rather than racing across the beach');
});

test('a held crab stops travelling but legs and claws animate in both third-person and POV', () => {
  const { world, player, interactions } = beachSetup();
  const crab = world.content.children.find((item) => item.name === 'Crab');
  player.group.position.copy(crab.position);
  assert.equal(interactions.getHint(), 'A：捕まえる');
  assert.equal(interactions.interact(), true);
  assert.equal(crab.parent, player.rightArm);
  assert.equal(crab.userData.isHeld, true);

  const fixedPosition = crab.position.clone();
  const leg = crab.getObjectByName('CrabLegR0');
  const claw = crab.getObjectByName('CrabClawL');
  const legBefore = leg.rotation.z;
  const clawBefore = claw.rotation.z;
  world.update(0.12, {});
  interactions.update(0.12, true);

  assert.ok(crab.position.equals(fixedPosition), 'held crabs must not wander');
  assert.notEqual(leg.rotation.z, legBefore, 'held crab still moves its legs');
  assert.notEqual(claw.rotation.z, clawBefore, 'held crab still moves its claws');
  assert.ok(interactions.cameraItem.visible);
  const preview = interactions.cameraItem.children[0];
  assert.equal(preview.name, 'Crab');
  assert.equal(preview.getObjectByName('CrabLegR0').rotation.z, leg.rotation.z);
  assert.equal(preview.getObjectByName('CrabClawL').rotation.z, claw.rotation.z);

  const originalLegPose = leg.rotation.z;
  world.update(0.11, {});
  interactions.update(0.11, false);
  assert.notEqual(leg.rotation.z, originalLegPose, 'the legs animate while third-person carrying');
  assert.equal(interactions.cameraItem.visible, false, 'POV clone is hidden in normal camera');
  interactions.update(0, true);
  assert.equal(interactions.cameraItem.visible, true);
  assert.equal(preview.getObjectByName('CrabLegR0').rotation.z, leg.rotation.z);
});

test('A releases the crab onto sand and it resumes walking; S uses only the shared vertical shake', () => {
  const { world, player, interactions } = beachSetup();
  const crab = world.content.children.find((item) => item.name === 'Crab');
  player.group.position.copy(crab.position);
  assert.equal(interactions.interact(), true);
  assert.equal(interactions.action(), true);
  world.update(0.07, {});
  interactions.update(0.07, true);
  assert.ok(interactions.swingRemaining > 0);
  assert.equal(player.rightArm.rotation.z, 0, 'shared action remains vertical');

  player.group.position.set(2, 0, 3.2);
  player.setFacing(0);
  assert.equal(interactions.interact(), true);
  assert.equal(crab.parent, world.content);
  assert.equal(crab.userData.isHeld, false);
  assert.equal(crab.userData.isTossing, true);
  const before = crab.position.clone();
  world.update(0.1, {});
  assert.ok(crab.position.equals(before), 'the crab does not wander during release animation');
  interactions.update(0.5);
  assert.equal(crab.userData.isTossing, false);
  assert.ok(crab.position.z >= world.minWalkZ);
  const placed = crab.position.clone();
  for (let i = 0; i < 24; i++) world.update(0.08, {});
  assert.ok(crab.position.distanceTo(placed) > 0.01, 'crab resumes its slow walk');
});

test('new crabs expose a reusable animation sync hook for POV without custom S action', () => {
  const animal = createCrab({ phase: 1.4 });
  assert.equal(animal.mesh.name, 'Crab');
  assert.equal(animal.mesh.userData.actionId, 'verticalShake');
  assert.equal(animal.mesh.userData.onAction, undefined);
  assert.equal(typeof animal.update, 'function');

  const clone = animal.mesh.clone(true);
  const leg = animal.mesh.getObjectByName('CrabLegL1');
  animal.update(0.15);
  animal.mesh.userData.syncHeldPreview(clone);
  assert.equal(clone.getObjectByName('CrabLegL1').rotation.z, leg.rotation.z);
  animal.update(0.14);
  animal.mesh.userData.syncHeldPreview(clone);
  assert.equal(clone.getObjectByName('CrabLegL1').rotation.z, leg.rotation.z);
});

test('catching a crab preserves its world-facing direction, not the player facing', () => {
  const near = (a, b) => Math.abs(a.dot(b)) > 1 - 1e-9;
  const worldY = new THREE.Vector3(0, 1, 0);

  for (const playerYaw of [0, 0.75, Math.PI, -1.2]) {
    for (const crabYaw of [0, 1.1, -2.1]) {
      const { world, player, camera, interactions } = beachSetup();
      const crab = world.content.children.find((item) => item.name === 'Crab');
      player.group.position.copy(crab.position);
      player.setFacing(playerYaw);
      crab.rotation.y = crabYaw;
      const before = crab.getWorldQuaternion(new THREE.Quaternion());

      assert.equal(interactions.interact(), true);
      const held = crab.getWorldQuaternion(new THREE.Quaternion());
      assert.ok(near(held, before),
        `pickup changed the crab heading: player=${playerYaw} crab=${crabYaw}`);

      // A vertical S shake must not turn a live animal onto its side.
      assert.equal(interactions.action(), true);
      world.update(0.08, {});
      interactions.update(0.08, false);
      assert.ok(near(crab.getWorldQuaternion(new THREE.Quaternion()), before),
        'the crab orientation stays unchanged while the arm bobs up and down');
      // Quaternions q and -q represent the same orientation; compare
      // absolute dot product to avoid rejecting visually identical poses.
      assert.ok(near(crab.getWorldQuaternion(new THREE.Quaternion()),
        new THREE.Quaternion().setFromAxisAngle(worldY, crabYaw)));

      // POV copy is camera-attached but must point in the same WORLD
      // direction as the third-person animal (when viewing straight ahead).
      const orbit = new OrbitCamera(camera);
      orbit.setFirstPerson(true, player.facing);
      orbit.follow(0, player.group.position);
      interactions.update(0.7, true); // let the shake finish
      camera.updateMatrixWorld(true);
      const preview = interactions.cameraItem.children[0];
      assert.ok(near(preview.getWorldQuaternion(new THREE.Quaternion()),
        crab.getWorldQuaternion(new THREE.Quaternion())),
        'POV facing should match the third-person crab');

      // Turning while carrying rotates the crab WITH the player but never
      // suddenly resets it to the player's heading.
      const relative = new THREE.Quaternion().setFromAxisAngle(worldY, crabYaw - playerYaw);
      player.setFacing(playerYaw + 0.9);
      orbit.setFirstPerson(false);
      orbit.setFirstPerson(true, player.facing);
      orbit.follow(0, player.group.position);
      interactions.update(0.016, true);
      const expected = player.avatar.getWorldQuaternion(new THREE.Quaternion()).multiply(relative);
      assert.ok(near(crab.getWorldQuaternion(new THREE.Quaternion()), expected),
        'carried crab preserves its heading relative to the avatar after a turn');
      assert.ok(near(preview.getWorldQuaternion(new THREE.Quaternion()), expected),
        'POV and third-person facing agree after the player turns');

      const atRelease = crab.getWorldQuaternion(new THREE.Quaternion());
      assert.equal(interactions.interact(), true);
      assert.ok(near(crab.getWorldQuaternion(new THREE.Quaternion()), atRelease),
        'releasing onto sand must not rotate the crab');
      interactions.update(0.50, false);
      assert.ok(near(crab.getWorldQuaternion(new THREE.Quaternion()), atRelease),
        'crab remains upright and facing the same direction after landing');
      assert.equal(crab.userData.isHeld, false);
      assert.equal(crab.userData.isTossing, false);
      assert.ok(crab.position.z >= world.minWalkZ);
    }
  }
});
