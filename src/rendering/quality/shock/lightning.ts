import * as THREE from 'three';

const fract=(x:number)=>x-Math.floor(x);
const hash=(x:number)=>fract(Math.sin(x*127.1+311.7)*43758.5453123);
/** Hierarchical displacement: large bends carry fine leaders, without a regular sine zigzag. */
export function lightningNoise(q:number,seed:number,epoch:number):number{
 let value=0;
 for(let level=0;level<4;level++){
  const frequency=2**(level+1),cell=Math.floor(q*frequency),t=fract(q*frequency);
  const n0=hash(seed+cell*7.13+level*21.4+epoch*1.37)*2-1,n1=hash(seed+(cell+1)*7.13+level*21.4+epoch*1.37)*2-1;
  value+=THREE.MathUtils.lerp(n0,n1,t)*[.15,.15,.09,.025][level];
 }
 return value*Math.min(q*6,(1-q)*6,1);
}
/** Stable strike direction; fast leader growth and uneven restrikes, rather than rotating a star. */
export function lightningPathPoint(out:THREE.Vector3,lane:number,q:number,age:number,seed:number,reach:number,width:number):THREE.Vector3{
 const angles=[.36,3.82,-1.13,1.56,.08],lengths=[1,.55,.64,.38,.89],i=lane%5;
 const angle=angles[i]+(hash(seed+11*i)-.5)*.85,length=lengths[i]*(.70+.30*hash(seed+5*i));
 const head=THREE.MathUtils.smoothstep(age,0,.038),s=Math.min(q,head),epoch=Math.floor(age*22);
 const bend=lightningNoise(s,seed+lane*23.7,epoch)*reach;
 return out.set(Math.cos(angle)*s*length*reach-Math.sin(angle)*bend,Math.sin(angle)*s*length*reach+Math.cos(angle)*bend,.025+width*3+Math.min(.22,reach*(.07*Math.sin(s*Math.PI)+s*.06)));
}

/** Two camera-facing, depth-tested layers sharing one instance buffer. Core, ion envelope and soft corona share a silhouette.
 * World-unit widths, rounded joints and analytical falloff replace opaque low-poly tubes.
 * Glow is local to the arcs: no fullscreen bloom, extra renderer or dynamic lights.
 */
export class LightningSegments{
 readonly group=new THREE.Group();readonly meshes:THREE.InstancedMesh[];
 private geometry=new THREE.PlaneGeometry(2,1);private materials:THREE.ShaderMaterial[]=[];
 private alpha:THREE.InstancedBufferAttribute;private count=0;private dummy=new THREE.Object3D();private delta=new THREE.Vector3();
 constructor(readonly capacity=1600,options:{fadeWithMaterial?:boolean;continuous?:boolean;minPixels?:number;referenceWidth?:number;maxWidthScale?:number}={}){
  this.group.name='shock-pooled-lightning';this.group.userData.comicOverlay=true;this.group.userData.presentationOnly=true;
  this.alpha=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);this.geometry.setAttribute('strokeAlpha',this.alpha);
  const viewport=new THREE.Vector2();
  this.meshes=[];for(let layer=0;layer<2;layer++){const material=new THREE.ShaderMaterial({uniforms:{layer:{value:layer},opacity:{value:1},joinWeight:{value:options.continuous?1:0},nearPlane:{value:.1},minPixels:{value:options.minPixels??0},viewportHeight:{value:1},referenceWidth:{value:options.referenceWidth??1},maxWidthScale:{value:options.maxWidthScale??0}},name:'shock-filament-core-corona',transparent:true,depthWrite:false,depthTest:true,toneMapped:false,side:THREE.DoubleSide,blending:layer===0?THREE.NormalBlending:THREE.AdditiveBlending,
   vertexShader:/* glsl */`attribute float strokeAlpha;uniform float joinWeight,nearPlane,minPixels,viewportHeight,referenceWidth,maxWidthScale;varying vec2 vStroke;varying float vLength;varying float vAlpha;
    void main(){vec4 a=modelViewMatrix*instanceMatrix*vec4(0.,-.5,0.,1.);vec4 b=modelViewMatrix*instanceMatrix*vec4(0.,.5,0.,1.);
     vec2 d=b.xy-a.xy;float len=max(length(d),.00001);vec2 axis=d/len;vec2 side=vec2(-axis.y,axis.x);
     float baseWidth=max(length((modelViewMatrix*instanceMatrix)[0].xyz),.00001),w=baseWidth;
     float relativeWidth=clamp(length(instanceMatrix[0].xyz)/max(referenceWidth,.00001),.15,1.);
     if(minPixels>0.){float pixelWorld=2.*abs((a.z+b.z)*.5)/max(abs(projectionMatrix[1][1])*viewportHeight,1.);w=max(w,minPixels*relativeWidth*pixelWorld/1.1);if(maxWidthScale>0.)w=min(w,baseWidth*maxWidthScale);}
     // Project the centerline first. Extending a view-plane quad without its
     // depth foreshortens each segment differently and opens gaps near a muzzle.
     // A returning segment can straddle the eye. Keep it in homogeneous clip
     // space until hardware near-plane clipping, avoiding division by zero or
     // a mirrored screen-space quad. Ordinary forward paths keep their joins.
     if(joinWeight>0. && a.z < -nearPlane && b.z < -nearPlane){
      vec4 ca=projectionMatrix*a,cb=projectionMatrix*b;
      vec2 pixels=vec2(viewportHeight*abs(projectionMatrix[1][1]/projectionMatrix[0][0]),viewportHeight)*.5;
      vec2 pa=ca.xy/ca.w*pixels,pb=cb.xy/cb.w*pixels,delta=pb-pa;
      float plen=max(length(delta),.0001),pw=w*abs(projectionMatrix[1][1])*viewportHeight/max(abs(a.z+b.z),.0001);
      vec2 tangent=delta/plen,normal=vec2(-tangent.y,tangent.x);
      float along=(position.y+.5)*plen+position.y*pw*12.,across=position.x*pw*6.;
      vec2 xy=(pa+tangent*along+normal*across)/pixels;
      float depth=mix(ca.z/ca.w,cb.z/cb.w,along/plen);
      vStroke=vec2(along/pw,across/pw);vLength=plen/pw;vAlpha=strokeAlpha;gl_Position=vec4(xy,depth,1.);return;
     }
     float along=(position.y+.5)*len+position.y*w*12.;float across=position.x*w*6.;
     vec4 p=mix(a,b,position.y+.5);p.xy=a.xy+axis*along+side*across;
     vStroke=vec2(along/w,across/w);vLength=len/w;vAlpha=strokeAlpha;gl_Position=projectionMatrix*p;
    }`,
   fragmentShader:/* glsl */`uniform float layer,opacity,joinWeight;varying vec2 vStroke;varying float vLength;varying float vAlpha;
    void main(){float end=max(max(-vStroke.x,vStroke.x-vLength),0.);float d=length(vec2(end,vStroke.y));
     float aa=max(fwidth(d)*.55,.12);float core=1.-smoothstep(.26-aa,.55+aa,d);float ion=exp(-d*d*1.25);float corona=exp(-d*d*.14);
     float a;vec3 color;
     if(layer<.5){a=(core*.88+ion*.65+corona*.38)*vAlpha;color=mix(vec3(.008,.028,.15),vec3(.025,.20,.88),clamp(ion+core,0.,1.));}
     else{a=(core*.98+ion*.20)*vAlpha;color=mix(vec3(.18,.63,1.),vec3(.90,.99,1.),core);}
     // Adjacent flight segments each contribute half at a joint, avoiding beads.
     a*=opacity*mix(1.,min(smoothstep(-1.5,1.5,vStroke.x),smoothstep(-1.5,1.5,vLength-vStroke.x)),joinWeight);if(a<.004)discard;gl_FragColor=vec4(color,a);
    }`});
  const mesh=new THREE.InstancedMesh(this.geometry,material,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.name='shock-lightning-filaments';mesh.renderOrder=6+layer;if(layer>0)mesh.instanceMatrix=this.meshes[0].instanceMatrix;
  // Ballistics owns trail/beam fade. Read its material opacity without advancing any clock.
  if(options.fadeWithMaterial||options.minPixels||options.continuous)mesh.onBeforeRender=(renderer,_scene,camera)=>{if(options.continuous){const near=(camera as THREE.PerspectiveCamera|undefined)?.near;if(near!==undefined&&material.uniforms.nearPlane.value!==near){material.uniforms.nearPlane.value=near;material.uniformsNeedUpdate=true;}}if((options.minPixels||options.continuous)&&renderer?.getSize){const height=renderer.getSize(viewport).y;if(material.uniforms.viewportHeight.value!==height){material.uniforms.viewportHeight.value=height;material.uniformsNeedUpdate=true;}}if(options.fadeWithMaterial&&material.uniforms.opacity.value!==material.opacity){material.uniforms.opacity.value=material.opacity;material.uniformsNeedUpdate=true;}};
  this.meshes.push(mesh);this.materials.push(material);this.group.add(mesh);}
 }
 begin():void{this.count=0;}
 add(a:THREE.Vector3,b:THREE.Vector3,width:number,alpha:number):void{
  if(this.count>=this.capacity||width<=0||alpha<.015)return;this.delta.copy(b).sub(a);const length=this.delta.length();if(!Number.isFinite(length)||length<.0001)return;
  this.dummy.position.copy(a).add(b).multiplyScalar(.5);this.dummy.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP,this.delta.multiplyScalar(1/length));this.dummy.scale.set(width,length,1);this.dummy.updateMatrix();this.meshes[0].setMatrixAt(this.count,this.dummy.matrix);this.alpha.setX(this.count,THREE.MathUtils.clamp(alpha,0,1));this.count++;
 }
 upload():void{for(const mesh of this.meshes){mesh.count=this.count;mesh.visible=this.count>0;}this.meshes[0].instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true;}
 get activeCount(){return this.count;}
 dispose():void{this.group.removeFromParent();this.geometry.dispose();this.materials.forEach(m=>m.dispose());this.meshes.forEach(m=>m.dispose());}
}

/** A local flash/corona, not a disc or explosion fan. Shape comes from the branching filaments. */
export function createLightningCorona():THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>{
 const geometry=new THREE.PlaneGeometry(2,2);const material=new THREE.ShaderMaterial({name:'shock-contact-corona',transparent:true,depthTest:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{presence:{value:0},heavy:{value:0}},
  vertexShader:/* glsl */`varying vec2 vUv;void main(){vUv=uv*2.-1.;vec4 center=modelViewMatrix*vec4(0.,0.,0.,1.);float sx=length(modelMatrix[0].xyz),sy=length(modelMatrix[1].xyz);center.xy+=position.xy*vec2(sx,sy);gl_Position=projectionMatrix*center;}`,
  fragmentShader:/* glsl */`varying vec2 vUv;uniform float presence,heavy;void main(){float r=length(vUv);float soft=exp(-r*r*8.)*mix(.24,.55,heavy);float star=exp(-abs(vUv.x*vUv.y)*140.)*exp(-r*7.)*.7;float core=exp(-r*r*mix(500.,75.,heavy))*mix(1.,2.,heavy);float a=(soft+star+core)*presence;if(a<.004)discard;gl_FragColor=vec4(mix(vec3(.03,.23,1.),vec3(.82,.97,1.),clamp(core+star,0.,1.)),a);}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='shock-heavy-capacitor-fan';mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.renderOrder=5;mesh.visible=false;return mesh;
}
export function animateLightningCorona(mesh:ReturnType<typeof createLightningCorona>,age:number,seed:number,reach:number,heavy=true):void{
 const pulse=(.64+.36*Math.sin(age*81+seed)**2)*(1-THREE.MathUtils.smoothstep(age,.025,heavy?.26:.15));
 mesh.material.uniforms.presence.value=pulse;mesh.material.uniforms.heavy.value=heavy?1:0;mesh.scale.setScalar(reach*(heavy?.44:.23));
}
