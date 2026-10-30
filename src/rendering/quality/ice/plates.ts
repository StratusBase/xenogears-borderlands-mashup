import * as THREE from 'three';
import type { EffectVariation } from '../shared/variation';

export type IcePlateStyle = 'previous' | 'layered';

// Kept byte-for-byte as the previous presentation shader for same-build comparisons and flakes.
export const previousIceVertex = /* glsl */`attribute float iceAlpha;varying float vA;varying vec3 vN;varying vec3 vP;varying vec3 vV;void main(){vA=iceAlpha;vP=position;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalize(mat3(modelViewMatrix*instanceMatrix)*normal);gl_Position=projectionMatrix*mv;}`;
export const previousIceFragment = /* glsl */`varying float vA;varying vec3 vN;varying vec3 vP;varying vec3 vV;void main(){if(vA<.015)discard;vec3 n=normalize(vN);float lit=dot(n,normalize(vec3(-.4,.8,1.)));float edge=smoothstep(.80,1.,length(vP.xy*vec2(.95,1.35)));float vein=pow(max(0.,cos(vP.x*17.+vP.y*12.+sin(vP.y*10.)*.9)),28.);float shine=pow(max(0.,dot(n,normalize(normalize(vV)+vec3(-.4,.8,1.)))),65.);vec3 c=mix(vec3(.065,.15,.23),vec3(.10,.24,.37),smoothstep(-.2,.6,lit));c=mix(c,vec3(.87,.96,.98),max(edge*.86,vein*.24));c+=vec3(.10,.14,.17)*shine;gl_FragColor=vec4(c,vA);}`;

export const layeredIceVertex = /* glsl */`attribute float iceAlpha;attribute float iceSeed;varying float vA;varying float vSeed;varying vec3 vN;varying vec3 vP;varying vec3 vV;
void main(){vA=iceAlpha;vSeed=iceSeed;vP=position;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalize(mat3(modelViewMatrix*instanceMatrix)*normal);gl_Position=projectionMatrix*mv;}`;
export const layeredIceFragment = /* glsl */`varying float vA;varying float vSeed;varying vec3 vN;varying vec3 vP;varying vec3 vV;
float segment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
void main(){if(vA<.015)discard;
 vec2 p=vP.xy;
 float border=min(min(segment(p,vec2(-.91,-.28),vec2(-.58,-.64)),segment(p,vec2(-.58,-.64),vec2(.31,-.54))),min(segment(p,vec2(.31,-.54),vec2(1.,.02)),segment(p,vec2(1.,.02),vec2(.48,.61))));
 border=min(border,min(segment(p,vec2(.48,.61),vec2(-.46,.68)),segment(p,vec2(-.46,.68),vec2(-.91,-.28))));
 float aa=max(.002,fwidth(border));float rim=1.-smoothstep(.017-aa,.036+aa,border);
 vec2 bend=vec2(-.10+vSeed*.24,-.06+vSeed*.08);
 float crack=min(segment(p,vec2(-.65,.32-vSeed*.30),bend),segment(p,bend,vec2(.64,-.22+vSeed*.16)));
 crack=min(crack,segment(p,vec2(-.35,.42),vec2(.12,.22+vSeed*.12)));
 float detail=1.-smoothstep(.08,.18,length(fwidth(p)));
 float fracture=(1.-smoothstep(.006,.014+max(.002,fwidth(crack)),crack))*detail;
 vec3 n=normalize(vN);float light=dot(n,normalize(vec3(-.4,.8,1.)));
 vec3 color=mix(vec3(.04,.09,.14),vec3(.08,.16,.24),smoothstep(.14,.24,light));
 color+=vec3(.025,.035,.045)*smoothstep(-.035,.035,p.x*.42+p.y-.03);
 color=mix(color,vec3(.83,.93,.96),fracture*.34);color=mix(color,vec3(.94,.98,.99),rim*.94);
 float glint=pow(max(0.,dot(n,normalize(normalize(vV)+vec3(-.4,.8,1.)))),65.);
 color+=vec3(.035,.045,.05)*glint;gl_FragColor=vec4(color,vA*mix(.86,.98,rim));
}`;

/** Same polygon, extrusion, dimensions and particle scale in both versions. */
export function icePlateGeometry(){
 const shape=new THREE.Shape(),points=[[-.91,-.28],[-.58,-.64],[.31,-.54],[1,.02],[.48,.61],[-.46,.68]];
 points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:1,steps:1,curveSegments:1});geometry.translate(0,0,-.035);return geometry;
}

const layouts=[
 [[.09,.08],[-.08,.01],[.18,.13],[-.18,-.10],[.03,-.15]],
 [[.08,.02],[-.09,-.10],[.18,.16],[-.19,-.16],[.01,.14]],
 [[.04,.07],[-.10,-.03],[.16,.18],[-.22,-.08],[.03,-.16]],
] as const;
/** Independent cosmetic choices, fixed at birth. No size/count/lifetime or gameplay randomness changes. */
export function icePlateArrangement(event:EffectVariation,index:number){
 const i=index%5,[x,y]=layouts[event.variant%layouts.length][i];
 const turn=[0,1.35,-1.15][event.variant%3]+event.range(1,-.20,.20),c=Math.cos(turn),s=Math.sin(turn);
 return{offset:new THREE.Vector2(x*c-y*s,x*s+y*c),yaw:turn+[-.12,.09,.18,-.22,.26][i]+event.range(4+i,-.06,.06),
  direction:[.55,.35,.75,-.05,1.05][i]+turn+event.range(10+i,-.08,.08),
  spin:new THREE.Vector3(event.range(16+i,-.20,.20),event.range(22+i,-.22,.22),event.range(28+i,-.45,.45)),seed:event.sample(34+i)};
}
