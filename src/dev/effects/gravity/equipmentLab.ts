import {runGravityLab} from './review';
import {gravityModule} from '../../../rendering/quality/gravity/response';
runGravityLab({current:(create,seed)=>gravityModule(create,{seed}),reference:(create,seed)=>gravityModule(create,{seed,equipment:'legacy'}),equipmentControls:true,referenceLabel:'PREVIOUS EQUIPMENT RINGS',currentLabel:'CONTAINED CORE + INWARD WISPS',description:'same world effects, combat and sound · equipment-only comparison'});
