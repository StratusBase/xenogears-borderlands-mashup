import assert from 'node:assert/strict';
import test from 'node:test';
import { qualityRecoilEnvelope } from '../src/rendering/quality/motion.ts';
import { distribution } from '../src/rendering/quality/performance.ts';

test('heavy presentation settles later than pilot and both return exactly to rest',()=>{
 assert.equal(qualityRecoilEnvelope('pilot',-1),0);assert.equal(qualityRecoilEnvelope('mech',NaN),0);
 assert.equal(qualityRecoilEnvelope('pilot',0),0);assert.equal(qualityRecoilEnvelope('pilot',.17),0);
 assert.ok(qualityRecoilEnvelope('mech',.2)>.1);assert.equal(qualityRecoilEnvelope('pilot',.2),0);
 assert.equal(qualityRecoilEnvelope('mech',.43),0);
});
test('performance distributions retain tails and reject unavailable measurements',()=>{
 assert.deepEqual(distribution([5,1,3,2,4,NaN]),{median:3,p95:5,min:1,max:5});
 assert.deepEqual(distribution([]),{median:0,p95:0,min:0,max:0});
});
