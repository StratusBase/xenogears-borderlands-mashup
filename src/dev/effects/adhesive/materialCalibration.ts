import * as THREE from 'three';
import {HONEY_PALETTE} from '../../../rendering/quality/adhesive/material';

// CPU reference for the installed Three.js ACESFilmicToneMapping + sRGB transfer.
// Matrices/fit match three/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js.
export function expectedOutput(rgb:readonly number[],exposure:number){
 const mul=(a:number[][],v:readonly number[])=>a.map(row=>row.reduce((sum,n,i)=>sum+n*v[i],0));
 const input=mul([[.59719,.35458,.04823],[.076,.90834,.01566],[.0284,.13383,.83777]],rgb.map(v=>v*exposure/.6));
 const fitted=input.map(v=>(v*(v+.0245786)-.000090537)/(v*(.983729*v+.432951)+.238081));
 return mul([[1.60475,-.53108,-.07367],[-.10208,1.10813,-.00605],[-.00327,-.07276,1.07602]],fitted).map(v=>{v=THREE.MathUtils.clamp(v,0,1);return Math.round((v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055)*255);});
}
export class MaterialCalibration {
 readonly group=new THREE.Group();private frames=0;private done=false;
 readonly patches=[{label:'Previous raw linear body',rgb:[.55,.205,.014]},...Object.entries(HONEY_PALETTE).map(([label,rgb])=>({label:'Honey '+label,rgb}))];
 constructor(private scene:THREE.Scene,private camera:THREE.Camera){
  this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;this.group.renderOrder=100000;this.group.name='adhesive-color-calibration';scene.add(this.group);
  this.patches.forEach((p,i)=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.52,.52),new THREE.ShaderMaterial({uniforms:{swatchColor:{value:new THREE.Vector3(...p.rgb)}},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 swatchColor;void main(){gl_FragColor=vec4(swatchColor,1.);}',toneMapped:false,depthTest:false,depthWrite:false}));mesh.position.set((i%3-1)*.65,i<3?.65:0,-2);mesh.renderOrder=100000;mesh.raycast=()=>{};this.group.add(mesh);});
 }
 align(){this.group.position.copy(this.camera.position);this.group.quaternion.copy(this.camera.quaternion);}
 sample(renderer:THREE.WebGLRenderer){
  if(this.done||++this.frames<3)return;this.done=true;const gl=renderer.getContext(),pixels=new Uint8Array(4);
  const patches=this.patches.map((p,i)=>{const at=this.group.children[i].getWorldPosition(new THREE.Vector3()).project(this.camera),x=Math.floor((at.x*.5+.5)*renderer.domElement.width),y=Math.floor((at.y*.5+.5)*renderer.domElement.height);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const sampled=Array.from(pixels).slice(0,3),expected=expectedOutput(p.rgb,renderer.toneMappingExposure);return{...p,expected,sampled,maxError:Math.max(...expected.map((v,j)=>Math.abs(v-sampled[j])))};});
  return{toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,outputColorSpace:renderer.outputColorSpace,patches,pass:patches.every(p=>p.maxError<=3),scope:'Readback immediately after actual ComicRenderer OutputPass/FXAA, no alternate renderer'};
 }
 dispose(){this.group.removeFromParent();for(const object of this.group.children){const mesh=object as THREE.Mesh;mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}
}
