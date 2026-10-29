import * as THREE from 'three';
import { elementColors, getWeaponElements, normalizeWeaponSpec, type BrandId, type WeaponSpec } from '../core/arsenal';
import { createProjectileVisual, createProjectileTrail, createBeamVisual } from './weaponVisuals';
import { ElementEffects } from './ElementEffects';

export interface BallisticTarget { id: number; root: THREE.Group; radius: number }
export interface BallisticHit {
  targetId: number;
  point: THREE.Vector3;
  direction: THREE.Vector3;
  damage: number;
  critical: boolean;
  spec: WeaponSpec;
}
export interface BallisticCallbacks {
  targets(): BallisticTarget[];
  occluders(): THREE.Object3D[];
  hit(event: BallisticHit): void;
}

/** Optional rendering adapter. Simulation, swept collision, and damage remain owned here. */
export interface BallisticPresentationImpact {
  point: THREE.Vector3; normal: THREE.Vector3; spec: Readonly<WeaponSpec>; radius: number;
  target?: THREE.Group; phase: 'contact' | 'detonate';
}
export interface BallisticPresentation {
  projectile(spec: WeaponSpec, brand: BrandId): THREE.Group;
  trail(start: THREE.Vector3, end: THREE.Vector3, spec: WeaponSpec, brand: BrandId): THREE.Group;
  beam(start: THREE.Vector3, end: THREE.Vector3, spec: WeaponSpec, jagged: boolean, brand: BrandId): THREE.Group;
  impact(event: BallisticPresentationImpact): void;
  updateProjectile?(root: THREE.Group, dt: number, age: number): void;
}

interface Target extends BallisticTarget { center: THREE.Vector3; bounds: THREE.Box3; meshes: THREE.Mesh[] }
interface Collision { intersection: THREE.Intersection; target?: Target; normal: THREE.Vector3 }
interface VisualRecipe extends WeaponSpec { visualBrand?: BrandId }
interface Projectile {
  visual: THREE.Group;
  velocity: THREE.Vector3;
  damage: number;
  spec: VisualRecipe;
  age: number;
  life: number;
  range: number;
  traveled: number;
  bounces: number;
  hits: Set<number>;
  stuck?: { targetId?: number; localPoint?: THREE.Vector3 };
  fuse?: number;
  presenter?: BallisticPresentation;
  visualContact?: { normal: THREE.Vector3; target?: THREE.Group };
}
interface Effect { visual: THREE.Group; life: number; duration: number; growth: number; opacities: Map<THREE.Material, number> }
interface ElementBurst { effect: ElementEffects; life: number }

const MAX_PROJECTILES = 192;
const MAX_EFFECTS = 224;
const MAX_ELEMENT_BURSTS = 32;
const MAX_ELEMENT_PAYLOADS = 24;
const STEP = 1 / 60;
const EPSILON = 0.025;
const forward = new THREE.Vector3(0, 0, 1);

function finite(vector: THREE.Vector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

export function reflectBallisticVelocity(velocity: THREE.Vector3, normal: THREE.Vector3, restitution = 1): THREE.Vector3 {
  if (!finite(velocity) || !finite(normal) || normal.lengthSq() < 1e-12) return new THREE.Vector3();
  return velocity.clone().reflect(normal.clone().normalize()).multiplyScalar(THREE.MathUtils.clamp(Number.isFinite(restitution) ? restitution : 1, 0, 1));
}

export function steerBallisticVelocity(velocity: THREE.Vector3, desiredDirection: THREE.Vector3, maxAngle: number): THREE.Vector3 {
  const speed = velocity.length();
  if (!finite(velocity) || !finite(desiredDirection) || speed < 1e-8 || desiredDirection.lengthSq() < 1e-12) return velocity.clone();
  const from = velocity.clone().divideScalar(speed);
  const turn = new THREE.Quaternion().setFromUnitVectors(from, desiredDirection.clone().normalize());
  const applied = new THREE.Quaternion().rotateTowards(turn, Math.max(0, Number.isFinite(maxAngle) ? maxAngle : 0));
  return from.applyQuaternion(applied).multiplyScalar(speed);
}

/** Stable cone distribution: the first pellet is centered and no random state is consumed. */
export function ballisticPelletDirections(direction: THREE.Vector3, count: number, spread: number): THREE.Vector3[] {
  if (!finite(direction) || direction.lengthSq() < 1e-12) return [];
  const aim = direction.clone().normalize();
  const total = Math.max(1, Math.min(12, Math.floor(Number.isFinite(count) ? count : 1)));
  const cone = THREE.MathUtils.clamp(Number.isFinite(spread) ? spread : 0, 0, 0.4);
  const right = new THREE.Vector3().crossVectors(aim, Math.abs(aim.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, aim).normalize();
  return Array.from({ length: total }, (_, index) => {
    const radius = total === 1 ? 0 : Math.sqrt(index / (total - 1)) * Math.tan(cone);
    const angle = index * 2.399963229728653;
    return aim.clone().addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius).normalize();
  });
}

function singleShotDirection(direction: THREE.Vector3, spread: number, sequence: number): THREE.Vector3 {
  const aim = direction.clone().normalize();
  if (spread <= 0) return aim;
  const right = new THREE.Vector3().crossVectors(aim, Math.abs(aim.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, aim).normalize();
  const radius = Math.sqrt((sequence * 0.7548776662466927) % 1) * Math.tan(spread);
  const angle = sequence * 2.399963229728653;
  return aim.addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius).normalize();
}

function isOverlay(object: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (!current.visible || current.userData.comicOverlay === true) return true;
  }
  return false;
}

function disposeVisual(root: THREE.Object3D): void {
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.removeFromParent();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
    if (object instanceof THREE.InstancedMesh) object.dispose();
    geometry.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
  });
  geometry.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
}

function glowMaterial(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: true, depthWrite: false, toneMapped: false });
}

/** Scene-owned projectile simulation. Every clock, attachment, trail and fuse advances only in update(). */
export class PlayerBallistics {
  private readonly projectiles = new Set<Projectile>();
  private readonly effects = new Set<Effect>();
  private readonly elementBursts = new Set<ElementBurst>();
  private readonly elementPayloads = new Map<Projectile, ElementEffects[]>();
  private readonly ray = new THREE.Raycaster();
  private readonly collisionMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  private targets: Target[] = [];
  private covers: THREE.Mesh[] = [];
  private allMeshes: THREE.Mesh[] = [];
  private bindings = new Map<THREE.Object3D, Target>();
  private epoch = 0;
  private shotSequence = 0;
  private presentation?: BallisticPresentation;

  constructor(private readonly scene: THREE.Scene, private readonly callbacks: BallisticCallbacks) {}

  /** Changes new presentation only; never clears active shots or modifies their recipes. */
  setPresentation(presentation?: BallisticPresentation): void { this.presentation = presentation; }

  get activeCount(): number { return this.projectiles.size; }
  get effectCount(): number { return this.effects.size + this.elementBursts.size; }

  fire(origin: THREE.Vector3, direction: THREE.Vector3, spec: WeaponSpec, damage: number, range = 100, brand: BrandId = 'ironvale'): void {
    if (!finite(origin) || !finite(direction) || direction.lengthSq() < 1e-12 || !Number.isFinite(damage) || damage <= 0 || damage > 1e9) return;
    const recipe = Object.freeze({ ...normalizeWeaponSpec(spec), visualBrand: brand });
    const distance = THREE.MathUtils.clamp(Number.isFinite(range) ? range : 100, 0.1, 250);
    this.refreshWorld();
    const directions = recipe.pellets === 1
      ? [singleShotDirection(direction, recipe.spread, ++this.shotSequence)]
      : ballisticPelletDirections(direction, recipe.pellets, recipe.spread);
    const epoch = this.epoch;
    for (const aim of directions) {
      if (this.epoch !== epoch) break;
      if (recipe.projectile === 'beam' || recipe.projectile === 'arc') {
        this.rayShot(origin, aim, recipe, damage, recipe.projectile === 'arc' ? Math.min(distance, 24) : distance);
        continue;
      }
      while (this.projectiles.size >= MAX_PROJECTILES) this.remove(this.projectiles.values().next().value!);
      const visual = this.presentation?.projectile(recipe, brand) ?? createProjectileVisual(recipe, brand);
      visual.position.copy(origin);
      visual.quaternion.setFromUnitVectors(forward, aim);
      this.scene.add(visual);
      const projectile: Projectile = { visual, spec: recipe, velocity: aim.clone().multiplyScalar(recipe.speed), damage, age: 0, life: Math.min(10, distance / recipe.speed + 1), range: distance, traveled: 0, bounces: recipe.bounces, hits: new Set(), presenter: this.presentation, fuse: recipe.projectile === 'sticky' ? undefined : recipe.fuse > 0 ? recipe.fuse : undefined };
      this.projectiles.add(projectile);
      const payloadElements = getWeaponElements(recipe).filter(element => element !== 'kinetic');
      if (!this.presentation && payloadElements.length && ['orb', 'sticky', 'rocket', 'homing'].includes(recipe.projectile)) {
        while (this.elementPayloads.size >= MAX_ELEMENT_PAYLOADS) {
          const oldest = this.elementPayloads.entries().next().value!;
          oldest[1].forEach(effect => effect.dispose()); this.elementPayloads.delete(oldest[0]);
        }
        const payloads = payloadElements.map((element, index) => {
          const payload = new ElementEffects(visual, element, { style: 'equipment', scale: recipe.projectile === 'orb' ? 1.15 : recipe.projectile === 'rocket' ? .85 : .65, intensity: .8, variant: (recipe.visualVariant ?? 0) + index });
          payload.group.position.set(index ? .06 : -.025, 0, -.12);
          return payload;
        });
        this.elementPayloads.set(projectile, payloads);
      }
    }
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Substeps preserve travel/fuse time across a slow frame. Beyond the hard
    // projectile lifetime, additional elapsed time cannot retain an effect.
    const elapsed = Math.min(dt, 16);
    this.refreshWorld();
    const steps = Math.ceil(elapsed / STEP), step = elapsed / steps;
    for (let index = 0; index < steps; index++) {
      for (const projectile of [...this.projectiles]) if (this.projectiles.has(projectile)) {
        this.advance(projectile, step);
        if (this.projectiles.has(projectile)) projectile.presenter?.updateProjectile?.(projectile.visual, step, projectile.age);
      }
      for (const effect of [...this.effects]) {
        effect.life -= step;
        if (effect.life <= 0) { this.effects.delete(effect); disposeVisual(effect.visual); continue; }
        effect.opacities.forEach((opacity, material) => { material.opacity = opacity * Math.min(1, effect.life / effect.duration * 2); });
        if (effect.growth > 0) effect.visual.scale.setScalar(0.06 + effect.growth * (1 - effect.life / effect.duration));
      }
      for (const payloads of this.elementPayloads.values()) payloads.forEach(payload => payload.update(step));
      for (const burst of this.elementBursts) {
        burst.life -= step;
        if (burst.life <= 0) { burst.effect.dispose(); this.elementBursts.delete(burst); }
        else burst.effect.update(step);
      }
    }
  }

  clear(): void {
    this.epoch++;
    this.elementPayloads.forEach(effects => effects.forEach(effect => effect.dispose())); this.elementPayloads.clear();
    this.elementBursts.forEach(burst => burst.effect.dispose()); this.elementBursts.clear();
    this.projectiles.forEach(projectile => disposeVisual(projectile.visual));
    this.effects.forEach(effect => disposeVisual(effect.visual));
    this.projectiles.clear();
    this.effects.clear();
    this.targets = [];
    this.covers = [];
    this.allMeshes = [];
    this.bindings.clear();
  }

  private refreshWorld(): void {
    this.scene.updateMatrixWorld(true);
    this.bindings = new Map();
    this.targets = [];
    const covered = new Set<THREE.Mesh>();
    for (const root of this.callbacks.occluders()) root.traverseVisible(object => { if (object instanceof THREE.Mesh && !isOverlay(object)) covered.add(object); });
    this.covers = [...covered];
    for (const candidate of this.callbacks.targets()) {
      if (!Number.isFinite(candidate.id) || !Number.isFinite(candidate.radius) || candidate.radius <= 0) continue;
      candidate.root.updateWorldMatrix(true, true);
      const meshes: THREE.Mesh[] = [], bounds = new THREE.Box3();
      candidate.root.traverseVisible(object => {
        // Enemy decoration, status auras and health bars must never become
        // damageable merely because they live below an enemy root.
        if (!(object instanceof THREE.Mesh) || object.userData.enemyId !== candidate.id || isOverlay(object)) return;
        object.geometry.computeBoundingBox();
        bounds.union(object.geometry.boundingBox!.clone().applyMatrix4(object.matrixWorld));
        meshes.push(object);
      });
      if (!meshes.length || bounds.isEmpty()) continue;
      const target = { ...candidate, bounds, center: bounds.getCenter(new THREE.Vector3()), meshes };
      this.targets.push(target);
      meshes.forEach(mesh => this.bindings.set(mesh, target));
    }
    this.allMeshes = [...new Set([...this.covers, ...this.targets.flatMap(target => target.meshes)])];
  }

  private trace(start: THREE.Vector3, end: THREE.Vector3, onlyCover = false): Collision | undefined {
    const delta = end.clone().sub(start), length = delta.length();
    if (length < 1e-8) return undefined;
    this.ray.set(start, delta.divideScalar(length));
    this.ray.near = 0;
    this.ray.far = length + 0.00001;
    const meshes = onlyCover ? this.covers : this.allMeshes;
    const original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    let intersection: THREE.Intersection | undefined;
    try {
      // Collision is double-sided even when a muzzle starts within thin cover.
      // Render materials are restored before any hit callback or scene render.
      meshes.forEach(mesh => { original.set(mesh, mesh.material); mesh.material = this.collisionMaterial; });
      intersection = this.ray.intersectObjects(meshes, false)[0];
    } finally { original.forEach((material, mesh) => { mesh.material = material; }); }
    if (!intersection) return undefined;
    const normal = intersection.face
      ? intersection.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(intersection.object.matrixWorld)).normalize()
      : this.ray.ray.direction.clone().negate();
    if (normal.dot(this.ray.ray.direction) > 0) normal.negate();
    return { intersection, normal, target: this.bindings.get(intersection.object) };
  }

  private emit(target: Target, point: THREE.Vector3, direction: THREE.Vector3, damage: number, spec: WeaponSpec, critical = false): boolean {
    if (damage <= 0 || !Number.isFinite(damage) || !this.callbacks.targets().some(candidate => candidate.id === target.id)) return true;
    const epoch = this.epoch;
    this.callbacks.hit({ targetId: target.id, point: point.clone(), direction: direction.clone().normalize(), damage, critical, spec });
    if (this.epoch !== epoch) return false;
    this.refreshWorld();
    return true;
  }

  private rayShot(origin: THREE.Vector3, direction: THREE.Vector3, spec: VisualRecipe, damage: number, range: number): void {
    const end = origin.clone().addScaledVector(direction, range);
    const collision = this.trace(origin, end);
    const point = collision?.intersection.point ?? end;
    this.beam(origin, point, spec, spec.projectile === 'arc');
    if (collision) this.presentation?.impact({ point: point.clone(), normal: collision.normal.clone(), spec, radius: .3, target: collision.target?.root, phase: 'contact' });
    if (!collision?.target) { if (collision) this.flash(point, spec, 0.2); return; }
    const primary = collision.target;
    if (!this.emit(primary, point, direction, damage, spec, collision.intersection.object.userData.critical === true)) return;
    if (getWeaponElements(spec).some(element => element !== 'kinetic')) this.flash(point, spec, 0.55);
    if (spec.projectile !== 'arc') return;
    const hit = new Set([primary.id]);
    let from = point.clone().addScaledVector(collision.normal, EPSILON);
    for (let hop = 1; hop <= 3; hop++) {
      const candidate = this.targets.filter(target => !hit.has(target.id) && target.center.distanceTo(from) <= 8 + target.radius)
        .sort((a, b) => a.center.distanceToSquared(from) - b.center.distanceToSquared(from))
        .find(target => !this.trace(from, target.center, true));
      if (!candidate) break;
      const endpoint = candidate.bounds.clampPoint(from, new THREE.Vector3());
      this.beam(from, endpoint, spec, true);
      this.presentation?.impact({point:endpoint.clone(),normal:from.clone().sub(endpoint).normalize(),spec,radius:.22,target:candidate.root,phase:'contact'});
      if (!this.emit(candidate, endpoint, endpoint.clone().sub(from), damage * Math.pow(0.58, hop), spec)) return;
      if (getWeaponElements(spec).some(element => element !== 'kinetic')) this.flash(endpoint, spec, 0.40);
      hit.add(candidate.id);
      from = endpoint;
    }
  }

  private advance(projectile: Projectile, dt: number): void {
    projectile.age += dt;
    projectile.life -= dt;
    if (projectile.stuck?.targetId !== undefined) {
      const target = this.targets.find(candidate => candidate.id === projectile.stuck!.targetId);
      if (target && projectile.stuck.localPoint) projectile.visual.position.copy(target.root.localToWorld(projectile.stuck.localPoint.clone()));
      else { projectile.stuck = undefined; projectile.velocity.set(0, -2, 0); }
    }
    if (projectile.fuse !== undefined) {
      projectile.fuse -= dt;
      if (projectile.fuse <= 0) { this.explode(projectile, projectile.visual.position, undefined, projectile.spec.projectile === 'sticky' ? 0.80 : 1); this.remove(projectile); return; }
    }
    if (projectile.age >= 16 || projectile.life <= 0) {
      if (projectile.spec.blastRadius > 0) this.explode(projectile, projectile.visual.position);
      this.remove(projectile); return;
    }
    if (projectile.stuck) return;
    const type = projectile.spec.projectile;
    if ((type === 'homing' || type === 'orb') && projectile.spec.tracking > 0) {
      const direction = projectile.velocity.clone().normalize();
      const selected = this.targets.filter(target => {
        const offset = target.center.clone().sub(projectile.visual.position);
        return offset.length() < 45 && offset.normalize().dot(direction) > 0.15 && !this.trace(projectile.visual.position, target.center, true);
      }).sort((a, b) => a.center.distanceToSquared(projectile.visual.position) - b.center.distanceToSquared(projectile.visual.position))[0];
      if (selected) projectile.velocity.copy(steerBallisticVelocity(projectile.velocity, selected.center.clone().sub(projectile.visual.position), projectile.spec.tracking * dt));
    }
    const gravity = type === 'slug' ? 12 : type === 'spike' ? 7.5 : type === 'sticky' ? 4 : 0;
    projectile.velocity.y -= gravity * dt;
    let remaining = dt;
    for (let impact = 0; impact < 4 && remaining > 1e-7 && this.projectiles.has(projectile); impact++) {
      const prior = projectile.visual.position.clone();
      const speed = projectile.velocity.length();
      const travel = Math.min(speed * remaining, projectile.range - projectile.traveled);
      if (travel <= 1e-7) { this.remove(projectile); return; }
      const direction = projectile.velocity.clone().normalize();
      const end = prior.clone().addScaledVector(direction, travel);
      const collision = this.trace(prior, end);
      const point = collision?.intersection.point ?? end;
      projectile.visual.position.copy(point);
      projectile.traveled += prior.distanceTo(point);
      projectile.visual.quaternion.setFromUnitVectors(forward, direction);
      if (type === 'disc' || type === 'ricochet') projectile.visual.rotateY(projectile.age * (type === 'disc' ? 14 : 21));
      else if (type === 'orb') projectile.visual.rotateZ(projectile.age * (1 + (projectile.spec.visualVariant ?? 0) * .3));
      this.trail(prior, point, projectile.spec, projectile.presenter ?? null);
      if (!collision) {
        if (projectile.traveled >= projectile.range - 1e-7) { if (projectile.spec.blastRadius > 0) this.explode(projectile, point); this.remove(projectile); }
        return;
      }
      const target = collision.target;
      projectile.visualContact = { normal: collision.normal.clone(), target: target?.root };
      projectile.presenter?.impact({point:point.clone(),normal:collision.normal.clone(),spec:projectile.spec,radius:.3,target:target?.root,phase:'contact'});
      if (type === 'sticky') {
        if (target && !projectile.hits.has(target.id)) {
          projectile.hits.add(target.id);
          if (!this.emit(target, point, direction, projectile.damage * 0.20, projectile.spec, collision.intersection.object.userData.critical === true)) return;
        }
        projectile.visual.position.addScaledVector(collision.normal, EPSILON);
        projectile.stuck = target && this.targets.some(candidate => candidate.id === target.id)
          ? { targetId: target.id, localPoint: target.root.worldToLocal(projectile.visual.position.clone()) }
          : target ? undefined : {};
        projectile.fuse ??= projectile.spec.fuse;
        projectile.life = Math.max(projectile.life, projectile.fuse + 0.1);
        projectile.velocity.set(0, projectile.stuck ? 0 : -2, 0);
        if (projectile.fuse <= 0) { this.explode(projectile, projectile.visual.position, undefined, 0.80); this.remove(projectile); }
        return;
      }
      if (target && !projectile.hits.has(target.id)) {
        projectile.hits.add(target.id);
        if (!this.emit(target, point, direction, projectile.damage, projectile.spec, collision.intersection.object.userData.critical === true)) return;
      }
      if (type === 'ricochet' || type === 'disc') {
        if (projectile.bounces > 0) {
          remaining = Math.max(0, remaining - prior.distanceTo(point) / Math.max(speed, 0.0001));
          projectile.velocity.copy(reflectBallisticVelocity(projectile.velocity, collision.normal, type === 'disc' ? 0.94 : 0.86));
          projectile.visual.position.addScaledVector(collision.normal, EPSILON);
          projectile.damage *= 0.85;
          projectile.bounces--;
          this.flash(point, projectile.spec, 0.14, projectile.presenter ?? null);
          continue;
        }
      }
      if (projectile.spec.blastRadius > 0) this.explode(projectile, point.clone().addScaledVector(collision.normal, EPSILON), target?.id, target ? 0.65 : 1);
      else this.flash(point, projectile.spec, 0.18, projectile.presenter ?? null);
      this.remove(projectile);
      return;
    }
  }

  private explode(projectile: Projectile, point: THREE.Vector3, excludeId?: number, multiplier = 1): void {
    const radius = projectile.spec.blastRadius;
    projectile.presenter?.impact({point:point.clone(),normal:projectile.visualContact?.normal.clone()??new THREE.Vector3(0,1,0),spec:projectile.spec,radius:Math.max(.35,radius),target:projectile.visualContact?.target,phase:'detonate'});
    this.flash(point, projectile.spec, Math.max(0.35, radius), projectile.presenter ?? null);
    if (radius <= 0) return;
    this.refreshWorld();
    for (const target of [...this.targets]) {
      if (target.id === excludeId) continue;
      const closest = target.bounds.clampPoint(point, new THREE.Vector3());
      const distance = point.distanceTo(closest);
      if (distance > radius) continue;
      const offset = closest.clone().sub(point);
      const start = point.clone();
      if (offset.lengthSq() > 1e-8) start.addScaledVector(offset.clone().normalize(), 0.005);
      if (this.trace(start, closest, true)) continue;
      const amount = projectile.damage * multiplier * Math.max(0.12, 1 - distance / radius);
      if (!this.emit(target, closest, offset.lengthSq() > 1e-8 ? offset : projectile.velocity, amount, projectile.spec)) return;
    }
  }

  private remove(projectile: Projectile): void {
    if (!this.projectiles.delete(projectile)) return;
    this.elementPayloads.get(projectile)?.forEach(effect => effect.dispose()); this.elementPayloads.delete(projectile);
    disposeVisual(projectile.visual);
  }

  private effect(visual: THREE.Group, duration: number, growth = 0): void {
    while (this.effects.size >= MAX_EFFECTS) {
      const oldest = this.effects.values().next().value!;
      this.effects.delete(oldest); disposeVisual(oldest.visual);
    }
    visual.userData.comicOverlay = true;
    const opacities = new Map<THREE.Material, number>();
    visual.traverse(object => {
      object.raycast = () => {};
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => opacities.set(material, material.opacity));
    });
    this.scene.add(visual);
    this.effects.add({ visual, duration, life: duration, growth, opacities });
  }

  private trail(start: THREE.Vector3, end: THREE.Vector3, spec: VisualRecipe, presenter: BallisticPresentation | null | undefined = this.presentation): void {
    if (start.distanceToSquared(end) < 0.00001) return;
    const visual = presenter?.trail(start,end,spec,spec.visualBrand??'ironvale') ?? createProjectileTrail(start, end, spec, spec.visualBrand);
    const duration = spec.trail === 'clean' ? .045 : spec.trail === 'comet' ? .18 : spec.trail === 'helix' || spec.trail === 'ribbon' ? .14 : .09;
    this.effect(visual, duration);
  }

  private flash(point: THREE.Vector3, spec: VisualRecipe, radius: number, presenter: BallisticPresentation | null | undefined = this.presentation): void {
    if (presenter) return;
    const elements = getWeaponElements(spec).filter(element => element !== 'kinetic');
    if (elements.length) {
      for (const [index, element] of elements.entries()) {
        while (this.elementBursts.size >= MAX_ELEMENT_BURSTS) {
          const oldest = this.elementBursts.values().next().value!;
          oldest.effect.dispose(); this.elementBursts.delete(oldest);
        }
        const deliveryScale = spec.projectile === 'orb' || spec.projectile === 'sticky' ? 1.05 : spec.projectile === 'rocket' ? 1.2 : spec.projectile === 'beam' || spec.projectile === 'arc' ? .65 : .36;
        const effect = new ElementEffects(this.scene, element, { style: 'impact', scale: THREE.MathUtils.clamp((0.6 + radius * 0.5) * deliveryScale, .26, 2.4), intensity: index ? .72 : 1.1, variant: (spec.visualVariant ?? 0) + index });
        effect.group.name = `player-ballistic-impact-${element}`;
        effect.group.position.copy(point);
        this.elementBursts.add({ effect, life: 1.15 });
      }
      return;
    }
    const root = new THREE.Group(); root.name = 'player-ballistic-impact'; root.position.copy(point);
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), glowMaterial(elementColors[spec.element], radius > 0.4 ? 0.22 : 0.60));
    root.add(shell); root.scale.setScalar(0.06);
    this.effect(root, radius > 0.4 ? 0.30 : 0.12, radius);
  }

  private beam(start: THREE.Vector3, end: THREE.Vector3, spec: VisualRecipe, jagged: boolean): void {
    if (start.distanceToSquared(end) < .000001) return;
    this.effect(this.presentation?.beam(start,end,spec,jagged,spec.visualBrand??'ironvale') ?? createBeamVisual(start, end, spec, jagged, spec.visualBrand), jagged ? .16 : .11);
  }
}
