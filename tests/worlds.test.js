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
  assert.equal(world.content.children.length, 3);
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

  const land = find(scene, 'MeadowGround');
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
  assert.equal(world.waves.length, 18);
  assert.equal(world.content.children.length, 3);
  assert.ok(world.content.children.every((mushroom) => mushroom.position.z > 1.55));
});

test('WORLD 02 grass stays on land (no underwater grass)', () => {
  const scene = new THREE.Scene();
  new World(scene, '02');
  const grass = find(scene, 'MeadowGrass');
  assert.ok(grass && grass.isInstancedMesh);
  assert.equal(grass.count, 120);
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let i = 0; i < grass.count; i++) {
    grass.getMatrixAt(i, transform);
    transform.decompose(position, rotation, scale);
    assert.ok(position.z >= 1.8 && position.z <= 21.6);
  }
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
  assert.match(main, /searchParams\.get\('world'\) === '02'/);
  assert.match(main, /searchParams\.set\('world', nextWorldId\)/);
  assert.match(main, /searchParams\.delete\('world'\)/);
  assert.match(main, /new Game\(container, worldId\)/);
  assert.match(styles, /\.world-label\s*\{[^}]*pointer-events: auto/s);
  assert.deepEqual(WORLD_NAMES, { '01': 'はじまりの草原', '02': '海辺の草原' });
});
