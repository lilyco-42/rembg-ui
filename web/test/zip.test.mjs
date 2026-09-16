import test from 'node:test';
import assert from 'node:assert/strict';
import {createZip} from '../zip.mjs';

test('multiple ZIP entries retain correct local offsets and payloads',async()=>{
 const layers=[{name:'a.png',bytes:new Uint8Array([1,2,3])},{name:'中文.json',bytes:new Uint8Array([4,5,6,7,8])}];
 const bytes=new Uint8Array(await createZip(layers).arrayBuffer()),view=new DataView(bytes.buffer);
 let central=view.getUint32(bytes.length-6,true);
 for(const layer of layers){
  assert.equal(view.getUint32(central,true),0x02014b50);
  const local=view.getUint32(central+42,true),length=view.getUint16(local+26,true);
  assert.equal(view.getUint32(local,true),0x04034b50);
  assert.equal(view.getUint32(local+18,true),layer.bytes.length);
  assert.deepEqual(bytes.slice(local+30+length,local+30+length+layer.bytes.length),layer.bytes);
  central+=46+view.getUint16(central+28,true);
 }
 assert.equal(central,bytes.length-22);
});
test('ZIP rejects excessive input before encoding',()=>{
 const megabyte=new Uint8Array(1024*1024);
 assert.throws(()=>createZip(Array.from({length:65},()=>({name:'x',bytes:megabyte}))),/64 MB/);
 assert.throws(()=>createZip([{name:'x'.repeat(65536),bytes:new Uint8Array()}]),/文件名/);
});
