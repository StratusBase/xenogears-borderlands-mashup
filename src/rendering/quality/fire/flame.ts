import * as THREE from 'three';

export const FIRE_LOBES=7;
/** Independent buoyant parcels. Their curved paths and unequal lifetimes drive the 3D combustion field. */
export function fireLobes(age:number,seed:number,explosive:boolean,out:THREE.Vector4[]){
 const t=Math.max(0,age),growth=1-Math.exp(-t*(explosive?24:35));
 for(let i=0;i<FIRE_LOBES;i++){
  const delay=i===0?0:.018*i,clock=Math.max(0,t-delay),phase=seed*2.1+i*2.399;
  const born=1-Math.exp(-clock*30),fade=1-THREE.MathUtils.smoothstep(clock,i===0?.09:explosive?.28:.20,i===0?.39:explosive?.82:.62);
  const spread=i===0?0:(.12+i*.043)*(explosive?1.45:1)*born;
  const curl=clock*(explosive?5.2:7.8)+phase;
  const x=Math.cos(phase)*spread+Math.sin(curl)*clock*.32;
  const y=-.56+(i===0?.12:i*.085)*growth+clock*(i===0?.8:1.05+i*.13)+clock*clock*.45;
  const z=Math.sin(phase)*spread+Math.cos(curl*1.17)*clock*.20;
  out[i].set(x,y,z,(i===0?.36:.22-i*.006)*(explosive?1.18:1)*born*fade);
 }
 return out;
}
export function createFireVolumeGeometry(){return new THREE.BoxGeometry(2,2,2);}
export const fireVolumeVertex=/* glsl */`
 varying vec3 vLocal;varying vec3 vEye;
 void main(){vLocal=position;vEye=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const fireVolumeFragment=/* glsl */`
 precision highp float;
 uniform mat4 projectionMatrix,modelViewMatrix;
 uniform float age,seed,explosive,life,supported;
 uniform vec4 lobes[7];uniform vec4 supportPlane;
 varying vec3 vLocal,vEye;
 float hash(vec3 p){p=fract(p*.3183099+vec3(.17,.31,.13));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm(vec3 p){return noise(p)*.58+noise(p*2.07+11.2)*.28+noise(p*4.13+2.4)*.14;}
 float density(vec3 p){
  if(supported>.5&&dot(supportPlane.xyz,p)+supportPlane.w<.008)return 0.;
  float h=clamp((p.y+.65)/1.6,0.,1.);
  // Advect upward; unequal lateral eddies bend the hot core before fine turbulence erodes it.
  vec3 adv=p*3.6+vec3(seed, -age*6.8,seed*.63);
  vec3 curl=vec3(noise(adv+14.),noise(adv.yzx+7.),noise(adv.zxy+29.))-.5;
  vec3 q=p+curl*(.11+h*.30);
  q.x+=sin(p.y*5.3-age*8.4+seed)*(.025+h*.12);
  q.z+=sin(p.y*6.8-age*6.1+seed*2.)*(.02+h*.10);
  float field=-10.;
  for(int i=0;i<7;i++){
   vec4 l=lobes[i];vec3 d=q-l.xyz;
   float taper=clamp(1.-max(0.,d.y)/max(.02,l.w)*.58,.16,1.);
   float r=length(d/vec3(taper,i==0?1.15:2.1,taper));
   field=max(field,1.-r/max(.001,l.w));
  }
  float turbulence=fbm(adv*1.5+curl*1.8);
  return smoothstep(.04,.31,field+(turbulence-.50)*(.42+h*.47))*(1.-smoothstep(.84,1.,abs(p.y)));
 }
 void main(){
  bool inside=max(max(abs(vEye.x),abs(vEye.y)),abs(vEye.z))<1.;
  if((!inside&&!gl_FrontFacing)||(inside&&gl_FrontFacing))discard;
  vec3 rd=normalize(vLocal-vEye),inv=1./rd;
  vec3 t0=(-vec3(1.)-vEye)*inv,t1=(vec3(1.)-vEye)*inv;
  vec3 nearT=min(t0,t1),farT=max(t0,t1);
  float entry=max(0.,max(max(nearT.x,nearT.y),nearT.z)),leave=min(min(farT.x,farT.y),farT.z);
  float stride=(leave-entry)/36.;if(stride<=0.)discard;
  float jitter=hash(vec3(gl_FragCoord.xy,seed+3.7));
  vec3 sum=vec3(0.);float alpha=0.,first=-1.;
  float fade=1.-smoothstep(life*.63,life,age);
  for(int step=0;step<36;step++){
   vec3 p=vEye+rd*(entry+(float(step)+jitter)*stride);
   float d=density(p)*fade;
   if(d>.035){
    if(first<0.)first=entry+(float(step)+jitter)*stride;
    float heat=clamp(d*(.47+.25*noise(p*12.+vec3(seed,-age*9.,3.)))-max(0.,p.y+.1)*.10,0.,1.);
    // Orange body, gold knots, a small hot core; avoid a flat pale ball.
    vec3 c=mix(vec3(.62,.016,.001),vec3(1.,.16,.002),smoothstep(.08,.40,heat));
    c=mix(c,vec3(1.2,.68,.035),smoothstep(.43,.82,heat));
    float a=1.-exp(-d*stride*4.7);
    sum+=(1.-alpha)*c*a;alpha+=(1.-alpha)*a;
    if(alpha>.96)break;
   }
  }
  if(alpha<.015)discard;
  vec4 clip=projectionMatrix*modelViewMatrix*vec4(vEye+rd*first,1.);
  gl_FragDepth=(clip.z/clip.w)*.5+.5;
  gl_FragColor=vec4(sum/max(alpha,.001),alpha);
 }`;

/** Flamelets use the same rising, curling turbulence as the main volume, rather than tapered strips. */
export const fireParticleVertex=/* glsl */`
 attribute float fxAlpha,fxAge,fxSeed,fxSupported;attribute vec4 fxSupport;uniform float kind;
 varying vec2 vUv;varying float vAlpha,vAge,vSeed,vSupported;varying vec4 vSupport;varying vec3 vWorld;
 void main(){vUv=uv;vAlpha=fxAlpha;vAge=fxAge;vSeed=fxSeed;vec3 p=position;
 if(kind>.5){p.y+=.5;float q=p.y;p.x+=sin(q*7.-fxAge*14.+fxSeed*13.)*.18*q*q;p.z+=cos(q*5.-fxAge*9.+fxSeed*7.)*.12*q*q;if(kind<1.5)p.y-=.15;}
 vSupport=fxSupport;vSupported=fxSupported;vec4 world=modelMatrix*instanceMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
export const fireParticleFragment=/* glsl */`
 uniform float kind,hybrid,cel;varying vec2 vUv;varying float vAlpha,vAge,vSeed,vSupported;varying vec4 vSupport;varying vec3 vWorld;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
 void main(){if(vAlpha<.012||vSupported>.5&&dot(vSupport.xyz,vWorld)+vSupport.w<.003)discard;
 if(kind<.5){vec3 color=hybrid>.5?mix(vec3(1.,.25,.008),vec3(1.,.95,.54),max(0.,1.-vAge*3.)):mix(vec3(.90,.055,.001),vec3(1.5,.65,.04),max(0.,1.-vAge*2.));gl_FragColor=vec4(color,vAlpha);return;}
 vec2 p=vec2(vUv.x*2.-1.,vUv.y);float q=p.y;
 vec2 adv=vec2(p.x*3.+vSeed*17.,q*6.-vAge*11.);
 float n=noise(adv)*.65+noise(adv*2.1+7.)*.35;
 float center=sin(q*7.-vAge*13.+vSeed*9.)*.30*q;
 float width=(1.-q)*(.68+.22*sin(q*9.-vAge*16.+vSeed*7.));
 float field=(width-abs(p.x-center))+(n-.5)*(.45+q*.3);
 float rootNoise=noise(vec2(p.x*4.7-vAge*2.,vSeed*11.));
 float root=.10+.23*pow(clamp(abs(p.x-center)/.85,0.,1.),1.4)+(rootNoise-.5)*.045;
 float foot=kind>1.5?smoothstep(0.,.08,q):smoothstep(root-.035,root+.060,q);
 float a=smoothstep(.0,.18,field)*foot*(1.-smoothstep(.86,1.,q))*vAlpha;
 if(kind>1.5){a*=sin(q*3.14159)*.13;gl_FragColor=vec4(.13,.11,.10,a);return;}
 if(cel>.5){float contour=smoothstep(.045,.085,field);a=contour*foot*(1.-smoothstep(.86,1.,q))*vAlpha;}
 if(a<.02)discard;float heat=clamp(field*.9+(1.-q)*.25,0.,1.);
 vec3 c=mix(vec3(.9,.025,.001),vec3(1.7,.34,.005),smoothstep(.10,.38,heat));c=mix(c,vec3(2.,.95,.08),smoothstep(.45,.8,heat));if(cel>.5){c=heat<.30?vec3(.95,.065,.001):heat<.56?vec3(1.,.33,.012):vec3(1.,.72,.13);}
 gl_FragColor=vec4(c,a*.86);
 }`;
