import * as THREE from 'three';

const INITIAL_CAMERA_POSITION = new THREE.Vector3(8.5, 8.8, 12.5);
const FOCUS_HEIGHT = 1.05;
const POV_EYE_HEIGHT = 1.55;
const MIN_PITCH = THREE.MathUtils.degToRad(12);
const MAX_PITCH = THREE.MathUtils.degToRad(75);
const POV_MAX_PITCH = THREE.MathUtils.degToRad(80);
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

    this.isFirstPerson = false;
    this.povYaw = this.yaw;
    this.povPitch = 0;

    // Movement remains relative to the active camera's horizontal heading.
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.updateDirections();
  }

  updateDirections() {
    const heading = this.isFirstPerson ? this.povYaw : this.yaw;
    this.forward.set(-Math.sin(heading), 0, -Math.cos(heading));
    this.right.set(Math.cos(heading), 0, -Math.sin(heading));
  }

  setFirstPerson(enabled) {
    if (this.isFirstPerson === enabled) return;
    this.isFirstPerson = enabled;
    if (enabled) {
      // Enter facing the same horizontal heading as the third-person camera.
      this.povYaw = this.yaw;
      this.povPitch = 0;
    }
    this.updateDirections();
  }

  rotate(dt, axes) {
    if (this.isFirstPerson || (axes.x === 0 && axes.y === 0)) return;

    this.yaw += axes.x * ORBIT_SPEED * dt;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + axes.y * TILT_SPEED * dt,
      MIN_PITCH,
      MAX_PITCH,
    );
    this.updateDirections();
  }

  look(dt, axes) {
    if (!this.isFirstPerson || (axes.x === 0 && axes.y === 0)) return;
    this.povYaw += axes.x * ORBIT_SPEED * dt;
    this.povPitch = THREE.MathUtils.clamp(
      this.povPitch + axes.y * TILT_SPEED * dt,
      -POV_MAX_PITCH,
      POV_MAX_PITCH,
    );
    this.updateDirections();
  }

  follow(dt, playerPosition, instant = false) {
    if (this.isFirstPerson) {
      // Position at eye level; avatar hiding is managed by Game.
      this.camera.position.copy(playerPosition);
      this.camera.position.y += POV_EYE_HEIGHT;
      const flat = Math.cos(this.povPitch);
      this.focus.set(
        this.camera.position.x - Math.sin(this.povYaw) * flat,
        this.camera.position.y + Math.sin(this.povPitch),
        this.camera.position.z - Math.cos(this.povYaw) * flat,
      );
      this.camera.lookAt(this.focus);
      return;
    }

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
