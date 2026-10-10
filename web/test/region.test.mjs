import test from 'node:test';
import assert from 'node:assert/strict';
import {MIN_REGION,normalizeBox,validateRegion} from '../region.mjs';

test('normalizes a forward drag',()=>{
 assert.equal(MIN_REGION,16);
 assert.deepEqual(normalizeBox({x:20,y:30},{x:60,y:80},100,100),{x:20,y:30,w:40,h:50});
});

test('normalizes a reverse drag to the same box',()=>{
 assert.deepEqual(normalizeBox({x:20,y:30},{x:60,y:80},100,100),normalizeBox({x:60,y:80},{x:20,y:30},100,100));
});

test('floors left and top and ceils right and bottom',()=>{
 assert.deepEqual(normalizeBox({x:10.2,y:12.8},{x:26.1,y:29.01},100,100),{x:10,y:12,w:17,h:18});
});

test('clamps a drag beyond the image bounds',()=>{
 assert.deepEqual(normalizeBox({x:-10,y:-20},{x:110,y:120},100,100),{x:0,y:0,w:100,h:100});
});

test('returns null for a 15-pixel-wide box',()=>{
 assert.equal(normalizeBox({x:10,y:10},{x:25,y:30},100,100),null);
});

test('accepts a box exactly 16 by 16 pixels',()=>{
 assert.deepEqual(normalizeBox({x:10,y:10},{x:26,y:26},100,100),{x:10,y:10,w:16,h:16});
});

test('returns null for a zero-size click',()=>{
 assert.equal(normalizeBox({x:10,y:10},{x:10,y:10},100,100),null);
});

test('rejects malformed dimensions and non-finite pointer coordinates',()=>{
 for(const width of [0,-1,100.5,Infinity,NaN])assert.equal(normalizeBox({x:0,y:0},{x:40,y:40},width,100),null);
 assert.equal(normalizeBox({x:NaN,y:0},{x:40,y:40},100,100),null);
});

test('worker region validation permits the exact image boundary',()=>{
 assert.deepEqual(validateRegion({x:84,y:84,w:16,h:16},100,100),{x:84,y:84,w:16,h:16});
});

test('worker region validation rejects out-of-bounds, fractional and small regions',()=>{
 for(const region of [null,{}, {x:-1,y:0,w:20,h:20},{x:0,y:0,w:15,h:20},
  {x:0.5,y:0,w:20,h:20},{x:90,y:0,w:20,h:20},{x:0,y:90,w:20,h:20},
  {x:0,y:0,w:Infinity,h:20}])assert.throws(()=>validateRegion(region,100,100),/选区/);
});
