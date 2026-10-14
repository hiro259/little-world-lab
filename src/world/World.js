import * as THREE from 'three';
import { createMushroom } from '../objects/Mushroom.js';

const WORLD_SIZE = 44;

export const WORLD_NAMES = Object.freeze({ '01': 'はじまりの草原', '02': '海辺の草原' });

function seededRandom(seed = 4389) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeCloud(x, y, z, size) {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.84, depthWrite: false });
  const shapes = [
    [-0.75, 0, 0, 0.95],
    [0.1, 0.23, 0, 1.20],
    [0.90, -0.03, 0, 0.81],
  ];
  for (const [px, py, pz, radius] of shapes) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), material);
    puff.scale.set(1.15, 0.68, 0.79);
    puff.position.set(px, py, pz);
    group.add(puff);
  }
  group.position.set(x, y, z);
  group.scale.setScalar(size);
  return group;
}

export class World {
  constructor(scene, worldId = '01') {
    this.scene = scene;
    this.id = worldId === '02' ? '02' : '01';
    this.size = WORLD_SIZE;
    this.limit = WORLD_SIZE / 2 - 1.3;
    this.minWalkZ = this.id === '02' ? 1.45 : -this.limit;
    this.spawnZ = this.id === '02' ? 6.5 : 0;
    this.waves = [];
    this.content = new THREE.Group();
    this.content.name = 'AddedObjects';
    this.scene.add(this.content);
    this.updatables = [];
    this.clouds = [];
    this.elapsedTime = 0;

    this.createTerrain();
    this.createGrass();
    this.createSky();
    this.createStarterMushrooms();
  }

  createTerrain() {
    const earth = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD_SIZE, 0.85, this.id === '02' ? WORLD_SIZE / 2 : WORLD_SIZE),
      new THREE.MeshStandardMaterial({ color: 0xa4b794, roughness: 1 }),
    );
    earth.position.set(0, -0.47, this.id === '02' ? WORLD_SIZE / 4 : 0);
    earth.receiveShadow = true;
    earth.name = 'MeadowEarth';
    this.scene.add(earth);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, this.id === '02' ? WORLD_SIZE / 2 : WORLD_SIZE),
      new THREE.MeshStandardMaterial({ color: 0xb3d9a4, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.037, this.id === '02' ? WORLD_SIZE / 4 : 0);
    ground.receiveShadow = true;
    ground.name = 'MeadowGround';
    this.scene.add(ground);

    if (this.id === '02') this.createSea();

    // Large, flat patches gently break up the grass colour.
    const rand = seededRandom(319);
    const patchGeometry = new THREE.CircleGeometry(1, 16);
    const patchMaterials = [
      new THREE.MeshBasicMaterial({ color: 0xbadfae, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: 0xaed19c, depthWrite: false }),
    ];
    for (let i = 0; i < 28; i++) {
      const patch = new THREE.Mesh(patchGeometry, patchMaterials[i % patchMaterials.length]);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(
        (rand() - 0.5) * 39,
        -0.025 + (i % 2) * 0.001,
        this.id === '02' ? 2.4 + rand() * 17.5 : (rand() - 0.5) * 39,
      );
      patch.scale.set(0.8 + rand() * 1.4, 0.55 + rand() * 0.9, 1);
      this.scene.add(patch);
    }
  }

  createSea() {
    const half = WORLD_SIZE / 2;
    // Keep the sea as the other half of the exact same square, not a larger plane.
    const seabed = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD_SIZE, 0.85, half),
      new THREE.MeshStandardMaterial({ color: 0x4d98a6, roughness: 1 }),
    );
    seabed.name = 'SeaBed';
    seabed.position.set(0, -0.47, -half / 2);
    seabed.receiveShadow = true;
    this.scene.add(seabed);

    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, half),
      new THREE.MeshStandardMaterial({ color: 0x66bfd0, transparent: true, opacity: 0.94, roughness: 0.36, metalness: 0.05 }),
    );
    surface.name = 'SeaSurface';
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(0, -0.020, -half / 2);
    surface.receiveShadow = true;
    this.scene.add(surface);

    // A narrow sandy edge is entirely on the land half; the 50/50 split stays exact.
    const beach = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, 1.55),
      new THREE.MeshStandardMaterial({ color: 0xeed9ae, roughness: 1 }),
    );
    beach.name = 'SandyShore';
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(0, -0.016, 0.775);
    beach.receiveShadow = true;
    this.scene.add(beach);

    const foam = new THREE.MeshBasicMaterial({ color: 0xd6fbfa, transparent: true, opacity: 0.42, depthWrite: false });
    const random = seededRandom(207);
    for (let i = 0; i < 18; i++) {
      const wave = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + random() * 2.1, 0.035 + random() * 0.035), foam);
      wave.name = 'SeaRipple';
      wave.rotation.x = -Math.PI / 2;
      const x = (random() - 0.5) * (WORLD_SIZE - 5);
      const z = -0.3 - random() * 20;
      wave.position.set(x, -0.013, z);
      wave.userData.baseX = x;
      this.waves.push(wave);
      this.scene.add(wave);
    }
  }

  createGrass() {
    // Single instanced draw call: many small blades without loading textures.
    const random = seededRandom(293);
    const count = this.id === '02' ? 120 : 240;
    const geometry = new THREE.ConeGeometry(0.11, 0.31, 3);
    geometry.translate(0, 0.155, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x94bf88, roughness: 1, flatShading: true });
    const grass = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let x = (random() - 0.5) * (WORLD_SIZE - 2);
      let z = this.id === '02' ? 1.9 + random() * (WORLD_SIZE / 2 - 2.5) : (random() - 0.5) * (WORLD_SIZE - 2);
      if (this.id === '01' && Math.hypot(x, z) < 3.3) { x += x >= 0 ? 4 : -4; z += z >= 0 ? 4 : -4; }
      dummy.position.set(
        THREE.MathUtils.clamp(x, -WORLD_SIZE / 2 + 0.4, WORLD_SIZE / 2 - 0.4),
        -0.01,
        THREE.MathUtils.clamp(z, this.id === '02' ? 1.8 : -WORLD_SIZE / 2 + 0.4, WORLD_SIZE / 2 - 0.4),
      );
      dummy.rotation.y = random() * Math.PI * 2;
      const scale = 0.65 + random() * 0.8;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      color.setHex([0x88b47a, 0x9ac48a, 0x86b988, 0xb2cc94][i % 4]);
      grass.setColorAt(i, color);
    }
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    grass.name = 'MeadowGrass';
    this.scene.add(grass);
  }

  createSky() {
    const cloudPositions = [
      [-19, 12, -28, 2.3],
      [6, 15, -32, 1.6],
      [25, 12, -20, 2.1],
      [-26, 16, 6, 1.7],
    ];
    for (const [x, y, z, size] of cloudPositions) {
      const cloud = makeCloud(x, y, z, size);
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  createStarterMushrooms() {
    // An intentionally small cluster: only three shoe-sized mushrooms.
    const mushrooms = [
      { position: [-2.60, -0.03, 2.00], scale: 1.00, capColor: 0xd96b65 },
      { position: [-3.13, -0.03, 2.45], scale: 0.86, capColor: 0xc65f68 },
      { position: [-2.46, -0.03, 2.85], scale: 0.93, capColor: 0xe28b65 },
    ];

    for (const { position, scale, capColor } of mushrooms) {
      this.addObject(createMushroom({ capColor, scale }), position);
    }
  }

  /**
   * Minimal extension point for future demo requests:
   *   world.addObject(new THREE.Group(), [4, 0, 2])
   *   world.addObject({ mesh: sheep.group, update: (dt, ctx) => sheep.update(dt, ctx) }, [4, 0, 2])
   */
  addObject(item, position = [0, 0, 0]) {
    const entry = item?.isObject3D ? { mesh: item } : item;
    if (!entry?.mesh?.isObject3D) {
      throw new TypeError('World.addObject expects a Three.js Object3D or { mesh, update? }.');
    }
    entry.mesh.position.set(...position);
    this.content.add(entry.mesh);
    if (typeof entry.update === 'function') this.updatables.push(entry);
    return entry.mesh;
  }

  update(dt, context) {
    this.elapsedTime += dt;
    for (let i = 0; i < this.clouds.length; i++) {
      this.clouds[i].position.x += Math.sin(this.elapsedTime * 0.11 + i) * dt * 0.045;
    }
    for (let i = 0; i < this.waves.length; i++) {
      const wave = this.waves[i];
      wave.position.x = wave.userData.baseX + Math.sin(this.elapsedTime * 0.6 + i) * 0.10;
    }
    for (const object of this.updatables) object.update(dt, context);
  }
}
