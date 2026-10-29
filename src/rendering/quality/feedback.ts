import * as THREE from 'three';
import type { Mode } from '../../core/index';
import { elementColors, type ElementType } from '../../core/arsenal';
import { getElementSmokeTexture } from '../ElementEffects';

export interface QualityFireFeedback { mode: Mode; muzzle: THREE.Object3D | THREE.Vector3; element?: ElementType }
export interface QualityImpactFeedback {
  point: THREE.Vector3;
  normal?: THREE.Vector3;
  kind?: 'metal' | 'dust' | 'shield';
  strength?: number;
  mode?: Mode;
}
export interface QualityStepFeedback { point: THREE.Vector3; mode: Mode; strength?: number }
type Kind = 'spark' | 'chip' | 'dust' | 'flash';
interface Particle {
  active: boolean; age: number; life: number; size: number; length: number; spin: number;
  position: THREE.Vector3; velocity: THREE.Vector3; rotation: THREE.Quaternion; tint: THREE.Color;
}
interface Pool {
  kind: Kind; mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  particles: Particle[]; alpha: THREE.InstancedBufferAttribute; tint: THREE.InstancedBufferAttribute; next: number;
}

export const QUALITY_FEEDBACK_CAPACITY = Object.freeze({ spark: 64, chip: 40, dust: 32, flash: 8 });
const noopRaycast = () => {};
const zAxis = new THREE.Vector3(0, 0, 1);

function particleMaterial(billboard: boolean, smoke: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: smoke ? 'QualitySoftDust' : 'QualityHardParticle', transparent: true,
    depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    uniforms: { dustMap: { value: smoke ? getElementSmokeTexture() : null } },
    defines: { BILLBOARD: billboard ? 1 : 0, SOFT_DUST: smoke ? 1 : 0 },
    vertexShader: /* glsl */ `
      attribute float particleAlpha;
      attribute vec3 particleTint;
      varying vec2 vUv;
      varying float vAlpha;
      varying vec3 vTint;
      void main() {
        vUv = uv; vAlpha = particleAlpha; vTint = particleTint;
        #if BILLBOARD == 1
          mat4 m = modelMatrix * instanceMatrix;
          vec3 center = m[3].xyz;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 world = center + right * position.x * length(m[0].xyz) + up * position.y * length(m[1].xyz);
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        #else
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D dustMap;
      varying vec2 vUv;
      varying float vAlpha;
      varying vec3 vTint;
      void main() {
        float alpha = vAlpha;
        #if SOFT_DUST == 1
          alpha *= texture2D(dustMap, vUv).a;
        #endif
        if (alpha < .004) discard;
        gl_FragColor = vec4(vTint, alpha);
      }
    `,
  });
}

/** Four fixed GPU pools. Presentation geometry never participates in shot raycasts. */
export class QualityFeedback {
  readonly group = new THREE.Group();
  private readonly pools = new Map<Kind, Pool>();
  private readonly dummy = new THREE.Object3D();
  private readonly direction = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private randomState = 0xc0ffee;
  private disposed = false;

  constructor({ scene }: { scene: THREE.Scene; camera?: THREE.Camera }) {
    this.group.name = 'quality-presentation-feedback';
    this.group.userData.comicOverlay = true;
    this.group.userData.presentationOnly = true;
    const flashGeometry = new THREE.ConeGeometry(1, 1, 5, 1, true);
    // Cone tip points along local +Z; fire() rotates that axis to the real muzzle.
    flashGeometry.rotateX(Math.PI / 2);
    const geometries: Record<Kind, THREE.BufferGeometry> = {
      spark: new THREE.BoxGeometry(1, 1, 1), chip: new THREE.TetrahedronGeometry(1),
      dust: new THREE.PlaneGeometry(1, 1), flash: flashGeometry,
    };
    for (const kind of ['spark', 'chip', 'dust', 'flash'] as const) {
      const count = QUALITY_FEEDBACK_CAPACITY[kind];
      const alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage);
      const tint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
      const geometry = geometries[kind];
      geometry.setAttribute('particleAlpha', alpha); geometry.setAttribute('particleTint', tint);
      const mesh = new THREE.InstancedMesh(geometry, particleMaterial(kind === 'dust', kind === 'dust'), count);
      mesh.name = `quality-${kind}-pool`; mesh.raycast = noopRaycast;
      mesh.frustumCulled = false; mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const particles: Particle[] = Array.from({ length: count }, () => ({
        active: false, age: 0, life: 1, size: 1, length: 1, spin: 0,
        position: new THREE.Vector3(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(), tint: new THREE.Color(),
      }));
      this.pools.set(kind, { kind, mesh, alpha, tint, particles, next: 0 });
      this.group.add(mesh);
    }
    scene.add(this.group);
  }

  get activeParticleCount(): number {
    let count = 0;
    for (const pool of this.pools.values()) for (const particle of pool.particles) if (particle.active) count++;
    return count;
  }

  fire({ mode, muzzle, element = 'kinetic' }: QualityFireFeedback): void {
    if (this.disposed) return;
    const heavy = mode === 'mech';
    if (muzzle instanceof THREE.Object3D) {
      muzzle.getWorldPosition(this.point);
      muzzle.getWorldQuaternion(this.quaternion);
      this.direction.set(0, 0, -1).applyQuaternion(this.quaternion);
    } else {
      this.point.copy(muzzle); this.direction.set(0, 0, -1);
    }
    const flash = this.emit('flash', this.point, heavy ? .07 : .043, heavy ? .105 : .045, heavy ? .46 : .2, 0xfff0bc);
    flash.rotation.setFromUnitVectors(zAxis, this.direction);
    flash.position.addScaledVector(this.direction, flash.length * .45);
    const core = this.emit('flash', this.point, heavy ? .045 : .025, heavy ? .065 : .028, heavy ? .25 : .13, element === 'kinetic' ? 0xfff9dc : elementColors[element]);
    core.rotation.copy(flash.rotation); core.position.addScaledVector(this.direction, core.length * .4);
    // A little gas detaches from the bore; never a particle wash over the receiver.
    const dust = this.emit('dust', this.point, .27, heavy ? .18 : .075, 1, 0xc9bfa8);
    dust.velocity.copy(this.direction).multiplyScalar(heavy ? 1.2 : .65).y += .16;
  }

  impact({ point, normal, kind = 'metal', strength = 1, mode = 'pilot' }: QualityImpactFeedback): void {
    if (this.disposed) return;
    const scale = (mode === 'mech' ? 1.45 : 1) * this.clampStrength(strength);
    this.normal.copy(normal ?? THREE.Object3D.DEFAULT_UP).normalize();
    if (this.normal.lengthSq() < .5) this.normal.set(0, 1, 0);
    this.point.copy(point).addScaledVector(this.normal, .025);
    if (kind !== 'dust') {
      for (let i = 0; i < (kind === 'shield' ? 7 : 6); i++) {
        const spark = this.emit('spark', this.point, (.095 + this.random() * .13) * Math.sqrt(scale), .012 * scale, (.09 + this.random() * .16) * scale, kind === 'shield' ? 0x82d8ff : i % 2 ? 0xffdd83 : 0xfff2c9);
        this.scatter(this.direction, this.normal, 1.1);
        spark.velocity.copy(this.direction).multiplyScalar((2.3 + this.random() * 3.8) * scale);
        spark.rotation.setFromUnitVectors(zAxis, this.direction);
      }
    }
    if (kind !== 'shield') for (let i = 0; i < 4; i++) {
      const chip = this.emit('chip', this.point, .24 + this.random() * .18, (.016 + this.random() * .024) * scale, 1, kind === 'dust' ? 0x9b7754 : i % 2 ? 0x394347 : 0xa0a18c);
      this.scatter(this.direction, this.normal, 1.35);
      chip.velocity.copy(this.direction).multiplyScalar((1.7 + this.random() * 2.3) * scale);
      chip.spin = this.random() * 16 - 8;
    }
    if (kind !== 'shield') for (let i = 0; i < 2; i++) {
      const dust = this.emit('dust', this.point, .36 + this.random() * .18, (.14 + this.random() * .1) * scale, 1, kind === 'dust' ? 0xbc9975 : 0xb6aa93);
      this.scatter(this.direction, this.normal, .8);
      dust.velocity.copy(this.direction).multiplyScalar(.55 * scale).y += .2;
    }
  }

  step({ point, mode, strength = 1 }: QualityStepFeedback): void {
    if (this.disposed) return;
    const heavy = mode === 'mech', scale = this.clampStrength(strength);
    const count = heavy ? 5 : 2;
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      this.point.copy(point); this.point.y = Math.max(.035, point.y);
      this.point.x += Math.cos(angle) * (heavy ? .28 : .08);
      this.point.z += Math.sin(angle) * (heavy ? .28 : .08);
      const dust = this.emit('dust', this.point, (heavy ? .52 : .28) * (.85 + this.random() * .3), (heavy ? .29 : .1) * scale, 1, 0xba9571);
      dust.velocity.set(Math.cos(angle) * (heavy ? 1.3 : .4), heavy ? .18 : .09, Math.sin(angle) * (heavy ? 1.3 : .4));
    }
  }

  update(dt: number, frame: { paused?: boolean } = {}): void {
    if (this.disposed || frame.paused) return;
    const delta = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    for (const pool of this.pools.values()) {
      let instance = 0;
      for (const particle of pool.particles) {
        if (!particle.active) continue;
        particle.age += delta;
        if (particle.age >= particle.life) { particle.active = false; continue; }
        const p = particle.age / particle.life;
        const gravity = pool.kind === 'chip' ? 9.8 : pool.kind === 'spark' ? 3.8 : 0;
        particle.velocity.y -= gravity * delta;
        particle.position.addScaledVector(particle.velocity, delta);
        if (pool.kind === 'chip' && particle.position.y < .018) {
          particle.position.y = .018; particle.velocity.multiplyScalar(.35); particle.velocity.y = Math.abs(particle.velocity.y) * .3;
        }
        this.dummy.position.copy(particle.position);
        this.dummy.quaternion.copy(particle.rotation);
        if (pool.kind === 'chip') this.dummy.rotateX(particle.age * particle.spin).rotateY(particle.age * particle.spin * .7);
        let alpha: number;
        if (pool.kind === 'dust') {
          const growth = particle.size * (1 + p * 2.7);
          this.dummy.scale.set(growth, growth * .74, growth);
          alpha = Math.sin(Math.min(1, p * 5) * Math.PI / 2) * (1 - p) ** 2 * .38;
        } else if (pool.kind === 'flash') {
          this.dummy.scale.set(particle.size * (1 - p * .55), particle.size * (1 - p * .55), particle.length * (1 - p * .4));
          alpha = (1 - p) ** .4;
        } else {
          this.dummy.scale.set(particle.size, particle.size, pool.kind === 'spark' ? particle.length * (1 - p * .55) : particle.size * .4);
          alpha = (1 - p) ** .7;
        }
        this.dummy.updateMatrix();
        pool.mesh.setMatrixAt(instance, this.dummy.matrix);
        pool.alpha.setX(instance, alpha); pool.tint.setXYZ(instance, particle.tint.r, particle.tint.g, particle.tint.b);
        instance++;
      }
      pool.mesh.count = instance;
      pool.mesh.visible = instance > 0;
      pool.mesh.instanceMatrix.needsUpdate = true; pool.alpha.needsUpdate = true; pool.tint.needsUpdate = true;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const pool of this.pools.values()) {
      pool.mesh.dispose(); pool.mesh.geometry.dispose(); pool.mesh.material.dispose();
      for (const particle of pool.particles) particle.active = false;
    }
    this.pools.clear();
  }

  private emit(kind: Kind, point: THREE.Vector3, life: number, size: number, length: number, color: THREE.ColorRepresentation): Particle {
    const pool = this.pools.get(kind)!;
    const particle = pool.particles[pool.next];
    pool.next = (pool.next + 1) % pool.particles.length;
    particle.active = true; particle.age = 0; particle.life = Math.max(.01, life);
    particle.size = size; particle.length = length; particle.spin = 0;
    particle.position.copy(point); particle.velocity.set(0, 0, 0); particle.rotation.identity(); particle.tint.set(color);
    return particle;
  }

  private scatter(out: THREE.Vector3, normal: THREE.Vector3, spread: number): void {
    out.set(this.random() * 2 - 1, this.random() * 2 - 1, this.random() * 2 - 1).multiplyScalar(spread).add(normal);
    if (out.dot(normal) < .1) out.addScaledVector(normal, .2 - out.dot(normal));
    out.normalize();
  }

  private random(): number {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  private clampStrength(strength: number): number { return Number.isFinite(strength) ? Math.max(.05, Math.min(2, strength)) : 1; }
}
