import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Annotation } from './types';

export interface P2 {
  x: number;
  z: number;
}

const SEGMENTS = 72;

function quad(p0: P2, p1: P2, bend: number, t: number): P2 {
  const mx = (p0.x + p1.x) / 2;
  const mz = (p0.z + p1.z) / 2;
  const dx = p1.x - p0.x;
  const dz = p1.z - p0.z;
  const len = Math.hypot(dx, dz) || 1;
  // control point pushed perpendicular to the chord
  const cx = mx + (-dz / len) * bend * 2;
  const cz = mz + (dx / len) * bend * 2;
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * cx + t * t * p1.x,
    z: u * u * p0.z + 2 * u * t * cz + t * t * p1.z,
  };
}

/** Ground-plane samples of an annotation, in pitch coordinates. */
export function sample2D(a: Annotation, segments = SEGMENTS): P2[] {
  const pts = a.points;
  if (pts.length < 2) return pts.slice();
  if (a.kind === 'zone') return pts.slice();
  if (pts.length === 2) {
    const out: P2[] = [];
    for (let i = 0; i <= segments; i++) out.push(quad(pts[0], pts[1], a.bend, i / segments));
    return out;
  }
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p.x, 0, p.z)),
    false,
    'catmullrom',
    0.3
  );
  return curve.getPoints(segments).map((v) => ({ x: v.x, z: v.z }));
}

/** Full 3D polyline for an annotation (adds the arc parabola / elevation). */
export function sample3D(a: Annotation, segments = SEGMENTS): THREE.Vector3[] {
  const flat = sample2D(a, segments);
  const n = flat.length - 1 || 1;
  return flat.map((p, i) => {
    const t = i / n;
    let y = a.style.elevation;
    if (a.kind === 'arc') {
      y = a.startHeight + (a.endHeight - a.startHeight) * t + 4 * a.apex * t * (1 - t);
    }
    return new THREE.Vector3(p.x, y, p.z);
  });
}

function polylineLength(pts: THREE.Vector3[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += pts[i].distanceTo(pts[i - 1]);
  return l;
}

/** Cut a polyline into dash sub-polylines. */
function dashSegments(pts: THREE.Vector3[], dash: number, gap: number): THREE.Vector3[][] {
  const out: THREE.Vector3[][] = [];
  const period = Math.max(0.05, dash + gap);
  let travelled = 0;
  let current: THREE.Vector3[] = [];
  const isOn = (d: number) => d % period < dash;

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const segLen = a.distanceTo(b);
    if (segLen < 1e-6) continue;
    const steps = Math.max(1, Math.ceil(segLen / 0.12));
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const mid = travelled + segLen * ((t0 + t1) / 2);
      const p0 = a.clone().lerp(b, t0);
      const p1 = a.clone().lerp(b, t1);
      if (isOn(mid)) {
        if (current.length === 0) current.push(p0);
        current.push(p1);
      } else if (current.length > 1) {
        out.push(current);
        current = [];
      } else {
        current = [];
      }
    }
    travelled += segLen;
  }
  if (current.length > 1) out.push(current);
  return out;
}

function tube(pts: THREE.Vector3[], radius: number): THREE.BufferGeometry | null {
  const clean: THREE.Vector3[] = [];
  for (const p of pts) {
    if (clean.length === 0 || clean[clean.length - 1].distanceTo(p) > 1e-4) clean.push(p);
  }
  if (clean.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(clean, false, 'catmullrom', 0.2);
  const segs = Math.max(2, Math.min(160, Math.round(polylineLength(clean) * 3)));
  return new THREE.TubeGeometry(curve, segs, radius, 7, false);
}

function head(at: THREE.Vector3, dir: THREE.Vector3, radius: number, scale: number): THREE.BufferGeometry {
  const r = radius * 2.6 * scale;
  const h = radius * 6.5 * scale;
  const geo = new THREE.ConeGeometry(r, h, 14);
  geo.translate(0, -h / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  geo.applyQuaternion(q);
  geo.translate(at.x, at.y, at.z);
  return geo;
}

/** Filled polygon for a `zone` annotation. */
function zoneFill(a: Annotation): THREE.BufferGeometry | null {
  if (a.points.length < 3) return null;
  const shape = new THREE.Shape(a.points.map((p) => new THREE.Vector2(p.x, p.z)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2);
  geo.scale(1, 1, -1);
  geo.translate(0, a.style.elevation, 0);
  return geo;
}

export interface AnnotationObject {
  group: THREE.Group;
  dispose(): void;
}

export function buildAnnotation3D(a: Annotation): AnnotationObject {
  const group = new THREE.Group();
  group.userData.annotationId = a.id;
  const st = a.style;
  const radius = Math.max(0.02, st.width / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: st.color,
    transparent: true,
    opacity: st.opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const geoms: THREE.BufferGeometry[] = [];

  if (a.kind === 'zone') {
    const fill = zoneFill(a);
    if (fill) {
      const fillMat = new THREE.MeshBasicMaterial({
        color: st.color,
        transparent: true,
        opacity: st.opacity * 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const m = new THREE.Mesh(fill, fillMat);
      m.renderOrder = 3;
      group.add(m);
    }
    const closed = a.points.map((p) => new THREE.Vector3(p.x, st.elevation + 0.01, p.z));
    if (closed.length > 2) closed.push(closed[0].clone());
    const outline = st.dashed ? dashSegments(closed, st.dashLength, st.gapLength) : [closed];
    for (const seg of outline) {
      const t = tube(seg, radius);
      if (t) geoms.push(t);
    }
  } else {
    const pts = sample3D(a);
    if (pts.length >= 2) {
      const segs = st.dashed ? dashSegments(pts, st.dashLength, st.gapLength) : [pts];
      for (const seg of segs) {
        const t = tube(seg, radius);
        if (t) geoms.push(t);
      }
      if (st.head === 'end' || st.head === 'both') {
        const end = pts[pts.length - 1];
        const dir = end.clone().sub(pts[pts.length - 2]);
        geoms.push(head(end, dir, radius, st.headSize));
      }
      if (st.head === 'both') {
        const start = pts[0];
        const dir = start.clone().sub(pts[1]);
        geoms.push(head(start, dir, radius, st.headSize));
      }
    }
  }

  if (geoms.length) {
    const merged = mergeGeometries(geoms, false);
    for (const g of geoms) g.dispose();
    if (merged) {
      const mesh = new THREE.Mesh(merged, mat);
      mesh.renderOrder = 4;
      group.add(mesh);
    }
  }

  return {
    group,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (m.material as THREE.Material).dispose();
      });
    },
  };
}

export function annotationSignature(a: Annotation): string {
  return JSON.stringify(a);
}
