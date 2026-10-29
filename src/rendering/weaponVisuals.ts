import * as THREE from 'three';
import { brands, elementColors, getWeaponElements, type BrandId, type WeaponSpec } from '../core/arsenal';

const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1);
export function shotMaterial(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: true, depthWrite: false, toneMapped: false });
}
function colors(spec: WeaponSpec, brand: BrandId) {
  const elements = getWeaponElements(spec).filter(element => element !== 'kinetic');
  const primary = new THREE.Color(elementColors[elements[0] ?? 'kinetic']);
  const secondary = elements[1] ? new THREE.Color(elementColors[elements[1]]) : primary.clone().lerp(new THREE.Color(0xffffff), .55);
  const metal = new THREE.Color(brands[brand].color).lerp(new THREE.Color(0x70818a), .62);
  return { primary, secondary, metal };
}
function metadata(root: THREE.Group, spec: WeaponSpec, brand: BrandId): void {
  root.userData.comicOverlay = true;
  root.userData.projectile = spec.projectile; root.userData.trail = spec.trail ?? 'tracer';
  root.userData.weaponType = spec.weaponType ?? 'rifle'; root.userData.visualVariant = spec.visualVariant ?? 0;
  root.userData.element = spec.element; root.userData.secondaryElement = spec.secondaryElement; root.userData.brand = brand;
}
function mesh(root: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material); result.name = name; result.raycast = () => {}; root.add(result); return result;
}
function tube(root: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, name = 'flight-core'): THREE.Mesh {
  const delta = b.clone().sub(a);
  const result = mesh(root, new THREE.CylinderGeometry(radius, radius, Math.max(.0001, delta.length()), 5), material, name);
  result.position.copy(a).addScaledVector(delta, .5); result.quaternion.setFromUnitVectors(UP, delta.normalize()); return result;
}
function trimUnused(root: THREE.Group, materials: THREE.Material[]): void {
  for (const material of materials) if (!root.children.some(child => child instanceof THREE.Mesh && child.material === material)) material.dispose();
}

/** Delivery supplies the silhouette. Element cartridges tint only the tip/core and payload. */
export function createProjectileVisual(spec: WeaponSpec, brand: BrandId = 'ironvale'): THREE.Group {
  const root = new THREE.Group(); root.name = `player-projectile-${spec.projectile}`; metadata(root, spec, brand);
  const c = colors(spec, brand), metal = shotMaterial(c.metal), bright = shotMaterial(c.primary), core = shotMaterial(c.secondary);
  const type = spec.projectile, variant = spec.visualVariant ?? 0;
  const familyScale = ({ pistol: .8, smg: .7, rifle: 1, shotgun: .82, sniper: 1.3, launcher: 1.45 } as const)[spec.weaponType ?? 'rifle'];
  root.scale.setScalar(familyScale);
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material = bright, name = 'projectile-payload') => mesh(root, geometry, material, name);
  if (type === 'cluster') {
    const pods = Math.max(2, Math.min(12, Math.floor(Number.isFinite(spec.split?.count) ? spec.split!.count : 6)));
    add(new THREE.CylinderGeometry(.042, .042, .38, 6), metal, 'cluster-carrier-spine').rotation.x = Math.PI / 2;
    for (let i = 0; i < pods; i++) {
      const angle = i / pods * Math.PI * 2;
      const pod = add(new THREE.CylinderGeometry(.036, .036, .30 + variant * .015, 5), metal, 'cluster-submunition-casing');
      pod.rotation.x = Math.PI / 2; pod.position.set(Math.cos(angle) * .08, Math.sin(angle) * .08, 0);
      const tip = add(new THREE.ConeGeometry(.036, .075, 5), i % 2 ? bright : core, 'cluster-submunition-tip');
      tip.rotation.x = Math.PI / 2; tip.position.set(pod.position.x, pod.position.y, .19 + variant * .0075);
    }
    for (const z of [-.10, .09]) { const band = add(new THREE.TorusGeometry(.12, .013, 4, 12), metal, 'cluster-separation-band'); band.position.z = z; }
  } else if (type === 'rocket' || type === 'homing') {
    add(new THREE.CylinderGeometry(.065, .075, .32 + variant * .035, 6), metal, 'ordnance-casing').rotation.x = Math.PI / 2;
    const nose = add(new THREE.ConeGeometry(.075, .18, 6), core, 'elemental-warhead'); nose.rotation.x = Math.PI / 2; nose.position.z = .24;
    for (let i = 0; i < (brand === 'kestrel' ? 3 : brand === 'cindergrid' ? 4 : 2); i++) {
      const angle = i * Math.PI * 2 / (brand === 'kestrel' ? 3 : brand === 'cindergrid' ? 4 : 2);
      const fin = add(new THREE.BoxGeometry(.18, .025, .15), metal, 'guidance-fin'); fin.position.set(Math.cos(angle) * .075, Math.sin(angle) * .075, -.09); fin.rotation.z = angle;
    }
    const exhaust = add(new THREE.ConeGeometry(.055, .22, 6), bright, 'engine-exhaust'); exhaust.rotation.x = -Math.PI / 2; exhaust.position.z = -.26;
    if (type === 'homing') {
      const seeker = add(new THREE.TorusGeometry(.10, .012, 4, 10), core, 'homing-seeker-ring'); seeker.position.z = .07;
    } else {
      const nozzle = add(new THREE.CylinderGeometry(.09, .08, .07, 6), metal, 'rocket-thrust-nozzle'); nozzle.rotation.x = Math.PI / 2; nozzle.position.z = -.19;
    }
  } else if (type === 'disc' || type === 'ricochet') {
    const radius = type === 'disc' ? .16 : .08;
    add(new THREE.CylinderGeometry(radius, radius, .035, variant % 2 ? 6 : 12), metal, 'ricochet-carrier');
    add(new THREE.TorusGeometry(radius * .95, .018, 4, 12), core, 'elemental-disc-rim').rotation.x = Math.PI / 2;
    for (let i = 0; i < 3 + variant; i++) {
      const angle = i / (3 + variant) * Math.PI * 2;
      const tooth = add(new THREE.BoxGeometry(.055, .02, .045), bright, 'disc-tooth'); tooth.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius); tooth.rotation.y = -angle;
    }
  } else if (type === 'spike') {
    const shaft = add(new THREE.CylinderGeometry(.023, .028, .36 + variant * .04, 5), metal, 'spike-shaft'); shaft.rotation.x = Math.PI / 2;
    const tip = add(new THREE.ConeGeometry(.055, .22, 5), core, 'spike-element-tip'); tip.rotation.x = Math.PI / 2; tip.position.z = .24;
  } else if (type === 'orb') {
    add(new THREE.IcosahedronGeometry(.15, variant % 2), bright, 'orb-core');
    for (let i = 0; i < 1 + variant % 3; i++) {
      const orbit = add(new THREE.TorusGeometry(.22 + i * .025, .014, 4, 16, Math.PI * 1.6), i % 2 ? bright : core, 'orb-orbit'); orbit.rotation.set(i * .9, i * .65, .35 + i);
    }
  } else if (type === 'sticky') {
    add(new THREE.IcosahedronGeometry(.09, 0), metal, 'sticky-charge-casing');
    for (const side of [-1, 1]) { const node = add(new THREE.IcosahedronGeometry(.065, 1), side < 0 ? bright : core, 'adhesive-payload'); node.position.x = side * .065; }
  } else if (type === 'slug') {
    add(new THREE.BoxGeometry(.065, .065, .28 + variant * .04), metal, 'slug-jacket');
    const tip = add(new THREE.DodecahedronGeometry(.085, 0), core, 'slug-impact-core'); tip.position.z = .16;
  } else {
    const pellet = type === 'scatter';
    add(new THREE.BoxGeometry(pellet ? .034 : .027, pellet ? .034 : .027, pellet ? .12 : .24 + variant * .025), metal, 'ballistic-jacket');
    const tip = add(new THREE.ConeGeometry(pellet ? .025 : .028, pellet ? .055 : .10, 5), core, 'elemental-tracer-tip'); tip.rotation.x = Math.PI / 2; tip.position.z = pellet ? .085 : .17;
    if (variant === 3) { const band = add(new THREE.TorusGeometry(.04, .009, 4, 8), bright, 'tracer-stabilizer'); band.position.z = -.035; }
  }
  trimUnused(root, [metal, bright, core]); return root;
}

/** Geometry and motion style are independent of the payload's damage color. */
export function createProjectileTrail(start: THREE.Vector3, end: THREE.Vector3, spec: WeaponSpec, brand: BrandId = 'ironvale'): THREE.Group {
  const root = new THREE.Group(); root.name = 'player-projectile-trail'; metadata(root, spec, brand);
  const delta = end.clone().sub(start), distance = delta.length(), direction = delta.clone().normalize();
  const c = colors(spec, brand), primary = shotMaterial(c.primary, .74), secondary = shotMaterial(c.secondary, .85);
  const type = spec.projectile, style = spec.trail ?? 'tracer', variant = spec.visualVariant ?? 0;
  const energy = type === 'orb' || type === 'sticky' || type === 'rocket' || type === 'cluster';
  const radius = (type === 'scatter' ? .007 : type === 'slug' || type === 'spike' ? .014 : energy ? .026 : .009) * (1 + variant * .1);
  const side = new THREE.Vector3().crossVectors(direction, Math.abs(direction.y) > .95 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
  const up = new THREE.Vector3().crossVectors(side, direction).normalize();
  if (style === 'clean') {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), new THREE.LineBasicMaterial({ color: c.primary, opacity: .28, transparent: true, depthTest: true, depthWrite: false })); line.raycast = () => {}; root.add(line);
  } else if (style === 'helix') {
    const loops = energy ? 1.3 : 1.8, amplitude = energy ? .11 : .045;
    for (let strand = 0; strand < (spec.secondaryElement ? 2 : 1); strand++) {
      const points = Array.from({ length: 7 }, (_, i) => {
        const t = i / 6, angle = (start.dot(direction) + distance * t) * loops * 10 + variant * .7 + strand * Math.PI;
        return start.clone().addScaledVector(delta, t).addScaledVector(side, Math.cos(angle) * amplitude).addScaledVector(up, Math.sin(angle) * amplitude);
      });
      for (let i = 1; i < points.length; i++) tube(root, points[i - 1], points[i], radius, strand ? secondary : primary, 'helical-trail');
    }
  } else if (style === 'ribbon') {
    const points = Array.from({ length: 5 }, (_, i) => {
      const t = i / 4; return start.clone().addScaledVector(delta, t).addScaledVector(side, Math.sin((start.dot(direction) + distance * t) * 9 + variant) * (energy ? .15 : .065));
    });
    for (let i = 1; i < points.length; i++) tube(root, points[i - 1], points[i], radius * 1.3, i % 2 ? primary : secondary, 'ribbon-trail');
  } else {
    tube(root, start, end, radius, primary);
    if (style === 'pulse') {
      for (const t of [.2, .7]) { const ring = mesh(root, new THREE.TorusGeometry(energy ? .10 : .045, .008, 4, 10), secondary, 'pulse-ring'); ring.position.copy(start).addScaledVector(delta, t); ring.quaternion.setFromUnitVectors(FORWARD, direction); }
    } else if (style === 'comet' || energy) {
      for (const [index, t] of [.25, .60, .9].entries()) {
        const geometry = type === 'rocket' ? new THREE.ConeGeometry(.05, .12, 5) : type === 'sticky' || type === 'orb' ? new THREE.IcosahedronGeometry(.045 + index * .01, 0) : new THREE.OctahedronGeometry(.028, 0);
        const fleck = mesh(root, geometry, index % 2 ? primary : secondary, 'payload-wake'); fleck.position.copy(start).addScaledVector(delta, t); fleck.quaternion.setFromUnitVectors(UP, direction);
      }
    } else if (spec.secondaryElement) {
      tube(root, start.clone().addScaledVector(side, .018), end.clone().addScaledVector(side, .018), radius * .65, secondary, 'secondary-payload-trace');
    }
  }
  trimUnused(root, [primary, secondary]); return root;
}

export function createBeamVisual(start: THREE.Vector3, end: THREE.Vector3, spec: WeaponSpec, jagged: boolean, brand: BrandId = 'ironvale'): THREE.Group {
  const root = new THREE.Group(); root.name = jagged ? 'player-arc-chain' : 'player-ray-beam'; metadata(root, spec, brand);
  const delta = end.clone().sub(start), direction = delta.clone().normalize(), c = colors(spec, brand);
  const side = new THREE.Vector3().crossVectors(direction, Math.abs(direction.y) > .95 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
  const up = new THREE.Vector3().crossVectors(side, direction).normalize();
  const primary = shotMaterial(c.primary, .9), secondary = shotMaterial(c.secondary, .84), halo = shotMaterial(c.primary, .10);
  const variant = spec.visualVariant ?? 0, style = spec.trail ?? 'tracer';
  const segments = jagged ? 8 : style === 'helix' || style === 'ribbon' ? 14 : 1;
  const strands = spec.secondaryElement ? 2 : 1;
  for (let strand = 0; strand < strands; strand++) {
    const points = Array.from({ length: segments + 1 }, (_, i) => {
      const t = i / segments, endpoint = i === 0 || i === segments;
      const angle = t * (3 + variant) * Math.PI * 2 + variant + strand * Math.PI;
      const amplitude = jagged ? (endpoint ? 0 : .12 + variant * .025) : style === 'helix' ? .09 : style === 'ribbon' ? .15 : strands > 1 ? .025 : 0;
      const point = start.clone().addScaledVector(delta, t);
      point.addScaledVector(side, Math.sin(jagged ? i * (2.4 + variant * .2) : angle) * amplitude);
      if (style === 'helix' && !jagged) point.addScaledVector(up, Math.cos(angle) * amplitude);
      return point;
    });
    for (let i = 1; i < points.length; i++) {
      tube(root, points[i - 1], points[i], jagged ? .017 : .021, strand ? secondary : primary, 'beam-core');
      if (strand === 0 && style !== 'clean') tube(root, points[i - 1], points[i], jagged ? .055 : .065, halo, 'beam-halo');
    }
  }
  if (style === 'pulse' || brand === 'rebound') for (const t of [.2, .45, .7]) {
    const ring = mesh(root, new THREE.TorusGeometry(.11 + variant * .015, .012, 4, 12), secondary, 'beam-pulse-ring'); ring.position.copy(start).addScaledVector(delta, t); ring.quaternion.setFromUnitVectors(FORWARD, direction);
  }
  trimUnused(root, [primary, secondary, halo]); return root;
}
