import {Game} from '../../../game';
import {createGameElements} from '../../../rendering/quality/gameElements';
import {setRadiationHardwareDebug} from '../../../rendering/quality/radiation/equipmentHardware';
import {BeforeRadiationEquipment} from './equipmentBefore';
import {radiationVerificationOptions,attachRadiationVerification} from './integrationVerification';

const game=new Game(document.querySelector<HTMLElement>('#app')!,{...radiationVerificationOptions,saveKey:'dust-steel.radiation.equipment.alignment'});
attachRadiationVerification(game,{title:'RADIATION / EQUIPMENT ALIGNMENT',equipmentControls:true,beforeLabel:'Before / tiny static side insert',beforeFactory:(scene,camera)=>{
 const layer=createGameElements(scene,camera),response=layer.responses.get('radiation')!;
 response.equipment=(root,appearance)=>{const visual=new BeforeRadiationEquipment(root,appearance);return{update:(_dt,time)=>visual.update(time),dispose:()=>visual.dispose()};};
 return layer;
}});
const debug=document.createElement('label');debug.innerHTML='<input id="equipment-debug" type="checkbox"> Highlight new hardware (inspection only)';document.querySelector('.signoff-panel')!.append(debug);debug.addEventListener('change',()=>setRadiationHardwareDebug((debug.querySelector('input')as HTMLInputElement).checked));
const toggle=document.createElement('button');toggle.textContent='Hide review controls';toggle.style.cssText='position:fixed;right:20px;top:20px;z-index:500;background:#17251d;color:#f5df3d;border:1px solid #9b9c61;padding:8px;cursor:pointer';document.body.append(toggle);toggle.addEventListener('click',()=>{const panel=document.querySelector<HTMLElement>('.signoff-panel')!;panel.hidden=!panel.hidden;toggle.textContent=panel.hidden?'Show review controls':'Hide review controls';});
const loot=document.createElement('label');loot.innerHTML='<input id="equipment-hide-loot" type="checkbox"> Hide loot card for equipment inspection';document.querySelector('.signoff-panel')!.append(loot);const style=document.createElement('style');style.textContent='.radiation-equipment-hide-loot [aria-label="World loot comparison"]{visibility:hidden}';document.head.append(style);loot.addEventListener('change',()=>document.body.classList.toggle('radiation-equipment-hide-loot',(loot.querySelector('input')as HTMLInputElement).checked));
game.run();
