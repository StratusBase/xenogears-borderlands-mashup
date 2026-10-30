import {runGravityLab} from './review';
import {gravityModule} from '../../../rendering/quality/gravity/response';
import {gravityModule as previousTiming} from 'virtual:gravity-timing-response';
runGravityLab({current:(create,seed)=>gravityModule(create,{seed}),reference:(create,seed)=>previousTiming(create,{seed}),currentLabel:'READABLE INFLOW / 0.65 s COLLAPSE',referenceLabel:'PREVIOUS INFLOW / 0.34 s COLLAPSE',description:'same core, equipment, physics and sound · cosmetic timing comparison'});
