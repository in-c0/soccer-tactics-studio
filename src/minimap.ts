import * as THREE from 'three';
import { sample2D, type P2 } from './annotations';
import { coneHeadingOf, sectorArc } from './range';
import type { Scenario } from './types';

const MARGIN = 3; // metres of surround drawn around the pitch
const D = Math.PI / 180;

export class Minimap {
  readonly canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private cssW = 0;
  private cssH = 0;
  private ppm = 1;

  constructor(parent: HTMLElement) {
    this.canvas.className = 'minimap';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  private totals(s: Scenario) {
    return { tw: s.pitch.length + MARGIN * 2, th: s.pitch.width + MARGIN * 2 };
  }

  layout(s: Scenario): void {
    const m = s.minimap;
    const { tw, th } = this.totals(s);
    const swap = m.rotate === 90 || m.rotate === 270;
    this.cssW = m.width;
    this.cssH = swap ? (m.width * tw) / th : (m.width * th) / tw;
    this.ppm = swap ? this.cssW / th : this.cssW / tw;

    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.canvas.style.display = m.visible ? 'block' : 'none';
    this.canvas.style.opacity = String(m.opacity);
    const pad = 14;
    this.canvas.style.top = m.corner === 'tl' || m.corner === 'tr' ? `${pad}px` : 'auto';
    this.canvas.style.bottom = m.corner === 'bl' || m.corner === 'br' ? `${pad}px` : 'auto';
    this.canvas.style.left = m.corner === 'tl' || m.corner === 'bl' ? `${pad}px` : 'auto';
    this.canvas.style.right = m.corner === 'tr' || m.corner === 'br' ? `${pad}px` : 'auto';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** pitch metres -> canvas CSS pixels */
  project(s: Scenario, x: number, z: number): [number, number] {
    const { tw, th } = this.totals(s);
    const u = (x + tw / 2) / tw;
    const v = (z + th / 2) / th;
    switch (s.minimap.rotate) {
      case 90:
        return [(1 - v) * this.cssW, u * this.cssH];
      case 180:
        return [(1 - u) * this.cssW, (1 - v) * this.cssH];
      case 270:
        return [v * this.cssW, (1 - u) * this.cssH];
      default:
        return [u * this.cssW, v * this.cssH];
    }
  }

  /** canvas CSS pixels -> pitch metres */
  unproject(s: Scenario, px: number, py: number): P2 {
    const { tw, th } = this.totals(s);
    let u: number;
    let v: number;
    switch (s.minimap.rotate) {
      case 90:
        v = 1 - px / this.cssW;
        u = py / this.cssH;
        break;
      case 180:
        u = 1 - px / this.cssW;
        v = 1 - py / this.cssH;
        break;
      case 270:
        v = px / this.cssW;
        u = 1 - py / this.cssH;
        break;
      default:
        u = px / this.cssW;
        v = py / this.cssH;
    }
    return { x: u * tw - tw / 2, z: v * th - th / 2 };
  }

  /** Pointer event -> pitch coordinates, or null when outside the map. */
  pointerToPitch(s: Scenario, ev: { clientX: number; clientY: number }): P2 | null {
    if (!s.minimap.visible) return null;
    const r = this.canvas.getBoundingClientRect();
    const px = ev.clientX - r.left;
    const py = ev.clientY - r.top;
    if (px < 0 || py < 0 || px > r.width || py > r.height) return null;
    return this.unproject(s, px, py);
  }

  metresToPx(m: number): number {
    return m * this.ppm;
  }

  mapAngle(s: Scenario, heading: number): number {
    return (heading + s.minimap.rotate) * D;
  }

  draw(s: Scenario, camera: THREE.PerspectiveCamera, draft: P2[], selectedId: string | null): void {
    const m = s.minimap;
    const g = this.ctx;
    g.clearRect(0, 0, this.cssW, this.cssH);
    if (!m.visible) return;

    g.globalAlpha = m.bgOpacity;
    g.fillStyle = m.grassColor;
    g.fillRect(0, 0, this.cssW, this.cssH);
    g.globalAlpha = 1;

    const P = (x: number, z: number) => this.project(s, x, z);
    const L = s.pitch.length / 2;
    const W = s.pitch.width / 2;

    // --- markings
    g.strokeStyle = m.lineColor;
    g.lineWidth = Math.max(1, this.metresToPx(0.16));
    g.globalAlpha = 0.85;
    const poly = (pts: [number, number][], close = false) => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      if (close) g.closePath();
      g.stroke();
    };
    const box = (x0: number, z0: number, x1: number, z1: number) =>
      poly([P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1)], true);

    box(-L, -W, L, W);
    poly([P(0, -W), P(0, W)]);
    const c0 = P(0, 0);
    g.beginPath();
    g.arc(c0[0], c0[1], this.metresToPx(9.15), 0, Math.PI * 2);
    g.stroke();
    for (const sgn of [-1, 1]) {
      box(sgn * L, -20.16, sgn * L - sgn * 16.5, 20.16);
      box(sgn * L, -9.16, sgn * L - sgn * 5.5, 9.16);
      const goal = P(sgn * L, 0);
      g.fillStyle = m.lineColor;
      g.beginPath();
      g.arc(goal[0], goal[1], Math.max(1.5, this.metresToPx(0.4)), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // --- throw range
    const thrower = s.throwerId ? s.players.find((p) => p.id === s.throwerId) ?? null : null;
    if (m.showRange && thrower) {
      const t = s.throwSettings;
      if (t.showCircle) {
        const c = P(thrower.x, thrower.z);
        g.fillStyle = t.circleColor;
        g.globalAlpha = t.circleOpacity;
        g.beginPath();
        g.arc(c[0], c[1], this.metresToPx(t.maxDistance), 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = Math.min(1, t.circleOpacity + 0.65);
        g.strokeStyle = t.circleColor;
        g.lineWidth = Math.max(1, this.metresToPx(t.circleLineWidth));
        g.stroke();
        if (t.ringStep > 0.5) {
          g.globalAlpha = Math.min(1, t.circleOpacity + 0.3);
          g.lineWidth = Math.max(0.5, this.metresToPx(t.circleLineWidth * 0.5));
          for (let r = t.ringStep; r < t.maxDistance - 0.01; r += t.ringStep) {
            g.beginPath();
            g.arc(c[0], c[1], this.metresToPx(r), 0, Math.PI * 2);
            g.stroke();
          }
        }
      }
      if (t.showCone) {
        const heading = coneHeadingOf(t, thrower);
        const rIn = Math.max(0, Math.min(t.coneMinRange, t.coneRange - 0.2));
        const outer = sectorArc(thrower.x, thrower.z, t.coneRange, heading, t.coneHalfAngle, 48);
        const inner = sectorArc(thrower.x, thrower.z, rIn, heading, t.coneHalfAngle, 32).reverse();
        const ring = [...outer, ...inner].map((p) => P(p.x, p.z));
        g.globalAlpha = t.coneOpacity;
        g.fillStyle = t.coneColor;
        g.beginPath();
        ring.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
        g.closePath();
        g.fill();
        g.globalAlpha = Math.min(1, t.coneOpacity + 0.7);
        g.strokeStyle = t.coneColor;
        g.lineWidth = Math.max(1, this.metresToPx(t.circleLineWidth * 0.8));
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // --- annotations
    if (m.showAnnotations) {
      for (const a of s.annotations) {
        if (!a.visible || !a.showOnMap) continue;
        const pts = sample2D(a).map((p) => P(p.x, p.z));
        if (pts.length < 2) continue;
        g.globalAlpha = a.style.opacity;
        g.strokeStyle = a.style.color;
        g.fillStyle = a.style.color;
        g.lineWidth = Math.max(1, this.metresToPx(a.style.width));
        g.lineJoin = 'round';
        g.lineCap = a.style.dashed ? 'butt' : 'round';
        g.setLineDash(
          a.style.dashed ? [this.metresToPx(a.style.dashLength), this.metresToPx(a.style.gapLength)] : []
        );
        g.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
        if (a.kind === 'zone') {
          g.closePath();
          g.globalAlpha = a.style.opacity * 0.28;
          g.fill();
          g.globalAlpha = a.style.opacity;
        }
        g.stroke();
        g.setLineDash([]);
        if (a.kind !== 'zone' && (a.style.head === 'end' || a.style.head === 'both')) {
          this.arrowHead(pts[pts.length - 2], pts[pts.length - 1], a.style.width * a.style.headSize);
        }
        if (a.kind !== 'zone' && a.style.head === 'both') {
          this.arrowHead(pts[1], pts[0], a.style.width * a.style.headSize);
        }
        if (a.id === selectedId) {
          g.globalAlpha = 1;
          g.setLineDash([4, 4]);
          g.strokeStyle = '#ffffff';
          g.lineWidth = 1;
          g.stroke();
          g.setLineDash([]);
        }
        g.globalAlpha = 1;
      }
    }

    // --- players
    const r = Math.max(4, this.metresToPx(m.markerSize));
    for (const p of s.players) {
      if (!p.visible) continue;
      const team = s.teams[p.team];
      const [x, y] = P(p.x, p.z);
      g.globalAlpha = Math.max(0.25, p.opacity);

      if (m.showHeading) {
        const a = this.mapAngle(s, p.heading);
        g.fillStyle = team.mapColor;
        g.globalAlpha = Math.max(0.2, p.opacity) * 0.55;
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, r * 2.6, a - 0.42, a + 0.42);
        g.closePath();
        g.fill();
        g.globalAlpha = Math.max(0.25, p.opacity);
      }

      if (p.highlight) {
        g.strokeStyle = p.highlightColor;
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(x, y, r + 4, 0, Math.PI * 2);
        g.stroke();
      }

      g.fillStyle = team.mapColor;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = p.id === selectedId ? 2.5 : 1.2;
      g.strokeStyle = p.id === selectedId ? '#ffffff' : '#00000066';
      g.stroke();

      if (s.throwerId === p.id) {
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, r + 2.5, 0, Math.PI * 2);
        g.stroke();
      }

      if (m.showNumbers) {
        g.fillStyle = team.mapTextColor;
        g.font = `700 ${Math.round(r * 1.25)}px Inter, system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(p.number), x, y + 0.5);
      }
      if (m.showNames) {
        g.fillStyle = '#ffffff';
        g.font = `600 ${Math.round(r * 1.05)}px Inter, system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'top';
        g.fillText(p.name, x, y + r + 3);
      }
      g.globalAlpha = 1;
    }

    // --- ball
    if (m.showBall && s.ball.visible) {
      let bx = s.ball.x;
      let bz = s.ball.z;
      if (s.ball.heldByThrower && thrower) {
        bx = thrower.x;
        bz = thrower.z;
      }
      const [x, y] = P(bx, bz);
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#111111';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, Math.max(2.5, r * 0.45), 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }

    // --- camera frustum
    if (m.showCamera) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const heading = (Math.atan2(dir.z, dir.x) * 180) / Math.PI;
      const half = (camera.fov * camera.aspect) / 2;
      const [cx, cy] = P(camera.position.x, camera.position.z);
      const a = this.mapAngle(s, heading);
      const len = this.metresToPx(18);
      g.fillStyle = '#ffffff22';
      g.strokeStyle = '#ffffffaa';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, len, a - half * D, a + half * D);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx, cy, 3, 0, Math.PI * 2);
      g.fill();
    }

    // --- in-progress drawing
    if (draft.length) {
      const pts = draft.map((p) => P(p.x, p.z));
      g.strokeStyle = '#ffd23f';
      g.setLineDash([5, 4]);
      g.lineWidth = 2;
      g.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#ffd23f';
      for (const [x, y] of pts) {
        g.beginPath();
        g.arc(x, y, 3.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  private arrowHead(from: [number, number], to: [number, number], widthM: number): void {
    const g = this.ctx;
    const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
    const len = Math.max(7, this.metresToPx(widthM * 3.2));
    const spread = 0.42;
    g.beginPath();
    g.moveTo(to[0], to[1]);
    g.lineTo(to[0] - Math.cos(a - spread) * len, to[1] - Math.sin(a - spread) * len);
    g.lineTo(to[0] - Math.cos(a + spread) * len, to[1] - Math.sin(a + spread) * len);
    g.closePath();
    g.fill();
  }

  /** Hit test in pitch coordinates; returns the closest player within the marker. */
  hitPlayer(s: Scenario, pt: P2): string | null {
    const rM = s.minimap.markerSize * 1.4;
    let best: string | null = null;
    let bestD = rM;
    for (const p of s.players) {
      if (!p.visible) continue;
      const d = Math.hypot(p.x - pt.x, p.z - pt.z);
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    return best;
  }
}
