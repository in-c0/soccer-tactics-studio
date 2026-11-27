import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraState, PlayerState } from './types';

const D = Math.PI / 180;

export interface CameraPreset {
  label: string;
  apply(cam: CameraState, thrower: PlayerState | null): void;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    label: 'Broadcast',
    apply(c) {
      c.mode = 'orbit';
      c.pos = { x: 0, y: 26, z: 62 };
      c.target = { x: 0, y: 0, z: 0 };
      c.fov = 42;
    },
  },
  {
    label: 'Top-down',
    apply(c) {
      c.mode = 'orbit';
      c.pos = { x: 0, y: 92, z: 0.01 };
      c.target = { x: 0, y: 0, z: 0 };
      c.fov = 48;
    },
  },
  {
    label: 'Behind goal',
    apply(c) {
      c.mode = 'orbit';
      c.pos = { x: 76, y: 16, z: 0 };
      c.target = { x: 20, y: 1, z: 0 };
      c.fov = 40;
    },
  },
  {
    label: 'Over the thrower',
    apply(c, t) {
      c.mode = 'orbit';
      const x = t?.x ?? 0;
      const z = t?.z ?? 0;
      const h = (t?.heading ?? 0) * D;
      c.pos = { x: x - Math.cos(h) * 12, y: 9, z: z - Math.sin(h) * 12 };
      c.target = { x: x + Math.cos(h) * 12, y: 1.5, z: z + Math.sin(h) * 12 };
      c.fov = 55;
    },
  },
  {
    label: 'Thrower first person',
    apply(c) {
      c.mode = 'fpv';
    },
  },
];

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  constructor(dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2000);
    this.camera.position.set(-6, 22, 60);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 400;
    this.controls.screenSpacePanning = false;
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Push the scenario's camera settings onto the actual three.js camera. */
  apply(c: CameraState, thrower: PlayerState | null, throwerHead: THREE.Vector3 | null): void {
    if (c.mode === 'fpv') {
      this.controls.enabled = false;
      const h = (thrower?.heading ?? 0) * D;
      const fx = Math.cos(h);
      const fz = Math.sin(h);
      const base = throwerHead ?? new THREE.Vector3(thrower?.x ?? 0, 0, thrower?.z ?? 0);
      const px = (thrower?.x ?? base.x) + fx * c.fpv.forward + -fz * c.fpv.lateral;
      const pz = (thrower?.z ?? base.z) + fz * c.fpv.forward + fx * c.fpv.lateral;
      this.camera.position.set(px, c.fpv.eyeHeight, pz);
      const yaw = (c.fpv.followHeading && thrower ? thrower.heading : c.fpv.yaw) * D;
      const pitch = c.fpv.pitch * D;
      const dir = new THREE.Vector3(
        Math.cos(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.sin(yaw) * Math.cos(pitch)
      );
      this.camera.lookAt(this.camera.position.clone().add(dir));
      if (this.camera.fov !== c.fpv.fov) {
        this.camera.fov = c.fpv.fov;
        this.camera.updateProjectionMatrix();
      }
    } else {
      this.controls.enabled = true;
      this.camera.position.set(c.pos.x, c.pos.y, c.pos.z);
      this.controls.target.set(c.target.x, c.target.y, c.target.z);
      this.controls.update();
      if (this.camera.fov !== c.fov) {
        this.camera.fov = c.fov;
        this.camera.updateProjectionMatrix();
      }
    }
  }

  /** Read the live orbit transform back into the scenario. */
  writeBack(c: CameraState): void {
    if (c.mode !== 'orbit') return;
    c.pos = { x: r3(this.camera.position.x), y: r3(this.camera.position.y), z: r3(this.camera.position.z) };
    c.target = {
      x: r3(this.controls.target.x),
      y: r3(this.controls.target.y),
      z: r3(this.controls.target.z),
    };
  }
}

function r3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
