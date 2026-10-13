import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Input } from '../src/game/Input.js';
import { OrbitCamera } from '../src/game/OrbitCamera.js';

function inputHarness() {
  const previousWindow = globalThis.window;
  const listeners = new Map();

  globalThis.window = {
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) {
      if (listeners.get(type) === callback) listeners.delete(type);
    },
  };

  const input = new Input();
  return {
    input,
    key(type, code, target = { tagName: 'BODY' }) {
      listeners.get(type)?.({ code, target, preventDefault() {} });
    },
    blur() { listeners.get('blur')?.(); },
    dispose() {
      input.dispose();
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    },
  };
}

test('arrow keys move normally, Shift + arrow keys orbit without moving', () => {
  const h = inputHarness();
  try {
    h.key('keydown', 'ArrowUp');
    assert.deepEqual(h.input.getMovement(), { x: 0, y: 1 });
    assert.deepEqual(h.input.getCameraOrbit(), { x: 0, y: 0 });

    h.key('keydown', 'ShiftLeft');
    assert.deepEqual(h.input.getMovement(), { x: 0, y: 0 });
    assert.deepEqual(h.input.getCameraOrbit(), { x: 0, y: 1 });

    h.key('keydown', 'ArrowRight');
    assert.equal(h.input.getMovement().x, 0);
    assert.equal(h.input.getMovement().y, 0);
    assert.ok(Math.abs(h.input.getCameraOrbit().x - Math.SQRT1_2) < 1e-8);

    h.key('keyup', 'ShiftLeft');
    assert.deepEqual(h.input.getCameraOrbit(), { x: 0, y: 0 });
    assert.ok(h.input.getMovement().x > 0 && h.input.getMovement().y > 0);
  } finally {
    h.dispose();
  }
});

test('WASD remains available while orbiting and the keys reset on blur', () => {
  const h = inputHarness();
  try {
    h.key('keydown', 'ShiftRight');
    h.key('keydown', 'ArrowLeft');
    h.key('keydown', 'KeyW');
    assert.deepEqual(h.input.getMovement(), { x: 0, y: 1 });
    assert.deepEqual(h.input.getCameraOrbit(), { x: -1, y: 0 });
    h.blur();
    assert.deepEqual(h.input.getMovement(), { x: 0, y: 0 });
    assert.deepEqual(h.input.getCameraOrbit(), { x: 0, y: 0 });
  } finally {
    h.dispose();
  }
});

test('camera orbits around the player, updates walking directions, and limits pitch', () => {
  const camera = new THREE.PerspectiveCamera();
  const orbit = new OrbitCamera(camera);
  const initialYaw = orbit.yaw;
  orbit.follow(0, new THREE.Vector3(), true);

  assert.ok(Math.abs(camera.position.x - 8.5) < 1e-6);
  assert.ok(Math.abs(camera.position.y - 8.8) < 1e-6);
  assert.ok(Math.abs(camera.position.z - 12.5) < 1e-6);

  orbit.rotate(0.5, { x: 1, y: 0 });
  assert.ok(orbit.yaw > initialYaw);
  assert.ok(Math.abs(orbit.forward.dot(orbit.right)) < 1e-10);
  assert.ok(Math.abs(orbit.forward.length() - 1) < 1e-10);

  orbit.rotate(100, { x: 0, y: 1 });
  assert.ok(orbit.pitch <= THREE.MathUtils.degToRad(75) + 1e-8);
  orbit.rotate(100, { x: 0, y: -1 });
  assert.ok(orbit.pitch >= THREE.MathUtils.degToRad(12) - 1e-8);

  const playerPosition = new THREE.Vector3(4, 0, -7);
  orbit.follow(0, playerPosition, true);
  assert.equal(orbit.focus.x, playerPosition.x);
  assert.equal(orbit.focus.z, playerPosition.z);
  assert.ok(Math.abs(camera.position.distanceTo(orbit.focus) - orbit.distance) < 1e-7);
});

test('the native help panel starts open and has the requested controls', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<details class="control-help" open>/);
  assert.match(html, /<summary class="control-help__summary">/);
  assert.match(html, /control-help__collapsed">操作方法/);
  assert.match(html, /Shift＋← →/);
  assert.match(html, /Shift＋↑ ↓/);
});
