import {execFileSync} from 'node:child_process';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlayerBallistics as After} from '../src/rendering/PlayerBallistics.ts';
import {createWeaponSpec} from '../src/core/arsenal.ts';
const baselineRef=process.env.BALLISTIC_BASELINE_REF??'ddb86b155e4e9979303894a0501b544458997f3d';
const original=execFileSync('git',['show',`${baselineRef}:src/rendering/PlayerBallistics.ts`],{encoding:'utf8'}),hash=s=>createHash('sha256').update(s).digest('hex');
const baselineHash=hash(original);assert.equal(baselineHash,process.env.BALLISTIC_BASELINE_SHA256??'e4982efda69045d20aefe08b9d7e3d867374d7d76ed8302ec6d2940aafc69c33','Pinned engine must match the recorded starting source');
const outputDirectory=process.env.BALLISTIC_OUTPUT_DIR??'artifacts/corrosive-ab';
const baselineFile=resolve(outputDirectory,'baseline-PlayerBallistics.ts');
const imports=original.replace(/from '(\.[^']+)'/g,(_,specifier)=>`from '${resolve('src/rendering',specifier)}.ts'`);
await writeFile(baselineFile,imports);
const module=await import(pathToFileURL(baselineFile).href),Before=module.PlayerBallistics??module.default.PlayerBallistics;
function run(Engine,projectile){
 const scene=new THREE.Scene(),targets=[],covers=[],hits=[],trajectory=[];
 for(const[id,x,z]of[[1,0,-6],[2,1.7,-6],[3,3,-6],[4,-1.7,-6]]){const root=new THREE.Group();root.position.set(x,1,z);const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1.8,1),new THREE.MeshBasicMaterial());mesh.userData.enemyId=id;mesh.userData.critical=id===3;root.add(mesh);scene.add(root);targets.push({id,root,radius:1});}
 const cover=new THREE.Mesh(new THREE.BoxGeometry(.2,4,3),new THREE.MeshBasicMaterial());cover.position.set(-.8,1,-5.4);scene.add(cover);covers.push(cover);
 let time=0;const ballistics=new Engine(scene,{targets:()=>targets,occluders:()=>covers,hit:h=>hits.push({at:time,id:h.targetId,p:h.point.toArray(),d:h.direction.toArray(),damage:h.damage,critical:h.critical,spec:h.spec})});
 ballistics.setPresentation({projectile:()=>{const g=new THREE.Group();g.name='compat-live';return g;},trail:()=>new THREE.Group(),beam:()=>new THREE.Group(),impact(){},splash(){}});
 const spec=createWeaponSpec(projectile,'corrosive','pilot');spec.secondaryElement='fire';const recipe=JSON.stringify(spec);
 for(let i=0;i<600;i++){time=i/120;targets[1].root.position.x=1.7+Math.sin(time*2)*.25;if([0,48,120].includes(i))ballistics.fire(new THREE.Vector3(0,1,2),new THREE.Vector3(0,0,-1),spec,70,50);ballistics.update(1/120);trajectory.push({active:ballistics.activeCount,transforms:scene.children.filter(o=>o.name==='compat-live').map(o=>({p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray()}))});}
 assert.equal(JSON.stringify(spec),recipe);ballistics.clear();return{hits,trajectory};
}
const results=[];for(const projectile of['bullet','slug','spike','ricochet','homing','sticky','orb','beam','scatter','rocket','disc','arc','cluster']){const a=run(Before,projectile),b=run(After,projectile);assert.deepEqual(b,a,projectile+' must preserve exact pre-change hits/flight');results.push({projectile,hits:a.hits.length,steps:a.trajectory.length,exact:true,traceSHA256:hash(JSON.stringify(a))});}
const current=await readFile('src/rendering/PlayerBallistics.ts','utf8');const result={capturedAt:new Date().toISOString(),baselineRef,baselineSourceSHA256:baselineHash,currentSourceSHA256:hash(current),protocol:'Exact source-before vs source-after engine replay: three shots, moving neighboring target, critical target and occluding cover, 600 x 1/120 updates per delivery. Identical hit order/time/coordinates/direction/damage/critical/spec plus every active projectile transform/count. Only import specifiers in the archived baseline were rewritten for local resolution.',results};await writeFile(resolve(outputDirectory,'ballistics-before-after.json'),JSON.stringify(result,null,2)+'\n');console.log('PASS exact pre-change engine compatibility:',results.length,'deliveries');
