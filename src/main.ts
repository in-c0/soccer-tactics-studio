import './styles.css';
import * as THREE from 'three';

import { buildAnnotation3D, type AnnotationObject } from './annotations';
import { Ball } from './ball';
import { CameraRig } from './camera';
import {
  composite,
  deleteSituation,
  type CaptureSources,
  downloadCanvas,
  downloadScenario,
  listSituations,
  pickScenarioFile,
  saveSituation,
  slug,
} from './capture';
import { Minimap } from './minimap';
import { TextLayer } from './overlays';
import { Panel } from './panel';
import { buildPitch, pitchSignature, skyTexture } from './pitch';
import { PlayerRig } from './player';
import { buildRange, type RangeObject } from './range';
import { defaultScenario, newAnnotation, newText, store } from './state';
import type { Annotation, KitStyle, Scenario, TextOverlay, ToolMode } from './types';

const D = Math.PI / 180;

// ---------------------------------------------------------------- renderer
const viewport = document.getElementById('viewport') as HTMLElement;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const app = document.getElementById('app') as HTMLElement;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const cameraRig = new CameraRig(canvas);

const hemi = new THREE.HemisphereLight('#cfe6ff', '#2d4a2f', 0.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff6e0', 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 320;
const shadowCam = sun.shadow.camera as THREE.OrthographicCamera;
shadowCam.left = -70;
shadowCam.right = 70;
shadowCam.top = 50;
shadowCam.bottom = -50;
shadowCam.updateProjectionMatrix();
scene.add(sun);
scene.add(sun.target);

const world = new THREE.Group();
scene.add(world);
const handleGroup = new THREE.Group();
scene.add(handleGroup);

const ball = new Ball();
world.add(ball.group);

// ------------------------------------------------------------------ scene sync
let pitchGroup: THREE.Group | null = null;
let pitchSig = '';
let skySig = '';
const rigs = new Map<string, PlayerRig>();
const annObjs = new Map<string, { obj: AnnotationObject; sig: string }>();
let rangeObj: RangeObject | null = null;
let rangeSig = '';
const handles: THREE.Mesh[] = [];

function kitFor(s: Scenario, playerId: string): KitStyle {
  const p = s.players.find((q) => q.id === playerId)!;
  return p.kitOverride ?? s.teams[p.team];
}

function syncScene(): void {
  const s = store.state;

  // pitch + sky + lighting
  const psig = pitchSignature(s.pitch);
  if (psig !== pitchSig) {
    if (pitchGroup) {
      pitchGroup.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      world.remove(pitchGroup);
    }
    pitchGroup = buildPitch(s.pitch);
    world.add(pitchGroup);
    pitchSig = psig;
  }
  const ssig = `${s.pitch.skyTop}|${s.pitch.skyBottom}`;
  if (ssig !== skySig) {
    (scene.background as THREE.Texture | null)?.dispose?.();
    scene.background = skyTexture(s.pitch);
    scene.fog = new THREE.Fog(new THREE.Color(s.pitch.skyBottom).getHex(), 220, 620);
    skySig = ssig;
  }
  hemi.intensity = s.pitch.ambient;
  sun.intensity = 0.4 + s.pitch.ambient * 1.1;
  const az = s.pitch.sunAzimuth * D;
  const el = s.pitch.sunElevation * D;
  sun.position.set(Math.cos(az) * Math.cos(el) * 90, Math.sin(el) * 90, Math.sin(az) * Math.cos(el) * 90);
  sun.castShadow = s.pitch.shadows;
  renderer.shadowMap.enabled = s.pitch.shadows;

  // players
  const alive = new Set<string>();
  for (const p of s.players) {
    alive.add(p.id);
    let rig = rigs.get(p.id);
    if (!rig) {
      rig = new PlayerRig(p.id);
      rigs.set(p.id, rig);
      world.add(rig.group);
    }
    rig.update(p, kitFor(s, p.id), s.teams[p.team].mapColor);
    rig.setHeadVisible(true);
  }
  for (const [id, rig] of [...rigs]) {
    if (!alive.has(id)) {
      world.remove(rig.group);
      rig.dispose();
      rigs.delete(id);
    }
  }
  // the camera sits at the thrower's eyes, so their own head is always hidden;
  // the rest of the body is optional
  if (s.camera.mode === 'fpv' && s.throwerId) {
    const r = rigs.get(s.throwerId);
    if (r) {
      r.setHeadVisible(false);
      if (!s.camera.fpv.showSelf) r.group.visible = false;
    }
  }

  // ball — follows the thrower's hands when held
  const throwerRig = s.throwerId ? rigs.get(s.throwerId) : undefined;
  const hands = throwerRig ? throwerRig.handsWorld(new THREE.Vector3()) : null;
  ball.update(s.ball, hands);

  // annotations
  const liveAnn = new Set<string>();
  for (const a of s.annotations) {
    if (!a.visible || !a.showIn3D) continue;
    liveAnn.add(a.id);
    const sig = JSON.stringify(a);
    const existing = annObjs.get(a.id);
    if (existing && existing.sig === sig) continue;
    if (existing) {
      world.remove(existing.obj.group);
      existing.obj.dispose();
    }
    const obj = buildAnnotation3D(a);
    world.add(obj.group);
    annObjs.set(a.id, { obj, sig });
  }
  for (const [id, entry] of [...annObjs]) {
    if (!liveAnn.has(id)) {
      world.remove(entry.obj.group);
      entry.obj.dispose();
      annObjs.delete(id);
    }
  }

  // throw range
  const thrower = store.thrower;
  const rsig = JSON.stringify(s.throwSettings) + (thrower ? `${thrower.x},${thrower.z},${thrower.heading}` : 'none');
  if (rsig !== rangeSig) {
    if (rangeObj) {
      world.remove(rangeObj.group);
      rangeObj.dispose();
    }
    rangeObj = buildRange(s.throwSettings, thrower);
    world.add(rangeObj.group);
    rangeSig = rsig;
  }

  syncHandles();
}

/** Draggable spheres on the selected annotation's control points. */
function syncHandles(): void {
  for (const h of handles) {
    handleGroup.remove(h);
    h.geometry.dispose();
    (h.material as THREE.Material).dispose();
  }
  handles.length = 0;
  const sel = store.selection;
  if (!sel || sel.type !== 'annotation') return;
  const a = store.annotation(sel.id);
  if (!a || !a.visible || !a.showIn3D) return;
  a.points.forEach((pt, i) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 12),
      new THREE.MeshBasicMaterial({ color: i === 0 ? '#ffffff' : '#ffd23f', depthTest: false, toneMapped: false })
    );
    m.position.set(pt.x, a.kind === 'arc' ? (i === 0 ? a.startHeight : a.endHeight) : a.style.elevation + 0.35, pt.z);
    m.renderOrder = 999;
    m.userData = { handle: true, annotationId: a.id, index: i };
    handleGroup.add(m);
    handles.push(m);
  });
}

// ---------------------------------------------------------------- overlays
const minimap = new Minimap(viewport);
const textLayer = new TextLayer(
  viewport,
  (id) => store.select({ type: 'text', id }),
  (id, ev) => startTextDrag(id, ev)
);

const toast = document.createElement('div');
toast.className = 'toast';
viewport.appendChild(toast);
let toastTimer = 0;
function say(msg: string): void {
  toast.textContent = msg;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

// ------------------------------------------------------------------- panel
const panel = new Panel(app, {
  exportPNG(scale) {
    renderer.render(scene, cameraRig.camera);
    const out = composite(captureSources(), scale);
    downloadCanvas(out, `${slug(store.state.name)}.png`);
    say('PNG saved');
  },
  async copyPNG() {
    renderer.render(scene, cameraRig.camera);
    const out = composite(captureSources(), 1);
    try {
      const blob: Blob = await new Promise((res, rej) =>
        out.toBlob((b) => (b ? res(b) : rej(new Error('no blob'))), 'image/png')
      );
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      say('Frame copied to the clipboard');
    } catch {
      say('Clipboard blocked — use “Capture PNG” instead');
    }
  },
  saveSituation() {
    renderer.render(scene, cameraRig.camera);
    const thumb = composite(captureSources(), 1);
    saveSituation(store.state, thumb);
    store.touch('ui');
    say('Situation saved in this browser');
  },
  loadSituation(id) {
    const found = listSituations().find((s) => s.id === id);
    if (found) {
      store.replace(migrate(found.scenario));
      say(`Loaded “${found.name}”`);
    }
  },
  deleteSituation(id) {
    deleteSituation(id);
    store.touch('ui');
  },
  saveFile() {
    downloadScenario(store.state);
  },
  async loadFile() {
    const s = await pickScenarioFile();
    if (s) {
      store.replace(migrate(s));
      say('Situation imported');
    } else {
      say('Could not read that file');
    }
  },
  addText() {
    const t = newText({ sx: 0.06, sy: 0.14 });
    store.state.texts.push(t);
    store.select({ type: 'text', id: t.id });
  },
  frameOn(x, z) {
    const c = store.state.camera;
    c.mode = 'orbit';
    c.target = { x, y: 1.2, z };
    c.pos = { x: x - 14, y: 12, z: z + 20 };
    store.touch('ui');
  },
});

function captureSources(): CaptureSources {
  return {
    viewport,
    webgl: canvas,
    minimap: minimap.canvas,
    texts: () => {
      const out: { overlay: TextOverlay; el: HTMLElement }[] = [];
      for (const overlay of store.state.texts) {
        const el = textLayer.element(overlay.id);
        if (el) out.push({ overlay, el });
      }
      return out;
    },
  };
}

/** Fill in fields added after a scenario was saved. */
function migrate(s: Scenario): Scenario {
  const base = defaultScenario();
  const merged: Scenario = { ...base, ...s };
  merged.pitch = { ...base.pitch, ...s.pitch };
  merged.throwSettings = { ...base.throwSettings, ...s.throwSettings };
  merged.minimap = { ...base.minimap, ...s.minimap };
  merged.camera = { ...base.camera, ...s.camera, fpv: { ...base.camera.fpv, ...s.camera?.fpv } };
  merged.teams = {
    home: { ...base.teams.home, ...s.teams?.home },
    away: { ...base.teams.away, ...s.teams?.away },
  };
  merged.ball = { ...base.ball, ...s.ball };
  merged.annotations = (s.annotations ?? []).map((a) => ({
    ...a,
    startHeight: a.startHeight ?? 2.3,
    endHeight: a.endHeight ?? 0.5,
    bend: a.bend ?? 0,
  }));
  merged.texts = (s.texts ?? []).map((t) => ({ ...newText(), ...t }));
  return merged;
}

// ----------------------------------------------------------------- toolbar
const TOOLS: [ToolMode, string, string][] = [
  ['select', 'Select', 'Select, move and rotate players (drag; hold Shift to rotate)'],
  ['draw-path', 'Run', 'Draw a run / pathway arrow'],
  ['draw-arc', 'Throw arc', 'Draw the throw trajectory from the thrower'],
  ['draw-kick', 'Kick', 'Draw a kick-direction arrow from the ball'],
  ['draw-zone', 'Zone', 'Outline an area'],
  ['place-text', 'Pin text', 'Pin a text label to a spot on the pitch'],
];

const toolbar = document.createElement('div');
toolbar.className = 'toolbar';
viewport.appendChild(toolbar);

const hint = document.createElement('div');
hint.className = 'hint';
viewport.appendChild(hint);

function renderToolbar(): void {
  toolbar.replaceChildren();
  const brand = document.createElement('span');
  brand.className = 'brand';
  brand.textContent = '⚽ Tactics Studio';
  toolbar.append(brand);

  for (const [mode, label, title] of TOOLS) {
    const b = document.createElement('button');
    b.className = `tool${store.mode === mode ? ' active' : ''}`;
    b.textContent = label;
    b.title = title;
    b.onclick = () => setMode(mode);
    toolbar.append(b);
  }

  const sep = document.createElement('span');
  sep.className = 'sep';
  toolbar.append(sep);

  const fpv = document.createElement('button');
  fpv.className = `tool${store.state.camera.mode === 'fpv' ? ' active' : ''}`;
  fpv.textContent = '👁 First person';
  fpv.title = 'Look through the thrower’s eyes (F)';
  fpv.onclick = () => {
    store.state.camera.mode = store.state.camera.mode === 'fpv' ? 'orbit' : 'fpv';
    store.touch('ui');
  };
  toolbar.append(fpv);

  const mm = document.createElement('button');
  mm.className = `tool${store.state.minimap.visible ? ' active' : ''}`;
  mm.textContent = '🗺 Minimap';
  mm.title = 'Toggle the top-down overlay (M)';
  mm.onclick = () => {
    store.state.minimap.visible = !store.state.minimap.visible;
    store.touch('ui');
  };
  toolbar.append(mm);

  const cap = document.createElement('button');
  cap.className = 'tool';
  cap.textContent = '📸 Capture';
  cap.title = 'Save this frame as a PNG (Ctrl+E)';
  cap.onclick = () => panelActionsExport();
  toolbar.append(cap);
}

function panelActionsExport(): void {
  renderer.render(scene, cameraRig.camera);
  downloadCanvas(composite(captureSources(), 1), `${slug(store.state.name)}.png`);
  say('PNG saved');
}

function renderHint(): void {
  const drafting = store.draft.length;
  switch (store.mode) {
    case 'select':
      hint.innerHTML =
        'Drag a player to move · <b>Shift</b>+drag to turn them · click a marker on the minimap to grab it · <b>Del</b> removes the selection';
      break;
    case 'place-text':
      hint.innerHTML = 'Click a spot on the pitch or the minimap to pin a label there.';
      break;
    default:
      hint.innerHTML = `Click to add points (<b>${drafting}</b> so far) · <b>double-click</b> or <b>Enter</b> to finish · <b>Esc</b> cancels`;
  }
}

function setMode(mode: ToolMode): void {
  store.setMode(mode);
  if (mode === 'draw-arc') {
    const t = store.thrower;
    if (t) store.draft = [{ x: t.x, z: t.z }];
  }
  if (mode === 'draw-kick') {
    const b = store.state.ball;
    const t = store.thrower;
    const from = b.heldByThrower && t ? { x: t.x, z: t.z } : { x: b.x, z: b.z };
    store.draft = [from];
  }
  store.touch('ui');
}

// ------------------------------------------------------------- interaction
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function setNDC(ev: { clientX: number; clientY: number }): void {
  const r = canvas.getBoundingClientRect();
  pointerNDC.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
}

function groundAt(ev: { clientX: number; clientY: number }, height = 0): THREE.Vector3 | null {
  setNDC(ev);
  raycaster.setFromCamera(pointerNDC, cameraRig.camera);
  groundPlane.constant = -height;
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
}

type Pick =
  | { kind: 'handle'; annotationId: string; index: number }
  | { kind: 'player'; id: string }
  | { kind: 'ball' }
  | { kind: 'annotation'; id: string }
  | null;

function pick(ev: PointerEvent): Pick {
  setNDC(ev);
  raycaster.setFromCamera(pointerNDC, cameraRig.camera);

  const handleHits = raycaster.intersectObjects(handles, false);
  if (handleHits.length) {
    const u = handleHits[0].object.userData;
    return { kind: 'handle', annotationId: u.annotationId, index: u.index };
  }
  const hits = raycaster.intersectObjects(world.children, true);
  for (const hit of hits) {
    let o: THREE.Object3D | null = hit.object;
    while (o) {
      if (o.userData?.playerId) return { kind: 'player', id: o.userData.playerId as string };
      if (o.userData?.ball) return { kind: 'ball' };
      if (o.userData?.annotationId) return { kind: 'annotation', id: o.userData.annotationId as string };
      o = o.parent;
    }
  }
  return null;
}

interface DragState {
  kind: 'player' | 'ball' | 'handle';
  id: string;
  index?: number;
  offX: number;
  offZ: number;
  rotating: boolean;
  height: number;
}
let drag: DragState | null = null;
let lookDrag: { x: number; y: number } | null = null;
let downAt: { x: number; y: number } | null = null;
let movedFar = false;

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  downAt = { x: ev.clientX, y: ev.clientY };
  movedFar = false;

  if (store.state.camera.mode === 'fpv') {
    lookDrag = { x: ev.clientX, y: ev.clientY };
    return;
  }
  if (store.mode !== 'select') return;

  const hit = pick(ev);
  if (!hit) return;

  if (hit.kind === 'annotation') {
    store.select({ type: 'annotation', id: hit.id });
    return;
  }

  const g = groundAt(ev);
  if (!g) return;

  if (hit.kind === 'player') {
    const p = store.player(hit.id);
    if (!p) return;
    store.select({ type: 'player', id: p.id });
    drag = { kind: 'player', id: p.id, offX: p.x - g.x, offZ: p.z - g.z, rotating: ev.shiftKey, height: 0 };
  } else if (hit.kind === 'ball') {
    const b = store.state.ball;
    store.select({ type: 'ball', id: 'ball' });
    if (b.heldByThrower) return;
    const gh = groundAt(ev, b.y) ?? g;
    drag = { kind: 'ball', id: 'ball', offX: b.x - gh.x, offZ: b.z - gh.z, rotating: false, height: b.y };
  } else {
    const a = store.annotation(hit.annotationId);
    if (!a) return;
    drag = { kind: 'handle', id: hit.annotationId, index: hit.index, offX: 0, offZ: 0, rotating: false, height: 0 };
  }
  cameraRig.controls.enabled = false;
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener('pointermove', (ev) => {
  if (downAt && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 4) movedFar = true;

  if (lookDrag) {
    const c = store.state.camera;
    const dx = ev.clientX - lookDrag.x;
    const dy = ev.clientY - lookDrag.y;
    lookDrag = { x: ev.clientX, y: ev.clientY };
    const t = store.thrower;
    if (c.fpv.followHeading && t) t.heading = (t.heading + dx * 0.22 + 360) % 360;
    else c.fpv.yaw = (c.fpv.yaw + dx * 0.22 + 360) % 360;
    c.fpv.pitch = THREE.MathUtils.clamp(c.fpv.pitch - dy * 0.18, -80, 80);
    store.touch('render');
    return;
  }

  if (!drag) return;
  const g = groundAt(ev, drag.height);
  if (!g) return;

  if (drag.kind === 'player') {
    const p = store.player(drag.id);
    if (!p) return;
    if (ev.shiftKey || drag.rotating) {
      p.heading = (((Math.atan2(g.z - p.z, g.x - p.x) / D) % 360) + 360) % 360;
    } else {
      p.x = round1(g.x + drag.offX);
      p.z = round1(g.z + drag.offZ);
    }
  } else if (drag.kind === 'ball') {
    const b = store.state.ball;
    b.x = round1(g.x + drag.offX);
    b.z = round1(g.z + drag.offZ);
  } else {
    const a = store.annotation(drag.id);
    if (!a || drag.index === undefined) return;
    a.points[drag.index] = { x: round1(g.x), z: round1(g.z) };
  }
  store.touch('render');
});

function endPointer(ev: PointerEvent): void {
  const wasClick = !movedFar;
  if (drag || lookDrag) {
    drag = null;
    lookDrag = null;
    cameraRig.controls.enabled = store.state.camera.mode === 'orbit';
    try {
      canvas.releasePointerCapture(ev.pointerId);
    } catch {
      /* not captured */
    }
    if (!wasClick) {
      downAt = null;
      store.touch('ui');
      return;
    }
  }
  downAt = null;
  if (!wasClick) return;

  if (store.mode === 'select') {
    if (!pick(ev)) store.select(null);
    return;
  }
  const g = groundAt(ev);
  if (!g) return;
  handleWorldClick(g.x, g.z);
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('dblclick', () => finishDrawing());
canvas.addEventListener('contextmenu', (ev) => {
  if (store.mode !== 'select') {
    ev.preventDefault();
    finishDrawing();
  }
});

function handleWorldClick(x: number, z: number): void {
  if (store.mode === 'place-text') {
    const t = newText({ anchor: 'world', wx: round1(x), wy: 2.2, wz: round1(z), leader: true, text: 'Label' });
    store.state.texts.push(t);
    store.setMode('select');
    store.select({ type: 'text', id: t.id });
    return;
  }
  store.draft.push({ x: round1(x), z: round1(z) });
  const kind = draftKind();
  if ((kind === 'arc' || kind === 'kick') && store.draft.length >= 2) finishDrawing();
  else store.touch('ui');
}

function draftKind(): Annotation['kind'] | null {
  switch (store.mode) {
    case 'draw-path':
      return 'path';
    case 'draw-arc':
      return 'arc';
    case 'draw-kick':
      return 'kick';
    case 'draw-zone':
      return 'zone';
    default:
      return null;
  }
}

function finishDrawing(): void {
  const kind = draftKind();
  if (!kind) return;
  const min = kind === 'zone' ? 3 : 2;
  if (store.draft.length < min) {
    say(`Need at least ${min} points`);
    return;
  }
  const a = newAnnotation(kind, store.draft.slice());
  if (kind === 'arc') {
    a.startHeight = store.state.throwSettings.releaseHeight;
    a.endHeight = 1.4;
    const span = Math.hypot(a.points[1].x - a.points[0].x, a.points[1].z - a.points[0].z);
    a.apex = Math.max(2, Math.min(14, span * 0.28));
  }
  store.state.annotations.push(a);
  store.setMode('select');
  store.select({ type: 'annotation', id: a.id });
  say(`${a.label} added`);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// -------------------------------------------------------- minimap pointers
let mapDrag: { kind: 'player' | 'handle'; id: string; index?: number; offX: number; offZ: number } | null = null;

minimap.canvas.addEventListener('pointerdown', (ev) => {
  const s = store.state;
  const pt = minimap.pointerToPitch(s, ev);
  if (!pt) return;
  ev.stopPropagation();

  if (store.mode !== 'select') {
    handleWorldClick(pt.x, pt.z);
    return;
  }

  // annotation handles win over players when an annotation is selected
  const sel = store.selection;
  if (sel?.type === 'annotation') {
    const a = store.annotation(sel.id);
    if (a) {
      const idx = a.points.findIndex((p) => Math.hypot(p.x - pt.x, p.z - pt.z) < 1.6);
      if (idx >= 0) {
        mapDrag = { kind: 'handle', id: a.id, index: idx, offX: 0, offZ: 0 };
        minimap.canvas.setPointerCapture(ev.pointerId);
        return;
      }
    }
  }
  const id = minimap.hitPlayer(s, pt);
  if (id) {
    const p = store.player(id)!;
    store.select({ type: 'player', id });
    mapDrag = { kind: 'player', id, offX: p.x - pt.x, offZ: p.z - pt.z };
    minimap.canvas.setPointerCapture(ev.pointerId);
  } else {
    store.select(null);
  }
});

minimap.canvas.addEventListener('pointermove', (ev) => {
  if (!mapDrag) return;
  const pt = minimap.pointerToPitch(store.state, ev);
  if (!pt) return;
  if (mapDrag.kind === 'player') {
    const p = store.player(mapDrag.id);
    if (!p) return;
    if (ev.shiftKey) p.heading = (((Math.atan2(pt.z - p.z, pt.x - p.x) / D) % 360) + 360) % 360;
    else {
      p.x = round1(pt.x + mapDrag.offX);
      p.z = round1(pt.z + mapDrag.offZ);
    }
  } else {
    const a = store.annotation(mapDrag.id);
    if (a && mapDrag.index !== undefined) a.points[mapDrag.index] = { x: round1(pt.x), z: round1(pt.z) };
  }
  store.touch('render');
});

const endMapDrag = (ev: PointerEvent) => {
  if (!mapDrag) return;
  mapDrag = null;
  try {
    minimap.canvas.releasePointerCapture(ev.pointerId);
  } catch {
    /* not captured */
  }
  store.touch('ui');
};
minimap.canvas.addEventListener('pointerup', endMapDrag);
minimap.canvas.addEventListener('pointercancel', endMapDrag);

// --------------------------------------------------------- text overlay drag
function startTextDrag(id: string, ev: PointerEvent): void {
  const t = store.text(id);
  if (!t) return;
  const startX = ev.clientX;
  const startY = ev.clientY;
  const base = { sx: t.sx, sy: t.sy, wx: t.wx, wz: t.wz };
  const rect = viewport.getBoundingClientRect();

  const move = (m: PointerEvent) => {
    if (t.anchor === 'screen') {
      t.sx = THREE.MathUtils.clamp(base.sx + (m.clientX - startX) / rect.width, 0, 0.99);
      t.sy = THREE.MathUtils.clamp(base.sy + (m.clientY - startY) / rect.height, 0, 0.99);
    } else {
      const g = groundAt(m, t.wy);
      if (g) {
        t.wx = round1(g.x);
        t.wz = round1(g.z);
      }
    }
    store.touch('render');
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    store.touch('ui');
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  void base;
}

// --------------------------------------------------------------- shortcuts
window.addEventListener('keydown', (ev) => {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
    if (ev.key === 'Escape') (el as HTMLElement).blur();
    return;
  }
  const s = store.state;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'e') {
    ev.preventDefault();
    panelActionsExport();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
    ev.preventDefault();
    renderer.render(scene, cameraRig.camera);
    saveSituation(s, composite(captureSources(), 1));
    store.touch('ui');
    say('Situation saved');
    return;
  }
  switch (ev.key) {
    case 'Escape':
      if (store.draft.length || store.mode !== 'select') setMode('select');
      else store.select(null);
      break;
    case 'Enter':
      finishDrawing();
      break;
    case 'Delete':
    case 'Backspace': {
      const sel = store.selection;
      if (!sel) break;
      if (sel.type === 'player') {
        s.players = s.players.filter((p) => p.id !== sel.id);
        if (s.throwerId === sel.id) s.throwerId = s.players[0]?.id ?? null;
      } else if (sel.type === 'annotation') s.annotations = s.annotations.filter((a) => a.id !== sel.id);
      else if (sel.type === 'text') s.texts = s.texts.filter((t) => t.id !== sel.id);
      store.select(null);
      break;
    }
    case 'm':
    case 'M':
      s.minimap.visible = !s.minimap.visible;
      store.touch('ui');
      break;
    case 'f':
    case 'F':
      s.camera.mode = s.camera.mode === 'fpv' ? 'orbit' : 'fpv';
      store.touch('ui');
      break;
    case '1':
      setMode('select');
      break;
    case '2':
      setMode('draw-path');
      break;
    case '3':
      setMode('draw-arc');
      break;
    case '4':
      setMode('draw-kick');
      break;
    case '5':
      setMode('draw-zone');
      break;
    case '6':
      setMode('place-text');
      break;
  }
});

// ------------------------------------------------------------- render loop
let cameraDirty = true;

store.subscribe((kind) => {
  cameraDirty = true;
  syncScene();
  if (kind === 'ui') {
    panel.render();
    renderToolbar();
    renderHint();
  }
});

function resize(): void {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  cameraRig.resize(w, h);
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(viewport);

function frame(): void {
  requestAnimationFrame(frame);
  const s = store.state;
  const thrower = store.thrower;
  const rig = thrower ? rigs.get(thrower.id) : undefined;
  const head = rig ? rig.headWorld(new THREE.Vector3()) : null;

  if (s.camera.mode === 'fpv') {
    cameraRig.apply(s.camera, thrower, head);
  } else if (cameraDirty) {
    cameraRig.apply(s.camera, thrower, head);
    cameraDirty = false;
  } else {
    cameraRig.controls.update();
    cameraRig.writeBack(s.camera);
  }

  sun.target.position.set(0, 0, 0);
  sun.target.updateMatrixWorld();

  minimap.layout(s);
  minimap.draw(s, cameraRig.camera, store.draft, store.selection?.id ?? null);
  textLayer.sync(s, cameraRig.camera, store.selection?.type === 'text' ? store.selection.id : null);

  renderer.render(scene, cameraRig.camera);
}

// -------------------------------------------------------------------- boot
resize();
syncScene();
panel.render();
renderToolbar();
renderHint();
frame();

// keep the panel's camera sliders roughly in sync while orbiting
window.setInterval(() => {
  if (store.state.camera.mode === 'orbit' && !cameraDirty && !drag && !lookDrag) {
    cameraRig.writeBack(store.state.camera);
  }
}, 500);

/**
 * Small scripting hook: `window.STS.store.state` is the live scenario, and
 * `STS.touch()` re-renders after you change it. Handy for automation, embeds
 * and debugging from the console.
 */
(window as unknown as { STS: unknown }).STS = {
  store,
  scene,
  renderer,
  camera: cameraRig.camera,
  touch: (kind: 'render' | 'ui' = 'ui') => store.touch(kind),
  setMode,
  load: (s: Scenario) => store.replace(migrate(s)),
  capture: (scale = 1) => {
    renderer.render(scene, cameraRig.camera);
    return composite(captureSources(), scale).toDataURL('image/png');
  },
};
