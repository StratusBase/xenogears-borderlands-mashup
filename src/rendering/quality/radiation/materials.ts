import * as THREE from 'three';
import {RADIATION_TIMING as T} from './timing';

const vertex=/* glsl */`
attribute float radAlpha,radAge,radSeed;attribute vec4 radPlane;
varying vec2 vUv;varying float vA,vAge,vSeed,vSupport;varying vec3 vN;
void main(){vUv=uv;vA=radAlpha;vAge=radAge;vSeed=radSeed;vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);vSupport=dot(radPlane.xyz,radPlane.xyz)<.1?1.:dot(radPlane.xyz,world.xyz)+radPlane.w;vN=normalize(mat3(modelViewMatrix*instanceMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`;
const fragment=/* glsl */`
uniform float kind;varying vec2 vUv;varying float vA,vAge,vSeed,vSupport;varying vec3 vN;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float blend(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
void main(){
 if(vA<.004)discard;vec2 p=(vUv-.5)*2.;float alpha=vA;vec3 color;
 if(kind<.5){
  // A tapered pressure streak, bright at the point of contact.
  float width=mix(.66,.025,vUv.x),edge=1.-smoothstep(width*.22,width,abs(p.y));
  alpha*=edge*pow(max(0.,1.-vUv.x),.26);color=mix(vec3(.96,.63,.015),vec3(1.6,1.35,.55),pow(edge,3.));
 }else if(kind<1.5){
  // Unequal, overlapping puffs rather than one airbrushed ellipse or radial petals.
  vec2 q=p;q.x+=sin(q.y*3.7+vSeed*9.+vAge*2.)*.065;
  vec2 a=q-vec2(-.27-.08*sin(vSeed*17.),.05*cos(vSeed*9.)),b=q-vec2(.16+vSeed*.17,.17+sin(vSeed*7.)*.10),c=q-vec2(.43+vSeed*.12,-.15-.11*cos(vSeed*13.));
  float da=length(a/vec2(.61,.68))-1.,db=length(b/vec2(.49,.50))-1.,dc=length(c/vec2(.32,.35))-1.;
  float shape=blend(blend(da,db,.24),dc,.16),coarse=noise(q*5.+vec2(vSeed*17.,-vAge*.6));
  shape+=(coarse-.5)*.14;
  float erosion=smoothstep(.30,1.45,vAge)*.30,density=1.-smoothstep(-.17-erosion,.08-erosion,shape);
  vec2 sphere=da<db&&da<dc?a/vec2(.61,.68):db<dc?b/vec2(.49,.50):c/vec2(.32,.35);
  vec3 n=normalize(vec3(sphere*.73,sqrt(max(.015,1.-dot(sphere,sphere)*.52))));
  float light=dot(n,normalize(vec3(-.45,.75,.65))),crease=smoothstep(.10,.34,abs(da-db));
  float shade=light*.65+coarse*.16+crease*.10;
  float band=shade>.50?1.:shade>.25?.72:.28;
  color=mix(vec3(.48,.33,.018),vec3(1.03,.91,.40),band);
  color=mix(color,vec3(1.30,1.18,.68),smoothstep(.78,.92,shade)*.60);
  // Resolvable, intermittent scintillation; empty gaps live outside the volume.
  vec2 cell=floor(q*15.+vSeed*11.);float pick=hash(cell),spark=step(.955,pick)*step(.73,fract(vAge*(6.+pick*5.)+pick*13.));
  spark*=1.-smoothstep(.10,.23,length(fract(q*15.+vSeed*11.)-.5));
  color=mix(color,vec3(1.9,1.55,.52),spark);alpha*=density*(.82+spark*.18)*smoothstep(.002,.055,vSupport);
 }else if(kind<2.5){
  float lit=.55+.45*max(0.,dot(normalize(vN),normalize(vec3(-.4,.8,1.))));
  color=mix(vec3(.40,.24,.004),vec3(1.08,.86,.13),step(.53,fract(vSeed*23.)))*lit;
 }else{
  // Small ionization stars. No rings, lightning branches or blanket glow.
  float core=1.-smoothstep(.06,.24,length(p));
  float x=max(0.,1.-abs(p.x)-abs(p.y)*6.5),y=max(0.,1.-abs(p.y)-abs(p.x)*6.5);
  float star=max(core,max(x,y));alpha*=star; color=mix(vec3(1.,.77,.055),vec3(2.1,1.85,.83),core);
 }
 if(alpha<.008)discard;gl_FragColor=vec4(color,min(.98,alpha));}`;

export function radiationParticleMaterial(kind:number){return new THREE.ShaderMaterial({name:['radiation-gamma-flash','radiation-fallout-volume','radiation-decay-flake','radiation-scintillation'][kind],uniforms:{kind:{value:kind}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});}

/** Motion is chosen once per event. Shape, lane spacing and rolling phase vary independently. */
export function radiationLobe(age:number,seed:number,lane:number){
 const delay=(lane===0?T.release:lane===1?T.counter:T.fringe)+(seed-.5)*.020,t=Math.max(0,age-delay),travel=lane===2?Math.min(t,.45):t,growth=1-Math.exp(-t*(lane===2?6:T.roll));
 return{delay,t,growth,x:(lane===0?1.12:lane===1?-.30:.75)*travel*(1.8+seed*.5),y:(lane===0?.16:lane===1?.30:-.08)*t,z:.10+t*(lane===0?.65:.38),stretch:1+Math.sin(t*6+seed*5+lane)*.10,turn:(lane===0?.35:lane===1?-.65:.70)*t};
}
