import * as THREE from 'three';
import { Input } from './Input.js';
import { OrbitCamera } from './OrbitCamera.js';
import { Player } from '../player/Player.js';
import { World } from '../world/World.js';
import { InteractionController } from './InteractionController.js';

export class Game {
  constructor(container, worldId = '01') {
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
    this.world = new World(this.scene, worldId);
    this.player = new Player();
    this.player.group.position.z = this.world.spawnZ;
    this.scene.add(this.player.group);
    this.clock = new THREE.Clock();

    this.cameraOrbit = new OrbitCamera(this.camera);
    this.cameraOrbit.follow(0, this.player.group.position, true);
    this.interactions = new InteractionController({ world: this.world, player: this.player, camera: this.camera, scene: this.scene });
    this.interactionHint = document.querySelector('#interaction-hint');

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

    const switchingPerspective = this.cameraOrbit.isFirstPerson !== this.input.isFirstPerson;
    if (switchingPerspective) {
      // The third-person camera can orbit independently of the character.
      // Enter POV from the actual avatar facing instead of the orbit heading.
      this.cameraOrbit.setFirstPerson(this.input.isFirstPerson, this.player.facing);
      // Hide the character mesh when the camera is inside its head, but keep
      // the small shadow on the ground.
      this.player.avatar.visible = !this.input.isFirstPerson;
    }

    if (this.input.isFirstPerson) {
      this.cameraOrbit.look(dt, this.input.getPOVLook());
      // Turning the POV turns the avatar too, so switching back preserves
      // the direction the character was looking.
      this.player.setFacing(this.cameraOrbit.getPOVFacing());
    } else {
      this.cameraOrbit.rotate(dt, this.input.getCameraOrbit());
    }

    this.player.update(
      dt,
      this.input.getMovement(),
      this.cameraOrbit.forward,
      this.cameraOrbit.right,
      this.world.limit,
      this.input.isFirstPerson,
      this.world.minWalkZ,
    );

    this.cameraOrbit.follow(dt, this.player.group.position, switchingPerspective);

    for (const action of this.input.consumeActions()) {
      if (action === 'interact') this.interactions.interact();
      else if (action === 'action') this.interactions.action();
    }
    this.interactions.update(dt, this.input.isFirstPerson);
    if (this.interactionHint) {
      const hint = this.interactions.getHint();
      if (this.interactionHint.textContent !== hint) this.interactionHint.textContent = hint;
    }

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
