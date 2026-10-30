import * as THREE from 'three';

export type SurfaceKind = 'skin' | 'cloth' | 'armor' | 'ground';
export interface SurfaceStatusVisual {
 readonly group:THREE.Group;
 update(dt:number,time?:number):void;
 setIntensity(value:number):void;
 dispose():void;
}
const surfaces=new Set<SurfaceKind>(['skin','cloth','armor','ground']);
export function surfaceKindOf(object:THREE.Object3D):SurfaceKind|undefined {
 let surface:SurfaceKind|undefined;
 for(let node:THREE.Object3D|null=object;node;node=node.parent){
  if(node.userData.equipmentSlot||node.userData.visualOwner&&node.userData.visualOwner!=='body')return;
  const tag=node.userData.effectSurface??node.userData.corrosiveSurface;
  if(!surface&&surfaces.has(tag))surface=tag;
 }return surface;
}
export function bodySurfaceSources(root:THREE.Group):THREE.Mesh[]{
 const explicit:THREE.Mesh[]=[],fallback:THREE.Mesh[]=[];
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh||!object.geometry.attributes.normal)return;
  for(let n:THREE.Object3D|null=object;n;n=n.parent)if(!n.visible||n.userData.comicOverlay||n.userData.equipmentSlot||n.userData.visualOwner&&n.userData.visualOwner!=='body')return;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  if(!materials.some(m=>m.visible&&m.colorWrite&&(!m.transparent||m.opacity>0)))return;
  if(surfaceKindOf(object)){explicit.push(object);return;}
  const physical=Number.isFinite(object.userData.enemyId),authored=materials.some(m=>m.name==='quality-paint');
  if((physical||authored)&&!/(?:^|-)(?:optic|visor|eye|core|muzzle|light|warning|status|sensor|rifle|cannon|blade|sight|weak-point)(?:-|$)/i.test(object.name))fallback.push(object);
 });return explicit.length?explicit:fallback;
}
export function targetSurfaceSpan(root?:THREE.Group):number{
 if(!root)return 2;root.updateWorldMatrix(true,true);const bounds=new THREE.Box3(),part=new THREE.Box3();
 for(const source of bodySurfaceSources(root))bounds.union(part.setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(source.matrixWorld));
 if(bounds.isEmpty())return 2;const size=bounds.getSize(new THREE.Vector3());return Math.max(.08,Math.min(size.x,size.y));
}
export interface SurfaceContact {source?:THREE.Mesh;surface:SurfaceKind;point:THREE.Vector3;normal:THREE.Vector3}
/** Resolve presentation on the visible outer shell; the authoritative collision remains untouched. */
export function nearestVisibleSurface(root:THREE.Group|undefined,point:THREE.Vector3,normal=new THREE.Vector3(0,0,1)):SurfaceContact{
 const direction=normal.clone();if(!Number.isFinite(direction.lengthSq())||direction.lengthSq()<.001)direction.set(0,1,0);direction.normalize();
 if(!root)return{surface:'ground',point:point.clone(),normal:direction};
 let source:THREE.Mesh|undefined,best=Infinity;const box=new THREE.Box3(),closest=new THREE.Vector3();
 root.updateWorldMatrix(true,true);
 const sources=bodySurfaceSources(root),ray=new THREE.Raycaster(point.clone().addScaledVector(direction,.75),direction.clone().negate(),0,1.5),hits:THREE.Intersection[]=[];
 for(const mesh of sources){
  // Display meshes intentionally opt out of combat raycasts. Use the stock routine only for this local VFX projection.
  THREE.Mesh.prototype.raycast.call(mesh,ray,hits);
 }
 hits.sort((a,b)=>a.distance-b.distance);
 const hit=hits.find(h=>h.point.distanceToSquared(point)<.75*.75);
 if(hit){source=hit.object as THREE.Mesh;const faceNormal=hit.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(source.matrixWorld)).normalize()??direction;
  if(faceNormal.dot(direction)<0)faceNormal.negate();return{source,surface:surfaceKindOf(source)??'armor',point:hit.point.clone(),normal:faceNormal};}
 // A broad combat proxy can extend past the display silhouette. A missed projection
 // must still land on real triangles; keeping the proxy point loses small splats.
 const triangle=new THREE.Triangle();let surfacePoint=point.clone(),surfaceNormal=direction.clone();
 for(const mesh of sources){
  const positions=mesh.geometry.attributes.position,index=mesh.geometry.index;
  box.setFromBufferAttribute(positions as THREE.BufferAttribute).applyMatrix4(mesh.matrixWorld);
  if(box.clampPoint(point,closest).distanceToSquared(point)>best)continue;
  const count=index?.count??positions.count;
  for(let i=0;i+2<count;i+=3){
   triangle.a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
   triangle.b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
   triangle.c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
   triangle.closestPointToPoint(point,closest);const distance=closest.distanceToSquared(point);
   if(distance<best){best=distance;source=mesh;surfacePoint.copy(closest);triangle.getNormal(surfaceNormal);if(surfaceNormal.dot(direction)<0)surfaceNormal.negate();}
  }
 }
 return{source,surface:source?surfaceKindOf(source)??'armor':'armor',point:surfacePoint,normal:surfaceNormal};
}
