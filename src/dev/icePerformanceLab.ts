import {configureIceLab} from './iceLabOptions';
import type {ElementalPresentation} from '../rendering/quality/elementalPresentation';
import {referenceIcePresentation} from 'virtual:ice-performance-reference';
const profile=new URLSearchParams(location.search).get('profile')==='1';
const endurance=new URLSearchParams(location.search).get('endurance')==='1';
configureIceLab({beforeFactory:(scene,camera)=>referenceIcePresentation(scene,camera) as ElementalPresentation,beforeLabel:'Accepted look / before optimization',afterLabel:'Accepted look / optimized',profile,measuredFrames:endurance?2160:720,prepareAfter:true,saveRecording:async(blob,name)=>{const response=await fetch(`/__ice_media/${name}`,{method:'POST',body:blob});if(!response.ok)throw new Error('Local media save failed');},saveRun:async(scene,label,run)=>{const response=await fetch(`/__ice_evidence/${profile?'profile':'timing'}-${scene}-${label}.json`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(run)});if(!response.ok)throw new Error('Local evidence save failed');}});
void import('./iceLab');
