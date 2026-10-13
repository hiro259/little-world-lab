import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMushroom } from '../src/objects/Mushroom.js';
import { World } from '../src/world/World.js';

test('the starter meadow contains exactly three mushrooms', () => {
  const scene = new THREE.Scene();
  const world = new World(scene);
  assert.equal(world.content.children.length, 3);

  const positions = new Set();
  for (const mushroom of world.content.children) {
    assert.equal(mushroom.name, 'Mushroom');
    assert.ok(Math.abs(mushroom.position.y + 0.03) < 1e-8);
    assert.ok(mushroom.position.length() < world.limit);
    assert.ok(Math.hypot(mushroom.position.x, mushroom.position.z) > 2);
    positions.add(mushroom.position.toArray().join(','));
  }
  assert.equal(positions.size, 3);
});

test('mushrooms are shoe-sized and have shaded caps and spots', () => {
  const world = new World(new THREE.Scene());
  for (const mushroom of world.content.children) {
    const size = new THREE.Box3().setFromObject(mushroom).getSize(new THREE.Vector3());
    assert.ok(size.y > 0.20 && size.y < 0.45, `height ${size.y} should be about a shoe`);
    assert.ok(size.x < 0.5 && size.z < 0.5);
    const meshes = mushroom.children.filter((child) => child.isMesh);
    assert.ok(meshes.length >= 6);
    assert.ok(meshes.some((mesh) => mesh.castShadow));
  }
});

test('a new mushroom can be created separately for future requests', () => {
  const mushroom = createMushroom({ capColor: 0xff66bb, scale: 0.8 });
  assert.equal(mushroom.name, 'Mushroom');
  assert.equal(mushroom.scale.x, 0.8);
  const cap = mushroom.children[1];
  assert.equal(cap.material.color.getHex(), 0xff66bb);
});
