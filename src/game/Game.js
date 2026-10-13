import * as THREE from 'three';
import { Input } from './Input.js';
import { Player } from '../player/Player.js';
import { World } from '../world/World.js';

const CAMERA_OFFSET = new THREE.Vector3(8.5, 8.8, 12.5);
const CAMERA_FOCUS_HEIGHT = 1.05;

export class Game {
  constructor(container) {
    if (!container) throw new Error('A game container is required.');

    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc5e6f8);
    this.scene.fog = new THREE.Fog(0xc5e6f8, 40, 88);

    this.camera = new THREE.PerspectiveCamera(49, 1, 0.1, 130);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.40;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', 'Little World Lab の3D草原');
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x81a783, 2.6));
    const sun = new THREE.DirectionalLight(0xfff3dc, 3.2);
    sun.position.set(-12, 21, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -27;
    sun.shadow.camera.right = 27;
    sun.shadow.camera.top = 27;
    sun.shadow.camera.bottom = -27;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 65;
    sun.shadow.bias = -0.00012;
    sun.shadow.normalBias = 0.015;
    this.scene.add(sun, sun.target);

    this.input = new Input();
    this.world = new World(this.scene);
    this.player = new Player();
    this.scene.add(this.player.group);
    this.clock = new THREE.Clock();

    this.cameraForward = new THREE.Vector3(-CAMERA_OFFSET.x, 0, -CAMERA_OFFSET.z).normalize();
    this.cameraRight = new THREE.Vector3(-this.cameraForward.z, 0, this.cameraForward.x);
    this.camera.position.copy(CAMERA_OFFSET);
    this.camera.lookAt(0, CAMERA_FOCUS_HEIGHT, 0);

    this.onResize = this.resize.bind(this);
    this.onFrame = this.frame.bind(this);
    this.resize();
    window.addEventListener('resize', this.onResize);
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.frame();
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.fov = height > width ? 61 : 49;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  frame() {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.onFrame);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.player.update(
      dt,
      this.input.getMovement(),
      this.cameraForward,
      this.cameraRight,
      this.world.limit,
    );

    const targetPosition = this.player.group.position.clone().add(CAMERA_OFFSET);
    this.camera.position.lerp(targetPosition, 1 - Math.exp(-5 * dt));
    const lookAt = this.player.group.position.clone();
    lookAt.y += CAMERA_FOCUS_HEIGHT;
    this.camera.lookAt(lookAt);

    this.world.update(dt, { player: this.player, camera: this.camera, world: this.world });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    this.input.dispose();
    this.scene.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
