import * as THREE from 'three';
import type {IceResponse} from './response';

/** Loading work, not a longer benchmark warmup. No Game time, contact or particle state advances. */
export async function prepareIceRendering(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,ice:IceResponse,drawScene:()=>void){
 const started=performance.now(),warm=new THREE.Scene();warm.fog=scene.fog;warm.environment=scene.environment;
 const view=new THREE.PerspectiveCamera(60,1,.1,100);view.updateMatrixWorld(true);
 const clones:THREE.Mesh[]=[];
 scene.traverseVisible(object=>{if(object instanceof THREE.Light)warm.add(object.clone(false));});
 scene.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;const materials=Array.isArray(object.material)?object.material:[object.material];
  if(!materials.some(m=>m instanceof THREE.ShaderMaterial))return;
  const mesh=object.clone(false);mesh.position.set(0,0,-3);mesh.quaternion.identity();mesh.scale.setScalar(1);mesh.matrixAutoUpdate=true;mesh.visible=true;mesh.frustumCulled=false;mesh.castShadow=false;mesh.onBeforeRender=()=>{};
  // Warm the live buffers, including hidden/zero-count pools. Never write their contents.
  if(mesh instanceof THREE.InstancedMesh&&object instanceof THREE.InstancedMesh){mesh.instanceMatrix=object.instanceMatrix;mesh.instanceColor=object.instanceColor;mesh.morphTexture=object.morphTexture;mesh.count=Math.min(1,mesh.instanceMatrix.count);}
  warm.add(mesh);clones.push(mesh);
 });
 const geometry=new THREE.BoxGeometry(1,1,1),rime=new THREE.Mesh(geometry,ice.rimeMaterials.material);rime.position.z=-3;rime.frustumCulled=false;warm.add(rime);
 const target=new THREE.WebGLRenderTarget(8,8,{type:THREE.HalfFloatType,depthBuffer:true});
 const compile=async(source:THREE.Scene,view:THREE.Camera,targetScene:THREE.Scene)=>{const previous=renderer.getRenderTarget();let promise:Promise<THREE.Object3D>;try{renderer.setRenderTarget(target);promise=renderer.compileAsync(source,view,targetScene);}finally{renderer.setRenderTarget(previous);}await promise!;};
 try{
  await compile(scene,camera,scene);await compile(warm,view,warm);
  const previous=renderer.getRenderTarget(),auto=renderer.shadowMap.autoUpdate,needed=renderer.shadowMap.needsUpdate,clear=renderer.autoClear;
  try{renderer.setRenderTarget(target);renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.autoClear=true;renderer.render(warm,view);}finally{renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=auto;renderer.shadowMap.needsUpdate=needed;renderer.autoClear=clear;}
  drawScene();
  return{ms:performance.now()-started,programs:renderer.info.programs?.length??0,warmDraws:clones.length+1};
 }finally{
  // InstancedMesh.dispose deletes its instance buffers and morph texture. Detach the
  // borrowed handles first; the live presentation remains their sole owner.
  const empty=new THREE.InstancedBufferAttribute(new Float32Array(0),16);
  for(const mesh of clones)if(mesh instanceof THREE.InstancedMesh){mesh.instanceMatrix=empty;mesh.instanceColor=null;mesh.morphTexture=null;mesh.dispose();}
  geometry.dispose();target.dispose();warm.clear();
 }
}
