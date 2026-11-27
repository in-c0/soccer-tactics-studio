import * as THREE from 'three';
import type { PitchState } from './types';

const RUNOFF = 6; // metres of grass beyond the touchlines

/** Paint the whole pitch — mown stripes and markings — into one texture. */
function pitchTexture(p: PitchState): THREE.CanvasTexture {
  const totalW = p.length + RUNOFF * 2;
  const totalH = p.width + RUNOFF * 2;
  const px = 24; // pixels per metre
  const c = document.createElement('canvas');
  c.width = Math.round(totalW * px);
  c.height = Math.round(totalH * px);
  const g = c.getContext('2d')!;

  // metres -> pixels, origin at pitch centre
  const X = (m: number) => (m + totalW / 2) * px;
  const Y = (m: number) => (m + totalH / 2) * px;

  g.fillStyle = p.grassA;
  g.fillRect(0, 0, c.width, c.height);

  if (p.stripes > 0) {
    const bandW = p.length / p.stripes;
    g.fillStyle = p.grassB;
    for (let i = 0; i < p.stripes; i += 2) {
      const x0 = -p.length / 2 + i * bandW;
      g.fillRect(X(x0), 0, bandW * px, c.height);
    }
    // subtle mow lines in the runoff too
    g.globalAlpha = 0.5;
    g.fillRect(0, 0, X(-p.length / 2), c.height);
    g.fillRect(X(p.length / 2), 0, c.width - X(p.length / 2), c.height);
    g.globalAlpha = 1;
  }

  if (!p.showLines) {
    const t0 = new THREE.CanvasTexture(c);
    t0.colorSpace = THREE.SRGBColorSpace;
    t0.anisotropy = 8;
    return t0;
  }

  const L = p.length / 2;
  const W = p.width / 2;
  g.globalAlpha = p.lineOpacity;
  g.strokeStyle = p.lineColor;
  g.fillStyle = p.lineColor;
  g.lineWidth = 0.12 * px;
  g.lineCap = 'butt';

  const rect = (x0: number, z0: number, x1: number, z1: number) =>
    g.strokeRect(X(x0), Y(z0), (x1 - x0) * px, (z1 - z0) * px);

  rect(-L, -W, L, W); // touchlines + goal lines
  g.beginPath();
  g.moveTo(X(0), Y(-W));
  g.lineTo(X(0), Y(W));
  g.stroke();

  const circle = (cx: number, cz: number, r: number, fill = false) => {
    g.beginPath();
    g.arc(X(cx), Y(cz), r * px, 0, Math.PI * 2);
    if (fill) g.fill();
    else g.stroke();
  };
  circle(0, 0, 9.15);
  circle(0, 0, 0.22, true);

  for (const s of [-1, 1]) {
    const gx = s * L;
    // penalty area 16.5 x 40.32, goal area 5.5 x 18.32
    rect(Math.min(gx, gx - s * 16.5), -20.16, Math.max(gx, gx - s * 16.5), 20.16);
    rect(Math.min(gx, gx - s * 5.5), -9.16, Math.max(gx, gx - s * 5.5), 9.16);
    circle(gx - s * 11, 0, 0.22, true);
    // penalty arc, clipped to outside the box
    g.beginPath();
    const cx = gx - s * 11;
    const a = Math.acos((16.5 - 11) / 9.15);
    if (s > 0) g.arc(X(cx), Y(0), 9.15 * px, Math.PI - a, Math.PI + a);
    else g.arc(X(cx), Y(0), 9.15 * px, -a, a);
    g.stroke();
    // corner arcs
    for (const t of [-1, 1]) {
      g.beginPath();
      const start = s > 0 ? (t > 0 ? Math.PI / 2 : Math.PI) : t > 0 ? 0 : -Math.PI / 2;
      g.arc(X(gx), Y(t * W), 1 * px, start, start + Math.PI / 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

function buildGoal(p: PitchState, side: 1 | -1): THREE.Group {
  const goal = new THREE.Group();
  const w = 7.32;
  const h = 2.44;
  const post = 0.06;
  const depth = 2;
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });

  const bar = (len: number, axis: 'x' | 'y' | 'z') => {
    const geo = new THREE.CylinderGeometry(post, post, len, 10);
    if (axis === 'x') geo.rotateZ(Math.PI / 2);
    if (axis === 'z') geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  };
  for (const t of [-1, 1]) {
    const m = bar(h, 'y');
    m.position.set(0, h / 2, (t * w) / 2);
    goal.add(m);
  }
  const cross = bar(w, 'z');
  cross.position.set(0, h, 0);
  goal.add(cross);

  // net: a translucent grid box behind the goal line
  const netMat = new THREE.MeshBasicMaterial({
    color: '#e9f1ff',
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const netGeoms: THREE.BufferGeometry[] = [];
  const back = new THREE.PlaneGeometry(w, h, 18, 8);
  back.rotateY(Math.PI / 2);
  back.translate(-depth, h / 2, 0);
  netGeoms.push(back);
  for (const t of [-1, 1]) {
    const sideGeo = new THREE.PlaneGeometry(depth, h, 6, 8);
    sideGeo.translate(-depth / 2, h / 2, (t * w) / 2);
    netGeoms.push(sideGeo);
  }
  const top = new THREE.PlaneGeometry(depth, w, 6, 18);
  top.rotateX(-Math.PI / 2);
  top.rotateY(Math.PI / 2);
  top.translate(-depth / 2, h, 0);
  netGeoms.push(top);
  for (const geo of netGeoms) {
    const mesh = new THREE.Mesh(geo, netMat);
    goal.add(mesh);
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 })
    );
    goal.add(wire);
  }

  goal.position.x = (side * p.length) / 2;
  goal.scale.x = side;
  return goal;
}

function buildStands(p: PitchState): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#1b2230', roughness: 0.95 });
  const seatMat = new THREE.MeshStandardMaterial({ color: '#28324a', roughness: 1 });
  const L = p.length / 2 + RUNOFF + 3;
  const W = p.width / 2 + RUNOFF + 3;
  // Each side gets a low wall at the pitch edge and a raked block behind it.
  const side = (w: number, d: number, x: number, z: number, outX: number, outZ: number) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d * 0.18), mat);
    wall.position.set(x, 0.6, z);
    wall.receiveShadow = true;
    g.add(wall);
    const tier = new THREE.Mesh(new THREE.BoxGeometry(w, 11, d), seatMat);
    tier.position.set(x + outX * (d / 2), 4.4, z + outZ * (d / 2));
    tier.rotation.x = outZ * 0.16;
    tier.rotation.z = -outX * 0.16;
    g.add(tier);
  };
  const depth = 20;
  side(p.length + 34, depth, 0, W, 0, 1);
  side(p.length + 34, depth, 0, -W, 0, -1);
  const sideGeoW = p.width + 26;
  const sideStand = (sx: number) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(depth * 0.18, 1.2, sideGeoW), mat);
    wall.position.set(sx * L, 0.6, 0);
    g.add(wall);
    const tier = new THREE.Mesh(new THREE.BoxGeometry(depth, 11, sideGeoW), seatMat);
    tier.position.set(sx * (L + depth / 2), 4.4, 0);
    tier.rotation.z = -sx * 0.16;
    g.add(tier);
  };
  sideStand(1);
  sideStand(-1);
  return g;
}

export function buildPitch(p: PitchState): THREE.Group {
  const group = new THREE.Group();
  group.name = 'pitch';

  const totalW = p.length + RUNOFF * 2;
  const totalH = p.width + RUNOFF * 2;
  const geo = new THREE.PlaneGeometry(totalW, totalH);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ map: pitchTexture(p), roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  // surrounding darker apron so the pitch does not float in the void
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(totalW + 60, totalH + 60).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#16281c', roughness: 1 })
  );
  apron.position.y = -0.02;
  group.add(apron);

  if (p.showGoals) {
    group.add(buildGoal(p, 1));
    group.add(buildGoal(p, -1));
  }
  if (p.showStands) group.add(buildStands(p));

  return group;
}

export function skyTexture(p: PitchState): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, p.skyTop);
  grad.addColorStop(1, p.skyBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

export function pitchSignature(p: PitchState): string {
  return [
    p.length,
    p.width,
    p.grassA,
    p.grassB,
    p.stripes,
    p.lineColor,
    p.lineOpacity,
    p.showLines,
    p.showGoals,
    p.showStands,
  ].join('|');
}
