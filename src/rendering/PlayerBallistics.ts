import * as THREE from 'three';
import { elementColors, getWeaponElements, getDamagePacketCount, getClusterBombletFuseRange, normalizeWeaponSpec, type BrandId, type WeaponSpec } from '../core/arsenal';
import { CLUSTER_MIRV, clusterBombletPlan } from '../core/cluster';
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
  worldImpact?(event:Readonly<BallisticWorldImpact>):void;
}

/** Authoritative contact/detonation notification, independent of the selected renderer. */
export interface BallisticWorldImpact {
 projectileId:number;phase:'contact'|'detonate';point:Readonly<{x:number;y:number;z:number}>;normal:Readonly<{x:number;y:number;z:number}>;
 spec:Readonly<WeaponSpec>;energy:number;radius:number;targetId?:number;stage?:'cluster-burst'|'bomblet';
}

/** Optional rendering adapter. Simulation, swept collision, and damage remain owned here. */
export interface BallisticPresentationImpact {
  point: THREE.Vector3; normal: THREE.Vector3; spec: Readonly<WeaponSpec>; radius: number;
  target?: THREE.Group; phase: 'contact' | 'detonate';
  /** Presentation-only actual shot energy and propagated contact fraction. */
  energy?: number; exposure?: number;
  stage?: 'cluster-burst' | 'bomblet';
  /** Visual support for settling effects; never participates in authoritative collision. */
  hitSurface?: THREE.Object3D;
}
export interface BallisticPresentationSplash extends BallisticPresentationImpact {
  target:THREE.Group;origin:THREE.Vector3;energy:number;exposure:number;primary:boolean;
}
export interface BallisticPresentation {
  projectile(spec: WeaponSpec, brand: BrandId, role?: 'carrier' | 'bomblet'): THREE.Group;
  trail(start: THREE.Vector3, end: THREE.Vector3, spec: WeaponSpec, brand: BrandId, role?: 'carrier' | 'bomblet'): THREE.Group;
  beam(start: THREE.Vector3, end: THREE.Vector3, spec: WeaponSpec, jagged: boolean, brand: BrandId): THREE.Group;
  impact(event: BallisticPresentationImpact): void;
  /** One notification for each actual, unoccluded blast recipient; no damage is applied here. */
  splash?(event:BallisticPresentationSplash):void;
  updateProjectile?(root: THREE.Group, dt: number, age: number): void;
}

interface Target extends BallisticTarget { center: THREE.Vector3; bounds: THREE.Box3; meshes: THREE.Mesh[] }
interface Collision { intersection: THREE.Intersection; target?: Target; normal: THREE.Vector3; exiting: boolean }
interface VisualRecipe extends WeaponSpec { visualBrand?: BrandId }
interface Projectile {
  impactId:number;
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
  /** Present only on a carrier; its children never acquire another split timer. */
  splitDelay?: number;
  clusterRole?: 'carrier' | 'bomblet';
  clusterSurface?: THREE.Object3D;
  clusterNormal?: THREE.Vector3;
  clusterTargetId?: number;
  presenter?: BallisticPresentation;
  visualContact?: { normal: THREE.Vector3; target?: THREE.Group; hitSurface?:THREE.Object3D };
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
  private readonly containmentRay = new THREE.Raycaster();
  private readonly closedCover = new WeakMap<THREE.BufferGeometry, boolean>();
  private readonly collisionMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  private targets: Target[] = [];
  private covers: THREE.Mesh[] = [];
  private allMeshes: THREE.Mesh[] = [];
  private bindings = new Map<THREE.Object3D, Target>();
  private epoch = 0;
  private shotSequence = 0;
  private presentation?: BallisticPresentation;
  private worldImpactHandler?: (event:Readonly<BallisticWorldImpact>)=>void;
  private worldImpactSequence=0;

  constructor(private readonly scene: THREE.Scene, private readonly callbacks: BallisticCallbacks) {}

  /** Combat-owner seam. Visual toggles do not install, remove or invoke this hook. */
  setWorldImpactHandler(handler?: (event:Readonly<BallisticWorldImpact>)=>void):void{this.worldImpactHandler=handler;}
  private worldImpact(id:number,phase:'contact'|'detonate',point:THREE.Vector3,normal:THREE.Vector3,spec:Readonly<WeaponSpec>,energy:number,radius:number,targetId?:number,stage?:'cluster-burst'|'bomblet'):void{
    const handler=this.worldImpactHandler??this.callbacks.worldImpact;if(!handler)return;
    handler(Object.freeze({projectileId:id,phase,point:Object.freeze({x:point.x,y:point.y,z:point.z}),normal:Object.freeze({x:normal.x,y:normal.y,z:normal.z}),spec,energy,radius,targetId,...(stage?{stage}:{})}));
  }

  /** Changes new presentation only; never clears active shots or modifies their recipes. */
  setPresentation(presentation?: BallisticPresentation): void { this.presentation = presentation; }

  get activeCount(): number { return this.projectiles.size; }
  get effectCount(): number { return this.effects.size + this.elementBursts.size; }

  fire(origin: THREE.Vector3, direction: THREE.Vector3, spec: WeaponSpec, damage: number, range = 100, brand: BrandId = 'ironvale'): void {
    if (!finite(origin) || !finite(direction) || direction.lengthSq() < 1e-12 || !Number.isFinite(damage) || damage <= 0 || damage > 1e9) return;
    const normalized = normalizeWeaponSpec(spec);
    const recipe = Object.freeze({ ...normalized, ...(normalized.split ? { split: Object.freeze({ ...normalized.split }) } : {}), visualBrand: brand });
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
      this.spawnProjectile(origin, aim, recipe, damage, distance, this.presentation);
    }
  }

  private spawnProjectile(origin: THREE.Vector3, aim: THREE.Vector3, recipe: VisualRecipe, damage: number, distance: number, presenter?: BallisticPresentation, child = false): Projectile | undefined {
    while (this.projectiles.size >= MAX_PROJECTILES) this.remove(this.projectiles.values().next().value!);
    const brand = recipe.visualBrand ?? 'ironvale';
    const epoch = this.epoch;
    const clusterRole = recipe.projectile === 'cluster' ? child ? 'bomblet' : 'carrier' : undefined;
    const visual = presenter?.projectile(recipe, brand, clusterRole) ?? createProjectileVisual(recipe, brand, clusterRole);
    if (this.epoch !== epoch) { disposeVisual(visual); return; }
    visual.position.copy(origin);
    visual.quaternion.setFromUnitVectors(forward, aim);
    if (child && !clusterRole) visual.scale.multiplyScalar(.42);
    if (clusterRole) visual.userData.clusterRole = clusterRole;
    this.scene.add(visual);
    const speed = recipe.speed * (child ? .65 : 1);
    const splitDelay = !child && !clusterRole ? recipe.split?.delay : undefined;
    const projectile: Projectile = { impactId:++this.worldImpactSequence,visual, spec: recipe, velocity: aim.clone().multiplyScalar(speed), damage, age: 0, life: Math.min(10, distance / speed + 1), range: distance, traveled: 0, bounces: recipe.bounces, hits: new Set(), presenter, splitDelay, clusterRole, fuse: clusterRole || splitDelay !== undefined || recipe.projectile === 'sticky' ? undefined : recipe.fuse > 0 ? recipe.fuse : undefined };
    this.projectiles.add(projectile);
    const payloadElements = getWeaponElements(recipe).filter(element => element !== 'kinetic');
    if (!presenter && clusterRole !== 'bomblet' && payloadElements.length && ['orb', 'sticky', 'rocket', 'homing', 'cluster'].includes(recipe.projectile)) {
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
    return projectile;
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

  private trace(start: THREE.Vector3, end: THREE.Vector3, onlyCover = false, departingSurface?: THREE.Object3D, departingNormal?: THREE.Vector3): Collision | undefined {
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
      const intersections = this.ray.intersectObjects(meshes, false);
      intersection = !departingSurface ? intersections[0] : intersections.find(hit => {
        if (hit.object !== departingSurface || hit.distance > 1e-7 || !hit.face) return true;
        if (!departingNormal || this.ray.ray.direction.dot(departingNormal) <= 1e-8) return true;
        const probe = start.clone().addScaledVector(this.ray.ray.direction, 1e-5);
        if (this.insideCover(probe, departingSurface)) return true;
        const face = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
        // Plane back faces are valid double-sided contacts. Skip only the
        // zero-distance coplanar support being left, regardless of winding.
        return Math.abs(face.dot(departingNormal)) < .999999;
      });
    } finally { original.forEach((material, mesh) => { mesh.material = material; }); }
    if (!intersection) return undefined;
    const normal = intersection.face
      ? intersection.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(intersection.object.matrixWorld)).normalize()
      : this.ray.ray.direction.clone().negate();
    const exiting = normal.dot(this.ray.ray.direction) > 0;
    if (exiting) normal.negate();
    return { intersection, normal, exiting, target: this.bindings.get(intersection.object) };
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
    if(collision){const epoch=this.epoch;this.worldImpact(++this.worldImpactSequence,'contact',point,collision.normal,spec,damage,.3,collision.target?.id);if(this.epoch!==epoch)return;}
    if (collision) this.presentation?.impact({ point: point.clone(), normal: collision.normal.clone(), spec, radius: .3, target: collision.target?.root, phase: 'contact',energy:damage,hitSurface:collision.intersection.object });
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
      this.presentation?.impact({point:endpoint.clone(),normal:from.clone().sub(endpoint).normalize(),spec,radius:.22,target:candidate.root,phase:'contact',energy:damage*Math.pow(.58,hop),exposure:Math.pow(.58,hop)});
      if (!this.emit(candidate, endpoint, endpoint.clone().sub(from), damage * Math.pow(0.58, hop), spec)) return;
      if (getWeaponElements(spec).some(element => element !== 'kinetic')) this.flash(endpoint, spec, 0.40);
      hit.add(candidate.id);
      from = endpoint;
    }
  }

  private advance(projectile: Projectile, dt: number): void {
    if (projectile.clusterRole === 'bomblet') { this.advanceBomblet(projectile, dt); return; }
    const stepTime = dt;
    // Move the carrier up to its release time, even when a frame straddles it.
    if (projectile.splitDelay !== undefined) {
      if (projectile.splitDelay < 1e-7) { this.splitProjectile(projectile, projectile.visual.position, dt); return; }
      dt = Math.min(dt, projectile.splitDelay);
      projectile.splitDelay = Math.max(0, projectile.splitDelay - dt);
    }
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
      if (projectile.clusterRole === 'carrier') { this.deployCluster(projectile, projectile.visual.position); return; }
      if (projectile.splitDelay === undefined && projectile.spec.blastRadius > 0) this.explode(projectile, projectile.visual.position);
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
      if (travel <= 1e-7) {
        if (projectile.clusterRole === 'carrier') this.deployCluster(projectile, prior); else this.remove(projectile);
        return;
      }
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
        if (projectile.traveled >= projectile.range - 1e-7) {
          if (projectile.clusterRole === 'carrier') this.deployCluster(projectile, point);
          else { if (projectile.splitDelay === undefined && projectile.spec.blastRadius > 0) this.explode(projectile, point); this.remove(projectile); }
        }
        else if (projectile.splitDelay === 0) this.splitProjectile(projectile, point, stepTime - dt);
        return;
      }
      const target = collision.target;
      projectile.visualContact = { normal: collision.normal.clone(), target: target?.root,hitSurface:collision.intersection.object };
      if (projectile.clusterRole === 'carrier') {
        // A muzzle already inside solid cover cannot release a payload from
        // its far face. This invalid shot loses its budget instead of leaking.
        if (!target && collision.exiting && this.insideCover(prior, collision.intersection.object)) { this.remove(projectile); return; }
        projectile.clusterTargetId = target?.id;
        const contactTime = dt - remaining + prior.distanceTo(point) / Math.max(speed, 0.0001);
        this.deployCluster(projectile, this.clusterClearance(point, collision.normal, collision.intersection.object, EPSILON), Math.max(0, stepTime - contactTime));
        return;
      }
      this.worldImpact(projectile.impactId,'contact',point,collision.normal,projectile.spec,projectile.damage*(type==='sticky'?.20:1),.3,target?.id);
      if(!this.projectiles.has(projectile))return;
      projectile.presenter?.impact({point:point.clone(),normal:collision.normal.clone(),spec:projectile.spec,radius:.3,target:target?.root,phase:'contact',energy:projectile.damage*(type==='sticky'?.20:1),hitSurface:collision.intersection.object});
      if (!this.projectiles.has(projectile)) return;
      if (projectile.splitDelay !== undefined) {
        // Release on the near side of the surface. Children still sweep against
        // that surface, so neither their contacts nor splash can skip cover.
        const contactTime = dt - remaining + prior.distanceTo(point) / Math.max(speed, 0.0001);
        this.splitProjectile(projectile, point.clone().addScaledVector(collision.normal, EPSILON), Math.max(0, stepTime - contactTime));
        return;
      }
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

  /** An exiting triangle alone does not imply containment: roofs and planes
   * are double-sided. Check closed topology and ray parity only when needed. */
  private insideCover(point: THREE.Vector3, object: THREE.Object3D): boolean {
    if (!(object instanceof THREE.Mesh)) return false;
    const geometry = object.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return false;
    const local = object.worldToLocal(point.clone()), epsilon = 1e-7;
    if (!(local.x > box.min.x + epsilon && local.x < box.max.x - epsilon
      && local.y > box.min.y + epsilon && local.y < box.max.y - epsilon
      && local.z > box.min.z + epsilon && local.z < box.max.z - epsilon)) return false;
    let closed = this.closedCover.get(geometry);
    if (closed === undefined) {
      const positions = geometry.getAttribute('position'), indices = geometry.index;
      const edges = new Map<string, number>();
      const vertex = (index: number) => [positions.getX(index), positions.getY(index), positions.getZ(index)].map(value => Math.round(value * 1e6)).join(',');
      const count = indices?.count ?? positions.count;
      for (let index = 0; index + 2 < count; index += 3) {
        const triangle = [0, 1, 2].map(offset => vertex(indices ? indices.getX(index + offset) : index + offset));
        if (new Set(triangle).size < 3) continue;
        for (let side = 0; side < 3; side++) {
          const edge = [triangle[side], triangle[(side + 1) % 3]].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      closed = edges.size > 0 && [...edges.values()].every(count => count === 2);
      this.closedCover.set(geometry, closed);
    }
    if (!closed) return false;
    this.containmentRay.set(point, new THREE.Vector3(1, .312123, .197137).normalize());
    this.containmentRay.near = epsilon; this.containmentRay.far = Infinity;
    const material = object.material;
    try {
      object.material = this.collisionMaterial;
      const intersections = this.containmentRay.intersectObject(object, false);
      let count = 0, previous = -Infinity;
      for (const hit of intersections) if (hit.distance > epsilon && hit.distance - previous > epsilon) { count++; previous = hit.distance; }
      return count % 2 === 1;
    } finally { object.material = material; }
  }

  /** Clearance is swept as well as flight: a small spacing offset must not
   * teleport bomblets through an overhang or the other wall of a narrow gap. */
  private clusterClearance(point: THREE.Vector3, normal: THREE.Vector3, surface?: THREE.Object3D, distance: number = CLUSTER_MIRV.clearance): THREE.Vector3 {
    const end = point.clone().addScaledVector(normal, distance);
    const obstruction = this.trace(point, end, true, surface, normal);
    return obstruction ? point.clone().addScaledVector(normal, Math.max(0, point.distanceTo(obstruction.intersection.point) - EPSILON)) : end;
  }

  /** MIRV is a delivery lifecycle, independent of either elemental channel. */
  private deployCluster(projectile: Projectile, point: THREE.Vector3, remainingTime = 0): void {
    const split = projectile.spec.split;
    if (!this.projectiles.has(projectile)) return;
    const count = getDamagePacketCount(projectile.spec) - 1;
    if (!split || count < 2) { this.explode(projectile, point); this.remove(projectile); return; }
    const epoch = this.epoch, range = CLUSTER_MIRV.travelLimit;
    const packetDamage = projectile.damage / getDamagePacketCount(projectile.spec);
    const normal = projectile.visualContact?.normal.clone() ?? new THREE.Vector3(0, 1, 0);
    const incoming = projectile.velocity.clone();
    const seed = projectile.impactId;
    // The burst is a real, single splash packet. Never combine a direct hit with
    // another blast against the contacted target, and never grant blast crits.
    projectile.visual.position.copy(point); projectile.damage = packetDamage;
    this.explode(projectile, point);
    if (this.epoch !== epoch || !this.projectiles.has(projectile)) return;
    this.remove(projectile);
    const tangent = new THREE.Vector3().crossVectors(normal, Math.abs(normal.y) > .95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const drift = incoming.addScaledVector(normal, -incoming.dot(normal)).multiplyScalar(.05);
    const origin = this.clusterClearance(point, normal, projectile.visualContact?.hitSurface);
    const children: Projectile[] = [];
    const fuses = getClusterBombletFuseRange(projectile.spec);
    for (const plan of clusterBombletPlan(count, projectile.spec.blastRadius, seed, fuses)) {
      if (this.epoch !== epoch) break;
      const velocity = tangent.clone().multiplyScalar(Math.cos(plan.angle) * plan.radialSpeed)
        .addScaledVector(bitangent, Math.sin(plan.angle) * plan.radialSpeed).add(drift);
      velocity.y += plan.lift;
      velocity.addScaledVector(normal, Math.max(0, 1.2 - velocity.dot(normal)));
      const child = this.spawnProjectile(origin, velocity.clone().normalize(), projectile.spec, packetDamage, range, projectile.presenter, true);
      if (!child) continue;
      child.velocity.copy(velocity); child.fuse = plan.fuse; child.life = Math.min(plan.fuse + .1, Math.max(.05, 16 - projectile.age));
      child.bounces = CLUSTER_MIRV.bounces; child.clusterSurface = projectile.visualContact?.hitSurface; child.clusterNormal = normal.clone();
      child.visual.userData.clusterInitialFuse = plan.fuse;
      child.visual.userData.clusterFuse = plan.fuse;
      children.push(child);
    }
    for (const child of children) if (remainingTime > 1e-7 && this.projectiles.has(child)) {
      this.advance(child, remainingTime);
      if (this.projectiles.has(child)) child.presenter?.updateProjectile?.(child.visual, remainingTime, child.age);
    }
  }

  private advanceBomblet(projectile: Projectile, dt: number): void {
    const elapsed = Math.min(dt, Math.max(0, projectile.fuse ?? 0));
    projectile.age += elapsed; projectile.life -= elapsed;
    let remaining = elapsed, rangeExpired = false;
    // Exact constant-acceleration endpoints; swept real meshes own contacts.
    // There is deliberately no invented y=0 floor or explosion on a bounce.
    for (let impact = 0; impact < 6 && remaining > 1e-8 && !projectile.stuck && this.projectiles.has(projectile); impact++) {
      const prior = projectile.visual.position.clone(), velocity = projectile.velocity.clone();
      const end = prior.clone().addScaledVector(velocity, remaining);
      end.y -= .5 * CLUSTER_MIRV.gravity * remaining * remaining;
      const distance = prior.distanceTo(end), available = Math.max(0, projectile.range - projectile.traveled);
      if (available < 1e-7) { rangeExpired = true; break; }
      const travelFraction = distance > available ? available / distance : 1;
      end.lerpVectors(prior, end, travelFraction);
      const collision = this.trace(prior, end, false, projectile.clusterSurface, projectile.clusterNormal);
      if (collision && !collision.target && collision.exiting && this.insideCover(prior, collision.intersection.object)) { this.remove(projectile); return; }
      const point = collision?.intersection.point ?? end;
      const fraction = prior.distanceTo(end) > 1e-8 ? Math.min(1, prior.distanceTo(point) / prior.distanceTo(end)) : 1;
      const consumed = remaining * travelFraction * fraction;
      projectile.traveled += prior.distanceTo(point);
      projectile.visual.position.copy(point);
      projectile.velocity.copy(velocity); projectile.velocity.y -= CLUSTER_MIRV.gravity * consumed;
      this.trail(prior, point, projectile.spec, projectile.presenter ?? null, 'bomblet');
      if (!this.projectiles.has(projectile)) return;
      if (!collision) {
        if (travelFraction < 1) rangeExpired = true;
        break;
      }
      remaining = Math.max(0, remaining - consumed);
      const normal = collision.normal;
      const outward = Math.min(0, projectile.velocity.dot(normal));
      const normalVelocity = normal.clone().multiplyScalar(outward);
      projectile.velocity.sub(normalVelocity).multiplyScalar(CLUSTER_MIRV.friction)
        .addScaledVector(normalVelocity, -CLUSTER_MIRV.restitution);
      projectile.visual.position.copy(this.clusterClearance(point, normal, collision.intersection.object));
      projectile.clusterSurface = collision.intersection.object; projectile.clusterNormal = normal.clone();
      projectile.bounces--;
      if (!collision.target && normal.y >= .7 && (projectile.velocity.length() <= CLUSTER_MIRV.restSpeed || projectile.bounces <= 0)) {
        projectile.stuck = {}; projectile.velocity.set(0, 0, 0);
        projectile.visualContact = { normal: normal.clone(), hitSurface: collision.intersection.object };
      }
    }
    if (!this.projectiles.has(projectile)) return;
    projectile.fuse = Math.max(0, (projectile.fuse ?? 0) - elapsed);
    projectile.visual.userData.clusterFuse = projectile.fuse;
    projectile.visual.userData.clusterSettled = !!projectile.stuck;
    if (rangeExpired || projectile.fuse <= 1e-8 || projectile.life <= 0 || projectile.age >= 16) {
      this.explode(projectile, projectile.visual.position); this.remove(projectile);
    }
  }

  private splitProjectile(projectile: Projectile, point: THREE.Vector3, remainingTime = 0): void {
    const split = projectile.spec.split;
    if (!split || !this.projectiles.has(projectile)) return;
    const range = projectile.range - projectile.traveled;
    const directions = ballisticPelletDirections(projectile.velocity, split.count, split.spread);
    const epoch = this.epoch;
    this.remove(projectile);
    this.flash(point, projectile.spec, .3, projectile.presenter ?? null);
    if (range <= 1e-7) return;
    // Reuse the captured recipe and presenter. Resource costs were paid by the
    // original shot; child damage divides its budget and never splits again.
    const children: Projectile[] = [];
    for (const aim of directions) {
      if (this.epoch !== epoch) break;
      const child = this.spawnProjectile(point, aim, projectile.spec, projectile.damage / split.count, range, projectile.presenter, true);
      if (child) children.push(child);
    }
    // The release does not consume the rest of the simulation step. New
    // children are absent from update()'s snapshot, so advance them here once.
    for (const child of children) if (remainingTime > 1e-7 && this.projectiles.has(child)) {
      this.advance(child, remainingTime);
      if (this.projectiles.has(child)) child.presenter?.updateProjectile?.(child.visual, remainingTime, child.age);
    }
  }

  private explode(projectile: Projectile, point: THREE.Vector3, excludeId?: number, multiplier = 1): void {
    if (!this.projectiles.has(projectile)) return;
    const radius = projectile.spec.blastRadius;
    const stage = projectile.clusterRole === 'carrier' ? 'cluster-burst' : projectile.clusterRole === 'bomblet' ? 'bomblet' : undefined;
    this.worldImpact(projectile.impactId,'detonate',point,projectile.visualContact?.normal??new THREE.Vector3(0,1,0),projectile.spec,projectile.damage*multiplier,Math.max(.35,radius),projectile.stuck?.targetId ?? projectile.clusterTargetId,stage);
    if(!this.projectiles.has(projectile))return;
    projectile.presenter?.impact({point:point.clone(),normal:projectile.visualContact?.normal.clone()??new THREE.Vector3(0,1,0),spec:projectile.spec,radius:Math.max(.35,radius),target:projectile.visualContact?.target,phase:'detonate',energy:projectile.damage*multiplier,hitSurface:projectile.visualContact?.hitSurface,...(stage?{stage}:{})});
    if (!this.projectiles.has(projectile)) return;
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
      if(projectile.presenter?.splash&&amount>0&&Number.isFinite(amount)&&this.callbacks.targets().some(candidate=>candidate.id===target.id))projectile.presenter.splash({point:closest.clone(),normal:offset.lengthSq()>1e-8?offset.clone().negate().normalize():projectile.visualContact?.normal.clone()??new THREE.Vector3(0,1,0),origin:point.clone(),spec:projectile.spec,radius,target:target.root,phase:'contact',energy:amount,exposure:Math.max(0,Math.min(1,amount/projectile.damage)),primary:target.root===projectile.visualContact?.target});
      if(!this.projectiles.has(projectile))return;
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

  private trail(start: THREE.Vector3, end: THREE.Vector3, spec: VisualRecipe, presenter: BallisticPresentation | null | undefined = this.presentation, role?: 'carrier' | 'bomblet'): void {
    if (start.distanceToSquared(end) < 0.00001) return;
    const epoch = this.epoch;
    const visual = presenter?.trail(start,end,spec,spec.visualBrand??'ironvale',role) ?? createProjectileTrail(start, end, spec, spec.visualBrand,role);
    if (this.epoch !== epoch) { disposeVisual(visual); return; }
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
