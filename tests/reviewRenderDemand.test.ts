import test from 'node:test';
import assert from 'node:assert/strict';
import {ReviewRenderDemand} from '../src/dev/effects/shared/reviewRenderDemand.ts';
test('frozen review renders once, then only after invalidation; live/capture frames are never dropped',()=>{
 const demand=new ReviewRenderDemand();assert.equal(demand.admit(false),true);
 for(let i=0;i<300;i++)assert.equal(demand.admit(false),false);
 demand.invalidate();assert.equal(demand.admit(false),true);assert.equal(demand.admit(false),false);
 for(let i=0;i<840;i++)assert.equal(demand.admit(true),true);
 assert.deepEqual(demand.diagnostics,{draws:842,idleCallbacks:301,pending:false});
});
