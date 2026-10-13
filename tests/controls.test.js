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
    key(type, code, target = { tagName: 'BODY' }, options = {}) {
      listeners.get(type)?.({ code, target, preventDefault() {}, ...options });
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
  assert.match(html, /Ctrl：一人称視点（POV）/);
  assert.match(html, /POV中 ← →/);
  assert.match(html, /POV中 ↑ ↓/);
  assert.match(html, /POV中 WASD/);
});

test('Ctrl toggles first-person mode once per press; arrows look while WASD walks', () => {
  const h = inputHarness();
  try {
    h.key('keydown', 'ControlLeft');
    assert.equal(h.input.isFirstPerson, true);
    h.key('keydown', 'ControlLeft', { tagName: 'BODY' }, { repeat: true });
    assert.equal(h.input.isFirstPerson, true, 'holding Ctrl must not toggle repeatedly');
    h.key('keyup', 'ControlLeft');
    assert.equal(h.input.isFirstPerson, true, 'POV is a toggle, not a held modifier');

    h.key('keydown', 'ArrowUp');
    assert.deepEqual(h.input.getMovement(), { x: 0, y: 0 });
    assert.deepEqual(h.input.getPOVLook(), { x: 0, y: 1 });
    assert.deepEqual(h.input.getCameraOrbit(), { x: 0, y: 0 });

    h.key('keydown', 'KeyW');
    assert.deepEqual(h.input.getMovement(), { x: 0, y: 1 });
    h.key('keydown', 'ShiftLeft');
    assert.deepEqual(h.input.getPOVLook(), { x: 0, y: 1 });
    assert.deepEqual(h.input.getCameraOrbit(), { x: 0, y: 0 });

    h.key('keyup', 'ArrowUp');
    h.key('keydown', 'ArrowRight');
    assert.deepEqual(h.input.getPOVLook(), { x: 1, y: 0 });

    h.key('keyup', 'ShiftLeft');
    h.key('keyup', 'ArrowRight');
    h.key('keyup', 'KeyW');
    h.key('keydown', 'ControlRight');
    assert.equal(h.input.isFirstPerson, false);
    assert.deepEqual(h.input.getPOVLook(), { x: 0, y: 0 });

    h.key('keydown', 'ArrowLeft');
    assert.deepEqual(h.input.getMovement(), { x: -1, y: 0 });
  } finally {
    h.dispose();
  }
});

test('Ctrl does not toggle POV while typing; losing focus clears held arrows', () => {
  const h = inputHarness();
  try {
    h.key('keydown', 'ControlLeft', { tagName: 'INPUT' });
    assert.equal(h.input.isFirstPerson, false);
    h.key('keydown', 'ControlRight', { tagName: 'BODY', isContentEditable: true });
    assert.equal(h.input.isFirstPerson, false);

    h.key('keydown', 'ControlLeft');
    h.key('keyup', 'ControlLeft');
    h.key('keydown', 'ArrowDown');
    h.blur();
    assert.equal(h.input.isFirstPerson, true);
    assert.deepEqual(h.input.getPOVLook(), { x: 0, y: 0 });
  } finally {
    h.dispose();
  }
});

test('POV camera sits at eye level, looks in four directions and returns to orbit', () => {
  const camera = new THREE.PerspectiveCamera();
  const orbit = new OrbitCamera(camera);
  const character = new THREE.Vector3(2, 0, -3);
  const originalYaw = orbit.yaw;
  orbit.setFirstPerson(true);
  orbit.follow(0, character);

  assert.ok(orbit.isFirstPerson);
  assert.deepEqual(camera.position.toArray(), [2, 1.55, -3]);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).dot(orbit.forward) > 0.999999);

  orbit.look(0.5, { x: 1, y: 0 });
  assert.ok(orbit.povYaw > originalYaw);
  assert.equal(orbit.yaw, originalYaw, 'third-person orbit retains its angle');
  assert.ok(orbit.forward.length() > 0.999999);
  orbit.look(100, { x: 0, y: 1 });
  assert.ok(orbit.povPitch <= THREE.MathUtils.degToRad(80) + 1e-10);
  orbit.follow(0, character);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).y > 0.9, 'up looks toward the sky');
  orbit.look(100, { x: 0, y: -1 });
  assert.ok(orbit.povPitch >= -THREE.MathUtils.degToRad(80) - 1e-10);
  orbit.follow(0, character);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).y < -0.9, 'down looks toward the ground');

  orbit.setFirstPerson(false);
  orbit.follow(0, character, true);
  assert.equal(orbit.isFirstPerson, false);
  assert.equal(orbit.yaw, originalYaw);
  assert.ok(Math.abs(camera.position.distanceTo(character.clone().add(new THREE.Vector3(0, 1.05, 0))) - orbit.distance) < 1e-7);
});
