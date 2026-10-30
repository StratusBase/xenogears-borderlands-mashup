// Frozen pre-finish A+B comparison only. Shared services remain shared.
import * as THREE from 'three';
import {RADIATION_TIMING as T} from './timing';

const vertex=/* glsl */`
attribute float radAlpha,radAge,radSeed;attribute vec4 radPlane;varying vec2 vUv;varying float vA,vAge,vSeed,vSupport;varying vec3 vN;
void main(){vUv=uv;vA=radAlpha;vAge=radAge;vSeed=radSeed;vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);vSupport=dot(radPlane.xyz,radPlane.xyz)<.1?1.:dot(radPlane.xyz,world.xyz)+radPlane.w;vN=normalize(mat3(modelViewMatrix*instanceMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`;
const fragment=/* glsl */`
uniform float kind;varying vec2 vUv;varying float vA,vAge,vSeed,vSupport;varying vec3 vN;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
void main(){
 if(vA<.005)discard;vec2 p=(vUv-.5)*2.;float alpha=vA;vec3 color;
 if(kind<.5){
  float along=1.-vUv.x,edge=1.-smoothstep(.015,.44,abs(p.y));float core=pow(edge,4.);alpha*=edge*pow(max(0.,along),.35);
  color=mix(vec3(.83,.64,.10),vec3(1.,.98,.65),core);color+=vec3(.12,.12,.08)*core;
 }else if(kind<1.5){
  vec2 q=p;q.y/=clamp(.86-p.x*.16,.68,1.08);q.x+=sin(p.y*3.+vAge*3.+vSeed*5.)*.10;q.y+=sin(p.x*3.6-vAge*2.+vSeed*7.)*.09;
  float coarse=noise(q*2.4+vec2(vSeed*12.,-vAge*.55)),detail=noise(q*7.+vSeed*17.);
  float edge=length(q*vec2(.92,1.))+(coarse-.5)*.27+(detail-.5)*.075;
  float erosion=smoothstep(.28,.72,vAge)*.26;float density=1.-smoothstep(.63-erosion,1.-erosion,edge);float body=smoothstep(.12,.82,density);
  vec3 n=normalize(vec3(q.x*.5,q.y*.55,sqrt(max(.02,1.-dot(q,q)*.38))));float light=max(0.,dot(n,normalize(vec3(-.45,.8,.6))));
  float band=floor(clamp(light*.57+coarse*.30+body*.30,0.,.999)*3.)/2.;
  color=mix(vec3(.61,.48,.17),vec3(.98,.91,.61),band);color=mix(vec3(.76,.61,.23),color,body*.78+.22);
  float grain=step(.978,hash(floor(q*57.+vSeed*11.)))*(.5+.5*sin(vAge*14.+detail*18.));color+=vec3(.22,.21,.09)*grain;
  alpha*=density*.81*smoothstep(.004,.070,vSupport);
 }else{
  float lit=.65+.35*max(0.,dot(normalize(vN),normalize(vec3(-.4,.8,1.))));float blink=.55+.45*pow(.5+.5*sin(vAge*17.+vSeed*37.),3.);
  color=mix(vec3(.58,.49,.13),vec3(1.,.94,.53),blink)*lit;alpha*=.75+.25*blink;
 }
 if(alpha<.009)discard;gl_FragColor=vec4(color,min(.95,alpha));}`;

export function radiationParticleMaterial(kind:number){return new THREE.ShaderMaterial({name:kind===0?'radiation-gamma-flash':kind===1?'radiation-fallout-dust':'radiation-decay-grain',uniforms:{kind:{value:kind}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});}

/** Bounded shader distortion, not an expanding fixed circular sprite. */
export function radiationLobe(age:number,seed:number,lane:number){
 const delay=(lane===0?T.release:lane===1?T.counter:T.fringe)+(seed-.5)*.020,t=Math.max(0,age-delay),growth=1-Math.exp(-t*(lane===2?9:T.roll));
 return{delay,t,growth,x:(lane===0?.96:lane===1?-.27:.41)*t*(1.9+seed*.6),y:(lane===0?.24:lane===1?.12:-.12)*t,z:.11+t*(lane===0?.64:.34),stretch:1+Math.sin(t*7+seed+lane)*.13,turn:(lane===0?.55:lane===1?-1.0:1.5)*t};
}
