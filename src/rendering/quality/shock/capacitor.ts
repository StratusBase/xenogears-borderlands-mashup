import * as THREE from 'three';
import { cosmeticSample } from '../shared/variation';

export const CAPACITOR_BUDGET=Object.freeze({blades:8,segments:18,shards:56});
interface Blade {angle:number;length:number;width:number;bends:Float32Array;edges:Float32Array;root:number}
interface Shard {angle:number;speed:number;length:number;width:number;lift:number;delay:number;roll:number}
const corners=[[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]] as const;
/** Primary-only capacitor volume. It samples the response's age; it owns no clock or gameplay state. */
export class CapacitorBurst {
 readonly group=new THREE.Group();readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 readonly core:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 private geometry=new THREE.BufferGeometry();private blades:Blade[]=[];private shards:Shard[]=[];
 private point=new THREE.Vector3();private next=new THREE.Vector3();private side=new THREE.Vector3();private direction=new THREE.Vector3();private view=new THREE.Vector3(0,0,1);
 private reach=1;private seed=0;private vertices=0;private bladeVertices=0;private shapeDirty=true;private disposed=false;
 constructor(){
  const count=CAPACITOR_BUDGET.blades*CAPACITOR_BUDGET.segments*6+CAPACITOR_BUDGET.shards*6;
  this.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
  this.geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(count*2),2).setUsage(THREE.DynamicDrawUsage));
  this.geometry.setAttribute('kind',new THREE.BufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage));
  (this.geometry.attributes.position as THREE.BufferAttribute).onUpload(()=>{this.shapeDirty=false;});
  const material=new THREE.ShaderMaterial({name:'shock-capacitor-white-blades',transparent:true,side:THREE.DoubleSide,depthWrite:false,depthTest:true,toneMapped:false,uniforms:{age:{value:0},presence:{value:0}},
   vertexShader:/* glsl */`attribute float kind;varying vec2 vUv;varying float vKind;void main(){vUv=uv;vKind=kind;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:/* glsl */`varying vec2 vUv;varying float vKind;uniform float age,presence;
    void main(){float across=abs(vUv.y),aa=max(fwidth(across),.015);float edge=1.-smoothstep(.92-aa,1.,across);
     float head=smoothstep(0.,.045,age),tail=smoothstep(.13,.34,age)*.88;
     float window=vKind>.5?1.:smoothstep(tail-.06,tail+.02,vUv.x)*(1.-smoothstep(head-.025,head+.025,vUv.x));
     float core=1.-smoothstep(.48,.68,across);vec3 c=mix(vec3(.006,.025,.14),vec3(.025,.29,1.),1.-smoothstep(.80,.97,across));
     c=mix(c,vec3(.90,.99,1.),core);float a=edge*window*presence;if(a<.015)discard;gl_FragColor=vec4(c,a);
    }`});
  this.mesh=new THREE.Mesh(this.geometry,material);this.mesh.name='shock-capacitor-blades-and-shards';this.mesh.frustumCulled=false;this.mesh.raycast=()=>{};this.mesh.renderOrder=8;
  this.core=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({name:'shock-capacitor-hot-nucleus',transparent:true,side:THREE.DoubleSide,depthWrite:false,depthTest:true,toneMapped:false,blending:THREE.AdditiveBlending,uniforms:{presence:{value:0},seed:{value:0}},
   vertexShader:/* glsl */`varying vec2 p;void main(){p=uv*2.-1.;vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);c.xy+=position.xy*vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));gl_Position=projectionMatrix*c;}`,
   fragmentShader:/* glsl */`varying vec2 p;uniform float presence,seed;void main(){float angle=atan(p.y,p.x),r=length(p);float boundary=.26+.035*sin(angle*7.+seed)+.022*sin(angle*17.-seed);float white=1.-smoothstep(boundary*.50,boundary,r);float ion=exp(-r*r*11.)*.45;float ray=exp(-abs(sin(angle*5.+seed))*24.)*exp(-r*8.)*.4;float a=(white*1.35+ion+ray)*presence;if(a<.004)discard;gl_FragColor=vec4(mix(vec3(.035,.29,1.),vec3(.91,.99,1.),white),a);}` }));
  this.core.name='shock-capacitor-hot-nucleus';this.core.frustumCulled=false;this.core.raycast=()=>{};this.core.renderOrder=9;
  this.group.name='shock-primary-capacitor';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;this.group.visible=false;this.group.add(this.mesh,this.core);
 }
 /** Stable per-event shape choices: no per-frame random silhouette and no gameplay RNG. */
 start(seed:number,reach:number,view:THREE.Vector3):void{
  if(this.disposed)return;this.seed=seed;this.reach=reach;this.view.copy(view).normalize();const entropy=Math.floor(seed*1000003)>>>0,s=(d:number)=>cosmeticSample(entropy,d),main=.12+s(1)*.55;
  this.blades=Array.from({length:CAPACITOR_BUDGET.blades},(_,i)=>{
   const counter=i>=6,offsets=[-.35,.12,.59,-.08,.38,-.58],angle=counter?main+2.6+s(20+i)*.9:main+offsets[i]+(s(35+i)-.5)*.16;
   const length=counter?.22+s(45+i)*.18:(i<3?1-i*.13:.63-(i-3)*.08)*(.84+s(55+i)*.16),width=counter?.012+s(65+i)*.010:i<3?.030+s(75+i)*.018:.010+s(75+i)*.009;
   const bends=Float32Array.from({length:19},(_,j)=>{if(j===0||j===18)return 0;const cell=Math.min(3,Math.floor(j/4.5)),f=j/4.5-cell;return THREE.MathUtils.lerp(s(100+i*40+cell)-.5,s(100+i*40+cell+1)-.5,f)*.15+(s(2000+i*20+j)-.5)*.025;});
   const edges=Float32Array.from({length:19},(_,j)=>.62+s(500+i*40+j)*.85);
   return{angle,length,width,bends,edges,root:i>=3&&i<6?.10+s(850+i)*.18:0};
  });
  this.shards=Array.from({length:CAPACITOR_BUDGET.shards},(_,i)=>({angle:main+(s(1000+i)*2-1)*(i%8===0?2.6:.90),speed:1.9+s(1100+i)*3.1,length:.035+s(1200+i)*.085,width:.002+s(1300+i)*.005,lift:.04+s(1400+i)*.16,delay:s(1500+i)*.045,roll:s(1600+i)}));
  this.vertices=0;this.writeBlades();this.bladeVertices=this.vertices;this.shapeDirty=true;this.geometry.attributes.uv.needsUpdate=true;this.geometry.attributes.kind.needsUpdate=true;
  this.core.scale.setScalar(reach*.54);this.core.position.z=.065;this.core.material.uniforms.seed.value=seed;this.group.visible=true;this.update(0);
 }
 private center(out:THREE.Vector3,blade:Blade,q:number):void{
  const k=Math.min(17,Math.floor(q*18)),f=q*18-k,bend=THREE.MathUtils.lerp(blade.bends[k],blade.bends[k+1],f)*Math.sin(q*Math.PI),travel=blade.root+q*blade.length;
  const width=blade.width*Math.sin(q*Math.PI)**.65*(1-q*.55);
  out.set((Math.cos(blade.angle)*travel-Math.sin(blade.angle)*bend)*this.reach,(Math.sin(blade.angle)*travel+Math.cos(blade.angle)*bend)*this.reach,.045+width*this.reach+.10*this.reach*Math.sin(q*Math.PI));
 }
 update(age:number):void{
  if(this.disposed||!this.group.visible)return;const a=Math.max(0,age),presence=1-THREE.MathUtils.smoothstep(a,.17,.40);this.mesh.material.uniforms.age.value=a;this.mesh.material.uniforms.presence.value=presence;
  this.core.material.uniforms.presence.value=(1-THREE.MathUtils.smoothstep(a,.055,.24))*(.82+.18*Math.sin(a*70+this.seed)**2);this.vertices=this.bladeVertices;
  for(const shard of this.shards){const t=Math.max(0,a-shard.delay),distance=(.06+t*shard.speed)*this.reach,length=shard.length*this.reach*(1-.5*THREE.MathUtils.smoothstep(a,.10,.36)),width=shard.width*this.reach;
   const x=Math.cos(shard.angle)*distance,y=Math.sin(shard.angle)*distance,z=.055+shard.lift*this.reach+t*.35;
   // Six vertices form two unequal pointed wedges, rather than thick short rods.
   for(const[q,edge]of [[0,0],[.44,-1],[1,0],[0,0],[1,0],[.62,1]] as const){const kink=q>.5?.012*this.reach*(shard.roll-.5):0;this.vertex(x+Math.cos(shard.angle)*q*length-Math.sin(shard.angle)*(edge*width+kink),y+Math.sin(shard.angle)*q*length+Math.cos(shard.angle)*(edge*width+kink),z+q*length*.22,q,edge*.82,1);}
  }
  this.geometry.setDrawRange(0,this.vertices);const position=this.geometry.attributes.position as THREE.BufferAttribute;position.clearUpdateRanges();position.addUpdateRange(this.shapeDirty?0:this.bladeVertices*3,(this.shapeDirty?this.vertices:this.vertices-this.bladeVertices)*3);position.needsUpdate=true;
 }
 private writeBlades():void{
  for(const blade of this.blades)for(let j=0;j<CAPACITOR_BUDGET.segments;j++){
   this.center(this.point,blade,j/18);this.center(this.next,blade,(j+1)/18);this.direction.copy(this.next).sub(this.point).normalize();this.side.crossVectors(this.direction,this.view).normalize();if(this.side.lengthSq()<.1)this.side.set(-Math.sin(blade.angle),Math.cos(blade.angle),0);
   for(const[along,edge]of corners){const q=(j+along)/18,p=along?this.next:this.point,w=this.reach*blade.width*Math.sin(q*Math.PI)**.65*(1-q*.55)*blade.edges[j+along];this.vertex(p.x+this.side.x*w*edge,p.y+this.side.y*w*edge,Math.max(.025,p.z+this.side.z*w*edge),q,edge,0);}
  }
 }
 private vertex(x:number,y:number,z:number,q:number,edge:number,kind:number):void{const i=this.vertices++;this.geometry.attributes.position.setXYZ(i,x,y,z);this.geometry.attributes.uv.setXY(i,q,edge);this.geometry.attributes.kind.setX(i,kind);}
 hide():void{this.group.visible=false;}
 get diagnostics(){return{active:this.group.visible,blades:this.group.visible?this.blades.length:0,shards:this.group.visible?this.shards.length:0,vertices:this.group.visible?this.vertices:0};}
 dispose():void{if(this.disposed)return;this.disposed=true;this.geometry.dispose();this.mesh.material.dispose();this.core.geometry.dispose();this.core.material.dispose();this.group.removeFromParent();}
}
