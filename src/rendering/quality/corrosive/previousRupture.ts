import * as THREE from 'three';

// Preserved revision 3 rupture for same-build visual and timing comparison.
export const previousRuptureVertex=/* glsl */`
 attribute float film;attribute vec3 flow;uniform float age,size,seed;
 varying vec2 vUv;varying vec3 vN;varying vec3 vView;varying float vFilm;varying float vFlow;
 void main(){
  vFilm=film;vUv=uv;vFlow=flow.x;float opening=1.-pow(1.-clamp(age/.16,0.,1.),2.);
  vec3 p=position*(.035+.965*opening)*size;
  p+=flow*max(0.,age-.055)*(.2+.8*uv.y)*size;
  p.y-=3.6*age*age*(.3+.7*uv.y);
  vec4 mv=modelViewMatrix*vec4(p,1.);vN=normalize(normalMatrix*normal);vView=-mv.xyz;gl_Position=projectionMatrix*mv;
 }
`;
export const previousRuptureFragment=/* glsl */`
 uniform float age,seed;varying vec2 vUv;varying vec3 vN;varying vec3 vView;varying float vFilm;varying float vFlow;
 void main(){
  // Loss begins at the free edge; never punch repeated interior holes through the liquid.
  float start=vFlow<0.?.075:vFlow>.5?.18:.11;
  float end=vFlow<0.?.25:vFlow>.5?.43:.32;
  float notches=max(max(max(0.,1.-abs(vUv.x-.16)/.045)*.29,max(0.,1.-abs(vUv.x-.54)/.028)*.43),max(0.,1.-abs(vUv.x-.79)/.067)*.21);
  float freeEdge=1.-smoothstep(start,end,age)*.78-notches*smoothstep(.045,.14,age);
  if(vFilm<.5&&vUv.y>freeEdge)discard;
  float lip=pow(vUv.y,18.);float sideEdge=1.-smoothstep(.0,.045,min(vUv.x,1.-vUv.x));
  vec3 n=normalize(vN),view=normalize(vView);float light=dot(n,normalize(vec3(-.4,.7,1.)));
  vec3 c=mix(vec3(.013,.032,.0008),vec3(.20,.39,.005),smoothstep(-.4,.7,light));
  c=mix(c,vec3(.43,.68,.013),lip*.85);
  c=mix(c,vec3(.025,.045,.001),sideEdge*.25);
  float streak=pow(max(0.,1.-abs(vUv.x-(.22+.12*sin(vUv.y*3.+seed)))*18.),6.);
  float glint=pow(max(0.,dot(n,normalize(view+vec3(-.4,.7,1.)))),90.);
  c+=vec3(.64,.78,.40)*(streak*.43+glint*.52);
  if(vUv.y<.12)c=mix(c,vec3(.93,1.,.65),1.-smoothstep(.018,.06,age));
  float alpha=(.84+.10*lip)*(1.-smoothstep(.30,.46,age));if(alpha<.015)discard;
  gl_FragColor=vec4(c,alpha);
 }
`;
/** Three unequal, folded open fans and curved rivulets. No full-circle crown or repeated petals. */
export function createPreviousCorrosiveSplashGeometry():THREE.BufferGeometry{
 const positions:number[]=[],uv:number[]=[],film:number[]=[],flow:number[]=[],indices:number[]=[];
 const fans=[
  {angles:[2.60,3.40],lengths:[.10,.43,.78,.92,.84,.64,.44,.22,.06],flow:[-.55,-.08,.72]},
  {angles:[-.80,.50],lengths:[.20,.60,1.05,1.15,.74,.62,.87,.58,.28],flow:[.72,-.18,1.05]},
  {angles:[4.20,5.10],lengths:[.08,.26,.60,.76,.65,.56,.34,.16,.08],flow:[.15,-.55,.48]},
 ];
 for(const fan of fans){const segments=32,rings=7,base=positions.length/3;
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
   const u=i/segments,t=j/rings,a=THREE.MathUtils.lerp(fan.angles[0],fan.angles[1],u);
   const knot=u*(fan.lengths.length-1),k=Math.min(fan.lengths.length-2,Math.floor(knot)),f=knot-k;
   const edge=THREE.MathUtils.lerp(fan.lengths[k],fan.lengths[k+1],f*f*(3-2*f));
   const r=.012+t*edge;positions.push(Math.cos(a)*r*1.22,Math.sin(a)*r*.80,.26*t+.16*Math.sin(u*Math.PI)*Math.sin(t*Math.PI));
   uv.push(u,t);film.push(0);flow.push(...fan.flow);
   if(j<rings&&i<segments){const x=base+j*(segments+1)+i;indices.push(x,x+1,x+segments+1,x+1,x+segments+2,x+segments+1);}
  }
 }
 const rivulets=[[[0,0,0],[-.55,.08,.16],[-1.02,.25,.33],[-1.35,.02,.47]],[[0,0,0],[.45,-.04,.10],[.96,-.12,.29],[1.30,-.36,.46]],[[0,0,0],[.12,-.30,.10],[.27,-.62,.23],[.07,-1.06,.34]]];
 for(const [number,points]of rivulets.entries()){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),base=positions.length/3,velocity=fans[number].flow;
  for(let i=0;i<=20;i++){const t=i/20,p=curve.getPoint(t),tangent=curve.getTangent(t),side=new THREE.Vector3(-tangent.y,tangent.x,0).normalize(),width=.026*(1-t)+.004;
   for(const sign of[-1,1]){positions.push(p.x+side.x*width*sign,p.y+side.y*width*sign,p.z);uv.push(sign<0?0:1,t);film.push(1);flow.push(...velocity);}
   if(i<20){const x=base+i*2;indices.push(x,x+1,x+2,x+1,x+3,x+2);}
  }
  const bead=new THREE.SphereGeometry(.035+number*.006,8,6);bead.translate(...points[3] as [number,number,number]);const offset=positions.length/3;
  for(let i=0;i<bead.attributes.position.count;i++){const a=bead.attributes.position;positions.push(a.getX(i),a.getY(i),a.getZ(i));uv.push(.5,1);film.push(2);flow.push(...velocity);}for(const index of bead.index!.array)indices.push(offset+index);bead.dispose();
 }
 const g=new THREE.BufferGeometry();g.name='corrosive-folded-liquid-fans-v2';g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('film',new THREE.Float32BufferAttribute(film,1));g.setAttribute('flow',new THREE.Float32BufferAttribute(flow,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
