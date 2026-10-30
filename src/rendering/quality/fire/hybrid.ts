import * as THREE from 'three';
import glyphData from './hybridGlyphs.json';
const atlasUrl=new URL('./hybridAtlas.svg',import.meta.url).href;

export type FirePathCommand = [string,...number[]];
export interface FireGlyph {name:string;layers:{band:number;paths:FirePathCommand[][]}[]}
export const FIRE_HYBRID_CAPACITY=12;
const UP=new THREE.Vector3(0,1,0);
const vertex=/* glsl */`
 attribute float heatBand;varying float vBand;varying vec3 vWorld;varying vec2 vArt;
 void main(){vBand=heatBand;vArt=uv;vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
const fragment=/* glsl */`
 uniform float age,life,seed,opacity,cell;uniform sampler2D atlas;uniform vec4 support;varying float vBand;varying vec3 vWorld;varying vec2 vArt;
 float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1)),f.x),f.y);}
 vec4 art(vec2 p){vec2 uv=(p+vec2(.30,.40))/vec2(2.05,1.65);if(min(uv.x,uv.y)<0.||max(uv.x,uv.y)>1.)return vec4(0.);return texture2D(atlas,vec2((cell+uv.x)/5.,uv.y));}
 void main(){if(dot(support.xyz,vWorld)+support.w<.006)discard;
 float end=smoothstep(life*.50,life,age),tip=clamp(vArt.x/1.5,0.,1.);
 vec2 flow=vec2(n(vArt*vec2(17.,23.)+vec2(-age*16.,seed)),n(vArt*vec2(25.,18.)+vec2(-age*21.,seed+8.)))-.5;
 vec2 p=vArt+flow*(.018+tip*.055);vec4 sampleArt=art(p);
 // Erode only the outside contour. Opaque interiors remain coherent instead of acquiring scattered holes.
 float erosion=(.003+tip*tip*.018+end*.048)*(.35+.65*n(p*24.-age*13.));
 float alpha=min(sampleArt.a,min(art(p+vec2(erosion,0.)).a,art(p-vec2(0.,erosion)).a));
 if(alpha<.28)discard;
 float retreat=end*(1.25+.14*sin(vArt.x*13.+vArt.y*9.+seed));if(vArt.x>1.70-retreat&&end>.28)discard;
 float a=opacity*(1.-smoothstep(life*.78,life,age));if(a<.02)discard;
 float band=clamp((sampleArt.r-.15)/.28,0.,3.);
 vec3 rim=vec3(.50,.030,.0005),orange=vec3(1.,.075,.0005),gold=vec3(1.,.34,.009),white=vec3(1.,.90,.53);
 float heat=n(p*vec2(18.,31.)+vec2(-age*24.,seed));
 vec3 color=band<.5?rim:band<1.5?orange:gold;
 if(band>1.5)color=mix(orange,gold,clamp(1.-smoothstep(.35,1.10,p.x)+(heat-.5)*.24,.12,1.));
 if(band>2.5&&p.x<.45)color=mix(gold,white,(1.-smoothstep(.10,.18,age))*(1.-smoothstep(.12,.45,p.x)));
 gl_FragColor=vec4(color,a*alpha);}`;

export function createHybridCardGeometry(){
 const geometry=new THREE.PlaneGeometry(2.05,1.65,26,20);geometry.translate(.725,.425,0);
 const p=geometry.getAttribute('position') as THREE.BufferAttribute,uv=geometry.getAttribute('uv') as THREE.BufferAttribute;
 for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i),p.getY(i));
 geometry.setAttribute('heatBand',new THREE.Float32BufferAttribute(new Float32Array(p.count),1));geometry.userData.rest=new Float32Array(p.array);return geometry;
}

/** Claude-authored cubic paths, triangulated as colored layers. No raster generation, collision or source-body edits. */
export function createHybridGlyph(glyph:FireGlyph){
 const positions:number[]=[],uv:number[]=[],bands:number[]=[];
 for(const layer of glyph.layers)for(const commands of layer.paths){
  const shape=new THREE.Shape();
  for(const [op,...p] of commands){
   if(op==='M')shape.moveTo(p[0],p[1]);else if(op==='L')shape.lineTo(p[0],p[1]);
   else if(op==='C')shape.bezierCurveTo(p[0],p[1],p[2],p[3],p[4],p[5]);
   else if(op==='Q')shape.quadraticCurveTo(p[0],p[1],p[2],p[3]);else if(op==='Z')shape.closePath();
   else throw new Error(`Unsupported Fire artwork command: ${op}`);
  }
  const drawn=new THREE.ShapeGeometry(shape,18).toNonIndexed(),p=drawn.getAttribute('position');
  for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),layer.band*.0007);uv.push(p.getX(i),p.getY(i));bands.push(layer.band);}
  drawn.dispose();
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('heatBand',new THREE.Float32BufferAttribute(bands,1));geometry.userData.rest=new Float32Array(positions);geometry.computeBoundingSphere();return geometry;
}

/** Bending progresses from root to fork tips; independent waves turn and stretch the tips instead of scaling a still. */
export function animateHybridGlyph(geometry:THREE.BufferGeometry,age:number,seed:number,curl:boolean){
 const rest=geometry.userData.rest as Float32Array,p=geometry.getAttribute('position') as THREE.BufferAttribute;
 const ignition=1-Math.exp(-Math.max(0,age)*45),turn=age*(curl?4.2:9.2);
 for(let i=0;i<p.count;i++){
  const x=rest[i*3],y=rest[i*3+1],tip=THREE.MathUtils.clamp(x/1.5,0,1),weight=tip*tip;
  const bend=(Math.sin(x*5.1-y*3.0-turn*1.6+seed)*(curl?.11:.12)+Math.sin(x*23-y*14-age*31+seed)*.018)*weight;
  const stretch=1+Math.sin(turn+x*4.7+seed)*weight*.13;
  p.setXYZ(i,x*(.28+.72*ignition)*stretch+Math.sin(turn*.8+y*7+seed)*weight*.035,
   y*(.65+.35*ignition)+bend+age*.12*tip,rest[i*3+2]+Math.sin(x*7-turn*2+seed)*weight*.018);
 }
 p.needsUpdate=true;
}

/** A readable camera-facing plane, tangent in x and safely biased away from the actual support in y. */
export function hybridContactFrame(camera:THREE.Camera,point:THREE.Vector3,normal:THREE.Vector3){
 camera.updateWorldMatrix(true,false);const toward=camera.getWorldPosition(new THREE.Vector3()).sub(point).normalize();
 let right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);right.addScaledVector(normal,-right.dot(normal));
 if(right.lengthSq()<.01){right=new THREE.Vector3().crossVectors(Math.abs(normal.y)>.9?new THREE.Vector3(0,0,1):UP,normal);}
 right.normalize();let rise=new THREE.Vector3().crossVectors(toward,right).normalize();
 if(rise.dot(UP)<0)rise.negate();if(rise.dot(normal)<0&&Math.abs(normal.y)>.65)rise.negate();
 rise.addScaledVector(normal,Math.max(0,.12-rise.dot(normal)));rise.addScaledVector(right,-rise.dot(right)).normalize();
 const facing=right.clone().cross(rise).normalize();return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,rise,facing));
}
interface Card{mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;delay:number;life:number;scale:number;angle:number;seed:number;contact:boolean}
interface Burst{group:THREE.Group;cards:Card[];age:number;size:number;seed:number;explosive:boolean;active:boolean;point:THREE.Vector3;normal:THREE.Vector3;anchor?:THREE.Mesh;local?:THREE.Vector3;localNormal?:THREE.Vector3}

/** A+C proof only. B status, equipment, projectiles and every authoritative combat owner remain outside this module. */
export class FireHybrid {
 readonly ready:Promise<void>;
 readonly group=new THREE.Group();private readonly bursts:Burst[]=[];private readonly texture:THREE.Texture;private next=0;private disposed=false;
 constructor(scene:THREE.Scene,private readonly camera:THREE.Camera){
  if(typeof Image!=='undefined'){let loaded!:()=>void,failed!:(error:unknown)=>void;this.ready=new Promise<void>((resolve,reject)=>{loaded=resolve;failed=reject;});this.texture=new THREE.TextureLoader().load(atlasUrl,()=>loaded(),undefined,failed);}else{this.texture=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);this.ready=Promise.resolve();}this.texture.colorSpace=THREE.NoColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=this.texture.magFilter=THREE.LinearFilter;
  this.group.name='fire-hybrid-authored-ac';this.group.userData.presentationOnly=true;this.group.userData.comicOverlay=true;scene.add(this.group);
  for(let i=0;i<FIRE_HYBRID_CAPACITY;i++){
   const group=new THREE.Group();group.visible=false;this.group.add(group);const cards:Card[]=[];
   for(const [index,glyph] of [...glyphData.a,...glyphData.c,...glyphData.contact].entries()){
    const geometry=createHybridCardGeometry(),material=new THREE.ShaderMaterial({name:'fire-authored-cel-shape',vertexShader:vertex,fragmentShader:fragment,uniforms:{age:{value:0},life:{value:.6},seed:{value:0},opacity:{value:1},cell:{value:index},atlas:{value:this.texture},support:{value:new THREE.Vector4()}},transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`fire-art-${glyph.name}`;mesh.frustumCulled=false;mesh.renderOrder=6;mesh.raycast=()=>{};mesh.visible=false;group.add(mesh);
    cards.push({mesh,delay:0,life:.6,scale:1,angle:0,seed:index,contact:index===4});
   }
   this.bursts.push({group,cards,age:0,size:1,seed:0,explosive:false,active:false,point:new THREE.Vector3(),normal:new THREE.Vector3(0,0,1)});
  }
 }
 emit(point:THREE.Vector3,normal:THREE.Vector3,size:number,explosive:boolean,seed:number,source?:THREE.Mesh){
  if(this.disposed||!Number.isFinite(point.lengthSq())||size<=0)return;
  const b=this.bursts[this.next++%this.bursts.length];b.age=0;b.size=size;b.seed=seed;b.explosive=explosive;b.point.copy(point);b.normal.copy(normal).normalize();b.active=true;b.group.visible=true;b.anchor=source;b.local=source?.worldToLocal(point.clone());b.localNormal=source?normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(source.matrixWorld).invert()).normalize():undefined;
  for(const [i,card] of b.cards.entries()){
   card.mesh.visible=false;const second=i%2===1;
   card.delay=card.contact?0:second?.040:0;card.life=card.contact?(explosive?.17:.12):(explosive?.66:.46)*(second?.88:1);card.scale=card.contact?.95:second?(explosive?.48:.40):1.12;card.angle=card.contact?seed*.14:second?-.28:explosive?-.12:.18;card.seed=seed+i*1.7;
  }
  this.pose(b);
 }
 private pose(b:Burst){
  if(b.anchor&&b.local){b.anchor.updateWorldMatrix(true,false);b.point.copy(b.local).applyMatrix4(b.anchor.matrixWorld);if(b.localNormal)b.normal.copy(b.localNormal).applyMatrix3(new THREE.Matrix3().getNormalMatrix(b.anchor.matrixWorld)).normalize();}
  b.group.position.copy(b.point).addScaledVector(b.normal,.045);b.group.quaternion.copy(hybridContactFrame(this.camera,b.point,b.normal));b.group.scale.setScalar(b.size);
  for(const [i,card] of b.cards.entries()){
   const selected=card.contact||(b.explosive?i===2||i===3:i===0||i===1);
   const age=b.age-card.delay;card.mesh.visible=selected&&age>=0&&age<card.life;if(!card.mesh.visible)continue;
   const scale=card.scale;card.mesh.scale.set(scale*(!b.explosive&&!card.contact?1.20:1),scale,scale);card.mesh.rotation.z=card.angle+Math.sin(age*5+card.seed)*age*.055;card.mesh.position.set(card.contact?0:i%2?.045:0,0,card.contact?.035:i%2?.018:0);
   const u=card.mesh.material.uniforms;u.age.value=age;u.life.value=card.life;u.seed.value=card.seed;u.opacity.value=card.contact?1:i%2?.95:1;u.support.value.set(b.normal.x,b.normal.y,b.normal.z,-b.normal.dot(b.point));animateHybridGlyph(card.mesh.geometry,age,card.seed,b.explosive&&!card.contact);
  }
 }
 update(dt:number){if(this.disposed||!Number.isFinite(dt)||dt<=0)return;for(const b of this.bursts){if(!b.active)continue;b.age+=Math.min(.1,dt);if(b.age>.76||b.anchor&&!b.anchor.parent){b.active=false;b.group.visible=false;b.anchor=undefined;continue;}this.pose(b);}}
 async prepareTexture(renderer:THREE.WebGLRenderer){await this.ready;if(!this.disposed)renderer.initTexture(this.texture);}
 get activeCount(){return this.bursts.filter(b=>b.active).length;}
 clear(){for(const b of this.bursts){b.active=false;b.group.visible=false;b.anchor=undefined;b.local=undefined;}this.next=0;}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;this.texture.dispose();for(const b of this.bursts)for(const c of b.cards){c.mesh.geometry.dispose();c.mesh.material.dispose();}this.group.removeFromParent();}
}
