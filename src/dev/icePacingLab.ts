import {configureIceLab} from './iceLabOptions';
import type {ElementalPresentation} from '../rendering/quality/elementalPresentation';
import {referenceIcePresentation} from 'virtual:ice-pacing-reference';
const params=new URLSearchParams(location.search),profile=params.get('profile')==='1',tag=params.get('tag')??'run';
if(!/^[a-z0-9-]+$/.test(tag))throw new Error('Invalid local receipt tag');
configureIceLab({beforeFactory:(scene,camera)=>referenceIcePresentation(scene,camera)as ElementalPresentation,beforeLabel:'Retained Ice / f613d74 reference',afterLabel:'Current Ice / identical accepted art',prepareBefore:true,prepareAfter:true,primeSceneGeometry:true,profile,pacing:true,evaluationHud:params.get('hud')==='native'?'native':params.get('hud')==='compare'?'compare-native':'step',runOrder:params.get('reverse')==='1'?'BAB':'ABA',measuredFrames:params.get('endurance')==='1'?2160:720,
 environment:async()=>{const r=await fetch('/__ice_pacing/host.json');if(!r.ok)throw new Error('Host metrics unavailable');return r.json();},
 saveRun:async(scene,label,run)=>{const r=await fetch(`/__ice_pacing/${tag}-${profile?'profile':'timing'}-${scene}-${label}.json`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(run)});if(!r.ok)throw new Error('Receipt export failed');},
 saveRecording:async(blob,name)=>{const r=await fetch(`/__ice_pacing/${tag}-${name}`,{method:'POST',body:blob});if(!r.ok)throw new Error('Media export failed');}});
void import('./iceLab');
