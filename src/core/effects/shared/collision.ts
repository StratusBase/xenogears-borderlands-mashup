import {finiteVector,copyVector,type EffectVector,type EffectBounds,type EffectBody} from '../contracts';

const EPS=.0001;
function expanded(b:EffectBounds,body:EffectBody):EffectBounds{return{minX:b.minX-body.radius,maxX:b.maxX+body.radius,minY:b.minY-body.halfHeight,maxY:b.maxY+body.halfHeight,minZ:b.minZ-body.radius,maxZ:b.maxZ+body.radius};}
function inside(p:EffectVector,b:EffectBounds){return p.x>b.minX+EPS&&p.x<b.maxX-EPS&&p.y>b.minY+EPS&&p.y<b.maxY-EPS&&p.z>b.minZ+EPS&&p.z<b.maxZ-EPS;}
export function effectBodyClear(p:EffectVector,body:EffectBody,solids:readonly EffectBounds[]):boolean{
 return finiteVector(p)&&p.y>=body.halfHeight-EPS&&solids.every(b=>!inside(p,expanded(b,body)));
}
/** Resolve a proposed stationary pose above low support. Movement still requires a separate sweep. */
export function supportedEffectPose(desired:EffectVector,body:EffectBody,solids:readonly EffectBounds[],maxRise=3):EffectVector{
 const p={...desired,y:Math.max(body.halfHeight,desired.y)};
 for(let pass=0;pass<=solids.length;pass++){
  const hits=solids.filter(b=>inside(p,expanded(b,body)));if(!hits.length)return p;
  const y=Math.max(...hits.map(b=>b.maxY+body.halfHeight+EPS));if(y-desired.y>maxRise)return copyVector(desired);p.y=y;
 }
 return copyVector(desired);
}
function firstHit(p:EffectVector,d:EffectVector,b:EffectBounds){
 let near=-Infinity,far=Infinity,normal:EffectVector={x:0,y:0,z:0};
 for(const axis of ['x','y','z']as const){const min=b[axis==='x'?'minX':axis==='y'?'minY':'minZ'],max=b[axis==='x'?'maxX':axis==='y'?'maxY':'maxZ'];
  if(Math.abs(d[axis])<1e-10){if(p[axis]<=min+EPS||p[axis]>=max-EPS)return;continue;}
  const a=(min-p[axis])/d[axis],c=(max-p[axis])/d[axis],entry=Math.min(a,c);
  if(entry>near){near=entry;normal={x:0,y:0,z:0};normal[axis]=d[axis]>0?-1:1;}
  far=Math.min(far,Math.max(a,c));if(near>far)return;
 }
 if(near< -EPS||near>1||far<0)return;return{t:Math.max(0,near),normal};
}
/** Swept expanded-body collision with sliding. Returning endpoints never tunnel through thin solids. */
export function sweepEffectBody(start:EffectVector,end:EffectVector,body:EffectBody,solids:readonly EffectBounds[]):EffectVector{
 if(!finiteVector(start)||!finiteVector(end)||!effectBodyClear(start,body,solids))return copyVector(start);
 let p=copyVector(start),d={x:end.x-start.x,y:end.y-start.y,z:end.z-start.z};
 for(let pass=0;pass<4;pass++){
  let hit:{t:number;normal:EffectVector}|undefined;
  if(d.y<0&&p.y+d.y<body.halfHeight)hit={t:Math.max(0,(body.halfHeight-p.y)/d.y),normal:{x:0,y:1,z:0}};
  for(const solid of solids){const candidate=firstHit(p,d,expanded(solid,body));if(candidate&&(!hit||candidate.t<hit.t))hit=candidate;}
  if(!hit){p={x:p.x+d.x,y:p.y+d.y,z:p.z+d.z};break;}
  const length=Math.hypot(d.x,d.y,d.z),t=Math.max(0,hit.t-EPS/Math.max(EPS,length));
  p={x:p.x+d.x*t,y:p.y+d.y*t,z:p.z+d.z*t};
  const remaining=1-t,dot=d.x*hit.normal.x+d.y*hit.normal.y+d.z*hit.normal.z;
  d={x:(d.x-dot*hit.normal.x)*remaining,y:(d.y-dot*hit.normal.y)*remaining,z:(d.z-dot*hit.normal.z)*remaining};
  if(Math.hypot(d.x,d.y,d.z)<EPS)break;
 }
 p.y=Math.max(body.halfHeight,p.y);return effectBodyClear(p,body,solids)?p:copyVector(start);
}

export function effectLineClear(a:EffectVector,b:EffectVector,solids:readonly EffectBounds[]):boolean{
 if(!finiteVector(a)||!finiteVector(b))return false;const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
 return !solids.some(box=>inside(a,box)||!!firstHit(a,d,box));
}
