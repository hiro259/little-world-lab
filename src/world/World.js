import * as THREE from 'three';
import { createMushroom } from '../objects/Mushroom.js';
import { createFlower } from '../objects/Flower.js';
import { createClam } from '../objects/Clam.js';
import { createCrab } from '../objects/Crab.js';
import { createShovel } from '../objects/Shovel.js';
import { DiggableSand } from './DiggableSand.js';

const WORLD_SIZE = 44;

// A radial grid gives each colored patch enough geometry to follow the
// terrain's curved depressions. The old CircleGeometry had only a center
// and an outer ring, so it would bridge across newly dug holes.
function makeSandPatchGeometry() {
  const rings = 12;
  const segments = 48;
  const vertices = [0, 0, 0]; // center
  const indices = [];

  for (let ring = 1; ring <= rings; ring++) {
    const radius = ring / rings;
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      vertices.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    }
  }
  for (let segment = 0; segment < segments; segment++) {
    indices.push(0, 1 + segment, 1 + (segment + 1) % segments);
  }
  for (let ring = 1; ring < rings; ring++) {
    const inside = 1 + (ring - 1) * segments;
    const outside = inside + segments;
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      indices.push(inside + segment, outside + segment, outside + next);
      indices.push(inside + segment, outside + next, inside + next);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export const WORLD_NAMES = Object.freeze({ '01': 'はじまりの草原', '02': '海辺の砂浜' });

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
    this.beachPatches = [];
    this.shoreWash = null;
    this.diggableSand = null;
    this.content = new THREE.Group();
    this.content.name = 'AddedObjects';
    this.scene.add(this.content);
    this.updatables = [];
    this.clouds = [];
    this.elapsedTime = 0;

    this.createTerrain();
    this.createGrass();
    this.createSky();
    if (this.id === '01') {
      this.createStarterMushrooms();
      this.createStarterFlowers();
    } else {
      this.createBeachCreatures();
      this.addObject(createShovel(), [1.05, -0.03, 6.75]);
    }
  }

  createTerrain() {
    const isBeach = this.id === '02';
    const landDepth = isBeach ? WORLD_SIZE / 2 : WORLD_SIZE;
    const landCenterZ = isBeach ? WORLD_SIZE / 4 : 0;

    const earth = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD_SIZE, 0.85, landDepth),
      new THREE.MeshStandardMaterial({ color: isBeach ? 0xc7ad81 : 0xa4b794, roughness: 1 }),
    );
    // WORLD 02's actual recessed holes need empty space below the beach
    // surface; otherwise the land cube would show through the depression.
    earth.position.set(0, isBeach ? -0.77 : -0.47, landCenterZ);
    earth.receiveShadow = true;
    earth.name = isBeach ? 'BeachEarth' : 'MeadowEarth';
    this.scene.add(earth);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, landDepth),
      new THREE.MeshStandardMaterial({ color: isBeach ? 0xe7d3ac : 0xb3d9a4, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.037, landCenterZ);
    ground.receiveShadow = true;
    ground.name = isBeach ? 'BeachGround' : 'MeadowGround';
    this.scene.add(ground);

    if (isBeach) {
      this.diggableSand = new DiggableSand(ground);
      this.createBeachPatches();
      this.createSea();
      return;
    }

    // WORLD 01 keeps its original grassy patches.
    const rand = seededRandom(319);
    const patchGeometry = new THREE.CircleGeometry(1, 16);
    const patchMaterials = [
      new THREE.MeshBasicMaterial({ color: 0xbadfae, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color: 0xaed19c, depthWrite: false }),
    ];
    for (let i = 0; i < 28; i++) {
      const patch = new THREE.Mesh(patchGeometry, patchMaterials[i % patchMaterials.length]);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set((rand() - 0.5) * 39, -0.025 + (i % 2) * 0.001, (rand() - 0.5) * 39);
      patch.scale.set(0.8 + rand() * 1.4, 0.55 + rand() * 0.9, 1);
      this.scene.add(patch);
    }
  }

  createBeachPatches() {
    // Sandy colour variation: no meadow patches, green grass, or grass geometry.
    const rand = seededRandom(921);
    const patchGeometry = makeSandPatchGeometry();
    const colours = [0xeddcb9, 0xdfc496, 0xe3ca9f];
    const materials = colours.map((color) => new THREE.MeshBasicMaterial({ color, depthWrite: false }));
    for (let i = 0; i < 26; i++) {
      const patch = new THREE.Mesh(patchGeometry.clone(), materials[i % materials.length]);
      patch.name = 'SandPatch';
      patch.rotation.x = -Math.PI / 2;
      patch.position.set((rand() - 0.5) * 39, -0.025 + (i % 2) * 0.001, 1.8 + rand() * 18.3);
      patch.scale.set(0.7 + rand() * 1.8, 0.65 + rand() * 1.2, 1);
      this.beachPatches.push(patch);
      this.scene.add(patch);
    }
    patchGeometry.dispose(); // Each patch owns its own deformable clone.
  }

  createSea() {
    const half = WORLD_SIZE / 2;
    // The ocean and beach each occupy exactly half of the original square.
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
      new THREE.MeshStandardMaterial({ color: 0x72c8d9, transparent: true, opacity: 0.95, roughness: 0.35, metalness: 0.04 }),
    );
    surface.name = 'SeaSurface';
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(0, -0.020, -half / 2);
    surface.receiveShadow = true;
    this.scene.add(surface);

    // A thin pale strip suggests wet sand where water reaches the shore.
    const shoreline = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, 2.0),
      new THREE.MeshStandardMaterial({ color: 0xf3dfb9, roughness: 1 }),
    );
    shoreline.name = 'SandyShore';
    shoreline.rotation.x = -Math.PI / 2;
    shoreline.position.set(0, -0.019, 1.0);
    shoreline.receiveShadow = true;
    this.scene.add(shoreline);

    this.createWaveBands();
  }

  createWaveBands() {
    // The translucent wash crosses z=0, so surf visibly reaches the beach
    // and retreats. It remains decorative; land/ocean boundaries stay fixed.
    this.shoreWash = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, 1.25),
      new THREE.MeshBasicMaterial({
        color: 0xa4e5e5, transparent: true, opacity: 0.23, depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.shoreWash.name = 'ShoreWash';
    this.shoreWash.rotation.x = -Math.PI / 2;
    this.shoreWash.position.set(0, -0.012, -0.15);
    this.shoreWash.renderOrder = 1;
    this.scene.add(this.shoreWash);

    const waves = [
      { width: 41, depth: 0.18, z: -0.32, amplitude: 0.65, speed: 1.20, phase: 0.0, opacity: 0.43 },
      { width: 36, depth: 0.14, z: -1.48, amplitude: 0.62, speed: 1.20, phase: -0.85, opacity: 0.31 },
      { width: 30, depth: 0.12, z: -2.85, amplitude: 0.55, speed: 1.20, phase: -1.65, opacity: 0.22 },
    ];
    for (let i = 0; i < waves.length; i++) {
      const spec = waves[i];
      const geometry = new THREE.PlaneGeometry(spec.width, spec.depth, 24, 1);
      // An irregular edge avoids completely ruler-straight foam lines.
      const vertices = geometry.attributes.position;
      for (let n = 0; n < vertices.count; n++) {
        const x = vertices.getX(n);
        const y = vertices.getY(n);
        vertices.setY(n, y + Math.sin(x * 0.42 + i) * 0.07 + Math.sin(x * 1.06 + i * 2) * 0.025);
      }
      geometry.computeVertexNormals();

      const foam = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0xf4ffff, transparent: true, opacity: spec.opacity, depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      foam.name = 'WaveBand';
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(0, -0.009 + i * 0.001, spec.z);
      foam.renderOrder = 2 + i;
      foam.userData = { baseZ: spec.z, amplitude: spec.amplitude, speed: spec.speed, phase: spec.phase, baseOpacity: spec.opacity };
      this.waves.push(foam);
      this.scene.add(foam);
    }
  }

  createGrass() {
    if (this.id === '02') return; // No green grass in the beach world.
    // Single instanced draw call: many small blades without loading textures.
    const random = seededRandom(293);
    const count = 240;
    const geometry = new THREE.ConeGeometry(0.11, 0.31, 3);
    geometry.translate(0, 0.155, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x94bf88, roughness: 1, flatShading: true });
    const grass = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let x = (random() - 0.5) * (WORLD_SIZE - 2);
      let z = (random() - 0.5) * (WORLD_SIZE - 2);
      if (Math.hypot(x, z) < 3.3) { x += x >= 0 ? 4 : -4; z += z >= 0 ? 4 : -4; }
      dummy.position.set(
        THREE.MathUtils.clamp(x, -WORLD_SIZE / 2 + 0.4, WORLD_SIZE / 2 - 0.4),
        -0.01,
        THREE.MathUtils.clamp(z, -WORLD_SIZE / 2 + 0.4, WORLD_SIZE / 2 - 0.4),
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

  createStarterFlowers() {
    // Only WORLD 01 grows flowers; WORLD 02 keeps its sandy coast.
    const flowers = [
      { position: [2.0, -0.03, 1.6], petalColor: 0xf6a5c1, scale: 1.00 },
      { position: [-1.8, -0.03, -1.5], petalColor: 0xf4dc80, scale: 0.86 },
      { position: [3.4, -0.03, -2.3], petalColor: 0xb9a3f3, scale: 1.12 },
    ];
    for (const { position, petalColor, scale } of flowers) {
      this.addObject(createFlower({ petalColor, scale }), position);
    }
  }

  createBeachCreatures() {
    // WORLD 02 replaces its former mushrooms with three resting clams and
    // three slow side-stepping crabs. All start above the sea boundary.
    const clams = [
      { position: [-4.0, -0.03, 2.9], shellColor: 0xefc8a4, scale: 1.05 },
      { position: [1.5, -0.03, 3.7], shellColor: 0xe9b7af, scale: 0.92 },
      { position: [6.8, -0.03, 2.8], shellColor: 0xdabbd0, scale: 1.12 },
    ];
    for (const { position, shellColor, scale } of clams) {
      this.addObject(createClam({ shellColor, scale }), position);
    }

    const crabs = [
      { position: [-6.5, -0.03, 5.1], shellColor: 0xe99172, scale: 1.00, phase: 0.4 },
      { position: [3.8, -0.03, 4.8], shellColor: 0xf1a582, scale: 0.92, phase: 2.2 },
      { position: [9.3, -0.03, 6.3], shellColor: 0xd97f68, scale: 1.10, phase: 4.1 },
    ];
    for (const { position, shellColor, scale, phase } of crabs) {
      this.addObject(createCrab({ shellColor, scale, phase }), position);
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

  digAt(x, z) {
    // A WORLD 01 meadow has no shovel and remains unchanged.
    if (!this.diggableSand?.dig(x, z, this.content.children)) return false;
    this.updateBeachPatchesAfterDig(x, z);
    return true;
  }

  updateBeachPatchesAfterDig(x, z) {
    // Keep the original colors, shapes and positions of all 26 patterns.
    // Only patch vertices near this hole need resampling; the patches
    // remain visible and conform to the real triangulated beach surface.
    for (const patch of this.beachPatches) {
      const maxRadius = Math.max(patch.scale.x, patch.scale.y);
      if (Math.hypot(x - patch.position.x, z - patch.position.z) > 0.91 + maxRadius) continue;

      const positions = patch.geometry.getAttribute('position');
      let changed = false;
      for (let i = 0; i < positions.count; i++) {
        const worldX = patch.position.x + positions.getX(i) * patch.scale.x;
        const worldZ = patch.position.z - positions.getY(i) * patch.scale.y;
        // Match the height of the rendered triangles rather than the
        // analytic hole function, avoiding a flat 'lid' over the cavity.
        const height = this.diggableSand.renderedHeightAt(worldX, worldZ);
        if (Math.abs(positions.getZ(i) - height) < 1e-6) continue;
        positions.setZ(i, height);
        changed = true;
      }
      if (changed) {
        positions.needsUpdate = true;
        patch.geometry.computeBoundingSphere();
        patch.geometry.computeBoundingBox();
      }
    }
  }

  getGroundOffsetAt(x, z) {
    return this.diggableSand?.heightAt(x, z) ?? 0;
  }

  update(dt, context) {
    this.elapsedTime += dt;
    for (let i = 0; i < this.clouds.length; i++) {
      this.clouds[i].position.x += Math.sin(this.elapsedTime * 0.11 + i) * dt * 0.045;
    }
    // A gentle shared tide: foam advances and recedes, with staggered breakers.
    if (this.shoreWash) {
      const tide = Math.sin(this.elapsedTime * 1.20);
      this.shoreWash.position.z = -0.15 + tide * 0.55;
      this.shoreWash.material.opacity = 0.17 + (tide + 1) * 0.075;
    }
    for (const wave of this.waves) {
      const { baseZ, amplitude, speed, phase, baseOpacity } = wave.userData;
      const tide = Math.sin(this.elapsedTime * speed + phase);
      wave.position.z = baseZ + tide * amplitude;
      wave.scale.x = 1 + tide * 0.035;
      wave.material.opacity = baseOpacity + (tide + 1) * 0.07;
    }
    for (const object of this.updatables) object.update(dt, context);
  }
}
