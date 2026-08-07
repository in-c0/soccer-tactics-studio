import * as THREE from 'three';
import type { Scenario, TextOverlay } from './types';

export function applyTextStyle(el: HTMLElement, t: TextOverlay): void {
  el.style.font = `${t.fontWeight} ${t.fontSize}px/${t.lineHeight} ${t.fontFamily}`;
  el.style.color = t.color;
  el.style.textAlign = t.align;
  el.style.letterSpacing = `${t.letterSpacing}px`;
  el.style.opacity = String(t.opacity);
  el.style.padding = t.bg ? `${t.bgPadY}px ${t.bgPadX}px` : '0';
  el.style.background = t.bg ? t.bgColor : 'transparent';
  el.style.borderRadius = `${t.bgRadius}px`;
  el.style.border = t.border ? `${t.borderWidth}px solid ${t.borderColor}` : 'none';
  el.style.textShadow = t.shadow ? `${t.shadowX}px ${t.shadowY}px ${t.shadowBlur}px ${t.shadowColor}` : 'none';
  el.style.boxShadow =
    t.shadow && t.bg ? `${t.shadowX}px ${t.shadowY}px ${t.shadowBlur}px ${t.shadowColor}` : 'none';
  el.style.display = t.visible ? 'block' : 'none';
  el.style.whiteSpace = 'pre';
}

export class TextLayer {
  readonly root: HTMLDivElement;
  private svg: SVGSVGElement;
  private els = new Map<string, HTMLDivElement>();
  private leaders = new Map<string, SVGLineElement>();

  constructor(parent: HTMLElement, private onSelect: (id: string) => void, private onDrag: (id: string, ev: PointerEvent) => void) {
    this.root = document.createElement('div');
    this.root.className = 'text-layer';
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'leader-svg');
    this.root.appendChild(this.svg);
    parent.appendChild(this.root);
  }

  element(id: string): HTMLDivElement | undefined {
    return this.els.get(id);
  }

  sync(s: Scenario, camera: THREE.PerspectiveCamera, selectedId: string | null): void {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    const seen = new Set<string>();

    for (const t of s.texts) {
      seen.add(t.id);
      let el = this.els.get(t.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'text-overlay';
        el.addEventListener('pointerdown', (ev) => {
          ev.stopPropagation();
          this.onSelect(t.id);
          this.onDrag(t.id, ev);
        });
        this.root.appendChild(el);
        this.els.set(t.id, el);
      }
      if (el.textContent !== t.text) el.textContent = t.text;
      applyTextStyle(el, t);
      el.classList.toggle('selected', selectedId === t.id);

      let left: number;
      let top: number;
      if (t.anchor === 'screen') {
        left = t.sx * w;
        top = t.sy * h;
        el.style.transform = 'none';
      } else {
        const p = new THREE.Vector3(t.wx, t.wy, t.wz).project(camera);
        const behind = p.z > 1;
        left = ((p.x + 1) / 2) * w;
        top = ((1 - p.y) / 2) * h;
        el.style.transform = 'translate(-50%, -100%)';
        el.style.visibility = behind ? 'hidden' : 'visible';
      }
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;

      // leader line down to the pitch
      let line = this.leaders.get(t.id);
      const wantLeader = t.anchor === 'world' && t.leader && t.visible;
      if (wantLeader && !line) {
        line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        this.svg.appendChild(line);
        this.leaders.set(t.id, line);
      }
      if (line) {
        if (!wantLeader) {
          line.setAttribute('stroke', 'transparent');
        } else {
          const ground = new THREE.Vector3(t.wx, 0, t.wz).project(camera);
          line.setAttribute('x1', String(left));
          line.setAttribute('y1', String(top));
          line.setAttribute('x2', String(((ground.x + 1) / 2) * w));
          line.setAttribute('y2', String(((1 - ground.y) / 2) * h));
          line.setAttribute('stroke', t.color);
          line.setAttribute('stroke-width', '2');
          line.setAttribute('stroke-dasharray', '5 4');
          line.setAttribute('opacity', String(t.opacity));
        }
      }
    }

    for (const [id, el] of [...this.els]) {
      if (!seen.has(id)) {
        el.remove();
        this.els.delete(id);
        this.leaders.get(id)?.remove();
        this.leaders.delete(id);
      }
    }
  }
}
