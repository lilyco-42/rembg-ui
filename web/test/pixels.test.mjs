import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,maskPixels} from '../pixels.mjs';
test('black input remains finite and RGB becomes CHW',()=>{
 assert.ok([...normalize(new Uint8Array(8))].every(Number.isFinite));
 const out=normalize(new Uint8Array([255,0,0,255,0,255,0,255]));
 assert.ok(Math.abs(out[0]-(1-.485)/.229)<1e-6);
 assert.ok(Math.abs(out[3]-(1-.456)/.224)<1e-6);
});
test('mask covers min/max and rejects invalid predictions',()=>{
 assert.deepEqual([...maskPixels([2,4])],[255,255,255,0,255,255,255,255]);
 assert.equal(maskPixels([4,4])[3],0);
 assert.throws(()=>maskPixels([NaN]));
});
