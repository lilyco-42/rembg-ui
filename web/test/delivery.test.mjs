import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryManifest,outputName} from '../delivery.mjs';
import {createZip} from '../zip.mjs';
test('delivery excludes failed and unreviewed items without hiding them',()=>{
 const items=[{source:'商品.jpg',status:'done',reviewed:true},{source:'商品.jpg',status:'done',reviewed:false},{source:'bad.jpg',status:'error',error:'decode'}];
 const manifest=deliveryManifest(items,1200,true);
 assert.deepEqual(manifest.items.map(i=>i.exported),[true,false,false]);
 assert.equal(manifest.items[2].error,'decode');
 assert.notEqual(manifest.items[0].product,manifest.items[1].product);
 assert.deepEqual(deliveryManifest(items,0,false).items.map(i=>i.exported),[true,true,false]);
 assert.equal(outputName('../test.jpg',0,'product'),'product_.._test_001.png');
});
test('ZIP writes UTF-8 flags and matching local / central entries',async()=>{
 const bytes=new Uint8Array(await createZip([{name:'商品.png',bytes:new TextEncoder().encode('hello')}]).arrayBuffer());
 const view=new DataView(bytes.buffer);
 assert.equal(view.getUint32(0,true),0x04034b50);
 assert.equal(view.getUint16(6,true),0x800);
 assert.equal(view.getUint32(14,true),0x3610a686);
 const nameLength=view.getUint16(26,true);
 assert.equal(new TextDecoder().decode(bytes.slice(30,30+nameLength)),'商品.png');
 const central=30+nameLength+5;
 assert.equal(view.getUint32(central,true),0x02014b50);
 assert.equal(view.getUint16(bytes.length-12,true),1);
});
