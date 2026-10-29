import * as THREE from 'three';

// Unequal moving ribbons: a broad leading sheet, a short counter jet and a late trailing strand.
const streams=[
 {x:5.5,y:1.35,z:1.85,drag:5.5,width:.24,delay:0,tail:.06,end:.37},
 {x:-2.65,y:.55,z:1.25,drag:6.5,width:.085,delay:.016,tail:.045,end:.25},
 {x:.85,y:-3.1,z:1.35,drag:5.5,width:.038,delay:.038,tail:.08,end:.43},
];
const segments=28,crossings=4;

export function createCorrosiveSplashGeometry():THREE.BufferGeometry{
 const count=streams.length*(segments+1)*(crossings+1),positions=new Float32Array(count*3),uv=new Float32Array(count*2),lanes=new Float32Array(count),indices:number[]=[];
 let vertex=0;
 for(let lane=0;lane<streams.length;lane++)for(let i=0;i<=segments;i++)for(let j=0;j<=crossings;j++){
  uv[vertex*2]=i/segments;uv[vertex*2+1]=j/crossings;lanes[vertex]=lane;
  if(i<segments&&j<crossings){const a=vertex,b=a+crossings+1;indices.push(a,b,a+1,a+1,b,b+1);}vertex++;
 }
 const geometry=new THREE.BufferGeometry();geometry.name='corrosive-directional-moving-ribbons';
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('stream',new THREE.BufferAttribute(lanes,1));geometry.setIndex(indices);
 animateCorrosiveRupture(geometry,.001,0);return geometry;
}

/** Advects the liquid along unequal streams. The tail follows the head instead of scaling about a fixed center. */
export function animateCorrosiveRupture(geometry:THREE.BufferGeometry,age:number,seed:number,gravity=new THREE.Vector3(0,-1,0),surfaceLift=0):void{
 const positions=geometry.attributes.position as THREE.BufferAttribute,uv=geometry.attributes.uv,lanes=geometry.attributes.stream;
 const time=Number.isFinite(age)?Math.max(0,Math.min(.6,age)):0,phase=Number.isFinite(seed)?seed:0;
 for(let i=0;i<positions.count;i++){
  const lane=lanes.getX(i),s=streams[lane],t=Math.max(0,time-s.delay),u=uv.getX(i),across=uv.getY(i)*2-1;
  const travel=(1-Math.exp(-s.drag*t))/s.drag,tail=Math.min(.82,Math.max(0,t-s.tail)*2.8),q=tail+(1-tail)*u;
  const width=s.width*(1-Math.exp(-t*37))*Math.pow(Math.sin(Math.PI*u),.65)*(1-.42*u)*(1-.3*Math.min(1,t*3));
  const roll=.30+q*1.9+t*(lane===0?6.5:-7)+phase*.15;
  const fold=Math.sin(q*Math.PI*1.35+t*12+phase*.4)*q*q;
  const sag=3.1*t*t*q;
  let outward=.012+s.z*travel*q+Math.sin(q*Math.PI)*t*.25+across*width*Math.sin(roll)+across*across*width*.35+gravity.z*sag;
  if(surfaceLift>0){
   outward+=surfaceLift*.48*(1-Math.exp(-t*28))*Math.exp(-t*3.4)*(.18+.82*q);
   // Compress the returning fold smoothly onto the contact plane rather than through it.
   const clearance=outward-.006;outward=.006+(clearance+Math.sqrt(clearance*clearance+.0001))*.5;
  }
  positions.setXYZ(i,
   s.x*travel*q+fold*.055+across*width*Math.sin(roll)*.14+gravity.x*sag,
   s.y*travel*q+fold*.10+across*width*Math.cos(roll)+gravity.y*sag,
   outward);
 }
 positions.needsUpdate=true;
}

export const ruptureVertex=/* glsl */`
 attribute float stream;uniform float size;varying vec2 vUv;varying vec3 vView;varying float vStream;
 void main(){vUv=uv;vStream=stream;vec4 mv=modelViewMatrix*vec4(position*size,1.);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}
`;
export const ruptureFragment=/* glsl */`
 uniform float age,seed;varying vec2 vUv;varying vec3 vView;varying float vStream;
 void main(){
  float end=vStream<.5?.37:vStream<1.5?.25:.43;
  float begin=vStream<.5?0.:vStream<1.5?.016:.038;
  float t=max(0.,age-begin),side=abs(vUv.y*2.-1.);
  // Break only from the open sides and trailing edge; no punched interior holes.
  float bite=max(0.,1.-abs(vUv.x-.67)/.10)*.30+max(0.,1.-abs(vUv.x-.34)/.055)*.20;
  float edge=1.-bite*smoothstep(.08,.23,t);
  if(age<begin||side>edge||vUv.x<smoothstep(.12,.34,t)*.42)discard;
  vec3 normal=normalize(cross(dFdx(vView),dFdy(vView)));if(!gl_FrontFacing)normal=-normal;
  vec3 view=normalize(vView);float light=dot(normal,normalize(vec3(-.4,.7,1.)));
  vec3 color=mix(vec3(.016,.043,.001),vec3(.23,.43,.008),smoothstep(-.5,.8,light));
  float rim=smoothstep(.72,1.,side),tip=smoothstep(.82,1.,vUv.x);
  color=mix(color,vec3(.51,.74,.025),rim*.65+tip*.23);
  float streak=pow(max(0.,1.-abs(vUv.y-(.32+.16*sin(vUv.x*5.-t*8.+seed)))*12.),5.);
  float shine=pow(max(0.,dot(normal,normalize(view+vec3(-.4,.7,1.)))),65.);
  color+=vec3(.78,.91,.48)*(shine*.60+streak*.35);
  float alpha=.92*smoothstep(0.,.012,t)*(1.-smoothstep(end-.12,end,t));if(alpha<.018)discard;
  gl_FragColor=vec4(color,alpha);
 }
`;
