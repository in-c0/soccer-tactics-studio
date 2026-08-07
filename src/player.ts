import * as THREE from 'three';
import type { KitStyle, PlayerState, PoseId } from './types';

const D = Math.PI / 180;

// --- pose library ----------------------------------------------------------
// Angles are degrees. Convention: `pitch` positive swings a limb forwards,
// `roll` positive abducts it away from the body, `elbow`/`knee` positive bend.

interface Limb {
  pitch?: number;
  roll?: number;
  bend?: number;
  twist?: number;
}
interface Pose {
  rootY?: number;
  rootPitch?: number;
  torsoPitch?: number;
  torsoTwist?: number;
  torsoRoll?: number;
  headPitch?: number;
  headTwist?: number;
  armL?: Limb;
  armR?: Limb;
  legL?: Limb;
  legR?: Limb;
}

export const POSE_LIBRARY: Record<PoseId, Pose> = {
  idle: {
    armL: { pitch: 2, roll: 6, bend: 8 },
    armR: { pitch: -2, roll: 6, bend: 8 },
    legL: { roll: 3, bend: 4 },
    legR: { roll: 3, bend: 4 },
  },
  ready: {
    torsoPitch: 12,
    armL: { pitch: 12, roll: 18, bend: 35 },
    armR: { pitch: 12, roll: 18, bend: 35 },
    legL: { pitch: -12, roll: 6, bend: 26 },
    legR: { pitch: -12, roll: 6, bend: 26 },
  },
  walking: {
    torsoPitch: 6,
    armL: { pitch: 22, bend: 20 },
    armR: { pitch: -22, bend: 20 },
    legL: { pitch: -14, bend: 10 },
    legR: { pitch: 16, bend: 22 },
  },
  running: {
    torsoPitch: 14,
    armL: { pitch: 45, roll: 8, bend: 75 },
    armR: { pitch: -40, roll: 8, bend: 60 },
    legL: { pitch: -28, bend: 55 },
    legR: { pitch: 34, bend: 14 },
  },
  sprinting: {
    torsoPitch: 24,
    rootY: 0.05,
    armL: { pitch: 65, roll: 6, bend: 85 },
    armR: { pitch: -55, roll: 6, bend: 70 },
    legL: { pitch: -42, bend: 92 },
    legR: { pitch: 48, bend: 10 },
  },
  throw_windup: {
    torsoPitch: -18,
    headPitch: -8,
    armL: { pitch: -140, roll: 14, bend: 55 },
    armR: { pitch: -140, roll: 14, bend: 55 },
    legL: { pitch: 18, roll: 8, bend: 14 },
    legR: { pitch: -16, roll: 8, bend: 18 },
  },
  throw_load: {
    torsoPitch: -30,
    headPitch: -14,
    armL: { pitch: -165, roll: 10, bend: 80 },
    armR: { pitch: -165, roll: 10, bend: 80 },
    legL: { pitch: 22, roll: 6, bend: 12 },
    legR: { pitch: -20, roll: 6, bend: 26 },
  },
  throw_release: {
    torsoPitch: 18,
    headPitch: -4,
    armL: { pitch: 155, roll: 8, bend: 12 },
    armR: { pitch: 155, roll: 8, bend: 12 },
    legL: { pitch: 16, bend: 10 },
    legR: { pitch: -14, bend: 20 },
  },
  throw_follow: {
    torsoPitch: 40,
    headPitch: 8,
    armL: { pitch: 105, roll: 6, bend: 6 },
    armR: { pitch: 105, roll: 6, bend: 6 },
    legL: { pitch: 10, bend: 14 },
    legR: { pitch: -8, bend: 26 },
  },
  kicking: {
    torsoPitch: -8,
    torsoTwist: -12,
    armL: { pitch: -30, roll: 35, bend: 15 },
    armR: { pitch: 35, roll: 45, bend: 20 },
    legL: { pitch: -12, bend: 20 },
    legR: { pitch: 60, bend: 8 },
  },
  jumping: {
    rootY: 0.45,
    torsoPitch: -4,
    armL: { pitch: 155, roll: 12, bend: 5 },
    armR: { pitch: 155, roll: 12, bend: 5 },
    legL: { pitch: -25, bend: 70 },
    legR: { pitch: -25, bend: 70 },
  },
  heading: {
    rootY: 0.35,
    torsoPitch: -16,
    headPitch: -22,
    armL: { pitch: -25, roll: 62, bend: 18 },
    armR: { pitch: -25, roll: 62, bend: 18 },
    legL: { pitch: -30, bend: 60 },
    legR: { pitch: -15, bend: 45 },
  },
  defending: {
    torsoPitch: 16,
    armL: { pitch: 5, roll: 65, bend: 12 },
    armR: { pitch: 5, roll: 65, bend: 12 },
    legL: { pitch: -14, roll: 10, bend: 32 },
    legR: { pitch: -14, roll: 10, bend: 32 },
  },
  pointing: {
    headPitch: -2,
    armL: { pitch: 4, roll: 8, bend: 10 },
    armR: { pitch: 88, roll: 6, bend: 2 },
    legL: { roll: 4, bend: 6 },
    legR: { roll: 4, bend: 6 },
  },
  celebrating: {
    rootY: 0.06,
    torsoPitch: -8,
    headPitch: -14,
    armL: { pitch: -20, roll: 70, bend: 8 },
    armR: { pitch: -20, roll: 70, bend: 8 },
    legL: { roll: 8, bend: 6 },
    legR: { roll: 8, bend: 6 },
  },
  gk_ready: {
    rootY: -0.05,
    torsoPitch: 20,
    armL: { pitch: 30, roll: 48, bend: 55 },
    armR: { pitch: 30, roll: 48, bend: 55 },
    legL: { pitch: -22, roll: 12, bend: 45 },
    legR: { pitch: -22, roll: 12, bend: 45 },
  },
  slide: {
    rootPitch: -58,
    rootY: -0.52,
    torsoPitch: 18,
    armL: { pitch: -55, roll: 40, bend: 20 },
    armR: { pitch: 25, roll: 45, bend: 25 },
    legL: { pitch: 74, bend: 6 },
    legR: { pitch: 10, bend: 78 },
  },
  down: {
    rootPitch: -86,
    rootY: -0.82,
    armL: { pitch: -45, roll: 45, bend: 25 },
    armR: { pitch: -45, roll: 45, bend: 25 },
    legL: { pitch: 6, bend: 12 },
    legR: { pitch: 6, bend: 12 },
  },
};

export const POSE_LABELS: Record<PoseId, string> = {
  idle: 'Idle',
  ready: 'Ready stance',
  walking: 'Walking',
  running: 'Running',
  sprinting: 'Sprinting',
  throw_windup: 'Throw — wind-up',
  throw_load: 'Throw — loaded',
  throw_release: 'Throw — release',
  throw_follow: 'Throw — follow through',
  kicking: 'Kicking',
  jumping: 'Jumping',
  heading: 'Heading',
  defending: 'Defending / blocking',
  pointing: 'Pointing',
  celebrating: 'Celebrating',
  gk_ready: 'Keeper set',
  slide: 'Slide tackle',
  down: 'On the ground',
};

// --- rig -------------------------------------------------------------------

function numberTexture(n: number, color: string, fg: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = fg;
  g.font = 'bold 86px Inter, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const HIP_Y = 0.94;
const THIGH = 0.45;
const SHIN = 0.44;
const TORSO = 0.55;
const UPPER_ARM = 0.29;
const FOREARM = 0.27;

/** Articulated stick-figure-with-volume player. One rig per player. */
export class PlayerRig {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private arms: Record<'L' | 'R', { shoulder: THREE.Group; elbow: THREE.Group; hand: THREE.Object3D }>;
  private legs: Record<'L' | 'R', { hip: THREE.Group; knee: THREE.Group }>;
  private mats: THREE.MeshStandardMaterial[] = [];
  private jerseyMat: THREE.MeshStandardMaterial;
  private shortsMat: THREE.MeshStandardMaterial;
  private socksMat: THREE.MeshStandardMaterial;
  private skinMat: THREE.MeshStandardMaterial;
  private numberMat: THREE.MeshStandardMaterial;
  private highlight: THREE.Mesh;
  private numberKey = '';

  constructor(playerId: string) {
    const mk = (color: string) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02 });
      this.mats.push(m);
      return m;
    };
    this.jerseyMat = mk('#ffffff');
    this.shortsMat = mk('#ffffff');
    this.socksMat = mk('#ffffff');
    this.skinMat = mk('#c68642');
    this.numberMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    this.mats.push(this.numberMat);

    const addMesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    this.group.add(this.body);
    this.body.position.y = HIP_Y;

    // ---- torso, head
    this.body.add(this.torso);
    addMesh(
      this.torso,
      new THREE.CapsuleGeometry(0.17, TORSO - 0.16, 4, 12).translate(0, TORSO / 2, 0).scale(1, 1, 0.72),
      this.jerseyMat
    );
    // shirt number, front and back
    for (const s of [1, -1]) {
      const plane = new THREE.PlaneGeometry(0.2, 0.2);
      plane.rotateY(s > 0 ? 0 : Math.PI);
      plane.translate(0, TORSO * 0.62, s * 0.128);
      addMesh(this.torso, plane, this.numberMat);
    }
    // shorts sit at the hips
    addMesh(
      this.body,
      new THREE.CapsuleGeometry(0.175, 0.14, 4, 12).translate(0, -0.03, 0).scale(1, 1, 0.78),
      this.shortsMat
    );

    this.torso.add(this.head);
    this.head.position.y = TORSO + 0.06;
    addMesh(this.head, new THREE.CylinderGeometry(0.055, 0.07, 0.09, 8).translate(0, -0.04, 0), this.skinMat);
    addMesh(this.head, new THREE.SphereGeometry(0.115, 16, 12).scale(0.92, 1.05, 1).translate(0, 0.1, 0), this.skinMat);

    // ---- arms
    const makeArm = (side: 'L' | 'R') => {
      const sign = side === 'L' ? 1 : -1;
      const shoulder = new THREE.Group();
      shoulder.position.set(sign * 0.2, TORSO - 0.06, 0);
      this.torso.add(shoulder);
      addMesh(
        shoulder,
        new THREE.CapsuleGeometry(0.055, UPPER_ARM - 0.06, 3, 8).translate(0, -UPPER_ARM / 2, 0),
        this.jerseyMat
      );
      const elbow = new THREE.Group();
      elbow.position.y = -UPPER_ARM;
      shoulder.add(elbow);
      addMesh(
        elbow,
        new THREE.CapsuleGeometry(0.045, FOREARM - 0.05, 3, 8).translate(0, -FOREARM / 2, 0),
        this.skinMat
      );
      const hand = new THREE.Object3D();
      hand.position.y = -FOREARM - 0.04;
      elbow.add(hand);
      addMesh(elbow, new THREE.SphereGeometry(0.055, 8, 6).translate(0, -FOREARM - 0.04, 0), this.skinMat);
      return { shoulder, elbow, hand };
    };
    this.arms = { L: makeArm('L'), R: makeArm('R') };

    // ---- legs
    const makeLeg = (side: 'L' | 'R') => {
      const sign = side === 'L' ? 1 : -1;
      const hip = new THREE.Group();
      hip.position.set(sign * 0.095, -0.02, 0);
      this.body.add(hip);
      addMesh(hip, new THREE.CapsuleGeometry(0.075, THIGH - 0.1, 3, 8).translate(0, -THIGH / 2, 0), this.shortsMat);
      const knee = new THREE.Group();
      knee.position.y = -THIGH;
      hip.add(knee);
      addMesh(knee, new THREE.CapsuleGeometry(0.06, SHIN - 0.09, 3, 8).translate(0, -SHIN / 2, 0), this.socksMat);
      addMesh(
        knee,
        new THREE.BoxGeometry(0.09, 0.06, 0.22).translate(0, -SHIN - 0.02, 0.05),
        new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.6 })
      );
      return { hip, knee };
    };
    this.legs = { L: makeLeg('L'), R: makeLeg('R') };

    // ---- ground highlight
    this.highlight = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.6, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.85, depthWrite: false })
    );
    this.highlight.position.y = 0.02;
    this.highlight.renderOrder = 2;
    this.group.add(this.highlight);

    // ---- invisible pick proxy (thin limbs are hard to click)
    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 1.9, 8).translate(0, 0.95, 0),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 })
    );
    proxy.userData.playerId = playerId;
    proxy.renderOrder = -1;
    this.group.add(proxy);
    this.group.userData.playerId = playerId;
  }

  /** World position midway between the hands — where a held ball sits. */
  handsWorld(target: THREE.Vector3): THREE.Vector3 {
    const a = this.arms.L.hand.getWorldPosition(new THREE.Vector3());
    const b = this.arms.R.hand.getWorldPosition(new THREE.Vector3());
    return target.copy(a).add(b).multiplyScalar(0.5);
  }

  headWorld(target: THREE.Vector3): THREE.Vector3 {
    return this.head.getWorldPosition(target);
  }

  /** Hidden while the camera sits behind this player's eyes. */
  setHeadVisible(v: boolean): void {
    this.head.visible = v;
  }

  update(p: PlayerState, kit: KitStyle, mapColorForNumber: string): void {
    this.group.position.set(p.x, 0, p.z);
    // heading 0 = +x; the rig's forward is local +z
    this.group.rotation.y = Math.PI / 2 - p.heading * D;
    const s = p.height / 1.87;
    this.group.scale.setScalar(s);
    this.group.visible = p.visible;

    this.jerseyMat.color.set(kit.jersey);
    this.shortsMat.color.set(kit.shorts);
    this.socksMat.color.set(kit.socks);
    this.skinMat.color.set(kit.skin);

    const key = `${p.number}|${kit.jersey}|${kit.numberColor}`;
    if (key !== this.numberKey) {
      this.numberMat.map?.dispose();
      this.numberMat.map = numberTexture(p.number, kit.jersey, kit.numberColor);
      this.numberMat.needsUpdate = true;
      this.numberKey = key;
    }

    const op = THREE.MathUtils.clamp(p.opacity, 0, 1);
    for (const m of this.mats) {
      m.opacity = op;
      m.transparent = op < 1;
      m.depthWrite = op > 0.98;
    }

    this.highlight.visible = p.highlight;
    (this.highlight.material as THREE.MeshBasicMaterial).color.set(p.highlightColor);
    (this.highlight.material as THREE.MeshBasicMaterial).opacity = 0.9 * op;

    this.applyPose(POSE_LIBRARY[p.pose] ?? POSE_LIBRARY.idle, p.mirror);
    void mapColorForNumber;
  }

  private applyPose(pose: Pose, mirror: boolean): void {
    const armL = (mirror ? pose.armR : pose.armL) ?? {};
    const armR = (mirror ? pose.armL : pose.armR) ?? {};
    const legL = (mirror ? pose.legR : pose.legL) ?? {};
    const legR = (mirror ? pose.legL : pose.legR) ?? {};
    const flip = mirror ? -1 : 1;

    this.body.position.y = HIP_Y + (pose.rootY ?? 0);
    this.body.rotation.x = -(pose.rootPitch ?? 0) * D;

    this.torso.rotation.set(-(pose.torsoPitch ?? 0) * D, (pose.torsoTwist ?? 0) * D * flip, (pose.torsoRoll ?? 0) * D * flip);
    this.head.rotation.set(-(pose.headPitch ?? 0) * D, (pose.headTwist ?? 0) * D * flip, 0);

    const setLimb = (
      root: THREE.Group,
      joint: THREE.Group,
      limb: Limb,
      sideSign: number,
      bendSign: number
    ) => {
      root.rotation.set(
        -(limb.pitch ?? 0) * D,
        (limb.twist ?? 0) * D * sideSign,
        (limb.roll ?? 0) * D * sideSign
      );
      joint.rotation.x = bendSign * (limb.bend ?? 0) * D;
    };
    // left limbs sit at +x, so a positive roll (abduction) is +z rotation
    setLimb(this.arms.L.shoulder, this.arms.L.elbow, armL, 1, -1);
    setLimb(this.arms.R.shoulder, this.arms.R.elbow, armR, -1, -1);
    setLimb(this.legs.L.hip, this.legs.L.knee, legL, 1, 1);
    setLimb(this.legs.R.hip, this.legs.R.knee, legR, -1, 1);
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    for (const m of this.mats) {
      m.map?.dispose();
      m.dispose();
    }
  }
}
