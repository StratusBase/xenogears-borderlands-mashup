import {runGravityLab} from './review';
import {gravityModule} from '../../../rendering/quality/gravity/response';
import {gravityReferenceModule} from './reference';
runGravityLab({current:(create,seed)=>gravityModule(create,{seed}),reference:create=>gravityReferenceModule(create),currentLabel:'DARK CORE + DISTORTION + WISPS / AFTER',description:'smooth deployment · contracting lens · fast ethereal inflow'});
