import * as THREE from 'three';
import type {EquipmentAppearance} from '../../../core/appearance';
import type {EquipmentEffectPresentation} from '../../equipmentEffects';
import {createQualityMaterial} from '../primitives';
import {EffectVariationSequence,cosmeticSample,type EffectVariation} from '../shared/variation';
import {LightningSegments} from './lightning';
import {shockAssemblies,assemblySolids,fitShockCollar,enclosedShockSource,shockTerminalFrame,relativeEquipmentMatrix,type ShockAssembly} from './equipmentGeometry';
import {shockEquipmentSurface} from './equipmentSurface';

interface Binding {source:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];overlay?:ReturnType<typeof shockEquipmentSurface>;assembly:ShockAssembly}
interface Terminal {assembly:ShockAssembly;host:THREE.Mesh;group:THREE.Group;lines:LightningSegments;lamp:THREE.MeshBasicMaterial;unit:number;gap:number;seed:number;period:number;epoch:number;idleSeed:number;charge:number;shotAt:number;lastAccepted:number;pending:number;events:EffectVariationSequence;choice:EffectVariation;tips:THREE.Mesh[];tipPoints:THREE.Vector3[]}
const deliveries=['bullet','scatter','slug','spike','beam','arc','sticky','rocket','homing','orb','cluster','ricochet','disc'];
/** Small installed terminals; the source geometry is the coordinate system.
 * No impact slots, capacitor burst, aura, muzzle/socket mutation or gameplay RNG. */
export class ShockEquipment implements EquipmentEffectPresentation {
 readonly bindings:Binding[]=[];readonly terminals:Terminal[]=[];readonly group=new THREE.Group();
 private geometries=new Set<THREE.BufferGeometry>();private materials=new Set<THREE.Material>();private lastTime:number|undefined;private disposed=false;
 private a=new THREE.Vector3();private b=new THREE.Vector3();private root=new THREE.Vector3();private matrix=new THREE.Matrix4();private inverse=new THREE.Matrix4();
 readonly weight:number;
 constructor(root:THREE.Object3D,readonly appearance:EquipmentAppearance,private released:()=>void=()=>{}){
  this.weight=appearance.element==='shock'?1:.62;this.group.name='shock-live-terminal-equipment';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;root.add(this.group);
  const assemblies=shockAssemblies(root,appearance);if(!assemblies.length)return;
  const substrate=createQualityMaterial(0x263d50,'metal');this.materials.add(substrate);
  for(const assembly of assemblies){
   const seed=((assembly.variant+1)*0x53484f43^((deliveries.indexOf(assembly.delivery)+1)*7919)^assembly.index*104729)>>>0,sequence=new EffectVariationSequence(seed),profile=sequence.next(5,'equipment');
   const solids=assemblySolids(assembly.owner),visible:THREE.Mesh[]=[];
   for(const source of assembly.sources){
    const binding:Binding={source,geometry:source.geometry,material:source.material,assembly};this.bindings.push(binding);
    const fitted=fitShockCollar(source,assembly,solids);if(fitted){this.geometries.add(fitted);source.geometry=fitted;}
    source.material=substrate;
    if(!enclosedShockSource(source,assembly,solids)){binding.overlay=shockEquipmentSurface(source,profile.seed+this.bindings.length*17,this.weight);this.materials.add(binding.overlay.material);visible.push(source);}
   }
   const host=visible.find(s=>s.name.startsWith('element-transfer-band')&&s.name.endsWith('-1'))??visible[0];if(!host)continue;
   const frame=shockTerminalFrame(host,assembly);if(!frame)continue;
   const group=new THREE.Group();group.name='shock-live-terminal-cell';group.position.copy(frame.point);group.quaternion.copy(frame.rotation);group.userData.comicOverlay=true;group.userData.presentationOnly=true;host.add(group);
   const ceramic=createQualityMaterial(0x8dacae,'paint'),metal=createQualityMaterial(0x35688a,'metal'),lamp=new THREE.MeshBasicMaterial({color:0xc9f3ff,transparent:true,opacity:.38*this.weight,toneMapped:false,depthTest:true,depthWrite:false});for(const m of [ceramic,metal,lamp])this.materials.add(m);
   const {unit:u,gap}=frame;
   const add=(name:string,size:[number,number,number],position:[number,number,number],material:THREE.Material)=>{const geometry=new THREE.BoxGeometry(...size);this.geometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.raycast=()=>{};group.add(mesh);return mesh;};
   add('shock-terminal-insulated-body',[u*2.1,gap+u*1.45,u*.42],[0,0,0],substrate);
   for(const sign of [-1,1]){add('shock-terminal-ceramic-seat',[u*1.25,u*.62,u*.22],[0,sign*gap*.5,u*.30],ceramic);add('shock-terminal-contact-pad',[u*.80,u*.35,u*.16],[0,sign*gap*.5,u*.47],metal);add('shock-terminal-white-contact',[u*.38,u*.17,u*.05],[0,sign*gap*.5,u*.58],lamp);}
   const lines=new LightningSegments(64);group.add(lines.group);
   const tips:THREE.Mesh[]=[];if(assembly.delivery==='beam'||assembly.delivery==='arc')assembly.owner.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='energy-emitter-tip'&&!o.userData.comicOverlay)tips.push(o);});
   const tipPoints=tips.slice(0,2).map((tip,i)=>{const b=new THREE.Box3().setFromBufferAttribute(tip.geometry.attributes.position as THREE.BufferAttribute);return b.getCenter(new THREE.Vector3()).setX(i===0?b.max.x:b.min.x);});
   this.terminals.push({assembly,host,group,lines,lamp,unit:u,gap,seed:profile.seed,period:profile.range(7,.7,1.8),epoch:-1,idleSeed:profile.seed,charge:1,shotAt:-Infinity,lastAccepted:-Infinity,pending:0,events:sequence,choice:profile,tips:tips.slice(0,2),tipPoints});
  }
 }
 shot(muzzleIndex?:number):void{
  if(this.disposed)return;for(const terminal of this.terminals)if(muzzleIndex===undefined||terminal.assembly.index===muzzleIndex)terminal.pending=muzzleIndex===undefined?.35:1;
 }
 update(dt:number,time:number):void{
  if(this.disposed||!Number.isFinite(dt)||dt<0||!Number.isFinite(time))return;if(dt===0&&this.lastTime===time)return;
  const step=this.lastTime===undefined?0:Math.max(0,Math.min(.1,time-this.lastTime));this.lastTime=time;
  for(const cell of this.terminals){
   const beam=cell.assembly.delivery==='beam'||cell.assembly.delivery==='arc',precision=cell.assembly.delivery==='slug'||cell.assembly.delivery==='spike';
   if(cell.pending){if(time-cell.lastAccepted>=(beam?.045:.12)){cell.lastAccepted=time;cell.shotAt=time;cell.choice=cell.events.next(5,'shot');cell.charge=.12;}else if(beam)cell.shotAt=time;cell.pending=0;}
   cell.charge=Math.min(1,cell.charge+step/(precision?.60:.48));const age=time-cell.shotAt,kick=age<.075?Math.exp(-age/(beam?.055:.030)):0;
   const phase=(time+cosmeticSample(cell.seed,12)*cell.period)/cell.period,epoch=Math.floor(phase),idleAge=(phase-epoch)*cell.period;
   if(epoch!==cell.epoch){cell.epoch=epoch;cell.idleSeed=cosmeticSample(cell.seed,epoch+53)*65535;}
   const idle=idleAge<.095?Math.sin(Math.PI*idleAge/.095)**2*cell.charge:0;
   cell.lamp.opacity=(.20+cell.charge*.36+kick*.42)*this.weight;
   for(const b of this.bindings)if(b.assembly===cell.assembly&&b.overlay){const u=b.overlay.material.uniforms;u.time.value=time;u.charge.value=cell.charge;u.kick.value=kick;}
   cell.lines.begin();const alpha=(idle*(precision?.22:.34)+kick*.95)*this.weight;
   if(alpha>.015){
    const z=cell.unit*.65;this.a.set(0,-cell.gap*.5,z);
    for(let i=1;i<=8;i++){const q=i/8,salt=kick>.02?cell.choice.seed:cell.idleSeed;this.b.set((cosmeticSample(salt,i+3)-.5)*cell.unit*.50*Math.sin(q*Math.PI),THREE.MathUtils.lerp(-cell.gap*.5,cell.gap*.5,q),z+Math.sin(q*Math.PI)*cell.unit*.12);cell.lines.add(this.a,this.b,cell.unit*(precision?.105:.145)*this.weight,alpha);this.a.copy(this.b);}
    if(kick>.10){this.a.set(0,cell.gap*.5,z);for(let i=1;i<=4;i++){const q=i/4;this.b.set((cell.choice.sample(i+19)-.5)*cell.unit*.40,cell.gap*.5+q*cell.unit*1.9,z+q*cell.unit*.15);cell.lines.add(this.a,this.b,cell.unit*.12*this.weight,kick*this.weight*(1-q*.6));this.a.copy(this.b);}}
   }
   if(beam&&cell.tips.length===2&&(idle>.02||kick>.05)){
    relativeEquipmentMatrix(cell.group,cell.assembly.owner,this.inverse).invert();
    relativeEquipmentMatrix(cell.tips[0],cell.assembly.owner,this.matrix);this.a.copy(cell.tipPoints[0]).applyMatrix4(this.matrix).applyMatrix4(this.inverse);this.root.copy(this.a);
    relativeEquipmentMatrix(cell.tips[1],cell.assembly.owner,this.matrix);this.b.copy(cell.tipPoints[1]).applyMatrix4(this.matrix).applyMatrix4(this.inverse);const end=this.b.clone();
    for(let i=1;i<=12;i++){const q=i/12;this.b.copy(this.root).lerp(end,q);this.b.y+=(cell.choice.sample(i+30)-.5)*cell.unit*.30*Math.sin(q*Math.PI);cell.lines.add(this.a,this.b,cell.unit*.085*this.weight,Math.max(idle*.13,kick*.70)*this.weight);this.a.copy(this.b);}
   }
   cell.lines.upload();
  }
 }
 get diagnostics(){return{bindings:this.bindings.length,visibleSurfaces:this.bindings.filter(b=>!!b.overlay).length,terminals:this.terminals.length,segments:this.terminals.reduce((n,t)=>n+t.lines.activeCount,0),muzzleIndices:this.terminals.map(t=>t.assembly.index),charges:this.terminals.map(t=>t.charge)};}
 dispose():void{
  if(this.disposed)return;this.disposed=true;for(const cell of this.terminals){cell.lines.dispose();cell.group.removeFromParent();}
  for(const b of this.bindings){b.overlay?.removeFromParent();b.source.geometry=b.geometry;b.source.material=b.material;}
  for(const geometry of this.geometries)geometry.dispose();for(const material of this.materials)material.dispose();this.bindings.length=0;this.terminals.length=0;this.group.removeFromParent();this.released();
 }
}
