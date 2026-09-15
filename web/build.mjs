import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out = new URL('./dist/', import.meta.url);
await mkdir(new URL('vendor/',out), {recursive:true});
await mkdir(new URL('models/',out), {recursive:true});
for (const name of ['index.html','app.mjs','worker.mjs','pixels.mjs','zip.mjs','delivery.mjs','project-store.mjs','presets.mjs']) await copyFile(new URL(name,import.meta.url),new URL(name,out));
for (const name of ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']) await copyFile(new URL(`node_modules/onnxruntime-web/dist/${name}`,import.meta.url),new URL(`vendor/${name}`,out));
const runtimeLicense=await fetch('https://raw.githubusercontent.com/microsoft/onnxruntime/v1.22.0/LICENSE');
if(!runtimeLicense.ok) throw Error('Cannot fetch ONNX Runtime license');
await writeFile(new URL('vendor/ONNX-Runtime-LICENSE',out),await runtimeLicense.text());
const notices=await fetch('https://raw.githubusercontent.com/microsoft/onnxruntime/v1.22.0/ThirdPartyNotices.txt');
if(!notices.ok) throw Error('Cannot fetch ONNX Runtime third-party notices');
await writeFile(new URL('vendor/ThirdPartyNotices.txt',out),await notices.text());
const target = new URL('models/u2netp.onnx',out);
const expected = '8e83ca70e441ab06c318d82300c84806';
let bytes;
try {bytes=await readFile(target);} catch {}
if (!bytes || createHash('md5').update(bytes).digest('hex')!==expected) {
 const response=await fetch('https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx');
 if(!response.ok) throw Error(`Model download HTTP ${response.status}`);
 bytes=Buffer.from(await response.arrayBuffer());
 if(createHash('md5').update(bytes).digest('hex')!==expected) throw Error('Model checksum mismatch');
 await writeFile(target,bytes);
}
const license=await fetch('https://raw.githubusercontent.com/xuebinqin/U-2-Net/ac7e1c817ecab7c7dff5ce6b1abba61cd213ff29/LICENSE');
if(!license.ok) throw Error('Cannot fetch U2Net license');
await writeFile(new URL('models/LICENSE',out),await license.text());
await writeFile(new URL('.nojekyll',out),'');
console.log('Built static WASM site; verified U2Netp:',bytes.length,'bytes');
