import * as THREE from 'three';

interface Hardware {geometry:THREE.BoxGeometry;shield:THREE.MeshStandardMaterial;ceramic:THREE.MeshStandardMaterial;users:number}
let hardware:Hardware|undefined;let debug=false;
export function setRadiationHardwareDebug(enabled:boolean){debug=enabled;if(hardware){hardware.shield.color.set(debug?0xff00cc:0x28372e);hardware.ceramic.color.set(debug?0xff77dd:0xc8bd98);}}
/** One reference-counted unit mesh per live set of devices; source geometry is never owned here. */
export function retainRadiationHardware(){if(!hardware)hardware={geometry:new THREE.BoxGeometry(1,1,1),shield:new THREE.MeshStandardMaterial({color:0x28372e,roughness:.72,metalness:.28}),ceramic:new THREE.MeshStandardMaterial({color:0xc8bd98,roughness:.83,metalness:.02}),users:0};hardware.users++;if(debug){hardware.shield.color.set(0xff00cc);hardware.ceramic.color.set(0xff77dd);}return hardware;}
export function releaseRadiationHardware(value:Hardware){if(--value.users)return;value.geometry.dispose();value.shield.dispose();value.ceramic.dispose();if(hardware===value)hardware=undefined;}
export function cosmeticEquipment(root:THREE.Object3D){root.traverse(o=>{o.userData.presentationOnly=true;o.castShadow=o.receiveShadow=false;o.raycast=()=>{};});}
export function hardwareBoxes(geometry:THREE.BufferGeometry,material:THREE.Material,boxes:readonly {position:THREE.Vector3;size:THREE.Vector3}[]){const mesh=new THREE.InstancedMesh(geometry,material,boxes.length),matrix=new THREE.Matrix4();for(const [i,b]of boxes.entries())mesh.setMatrixAt(i,matrix.compose(b.position,new THREE.Quaternion(),b.size));mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;return mesh;}

/** Batches may span unrelated high details: use actual triangles under the fitting, not the batch AABB. */
export function radiationMountHeight(source:THREE.Mesh,physical:readonly THREE.Mesh[],center:THREE.Vector3,width:number,length:number,fallback:number){
 const parent=source.parent!,inverse=new THREE.Matrix4().copy(parent.matrixWorld).invert(),owner=(o:THREE.Object3D)=>{for(let n:THREE.Object3D|null=o;n;n=n.parent)if(n.userData.visualOwner==='weapon')return n;},same=physical.filter(m=>owner(m)===owner(source));let ceiling=fallback;
 for(const mesh of same){const box=new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));ceiling=Math.max(ceiling,box.max.y);}
 const ray=new THREE.Raycaster(),direction=new THREE.Vector3(0,-1,0).transformDirection(parent.matrixWorld);let top=fallback;
 for(const [x,z]of [[0,0],[-.38,-.38],[-.38,.38],[.38,-.38],[.38,.38]]){const origin=new THREE.Vector3(center.x+x*width,ceiling+1,center.z+z*length).applyMatrix4(parent.matrixWorld);ray.set(origin,direction);for(const hit of ray.intersectObjects(same,false)){const point=hit.point.clone().applyMatrix4(inverse);top=Math.max(top,point.y);}}
 return top;
}
