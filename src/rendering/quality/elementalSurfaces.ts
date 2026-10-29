import * as THREE from 'three';
import type { EquipmentAppearance } from '../../core/appearance';
import type { ElementType } from '../../core/arsenal';
import { createBandTexture } from '../materials';

export type SurfaceElement = Exclude<ElementType, 'kinetic'>;
export const SURFACE_ELEMENTS: readonly SurfaceElement[] = ['fire','ice','corrosive','shock','radiation','gravity','adhesive'];
export interface ElementalSurfaceRecipe {
  readonly index:number; readonly base:number; readonly color:number; readonly highlight:number;
  readonly equipmentCount:number; readonly statusCount:number; readonly response:string;
}
export const ELEMENTAL_SURFACE_RECIPES: Readonly<Record<SurfaceElement,Readonly<ElementalSurfaceRecipe>>> = Object.freeze({
  fire:Object.freeze({index:0,base:0x4d261c,color:0xff7832,highlight:0xffd58a,equipmentCount:6,statusCount:9,response:'heat cracks, rising flame tongues and cooling char'}),
  ice:Object.freeze({index:1,base:0x315761,color:0x90d9ef,highlight:0xe1faff,equipmentCount:8,statusCount:10,response:'frost filigree, rim facets and crystalline growth'}),
  corrosive:Object.freeze({index:2,base:0x30491d,color:0x80b939,highlight:0xc4e95b,equipmentCount:7,statusCount:9,response:'wet meniscus, descending runnels and viscous drops'}),
  shock:Object.freeze({index:3,base:0x243f55,color:0x61b9ed,highlight:0xd4f4ff,equipmentCount:8,statusCount:9,response:'branching conductor arcs and travelling charge'}),
  radiation:Object.freeze({index:4,base:0x54501e,color:0xd6cf48,highlight:0xffefa3,equipmentCount:6,statusCount:8,response:'contained particulate decay and slow dosimeter pulses'}),
  gravity:Object.freeze({index:5,base:0x392b54,color:0xa78bd9,highlight:0xe0c5ff,equipmentCount:3,statusCount:3,response:'orbital arcs, compression bands and inward lensing'}),
  adhesive:Object.freeze({index:6,base:0x674321,color:0xc48b43,highlight:0xf3cf8a,equipmentCount:6,statusCount:7,response:'honeyed wet patches, elastic filaments and stretching beads'}),
});

const noRaycast:THREE.Mesh['raycast']=()=>{};
const UP=new THREE.Vector3(0,1,0);
function overlayAncestor(object:THREE.Object3D):boolean {
  for(let node:THREE.Object3D|null=object;node;node=node.parent)if(node.userData.comicOverlay||node.userData.elementalSurface)return true;
  return false;
}
function weaponOwner(object:THREE.Object3D):boolean {
  for(let node:THREE.Object3D|null=object;node;node=node.parent){
    const owner=node.userData.visualOwner??node.userData.equipmentSlot;
    if(owner!==undefined)return owner==='weapon';
  }
  return false;
}
function localBounds(mesh:THREE.Mesh):THREE.Box3 {
  return new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute);
}
function tagged(object:THREE.Object3D,element:SurfaceElement):void {
  object.name=`elemental-${element}-surface-presentation`;
  object.userData.comicOverlay=true;object.userData.presentationOnly=true;
  object.userData.elementalSurface=true;object.userData.element=element;
  object.castShadow=object.receiveShadow=false;
  if(object instanceof THREE.Mesh)object.raycast=noRaycast;
}

const surfaceVertex=/* glsl */`
  uniform vec3 boundsMin;uniform vec3 boundsSize;uniform float offset;
  varying vec3 vP;varying vec3 vN;
  void main(){
    vP=(position-boundsMin)/boundsSize;
    vN=normalize(normalMatrix*normal);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normalize(normal)*offset,1.);
  }
`;
const surfaceFragment=/* glsl */`
  uniform float elementKind;uniform float time;uniform float equipment;uniform float seed;uniform float presence;
  uniform vec3 pigment;uniform vec3 highlight;
  varying vec3 vP;varying vec3 vN;
  float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  void main(){
    vec3 p=vP+vec3(seed,seed*.3,seed*.7);
    float n=noise(p*7.);float fine=noise(p*22.);float a=0.;float bright=.0;
    vec3 color=pigment;
    // Broad armor stays legible; this is a material response rather than an aura.
    if(elementKind<.5){
      float seam=1.-smoothstep(.025,.09,abs(sin((p.x+p.z)*14.+noise(p*3.)*5.)));
      float hot=smoothstep(.67,.86,n)*(.65+.15*sin(time*3.+p.y*8.));
      a=max(seam*.64,hot*.45);bright=seam*(.4+.2*sin(time*4.-p.y*9.));
      color=mix(vec3(.07,.025,.012),mix(pigment,highlight,bright),smoothstep(.04,.4,a));
    }else if(elementKind<1.5){
      float branch=pow(1.-abs(sin(p.x*27.+p.z*19.+noise(p*5.)*4.)),14.);
      float frost=smoothstep(.62,.84,n)*(.7+max(0.,vN.y)*.3);
      float edge=pow(abs(sin(p.y*29.+p.x*13.)),22.)*smoothstep(.43,.72,n);
      a=max(frost*.6,max(branch*.62,edge*.45));bright=max(branch,edge)*.6;
      color=mix(pigment,highlight,.38+fine*.4);
    }else if(elementKind<2.5){
      float runs=noise(vec3(p.x*19.,p.y*1.5+time*.12,p.z*19.));
      float wet=smoothstep(.60,.75,n);
      float rim=smoothstep(.54,.62,n)*(1.-smoothstep(.62,.69,n));
      a=max(wet*.76,smoothstep(.70,.82,runs)*.50);bright=pow(max(0.,dot(normalize(vN),normalize(vec3(-.4,.6,1.)))),20.);
      color=mix(pigment*.37,pigment,wet);color+=highlight*(bright*.38+rim*.15);
    }else if(elementKind<3.5){
      float arc=pow(1.-abs(sin(p.x*21.+p.z*17.+p.y*8.+floor(time*9.)*.57+noise(p*7.)*6.)),25.);
      float gate=.35+.65*smoothstep(.4,.9,sin(time*6.+seed)*.5+.5);
      a=arc*gate*.72;bright=arc*.8;color=mix(pigment,highlight,arc*.7);
    }else if(elementKind<4.5){
      float grain=step(.96,hash(floor(p*42.)));
      float pulse=.65+.35*sin(time*2.7+seed);
      float patches=smoothstep(.70,.84,n);
      a=max(grain*.5,patches*.38)*pulse;bright=grain*.35;color=mix(pigment*.7,highlight,grain*.7);
    }else if(elementKind<5.5){
      vec2 uv=p.xz-.5;float bands=pow(.5+.5*sin(length(uv)*44.-atan(uv.y,uv.x)*2.-time*2.+p.y*12.),20.);
      a=bands*.42;bright=bands*.2;color=mix(pigment*.55,highlight,bands*.65);
    }else{
      float sheet=smoothstep(.60,.77,n);
      float strand=pow(.5+.5*sin(p.x*24.+p.z*18.+noise(vec3(p.x*6.,p.y*.8+time*.035,p.z*6.))*5.),25.);
      float shine=pow(max(0.,dot(normalize(vN),normalize(vec3(.35,.6,1.)))),27.);
      a=max(sheet*.65,strand*.32);color=mix(pigment*.48,pigment,sheet)+highlight*shine*.45;
    }
    a*=mix(.74,1.,equipment)*presence;if(a<.035)discard;
    float facet=.72+abs(normalize(vN).y)*.18+max(0.,normalize(vN).z)*.10;
    gl_FragColor=vec4(color*(facet+bright*.16),a);
  }
`;
const accentVertex=/* glsl */`
  attribute float elementalAlpha;attribute vec3 elementalTint;
  varying float vA;varying vec3 vC;varying vec3 vN;
  void main(){vA=elementalAlpha;vC=elementalTint;vN=normalize(mat3(modelViewMatrix*instanceMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}
`;
const accentFragment=/* glsl */`
  varying float vA;varying vec3 vC;varying vec3 vN;
  void main(){if(vA<.02)discard;float band=dot(normalize(vN),normalize(vec3(-.4,.8,1.)))>.3?1.:.64;gl_FragColor=vec4(vC*band,vA);}
`;
interface Anchor {source:THREE.Mesh;point:THREE.Vector3;normal:THREE.Vector3;center:THREE.Vector3}
interface Overlay {source:THREE.Mesh;mesh:THREE.Mesh;material:THREE.ShaderMaterial}
interface AccentPool {mesh:THREE.InstancedMesh;alpha:THREE.InstancedBufferAttribute;tint:THREE.InstancedBufferAttribute;element:SurfaceElement;anchors:Anchor[];size:number;equipment:boolean;delivery:string;variant:number}

function accentGeometry(element:SurfaceElement):THREE.BufferGeometry {
  switch(element){
    case 'fire':return new THREE.ConeGeometry(1,2,5,1,false);
    case 'ice':return new THREE.OctahedronGeometry(1,0);
    case 'corrosive':return new THREE.IcosahedronGeometry(1,1);
    case 'shock':return new THREE.CylinderGeometry(.65,1,2,4,1);
    case 'radiation':return new THREE.TetrahedronGeometry(1,0);
    case 'gravity':{const geometry=new THREE.TorusGeometry(1,.025,4,28,Math.PI*1.48);return geometry;}
    case 'adhesive':return new THREE.CylinderGeometry(.65,1,2,6,1);
  }
}
function armorSources(root:THREE.Object3D):THREE.Mesh[]{
  const display=root.getObjectByName('reference-sentry')??root;
  const sources:THREE.Mesh[]=[];
  display.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh||overlayAncestor(object))return;
    const material=Array.isArray(object.material)?object.material:[object.material];
    const authored=material.some(value=>value.name==='quality-paint'||value.name==='quality-metal');
    const physical=display===root&&Number.isFinite(object.userData.enemyId)&&!object.userData.critical&&!/visor|eye|core|muzzle|warning|status|sensor|light/.test(object.name);
    if((authored||physical)&&object.geometry.getAttribute('position')&&object.geometry.getAttribute('normal'))sources.push(object);
  });
  // Front torso and two limb paint groups carry the response. Tiny metal greebles stay quiet.
  return sources.sort((a,b)=>{
    const paint=(mesh:THREE.Mesh)=>(Array.isArray(mesh.material)?mesh.material:[mesh.material]).some(m=>m.name==='quality-paint')?1:0;
    const score=(mesh:THREE.Mesh)=>paint(mesh)*5+(/upper|torso|chest|shin/.test(mesh.name)?2:0);
    return score(b)-score(a);
  }).slice(0,6);
}
function anchors(sources:readonly THREE.Mesh[],count:number):Anchor[]{
  const result:Anchor[]=[];
  if(!sources.length)return result;
  for(let i=0;i<count;i++){
    const source=sources[i%sources.length],position=source.geometry.getAttribute('position'),normal=source.geometry.getAttribute('normal');
    let selected=Math.floor((((i+1)*.61803398875)%1)*position.count);
    for(let step=0;step<Math.min(position.count,60);step++){
      const index=(selected+step*3)%position.count;
      if(normal.getZ(index)>.5){selected=index;break;}
    }
    result.push({source,point:new THREE.Vector3().fromBufferAttribute(position,selected),normal:new THREE.Vector3().fromBufferAttribute(normal,selected).normalize(),center:localBounds(source).getCenter(new THREE.Vector3())});
  }
  return result;
}

class SurfacePresentation {
  readonly group=new THREE.Group();
  readonly overlays:THREE.Mesh[]=[];
  protected readonly bindings:Overlay[]=[];
  protected readonly pools:AccentPool[]=[];
  private elapsed=0;
  private intensity=1;
  private disposed=false;
  private readonly dummy=new THREE.Object3D();
  private readonly point=new THREE.Vector3();
  private readonly normal=new THREE.Vector3();
  private readonly target=new THREE.Vector3();
  private readonly normalMatrix=new THREE.Matrix3();
  private readonly baseCenter=new THREE.Vector3();
  private readonly localMatrix=new THREE.Matrix4();
  constructor(protected readonly root:THREE.Object3D,name:string){
    this.group.name=name;this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;this.group.userData.elementalSurface=true;
    root.add(this.group);
  }
  protected surfaces(sources:readonly THREE.Mesh[],element:SurfaceElement,equipment:boolean):void {
    const recipe=ELEMENTAL_SURFACE_RECIPES[element];
    sources.forEach((source,index)=>{
      const bounds=localBounds(source),size=bounds.getSize(new THREE.Vector3());size.set(Math.max(size.x,.0001),Math.max(size.y,.0001),Math.max(size.z,.0001));
      const original=Array.isArray(source.material)?source.material[0]:source.material;
      const material=new THREE.ShaderMaterial({name:`quality-${element}-${equipment?'cartridge':'armor'}-response`,vertexShader:surfaceVertex,fragmentShader:surfaceFragment,
        uniforms:{boundsMin:{value:bounds.min},boundsSize:{value:size},offset:{value:equipment?.0025:.005},elementKind:{value:recipe.index},time:{value:0},presence:{value:equipment?1:.18},equipment:{value:equipment?1:0},seed:{value:index*1.719+.31},pigment:{value:new THREE.Color(recipe.color)},highlight:{value:new THREE.Color(recipe.highlight)}},
        transparent:true,depthTest:true,depthWrite:false,toneMapped:false,side:original?.side??THREE.FrontSide});
      const mesh=new THREE.Mesh(source.geometry,material);tagged(mesh,element);mesh.userData.borrowedGeometry=true;source.add(mesh);
      this.bindings.push({source,mesh,material});this.overlays.push(mesh);
    });
  }
  protected accents(sources:readonly THREE.Mesh[],element:SurfaceElement,equipment:boolean,delivery='bullet',variant=0):void {
    if(!sources.length)return;
    const recipe=ELEMENTAL_SURFACE_RECIPES[element],count=equipment?recipe.equipmentCount:recipe.statusCount;
    const geometry=accentGeometry(element),alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage),tint=new THREE.InstancedBufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('elementalAlpha',alpha);geometry.setAttribute('elementalTint',tint);
    const material=new THREE.ShaderMaterial({name:`quality-${element}-surface-accents`,vertexShader:accentVertex,fragmentShader:accentFragment,transparent:true,depthTest:true,depthWrite:false,toneMapped:false});
    const mesh=new THREE.InstancedMesh(geometry,material,count);tagged(mesh,element);mesh.name=`quality-${element}-${equipment?'cartridge':'status'}-accents`;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);
    const sourcesBounds=new THREE.Box3();this.root.updateWorldMatrix(true,true);
    for(const source of sources){source.updateWorldMatrix(true,false);sourcesBounds.union(localBounds(source).applyMatrix4(source.matrixWorld));}
    const worldSize=sourcesBounds.getSize(new THREE.Vector3());
    const worldScale=this.root.getWorldScale(new THREE.Vector3());
    const size=equipment?.11:Math.min(1.2,Math.max(.5,worldSize.y/Math.max(.0001,worldScale.y)*.44));
    this.pools.push({mesh,alpha,tint,element,anchors:anchors(sources,count),size,equipment,delivery,variant});
    const color=new THREE.Color();
    for(let i=0;i<count;i++){color.set(i%3?recipe.color:recipe.highlight);tint.setXYZ(i,color.r,color.g,color.b);}tint.needsUpdate=true;
  }
  protected initialize():void {this.renderAt(0);}
  get activeAccentCount():number{return this.pools.reduce((sum,pool)=>sum+pool.mesh.count,0);}
  /** Optional presentation fade, e.g. remaining status seconds / .2; never changes combat state. */
  setIntensity(value:number):void {if(Number.isFinite(value))this.intensity=THREE.MathUtils.clamp(value,0,1);}
  update(dt:number,time?:number):void {
    if(this.disposed||!Number.isFinite(dt)||dt<=0)return;
    this.elapsed+=dt;this.renderAt(Number.isFinite(time)?time!:this.elapsed);
  }
  private renderAt(time:number):void {
    if(this.disposed)return;
    this.root.updateWorldMatrix(true,true);
    this.localMatrix.copy(this.root.matrixWorld).invert();
    for(const binding of this.bindings){binding.material.uniforms.time.value=time;binding.material.uniforms.presence.value=this.intensity*(binding.material.uniforms.equipment.value?1:.18+.82*Math.min(1,this.elapsed/.5));}
    for(const pool of this.pools){
      const {mesh,element,equipment,anchors,size,variant,delivery}=pool;
      const pressure=delivery==='sticky'||delivery==='orb'?1.2:delivery==='beam'||delivery==='arc'?.75:1;
      const radius=size*(equipment?(element==='gravity'?1.22:.62):.95)*pressure;
      // Stable central torso/chamber center, in the presentation root's coordinate space.
      this.baseCenter.set(0,0,0);
      for(const anchor of anchors){this.point.copy(anchor.center).applyMatrix4(anchor.source.matrixWorld).applyMatrix4(this.localMatrix);this.baseCenter.add(this.point);}
      this.baseCenter.multiplyScalar(1/anchors.length);
      for(let i=0;i<anchors.length;i++){
        const anchor=anchors[i],seed=i*.61803398875+variant*.137;
        const age=(time*(element==='adhesive'?.48:element==='ice'?.35:1)+seed)%1;
        this.point.copy(anchor.point).applyMatrix4(anchor.source.matrixWorld).applyMatrix4(this.localMatrix);
        this.normalMatrix.getNormalMatrix(anchor.source.matrixWorld);
        this.normal.copy(anchor.normal).applyMatrix3(this.normalMatrix).transformDirection(this.localMatrix).normalize();
        this.point.addScaledVector(this.normal,equipment?.007:.009);
        this.dummy.position.copy(this.point);this.dummy.quaternion.identity();this.dummy.scale.setScalar(1);
        let alpha=equipment?.67:.76;
        switch(element){
          case 'fire':{
            const height=(equipment?.034:.115)*(1+.6*Math.sin(time*6+i));
            this.dummy.position.y+=age*(equipment?.028:.15);
            this.dummy.scale.set(equipment?.009:.022,height*(1-age*.45),equipment?.008:.018);
            this.dummy.rotation.z=Math.sin(time*4+i)*.18;alpha*=1-age*.72;break;
          }
          case 'ice':{
            this.dummy.position.addScaledVector(this.normal,equipment?.009:.02);
            this.dummy.quaternion.setFromUnitVectors(UP,this.normal.clone().addScaledVector(UP,.7).normalize());
            const growth=equipment?1:.35+.65*Math.min(1,this.elapsed/.5);
            this.dummy.scale.set((equipment?.008:.018)*growth,(equipment?.027:.065)*growth,(equipment?.007:.016)*growth);
            alpha*=.65+.22*Math.sin(time*.7+i);break;
          }
          case 'corrosive':{
            this.dummy.position.y-=age*age*(equipment?.035:.20);
            this.dummy.scale.set(equipment?.008:.022,(equipment?.012:.025)*(1+age*.9),equipment?.008:.015);
            alpha*=.9-age*.6;break;
          }
          case 'shock':{
            const length=(equipment?.028:.065)*(1+Math.sin(i*2.4)*.3);
            this.target.copy(this.normal).cross(UP);if(this.target.lengthSq()<.001)this.target.set(1,0,0);this.target.normalize().addScaledVector(UP,Math.sin(i*2.2+Math.floor(time*8))*.6).normalize();
            this.dummy.quaternion.setFromUnitVectors(UP,this.target);
            this.dummy.scale.set(equipment?.0028:.0045,length,equipment?.0028:.0045);
            alpha*=.35+.6*Math.max(0,Math.sin(time*7+i*1.8));break;
          }
          case 'radiation':{
            const angle=time*.7+i*2.399;
            this.dummy.position.add(new THREE.Vector3(Math.cos(angle)*radius*.14,age*(equipment?.035:.16),Math.sin(angle)*radius*.14));
            this.dummy.rotation.set(time*.4+i,time*.6+i*.3,0);this.dummy.scale.setScalar(equipment?.005:.012);alpha*=Math.sin(age*Math.PI)*.8;break;
          }
          case 'gravity':{
            this.dummy.position.copy(this.baseCenter);this.dummy.position.y+=(i-1)*radius*.26;
            // A moderately tilted field retains orbital curvature in the gameplay camera;
            // a horizontal hoop collapses into a misleading straight bar at pilot height.
            this.dummy.rotation.set((equipment?0:.88)+(equipment?.15:.12)*Math.sin(time*.6+i),i*(equipment?.13:.29), time*(i%2?-.55:.45)+i*2.1);
            const compression=1-.09*Math.sin(time*2.1+i);
            this.dummy.scale.set(radius*compression,radius*.73*compression,radius);
            alpha=equipment?.50:.40;break;
          }
          case 'adhesive':{
            // A finite sticky meniscus stretches down from an attached armor/chamber edge.
            const stretch=(equipment?.018:.07)*(1+.55*Math.sin(time*1.1+i));
            this.dummy.position.y-=stretch;
            this.target.copy(UP).multiplyScalar(-1).addScaledVector(this.normal,.14*Math.sin(time*.8+i)).normalize();
            this.dummy.quaternion.setFromUnitVectors(UP,this.target);
            this.dummy.scale.set(equipment?.0035:.007,stretch,equipment?.0035:.006);
            alpha=.67;break;
          }
        }
        this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);pool.alpha.setX(i,Math.max(0,alpha*this.intensity*(equipment?1:.18+.82*Math.min(1,this.elapsed/.5))));
      }
      mesh.instanceMatrix.needsUpdate=true;pool.alpha.needsUpdate=true;
    }
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;
    for(const binding of this.bindings){binding.mesh.removeFromParent();binding.material.dispose();}
    this.bindings.length=0;this.overlays.length=0;
    for(const pool of this.pools){pool.mesh.removeFromParent();pool.mesh.geometry.dispose();(pool.mesh.material as THREE.Material).dispose();pool.mesh.dispose();}
    this.pools.length=0;this.group.removeFromParent();
  }
}

/** Barrel/chamber-only material response; receiver paint and every other slot are untouched. */
export class ElementalEquipment extends SurfacePresentation {
  private readonly originals:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[]}[]=[];
  private readonly materials:THREE.MeshToonMaterial[]=[];
  private bands:THREE.DataTexture|undefined;
  constructor(root:THREE.Object3D,appearance:EquipmentAppearance){
    super(root,'quality-elemental-equipment');
    if(!appearance.equipped){this.initialize();return;}
    const channels=[appearance.element,appearance.secondaryElement].filter((element,index,all):element is SurfaceElement=>!!element&&element!=='kinetic'&&all.indexOf(element)===index);
    for(const element of channels){
      const sources:THREE.Mesh[]=[];
      root.traverse(object=>{if(object instanceof THREE.Mesh&&!(object instanceof THREE.InstancedMesh)&&!overlayAncestor(object)&&weaponOwner(object)&&object.userData.equipmentElementSurface===element&&object.geometry.getAttribute('normal'))sources.push(object);});
      if(!sources.length)continue;
      this.bands??=createBandTexture();
      const recipe=ELEMENTAL_SURFACE_RECIPES[element],material=new THREE.MeshToonMaterial({color:recipe.base,emissive:recipe.color,emissiveIntensity:.06,gradientMap:this.bands});material.name=`quality-${element}-cartridge-substrate`;this.materials.push(material);
      for(const source of sources){this.originals.push({mesh:source,material:source.material});source.material=material;}
      this.surfaces(sources,element,true);this.accents(sources,element,true,appearance.projectile,appearance.visualVariant??appearance.variant);
    }
    this.initialize();
  }
  override dispose():void {
    for(const {mesh,material}of this.originals)mesh.material=material;
    this.originals.length=0;super.dispose();this.materials.forEach(material=>material.dispose());this.materials.length=0;this.bands?.dispose();this.bands=undefined;
  }
}

/** Surface-conforming armor response with modest geometric lingering cues; does not touch status state. */
export class ElementalStatus extends SurfacePresentation {
  readonly element:ElementType;
  constructor(root:THREE.Object3D,element:ElementType){
    super(root,`quality-elemental-status-${element}`);this.element=element;
    if(element!=='kinetic'){
      const sources=armorSources(root);
      this.surfaces(sources,element,false);this.accents(sources,element,false);
    }
    this.initialize();
  }
}
