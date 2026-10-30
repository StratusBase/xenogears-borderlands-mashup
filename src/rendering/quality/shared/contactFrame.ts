import * as THREE from 'three';

const Z=new THREE.Vector3(0,0,1);
/** Choose the direction once at contact. The splash remains world-space as the camera moves. */
export function surfaceContactFrame(normal:THREE.Vector3,point:THREE.Vector3,seed:number,camera?:THREE.Camera,supported=true){
 const rotation=new THREE.Quaternion().setFromUnitVectors(Z,normal),lift=supported?THREE.MathUtils.smoothstep(Math.abs(normal.y),.35,.85):0;
 if(lift>0&&camera){
  const view=camera.getWorldPosition(new THREE.Vector3()).sub(point);view.addScaledVector(normal,-view.dot(normal));
  if(view.lengthSq()>1e-8){
   const right=normal.clone().cross(view).normalize(),along=normal.clone().cross(right).normalize();
   const frame=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,along,normal));rotation.slerp(frame,lift);
  }
 }
 rotation.multiply(new THREE.Quaternion().setFromAxisAngle(Z,Math.sin(seed*2.7)*.35));return{rotation,lift};
}

export interface SurfaceSupport {point:THREE.Vector3;normal:THREE.Vector3;mesh?:THREE.Mesh}
/** Visual particle contact only. A finite top lets droplets fall off its edges. */
export function settleSurfaceParticle(position:THREE.Vector3,radius:number,support:SurfaceSupport):boolean{
 const distance=position.clone().sub(support.point).dot(support.normal);if(distance>=radius+.002)return false;
 const projected=position.clone().addScaledVector(support.normal,-distance);
 if(support.mesh){
  if(!support.mesh.parent)return false;support.mesh.updateWorldMatrix(true,false);
  const ray=new THREE.Raycaster(projected.clone().addScaledVector(support.normal,.10),support.normal.clone().negate(),0,.20),hits:THREE.Intersection[]=[];
  THREE.Mesh.prototype.raycast.call(support.mesh,ray,hits);
  const hit=hits.find(h=>h.face&&h.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(support.mesh!.matrixWorld)).normalize().dot(support.normal)>.8);
  if(!hit)return false;projected.copy(hit.point);
 }
 position.copy(projected).addScaledVector(support.normal,radius+.002);return true;
}
