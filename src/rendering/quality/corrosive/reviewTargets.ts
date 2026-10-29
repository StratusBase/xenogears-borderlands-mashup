import * as THREE from 'three';
import { addBox,addCylinder,createQualityMaterial } from '../primitives';
import type { EnemyPresentation } from '../../../encounter/contracts';
import type { CorrosiveSurface } from './surfaces';

/** Clothed human VFX review fixtures, not new combat archetypes or story canon. */
export function createCorrosiveReviewTarget(root:THREE.Group,id:number,armored:boolean){
 const originals:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[];cast:boolean;receive:boolean}[]=[];
 const proxy=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,transparent:true,opacity:0});
 root.traverse(object=>{if(object instanceof THREE.Mesh&&object.userData.enemyId===id){originals.push({mesh:object,material:object.material,cast:object.castShadow,receive:object.receiveShadow});object.material=proxy;object.castShadow=object.receiveShadow=false;}});
 const group=new THREE.Group();group.name=armored?'corrosive-review-armored-human':'corrosive-review-clothed-human';group.userData.visualOwner='body';root.add(group);
 const skin=createQualityMaterial(0xb98b68),shirt=createQualityMaterial(0x614c65),pants=createQualityMaterial(0x4a514a),leather=createQualityMaterial(0x46362d,'rubber'),hair=createQualityMaterial(0x29252a,'rubber'),plate=createQualityMaterial(0xd4c19b),metal=createQualityMaterial(0x59666a,'metal'),seam=createQualityMaterial(0x9a7e70),eye=createQualityMaterial(0x231c22,'rubber');
 const materials=new Set([skin,shirt,pants,leather,hair,plate,metal,seam,eye]);
 const body=new THREE.Group();body.name='human-animated-upper-body';group.add(body);
 const tag=(mesh:THREE.Mesh,surface?:CorrosiveSurface)=>{mesh.userData.presentationOnly=true;mesh.userData.visualOwner='body';if(surface)mesh.userData.corrosiveSurface=surface;mesh.raycast=()=>{};return mesh;};
 const box=(parent:THREE.Object3D,name:string,size:[number,number,number],at:[number,number,number],mat:THREE.Material,surface?:CorrosiveSurface,bevel=.04)=>tag(addBox(parent,name,size,at,mat,bevel),surface);
 const capsule=(parent:THREE.Object3D,name:string,radius:number,length:number,at:[number,number,number],mat:THREE.Material,surface?:CorrosiveSurface)=>{const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,4,10),mat);mesh.name=name;mesh.position.set(...at);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return tag(mesh,surface);};
 box(body,'human-shirt-torso',[.73,.73,.50],[0,1.56,0],shirt,'cloth',.12);
 box(body,'human-waist-belt',[.73,.10,.53],[0,1.16,.005],leather,'cloth');
 box(body,'human-belt-buckle',[.11,.09,.026],[0,1.16,.287],metal);
 box(body,'human-shirt-placket',[.035,.53,.012],[0,1.55,.258],seam,'cloth',.005);
 for(let i=0;i<3;i++)box(body,'shirt-button',[.026,.026,.018],[0,1.44+i*.15,.275],leather,undefined,.008);
 for(const side of[-1,1]){
  box(body,'shirt-chest-pocket',[.18,.18,.025],[side*.21,1.65,.264],shirt,'cloth',.018);
  box(body,'shirt-pocket-flap',[.19,.035,.034],[side*.21,1.74,.278],seam,'cloth',.008);
 }
 capsule(body,'human-neck',.115,.16,[0,2.01,0],skin,'skin');
 const head=new THREE.Group();head.position.set(0,2.23,.01);body.add(head);
 const face=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),skin);face.name='human-intact-face';face.scale.set(.23,.29,.225);face.castShadow=face.receiveShadow=true;head.add(face);tag(face,'skin');
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.238,16,8,0,Math.PI*2,0,Math.PI*.50),hair);cap.scale.set(1,1.20,1);cap.position.y=.04;cap.name='human-hair-cap';head.add(cap);tag(cap);
 box(head,'human-hair-fringe',[.34,.075,.08],[.025,.175,.16],hair,undefined,.025).rotation.z=-.12;
 for(const side of[-1,1]){
  const ear=new THREE.Mesh(new THREE.SphereGeometry(.053,8,6),skin);ear.scale.set(.55,1,.7);ear.position.set(side*.226,0,0);head.add(ear);tag(ear,'skin');
  box(head,'human-eyebrow',[.095,.023,.025],[side*.092,.057,.204],hair,undefined,.008).rotation.z=side*.07;
  const e=new THREE.Mesh(new THREE.SphereGeometry(.027,8,6),eye);e.scale.set(1,.55,.30);e.position.set(side*.09,.025,.221);head.add(e);tag(e);
 }
 const nose=new THREE.Mesh(new THREE.IcosahedronGeometry(.058,0),skin);nose.scale.set(.6,1,1);nose.position.set(0,-.024,.23);head.add(nose);tag(nose,'skin');
 box(head,'human-mouth',[.085,.012,.01],[0,-.115,.202],leather,undefined,.004);
 const arms:THREE.Group[]=[];const legs:THREE.Group[]=[];
 for(const side of[-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.48,1.83,0);body.add(arm);arms.push(arm);
  capsule(arm,'human-shirt-sleeve',.15,.27,[side*.025,-.21,0],shirt,'cloth').rotation.z=side*.10;
  box(arm,'rolled-shirt-cuff',[.31,.10,.31],[side*.045,-.42,0],seam,'cloth');
  capsule(arm,'human-bare-forearm',.10,.29,[side*.065,-.64,.035],skin,'skin').rotation.z=side*.04;
  box(arm,'human-intact-hand',[.16,.20,.14],[side*.075,-.91,.06],skin,'skin',.05);
  for(let finger=0;finger<3;finger++)box(arm,'human-finger',[.031,.09,.10],[side*.075-.047+finger*.046,-1.035,.075],skin,'skin',.012);
  const leg=new THREE.Group();leg.position.set(side*.21,1.10,0);group.add(leg);legs.push(leg);
  capsule(leg,'human-trouser-leg',.16,.58,[0,-.40,0],pants,'cloth');
  box(leg,'human-trouser-knee',[.25,.20,.08],[0,-.52,.135],pants,'cloth');
  box(leg,'human-leather-boot',[.30,.30,.46],[0,-.91,.065],leather,'cloth',.07);
  box(leg,'human-boot-sole',[.31,.055,.48],[0,-1.055,.067],hair,undefined,.018);
 }
 if(armored){
  box(body,'human-intact-breastplate',[.80,.66,.16],[0,1.62,.30],plate,'armor',.085);
  box(body,'breastplate-central-rib',[.065,.46,.026],[0,1.63,.40],metal,'armor',.012);
  for(const side of[-1,1]){
   box(body,'breastplate-chamfer-edge',[.04,.50,.032],[side*.335,1.63,.395],metal,'armor',.012).rotation.z=side*.10;
   box(arms[side<0?0:1],'human-pauldron',[.40,.28,.48],[0,-.075,0],plate,'armor',.07);
   box(arms[side<0?0:1],'human-forearm-guard',[.17,.31,.08],[side*.08,-.65,.145],metal,'armor');
   box(legs[side<0?0:1],'human-knee-guard',[.27,.22,.12],[0,-.50,.18],plate,'armor');
  }
  const helmet=tag(addCylinder(head,'human-open-face-helmet-rim',.25,.075,[0,.18,0],metal,'y',12),'armor');helmet.scale.z=.94;
 }
 let disposed=false,walk=0;
 return{group,update(dt:number,time:number,state:EnemyPresentation){if(disposed)return;walk+=dt*7;const moving=state.moving?1:0,hit=THREE.MathUtils.clamp(state.hitReaction,0,1);body.rotation.x=-hit*.06;body.position.z=-hit*.035;body.position.y=moving*Math.abs(Math.sin(walk))*.023;head.rotation.y=Math.sin(time*.6)*.025;legs.forEach((leg,i)=>leg.rotation.x=Math.sin(walk+i*Math.PI)*moving*.21);arms.forEach((arm,i)=>arm.rotation.x=-Math.sin(walk+i*Math.PI)*moving*.13);},
  dispose(){if(disposed)return;disposed=true;const geometries=new Set<THREE.BufferGeometry>();group.traverse(o=>{if(o instanceof THREE.Mesh)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.removeFromParent();for(const p of originals){p.mesh.material=p.material;p.mesh.castShadow=p.cast;p.mesh.receiveShadow=p.receive;}proxy.dispose();}
 };
}
