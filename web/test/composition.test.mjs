import test from 'node:test';
import assert from 'node:assert/strict';
import {composeProduct} from '../composition.mjs';

test('composition scans bounded strips and releases its product canvas',async()=>{
 const calls=[];let created;
 const previous=globalThis.OffscreenCanvas;
 globalThis.OffscreenCanvas=class {
  constructor(w,h){this.width=w;this.height=h;created=this;}
  getContext(){return {fillRect(){},drawImage(...args){calls.push(args);}};}
  async convertToBlob(){return new Blob(['product']);}
 };
 try{
  const cutout={width:10,height:130,getContext:()=>({getImageData(x,y,w,h){assert.ok(h<=64);const data=new Uint8ClampedArray(w*h*4);data[3]=255;return {data};}})};
  assert.equal(await (await composeProduct(cutout,1200)).text(),'product');
  assert.equal(calls.length,1);assert.equal(created.width,1);assert.equal(created.height,1);
  const empty={width:1,height:1,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(4)})})};
  await assert.rejects(composeProduct(empty,1200),/未检测到主体/);
 }finally{globalThis.OffscreenCanvas=previous;}
});
