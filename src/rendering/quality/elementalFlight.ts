import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { brands, getWeaponElements, type BrandId, type ElementType, type WeaponSpec } from '../../core/arsenal';

const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1);
const noRaycast: THREE.Mesh['raycast'] = () => {};

type Finish = 'metal' | 'dark' | 'body' | 'core' | 'glaze' | 'highlight';
export interface ElementalFlightStyle {
  readonly body: number; readonly core: number; readonly dark: number;
  readonly opacity: number; readonly wake: string;
}
/** Color supports a material/shape identity; it is never the entire effect recipe. */
export const ELEMENTAL_FLIGHT_STYLES: Readonly<Record<ElementType, ElementalFlightStyle>> = Object.freeze({
  kinetic: Object.freeze({ body: 0xd3ad69, core: 0xffedbf, dark: 0x4f4640, opacity: .72, wake: 'thin brass tracer' }),
  fire: Object.freeze({ body: 0xf96a25, core: 0xffe9b8, dark: 0x6f251f, opacity: .76, wake: 'incandescent tapered ember' }),
  ice: Object.freeze({ body: 0x69d6ed, core: 0xe0fdff, dark: 0x254c6c, opacity: .48, wake: 'faceted crystal and fine condensation' }),
  corrosive: Object.freeze({ body: 0x75d948, core: 0xc9ed7c, dark: 0x345a27, opacity: .53, wake: 'wet capsule and detached droplets' }),
  shock: Object.freeze({ body: 0x4a98e8, core: 0xdcf6ff, dark: 0x2a3d71, opacity: .80, wake: 'forked conductor discharge' }),
  radiation: Object.freeze({ body: 0xc7eb51, core: 0xf6ffd3, dark: 0x687133, opacity: .64, wake: 'ringed isotope and sparse decay motes' }),
  gravity: Object.freeze({ body: 0x9867dc, core: 0xe3d4ff, dark: 0x251d41, opacity: .42, wake: 'dark compressed core and distorted orbits' }),
  adhesive: Object.freeze({ body: 0xd9a13e, core: 0xffe2a2, dark: 0x684b28, opacity: .63, wake: 'viscous amber globule and connective thread' }),
});

function finite(vector: THREE.Vector3): boolean { return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z); }
function variantOf(spec: WeaponSpec): number { return Number.isFinite(spec.visualVariant) ? Math.max(0, Math.min(3, Math.floor(spec.visualVariant!))) : 0; }
function familyScale(spec: WeaponSpec): number {
  return ({ pistol: .84, smg: .76, rifle: 1, shotgun: .86, sniper: 1.17, launcher: 1.30 } as const)[spec.weaponType ?? 'rifle'];
}
function rootGroup(name: string, spec: WeaponSpec, brand: BrandId): THREE.Group {
  const group = new THREE.Group(); group.name = name; group.userData.comicOverlay = true;
  group.userData.presentationOnly = true; group.userData.qualityElementalFlight = true;
  group.userData.projectile = spec.projectile; group.userData.trail = spec.trail ?? 'tracer';
  group.userData.element = spec.element; group.userData.secondaryElement = spec.secondaryElement;
  group.userData.weaponType = spec.weaponType ?? 'rifle'; group.userData.visualVariant = variantOf(spec); group.userData.brand = brand;
  group.userData.visualElements = getWeaponElements(spec);
  return group;
}

/** Owns every material/geometry it creates; rigid geometry is batched by finish. */
class Parts {
  private readonly materials = new Map<Finish, THREE.MeshBasicMaterial>();
  private readonly pieces = new Map<Finish, THREE.BufferGeometry[]>();
  private readonly names = new Map<Finish, string[]>();
  constructor(private readonly element: ElementType, private readonly brand: BrandId = 'ironvale', private readonly alpha = 1) {}
  private material(finish: Finish): THREE.MeshBasicMaterial {
    let material = this.materials.get(finish); if (material) return material;
    const style = ELEMENTAL_FLIGHT_STYLES[this.element];
    const metal = new THREE.Color(brands[this.brand].color).lerp(new THREE.Color(0xa6b4ae), .76);
    const colors: Record<Finish, THREE.ColorRepresentation> = { metal, dark: style.dark, body: style.body, core: style.core, glaze: style.body, highlight: 0xfff9e5 };
    const opacity = this.alpha * (finish === 'glaze' ? style.opacity * .48 : finish === 'body' ? style.opacity : finish === 'core' ? .94 : 1);
    material = new THREE.MeshBasicMaterial({ color: colors[finish], transparent: opacity < .999, opacity, depthTest: true, depthWrite: false, toneMapped: false });
    material.name = `elemental-flight-${this.element}-${finish}`;
    this.materials.set(finish, material); return material;
  }
  add(finish: Finish, name: string, geometry: THREE.BufferGeometry, position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1)): void {
    const source = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
    source.applyMatrix4(new THREE.Matrix4().compose(position, quaternion, scale));
    const pieces = this.pieces.get(finish) ?? []; pieces.push(source); this.pieces.set(finish, pieces);
    const names = this.names.get(finish) ?? []; names.push(name); this.names.set(finish, names);
  }
  box(finish: Finish, name: string, size: readonly [number, number, number], at: readonly [number, number, number], rotation = new THREE.Euler()): void {
    this.add(finish, name, new THREE.BoxGeometry(...size), new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(rotation));
  }
  sphere(finish: Finish, name: string, radius: number, at: readonly [number, number, number], scale: readonly [number, number, number] = [1, 1, 1], detail = 1): void {
    this.add(finish, name, new THREE.IcosahedronGeometry(radius, detail), new THREE.Vector3(...at), undefined, new THREE.Vector3(...scale));
  }
  cone(finish: Finish, name: string, radius: number, length: number, at: readonly [number, number, number], direction = FORWARD, sides = 6): void {
    this.add(finish, name, new THREE.ConeGeometry(radius, length, sides), new THREE.Vector3(...at), new THREE.Quaternion().setFromUnitVectors(UP, direction));
  }
  tube(finish: Finish, name: string, from: THREE.Vector3, to: THREE.Vector3, radius: number, endRadius = radius, sides = 5): void {
    const delta = to.clone().sub(from), length = delta.length(); if (length < 1e-7) return;
    this.add(finish, name, new THREE.CylinderGeometry(endRadius, radius, length, sides), from.clone().addScaledVector(delta, .5), new THREE.Quaternion().setFromUnitVectors(UP, delta.divideScalar(length)));
  }
  ring(finish: Finish, name: string, radius: number, tube: number, at: readonly [number, number, number], rotation = new THREE.Euler(), arc = Math.PI * 2): void {
    this.add(finish, name, new THREE.TorusGeometry(radius, tube, 4, 16, arc), new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(rotation));
  }
  finish(parent: THREE.Group, label: string): void {
    for (const [finish, pieces] of this.pieces) {
      const geometry = mergeGeometries(pieces, false)!; pieces.forEach(piece => piece.dispose());
      const mesh = new THREE.Mesh(geometry, this.material(finish)); mesh.name = `${label}-${finish}`;
      mesh.userData.comicOverlay = true; mesh.userData.presentationOnly = true; mesh.userData.element = this.element;
      mesh.userData.authoredParts = this.names.get(finish); mesh.raycast = noRaycast;
      parent.add(mesh);
    }
  }
}

interface MotionPart { object: THREE.Object3D; home: THREE.Euler; rate: readonly [number, number, number]; pulse?: number }
const motions = new WeakMap<THREE.Group, MotionPart[]>();
function moving(root: THREE.Group, object: THREE.Object3D, rate: readonly [number, number, number], pulse = 0): void {
  const parts = motions.get(root) ?? []; parts.push({object,home:object.rotation.clone(),rate,pulse}); motions.set(root,parts);
}

function payload(parent: THREE.Group, element: ElementType, brand: BrandId, radius: number, z: number, variant: number, root: THREE.Group, secondary: boolean): void {
  const group = new THREE.Group(); group.name = `quality-${secondary ? 'secondary' : 'primary'}-${element}-payload`;
  group.userData.comicOverlay = true; group.userData.element = element; group.position.set(secondary ? -radius * .8 : 0, secondary ? radius * .3 : 0, z); parent.add(group);
  const p = new Parts(element, brand, secondary ? .76 : 1), r = radius;
  if (element === 'fire') {
    p.sphere('dark', 'heat-shielded-root', r * .91, [0,0,-r*.18], [1,1,1.25],0);
    p.cone('body', 'incandescent-flame-head', r, r * 3.4, [0,0,r*.45]);
    p.cone('core', 'white-hot-filament', r * .42, r * 2.8, [0,0,r*.8]);
    for (let i=0;i<3;i++) p.cone('body','tapered-ember-rib',r*.18,r*(1.4+i*.28),[Math.cos(i*2.1)*r*.7,Math.sin(i*2.1)*r*.7,-r*(.7+i*.22)],FORWARD.clone().negate(),4);
    moving(root,group,[0,0,1.6],.05);
  } else if (element === 'ice') {
    p.cone('body','faceted-ice-dart',r*.95,r*3.8,[0,0,r*.48],FORWARD,4);
    p.cone('core','crystal-light-face',r*.42,r*3.65,[-r*.22,r*.15,r*.5],FORWARD,3);
    for(let i=0;i<3;i++){const a=i/3*Math.PI*2+.4; p.cone('glaze','ice-facet-satellite',r*.27,r*2.0,[Math.cos(a)*r*.7,Math.sin(a)*r*.7,-r*.1],FORWARD,3);}
  } else if (element === 'corrosive') {
    p.sphere('body','pressurized-fluid-capsule',r,[0,0,0],[1,.92,1.55]);
    p.sphere('glaze','wet-meniscus-shell',r*1.13,[0,0,0],[1,.92,1.55]);
    p.sphere('highlight','liquid-specular-slash',r*.15,[-r*.43,r*.50,r*.3],[.65,1.3,2.4]);
    for(let i=0;i<2;i++)p.sphere('core','suspended-reagent-bubble',r*(.12+i*.035),[r*(i?-.3:.25),r*(i?.2:-.2),r*(i?.5:-.2)],undefined,0);
    moving(root,group,[0,0,.7],.035);
  } else if (element === 'shock') {
    p.tube('dark','electrode-spine',new THREE.Vector3(0,0,-r),new THREE.Vector3(0,0,r*.8),r*.48);
    p.ring('body','charged-conductor-coil',r*.95,r*.14,[0,0,0],new THREE.Euler(.45,0,.3));
    p.sphere('core','electrical-white-core',r*.5,[0,0,r*.65],[1,1,1.5],0);
    for(let i=0;i<3;i++){const a=i*2.1; const base=new THREE.Vector3(Math.cos(a)*r*.6,Math.sin(a)*r*.6,-r*.6),mid=new THREE.Vector3(Math.cos(a+.4)*r*1.4,Math.sin(a+.4)*r*1.4,r*.15),tip=new THREE.Vector3(0,0,r*1.8);p.tube('core','forked-electrical-filament',base,mid,r*.085);p.tube('body','forked-electrical-filament',mid,tip,r*.11,r*.04);}
    moving(root,group,[0,0,4.7]);
  } else if (element === 'radiation') {
    p.sphere('dark','isotope-carrier',r*.8,[0,0,0],undefined,0);
    p.sphere('core','isotope-light-core',r*.48,[0,0,r*.1],undefined,1);
    for(let i=0;i<2;i++)p.ring(i?'core':'body','isotope-containment-ring',r*(1.0+i*.22),r*.095,[0,0,(i-.5)*r*.7],new THREE.Euler(i*.32,.25,.2+i));
    for(let i=0;i<3;i++){const a=i/3*Math.PI*2+.2;p.sphere('body','decay-mote',r*.15,[Math.cos(a)*r*1.45,Math.sin(a)*r*1.45,-r*.2],undefined,0);}
    moving(root,group,[.6,.4,2.3],.025);
  } else if (element === 'gravity') {
    p.sphere('dark','compressed-dark-core',r*.94,[0,0,0],undefined,1);
    p.ring('core','compressed-core-event-rim',r*.98,r*.045,[0,0,r*.05],new THREE.Euler(.3,.2,.1));
    p.ring('body','distorted-gravity-orbit',r*1.55,r*.065,[0,0,0],new THREE.Euler(.75,.45,.3),Math.PI*1.65);
    p.ring('glaze','distorted-counter-orbit',r*1.85,r*.10,[0,0,0],new THREE.Euler(-.8,.6,1.3),Math.PI*1.45);
    p.sphere('core','infalling-mote',r*.12,[r*1.4,0,r*.4],undefined,0);
    moving(root,group,[.7,.9,1.6],.015);
  } else if (element === 'adhesive') {
    p.sphere('body','viscous-amber-globule',r,[0,0,0],[1.05,.9,1.4]);
    p.sphere('glaze','resin-meniscus',r*1.09,[0,0,0],[1.05,.9,1.4]);
    p.sphere('highlight','resin-highlight',r*.12,[-r*.45,r*.48,r*.25],[.8,1,2.5]);
    for(let i=0;i<3;i++){const a=i*2.1;p.sphere('body','adhesive-lobe',r*.38,[Math.cos(a)*r*.75,Math.sin(a)*r*.65,-r*.85],[1,1,1.4]);p.tube('body','connective-resin-neck',new THREE.Vector3(0,0,-r*.55),new THREE.Vector3(Math.cos(a)*r*.75,Math.sin(a)*r*.65,-r*1.4),r*.14,r*.045);}
    moving(root,group,[0,0,.4],.035);
  } else {
    p.cone('body','brass-projectile-nose',r*.8,r*2.6,[0,0,r*.4]);
    p.cone('core','kinetic-tracer-point',r*.32,r*.9,[0,0,r*1.3]);
  }
  p.finish(group,`quality-${element}-payload`);
}

/** Presentation only: original simulation owns every velocity, collision and fuse. */
export function createElementalProjectile(spec: WeaponSpec, brand: BrandId = 'ironvale'): THREE.Group {
  const root=rootGroup(`quality-projectile-${spec.projectile}`,spec,brand),carrier=new THREE.Group();carrier.name='quality-physical-carrier';root.add(carrier);
  const variant=variantOf(spec),type=spec.projectile, p=new Parts('kinetic',brand), scale=familyScale(spec);
  root.scale.setScalar(scale);
  let radius=.052,z=.16;
  if(type==='cluster'){
    const pods=Math.max(2,Math.min(12,Math.floor(Number.isFinite(spec.split?.count)?spec.split!.count:6)));
    radius=.061;z=.24;
    p.tube('dark','cluster-carrier-spine',new THREE.Vector3(0,0,-.21),new THREE.Vector3(0,0,.18),.043,.043,6);
    for(let i=0;i<pods;i++){
      const a=i/pods*Math.PI*2,x=Math.cos(a)*.08,y=Math.sin(a)*.08;
      p.tube('metal','cluster-segmented-submunition-casing',new THREE.Vector3(x,y,-.17),new THREE.Vector3(x,y,.13+variant*.012),.035,.032,5);
      p.cone('dark','cluster-submunition-nose',.032,.075,[x,y,.17+variant*.012],FORWARD,5);
    }
    for(const z of[-.11,.09])p.ring('metal','cluster-separation-band',.12,.012,[0,0,z]);
    moving(root,carrier,[0,0,.8]);
  }else if(type==='rocket'||type==='homing'){
    radius=.085;z=.23;
    p.tube('metal','ordnance-pressure-shell',new THREE.Vector3(0,0,-.18),new THREE.Vector3(0,0,.13+variant*.01),.073,.061,8);
    p.tube('dark','ordnance-nozzle',new THREE.Vector3(0,0,-.23),new THREE.Vector3(0,0,-.16),.078,.055,8);
    p.ring('metal','pressure-collar',.077,.013,[0,0,.10]);
    const fins=brand==='kestrel'?3:4;
    for(let i=0;i<fins;i++){const a=i/fins*Math.PI*2;p.box('dark','swept-guidance-fin',[.13,.022,.17],[Math.cos(a)*.074,Math.sin(a)*.074,-.11],new THREE.Euler(0,.17,a));}
    p.cone('core','contained-thrust-core',.027,.16,[0,0,-.29],FORWARD.clone().negate());
    if(type==='homing')p.ring('dark','seeker-gimbal',.092,.012,[0,0,.11],new THREE.Euler(.23,0,0));
  }else if(type==='disc'||type==='ricochet'){
    radius=type==='disc'?.115:.068;z=0;
    p.tube('metal','machined-disc-carrier',new THREE.Vector3(0,-.022,0),new THREE.Vector3(0,.022,0),radius*1.2,radius*1.2,12);
    p.ring('dark','disc-annular-cut',radius*.83,.011,[0,.025,0],new THREE.Euler(Math.PI/2,0,0));
    for(let i=0;i<4+variant;i++){const a=i/(4+variant)*Math.PI*2;p.box('metal','separated-disc-edge-tooth',[.06,.018,.035],[Math.cos(a)*radius*1.2,0,Math.sin(a)*radius*1.2],new THREE.Euler(0,-a,0));}
    moving(root,carrier,[0,14,0]);
  }else if(type==='spike'){
    radius=.046;z=.20;
    p.tube('metal','accelerator-needle',new THREE.Vector3(0,0,-.25),new THREE.Vector3(0,0,.17),.019,.024,6);
    for(let i=0;i<3;i++){const a=i/3*Math.PI*2;p.box('dark','needle-stabilizer',[.08,.008,.11],[Math.cos(a)*.021,Math.sin(a)*.021,-.18],new THREE.Euler(0,0,a));}
  }else if(type==='orb'){
    radius=.14;z=0;
    for(let i=0;i<3;i++)p.ring('metal','open-orb-field-cage',.16,.012,[0,0,0],new THREE.Euler(i*.8,i*.65,i*.4),Math.PI*1.35);
    moving(root,carrier,[.3,.5,.25]);
  }else if(type==='sticky'){
    radius=.092;z=.035;
    p.sphere('dark','sticky-pressure-backing',.09,[0,0,-.055],[1,1,.65]);
    p.ring('metal','sticky-payload-retaining-ring',.085,.012,[0,0,-.005]);
    for(let i=0;i<3;i++){const a=i/3*Math.PI*2;p.box('metal','sticky-attachment-cleat',[.035,.025,.07],[Math.cos(a)*.08,Math.sin(a)*.08,-.045],new THREE.Euler(0,0,a));}
  }else if(type==='slug'){
    radius=.067;z=.14;
    p.tube('metal','heavy-slug-jacket',new THREE.Vector3(0,0,-.19),new THREE.Vector3(0,0,.10),.037,.041,6);
    for(const z of[-.13,.04])p.ring('dark','slug-driving-band',.045,.009,[0,0,z]);
  }else{
    const scatter=type==='scatter';radius=scatter?.030:.044;z=scatter?.07:.13;
    p.tube('metal','ballistic-metal-jacket',new THREE.Vector3(0,0,scatter?-.07:-.14),new THREE.Vector3(0,0,z*.65),scatter?.019:.026,scatter?.022:.026,6);
    p.ring('dark','projectile-crimp',scatter?.022:.028,.004,[0,0,scatter?-.04:-.10]);
  }
  p.finish(carrier,'quality-carrier');
  const elements=getWeaponElements(spec);
  payload(root,elements[0],brand,radius,z,variant,root,false);
  if(elements[1])payload(root,elements[1],brand,radius*.60,z-radius*.30,variant,root,true);
  root.userData.flightRadius=radius;root.userData.maxVisualParts=16;
  return root;
}

function axes(start:THREE.Vector3,end:THREE.Vector3):{delta:THREE.Vector3;distance:number;direction:THREE.Vector3;side:THREE.Vector3;up:THREE.Vector3}|null{
 if(!finite(start)||!finite(end))return null;
 const delta=end.clone().sub(start),distance=delta.length();if(distance<1e-6)return null;
 const direction=delta.clone().divideScalar(distance),side=new THREE.Vector3().crossVectors(direction,Math.abs(direction.y)>.94?new THREE.Vector3(1,0,0):UP).normalize();
 return{delta,distance,direction,side,up:new THREE.Vector3().crossVectors(side,direction).normalize()};
}
function pathPoint(start:THREE.Vector3,delta:THREE.Vector3,side:THREE.Vector3,up:THREE.Vector3,t:number,offset:number,vertical=0):THREE.Vector3{
 return start.clone().addScaledVector(delta,t).addScaledVector(side,offset).addScaledVector(up,vertical);
}

/** Exact world endpoints with small element-specific disturbances between them. */
export function createElementalTrail(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,brand:BrandId='ironvale'):THREE.Group{
 const root=rootGroup('quality-elemental-trail',spec,brand),basis=axes(start,end);root.userData.start=start.toArray();root.userData.end=end.toArray();if(!basis)return root;
 const {delta,distance,direction,side,up}=basis,type=spec.projectile,style=spec.trail??'tracer',variant=variantOf(spec);
 const energy=['orb','rocket','homing','sticky','cluster'].includes(type),scale=familyScale(spec);
 const width=(type==='scatter'?.0034:energy?.013:.0055)*scale;
 const elements=getWeaponElements(spec);
 for(const[channel,element]of elements.entries()){
  const p=new Parts(element,brand,(style==='clean'?.32:1)*(channel?.65:1));
  const alpha=channel?-.014:.014;
  const points:THREE.Vector3[]=[];
  const segments=element==='shock'?6:element==='gravity'?8:style==='helix'||style==='ribbon'?6:1;
  for(let i=0;i<=segments;i++){
   const t=i/segments,edge=Math.sin(t*Math.PI),phase=t*(2+variant*.25)*Math.PI*2+start.dot(direction)*2;
   let offset=channel?edge*alpha:0,vertical=0;
   if(element==='shock')offset+=i===0||i===segments?0:Math.sin(i*2.47+variant)*Math.min(.055,distance*.025);
   else if(element==='gravity'){offset+=Math.cos(phase)*edge*.042;vertical=Math.sin(phase)*edge*.034;}
   else if(style==='helix'){offset+=Math.cos(phase)*edge*(energy?.028:.015);vertical=Math.sin(phase)*edge*(energy?.028:.015);}
   else if(style==='ribbon')offset+=Math.sin(phase)*edge*(energy?.035:.018);
   points.push(pathPoint(start,delta,side,up,t,offset,vertical));
  }
  // The dark gravity center remains hollow: two fine orbit strands, no purple hose.
  for(let i=1;i<points.length;i++){
   const t=(i-.5)/segments;
   const taper=element==='fire'?.2+t*.8:element==='adhesive'?.25+t*.75:1;
   p.tube(element==='gravity'?'body':element==='ice'?'body':'core','element-flight-line',points[i-1],points[i],width*taper, width*(element==='fire'?taper*.75:taper));
   if(element==='shock')p.tube('body','blue-discharge-envelope',points[i-1],points[i],width*2.4,width*1.8);
  }
  if(element==='fire'){
   for(let i=0;i<3;i++){const t=.22+i*.27,at=pathPoint(start,delta,side,up,t,Math.sin(i*2.4+variant)*.028,.01*i);p.cone(i===2?'core':'body','tapered-incandescent-ember',width*(1.1+i*.3),Math.min(.12,distance*.1),[at.x,at.y,at.z],direction,4);}
  }else if(element==='ice'){
   for(let i=0;i<3;i++){const t=.18+i*.29,at=pathPoint(start,delta,side,up,t,(i%2?1:-1)*.025,.008);p.cone('glaze','fine-crystal-condensation',width*2.1,Math.min(.12,distance*.09),[at.x,at.y,at.z],direction,3);}
  }else if(element==='corrosive'){
   for(let i=0;i<3;i++){const t=.20+i*.29,at=pathPoint(start,delta,side,up,t,(i%2?1:-1)*(.018+i*.004),-.012*i);p.sphere(i===1?'glaze':'body','detached-wet-droplet',width*(2.0+i*.25),[at.x,at.y,at.z],[1,1,1.4]);}
  }else if(element==='shock'){
   const a=points[2],b=a.clone().addScaledVector(side,.055).addScaledVector(direction,Math.min(.12,distance*.08));p.tube('core','short-branch-discharge',a,b,width*.6,width*.2);
  }else if(element==='radiation'){
   for(let i=0;i<2;i++){const t=.26+i*.43,at=start.clone().addScaledVector(delta,t);p.ring('body','isotope-decay-ring',width*4,.0035,[at.x,at.y,at.z],new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(FORWARD,direction)),Math.PI*1.65);p.sphere('core','isotope-decay-mote',width*1.7,[at.x+side.x*.035,at.y+side.y*.035,at.z+side.z*.035],undefined,0);}
  }else if(element==='gravity'){
   const a=start.clone().addScaledVector(delta,.18),b=end.clone().addScaledVector(delta,-.18);
   const counterA=a.clone().addScaledVector(side,-.028),counterB=b.clone().addScaledVector(side,-.028);p.tube('glaze','gravitational-counter-stream',counterA,counterB,width*.55);
  }else if(element==='adhesive'){
   for(let i=0;i<3;i++){const t=.22+i*.28,at=start.clone().addScaledVector(delta,t);p.sphere('body','resin-thread-bead',width*(1.9+i*.35),[at.x,at.y,at.z],[.9,.9,1.45]);}
   p.tube('glaze','viscous-thread-meniscus',start,end,width*1.8,width*2.4);
  }
  if(style==='pulse'&&element!=='radiation')for(const t of[.3,.75]){const at=start.clone().addScaledVector(delta,t);p.ring('body','delivery-pulse-band',width*(energy?4.6:3),.003,[at.x,at.y,at.z],new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(FORWARD,direction)),Math.PI*1.5);}
  if(style==='comet'&&element==='kinetic'){const at=end.clone().addScaledVector(direction,-Math.min(.08,distance*.15));p.cone('body','comet-delivery-taper',width*1.7,Math.min(.18,distance*.25),[at.x,at.y,at.z],direction);}
  p.finish(root,`quality-trail-${channel}-${element}`);
 }
 root.userData.maxVisualParts=8;
 return root;
}

/** A controlled luminous core and authored energy structure, with converging endpoints. */
export function createElementalBeam(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,jagged:boolean,brand:BrandId='ironvale'):THREE.Group{
 const root=rootGroup(jagged?'quality-elemental-arc':'quality-elemental-beam',spec,brand),basis=axes(start,end);root.userData.start=start.toArray();root.userData.end=end.toArray();if(!basis)return root;
 const{delta,distance,direction,side,up}=basis,variant=variantOf(spec),elements=getWeaponElements(spec),style=spec.trail??'tracer';
 const width=(jagged?.009:.012)*familyScale(spec);
 for(const[channel,element]of elements.entries()){
  const p=new Parts(element,brand,channel?.76:1);
  const segments=jagged||element==='shock'?9:element==='gravity'?12:element==='adhesive'?7:style==='helix'||style==='ribbon'?10:4;
  const points:THREE.Vector3[]=[];
  for(let i=0;i<=segments;i++){
   const t=i/segments,edge=Math.sin(t*Math.PI),angle=t*(2+variant*.3)*Math.PI*2;
   let bend=channel?edge*.032:0,vertical=0;
   if(jagged||element==='shock')bend+=i===0||i===segments?0:Math.sin(i*2.399+variant)*Math.min(.11,distance*.022);
   else if(element==='gravity'){bend+=Math.cos(angle)*edge*.065;vertical=Math.sin(angle)*edge*.05;}
   else if(element==='adhesive'){bend+=Math.sin(angle*.5)*edge*.035;vertical=-edge*.035;}
   else if(style==='helix'){bend+=Math.cos(angle)*edge*.035;vertical=Math.sin(angle)*edge*.035;}
   else if(style==='ribbon')bend+=Math.sin(angle)*edge*.05;
   points.push(pathPoint(start,delta,side,up,t,bend,vertical));
  }
  for(let i=1;i<points.length;i++){
   p.tube(element==='gravity'?'body':'core','beam-precise-core',points[i-1],points[i],element==='adhesive'?width*1.5:width);
   if(style!=='clean'&&element!=='gravity')p.tube('glaze','controlled-beam-edge',points[i-1],points[i],width*(element==='fire'?2.6:2.1));
  }
  if(element==='ice')for(let i=1;i<=4;i++){const at=start.clone().addScaledVector(delta,i/5);p.cone('body','beam-crystal-lance',width*2.4,Math.min(.32,distance*.08),[at.x,at.y,at.z],direction,3);}
  if(element==='fire')for(let i=1;i<=4;i++){const at=start.clone().addScaledVector(delta,i/5).addScaledVector(side,Math.sin(i*2.4)*.04);p.cone('body','beam-heat-tongue',width*1.3,Math.min(.22,distance*.06),[at.x,at.y,at.z],direction,4);}
  if(element==='corrosive'||element==='adhesive')for(let i=1;i<=4;i++){const at=points[Math.round(i/5*segments)];p.sphere('body',element==='adhesive'?'resin-beam-bead':'pressurized-fluid-bead',width*(element==='adhesive'?2.9:2.0),[at.x,at.y,at.z],[1,1,1.7]);}
  if(element==='shock'||jagged)for(const i of[3,6]){const at=points[i],fork=at.clone().addScaledVector(side,(i%2?1:-1)*.15).addScaledVector(direction,-.08);p.tube('body','short-lived-arc-fork',at,fork,width*.7,width*.2);}
  if(element==='shock')for(const i of[2,7]){const at=points[i];p.ring('body','charged-beam-electrode-knot',.032,.004,[at.x,at.y,at.z],new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(FORWARD,direction)),Math.PI*1.4);}
  if(element==='radiation'||element==='gravity'||style==='pulse')for(let i=1;i<=3;i++){
   const at=start.clone().addScaledVector(delta,i/4),orientation=new THREE.Quaternion().setFromUnitVectors(FORWARD,direction);
   const tilt=element==='gravity'?.55:0;orientation.multiply(new THREE.Quaternion().setFromAxisAngle(UP,tilt));
   p.ring(element==='gravity'?'glaze':'body',element==='gravity'?'beam-spacetime-lens':'beam-containment-ring',element==='gravity'?.085:.045,.004,[at.x,at.y,at.z],new THREE.Euler().setFromQuaternion(orientation),Math.PI*(element==='gravity'?1.4:1.8));
  }
  p.finish(root,`quality-beam-${channel}-${element}`);
 }
 root.userData.maxVisualParts=8;
 return root;
}

/** Absolute simulation age avoids shimmer/drift. Root transforms always remain simulation-owned. */
export function updateElementalProjectile(root:THREE.Group,dt:number,age:number):void{
 if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(age)||age<0)return;
 for(const part of motions.get(root)??[]){
  part.object.rotation.set(part.home.x+age*part.rate[0],part.home.y+age*part.rate[1],part.home.z+age*part.rate[2]);
  if(part.pulse)part.object.scale.setScalar(1+Math.sin(age*8.5)*part.pulse);
 }
}
