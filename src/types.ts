// ---------------------------------------------------------------------------
// Domain model. Everything the app draws is derived from a single `Scenario`
// object, expressed in real-world pitch coordinates (metres).
//
//   x : along the pitch length,  -52.5 (home goal) .. +52.5 (away goal)
//   z : across the pitch width,  -34   (near touchline) .. +34 (far touchline)
//   y : up
//
// Headings are degrees, 0 = facing +x (towards the away goal), increasing
// towards +z. The minimap draws +x right and +z down, so 0 = "right".
// ---------------------------------------------------------------------------

export type TeamId = 'home' | 'away';

export const POSES = [
  'idle',
  'ready',
  'walking',
  'running',
  'sprinting',
  'throw_windup',
  'throw_load',
  'throw_release',
  'throw_follow',
  'kicking',
  'jumping',
  'heading',
  'defending',
  'pointing',
  'celebrating',
  'gk_ready',
  'slide',
  'down',
] as const;
export type PoseId = (typeof POSES)[number];

export interface PlayerState {
  id: string;
  team: TeamId;
  number: number;
  name: string;
  x: number;
  z: number;
  /** degrees, 0 = +x */
  heading: number;
  pose: PoseId;
  /** mirror the pose left/right */
  mirror: boolean;
  /** 0..1 */
  opacity: number;
  /** body height in metres */
  height: number;
  visible: boolean;
  /** overrides the team kit for this single player (e.g. keeper) */
  kitOverride: KitStyle | null;
  /** draw a highlight disc under this player */
  highlight: boolean;
  highlightColor: string;
}

export interface KitStyle {
  jersey: string;
  shorts: string;
  socks: string;
  skin: string;
  numberColor: string;
}

export interface TeamStyle extends KitStyle {
  name: string;
  /** colour used for this team's markers on the minimap */
  mapColor: string;
  mapTextColor: string;
}

export interface BallState {
  x: number;
  y: number;
  z: number;
  visible: boolean;
  /** snap the ball into the thrower's hands */
  heldByThrower: boolean;
  scale: number;
  color: string;
  accentColor: string;
}

export interface ArrowStyle {
  color: string;
  /** stroke width in metres */
  width: number;
  opacity: number;
  dashed: boolean;
  /** metres */
  dashLength: number;
  gapLength: number;
  /** arrow head scale multiplier */
  headSize: number;
  head: 'end' | 'both' | 'none';
  /** height above the ground for flat annotations */
  elevation: number;
}

export type AnnotationKind = 'path' | 'arc' | 'kick' | 'zone';

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  label: string;
  /** polyline / control points in pitch coordinates */
  points: { x: number; z: number }[];
  /** apex height of a throw arc, metres */
  apex: number;
  /** arc endpoints height, metres (release height -> landing height) */
  startHeight: number;
  endHeight: number;
  /** lateral bend applied at the midpoint, metres (path & kick) */
  bend: number;
  style: ArrowStyle;
  visible: boolean;
  showIn3D: boolean;
  showOnMap: boolean;
}

export interface ThrowSettings {
  /** show the max-distance circle */
  showCircle: boolean;
  /** max legal/realistic throw distance, metres */
  maxDistance: number;
  circleColor: string;
  circleOpacity: number;
  circleLineWidth: number;
  /** concentric distance rings every N metres, 0 = off */
  ringStep: number;

  /** show the target sector */
  showCone: boolean;
  /** half angle of the sector, degrees */
  coneHalfAngle: number;
  /** sector radius, metres (defaults to maxDistance via the UI) */
  coneRange: number;
  /** inner cutoff, metres — makes a donut sector */
  coneMinRange: number;
  /** sector direction, degrees. Follows the thrower's heading when `coneFollowsThrower` */
  coneHeading: number;
  coneFollowsThrower: boolean;
  coneColor: string;
  coneOpacity: number;
  /** also draw the 3D volume from the release point down to the sector */
  coneVolume: boolean;
  coneVolumeOpacity: number;
  /** ball release height, metres — also the FPV eye anchor */
  releaseHeight: number;
  showOnMap: boolean;
}

export interface TextOverlay {
  id: string;
  text: string;
  anchor: 'screen' | 'world';
  /** fractions of the viewport, 0..1 */
  sx: number;
  sy: number;
  /** world anchor, metres */
  wx: number;
  wy: number;
  wz: number;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  opacity: number;
  visible: boolean;
  letterSpacing: number;
  lineHeight: number;
  bg: boolean;
  bgColor: string;
  bgPadX: number;
  bgPadY: number;
  bgRadius: number;
  border: boolean;
  borderColor: string;
  borderWidth: number;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
  /** leader line from the label to its world anchor */
  leader: boolean;
}

export interface CameraState {
  mode: 'orbit' | 'fpv';
  pos: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
  /** first-person settings, relative to the thrower */
  fpv: {
    /** degrees, absolute world yaw; 0 = +x */
    yaw: number;
    /** degrees, positive looks up */
    pitch: number;
    /** eye height above the ground, metres */
    eyeHeight: number;
    /** offsets from the thrower, in the thrower's local frame */
    forward: number;
    lateral: number;
    fov: number;
    /** keep yaw locked to the thrower's heading */
    followHeading: boolean;
    /** draw the thrower's own body in first person */
    showSelf: boolean;
  };
}

export interface MinimapState {
  visible: boolean;
  corner: 'tl' | 'tr' | 'bl' | 'br';
  /** width in CSS pixels */
  width: number;
  opacity: number;
  bgOpacity: number;
  /** 0 = pitch drawn horizontally, 90 = rotated */
  rotate: 0 | 90 | 180 | 270;
  showNumbers: boolean;
  showNames: boolean;
  showHeading: boolean;
  showBall: boolean;
  showAnnotations: boolean;
  showRange: boolean;
  showCamera: boolean;
  /** marker radius in metres */
  markerSize: number;
  grassColor: string;
  lineColor: string;
}

export interface PitchState {
  length: number;
  width: number;
  grassA: string;
  grassB: string;
  stripes: number;
  lineColor: string;
  lineOpacity: number;
  showLines: boolean;
  showGoals: boolean;
  showStands: boolean;
  skyTop: string;
  skyBottom: string;
  sunAzimuth: number;
  sunElevation: number;
  shadows: boolean;
  ambient: number;
}

export interface Scenario {
  version: 1;
  name: string;
  notes: string;
  pitch: PitchState;
  teams: Record<TeamId, TeamStyle>;
  players: PlayerState[];
  ball: BallState;
  throwerId: string | null;
  throwSettings: ThrowSettings;
  annotations: Annotation[];
  texts: TextOverlay[];
  camera: CameraState;
  minimap: MinimapState;
}

export type SelectionType = 'player' | 'annotation' | 'text' | 'ball';
export interface Selection {
  type: SelectionType;
  id: string;
}

export type ToolMode =
  | 'select'
  | 'draw-path'
  | 'draw-arc'
  | 'draw-kick'
  | 'draw-zone'
  | 'place-text';
