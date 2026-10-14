import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World, WORLD_NAMES } from '../src/world/World.js';
import { Player } from '../src/player/Player.js';

const find = (scene, name) => scene.children.find((object) => object.name === name);

test('WORLD 01 remains the original square grassland with three mushrooms', () => {
  const scene = new THREE.Scene();
  const world = new World(scene);
  assert.equal(world.id, '01');
  assert.equal(world.size, 44);
  assert.equal(world.minWalkZ, -world.limit);
  assert.equal(world.spawnZ, 0);
  assert.equal(world.content.children.length, 6); // 3 mushrooms + 3 flowers
  assert.equal(world.content.children.filter((item) => item.name === 'Flower').length, 3);
  assert.ok(find(scene, 'MeadowGround'));
  assert.equal(find(scene, 'MeadowGround').geometry.parameters.height, 44);
  assert.equal(find(scene, 'SeaSurface'), undefined);
  assert.equal(find(scene, 'SandyShore'), undefined);
});

test('WORLD 02 is exactly half ocean and half land within the original square', () => {
  const scene = new THREE.Scene();
  const world = new World(scene, '02');
  assert.equal(world.id, '02');
  assert.equal(world.size, 44);
  assert.equal(world.spawnZ, 6.5);
  assert.equal(world.minWalkZ, 1.45);

  const land = find(scene, 'BeachGround');
  const sea = find(scene, 'SeaSurface');
  const seabed = find(scene, 'SeaBed');
  const shore = find(scene, 'SandyShore');
  assert.ok(land && sea && seabed && shore);

  assert.equal(land.geometry.parameters.width, 44);
  assert.equal(sea.geometry.parameters.width, 44);
  assert.equal(land.geometry.parameters.height, 22);
  assert.equal(sea.geometry.parameters.height, 22);
  assert.equal(land.position.z, 11);
  assert.equal(sea.position.z, -11);
  assert.equal(seabed.position.z, -11);
  assert.ok(shore.position.z >= 0);
  assert.equal(world.waves.length, 3);
  assert.ok(find(scene, 'ShoreWash'));
  assert.ok(world.shoreWash);
  assert.equal(find(scene, 'MeadowGround'), undefined);
  assert.equal(world.content.children.length, 7); // three clams + three crabs + one shovel
  assert.equal(world.content.children.filter((item) => item.name === 'Shovel').length, 1);
  assert.equal(world.content.children.filter((item) => item.name === 'Clam').length, 3);
  assert.equal(world.content.children.filter((item) => item.name === 'Crab').length, 3);
  assert.equal(world.content.children.filter((item) => item.name === 'Mushroom').length, 0);
  assert.equal(world.content.children.filter((item) => item.name === 'Flower').length, 0);
  assert.ok(world.content.children.every((item) => item.position.z > 1.55));
});

test('WORLD 02 is a beach without any meadow grass or green meadow patches', () => {
  const scene = new THREE.Scene();
  const world = new World(scene, '02');
  const beach = find(scene, 'BeachGround');
  assert.ok(beach);
  assert.equal(beach.geometry.parameters.height, 22);
  assert.equal(find(scene, 'MeadowGrass'), undefined);
  assert.equal(find(scene, 'MeadowEarth'), undefined);
  assert.equal(find(scene, 'MeadowGround'), undefined);

  assert.equal(scene.children.filter((object) => object.name === 'SandPatch').length, 0,
    'sand motifs are baked into the actual beach ground, not overlay planes');
  assert.equal(world.beachPatches.length, 26);
  for (const patch of world.beachPatches) {
    assert.ok(patch.z > 0, 'sand pattern remains on land');
    assert.ok(patch.radiusX > 0 && patch.radiusZ > 0);
  }
  assert.ok(beach.geometry.getAttribute('color'), 'beach contains colored motif vertices');

  const normalWorld = new World(new THREE.Scene(), '01');
  assert.equal(normalWorld.waves.length, 0);
  assert.equal(normalWorld.shoreWash, null);
});

test('WORLD 02 waves visibly advance and recede with gentle foam animation', () => {
  const scene = new THREE.Scene();
  const world = new World(scene, '02');
  assert.equal(world.waves.length, 3);
  assert.ok(world.waves.every((wave) => wave.name === 'WaveBand'));
  assert.equal(world.shoreWash.name, 'ShoreWash');

  const before = world.waves.map((wave) => ({
    z: wave.position.z,
    opacity: wave.material.opacity,
  }));
  const washBefore = world.shoreWash.position.z;
  world.update(0.7, {});

  assert.ok(world.waves.some((wave, i) => wave.position.z !== before[i].z));
  assert.ok(world.waves.some((wave, i) => wave.material.opacity !== before[i].opacity));
  const washAdvanced = world.shoreWash.position.z;
  assert.ok(washAdvanced > washBefore, 'water first advances toward the beach');

  world.update(2.6, {});
  assert.ok(world.shoreWash.position.z < washAdvanced, 'water then retreats');
  assert.ok(world.waves[0].position.z < world.waves[0].userData.baseZ, 'front breaker retreats');
  assert.ok(world.shoreWash.position.z < 1, 'decorative water does not reach the spawn location');
});

test('the player can walk on the shore but cannot walk onto sea in WORLD 02', () => {
  const world = new World(new THREE.Scene(), '02');
  const player = new Player();
  player.group.position.z = world.spawnZ;
  const forward = new THREE.Vector3(0, 0, -1);
  const right = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < 50; i++) {
    player.update(0.1, { x: 0, y: 1 }, forward, right, world.limit, false, world.minWalkZ);
  }
  assert.equal(player.group.position.z, world.minWalkZ);
  assert.ok(player.group.position.z > 0);

  // Original WORLD 01 still permits walking across its full land area.
  const meadow = new World(new THREE.Scene(), '01');
  const walker = new Player();
  for (let i = 0; i < 50; i++) {
    walker.update(0.1, { x: 0, y: 1 }, forward, right, meadow.limit);
  }
  assert.ok(walker.group.position.z < 0);
});

test('the world badge is a keyboard-operable button with the correct URL switch', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

  assert.match(html, /<button class="world-label" id="world-switch" type="button"/);
  assert.match(html, /data-world-number/);
  assert.match(html, /data-world-name/);
  assert.match(main, /URLSearchParams\(window\.location\.search\)\.get\('world'\) === '02'/);
  assert.match(main, /searchParams\.set\('world', nextWorldId\)/);
  assert.match(main, /searchParams\.delete\('world'\)/);
  assert.match(main, /new Game\(container, worldId\)/);
  assert.match(styles, /\.world-label\s*\{[^}]*pointer-events: auto/s);
  assert.deepEqual(WORLD_NAMES, { '01': 'はじまりの草原', '02': '海辺の砂浜' });
});
