import * as THREE from 'three';
import {cosmeticSample} from '../shared/variation';

interface ResinPull {x:number;y:number;z:number;width:number;delay:number;neck:number;bead:number;beadAt:number;curve:number;phase:number;active:boolean}
export interface ResinProfile {variant:number;pulls:readonly ResinPull[];speed:number;sag:number;thickness:number}
export const RESIN_VARIANTS=['short-tack','split-pull','low-sweep','heavy-slump','long-draw'] as const;
/** Bounded art-directed forms, with continuous differences inside each family. */
export function createResinProfile(seed:number,variant=(seed>>>0)%RESIN_VARIANTS.length):ResinProfile {
 const r=(n:number,lo:number,hi:number)=>lo+(hi-lo)*cosmeticSample(seed,n),family=variant%RESIN_VARIANTS.length,hand=cosmeticSample(seed,1)<.5?-1:1;
 const lengths=[r(2,.48,.70),r(2,.58,.82),r(2,.72,.97),r(2,.38,.59),r(2,.95,1.18)];
 const angle=(family===2?r(3,-.35,.12):r(3,.18,.78)),count=family===3?1:family===0||family===4?2:3;
 const pulls=Array.from({length:3},(_,i):ResinPull=>{
  const a=i===0?angle:i===1?(family===1?angle+r(5,.48,.80):angle+r(5,1.9,2.8)):angle-r(6,.7,1.8);
  const length=i===0?lengths[family]:i===1?(family===1?r(7,.38,.62):r(7,.16,.35)):r(8,.15,.33);
  return{x:Math.cos(a)*length*hand,y:Math.sin(a)*length,z:r(9+i,.08,.27),width:(i===0?r(13,family===3?.17:.12,family===3?.23:.18):r(14+i,.045,.085)),delay:i===0?0:r(18+i,.018,.095),neck:r(22+i,.07,.17),bead:r(26+i,.40,.82),beadAt:r(30+i,.73,.88),curve:r(34+i,-.09,.12),phase:r(38+i,0,Math.PI*2),active:i<count};
 });return Object.freeze({variant:family,pulls:Object.freeze(pulls.map(p=>Object.freeze(p))),speed:r(42,12,20),sag:r(43,1.25,2.2),thickness:r(44,.65,.93)});
}
const STEPS=20,RINGS=8;
/** Closed thick sections: no cutout crown, radial disk or hole mask. */
export function createResinFold(){
 const count=3*(STEPS+1)*RINGS,positions=new Float32Array(count*3),indices:number[]=[],lanes:number[]=[],params:number[]=[];
 for(let lane=0;lane<3;lane++){
  const base=lane*(STEPS+1)*RINGS;
  for(let i=0;i<=STEPS;i++)for(let j=0;j<RINGS;j++){lanes.push(lane);params.push(i/STEPS,j/RINGS);}
  for(let i=0;i<STEPS;i++)for(let j=0;j<RINGS;j++){const a=base+i*RINGS+j,b=base+i*RINGS+(j+1)%RINGS,c=a+RINGS,d=b+RINGS;indices.push(a,b,c,b,d,c);}
  for(let j=1;j<RINGS-1;j++){indices.push(base,base+j+1,base+j);const end=base+STEPS*RINGS;indices.push(end,end+j,end+j+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('resinLane',new THREE.Float32BufferAttribute(lanes,1));g.setAttribute('resinParam',new THREE.Float32BufferAttribute(params,2));g.setIndex(indices);deformResinFold(g,0,0);return g;
}
/** Event-specific thick pulls, pinched necks and weighted beads; never a fixed radial crown. */
export function deformResinFold(geometry:THREE.BufferGeometry,age:number,seed:number,gravity=new THREE.Vector3(0,-1,0),chosen?:ResinProfile){
 const p=geometry.attributes.position,param=geometry.attributes.resinParam,lane=geometry.attributes.resinLane,t=THREE.MathUtils.clamp(Number.isFinite(age)?age:0,0,.8);
 let profile=chosen;if(!profile){if(geometry.userData.resinSeed!==seed){geometry.userData.resinSeed=seed;geometry.userData.resinProfile=createResinProfile(seed);}profile=geometry.userData.resinProfile as ResinProfile;}
 for(let i=0;i<p.count;i++){
  const s=profile.pulls[lane.getX(i)],q=param.getX(i),angle=param.getY(i)*Math.PI*2,clock=Math.max(0,t-s.delay-.035*(1-q)),grow=s.active?1-Math.exp(-clock*profile.speed):0,returning=THREE.MathUtils.smoothstep(clock,.25,.70);
  // A pinched neck and blunt end bead replace the former broad leaf-shaped cross-section.
  const end=Math.sqrt(Math.max(0,1-THREE.MathUtils.smoothstep(q,.89,1))),bulb=Math.exp(-(((q-s.beadAt)/.13)**2));
  const travel=grow*(1-returning*.25),width=(s.width*(1-q)**3+s.width*s.neck+s.width*s.bead*bulb)*grow*(1-returning*.48)*end,thickness=width*profile.thickness;
  const curl=Math.sin(q*Math.PI*1.5+clock*5+s.phase)*q*q*grow,roll=.12+q*.35+Math.sin(clock*7+s.phase)*.08,across=Math.hypot(s.x,s.y);
  const side=Math.cos(angle)*width,depth=Math.sin(angle)*thickness;
  const x=s.x*travel*q+curl*s.curve*.45-side*s.y/across+gravity.x*clock*clock*q*profile.sag;
  const y=s.y*travel*q+Math.sin(q*Math.PI)*grow*s.curve+curl*.040+side*s.x/across*Math.cos(roll)+gravity.y*clock*clock*q*profile.sag;
  const outward=.018+s.z*travel*q+Math.sin(q*Math.PI)*grow*.14*(1-returning*.85)+side*Math.sin(roll)*.18+depth+gravity.z*clock*clock*q*profile.sag;
  const clearance=outward-.009,z=.009+(clearance+Math.sqrt(clearance*clearance+.0001))*.5;
  p.setXYZ(i,x,y,z);
 }
 p.needsUpdate=true;geometry.computeVertexNormals();
}

export const resinVertex=/* glsl */`varying vec3 vN,vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
export const resinLight=/* glsl */`vec3 resinColor(vec3 n,vec3 v){vec3 l=normalize(vec3(-.45,.80,.85));float light=dot(n,l);float edge=pow(1.-abs(dot(n,v)),3.);float glint=pow(max(0.,dot(n,normalize(l+v))),85.);vec3 c=mix(vec3(.12,.030,.002),vec3(.55,.205,.014),smoothstep(-.35,.7,light));c=mix(c,vec3(.87,.49,.065),edge*.42);c+=vec3(1.,.91,.61)*glint*.42;return c;}`;
export const resinFragment=/* glsl */`uniform float age,life;varying vec3 vN,vV;${resinLight}void main(){float a=min(1.,(life-age)*9.);if(a<.01)discard;gl_FragColor=vec4(resinColor(normalize(vN),normalize(vV)),a*.82);}`;
export const resinParticleVertex=/* glsl */`attribute float resinAlpha;varying float vA;varying vec3 vN,vV;void main(){vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vA=resinAlpha;vec3 s=vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));vN=normalize(mat3(modelViewMatrix*instanceMatrix)*(normal/max(s,vec3(.000001))));vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
export const resinParticleFragment=/* glsl */`varying float vA;varying vec3 vN,vV;${resinLight}void main(){if(vA<.01)discard;gl_FragColor=vec4(resinColor(normalize(vN),normalize(vV)),vA*.84);}`;
