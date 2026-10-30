import * as THREE from 'three';
import {getWeaponElements,type WeaponSpec,type BrandId} from '../../../core/arsenal';
import {elementalFlightFamilyScale,type ElementalPayloadAnchor} from '../elementalFlight';
import {EffectVariationSequence,type EffectVariation} from '../shared/variation';
import {LightningSegments,lightningNoise} from './lightning';
import {installShockStickyCharge,animateShockStickyCharge} from './sticky';

interface Payload {group:THREE.Group;lines:LightningSegments;core:THREE.MeshBasicMaterial;radius:number;weight:number;choice:EffectVariation;kind:'linear'|'orb'|'disc';broad:boolean;lastAge:number}
const payloads=new WeakMap<THREE.Group,Payload>();
const a=new THREE.Vector3(),b=new THREE.Vector3();
const finite=(v:THREE.Vector3)=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
function releasePayload(root:THREE.Object3D){const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.removeFromParent();root.traverse(o=>{if(o instanceof THREE.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
function movingNoise(q:number,seed:number,age:number){return lightningNoise(q,seed,Math.floor(age*22));}
/** All GPU resources live under the projectile and are released by Ballistics.
 * The weak state and captured hooks survive a renderer toggle without reviving world effects. */
function animate(root:THREE.Group,dt:number,age:number){
 animateShockStickyCharge(root,dt,age);const p=payloads.get(root);if(!p||!Number.isFinite(dt)||dt<=0||!Number.isFinite(age)||age<0||p.lastAge===age)return;p.lastAge=age;
 const {radius:r,choice,weight,kind}=p;const lines=p.lines;lines.begin();
 for(let lane=0;lane<(kind==='orb'?4:3);lane++){
  const angle=choice.range(lane+1,0,Math.PI*2),span=choice.range(lane+12,.85,1.65),length=choice.range(lane+20,p.broad?2.4:1.8,p.broad?3.3:2.7);
  for(let i=0;i<=9;i++){
   const q=i/9,jitter=movingNoise(q,choice.seed+lane*53,age)*r*.45;
   if(kind==='disc'){const theta=angle+q*span;b.set(Math.cos(theta)*r*1.17,.030+jitter*.25,Math.sin(theta)*r*1.17);}
   else if(kind==='orb'){const theta=angle+q*span*1.8;b.set(Math.cos(theta)*r*.76,Math.sin(theta)*r*.64+jitter,(q-.5)*r*1.2);}
   else{const taper=1-q;b.set(Math.cos(angle)*r*.60*taper+jitter,Math.sin(angle)*r*.58*taper+movingNoise(q,choice.seed+lane*67+11,age)*r*.34,THREE.MathUtils.lerp(-r*length,r*.75,q));}
   if(i)lines.add(a,b,r*(p.broad?.037:.032)*THREE.MathUtils.lerp(.7,1,q),(.65+.25*choice.sample(30+lane))*weight);a.copy(b);
  }
 }
 lines.upload();p.core.opacity=(.68+.18*Math.sin(age*29+choice.range(42,0,6))**2)*weight;
}
/** Keep the real casing, source transform, delivery metadata and other channel.
 * Replace only the generic Shock payload; sticky retains its approved fixed device. */
function decorate(root:THREE.Group,spec:WeaponSpec,choice:EffectVariation){
 if(!getWeaponElements(spec).includes('shock'))return;
 if(spec.projectile==='sticky'){installShockStickyCharge(root,choice);return;}
 const anchor=root.userData.elementalPayloadAnchors?.shock as ElementalPayloadAnchor|undefined,old:THREE.Group[]=[];if(!anchor?.omitted)root.traverse(o=>{if(o instanceof THREE.Group&&o.name.match(/^quality-(primary|secondary)-shock-payload$/))old.push(o);});if(!anchor&&!old.length||payloads.has(root))return;
 const secondary=spec.element!=='shock',scale=secondary?.60:1,weight=secondary?.76:1,r=anchor?.radius??(Number(root.userData.flightRadius)||.044)*scale,kind=spec.projectile==='orb'?'orb':spec.projectile==='disc'||spec.projectile==='ricochet'?'disc':'linear',broad=['rocket','homing','cluster','orb'].includes(spec.projectile);
 const group=new THREE.Group();group.name='shock-live-flight-payload';if(old[0]){group.position.copy(old[0].position);group.quaternion.copy(old[0].quaternion);}else group.position.fromArray(anchor!.position);group.userData={comicOverlay:true,presentationOnly:true,element:'shock',secondary,cosmeticSeed:choice.seed};
 const carrier=root.getObjectByName('quality-physical-carrier'),parent=old[0]?.parent??(anchor?.carrier?carrier:root);(parent??root).add(group);if(kind==='disc'&&carrier&&group.parent!==carrier){root.updateWorldMatrix(true,true);carrier.attach(group);}old.forEach(releasePayload);
 const lines=new LightningSegments(48,{fadeWithMaterial:true,continuous:true,minPixels:1*scale,referenceWidth:r*(broad?.037:.032),maxWidthScale:4});group.add(lines.group);
 const core=new THREE.MeshBasicMaterial({color:0xcfefff,transparent:true,opacity:.8*weight,depthTest:true,depthWrite:false,toneMapped:false}),mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r*(kind==='orb'?.20:.15),0),core);mesh.name='shock-flight-contact-core';mesh.position.set(0,kind==='disc'?.032:0,kind==='linear'?r*.75:0);mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.raycast=()=>{};group.add(mesh);
 payloads.set(root,{group,lines,core,radius:r,weight,choice,kind,broad,lastAge:-1});root.userData.shockFlight={style:'filaments',secondary,scale,weight,seed:choice.seed,kind};animate(root,1/60,0);
}
/** Fixed event silhouette, exact endpoints, unequal short forks. No clock or
 * simulation in a draw callback: Ballistics owns this root's existing fade/lifetime. */
function path(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,choice:EffectVariation,beam:boolean,jagged:boolean,role?:'carrier'|'bomblet'){
 const root=new THREE.Group();root.name=beam?'shock-live-beam':'shock-live-trail';root.userData={comicOverlay:true,presentationOnly:true,element:'shock',start:start.toArray(),end:end.toArray(),cosmeticSeed:choice.seed};
 const original=end.clone().sub(start),length=original.length();if(!finite(start)||!finite(end)||!Number.isFinite(length)||length<1e-6)return root;
 const bomblet=spec.projectile==='cluster'&&role==='bomblet',pathStart=bomblet?end.clone().addScaledVector(original,-Math.min(.14,length)/length):start,delta=end.clone().sub(pathStart),distance=delta.length();if(bomblet)root.userData.clusterRole='bomblet';
 const direction=delta.clone().divideScalar(distance),side=new THREE.Vector3().crossVectors(direction,Math.abs(direction.y)>.94?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(side,direction).normalize(),secondary=spec.element!=='shock',weight=bomblet?(secondary?.21:.30):secondary?(beam?.76:.65):1,family=bomblet?1:elementalFlightFamilyScale(spec),clean=spec.trail==='clean'||bomblet;
 const width=(bomblet?.0035:beam?(jagged?.020:.018):spec.projectile==='scatter'?.0019:['rocket','homing','orb','cluster'].includes(spec.projectile)?.006:.0048)*family,spread=Math.min(bomblet?.012:beam?.22:.075,distance*(beam?.025:.08)),steps=bomblet?6:beam?14:12,lines=new LightningSegments(beam?96:40,{fadeWithMaterial:true,continuous:true,minPixels:bomblet?0:(beam?2.1:1.4)*(spec.projectile==='scatter'?.45:1)*(secondary?(beam?.76:.65):1),referenceWidth:width});root.add(lines.group);lines.begin();
 const points:THREE.Vector3[]=[];
 for(let i=0;i<=steps;i++){const q=i/steps,point=pathStart.clone().addScaledVector(delta,q);point.addScaledVector(side,lightningNoise(q,choice.seed,0)*spread).addScaledVector(up,lightningNoise(q,choice.seed+41,0)*spread*.65);points.push(point);if(i)lines.add(points[i-1],point,width*(bomblet?1-.57*q:.65+.35*Math.sin(q*Math.PI)),weight*(bomblet?1:clean?.38:beam?.90:.72));}
 if(!clean){
  // A thinner companion restrike and a few tapered forward forks; no radial burst.
  if(beam)for(let i=1;i<=12;i++){const q=i/12,previous=(i-1)/12;const point=(out:THREE.Vector3,t:number)=>out.copy(start).addScaledVector(delta,t).addScaledVector(side,lightningNoise(t,choice.seed+217,0)*spread*1.7).addScaledVector(up,lightningNoise(t,choice.seed+371,0)*spread);point(a,previous);point(b,q);lines.add(a,b,width*.48,weight*.42);}
  const forks=beam?3:distance>.15?1:0;
  for(let lane=0;lane<forks;lane++){const at=choice.range(65+lane,.20,.74),index=Math.round(at*steps),reach=Math.min(distance*.18,beam?choice.range(70+lane,.20,.52):.10),sign=choice.sample(75+lane)<.5?-1:1;const from=points[index];a.copy(from);
   for(let i=1;i<=5;i++){const q=i/5;b.copy(from).addScaledVector(direction,reach*q*.65).addScaledVector(side,sign*reach*q*.62+lightningNoise(q,choice.seed+lane*91,0)*reach*.30).addScaledVector(up,choice.range(80+lane,-.35,.35)*reach*q);lines.add(a,b,width*(1-q*.8)*.65,weight*(1-q*.78)*.6);a.copy(b);}
  }
 }
 lines.upload();root.userData.shockFlight={style:'filaments',secondary,weight,width,segments:lines.activeCount,seed:choice.seed,beam};return root;
}
export function createShockFlight(seed?:number){
 const variation=new EffectVariationSequence(seed);
 return{
  decorateProjectile:(root:THREE.Group,spec:WeaponSpec,_brand:BrandId)=>decorate(root,spec,variation.next(7,'projectile')),
  updateProjectile:animate,
  trail:(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,_brand:BrandId,role?:'carrier'|'bomblet')=>path(start,end,spec,variation.next(7,'trail'),false,false,role),
  beam:(start:THREE.Vector3,end:THREE.Vector3,spec:WeaponSpec,jagged:boolean,_brand:BrandId)=>path(start,end,spec,variation.next(7,'beam'),true,jagged),
  reset:()=>variation.reset(),
 };
}
