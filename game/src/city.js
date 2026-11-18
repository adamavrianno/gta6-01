// Porto Verde city: six districts, a road grid, buildings, landmarks and colliders.
// Deterministic layout (seeded RNG) so the city is identical on every load.
import * as THREE from 'three';
import { DISTRICTS, mulberry32, clamp } from './state.js';

export const ROAD_LINES = [-256, -192, -128, -64, 0, 64, 128, 192, 256];
export const CITY_BOUND = 262;

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#20242c';
  for (let y = 10; y < 120; y += 18) for (let x = 8; x < 56; x += 16) g.fillRect(x, y, 9, 11);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[2];
}

export function buildCity(scene) {
  const rng = mulberry32(20261118);
  const colliders = [];
  const matCache = new Map();
  const winTex = windowTexture();

  function mat(color, opts = {}) {
    const key = color + '|' + (opts.emissive || 0) + '|' + (opts.win ? 1 : 0);
    if (!matCache.has(key)) {
      const m = new THREE.MeshLambertMaterial({ color });
      if (opts.win) m.map = winTex;
      if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.ei || 0.9; }
      matCache.set(key, m);
    }
    return matCache.get(key);
  }
  function box(w, h, d, x, y, z, material, collide = true) {
    const mesh = new THREE.Mesh(unitBox, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y + h / 2, z);
    scene.add(mesh);
    if (collide) colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    return mesh;
  }

  // Ground: muted urban green-grey, sand strip and sea to the south.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: 0x46543f }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0); scene.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(560, 46), new THREE.MeshLambertMaterial({ color: 0xd9c08a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 246); scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 220), new THREE.MeshLambertMaterial({ color: 0x1e6f8e }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.0, 380); scene.add(sea);

  // Roads: dark asphalt strips on the grid, with pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d3a0 });
  for (const line of ROAD_LINES) {
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(524, 12), roadMat);
    hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0.06, line); scene.add(hRoad);
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, 524), roadMat);
    vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(line, 0.06, 0); scene.add(vRoad);
    for (let p = -240; p <= 240; p += 32) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.7), dashMat);
      d1.rotation.x = -Math.PI / 2; d1.position.set(p, 0.08, line); scene.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 6), dashMat);
      d2.rotation.x = -Math.PI / 2; d2.position.set(line, 0.08, p); scene.add(d2);
    }
  }

  // Buildings, one block at a time. Heights and colours follow the district.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0xffe9a8, emissiveIntensity: 0.7 });
  for (let gi = 0; gi < ROAD_LINES.length - 1; gi++) {
    for (let gj = 0; gj < ROAD_LINES.length - 1; gj++) {
      const x0 = ROAD_LINES[gi] + 8, x1 = ROAD_LINES[gi + 1] - 8;
      const z0 = ROAD_LINES[gj] + 8, z1 = ROAD_LINES[gj + 1] - 8;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const d = districtAt(cx, cz);
      if (d.id === 'beach' && cz > 225) continue; // sand, kept open
      if (d.id === 'uni' && Math.abs(cx - 205) < 45 && Math.abs(cz - 130) < 30) continue; // campus plaza
      const pal = d.palette;
      if (d.id === 'harbor' || d.id === 'docks') {
        // Warehouses: long low sheds, or container stacks in the docks.
        if (d.id === 'docks' && rng() < 0.55) {
          for (let k = 0; k < 5; k++) {
            const w = 12 + rng() * 6, h = 2.6 + Math.floor(rng() * 3) * 2.6;
            const px = x0 + 8 + rng() * (x1 - x0 - 16), pz = z0 + 8 + rng() * (z1 - z0 - 16);
            box(w, h, 3, px, 0, pz, mat([0xc94f4f, 0x2e86ab, 0xe9c46a, 0x6a994e][Math.floor(rng() * 4)]));
          }
        } else {
          box(x1 - x0 - 6, 9 + rng() * 6, z1 - z0 - 10, cx, 0, cz, mat(pal[Math.floor(rng() * pal.length)]));
        }
        continue;
      }
      if (d.id === 'hills') {
        // Villas: small houses with pyramid roofs.
        for (let k = 0; k < 3; k++) {
          const px = x0 + 10 + rng() * (x1 - x0 - 20), pz = z0 + 10 + rng() * (z1 - z0 - 20);
          box(13, 6 + rng() * 3, 11, px, 0, pz, mat(pal[Math.floor(rng() * pal.length)], { win: true }));
          const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 4, 4), mat(0x8c4a2f));
          roof.position.set(px, 6 + 4, pz); roof.rotation.y = Math.PI / 4; scene.add(roof);
          colliders.push({ x0: px - 7, z0: pz - 6, x1: px + 7, z1: pz + 6 });
        }
        continue;
      }
      // Towers / mid-rise blocks.
      const n = rng() < 0.5 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const w = 16 + rng() * 18, dep = 14 + rng() * 16;
        const px = n === 1 ? cx : x0 + w / 2 + 4 + k * (x1 - x0 - w - 8);
        const pz = cz + (rng() - 0.5) * 8;
        const h = d.id === 'strip' ? 22 + rng() * 42 : 12 + rng() * 26;
        box(w, h, dep, px, 0, pz, mat(pal[Math.floor(rng() * pal.length)], { win: true }));
        if (d.id === 'strip' && rng() < 0.7) {
          // Neon sign slab on the facade.
          const sign = new THREE.Mesh(unitBox, mat([0xff2e88, 0x00e5ff, 0xffe66d, 0x7dff9e][Math.floor(rng() * 4)], { emissive: 0xffffff, ei: 0.55 }));
          sign.scale.set(w * 0.7, 2.2, 0.6);
          sign.position.set(px, 7 + rng() * 6, pz - dep / 2 - 0.4);
          scene.add(sign);
        }
      }
    }
  }

  // Landmarks.
  // Old Harbor cranes.
  for (const cz of [10, 80, 150]) {
    box(4, 34, 4, -238, 0, cz, mat(0xd98e32), true);
    const jib = new THREE.Mesh(unitBox, mat(0xd98e32));
    jib.scale.set(4, 3, 34); jib.position.set(-238, 32, cz + 8); scene.add(jib);
    box(10, 3, 8, -238, 0, cz + 26, mat(0x6b5a44));
  }
  // Beachfront casino "Casino Verde".
  box(46, 20, 30, 120, 0, 208, mat(0x1b2a4a, { win: true }));
  const casinoSign = new THREE.Mesh(unitBox, mat(0x06d6a0, { emissive: 0x06d6a0, ei: 1.0 }));
  casinoSign.scale.set(34, 4, 1); casinoSign.position.set(120, 22, 192); scene.add(casinoSign);
  // Pier out to sea.
  box(14, 1.2, 52, 0, 0, 288, mat(0x8a6f4d), false);
  for (const px of [-6, 6]) for (const pz of [272, 292, 308]) {
    const post = new THREE.Mesh(unitCyl, mat(0x5d4030));
    post.scale.set(1.4, 3, 1.4); post.position.set(px, 0.5, pz); scene.add(post);
  }
  // University clock tower.
  box(10, 30, 10, 205, 0, 96, mat(0xb08968, { win: true }));
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 1, 16), mat(0xffe66d, { emissive: 0xffe66d, ei: 0.8 }));
  clock.rotation.x = Math.PI / 2; clock.position.set(205, 28, 90); scene.add(clock);
  // Neon Strip arch over the avenue.
  box(3, 16, 3, -8, 0, 0, mat(0xff2e88, { emissive: 0xff2e88, ei: 0.6 }));
  box(3, 16, 3, 8, 0, 0, mat(0x00e5ff, { emissive: 0x00e5ff, ei: 0.6 }));
  const arch = new THREE.Mesh(unitBox, mat(0xff2e88, { emissive: 0xff2e88, ei: 0.5 }));
  arch.scale.set(19, 2.5, 2.5); arch.position.set(0, 15, 0); scene.add(arch);

  // Lamp posts at intersections (visual only).
  for (const lx of ROAD_LINES) for (const lz of ROAD_LINES) {
    if (Math.abs(lx) > 250 || Math.abs(lz) > 250) continue;
    const pole = new THREE.Mesh(unitCyl, mat(0x2a2f36));
    pole.scale.set(0.5, 7, 0.5); pole.position.set(lx + 7, 3.5, lz + 7); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lampMat);
    lamp.position.set(lx + 7, 7.2, lz + 7); scene.add(lamp);
  }

  // Stunt ramp on the beachfront avenue.
  const ramp = new THREE.Mesh(unitBox, mat(0xe07b39));
  ramp.scale.set(8, 1.4, 10); ramp.position.set(64, 0.7, 158); ramp.rotation.x = -0.32; scene.add(ramp);
  colliders.push({ x0: 59, z0: 152, x1: 69, z1: 164 });

  const spots = {
    playerSpawn: { x: 20, z: 40 },
    harborPickup: { x: -200, z: 120 },
    harborDrop: { x: 96, z: -32 },
    garage: { x: 60, z: -32 },
    sportsCar: { x: 40, z: 8 },
    docksExit: { x: -192, z: -224 },
    docksStart: { x: -160, z: -96 },
    uniWitness: { x: 205, z: 130 },
    uniDrop: { x: 96, z: 128 },
    gearSpots: [{ x: -208, z: -176 }, { x: 216, z: -192 }, { x: -40, z: 224 }],
    casino: { x: 120, z: 186 },
    safehouse: { x: 224, z: -192 },
    taxiStand: { x: 0, z: 0 },
    stuntRamp: { x: 64, z: 150 },
  };

  return { colliders, districtAt, spots, roadLines: ROAD_LINES };
}

// Circle-vs-AABB resolve: push a circle of radius r out of every overlapping collider.
// Returns true when a collision happened.
export function collideCircle(colliders, x, z, r) {
  let hit = false;
  for (const c of colliders) {
    const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1);
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        return { hit: true, px: dx * push, pz: dz * push };
      }
      return { hit: true, px: r, pz: 0 };
    }
  }
  return { hit };
}

export function nearestRoadPoint(x, z) {
  let bx = ROAD_LINES[0], bz = ROAD_LINES[0];
  for (const l of ROAD_LINES) { if (Math.abs(l - x) < Math.abs(bx - x)) bx = l; if (Math.abs(l - z) < Math.abs(bz - z)) bz = l; }
  return { x: bx, z: bz };
}
