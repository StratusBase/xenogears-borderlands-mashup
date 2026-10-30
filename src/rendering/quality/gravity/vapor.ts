import * as THREE from 'three';
import {GRAVITY_TIMING} from './timing';

/** Soft pressure vapor, shared by Gravity's small carrier and contact accents.
 * Ballistics fades material.opacity; mirror that existing contract into GLSL. */
export function gravityVapor(seed:number,opacity=1){
 const material=new THREE.ShaderMaterial({name:'GravityPressureVapor',transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false,
  uniforms:{opacity:{value:opacity},seed:{value:seed%4096},time:{value:0},noiseRate:{value:GRAVITY_TIMING.spike.noiseRate}},
  vertexShader:`varying vec2 vUv;varying float vFacing;void main(){vec4 view=modelViewMatrix*vec4(position,1.);vFacing=abs(dot(normalize(normalMatrix*normal),normalize(-view.xyz)));vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float opacity,seed,time,noiseRate;varying vec2 vUv;varying float vFacing;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
void main(){vec2 p=vUv;float curl=sin(p.y*7.+seed)*.12+sin(p.y*13.+seed*2.)*.04;float width=.10+.12*sin(p.y*3.14159);float edge=exp(-pow((p.x-.5-curl)/width,2.)*2.);float ends=smoothstep(0.,.24,p.y)*(1.-smoothstep(.62,1.,p.y));float n=noise(vec2(p.x*9.+seed,p.y*15.-time*noiseRate));float fine=noise(vec2(p.x*17.-seed,p.y*28.-time*noiseRate*1.67));float a=smoothstep(.025,.17,vFacing)*edge*ends*mix(.10,.85,n)*mix(.35,1.,fine)*opacity;if(a<.002)discard;gl_FragColor=vec4(mix(vec3(.28,.12,.48),vec3(.67,.43,.91),n),a);}`});
 Object.defineProperty(material,'opacity',{configurable:true,get:()=>material.uniforms.opacity.value as number,set:(value:number)=>{material.uniforms.opacity.value=value;}});return material;
}
export function gravityCosmetic<T extends THREE.Object3D>(object:T):T{object.userData.presentationOnly=true;object.userData.comicOverlay=true;object.raycast=()=>{};return object;}
