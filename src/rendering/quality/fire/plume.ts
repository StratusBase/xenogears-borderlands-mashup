import * as THREE from 'three';
import {acquireFireAtlas} from './atlas';

const vertex=/* glsl */`
 uniform float time,seed,curl;varying vec2 artP;
 void main(){artP=uv;vec3 p=position;float tip=clamp(uv.x/1.5,0.,1.);
 p.y+=tip*tip*(sin(uv.x*6.-time*13.+seed)*.095+sin(uv.x*15.+time*19.+seed)*.035);
 p.y+=tip*tip*curl*.12;
 p.z+=sin(uv.x*9.-time*11.+seed)*tip*tip*.055;
 p.x*=1.+sin(time*9.+seed+uv.x*5.)*tip*.10;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const fragment=/* glsl */`
 uniform sampler2D atlas;uniform float cell,time,seed,opacity,heat;varying vec2 artP;
 float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1)),f.x),f.y);}
 vec4 art(vec2 p){vec2 uv=(p+vec2(.30,.40))/vec2(2.05,1.65);if(min(uv.x,uv.y)<0.||max(uv.x,uv.y)>1.)return vec4(0.);return texture2D(atlas,vec2((cell+uv.x)/5.,uv.y));}
 void main(){float tip=clamp(artP.x/1.5,0.,1.);vec2 flow=vec2(n(artP*vec2(19.,27.)+vec2(-time*12.,seed)),n(artP*vec2(27.,19.)+vec2(-time*18.,seed+7.)))-.5;
 vec2 p=artP+flow*(.013+tip*.052);vec4 a=art(p);float edge=.004+tip*tip*.014;
 float alpha=min(a.a,min(art(p+vec2(edge,0.)).a,art(p-vec2(0.,edge)).a));if(alpha<.30||opacity<.015)discard;
 float band=clamp((a.r-.15)/.28,0.,3.);vec3 c=band<.5?vec3(.48,.022,.0005):band<1.5?vec3(1.,.080,.001):vec3(1.,.39,.018);
 if(band>2.5)c=mix(vec3(1.,.47,.035),vec3(1.,.91,.59),heat*(1.-smoothstep(.12,.55,p.x)));
 gl_FragColor=vec4(c,alpha*opacity);}`;

/** Authored forked tear, curved all the way to its root; grid deformation adds depth and independent tip motion. */
export function createFirePlume(seed:number,cell=0){
 const lease=acquireFireAtlas(),geometry=new THREE.PlaneGeometry(2.05,1.65,14,10);geometry.translate(.725,.425,0);
 const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv') as THREE.BufferAttribute;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i),p.getY(i));
 const material=new THREE.ShaderMaterial({name:'fire-authored-flowing-tear',vertexShader:vertex,fragmentShader:fragment,uniforms:{atlas:{value:lease.texture},cell:{value:cell%2},time:{value:0},seed:{value:seed},curl:{value:0},opacity:{value:1},heat:{value:1}},transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
 material.addEventListener('dispose',lease.release);
 const mesh=new THREE.Mesh(geometry,material);mesh.name='fire-hybrid-flowing-plume';mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.userData.element='fire';mesh.raycast=()=>{};mesh.renderOrder=4;
 mesh.onBeforeRender=()=>{material.uniforms.opacity.value=material.opacity;};
 return mesh;
}
export function updateFirePlume(mesh:ReturnType<typeof createFirePlume>,time:number,heat=1){mesh.material.uniforms.time.value=time;mesh.material.uniforms.heat.value=heat;}
export function disposeFirePlume(mesh:ReturnType<typeof createFirePlume>){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}
