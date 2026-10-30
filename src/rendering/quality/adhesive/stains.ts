import {cosmeticSample} from '../shared/variation';

export type ResinStainStyle='fixed'|'varied';
export const STAIN_VARIANTS=['drawn-tack','broad-pool','canted-wedge','low-slump','offset-pad'] as const;
export interface StainLobe {readonly x:number;readonly y:number;readonly rx:number;readonly ry:number}
export interface StainProfile {readonly seed:number;readonly variant:number;readonly angle:number;readonly lobes:readonly StainLobe[]}
type Lobe=readonly [number,number,number,number];
const forms:readonly (readonly Lobe[])[]=[
 [[0,0,.64,.61],[.40,.12,.85,.34]],
 [[0,0,.87,.55],[.08,.18,.65,.77],[-.28,-.10,.69,.49]],
 [[0,0,.66,.58],[.35,.24,.79,.43],[-.12,-.25,.44,.68],[.20,-.10,.71,.38]],
 [[0,0,.81,.43],[.04,-.29,.51,.75],[-.30,-.06,.67,.40]],
 [[0,0,.62,.67],[.24,.24,.69,.57],[-.24,.11,.65,.40],[.13,-.25,.44,.69]],
];
const RAYS=Array.from({length:48},(_,i)=>[Math.cos(i*Math.PI/24),Math.sin(i*Math.PI/24)] as const);
/** Star-shaped union area from analytic ray/ellipse exits; no per-event raster grid. */
export function stainArea(lobes:readonly StainLobe[]){
 let sum=0;for(const[x,y]of RAYS){let radius=0;for(const l of lobes){const xx=1/(l.rx*l.rx),yy=1/(l.ry*l.ry),a=x*x*xx+y*y*yy,b=-2*(x*l.x*xx+y*l.y*yy),c=l.x*l.x*xx+l.y*l.y*yy-1;radius=Math.max(radius,(-b+Math.sqrt(Math.max(0,b*b-4*a*c)))/(2*a));}sum+=radius*radius;}return sum*Math.PI/RAYS.length;
}
export const FIXED_STAIN_AREA=stainArea([{x:.12,y:-.03,rx:1/.90,ry:1/1.25},{x:-.27,y:.10,rx:1/1.5,ry:1/1.65},{x:.03,y:-.38,rx:1/2.1,ry:1/1.2}]);
/** Closed connected unions, not a radial crown. Every ellipse contains the contact origin. */
export function createStainProfile(seed:number,variant:number,downAngle?:number):StainProfile {
 const family=((variant%forms.length)+forms.length)%forms.length,r=(i:number,a:number,b:number)=>a+(b-a)*cosmeticSample(seed,i);
 const lobes=forms[family].map(([x,y,rx,ry],i)=>{
  rx*=r(8+i*4,.84,1.16);ry*=r(9+i*4,.84,1.16);x+=r(10+i*4,-.09,.09);y+=r(11+i*4,-.09,.09);
  if(i===0){x=0;y=0;}const distance=Math.hypot(x/rx,y/ry);if(distance>.88){x*=.88/distance;y*=.88/distance;}
  return{x,y,rx,ry};
 });
 // Keep the same nominal radius input and bound every outline inside 1.25 radii.
 const extent=Math.max(...lobes.map(l=>Math.hypot(l.x,l.y)+Math.max(l.rx,l.ry))),scale=1.25/extent;
 for(const l of lobes){l.x*=scale;l.y*=scale;l.rx*=scale;l.ry*=scale;}
 const target=FIXED_STAIN_AREA*r(31,.96,1.04),area=stainArea(lobes);
 if(area>target){const s=Math.sqrt(target/area);for(const l of lobes){l.x*=s;l.y*=s;l.rx*=s;l.ry*=s;}}
 else{
  const original={...lobes[0]},aspect=[1.23,.82,1.12,1.25,.86][family]*r(32,.95,1.05);let lo=0,hi=1.25;
  for(let i=0;i<9;i++){const t=(lo+hi)*.5;lobes[0].rx=Math.max(original.rx,Math.min(1.25,t*aspect));lobes[0].ry=Math.max(original.ry,Math.min(1.25,t/aspect));if(stainArea(lobes)<target)lo=t;else hi=t;}
 }
 const mass=lobes.slice(1).reduce((v,l)=>({x:v.x+l.x*l.rx*l.ry,y:v.y+l.y*l.rx*l.ry}),{x:0,y:0}),heavy=Math.atan2(mass.y,mass.x);
 const angle=downAngle===undefined?r(2,0,Math.PI*2):downAngle-heavy+r(2,-.78,.78);
 return Object.freeze({seed:seed>>>0,variant:family,angle,lobes:Object.freeze(lobes.map(l=>Object.freeze(l)))});
}
/** Review/test sampling in the contact plane. Runtime uses the same ellipse distance in GLSL. */
export function stainDistance(profile:StainProfile,x:number,y:number){
 const c=Math.cos(profile.angle),s=Math.sin(profile.angle),u=c*x+s*y,v=-s*x+c*y;
 return Math.min(...profile.lobes.map(l=>Math.hypot((u-l.x)/l.rx,(v-l.y)/l.ry)));
}
