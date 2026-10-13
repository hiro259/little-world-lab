import * as THREE from 'three';

const INITIAL_CAMERA_POSITION = new THREE.Vector3(8.5, 8.8, 12.5);
const FOCUS_HEIGHT = 1.05;
const MIN_PITCH = THREE.MathUtils.degToRad(12);
const MAX_PITCH = THREE.MathUtils.degToRad(75);
const ORBIT_SPEED = 1.3;
const TILT_SPEED = 0.9;

export class OrbitCamera {
  constructor(camera) {
    this.camera = camera;

    const verticalOffset = INITIAL_CAMERA_POSITION.y - FOCUS_HEIGHT;
    const horizontalDistance = Math.hypot(INITIAL_CAMERA_POSITION.x, INITIAL_CAMERA_POSITION.z);
    this.distance = Math.hypot(horizontalDistance, verticalOffset);
    this.yaw = Math.atan2(INITIAL_CAMERA_POSITION.x, INITIAL_CAMERA_POSITION.z);
    this.pitch = Math.atan2(verticalOffset, horizontalDistance);

    // Movement remains relative to the camera's horizontal heading.
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.updateDirections();
  }

  updateDirections() {
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  rotate(dt, axes) {
    if (axes.x === 0 && axes.y === 0) return;

    this.yaw += axes.x * ORBIT_SPEED * dt;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + axes.y * TILT_SPEED * dt,
      MIN_PITCH,
      MAX_PITCH,
    );
    this.updateDirections();
  }

  follow(dt, playerPosition, instant = false) {
    const horizontal = this.distance * Math.cos(this.pitch);
    this.desiredPosition.set(
      horizontal * Math.sin(this.yaw),
      FOCUS_HEIGHT + this.distance * Math.sin(this.pitch),
      horizontal * Math.cos(this.yaw),
    ).add(playerPosition);

    this.camera.position.lerp(
      this.desiredPosition,
      instant ? 1 : 1 - Math.exp(-5 * dt),
    );
    this.focus.copy(playerPosition);
    this.focus.y += FOCUS_HEIGHT;
    this.camera.lookAt(this.focus);
  }
}
