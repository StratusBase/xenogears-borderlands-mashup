import {runGravityLab} from './review';
import {gravityModule} from '../../../rendering/quality/gravity/response';
import {gravityModule as pressureModule} from 'virtual:gravity-pressure-before';
runGravityLab({current:(create,seed)=>gravityModule(create,{seed}),reference:(create,seed)=>pressureModule(create,{seed}),referenceLabel:'PRESSURE BANDS / BEFORE',currentLabel:'DARK CORE + DISTORTION + WISPS / AFTER',description:'smooth deployment · rapidly contracting lens · fast ethereal inflow'});
