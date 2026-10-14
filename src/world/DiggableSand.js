import * as THREE from 'three';

const SIZE_X = 44;
const SIZE_Z = 22;
const CENTER_Z = 11;
const GRID_X = 176;
const GRID_Z = 88;
const MAX_HOLES = 24;
const HOLE_RADIUS = 0.91;
const SHORE_MIN_Z = 2.65;
const LAND_MAX_Z = 19.8;
const LAND_MAX_X = 19.7;

// Smoothstep from 0..1, with zero slopes at either end.
function smoothstep(x) {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

function holeShape(distance) {
  if (distance >= HOLE_RADIUS) return { height: 0, darkness: 0 };
  // A broad recessed center slopes into a small raised rim.
  const bowl = 1 - smoothstep((distance - 0.18) / 0.53);
  const rim = Math.max(0, 1 - Math.abs(distance - 0.74) / 0.16);
  return {
    height: -0.23 * bowl + 0.043 * rim * rim,
    darkness: 0.53 * bowl + 0.11 * rim,
  };
}

/**
 * REAL mesh depressions, not flat dark stickers. The land cube is lowered
 * in WORLD 02 so the ground underneath doesn't cover the hollowed surface.
 *
 * Geometry remains one mesh. Work is only performed when S digs a new hole,
 * not each animation frame. There are at most 24 holes for bounded cost.
 */
export class DiggableSand {
  constructor(ground) {
    this.ground = ground;
    this.holes = [];
    this.maxHoles = MAX_HOLES;

    const original = ground.geometry;
    const geometry = new THREE.PlaneGeometry(SIZE_X, SIZE_Z, GRID_X, GRID_Z);
    const positions = geometry.getAttribute('position');
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3));
    ground.geometry = geometry;
    original.dispose();
    ground.material.vertexColors = true;
    ground.material.needsUpdate = true;

    // A colored sand pattern is painted onto the SAME vertices that dig
    // later deforms. Retaining an immutable base palette ensures new holes
    // change only relief/shadow, never erase the sand motif.
    this.baseColors = new Float32Array(positions.count * 3);
    this.patterns = [];
    this.setColorPatches([]);
  }

  setColorPatches(patches) {
    // Three.js vertex colors must be LINEAR RGB. Color.setHex converts the
    // supplied sRGB hex to linear, matching the previous materials.
    this.patterns = patches.map(({ x, z, radiusX, radiusZ, color }) => ({
      x, z, radiusX, radiusZ, color: new THREE.Color(color),
    }));
    const vertices = this.ground.geometry.getAttribute('position');
    const base = new THREE.Color(0xe7d3ac);
    const ink = new THREE.Color();
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const z = CENTER_Z - vertices.getY(i);
      ink.copy(base);
      for (const patch of this.patterns) {
        const distance = Math.hypot(
          (x - patch.x) / patch.radiusX,
          (z - patch.z) / patch.radiusZ,
        );
        if (distance >= 1) continue;
        // Preserve the original patch footprint with just a small soft
        // transition at the edge, avoiding jagged 0.25-unit grid outlines.
        const coverage = smoothstep((1 - distance) / 0.12);
        ink.lerp(patch.color, coverage);
      }
      this.baseColors[i * 3] = ink.r;
      this.baseColors[i * 3 + 1] = ink.g;
      this.baseColors[i * 3 + 2] = ink.b;
    }
    this.rebuildGeometry();
  }

  /** Offset relative to the original level surface. */
  heightAt(x, z) {
    let result = 0;
    for (const hole of this.holes) {
      const d = Math.hypot(x - hole.x, z - hole.z);
      if (d < HOLE_RADIUS) result += holeShape(d).height;
    }
    return result;
  }

  /**
   * Interpolate the ACTUAL triangulated ground surface under a decorative
   * sand patch. Sampling the rendered triangles (instead of the smooth
   * analytic bowl) prevents the patch from crossing through the terrain
   * or covering the hollow with a flat colored lid.
   *
   * PlaneGeometry vertices are ordered by rows from z=0 to z=22,
   * with the diagonal running from each cell's bottom-left to top-right.
   */
  renderedHeightAt(x, z) {
    const xGrid = THREE.MathUtils.clamp((x + SIZE_X / 2) * GRID_X / SIZE_X, 0, GRID_X);
    const zGrid = THREE.MathUtils.clamp(z * GRID_Z / SIZE_Z, 0, GRID_Z);
    const ix = Math.min(Math.floor(xGrid), GRID_X - 1);
    const iz = Math.min(Math.floor(zGrid), GRID_Z - 1);
    const fx = xGrid - ix;
    const fz = zGrid - iz;
    const vertices = this.ground.geometry.getAttribute('position');
    const index = iz * (GRID_X + 1) + ix;
    const a = vertices.getZ(index);                 // top-left
    const b = vertices.getZ(index + GRID_X + 1);    // bottom-left
    const c = vertices.getZ(index + GRID_X + 2);    // bottom-right
    const d = vertices.getZ(index + 1);             // top-right
    if (fx + fz <= 1) {
      return a * (1 - fx - fz) + b * fz + d * fx;
    }
    return b * (1 - fx) + c * (fx + fz - 1) + d * (1 - fz);
  }

  canDig(x, z, objects = []) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || this.holes.length >= this.maxHoles) return false;
    // Stay on dry sand and away from corners, water, and the decorative shore.
    if (Math.abs(x) > LAND_MAX_X || z < SHORE_MIN_Z || z > LAND_MAX_Z) return false;
    for (const hole of this.holes) {
      if (Math.hypot(x - hole.x, z - hole.z) < HOLE_RADIUS * 2.15) return false;
    }
    for (const object of objects) {
      if (!object.userData.pickupType || object.userData.isHeld || object.userData.isTossing) continue;
      if (Math.hypot(x - object.position.x, z - object.position.z) < 1.12) return false;
    }
    return true;
  }

  dig(x, z, objects = []) {
    if (!this.canDig(x, z, objects)) return false;
    this.holes.push({ x, z });
    this.rebuildGeometry();
    return true;
  }

  rebuildGeometry() {
    const geometry = this.ground.geometry;
    const vertices = geometry.getAttribute('position');
    const colors = geometry.getAttribute('color');
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      // PlaneGeometry is rotated -90 degrees around X in World.js, so its
      // local Y becomes negative world Z after a world-space shift of +11.
      const z = CENTER_Z - vertices.getY(i);
      let height = 0;
      let darkness = 0;
      for (const hole of this.holes) {
        const distance = Math.hypot(x - hole.x, z - hole.z);
        if (distance >= HOLE_RADIUS) continue;
        const shape = holeShape(distance);
        height += shape.height;
        darkness = Math.max(darkness, shape.darkness);
      }
      vertices.setZ(i, height); // local +Z becomes WORLD +Y after rotation
      const shade = Math.max(0.37, 1 - darkness);
      colors.setXYZ(
        i,
        this.baseColors[i * 3] * shade,
        this.baseColors[i * 3 + 1] * shade,
        this.baseColors[i * 3 + 2] * shade,
      );
    }
    vertices.needsUpdate = true;
    colors.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
}
