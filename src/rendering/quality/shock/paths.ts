import * as THREE from 'three';

/** Unequal leaders with advected kinks. Local +Z always points out of the contact surface. */
export function shockPathPoint(out:THREE.Vector3,lane:number,q:number,age:number,seed:number,reach:number,width:number):THREE.Vector3{
 const angles=[.30,3.65,-1.20,1.25,-.45],lengths=[1,.52,.40,.32,.78],angle=angles[lane%5],length=lengths[lane%5];
 const travel=THREE.MathUtils.smoothstep(age,0,.075),lead=Math.min(1,q)*travel;
 const kink=Math.sin(q*28+seed*3+Math.floor(age*28)*.63)*Math.sin(q*Math.PI)*.105;
 return out.set((Math.cos(angle)*lead*length+kink)*reach,(Math.sin(angle)*lead*length+kink*.67)*reach,.020+width*3+Math.sin(lead*Math.PI)*reach*.16+lead*reach*.10);
}

/** Three pooled hard-edged strokes: navy separation, cobalt envelope, selective white core. */
export class ShockSegments{
 readonly group=new THREE.Group();readonly meshes:THREE.InstancedMesh[]=[];
 private geometry=new THREE.CylinderGeometry(1,1,1,5,1);private alpha:THREE.InstancedBufferAttribute;
 private materials:THREE.ShaderMaterial[]=[];private count=0;private dummy=new THREE.Object3D();private delta=new THREE.Vector3();
 constructor(readonly capacity=1600){
  this.group.name='shock-pooled-arc-strokes';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;
  this.alpha=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);this.geometry.setAttribute('strokeAlpha',this.alpha);
  for(const[color,opacity]of[[0x071c54,.85],[0x197dff,.85],[0xe5fbff,1]] as const){
   const material=new THREE.ShaderMaterial({name:'shock-controlled-comic-stroke',uniforms:{color:{value:new THREE.Color(color)},opacity:{value:opacity}},transparent:true,depthWrite:false,depthTest:true,toneMapped:false,
    vertexShader:'attribute float strokeAlpha;varying float a;void main(){a=strokeAlpha;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 color;uniform float opacity;varying float a;void main(){if(a<.015)discard;gl_FragColor=vec4(color,a*opacity);}'});
   const mesh=new THREE.InstancedMesh(this.geometry,material,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.renderOrder=5+this.meshes.length;this.meshes.push(mesh);this.materials.push(material);this.group.add(mesh);
  }
 }
 begin():void{this.count=0;}
 add(a:THREE.Vector3,b:THREE.Vector3,width:number,alpha:number):void{
  if(this.count>=this.capacity||alpha<.015||width<=0)return;this.delta.copy(b).sub(a);const length=this.delta.length();if(length<.0001||!Number.isFinite(length))return;
  this.dummy.position.copy(a).add(b).multiplyScalar(.5);this.dummy.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP,this.delta.multiplyScalar(1/length));
  for(let i=0;i<3;i++){const scale=[2.2,1.55,.80][i];this.dummy.scale.set(width*scale,length,width*scale);this.dummy.updateMatrix();this.meshes[i].setMatrixAt(this.count,this.dummy.matrix);}
  this.alpha.setX(this.count,THREE.MathUtils.clamp(alpha,0,1));this.count++;
 }
 upload():void{for(const mesh of this.meshes){mesh.count=this.count;mesh.visible=this.count>0;mesh.instanceMatrix.needsUpdate=true;}this.alpha.needsUpdate=true;}
 get activeCount(){return this.count;}
 dispose():void{this.group.removeFromParent();this.geometry.dispose();this.materials.forEach(m=>m.dispose());this.meshes.forEach(m=>m.dispose());}
}

/** Only confirmed heavy detonations receive these two open, unequal capacitor ribbons. */
export function createShockFan():THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>{
 const geometry=new THREE.BufferGeometry(),positions=new Float32Array(2*14*6*3),uv=new Float32Array(2*14*6*2);geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 const material=new THREE.ShaderMaterial({name:'shock-capacitor-kick-ribbons',transparent:true,side:THREE.DoubleSide,depthTest:true,depthWrite:false,toneMapped:false,uniforms:{presence:{value:1}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform float presence;varying vec2 vUv;void main(){float across=abs(vUv.y*2.-1.);float core=1.-smoothstep(.06,.23,across);float tail=smoothstep(.0,.12,vUv.x)*(1.-smoothstep(.78,1.,vUv.x));float a=(1.-smoothstep(.75,1.,across))*tail*presence;if(a<.025)discard;vec3 c=mix(vec3(.025,.23,1.),vec3(.80,.96,1.),core);gl_FragColor=vec4(c,a);}'});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='shock-heavy-capacitor-fan';mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.renderOrder=4;mesh.visible=false;return mesh;
}
export function animateShockFan(mesh:ReturnType<typeof createShockFan>,age:number,seed:number,reach:number):void{
 const position=mesh.geometry.attributes.position as THREE.BufferAttribute,uv=mesh.geometry.attributes.uv as THREE.BufferAttribute;
 const t=Math.max(0,age),head=THREE.MathUtils.smoothstep(t,0,.085),tail=THREE.MathUtils.smoothstep(t,.10,.34)*.85;let index=0;
 for(let lane=0;lane<2;lane++)for(let segment=0;segment<14;segment++)for(const[along,side]of[[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]]){
  const q=(segment+along)/14,travel=THREE.MathUtils.lerp(tail,head,q),angle=lane===0?.63:3.95,length=lane===0?1:.52;
  const kink=Math.sin(Math.floor(q*7)*2.2+seed+t*15)*.09,spread=Math.sin(q*Math.PI)*(.045+.12*Math.sin(q*22+seed)**2)*(lane===0?1:.65);
  position.setXYZ(index,(Math.cos(angle)*travel*length+kink*.3+side*spread*Math.sin(angle))*reach,(Math.sin(angle)*travel*length+kink+.20*Math.sin(travel*Math.PI)*q-side*spread*Math.cos(angle))*reach,(.08+Math.sin(travel*Math.PI)*.25+q*.12)*reach);
  uv.setXY(index,q,(side+1)*.5);index++;
 }
 mesh.material.uniforms.presence.value=Math.max(0,1-THREE.MathUtils.smoothstep(t,.12,.38));position.needsUpdate=true;uv.needsUpdate=true;
}
