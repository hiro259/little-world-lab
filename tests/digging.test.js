import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { Player } from '../src/player/Player.js';
import { InteractionController } from '../src/game/InteractionController.js';
import { createShovel } from '../src/objects/Shovel.js';

function setup(id = '02') {
  const scene = new THREE.Scene();
  const world = new World(scene, id);
  const player = new Player();
  const camera = new THREE.PerspectiveCamera();
  scene.add(player.group);
  const interaction = new InteractionController({ world, player, camera, scene });
  return { world, player, camera, interaction, scene };
}

test('only WORLD 02 has one pickable shovel with an individual digging S action', () => {
  const { world, scene } = setup();
  const shovels = world.content.children.filter((item) => item.name === 'Shovel');
  assert.equal(shovels.length, 1);
  assert.equal(world.content.children.length, 7);
  assert.equal(world.content.children.filter((item) => item.name === 'Crab').length, 3);
  assert.equal(world.content.children.filter((item) => item.name === 'Clam').length, 3);
  const shovel = shovels[0];
  assert.equal(shovel.userData.pickupType, 'shovel');
  assert.equal(shovel.userData.actionId, 'digSand');
  assert.ok(shovel.position.z > world.minWalkZ);
  assert.ok(shovel.children.some((part) => part.name === 'ShovelBlade'));
  assert.ok(new THREE.Box3().setFromObject(shovel).getSize(new THREE.Vector3()).y > 1);
  const fresh = createShovel();
  assert.equal(fresh.userData.actionId, 'digSand');
  assert.equal(fresh.userData.carry.gripHeight, 0.73);

  assert.ok(world.diggableSand);
  assert.equal(world.diggableSand.ground.name, 'BeachGround');
  assert.ok(scene.children.find((item) => item.name === 'BeachEarth').position.y < -0.6);

  const meadow = new World(new THREE.Scene(), '01');
  assert.equal(meadow.diggableSand, null);
  assert.equal(meadow.content.children.filter((item) => item.name === 'Shovel').length, 0);
  assert.equal(meadow.content.children.filter((item) => item.name === 'Mushroom').length, 3);
  assert.equal(meadow.content.children.filter((item) => item.name === 'Flower').length, 3);
  assert.equal(meadow.digAt(0, 0), false);
  assert.equal(meadow.getGroundOffsetAt(0, 0), 0);
});

test('digging genuinely lowers sand vertices, changes colors and creates a raised edge', () => {
  const { world } = setup();
  const ground = world.diggableSand.ground;
  const geometry = ground.geometry;
  const positions = geometry.getAttribute('position');
  const colors = geometry.getAttribute('color');
  assert.ok(positions.count > 14000);
  assert.equal(geometry.parameters.width, 44);
  assert.equal(geometry.parameters.height, 22);
  const pointX = -2;
  const pointZ = 9;
  const localY = 11 - pointZ;

  const nearest = (x, z) => {
    let found = -1;
    let distance = Infinity;
    for (let i = 0; i < positions.count; i++) {
      const dx = positions.getX(i) - x;
      const dz = positions.getY(i) - (11 - z);
      const d = Math.hypot(dx, dz);
      if (d < distance) { distance = d; found = i; }
    }
    return found;
  };
  const center = nearest(pointX, pointZ);
  const rim = nearest(pointX + 0.75, pointZ);
  const far = nearest(pointX + 3, pointZ);
  assert.ok(Math.abs(positions.getX(center) - pointX) < 0.001);
  assert.ok(Math.abs(positions.getY(center) - localY) < 0.001);
  assert.equal(positions.getZ(center), 0);
  assert.equal(world.digAt(pointX, pointZ), true);
  assert.equal(world.diggableSand.holes.length, 1);
  assert.ok(positions.getZ(center) < -0.18, 'the mesh has a real recessed bottom');
  assert.ok(positions.getZ(rim) > 0, 'the displaced sand makes a raised ring');
  assert.equal(positions.getZ(far), 0, 'undisturbed terrain stays at original height');
  assert.ok(colors.getX(center) < 0.6, 'the bottom is darker');
  assert.ok(colors.getX(rim) > colors.getX(center));
  assert.equal(colors.getX(far), 1);
  assert.ok(world.getGroundOffsetAt(pointX, pointZ) < -0.2);
  assert.equal(world.getGroundOffsetAt(pointX + 3, pointZ), 0);
  assert.equal(ground.material.vertexColors, true);
  const normal = geometry.getAttribute('normal');
  assert.ok(normal.array.some((v, i) => i % 3 < 2 && Math.abs(v) > 0.0001),
    'the terrain normals are re-computed for side lighting');
});

test('holes are restricted to dry sand away from items, other holes and the edge', () => {
  const { world } = setup();
  const holes = world.diggableSand.holes;
  assert.equal(world.digAt(0, 0), false, 'ocean');
  assert.equal(world.digAt(0, 2.0), false, 'wet shoreline');
  assert.equal(world.digAt(0, 22), false, 'upper boundary');
  assert.equal(world.digAt(21, 8), false, 'edge of square');
  assert.equal(world.digAt(NaN, 8), false);
  assert.equal(world.digAt(1.05, 6.75), false, 'cannot dig through grounded shovel');
  assert.equal(world.digAt(-4, 2.9), false, 'cannot dig through resting clam');
  assert.equal(world.digAt(-6.5, 5.1), false, 'cannot dig through walking crab');
  assert.equal(holes.length, 0);
  assert.equal(world.digAt(-2, 9), true);
  assert.equal(world.digAt(-2.1, 9.3), false, 'overlapping holes are not allowed');
  assert.equal(holes.length, 1);
  // A bounded number of holes keeps excavation from growing indefinitely.
  for (let z = 3.5; z < 19 && holes.length < world.diggableSand.maxHoles; z += 2.3) {
    for (let x = -17; x < 18 && holes.length < world.diggableSand.maxHoles; x += 2.3) {
      world.digAt(x, z);
    }
  }
  assert.equal(holes.length, world.diggableSand.maxHoles);
  assert.equal(world.digAt(18, 18), false, 'once at capacity another hole is rejected');
});


test('digging keeps every original sand color patch visible and follows the carved surface', () => {
  const { world, scene } = setup();
  const patches = scene.children.filter((object) => object.name === 'SandPatch');
  assert.equal(patches.length, 26);
  assert.equal(world.beachPatches.length, 26);
  assert.ok(patches.every((patch) => patch.visible), 'patterns are initially visible');

  const originalAppearance = patches.map((patch) => ({
    color: patch.material.color.getHex(),
    position: patch.position.clone(),
    scale: patch.scale.clone(),
  }));

  const patch = patches.find((item) => world.diggableSand.canDig(
    item.position.x, item.position.z, world.content.children,
  ));
  assert.ok(patch, 'a safely diggable patch is available');
  const centerX = patch.position.x;
  const centerZ = patch.position.z;
  const beforeGeometry = patch.geometry.getAttribute('position');
  assert.equal(beforeGeometry.getZ(0), 0, 'pattern center starts level with beach');
  assert.ok(beforeGeometry.count > 400, 'patch is subdivided enough to follow a hole');
  assert.notEqual(patch.geometry, patches.find((item) => item !== patch).geometry,
    'each patch has its own independently deformable vertices');

  assert.equal(world.digAt(centerX, centerZ), true);
  assert.ok(world.getGroundOffsetAt(centerX, centerZ) < -0.2);
  const afterGeometry = patch.geometry.getAttribute('position');
  assert.ok(afterGeometry.getZ(0) < -0.18,
    'the pattern center follows the depression instead of bridging over it');

  for (let i = 0; i < afterGeometry.count; i += 17) {
    const x = centerX + afterGeometry.getX(i) * patch.scale.x;
    const z = centerZ - afterGeometry.getY(i) * patch.scale.y;
    assert.ok(Math.abs(afterGeometry.getZ(i) - world.diggableSand.renderedHeightAt(x, z)) < 1e-5,
      'colored pattern conforms to the exact rendered terrain triangles');
  }

  const patchHeight = patch.position.y + afterGeometry.getZ(0);
  const terrainHeight = world.diggableSand.ground.position.y
    + world.diggableSand.renderedHeightAt(centerX, centerZ);
  assert.ok(patchHeight > terrainHeight && patchHeight - terrainHeight < 0.02,
    'patch stays just above the hollow floor, not covering the excavated hole');

  assert.ok(patches.every((item) => item.visible), 'no patterns are hidden after digging');
  patches.forEach((item, i) => {
    assert.equal(item.material.color.getHex(), originalAppearance[i].color);
    assert.ok(item.position.equals(originalAppearance[i].position));
    assert.ok(item.scale.equals(originalAppearance[i].scale));
  });

  const second = patches.find((item) => (
    Math.hypot(item.position.x - centerX, item.position.z - centerZ) > 4
    && world.diggableSand.canDig(item.position.x, item.position.z, world.content.children)
  ));
  assert.ok(second, 'there is a separate location for a second hole');
  assert.equal(world.digAt(second.position.x, second.position.z), true);
  assert.ok(patches.every((item) => item.visible), 'multiple holes never erase sand patterns');
  assert.ok(patch.geometry.getAttribute('position').getZ(0) < -0.18,
    'the first colored depression survives a second dig');
  assert.ok(second.geometry.getAttribute('position').getZ(0) < -0.18,
    'the second colored depression follows the sand too');
});

test('digging leaves distant sand patterns unchanged and WORLD 01 untouched', () => {
  const { world, scene } = setup();
  const far = scene.children.filter((object) => object.name === 'SandPatch')
    .find((item) => Math.hypot(item.position.x + 2, item.position.z - 9) > 6);
  assert.ok(far);
  const vertices = far.geometry.getAttribute('position');
  const original = vertices.array.slice();
  assert.equal(world.digAt(-2, 9), true);
  assert.deepEqual(vertices.array, original, 'distant patch vertices remain untouched');
  assert.ok(far.visible);

  const meadow = new World(new THREE.Scene(), '01');
  assert.equal(meadow.digAt(-2, 9), false);
  assert.deepEqual(meadow.beachPatches, []);
  assert.equal(meadow.scene.children.filter((item) => item.name === 'SandPatch').length, 0);
});

test('A picks up the shovel, S digs once and animates down, and A puts it on the ground', () => {
  const { world, player, camera, interaction } = setup();
  const shovel = world.content.children.find((item) => item.name === 'Shovel');
  player.group.position.copy(shovel.position);
  assert.equal(interaction.getHint(), 'A：拾う');
  assert.equal(interaction.interact(), true);
  assert.equal(interaction.held, shovel);
  assert.equal(shovel.parent, player.rightArm);
  assert.equal(interaction.getHint(), 'スコップを持っています　A：置く　S：掘る');
  assert.equal(interaction.cameraItem.children.length, 1);
  assert.equal(interaction.cameraItem.children[0].name, 'Shovel');
  assert.ok(interaction.cameraItem.position.x > 0);

  player.setFacing(0);
  assert.equal(interaction.action(), true);
  assert.equal(world.diggableSand.holes.length, 1);
  const first = world.diggableSand.holes[0];
  assert.ok(Math.abs(first.x - player.group.position.x) < 1e-8);
  assert.ok(Math.abs(first.z - (player.group.position.z + 1.5)) < 1e-8);
  interaction.update(0.14, false);
  assert.ok(interaction.digRemaining > 0);
  assert.ok(player.rightArm.rotation.x > -Math.PI / 2 + 0.1,
    'arm dips toward the sand while digging');
  assert.equal(player.rightArm.rotation.z, 0);
  assert.equal(interaction.action(), true, 'S is dispatched even when the stroke is on cooldown');
  assert.equal(world.diggableSand.holes.length, 1);
  interaction.update(1, true);
  assert.equal(interaction.digRemaining, 0);
  assert.ok(interaction.cameraItem.visible);
  assert.equal(camera.children.includes(interaction.cameraItem), true);

  assert.equal(interaction.interact(), true);
  assert.equal(interaction.held, null);
  assert.equal(shovel.userData.isHeld, false);
  assert.equal(shovel.parent, world.content);
  assert.ok(shovel.userData.isTossing);
  interaction.update(0.6, false);
  assert.equal(shovel.userData.isTossing, false);
  assert.equal(player.rightArm.rotation.x, 0);
  assert.equal(world.diggableSand.holes.length, 1, 'holes persist after dropping the shovel');
});

test('dig action never changes S-shake for a held crab or clam', () => {
  for (const type of ['Crab', 'Clam']) {
    const { world, player, interaction } = setup();
    const item = world.content.children.find((object) => object.name === type);
    player.group.position.copy(item.position);
    assert.equal(interaction.interact(), true);
    assert.match(interaction.getHint(), /S：振る/);
    assert.equal(interaction.action(), true);
    interaction.update(0.08);
    assert.ok(interaction.swingRemaining > 0);
    assert.equal(interaction.digRemaining, 0);
    assert.equal(world.diggableSand.holes.length, 0);
  }
});

test('game keeps the avatar at beach depression height instead of hovering above holes', () => {
  const { world, player } = setup();
  assert.equal(world.digAt(-2, 9), true);
  player.group.position.set(-2, world.getGroundOffsetAt(-2, 9), 9);
  assert.ok(player.group.position.y < -0.2, 'player feet can reach the recessed floor');
  const adjacent = world.getGroundOffsetAt(-2 + 2, 9);
  assert.equal(adjacent, 0);
  player.group.position.set(0, adjacent, 9);
  assert.equal(player.group.position.y, 0);
});
