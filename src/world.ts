import * as THREE from 'three';
import { createBandTexture, createPaintTexture, createComicToonMaterial, type PaintFinish } from './rendering/materials';
import { createGroundMaterial } from './rendering/ground';
import { createCheckpointStation, type CheckpointStationVisual } from './rendering/checkpointStation';
import { CHECKPOINTS, type CheckpointId } from './core/checkpoints';
import { createProgression } from './core/index';
import { resolveEquipmentAppearance } from './core/appearance';
import { createEquipmentCharacter } from './rendering/equipmentModels';
import { createVendingMachine, vendingPlacements } from './rendering/vendingMachines';
import type { VendingType } from './core/vending';
import { createWeaponWorkbenchStation } from './rendering/weaponWorkbenchStation';
import { createEncounterObjective, type EncounterObjectiveVisual } from './rendering/encounterObjectives';
import { ENCOUNTER } from './encounter/encounter';
import type { TraversalCollider } from './core/ledgeClimb';
import type {EffectBounds} from './core/effects/contracts';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type ZoneId = 'yard' | 'vault' | 'badlands';

export interface Zone {
  id: ZoneId;
  name: string;
  subtitle: string;
  allowed: 'both' | 'pilot' | 'mech';
  bounds: Bounds;
}

export const zones: Zone[] = [
  {
    id: 'vault',
    name: 'SERVICE VAULT',
    subtitle: 'Close quarters · pilot access',
    allowed: 'pilot',
    bounds: { minX: -90, maxX: -35, minZ: -55, maxZ: 55 },
  },
  {
    id: 'yard',
    name: 'PROVING GROUND',
    subtitle: 'Mixed access · live-fire sandbox',
    allowed: 'both',
    bounds: { minX: -35, maxX: 35, minZ: -55, maxZ: 55 },
  },
  {
    id: 'badlands',
    name: 'HEAVY RANGE',
    subtitle: 'Heavy fire · mech access',
    allowed: 'mech',
    bounds: { minX: 35, maxX: 90, minZ: -55, maxZ: 55 },
  },
];

export function getZone(x: number, _z: number): Zone {
  return x < -35 ? zones[0] : x > 35 ? zones[2] : zones[1];
}

export function isWalkable(x: number, z: number, radius: number, colliders: Bounds[]): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) return false;
  if (x - radius < -90 || x + radius > 90 || z - radius < -55 || z + radius > 55) return false;
  return !colliders.some((b) => x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ);
}

/** Existing measured traversal solids, including overheads. Unknown heights stay blocking walls. */
export function effectWorldSolids(colliders:readonly TraversalCollider[]):EffectBounds[]{
  return [...colliders.map(b=>({...b,minY:b.minY??-Infinity,maxY:b.maxY??Infinity})),
    {minX:-Infinity,maxX:-90,minY:-Infinity,maxY:Infinity,minZ:-Infinity,maxZ:Infinity},
    {minX:90,maxX:Infinity,minY:-Infinity,maxY:Infinity,minZ:-Infinity,maxZ:Infinity},
    {minZ:-Infinity,maxZ:-55,minY:-Infinity,maxY:Infinity,minX:-Infinity,maxX:Infinity},
    {minZ:55,maxZ:Infinity,minY:-Infinity,maxY:Infinity,minX:-Infinity,maxX:Infinity}];
}

/** Lifted actors can stand/walk on measured tops; unmeasured footprints remain walls. */
export function navigationAtHeight(colliders:readonly TraversalCollider[],feet:number,height:number):Bounds[]{
  return colliders.filter(b=>(b.maxY??Infinity)>feet+.001&&(b.minY??-Infinity)<feet+height-.001);
}

const INK = 0x221c23;
const SAND = 0xd99a44;
const TEAL = 0x167f89;
const RUST = 0xd54d2e;
const CREAM = 0xf5dea4;
const GOLD = 0xffc23f;

function gradientTexture(): THREE.DataTexture {
  return createBandTexture();
}

function toon(color: number, gradient: THREE.DataTexture, map?: THREE.Texture): THREE.MeshToonMaterial {
  return createComicToonMaterial({ color, gradientMap: gradient, map: map ?? null });
}

function outlinedMesh(geometry: THREE.BufferGeometry, material: THREE.Material, _outline = true): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Real hard normals match the flat polygon used by lighting and shadow bias. */
function facetedCylinder(topRadius: number, bottomRadius: number, height: number, sides: number): THREE.BufferGeometry {
  const indexed = new THREE.CylinderGeometry(topRadius, bottomRadius, height, sides, 1);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

/** An original six-metre industrial frame. Its visual front points toward +Z. */
export function createMech(color?: number): THREE.Group {
  const appearance = resolveEquipmentAppearance(createProgression(), 'mech');
  if (color !== undefined) {
    for (const descriptor of Object.values(appearance)) {
      descriptor.primary = color;
      descriptor.key += `:paint:${color}`;
    }
  }
  return createEquipmentCharacter('mech', appearance);
}

export function createWorld(scene: THREE.Scene): {
  colliders: Bounds[];
  traversalColliders: TraversalCollider[];
  effectColliders: EffectBounds[];
  parkedMech: THREE.Group;
  occluders: THREE.Object3D[];
  checkpointStations: Map<CheckpointId, CheckpointStationVisual>;
  vendingMachines: { id: VendingType; group: THREE.Group; position: THREE.Vector3 }[];
  weaponWorkbench: THREE.Group;
  encounterObjectives: { id: string; kind: 'relay' | 'extract'; visual: EncounterObjectiveVisual }[];
  dispose: () => void;
} {
  const root = new THREE.Group();
  root.name = 'proving-ground';
  scene.add(root);
  const colliders: Bounds[] = [];
  const traversalColliders: TraversalCollider[] = [];
  const heightMapped = new Set<Bounds>();
  const occluders: THREE.Object3D[] = [];
  const checkpointStations = new Map<CheckpointId, CheckpointStationVisual>();
  const vendingMachines: { id: VendingType; group: THREE.Group; position: THREE.Vector3 }[] = [];
  const encounterObjectives: { id: string; kind: 'relay' | 'extract'; visual: EncounterObjectiveVisual }[] = [];
  const gradient = gradientTexture();
  const materials = new Map<string, THREE.MeshToonMaterial>();
  const textures: THREE.Texture[] = [gradient];
  const paint = new Map<PaintFinish, THREE.CanvasTexture>();
  for (const finish of ['armor', 'rock', 'ground'] as const) {
    const texture = createPaintTexture(finish, finish === 'armor' ? 91 : finish === 'rock' ? 37 : 12);
    if (finish === 'ground') texture.repeat.set(42, 34);
    if (finish === 'rock') texture.repeat.set(1.5, 1.4);
    paint.set(finish, texture);
    textures.push(texture);
  }
  const material = (color: number, finish: PaintFinish | 'plain' = 'armor') => {
    const key = `${color}:${finish}`;
    if (!materials.has(key)) materials.set(key, toon(color, gradient, finish === 'plain' || color === INK ? undefined : paint.get(finish)));
    return materials.get(key)!;
  };
  function box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, solid = true, outline = true, climbable = solid): THREE.Mesh {
    const mesh = outlinedMesh(new THREE.BoxGeometry(w, h, d), material(color, h < 0.25 ? 'plain' : 'armor'), outline);
    mesh.position.set(x, y, z);
    root.add(mesh);
    const bounds = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
    if (solid || climbable) traversalColliders.push({ ...bounds, minY: y - h / 2, maxY: y + h / 2, climbable });
    if (solid) {
      colliders.push(bounds); heightMapped.add(bounds);
      occluders.push(mesh);
    }
    return mesh;
  }
  function gate(
    name: 'yard' | 'pilot' | 'mech',
    crown: readonly [x: number, y: number, z: number, width: number, height: number, depth: number],
    posts: readonly (readonly [x: number, z: number, width: number, depth: number])[],
    color: number,
  ): void {
    // Derive both posts from the crown underside: the solids meet at a single
    // boundary, so their exterior faces never overlap or leave a floating beam.
    const [x, y, z, width, height, depth] = crown;
    const postHeight = y - height / 2;
    posts.forEach(([px, pz, pw, pd], index) => {
      box(px, postHeight / 2, pz, pw, postHeight, pd, color).name = `${name}-gate-post-${index === 0 ? 'left' : 'right'}`;
    });
    box(x, y, z, width, height, depth, INK, false).name = `${name}-gate-beam`;
    traversalColliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2,
      maxZ: z + depth / 2, minY: y - height / 2, maxY: y + height / 2, climbable: false });
  }
  function cylinder(x: number, y: number, z: number, radius: number, height: number, color: number, sides = 8, solid = false) {
    const mesh = outlinedMesh(facetedCylinder(radius, radius * 1.05, height, sides), material(color, height < 0.3 ? 'plain' : 'armor'));
    mesh.position.set(x, y, z);
    root.add(mesh);
    if (solid) {
      colliders.push({ minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius });
      occluders.push(mesh);
    }
    return mesh;
  }
  function sign(text: string, small: string, x: number, y: number, z: number, width: number, height: number, rotationY = 0, color = INK) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#f2dfb5';
    ctx.lineWidth = 8;
    ctx.strokeRect(18, 18, 988, 348);
    ctx.fillStyle = '#f2dfb5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${text.length > 17 ? 64 : 82}px Arial, sans-serif`;
    ctx.fillText(text, 512, 158, 930);
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillStyle = '#e7b948';
    ctx.fillText(small, 512, 266, 930);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    root.add(mesh);
    return mesh;
  }

  scene.background = new THREE.Color(0xefbd80);
  scene.fog = new THREE.Fog(0xefbd80, 115, 285);
  const hemi = new THREE.HemisphereLight(0xffe5bb, 0x382538, 0.48);
  const sun = new THREE.DirectionalLight(0xffe1a3, 1.65);
  sun.name = 'world-sun';
  sun.position.set(-45, 75, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 65, bottom: -65, near: 0.5, far: 200 });
  // Small offsets prevent self-shadow speckling without separating ground
  // contact. The previous offsets exceeded several shadow-map texels.
  sun.shadow.normalBias = 0.02;
  sun.shadow.bias = -0.00005;
  root.add(hemi, sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(450, 360), createGroundMaterial({ color: SAND, gradientMap: gradient, map: paint.get('ground')! }));
  ground.name = 'terrain-surface';
  ground.userData.surface = 'One y=0 surface; roads, hazards, dashes and pads are albedo paint only.';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
  occluders.push(ground);

  // Main landmark: a weathered test-range gantry, with open sightlines beneath it.
  gate('yard', [0, 10.7, -42, 26, 1.2, 1.6], [[-12, -42, 1.4, 1.6], [12, -42, 1.4, 1.6]], RUST);
  box(0, 8.6, -42, 21, 3.9, 0.7, TEAL, false);
  sign('FIELD TEST / 01', 'PROTOTYPE DIVISION — LIVE FIRE', 0, 8.65, -41.61, 20.4, 3.5);
  sign('CLEAR / REBUILD / REPEAT', 'NO STORY. JUST SYSTEMS.', 0, 4.8, -45, 15, 2.5, 0, RUST);

  // Industrial cover stays out of the spawn, central cross-route, and zone gates.
  box(-15, 1.6, -10, 7.5, 3.2, 4.1, TEAL);
  box(-15, 3.28, -10, 7.8, 0.18, 4.4, INK, false, true, true);
  box(-18, 1.25, -9.98, 0.14, 2.05, 4.22, CREAM, false);
  box(15, 1.6, -22, 8.5, 3.2, 4.1, RUST);
  box(15, 3.28, -22, 8.8, 0.18, 4.4, INK, false, true, true);
  sign('02', 'RANGE SUPPLY', 15, 1.9, -19.91, 2.4, 1.8);
  box(-20, 0.65, 22, 5, 1.3, 2.4, 0x867d64);
  box(23, 0.65, 17, 4.5, 1.3, 2.4, TEAL);
  box(24, 0.65, -5, 5.5, 1.3, 2.4, 0x867d64);
  for (const [x, z] of [[-23, -28], [-20, -31], [20, 31], [23, 33]]) {
    cylinder(x, 0.85, z, 0.65, 1.7, RUST, 10, true);
    cylinder(x, 0.95, z, 0.675, 0.13, INK, 10);
  }

  // Both pads are paint on the terrain; the parked frame hides independently.
  const parkedMech = createMech();
  parkedMech.position.set(6, 0, 8);
  parkedMech.rotation.y = -0.45;
  root.add(parkedMech);
  sign('FRAME / READY', 'F — EMBARK', 6, 1.0, 13, 4.4, 1.4);
  const serviceTerminal = box(-3.8, 0.75, 15, 1.5, 1.5, 0.9, TEAL);
  serviceTerminal.userData.serviceTerminal = true;
  box(-3.8, 0.13, 15, 1.75, 0.26, 1.1, INK, false);
  sign('SERVICE / TRADE', 'E — REPAIR / EQUIPMENT', -3.8, 1.35, 15.49, 1.4, 0.6);

  const bench = createWeaponWorkbenchStation();
  const weaponWorkbench = bench.group;
  weaponWorkbench.position.set(-6, 0, 22);
  weaponWorkbench.rotation.y = Math.atan2(6, -6);
  root.add(weaponWorkbench);
  weaponWorkbench.updateWorldMatrix(true, true);
  const benchBounds = new THREE.Box3().setFromObject(weaponWorkbench);
  colliders.push({ minX: benchBounds.min.x, maxX: benchBounds.max.x, minZ: benchBounds.min.z, maxZ: benchBounds.max.z });
  weaponWorkbench.traverse(object => { if (object instanceof THREE.Mesh) occluders.push(object); });
  textures.push(...bench.textures);

  // The vault is physically human-scaled, with small service cells and low cover.
  gate('pilot', [-35, 4.1, 0, 1.3, 0.8, 23], [[-35, -10.5, 1.3, 2], [-35, 10.5, 1.3, 2]], TEAL);
  sign('PILOT ACCESS', 'SERVICE VAULT / 02', -34.23, 3.1, 0, 12, 1.8, Math.PI / 2);
  box(-67, 1.8, -31, 34, 3.6, 1, TEAL);
  box(-83.5, 1.8, -18, 1, 3.6, 25, TEAL);
  box(-50.5, 1.8, -23, 1, 3.6, 15, TEAL);
  box(-73, 1.8, -5.5, 22, 3.6, 1, TEAL);
  box(-73, 1.5, -18, 1, 3, 12, 0x8c694f);
  box(-60, 0.55, -17, 5, 1.1, 2, RUST);
  box(-57, 0.55, 18, 4.6, 1.1, 2.5, TEAL);
  box(-73, 0.7, 27, 8, 1.4, 3, 0x8c694f);
  sign('SERVICE VAULT', 'RESTRICTED FRAME CLEARANCE', -67, 2.7, -30.43, 20, 2.4);
  for (let i = 0; i < 3; i++) {
    box(-80 + i * 3.8, 1.1, -29.5, 2.2, 2.2, 1.4, i % 2 ? RUST : INK);
    box(-80 + i * 3.8, 1.4, -28.75, 1.6, 0.65, 0.1, GOLD, false, false);
  }

  // A broad gantry and much larger hard cover establish the heavy range's scale.
  gate('mech', [35, 9.5, 0, 1.8, 1.0, 26], [[35, -12, 1.8, 1.8], [35, 12, 1.8, 1.8]], RUST);
  sign('MECH ACCESS', 'HEAVY RANGE / 03', 33.99, 7.5, 0, 17, 2.7, -Math.PI / 2);
  box(62, 3.5, -22, 10, 7, 5.5, RUST);
  box(62, 7.2, -22, 10.6, 0.4, 6, INK, false, true, true);
  sign('H-03', 'HEAVY SYSTEMS', 62, 4.3, -19.2, 7.1, 3.1);
  box(73, 2.1, 22, 12, 4.2, 6, TEAL);
  box(49, 1.3, 20, 6.5, 2.6, 3.8, 0x867d64);
  cylinder(79, 4.3, -35, 3.5, 8.6, TEAL, 12, true);
  cylinder(79, 8.75, -35, 3.7, 0.3, INK, 12);
  cylinder(79, 9.55, -35, 0.4, 1.5, RUST, 8);

  // Polygonal mesas create an inked comic-book horizon without image assets.
  const mesaPositions: [number, number, number, number, number][] = [
    [-105, -47, 17, 19, 0], [-91, -69, 21, 28, 1], [-62, -79, 18, 24, 2],
    [-29, -83, 24, 33, 3], [8, -89, 20, 29, 4], [43, -82, 22, 38, 5],
    [81, -76, 19, 27, 6], [108, -55, 26, 33, 7], [117, -16, 16, 20, 8],
    [111, 30, 21, 28, 9], [87, 76, 28, 27, 10], [42, 85, 22, 23, 11],
    [-11, 89, 20, 20, 12], [-61, 81, 29, 30, 13], [-108, 51, 22, 30, 14],
    [-118, 4, 21, 29, 15],
  ];
  for (const [x, z, radius, height, i] of mesaPositions) {
    const rock = outlinedMesh(facetedCylinder(radius * 0.64, radius, height, 5 + i % 3), material(i % 3 === 0 ? 0xd87736 : i % 3 === 1 ? 0xb95132 : 0xe68b3d, 'rock'));
    rock.name = `mesa-body-${i}`;
    rock.position.set(x, height / 2 - 1, z);
    rock.rotation.y = i * 0.64;
    root.add(rock);
    colliders.push({ minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius });
    occluders.push(rock);
    const cap = outlinedMesh(facetedCylinder(radius * 0.59, radius * 0.68, 1.6, 5 + i % 3), material(0xf0ae59, 'rock'));
    cap.name = `mesa-cap-${i}`;
    cap.position.set(x, height - 0.4, z);
    cap.rotation.y = i * 0.64;
    root.add(cap);
    occluders.push(cap);
  }
  // Interior stones and boundary markers remain modest enough for clean paths.
  for (const [index, [x, z, scale]] of ([[-29, 37, 2.5], [28, -37, 2.8], [-80, 45, 3], [84, 8, 2.4]] as const).entries()) {
    const rock = outlinedMesh(new THREE.DodecahedronGeometry(scale, 0), material(0xc36937, 'rock'));
    rock.name = `ground-rock-${index}`;
    rock.position.set(x, scale * 0.45, z);
    rock.scale.y = 0.7;
    root.add(rock);
    colliders.push({ minX: x - scale, maxX: x + scale, minZ: z - scale, maxZ: z + scale });
    occluders.push(rock);
  }
  for (let x = -90; x <= 90; x += 15) {
    for (const z of [-54, 54]) box(x, 0.85, z, 0.3, 1.7, 0.3, INK, false);
  }
  for (let z = -40; z <= 40; z += 20) {
    for (const x of [-89, 89]) box(x, 0.85, z, 0.3, 1.7, 0.3, INK, false);
  }

  for (const definition of CHECKPOINTS) {
    const station = createCheckpointStation(definition.name);
    station.group.name = `checkpoint-${definition.id}`;
    station.group.userData.checkpointId = definition.id;
    station.group.position.set(definition.station.x, 0, definition.station.z);
    root.add(station.group);
    checkpointStations.set(definition.id, station);
    colliders.push({
      minX: definition.station.x - 0.45,
      maxX: definition.station.x + 0.45,
      minZ: definition.station.z - 0.45,
      maxZ: definition.station.z + 0.45,
    });
    station.group.traverse(object => {
      if (object instanceof THREE.Mesh) occluders.push(object);
    });
    textures.push(...station.group.userData.ownedTextures as THREE.Texture[]);
  }

  for (const placement of vendingPlacements) {
    const vendor = createVendingMachine(placement.id);
    vendor.group.position.set(placement.x, 0, placement.z);
    // Each cabinet faces the spawn/service approach rather than hiding its
    // nameplate edge-on when the player arrives at the hub.
    vendor.group.rotation.y = Math.atan2(-placement.x, 16 - placement.z);
    root.add(vendor.group);
    vendor.group.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(vendor.group);
    colliders.push({ minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z });
    vendor.group.traverse(object => { if (object instanceof THREE.Mesh) occluders.push(object); });
    textures.push(...vendor.textures);
    vendingMachines.push({ id: placement.id, group: vendor.group, position: vendor.group.position });
  }

  for (const objective of [
    ...ENCOUNTER.relays.map(relay => ({ ...relay, kind: 'relay' as const })),
    { id: 'salvage-cache', x: ENCOUNTER.reward.x + 6, z: ENCOUNTER.reward.z + 4, kind: 'extract' as const },
  ]) {
    const visual = createEncounterObjective(objective.kind, objective.id);
    visual.group.position.set(objective.x, 0, objective.z);
    root.add(visual.group);
    encounterObjectives.push({ id: objective.id, kind: objective.kind, visual });
    // Consoles are physical even while their objective marker is inactive.
    colliders.push({ minX: objective.x - 0.8, maxX: objective.x + 0.8, minZ: objective.z - 0.7, maxZ: objective.z + 0.7 });
    visual.group.traverse(object => {
      if (object instanceof THREE.Mesh && object.userData.comicOverlay !== true) occluders.push(object);
    });
  }

  // Irregular props and interactive assemblies retain their original blocking
  // footprints. Only explicitly measured flat surfaces supply a landing top.
  for (const bounds of colliders) if (!heightMapped.has(bounds)) traversalColliders.push({ ...bounds });

  return {
    colliders,
    traversalColliders,
    effectColliders:effectWorldSolids(traversalColliders),
    parkedMech,
    occluders,
    checkpointStations,
    vendingMachines,
    weaponWorkbench,
    encounterObjectives,
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>();
      const allMaterials = new Set<THREE.Material>();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach((entry) => allMaterials.add(entry));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      allMaterials.forEach((entry) => entry.dispose());
      textures.forEach((texture) => texture.dispose());
      sun.shadow.dispose();
      scene.remove(root);
    },
  };
}
