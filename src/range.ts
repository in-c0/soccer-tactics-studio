import * as THREE from 'three';
import type { PlayerState, ThrowSettings } from './types';

const D = Math.PI / 180;

export function coneHeadingOf(t: ThrowSettings, thrower: PlayerState | null): number {
  return t.coneFollowsThrower && thrower ? thrower.heading : t.coneHeading;
}

/** Points along the sector arc, in pitch coordinates. */
export function sectorArc(cx: number, cz: number, radius: number, heading: number, half: number, steps = 48) {
  const out: { x: number; z: number }[] = [];
  const a0 = (heading - half) * D;
  const a1 = (heading + half) * D;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push({ x: cx + Math.cos(a) * radius, z: cz + Math.sin(a) * radius });
  }
  return out;
}

function fanGeometry(
  cx: number,
  cz: number,
  rInner: number,
  rOuter: number,
  heading: number,
  half: number,
  y: number,
  steps = 64
): THREE.BufferGeometry {
  const pos: number[] = [];
  const a0 = (heading - half) * D;
  const a1 = (heading + half) * D;
  for (let i = 0; i < steps; i++) {
    const t0 = a0 + ((a1 - a0) * i) / steps;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
    const p = (r: number, a: number) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    const i0 = p(rInner, t0);
    const i1 = p(rInner, t1);
    const o0 = p(rOuter, t0);
    const o1 = p(rOuter, t1);
    pos.push(...i0, ...o0, ...o1);
    pos.push(...i0, ...o1, ...i1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function ring(cx: number, cz: number, radius: number, width: number, y: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(radius, Math.max(0.02, width / 2), 6, 128);
  g.rotateX(Math.PI / 2);
  g.translate(cx, y, cz);
  return g;
}

/**
 * Flat ribbon along a ground polyline. Used instead of a tube because the
 * sector outline doubles back on itself, which makes swept frames misbehave.
 */
function groundRibbon(pts: { x: number; z: number }[], y: number, width: number): THREE.BufferGeometry | null {
  if (pts.length < 2) return null;
  const half = Math.max(0.02, width / 2);
  const pos: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) continue;
    const nx = (-dz / len) * half;
    const nz = (dx / len) * half;
    const a0 = [a.x + nx, y, a.z + nz];
    const a1 = [a.x - nx, y, a.z - nz];
    const b0 = [b.x + nx, y, b.z + nz];
    const b1 = [b.x - nx, y, b.z - nz];
    pos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export interface RangeObject {
  group: THREE.Group;
  dispose(): void;
}

export function buildRange(t: ThrowSettings, thrower: PlayerState | null): RangeObject {
  const group = new THREE.Group();
  group.name = 'range';
  const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  if (!thrower) return { group, dispose() {} };

  const cx = thrower.x;
  const cz = thrower.z;
  const heading = coneHeadingOf(t, thrower);

  const addMesh = (geo: THREE.BufferGeometry, color: string, opacity: number, order: number) => {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = order;
    group.add(m);
    disposables.push(geo, mat);
    return m;
  };

  if (t.showCircle) {
    const disc = new THREE.CircleGeometry(t.maxDistance, 96);
    disc.rotateX(-Math.PI / 2);
    disc.translate(cx, 0.012, cz);
    addMesh(disc, t.circleColor, t.circleOpacity, 1);
    addMesh(ring(cx, cz, t.maxDistance, t.circleLineWidth, 0.03), t.circleColor, Math.min(1, t.circleOpacity + 0.65), 2);
    if (t.ringStep > 0.5) {
      for (let r = t.ringStep; r < t.maxDistance - 0.01; r += t.ringStep) {
        addMesh(ring(cx, cz, r, t.circleLineWidth * 0.5, 0.025), t.circleColor, Math.min(1, t.circleOpacity + 0.3), 2);
      }
    }
  }

  if (t.showCone) {
    const rIn = Math.max(0, Math.min(t.coneMinRange, t.coneRange - 0.2));
    const fan = fanGeometry(cx, cz, rIn, t.coneRange, heading, t.coneHalfAngle, 0.02);
    addMesh(fan, t.coneColor, t.coneOpacity, 3);

    const inner = sectorArc(cx, cz, rIn, heading, t.coneHalfAngle, 32);
    const outer = sectorArc(cx, cz, t.coneRange, heading, t.coneHalfAngle, 48);
    const outline = [...inner, ...outer.slice().reverse(), inner[0]];
    const ol = groundRibbon(outline, 0.04, t.circleLineWidth * 0.8);
    if (ol) addMesh(ol, t.coneColor, Math.min(1, t.coneOpacity + 0.7), 4);

    if (t.coneVolume) {
      const apex = new THREE.Vector3(cx, t.releaseHeight, cz);
      const arc = sectorArc(cx, cz, t.coneRange, heading, t.coneHalfAngle, 48);
      const pos: number[] = [];
      for (let i = 0; i < arc.length - 1; i++) {
        pos.push(apex.x, apex.y, apex.z, arc[i].x, 0.02, arc[i].z, arc[i + 1].x, 0.02, arc[i + 1].z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      addMesh(g, t.coneColor, t.coneVolumeOpacity, 3);
    }
  }

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
