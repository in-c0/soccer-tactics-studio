import * as THREE from 'three';
import type { BallState } from './types';

function ballTexture(base: string, accent: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = accent;
  const blob = (cx: number, cy: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.8;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
  };
  blob(40, 40, 18);
  blob(128, 30, 18);
  blob(214, 44, 18);
  blob(84, 96, 16);
  blob(174, 98, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Ball {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  private key = '';

  constructor() {
    this.mat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.02 });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.111, 28, 20), this.mat);
    this.mesh.castShadow = true;
    this.mesh.userData.ball = true;
    this.group.add(this.mesh);
    const proxy = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 })
    );
    proxy.userData.ball = true;
    this.group.add(proxy);
    this.group.userData.ball = true;
  }

  update(b: BallState, held: THREE.Vector3 | null): void {
    this.group.visible = b.visible;
    const key = `${b.color}|${b.accentColor}`;
    if (key !== this.key) {
      this.mat.map?.dispose();
      this.mat.map = ballTexture(b.color, b.accentColor);
      this.mat.needsUpdate = true;
      this.key = key;
    }
    if (b.heldByThrower && held) this.group.position.copy(held);
    else this.group.position.set(b.x, b.y, b.z);
    this.group.scale.setScalar(b.scale);
  }
}
