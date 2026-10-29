import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Mode } from '../../core/index';
import type { EquipmentAppearance, EquipmentLoadoutAppearance } from '../../core/appearance';
import { createEquipmentWeapon, type WeaponRig } from '../equipmentModels';
import { createBandTexture, createComicToonMaterial } from '../materials';

export interface ReferenceWeaponUpgrade {
  /** Restores the exact original renderer, including its geometry/material identities. */
  dispose(): void;
}
export interface ReferenceWeaponRig extends WeaponRig { quality: ReferenceWeaponUpgrade }

type PaletteKey = 'paint' | 'ceramic' | 'steel' | 'rubber' | 'edge' | 'signal';
type Palette = Record<PaletteKey, THREE.Material>;
const upgraded = new WeakMap<THREE.Group, ReferenceWeaponUpgrade>();

function ownerOf(object: THREE.Object3D): string {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    const owner = current.userData.visualOwner ?? current.userData.equipmentSlot;
    if (owner) return owner;
  }
  return 'weapon';
}

function palette(appearance: EquipmentAppearance, ramp: THREE.DataTexture): Palette {
  const toon = (color: number, name: string) => {
    const material = createComicToonMaterial({ color, gradientMap: ramp });
    material.name = `reference-weapon-${name}`;
    return material;
  };
  return {
    paint: toon(appearance.primary, 'enamel'), ceramic: toon(appearance.secondary, 'ceramic'),
    steel: toon(0x8badae, 'machined-steel'), rubber: toon(0x192a31, 'rubber'),
    edge: toon(0xc1cfbd, 'rubbed-edge'), signal: new THREE.MeshBasicMaterial({ color: 0xa7e4db }),
  };
}


/** Closed, tapered receiver with broad planar faces and deliberately few silhouette breaks. */
function taperedReceiver(width: number, height: number, depth: number): THREE.BufferGeometry {
  const outline = [[-.5,-.34],[-.34,-.5],[.34,-.5],[.5,-.34],[.5,.29],[.31,.5],[-.31,.5],[-.5,.29]];
  const points = outline.flatMap(([x,y]) => [x*width,y*height,-depth/2]);
  for (const [x,y] of outline) points.push(x*width*.77,y*height*.84,depth*.39);
  const indices: number[] = [];
  for (let i=1;i<7;i++) { indices.push(0,i+1,i); indices.push(8,8+i,8+i+1); }
  for(let i=0;i<8;i++){const next=(i+1)%8;indices.push(i,next,8+next,i,8+next,8+i);}
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3)); geometry.setIndex(indices);
  const flat=geometry.toNonIndexed(); geometry.dispose(); flat.computeVertexNormals(); return flat;
}
function rigidBoxes(parts: {size:[number,number,number];at:[number,number,number];pitch?:number}[]): THREE.BufferGeometry {
  const pieces=parts.map(part=>{const g=new THREE.BoxGeometry(...part.size);g.rotateX(part.pitch??0);g.translate(...part.at);return g;});
  const result=mergeGeometries(pieces,false)!;pieces.forEach(piece=>piece.dispose());return result;
}
function skeletalStock(): THREE.BufferGeometry {
  return rigidBoxes([
    {size:[.105,.155,.031],at:[0,-.012,-.105]},
    {size:[.023,.028,.17],at:[-.035,.040,-.20]},
    {size:[.023,.028,.17],at:[.035,.040,-.20]},
    {size:[.023,.029,.18],at:[-.035,-.033,-.20],pitch:.43},
    {size:[.023,.029,.18],at:[.035,-.033,-.20],pitch:.43},
  ]);
}
function reflexFrame(): THREE.BufferGeometry {
  return rigidBoxes([
    {size:[.151,.025,.13],at:[0,.071,0]}, {size:[.151,.025,.13],at:[0,-.071,0]},
    {size:[.024,.135,.13],at:[-.064,0,0]}, {size:[.024,.135,.13],at:[.064,0,0]},
  ]);
}

/** Detail parts are baked into six material batches, rather than one draw per screw. */
class Fitments {
  readonly group = new THREE.Group();
  private readonly pieces = new Map<PaletteKey, THREE.BufferGeometry[]>();
  constructor(private readonly materials: Palette) { this.group.name = 'reference-weapon-fitments'; }
  box(key: PaletteKey, size: readonly [number, number, number], at: readonly [number, number, number], rotation: readonly [number, number, number] = [0, 0, 0]): void {
    const geometry = new THREE.BoxGeometry(...size);
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
    this.add(key, geometry);
  }
  pin(key: PaletteKey, radius: number, length: number, at: readonly [number, number, number], axis: 'x' | 'y' | 'z' = 'x'): void {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 6);
    if (axis === 'x') geometry.rotateZ(Math.PI / 2);
    if (axis === 'z') geometry.rotateX(Math.PI / 2);
    geometry.translate(...at); this.add(key, geometry);
  }
  private add(key: PaletteKey, geometry: THREE.BufferGeometry): void {
    const pieces = this.pieces.get(key) ?? []; pieces.push(geometry); this.pieces.set(key, pieces);
  }
  finish(): THREE.Group {
    for (const [key, pieces] of this.pieces) {
      const geometry = mergeGeometries(pieces, false)!;
      pieces.forEach(piece => piece.dispose());
      const mesh = new THREE.Mesh(geometry, this.materials[key]);
      mesh.name = `reference-${key}-fitments`; mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    return this.group;
  }
}

function stamp(parent: THREE.Object3D, width: number): THREE.Mesh | null {
  // Canvas artwork is authored here at source; no runtime downloads or font dependencies.
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.fillText !== 'function') return null;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = '#e7ead6'; ctx.font = '900 58px monospace'; ctx.fillText('R / 07', 6, 60);
  ctx.fillStyle = '#c4cbb7'; ctx.font = '22px monospace'; ctx.fillText('FIELD ASSEMBLY   //   5.8', 6, 99);
  ctx.fillRect(350, 15, 10, 39); ctx.fillRect(368, 15, 7, 39); ctx.fillRect(383, 15, 17, 39);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  material.name = 'reference-weapon-stencil';
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.32, .08), material);
  mesh.name = 'reference-field-stencil'; mesh.position.set(-width / 2 - .0015, .014, .005); mesh.rotation.y = -Math.PI / 2;
  parent.add(mesh); return mesh;
}

function upgradePilotDetails(rig: WeaponRig, appearance: EquipmentAppearance, p: Palette): THREE.Group {
  const details = new THREE.Group(); details.name = 'reference-pilot-construction';
  const receiver = rig.group.getObjectByName('weapon-receiver') as THREE.Mesh<THREE.BoxGeometry> | undefined;
  if (!receiver) return details;
  receiver.geometry.computeBoundingBox();
  const dimensions = receiver.geometry.boundingBox!.getSize(new THREE.Vector3());
  const width = dimensions.x, height = dimensions.y, length = dimensions.z;
  const f = new Fitments(p);
  // Recessed ejection port, a broad uninterrupted enamel cheek, and service fasteners.
  f.box('rubber', [.006, height * .39, length * .40], [-width / 2 - .002, height * .12, length * .05]);
  f.box('steel', [.008, .019, length * .30], [-width / 2 - .007, height * .29, length * .05]);
  for (const z of [-length * .35, length * .34]) f.pin('steel', .012, .010, [-width / 2 - .006, -height * .28, z]);
  // Restrained edge chips sit on leading corners, never tile across broad painted faces.
  f.box('edge', [.012, .007, .055], [-width / 2 + .008, height / 2 + .001, -.15]);
  f.box('edge', [.009, .024, .024], [-width / 2 - .001, -height * .28, length * .41]);
  f.box('edge', [.07, .004, .012], [0, height / 2 + .072, -.19]);
  // Trigger guard gives the grip an actual operating space and readable lower silhouette.
  f.box('rubber', [.038, .032, .205], [0, -height / 2 - .22, -.012]);
  f.box('rubber', [.038, .16, .032], [0, -height / 2 - .14, -.10]);
  f.box('steel', [.018, .073, .026], [0, -height / 2 - .055, -.015], [-.35, 0, 0]);
  // Short, real rail teeth; handguard gaps read dark against the light ceramic sleeve.
  for (let index = 0; index < 5; index++) f.box('rubber', [width * .54, .014, .020], [0, height / 2 + .078, -.16 + index * .054]);
  if (appearance.weaponType !== 'pistol') {
    const handguardEnd = -length / 2 - (appearance.form === 'compact' ? .18 : .29);
    for (const side of [-1, 1]) {
      for (let index = 0; index < 3; index++) f.box('rubber', [.010, .030, .050], [side * .080, .027, -length / 2 - .06 - index * .075]);
      f.box('steel', [.025, .025, .055], [side * .073, -.052, handguardEnd]);
    }
  }
  // The rear of the gun is what the pilot actually sees: a compressed adjustable
  // cheek rest, stock latch, rubber shoulder pad and charging handle, not a box.
  const stock = rig.group.getObjectByName('weapon-stock');
  if (stock) {
    f.box('ceramic',[.112,.033,.145],[0,stock.position.y+.068,stock.position.z-.205]);
    f.box('steel',[.018,.035,.045],[-.062,stock.position.y+.015,stock.position.z-.18]);
    f.box('rubber',[.076,.014,.025],[0,stock.position.y+.087,stock.position.z-.21]);
    for(let i=0;i<3;i++)f.box('steel',[.094,.009,.003],[0,stock.position.y-.045+i*.031,stock.position.z-.088]);
  }
  f.pin('steel',.023,.043,[-width/2-.028,height*.14,length*.19]);
  f.box('rubber',[.09,.033,.055],[-width/2-.059,height*.14,length*.19]);
  const optic=rig.group.getObjectByName('raised-optic');
  if(optic){
    f.box('steel',[.088,.027,.068],[0,optic.position.y-.096,optic.position.z]);
    f.pin('steel',.018,.038,[-.091,optic.position.y-.047,optic.position.z+.009]);
    const reticle=new THREE.Mesh(new THREE.RingGeometry(.006,.008,12),new THREE.MeshBasicMaterial({color:0xe9ba64,transparent:true,opacity:.85,depthWrite:false,toneMapped:false}));
    reticle.name='reference-reflex-reticle';reticle.position.set(0,optic.position.y-.003,optic.position.z+.026);reticle.userData.comicOverlay=true;reticle.raycast=()=>{};details.add(reticle);
  }
  details.add(f.finish());
  stamp(details, width);
  return details;
}

function upgradeMagazine(rig: WeaponRig, p: Palette): THREE.Group | null {
  if (!rig.magazine) return null;
  const box = rig.magazine.getObjectByName('weapon-box-magazine') as THREE.Mesh | undefined;
  if (!box) return null;
  box.geometry.computeBoundingBox();
  const bounds = box.geometry.boundingBox!, dims = bounds.getSize(new THREE.Vector3());
  const f = new Fitments(p);
  for (let index = 0; index < 3; index++) {
    f.box('rubber', [.007, dims.y * .62, .013], [-dims.x / 2 - .003, box.position.y, -.052 + index * .052]);
  }
  f.box('rubber', [.008, .13, .045], [dims.x / 2 + .003, box.position.y, 0]);
  for (let index = 0; index < 3; index++) f.pin('edge', .007, .009, [dims.x / 2 + .008, box.position.y + .04 - index * .04, 0]);
  const result = f.finish(); result.name = 'reference-magazine-construction'; return result;
}

function upgradeMechDetails(rig: WeaponRig, p: Palette): THREE.Group[] {
  const groups: THREE.Group[] = [];
  for (const cannon of rig.group.children.filter(child => child.name === 'mech-cannon')) {
    const receiver = cannon.getObjectByName('cannon-receiver') as THREE.Mesh | undefined;
    if (!receiver) continue;
    receiver.geometry.computeBoundingBox(); const dims = receiver.geometry.boundingBox!.getSize(new THREE.Vector3());
    const f = new Fitments(p);
    for (const side of [-1, 1]) {
      f.box('rubber', [.01, dims.y * .45, dims.z * .58], [side * (dims.x / 2 + .003), .015, -.1]);
      for (let i = 0; i < 4; i++) f.box('steel', [.02, .022, dims.z * .45], [side * (dims.x / 2 + .012), -.07 + i * .058, -.1]);
      for (const z of [-dims.z * .32, dims.z * .28]) f.pin('steel', .023, .018, [side * (dims.x / 2 + .013), dims.y * .32, z - .1]);
      f.box('edge', [.016, .006, .105], [side * dims.x * .48, dims.y / 2 + .104, -.2]);
    }
    const group = f.finish(); group.name = 'reference-cannon-construction'; cannon.add(group); groups.push(group);
  }
  return groups;
}

/**
 * Optional art target layered over the existing factory. The original rig is the
 * source of truth for muzzle sockets, moving assembly parents, and reload homes.
 * No collision geometry, ballistic configuration, or unrelated slot is modified.
 */
export function upgradeReferenceWeapon(rig: WeaponRig, appearance: EquipmentAppearance, mode: Mode = appearance.target): ReferenceWeaponUpgrade {
  const existing = upgraded.get(rig.group); if (existing) return existing;
  const ramp = createBandTexture(), p = palette(appearance, ramp);
  const replacements: { mesh: THREE.Mesh; geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
  const newGeometries = new Set<THREE.BufferGeometry>();
  const attachments: THREE.Group[] = [];
  const specialMaterials = new Set<THREE.Material>();
  let disposed = false;
  if (appearance.equipped) {
    rig.group.traverse(object => {
      if (!(object instanceof THREE.Mesh) || ownerOf(object) !== 'weapon' || object.userData.comicOverlay) return;
      // Element cartridges retain their physical delivery-specific geometry and color.
      if (object.userData.equipmentElementSurface || /energy-emitter-tip|guidance-seeker/.test(object.name)) return;
      replacements.push({ mesh: object, geometry: object.geometry, material: object.material });
      const name = object.name;
      if (/optic-glass|receiver-status|cannon-status-cell/.test(name)) object.material = p.signal;
      else if (/grip|brace|bore|muzzle-collar|front-collar|rail|folded-stock-spine|raised-optic|carry-handle-bridge|recoil-spring/.test(name)) object.material = p.rubber;
      else if (/metal|barrel|bolt|rivet|battery|box-magazine|feed|telescopic|breech-hatch|stock-neck|cooling-fin|heat-sink/.test(name)) object.material = p.steel;
      else if (/secondary|stock|cheek|muzzle-brake|sleeve|hatch|top-armor|band|payload|prong|collar/.test(name)) object.material = p.ceramic;
      else object.material = p.paint;
      if (object.geometry instanceof THREE.BoxGeometry) {
        const { width, height, depth } = object.geometry.parameters;
        if (mode === 'pilot' && name === 'weapon-stock') {
          const geometry = skeletalStock(); object.geometry=geometry; object.material=p.rubber;newGeometries.add(geometry);return;
        }
        if (mode === 'pilot' && name === 'weapon-stock-neck') {
          const geometry = new RoundedBoxGeometry(.085,.075,.11,1,.012);geometry.translate(0,0,-.10);object.geometry=geometry;object.material=p.steel;newGeometries.add(geometry);return;
        }
        if (mode === 'pilot' && name === 'weapon-receiver') {
          const geometry=taperedReceiver(width,height,depth);object.geometry=geometry;newGeometries.add(geometry);return;
        }
        if (mode === 'pilot' && name === 'raised-optic') {
          const geometry=reflexFrame();object.geometry=geometry;object.material=p.rubber;newGeometries.add(geometry);return;
        }
        if (mode === 'pilot' && name === 'optic-glass') {
          const geometry=new THREE.BoxGeometry(.102,.112,.001);geometry.translate(0,-.010,.10);object.geometry=geometry;newGeometries.add(geometry);
          const glass=new THREE.MeshBasicMaterial({color:0x99d8d1,transparent:true,opacity:.09,depthWrite:false});specialMaterials.add(glass);object.material=glass;return;
        }
        const radius = Math.min(width, height, depth) * .16;
        if (radius > .003) {
          const geometry = new RoundedBoxGeometry(width, height, depth, 1, Math.min(radius, .017));
          object.geometry = geometry; newGeometries.add(geometry);
        }
      }
    });
    if (mode === 'pilot') {
      const details = upgradePilotDetails(rig, appearance, p); rig.group.add(details); attachments.push(details);
      const magazine = upgradeMagazine(rig, p);
      if (magazine) { rig.magazine!.add(magazine); attachments.push(magazine); }
    } else attachments.push(...upgradeMechDetails(rig, p));
  }
  const upgrade: ReferenceWeaponUpgrade = { dispose() {
    if (disposed) return; disposed = true;
    for (const replacement of replacements) {
      replacement.mesh.geometry = replacement.geometry; replacement.mesh.material = replacement.material;
    }
    const extraMaterials = new Set<THREE.Material>();
    for (const attachment of attachments) {
      attachment.removeFromParent();
      attachment.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        newGeometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) extraMaterials.add(material);
      });
    }
    newGeometries.forEach(geometry => geometry.dispose());
    for (const material of extraMaterials) {
      if (Object.values(p).includes(material)) continue;
      const map = (material as THREE.MeshBasicMaterial).map; map?.dispose(); material.dispose();
    }
    specialMaterials.forEach(material=>material.dispose());
    Object.values(p).forEach(material => material.dispose()); ramp.dispose(); upgraded.delete(rig.group);
  } };
  upgraded.set(rig.group, upgrade); return upgrade;
}

export function createReferenceWeapon(mode: Mode, appearance: EquipmentAppearance, loadout?: EquipmentLoadoutAppearance): ReferenceWeaponRig {
  const rig = createEquipmentWeapon(mode, appearance, loadout) as ReferenceWeaponRig;
  rig.quality = upgradeReferenceWeapon(rig, appearance, mode); return rig;
}
