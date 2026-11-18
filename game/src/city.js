// Solmarina: a sun-soaked fictional coastal city. Grid of avenues and
// streets, a beach and pier to the south, a park, a plaza and a skyline of
// pastel towers — all built from geometry and canvas textures, no assets.
import * as THREE from 'three';
import { G, CITY, rand, pick } from './state.js';

const PALETTE = [0xf2c9a0, 0xf7e6c8, 0xd9a441, 0x7fb3d5, 0xe8a0a0, 0xb5c9a8, 0xf5f0e6, 0x9db8c9, 0xe0b070, 0xc98a7a];
const SIGNS = ['CAFÉ LUNA', 'HOTEL PALMA', 'TACOS EL FARO', 'SURF SHOP', 'BANCO SOL', 'CINE MAR', 'PIZZA SOL', 'GYM FUERTE', 'FARMACIA', 'MERCADO'];

function windowTexture(base, lit) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 256);
  for (let r = 0; r < 10; r++) for (let col = 0; col < 4; col++) {
    const on = Math.random() < (lit ? 0.55 : 0.25);
    x.fillStyle = on ? '#ffe9a8' : (Math.random() < 0.5 ? '#274b63' : '#1d3547');
    x.fillRect(10 + col * 30, 12 + r * 24, 20, 14);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildCity() {
  const scene = G.scene;
  scene.background = new THREE.Color(0x87c5e8);
  scene.fog = new THREE.Fog(0x9fd0e8, 260, 720);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a6f4d, 0.95); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.1);
  sun.position.set(180, 260, 120); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700; scene.add(sun);

  // Ground: grass/asphalt base, then road strips on top.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100),
    new THREE.MeshLambertMaterial({ color: 0x9db98a }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // Ocean to the south (z > 250) and sand beach.
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1100, 320),
    new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, 0.05, 400); scene.add(ocean);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(1100, 60),
    new THREE.MeshLambertMaterial({ color: 0xeed9a4 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.06, 262); scene.add(beach);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x333a42 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const r of CITY.roads) {
    for (const [w, l, x, z] of [[CITY.roadW, 560, r, 0], [560, CITY.roadW, 0, r]]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
      road.rotation.x = -Math.PI / 2; road.position.set(x, 0.1, z); road.receiveShadow = true; scene.add(road);
    }
    // Centre dashes along both axes, skipped near intersections so the
    // crossings stay clean.
    for (let d = -260; d < 260; d += 26) {
      if (CITY.roads.some(r => Math.abs(d - r) < 9)) continue;
      for (const [x, z, ry] of [[r, d, 0], [d, r, Math.PI / 2]]) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 6), lineMat);
        dash.rotation.x = -Math.PI / 2; dash.rotation.z = ry; dash.position.set(x, 0.12, z); scene.add(dash);
      }
    }
    G.roads.push(r);
  }
  // Sidewalk slabs around every block.
  const blockCentres = [];
  for (let i = 0; i < CITY.roads.length - 1; i++) for (let j = 0; j < CITY.roads.length - 1; j++) {
    const cx = (CITY.roads[i] + CITY.roads[i + 1]) / 2, cz = (CITY.roads[j] + CITY.roads[j + 1]) / 2;
    blockCentres.push([cx, cz]);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block + 6, CITY.block + 6), walkMat);
    walk.rotation.x = -Math.PI / 2; walk.position.set(cx, 0.09, cz); walk.receiveShadow = true; scene.add(walk);
  }

  // Buildings: 1–4 per block, varied heights, pastel facades, lit windows.
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b5a4a });
  const texCache = {};
  let bCount = 0;
  for (const [cx, cz] of blockCentres) {
    // Park block near the centre-west, plaza near the centre.
    if (Math.abs(cx + 130) < 1 && Math.abs(cz + 26) < 1) { buildPark(cx, cz); continue; }
    if (Math.abs(cx - 26) < 1 && Math.abs(cz - 26) < 1) { buildPlaza(cx, cz); continue; }
    const n = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const w = rand(10, 18), d = rand(10, 18), h = rand(9, 46) * (Math.random() < 0.12 ? 1.8 : 1);
      const ox = (k % 2 ? -1 : 1) * rand(2, 9), oz = (k < 2 ? -1 : 1) * rand(2, 9);
      const bx = cx + ox, bz = cz + oz;
      const col = pick(PALETTE);
      const key = col + (Math.random() < 0.5 ? 'a' : 'b');
      if (!texCache[key]) texCache[key] = windowTexture('#' + col.toString(16).padStart(6, '0'), key.endsWith('a'));
      const mat = new THREE.MeshLambertMaterial({ map: texCache[key] });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(bx, h / 2, bz); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
      roof.position.set(bx, h + 0.4, bz); scene.add(roof);
      if (Math.random() < 0.4) { // rooftop AC box
        const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 3), new THREE.MeshLambertMaterial({ color: 0x9aa5ad }));
        ac.position.set(bx + w / 4, h + 1.6, bz); scene.add(ac);
      }
      G.colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      bCount++;
    }
  }

  // Shop signs on random ground-floor fronts.
  const signMats = SIGNS.map(s => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48;
    const x = c.getContext('2d'); x.fillStyle = pick(['#20344d', '#7a1f2b', '#14532d', '#5b2a86']);
    x.fillRect(0, 0, 256, 48); x.fillStyle = '#fff'; x.font = 'bold 26px Arial';
    x.textAlign = 'center'; x.fillText(s, 128, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
  for (let i = 0; i < 26; i++) {
    const road = pick(CITY.roads), along = rand(-200, 200);
    const horiz = Math.random() < 0.5;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2),
      new THREE.MeshBasicMaterial({ map: pick(signMats) }));
    s.position.set(horiz ? along : road + 8.5, 4.4, horiz ? road + 8.5 : along);
    s.rotation.y = horiz ? 0 : Math.PI / 2; scene.add(s);
  }

  buildPalms(); buildPier(); buildStreetlights();
  return bCount;
}

function buildPark(cx, cz) {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block, CITY.block),
    new THREE.MeshLambertMaterial({ color: 0x5da24a }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(cx, 0.11, cz); G.scene.add(grass);
  for (let i = 0; i < 8; i++) makePalm(cx + rand(-16, 16), cz + rand(-16, 16));
  const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 24),
    new THREE.MeshLambertMaterial({ color: 0x3a9bc2 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(cx + 8, 0.13, cz - 8); G.scene.add(pond);
}
function buildPlaza(cx, cz) {
  const stone = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block, CITY.block),
    new THREE.MeshLambertMaterial({ color: 0xd8cdb8 }));
  stone.rotation.x = -Math.PI / 2; stone.position.set(cx, 0.11, cz); G.scene.add(stone);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 1.2, 12),
    new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
  base.position.set(cx, 0.7, cz); G.scene.add(base);
  const statue = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a441 }));
  statue.position.set(cx, 4.2, cz); statue.castShadow = true; G.scene.add(statue);
  for (let i = 0; i < 6; i++) makePalm(cx + rand(-17, 17), cz + rand(-17, 17));
}
function makePalm(x, z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 6, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6b42 }));
  trunk.position.set(x, 3, z); trunk.castShadow = true; G.scene.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e4f });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
    const a = i / 6 * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 1.4, 6.2, z + Math.sin(a) * 1.4);
    leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1; G.scene.add(leaf);
  }
}
function buildPalms() {
  for (let i = 0; i < 40; i++) {
    const road = pick(CITY.roads);
    if (Math.random() < 0.5) makePalm(road + 9, rand(-210, 210)); else makePalm(rand(-210, 210), road + 9);
  }
  for (let i = 0; i < 14; i++) makePalm(rand(-230, 230), 252 + rand(0, 8)); // beach palms
}
function buildPier() {
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 90),
    new THREE.MeshLambertMaterial({ color: 0x9a7b52 }));
  pier.position.set(-104, 0.8, 300); G.scene.add(pier);
  for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4f30 }));
    post.position.set(-104 + (i % 2 ? 4.4 : -4.4), 0.4, 262 + i * 10); G.scene.add(post);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(9, 0.9, 8, 24),
    new THREE.MeshLambertMaterial({ color: 0xff5a7a }));
  wheel.position.set(-130, 12, 300); wheel.castShadow = true; G.scene.add(wheel);
}
function buildStreetlights() {
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const r of CITY.roads) for (let d = -200; d <= 200; d += 52) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
    pole.position.set(r + 7.5, 3.5, d); G.scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
    lamp.position.set(r + 7.5, 7.1, d); G.scene.add(lamp);
  }
}

// Circle-vs-building collision: push a circle of radius r out of footprints.
export function collideCircle(pos, r) {
  for (const c of G.colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-6) { pos.x += r; continue; }
      const d = Math.sqrt(d2); pos.x = nx + dx / d * r; pos.z = nz + dz / d * r;
      return true;
    }
  }
  return false;
}
export function clampToCity(pos, margin) {
  const m = CITY.half + 60;
  pos.x = Math.max(-m, Math.min(m, pos.x)); pos.z = Math.max(-m, Math.min(m, pos.z));
}
