import * as THREE from 'three';
import {ResinMask} from '../../../rendering/quality/adhesive/surfaces';
import {referenceVariedStainFragment} from '../../../rendering/quality/adhesive/stainShader';
import {createStainProfile} from '../../../rendering/quality/adhesive/stains';
import {distribution} from '../../../rendering/quality/performance';

// Diagnostic only: amplifies the actual mask shaders, not a second gameplay renderer.
// Full Game measurements and audio are collected separately in adhesive-lab.html.
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(1440,900);renderer.setClearColor(0x282218);document.body.append(renderer.domElement);
const camera=new THREE.OrthographicCamera(-1.6,1.6,1,-1,.1,10);camera.position.z=2;
const scene=new THREE.Scene(),source=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2),new THREE.MeshBasicMaterial({visible:false}));source.userData.effectSurface='armor';scene.add(source);
const masks={reference:new ResinMask(source,'honey','varied','reference'),optimized:new ResinMask(source,'honey','varied','optimized')};
const gl=renderer.getContext() as WebGL2RenderingContext,timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
const panel=document.createElement('aside');panel.innerHTML='<h1>Adhesive stain kernel / isolated GPU diagnostic</h1><p>Actual ResinMask shaders and honey profiles; no Game, postprocessing or audio. Eight repeated draws amplify mask cost. Results are separate from full gameplay.</p><button id="kernel-run">Run alternating GPU profile</button><output id="kernel-state">Ready</output><pre id="kernel-results">{}</pre>';document.body.append(panel);
Object.assign(document.body.style,{background:'#171711',color:'#eedda9',font:'16px system-ui',margin:'20px'});Object.assign(renderer.domElement.style,{width:'min(100%,960px)',height:'auto'});
const results:unknown[]=[],pending:{query:WebGLQuery;kind:keyof typeof masks;measured:boolean}[]=[],samples={reference:[] as number[],optimized:[] as number[]},cpu={reference:[] as number[],optimized:[] as number[]};
const repeats=8,warmup=80,measured=240;let running=false,frame=0,caseIndex=0,disjoint=0;
function state(text:string){document.querySelector('#kernel-state')!.textContent=text;}
function publish(){document.querySelector('#kernel-results')!.textContent=JSON.stringify({protocol:{repeats,warmupFrames:warmup,measuredFrames:measured,order:'ABBA every four displayed frames, 120 samples per shader per case',width:1440,height:900,scope:'Mask-only GPU/CPU per draw; not full Game or audio',disjoint},results},null,2);}
function show(kind:keyof typeof masks){for(const key of ['reference','optimized']as const)masks[key].mesh.visible=key===kind;}
function setup(){
 for(const mask of Object.values(masks)){mask.dispose();}
 masks.reference=new ResinMask(source,'honey','varied','reference');masks.optimized=new ResinMask(source,'honey','varied','optimized');
 const points=caseIndex===0?[[0,0]]:[[-.65,-.45],[.65,-.45],[-.65,.45],[.65,.45]];
 for(const mask of Object.values(masks))for(const [i,[x,y]]of points.entries()){mask.contact(new THREE.Vector3(x,y,0),caseIndex===0?.65:.32,new THREE.Vector3(0,0,1),createStainProfile(37391+i,i),new THREE.Vector3(1,0,0));mask.update(.4,1);}
 // Pixel equality is outside the timed region, using the same renderer and actual masks.
 const pixels=[];for(const kind of ['reference','optimized']as const){show(kind);renderer.render(scene,camera);const data=new Uint8Array(1440*900*4);gl.readPixels(0,0,1440,900,gl.RGBA,gl.UNSIGNED_BYTE,data);pixels.push(data);}
 let differentChannels=0;for(let i=0;i<pixels[0].length;i++)if(pixels[0][i]!==pixels[1][i])differentChannels++;
 results.push({case:caseIndex===0?'one active contact / two lobes':'four separated contacts / 2–4 lobes',differentChannels,optimizedPath:masks.optimized.material.fragmentShader===referenceVariedStainFragment?'exact reference fallback':'sparse fast path'});
 frame=0;samples.reference=[];samples.optimized=[];cpu.reference=[];cpu.optimized=[];state(`Profiling case ${caseIndex+1} / 2`);
}
function finishCase(){Object.assign(results.at(-1) as object,{gpuMsPerDraw:{reference:distribution(samples.reference),optimized:distribution(samples.optimized)},submitMsPerDraw:{reference:distribution(cpu.reference),optimized:distribution(cpu.optimized)},gpuSamples:{reference:[...samples.reference],optimized:[...samples.optimized]},sampleCounts:{reference:samples.reference.length,optimized:samples.optimized.length}});publish();if(++caseIndex<2)setup();else{running=false;state('Complete / alternating GPU samples / raw results retained');}}
document.querySelector('#kernel-run')!.addEventListener('click',()=>{if(running)return;if(!timer){state('GPU timer unavailable');return;}results.length=0;caseIndex=0;disjoint=0;running=true;setup();});
renderer.setAnimationLoop(()=>{
 if(!timer)return;
 while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){const p=pending.shift()!;if(gl.getParameter(timer.GPU_DISJOINT_EXT))disjoint++;else if(p.measured)samples[p.kind].push(gl.getQueryParameter(p.query,gl.QUERY_RESULT)/1e6/repeats);gl.deleteQuery(p.query);}
 if(!running)return;
 if(frame>=warmup+measured){if(!pending.length)finishCase();return;}
 const kind=frame%4===0||frame%4===3?'reference':'optimized',query=gl.createQuery();if(!query)return;show(kind);const start=performance.now();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);for(let i=0;i<repeats;i++)renderer.render(scene,camera);gl.endQuery(timer.TIME_ELAPSED_EXT);if(frame>=warmup)cpu[kind].push((performance.now()-start)/repeats);pending.push({query,kind,measured:frame>=warmup});frame++;
});
window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);for(const p of pending)gl.deleteQuery(p.query);for(const mask of Object.values(masks))mask.dispose();source.geometry.dispose();source.material.dispose();renderer.dispose();});
