import type {
  Annotation,
  AnnotationKind,
  ArrowStyle,
  PlayerState,
  Scenario,
  Selection,
  TeamId,
  TextOverlay,
  ToolMode,
} from './types';

let idCounter = 0;
export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export const PITCH_LENGTH = 105;
export const PITCH_WIDTH = 68;

// --- defaults --------------------------------------------------------------

export function defaultArrowStyle(kind: AnnotationKind): ArrowStyle {
  const base: ArrowStyle = {
    color: '#ffd23f',
    width: 0.35,
    opacity: 0.95,
    dashed: false,
    dashLength: 1.6,
    gapLength: 0.9,
    headSize: 1,
    head: 'end',
    elevation: 0.06,
  };
  if (kind === 'arc') return { ...base, color: '#4fc3f7', width: 0.22, dashed: true, dashLength: 1.2, gapLength: 0.7 };
  if (kind === 'kick') return { ...base, color: '#ff5252', width: 0.4, headSize: 1.3 };
  if (kind === 'zone') return { ...base, color: '#8bc34a', width: 0.25, opacity: 0.6, head: 'none', dashed: true };
  return base;
}

function makeTeam(name: string, jersey: string, shorts: string, socks: string, mapColor: string, numberColor: string) {
  return {
    name,
    jersey,
    shorts,
    socks,
    skin: '#c68642',
    numberColor,
    mapColor,
    mapTextColor: numberColor,
  };
}

/** A 4-4-2-ish shape squeezed towards a right-side throw-in near the halfway line. */
function throwInPlayers(): PlayerState[] {
  const spec: [TeamId, number, string, number, number, number][] = [
    // team, number, name, x, z, heading
    ['home', 10, 'Thrower', 8, 33.4, 200],
    ['home', 7, 'Winger', 14, 26, 175],
    ['home', 9, 'Striker', 22, 18, 160],
    ['home', 8, 'Mid', 2, 24, 20],
    ['home', 6, 'Pivot', -4, 12, 25],
    ['home', 4, 'Back', -6, 30, 10],
    ['away', 2, 'RB', 12, 27.5, 350],
    ['away', 5, 'CB', 19, 16, 340],
    ['away', 6, 'DM', 4, 20, 355],
    ['away', 8, 'CM', 0, 28, 5],
    ['away', 3, 'LB', 24, 8, 330],
  ];
  return spec.map(([team, number, name, x, z, heading], i) => ({
    id: `p${i}`,
    team,
    number,
    name,
    x,
    z,
    heading,
    pose: i === 0 ? ('throw_windup' as const) : team === 'home' ? ('running' as const) : ('defending' as const),
    mirror: false,
    opacity: 1,
    height: 1.82,
    visible: true,
    kitOverride: null,
    highlight: i === 0,
    highlightColor: '#ffd23f',
  }));
}

export function defaultScenario(): Scenario {
  const players = throwInPlayers();
  return {
    version: 1,
    name: 'Right-side throw-in, halfway line',
    notes: 'Toggle poses, arrows and the throw cone to talk through the options.',
    pitch: {
      length: PITCH_LENGTH,
      width: PITCH_WIDTH,
      grassA: '#2f7d3a',
      grassB: '#2a7134',
      stripes: 12,
      lineColor: '#ffffff',
      lineOpacity: 0.85,
      showLines: true,
      showGoals: true,
      showStands: true,
      skyTop: '#0d1b2a',
      skyBottom: '#3d5a80',
      sunAzimuth: 135,
      sunElevation: 52,
      shadows: true,
      ambient: 0.75,
    },
    teams: {
      home: makeTeam('Home', '#e63946', '#ffffff', '#e63946', '#ff4d5a', '#ffffff'),
      away: makeTeam('Away', '#1d3557', '#1d3557', '#ffffff', '#4d8fe0', '#ffffff'),
    },
    players,
    ball: {
      x: 8.4,
      y: 2.25,
      z: 33.9,
      visible: true,
      heldByThrower: true,
      scale: 1,
      color: '#ffffff',
      accentColor: '#161616',
    },
    throwerId: players[0].id,
    throwSettings: {
      showCircle: true,
      maxDistance: 24,
      circleColor: '#ffd23f',
      circleOpacity: 0.1,
      circleLineWidth: 0.18,
      ringStep: 8,
      showCone: true,
      coneHalfAngle: 38,
      coneRange: 24,
      coneMinRange: 4,
      coneHeading: 200,
      coneFollowsThrower: true,
      coneColor: '#4fc3f7',
      coneOpacity: 0.22,
      coneVolume: false,
      coneVolumeOpacity: 0.1,
      releaseHeight: 2.35,
      showOnMap: true,
    },
    annotations: [
      {
        id: uid('an'),
        kind: 'arc',
        label: 'Long throw to the striker',
        points: [
          { x: 8.4, z: 33.9 },
          { x: 21, z: 18.5 },
        ],
        apex: 6.5,
        startHeight: 2.35,
        endHeight: 1.9,
        bend: 0,
        style: defaultArrowStyle('arc'),
        visible: true,
        showIn3D: true,
        showOnMap: true,
      },
      {
        id: uid('an'),
        kind: 'path',
        label: '#9 run to the near post',
        points: [
          { x: 22, z: 18 },
          { x: 28, z: 12 },
          { x: 34, z: 6 },
        ],
        apex: 0,
        startHeight: 0,
        endHeight: 0,
        bend: 0,
        style: { ...defaultArrowStyle('path'), color: '#ffffff', dashed: true },
        visible: true,
        showIn3D: true,
        showOnMap: true,
      },
    ],
    texts: [
      {
        id: uid('tx'),
        text: 'Option A — long throw\ninto the channel',
        anchor: 'screen',
        sx: 0.04,
        sy: 0.06,
        wx: 0,
        wy: 2,
        wz: 0,
        fontSize: 26,
        fontWeight: 700,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#ffffff',
        align: 'left',
        opacity: 1,
        visible: true,
        letterSpacing: 0,
        lineHeight: 1.25,
        bg: true,
        bgColor: '#000000b3',
        bgPadX: 16,
        bgPadY: 10,
        bgRadius: 8,
        border: true,
        borderColor: '#ffd23f',
        borderWidth: 2,
        shadow: true,
        shadowColor: '#000000cc',
        shadowBlur: 12,
        shadowX: 0,
        shadowY: 3,
        leader: false,
      },
    ],
    camera: {
      mode: 'orbit',
      pos: { x: -6, y: 22, z: 60 },
      target: { x: 12, y: 1.2, z: 22 },
      fov: 48,
      fpv: {
        yaw: 200,
        pitch: -6,
        eyeHeight: 1.72,
        forward: 0.2,
        lateral: 0,
        fov: 72,
        followHeading: true,
        showSelf: true,
      },
    },
    minimap: {
      visible: true,
      corner: 'br',
      width: 360,
      opacity: 0.95,
      bgOpacity: 0.85,
      rotate: 0,
      showNumbers: true,
      showNames: false,
      showHeading: true,
      showBall: true,
      showAnnotations: true,
      showRange: true,
      showCamera: true,
      markerSize: 1.5,
      grassColor: '#12351c',
      lineColor: '#e8f5ec',
    },
  };
}

// --- store -----------------------------------------------------------------

export type ChangeKind = 'render' | 'ui';
type Listener = (kind: ChangeKind) => void;

/**
 * Deliberately tiny: mutate `store.state` directly, then call `touch()`.
 * `'render'` only redraws the scene/minimap (safe while dragging a slider);
 * `'ui'` additionally rebuilds the control panel.
 */
class Store {
  state: Scenario = defaultScenario();
  selection: Selection | null = null;
  mode: ToolMode = 'select';
  /** points collected for the annotation currently being drawn */
  draft: { x: number; z: number }[] = [];
  private listeners: Listener[] = [];

  subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  touch(kind: ChangeKind = 'render'): void {
    for (const l of this.listeners) l(kind);
  }

  select(sel: Selection | null): void {
    this.selection = sel;
    this.touch('ui');
  }

  setMode(mode: ToolMode): void {
    this.mode = mode;
    this.draft = [];
    this.touch('ui');
  }

  replace(scenario: Scenario): void {
    this.state = scenario;
    this.selection = null;
    this.draft = [];
    this.touch('ui');
  }

  get thrower(): PlayerState | null {
    const id = this.state.throwerId;
    if (!id) return null;
    return this.state.players.find((p) => p.id === id) ?? null;
  }

  player(id: string): PlayerState | undefined {
    return this.state.players.find((p) => p.id === id);
  }

  annotation(id: string): Annotation | undefined {
    return this.state.annotations.find((a) => a.id === id);
  }

  text(id: string): TextOverlay | undefined {
    return this.state.texts.find((t) => t.id === id);
  }
}

export const store = new Store();

// --- helpers ---------------------------------------------------------------

export function addPlayer(team: TeamId): PlayerState {
  const s = store.state;
  const used = s.players.filter((p) => p.team === team).map((p) => p.number);
  let number = 2;
  while (used.includes(number)) number += 1;
  const p: PlayerState = {
    id: uid('p'),
    team,
    number,
    name: `${s.teams[team].name} ${number}`,
    x: team === 'home' ? -10 : 10,
    z: 0,
    heading: team === 'home' ? 0 : 180,
    pose: 'idle',
    mirror: false,
    opacity: 1,
    height: 1.8,
    visible: true,
    kitOverride: null,
    highlight: false,
    highlightColor: '#ffd23f',
  };
  s.players.push(p);
  return p;
}

export function newAnnotation(kind: AnnotationKind, points: { x: number; z: number }[]): Annotation {
  return {
    id: uid('an'),
    kind,
    label:
      kind === 'arc' ? 'Throw arc' : kind === 'kick' ? 'Kick direction' : kind === 'zone' ? 'Zone' : 'Run',
    points,
    apex: kind === 'arc' ? 6 : 0,
    startHeight: kind === 'arc' ? 2.35 : 0,
    endHeight: kind === 'arc' ? 1.6 : 0,
    bend: 0,
    style: defaultArrowStyle(kind),
    visible: true,
    showIn3D: true,
    showOnMap: true,
  };
}

export function newText(partial: Partial<TextOverlay> = {}): TextOverlay {
  return {
    id: uid('tx'),
    text: 'New label',
    anchor: 'screen',
    sx: 0.5,
    sy: 0.5,
    wx: 0,
    wy: 2,
    wz: 0,
    fontSize: 22,
    fontWeight: 700,
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#ffffff',
    align: 'left',
    opacity: 1,
    visible: true,
    letterSpacing: 0,
    lineHeight: 1.25,
    bg: true,
    bgColor: '#000000b3',
    bgPadX: 14,
    bgPadY: 8,
    bgRadius: 8,
    border: false,
    borderColor: '#ffd23f',
    borderWidth: 2,
    shadow: true,
    shadowColor: '#000000cc',
    shadowBlur: 10,
    shadowX: 0,
    shadowY: 2,
    leader: false,
    ...partial,
  };
}
