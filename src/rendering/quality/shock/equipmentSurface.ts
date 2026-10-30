import * as THREE from 'three';
import {cosmeticSample} from '../shared/variation';
/** Borrow the exact surface. Sample its real facets once, then keep the fixed
 * paths in source space. World-metric widths survive preview/nonuniform scales. */
export function shockEquipmentSurface(source:THREE.Mesh,seed:number,weight:number){
 const bounds=new THREE.Box3().setFromBufferAttribute(source.geometry.attributes.position as THREE.BufferAttribute),size=bounds.getSize(new THREE.Vector3()),band=source.name.startsWith('element-transfer-band');
 const paths:THREE.Vector3[]=[],probeMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),probe=new THREE.Mesh(source.geometry,probeMaterial),ray=new THREE.Raycaster(),direction=new THREE.Vector3(),origin=new THREE.Vector3();probe.updateMatrixWorld();
 const arc=source.geometry.userData.shockArc as {start:number;length:number}|undefined;
 for(let lane=0;lane<3;lane++)for(let j=0;j<=6;j++){
  const t=j/6,bend=(cosmeticSample(seed,lane*23+j*7)-.5)*Math.sin(t*Math.PI);let p:THREE.Vector3;
  if(band){const angle=(arc?.start??0)+(arc?.length??Math.PI*2)*(lane+.5)/3+bend*.12;direction.set(Math.sin(angle),0,Math.cos(angle));origin.copy(direction).multiplyScalar(size.length()*2);origin.y=bounds.min.y+size.y*(.12+.76*t);ray.set(origin,direction.clone().negate());const hits:THREE.Intersection[]=[];THREE.Mesh.prototype.raycast.call(probe,ray,hits);p=hits[0]?.point.clone()??new THREE.Vector3(0,origin.y,0);}
  else{const z=bounds.min.z+size.z*(.12+.76*t);p=lane===0?new THREE.Vector3(bounds.min.x,bounds.min.y+size.y*(.50+bend*.52),z):lane===1?new THREE.Vector3(bounds.max.x,bounds.min.y+size.y*(.46+bend*.45),z):new THREE.Vector3(bounds.min.x+size.x*(.5+bend*.52),bounds.max.y,z);}
  paths.push(p);
 }
 probeMaterial.dispose();
 const material=new THREE.ShaderMaterial({name:'shock-equipment-live-wire',transparent:true,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false,side:THREE.DoubleSide,
  uniforms:{time:{value:0},seed:{value:seed%4096},weight:{value:weight},charge:{value:1},kick:{value:0},paths:{value:paths}},
  vertexShader:`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 p;uniform mat4 modelMatrix;uniform float time,seed,weight,charge,kick;uniform vec3 paths[21];
   float hash(float x){return fract(sin(x*127.1+seed)*43758.5453);}
   float stroke(vec3 q,vec3 a,vec3 b){vec3 d=mat3(modelMatrix)*(q-a),v=mat3(modelMatrix)*(b-a);float t=clamp(dot(d,v)/max(dot(v,v),1.e-8),0.,1.);return length(d-v*t);}
   void main(){float core=0.,ion=0.,nodes=0.;float width=.0012*mix(.72,1.,weight),aa;
    for(int lane=0;lane<3;lane++){float d=1.e3;vec3 previous=paths[lane*7];
     for(int j=1;j<=6;j++){vec3 next=paths[lane*7+j];d=min(d,stroke(p,previous,next));previous=next;}
     aa=max(fwidth(d)*.6,.00015);core=max(core,1.-smoothstep(width*.28-aa,width*.65+aa,d));ion=max(ion,exp(-d*d/(width*width*5.)));
     float n=min(length(mat3(modelMatrix)*(p-paths[lane*7])),length(mat3(modelMatrix)*(p-paths[lane*7+6])));nodes=max(nodes,exp(-n*n/.000010));
    }
    float flicker=.35+.65*pow(max(0.,sin(time*(7.+hash(11.)*4.)+seed)),8.);float presence=(.18*charge+.28*flicker*charge+.8*kick)*weight;
    float a=(core*.9+ion*.32)*presence+nodes*(.20+.60*kick)*weight;if(a<.008)discard;
    vec3 color=mix(vec3(.015,.10,.52),vec3(.07,.42,1.),ion);color=mix(color,vec3(.83,.97,1.),clamp(core*.86+nodes,0.,1.));gl_FragColor=vec4(color,clamp(a,0.,.92));
   }`});
 const mesh=new THREE.Mesh(source.geometry,material);mesh.name='shock-equipment-surface-wire';mesh.userData.comicOverlay=true;mesh.userData.presentationOnly=true;mesh.userData.borrowedGeometry=true;mesh.raycast=()=>{};mesh.renderOrder=4;source.add(mesh);return mesh;
}
