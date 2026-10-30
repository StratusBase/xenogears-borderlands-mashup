import * as THREE from 'three';
import {createComicMaterial} from '../../materials';
import {EffectVariationSequence} from '../shared/variation';
import {createFirePlume,disposeFirePlume,updateFirePlume} from './plume';

/** Construction-local escape path. Original cartridge, barrel and sockets stay untouched. */
export class FireEquipmentVent {
 readonly group=new THREE.Group();
 readonly aperture:THREE.Vector3;
 private readonly geometries:THREE.BufferGeometry[]=[];
 private readonly shell=createComicMaterial(0x302d29);
 private readonly lip=createComicMaterial(0x635448);
 private readonly coal=new THREE.MeshBasicMaterial({color:0x541a08,toneMapped:false});
 private readonly flames:ReturnType<typeof createFirePlume>[]=[];
 private readonly flameFrames:THREE.Quaternion[]=[];
 private readonly twist=new THREE.Quaternion();private readonly twistAxis=new THREE.Vector3(0,0,1);
 private readonly variation=new EffectVariationSequence();
 private heat=0;private lean=0;private targetLean=0;private curl=0;private targetCurl=0;private power=1;private targetPower=1;private clockOffset=0;private disposed=false;
 readonly broad:boolean;
 private readonly sourceHeight:number;
 constructor(readonly source:THREE.Mesh,readonly barrelIndex:number,readonly delivery:string,form='standard'){
  this.broad=['rocket','sticky','orb','cluster','homing'].includes(delivery);
  this.group.name='fire-cartridge-exhaust';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;
  source.updateWorldMatrix(true,false);
  const bounds=new THREE.Box3().setFromBufferAttribute(source.geometry.getAttribute('position') as THREE.BufferAttribute),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  this.sourceHeight=size.y;
  // At this axial station, clear the real bore/collar rather than putting the vent inside a launcher shell.
  let top=bounds.max.y;
  const local=new THREE.Matrix4().copy(source.matrixWorld).invert();
  source.parent?.traverse(object=>{
   if(!(object instanceof THREE.Mesh)||object===source||object.userData.equipmentElementSurface||object.userData.comicOverlay)return;
   for(let p:THREE.Object3D|null=object;p&&p!==source.parent;p=p.parent)if(p.userData.comicOverlay)return;
   object.updateWorldMatrix(true,false);
   const physical=new THREE.Box3().setFromBufferAttribute(object.geometry.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(new THREE.Matrix4().multiplyMatrices(local,object.matrixWorld));
   if(physical.max.z>=center.z-size.z*.3&&physical.min.z<=center.z+size.z*.3)top=Math.max(top,physical.max.y);
  });
  const construction=form==='heavy'?1.12:form==='compact'?.87:1;
  const cannon=source.parent?.parent,outboard=cannon?.name==='mech-cannon'&&Math.sign(cannon.position.x)===Math.sign(source.position.x);
  const base=top+size.y*(outboard?.77:.12),width=size.x*(this.broad?2.1:1.75)*construction,length=size.z*(this.broad?1.12:.92)*construction,height=size.y*.70;
  this.aperture=new THREE.Vector3(center.x,base+height,center.z);
  this.group.userData.aperture=this.aperture.toArray();this.group.userData.shellTop=top;this.group.userData.barrelIndex=barrelIndex;
  const part=(name:string,dimensions:[number,number,number],position:[number,number,number],material:THREE.Material)=>{
   const geometry=new THREE.BoxGeometry(...dimensions);this.geometries.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.raycast=()=>{};this.group.add(mesh);return mesh;
  };
  const rise=Math.max(size.y*.25,base-bounds.max.y);
  part('fire-vent-feed-riser',[size.x*.68,rise+size.y*.15,size.z*.54],[center.x,bounds.max.y+rise*.5,center.z],this.shell);
  part('fire-vent-mount',[width,size.y*.22,length],[center.x,base,center.z],this.shell);
  // Two thick lips enclose a recessed warm aperture; the core cannot read as a separate muzzle.
  for(const side of [-1,1])part('fire-vent-ceramic-cheek',[width*.20,height,length],[center.x+side*width*.40,base+height*.46,center.z],this.shell);
  part('fire-vent-rear-lip',[width*.72,height*.42,length*.17],[center.x,base+height*.65,center.z+length*.42],this.lip);
  for(let i=0;i<3;i++)part('fire-vent-recessed-coals',[width*.60,height*.11,length*.15],[center.x,base+height*(i===1?.72:.67),center.z+(i-1)*length*.23],this.coal);
  const side=Math.sign(source.position.x)||-1,exhaust=new THREE.Vector3(side*.38,.80,.38).normalize(),frame=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),exhaust);
  const shoeRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-side*.24),pivot=new THREE.Vector3(center.x,base,center.z);
  for(const part of this.group.children)if(part.name!=='fire-vent-feed-riser'){part.position.sub(pivot).applyQuaternion(shoeRotation).add(pivot);part.quaternion.copy(shoeRotation);}
  this.aperture.sub(pivot).applyQuaternion(shoeRotation).add(pivot);this.group.userData.aperture=this.aperture.toArray();this.clockOffset=barrelIndex*.73+source.position.x*2;
  for(let i=0;i<2;i++){
   const flame=createFirePlume(barrelIndex*8.7+i*4.3,i);flame.name='fire-equipment-exhaust-tear';
   flame.position.copy(this.aperture).add(new THREE.Vector3((i?1:-1)*width*.14,i?size.y*.03:0,(i?-.19:.17)*length));
   // Crossed views give physical depth without facing the camera or moving the vent origin.
   const basis=frame.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),i?.61:-.61));flame.quaternion.copy(basis);this.flameFrames.push(basis);this.group.add(flame);this.flames.push(flame);
  }
  source.add(this.group);this.update(0,0);
 }
 shot(){
  const choice=this.variation.next(5,'exhaust');this.heat=1;this.targetLean=[-.28,-.14,.12,.25,.38][choice.variant]+choice.range(1,-.035,.035);this.targetCurl=[-.8,.6,-.4,.95,.35][choice.variant];this.targetPower=choice.range(2,.88,1.12);
 }
 update(dt:number,time:number){
  if(this.disposed)return;this.heat*=Math.exp(-dt*(this.broad?2.1:2.8));
  const blend=1-Math.exp(-dt*20);this.lean+=(this.targetLean-this.lean)*blend;this.curl+=(this.targetCurl-this.curl)*blend;this.power+=(this.targetPower-this.power)*blend;
  this.coal.color.setRGB(.19+.80*this.heat,.018+.31*this.heat,.003+.018*this.heat);
  const scale=this.sourceHeight;
  for(const [i,flame]of this.flames.entries()){
   const energy=['beam','arc'].includes(this.delivery)?.64:1;
   const flicker=.88+.12*Math.sin(time*(i?17:13)+this.clockOffset+i*2.4),length=scale*((this.broad?.26:.18)+(this.broad?1.14:1.38)*this.heat)*this.power*energy;
   flame.scale.set(length*flicker,scale*(.17+.33*this.heat)*(i?.78:1),1);
   flame.quaternion.copy(this.flameFrames[i]).multiply(this.twist.setFromAxisAngle(this.twistAxis,this.lean+Math.sin(time*8+i*2.9+this.clockOffset)*.07));
   flame.material.uniforms.curl.value=this.curl;flame.material.opacity=THREE.MathUtils.smoothstep(this.heat,.08,.35)*.88;flame.visible=flame.material.opacity>.01;updateFirePlume(flame,time+this.clockOffset+i*.53,.25+.7*this.heat);
  }
 }
 get diagnostics(){return{barrel:this.barrelIndex,heat:this.heat,lean:this.targetLean,aperture:this.aperture.toArray(),plumes:this.flames.length};}
 dispose(){if(this.disposed)return;this.disposed=true;for(const flame of this.flames)disposeFirePlume(flame);for(const geometry of this.geometries)geometry.dispose();this.shell.dispose();this.lip.dispose();this.coal.dispose();this.group.removeFromParent();}
}
