import test from 'node:test';
import assert from 'node:assert/strict';
import {exportProjectArchive,importProjectArchive} from '../project-archive.mjs';

function project(){return {schemaVersion:1,size:1200,reviewedOnly:true,items:[{id:'a',source:'商品.jpg',file:new File(['source'],'商品.jpg',{type:'image/jpeg',lastModified:42}),status:'done',reviewed:true,imageRevision:2,reviewedRevision:2,output:{product:new Blob(['product'],{type:'image/png'}),transparent:new Blob(['transparent'],{type:'image/png'})}}]};}

test('portable project archive round-trips source, outputs, settings and revision review',async()=>{
 const restored=await importProjectArchive(await exportProjectArchive(project()));
 assert.equal(restored.size,1200);assert.equal(restored.reviewedOnly,true);assert.equal(restored.items[0].source,'商品.jpg');
 assert.equal(restored.items[0].file.type,'image/jpeg');assert.equal(restored.items[0].file.lastModified,42);assert.equal(await restored.items[0].file.text(),'source');
 assert.equal(await restored.items[0].output.product.text(),'product');assert.equal(restored.items[0].imageRevision,2);assert.equal(restored.items[0].reviewedRevision,2);assert.equal(restored.items[0].reviewed,true);
});

test('processing archive restores as pending and cannot retain stale output',async()=>{
 const input=project();input.items[0].status='processing';input.items[0].reviewed=false;delete input.items[0].output;
 const restored=await importProjectArchive(await exportProjectArchive(input));
 assert.equal(restored.items[0].status,'pending');assert.equal(restored.items[0].reviewed,false);assert.equal('output' in restored.items[0],false);
});

test('tampered archive bytes are rejected by CRC and malformed project content fails closed',async()=>{
 const archive=new Uint8Array(await (await exportProjectArchive(project())).arrayBuffer());
 // Flip the first payload byte; the central-directory CRC must catch it.
 const localName=archive[26]|(archive[27]<<8),payload=30+localName;archive[payload]^=1;
 await assert.rejects(importProjectArchive(new Blob([archive],{type:'application/zip'})),/校验失败/);
});
