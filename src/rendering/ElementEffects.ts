import * as THREE from 'three';
import type { ElementType } from '../core/arsenal';

export interface ElementEffectOptions {
  scale?: number;
  style?: 'impact' | 'status' | 'equipment';
  intensity?: number;
  /** Stable hardware/trail variation; does not consume game random state. */
  variant?: number;
}

type Kind = 'vapor' | 'gloop' | 'splat' | 'flame' | 'ember' | 'smoke' | 'arc' | 'spark' | 'crystal' | 'mote' | 'ribbon' | 'strand';
interface Pool { kind: Kind; mesh: THREE.InstancedMesh; alpha?: THREE.InstancedBufferAttribute; opacity: number }

const TAU = Math.PI * 2;
const noopRaycast = () => {};
let sharedSmokeTexture: THREE.Texture | undefined;

/** Immutable application-owned texture: instance disposal never releases it. */
export function getElementSmokeTexture(): THREE.Texture {
  if (sharedSmokeTexture) return sharedSmokeTexture;
  const size = 64, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const radius = Math.hypot(u, v);
    const lobes = 0.87 + Math.sin(u * 11 + v * 5) * 0.07 + Math.cos(v * 13 - u * 3) * 0.06;
    const alpha = Math.pow(Math.max(0, 1 - radius / lobes), 1.65);
    const i = (y * size + x) * 4;
    bytes[i] = bytes[i + 1] = bytes[i + 2] = 255; bytes[i + 3] = Math.round(alpha * 255);
  }
  // CanvasTexture in the game; DataTexture also supports headless geometry tests.
  const canvas = typeof document === 'undefined' ? undefined : document.createElement('canvas');
  const context = canvas?.getContext('2d');
  if (canvas && context && typeof context.createImageData === 'function' && typeof context.putImageData === 'function') {
    canvas.width = canvas.height = size;
    const pixels = context.createImageData(size, size); pixels.data.set(bytes); context.putImageData(pixels, 0, 0);
    sharedSmokeTexture = new THREE.CanvasTexture(canvas);
  } else sharedSmokeTexture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  sharedSmokeTexture.name = 'shared-procedural-element-vapor';
  sharedSmokeTexture.minFilter = sharedSmokeTexture.magFilter = THREE.LinearFilter;
  sharedSmokeTexture.generateMipmaps = false; sharedSmokeTexture.needsUpdate = true;
  return sharedSmokeTexture;
}

function vaporMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'ElementSoftVapor', transparent: true, depthTest: true, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
    uniforms: { tint: { value: new THREE.Color(color) }, smokeMap: { value: getElementSmokeTexture() } },
    vertexShader: /* glsl */ `
      attribute float particleAlpha;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        vUv = uv; vAlpha = particleAlpha;
        mat4 particleWorld = modelMatrix * instanceMatrix;
        vec3 center = particleWorld[3].xyz;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 world = center + right * position.x * length(particleWorld[0].xyz)
                            + up * position.y * length(particleWorld[1].xyz);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D smokeMap;
      uniform vec3 tint;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float a = texture2D(smokeMap, vUv).a * vAlpha;
        if (a < .003) discard;
        gl_FragColor = vec4(tint, a);
      }
    `,
  });
}

/** Distinct, fixed-size particle pools. +Y is up; status origin is the target's midbody. */
export class ElementEffects {
  readonly group = new THREE.Group();
  readonly particleCount: number;
  private readonly pools: Pool[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly direction = new THREE.Vector3();
  private readonly pointA = new THREE.Vector3();
  private readonly pointB = new THREE.Vector3();
  private readonly style: NonNullable<ElementEffectOptions['style']>;
  private readonly intensity: number;
  private readonly variant: number;
  private elapsed = 0;
  private disposed = false;

  constructor(parent: THREE.Object3D, readonly element: ElementType, options: ElementEffectOptions = {}) {
    this.style = options.style ?? 'status';
    this.intensity = THREE.MathUtils.clamp(Number.isFinite(options.intensity) ? options.intensity! : 1, 0, 2);
    this.variant = Number.isFinite(options.variant) ? Math.abs(Math.floor(options.variant!)) % 4 : 0;
    const scale = THREE.MathUtils.clamp(Number.isFinite(options.scale) ? options.scale! : 1, 0.01, 20);
    this.group.name = `element-${this.style}-${element}`;
    this.group.userData.comicOverlay = true;
    this.group.userData.element = element;
    this.group.userData.effectStyle = this.style;
    this.group.userData.visualVariant = this.variant;
    this.group.scale.setScalar(scale * (this.style === 'equipment' ? 0.12 : this.style === 'impact' ? 0.75 : 1));
    parent.add(this.group);
    const count = (n: number) => this.style === 'equipment' ? Math.max(2, Math.round(n * 0.36)) : n;
    const add = (kind: Kind, n: number, color: number, opacity = 1) => this.addPool(kind, count(n), color, opacity);
    switch (element) {
      case 'corrosive': add('vapor', 12, 0x8aff22, 0.91); add('gloop', 10, 0xb4ff29); add('splat', 6, 0x66e600); break;
      case 'fire': add('flame', 10, 0xff7818); add('ember', 10, 0xffd25d); add('smoke', 8, 0x76523e, 0.66); break;
      case 'shock': add('arc', 24, 0xa6eaff); add('spark', 8, 0x40baff); break;
      case 'ice': add('crystal', 14, 0xc5faff); add('vapor', 10, 0x73c6e9, 0.58); break;
      case 'radiation': add('mote', 18, 0xfaff58); add('vapor', 8, 0xaaca1d, 0.58); add('ribbon', 2, 0xe2ed37, 0.8); break;
      case 'gravity': add('ribbon', 3, 0xd28aff, 0.92); add('mote', 16, 0x9370ff); add('vapor', 6, 0x8a3ad5, 0.42); break;
      case 'adhesive': add('strand', 8, 0xffdc6c, 0.9); add('gloop', 12, 0xffad23); add('vapor', 4, 0xfabf51, 0.35); break;
      default: add('spark', 16, 0xffd89d); add('smoke', 4, 0xa59581, 0.45);
    }
    this.particleCount = this.pools.reduce((sum, pool) => sum + pool.mesh.count, 0);
    this.group.userData.particleCount = this.particleCount;
    this.apply(0);
  }

  private addPool(kind: Kind, count: number, color: number, opacity: number): void {
    let geometry: THREE.BufferGeometry;
    const soft = kind === 'vapor' || kind === 'smoke';
    switch (kind) {
      case 'vapor': case 'smoke': geometry = new THREE.PlaneGeometry(1, 1); break;
      case 'flame': geometry = new THREE.ConeGeometry(1, 2, 5); break;
      case 'gloop': case 'splat': geometry = new THREE.IcosahedronGeometry(1, 1); break;
      case 'crystal': geometry = new THREE.OctahedronGeometry(1, 0); break;
      case 'ribbon': geometry = new THREE.TorusGeometry(1, 0.025, 4, 22, Math.PI * 1.65); break;
      case 'arc': case 'strand': geometry = new THREE.CylinderGeometry(1, 1, 1, 5, 1); break;
      default: geometry = new THREE.OctahedronGeometry(1, 0);
    }
    const material = soft ? vaporMaterial(color) : new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthTest: true, depthWrite: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = `${this.element}-${kind}`;
    mesh.userData.comicOverlay = true;
    mesh.userData.elementParticleKind = kind;
    mesh.raycast = noopRaycast;
    // Particles move inside a small known volume, so stale per-frame instance bounds must not cull them.
    mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    let alpha: THREE.InstancedBufferAttribute | undefined;
    if (soft) {
      alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      alpha.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('particleAlpha', alpha);
    } else {
      const base = new THREE.Color(color), white = new THREE.Color(0xffffff);
      for (let i = 0; i < count; i++) mesh.setColorAt(i, base.clone().lerp(white, (i % 4) * 0.07));
    }
    this.group.add(mesh); this.pools.push({ kind, mesh, alpha, opacity });
  }

  /** Supply game time for synchronized effects, or only dt for an independent paused clock. */
  update(dt: number, time?: number): void {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    this.apply(Number.isFinite(time) ? time! : this.elapsed);
  }

  private apply(time: number): void {
    const impact = this.style === 'impact';
    const fade = this.intensity * (impact ? Math.max(0, 1 - this.elapsed / 1.15) : 1);
    for (const pool of this.pools) {
      const count = pool.mesh.count;
      for (let i = 0; i < count; i++) {
        const seed = (i * 0.61803398875 + 0.137 + this.variant * .173) % 1;
        const p = (seed + time * (pool.kind === 'gloop' ? 0.75 : 0.42)) % 1;
        const angle = i * 2.39996323 + this.variant * .71 + time * (this.element === 'gravity' ? 1.9 : 0.6) * (1 + this.variant * .12);
        const radius = impact ? 0.12 + this.elapsed * (0.8 + seed) : 0.35 + seed * 0.35;
        const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
        const d = this.dummy;
        d.position.set(x, -0.9 + p * 1.85, z); d.rotation.set(0, 0, 0); d.scale.setScalar(1);
        let alpha = fade;
        switch (pool.kind) {
          case 'vapor': case 'smoke': {
            const size = ((pool.kind === 'smoke' ? 0.55 : 0.62) + p * 0.7) * (this.element === 'corrosive' ? 1.13 : 1);
            d.position.x += Math.sin(time * 1.7 + i) * 0.12;
            d.scale.set(size, size * (this.element === 'corrosive' ? 0.85 : 1.1), 1);
            alpha *= pool.opacity * Math.sin(Math.PI * Math.max(0.02, Math.min(0.98, p)));
            break;
          }
          case 'gloop':
            d.position.y = impact ? 0.1 + Math.sin(seed * TAU) * this.elapsed * 2 - this.elapsed * this.elapsed : 0.85 - p * 1.75;
            d.scale.set(0.065 + seed * 0.025, 0.10 + p * 0.09, 0.065 + seed * 0.025);
            d.rotation.z = Math.sin(angle) * 0.4;
            break;
          case 'splat':
            d.position.set(Math.cos(angle) * 0.48, -0.82 + seed * 0.45, Math.sin(angle) * 0.48);
            d.scale.set(0.14 + seed * 0.08, 0.045, 0.11); d.rotation.z = Math.sin(angle) * 0.7;
            break;
          case 'flame':
            d.position.y = -0.75 + p * 1.6;
            d.scale.set(0.10 + (1 - p) * 0.11, 0.16 + (1 - p) * 0.25, 0.08);
            d.rotation.z = Math.sin(time * 9 + i) * 0.3; d.rotation.y = angle;
            alpha *= 0.95 - p * 0.4;
            break;
          case 'ember':
            d.position.y = -0.5 + p * 1.65; d.scale.set(0.025, 0.07, 0.025); d.rotation.z = angle;
            break;
          case 'crystal':
            d.position.y = -0.72 + seed * 1.4;
            d.scale.set(0.07 + seed * 0.06, 0.21 + seed * 0.15, 0.06);
            d.rotation.set(Math.sin(angle) * 0.6, angle, Math.cos(angle) * 0.5);
            alpha *= 0.75 + Math.sin(time * 3 + i) * 0.2;
            break;
          case 'arc': {
            const segment = i % 4, arc = Math.floor(i / 4), flicker = Math.floor(time * 14);
            const a = arc * 1.91, base = -0.7 + (arc % 3) * 0.55;
            const arcPoint = (step: number, target: THREE.Vector3) => {
              const t = step / 4, jitter = step === 0 || step === 4 ? 0 : Math.sin(step * 9.1 + arc * 4 + flicker * 2.7) * 0.19;
              target.set(Math.cos(a + t * 1.8) * (0.54 + jitter), base + t * 0.62 + jitter, Math.sin(a + t * 1.8) * (0.54 + jitter));
            };
            arcPoint(segment, this.pointA); arcPoint(segment + 1, this.pointB);
            this.segment(this.pointA, this.pointB, 0.022 + (i % 2) * 0.008);
            alpha *= (arc + flicker) % 5 === 0 ? 0.18 : 1;
            break;
          }
          case 'spark':
            d.position.y = impact ? Math.sin(seed * TAU) * this.elapsed * 2 - this.elapsed * this.elapsed * 0.8 : -0.6 + p * 1.4;
            d.scale.set(0.018, 0.10 + seed * 0.07, 0.018); d.rotation.z = angle;
            break;
          case 'mote':
            d.position.y = Math.sin(angle * 1.3) * 0.78;
            d.scale.setScalar(0.035 + seed * 0.045); d.rotation.set(angle, angle, angle);
            alpha *= 0.6 + Math.sin(time * 5 + i) * 0.3;
            break;
          case 'ribbon':
            d.position.set(0, Math.sin(i * 2.1 + time) * 0.24, 0);
            d.scale.set(0.67 + i * 0.035, 0.67 + i * 0.035, 0.67 + i * 0.035);
            d.rotation.set(Math.PI / 2 + Math.sin(i * 2.4) * 0.65, time * (i % 2 ? -1 : 1), i * 1.8 + time * 0.4);
            break;
          case 'strand':
            this.pointA.set(Math.cos(angle) * 0.48, -0.2 + seed * 0.8, Math.sin(angle) * 0.48);
            this.pointB.copy(this.pointA); this.pointB.y -= 0.25 + p * 0.50; this.pointB.x += Math.sin(time * 2 + i) * 0.10;
            this.segment(this.pointA, this.pointB, 0.022 + seed * 0.012);
            break;
        }
        if (impact && !['spark', 'gloop'].includes(pool.kind)) {
          d.position.x *= 0.5 + this.elapsed;
          d.position.z *= 0.5 + this.elapsed;
          d.position.y += this.elapsed * 0.35;
        }
        d.updateMatrix(); pool.mesh.setMatrixAt(i, d.matrix);
        pool.alpha?.setX(i, Math.min(1, alpha));
      }
      pool.mesh.instanceMatrix.needsUpdate = true;
      if (pool.alpha) pool.alpha.needsUpdate = true;
      else (pool.mesh.material as THREE.Material).opacity = Math.min(1, fade * pool.opacity);
    }
  }

  private segment(start: THREE.Vector3, end: THREE.Vector3, width: number): void {
    this.direction.subVectors(end, start);
    const length = this.direction.length();
    this.dummy.position.copy(start).addScaledVector(this.direction, 0.5);
    this.dummy.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, this.direction.normalize());
    this.dummy.scale.set(width, length, width);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.group.removeFromParent();
    for (const pool of this.pools) { pool.mesh.dispose(); pool.mesh.geometry.dispose(); (pool.mesh.material as THREE.Material).dispose(); }
    this.pools.length = 0; this.group.clear();
  }
}
