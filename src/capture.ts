import type { Scenario, TextOverlay } from './types';

// --- PNG compositing -------------------------------------------------------

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function drawOverlay(
  g: CanvasRenderingContext2D,
  t: TextOverlay,
  rect: { x: number; y: number; w: number; h: number },
  k: number
): void {
  const pad = { x: t.bg ? t.bgPadX : 0, y: t.bg ? t.bgPadY : 0 };
  const border = t.border ? t.borderWidth : 0;
  g.save();
  g.globalAlpha = t.opacity;

  if (t.shadow) {
    g.shadowColor = t.shadowColor;
    g.shadowBlur = t.shadowBlur * k;
    g.shadowOffsetX = t.shadowX * k;
    g.shadowOffsetY = t.shadowY * k;
  }
  if (t.bg) {
    g.fillStyle = t.bgColor;
    roundRect(g, rect.x, rect.y, rect.w, rect.h, t.bgRadius * k);
    g.fill();
  }
  if (border) {
    g.strokeStyle = t.borderColor;
    g.lineWidth = border * k;
    roundRect(g, rect.x + (border * k) / 2, rect.y + (border * k) / 2, rect.w - border * k, rect.h - border * k, t.bgRadius * k);
    g.stroke();
  }
  if (!t.bg && !border) {
    // keep the text shadow, drop the box shadow
  } else {
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
    if (t.shadow) {
      g.shadowColor = t.shadowColor;
      g.shadowBlur = t.shadowBlur * k * 0.6;
      g.shadowOffsetX = t.shadowX * k;
      g.shadowOffsetY = t.shadowY * k;
    }
  }

  g.fillStyle = t.color;
  g.font = `${t.fontWeight} ${t.fontSize * k}px ${t.fontFamily}`;
  g.textBaseline = 'alphabetic';
  const anyG = g as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in g) anyG.letterSpacing = `${t.letterSpacing * k}px`;

  const lines = t.text.split('\n');
  const lineH = t.fontSize * t.lineHeight * k;
  const innerX = rect.x + border * k + pad.x * k;
  const innerW = rect.w - (border * k + pad.x * k) * 2;
  const top = rect.y + border * k + pad.y * k;
  g.textAlign = t.align === 'center' ? 'center' : t.align === 'right' ? 'right' : 'left';
  const tx = t.align === 'center' ? innerX + innerW / 2 : t.align === 'right' ? innerX + innerW : innerX;
  lines.forEach((line, i) => {
    const baseline = top + i * lineH + (lineH - t.fontSize * k) / 2 + t.fontSize * k * 0.79;
    g.fillText(line, tx, baseline);
  });
  if ('letterSpacing' in g) anyG.letterSpacing = '0px';
  g.restore();
}

export interface CaptureSources {
  viewport: HTMLElement;
  webgl: HTMLCanvasElement;
  minimap: HTMLCanvasElement;
  texts: () => { overlay: TextOverlay; el: HTMLElement }[];
}

/** Composite the WebGL canvas, minimap and text overlays into one PNG. */
export function composite(src: CaptureSources, scale = 1): HTMLCanvasElement {
  const vp = src.viewport.getBoundingClientRect();
  const k = (src.webgl.width / Math.max(1, vp.width)) * scale;
  const out = document.createElement('canvas');
  out.width = Math.round(vp.width * k);
  out.height = Math.round(vp.height * k);
  const g = out.getContext('2d')!;
  g.imageSmoothingQuality = 'high';

  g.drawImage(src.webgl, 0, 0, out.width, out.height);

  if (src.minimap.style.display !== 'none' && src.minimap.width > 0) {
    const r = src.minimap.getBoundingClientRect();
    g.globalAlpha = Number(src.minimap.style.opacity || '1');
    g.drawImage(src.minimap, (r.left - vp.left) * k, (r.top - vp.top) * k, r.width * k, r.height * k);
    g.globalAlpha = 1;
  }

  for (const { overlay, el } of src.texts()) {
    if (!overlay.visible) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || el.style.visibility === 'hidden') continue;
    drawOverlay(g, overlay, { x: (r.left - vp.left) * k, y: (r.top - vp.top) * k, w: r.width * k, h: r.height * k }, k);
  }

  return out;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'situation'
  );
}

// --- scenario files --------------------------------------------------------

export function downloadScenario(s: Scenario): void {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${slug(s.name)}.stsx.json`);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function pickScenarioFile(): Promise<Scenario | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      try {
        const parsed = JSON.parse(await f.text()) as Scenario;
        resolve(parsed);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

// --- saved situations (localStorage) ---------------------------------------

const KEY = 'sts.situations.v1';

export interface SavedSituation {
  id: string;
  name: string;
  savedAt: number;
  thumb: string;
  scenario: Scenario;
}

export function listSituations(): SavedSituation[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as SavedSituation[]).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function writeSituations(list: SavedSituation[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // quota — drop the oldest and retry once
    const trimmed = list.slice(0, Math.max(1, list.length - 4));
    try {
      localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      /* give up silently */
    }
  }
}

export function saveSituation(s: Scenario, thumbCanvas: HTMLCanvasElement | null): SavedSituation {
  const thumb = thumbCanvas ? downscale(thumbCanvas, 320).toDataURL('image/jpeg', 0.7) : '';
  const entry: SavedSituation = {
    id: `sit_${Date.now().toString(36)}`,
    name: s.name || 'Untitled situation',
    savedAt: Date.now(),
    thumb,
    scenario: JSON.parse(JSON.stringify(s)),
  };
  const list = listSituations();
  list.unshift(entry);
  writeSituations(list.slice(0, 40));
  return entry;
}

export function deleteSituation(id: string): void {
  writeSituations(listSituations().filter((s) => s.id !== id));
}

function downscale(canvas: HTMLCanvasElement, width: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = width;
  out.height = Math.round((canvas.height / canvas.width) * width);
  out.getContext('2d')!.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}
