import type {GravityEvent,GravityFields} from '../../../core/effects/gravity/field';
import type {ElementalPresentation} from '../elementalPresentation';
import type {ElementResponse} from '../shared/composedPresentation';
import type {GravityView} from './response';

export type GravitySnapshot=ReturnType<GravityFields['snapshot']>;
/** A narrow capability adapter. Standalone renderers remain valid; this never advances gameplay. */
export function presentGravity(layer:ElementalPresentation|null,snapshot:GravitySnapshot,events:readonly GravityEvent[]=[]):void{
 const responses=(layer as (ElementalPresentation&{responses?:ReadonlyMap<string,ElementResponse>})|null)?.responses;
 const response=responses?.get('gravity') as Partial<GravityView>|undefined;
 if(!response?.sync||!response.event)return;
 for(const event of events)response.event(event);
 response.sync(snapshot);
}
